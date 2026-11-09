import Schema from '@deepseek-ai/schemastery'
import { z } from 'zod'
import { BoardEngine } from './board-engine.ts'
import { DshCollector, projectionDefinition } from './collector.ts'
import { fallbackText, firstSentence, isTemp } from '../hooks/logic.ts'
import { pickLang, STRINGS, type Lang } from '../hooks/i18n.ts'
import type { TextEntry } from '../types/index.d.ts'
import { buildDshBoard } from './native-board.ts'
import { abortable } from './async.ts'

export const name = 'switchboard-dsh'
export const inject = ['agents', 'sessions', 'sessionProjections', 'sessionQuery', 'sessionController', 'commands', 'connection', 'storageDomain', 'tools']
export const Config = Schema.object({
  language: Schema.union(['auto', 'en', 'zh']).default('auto').description('Board language / 看板语言').volatile(),
  summaries: Schema.boolean().default(false).description('Short lines by a small model / 小模型短句；关闭后零调用').volatile(),
  modelMode: Schema.union(['off', 'fake', 'live']).default('fake').description('Fake is local test data; live sends excerpts to the selected model / fake 不联网').volatile(),
  provider: Schema.string().default('').description('Explicit small-model provider; never inherits the chat model / 小模型提供方').volatile(),
  model: Schema.string().default('').description('Explicit mini / nano / haiku / flash / lite / small model ID').volatile(),
  openPane: Schema.union(['auto', 'command']).default('auto').description('Open the board automatically or only by command / 自动或手动打开').volatile(),
  footerCommand: Schema.string().default('').description('Optional footer slash command / 可选底部命令').volatile(),
  footerLabel: Schema.string().default('').description('Optional footer button label / 可选底部按钮文字').volatile(),
})
const settingsSchema = z.object({
  language: z.enum(['auto', 'en', 'zh']), summaries: z.boolean(), modelMode: z.enum(['off', 'fake', 'live']),
  provider: z.string().max(160), model: z.string().max(200), openPane: z.enum(['auto', 'command']),
  footerCommand: z.string().max(300), footerLabel: z.string().max(100),
})
export type Settings = z.infer<typeof settingsSchema>
export const DEFAULT_SETTINGS: Settings = { language: 'auto', summaries: false, modelMode: 'fake', provider: '', model: '', openPane: 'auto', footerCommand: '', footerLabel: '' }
const get = (v: any) => typeof v?.get === 'function' ? v.get() : v
export const readSettings = (raw: any): Settings => settingsSchema.parse({ ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, get(v)])) })
const textSchema = z.object({ short: z.string().min(1), project: z.string(), doing: z.string(), ask: z.string(), why: z.string(), needsUser: z.boolean(), forUser: z.boolean(), blocking: z.boolean(), relay: z.boolean(), closeable: z.boolean() })
const textEntrySchema = z.object({ key: z.string(), at: z.number(), text: textSchema, status: z.string().nullable().optional() })
const contextSchema = z.object({ sessionId: z.string().min(1).max(256), locale: z.string().max(100).optional() })
const actionSchema = contextSchema.extend({ action: z.enum(['open', 'demo', 'configure', 'footer', 'focus']), patch: z.unknown().optional() })
const smallModel = /(?:mini|nano|haiku|flash|lite|small)(?:\b|[-_.])/i
const engineConfig = (c: Settings) => ({ language: c.language, summaries: c.summaries, modelMode: c.modelMode, provider: c.provider, model: c.model })
const englishLocale = () => process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || 'en'

