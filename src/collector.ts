// Native dsh adapter. Session logs are authoritative; this projection is only a derived cache.
import { z } from 'zod'
import type { Facts, SessionFact, Said } from '../types/index.d.ts'
import { isTemp } from '../hooks/logic.ts'
import type { NativeFact } from './native-board.ts'
import { abortable } from './async.ts'

export const FACTS_KEY = 'switchboardFacts'
const DAY = 86_400_000
export type Event = { type: string; seq: number; time: number; data: any }
export type Header = { id: string; cwd?: string; origin?: string; parentSession?: string; createdAt: number }
const pendingSchema = z.object({ text: z.string(), at: z.string(), time: z.number(), kind: z.enum(['ask', 'plan']), timed: z.boolean(), continued: z.boolean() })
export const stateSchema = z.object({
  inherited: z.number(), title: z.string(), ownTitle: z.boolean(), firstInput: z.string(), cwd: z.string(),
  createdAt: z.number(), lastActivityAt: z.number(), statusAt: z.number(), turnOpen: z.boolean(), timed: z.boolean(),
  progress: z.object({ at: z.string(), text: z.string() }).nullable(),
  questions: z.record(z.string(), pendingSchema),
  approvals: z.record(z.string(), z.object({ text: z.string(), time: z.number() })),
  label: z.string(), mode: z.string(),
  children: z.array(z.object({ id: z.string(), mode: z.string(), label: z.string(), createdAt: z.number() })),
})
export type NativeState = z.infer<typeof stateSchema>
export const textOf = (content: unknown): string => Array.isArray(content)
  ? content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n').trim() : ''
const short = (s: string, cap = 800) => Array.from(s).slice(0, cap).join('')
const parse = (value: unknown): any => { try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null } }
const questionsSchema = z.array(z.object({ id: z.string(), question: z.string(), options: z.array(z.object({ label: z.string() })).optional() })).min(1)
const questionsOf = (value: unknown): any[] | null => { const result = questionsSchema.safeParse(value); return result.success ? result.data : null }
const questionText = (questions: unknown): string => short((questionsOf(questions) ?? []).map(q => [q.question, ...(q.options ?? []).map((o: any) => o.label)].filter(Boolean).join(' · ')).join('\n'))
export const initialState = (header: Header, inherited = 0): NativeState => ({
  inherited, title: '', ownTitle: false, firstInput: '', cwd: header.cwd ?? '', createdAt: header.createdAt,
  lastActivityAt: header.createdAt, statusAt: header.createdAt, turnOpen: false, timed: false,
  progress: null, questions: {}, approvals: {}, label: '', mode: '', children: [],
})

/** Pure, synchronous, ignores unrelated events by identity; only folds own question/delegation facts. */
export function applyEvent(s: NativeState, e: Event): NativeState {
  const d = e.data
  // A fork's seed is not this child's pending input or delegation. Inherited title is a useful fallback.
  if (e.seq < s.inherited && e.type !== 'session/title') return s
  switch (e.type) {
    case 'session/title': return { ...s, title: String(d.title ?? ''), ownTitle: e.seq >= s.inherited && d.source?.kind === 'user' }
    case 'working-directory/change': return { ...s, cwd: String(d.cwd ?? s.cwd) }
    case 'request/header': {
      const tools = d.header?.tools ?? []
      const timed = tools.some((t: any) => t.name === 'ask_user_question' && t.parameters?.properties?.timeout !== undefined)
      return timed === s.timed ? s : { ...s, timed }
    }
    case 'turn/start': return { ...s, turnOpen: true, statusAt: e.time, lastActivityAt: e.time }
    case 'turn/end': return { ...s, turnOpen: false, statusAt: e.time, lastActivityAt: e.time, approvals: {},
      questions: Object.fromEntries(Object.entries(s.questions).filter(([, q]) => q.continued)) }
    case 'assistant/message': {
      const text = textOf(d.message?.content)
      return text ? { ...s, progress: { at: new Date(e.time).toISOString(), text: short(text) }, lastActivityAt: e.time } : s
    }
    case 'user/message': {
      const source = d.source ?? {}
      if (source.kind === 'user-question-reply') {
        const questions = { ...s.questions }; delete questions[source.callId]
        return { ...s, questions, lastActivityAt: e.time, statusAt: e.time }
      }
      const text = textOf(d.content)
      // Never use model/system/agent notices as the human's task/title.
      if (source.kind !== 'user') return s
      return { ...s, firstInput: s.firstInput || short(text, 80), lastActivityAt: e.time }
    }
    case 'tool/call': {
      if (d.name !== 'ask_user_question') return s
      const args = parse(d.arguments)
      if (!questionsOf(args?.questions)) return s
      const q = { text: questionText(args.questions), at: new Date(e.time).toISOString(), time: e.time,
        kind: 'ask' as const, timed: s.timed, continued: false }
      return { ...s, questions: { ...s.questions, [d.callId]: q }, statusAt: e.time }
    }
    case 'tool/result': {
      const id = d.message?.toolCallId
      if (!s.questions[id]) return s
      const pending = parse(textOf(d.message.content))?.pending === true
      if (s.questions[id].timed && (pending || d.error?.code === 'TOOL_OUTCOME_UNKNOWN')) return {
        ...s, questions: { ...s.questions, [id]: { ...s.questions[id], continued: true } },
      }
      const questions = { ...s.questions }; delete questions[id]
      return { ...s, questions, statusAt: e.time }
    }
    case 'tool/ptc-dispatch': {
      if (d.name !== 'ask_user_question' || d.isError || parse(textOf(d.content))?.pending !== true) return s
      const args = parse(d.arguments)
      if (!questionsOf(args?.questions)) return s
      return { ...s, questions: { ...s.questions, [d.subCallId]: { text: questionText(args.questions),
        at: new Date(e.time).toISOString(), time: e.time, kind: 'ask', timed: true, continued: true } }, statusAt: e.time }
    }
    case 'approval/asked': return { ...s, approvals: { ...s.approvals, [d.id]: {
      text: [d.toolName, d.reason].filter(Boolean).join(': '), time: e.time } }, statusAt: e.time }
    case 'approval/decided': {
      const approvals = { ...s.approvals }; delete approvals[d.id]
      return { ...s, approvals, statusAt: e.time }
    }
    case 'subagent/descriptor': return { ...s, label: String(d.label ?? ''), mode: String(d.mode ?? '') }
    case 'subagent/catalog': return { ...s, children: [...s.children.filter(c => c.id !== d.childId), {
      id: String(d.childId), mode: String(d.mode), label: String(d.label ?? ''), createdAt: d.childCreatedAt ?? e.time }] }
    default: return s
  }
}

