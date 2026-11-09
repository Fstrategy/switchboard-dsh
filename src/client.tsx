import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { Board, Facts, Line, Project, Single, WaitItem } from '../types'
import { STRINGS, pickLang } from '../hooks/i18n'
import type { Lang, Strings } from '../hooks/i18n'
import { isTemp } from '../hooks/logic'
import { DSH_DICTIONARIES, LOCALE_NAMESPACE } from './dsh-i18n'
import type { DshKey, Translate } from './dsh-i18n'
// Embedded by the Client build's .css=text loader; never installed into document.head.
import styles from './styles.css'

export const PACKAGE_ID = '@lumir_kumou/switchboard-dsh'
export const PANE_KIND = 'switchboard'
export const POLL_MS = 5_000
const RPC_TIMEOUT_MS = 45_000
const RESTING_ROWS = 6

type Dispose = () => void
export type SessionTarget = string | {
  parentSessionId: string
  childSessionId: string
  mode: 'one-shot' | 'continuable' | 'unknown'
}
export type BoardConfig = {
  language: 'auto' | Lang
  summaries: boolean
  modelMode: 'off' | 'fake' | 'live'
  provider: string
  model: string
  openPane: 'auto' | 'command'
  footerCommand: string
  footerLabel: string
}
export type ClientSnapshot = {
  board: Board | null
  facts: Facts | null
  eligible: boolean
  lang: Lang
  demo: boolean
  note: string
  config: BoardConfig
  counters: { modelCalls: number; cacheHits: number }
  openRevision: number
  jumpTargets: Record<string, SessionTarget>
  diagnostics: string[]
}
export type BoardAction = 'open' | 'demo' | 'configure' | 'footer' | 'focus'
type RpcResult = { ok: true; value: unknown } | { ok: false; error: unknown }
type Rpc = (endpoint: 'snapshot' | 'act', payload: Record<string, unknown>, signal: AbortSignal) => Promise<RpcResult>

type LocaleSnapshot = { active: string; revision: number }
interface LocaleFace {
  getSnapshot(): LocaleSnapshot
  subscribe(listener: () => void): Dispose
  bind(namespace: string): (key: string) => string
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): Dispose
}
interface Observable<T> {
  getSnapshot(): T
  subscribe(listener: () => void): Dispose
}
interface SidebarFace {
  mounted: Observable<string | undefined>
  openTab(kind: string): unknown
}
interface SidebarTabsFace {
  register(definition: {
    id: string
    kind: string
    title: () => string
    guide: { id: string; title: () => string; order: number }[]
  }): Dispose
}
interface SlotsFace {
  inject(name: string, register: () => Dispose): Dispose
  register(options: Record<string, unknown>, component: unknown): Dispose
}
interface ClientContext {
  get(name: 'locale'): LocaleFace
  get(name: 'sidebarRight'): SidebarFace
  get(name: 'sidebarRightTabs'): SidebarTabsFace
  get(name: 'slots'): SlotsFace
  get(name: 'uiWorkspace'): { openSession(target: SessionTarget): void }
  get(name: 'connection'): {
    rpc: { call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RpcResult> }
  }
  effect(register: () => Dispose, label?: string): unknown
}

export type PollState = {
  snapshot: ClientSnapshot | null
  refreshing: boolean
  error: string
  actionError: string
  notice: string
  busy: BoardAction | null
}
interface PollEnvironment {
  rpc: Rpc
  locale(): string
  selected(sessionId: string): boolean
  open(sessionId: string): void
  navigate(target: SessionTarget): void
}

const messageOf = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message.slice(0, 300) || fallback
  if (typeof error === 'string') return error.slice(0, 300) || fallback
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    for (const key of ['reason', 'message', 'code']) {
      if (typeof record[key] === 'string' && record[key]) return (record[key] as string).slice(0, 300)
    }
  }
  return fallback
}

const isSnapshot = (value: unknown): value is ClientSnapshot => {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<ClientSnapshot>
  if (typeof s.eligible !== 'boolean' || (s.lang !== 'en' && s.lang !== 'zh') ||
    typeof s.demo !== 'boolean' || typeof s.note !== 'string' || typeof s.openRevision !== 'number' ||
    !s.config || !s.counters || !s.jumpTargets || !Array.isArray(s.diagnostics)) return false
  if (s.facts !== null && (!s.facts || !Array.isArray(s.facts.sessions))) return false
  if (s.board !== null && (!s.board || !['waiting', 'stale', 'projects', 'running', 'resting', 'errors']
    .every(key => Array.isArray((s.board as unknown as Record<string, unknown>)[key])))) return false
  return true
}

