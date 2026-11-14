# Releasing

The `0.1.2` primary release target is the GitHub Release archive in `Fstrategy/switchboard-dsh`, with package identity `@lumir_kumou/switchboard-dsh` and exact DSH `0.2.2-rc.3` compatibility. The npm identity is prepared but unpublished: the `0.1.1` draft was never published because maintainer 2FA remains pending. The earlier `v0.1.0` asset and its `@fstrategy/switchboard-dsh` identity remain immutable for exact rc.1 users. Instructions below are a procedure, not a claim that publication or an actual GUI click test has completed.

**Ship one tested, prepacked tarball to GitHub; optional npm publication later must use the same approved bytes.** Do not publish from the working directory or rebuild/repack between destinations. Installing the archive requires no npm login. npm publishing requires an authorized maintainer who controls the scope and completes the official authorization/2FA flow; GitHub release publication requires repository permission.

## Local release gates

1. Keep `engines.dsh` at the exact runtime actually tested: `0.2.2-rc.3`. Do not widen compatibility or platform claims on assumption.
2. Verify the release manifest, bundle patch, built Client registration, and documentation consistently use `@lumir_kumou/switchboard-dsh` and version `0.1.2`. Keep shared behavior identifiers unchanged; users must uninstall older identities before migration.
3. Use pinned development dependencies, rebuild, and run fake-only checks:

   ```sh
   pnpm install --frozen-lockfile --ignore-scripts
   pnpm run build
   pnpm test
   pnpm run typecheck
   pnpm run check
   pnpm run upstream:check
   node scripts/release-check.mjs --source-only
   ```

4. Review and stage only public allowlisted source plus rebuilt `dist/`. Git-source installation must not depend on consumer-side prepare scripts. Use a non-private commit email when appropriate. Check the staged file list and public assets separately from the archive.
5. Pack a **fresh** artifact once, then check that exact archive:

   ```sh
   pnpm pack --pack-destination artifacts
   node scripts/release-check.mjs artifacts/lumir_kumou-switchboard-dsh-0.1.2.tgz
   ```

   This package has no automatic install, pack, or publish lifecycle scripts. Review the archive's exact runtime allowlist and checksum. Do not reuse local acceptance archives, verification receipts, or full-window screenshots. Record the archive digest; no later build or repack may silently replace the bytes being approved.

## Optional npm publication: explicit maintainer action after 2FA

Confirm that the npm version is available to publish and that the authenticated user has permission for `@lumir_kumou`. Use the official npm registry, not a read-only mirror. The publishing CLI for this procedure is npm `11.19.1`.

```sh
npm publish ./artifacts/lumir_kumou-switchboard-dsh-0.1.2.tgz --access public --registry https://registry.npmjs.org/ --ignore-scripts
```

Keep the `./` prefix: npm can interpret an unprefixed two-component path as a GitHub repository shorthand. Publish the **tested archive file**, not `npm publish .`. Explicit `--access public` makes the scoped package public; `--ignore-scripts` prevents publish-time lifecycle hooks. Do not modify the archive after approval.

Current npm account policy may require fresh browser authorization, two-factor authentication, an OTP, or another user confirmation. The maintainer must complete that flow directly in the official npm/CLI interface. Do not ask someone to paste tokens, recovery codes, or OTPs into chat; do not read, copy, commit, or upload authentication files. Do not disable 2FA, expand authorization scopes, or create an automatic publishing workflow to bypass a prompt. Stop and report an authorization problem instead of claiming publication succeeded.

After npm confirms publication, verify the exact public name/version and anonymously retrieve the published `dist.tarball`; compare its bytes with the tested archive. Only then describe package-name installation as available. Mirrors can lag behind the official registry; do not republish or change versions merely to work around mirror caching.

## GitHub publication: use the same bytes

Tag the reviewed source as `v0.1.2`, push only the approved public repository content, and attach the same `lumir_kumou-switchboard-dsh-0.1.2.tgz` to that release with its checksum and fake-test result. Its asset URL is:

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.2/lumir_kumou-switchboard-dsh-0.1.2.tgz
```

Verify the asset downloads without authentication and matches the tested archive. If npm publication later completes, compare that tarball too. Never overwrite or relabel the existing `v0.1.0` artifact. GitHub Actions workflows and expanded GitHub workflow scope are not required; the release gates above are local commands.

Verify installation and activation through the same plugin-manager entry point used by **Plugins → Add plugin**, only with separate permission to change a test profile. A successful download, archive check, or package-manager exit alone does not prove activation or rendered UI. Do not claim an actual GUI click test that was not performed.

## Installation and optional index instructions

Publish the primary instructions as **Plugins → Add plugin → paste the full GitHub Release archive URL → Install → Enable now**, using the exact `v0.1.2` asset URL above only once downloadable. Installation requires no npm account or login. Keep npm package-name installation explicitly unavailable until the maintainer completes 2FA and verifies public `@lumir_kumou/switchboard-dsh@0.1.2`; only then offer it with official registry `https://registry.npmjs.org/`. Link the [migration guidance](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/README.md#从旧包迁移>): uninstall old `@fstrategy` before installing `@lumir_kumou`, because behavior identifiers collide. Tarball upgrades remain uninstall/reinstall; rc.3's eligible same-repository Git commit update support does not change that.

Only after verifying actual npm publication should the optional root index be updated to the new package identity/version with `source: { "type": "npm", "registry": "https://registry.npmjs.org/" }`, the real npm publication timestamp in Unix seconds, and `engines.dsh: "0.2.2-rc.3"`. Validate the resulting JSON. Do not retarget the old Git-backed `0.1.0` entry to a different identity or pretend a Release `.tgz` URL is a Git source. The index is explicitly user-added, not an official or default catalog. See [distribution details](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/docs/DISTRIBUTION.md>).

## Do not publish

Local verification receipts, session IDs/titles/replies, loopback GUI URLs, personal home/profile paths, dependency stores, test builds, private configuration, authentication data, old archives, and whole-window screenshots are not public source. The cropped demo panel contains only synthetic data; the original full-window screenshot is intentionally excluded.
