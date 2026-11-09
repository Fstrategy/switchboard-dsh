import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BoardText, Facts, SessionFact, TextEntry } from '../types/index.d.ts'
import { asModelReply, DEMO_TEXTS, demoFacts } from '../hooks/demo.ts'
import { pickLang, PROMPTS, STRINGS } from '../hooks/i18n.ts'
import type { Lang } from '../hooks/i18n.ts'
import { buildBoard, fingerprint, isTemp, needsText, parseText, promptFor, scrub } from '../hooks/logic.ts'
import {
  ASKS_PER_REFRESH,
  BoardEngine,
  TEXT_CACHE_TTL_MS,
  bandLine,
} from '../src/board-engine.ts'
import type {
  BoardEngineConfig,
  BoardEngineDependencies,
  CompletionInput,
  TextCache,
} from '../src/board-engine.ts'

// All completion functions in this file are in-process fakes, even when testing a mode named "live".
// No test imports a Harness Service, provider SDK, process runner, or network implementation.
const NOW = Date.UTC(2026, 10, 9, 15, 0)
const CONFIG: BoardEngineConfig = {
  summaries: true,
  language: 'auto',
  modelMode: 'fake',
  provider: 'fixture-provider',
  model: 'fixture-small',
}

const emptyFacts = (): Facts => ({ generatedAt: NOW, sessions: [], hiddenDormant: 0, errors: [] })
const native = (id: string, title = id, status: SessionFact['status'] = 'idle'): SessionFact => ({
  id,
  kind: 'cli',
  title,
  cwd: '/work/project',
  live: true,
  status,
  statusAt: NOW - 4 * 60_000,
  createdAt: NOW - 60 * 60_000,
  lastActivityAt: NOW - 4 * 60_000,
  progress: { at: '', text: 'A last reply from the main thread.' },
})
const factsOf = (...sessions: SessionFact[]): Facts => ({ ...emptyFacts(), sessions })
const modelReply = (text: Partial<BoardText> & Pick<BoardText, 'short' | 'doing'>): string => asModelReply(text)

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const memoryCache = () => {
  const entries = new Map<string, TextEntry>()
  const stats = { gets: 0, puts: 0 }
  const cache: TextCache = {
    async get(key) { stats.gets += 1; return entries.get(key) },
    async put(key, value) { stats.puts += 1; entries.set(key, value) },
  }
  return { cache, entries, stats }
}

const world = (initial = demoFacts(NOW, 'en'), config: Partial<BoardEngineConfig> = {}) => {
  const store = memoryCache()
  const state = {
    facts: initial,
    now: NOW,
    failure: '',
    collects: 0,
    inputs: [] as CompletionInput[],
    replies: {} as Record<string, string>,
  }
  const engine = new BoardEngine({ ...CONFIG, ...config }, {
    async collect() {
      state.collects += 1
      if (state.failure) throw new Error(state.failure)
      return structuredClone(state.facts)
    },
    async complete(input) {
      state.inputs.push(input)
      const override = state.replies[input.session.id]
      if (override !== undefined) return override
      const text = DEMO_TEXTS[input.lang][input.session.id]
      return text
        ? asModelReply(text)
        : modelReply({ short: input.session.title, doing: 'record read' })
    },
    cache: store.cache,
    now: () => state.now,
  })
  return { engine, state, ...store }
}

const settle = async (engine: BoardEngine, lang: Lang = 'en') => {
  // Upstream budgets eight unique requests per tick; its fourteen-session fixture settles in two.
  await engine.refresh(lang)
  await engine.refresh(lang)
  return engine.snapshot(lang)
}

