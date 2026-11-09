import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import type { Board, Facts, WaitItem } from '../types/index.d.ts'
import { demoFacts, demoTexts } from '../hooks/demo.ts'
import { buildBoard } from '../hooks/logic.ts'
import { pickLang, STRINGS } from '../hooks/i18n.ts'
import { DSH_DICTIONARIES, LOCALE_NAMESPACE } from '../src/dsh-i18n.ts'
import { apply, bandSummary, inject, PACKAGE_ID, PANE_KIND, POLL_MS, SessionBoardStore } from '../src/client.tsx'
import type { BoardAction, ClientSnapshot, SessionTarget } from '../src/client.tsx'

// Boundary tests only: native node:test + fake transport/environment. No DOM, React render,
// fake application page, browser, filesystem session collector, or real model is involved.
const NOW = Date.UTC(2026, 10, 9, 11, 0)
const SELF = 'fixture-viewer'
type Wire = { ok: true; value: unknown } | { ok: false; error: unknown }
type Call = { endpoint: 'snapshot' | 'act'; payload: Record<string, unknown>; signal: AbortSignal }
type Override = (call: Call) => Promise<Wire>
type Dispose = () => void

const snapshotOf = (patch: Partial<ClientSnapshot> = {}): ClientSnapshot => {
  const facts: Facts = {
    generatedAt: NOW,
    sessions: [{ id: SELF, title: 'Viewing session', kind: 'cli', live: true, cwd: '/work/fixture', status: 'idle' }],
    hiddenDormant: 0,
    errors: [],
  }
  return {
    facts,
    board: buildBoard(facts, {}, NOW, 'en'),
    eligible: true,
    lang: 'en',
    demo: false,
    note: '',
    config: {
      language: 'auto', summaries: false, modelMode: 'off', provider: '', model: '',
      openPane: 'command', footerCommand: '', footerLabel: '',
    },
    counters: { modelCalls: 0, cacheHits: 0 },
    openRevision: 0,
    jumpTargets: {},
    diagnostics: [],
    ...patch,
  }
}

class FakeWorld {
  snapshot: ClientSnapshot
  selected = true
  locale = 'en-US'
  readonly calls: Call[] = []
  readonly opens: string[] = []
  readonly navigations: SessionTarget[] = []
  readOverride: Override | undefined
  actOverride: Override | undefined
  navigationFailure = false

  constructor(snapshot = snapshotOf()) { this.snapshot = snapshot }
  readonly rpc = async (endpoint: Call['endpoint'], payload: Record<string, unknown>, signal: AbortSignal): Promise<Wire> => {
    const call: Call = { endpoint, payload, signal }
    this.calls.push(call)
    if (signal.aborted) throw signal.reason
    if (endpoint === 'snapshot') {
      if (this.readOverride) return this.readOverride(call)
      const value = structuredClone(this.snapshot)
      value.lang = pickLang(value.config.language, String(payload.locale ?? ''))
      return { ok: true, value }
    }
    if (this.actOverride) return this.actOverride(call)
    const action = payload.action as BoardAction
    if (action === 'demo') {
      const lang = pickLang(this.snapshot.config.language, String(payload.locale ?? ''))
      const demo = !this.snapshot.demo
      const facts = demo ? demoFacts(NOW, lang) : snapshotOf().facts!
      this.snapshot = {
        ...this.snapshot, demo, lang, facts,
        board: buildBoard(facts, demo ? demoTexts(NOW, lang) : {}, NOW, lang),
        note: STRINGS[lang][demo ? 'demoOn' : 'demoOff'],
        openRevision: this.snapshot.openRevision + 1,
      }
    } else if (action === 'open') {
      this.snapshot.openRevision++
    } else if (action === 'configure') {
      this.snapshot.config = { ...this.snapshot.config, ...payload.patch as object }
    }
    return { ok: true, value: { ok: true } }
  }