export const projectionDefinition = {
  key: FACTS_KEY, stateVersion: 4, stateSchema,
  init: initialState, apply: applyEvent,
  wire: { viewSchema: stateSchema, view: (s: NativeState) => s, summary: false },
}
export type JumpTarget = string | { parentSessionId: string; childSessionId: string; mode: 'one-shot' | 'continuable' | 'unknown' }
export type CollectorExtras = { jumpTargets: Record<string, JumpTarget>; diagnostics: string[] }

/** No file paths, credentials, transcript format assumptions, process spawning, or model calls. */
export class DshCollector {
  readonly status = new Map<string, { status: string; at: number }>()
  readonly focus = new Map<string, number>()
  readonly transient = new Map<string, Map<object, { text: string; time: number; kind: 'ask' | 'plan' }>>()
  extras: CollectorExtras = { jumpTargets: {}, diagnostics: [] }
  private disposed = false
  private readonly lifecycle = new AbortController()
  constructor(private ctx: any, private projection: any) {
    for (const a of ctx.agents.list()) this.status.set(a.id, { status: a.status, at: 0 }) // initial sample only
    ctx.on('agent/status', ({ agent, status }: any) => this.status.set(agent.id, { status, at: Date.now() }))
    ctx.on('agent/created', ({ agent }: any) => { this.status.set(agent.id, { status: agent.status, at: 0 }) })
    ctx.on('agent/disposed', ({ agent }: any) => { this.status.delete(agent.id); this.transient.delete(agent.id) })
    // A legacy question inside a PTC call has no separate tool/call until it finishes. Observe, never claim it.
    ctx.on('user-questions/request', async (request: any, next: () => Promise<unknown>) => {
      if (!request.agent || request.signal?.aborted) return next()
      const id = request.agent.id
      const requests = this.transient.get(id) ?? new Map()
      const marker = {}
      requests.set(marker, { text: questionText(request.questions), time: Date.now(),
        kind: request.questions.some((q: any) => q.intent?.kind === 'plan-review') ? 'plan' : 'ask' })
      this.transient.set(id, requests)
      try { return await next() } finally { requests.delete(marker); if (!requests.size) this.transient.delete(id) }
    }, { prepend: true })
  }
  dispose() { this.disposed = true; this.lifecycle.abort(); this.status.clear(); this.transient.clear(); this.focus.clear() }
  markFocus(id: string) { this.focus.set(id, Date.now()) }

