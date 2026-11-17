export const PROGRAM_GOALS = ["Perte de poids", "Prise de masse", "Remise en forme", "Force", "Santé & mobilité", "Préparation physique"];
export const PROGRAM_LEVELS = ["Débutant", "Intermédiaire", "Avancé"];

export function levelTone(level: string | null): "green" | "amber" | "red" | "gray" {
  if (!level) return "gray";
  if (/d[ée]butant/i.test(level)) return "green";
  if (/avanc/i.test(level)) return "red";
  return "amber";
}

/** Semaine en cours d'un programme démarré le `start` (AAAA-MM-JJ). */
export function programWeek(start: string, weeks: number, today: string) {
  const elapsed = Math.floor((Date.parse(today) - Date.parse(start)) / 86400000);
  if (elapsed < 0) return { week: 0, total: weeks, pct: 0, upcoming: true, finished: false, daysLeft: -elapsed };
  const week = Math.floor(elapsed / 7) + 1;
  const finished = week > weeks;
  const pct = Math.min(100, Math.round((Math.min(elapsed, weeks * 7) / (weeks * 7)) * 100));
  return { week: Math.min(week, weeks), total: weeks, pct, upcoming: false, finished, daysLeft: 0 };
}
