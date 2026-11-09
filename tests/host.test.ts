import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, Config, readSettings, DEFAULT_SETTINGS } from '../src/host.ts'
import { initialState, applyEvent } from '../src/collector.ts'
import { abortable } from '../src/async.ts'

const deferred = <T = any>() => { let resolve!: (v: T) => void; let reject!: (e: any) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
async function world(overrides: Record<string, any> = {}) {
  const raw: any = { ...DEFAULT_SETTINGS, ...overrides }
  const effects: (() => any)[] = [], events = new Map<string, Function[]>(), tools = new Map<string, any>(), commands = new Map<string, any>()
  const sessions = new Map<string, any>()
  const agents = new Map<string, any>()
  const table = new Map<string, any>()
  const order: string[] = []
  let route: any, service: any, reads = 0, executions = 0, streams = 0, editorMissing = false, rejectEdit = false
  const ctx: any = {
    fiber: { entry: {} },
    on(name: string, f: Function) { events.set(name, [...(events.get(name) ?? []), f]); return () => {} },
    effect(f: () => any) { const dispose = f(); if (typeof dispose === 'function') effects.push(dispose); return dispose },
    reflect: { provide(_name: string, value: any) { service = value; return () => order.push('service') } },
    agents: { list: () => [...agents.values()], get: (id: string) => agents.get(id) },
    sessions: { get: (id: string) => sessions.get(id) },
    sessionProjections: { register: async () => ({ stateOf: (s: any) => s.events.reduce(applyEvent, initialState(s.header, 0)), dispose: async () => { order.push('projection') } }) },
    sessionQuery: {
      listSessions: async () => { reads++; return [...sessions.values()].map(s => ({ header: s.header, live: true, persisted: false })) },
      observeSession: async (id: string) => ({ events: sessions.get(id).events, inheritedEventCount: 0, [Symbol.dispose]() {} }),
    },
    sessionController: { list: async () => ({ items: [...sessions.keys()].map(sessionId => ({ sessionId })) }) },
    storageDomain: { open: async (spec: any) => {
      assert.match(spec.name, /^[a-z][a-z0-9_]*$/, 'Real dsh storage unit-name contract')
      return { table: () => ({ get: (key: string) => table.get(key), put: async (key: string, value: any) => { table.set(key, value) }, entries: () => table.entries(), deleteMany: async (keys: string[]) => { keys.forEach(k => table.delete(k)) } }), close: async () => { order.push('domain') } }
    } },
    commands: { register: (d: any) => { commands.set(d.name, d) }, execute: async (_a: any, line: string) => { executions++; return { result: { kind: 'success', text: line } } } },
    tools: { register: (d: any) => tools.set(d.name, d) },
    connection: { fetch: { register: async (r: any) => { route = r } } },
    get(name: string) {
      if (name === 'workingDirectory') return { get: (s: any) => s.header.cwd }
      if (name === 'configEditor') return editorMissing ? undefined : { edit: async (_e: any, change: Function) => {
        if (rejectEdit) throw new Error('config is overridden')
        Object.assign(raw, change(raw))
      } }
      if (name === 'llm') return { listModels: async () => [{ id: 'fake-mini' }], stream: async function* () { streams++; yield { type: 'text-delta', text: '{"short":"Fake","doing":"working"}' } } }
    },
  }
  function add(id: string, cwd = '/workspace/project') {
    const s = { header: { id, cwd, createdAt: Date.now() }, events: [] as any[] }
    sessions.set(id, s); const agent = { id, session: s, status: 'idle' }; agents.set(id, agent)
    return agent
  }
  const mine = add('mine')
  await apply(ctx, raw)
  const close = async () => { for (const f of effects.reverse()) await f() }
  const rpc = async (method: string, payload: any) => {
    const response = await route.fetch(new Request('http://dsh.internal/api/switchboard-dsh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'test-1', method: 'switchboard-dsh', payload: { method, payload } }) }))
    return (await response.json()).result
  }
  const ui = () => service.status({ sessionId: 'mine', locale: 'en' }, true)
  return { ctx, raw, tools, commands, sessions, agents, service, mine, add, rpc, ui, close, order,
    get reads() { return reads }, get executions() { return executions }, get streams() { return streams },
    set editorMissing(v: boolean) { editorMissing = v }, set rejectEdit(v: boolean) { rejectEdit = v } }
}

test('actual Config parses safe volatile defaults and explicit settings', () => {
  const c = readSettings(Config({}))
  assert.equal(c.summaries, false); assert.equal(c.modelMode, 'fake'); assert.equal(c.provider, '')
  assert.equal(readSettings(Config({ language: 'zh', summaries: false })).language, 'zh')
})

test('Host wiring uses native authenticated Connection route and never a second server', async t => {
  const w = await world(); t.after(w.close)
  const response = await w.rpc('snapshot', { sessionId: 'mine', locale: 'en' })
  assert.equal(response.ok, true); assert.equal(response.value.eligible, true)
  assert.equal(response.value.counters.liveModelCalls, 0)
  const unknown = await w.rpc('made-up', {})
  assert.equal(unknown.ok, false); assert.match(unknown.error.message, /enum|Invalid|expected/i)
})

test('acceptance 6: temp sessions neither open nor start a refresh', async t => {
  const w = await world({ summaries: true }); t.after(w.close)
  w.add('temp', '/tmp/script-eval')
  const before = w.reads
  const result = await w.service.act({ sessionId: 'temp', action: 'open' })
  assert.equal(result.ok, false)
  const value = await w.service.status({ sessionId: 'temp', locale: 'en' }, true)
  assert.equal(value.eligible, false); assert.equal(w.reads, before)
  assert.equal(w.service.engine.counters.modelCalls, 0)
})

test('acceptance 11: native slash demo toggles, bypasses collector/model and refuses focus', async t => {
  const w = await world({ summaries: true }); t.after(w.close)
  const command = w.commands.get('switchboard')
  const on = await command.handler({ agent: w.mine, rawInput: ' demo' })
  assert.equal(on.kind, 'success')
  const before = w.reads
  const demo = await w.ui()
  assert.equal(demo.demo, true); assert.equal(demo.board.waiting.length, 3); assert.equal(demo.board.stale.length, 1)
  assert.equal(w.reads, before); assert.equal(demo.counters.modelCalls, 0)
  assert.deepEqual(demo.jumpTargets, {})
  const focus = await w.service.act({ sessionId: 'mine', action: 'focus', patch: { id: 'local_demo_checkout' }, locale: 'en' })
  assert.equal(focus.ok, false); assert.match(focus.reason, /demo data/)
  await command.handler({ agent: w.mine, rawInput: ' demo' })
  const real = await w.ui()
  assert.equal(real.demo, false)
  assert.equal((await command.handler({ agent: w.mine, rawInput: ' unknown' })).kind, 'error')
})

test('acceptance 8: disabling real Host setting ignores cached text and makes zero subsequent calls', async t => {
  const w = await world({ summaries: true, modelMode: 'fake' }); t.after(w.close)
  await w.ui(); await w.service.engine.refresh('en')
  assert.ok(w.service.engine.counters.modelCalls > 0)
  const changed = await w.service.act({ sessionId: 'mine', action: 'configure', patch: { summaries: false } })
  assert.equal(changed.ok, true); assert.equal(w.raw.summaries, false)
  const before = w.service.engine.counters.modelCalls
  await Promise.all([w.ui(), w.ui(), w.service.engine.refresh('en')])
  assert.equal(w.service.engine.counters.modelCalls, before)
  assert.deepEqual(w.service.engine.snapshot('en').texts, {})
  assert.equal(w.streams, 0)
})

test('no UI: passive agent status reads fresh native facts without summary requests or a heartbeat', async t => {
  const w = await world({ summaries: true, modelMode: 'live', provider: 'never-used', model: 'fake-mini' }); t.after(w.close)
  const tool = w.tools.get('switchboard')
  const status = await tool.execute({ action: 'status' }, { agent: w.mine })
  assert.equal(status.board.liveCount, 1)
  await w.service.act({ sessionId: 'mine', action: 'open' })
  assert.equal(w.service.engine.counters.modelCalls, 0); assert.equal(w.streams, 0)
})

test('agent cannot enable live model egress, alter footer or trampoline a human authority command', async t => {
  const w = await world({ footerCommand: 'grant-all-permissions' }); t.after(w.close)
  const tool = w.tools.get('switchboard')
  assert.deepEqual(tool.parameters.properties.action.enum, ['status', 'configure'])
  const enabled = await tool.execute({ action: 'configure', patch: { modelMode: 'live', summaries: true, provider: 'x', model: 'fake-mini' } }, { agent: w.mine })
  assert.equal(enabled.ok, false); assert.equal(w.raw.summaries, false)
  const footer = await tool.execute({ action: 'footer' }, { agent: w.mine })
  assert.equal(footer.ok, false); assert.equal(w.executions, 0)
  const alter = await tool.execute({ action: 'configure', patch: { footerCommand: 'grant-all-permissions' } }, { agent: w.mine })
  assert.equal(alter.ok, false); assert.equal(w.executions, 0)
  // The actual user-only UI operation remains functional through the same Host method.
  const human = await w.service.act({ sessionId: 'mine', action: 'footer' })
  assert.equal(human.ok, true); assert.equal(w.executions, 1)
})

test('settings errors are explicit, never a false saved success', async t => {
  const w = await world(); t.after(w.close)
  w.editorMissing = true
  assert.equal((await w.service.act({ sessionId: 'mine', action: 'configure', patch: { language: 'zh' } })).ok, false)
  assert.equal(w.raw.language, 'auto')
  w.editorMissing = false; w.rejectEdit = true
  const rejected = await w.service.act({ sessionId: 'mine', action: 'configure', patch: { language: 'zh' } })
  assert.equal(rejected.ok, false); assert.match(rejected.reason, /overridden/)
})

test('catalog lookup is aborted before late completion can dispatch a real request', { timeout: 2_000 }, async t => {
  const w = await world({ summaries: true, modelMode: 'live', provider: 'test', model: 'fake-mini' }); t.after(w.close)
  const catalog = deferred<any[]>(), entered = deferred<void>()
  const original = w.ctx.get.bind(w.ctx)
  w.ctx.get = (name: string) => name === 'llm' ? { listModels: () => { entered.resolve(); return catalog.promise }, stream: () => { throw new Error('Live dispatch forbidden in test') } } : original(name)
  await w.ui()
  const refresh = w.service.engine.refresh('en')
  await entered.promise
  const result = await w.service.act({ sessionId: 'mine', action: 'configure', patch: { summaries: false } })
  assert.equal(result.ok, true)
  await refresh
  catalog.resolve([{ id: 'fake-mini' }])
  assert.equal((await w.ui()).counters.liveModelCalls, 0)
})

test('abortable cancellation settles even a service ignoring its signal', async () => {
  const never = deferred(), c = new AbortController()
  const p = abortable(never.promise, c.signal)
  c.abort(new Error('unloaded'))
  await assert.rejects(p, /unloaded/)
  never.resolve('late')
})

test('native registry archive set hides archived sessions even when controller rows remain addressable', async t => {
  const w = await world(); t.after(w.close)
  w.add('archived')
  const original = w.ctx.get.bind(w.ctx)
  w.ctx.get = (name: string) => name === 'workspaceRegistry' ? { archivedSessionIds: ['archived'] } : original(name)
  const facts = await w.service.collector.collect()
  assert.deepEqual(facts.sessions.map((s: any) => s.id), ['mine'])
})

test('teardown drains before closing domain and then releases projection', async () => {
  const w = await world(); await w.ui(); await w.service.engine.refresh('en'); await w.close()
  assert.ok(w.order.indexOf('domain') < w.order.indexOf('projection'))
})