test('acceptance 1: blocker, question, card; stopped wait apart; coordinator and delivered lines', async t => {
  const { engine } = world()
  t.after(() => engine.dispose())
  const { board } = await settle(engine)
  assert.ok(board)
  assert.deepEqual(board.waiting.map(item => item.id), [
    'local_demo_checkout', 'local_demo_landing', 'local_demo_onboarding',
  ])
  assert.deepEqual(board.waiting.map(item => item.kind), ['block', 'question', 'card'])
  assert.deepEqual(board.stale.map(item => item.id), ['local_demo_search'])
  assert.equal(board.stale[0]?.waitMs, 2 * 24 * 60 * 60_000)
  assert.equal(board.waiting[2]?.isHere, true)
  const checkout = board.projects.find(project => project.id === 'local_demo_checkout')
  assert.equal(checkout?.name, 'Checkout v2')
  assert.equal(checkout?.done, 1)
  assert.equal(checkout?.lines.length, 4)
  assert.match(checkout?.lines.find(line => line.id === 'local_demo_tax')?.doing ?? '', /testing 12 regions/)
  const docs = board.projects.find(project => project.id === 'local_demo_docs')
  assert.equal(docs?.isActive, false)
  assert.equal(docs?.done, 2)
  assert.equal(board.resting.find(item => item.id === 'local_demo_analytics')?.isCloseable, true)
  assert.equal(board.hiddenDormant, 7)
  assert.equal(board.liveCount, 10)
  assert.equal(board.units, 8)
  assert.equal(board.linesRunning, 3)
})

test('acceptance 2: replying and becoming busy suppresses even an old blocked verdict', async t => {
  const { engine, state } = world()
  t.after(() => engine.dispose())
  await settle(engine)
  const coordinator = state.facts.sessions.find(session => session.id === 'local_demo_checkout')!
  coordinator.status = 'busy'
  coordinator.progress = { at: '', text: 'Got it, applying the refund rule.' }
  await engine.refresh('en')
  const board = engine.snapshot('en').board!
  assert.ok(!board.waiting.some(item => item.id === coordinator.id))
  assert.ok(!board.waiting.some(item => item.kind === 'block'))
  assert.ok(board.waiting.some(item => item.id === 'local_demo_landing'))
  assert.equal(coordinator.summary?.category, 'blocked')
})

test('acceptance 3: prompt band counts only other live sessions, never its own session', async t => {
  const { engine } = world()
  t.after(() => engine.dispose())
  const board = (await settle(engine)).board!
  const line = bandLine(board, 'local_demo_landing', 'en')
  assert.match(line, /^2 waiting on you · Checkout coordinator is blocking others/)
  assert.ok(!line.includes('Landing page hero'))
  assert.ok(!line.includes('left for a while'))
  assert.match(bandLine(board, 'local_demo_checkout', 'en'), /^2 waiting on you · Landing page hero is asking you/)
})

test('acceptance 4: calm band still has text and a localized Board action label', async t => {
  const calm = demoFacts(NOW, 'en')
  calm.sessions = calm.sessions.filter(session => ['local_demo_tax', 'local_demo_receipts'].includes(session.id))
  const { engine } = world(calm)
  t.after(() => engine.dispose())
  await engine.refresh('en')
  const board = engine.snapshot('en').board!
  assert.equal(bandLine(board, undefined, 'en'), 'Nothing is waiting on you')
  assert.equal(STRINGS.en.band.open, 'Board')
  assert.equal(STRINGS.zh.band.open, '看板')
  // Rendering/pressing that label is verified in the Client integration, not by this pure-engine test.
  const selfOnly = buildBoard(factsOf({ ...native('self'), status: 'waiting', waitingFor: 'answer' }), {}, NOW, 'en')
  assert.equal(bandLine(selfOnly, 'self', 'en'), 'No other session is waiting on you')
})