/** A single subscription owner per viewing Session, shared by its input band and any native tab copies.
 * It receives already-derived Host snapshots; it never reads or folds a Session event log.
 */
export class SessionBoardStore {
  private state: PollState = {
    snapshot: null, refreshing: false, error: '', actionError: '', notice: '', busy: null,
  }
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readController: AbortController | undefined
  private actionController: AbortController | undefined
  private readPromise: Promise<void> | undefined
  private refs = 0
  private disposed = false
  private locale: string
  private autoOpened = false
  private openRevision: number | undefined
  private localOpen = false

  constructor(readonly sessionId: string, private readonly env: PollEnvironment) {
    this.locale = env.locale()
  }

  getSnapshot = (): PollState => this.state

  subscribe = (listener: () => void): Dispose => {
    if (this.disposed) return () => {}
    const subscription = () => listener()
    this.listeners.add(subscription)
    this.refs++
    if (this.refs === 1) void this.refresh()
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      this.listeners.delete(subscription)
      this.refs--
      if (this.refs === 0) this.stop()
    }
  }

  private publish(patch: Partial<PollState>): void {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private copy(key: DshKey): string {
    return DSH_DICTIONARIES[this.state.snapshot?.lang ?? pickLang('auto', this.locale)][key]
  }

  setLocale(locale: string): void {
    if (locale === this.locale || this.disposed) return
    this.locale = locale
    this.readController?.abort()
    if (this.refs > 0) {
      const previous = this.readPromise
      if (previous) void previous.then(() => this.refresh())
      else void this.refresh()
    }
  }

  private schedule(): void {
    if (this.refs === 0 || this.disposed || !this.env.selected(this.sessionId)) return
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.refresh()
    }, POLL_MS)
  }

  private accept(snapshot: ClientSnapshot): void {
    // A command may arrive before this Session's first Client fetch. Consume that first
    // positive intent once; retaining this store across tab remounts prevents replay there.
    const commandOpen = this.openRevision === undefined
      ? snapshot.openRevision > 0
      : snapshot.openRevision > this.openRevision
    this.openRevision = snapshot.openRevision
    this.publish({ snapshot, error: '' })
    const current = snapshot.facts?.sessions.find(s => s.id === this.sessionId)
    const eligible = snapshot.eligible && !(current?.cwd && isTemp(current.cwd))
    const automatic = snapshot.config.openPane === 'auto' && !this.autoOpened
    if (!eligible || !this.env.selected(this.sessionId) || this.localOpen || (!commandOpen && !automatic)) return
    try {
      this.env.open(this.sessionId)
      this.autoOpened = true
    } catch (error) {
      this.publish({ actionError: messageOf(error, this.copy('openFailed')) })
    }
  }

  refresh = (): Promise<void> => {
    if (this.disposed || this.refs === 0 || !this.env.selected(this.sessionId)) return Promise.resolve()
    if (this.readPromise) return this.readPromise
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    const controller = new AbortController()
    this.readController = controller
    this.publish({ refreshing: true })
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new Error(this.copy('connectionFailed')))
    }, RPC_TIMEOUT_MS)
    const clearAbortTimeout = () => clearTimeout(timeout)
    controller.signal.addEventListener('abort', clearAbortTimeout, { once: true })
    // The initial microtask makes even a synchronously throwing transport safely single-flight.
    const promise = Promise.resolve().then(async () => {
      try {
        const result = await this.env.rpc('snapshot', { sessionId: this.sessionId, locale: this.locale }, controller.signal)
        if (controller.signal.aborted || this.disposed || this.refs === 0) return
        if (!result.ok) throw new Error(messageOf(result.error, this.copy('connectionFailed')))
        if (!isSnapshot(result.value)) throw new Error(this.copy('invalidResponse'))
        this.accept(result.value)
      } catch (error) {
        if (!this.disposed && this.refs > 0 && (!controller.signal.aborted || timedOut)) {
          this.publish({ error: messageOf(controller.signal.aborted ? controller.signal.reason : error, this.copy('connectionFailed')) })
        }
      } finally {
        clearTimeout(timeout)
        controller.signal.removeEventListener('abort', clearAbortTimeout)
        if (this.readController === controller) this.readController = undefined
        if (this.readPromise === promise) this.readPromise = undefined
        this.publish({ refreshing: false })
        this.schedule()
      }
    })
    this.readPromise = promise
    return promise
  }

  private async reloadAfterAction(): Promise<void> {
    const previous = this.readPromise
    if (previous) {
      this.readController?.abort()
      await previous
    }
    await this.refresh()
  }

  act = async (action: BoardAction, patch?: Record<string, unknown>): Promise<boolean> => {
    if (this.disposed || this.refs === 0) return false
    if (this.state.busy) {
      this.publish({ actionError: this.copy('busy') })
      return false
    }
    const controller = new AbortController()
    this.actionController = controller
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new Error(this.copy('connectionFailed')))
    }, RPC_TIMEOUT_MS)
    const clearAbortTimeout = () => clearTimeout(timeout)
    controller.signal.addEventListener('abort', clearAbortTimeout, { once: true })
    this.publish({ busy: action, actionError: '', notice: '' })
    try {
      const result = await this.env.rpc('act', {
        sessionId: this.sessionId, locale: this.locale, action, ...(patch ? { patch } : {}),
      }, controller.signal)
      if (controller.signal.aborted || this.disposed) return false
      if (!result.ok) throw new Error(messageOf(result.error, this.copy('actionFailed')))
      const value = result.value as { ok?: boolean; reason?: unknown } | null
      if (!value || value.ok !== true) throw new Error(messageOf(value?.reason, this.copy('actionFailed')))
      clearTimeout(timeout)
      // Navigation needs only the focus acknowledgement; do not make it wait for a board refresh.
      if (action !== 'focus') await this.reloadAfterAction()
      return !controller.signal.aborted && !this.disposed
    } catch (error) {
      if (!this.disposed && (!controller.signal.aborted || timedOut)) {
        this.publish({ actionError: messageOf(controller.signal.aborted ? controller.signal.reason : error, this.copy('actionFailed')) })
      }
      return false
    } finally {
      clearTimeout(timeout)
      controller.signal.removeEventListener('abort', clearAbortTimeout)
      if (this.actionController === controller) {
        this.actionController = undefined
        this.publish({ busy: null })
      }
    }
  }

  open = async (demo = false): Promise<void> => {
    const snapshot = this.state.snapshot
    if (!snapshot?.eligible || !this.env.selected(this.sessionId)) return
    this.localOpen = true
    try {
      // Native navigation is immediate; the Host operation records the shared intent afterward.
      this.env.open(this.sessionId)
      this.autoOpened = true
      await this.act(demo ? 'demo' : 'open')
    } catch (error) {
      this.publish({ actionError: messageOf(error, this.copy('openFailed')) })
    } finally {
      this.localOpen = false
    }
  }

  jump = async (id: string): Promise<void> => {
    const snapshot = this.state.snapshot
    if (!snapshot) return
    const S = STRINGS[snapshot.lang]
    if (snapshot.demo) {
      this.publish({ notice: S.demoJump, actionError: '' })
      return
    }
    const target = snapshot.jumpTargets[id]
    if (!target) {
      this.publish({ notice: S.cannotJump, actionError: '' })
      return
    }
    // Settle the focus observation before navigation releases the viewing Session's subscription.
    if (!await this.act('focus', { id }) || !this.env.selected(this.sessionId)) return
    try {
      this.env.navigate(target)
      this.publish({ notice: '' })
    } catch {
      this.publish({ notice: S.jumpFailed })
    }
  }

  private stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.readController?.abort()
    this.actionController?.abort()
    this.localOpen = false
    this.publish({ refreshing: false, busy: null })
  }

  dispose(): void {
    this.stop()
    this.disposed = true
    this.listeners.clear()
  }
}

