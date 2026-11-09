import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import {
  applyEvent,
  DshCollector,
  FACTS_KEY,
  initialState,
  projectionDefinition,
  stateSchema,
  textOf,
} from '../src/collector.ts'
import type { Event, Header, NativeState } from '../src/collector.ts'
import { buildDshBoard } from '../src/native-board.ts'
import type { NativeFact } from '../src/native-board.ts'
import { buildBoard } from '../hooks/logic.ts'
import type { Facts, SessionFact } from '../types/index.d.ts'

// This module uses only fake contexts, committed-event fixtures and disposable in-memory leases.
// It never imports or starts dsh, activates an Agent, calls a model or uses the network.
const NOW = Date.UTC(2026, 10, 9, 15, 0)
const DAY = 86_400_000
const MINUTE = 60_000
const header = (id: string, changes: Partial<Header> = {}): Header => ({
  id, cwd: '/work/project', createdAt: NOW - 60 * MINUTE, ...changes,
})
const event = (type: string, data: any, seq = 0, time = NOW - MINUTE): Event => ({ type, data, seq, time })
const question = (id = 'headline') => ({
  id, question: 'Which headline?', options: [{ label: 'Short' }, { label: 'Detailed' }],
})
const ask = (callId = 'ask-1', questions: unknown = [question()], seq = 0, time = NOW - 5 * MINUTE): Event =>
  event('tool/call', { name: 'ask_user_question', callId, arguments: JSON.stringify({ questions }) }, seq, time)
const toolResult = (id: string, payload: unknown = { answers: [{ id: 'headline', selected: ['Short'] }] }, changes: any = {}): Event =>
  event('tool/result', { message: { toolCallId: id, content: [{ type: 'text', text: JSON.stringify(payload) }] }, ...changes })
const timedHeader = (seq = 0): Event => event('request/header', {
  header: { tools: [{ name: 'ask_user_question', parameters: { properties: { questions: {}, timeout: {} } } }] },
}, seq)
const fold = (h: Header, events: Event[] = [], inherited = 0): NativeState => events.reduce(applyEvent, initialState(h, inherited))
const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

type Fixture = {
  header: Header
  events?: Event[]
  state?: NativeState
  inherited?: number
  agent?: 'idle' | 'running'
  recordLive?: boolean
  visible?: boolean
  cached?: boolean
  readFailure?: boolean
  observeFailure?: boolean
}
type RigOptions = {
  delayObserve?: (id: string, signal: AbortSignal) => Promise<void>
  onDispose?: (id: string) => void
  listSessions?: (signal: AbortSignal) => Promise<any[]>
  listVisible?: (signal: AbortSignal) => Promise<{ items: { sessionId: string }[] }>
}

