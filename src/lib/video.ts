/** Analyse des URL vidéo d'exercices (YouTube, Vimeo, fichier mp4). */

export type VideoInfo =
  | { kind: "youtube"; id: string; embedUrl: string; thumbnail: string }
  | { kind: "vimeo"; id: string; embedUrl: string; thumbnail: null }
  | { kind: "file"; src: string; embedUrl: string; thumbnail: null };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function safeUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

export function youtubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && YT_ID.test(id) ? id : null;
}

export function vimeoId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = u.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/);
  return m?.[1] ?? null;
}

/** Retourne les infos de lecture d'une URL, ou null si non reconnue. */
export function parseVideo(raw: string | null | undefined): VideoInfo | null {
  if (!raw) return null;
  const yt = youtubeId(raw);
  if (yt) {
    return {
      kind: "youtube",
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1`,
      thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }
  const vm = vimeoId(raw);
  if (vm) return { kind: "vimeo", id: vm, embedUrl: `https://player.vimeo.com/video/${vm}?dnt=1&title=0&byline=0&portrait=0`, thumbnail: null };
  const u = safeUrl(raw);
  if (u && (u.protocol === "https:" || u.protocol === "http:") && /\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) {
    return { kind: "file", src: u.toString(), embedUrl: u.toString(), thumbnail: null };
  }
  return null;
}

export function videoThumbnail(raw: string | null | undefined): string | null {
  return parseVideo(raw)?.thumbnail ?? null;
}

/** Dégradé de la vignette générée selon la catégorie d'exercice. */
export const CATEGORY_GRADIENT: Record<string, string> = {
  Musculation: "from-brand-600 via-brand-500 to-sky-400",
  Cardio: "from-accent-600 via-accent-500 to-amber-400",
  Gainage: "from-teal-700 via-teal-500 to-emerald-400",
  Mobilité: "from-violet-600 via-fuchsia-500 to-pink-400",
  Étirements: "from-violet-600 via-fuchsia-500 to-pink-400",
  Fonctionnel: "from-slate-700 via-slate-600 to-brand-400",
};

export function categoryGradient(category: string | null | undefined) {
  return CATEGORY_GRADIENT[category ?? ""] ?? "from-slate-700 via-brand-600 to-brand-400";
}

export const EXERCISE_CATEGORIES = ["Musculation", "Cardio", "Gainage", "Mobilité", "Étirements", "Fonctionnel"];
export const EXERCISE_LEVELS = ["Tous niveaux", "Débutant", "Intermédiaire", "Avancé"];
export const MUSCLE_GROUPS = [
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Abdominaux",
  "Gainage",
  "Lombaires",
  "Fessiers",
  "Quadriceps",
  "Ischios",
  "Mollets",
  "Corps entier",
];

/** Normalisation d'un nom d'exercice pour la correspondance programme ↔ vidéothèque. */
export function normName(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
