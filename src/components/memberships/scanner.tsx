"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, Camera, CameraOff, CheckCircle2, Clock, Hash, Keyboard, Loader2, ScanLine, Search, UserCheck, X } from "lucide-react";
import { checkInAction, type CheckInResult } from "@/actions/memberships";
import { cn } from "@/lib/utils";
import { Avatar, buttonClass } from "@/components/ui";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export type ScanClient = { id: string; name: string; code: string | null; phone: string | null };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });

export function Scanner({ clients }: { clients: ScanClient[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [camOn, setCamOn] = useState(false);
  const [camLoading, setCamLoading] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissRef.current) clearTimeout(dismissRef.current);
    setResult(null);
    busyRef.current = false;
    setBusy(false);
  }, []);

  const submit = useCallback(
    async (input: { code?: string; clientId?: string }, method: "qr" | "code" | "manuel") => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await checkInAction({ ...input, method });
        setResult(res);
        try {
          navigator.vibrate?.(res.ok ? 80 : [120, 80, 120]);
        } catch {
          /* vibration non disponible */
        }
        if (dismissRef.current) clearTimeout(dismissRef.current);
        dismissRef.current = setTimeout(dismiss, res.ok ? 4500 : 7000);
      } catch {
        setResult({ ok: false, title: "Connexion perdue", reason: "Impossible de joindre le serveur. Réessaie dans un instant." });
        dismissRef.current = setTimeout(dismiss, 5000);
      }
    },
    [dismiss],
  );

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const det = detectorRef.current;
    if (!video || !det || !streamRef.current) return;
    if (!busyRef.current && video.readyState >= 2) {
      try {
        const found = await det.detect(video);
        const value = found[0]?.rawValue?.trim();
        if (value) {
          const now = Date.now();
          const last = lastRef.current;
          if (!last || last.code !== value || now - last.at > 6000) {
            lastRef.current = { code: value, at: now };
            void submit({ code: value }, "qr");
          }
        }
      } catch {
        /* image illisible : on continue */
      }
    }
    timerRef.current = setTimeout(tick, 280);
  }, [submit]);

  async function startCamera() {
    setCamError(null);
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setCamError("Ce navigateur ne sait pas lire les QR codes avec la caméra. Utilisez Chrome ou Edge sur la tablette, ou saisissez le code ci-dessous.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("La caméra n'est pas accessible (une connexion sécurisée HTTPS est nécessaire).");
      return;
    }
    setCamLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      detectorRef.current = new Ctor({ formats: ["qr_code"] });
      setCamOn(true);
      timerRef.current = setTimeout(tick, 400);
    } catch (e) {
      const name = (e as { name?: string }).name;
      setCamError(
        name === "NotAllowedError"
          ? "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur puis réessayez."
          : name === "NotFoundError"
            ? "Aucune caméra détectée sur cet appareil."
            : "Impossible de démarrer la caméra.",
      );
      stopCamera();
    } finally {
      setCamLoading(false);
    }
  }

  // Arrêt de la caméra et des minuteries au démontage
  useEffect(
    () => () => {
      stopCamera();
      if (dismissRef.current) clearTimeout(dismissRef.current);
    },
    [stopCamera],
  );

  // Rafraîchit la liste des présents régulièrement (plusieurs postes possibles)
  useEffect(() => {
    const t = setInterval(() => {
      if (!busyRef.current) router.refresh();
    }, 30000);
    return () => clearInterval(t);
  }, [router]);

  // Échap ferme la carte de résultat
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, dismiss]);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const digits = n.replace(/\D/g, "");
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(n) ||
          (c.code ?? "").toLowerCase().includes(n) ||
          (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
      )
      .slice(0, 6);
  }, [q, clients]);

  return (
    <div className="space-y-4">
      {/* Caméra */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 shadow-card">
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
          <video ref={videoRef} playsInline muted className={cn("absolute inset-0 size-full object-cover", !camOn && "invisible")} />
          {camOn ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative size-[58%] max-w-[300px] rounded-3xl shadow-[0_0_0_9999px_rgba(8,33,45,.55)]">
                {["left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"].map((c) => (
                  <span key={c} className={cn("absolute size-10 border-accent-400", c)} />
                ))}
                <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse rounded-full bg-accent-400/90 shadow-[0_0_16px_rgba(236,138,69,.9)]" />
              </div>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                {busy ? "Vérification…" : "Présentez le QR code de la carte membre"}
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
              <div className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-accent-500/20 blur-2xl" />
              <span className="relative grid size-20 place-items-center rounded-3xl bg-white/10 ring-1 ring-inset ring-white/20">
                <ScanLine className="size-10" />
              </span>
              <div className="relative">
                <p className="font-display text-xl font-extrabold sm:text-2xl">Scanner les cartes membres</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-white/70">La caméra de la tablette lit le QR code affiché dans l&apos;app du membre.</p>
              </div>
              <button type="button" onClick={startCamera} disabled={camLoading} className={buttonClass("primary", "relative h-14 px-7 text-base")}>
                {camLoading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                Activer la caméra
              </button>
            </div>
          )}
        </div>
        {camOn && (
          <button
            type="button"
            onClick={stopCamera}
            className="absolute right-3 top-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-black/45 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/60"
          >
            <CameraOff className="size-4" /> Arrêter
          </button>
        )}
      </div>
      {camError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{camError}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Code manuel */}
        <form
          className="rounded-2xl border border-line bg-white p-4 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            void submit({ code }, "code").then(() => setCode(""));
          }}
        >
          <p className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink">
            <Keyboard className="size-4 text-brand-500" /> Saisir le code d&apos;accès
          </p>
          <div className="flex gap-2">
            <span className="relative flex-1">
              <Hash className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MU004821"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-3 font-mono text-base tracking-wider text-ink placeholder:text-slate-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
              />
            </span>
            <button type="submit" disabled={busy || !code.trim()} className={buttonClass("brand", "h-12 px-5")}>
              Valider
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Le code figure sous le QR code de la carte.</p>
        </form>

        {/* Recherche */}
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink">
            <UserCheck className="size-4 text-brand-500" /> Pointer un membre à la main
          </p>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, téléphone ou code…"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-base text-ink placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
            />
          </span>
          {q.trim().length >= 2 && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {matches.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted">Aucun membre trouvé</li>
              ) : (
                matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submit({ clientId: c.id }, "manuel").then(() => setQ(""))}
                      className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-canvas active:bg-brand-50 disabled:opacity-60"
                    >
                      <Avatar name={c.name} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                        <span className="block truncate font-mono text-[11px] text-muted">{c.code ?? "—"}</span>
                      </span>
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">Pointer</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      {busy && !result && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-white/50 backdrop-blur-sm">
          <Loader2 className="size-10 animate-spin text-brand-500" />
        </div>
      )}
      {result && <ResultCard result={result} onClose={dismiss} />}
    </div>
  );
}