class ClientRuntime {
  readonly locale: LocaleFace
  readonly sidebar: SidebarFace
  readonly localeSource: Observable<LocaleSnapshot>
  readonly mountedSource: Observable<string | undefined>
  readonly translate: (key: string) => string
  private readonly stores = new Map<string, SessionBoardStore>()
  private readonly env: PollEnvironment

  constructor(ctx: ClientContext) {
    this.locale = ctx.get('locale')
    this.sidebar = ctx.get('sidebarRight')
    this.localeSource = {
      getSnapshot: () => this.locale.getSnapshot(),
      subscribe: listener => this.locale.subscribe(listener),
    }
    this.mountedSource = {
      getSnapshot: () => this.sidebar.mounted.getSnapshot(),
      subscribe: listener => this.sidebar.mounted.subscribe(listener),
    }
    this.translate = this.locale.bind(LOCALE_NAMESPACE)
    const connection = ctx.get('connection')
    const workspace = ctx.get('uiWorkspace')
    this.env = {
      rpc: (endpoint, payload, signal) => connection.rpc.call('/api', 'switchboard-dsh', { method: endpoint, payload }, signal),
      locale: () => this.locale.getSnapshot().active,
      selected: sessionId => this.sidebar.mounted.getSnapshot() === sessionId,
      open: sessionId => {
        if (this.sidebar.mounted.getSnapshot() !== sessionId) throw new Error(this.translate('openFailed'))
        this.sidebar.openTab(PANE_KIND)
      },
      navigate: target => workspace.openSession(target),
    }
  }

