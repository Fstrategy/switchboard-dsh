# Switchboard → dsh: porting map

Community port of [Fstrategy/switchboard](https://github.com/Fstrategy/switchboard), originally by Lumir (MIT). Not an official DeepSeek/dsh product. Baseline: upstream commit `07b07b63fc56add654f62f823fd1e8105fd2c8a8`. See [attribution](<../NOTICE.md>), [license](<../LICENSE>) and [provenance hashes](<../UPSTREAM.json>).

The implementation targets **dsh 0.2.2-rc.1**. Package/API contracts and the installed implementation take precedence over newer upstream documentation. Public source deliberately excludes machine-local acceptance receipts, personal session logs/IDs and full-window screenshots.

## npm distribution identity (v0.1.1)

The npm package is `@lumir_kumou/switchboard-dsh`. The GitHub repository remains `Fstrategy/switchboard-dsh`; GitHub account names do not grant ownership of the same npm scope. The immutable v0.1.0 GitHub release used the earlier package identity and is retained as a historical alternative.

The v0.1.1 change coordinates the package manifest, bundle patch, browser module-loader id and Client registration id. Behavioral service/projection/cache/command IDs stay stable, so old and new packages must not be enabled together. Remove the earlier installation before enabling the npm package. This is a distribution/identity update, not a new runtime API or broader compatibility claim.

## What stays unchanged

- [Pure board logic](<../hooks/logic.ts>), [English/Chinese strings and prompts](<../hooks/i18n.ts>) and [demo facts](<../hooks/demo.ts>) are byte-for-byte copies, checked against pinned SHA-256 values.
- [Original data types](<../types/index.d.ts>) omit only the final Claude Code module augmentation.
- Original Claude strings and unused navigation helper remain in those copies. The dsh adapter never executes the Claude collector, Python scripts or terminal AppleScript.

## Native facts

| Upstream concept | dsh implementation | Limit / truthful fallback |
| --- | --- | --- |
| Session files and process liveness | Native Agent registry, status events and live-preferred sessionQuery observations | Only actual resident Agents in the current Host count as live. A file, passive Session or query lease does not. No PID guessing or cross-process claims. |
| Busy / idle | Initial Agent status plus agent/status; incremental turn/start/end facts | A historical open turn without an Agent is not current work. |
| Unanswered question | Parsed native tool/call and matched tool/result; admitted user-question-reply records | Match call/subcall IDs; unrelated results do not settle another question. Never answer on behalf of a user. |
| Timed / continued / PTC question | Timed schema from request headers, continued outcomes, PTC subcall identity; pass-through request observer for legacy transient waits | A continued actionable question stays waiting when idle; actual settlement clears it. Observer is prepended but always delegates to the real answerer. |
| Approval / plan review | approval/asked paired with approval/decided; plan-review question intent | Normal tool execution is not approval waiting. The board does not approve anything. |
| Latest assistant reply | Text blocks of assistant/message, bounded before model prompts | Reasoning, tool output and system messages are not substituted. |
| Coordinator and children | Header origin=subagent and parentSession; native descriptor/catalog labels | A normal fork is not delegation. External executions without a local readable Session are not guessed live or jumpable. |
| Post-turn verdict | No universal dsh equivalent; summary=null | Do not turn a completed step into a completed task. Optional live summaries can infer a question only under the original eligibility rules. |
| Wrap-up / suggestion cards | No universal equivalent; real wrapUp empty and cards=[] | Do not relabel approvals as suggested new sessions. Demo still includes original card scenarios. |
| Focus history | Timestamp of an actual board jump | No invented global focus history. |
| Archived / dormant | Registry archive set, addressable session rows and recent activity | Addressable is not unarchived. Archived grouping roots/descendants are hidden; old stopped rows without pending input are dormant. |
| Stopped unanswered input | Separate dshPending extension and real-only board adapter | Put actual unresolved questions/approvals in the stopped/stale group, without inventing a TurnSummary. |

[Collector](<../src/collector.ts>) is a native incremental projection. It obtains cold observations through public sessionQuery leases, with bounded concurrency, cancellation and exact disposal; it does not parse private persistence paths or physical log formats. [Native-board adapter](<../src/native-board.ts>) accounts for unresolved stopped input without modifying upstream pure logic.

## Surface and execution map

| Original behavior | Native dsh surface |
| --- | --- |
| Side pane | Registered right sidebar tab and sidebar.right.pane.tab slot; preserves other tabs. |
| Above-prompt line | conversation.input.dock; excludes the current session and retains an open button with zero waits. |
| Shared live facts | One Host engine plus one ref-counted Client polling store per visible session; band and pane share it. |
| Refresh | Incremental facts with a 20s Host refresh and 5s Client snapshot poll; no interest lease means no background summaries. |
| /switchboard | Native command opens the current session's board, including when invoked before the first snapshot. |
| /switchboard demo | Same original synthetic facts; toggle in/out, no model/cache reads, no real jump. |
| Session jump | uiWorkspace.openSession with root ID or native direct-parent child address; no shell execution. |
| Short summaries | Explicit selected small-model route through llm.stream, 600 output tokens and a 30s deadline including catalog wait. No chat-model fallback. |
| Shared summary cache | Native storage domain, content/language/provider/model/mode keys, 3-day TTL, single-flight and cancellation/generation guards. |
| Settings | Exported Config schema and configEditor; updates only this plugin's settings, never rewrites the user's profile files manually. |
| Footer command | User-only native command operation; agent calls cannot configure/execute it or enable live inference. |
| Browser transport | Authenticated owner-only native Connection Fetch route with generic RPC envelope; no replacement HTTP app/server. |
| UI ownership | Native React slots/services and theme tokens; no private dsh Client imports, external DOM mutation, iframe or duplicated React root. |

## Safety defaults and intentional differences

Short summaries default to **off**, with local fake mode selected for development. This differs from an upstream default that can enable summaries, so installation never silently incurs model charges. Turning summaries off masks semantic cache content and hard-gates dispatch. Demo uses prewritten facts. Passive agent-tool status reads are not UI heartbeats and cannot start background summaries.

Live summaries require a user's explicit configured provider/model, a currently advertised small-model name and actual UI interest. Catalog/stream cancellation is bounded; a late aborted result cannot write back. Names are a conservative eligibility filter, not a price guarantee. Users remain responsible for provider costs and for whether session excerpts can be sent to that provider.

The port additionally clears an old refresh warning after a successful refresh, strengthens cache routing/single-flight behavior and uses dsh's authoritative archive set. Original grouping, relay deduplication, strings, prompts, resting expansion and demo ordering otherwise remain in the unchanged pure modules.

## The 11 upstream scenarios

All are covered by fake-only Node tests in [acceptance tests](<../tests/acceptance.test.ts>) plus [Host](<../tests/host.test.ts>), [collector](<../tests/collector.test.ts>) and [Client store/action tests](<../tests/client.test.ts>).

1. Demo blocker → question → card ordering, separate stopped group, project completion counts and hidden items.
2. Matching answer/approval settlement or resumed busy state removes old waiting text.
3. Composer band excludes the current session, including stale tails.
4. Zero waits still provides a board entry and open action.
5. Collection/model/storage failures expose a warning/reason; a later successful refresh clears it.
6. Temporary-directory script sessions do not attach/open a board, including effective cwd changes.
7. Language follows the Host locale or explicit en/zh override; prompts use the same language.
8. Summaries off means zero model dispatch, including old cache and aborted/late in-flight work.
9. Eligible no-verdict idle text questions can be inferred by fake model replies; off does not pretend to infer them.
10. Coordinator/descendant relay is deduplicated under the original rules.
11. Demo toggles safely, performs no real focus/navigation and can return to real facts.

Additional tests cover model/user authority, malformed parameters, cancellation and lease disposal, archive visibility, inherited titles, ordinary forks, external execution, bounded batches, cache TTL/routing and teardown ordering. These tests do not replace a browser or native multi-session acceptance test.

## Verification scope

The predecessor local build was exercised with real native sessions driven by an in-process deterministic fake provider: question waiting, working and idle; a human confirmed the board jump and answered the native question. That historical native/UI exercise is not represented as a fresh measurement of this public artifact, and its private receipts are intentionally not distributed.

The public release is rebuilt, tested and packed under its new identity; release assets include fresh fake-test results and checksums after the release gates pass. [The illustration](<images/demo-zh.png>) is a crop of the actual dsh demo pane, containing only original synthetic data—not a generated mock UI. Public URL installation/activation must be verified separately; see [release gates](<../RELEASING.md>).

Known limits: Windows/Linux native UI/install, dark-mode pixels, real paid providers, plugin-detail icon/localized metadata rendering, browser console, long-running scale and cross-Host aggregation have not all been exercised. Compatibility remains exactly the tested dsh runtime; no version exemptions are recommended. Normal dsh live session facts—not semantic guessing—remain available with summaries off.

### Public v0.1.0 post-publication check

- Public source/tag: `0f2deb78c4ec8ed6a7ed3bb9925c68887e1f3efc` / `v0.1.0`.
- The actual Release tarball downloaded without authentication and matched the reviewed SHA-256: `a3945e4e14cdade62dbda0d49f37fe3ca75ba34465d88680eb00f02f30e026b5`.
- On macOS with dsh 0.2.2-rc.1, removed the local prototype and installed the public HTTPS asset through the native plugin-manager operation also used by Plugins → Add plugin: `application=applied`, `warnings=[]`. This is an actual public-source installation/activation test, not a claim that mouse clicks in the Add dialog were automated.
- Public Host Config entry and active Client composer slot use `@fstrategy/switchboard-dsh`; the running Host tool reads native facts successfully. A local-only window capture confirmed the installed public board and composer band rendered in the current GUI.
- Summaries remained disabled: summary modelCalls=0, liveModelCalls=0, diagnostics=[]. No paid model was used for tests or verification.
- The full-window verification capture and installation logs are not public assets. Only the reviewed synthetic demo-pane crop is distributed in this repository.
