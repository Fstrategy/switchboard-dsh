import type { Board, Facts, SessionFact, TextEntry } from '../types/index.d.ts'
import { demoFacts, demoTexts } from '../hooks/demo.ts'
import { PROMPTS, STRINGS } from '../hooks/i18n.ts'
import type { Lang } from '../hooks/i18n.ts'
import {
  buildBoard,
  childrenOf,
  fingerprint,
  needsText,
  parseText,
  promptFor,
  roleOf,
  waitSignal,
} from '../hooks/logic.ts'

export type BoardEngineConfig = {
  summaries: boolean
  language: 'auto' | Lang
  modelMode: 'off' | 'fake' | 'live'
  provider: string
  model: string
}

export type CompletionInput = {
  session: SessionFact
  prompt: string
  system: string
  lang: Lang
  signal: AbortSignal
}

export type TextCache = {
  get(key: string): Promise<TextEntry | undefined>
  put(key: string, value: TextEntry): Promise<void>
}

export type BoardEngineDependencies = {
  collect(): Promise<Facts>
  complete(input: CompletionInput): Promise<string>
  cache?: TextCache
  now?: () => number
  /**
   * Optional pure native arrangement extension for authoritative facts the unchanged upstream
   * contract cannot express (for example, stopped pending input without a post-turn verdict).
   * Must not mutate facts/texts or invent a native summary. Demo always uses upstream buildBoard.
   */
  arrange?: (facts: Facts, texts: Record<string, TextEntry>, now: number, lang: Lang) => Board
}

export type BoardSnapshot = {
  facts: Facts | null
  texts: Record<string, TextEntry>
  note: string
  board: Board | null
}

export const TEXT_CACHE_TTL_MS = 3 * 24 * 60 * 60_000
export const ASKS_PER_REFRESH = 8
export const ASK_BATCH = 4

type TextRequest = { session: SessionFact; prompt: string; key: string }
type TextFlight = { generation: number; promise: Promise<TextEntry | undefined> }

const errorMessage = (error: unknown): string =>
  String(error instanceof Error ? error.message : error).slice(0, 100)

/**
 * Shared Host-side state, independent of the Harness APIs and of any model provider.
 * The adapter supplies native facts and is solely responsible for selecting a real or fake route.
 * `lang` is the effective language already resolved by the adapter with upstream pickLang.
 */
export class BoardEngine {
  readonly counters = { modelCalls: 0, cacheHits: 0 }

  private settings: BoardEngineConfig
  private readonly dependencies: BoardEngineDependencies
  private readonly now: () => number
  private facts: Facts | null = null
  private readonly textsByLang = new Map<Lang, Record<string, TextEntry>>()
  private readonly memoryCache = new Map<string, TextEntry>()
  private collectionError = ''
  private readonly textErrors = new Map<Lang, string>()
  private collectionFlight: Promise<Facts> | undefined
  private readonly refreshFlights = new Map<string, Promise<void>>()
  private readonly textFlights = new Map<string, TextFlight>()
  private readonly controllers = new Set<AbortController>()
  private generation = 0
  private disposed = false

  constructor(config: BoardEngineConfig, dependencies: BoardEngineDependencies) {
    this.settings = { ...config }
    this.dependencies = dependencies
    this.now = dependencies.now ?? Date.now
  }

  get config(): Readonly<BoardEngineConfig> {
    return { ...this.settings }
  }

  /** Invalidate in-flight work before exposing any changed privacy or routing configuration. */
  configure(partial: Partial<BoardEngineConfig>): void {
    if (this.disposed) return
    const next = { ...this.settings, ...partial }
    const changed = (Object.keys(next) as (keyof BoardEngineConfig)[]).some(
      key => next[key] !== this.settings[key],
    )
    if (!changed) return
    this.settings = next
    this.invalidate()
    this.textsByLang.clear()
    this.textErrors.clear()
  }