export async function apply(ctx: any, rawConfig: any) {
  const projection = await ctx.sessionProjections.register(projectionDefinition)
  let ownedDomain: any
  let finish: (() => Promise<void>) | undefined
  // One ordered teardown: cancel and drain workers before closing their storage/projection.
  ctx.effect(() => async () => { await finish?.(); await ownedDomain?.close(); await projection.dispose() })
  const domain = await ctx.storageDomain.open({ name: 'switchboard_dsh', version: 1, layout: 'per-record', invalidRecords: 'backup-and-skip', tables: { texts: { valueSchema: textEntrySchema } } })
  ownedDomain = domain
  const table = domain.table('texts')
  const lifecycle = new AbortController()
  const collector = new DshCollector(ctx, projection)
  let settings = readSettings(rawConfig)
  let liveModelCalls = 0
  const modes = new Map<string, { demo: boolean; openRevision: number }>()
  const viewers = new Map<string, { lang: Lang; at: number }>()
  const tasks = new Set<Promise<unknown>>()
  const refreshAt = new Map<Lang, number>()
  const pendingLangs = new Set<Lang>()
  const interested = (lang: Lang) => [...viewers].some(([id, viewer]) => viewer.lang === lang && Date.now() - viewer.at <= 120_000 && !modes.get(id)?.demo)
  let lastPruned = 0
  const track = <T>(p: Promise<T>): Promise<T> => { tasks.add(p); void p.finally(() => tasks.delete(p)).catch(() => {}); return p }
  const engine = new BoardEngine(engineConfig(settings), {
    collect: () => collector.collect(),
    arrange: buildDshBoard,
    cache: {
      get: async (key: string) => table.get(key),
      put: async (key: string, value: TextEntry) => { await table.put(key, value) },
    },
    complete: async ({ session, prompt, system, lang, signal }: any) => {
      // Re-read volatile settings immediately before *each* dispatch, including queued batch members.
      const c = readSettings(rawConfig)
      if (!c.summaries || c.modelMode === 'off' || signal.aborted || lifecycle.signal.aborted) throw new Error('Short lines disabled')
      if (!interested(lang)) throw new Error('No visible non-demo board is requesting short lines')
      if (c.modelMode === 'fake') {
        const t = fallbackText(session, lang)
        return JSON.stringify({ short: t.short, project: '', doing: t.doing || firstSentence(session.progress?.text ?? ''),
          ask: t.ask, why: '', needs_user: false, for_user: true, blocking: false, relay: false, closeable: false })
      }
      if (!c.provider || !c.model || !smallModel.test(c.model)) throw new Error('Select an explicit small model (mini/nano/haiku/flash/lite/small); no chat-model fallback')
      const llm = ctx.get('llm')
      if (!llm) throw new Error('dsh llm service is unavailable')
      const combined = AbortSignal.any([signal, lifecycle.signal, AbortSignal.timeout(30_000)])
      const advertised = await abortable(Promise.resolve(llm.listModels(c.provider)), combined)
      if (!advertised.some((m: any) => m.id === c.model)) throw new Error('The selected small model is not advertised by this provider')
      const latest = readSettings(rawConfig)
      if (!latest.summaries || latest.modelMode !== 'live' || latest.provider !== c.provider || latest.model !== c.model || !interested(lang)) throw new Error('Summary settings or visible interest changed before dispatch')
      combined.throwIfAborted()
      liveModelCalls++
      let text = ''
      let completeText = ''
      for await (const chunk of llm.stream({ provider: c.provider, model: c.model, system,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        maxTokens: 600, tools: [], purpose: 'switchboard-summary', signal: combined })) {
        if (chunk.type === 'text-delta') text += chunk.text
        if (chunk.type === 'block-end' && chunk.block?.type === 'text') completeText += chunk.block.text
        if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) throw new Error(chunk.reason.failure.message)
      }
      return text || completeText
    },
  })
  const sync = () => {
    const next = readSettings(rawConfig)
    if (JSON.stringify(next) !== JSON.stringify(settings)) {
      settings = next; engine.configure(engineConfig(next)); refreshAt.clear()
    }
  }
  ctx.on('app-boot/config-reload', sync)
  const eligible = (id: string) => {
    const session = ctx.sessions.get(id)
    if (!session) return false
    const cwd = ctx.get('workingDirectory')?.get(session) ?? session.header.cwd
    return !!cwd && !isTemp(cwd)
  }
  const refresh = (lang: Lang, force = false) => {
    sync()
    if (lifecycle.signal.aborted || pendingLangs.has(lang) || !interested(lang)) return
    if (!force && Date.now() - (refreshAt.get(lang) ?? 0) < 20_000) return
    pendingLangs.add(lang)
    track(engine.refresh(lang).finally(() => { refreshAt.set(lang, Date.now()); pendingLangs.delete(lang) }))
  }
  const prune = () => {
    if (Date.now() - lastPruned < 3_600_000) return
    lastPruned = Date.now()
    const stale = [...table.entries()].filter(([, value]: any) => Date.now() - value.at > 3 * 86_400_000).map(([key]: any) => key)
    if (stale.length) track(table.deleteMany(stale))
  }
  const langOf = (locale?: string) => pickLang(settings.language, locale || englishLocale())
  const stateOf = (id: string) => {
    let state = modes.get(id)
    if (!state) { state = { demo: false, openRevision: 0 }; modes.set(id, state) }
    return state
  }
  const status = async (input: unknown, fromUi = false) => {
    const p = contextSchema.parse(input)
    sync()
    const lang = langOf(p.locale || viewers.get(p.sessionId)?.lang)
    const state = stateOf(p.sessionId)
    const canDraw = eligible(p.sessionId)
    if (canDraw && fromUi) {
      viewers.set(p.sessionId, { lang, at: Date.now() })
      if (!state.demo) { refresh(lang); prune() }
    }
    let snapshot = engine.snapshot(lang, state.demo)
    if (!fromUi && canDraw && !state.demo) {
      // Passive tool reads are fresh recorded facts, not a heartbeat or authorization to summarize.
      try {
        const facts = await collector.collect()
        snapshot = { facts, texts: {}, note: '', board: buildDshBoard(facts, {}, Date.now(), lang) }
      } catch (error) { snapshot = { ...snapshot, note: STRINGS[lang].refreshFailed(String(error).slice(0, 100)) } }
    }
    return { ...snapshot, lang, demo: state.demo, eligible: canDraw, config: settings,
      counters: { ...engine.counters, liveModelCalls }, openRevision: state.openRevision,
      jumpTargets: state.demo ? {} : collector.extras.jumpTargets,
      diagnostics: state.demo ? [] : collector.extras.diagnostics }
  }
  const act = async (input: unknown, authority: 'human' | 'agent' = 'human') => {
    const p = actionSchema.parse(input)
    sync()
    if (!eligible(p.sessionId)) return { ok: false, reason: 'No Switchboard in temporary/headless or unavailable sessions' }
    const lang = langOf(p.locale || viewers.get(p.sessionId)?.lang)
    const state = stateOf(p.sessionId)
    if (p.action === 'open' || p.action === 'demo') {
      if (p.action === 'demo') state.demo = !state.demo
      state.openRevision = Math.max(Date.now(), state.openRevision + 1)
      if (!state.demo) refresh(lang, true)
      return { ok: true, demo: state.demo, text: p.action === 'demo' ? state.demo ? STRINGS[lang].demoOn : STRINGS[lang].demoOff : STRINGS[lang].opened }
    }
    if (p.action === 'focus') {
      if (state.demo) return { ok: false, reason: STRINGS[lang].demoJump }
      const id = z.object({ id: z.string().min(1).max(256) }).parse(p.patch).id
      if (!collector.extras.jumpTargets[id]) return { ok: false, reason: STRINGS[lang].cannotJump }
      collector.markFocus(id)
      return { ok: true }
    }
    if (p.action === 'configure') {
      const patch = settingsSchema.partial().strict().parse(p.patch)
      const next = { ...settings, ...patch }
      if (authority === 'agent' && (patch.footerCommand !== undefined || patch.footerLabel !== undefined))
        return { ok: false, reason: 'Footer commands and their labels are user-only settings' }
      // Opting into external model requests is user-only, never delegated to this tool.
      if (authority === 'agent' && next.summaries && next.modelMode === 'live' &&
        (!settings.summaries || settings.modelMode !== 'live' || settings.provider !== next.provider || settings.model !== next.model))
        return { ok: false, reason: 'Enabling or changing live summary requests is user-only; use the Switchboard settings' }
      const editor = ctx.get('configEditor')
      const entry = ctx.fiber.entry
      if (!editor || !entry) return { ok: false, reason: 'This profile has no configuration editor; settings were not saved' }
      // Stop dispatch immediately, before a possibly slow durable settings write.
      if (patch.summaries === false || patch.modelMode === 'off') engine.configure({ summaries: false })
      try {
        await editor.edit(entry, (current: any) => ({ ...current, ...patch }))
        sync()
        return { ok: true, config: settings }
      } catch (error) {
        engine.configure(engineConfig(settings))
        return { ok: false, reason: String(error) }
      }
    }
    // Human-command handlers can grant authority; never turn this into an agent command trampoline.
    if (authority !== 'human') return { ok: false, reason: 'Footer commands are user-only' }
    const footer = settings.footerCommand.replace(/^\//, '').trim()
    if (!footer) return { ok: false, reason: 'No footer command is configured' }
    if (/^switchboard(?:\s|$)/i.test(footer)) return { ok: false, reason: 'A footer cannot recursively invoke Switchboard' }
    const agent = ctx.agents.get(p.sessionId)
    if (!agent) return { ok: false, reason: STRINGS[lang].cannotJump }
    const result = await ctx.commands.execute(agent, `/${footer}`, [], lifecycle.signal)
    if (!result) return { ok: false, reason: `Unknown command: /${footer}` }
    return { ok: result.result.kind === 'success', text: result.result.text ?? '', ...(result.result.kind === 'error' ? { reason: result.result.text } : {}) }
  }
  const service = { status, act, engine, collector }
  ctx.effect(() => ctx.reflect.provide('switchboard', service))

  // Connection owns browser authentication, Host/Origin/CSRF checks, owner gating, and Desktop IPC.
  await ctx.connection.fetch.register({ path: '/api/switchboard-dsh', methods: ['POST'], requestBody: 'buffered',
    fetch: async (request: Request) => {
      const envelopeSchema = z.object({ type: z.literal('client-request'), rpcId: z.string().max(160), method: z.literal('switchboard-dsh'),
        payload: z.object({ method: z.enum(['snapshot', 'act']), payload: z.unknown() }) })
      let rpcId = ''
      try {
        const envelope = envelopeSchema.parse(await request.json()); rpcId = envelope.rpcId
        request.signal.throwIfAborted()
        const value = envelope.payload.method === 'snapshot' ? await status(envelope.payload.payload, true) : await act(envelope.payload.payload)
        return Response.json({ type: 'server-response', rpcId, result: { ok: true, value } })
      } catch (error) {
        return Response.json({ type: 'server-response', rpcId, result: { ok: false, error: { code: 'switchboard/failed', message: String(error).slice(0, 400), details: {} } } })
      }
    } })
  ctx.commands.register({ name: 'switchboard', description: 'Switchboard / 会话看板 — /switchboard demo', input: { hint: 'demo' },
    handler: async ({ agent, rawInput }: any) => {
      const arg = rawInput.trim()
      if (arg && arg !== 'demo') return { kind: 'error', text: 'Usage: /switchboard [demo]' }
      const result = await act({ sessionId: agent.id, action: arg === 'demo' ? 'demo' : 'open' })
      return result.ok ? { kind: 'success', text: result.text } : { kind: 'error', text: result.reason }
    } })
  ctx.tools.register({ name: 'switchboard', description: 'Read the dsh session board or change its settings. Live-model opt-in is user-only; this tool cannot answer questions or approve actions.',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['status', 'configure'], description: 'status reads the board; configure saves non-authority settings. Footer commands are user-only.' },
      patch: { type: 'object', description: 'For configure: language, summaries, modelMode, provider, model or openPane. Live-model opt-in remains user-only.', properties: {
        language: { type: 'string', enum: ['auto', 'en', 'zh'] }, summaries: { type: 'boolean' }, modelMode: { type: 'string', enum: ['off', 'fake', 'live'] },
        provider: { type: 'string' }, model: { type: 'string' }, openPane: { type: 'string', enum: ['auto', 'command'] },
      }, additionalProperties: false } }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object' }, render: (_: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async (args: any, exec: any) => {
      if (!exec.agent) throw new Error('Switchboard requires a receiving Agent')
      if (args.action === 'status') {
        const value = await status({ sessionId: exec.agent.id })
        return { board: value.board, note: value.note, config: value.config, counters: value.counters, diagnostics: value.diagnostics }
      }
      return act({ sessionId: exec.agent.id, action: args.action, patch: args.patch }, 'agent')
    } })
  ctx.effect(() => {
    const timer = setInterval(() => {
      sync()
      const langs = new Set<Lang>()
      for (const [id, viewer] of viewers) {
        if (Date.now() - viewer.at > 120_000) { viewers.delete(id); continue }
        if (!stateOf(id).demo) langs.add(viewer.lang)
      }
      for (const lang of langs) refresh(lang)
      if (langs.size) prune()
    }, 20_000)
    finish = async () => {
      clearInterval(timer); lifecycle.abort(); engine.dispose(); collector.dispose()
      await Promise.allSettled(tasks)
      modes.clear(); viewers.clear()
    }
    return () => clearInterval(timer)
  })
}
