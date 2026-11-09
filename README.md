# Switchboard for DeepSeek Harness

[English](#english) · [中文](#中文)

## 中文

**看哪些 dsh 会话在等你、要你做什么，一键去回答。**

移植自 [Fstrategy/switchboard](https://github.com/Fstrategy/switchboard)（原作者 Lumir，MIT）。本项目是社区插件，**非 DeepSeek/dsh 官方出品**；原始许可、来源和依赖声明保留在 [LICENSE](<LICENSE>)、[NOTICE](<NOTICE.md>) 与 [THIRD-PARTY-NOTICES](<THIRD-PARTY-NOTICES.md>)。

![当前 dsh 内的演示面板，只有虚构会话](<https://raw.githubusercontent.com/Fstrategy/switchboard-dsh/v0.1.0/docs/images/demo-zh.png>)

这是真实 dsh 界面中的 demo 面板裁剪，不是独立网页或 mock；仅保留虚构会话面板，聊天、头像和本机会话信息不公开。

### 在 dsh 插件页按包名安装

需要 **dsh 0.2.2-rc.1**（目前仅此版本经过验证）。以下是 `0.1.1` 的安装目标；须等待该版本在官方 npm 注册表可用，不代表发布已完成。

1. 打开 **插件 → 添加插件（Add plugin）**。
2. 输入下方包名，点击 **安装**。
3. 安装完成后点击 **立即启用（Enable now）**。若直接关闭安装结果页，包会保持未启用；按 dsh 提示重启。

```text
@lumir_kumou/switchboard-dsh
```

**安装者不需要 npm 账号或登录。** npm 登录、发布权限及可能的浏览器确认/双因素验证只属于维护者的发布过程。

若中国大陆镜像尚未同步，选择 **Registry → 官方 npm 注册表**（`https://registry.npmjs.org/`），并指定版本重试：

```text
@lumir_kumou/switchboard-dsh@0.1.1
```

镜像延迟不等于需要登录；若官方源仍不可用，检查该版本是否已经发布。也可以用 CLI 安装，`web` 应替换为实际 profile：

```sh
dsh plugin --profile web add @lumir_kumou/switchboard-dsh@0.1.1
```

### GitHub Release 安装替代方式

`v0.1.1` 的 Release 资产可用后，也可在 **添加插件** 中粘贴完整链接，再安装并 **立即启用**：

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.1/lumir_kumou-switchboard-dsh-0.1.1.tgz
```

旧版 [`v0.1.0` Release 安装包](<https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz>) 保持不变，其包名是 `@fstrategy/switchboard-dsh`；它不是新 npm 包名的安装入口。不要粘贴 Release 页面地址或 GitHub 源码 ZIP。

### 从旧包迁移

若曾安装 `@local/switchboard-dsh` 或 `@fstrategy/switchboard-dsh`，请先在 **插件** 页卸载旧包，再安装 `@lumir_kumou/switchboard-dsh`。三种身份共用看板服务、命令和存储域，**不要并存启用**；仅禁用会保留旧依赖。保留需要的设置，按提示重启，不要为迁移删除普通会话日志或手改 profile。

Git/tarball 安装的版本变更采用卸载再安装；从旧包名转为新 npm 包名同样不是原地升级。详情见 [分发与升级说明](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/docs/DISTRIBUTION.md>)。

### 使用

- `/switchboard`：打开聊天旁的原生右侧看板。
- `/switchboard demo`：切入/切出演示数据；演示中的跳转不会打开任何会话。
- 输入框上方常驻一行，只数其他会话；没有等待也保留看板按钮。
- 看板显示：等你（优先挡住其他任务的统筹、问题、决策、卡片）、放了很久、统筹与子任务、停着/做完了。
- 看板设置：中英文、短句、自动打开、可选底部命令。

**默认不调用模型。** `summaries=false`，开发模式为本地 fake。关闭短句时只使用原生会话记录，旧语义缓存不参与展示；demo 使用预写数据。只有用户明确开启 live 并配置可用小模型 provider/model 时才发送短摘录，不继承聊天模型，不自动回退到昂贵模型；可能产生所选提供方的费用。

### 发现列表与兼容范围

按包名安装、npm 发布或公开链接**都不等于自动出现在所有人的默认发现列表**。`dsh-plugin` 是 GitHub topic，不是官方认证或自动收录。可选的自有社区索引需要用户启用“自定义插件索引”并主动添加来源；详见 [分发说明](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/docs/DISTRIBUTION.md>)。

- 测试只用假模型；不为发布调用真实模型。
- 当前兼容声明为精确的 `0.2.2-rc.1`，不建议绕过版本检查。
- Windows/Linux 原生安装、深色像素外观、真实计费模型、跨 Host/跨进程聚合未完成实测。
- dsh 没有通用的 Claude 桌面版 post-turn verdict 或新会话建议卡片，真实数据不捏造这些字段；关闭模型后，普通回复中的语义提问不作 AI 推断。

完整数据映射与已知差异见 [PORTING-dsh](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/docs/PORTING-dsh.md>)。

## English

See which dsh sessions are waiting on you, what they need, and jump to reply. A native right-side tab and a persistent composer band show waiting actions, stopped work, coordinators/subagents, and idle sessions.

Community port of [Fstrategy/switchboard](https://github.com/Fstrategy/switchboard), originally by Lumir (MIT). **Not an official DeepSeek/dsh product.**

### Install by package name from Plugins

Tested with **dsh 0.2.2-rc.1** only. After `0.1.1` is available on the official npm registry, open **Plugins → Add plugin**, enter the package name, install, then choose **Enable now**:

```text
@lumir_kumou/switchboard-dsh
```

Users need **no npm account or login to install**. Only maintainers publishing a release need npm authorization and any required browser/2FA approval. These instructions identify the release target; they are not a publication-status claim.

If a mainland China mirror has not synchronized, select the **official npm registry** (`https://registry.npmjs.org/`) in **Registry** and try `@lumir_kumou/switchboard-dsh@0.1.1`. If that is still unavailable, check whether the release has been published; logging in does not fix mirror lag.

The alternative GitHub asset, once available, is:

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.1/lumir_kumou-switchboard-dsh-0.1.1.tgz
```

Paste that exact URL into **Add plugin**, install, then **Enable now**. The immutable [legacy v0.1.0 asset](<https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz>) keeps its earlier `@fstrategy/switchboard-dsh` identity; it is not the new npm package.

**Migration:** uninstall the earlier `@local/switchboard-dsh` prototype and/or `@fstrategy/switchboard-dsh` through **Plugins** before installing `@lumir_kumou/switchboard-dsh`. They share service, command, and storage identifiers and must not run side by side. Disabling alone retains the old dependency. Keep any settings you need, follow restart instructions, and do not delete conversation logs or hand-edit the profile for this migration. Git/tarball upgrades use uninstall then reinstall; changing package identity is not an in-place registry update.

Use `/switchboard` or `/switchboard demo`. Short-line summaries are **off by default**; off means no summary model calls. Fake mode stays local, demo uses prewritten facts, and live mode requires the user's explicit opt-in and configured small-model route.

Public installation does not imply automatic inclusion in the default discovery catalog. See [distribution options and official references](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/docs/DISTRIBUTION.md>). Untested native targets include Windows/Linux, dark-mode pixels and real paid models; read the [porting map](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/docs/PORTING-dsh.md>) before changing supported runtime versions.

### Develop from source

CLI development needs Node **>=24.9.0**. Build tools are pinned; the runtime tarball has no install lifecycle/build scripts. Clone this repository rather than developing inside an installed runtime tarball:

```sh
git clone https://github.com/Fstrategy/switchboard-dsh.git
cd switchboard-dsh
git checkout v0.1.1
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm test
pnpm run typecheck
pnpm run check
pnpm run upstream:check
node scripts/release-check.mjs --source-only
```

The three reusable upstream modules remain byte-for-byte unchanged. Tests inject fake collectors/models/transports and make no paid model calls. Prebuilt artifacts are committed for Git-source installs; normal users should prefer the npm package name, with the matching versioned Release tarball as an alternative. See [release procedure](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/RELEASING.md>) and [privacy/security notes](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.1/SECURITY.md>).