  /** Same-language refreshes and the collector are both single-flight. Errors become visible notes. */
  refresh(lang: Lang): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const generation = this.generation
    const key = `${generation}:${lang}`
    const existing = this.refreshFlights.get(key)
    if (existing) return existing
    const flight = this.refreshOnce(lang, generation)
    this.refreshFlights.set(key, flight)
    const clear = () => {
      if (this.refreshFlights.get(key) === flight) this.refreshFlights.delete(key)
    }
    void flight.then(clear, clear)
    return flight
  }

  /** A demo is a read-only alternate view: it never collects, caches or calls a model. */
  snapshot(lang: Lang, demo = false): BoardSnapshot {
    const now = this.now()
    if (demo) {
      const facts = demoFacts(now, lang)
      const texts = demoTexts(now, lang)
      return { facts, texts, note: '', board: buildBoard(facts, texts, now, lang) }
    }
    const texts: Record<string, TextEntry> = {}
    if (this.modelsEnabled() && this.facts) {
      const have = this.textsByLang.get(lang)
      for (const session of this.facts.sessions) {
        const entry = have?.[session.id]
        // A previous state must not classify a newly resumed/stopped/questioning session.
        if (!session.readError && entry && entry.status === (session.status ?? null)) texts[session.id] = entry
      }
    }
    const why = [this.collectionError, this.textErrors.get(lang)].filter(Boolean).join(' · ')
    return {
      facts: this.facts,
      texts,
      note: why ? STRINGS[lang].refreshFailed(why) : '',
      board: this.facts ? (this.dependencies.arrange ?? buildBoard)(this.facts, texts, now, lang) : null,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.invalidate()
    this.memoryCache.clear()
  }

  private invalidate(): void {
    this.generation += 1
    for (const controller of this.controllers) controller.abort()
    this.controllers.clear()
    this.refreshFlights.clear()
    this.textFlights.clear()
  }

  private modelsEnabled(): boolean {
    return !this.disposed && this.settings.summaries && this.settings.modelMode !== 'off'
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation
  }

  private canComplete(generation: number): boolean {
    return this.isCurrent(generation) && this.modelsEnabled()
  }

  private reportTextError(lang: Lang, generation: number, error: unknown): void {
    if (this.isCurrent(generation)) this.textErrors.set(lang, errorMessage(error))
  }

  private collectOnce(): Promise<Facts> {
    if (this.collectionFlight) return this.collectionFlight
    const flight = Promise.resolve().then(() => this.dependencies.collect())
    this.collectionFlight = flight
    const clear = () => {
      if (this.collectionFlight === flight) this.collectionFlight = undefined
    }
    void flight.then(clear, clear)
    return flight
  }

  private async refreshOnce(lang: Lang, generation: number): Promise<void> {
    let facts: Facts
    try {
      facts = await this.collectOnce()
    } catch (error) {
      if (this.isCurrent(generation)) this.collectionError = errorMessage(error)
      return
    }
    if (!this.isCurrent(generation)) return
    this.facts = facts
    this.collectionError = ''
    this.textErrors.delete(lang)
    if (!this.canComplete(generation)) return

    const config = { ...this.settings }
    const have = this.textsByLang.get(lang) ?? {}
    this.textsByLang.set(lang, have)
    const byId = new Map(facts.sessions.map(session => [session.id, session]))
    const kids = childrenOf(facts)
    // Include route and fake/live mode so one provider, or a fake, can never poison another route's cache.
    const route = JSON.stringify([config.modelMode, config.provider, config.model])
    const requests: TextRequest[] = facts.sessions
      .filter(session => !session.readError)
      .map(session => {
        const prompt = promptFor(session, roleOf(session, byId, kids, lang), lang)
        return { session, prompt, key: fingerprint(`${route}\n${lang}\n${prompt}`) }
      })
      .filter(request => needsText(request.session, request.key, have[request.session.id], this.now()))
      .sort((a, b) => Number(!!waitSignal(b.session)) - Number(!!waitSignal(a.session)))

    // Work once per distinct prompt, then attach the same short lines to each corresponding session.
    const grouped = new Map<string, TextRequest[]>()
    for (const request of requests) grouped.set(request.key, [...(grouped.get(request.key) ?? []), request])
    const groups = [...grouped.values()]
    let asked = 0
    const reserve = () => {
      if (asked >= ASKS_PER_REFRESH) return false
      asked += 1
      return true
    }
    for (let index = 0; index < groups.length; index += ASK_BATCH) {
      if (!this.canComplete(generation)) return
      await Promise.all(
        groups.slice(index, index + ASK_BATCH).map(async group => {
          const request = group[0]
          if (!request) return
          try {
            const entry = await this.sharedText(request, lang, generation, reserve)
            if (!entry || !this.canComplete(generation)) return
            for (const item of group) {
              have[item.session.id] = { ...entry, status: item.session.status ?? null }
            }
          } catch (error) {
            this.reportTextError(lang, generation, error)
          }
        }),
      )
    }
  }

  private sharedText(
    request: TextRequest,
    lang: Lang,
    generation: number,
    reserve: () => boolean,
  ): Promise<TextEntry | undefined> {
    const existing = this.textFlights.get(request.key)
    if (existing?.generation === generation) return existing.promise
    const promise = this.resolveText(request, lang, generation, reserve)
    const flight = { generation, promise }
    this.textFlights.set(request.key, flight)
    const clear = () => {
      if (this.textFlights.get(request.key) === flight) this.textFlights.delete(request.key)
    }
    void promise.then(clear, clear)
    return promise
  }

  private async resolveText(
    request: TextRequest,
    lang: Lang,
    generation: number,
    reserve: () => boolean,
  ): Promise<TextEntry | undefined> {
    if (!this.canComplete(generation)) return undefined
    const remembered = this.memoryCache.get(request.key)
    if (remembered && this.now() - remembered.at <= TEXT_CACHE_TTL_MS) {
      this.counters.cacheHits += 1
      return remembered
    }
    if (this.dependencies.cache) {
      try {
        const cached = await this.dependencies.cache.get(request.key)
        if (!this.canComplete(generation)) return undefined
        if (
          cached?.key === request.key &&
          typeof cached.text?.short === 'string' &&
          cached.text.short &&
          Number.isFinite(cached.at) &&
          this.now() - cached.at <= TEXT_CACHE_TTL_MS
        ) {
          this.counters.cacheHits += 1
          this.memoryCache.set(request.key, cached)
          return cached
        }
      } catch (error) {
        this.reportTextError(lang, generation, error)
      }
    }
    // This is the hard call-entry gate: an off switch during an asynchronous cache read wins.
    if (!this.canComplete(generation) || !reserve()) return undefined
    const controller = new AbortController()
    this.controllers.add(controller)
    try {
      if (!this.canComplete(generation) || controller.signal.aborted) return undefined
      this.counters.modelCalls += 1
      const raw = await this.dependencies.complete({
        session: request.session,
        prompt: request.prompt,
        system: PROMPTS[lang].system,
        lang,
        signal: controller.signal,
      })
      // Providers may ignore AbortSignal. Never publish or persist their late answer after invalidation.
      if (!this.canComplete(generation) || controller.signal.aborted) return undefined
      const text = parseText(raw, lang)
      if (!text) throw new Error('The short-line model returned invalid JSON.')
      const entry: TextEntry = {
        key: request.key,
        at: this.now(),
        text,
        status: request.session.status ?? null,
      }
      if (this.dependencies.cache) {
        try {
          if (!this.canComplete(generation)) return undefined
          await this.dependencies.cache.put(request.key, entry)
        } catch (error) {
          this.reportTextError(lang, generation, error)
        }
      }
      if (!this.canComplete(generation) || controller.signal.aborted) return undefined
      this.memoryCache.set(request.key, entry)
      return entry
    } finally {
      this.controllers.delete(controller)
    }
  }
}

/** Text only: the Client still renders an always-available localized Board button beside it. */
export const bandLine = (board: Board, currentId: string | undefined, lang: Lang): string => {
  const strings = STRINGS[lang]
  const others = board.waiting.filter(item => item.id !== currentId)
  const top = others[0]
  if (top) {
    const what =
      top.kind === 'block'
        ? strings.band.what.block
        : top.kind === 'question'
          ? strings.band.what.question
          : strings.band.what.other
    return strings.band.waiting(others.length, top.name, what, top.waitMs).trimEnd()
  }
  const nobody = others.length < board.waiting.length ? strings.band.noneOthers : strings.band.none
  return `${nobody}${board.stale.length ? strings.band.staleTail(board.stale.length) : ''}`
}
