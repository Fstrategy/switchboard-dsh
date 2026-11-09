import type { Board, Facts, SessionFact, TextEntry, WaitItem } from '../types/index.d.ts'
import { buildBoard, clip, fallbackText, HERE_MS, scrub } from '../hooks/logic.ts'
import { PROMPTS, STRINGS, type Lang } from '../hooks/i18n.ts'

/** Native extension, NOT a fabricated post-turn summary: a durable unresolved question/approval. */
export type NativeFact = SessionFact & { dshPending?: { text: string; time: number; kind: 'ask' | 'plan' } }
export function buildDshBoard(facts: Facts, texts: Record<string, TextEntry>, now: number, lang: Lang): Board {
  const board = buildBoard(facts, texts, now, lang)
  const recorded = facts.sessions.filter((s): s is NativeFact => !s.live && !s.readError && !!(s as NativeFact).dshPending)
  if (!recorded.length) return board
  const added: WaitItem[] = recorded.map(s => {
    const t = texts[s.id]?.text ?? fallbackText(s, lang)
    const pending = s.dshPending!
    const F = STRINGS[lang].fallback
    return { id: s.id, name: t.short,
      ask: clip(scrub(pending.text) || (pending.kind === 'plan' ? F.plan : F.answer), PROMPTS[lang].limits.ask - 2),
      why: t.why, kind: 'question', waitMs: Math.max(0, now - pending.time), isLive: false,
      isHere: !!s.lastFocusedAt && s.lastFocusedAt <= now && now - s.lastFocusedAt < HERE_MS }
  })
  const ids = new Set(added.map(w => w.id))
  const order = { wait: 0, run: 1, bg: 2, done: 3, gone: 4 }
  const projects = board.projects.map(p => {
    const lines = p.lines.map(l => ids.has(l.id) ? { ...l, state: 'wait' as const } : l).sort((a, b) => order[a.state] - order[b.state])
    const isParentWaiting = p.isParentWaiting || ids.has(p.id)
    return { ...p, lines, isParentWaiting, isActive: p.isActive || isParentWaiting || lines.some(l => l.state === 'wait'),
      done: lines.filter(l => l.state === 'done' || l.state === 'gone').length }
  })
  return { ...board, projects,
    stale: [...board.stale.filter(w => !ids.has(w.id)), ...added].sort((a, b) => a.waitMs - b.waitMs),
    resting: board.resting.filter(s => !ids.has(s.id)), running: board.running.filter(s => !ids.has(s.id)) }
}