/** A Session in memory is deliberately NOT an Agent; only the separate AgentRegistry grants liveness. */
const rig = (t: TestContext, fixtures: Fixture[], options: RigOptions = {}) => {
  t.mock.method(Date, 'now', () => NOW)
  const fixturesById = new Map(fixtures.map(fixture => [fixture.header.id, fixture]))
  const states = new Map(fixtures.map(fixture => [
    fixture.header.id, fixture.state ?? fold(fixture.header, fixture.events, fixture.inherited),
  ]))
  const sessions = new Map(fixtures.map(fixture => [fixture.header.id, { id: fixture.header.id, header: fixture.header }]))
  const agents = new Map<string, any>(fixtures.filter(fixture => fixture.agent !== undefined).map(fixture => [
    fixture.header.id, { id: fixture.header.id, status: fixture.agent, session: sessions.get(fixture.header.id) },
  ]))
  const effectiveCwd = new Map<string, string>()
  const handlers = new Map<string, ((...args: any[]) => any)[]>()
  const stats = {
    listCalls: 0,
    visibleCalls: 0,
    listSignals: [] as AbortSignal[],
    visibleSignals: [] as AbortSignal[],
    observations: [] as { id: string; projectionMode: string; signal: AbortSignal }[],
    openLeases: 0,
    maxOpenLeases: 0,
    disposals: new Map<string, number>(),
  }
  const records = fixtures.map(fixture => ({ header: fixture.header, live: fixture.recordLive ?? false, persisted: true }))
  const visible = fixtures.filter(fixture => fixture.visible ?? !fixture.header.origin).map(fixture => ({ sessionId: fixture.header.id }))
  const ctx: any = {
    agents: {
      list: () => [...agents.values()],
      get: (id: string) => agents.get(id),
      create: () => assert.fail('collection must never activate an Agent'),
      resume: () => assert.fail('collection must never resume an Agent'),
    },
    sessions: { get: (id: string) => sessions.get(id) },
    get: (name: string) => {
      if (name === 'workspaceRegistry') return { archivedSessionIds: [] }
      assert.equal(name, 'workingDirectory', 'collector must not request model/process/network services')
      return { get: (session: { id: string }) => effectiveCwd.get(session.id) }
    },
    on: (name: string, callback: (...args: any[]) => any) => {
      const list = handlers.get(name) ?? []
      list.push(callback)
      handlers.set(name, list)
      return () => handlers.set(name, list.filter(item => item !== callback))
    },
    sessionQuery: {
      async listSessions(signal: AbortSignal) {
        stats.listCalls += 1
        stats.listSignals.push(signal)
        return options.listSessions ? options.listSessions(signal) : records
      },
      async observeSession(id: string, readOptions: { projectionMode: string; signal: AbortSignal }) {
        stats.observations.push({ id, ...readOptions })
        const fixture = fixturesById.get(id)!
        assert.ok(fixture, `unexpected cold read ${id}`)
        if (fixture.observeFailure) throw new Error(`cannot observe ${id}`)
        stats.openLeases += 1
        stats.maxOpenLeases = Math.max(stats.maxOpenLeases, stats.openLeases)
        let disposed = false
        const lease: any = {
          inheritedEventCount: fixture.inherited ?? 0,
          events: fixture.events ?? [],
          [Symbol.dispose]() {
            stats.disposals.set(id, (stats.disposals.get(id) ?? 0) + 1)
            if (!disposed) { disposed = true; stats.openLeases -= 1 }
            options.onDispose?.(id)
          },
        }
        Object.defineProperty(lease, 'projections', { get() {
          if (fixture.readFailure) throw new Error(`bad projection ${id}`)
          return fixture.cached === false ? undefined : { values: { [FACTS_KEY]: states.get(id) } }
        } })
        if (options.delayObserve) await options.delayObserve(id, readOptions.signal)
        return lease
      },
    },
    sessionController: {
      async list(_input: unknown, signal: AbortSignal) {
        stats.visibleCalls += 1
        stats.visibleSignals.push(signal)
        return options.listVisible ? options.listVisible(signal) : { items: visible }
      },
    },
  }
  const projection = {
    stateOf(session: { id: string }) {
      const fixture = fixturesById.get(session.id)!
      if (fixture.readFailure) throw new Error(`bad projection ${session.id}`)
      return states.get(session.id)
    },
  }
  const collector = new DshCollector(ctx, projection)
  t.after(() => { collector.dispose(); handlers.clear() })
  const emit = (name: string, payload: unknown) => {
    for (const callback of handlers.get(name) ?? []) callback(payload)
  }
  const request = (input: unknown, next: () => Promise<unknown>) => {
    const listeners = handlers.get('user-questions/request') ?? []
    assert.equal(listeners.length, 1)
    return listeners[0]!(input, next) as Promise<unknown>
  }
  return { collector, states, sessions, agents, effectiveCwd, stats, records, emit, request }
}
const byId = (facts: Facts) => new Map(facts.sessions.map(session => [session.id, session as NativeFact]))

test('projection: a native question survives unrelated results and only its matched result removes it', () => {
  const initial = initialState(header('one'))
  assert.equal(applyEvent(initial, event('unrelated/event', {})), initial)
  assert.equal(applyEvent(initial, event('tool/call', { name: 'some_other_tool' })), initial)
  const asked = applyEvent(initial, ask())
  assert.equal(asked.questions['ask-1']?.text, 'Which headline? · Short · Detailed')
  assert.equal(asked.questions['ask-1']?.kind, 'ask')
  assert.equal(asked.questions['ask-1']?.timed, false)
  assert.equal(asked.statusAt, NOW - 5 * MINUTE)
  assert.equal(applyEvent(asked, toolResult('unrelated')), asked)
  const two = applyEvent(asked, ask('ask-2', [question('second')]))
  const answered = applyEvent(two, toolResult('ask-1'))
  assert.equal(answered.questions['ask-1'], undefined)
  assert.ok(answered.questions['ask-2'])
  const skipped = applyEvent(answered, toolResult('ask-2', { answers: [{ id: 'second', selected: [] }] }))
  assert.deepEqual(skipped.questions, {})
})

test('projection: approval asked/decided is matched by id and turn end clears obsolete approvals', () => {
  let state = initialState(header('one'))
  state = applyEvent(state, event('approval/asked', { id: 'a1', toolName: 'write', reason: 'outside workspace' }))
  state = applyEvent(state, event('approval/asked', { id: 'a2', toolName: 'run', reason: 'needs permission' }))
  assert.equal(state.approvals.a1?.text, 'write: outside workspace')
  const decided = applyEvent(state, event('approval/decided', { id: 'a1', decision: 'allow' }))
  assert.equal(decided.approvals.a1, undefined)
  assert.ok(decided.approvals.a2)
  const ended = applyEvent(decided, event('turn/end', { reason: { kind: 'aborted' } }))
  assert.deepEqual(ended.approvals, {})
})

