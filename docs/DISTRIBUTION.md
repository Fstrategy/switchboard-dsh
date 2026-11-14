# Distribution and plugin-page installation

Switchboard dsh is an independent community plugin, not an official DeepSeek product. The `0.1.2` distribution target is `@lumir_kumou/switchboard-dsh`, with declared Harness compatibility exactly `0.2.2-rc.3`. The GitHub repository remains `Fstrategy/switchboard-dsh`. These instructions do not certify that npm or GitHub publication has completed; the selected source must actually offer the requested version.

## Primary route: install the matching GitHub Release archive

Once the planned `v0.1.2` Release asset is published and downloadable:

1. Open **Plugins → Add plugin** in DeepSeek Harness.
2. Paste the full public archive URL below and choose **Install**.
3. Review the source and trust notice.
4. When installation finishes, choose **Enable now**. Closing the dialog instead leaves the bundle installed but off.
5. Follow any restart instruction the Harness reports. Package installation alone does not establish successful activation or rendering; these instructions do not claim an actual GUI click test.

**Installing needs no npm account or npm login.** The npm identity `@lumir_kumou/switchboard-dsh` is prepared but unpublished. The `0.1.1` draft was never published because maintainer 2FA remains pending; package-name installation is currently unavailable. npm authorization and two-factor authentication belong to the maintainer, not installing users. Never share credentials or verification codes in chat.

The primary planned archive URL is:

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.2/lumir_kumou-switchboard-dsh-0.1.2.tgz
```

Publish the tested prepacked archive to GitHub; optional later npm publication must use the same approved bytes. A GitHub-hosted archive is a separate endpoint, not npm registration of the package name. Its download needs no npm login. Do not use the release page, GitHub source ZIP, or repository web page in place of the archive.

### Optional npm route, only after verified publication

After the maintainer completes official npm authorization/2FA and verifies the public version, package-name installation may use `@lumir_kumou/switchboard-dsh@0.1.2`. If a mirror lags, choose the official npm registry (`https://registry.npmjs.org/`) in **Registry**. Until then, an absent official package is unpublished, not a mirror or installer-login problem. Release-age policy may also apply; an exact version does not bypass it.

The immutable [legacy v0.1.0 asset](<https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz>) retains the identity `@fstrategy/switchboard-dsh` and exact `0.2.2-rc.1` compatibility for rc.1 users; do not overwrite it or treat it as the new package.

The Host still uses its package manager to install a tarball, and dependencies can contact a registry. Changing registries cannot mirror an unreachable GitHub asset. The archive must actually contain the built Host/Client entry points, bundle patch, exported locales, icon, and license notices; a local linked checkout working is not proof that a packed archive is complete.

**Trust:** installed Host code runs inside the Harness process, outside the agent's workspace sandbox. An accepted package name, URL, or completed download is not a security review. Only approve a requested dependency build script after reviewing it.

### Other accepted source forms

Harness `0.2.2-rc.3` accepts package names with optional versions/ranges/tags; `github:Fstrategy/switchboard-dsh#v0.1.2`; explicit Git addresses such as `git+https://github.com/Fstrategy/switchboard-dsh.git#v0.1.2`; public HTTP(S) tarball URLs ending in `.tgz` or `.tar.gz`; and absolute local package-directory paths, optionally prefixed with `file:` or `link:`.

A selected Git ref must contain an installable bundle and its built entry points. Git installations can require preparation/build-script approval. Bare `Fstrategy/switchboard-dsh` is not accepted shorthand by this GUI parser. Plain HTTPS repository URLs must not have a trailing slash; avoid query strings appended after a tarball extension. Relative local paths are not accepted. A Git/tarball preview checks form and host, not the remote manifest and compatibility before downloading it.

## Migration, compatibility, and upgrades

