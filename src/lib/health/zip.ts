/**
 * Lecteur ZIP minimal pour le navigateur (sans dépendance) : lit le répertoire central puis
 * décompresse un fichier en flux avec DecompressionStream("deflate-raw").
 * Gère ZIP64 (les exports Apple Santé dépassent souvent 4 Go une fois décompressés).
 */

export type ZipEntry = { name: string; method: number; compSize: number; size: number; localOffset: number };

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);
const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true));

async function view(file: Blob, start: number, end: number) {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

export async function listZip(file: Blob): Promise<ZipEntry[]> {
  const tailLen = Math.min(file.size, 65557 + 20);
  const tailStart = file.size - tailLen;
  const tail = await view(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Ce fichier n'est pas une archive ZIP valide.");
  let count = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20;
    if (loc < 0 || u32(tail, loc) !== 0x07064b50) throw new Error("Archive ZIP64 illisible.");
    const z64 = u64(tail, loc + 8);
    const rec = await view(file, z64, z64 + 56);
    if (u32(rec, 0) !== 0x06064b50) throw new Error("Archive ZIP64 illisible.");
    count = u64(rec, 32);
    cdSize = u64(rec, 40);
    cdOffset = u64(rec, 48);
  }
  const cd = await view(file, cdOffset, cdOffset + cdSize);
  const dec = new TextDecoder();
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < count && p + 46 <= cd.byteLength; i++) {
    if (u32(cd, p) !== 0x02014b50) break;
    const method = u16(cd, p + 10);
    let compSize = u32(cd, p + 20);
    let size = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    let localOffset = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // Champ supplémentaire ZIP64 (id 0x0001) : tailles / position sur 8 octets
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = u16(cd, e);
      const len = u16(cd, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = u64(cd, q);
          q += 8;
        }
        if (compSize === 0xffffffff) {
          compSize = u64(cd, q);
          q += 8;
        }
        if (localOffset === 0xffffffff) localOffset = u64(cd, q);
      }
      e += 4 + len;
    }
    entries.push({ name, method, compSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Flux d'octets décompressés d'une entrée ; `onRead` reçoit le nombre d'octets compressés lus. */
export async function entryStream(file: Blob, e: ZipEntry, onRead?: (bytes: number) => void): Promise<ReadableStream<Uint8Array>> {
  const head = await view(file, e.localOffset, e.localOffset + 30);
  if (u32(head, 0) !== 0x04034b50) throw new Error("Archive ZIP endommagée.");
  const start = e.localOffset + 30 + u16(head, 26) + u16(head, 28);
  let raw = file.slice(start, start + e.compSize).stream() as ReadableStream<Uint8Array>;
  if (onRead) {
    let read = 0;
    raw = raw.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          read += chunk.byteLength;
          onRead(read);
          ctrl.enqueue(chunk);
        },
      }),
    );
  }
  if (e.method === 0) return raw;
  if (e.method !== 8) throw new Error("Méthode de compression ZIP non prise en charge.");
  if (typeof DecompressionStream === "undefined") throw new Error("Navigateur trop ancien : décompressez l'archive puis importez le fichier .xml.");
  return raw.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
}

export async function entryText(file: Blob, e: ZipEntry): Promise<string> {
  const stream = await entryStream(file, e);
  return new Response(stream).text();
}