function ResultCard({ result, onClose }: { result: CheckInResult; onClose: () => void }) {
  const tone = !result.ok ? "red" : result.already ? "amber" : "green";
  const bg = { green: "from-emerald-600 to-emerald-500", amber: "from-amber-500 to-amber-400", red: "from-red-600 to-red-500" }[tone];
  const duration = result.ok ? 4500 : 7000;
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      onClick={onClose}
      className={cn("fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center bg-gradient-to-br p-6 text-center text-white", bg)}
    >
      <style>{`@keyframes mu-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute right-4 top-4 grid size-12 place-items-center rounded-2xl bg-white/15 transition hover:bg-white/25">
        <X className="size-6" />
      </button>

      <span className="grid size-28 place-items-center rounded-full bg-white/20 ring-8 ring-white/10 animate-fade-up sm:size-36">
        {tone === "green" ? <CheckCircle2 className="size-16 sm:size-20" /> : tone === "amber" ? <Clock className="size-16 sm:size-20" /> : <AlertOctagon className="size-16 sm:size-20" />}
      </span>

      {result.ok ? (
        <>
          <p className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            {result.already ? `Déjà enregistré` : `Bienvenue ${result.client.first} ✓`}
          </p>
          <p className="mt-2 text-lg text-white/85 sm:text-xl">
            {result.already ? `${result.client.name} est passé(e) à ${timeFmt.format(new Date(result.at))}. Bonne séance !` : result.client.name}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Chip label="Formule" value={result.membership.name} />
            <Chip label="Valable jusqu'au" value={dateFmt.format(new Date(`${result.membership.end_date}T12:00:00Z`))} />
            {result.membership.sessionsLeft !== null ? (
              <Chip label="Séances restantes" value={`${result.membership.sessionsLeft} / ${result.membership.sessionsTotal}`} warn={result.membership.sessionsLeft <= 2} />
            ) : (
              <Chip label="Jours restants" value={String(result.membership.daysLeft)} warn={result.membership.daysLeft <= 7} />
            )}
          </div>
          {!result.already && result.membership.daysLeft <= 7 && (
            <p className="mt-6 rounded-2xl bg-black/15 px-5 py-3 text-base font-semibold">
              ⚠️ Abonnement à renouveler : {result.membership.daysLeft === 0 ? "dernier jour" : `plus que ${result.membership.daysLeft} jour${result.membership.daysLeft > 1 ? "s" : ""}`}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">{result.title}</p>
          {result.client && <p className="mt-2 text-xl font-semibold text-white/90">{result.client.name}</p>}
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">{result.reason}</p>
          <p className="mt-6 rounded-2xl bg-black/15 px-5 py-3 text-base font-semibold">Merci de passer à l&apos;accueil 🙏</p>
        </>
      )}

      <p className="mt-10 text-sm text-white/70">Touchez l&apos;écran pour continuer</p>
      <span className="absolute inset-x-0 bottom-0 h-1.5 origin-left bg-white/60" style={{ animation: `mu-shrink ${duration}ms linear forwards` }} />
    </div>
  );
}

function Chip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span className={cn("min-w-[150px] rounded-2xl px-5 py-3 text-left ring-1 ring-inset", warn ? "bg-amber-400/30 ring-amber-200/60" : "bg-white/15 ring-white/25")}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/70">{label}</span>
      <span className="mt-0.5 block text-lg font-bold">{value}</span>
    </span>
  );
}