Uninstall the earlier local prototype and/or `@fstrategy/switchboard-dsh` through **Plugins** before installing `@lumir_kumou/switchboard-dsh`; the exact names and steps are in the [migration guide](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/README.md#从旧包迁移>). The identities share services, commands, and storage domains and must not run side by side. Disabling alone leaves the old dependency installed. Retain any settings you need and follow restart instructions; migration does not require deleting conversation logs or manually rewriting the profile.

The declared `engines.dsh` range remains exactly `0.2.2-rc.3`; other runtimes and additional native platforms are not asserted as tested. The installer and launcher enforce compatibility. A version-exemption warning is not a normal installation step or evidence that an untested runtime works.

Tarball and local-path upgrades require uninstalling the old bundle, installing the chosen new source, then enabling it. rc.3 supports `updateBundle` for eligible Git installations pinned to full commits when the new commit belongs to the same repository directory; this is not a tarball update route. A package-identity change still requires uninstall/reinstall. Eligible same-name npm installations can expose registry versions only after publication. Review compatibility and migration notes before any upgrade.

## Optional Discover index: explicit user opt-in

An npm publication, GitHub release, or `dsh-plugin` topic does **not** automatically place Switchboard dsh in **Discover**, the Official catalog, or the default plugin list.

Harness `0.2.2-rc.3` provides **Custom plugin indexes**, experimental and off in shipped profiles. To use an independent index:

1. Enable **Plugins → Experimental plugins → Custom plugin indexes**.
2. Open **Discover → Add index source**, or **Manage index sources…** in its index menu.
3. Add the final raw JSON URL, not a repository HTML page:

   ```text
   https://raw.githubusercontent.com/Fstrategy/switchboard-dsh/main/plugin-index.json
   ```

4. Check the entry's actual package name, source, and version before confirming installation, then enable the installed bundle.

The published root index lists the new Git-backed `0.1.2` package for rc.3 and a separately labeled legacy `0.1.0` package for rc.1. Both pin actual prebuilt source commits and explicit engines; neither depends on an unpublished npm package. Do not co-install the identities. Adding the index is a user's explicit opt-in, not a change this release makes to everyone's profile.

There is no official index configured by default. Authors may host their own indexes without upstream approval; another community index's inclusion policy belongs to its maintainer. Every user still chooses which sources to add. An index label called “official” is only that index's claim, not DeepSeek verification.

Index sources use HTTP(S), without credentials or a fragment. Prefer HTTPS. The Host refuses redirects, so configure the final raw-content URL. Indexes are unsigned; display and compatibility metadata are publisher claims, and the installed manifest remains authoritative.

### Format-1 npm listing: maintainer example

The installed format-1 validator supports `npm` and commit-pinned `git` sources, but **no Release-tarball source type**. After the new npm package is actually published and checked, a listing can use this parameterized example. It is not a publication receipt or an instruction to replace the existing index before that check.

```js
function switchboardNpmIndex(publishTimestamp) {
  if (!Number.isInteger(publishTimestamp)
      || publishTimestamp < 0 || publishTimestamp >= 100_000_000_000) {
    throw new Error('Use the actual npm publication time as integer Unix seconds')
  }
  return {
    format: 1,
    title: { en: 'Switchboard dsh community index', zh: 'Switchboard dsh 社区索引' },
    description: { en: 'Independent Switchboard dsh releases.', zh: '独立发布的 Switchboard dsh 社区插件。' },
    plugins: [{
      name: '@lumir_kumou/switchboard-dsh',
      title: { en: 'Switchboard dsh', zh: 'Switchboard dsh 会话看板' },
      description: { en: 'A session board for DeepSeek Harness.', zh: 'DeepSeek Harness 的会话看板。' },
      author: 'Lumir',
      repository: { url: 'https://github.com/Fstrategy/switchboard-dsh' },
      icon: 'icon.svg',
      metadata: { keywords: ['switchboard', 'dsh', 'session board'] },
      versions: [{
        version: '0.1.2',
        publishTimestamp,
        source: { type: 'npm', registry: 'https://registry.npmjs.org/' },
        engines: { dsh: '0.2.2-rc.3' },
      }],
    }],
  }
}
```

Use real publication time in **seconds**, not JavaScript milliseconds. The listed name/version and compatibility must match the package manifest. A Git version instead needs the actual lowercase full 40-character commit SHA of an installable prebuilt source; its source must never point at a Release `.tgz` URL.

For the root raw-index URL above, `"icon": "icon.svg"` resolves beside that document to the repository's raw [icon.svg](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/icon.svg>), not against the npm registry or repository metadata. Keep that resource reachable; an index hosted elsewhere needs its own adjacent icon or an absolute HTTPS image URL. Browser rendering must still be checked separately.

Names and exact versions must be unique within their respective scopes. Each plugin needs at least one exact SemVer version, integer Unix timestamp, and supported source. Localized objects require `en` and lowercase language identifiers such as `zh`. Optional category/label/sort-key references need declarations in root metadata. Invalid sources, duplicates, or undeclared references reject the whole document. Validate against the matching Harness version before publishing an actual index.

## GitHub discoverability and the Official catalog

Upstream recommends the GitHub `dsh-plugin` topic for topic/search discoverability, not automatic enrollment or endorsement. Official optional/on-demand lists are compiled into the Harness distribution; changing them requires an upstream change and a new Harness release. A plugin or profile cannot extend them merely by publishing metadata. Upstream currently does not accept external pull requests and identifies GitHub Discussions as the feedback channel. No default-listing review or acceptance is promised by this release.

## Upstream evidence

These mechanisms were checked against installed Harness `0.2.2-rc.3`; upstream documentation can change with later releases.

- [Plugins installation UI, registries, enablement, and registry versions](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md#installing-a-bundle)
- [Install-spec parser](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/src/install-spec.ts)
- [Installer compatibility and registry fallback](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md#version-compatibility-and-exemptions)
- [Launcher compatibility](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md#profiles)
- [Custom indexes: opt-in and no official index](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/plugin-market-bundle/README.md)
- [Discover source management](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-market/README.md#use-this-package)
- [Format-1 executable validator and install targets](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/plugin-market-index/src/index.ts)
- [Installation-owned Official catalog](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/official-bundles/README.md)
- [GitHub topic recommendation](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md#community-and-support) and [contribution policy](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md)