test('projection: timed pending continues through turn end and settles only on admitted matched reply', () => {
  const h = header('one')
  let state = fold(h, [timedHeader(), ask('timed')])
  state = applyEvent(state, toolResult('timed', { pending: true, callId: 'timed' }))
  assert.equal(state.questions.timed?.continued, true)
  state = applyEvent(state, event('turn/end', { reason: { kind: 'completed' } }))
  assert.ok(state.questions.timed)
  state = applyEvent(state, event('user/message', {
    source: { kind: 'user-question-reply', callId: 'unrelated' }, content: [],
  }))
  assert.ok(state.questions.timed)
  const settled = applyEvent(state, event('user/message', {
    source: { kind: 'user-question-reply', callId: 'timed' }, content: [],
  }))
  assert.deepEqual(settled.questions, {})
  const repaired = applyEvent(fold(h, [timedHeader(), ask('repair')]), toolResult('repair', {}, {
    error: { code: 'TOOL_OUTCOME_UNKNOWN' },
  }))
  assert.equal(repaired.questions.repair?.continued, true)
  const legacyFailure = applyEvent(fold(h, [ask('legacy')]), toolResult('legacy', {}, { error: { code: 'ASK_ABORTED' } }))
  assert.deepEqual(legacyFailure.questions, {})
  const legacyEnded = applyEvent(fold(h, [ask('legacy')]), event('turn/end', { reason: { kind: 'aborted' } }))
  assert.deepEqual(legacyEnded.questions, {})
})

test('projection: a pending PTC sub-call uses its subCallId and a late reply removes it', () => {
  const initial = initialState(header('one'))
  const dispatch = event('tool/ptc-dispatch', {
    name: 'ask_user_question', subCallId: 'sub-ask', arguments: { questions: [question()] },
    content: [{ type: 'text', text: JSON.stringify({ pending: true }) }], isError: false,
  })
  const pending = applyEvent(initial, dispatch)
  assert.equal(pending.questions['sub-ask']?.continued, true)
  assert.equal(pending.questions['sub-ask']?.timed, true)
  assert.match(pending.questions['sub-ask']?.text ?? '', /Which headline/)
  assert.equal(applyEvent(initial, { ...dispatch, data: { ...dispatch.data, isError: true } }), initial)
  assert.equal(applyEvent(initial, { ...dispatch, data: { ...dispatch.data, content: [] } }), initial)
  const answered = applyEvent(pending, event('user/message', {
    source: { kind: 'user-question-reply', callId: 'sub-ask' }, content: [],
  }))
  assert.deepEqual(answered.questions, {})
})

test('projection: malformed raw question arguments preserve identity without throwing', () => {
  const initial = initialState(header('one'))
  for (const questions of [null, {}, [], [null], [{ id: 'x', question: 'Pick?', options: {} }], [{ id: 'x' }]]) {
    assert.doesNotThrow(() => assert.equal(applyEvent(initial, ask('bad', questions)), initial))
    const ptc = event('tool/ptc-dispatch', {
      name: 'ask_user_question', subCallId: 'bad', arguments: { questions },
      content: [{ type: 'text', text: '{"pending":true}' }], isError: false,
    })
    assert.doesNotThrow(() => assert.equal(applyEvent(initial, ptc), initial))
  }
  assert.equal(applyEvent(initial, event('tool/call', {
    name: 'ask_user_question', callId: 'bad', arguments: '{ not JSON',
  })), initial)
})

test('projection: fork-inherited pending/catalog/descriptor/progress are ignored; title is fallback only', () => {
  const h = header('child', { origin: 'subagent', parentSession: 'parent' })
  const inherited = initialState(h, 10)
  const titled = applyEvent(inherited, event('session/title', { title: 'Parent title', source: { kind: 'user' } }, 0))
  assert.equal(titled.title, 'Parent title')
  assert.equal(titled.ownTitle, false)
  for (const inheritedEvent of [
    ask('inherited', [question()], 1),
    event('approval/asked', { id: 'a', toolName: 'run', reason: 'old' }, 2),
    event('subagent/catalog', { childId: 'unrelated-child', mode: 'external', label: 'Not ours' }, 3),
    event('subagent/descriptor', { mode: 'continuable', label: 'Parent descriptor' }, 4),
    event('assistant/message', { message: { content: [{ type: 'text', text: 'Parent reply' }] } }, 5),
    event('working-directory/change', { cwd: '/tmp/parent' }, 6),
    timedHeader(7),
  ]) assert.equal(applyEvent(titled, inheritedEvent), titled)
  const descriptor = applyEvent(titled, event('subagent/descriptor', { mode: 'continuable', label: 'Tax rules' }, 10))
  assert.equal(descriptor.ownTitle, false)
  assert.equal(descriptor.label, 'Tax rules')
  const fallback = applyEvent(descriptor, event('session/title', { title: 'Automatic first-prompt title', source: { kind: 'fallback' } }, 11))
  assert.equal(fallback.ownTitle, false)
  const provider = applyEvent(fallback, event('session/title', { title: 'Generated model title', source: { kind: 'provider', provider: 'fixture' } }, 12))
  assert.equal(provider.ownTitle, false)
  const renamed = applyEvent(provider, event('session/title', { title: 'Own renamed task', source: { kind: 'user' } }, 13))
  assert.equal(renamed.ownTitle, true)
  assert.equal(renamed.title, 'Own renamed task')
  assert.deepEqual(renamed.questions, {})
  assert.deepEqual(renamed.approvals, {})
  assert.deepEqual(renamed.children, [])
  assert.equal(renamed.progress, null)
  assert.equal(stateSchema.safeParse(renamed).success, true)
  assert.ok(projectionDefinition.stateVersion >= 4)
})

