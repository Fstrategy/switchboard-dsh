# Distribution and plugin-page installation

Switchboard dsh is an independent community plugin, not an official DeepSeek product. Its package identity is `@fstrategy/switchboard-dsh`, version `0.1.0`, with declared Harness compatibility `0.2.2-rc.1`.

## Install the public release asset

No npm account, npm login, or npm package publication is required.

1. Open **Plugins → Add plugin** in DeepSeek Harness.
2. Paste this GitHub Release asset URL:

   ```text
   https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz
   ```

3. Review the source and trust notice, then choose **Install**.
4. When installation finishes, choose **Enable now**. Closing the dialog instead leaves the bundle installed but off.
5. Follow any restart instruction the Harness reports. Package installation alone does not establish successful activation or rendering.

Use the uploaded `.tgz` asset, not the release page, a GitHub source ZIP, or the repository's web page in its place. The asset must contain the built Host and Client entry points, bundle patch, exported locales, icon, and license notices. A source checkout working through a local link does not establish that those files are in the archive.

The Host uses its package manager to install this artifact. Dependencies can still be downloaded from a registry; distributing through GitHub does **not** promise an installation without registry traffic. Changing the registry cannot mirror a GitHub asset that the Host cannot reach.

**Trust:** installed Host plugin code runs in the Harness process, outside the agent's workspace sandbox. An accepted URL or completed download is not a security review. Only grant a requested dependency build-script permission after reviewing it.

### Other accepted source forms

The Plugins **Add plugin** field in Harness `0.2.2-rc.1` accepts:

| Source | Accepted form and limitation |
| --- | --- |
| Registry package | An actual published package name, optionally followed by a version, range, or tag. This project is distributed by Release asset; the package identity alone is **not** a registry-install instruction. |
| GitHub repository | `github:Fstrategy/switchboard-dsh`, optionally pinned to a published ref such as `github:Fstrategy/switchboard-dsh#v0.1.0`. The chosen source must contain an installable bundle and its built entry points. |
| Explicit Git URL | `git+https://github.com/Fstrategy/switchboard-dsh.git`, optionally with the chosen Git ref after `#`. |
| Tarball | A public HTTP(S) URL ending in `.tgz` or `.tar.gz`; the Release URL above is the recommended route. Avoid a query string appended after the extension. |
| Local development copy | An absolute package-directory path on the Harness Host, optionally prefixed with `file:` or `link:`. Relative paths are not accepted by this GUI field. |

Bare `Fstrategy/switchboard-dsh` is not an accepted shorthand here. A plain HTTPS repository URL must not have a trailing slash. A Git or tarball preview checks the form and host; it does not prove the remote manifest, contents, or compatibility before downloading it. Git installations can also require preparation/build-script permission, which the prebuilt release asset avoids for this bundle itself.

### Compatibility and upgrades

The declared `engines.dsh` range is exactly `0.2.2-rc.1`; support for other Harness versions is not asserted. The installer and launcher enforce declared DSH compatibility. An exemption warning is not a normal installation step or evidence that an untested runtime works.

A bundle installed from a tarball, Git URL, or local path has no registry **Versions** section in this Harness version. To change versions, uninstall the old bundle through **Plugins**, then install the chosen new Release asset and enable it. Follow any restart requirement; disabling alone retains the installed dependency. Review the new release's compatibility and migration notes first.

## Optional Discover index: explicit user opt-in

Publishing this repository or release does **not** automatically place Switchboard dsh in **Discover**, the Official catalog, or the default plugin list.

Harness `0.2.2-rc.1` provides the experimental **Custom plugin indexes** bundle, off in shipped profiles. A user who wants an independently hosted index must:

1. Enable **Plugins → Experimental plugins → Custom plugin indexes**.
2. Open **Discover → Add index source**, or use **Manage index sources…** in its index menu.
3. Add the **raw JSON document's final URL**, not a repository page or a `github.com/.../blob/...` HTML page.
4. Select that index, review the entry's source/version and trust notice, and confirm installation. Enable the installed bundle afterward.

This repository also publishes an optional root-level community index. Its source URL is:

```text
https://raw.githubusercontent.com/Fstrategy/switchboard-dsh/main/plugin-index.json
```

The actual JSON document pins v0.1.0 to the real prebuilt source commit `0f2deb78c4ec8ed6a7ed3bb9925c68887e1f3efc`. It is separate from the Release asset; users must add this source themselves. Publishing it does not add an index to anyone's profile.

There is no official index configured by default. An author may host their own index without upstream approval; inclusion in someone else's community index is that index maintainer's decision. Every user still chooses which index sources to add. A label an index calls “official” is merely that index's claim, not DeepSeek verification.