  environment() {
    return {
      rpc: this.rpc,
      locale: () => this.locale,
      selected: (id: string) => this.selected && id === SELF,
      open: (id: string) => { this.opens.push(id) },
      navigate: (target: SessionTarget) => {
        if (this.navigationFailure) throw new Error('fixture navigation rejected')
        this.navigations.push(target)
      },
    }
  }
  reads(): Call[] { return this.calls.filter(call => call.endpoint === 'snapshot') }
  actions(action?: BoardAction): Call[] {
    return this.calls.filter(call => call.endpoint === 'act' && (!action || call.payload.action === action))
  }
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const microtasks = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
const useClock = (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  return t.mock.timers
}
const rig = (t: TestContext, snapshot = snapshotOf()) => {
  const world = new FakeWorld(snapshot)
  const store = new SessionBoardStore(SELF, world.environment())
  const release = store.subscribe(() => {})
  t.after(() => { release(); store.dispose() })
  return { world, store, release, ready: () => store.refresh() }
}
const waiting = (id: string, name = id): WaitItem => ({
  id, name, ask: 'Choose a fixture option', why: '', kind: 'question', waitMs: 60_000, isHere: false, isLive: true,
})

for (const lang of ['en', 'zh'] as const) {
  test(`client acceptance 11 (${lang}): act demo toggles snapshot fixture on and off through one shared store`, async t => {
    const initial = snapshotOf({ lang })
    initial.config.language = lang
    const { store, world, ready } = rig(t, initial)
    await ready()
    assert.equal(store.getSnapshot().snapshot?.demo, false)
    await store.open(true)
    const demo = store.getSnapshot().snapshot!
    assert.equal(demo.demo, true)
    assert.equal(demo.note, STRINGS[lang].demoOn)
    assert.deepEqual(demo.board?.waiting.map(item => item.kind), ['block', 'question', 'card'])
    assert.deepEqual(demo.board?.stale.map(item => item.id), ['local_demo_search'])
    const project = demo.board?.projects.find(item => item.id === 'local_demo_checkout')
    assert.equal(project?.done, 1)
    assert.equal(project?.lines.length, 4)
    assert.deepEqual(world.opens, [SELF], 'local native open is not replayed when its Host revision returns')
    await store.open(true)
    assert.equal(store.getSnapshot().snapshot?.demo, false)
    assert.equal(store.getSnapshot().snapshot?.note, STRINGS[lang].demoOff)
    assert.equal(world.actions('demo').length, 2)
    assert.deepEqual(world.opens, [SELF, SELF])
    assert.equal(store.getSnapshot().snapshot?.counters.modelCalls, 0)
  })

  test(`client acceptance 11 (${lang}): demo jump displays upstream note with zero focus calls and zero navigation`, async t => {
    const initial = snapshotOf({ demo: true, lang, jumpTargets: { demo: 'must-not-open' } })
    initial.config.language = lang
    const { store, world, ready } = rig(t, initial)
    await ready()
    await store.jump('demo')
    assert.equal(store.getSnapshot().notice, STRINGS[lang].demoJump)
    assert.equal(world.actions().length, 0)
    assert.deepEqual(world.navigations, [])
  })
}

test('client native jump records target focus then navigates exact Session id or durable subagent address', async t => {
  const child: SessionTarget = { parentSessionId: 'fixture-parent', childSessionId: 'fixture-child', mode: 'continuable' }
  const { store, world, ready } = rig(t, snapshotOf({ jumpTargets: { normal: 'fixture-normal', child } }))
  await ready()
  await store.jump('normal')
  await store.jump('child')
  assert.deepEqual(world.navigations, ['fixture-normal', child])
  assert.deepEqual(world.actions('focus').map(call => call.payload.patch), [{ id: 'normal' }, { id: 'child' }])
  assert.equal(world.reads().length, 1, 'focus acknowledgement does not wait for an unrelated board reread')
  assert.equal(store.getSnapshot().notice, '')
})

test('client jump shows cannotJump for absent target without a Host action', async t => {
  const { store, world, ready } = rig(t)
  await ready()
  await store.jump('missing')
  assert.equal(store.getSnapshot().notice, STRINGS.en.cannotJump)
  assert.equal(world.actions().length, 0)
  assert.deepEqual(world.navigations, [])
})

test('client jump surfaces operation refusal and transport refusal without navigation', async t => {
  const { store, world, ready } = rig(t, snapshotOf({ jumpTargets: { target: 'fixture-target' } }))
  await ready()
  world.actOverride = async () => ({ ok: true, value: { ok: false, reason: 'fixture Host refused focus' } })
  await store.jump('target')
  assert.equal(store.getSnapshot().actionError, 'fixture Host refused focus')
  assert.equal(store.getSnapshot().busy, null)
  assert.deepEqual(world.navigations, [])
  world.actOverride = async () => ({ ok: false, error: { code: 'fixture/denied', message: 'fixture owner access required' } })
  await store.jump('target')
  assert.equal(store.getSnapshot().actionError, 'fixture owner access required')
  assert.deepEqual(world.navigations, [])
})

test('client native navigation exception displays unchanged jumpFailed text', async t => {
  const { store, world, ready } = rig(t, snapshotOf({ jumpTargets: { target: 'fixture-target' } }))
  await ready()
  world.navigationFailure = true
  await store.jump('target')
  assert.equal(store.getSnapshot().notice, STRINGS.en.jumpFailed)
  assert.equal(world.actions('focus').length, 1)
})

test('client acceptance 4: zero waits retains Board action and opens native pane before Host completion', async t => {
  const { store, world, ready } = rig(t)
  await ready()
  const board = store.getSnapshot().snapshot!.board!
  assert.equal(board.waiting.length, 0)
  assert.equal(bandSummary(board, SELF, STRINGS.en).text.trim(), STRINGS.en.band.none)
  assert.equal(STRINGS.en.band.open, 'Board')
  assert.equal(STRINGS.zh.band.open, '看板')
  const pending = deferred<Wire>()
  world.actOverride = () => pending.promise
  const opening = store.open()
  assert.deepEqual(world.opens, [SELF], 'native pane opens synchronously on the button action')
  assert.equal(world.actions('open').length, 1)
  pending.resolve({ ok: true, value: { ok: true } })
  await opening
  assert.equal(store.getSnapshot().busy, null)
  assert.equal(world.navigations.length, 0)
})

test('client acceptance 3: band excludes own id from both live waits and stale tail', () => {
  const base = snapshotOf().board!
  const board: Board = { ...base, waiting: [waiting(SELF, 'must-not-appear'), waiting('other', 'Other session')], stale: [waiting(SELF), waiting('stale-other')] }
  const line = bandSummary(board, SELF, STRINGS.en)
  assert.match(line.text, /^1 waiting on you · Other session is asking you/)
  assert.ok(!line.text.includes('must-not-appear'))
  const onlyOwnLive = bandSummary({ ...board, waiting: [waiting(SELF)] }, SELF, STRINGS.en)
  assert.equal(onlyOwnLive.text.trim(), `${STRINGS.en.band.noneOthers}${STRINGS.en.band.staleTail(1)}`)
  const onlyOwnStale = bandSummary({ ...board, waiting: [], stale: [waiting(SELF)] }, SELF, STRINGS.en)
  assert.equal(onlyOwnStale.text.trim(), STRINGS.en.band.none)
  assert.equal(onlyOwnStale.tone, 'success')
})

test('client acceptance 6: excluded temp session and explicit temp cwd never auto-open', async t => {
  const excluded = snapshotOf({ eligible: false, facts: { generatedAt: NOW, sessions: [], hiddenDormant: 0, errors: [] } })
  excluded.config.openPane = 'auto'
  const a = rig(t, excluded)
  await a.ready()
  await a.store.open()
  assert.deepEqual(a.world.opens, [])
  assert.equal(a.world.actions().length, 0)
  const explicit = snapshotOf()
  explicit.config.openPane = 'auto'
  explicit.facts!.sessions[0]!.cwd = '/private/tmp/fixture-script'
  const b = rig(t, explicit)
  await b.ready()
  assert.deepEqual(b.world.opens, [])
})

test('client command-only mode stays closed for revision zero, opens once on each positive command revision', async t => {
  const { store, world, ready } = rig(t)
  await ready()
  assert.deepEqual(world.opens, [])
  world.snapshot.openRevision = NOW
  await store.refresh()
  assert.deepEqual(world.opens, [SELF])
  await store.refresh()
  assert.deepEqual(world.opens, [SELF], 'same command revision is not replayed')
  world.snapshot.openRevision++
  await store.refresh()
  assert.deepEqual(world.opens, [SELF, SELF])
})

test('client first positive command revision is consumed even if command preceded first fetch; same-store remount does not replay', async t => {
  const initial = snapshotOf({ openRevision: NOW })
  const { store, world, ready, release } = rig(t, initial)
  await ready()
  assert.deepEqual(world.opens, [SELF], 'fresh Host open intent must not be lost before first Client snapshot')
  release()
  const releaseAgain = store.subscribe(() => {})
  t.after(releaseAgain)
  await store.refresh()
  assert.deepEqual(world.opens, [SELF], 'retained Session store remembers its consumed revision across tab remounts')
})

test('client automatic opening happens once per eligible selected session, never while in background', async t => {
  const initial = snapshotOf()
  initial.config.openPane = 'auto'
  const world = new FakeWorld(initial)
  world.selected = false
  const store = new SessionBoardStore(SELF, world.environment())
  const release = store.subscribe(() => {})
  t.after(() => { release(); store.dispose() })
  await store.refresh()
  assert.equal(world.reads().length, 0)
  assert.deepEqual(world.opens, [])
  world.selected = true
  await store.refresh()
  await store.refresh()
  assert.deepEqual(world.opens, [SELF])
  world.selected = false
  await store.refresh()
  assert.deepEqual(world.opens, [SELF])
})

test('client duplicate subscribers share one request and one >=5s polling loop', async t => {
  const clock = useClock(t)
  const world = new FakeWorld()
  const pending = deferred<Wire>()
  world.readOverride = () => pending.promise
  const store = new SessionBoardStore(SELF, world.environment())
  let notifications = 0
  const listener = () => { notifications++ }
  const releaseA = store.subscribe(listener)
  const releaseB = store.subscribe(listener)
  t.after(() => { releaseA(); releaseB(); store.dispose() })
  const reading = store.refresh()
  await microtasks()
  assert.equal(world.reads().length, 1)
  const signal = world.reads()[0]!.signal
  releaseA()
  assert.equal(signal.aborted, false, 'one remaining band/pane keeps shared work alive')
  const beforeNotification = notifications
  world.readOverride = undefined
  pending.resolve({ ok: true, value: structuredClone(world.snapshot) })
  await reading
  assert.ok(notifications > beforeNotification, 'same callback subscribed twice still has one live subscription')
  assert.ok(POLL_MS >= 5_000)
  clock.tick(POLL_MS - 1)
  await microtasks()
  assert.equal(world.reads().length, 1)
  clock.tick(1)
  await microtasks()
  assert.equal(world.reads().length, 2)
  releaseB()
  const stoppedAt = world.reads().length
  clock.tick(60_000)
  await microtasks()
  assert.equal(world.reads().length, stoppedAt)
})

test('client store stops scheduled polling when its viewing session is no longer selected', async t => {
  const clock = useClock(t)
  const { world, store, ready } = rig(t)
  await ready()
  assert.equal(world.reads().length, 1)
  world.selected = false
  clock.tick(POLL_MS)
  await microtasks()
  assert.equal(world.reads().length, 1)
  await store.refresh()
  clock.tick(60_000)
  await microtasks()
  assert.equal(world.reads().length, 1, 'background session must not reschedule another snapshot loop')
})

test('client final unsubscribe aborts in-flight request, clears timeout, and ignores late data', async t => {
  const clock = useClock(t)
  const scheduled = t.mock.method(globalThis, 'setTimeout')
  const cleared = t.mock.method(globalThis, 'clearTimeout')
  const world = new FakeWorld()
  const pending = deferred<Wire>()
  world.readOverride = () => pending.promise // Intentionally ignores signal to exercise late-result guard.
  const store = new SessionBoardStore(SELF, world.environment())
  const release = store.subscribe(() => {})
  t.after(() => { release(); store.dispose() })
  const reading = store.refresh()
  await microtasks()
  const signal = world.reads()[0]!.signal
  const requestTimeout = scheduled.mock.calls[0]!.result
  release()
  assert.equal(signal.aborted, true)
  assert.ok(cleared.mock.calls.some(call => call.arguments[0] === requestTimeout))
  pending.resolve({ ok: true, value: structuredClone(world.snapshot) })
  await reading
  assert.equal(store.getSnapshot().snapshot, null)
  assert.equal(store.getSnapshot().error, '', 'ordinary unmount abort is not a refresh failure')
  clock.tick(60_000)
  await microtasks()
  assert.equal(world.reads().length, 1)
})

test('client dispose aborts action and clears every owned timer without later requests', async t => {
  const clock = useClock(t)
  const scheduled = t.mock.method(globalThis, 'setTimeout')
  const cleared = t.mock.method(globalThis, 'clearTimeout')
  const { store, world, ready } = rig(t)
  await ready()
  world.actOverride = call => new Promise((_resolve, reject) => {
    call.signal.addEventListener('abort', () => reject(call.signal.reason), { once: true })
  })
  const action = store.act('configure', { language: 'zh' })
  const signal = world.actions()[0]!.signal
  assert.equal(store.getSnapshot().busy, 'configure')
  store.dispose()
  assert.equal(signal.aborted, true)
  assert.equal(await action, false)
  assert.equal(store.getSnapshot().busy, null)
  for (const call of scheduled.mock.calls) {
    assert.ok(cleared.mock.calls.some(clear => clear.arguments[0] === call.result), 'every created timeout was cleared on completion or disposal')
  }
  const callsAtDispose = world.calls.length
  clock.tick(60_000)
  await microtasks()
  assert.equal(world.calls.length, callsAtDispose)
  assert.equal(store.getSnapshot().actionError, '', 'disposal is not reported as a Host refusal')
})

test('client acceptance 7: snapshot/action payloads share current locale and changed locale aborts stale read', async t => {
  const world = new FakeWorld()
  world.locale = 'zh-CN'
  world.readOverride = call => new Promise((_resolve, reject) => {
    call.signal.addEventListener('abort', () => reject(call.signal.reason), { once: true })
  })
  const store = new SessionBoardStore(SELF, world.environment())
  const release = store.subscribe(() => {})
  t.after(() => { release(); store.dispose() })
  await microtasks()
  const oldSignal = world.reads()[0]!.signal
  assert.equal(world.reads()[0]!.payload.locale, 'zh-CN')
  world.readOverride = undefined
  store.setLocale('en-US')
  assert.equal(oldSignal.aborted, true)
  await microtasks()
  await store.refresh()
  assert.equal(world.reads().at(-1)!.payload.locale, 'en-US')
  assert.equal(store.getSnapshot().snapshot?.lang, 'en')
  assert.equal(store.getSnapshot().error, '')
  await store.act('configure', { language: 'zh' })
  assert.equal(world.actions().at(-1)!.payload.locale, 'en-US')
  assert.equal(store.getSnapshot().snapshot?.lang, 'zh', 'explicit board language overrides the Harness locale')
  assert.equal(store.getSnapshot().snapshot?.counters.modelCalls, 0)
})

test('client read failures keep previous snapshot and show explicit reason; recovery clears the error', async t => {
  const { world, store, ready } = rig(t)
  await ready()
  const previous = store.getSnapshot().snapshot
  world.readOverride = async () => ({ ok: false, error: { message: 'fixture collector unavailable' } })
  await store.refresh()
  assert.strictEqual(store.getSnapshot().snapshot, previous)
  assert.equal(store.getSnapshot().error, 'fixture collector unavailable')
  assert.match(STRINGS.en.refreshFailed(store.getSnapshot().error), /didn't refresh.*fixture collector unavailable/)
  world.readOverride = undefined
  await store.refresh()
  assert.equal(store.getSnapshot().error, '')
})

test('client configure/footer refuse explicitly instead of claiming success', async t => {
  const { world, store, ready } = rig(t)
  await ready()
  world.actOverride = async () => ({ ok: true, value: { ok: false, reason: 'fixture command denied' } })
  assert.equal(await store.act('footer'), false)
  assert.equal(store.getSnapshot().actionError, 'fixture command denied')
  world.actOverride = async () => { throw new Error('fixture persistence failed') }
  assert.equal(await store.act('configure', { summaries: false }), false)
  assert.equal(store.getSnapshot().actionError, 'fixture persistence failed')
  assert.equal(world.snapshot.config.summaries, false)
})

test('client apply registers native tab/body and input band without rendering, and unload disposes the injected shared store', async t => {
  const clock = useClock(t)
  const releases: Dispose[] = []
  const removed: string[] = []
  const entries: { options: Record<string, unknown>; component: unknown }[] = []
  const definitions: Record<string, unknown>[] = []
  const rpcCalls: unknown[][] = []
  const localeRegistrations: unknown[][] = []
  const pending = deferred<Wire>()
  const activeLocale = { active: 'zh-CN', revision: 1 }
  const services: Record<string, unknown> = {
    locale: {
      getSnapshot: () => activeLocale,
      subscribe: () => () => {},
      bind: () => (key: keyof typeof DSH_DICTIONARIES.en) => DSH_DICTIONARIES.zh[key],
      register: (...args: unknown[]) => { localeRegistrations.push(args); return () => { removed.push('locale') } },
    },
    sidebarRight: { mounted: { getSnapshot: () => SELF, subscribe: () => () => {} }, openTab: () => {} },
    sidebarRightTabs: { register: (definition: Record<string, unknown>) => { definitions.push(definition); return () => { removed.push('tab') } } },
    uiWorkspace: { openSession: () => {} },
    connection: {
      rpc: { call: (...args: unknown[]) => { rpcCalls.push(args); return pending.promise } },
    },
    slots: {
      inject: (name: string, register: () => Dispose) => {
        const release = register() // Simulate declaration lifetime only; never invoke its React Component.
        return () => { release(); removed.push(`seat:${name}`) }
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        entries.push({ options, component })
        return () => { removed.push(`entry:${String(options.name)}`) }
      },
    },
  }
  const context = {
    get: (name: string) => { assert.ok(name in services); return services[name] },
    effect: (register: () => Dispose) => { releases.push(register()) },
  }
  let unloaded = false
  const unload = () => {
    if (unloaded) return
    unloaded = true
    for (const release of [...releases].reverse()) release()
  }
  t.after(unload)
  apply(context as unknown as Parameters<typeof apply>[0])
  assert.deepEqual(inject, ['slots', 'locale', 'connection', 'uiWorkspace', 'sidebarRight', 'sidebarRightTabs'])
  assert.equal(localeRegistrations.length, 1)
  assert.equal(localeRegistrations[0]![0], LOCALE_NAMESPACE)
  assert.deepEqual(localeRegistrations[0]![1], DSH_DICTIONARIES)
  assert.equal(definitions.length, 1)
  const definition = definitions[0]!
  assert.equal(definition.id, PACKAGE_ID)
  assert.equal(definition.kind, PANE_KIND)
  assert.equal((definition.title as () => string)(), DSH_DICTIONARIES.zh.title)
  const guide = definition.guide as { id: string; title: () => string; order: number }[]
  assert.equal(guide[0]!.id, 'switchboard')
  assert.equal(guide[0]!.title(), DSH_DICTIONARIES.zh.title)
  const pane = entries.find(entry => entry.options.name === 'sidebar.right.pane.tab')!
  const band = entries.find(entry => entry.options.name === 'conversation.input.dock')!
  assert.equal(pane.options.key, PACKAGE_ID)
  assert.equal(band.options.id, PACKAGE_ID)
  assert.equal(band.options.order, 30)
  assert.equal(pane.options.locale, LOCALE_NAMESPACE)
  assert.equal(band.options.locale, LOCALE_NAMESPACE)
  assert.equal(typeof pane.component, 'function')
  assert.equal(typeof band.component, 'function')
  const injectedPane = (pane.options.inject as () => { switchboardRuntime: { store(id: string): SessionBoardStore } })()
  const injectedBand = (band.options.inject as () => { switchboardRuntime: { store(id: string): SessionBoardStore } })()
  assert.strictEqual(injectedPane.switchboardRuntime, injectedBand.switchboardRuntime)
  const store = injectedBand.switchboardRuntime.store(SELF)
  const releaseStore = store.subscribe(() => {})
  t.after(releaseStore)
  await microtasks()
  assert.equal(rpcCalls.length, 1)
  const [channel, endpoint, envelope, signal] = rpcCalls[0]!
  assert.equal(channel, '/api')
  assert.equal(endpoint, 'switchboard-dsh')
  assert.deepEqual(envelope, { method: 'snapshot', payload: { sessionId: SELF, locale: 'zh-CN' } })
  unload()
  assert.equal((signal as AbortSignal).aborted, true)
  pending.resolve({ ok: true, value: snapshotOf() })
  await microtasks()
  clock.tick(60_000)
  await microtasks()
  assert.equal(rpcCalls.length, 1)
  assert.ok(removed.includes('tab'))
  assert.ok(removed.includes('locale'))
  assert.ok(removed.includes('entry:conversation.input.dock'))
  assert.ok(removed.includes('entry:sidebar.right.pane.tab'))
  assert.equal(store.getSnapshot().snapshot, null)
})