test('projection: only text is progress, only human input is the fallback title, and clipping is character-safe', () => {
  assert.equal(textOf([{ type: 'reasoning', text: 'secret reasoning' }, { type: 'text', text: 'First' },
    { type: 'file', text: 'not text' }, { type: 'text', text: 'Second' }]), 'First\nSecond')
  const initial = initialState(header('one'))
  assert.equal(applyEvent(initial, event('assistant/message', {
    message: { content: [{ type: 'reasoning', text: 'not progress' }] },
  })), initial)
  for (const kind of ['model', 'system-prompt', 'agent-notice']) {
    assert.equal(applyEvent(initial, event('user/message', { source: { kind }, content: [{ type: 'text', text: 'not a task' }] })), initial)
  }
  let state = applyEvent(initial, event('user/message', { source: { kind: 'user' }, content: [{ type: 'text', text: 'Human task' }] }))
  state = applyEvent(state, event('user/message', { source: { kind: 'user' }, content: [{ type: 'text', text: 'Follow-up' }] }))
  assert.equal(state.firstInput, 'Human task')
  state = applyEvent(state, event('assistant/message', { message: { content: [{ type: 'text', text: '😀'.repeat(1_000) }] } }))
  assert.equal(Array.from(state.progress!.text).length, 800)
})

test('collector: only live Agents establish liveness; passive in-memory Sessions and open turns do not', async t => {
  const passiveHeader = header('passive')
  const r = rig(t, [
    { header: header('active'), agent: 'running', recordLive: false },
    { header: passiveHeader, recordLive: true, events: [event('turn/start', { turn: 1 })] },
  ])
  assert.ok(r.sessions.has('passive'))
  let sessions = byId(await r.collector.collect())
  assert.equal(sessions.get('active')?.live, true)
  assert.equal(sessions.get('active')?.status, 'busy')
  assert.equal(sessions.get('passive')?.live, false)
  assert.equal(sessions.get('passive')?.status, null)
  assert.deepEqual(r.stats.observations.map(read => read.id), ['passive'])
  const active = r.agents.get('active')!
  active.status = 'idle'
  r.emit('agent/status', { agent: active, status: 'idle' })
  sessions = byId(await r.collector.collect())
  assert.equal(sessions.get('active')?.status, 'idle')
  r.agents.delete('active')
  r.emit('agent/disposed', { agent: active })
  sessions = byId(await r.collector.collect())
  assert.equal(sessions.get('active')?.live, false)
  assert.equal(sessions.get('active')?.status, null)
  assert.equal(r.collector.status.has('active'), false)
  assert.equal(r.stats.openLeases, 0)
})

test('collector: explicit native question and approval override busy, then matched settlement returns to busy/idle', async t => {
  const qHeader = header('question')
  const aHeader = header('approval')
  const r = rig(t, [
    { header: qHeader, agent: 'running', events: [ask()] },
    { header: aHeader, agent: 'running', events: [event('approval/asked', { id: 'approval-1', toolName: 'write', reason: 'outside workspace' })] },
  ])
  let sessions = byId(await r.collector.collect())
  assert.equal(sessions.get('question')?.status, 'waiting')
  assert.equal(sessions.get('question')?.question?.kind, 'ask')
  assert.equal(sessions.get('question')?.waitingFor, 'Which headline? · Short · Detailed')
  assert.equal(sessions.get('question')?.statusAt, NOW - 5 * MINUTE)
  assert.equal(sessions.get('approval')?.status, 'waiting')
  assert.equal(sessions.get('approval')?.question?.kind, 'plan')
  assert.equal(sessions.get('approval')?.question?.text, 'write: outside workspace')
  r.states.set('question', applyEvent(r.states.get('question')!, toolResult('ask-1')))
  r.states.set('approval', applyEvent(r.states.get('approval')!, event('approval/decided', { id: 'approval-1' })))
  const approvalAgent = r.agents.get('approval')!
  approvalAgent.status = 'idle'
  r.emit('agent/status', { agent: approvalAgent, status: 'idle' })
  sessions = byId(await r.collector.collect())
  assert.equal(sessions.get('question')?.status, 'busy')
  assert.equal(sessions.get('approval')?.status, 'idle')
  assert.equal(sessions.get('question')?.question, null)
  assert.equal(sessions.get('approval')?.waitingFor, null)
})