Index sources use HTTP(S), without credentials or a fragment. Prefer HTTPS. The Host refuses redirects, so configure the final raw-content URL. Indexes are unsigned, and their names, versions, icons, and compatibility declarations are publisher claims; the installed manifest remains authoritative.

### Small format-1 listing for a prebuilt Git commit

The installed format-1 validator supports only `npm` and commit-pinned `git` sources. It has **no Release-tarball source type**. Consequently, the `.tgz` route above works through **Add plugin**, but must not be disguised as a `git` source in an index.

A Git-backed listing is possible if the repository commit itself contains the built, installable bundle. The following JavaScript describes a small complete JSON document; it is **not a published index**. Supply the real, already-published commit SHA and its committer timestamp before serializing it. The index may be added in a later commit that points back to that prebuilt source commit; it need not refer to its own commit. Do not publish placeholder values.

```js
function switchboardIndex(sourceCommit, publishTimestamp) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error('Use the actual full lowercase source commit SHA')
  }
  if (!Number.isInteger(publishTimestamp)
      || publishTimestamp < 0 || publishTimestamp >= 100_000_000_000) {
    throw new Error('Use the commit timestamp as integer Unix seconds')
  }
  return {
    format: 1,
    title: { en: 'Switchboard dsh community index', zh: 'Switchboard dsh 社区索引' },
    description: { en: 'Independent Switchboard dsh releases.', zh: '独立发布的 Switchboard dsh 社区插件。' },
    plugins: [{
      name: '@fstrategy/switchboard-dsh',
      title: { en: 'Switchboard dsh', zh: 'Switchboard dsh 会话看板' },
      description: { en: 'A session board for DeepSeek Harness.', zh: 'DeepSeek Harness 的会话看板。' },
      author: 'Fstrategy',
      repository: { url: 'https://github.com/Fstrategy/switchboard-dsh' },
      icon: 'icon.svg',
      metadata: { keywords: ['switchboard', 'dsh', 'session board'] },
      versions: [{
        version: '0.1.0',
        publishTimestamp,
        source: {
          type: 'git',
          url: 'https://github.com/Fstrategy/switchboard-dsh',
          commit: sourceCommit,
        },
        engines: { dsh: '0.2.2-rc.1' },
      }],
    }],
  }
}
```

Here `publishTimestamp` is **seconds**, not JavaScript milliseconds. The commit must contain a manifest whose name, version, compatibility, patch, and entry points match the listing. A SHA is not a branch name or tag. For a package in a subdirectory, the Git source also permits `path`, a relative slash-separated directory without `.` or `..` segments; this repository's package is at its root.

If the JSON document is published as a root-level index beside [icon.svg](../icon.svg), `"icon": "icon.svg"` resolves beside that raw JSON URL, not against `source.url`. The included icon is a small self-contained SVG, an accepted image format. Keep it reachable at that relative raw path; if the index is hosted elsewhere, host the icon beside it or use its absolute HTTPS URL. An index under a `docs/` directory would need `../icon.svg` instead. Browser rendering and reachability must still be checked after publication.

In this runtime, names must be unique npm-style package names; every plugin needs at least one exact SemVer version. Each version needs a unique version string, integer Unix timestamp, and supported source. Localized objects require `en` and lowercase language identifiers such as `zh`. Optional category, label, and sort-key references must first be declared in the root metadata maps. An invalid source, duplicate, or undeclared reference rejects the whole document. Use the matching Harness version's validator when preparing an actual index.

## What GitHub discoverability does—and does not—mean

The upstream project recommends the GitHub `dsh-plugin` topic to help people find community repositories. This is GitHub topic/search discoverability, not automatic index enrollment, an endorsement, or default GUI placement.

The Official optional/on-demand catalog is compiled into the Harness distribution. Changing it requires an upstream change and a new Harness release; a plugin or profile cannot extend it merely by publishing metadata. Upstream currently does not accept external pull requests and identifies GitHub Discussions as the feedback channel. No default-listing review or acceptance is promised by this release.

## Upstream evidence

These mechanisms were checked against installed Harness `0.2.2-rc.1`; upstream documentation can change with later releases.

- [Plugins installation UI and enablement](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md#installing-a-bundle)
- [Install-spec parser: package names, Git, tarballs, and paths](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/src/install-spec.ts)
- [Compatibility checks and package-install failure behavior](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md#version-compatibility-and-exemptions)
- [Launcher compatibility and bundle metadata](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md#profiles)
- [Custom plugin indexes: opt-in and no official index](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/plugin-market-bundle/README.md)
- [Discover source management](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-market/README.md#use-this-package)
- [Format-1 executable validator and install-target construction](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/plugin-market-index/src/index.ts)
- [Installation-owned Official catalog](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/official-bundles/README.md)
- [GitHub topic recommendation](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md#community-and-support) and [contribution policy](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md)