  store(sessionId: string): SessionBoardStore {
    let store = this.stores.get(sessionId)
    if (!store) {
      store = new SessionBoardStore(sessionId, this.env)
      this.stores.set(sessionId, store)
    }
    return store
  }

  copy(lang: Lang): Translate {
    return key => pickLang('auto', this.locale.getSnapshot().active) === lang
      ? this.translate(key)
      : DSH_DICTIONARIES[lang][key]
  }

  dispose(): void {
    for (const store of this.stores.values()) store.dispose()
    this.stores.clear()
  }
}

type BaseProps = { sessionId: string; switchboardRuntime: ClientRuntime }
type PaneProps = BaseProps & { useTabInfo(): { tab: { visible: boolean } } }
const noSubscription = (): Dispose => () => {}

function useBoard(runtime: ClientRuntime, sessionId: string, enabled: boolean) {
  const locale = useSyncExternalStore(runtime.localeSource.subscribe, runtime.localeSource.getSnapshot)
  const mounted = useSyncExternalStore(runtime.mountedSource.subscribe, runtime.mountedSource.getSnapshot)
  const active = enabled && mounted === sessionId
  const store = useMemo(() => runtime.store(sessionId), [runtime, sessionId])
  const state = useSyncExternalStore(active ? store.subscribe : noSubscription, store.getSnapshot)
  useEffect(() => {
    if (active) store.setLocale(locale.active)
  }, [store, locale.active, active])
  const lang = state.snapshot?.lang ?? pickLang('auto', locale.active)
  return { store, state, lang, S: STRINGS[lang], t: runtime.copy(lang) }
}

export function bandSummary(board: Board, sessionId: string, S: Strings): { text: string; tone: string } {
  const others = board.waiting.filter(w => w.id !== sessionId)
  const stale = board.stale.filter(w => w.id !== sessionId)
  const top = others[0]
  const what = top
    ? top.kind === 'block' ? S.band.what.block : top.kind === 'question' ? S.band.what.question : S.band.what.other
    : ''
  const nobody = others.length < board.waiting.length ? S.band.noneOthers : S.band.none
  return {
    text: top ? S.band.waiting(others.length, top.name, what, top.waitMs)
      : `${nobody}${stale.length ? S.band.staleTail(stale.length) : ''} `,
    tone: top ? top.kind === 'block' ? 'error' : 'warn' : stale.length ? 'warn' : 'success',
  }
}

