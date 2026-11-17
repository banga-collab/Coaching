"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Dumbbell,
  Flag,
  History,
  Loader2,
  Minus,
  Play,
  Plus,
  Search,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Weight,
  X,
  Zap,
} from "lucide-react";
import type { Exercise, ProgramDay, WorkoutEntry } from "@/lib/types";
import { normName } from "@/lib/video";
import { cn } from "@/lib/utils";
import { Card, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { ExerciseVideoButton } from "@/components/exercises/exercise-modal";
import { saveWorkoutAction } from "@/actions/workouts";
import { RestSheet } from "./rest-timer";
import { DEFAULT_REST, bestSetLabel, fmtClock, fmtDuration, fmtKg, logStats, maxLoad, parseRest, targetOf } from "./utils";

export type LastInfo = { date: string; sets: { reps: string; load: string }[] };

type LiveSet = { reps: string; load: string; done: boolean };
type LiveExercise = { uid: string; name: string; target: string | null; rest: number; notes: string | null; sets: LiveSet[] };
type LiveState = {
  v: 1;
  programId: string | null;
  dayTitle: string;
  startedAt: string;
  exercises: LiveExercise[];
  active: number;
  rest: { endsAt: number; total: number } | null;
};
type Summary = {
  dayTitle: string;
  durationMin: number;
  volume: number;
  setsDone: number;
  setsTotal: number;
  exercises: number;
  rpe: number | null;
  prs: { exercise: string; load: number; previous: number }[];
};
type Phase = "loading" | "start" | "live" | "finish" | "summary";

const rid = () => Math.random().toString(36).slice(2, 10);
const firstNum = (s: string | null | undefined) => s?.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? "";

const RPE_LABEL: Record<number, string> = {
  1: "Très facile",
  2: "Facile",
  3: "Facile",
  4: "Modéré",
  5: "Modéré",
  6: "Soutenu",
  7: "Difficile",
  8: "Très difficile",
  9: "Presque max",
  10: "Maximal",
};
const rpeColor = (r: number) => (r <= 3 ? "bg-emerald-500" : r <= 5 ? "bg-lime-500" : r <= 7 ? "bg-amber-500" : r <= 8 ? "bg-orange-500" : "bg-red-500");

function toEntries(live: LiveState): WorkoutEntry[] {
  return live.exercises.map((e) => ({
    exercise: e.name,
    target: e.target,
    sets: e.sets.map((s) => {
      const l = Number(s.load.replace(",", "."));
      return { reps: s.reps || null, load: Number.isFinite(l) && l > 0 ? l : null, done: s.done };
    }),
  }));
}

function lastAsEntry(name: string, last: LastInfo | undefined): WorkoutEntry | null {
  if (!last) return null;
  return { exercise: name, sets: last.sets.map((s) => ({ reps: s.reps || null, load: Number(s.load) || null, done: true })) };
}

function readStore(key: string): LiveState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as LiveState;
    if (s?.v !== 1 || !Array.isArray(s.exercises) || typeof s.startedAt !== "string") return null;
    if (Date.now() - new Date(s.startedAt).getTime() > 24 * 3600_000) return null;
    return s;
  } catch {
    return null;
  }
}
function writeStore(key: string, s: LiveState | null) {
  try {
    if (s) window.localStorage.setItem(key, JSON.stringify(s));
    else window.localStorage.removeItem(key);
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

export function WorkoutApp({
  clientId,
  firstName,
  program,
  suggested,
  library,
  last,
  best,
  children,
}: {
  clientId: string;
  firstName: string;
  program: { id: string; name: string; days: ProgramDay[] } | null;
  suggested: number;
  library: Exercise[];
  last: Record<string, LastInfo>;
  best: Record<string, number>;
  children?: ReactNode;
}) {
  const router = useRouter();
  const storeKey = `moovup:seance:${clientId}`;
  const [phase, setPhase] = useState<Phase>("loading");
  const [live, setLive] = useState<LiveState | null>(null);
  const [now, setNow] = useState(0);
  const [picked, setPicked] = useState(suggested);
  const [adding, setAdding] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saving, startSaving] = useTransition();
  const audioRef = useRef<AudioContext | null>(null);
  const notifiedRef = useRef<number | null>(null);

  const closeAdd = useCallback(() => setAdding(false), []);
  const libIndex = useMemo(() => new Map(library.map((e) => [normName(e.name), e])), [library]);

  /* ---------- Chargement / persistance ---------- */
  useEffect(() => {
    const saved = readStore(storeKey);
    setNow(Date.now());
    if (saved) {
      setLive(saved);
      setPhase("live");
    } else setPhase("start");
  }, [storeKey]);

  useEffect(() => {
    if (phase === "live" || phase === "finish") writeStore(storeKey, live);
  }, [live, phase, storeKey]);

  useEffect(() => {
    if (phase !== "live" && phase !== "finish") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [phase]);

  // Garde l'écran allumé pendant la séance (si supporté)
  useEffect(() => {
    if (phase !== "live") return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    try {
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {});
    } catch {
      /* non supporté */
    }
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [phase]);

  /* ---------- Son & vibration ---------- */
  const ensureAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) audioRef.current = new AC();
      }
      void audioRef.current?.resume();
    } catch {
      /* audio indisponible */
    }
  }, []);

  const beep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      [0, 0.22, 0.44].forEach((t, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = i === 2 ? 1175 : 880;
        const at = ctx.currentTime + t;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(at);
        o.stop(at + 0.2);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const vibrate = (p: number | number[]) => {
    try {
      navigator.vibrate?.(p);
    } catch {
      /* ignore */
    }
  };

  /* ---------- Fin du repos ---------- */
  const rest = live?.rest ?? null;
  const remaining = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (!rest || now === 0) return;
    if (now >= rest.endsAt && notifiedRef.current !== rest.endsAt) {
      notifiedRef.current = rest.endsAt;
      // pas de notification si le repos s'est terminé pendant un rechargement de page
      if (now - rest.endsAt < 3000) {
        vibrate([250, 120, 250]);
        beep();
      }
    }
    if (now >= rest.endsAt + 5000) setLive((s) => (s ? { ...s, rest: null } : s));
  }, [now, rest, beep]);

  /* ---------- Construction d'une séance ---------- */
  const makeExercise = useCallback(
    (name: string, opts: { sets?: number | null; reps?: string | null; load?: string | null; rest?: string | null; notes?: string | null; target?: string | null } = {}): LiveExercise => {
      const prev = last[normName(name)];
      const n = Math.max(1, Math.min(12, opts.sets || prev?.sets.length || 3));
      const repsDefault = firstNum(opts.reps);
      const loadDefault = firstNum(opts.load);
      return {
        uid: rid(),
        name,
        target: opts.target ?? null,
        rest: opts.rest ? parseRest(opts.rest) : DEFAULT_REST,
        notes: opts.notes ?? null,
        sets: Array.from({ length: n }, (_, i) => {
          const p = prev?.sets[i] ?? prev?.sets.at(-1);
          return { reps: p?.reps || repsDefault, load: p?.load || loadDefault, done: false };
        }),
      };
    },
    [last],
  );

  const start = (dayIdx: number | null) => {
    ensureAudio();
    const day = dayIdx !== null ? program?.days[dayIdx] : undefined;
    const state: LiveState = {
      v: 1,
      programId: day && program ? program.id : null,
      dayTitle: day?.title ?? "Séance libre",
      startedAt: new Date().toISOString(),
      exercises: (day?.exercises ?? []).map((e) =>
        makeExercise(e.name, { sets: e.sets, reps: e.reps, load: e.load, rest: e.rest, notes: e.notes, target: targetOf(e) }),
      ),
      active: 0,
      rest: null,
    };
    setLive(state);
    setNow(Date.now());
    setRpe(null);
    setNotes("");
    setError(null);
    setPhase("live");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!state.exercises.length) setAdding(true);
  };

  /* ---------- Mutations ---------- */
  const patch = (fn: (s: LiveState) => LiveState) => setLive((s) => (s ? fn(s) : s));

  const updateSet = (ei: number, si: number, p: Partial<LiveSet>) =>
    patch((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...p } : x)) })),
    }));

  const toggleDone = (ei: number, si: number) => {
    ensureAudio();
    if (live && !live.exercises[ei]?.sets[si]?.done) vibrate(35);
    patch((s) => {
      const ex = s.exercises[ei];
      if (!ex) return s;
      const wasDone = ex.sets[si]?.done;
      const exercises = s.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, done: !x.done } : x)) }));
      if (wasDone) return { ...s, exercises };
      const cur = exercises[ei]!;
      let active = s.active;
      if (cur.sets.every((x) => x.done)) {
        const nextIdx = exercises.findIndex((e, i) => i > ei && e.sets.some((x) => !x.done));
        const anyIdx = nextIdx >= 0 ? nextIdx : exercises.findIndex((e) => e.sets.some((x) => !x.done));
        if (anyIdx >= 0) active = anyIdx;
      }
      const allDone = exercises.every((e) => e.sets.every((x) => x.done));
      const t = Date.now();
      return { ...s, exercises, active, rest: allDone ? null : { endsAt: t + cur.rest * 1000, total: cur.rest } };
    });
  };

  const addSet = (ei: number) =>
    patch((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => {
        if (i !== ei) return e;
        const lastSet = e.sets.at(-1);
        return { ...e, sets: [...e.sets, { reps: lastSet?.reps ?? "", load: lastSet?.load ?? "", done: false }] };
      }),
    }));

  const removeSet = (ei: number) =>
    patch((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i !== ei || e.sets.length <= 1 ? e : { ...e, sets: e.sets.slice(0, -1) })),
    }));

  const removeExercise = (ei: number) => {
    if (!confirm("Retirer cet exercice de ta séance ?")) return;
    patch((s) => {
      const exercises = s.exercises.filter((_, i) => i !== ei);
      return { ...s, exercises, active: Math.max(0, Math.min(s.active, exercises.length - 1)) };
    });
  };

  const addExercise = (name: string) => {
    const clean = name.trim().slice(0, 120);
    if (!clean) return;
    const lib = libIndex.get(normName(clean));
    patch((s) => ({ ...s, exercises: [...s.exercises, makeExercise(lib?.name ?? clean)], active: s.exercises.length }));
    setAdding(false);
  };

  const shiftRest = (d: number) =>
    patch((s) => {
      if (!s.rest) return s;
      const t = Date.now();
      const endsAt = Math.max(t + 1000, s.rest.endsAt + d * 1000);
      return { ...s, rest: { endsAt, total: Math.max(s.rest.total, Math.ceil((endsAt - t) / 1000)) } };
    });
  const skipRest = () => patch((s) => ({ ...s, rest: null }));

  const abandon = () => {
    if (!confirm("Abandonner cette séance ? Ta progression ne sera pas enregistrée.")) return;
    writeStore(storeKey, null);
    setLive(null);
    setPhase("start");
  };

  const save = () => {
    if (!live) return;
    setError(null);
    const payload = {
      programId: live.programId,
      dayTitle: live.dayTitle,
      startedAt: live.startedAt,
      entries: live.exercises.map((e) => ({ exercise: e.name, target: e.target, sets: e.sets })),
      rpe,
      notes: notes.trim() || null,
    };
    startSaving(async () => {
      try {
        const res = await saveWorkoutAction(payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const entries = toEntries(live);
        const st = logStats({ entries, started_at: live.startedAt, finished_at: new Date().toISOString() });
        const prs = entries.flatMap((e) => {
          const prev = best[normName(e.exercise)];
          const m = maxLoad(e);
          return prev !== undefined && m > prev ? [{ exercise: e.exercise, load: m, previous: prev }] : [];
        });
        setSummary({ dayTitle: live.dayTitle, durationMin: st.durationMin ?? 0, volume: st.volume, setsDone: st.done, setsTotal: st.total, exercises: entries.filter((e) => e.sets.some((x) => x.done)).length, rpe, prs });
        writeStore(storeKey, null);
        setLive(null);
        setPhase("summary");
        window.scrollTo({ top: 0 });
        if (prs.length) vibrate([60, 60, 60, 60, 180]);
        router.refresh();
      } catch {
        setError("Connexion perdue : ta séance est conservée sur ton téléphone, réessaie dans un instant.");
      }
    });
  };

  /* ====================== Rendu ====================== */
  if (phase === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-56 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (phase === "summary" && summary) return <SummaryScreen summary={summary} onBack={() => setPhase("start")} />;

  if ((phase === "live" || phase === "finish") && live) {
    const total = live.exercises.reduce((a, e) => a + e.sets.length, 0);
    const done = live.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const elapsed = now ? Math.max(0, Math.floor((now - new Date(live.startedAt).getTime()) / 1000)) : 0;
    const nextUp = (() => {
      for (const e of live.exercises) {
        const k = e.sets.findIndex((x) => !x.done);
        if (k >= 0) return `${e.name} · série ${k + 1}`;
      }
      return null;
    })();

    if (phase === "finish") {
      const st = logStats({ entries: toEntries(live), started_at: live.startedAt, finished_at: null });
      return (
        <div className="mx-auto max-w-lg animate-fade-up pb-6">
          <button type="button" onClick={() => setPhase("live")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand-600">
            <ArrowLeft className="size-4" /> Retour à la séance
          </button>
          <h1 className="font-display text-2xl font-extrabold text-ink">Bravo, séance bouclée ! 🎉</h1>
          <p className="mt-1 text-sm text-muted">Dis-nous comment tu l&apos;as ressentie, ton coach verra tout ça.</p>
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <MiniStat icon={<Clock className="size-4" />} label="Durée" value={fmtClock(elapsed)} />
            <MiniStat icon={<Check className="size-4" />} label="Séries" value={`${done}/${total}`} />
            <MiniStat icon={<Weight className="size-4" />} label="Volume" value={fmtKg(st.volume)} />
          </div>
          <Card className="mt-5 p-5">
            <p className="font-display text-[15px] font-bold text-ink">Effort ressenti (RPE)</p>
            <p className="mt-0.5 text-xs text-muted">1 = très facile · 10 = effort maximal</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpe(n)}
                  aria-pressed={rpe === n}
                  className={cn(
                    "h-12 rounded-xl font-display text-lg font-extrabold transition active:scale-95",
                    rpe === n ? cn(rpeColor(n), "text-white shadow-md ring-4 ring-black/5") : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-3 h-6 text-center text-sm font-semibold text-ink">{rpe ? RPE_LABEL[rpe] : <span className="text-muted">Choisis une note</span>}</div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Un mot pour ton coach (facultatif)</span>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Énergie, douleurs, sensations…" rows={3} />
            </label>
          </Card>
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {done === 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Tu n&apos;as validé aucune série : coche au moins une série pour enregistrer ta séance.</p>}
          <div className="sticky bottom-20 z-10 mt-5 lg:bottom-4">
            <button
              type="button"
              onClick={save}
              disabled={saving || done === 0}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 font-display text-base font-extrabold text-white shadow-pop transition active:scale-[.98] hover:bg-accent-600 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Flag className="size-5" />}
              {saving ? "Enregistrement…" : "Enregistrer ma séance"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("mx-auto max-w-2xl", rest ? "pb-48 lg:pb-40" : "pb-6")}>
        {/* Barre de séance */}
        <div className="sticky top-14 z-10 -mx-4 mb-4 border-b border-line bg-canvas/90 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-b-2xl lg:px-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={abandon} aria-label="Abandonner la séance" className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-muted ring-1 ring-line transition hover:text-red-600">
              <X className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] font-bold text-ink">{live.dayTitle}</p>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-600">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent-500" />
                </span>
                <span className="font-display tabular-nums text-ink">{fmtClock(elapsed)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("finish")}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-brand-600"
            >
              <Flag className="size-4" /> Terminer
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-amber-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600">
              {done}/{total} séries
            </span>
          </div>
        </div>

        {live.exercises.length === 0 && (
          <Card className="mb-4 border-dashed p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-50 text-accent-500">
              <Zap className="size-6" />
            </span>
            <p className="mt-3 font-display font-bold text-ink">Séance libre</p>
            <p className="mt-1 text-sm text-muted">Ajoute tes exercices au fur et à mesure.</p>
          </Card>
        )}

        <div className="space-y-3">
          {live.exercises.map((e, ei) => (
            <LiveExerciseCard
              key={e.uid}
              ex={e}
              index={ei}
              active={live.active === ei}
              lib={libIndex.get(normName(e.name)) ?? null}
              last={last[normName(e.name)]}
              onOpen={() => patch((s) => ({ ...s, active: s.active === ei ? -1 : ei }))}
              onSet={(si, p) => updateSet(ei, si, p)}
              onToggle={(si) => toggleDone(ei, si)}
              onAddSet={() => addSet(ei)}
              onRemoveSet={() => removeSet(ei)}
              onRemove={() => removeExercise(ei)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-bold text-slate-600 transition hover:border-brand-300 hover:bg-white hover:text-brand-600"
        >
          <Plus className="size-5" /> Ajouter un exercice
        </button>

        {total > 0 && (
          <button
            type="button"
            onClick={() => setPhase("finish")}
            className={cn(
              "mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-base font-extrabold transition active:scale-[.98]",
              done === total ? "bg-accent-500 text-white shadow-pop hover:bg-accent-600" : "bg-white text-brand-600 ring-1 ring-line hover:bg-brand-50",
            )}
          >
            <Flag className="size-5" /> {done === total ? "Terminer la séance" : "Terminer maintenant"}
          </button>
        )}

        {rest && <RestSheet remaining={remaining} total={rest.total} next={nextUp} onAdd={shiftRest} onSkip={skipRest} />}
        {adding && <AddExerciseSheet library={library} existing={live.exercises.map((e) => normName(e.name))} onPick={addExercise} onClose={closeAdd} />}
      </div>
    );
  }

  /* ---------- Écran de départ ---------- */
  const days = program?.days ?? [];
  const day = days[picked];
  const estimate = day
    ? Math.round(day.exercises.reduce((a, e) => a + (e.sets || 3) * (40 + parseRest(e.rest)), 0) / 60)
    : 0;

  return (
    <>
      <PageHeader title={`Prêt${firstName ? `, ${firstName}` : ""} ? 🔥`} subtitle={program ? `Programme : ${program.name}` : "Lance ta séance et suis tes séries en direct."} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] lg:items-start [&>*]:min-w-0">
        <div className="space-y-4">
          {day ? (
            <div className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-5 text-white shadow-pop sm:p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-16 right-10 size-40 rounded-full bg-accent-500/30 blur-2xl" />
              <Dumbbell className="pointer-events-none absolute -right-3 bottom-4 size-32 rotate-[-20deg] text-white/[.07]" />
              <p className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="size-3.5" /> {picked === suggested ? "Séance du jour" : "Séance choisie"}
              </p>
              <h2 className="relative mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{day.title}</h2>
              {day.focus && <p className="relative mt-1 text-sm text-white/80">{day.focus}</p>}
              <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><Dumbbell className="size-3.5" /> {day.exercises.length} exercice{day.exercises.length > 1 ? "s" : ""}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><Clock className="size-3.5" /> ~{fmtDuration(estimate)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><Timer className="size-3.5" /> Minuteur de repos</span>
              </div>
              <ul className="relative mt-4 space-y-1.5">
                {day.exercises.slice(0, 5).map((e, i) => {
                  const lib = libIndex.get(normName(e.name));
                  return (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/15 text-[11px] font-bold">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                      {targetOf(e) && <span className="shrink-0 text-xs font-semibold text-white/70">{targetOf(e)}</span>}
                      {lib?.video_url && <Play className="size-3.5 shrink-0 fill-current text-accent-300" />}
                    </li>
                  );
                })}
                {day.exercises.length > 5 && <li className="pl-8 text-xs text-white/70">+ {day.exercises.length - 5} autre(s)</li>}
              </ul>
              <button
                type="button"
                onClick={() => start(picked)}
                className="relative mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 font-display text-base font-extrabold text-white shadow-lg shadow-accent-900/30 transition active:scale-[.98] hover:bg-accent-400"
              >
                <Play className="size-5 fill-current" /> Commencer la séance
              </button>
            </div>
          ) : (
            <Card className="p-6 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <Dumbbell className="size-6" />
              </span>
              <p className="mt-3 font-display font-bold text-ink">Pas encore de programme actif</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Ton coach va bientôt t&apos;en préparer un. En attendant, lance une séance libre !</p>
            </Card>
          )}

          {days.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Choisir une autre séance</p>
              <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                  {days.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPicked(i)}
                      aria-pressed={picked === i}
                      className={cn(
                        "flex min-h-[52px] w-44 flex-col items-start justify-center rounded-2xl px-3.5 py-2 text-left ring-1 ring-inset transition active:scale-[.98] sm:w-auto sm:min-w-40",
                        picked === i ? "bg-brand-500 text-white ring-brand-500 shadow-sm" : "bg-white text-ink ring-line hover:ring-slate-300",
                      )}
                    >
                      <span className={cn("text-[11px] font-bold uppercase tracking-wide", picked === i ? "text-white/70" : "text-muted")}>
                        Jour {i + 1}
                        {i === suggested && " · suggéré"}
                      </span>
                      <span className="w-full truncate text-sm font-semibold">{d.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => start(null)}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-4 text-left transition hover:border-accent-300 hover:bg-white"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-500">
              <Zap className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Séance libre</span>
              <span className="block text-xs text-muted">Compose ta séance au fil de l&apos;eau</span>
            </span>
            <Plus className="size-5 text-muted" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </>
  );
}

/* ====================== Sous-composants ====================== */

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 shadow-card">
      <span className="text-accent-500">{icon}</span>
      <p className="mt-1.5 font-display text-lg font-extrabold leading-none tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

function LiveExerciseCard({
  ex,
  index,
  active,
  lib,
  last,
  onOpen,
  onSet,
  onToggle,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  ex: LiveExercise;
  index: number;
  active: boolean;
  lib: Exercise | null;
  last: LastInfo | undefined;
  onOpen: () => void;
  onSet: (si: number, p: Partial<LiveSet>) => void;
  onToggle: (si: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onRemove: () => void;
}) {
  const done = ex.sets.filter((s) => s.done).length;
  const complete = done === ex.sets.length && ex.sets.length > 0;
  const lastEntry = lastAsEntry(ex.name, last);
  const lastLabel = lastEntry ? bestSetLabel(lastEntry) : null;

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-white shadow-card transition", active ? "border-brand-300 ring-4 ring-brand-50" : complete ? "border-emerald-200" : "border-line")}>
      <div className="flex items-center gap-3 p-3.5">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={active}>
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl font-display text-base font-extrabold transition",
              complete ? "bg-emerald-500 text-white" : active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
            )}
          >
            {complete ? <Check className="size-5" strokeWidth={3} /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-display text-[15px] font-bold", complete && !active ? "text-slate-500" : "text-ink")}>{ex.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
              {ex.target && <span className="font-semibold text-brand-600">{ex.target}</span>}
              <span className="inline-flex items-center gap-1"><Timer className="size-3" /> {ex.rest >= 60 && ex.rest % 60 === 0 ? `${ex.rest / 60} min` : `${ex.rest} s`}</span>
              <span className={cn("font-semibold", complete ? "text-emerald-600" : "")}>{done}/{ex.sets.length}</span>
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition", active && "rotate-180")} />
        </button>
        {lib && (
          <ExerciseVideoButton exercise={lib} className="w-[72px] shrink-0 overflow-hidden rounded-xl ring-1 ring-line" label={`Voir la vidéo : ${lib.name}`}>
            <ExerciseThumb exercise={lib} size="sm" />
          </ExerciseVideoButton>
        )}
      </div>

      {active && (
        <div className="border-t border-line px-3 pb-3.5 pt-3">
          {(lastLabel || ex.notes) && (
            <div className="mb-3 space-y-1.5">
              {lastLabel && (
                <p className="flex items-center gap-1.5 rounded-xl bg-brand-50/70 px-3 py-2 text-xs text-brand-700">
                  <History className="size-3.5 shrink-0" /> La dernière fois : <b>{lastLabel}</b>
                </p>
              )}
              {ex.notes && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs italic text-amber-800">{ex.notes}</p>}
            </div>
          )}
          <div className="grid grid-cols-[2.25rem_1fr_1fr_3.25rem] gap-2 px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="text-center">Série</span>
            <span className="text-center">Reps</span>
            <span className="text-center">Charge</span>
            <span className="text-center">OK</span>
          </div>
          <div className="space-y-1.5">
            {ex.sets.map((s, si) => {
              const prev = last?.sets[si];
              return (
                <div
                  key={si}
                  className={cn(
                    "grid grid-cols-[2.25rem_1fr_1fr_3.25rem] items-center gap-2 rounded-xl p-1 transition-colors",
                    s.done ? "bg-emerald-50" : "",
                  )}
                >
                  <span className={cn("grid size-9 place-items-center rounded-lg text-sm font-bold", s.done ? "text-emerald-700" : "text-slate-500")}>{si + 1}</span>
                  <input
                    value={s.reps}
                    onChange={(e) => onSet(si, { reps: e.target.value.slice(0, 12) })}
                    inputMode="numeric"
                    placeholder={prev?.reps || "–"}
                    aria-label={`Répétitions série ${si + 1}`}
                    className={cn(
                      "h-12 w-full min-w-0 rounded-xl border bg-white text-center font-display text-lg font-bold tabular-nums text-ink outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-50",
                      s.done ? "border-emerald-200" : "border-line",
                    )}
                  />
                  <div className="relative">
                    <input
                      value={s.load}
                      onChange={(e) => onSet(si, { load: e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) })}
                      inputMode="decimal"
                      placeholder={prev?.load || "–"}
                      aria-label={`Charge en kg série ${si + 1}`}
                      className={cn(
                        "h-12 w-full min-w-0 rounded-xl border bg-white pr-7 text-center font-display text-lg font-bold tabular-nums text-ink outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-50",
                        s.done ? "border-emerald-200" : "border-line",
                      )}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">kg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(si)}
                    aria-pressed={s.done}
                    aria-label={s.done ? `Annuler la série ${si + 1}` : `Valider la série ${si + 1}`}
                    className={cn(
                      "grid size-[52px] place-items-center rounded-xl transition active:scale-90",
                      s.done ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "border-2 border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-400",
                    )}
                  >
                    <Check className="size-6" strokeWidth={3} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={onAddSet} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[.98]">
              <Plus className="size-4" /> Ajouter une série
            </button>
            {ex.sets.length > 1 && !ex.sets.at(-1)?.done && (
              <button type="button" onClick={onRemoveSet} aria-label="Retirer la dernière série" className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200">
                <Minus className="size-4" />
              </button>
            )}
            <button type="button" onClick={onRemove} aria-label="Retirer l'exercice" className="grid size-11 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddExerciseSheet({ library, existing, onPick, onClose }: { library: Exercise[]; existing: string[]; onPick: (name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const needle = normName(q);
  const list = library.filter((e) => !needle || normName([e.name, ...e.muscles, e.category].join(" ")).includes(needle)).slice(0, 40);
  const exact = library.some((e) => normName(e.name) === needle);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Ajouter un exercice">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
      <div className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop animate-fade-up sm:rounded-3xl">
        <div className="shrink-0 border-b border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-lg font-extrabold text-ink">Ajouter un exercice</p>
            <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) onPick(q);
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher ou saisir un exercice…"
              className="h-12 w-full rounded-xl border border-line bg-canvas pl-10 pr-3 text-base text-ink outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-50"
              maxLength={120}
            />
          </form>
        </div>
        <ul className="flex-1 overflow-y-auto overscroll-contain p-2">
          {q.trim() && !exact && (
            <li>
              <button type="button" onClick={() => onPick(q)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-accent-50">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-500 text-white">
                  <Plus className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">Ajouter « {q.trim()} »</span>
                  <span className="block text-xs text-muted">Exercice personnalisé</span>
                </span>
              </button>
            </li>
          )}
          {list.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e.name)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-canvas">
                <span className="w-20 shrink-0 overflow-hidden rounded-lg">
                  <ExerciseThumb exercise={e} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{e.name}</span>
                  <span className="block truncate text-xs text-muted">{[e.category, ...e.muscles.slice(0, 2)].join(" · ")}</span>
                </span>
                {existing.includes(normName(e.name)) ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Déjà ajouté</span>
                ) : (
                  <Plus className="size-5 shrink-0 text-brand-500" />
                )}
              </button>
            </li>
          ))}
          {!list.length && !q.trim() && <li className="p-6 text-center text-sm text-muted">La vidéothèque est vide : saisis le nom de ton exercice.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

const CONFETTI_COLORS = ["#e8782a", "#1a6d8e", "#f6b26b", "#34d399", "#60a5fa", "#f472b6"];

function SummaryScreen({ summary, onBack }: { summary: Summary; onBack: () => void }) {
  const hasPr = summary.prs.length > 0;
  return (
    <div className="mx-auto max-w-lg pb-6">
      <style>{`
        @keyframes cf-fall{0%{transform:translate3d(0,-20px,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),340px,0) rotate(var(--rot));opacity:0}}
        @keyframes pop-in{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
        @keyframes shine{0%,100%{box-shadow:0 0 0 0 rgba(232,120,42,.35)}50%{box-shadow:0 0 0 14px rgba(232,120,42,0)}}
      `}</style>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-5 pb-7 pt-9 text-center text-white shadow-pop">
        {hasPr && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {Array.from({ length: 36 }, (_, i) => (
              <span
                key={i}
                className="absolute top-0 block rounded-[2px]"
                style={
                  {
                    left: `${(i * 37) % 100}%`,
                    width: i % 3 === 0 ? 6 : 8,
                    height: i % 3 === 0 ? 12 : 8,
                    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    animation: `cf-fall ${1.8 + (i % 5) * 0.35}s ${(i % 9) * 0.12}s cubic-bezier(.25,.6,.4,1) 2 both`,
                    "--dx": `${((i * 53) % 120) - 60}px`,
                    "--rot": `${(i % 2 ? 1 : -1) * (360 + i * 25)}deg`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
        <span className="relative mx-auto grid size-20 place-items-center rounded-full bg-white text-accent-500 shadow-lg animate-[pop-in_.6s_cubic-bezier(.2,.8,.2,1)_both,shine_2s_.6s_ease-in-out_infinite]">
          {hasPr ? <Trophy className="size-9" /> : <Check className="size-10" strokeWidth={3} />}
        </span>
        <h1 className="relative mt-4 font-display text-2xl font-extrabold">{hasPr ? "Nouveau record ! 🏆" : "Séance enregistrée 💪"}</h1>
        <p className="relative mt-1 text-sm text-white/80">{summary.dayTitle} · ton coach est prévenu.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MiniStat icon={<Clock className="size-4" />} label="Durée" value={fmtDuration(summary.durationMin)} />
        <MiniStat icon={<Weight className="size-4" />} label="Volume total" value={fmtKg(summary.volume)} />
        <MiniStat icon={<Check className="size-4" />} label="Séries validées" value={`${summary.setsDone}/${summary.setsTotal}`} />
        <MiniStat icon={<Trophy className="size-4" />} label={summary.rpe ? `Records · RPE ${summary.rpe}` : "Records"} value={String(summary.prs.length)} />
      </div>

      {hasPr && (
        <Card className="mt-4 overflow-hidden">
          <p className="flex items-center gap-2 border-b border-line bg-accent-50/60 px-4 py-3 text-sm font-bold text-accent-700">
            <Trophy className="size-4" /> Tes records du jour
          </p>
          <ul className="divide-y divide-line">
            {summary.prs.map((p, i) => (
              <li key={p.exercise} className="flex items-center gap-3 px-4 py-3 animate-fade-up" style={{ animationDelay: `${300 + i * 120}ms` }}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-500 text-white">
                  <Trophy className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{p.exercise}</span>
                  <span className="block text-xs text-muted">Avant : {fmtKg(p.previous)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg font-extrabold text-accent-600">{fmtKg(p.load)}</span>
                  <span className="block text-[11px] font-bold text-emerald-600">+{fmtKg(Math.round((p.load - p.previous) * 10) / 10)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5 grid gap-2.5">
        <button type="button" onClick={onBack} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 font-display text-base font-extrabold text-white shadow-pop transition active:scale-[.98] hover:bg-accent-600">
          <History className="size-5" /> Voir mon historique
        </button>
        <LinkButton href="/moi" variant="secondary" className="h-12 rounded-2xl">
          Ma progression
        </LinkButton>
      </div>
    </div>
  );
}