test('collector: legacy transient questions are observed without answering or retaining them after settlement', async t => {
  const r = rig(t, [{ header: header('root'), agent: 'running' }])
  const answer = deferred<unknown>()
  let delegated = 0
  const requested = r.request({
    agent: r.agents.get('root'), questions: [{ ...question(), intent: { kind: 'plan-review', approve: 'Short' } }],
    signal: new AbortController().signal,
  }, () => { delegated += 1; return answer.promise })
  const waiting = byId(await r.collector.collect()).get('root')!
  assert.equal(waiting.status, 'waiting')
  assert.equal(waiting.question?.kind, 'plan')
  assert.match(waiting.question?.text ?? '', /Which headline/)
  assert.equal(delegated, 1)
  answer.resolve({ answers: [{ id: 'headline', selected: [] }] })
  assert.deepEqual(await requested, { answers: [{ id: 'headline', selected: [] }] })
  const resumed = byId(await r.collector.collect()).get('root')!
  assert.equal(resumed.status, 'busy')
  assert.equal(resumed.question, null)
  assert.equal(r.collector.transient.size, 0)
})

test('collector: inherited/generated titles yield to descriptor, but an explicit own user rename wins', async t => {
  const child = header('child', { origin: 'subagent', parentSession: 'parent' })
  const events = [
    event('session/title', { title: 'Parent inherited title' }, 0),
    event('subagent/descriptor', { mode: 'continuable', label: 'Tax rules by region' }, 5),
  ]
  const r = rig(t, [{ header: header('parent') }, { header: child, inherited: 5, events, agent: 'idle' }])
  assert.equal(byId(await r.collector.collect()).get('child')?.title, 'Tax rules by region')
  r.states.set('child', applyEvent(r.states.get('child')!, event('session/title', {
    title: 'Read-only tas...', source: { kind: 'fallback' },
  }, 6)))
  assert.equal(r.states.get('child')?.ownTitle, false)
  assert.equal(byId(await r.collector.collect()).get('child')?.title, 'Tax rules by region')
  r.states.set('child', applyEvent(r.states.get('child')!, event('session/title', {
    title: 'Provider generated title', source: { kind: 'provider', provider: 'fixture' },
  }, 7)))
  assert.equal(r.states.get('child')?.ownTitle, false)
  assert.equal(byId(await r.collector.collect()).get('child')?.title, 'Tax rules by region')
  r.states.set('child', applyEvent(r.states.get('child')!, event('session/title', {
    title: 'User renamed child', source: { kind: 'user' },
  }, 8)))
  assert.equal(r.states.get('child')?.ownTitle, true)
  assert.equal(byId(await r.collector.collect()).get('child')?.title, 'User renamed child')
})

test('collector: continued timed native and PTC questions remain waiting while idle, then admitted replies settle them', async t => {
  const timed = header('timed-root')
  const ptc = header('ptc-root')
  const r = rig(t, [
    { header: timed, agent: 'idle', events: [
      timedHeader(), ask('continued'), toolResult('continued', { pending: true }),
      event('turn/end', { reason: { kind: 'completed' } }),
    ] },
    { header: ptc, agent: 'idle', events: [event('tool/ptc-dispatch', {
      name: 'ask_user_question', subCallId: 'ptc-continued', arguments: { questions: [question()] },
      content: [{ type: 'text', text: '{"pending":true}' }], isError: false,
    })] },
  ])
  let sessions = byId(await r.collector.collect())
  for (const id of ['timed-root', 'ptc-root']) {
    assert.equal(sessions.get(id)?.status, 'waiting')
    assert.equal(sessions.get(id)?.question?.kind, 'ask')
    assert.match(sessions.get(id)?.question?.text ?? '', /Which headline/)
    assert.equal(sessions.get(id)?.summary, null)
  }
  for (const [id, callId] of [['timed-root', 'continued'], ['ptc-root', 'ptc-continued']] as const) {
    r.states.set(id, applyEvent(r.states.get(id)!, event('user/message', {
      source: { kind: 'user-question-reply', callId }, content: [{ type: 'text', text: 'answer admitted' }],
    })))
  }
  const timedAgent = r.agents.get('timed-root')!
  timedAgent.status = 'running'
  r.emit('agent/status', { agent: timedAgent, status: 'running' })
  sessions = byId(await r.collector.collect())
  assert.equal(sessions.get('timed-root')?.status, 'busy')
  assert.equal(sessions.get('ptc-root')?.status, 'idle')
  assert.equal(sessions.get('timed-root')?.question, null)
  assert.equal(sessions.get('ptc-root')?.question, null)
})