test('acceptance 5: failed collection is explicit, keeps warned previous facts, and recovers', async t => {
  const { engine, state } = world()
  t.after(() => engine.dispose())
  state.failure = 'boom: cannot read the sessions folder'
  await engine.refresh('en')
  assert.equal(engine.snapshot('en').board, null)
  assert.match(engine.snapshot('en').note, /The board didn't refresh this time: boom/)
  assert.equal(engine.counters.modelCalls, 0)
  state.failure = ''
  const successful = await settle(engine)
  assert.ok(successful.board)
  assert.equal(successful.note, '')
  const calls = engine.counters.modelCalls
  state.failure = 'projection lease unavailable'
  await engine.refresh('en')
  const warned = engine.snapshot('en')
  assert.deepEqual(warned.board?.waiting, successful.board.waiting)
  assert.match(warned.note, /projection lease unavailable/)
  assert.equal(engine.counters.modelCalls, calls)
  state.failure = ''
  await engine.refresh('en')
  assert.equal(engine.snapshot('en').note, '')
})

test('acceptance 6: temporary one-off cwd classification, including Windows, denies mounting', () => {
  for (const cwd of [
    '/tmp/eval-1', '/private/tmp/eval-1', '/var/folders/x_/abc/T', '/private/var/folders/x_/abc/T',
    'C:\\Users\\me\\AppData\\Local\\Temp\\eval',
  ]) assert.equal(isTemp(cwd), true, cwd)
  for (const cwd of ['/home/me/proj', '/Users/me/work/app', 'C:\\Users\\me\\code\\app']) {
    assert.equal(isTemp(cwd), false, cwd)
  }
  // Actual command/auto-open guards are owned by the Host/Client adapter.
})

test('acceptance 7: locale, explicit override and both prompt languages agree', async t => {
  assert.equal(pickLang('auto', 'zh_CN.UTF-8'), 'zh')
  assert.equal(pickLang('auto', 'zh_TW.UTF-8'), 'zh')
  assert.equal(pickLang('auto', 'ZH-Hant'), 'zh')
  assert.equal(pickLang('en', 'zh_CN.UTF-8'), 'en')
  assert.equal(pickLang('zh', 'en_US.UTF-8'), 'zh')
  assert.equal(pickLang('auto', undefined), 'en')
  const fixture = demoFacts(NOW, 'zh')
  fixture.sessions = fixture.sessions.filter(session => session.id === 'local_demo_landing')
  const { engine, state } = world(fixture)
  t.after(() => engine.dispose())
  await Promise.all([engine.refresh('en'), engine.refresh('zh')])
  assert.equal(state.collects, 1)
  assert.equal(state.inputs.length, 2)
  const english = state.inputs.find(input => input.lang === 'en')!
  const chinese = state.inputs.find(input => input.lang === 'zh')!
  assert.match(english.prompt, /\[Session title\]/)
  assert.match(chinese.prompt, /【会话标题】/)
  assert.equal(english.system, PROMPTS.en.system)
  assert.equal(chinese.system, PROMPTS.zh.system)
  assert.match(engine.snapshot('zh').board!.waiting[0]!.ask, /选标题/)
  const callsBeforeOverride = state.inputs.length
  engine.configure({ language: 'en' })
  await engine.refresh(pickLang(engine.config.language, 'zh_CN.UTF-8'))
  assert.equal(state.inputs.length, callsBeforeOverride) // Reuse only the existing English entry.
  assert.match(engine.snapshot('en').board!.waiting[0]!.ask, /Pick a headline/)
  assert.ok(engine.snapshot('en').texts.local_demo_landing)
})

test('acceptance 8: short lines off makes zero calls and ignores previous semantic text', async t => {
  const off = world(demoFacts(NOW, 'en'), { summaries: false })
  t.after(() => off.engine.dispose())
  await off.engine.refresh('en')
  const fallback = off.engine.snapshot('en')
  assert.equal(off.engine.counters.modelCalls, 0)
  assert.equal(off.stats.gets, 0)
  assert.deepEqual(fallback.texts, {})
  assert.equal(fallback.board!.waiting.find(item => item.id === 'local_demo_landing')?.ask, 'Which headline should the hero use?')
  assert.match(fallback.board!.waiting.find(item => item.id === 'local_demo_onboarding')?.ask ?? '', /Decide on the card “Translate onboarding into Spanish”/)
  const on = world()
  t.after(() => on.engine.dispose())
  await settle(on.engine)
  assert.ok(on.engine.snapshot('en').texts.local_demo_checkout)
  const before = on.engine.counters.modelCalls
  on.engine.configure({ summaries: false })
  assert.deepEqual(on.engine.snapshot('en').texts, {})
  assert.equal(on.engine.snapshot('en').board!.waiting[0]?.kind, 'question')
  await on.engine.refresh('en')
  assert.equal(on.engine.counters.modelCalls, before)
})

test('acceptance 9: last-reply question without native verdict becomes a personal decision', async t => {
  const auth = native('auth', 'Refactor auth')
  auth.progress = { at: '', text: 'First pass done. Rename the old tables too, or leave them?' }
  const migration = native('migration', 'Write migration')
  migration.progress = { at: '', text: 'Migration written and tested; nothing else to do.' }
  const { engine, state } = world(factsOf(auth, migration))
  t.after(() => engine.dispose())
  state.replies.auth = modelReply({
    short: 'Refactor auth', doing: 'first pass done', ask: 'Say whether to rename the old tables', needsUser: true, forUser: true,
  })
  state.replies.migration = modelReply({ short: 'Write migration', doing: 'written and tested', closeable: true })
  await engine.refresh('en')
  const board = engine.snapshot('en').board!
  assert.deepEqual(board.waiting.map(item => [item.id, item.kind]), [['auth', 'decide']])
  assert.equal(board.waiting[0]?.ask, 'Say whether to rename the old tables')
  assert.equal(board.resting.find(item => item.id === 'migration')?.isCloseable, true)
  assert.ok(engine.snapshot('en').facts!.sessions.every(session => !session.summary))
  engine.configure({ summaries: false })
  assert.equal(engine.snapshot('en').board!.waiting.length, 0)
})

test('acceptance 10: a parent merely relaying a descendant action is not listed twice', async t => {
  const facts = demoFacts(NOW, 'en')
  facts.sessions.push({
    ...native('planning', 'Weekly planning'),
    summary: { category: 'blocked', detail: 'handed checkout off', needs: 'approve refund in checkout', fresh: true },
  })
  facts.sessions.find(session => session.id === 'local_demo_checkout')!.parent = 'planning'
  const { engine, state } = world(facts)
  t.after(() => engine.dispose())
  state.replies.planning = modelReply({
    short: 'Weekly planning', doing: 'checkout handed off', ask: 'Go to the checkout session and approve the refund rule',
    forUser: true, relay: true,
  })
  const board = (await settle(engine)).board!
  assert.ok(board.waiting.some(item => item.id === 'local_demo_checkout'))
  assert.ok(!board.waiting.some(item => item.id === 'planning'))
  assert.equal(engine.snapshot('en').texts.planning?.text.relay, true)
})

test('acceptance 11: demo swaps only the view, has no collector/model/cache effects, then goes back', async t => {
  const { engine, state, stats } = world(emptyFacts())
  t.after(() => engine.dispose())
  await engine.refresh('en')
  const before = { collects: state.collects, calls: engine.counters.modelCalls, gets: stats.gets, puts: stats.puts }
  const demo = engine.snapshot('en', true)
  assert.equal(demo.facts?.platform, 'demo')
  assert.equal(demo.board!.waiting[0]?.id, 'local_demo_checkout')
  assert.match(demo.board!.waiting[0]?.ask ?? '', /Approve the refund rule/)
  state.now += 60_000
  assert.equal(engine.snapshot('en', true).board!.waiting[0]?.waitMs, demo.board!.waiting[0]?.waitMs)
  assert.deepEqual({ collects: state.collects, calls: engine.counters.modelCalls, gets: stats.gets, puts: stats.puts }, before)
  const back = engine.snapshot('en', false)
  assert.equal(back.facts?.sessions.length, 0)
  assert.equal(back.board!.waiting.length, 0)
  assert.equal(back.facts?.platform, undefined)
  assert.equal(STRINGS.en.demoJump, 'This is demo data: there is no real session to open.')
  // Engine exposes no navigation side effect. The Host must deny jumps for its demo viewing context;
  // Client/Host command and jump integration tests cover that separate adapter boundary.
})

test('safety: concurrent refreshes and duplicate prompts share collection and one completion', async t => {
  const started = deferred<void>()
  const released = deferred<string>()
  let facts = factsOf(native('one', 'Same work'), native('two', 'Same work'))
  let collects = 0
  let calls = 0
  const engine = new BoardEngine(CONFIG, {
    async collect() { collects += 1; return structuredClone(facts) },
    async complete() { calls += 1; started.resolve(); return released.promise },
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  const first = engine.refresh('en')
  const second = engine.refresh('en')
  assert.equal(first, second)
  await started.promise
  assert.equal(collects, 1)
  assert.equal(calls, 1)
  released.resolve(modelReply({ short: 'Shared answer', doing: 'working' }))
  await Promise.all([first, second])
  assert.equal(Object.keys(engine.snapshot('en').texts).length, 2)
  facts = factsOf(...facts.sessions, native('three', 'Same work'))
  await engine.refresh('en')
  assert.equal(calls, 1)
  assert.equal(Object.keys(engine.snapshot('en').texts).length, 3)
  assert.equal(engine.counters.cacheHits, 1)
})

test('safety: disabling while cache lookup is pending wins the hard call-entry gate', async t => {
  const entered = deferred<void>()
  const lookup = deferred<TextEntry | undefined>()
  let calls = 0
  const engine = new BoardEngine(CONFIG, {
    async collect() { return factsOf(native('one')) },
    async complete() { calls += 1; return modelReply({ short: 'One', doing: 'done' }) },
    cache: { async get() { entered.resolve(); return lookup.promise }, async put() { assert.fail('must not persist') } },
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  const refreshing = engine.refresh('en')
  await entered.promise
  engine.configure({ summaries: false })
  lookup.resolve(undefined)
  await refreshing
  assert.equal(calls, 0)
  assert.equal(engine.counters.modelCalls, 0)
  assert.deepEqual(engine.snapshot('en').texts, {})
})

test('safety: disabling aborts outstanding completion and discards an abort-ignoring late answer', async t => {
  const entered = deferred<AbortSignal>()
  const answer = deferred<string>()
  const store = memoryCache()
  const engine = new BoardEngine(CONFIG, {
    async collect() { return factsOf(native('one')) },
    async complete(input) { entered.resolve(input.signal); return answer.promise },
    cache: store.cache,
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  const refreshing = engine.refresh('en')
  const signal = await entered.promise
  engine.configure({ summaries: false })
  assert.equal(signal.aborted, true)
  answer.resolve(modelReply({ short: 'Late', doing: 'done', needsUser: true, forUser: true }))
  await refreshing
  assert.equal(engine.counters.modelCalls, 1)
  assert.equal(store.stats.puts, 0)
  assert.deepEqual(engine.snapshot('en').texts, {})
  assert.equal(engine.snapshot('en').board!.waiting.length, 0)
  assert.equal(engine.snapshot('en').note, '')
})

test('safety: provider, model, mode and language changes abort and generation-guard old answers', async t => {
  for (const change of [
    { provider: 'another-provider' }, { model: 'another-model' }, { modelMode: 'live' as const }, { language: 'zh' as const },
  ]) {
    await t.test(JSON.stringify(change), async () => {
      const entered = deferred<AbortSignal>()
      const answer = deferred<string>()
      const store = memoryCache()
      const engine = new BoardEngine(CONFIG, {
        async collect() { return factsOf(native('one')) },
        async complete(input) { entered.resolve(input.signal); return answer.promise },
        cache: store.cache,
        now: () => NOW,
      })
      const refreshing = engine.refresh('en')
      const signal = await entered.promise
      engine.configure(change)
      assert.equal(signal.aborted, true)
      answer.resolve(modelReply({ short: 'Old route', doing: 'stale' }))
      await refreshing
      assert.deepEqual(engine.snapshot('en').texts, {})
      assert.equal(store.stats.puts, 0)
      engine.dispose()
    })
  }
})

test('safety: shared persisted cache is reused only for the same route, mode and language', async t => {
  const store = memoryCache()
  const execute = async (config: Partial<BoardEngineConfig> = {}, lang: Lang = 'en') => {
    const engine = new BoardEngine({ ...CONFIG, ...config }, {
      async collect() { return factsOf(native('one')) },
      async complete(input) { return modelReply({ short: input.lang === 'zh' ? '同一件事' : 'Same thing', doing: 'working' }) },
      cache: store.cache,
      now: () => NOW,
    })
    t.after(() => engine.dispose())
    await engine.refresh(lang)
    return engine
  }
  assert.equal((await execute()).counters.modelCalls, 1)
  const reused = await execute()
  assert.equal(reused.counters.modelCalls, 0)
  assert.equal(reused.counters.cacheHits, 1)
  assert.equal((await execute({ provider: 'new-provider' })).counters.modelCalls, 1)
  assert.equal((await execute({ model: 'new-model' })).counters.modelCalls, 1)
  assert.equal((await execute({}, 'zh')).counters.modelCalls, 1)
  assert.equal((await execute({ modelMode: 'live' })).counters.modelCalls, 1)
})

test('safety: expired persisted text is not reused', async t => {
  const store = memoryCache()
  const deps: BoardEngineDependencies = {
    async collect() { return factsOf(native('one')) },
    async complete() { return modelReply({ short: 'Fresh', doing: 'working' }) },
    cache: store.cache,
    now: () => NOW,
  }
  const first = new BoardEngine(CONFIG, deps)
  await first.refresh('en')
  first.dispose()
  for (const [key, entry] of store.entries) store.entries.set(key, { ...entry, at: NOW - TEXT_CACHE_TTL_MS - 1 })
  const second = new BoardEngine(CONFIG, deps)
  t.after(() => second.dispose())
  await second.refresh('en')
  assert.equal(second.counters.modelCalls, 1)
  assert.equal(second.counters.cacheHits, 0)
})

test('safety: busy content is throttled for five minutes but a status change is immediate', async t => {
  const session = native('busy', 'Busy work', 'busy')
  session.progress = { at: '', text: 'Progress: first pass' }
  const { engine, state } = world(factsOf(session))
  t.after(() => engine.dispose())
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, 1)
  state.now += 60_000
  session.progress = { at: '', text: 'Progress: second pass' }
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, 1)
  state.now = NOW + 5 * 60_000 + 1
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, 2)
  session.status = 'idle'
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, 3)
})

test('safety: mode off ignores semantic caches and makes zero additional model calls', async t => {
  const { engine } = world()
  t.after(() => engine.dispose())
  await settle(engine)
  const before = engine.counters.modelCalls
  engine.configure({ modelMode: 'off' })
  assert.deepEqual(engine.snapshot('en').texts, {})
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, before)
  engine.configure({ modelMode: 'fake' })
  await settle(engine)
  assert.equal(engine.counters.modelCalls, before)
  assert.ok(engine.counters.cacheHits > 0)
})

test('safety: malformed/failed model output is a visible warning with recorded fallback', async t => {
  const question = { ...native('question', 'Question', 'waiting'), question: { at: '', text: 'Pick the headline?', kind: 'ask' as const } }
  const { engine, state } = world(factsOf(question))
  t.after(() => engine.dispose())
  state.replies.question = 'not JSON'
  await engine.refresh('en')
  assert.match(engine.snapshot('en').note, /returned invalid JSON/)
  assert.equal(engine.snapshot('en').board!.waiting[0]?.ask, 'Pick the headline?')
  assert.deepEqual(engine.snapshot('en').texts, {})
  state.replies.question = modelReply({ short: 'Question', doing: 'ready', ask: 'Pick the headline' })
  await engine.refresh('en')
  assert.equal(engine.snapshot('en').note, '')
  assert.equal(engine.snapshot('en').board!.waiting[0]?.ask, 'Pick the headline')
})

test('safety: cache write failure preserves paid-for in-memory answer but exposes the failure', async t => {
  const engine = new BoardEngine(CONFIG, {
    async collect() { return factsOf(native('one')) },
    async complete() { return modelReply({ short: 'Saved in memory', doing: 'working' }) },
    cache: { async get() { return undefined }, async put() { throw new Error('storage unavailable') } },
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  await engine.refresh('en')
  assert.equal(engine.snapshot('en').texts.one?.text.short, 'Saved in memory')
  assert.match(engine.snapshot('en').note, /storage unavailable/)
})

test('safety: disposal invalidates a pending collector and all future refreshes', async () => {
  const entered = deferred<void>()
  const result = deferred<Facts>()
  let collects = 0
  let calls = 0
  const engine = new BoardEngine(CONFIG, {
    async collect() { collects += 1; entered.resolve(); return result.promise },
    async complete() { calls += 1; return modelReply({ short: 'One', doing: 'working' }) },
    now: () => NOW,
  })
  const refreshing = engine.refresh('en')
  await entered.promise
  engine.dispose()
  result.resolve(factsOf(native('one')))
  await refreshing
  await engine.refresh('en')
  assert.equal(collects, 1)
  assert.equal(calls, 0)
  assert.equal(engine.snapshot('en').facts, null)
})

test('safety: per-refresh unique-call budget and batches retain upstream limits', async t => {
  let active = 0
  let maximum = 0
  const engine = new BoardEngine(CONFIG, {
    async collect() { return factsOf(...Array.from({ length: 14 }, (_, index) => native(`s${index}`, `Work ${index}`))) },
    async complete(input) {
      active += 1
      maximum = Math.max(maximum, active)
      await Promise.resolve()
      active -= 1
      return modelReply({ short: input.session.title, doing: 'working' })
    },
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, ASKS_PER_REFRESH)
  assert.equal(Object.keys(engine.snapshot('en').texts).length, ASKS_PER_REFRESH)
  assert.ok(maximum <= 4)
  await engine.refresh('en')
  assert.equal(engine.counters.modelCalls, 14)
})

test('safety: rapid off/on cannot let an old generation overwrite the replacement answer', async t => {
  const entered = [deferred<AbortSignal>(), deferred<AbortSignal>()]
  const answers = [deferred<string>(), deferred<string>()]
  const store = memoryCache()
  let calls = 0
  const engine = new BoardEngine(CONFIG, {
    async collect() { return factsOf(native('one')) },
    async complete(input) {
      const index = calls++
      entered[index]!.resolve(input.signal)
      return answers[index]!.promise
    },
    cache: store.cache,
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  const oldRefresh = engine.refresh('en')
  const oldSignal = await entered[0]!.promise
  engine.configure({ summaries: false })
  engine.configure({ summaries: true })
  const newRefresh = engine.refresh('en')
  await entered[1]!.promise
  assert.equal(oldSignal.aborted, true)
  answers[1]!.resolve(modelReply({ short: 'Replacement', doing: 'current' }))
  await newRefresh
  answers[0]!.resolve(modelReply({ short: 'Obsolete', doing: 'late' }))
  await oldRefresh
  assert.equal(engine.snapshot('en').texts.one?.text.short, 'Replacement')
  assert.equal(store.stats.puts, 1)
  assert.equal(engine.counters.modelCalls, 2)
})

test('safety: a rejected model call leaves records intact and explains the failure', async t => {
  const engine = new BoardEngine(CONFIG, {
    async collect() { return factsOf({ ...native('one', 'Question', 'waiting'), waitingFor: 'Choose a headline' }) },
    async complete() { throw new Error('fixture route unavailable') },
    now: () => NOW,
  })
  t.after(() => engine.dispose())
  await engine.refresh('en')
  assert.match(engine.snapshot('en').note, /fixture route unavailable/)
  assert.equal(engine.snapshot('en').board!.waiting[0]?.ask, 'Choose a headline')
  assert.equal(engine.counters.modelCalls, 1)
})

test('native arrangement extension handles real facts only and never changes the upstream demo', async t => {
  const stopped: SessionFact = {
    ...native('stopped', 'Stopped native question'), live: false, status: null,
    question: { at: '', text: 'Choose a headline', kind: 'ask' },
  }
  let arrangements = 0
  const engine = new BoardEngine({ ...CONFIG, summaries: false }, {
    async collect() { return factsOf(stopped) },
    async complete() { assert.fail('disabled model must not run') },
    now: () => NOW,
    arrange(facts, texts, now, lang) {
      arrangements += 1
      assert.equal(facts.sessions[0]?.id, 'stopped')
      assert.equal(facts.sessions[0]?.summary, undefined)
      assert.deepEqual(texts, {})
      assert.equal(now, NOW)
      assert.equal(lang, 'en')
      const board = buildBoard(facts, texts, now, lang)
      assert.equal(board.stale.length, 0) // The unchanged source cannot represent this native fact.
      return {
        ...board,
        stale: [{ id: stopped.id, name: stopped.title, ask: stopped.question!.text, why: '', kind: 'question',
          waitMs: now - stopped.lastActivityAt!, isHere: false, isLive: false }],
        resting: board.resting.filter(item => item.id !== stopped.id),
      }
    },
  })
  t.after(() => engine.dispose())
  await engine.refresh('en')
  assert.equal(arrangements, 0)
  const real = engine.snapshot('en')
  assert.equal(arrangements, 1)
  assert.equal(real.board!.stale[0]?.ask, 'Choose a headline')
  assert.equal(real.board!.resting.length, 0)
  const demo = engine.snapshot('en', true)
  assert.equal(arrangements, 1)
  assert.equal(demo.board!.waiting[0]?.id, 'local_demo_checkout')
  assert.equal(demo.board!.stale[0]?.id, 'local_demo_search')
  assert.equal(real.facts!.sessions[0]?.summary, undefined)
})

test('pures: exact booleans, field clipping/scrubbing and content-only cache fingerprints', () => {
  const parsed = parseText(JSON.stringify({
    short: 'A'.repeat(100), doing: '`done` /Users/me/secret 07b07b63',
    needs_user: 'true', for_user: true, blocking: 1, closeable: true,
  }), 'en')!
  assert.equal(Array.from(parsed.short).length, PROMPTS.en.limits.short)
  assert.ok(parsed.short.endsWith('…'))
  assert.equal(parsed.doing, 'done')
  assert.equal(parsed.needsUser, false)
  assert.equal(parsed.forUser, true)
  assert.equal(parsed.blocking, false)
  assert.equal(parsed.closeable, true)
  assert.equal(parseText('bad JSON', 'en'), null)
  assert.equal(scrub('`hello` origin/branch 1234567'), 'hello')
  const session = native('one')
  const first = promptFor(session, PROMPTS.en.role.single, 'en')
  const second = promptFor({ ...session, statusAt: NOW + 60_000, lastFocusedAt: NOW }, PROMPTS.en.role.single, 'en')
  assert.equal(first, second)
  assert.equal(fingerprint(first), fingerprint(second))
  const have: TextEntry = { key: 'same', at: NOW, status: 'idle', text: parsed }
  assert.equal(needsText(session, 'same', have, NOW + 1_000_000), false)
  assert.equal(needsText({ ...session, status: 'busy' }, 'changed', have, NOW), true)
})
