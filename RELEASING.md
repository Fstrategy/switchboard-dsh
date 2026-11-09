# Releasing

Distribution is a public GitHub Release tarball, not an npm registry publication. The maintainer must have permission to create releases on `Fstrategy/switchboard-dsh`; no token should be stored in the repository or pasted into issue/chat messages.

## Gates

1. Keep `engines.dsh` at the exact runtime actually tested. Do not widen the range on assumption.
2. Use the pinned development dependencies with `pnpm install --frozen-lockfile --ignore-scripts`.
3. Build, run fake-only tests, run `typecheck`, `check`, `upstream:check`, and `release:check -- --source-only`.
4. Pack a **fresh** artifact with `pnpm pack --pack-destination artifacts`. This package has no prepack/prepare/install scripts. Do not reuse local acceptance archives, receipts or full-window screenshots.
5. Run the release checker on the exact new `.tgz`. Compare its members to the runtime allowlist, inspect the staged Git file list separately, and check privacy-sensitive content in all public assets.
6. Commit the reviewed source plus rebuilt `dist/`; Git-based installation must not depend on consumer-side prepare scripts. Use a non-private commit email when appropriate.
7. Tag the reviewed commit, push to the approved public repository, and upload the matching `.tgz`, checksum and fake-test result as Release assets.
8. Verify the public asset downloads without authentication and matches the local checksum. Exercise the same dsh plugin-manager entry point used by Plugins → Add plugin. A successful download alone is not activation verification.
9. Publish exact GUI instructions: paste the full `.tgz` asset URL, install, then **Enable now**. Do not claim npm publication, default catalog inclusion, or an actual GUI click test that was not performed.

If supplying `plugin-index.json`, use a real immutable full 40-character commit containing the prebuilt plugin. The optional index is user-added, not an official catalog. A Git source entry cannot point to a Release `.tgz` URL. See [distribution details](<docs/DISTRIBUTION.md>).

## Do not publish

Local verification receipts, session IDs/titles/replies, loopback GUI URLs, personal home/profile paths, dependency stores, test builds, private configuration, old archives and whole-window screenshots are not public source. The cropped demo panel in this repository contains only synthetic data; the original full-window screenshot is intentionally excluded.

GitHub Actions workflows are not included in this initial release. Tests/release gates are explicit local commands; no npm credentials or expanded GitHub workflow scope is required for the GitHub Release distribution path.