  async collect(): Promise<Facts> {
    if (this.disposed) throw new Error('Switchboard collector has been disposed')
    const now = Date.now()
    const signal = AbortSignal.any([this.lifecycle.signal, AbortSignal.timeout(25_000)])
    const records = await abortable<{ header: Header }[]>(this.ctx.sessionQuery.listSessions(signal), signal)
    // List addressable sessions without activating cold agents; archive visibility is applied separately.
    const listed = await abortable<{ items: { sessionId: string }[] }>(this.ctx.sessionController.list({}, signal), signal)
    const visible = new Set<string>(listed.items.map((s: any) => s.sessionId))
    const byId = new Map<string, any>(records.map((r: any) => [r.header.id, r]))
    // SessionController lists addressable rows; the registry's archive set is authoritative for grouping.
    const archived = new Set<string>(this.ctx.get('workspaceRegistry')?.archivedSessionIds ?? [])
    const included = (header: Header) => {
      if (archived.has(header.id)) return false
      if (this.ctx.agents.get(header.id)) return true
      const seen = new Set<string>()
      let h: Header | undefined = header
      while (h?.origin === 'subagent' && h.parentSession) {
        if (seen.has(h.id) || archived.has(h.id)) return false
        seen.add(h.id); h = byId.get(h.parentSession)?.header
      }
      return !!h && !archived.has(h.id) && visible.has(h.id)
    }
    const sessions: SessionFact[] = []
    const states = new Map<string, NativeState>()
    const targets: Record<string, JumpTarget> = {}
    const diagnostics: string[] = []
    let hiddenDormant = 0
    // Bounded cold-read concurrency; never create/resume an Agent just to collect facts.
    const candidates = records.filter((r: any) => included(r.header))
    let index = 0
    const work = async () => {
      while (index < candidates.length) {
        signal.throwIfAborted()
        const r = candidates[index++]
        const header: Header = r.header
        const agent = this.ctx.agents.get(header.id)
        let s: NativeState
        try {
          if (agent) s = this.projection.stateOf(agent.session)
          else {
            const lease = await abortable(Promise.resolve(this.ctx.sessionQuery.observeSession(header.id, { projectionMode: 'all', signal })).then((value: any) => {
              if (signal.aborted) { value[Symbol.dispose](); signal.throwIfAborted() }
              return value
            }), signal)
            try {
              s = lease.projections?.values?.[FACTS_KEY]
                ?? lease.events.reduce(applyEvent, initialState(header, lease.inheritedEventCount))
            } finally { lease[Symbol.dispose]() }
          }
          states.set(header.id, s)
        } catch (err) {
          sessions.push({ id: header.id, kind: 'cli', title: '', live: !!agent, readError: String(err), cwd: header.cwd })
          const why = String(err)
          diagnostics.push(`${header.id}: ${why.length > 420 ? why.slice(0, 120) + ' … ' + why.slice(-300) : why}`)
          continue
        }
        signal.throwIfAborted()
        const cwd = agent ? this.ctx.get('workingDirectory')?.get(agent.session) ?? s.cwd : s.cwd
        if (!cwd || isTemp(cwd)) { states.delete(header.id); continue }
        const requests = [...(this.transient.get(header.id)?.values() ?? [])]
        const question = requests[0] ?? Object.values(s.questions)[0]
        const approval = Object.values(s.approvals)[0]
        const pending = !!question || !!approval
        // Continued timed questions are still actionable; normal tool timeouts/skip/rejection remove them.
        const status = !agent ? null : pending ? 'waiting' : this.status.get(header.id)?.status === 'running' ? 'busy' : 'idle'
        const lastActivityAt = s.lastActivityAt
        if (!agent && !pending && now - lastActivityAt > DAY) { hiddenDormant++; continue }
        if (!agent && pending) diagnostics.push(`${header.id}: unresolved recorded input in a stopped session; reopen it to recover the request`)
        const fact: NativeFact = {
          id: header.id, kind: 'cli', title: (s.ownTitle ? s.title : s.label || s.title) || s.firstInput,
          cwd,
          live: !!agent, status, statusAt: question?.time ?? approval?.time ?? (this.status.get(header.id)?.at || s.statusAt),
          createdAt: header.createdAt, lastActivityAt, lastFocusedAt: this.focus.get(header.id),
          parent: header.origin === 'subagent' ? header.parentSession ?? null : null,
          summary: null, wrapUp: '', cards: [], cliId: header.id, tty: null,
          progress: s.progress, question: question ? { at: new Date(question.time).toISOString(), text: question.text, kind: question.kind } :
            approval ? { at: new Date(approval.time).toISOString(), text: approval.text, kind: 'plan' } : null,
          waitingFor: pending ? (question?.text ?? approval?.text ?? '') : null,
          ...!agent && pending ? { dshPending: { text: question?.text ?? approval?.text ?? '',
            time: question?.time ?? approval?.time ?? s.statusAt, kind: question?.kind ?? 'plan' } } : {},
        }
        sessions.push(fact)
        targets[header.id] = header.origin === 'subagent' && header.parentSession
          ? { parentSessionId: header.parentSession, childSessionId: header.id,
            mode: ['one-shot', 'continuable'].includes(s.mode) ? s.mode as 'one-shot' | 'continuable' : 'unknown' }
          : header.id
      }
    }
    await Promise.all([work(), work(), work()])
    signal.throwIfAborted()
    const present = new Set(sessions.map(s => s.id))
    for (const [parent, s] of states) for (const child of s.children) {
      if (present.has(child.id)) continue
      if (child.mode === 'external') {
        // No local transcript or exact live status exists for an external execution: do not guess it.
        sessions.push({ id: child.id, kind: 'cli', title: child.label, live: false,
          parent, createdAt: child.createdAt, readError: 'External execution has no local dsh Session' })
        diagnostics.push(`${child.label || child.id}: external execution; no local Session to open`)
      }
    }
    this.extras = { jumpTargets: targets, diagnostics }
    return { generatedAt: now, platform: 'dsh', sessions: sessions.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)), hiddenDormant, errors: [] }
  }
}
