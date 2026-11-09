# Security and privacy

Switchboard reads session facts from the current dsh Host/profile. It does not read Claude session files, browser profiles, authentication tokens, or sessions from unrelated Host processes.

- Short-line summaries are disabled by default. When disabled, the model dispatcher is hard-gated and cached semantic summaries are ignored.
- Fake mode and demo mode do not make external model requests.
- Live summaries send a session title and short state/reply/question excerpts through the user's explicitly configured small-model provider. Display scrubbing is **not a secret-redaction guarantee**. Do not enable live summaries for sensitive session content unless that transfer is acceptable.
- Browser calls use the native authenticated Connection route and its owner checks; no unprotected replacement server is started.
- User questions, permissions, live-model opt-in, and footer command configuration/execution are user-only. The agent tool cannot use the footer as a bridge to arbitrary human-only commands.
- Temporary-directory script sessions do not attach a board. Passive agent-tool reads do not authorize background summaries.
- Cache entries expire after three days; underlying storage routing belongs to dsh.

## Reporting an issue

For non-sensitive problems, use [GitHub Issues](https://github.com/Fstrategy/switchboard-dsh/issues). Never include API keys, raw session logs, credentials, or full-window screenshots containing private chats/avatars. Use `/switchboard demo` and crop/review screenshots before sharing.

For a suspected sensitive vulnerability, use GitHub's **Report a vulnerability** feature if available; otherwise contact the repository maintainer without posting exploit secrets publicly. A dedicated private reporting address is not configured by this release.
