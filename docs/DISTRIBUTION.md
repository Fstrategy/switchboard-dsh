# Distribution and plugin-page installation

Switchboard dsh is an independent community plugin, not an official DeepSeek product. The `0.1.1` distribution target is `@lumir_kumou/switchboard-dsh`, with declared Harness compatibility exactly `0.2.2-rc.1`. The GitHub repository remains `Fstrategy/switchboard-dsh`. These instructions do not certify that npm or GitHub publication has completed; the selected source must actually offer the requested version.

## Primary route: install by npm package name

1. Open **Plugins → Add plugin** in DeepSeek Harness.
2. Enter the package name and choose **Install**:

   ```text
   @lumir_kumou/switchboard-dsh
   ```

3. Review the source and trust notice.
4. When installation finishes, choose **Enable now**. Closing the dialog instead leaves the bundle installed but off.
5. Follow any restart instruction the Harness reports. Package installation alone does not establish successful activation or rendering.

**Installing the public package needs no npm account or npm login.** npm authorization, publishing permission, browser confirmation, and possible two-factor authentication apply to the maintainer publishing the package—not to users installing it.

### Official npm registry and mirror delay

A mainland China mirror may not yet have a newly published package or version. In the install dialog's **Registry** selector, choose the **official npm registry** (`https://registry.npmjs.org/`) and specify the exact release:

```text
@lumir_kumou/switchboard-dsh@0.1.1
```

The registry selection affects this installation. A missing mirror copy is not a request to log in. If the official registry also has no such version, verify publication status rather than trying credentials or disabling package-manager security policy. Registry availability and the package manager's release-age policy can affect a fresh release; an exact version is not a promise to bypass those protections.

## Alternative: install the matching GitHub Release archive

Once the `v0.1.1` Release asset is available, paste its full public URL into **Add plugin**, choose **Install**, then **Enable now**:

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.1/lumir_kumou-switchboard-dsh-0.1.1.tgz
```

The maintainer publishes the same tested prepacked archive to npm and GitHub. A GitHub-hosted archive is a separate distribution endpoint, not a substitute for npm registration of the package name. Its download needs no npm login. Do not use the release page, GitHub source ZIP, or repository web page in place of the archive.

The immutable [legacy v0.1.0 asset](<https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz>) retains the identity `@fstrategy/switchboard-dsh`; do not overwrite it or treat it as the new npm package.

The Host still uses its package manager to install a tarball, and dependencies can contact a registry. Changing registries cannot mirror an unreachable GitHub asset. The archive must actually contain the built Host/Client entry points, bundle patch, exported locales, icon, and license notices; a local linked checkout working is not proof that a packed archive is complete.

**Trust:** installed Host code runs inside the Harness process, outside the agent's workspace sandbox. An accepted package name, URL, or completed download is not a security review. Only approve a requested dependency build script after reviewing it.

### Other accepted source forms

Harness `0.2.2-rc.1` accepts package names with optional versions/ranges/tags; `github:Fstrategy/switchboard-dsh#v0.1.1`; explicit Git addresses such as `git+https://github.com/Fstrategy/switchboard-dsh.git#v0.1.1`; public HTTP(S) tarball URLs ending in `.tgz` or `.tar.gz`; and absolute local package-directory paths, optionally prefixed with `file:` or `link:`.

A selected Git ref must contain an installable bundle and its built entry points. Git installations can require preparation/build-script approval. Bare `Fstrategy/switchboard-dsh` is not accepted shorthand by this GUI parser. Plain HTTPS repository URLs must not have a trailing slash; avoid query strings appended after a tarball extension. Relative local paths are not accepted. A Git/tarball preview checks form and host, not the remote manifest and compatibility before downloading it.

## Migration, compatibility, and upgrades