test('collector: native turn outcomes never become invented post-turn summary/cards/closeable verdicts', async t => {
  const fixtures: Fixture[] = ['completed', 'blocked', 'error', 'max-tokens'].map((kind, index) => ({
    header: header(`turn-${index}`), agent: 'idle', events: [
      event('assistant/message', { message: { content: [{ type: 'text', text: 'Native last reply' }] } }),
      event('turn/end', { reason: { kind }, summary: { needs: 'Do not copy a fabricated verdict' } }),
    ],
  }))
  const r = rig(t, fixtures)
  const facts = await r.collector.collect()
  for (const session of facts.sessions) {
    assert.equal(session.summary, null)
    assert.equal(session.wrapUp, '')
    assert.deepEqual(session.cards, [])
    assert.equal(session.progress?.text, 'Native last reply')
    assert.equal(session.status, 'idle')
  }
  const board = buildDshBoard(facts, {}, NOW, 'en')
  assert.equal(board.waiting.length, 0)
  assert.ok(board.resting.every(session => !session.isCloseable))
})

test('collector: cold cached/raw leases are disposed exactly once, including projection failure', async t => {
  const r = rig(t, [
    { header: header('cached'), events: [event('session/title', { title: 'Cached title' })] },
    { header: header('raw'), cached: false, events: [event('session/title', { title: 'Replayed title' })] },
    { header: header('bad'), readFailure: true },
    { header: header('unavailable'), observeFailure: true },
  ])
  const facts = byId(await r.collector.collect())
  assert.equal(facts.get('cached')?.title, 'Cached title')
  assert.equal(facts.get('raw')?.title, 'Replayed title')
  assert.match(facts.get('bad')?.readError ?? '', /bad projection/)
  assert.match(facts.get('unavailable')?.readError ?? '', /cannot observe/)
  assert.equal(r.stats.disposals.get('cached'), 1)
  assert.equal(r.stats.disposals.get('raw'), 1)
  assert.equal(r.stats.disposals.get('bad'), 1)
  assert.equal(r.stats.disposals.has('unavailable'), false)
  assert.equal(r.stats.openLeases, 0)
  assert.ok(r.stats.observations.every(read => read.projectionMode === 'all' && read.signal instanceof AbortSignal))
  assert.ok(!r.collector.extras.jumpTargets.bad)
  assert.ok(r.collector.extras.diagnostics.some(message => message.includes('bad projection')))
})

test('collector: no more than three cold observations/leases are outstanding', async t => {
  const threeStarted = deferred<void>()
  const release = deferred<void>()
  let started = 0
  const r = rig(t, Array.from({ length: 9 }, (_, index) => ({ header: header(`cold-${index}`) })), {
    async delayObserve() { if (++started === 3) threeStarted.resolve(); await release.promise },
  })
  const collecting = r.collector.collect()
  await threeStarted.promise
  assert.equal(r.stats.openLeases, 3)
  assert.equal(r.stats.observations.length, 3)
  release.resolve()
  const facts = await collecting
  assert.equal(facts.sessions.length, 9)
  assert.equal(r.stats.maxOpenLeases, 3)
  assert.equal(r.stats.openLeases, 0)
  assert.equal(r.stats.disposals.size, 9)
  assert.ok([...r.stats.disposals.values()].every(count => count === 1))
})