const hhmm = (ms: number): string => {
  const date = new Date(ms)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function FailureNotice({ state, S }: { state: PollState; S: Strings }) {
  const notices = [state.snapshot?.note, state.notice].filter(Boolean)
  return <>
    {state.error ? <p className="sb-dsh-message sb-dsh-warn" role="alert">{S.refreshFailed(state.error)}</p> : null}
    {state.actionError ? <p className="sb-dsh-message sb-dsh-error" role="alert">{state.actionError}</p> : null}
    {notices.map((notice, index) => <p className="sb-dsh-message sb-dsh-warn" role="status" key={`${index}-${notice}`}>{notice}</p>)}
  </>
}

function BoardBand({ sessionId, switchboardRuntime: runtime }: BaseProps) {
  const { store, state, S } = useBoard(runtime, sessionId, true)
  const snapshot = state.snapshot
  // Eligibility comes from the Host: temp sessions may be deliberately absent from Facts.
  if (!snapshot?.eligible) return null
  const current = snapshot.facts?.sessions.find(s => s.id === sessionId)
  if (current?.cwd && isTemp(current.cwd)) return null
  const line = snapshot.board ? bandSummary(snapshot.board, sessionId, S) : { text: S.loading, tone: 'idle' }
  return <div className="sb-dsh sb-dsh-band-wrap">
    <style>{styles}</style>
    <div className="sb-dsh-band">
      <span className={`sb-dsh-dot sb-dsh-${line.tone}`} aria-hidden="true">●</span>
      <span className="sb-dsh-band-text" title={line.text}>{line.text}</span>
      <button className="sb-dsh-button sb-dsh-button-small" type="button" onClick={() => void store.open()} disabled={state.busy !== null}>{S.band.open}</button>
    </div>
    <FailureNotice state={state} S={S} />
  </div>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="sb-dsh-section"><h2>{title}</h2>{children}</section>
}

type JumpProps = { jump(id: string): void; disabled: boolean }
function WaitCard({ item: w, S, jump, disabled }: { item: WaitItem; S: Strings } & JumpProps) {
  const when = w.isHere ? S.isHere : w.isLive ? S.waited(w.waitMs) : S.idleFor(w.waitMs)
  return <article className="sb-dsh-wait-card">
    <div className="sb-dsh-wait-meta">
      <span className={`sb-dsh-chip sb-dsh-${w.kind === 'block' ? 'error' : 'warn'}`}>{S.chip[w.kind]}</span>
      <span className="sb-dsh-session-name">{w.name}</span>
      <span className="sb-dsh-muted">· {when}</span>
    </div>
    <p className="sb-dsh-ask">{w.ask}</p>
    {w.why ? <p className="sb-dsh-muted sb-dsh-why">{w.why}</p> : null}
    <button className={`sb-dsh-button${w.isLive ? ' sb-dsh-button-primary' : ''}`} type="button" onClick={() => jump(w.id)} disabled={disabled}>{S.go[w.kind]}</button>
  </article>
}

const DOTS: Record<Line['state'], string> = { wait: '!', run: '●', bg: '◐', done: '✓', gone: '✓' }
const LINE_TONE: Record<Line['state'], string> = { wait: 'error', run: 'brand', bg: 'brand', done: 'success', gone: 'idle' }
function LineRow({ line, jump, disabled }: { line: Line } & JumpProps) {
  return <button className="sb-dsh-row-button sb-dsh-line" type="button" onClick={() => jump(line.id)} disabled={disabled}>
    <span className={`sb-dsh-line-dot sb-dsh-${LINE_TONE[line.state]}`} aria-hidden="true">{DOTS[line.state]}</span>
    <span>{line.name} <span className="sb-dsh-muted">{line.doing}</span></span>
  </button>
}

function ProjectBlock({ project: p, S, jump, disabled }: { project: Project; S: Strings } & JumpProps) {
  return <article className="sb-dsh-project">
    <button className="sb-dsh-row-button sb-dsh-project-heading" type="button" onClick={() => jump(p.id)} disabled={disabled}>
      <strong>{p.name}</strong><span className="sb-dsh-muted"> · {S.delivered(p.done, p.lines.length)}</span>
      {p.isParentWaiting ? <span className="sb-dsh-error"> · {S.parentWaiting}</span> : null}
    </button>
    {p.note ? <p className="sb-dsh-project-note sb-dsh-muted">{p.note}</p> : null}
    <div className="sb-dsh-lines">{p.lines.map(line => <LineRow key={line.id} line={line} jump={jump} disabled={disabled} />)}</div>
  </article>
}

function SingleRow({ single: s, S, jump, disabled }: { single: Single; S: Strings } & JumpProps) {
  return <button className="sb-dsh-row-button" type="button" onClick={() => jump(s.id)} disabled={disabled}>
    <span>{s.name} <span className="sb-dsh-muted">{s.doing}</span>
      {s.isCloseable ? <span className="sb-dsh-success"> · {S.closeable}</span> : null}</span>
  </button>
}

function BoardView({ board: b, snapshot, state, store, S }: {
  board: Board; snapshot: ClientSnapshot; state: PollState; store: SessionBoardStore; S: Strings
}) {
  const [more, setMore] = useState(false)
  const active = b.projects.filter(p => p.isActive)
  const finished = b.projects.filter(p => !p.isActive)
  const resting = more ? b.resting : b.resting.slice(0, RESTING_ROWS)
  const n = b.waiting.length + b.stale.length
  const heroTone = n === 0 ? 'success' : b.waiting.some(w => w.kind === 'block') ? 'error' : b.waiting.length ? 'warn' : ''
  const jump = (id: string) => { void store.jump(id) }
  const disabled = state.busy !== null
  return <>
    <div className="sb-dsh-overview">
      <div className="sb-dsh-hero-row">
        <p className="sb-dsh-hero"><strong className={`sb-dsh-count sb-dsh-${heroTone}`}>{n}</strong><strong>{S.heroTail}</strong>
          {b.stale.length ? <span className="sb-dsh-muted sb-dsh-stale-count">{S.staleTail(b.stale.length)}</span> : null}</p>
        <span className="sb-dsh-time">{snapshot.demo ? S.demoTag : hhmm(b.generatedAt)}</span>
      </div>
      <p className="sb-dsh-muted sb-dsh-counts">{S.counts(b.liveCount, b.units, b.linesRunning)}</p>
    </div>
    {b.waiting.length ? <Section title={S.sections.waiting}>{b.waiting.map(w => <WaitCard key={w.id} item={w} S={S} jump={jump} disabled={disabled} />)}</Section> : null}
    {b.stale.length ? <Section title={S.sections.stale}>{b.stale.map(w => <WaitCard key={w.id} item={w} S={S} jump={jump} disabled={disabled} />)}</Section> : null}
    {active.length || b.running.length ? <Section title={S.sections.working}>
      {active.map(p => <ProjectBlock key={p.id} project={p} S={S} jump={jump} disabled={disabled} />)}
      {b.running.length ? <div className="sb-dsh-single-list">{b.running.map(s => <SingleRow key={s.id} single={s} S={S} jump={jump} disabled={disabled} />)}</div> : null}
    </Section> : null}
    {finished.length || resting.length ? <Section title={S.sections.resting}>
      {finished.map(p => <button className="sb-dsh-row-button" type="button" key={p.id} onClick={() => jump(p.id)} disabled={disabled}>
        <span>{p.name} <span className="sb-dsh-muted">{S.allDelivered(p.lines.length)}</span></span>
      </button>)}
      {resting.map(s => <SingleRow key={s.id} single={s} S={S} jump={jump} disabled={disabled} />)}
    </Section> : null}
    {b.resting.length > RESTING_ROWS ? <button className="sb-dsh-link-button" type="button" aria-expanded={more} onClick={() => setMore(value => !value)}>{more ? S.less : S.more(b.resting.length - RESTING_ROWS)}</button> : null}
    {b.hiddenDormant ? <p className="sb-dsh-muted sb-dsh-message">{S.hidden(b.hiddenDormant)}</p> : null}
    {b.errors.length ? <p className="sb-dsh-message sb-dsh-warn" role="status">{b.errors.slice(0, 2).map(e => S.noTranscript(e.title)).join(' · ')}</p> : null}
    {snapshot.config.footerCommand ? <div className="sb-dsh-footer-action">
      <button className="sb-dsh-button" type="button" disabled={disabled} onClick={() => void store.act('footer')}>{snapshot.config.footerLabel || `/${snapshot.config.footerCommand.replace(/^\//, '')}`}</button>
    </div> : null}
  </>
}

function Settings({ snapshot, store, busy, t }: { snapshot: ClientSnapshot; store: SessionBoardStore; busy: boolean; t: Translate }) {
  const [draft, setDraft] = useState<BoardConfig>({ ...snapshot.config })
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [saved, setSaved] = useState(false)
  const prefix = useId()
  const configKey = JSON.stringify(snapshot.config)
  useEffect(() => {
    if (!dirtyRef.current) setDraft({ ...snapshot.config })
  }, [configKey])
  const change = <K extends keyof BoardConfig>(key: K, value: BoardConfig[K]) => {
    dirtyRef.current = true
    setDirty(true)
    setSaved(false)
    setDraft(previous => ({ ...previous, [key]: value }))
  }
  const save = async () => {
    if (await store.act('configure', { ...draft })) {
      dirtyRef.current = false
      setDirty(false)
      const refreshed = store.getSnapshot()
      if (!refreshed.error && refreshed.snapshot) setDraft({ ...refreshed.snapshot.config })
      setSaved(true)
    }
  }
  return <details className="sb-dsh-settings">
    <summary>{t('settings')}</summary>
    <p className="sb-dsh-muted sb-dsh-message">{t('settingsHint')}</p>
    <form onSubmit={event => { event.preventDefault(); void save() }}>
      <label className="sb-dsh-field" htmlFor={`${prefix}-language`}><span>{t('language')}</span>
        <select id={`${prefix}-language`} value={draft.language} disabled={busy} onChange={event => change('language', event.target.value as BoardConfig['language'])}>
          <option value="auto">{t('languageAuto')}</option><option value="en">{t('languageEn')}</option><option value="zh">{t('languageZh')}</option>
        </select>
      </label>
      <div className="sb-dsh-switch-field">
        <span id={`${prefix}-summaries`}>{t('summaries')}</span>
        <button className="sb-dsh-switch" type="button" role="switch" aria-checked={draft.summaries} aria-labelledby={`${prefix}-summaries`} aria-describedby={`${prefix}-summaries-hint`} disabled={busy} onClick={() => change('summaries', !draft.summaries)}>
          <span className="sb-dsh-switch-track" aria-hidden="true"><span /></span><span>{t(draft.summaries ? 'on' : 'off')}</span>
        </button>
      </div>
      <p className="sb-dsh-muted sb-dsh-field-hint" id={`${prefix}-summaries-hint`}>{t('summariesHint')}</p>
      <label className="sb-dsh-field" htmlFor={`${prefix}-mode`}><span>{t('modelMode')}</span>
        <select id={`${prefix}-mode`} value={draft.modelMode} disabled={busy} onChange={event => change('modelMode', event.target.value as BoardConfig['modelMode'])}>
          <option value="off">{t('modeOff')}</option><option value="fake">{t('modeFake')}</option><option value="live">{t('modeLive')}</option>
        </select>
      </label>
      <label className="sb-dsh-field" htmlFor={`${prefix}-provider`}><span>{t('provider')}</span><input id={`${prefix}-provider`} type="text" autoComplete="off" spellCheck={false} value={draft.provider} disabled={busy} onChange={event => change('provider', event.target.value)} /></label>
      <label className="sb-dsh-field" htmlFor={`${prefix}-model`}><span>{t('model')}</span><input id={`${prefix}-model`} type="text" autoComplete="off" spellCheck={false} value={draft.model} disabled={busy} onChange={event => change('model', event.target.value)} /></label>
      {draft.modelMode === 'live' && draft.summaries ? <p className="sb-dsh-message sb-dsh-warn">{t('liveWarning')}</p> : null}
      <label className="sb-dsh-field" htmlFor={`${prefix}-open`}><span>{t('openPane')}</span>
        <select id={`${prefix}-open`} value={draft.openPane} disabled={busy} onChange={event => change('openPane', event.target.value as BoardConfig['openPane'])}>
          <option value="auto">{t('openAuto')}</option><option value="command">{t('openCommand')}</option>
        </select>
      </label>
      <label className="sb-dsh-field" htmlFor={`${prefix}-footer`}><span>{t('footerCommand')}</span><input id={`${prefix}-footer`} type="text" autoComplete="off" spellCheck={false} value={draft.footerCommand} disabled={busy} onChange={event => change('footerCommand', event.target.value)} /></label>
      <label className="sb-dsh-field" htmlFor={`${prefix}-footer-label`}><span>{t('footerLabel')}</span><input id={`${prefix}-footer-label`} type="text" autoComplete="off" value={draft.footerLabel} disabled={busy} onChange={event => change('footerLabel', event.target.value)} /></label>
      <p className="sb-dsh-muted sb-dsh-field-hint">{t('footerHint')}</p>
      <div className="sb-dsh-settings-actions"><button className="sb-dsh-button sb-dsh-button-primary" type="submit" disabled={busy || !dirty}>{t(busy ? 'saving' : 'save')}</button>
        {saved ? <span className="sb-dsh-success" role="status">{t('saved')}</span> : null}
      </div>
    </form>
  </details>
}

function BoardPane({ sessionId, useTabInfo, switchboardRuntime: runtime }: PaneProps) {
  const info = useTabInfo()
  const { store, state, lang, S, t } = useBoard(runtime, sessionId, info.tab.visible)
  const snapshot = state.snapshot
  const b = snapshot?.board
  const empty = b && !b.waiting.length && !b.stale.length && !b.projects.length && !b.running.length && !b.resting.length
  return <div className="sb-dsh sb-dsh-pane" lang={lang} aria-label={t('title')} aria-busy={state.busy !== null || (!snapshot && state.refreshing)}>
    <style>{styles}</style>
    <div className="sb-dsh-pane-toolbar">
      <h1>{t('title')}</h1>
      {snapshot?.eligible ? <div className="sb-dsh-toolbar-actions">
        <button className="sb-dsh-button sb-dsh-button-small" type="button" disabled={state.busy !== null} onClick={() => void store.open(true)}>{t(snapshot.demo ? 'demoOff' : 'demoOn')}</button>
        <button className="sb-dsh-icon-button" type="button" title={t('refresh')} aria-label={t('refresh')} disabled={state.refreshing || state.busy !== null} onClick={() => void store.refresh()}><span aria-hidden="true">↻</span></button>
      </div> : null}
    </div>
    {!snapshot ? <p className="sb-dsh-muted sb-dsh-message" role="status">{S.loading}</p>
      : !snapshot.eligible ? <p className="sb-dsh-muted sb-dsh-message">{t('unavailable')}</p>
      : <>
        {b ? <BoardView key={sessionId} board={b} snapshot={snapshot} state={state} store={store} S={S} /> : <p className="sb-dsh-muted sb-dsh-message" role="status">{S.loading}</p>}
        {empty ? <p className="sb-dsh-muted sb-dsh-message">{t('empty')}</p> : null}
        {!snapshot.config.summaries || snapshot.config.modelMode === 'off' ? <p className="sb-dsh-muted sb-dsh-model-state">{t('summaryOff')}</p>
          : snapshot.config.modelMode === 'fake' ? <p className="sb-dsh-muted sb-dsh-model-state">{t('fakeMode')}</p> : null}
        <Settings snapshot={snapshot} store={store} busy={state.busy !== null} t={t} />
        <details className="sb-dsh-diagnostics"><summary>{t('diagnostics')}</summary>
          <p className="sb-dsh-muted">{t('modelCalls')}: {snapshot.counters.modelCalls} · {t('cacheHits')}: {snapshot.counters.cacheHits}</p>
          {snapshot.diagnostics.length ? <ul>{snapshot.diagnostics.map((diagnostic, index) => <li key={`${index}-${diagnostic}`}>{diagnostic}</li>)}</ul> : null}
        </details>
      </>}
    <FailureNotice state={state} S={S} />
    <p className="sb-dsh-attribution">{t('sourceNotice')}</p>
  </div>
}

export const inject = ['slots', 'locale', 'connection', 'uiWorkspace', 'sidebarRight', 'sidebarRightTabs']

export function apply(ctx: ClientContext): void {
  const slots = ctx.get('slots')
  const locale = ctx.get('locale')
  const tabs = ctx.get('sidebarRightTabs')
  ctx.effect(() => locale.register(LOCALE_NAMESPACE, DSH_DICTIONARIES), 'switchboard: locale')
  const runtime = new ClientRuntime(ctx)
  ctx.effect(() => () => runtime.dispose(), 'switchboard: polling lifetime')
  ctx.effect(() => tabs.register({
    id: PACKAGE_ID,
    kind: PANE_KIND,
    title: () => runtime.translate('title'),
    guide: [{ id: 'switchboard', title: () => runtime.translate('title'), order: 30 }],
  }), 'switchboard: native tab type')
  ctx.effect(() => slots.inject('sidebar.right.pane.tab', () => slots.register({
    name: 'sidebar.right.pane.tab',
    key: PACKAGE_ID,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ switchboardRuntime: runtime }),
  }, BoardPane)), 'switchboard: native tab body')
  ctx.effect(() => slots.inject('conversation.input.dock', () => slots.register({
    name: 'conversation.input.dock',
    id: PACKAGE_ID,
    order: 30,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ switchboardRuntime: runtime }),
  }, BoardBand)), 'switchboard: input band')
}