Uninstall the earlier local prototype and/or `@fstrategy/switchboard-dsh` through **Plugins** before installing `@lumir_kumou/switchboard-dsh`; the exact names and steps are in the [migration guide](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/README.md#从旧包迁移>). The identities share services, commands, and storage domains and must not run side by side. Disabling alone leaves the old dependency installed. Retain any settings you need and follow restart instructions; migration does not require deleting conversation logs or manually rewriting the profile.

The declared `engines.dsh` range remains exactly `0.2.2-rc.1`; other runtimes and additional native platforms are not asserted as tested. The installer and launcher enforce compatibility. A version-exemption warning is not a normal installation step or evidence that an untested runtime works.

Git, tarball, and local-path installations have no registry **Versions** section in this Harness version: uninstall the old bundle, install the chosen new source, then enable it. A package-identity change is also uninstall/reinstall, not an in-place update. Eligible same-name npm installations can expose **Versions** for later published registry updates. Review compatibility and migration notes before any upgrade.

## Optional Discover index: explicit user opt-in

An npm publication, GitHub release, or `dsh-plugin` topic does **not** automatically place Switchboard dsh in **Discover**, the Official catalog, or the default plugin list.

Harness `0.2.2-rc.1` provides **Custom plugin indexes**, experimental and off in shipped profiles. To use an independent index:

1. Enable **Plugins → Experimental plugins → Custom plugin indexes**.
2. Open **Discover → Add index source**, or **Manage index sources…** in its index menu.
3. Add the final raw JSON URL, not a repository HTML page:

   ```text
   https://raw.githubusercontent.com/Fstrategy/switchboard-dsh/main/plugin-index.json
   ```

4. Check the entry's actual package name, source, and version before confirming installation, then enable the installed bundle.

The existing index may still offer the legacy Git-backed `0.1.0` package until the maintainer updates it after verifying npm publication. A documentation example does not update the live index or install anything in a user's profile. Do not co-install an older identity from an index with the new npm identity.

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
        version: '0.1.1',
        publishTimestamp,
        source: { type: 'npm', registry: 'https://registry.npmjs.org/' },
        engines: { dsh: '0.2.2-rc.1' },
      }],
    }],
  }
}
```

Use real publication time in **seconds**, not JavaScript milliseconds. The listed name/version and compatibility must match the package manifest. A Git version instead needs the actual lowercase full 40-character commit SHA of an installable prebuilt source; its source must never point at a Release `.tgz` URL.

For the root raw-index URL above, `"icon": "icon.svg"` resolves beside that document to the repository's raw [icon.svg](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/icon.svg>), not against the npm registry or repository metadata. Keep that resource reachable; an index hosted elsewhere needs its own adjacent icon or an absolute HTTPS image URL. Browser rendering must still be checked separately.

Names and exact versions must be unique within their respective scopes. Each plugin needs at least one exact SemVer version, integer Unix timestamp, and supported source. Localized objects require `en` and lowercase language identifiers such as `zh`. Optional category/label/sort-key references need declarations in root metadata. Invalid sources, duplicates, or undeclared references reject the whole document. Validate against the matching Harness version before publishing an actual index.

## GitHub discoverability and the Official catalog

Upstream recommends the GitHub `dsh-plugin` topic for topic/search discoverability, not automatic enrollment or endorsement. Official optional/on-demand lists are compiled into the Harness distribution; changing them requires an upstream change and a new Harness release. A plugin or profile cannot extend them merely by publishing metadata. Upstream currently does not accept external pull requests and identifies GitHub Discussions as the feedback channel. No default-listing review or acceptance is promised by this release.

## Upstream evidence

These mechanisms were checked against installed Harness `0.2.2-rc.1`; upstream documentation can change with later releases.

- [Plugins installation UI, registries, enablement, and registry versions](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md#installing-a-bundle)
- [Install-spec parser](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/src/install-spec.ts)
- [Installer compatibility and registry fallback](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md#version-compatibility-and-exemptions)
- [Launcher compatibility](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md#profiles)
- [Custom indexes: opt-in and no official index](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/plugin-market-bundle/README.md)
- [Discover source management](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-market/README.md#use-this-package)
- [Format-1 executable validator and install targets](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/plugin-market-index/src/index.ts)
- [Installation-owned Official catalog](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/official-bundles/README.md)
- [GitHub topic recommendation](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md#community-and-support) and [contribution policy](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md)
