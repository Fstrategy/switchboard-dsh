# Switchboard for DeepSeek Harness

[English](#english) · [中文](#中文)

## 中文

**看哪些 dsh 会话在等你、要你做什么，一键去回答。**

移植自 [Fstrategy/switchboard](https://github.com/Fstrategy/switchboard)（原作者 Lumir，MIT）。本项目是社区插件，**非 DeepSeek/dsh 官方出品**；原始许可、来源和依赖声明保留在 [LICENSE](<LICENSE>)、[NOTICE](<NOTICE.md>) 与 [THIRD-PARTY-NOTICES](<THIRD-PARTY-NOTICES.md>)。

![当前 dsh 内的演示面板，只有虚构会话](<https://raw.githubusercontent.com/Fstrategy/switchboard-dsh/v0.1.0/docs/images/demo-zh.png>)

这是真实 dsh 界面中的 demo 面板裁剪，不是独立网页或 mock；仅保留虚构会话面板，聊天、头像和本机会话信息不公开。

### 在 dsh 插件页安装 GitHub Release 包（推荐）

`0.1.2` 面向 **dsh 0.2.2-rc.3**，兼容声明仅此精确版本。安装步骤：

1. 打开 **插件 → 添加插件（Add plugin）**。
2. 粘贴下方完整 `.tgz` 链接，点击 **安装（Install）**。
3. 安装完成后点击 **立即启用（Enable now）**。若直接关闭安装结果页，包会保持未启用；按 dsh 提示重启。

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.2/lumir_kumou-switchboard-dsh-0.1.2.tgz
```

请使用完整资产链接，不要粘贴 Release 页面或源码 ZIP。安装、接口与界面验证范围见下方移植对照表；不把后台安装测试冒充自动化鼠标点击。

**安装者不需要 npm 账号或登录。** npm 身份 `@lumir_kumou/switchboard-dsh` 已准备，但尚未发布；`0.1.1` 草稿因维护者的双因素验证待完成而从未发布。当前不要按包名安装。只有维护者完成官方 npm 的授权/2FA 并确认目标版本公开可用后，才可改用 `@lumir_kumou/switchboard-dsh@0.1.2`；镜像可能稍后同步，官方注册表为 `https://registry.npmjs.org/`。不要向聊天提供令牌或验证码。

旧版 [`v0.1.0` Release 安装包](<https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz>) 保持不变，其包名是 `@fstrategy/switchboard-dsh`；它不是新 npm 包名的安装入口。不要粘贴 Release 页面地址或 GitHub 源码 ZIP。

### 从旧包迁移

若曾安装 `@local/switchboard-dsh` 或 `@fstrategy/switchboard-dsh`，请先在 **插件** 页卸载旧包，再安装 `@lumir_kumou/switchboard-dsh`。三种身份共用看板服务、命令和存储域，**不要并存启用**；仅禁用会保留旧依赖。保留需要的设置，按提示重启，不要为迁移删除普通会话日志或手改 profile。

tarball 安装的版本变更采用卸载再安装；rc.3 支持符合条件的同仓库 Git 提交更新，但从旧包名转为新包名仍不是原地升级。详情见 [分发与升级说明](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/docs/DISTRIBUTION.md>)。

### 使用

- `/switchboard`：打开聊天旁的原生右侧看板。
- `/switchboard demo`：切入/切出演示数据；演示中的跳转不会打开任何会话。
- 输入框上方常驻一行，只数其他会话；没有等待也保留看板按钮。
- 看板显示：等你（优先挡住其他任务的统筹、问题、决策、卡片）、放了很久、统筹与子任务、停着/做完了。
- 看板设置：中英文、短句、自动打开、可选底部命令。

**默认不调用模型。** `summaries=false`，开发模式为本地 fake。关闭短句时只使用原生会话记录，旧语义缓存不参与展示；demo 使用预写数据。只有用户明确开启 live 并配置可用小模型 provider/model 时才发送短摘录，不继承聊天模型，不自动回退到昂贵模型；可能产生所选提供方的费用。

### 发现列表与兼容范围

按包名安装、npm 发布或公开链接**都不等于自动出现在所有人的默认发现列表**。`dsh-plugin` 是 GitHub topic，不是官方认证或自动收录。可选的自有社区索引需要用户启用“自定义插件索引”并主动添加来源；详见 [分发说明](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/docs/DISTRIBUTION.md>)。

- 测试只用假模型；不为发布调用真实模型。
- 当前兼容声明为精确的 `0.2.2-rc.3`，不建议绕过版本检查。
- Windows/Linux 原生安装、深色像素外观、真实计费模型、跨 Host/跨进程聚合未完成实测。
- dsh 没有通用的 Claude 桌面版 post-turn verdict 或新会话建议卡片，真实数据不捏造这些字段；关闭模型后，普通回复中的语义提问不作 AI 推断。

完整数据映射与已知差异见 [PORTING-dsh](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/docs/PORTING-dsh.md>)。

## English

See which dsh sessions are waiting on you, what they need, and jump to reply. A native right-side tab and a persistent composer band show waiting actions, stopped work, coordinators/subagents, and idle sessions.

Community port of [Fstrategy/switchboard](https://github.com/Fstrategy/switchboard), originally by Lumir (MIT). **Not an official DeepSeek/dsh product.**

### Install the GitHub Release archive from Plugins (primary route)

Version `0.1.2` targets **dsh 0.2.2-rc.3 exactly**. Open **Plugins → Add plugin**, paste this full archive URL, choose **Install**, then **Enable now**:

```text
https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.2/lumir_kumou-switchboard-dsh-0.1.2.tgz
```

Use the exact asset URL, not the release page or source ZIP. Closing the result dialog without enabling leaves the bundle off; follow any restart instruction. Validation scope is documented in the porting map; shared-backend installation checks are not presented as automated GUI mouse clicks.

Users need **no npm account or login to install**. The npm identity `@lumir_kumou/switchboard-dsh` is prepared but unpublished: the `0.1.1` draft was never published because maintainer 2FA remains pending. Do not currently install by package name. Only after the maintainer completes official npm authorization/2FA and verifies the public target version may users install `@lumir_kumou/switchboard-dsh@0.1.2`. The official registry is `https://registry.npmjs.org/`; mirrors may lag. Never share tokens or verification codes in chat.

The immutable [legacy v0.1.0 asset](<https://github.com/Fstrategy/switchboard-dsh/releases/download/v0.1.0/fstrategy-switchboard-dsh-0.1.0.tgz>) keeps its earlier `@fstrategy/switchboard-dsh` identity and exact rc.1 compatibility for rc.1 users; it is not the new package.

**Migration:** uninstall the earlier `@local/switchboard-dsh` prototype and/or `@fstrategy/switchboard-dsh` through **Plugins** before installing `@lumir_kumou/switchboard-dsh`. They share service, command, and storage identifiers and must not run side by side. Disabling alone retains the old dependency. Keep any settings you need, follow restart instructions, and do not delete conversation logs or hand-edit the profile for this migration. Tarball upgrades use uninstall then reinstall. rc.3 supports eligible same-repository Git commit updates, but changing package identity still requires uninstall/reinstall.

Use `/switchboard` or `/switchboard demo`. Short-line summaries are **off by default**; off means no summary model calls. Fake mode stays local, demo uses prewritten facts, and live mode requires the user's explicit opt-in and configured small-model route.

Public installation does not imply automatic inclusion in the default discovery catalog. See [distribution options and official references](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/docs/DISTRIBUTION.md>). Untested native targets include Windows/Linux, dark-mode pixels and real paid models; read the [porting map](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/docs/PORTING-dsh.md>) before changing supported runtime versions.

### Develop from source

CLI development needs Node **>=24.9.0**. Build tools are pinned; the runtime tarball has no install lifecycle/build scripts. Clone this repository rather than developing inside an installed runtime tarball:

```sh
git clone https://github.com/Fstrategy/switchboard-dsh.git
cd switchboard-dsh
git checkout v0.1.2
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm test
pnpm run typecheck
pnpm run check
pnpm run upstream:check
node scripts/release-check.mjs --source-only
```

The three reusable upstream modules remain byte-for-byte unchanged. Tests inject fake collectors/models/transports and make no paid model calls. Prebuilt artifacts are committed for Git-source installs; normal users should use the matching versioned GitHub Release tarball once published; npm package-name installation remains unavailable until publication is verified. See [release procedure](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/RELEASING.md>) and [privacy/security notes](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.2/SECURITY.md>).