test('collector: archive, effective cwd and 24-hour filters retain only meaningful native rows', async t => {
  const old = header('old-done', { createdAt: NOW - 3 * DAY })
  const boundary = header('exactly-one-day', { createdAt: NOW - DAY })
  const moved = header('moved-from-temp', { cwd: '/tmp/one-off' })
  const absentCwd = header('assigned-later', { cwd: undefined })
  const r = rig(t, [
    { header: header('archived'), visible: false },
    { header: header('archived-child', { origin: 'subagent', parentSession: 'archived' }) },
    { header: header('archived-live'), visible: false, agent: 'idle' },
    { header: header('temp', { cwd: '/private/tmp/eval' }) },
    { header: header('windows-temp', { cwd: 'C:\\Users\\me\\AppData\\Local\\Temp\\eval' }) },
    { header: header('no-cwd', { cwd: undefined }) },
    { header: moved, events: [event('working-directory/change', { cwd: '/work/recovered' })] },
    { header: absentCwd, events: [event('working-directory/change', { cwd: '/work/assigned' })] },
    { header: header('runtime-to-temp'), agent: 'idle' },
    { header: header('runtime-to-work', { cwd: '/tmp/seed' }), agent: 'idle' },
    { header: old }, { header: boundary }, { header: header('recent-cold') },
  ])
  r.effectiveCwd.set('runtime-to-temp', '/tmp/now-a-script')
  r.effectiveCwd.set('runtime-to-work', '/work/current')
  const facts = await r.collector.collect()
  const ids = new Set(facts.sessions.map(session => session.id))
  for (const excluded of ['archived', 'archived-child', 'temp', 'windows-temp', 'no-cwd', 'runtime-to-temp', 'old-done']) {
    assert.equal(ids.has(excluded), false, excluded)
    assert.equal(r.collector.extras.jumpTargets[excluded], undefined, excluded)
  }
  for (const included of ['archived-live', 'moved-from-temp', 'assigned-later', 'runtime-to-work', 'exactly-one-day', 'recent-cold']) {
    assert.equal(ids.has(included), true, included)
  }
  assert.equal(byId(facts).get('runtime-to-work')?.cwd, '/work/current')
  assert.equal(facts.hiddenDormant, 1)
})

test('native board: stopped durable question/approval remain stale and pending project lines are not done', async t => {
  const parent = header('coordinator')
  const pendingChild = header('pending-line', { origin: 'subagent', parentSession: parent.id, createdAt: NOW - 4 * DAY })
  const doneChild = header('done-line', { origin: 'subagent', parentSession: parent.id })
  const stoppedApproval = header('stopped-approval', { createdAt: NOW - 3 * DAY })
  const r = rig(t, [
    { header: parent, agent: 'idle', events: [event('session/title', { title: 'Coordinator' })] },
    { header: pendingChild, events: [ask('stopped-question', [question()], 0, NOW - 2 * DAY)] },
    { header: doneChild },
    { header: stoppedApproval, events: [event('approval/asked', { id: 'ap', toolName: 'write', reason: 'Review this change' }, 0, NOW - DAY)] },
  ])
  r.collector.markFocus('pending-line')
  const facts = await r.collector.collect()
  const sessions = byId(facts)
  assert.equal(facts.hiddenDormant, 0)
  assert.equal(sessions.get('pending-line')?.live, false)
  assert.equal(sessions.get('pending-line')?.status, null)
  assert.equal(sessions.get('pending-line')?.summary, null)
  assert.equal(sessions.get('pending-line')?.dshPending?.time, NOW - 2 * DAY)
  assert.equal(sessions.get('stopped-approval')?.dshPending?.kind, 'plan')
  const original = structuredClone(facts)
  const upstream = buildBoard(facts, {}, NOW, 'en')
  assert.equal(upstream.stale.length, 0)
  assert.equal(upstream.projects[0]?.done, 2)
  const board = buildDshBoard(facts, {}, NOW, 'en')
  assert.deepEqual(board.stale.map(item => item.id), ['stopped-approval', 'pending-line'])
  assert.equal(board.stale.find(item => item.id === 'pending-line')?.waitMs, 2 * DAY)
  assert.equal(board.stale.find(item => item.id === 'pending-line')?.isHere, true)
  assert.equal(board.stale.find(item => item.id === 'pending-line')?.isLive, false)
  assert.ok(!board.resting.some(item => item.id === 'stopped-approval'))
  const project = board.projects.find(item => item.id === parent.id)!
  assert.equal(project.isActive, true)
  assert.equal(project.done, 1)
  assert.equal(project.lines[0]?.id, 'pending-line')
  assert.equal(project.lines[0]?.state, 'wait')
  assert.equal(project.lines.find(item => item.id === 'done-line')?.state, 'gone')
  assert.ok(r.collector.extras.diagnostics.some(message => message.includes('unresolved recorded input')))
  assert.deepEqual(facts, original, 'native arrangement is pure and does not invent a verdict')
})

test('native board: stopped pending coordinator is active; unreadable pending is not guessed actionable', () => {
  const coordinator: NativeFact = {
    id: 'parent', kind: 'cli', title: 'Stopped coordinator', live: false, status: null,
    dshPending: { text: '', time: NOW - MINUTE, kind: 'plan' },
  }
  const child: SessionFact = { id: 'child', kind: 'cli', title: 'Line', live: false, parent: 'parent' }
  const unreadable: NativeFact = {
    id: 'bad', kind: 'cli', title: 'Unreadable', live: false, readError: 'corrupt',
    dshPending: { text: 'not trustworthy', time: NOW, kind: 'ask' },
  }
  const facts: Facts = { generatedAt: NOW, sessions: [coordinator, child, unreadable], hiddenDormant: 0, errors: [] }
  const board = buildDshBoard(facts, {}, NOW, 'en')
  assert.deepEqual(board.stale.map(item => item.id), ['parent'])
  assert.equal(board.stale[0]?.ask, 'Review its plan')
  assert.equal(board.projects[0]?.isParentWaiting, true)
  assert.equal(board.projects[0]?.isActive, true)
  assert.equal(board.resting.find(item => item.id === 'bad')?.isUnreadable, true)
})

test('collector: ordinary fork is not delegation; local child has native target; external work has no guessed liveness/jump', async t => {
  const root = header('root')
  const fork = header('ordinary-fork', { parentSession: root.id })
  const child = header('native-child', { origin: 'subagent', parentSession: root.id })
  const r = rig(t, [
    { header: root, agent: 'idle', events: [
      event('subagent/catalog', { childId: 'external-child', mode: 'external', label: 'External research', childCreatedAt: NOW - MINUTE }),
      event('subagent/catalog', { childId: 'missing-local-child', mode: 'continuable', label: 'Unknown local work' }),
    ] },
    { header: fork, agent: 'idle' },
    { header: child, events: [event('subagent/descriptor', { mode: 'continuable', label: 'Native child work' })] },
  ])
  const facts = await r.collector.collect()
  const sessions = byId(facts)
  assert.equal(sessions.get('ordinary-fork')?.parent, null)
  assert.equal(sessions.get('native-child')?.parent, root.id)
  assert.equal(r.collector.extras.jumpTargets['ordinary-fork'], 'ordinary-fork')
  assert.deepEqual(r.collector.extras.jumpTargets['native-child'], {
    parentSessionId: root.id, childSessionId: child.id, mode: 'continuable',
  })
  const external = sessions.get('external-child')!
  assert.equal(external.parent, root.id)
  assert.equal(external.live, false)
  assert.match(external.readError ?? '', /External execution/)
  assert.equal(external.summary, undefined)
  assert.equal(r.collector.extras.jumpTargets['external-child'], undefined)
  assert.equal(sessions.has('missing-local-child'), false)
  assert.ok(r.collector.extras.diagnostics.some(message => message.includes('external execution')))
})

test('collector: cancellation interrupts listing without starting observations or publishing late results', async t => {
  const listed = deferred<any[]>()
  const entered = deferred<AbortSignal>()
  const r = rig(t, [{ header: header('one') }], {
    async listSessions(signal) { entered.resolve(signal); return listed.promise },
  })
  const collecting = r.collector.collect()
  const signal = await entered.promise
  r.collector.dispose()
  assert.equal(signal.aborted, true)
  await assert.rejects(collecting, error => error instanceof Error && error.name === 'AbortError')
  assert.equal(r.stats.visibleCalls, 0)
  assert.equal(r.stats.observations.length, 0)
  listed.resolve(r.records)
  assert.deepEqual(r.collector.extras, { jumpTargets: {}, diagnostics: [] })
  await assert.rejects(r.collector.collect(), /disposed/)
})

test('collector: cancellation interrupts the visible-session read before any lease starts', async t => {
  const visible = deferred<{ items: { sessionId: string }[] }>()
  const entered = deferred<AbortSignal>()
  const r = rig(t, [{ header: header('one') }], {
    async listVisible(signal) { entered.resolve(signal); return visible.promise },
  })
  const collecting = r.collector.collect()
  const signal = await entered.promise
  r.collector.dispose()
  await assert.rejects(collecting, error => error instanceof Error && error.name === 'AbortError')
  assert.equal(signal.aborted, true)
  assert.equal(r.stats.observations.length, 0)
  visible.resolve({ items: [{ sessionId: 'one' }] })
})

test('collector: an abort-ignoring late observation lease is still disposed exactly once', async t => {
  const entered = deferred<AbortSignal>()
  const release = deferred<void>()
  const disposed = deferred<void>()
  const r = rig(t, [{ header: header('late') }], {
    async delayObserve(_id, signal) { entered.resolve(signal); await release.promise },
    onDispose() { disposed.resolve() },
  })
  const collecting = r.collector.collect()
  const signal = await entered.promise
  assert.equal(r.stats.openLeases, 1)
  r.collector.dispose()
  await assert.rejects(collecting, error => error instanceof Error && error.name === 'AbortError')
  assert.equal(signal.aborted, true)
  assert.equal(r.stats.openLeases, 1, 'provider has not delivered its leased result yet')
  release.resolve()
  await disposed.promise
  assert.equal(r.stats.openLeases, 0)
  assert.equal(r.stats.disposals.get('late'), 1)
  assert.deepEqual(r.collector.extras, { jumpTargets: {}, diagnostics: [] })
})
