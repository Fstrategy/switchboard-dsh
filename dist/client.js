window.__ModuleLoader__.load({id:"@lumir_kumou/switchboard-dsh",factory(require){const module={exports:{}};const exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  PACKAGE_ID: () => PACKAGE_ID,
  PANE_KIND: () => PANE_KIND,
  POLL_MS: () => POLL_MS,
  SessionBoardStore: () => SessionBoardStore,
  apply: () => apply,
  bandSummary: () => bandSummary,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");

// hooks/i18n.ts
var pickLang = (setting, locale) => setting === "en" || setting === "zh" ? setting : /^zh/i.test(locale ?? "") ? "zh" : "en";
var MIN = 6e4;
var agoEn = (ms) => {
  const min = Math.max(0, Math.round(ms / MIN));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
};
var agoZh = (ms) => {
  const min = Math.max(0, Math.round(ms / MIN));
  if (min < 1) return "\u521A\u521A";
  if (min < 60) return `${min} \u5206\u949F`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} \u5C0F\u65F6` : `${Math.round(h / 24)} \u5929`;
};
var STRINGS = {
  en: {
    ago: agoEn,
    loading: "Reading your sessions\u2026",
    heroTail: " waiting on you",
    staleTail: (n) => ` \xB7 ${n} left for a while`,
    counts: (live, units, running) => `${live} sessions open \xB7 ${units} things in all \xB7 ${running} line${running === 1 ? "" : "s"} at work`,
    sections: {
      waiting: "Waiting on you",
      stale: "Left for a while \xB7 the session has stopped",
      working: "Claude is on it \xB7 nothing for you",
      resting: "Idle \xB7 done"
    },
    chip: { block: "Blocking others", question: "Asking you", decide: "Your call", card: "Card to click" },
    go: { block: "Reply", question: "Answer", decide: "Open", card: "Open" },
    isHere: "you were just here",
    waited: (ms) => ms < MIN ? "just now" : `waiting ${agoEn(ms)}`,
    idleFor: (ms) => `idle for ${agoEn(ms)}`,
    parentWaiting: "coordinator waiting on you",
    delivered: (done, total) => `${done}/${total} done`,
    allDelivered: (n) => `all ${n} lines done`,
    closeable: "can close",
    more: (n) => `${n} more, show`,
    less: "show less",
    hidden: (n) => `${n} more session${n === 1 ? "" : "s"} idle for over a day, not waiting on you`,
    unreadableName: "Unreadable session",
    unreadable: "couldn't read this session's record",
    noTranscript: (title) => `no transcript found for \u201C${title}\u201D`,
    refreshFailed: (why) => `The board didn't refresh this time: ${why}`,
    cannotJump: "This session can't be opened from here; find it in the sidebar.",
    jumpFailed: "Couldn't switch: that session's window may be closed.",
    demoJump: "This is demo data: there is no real session to open.",
    demoTag: "demo",
    band: {
      waiting: (n, name, what, ms) => `${n} waiting on you \xB7 ${name} ${what}, ${agoEn(ms)} `,
      what: { block: "is blocking others", question: "is asking you", other: "is waiting" },
      none: "Nothing is waiting on you",
      noneOthers: "No other session is waiting on you",
      staleTail: (n) => ` \xB7 ${n} left for a while`,
      open: "Board"
    },
    opened: "Opened the board.",
    demoOn: "Demo data on: the board shows made-up sessions. Run /switchboard demo again to go back.",
    demoOff: "Demo data off: the board shows your sessions again.",
    fallback: {
      untitled: "Untitled session",
      busy: "working",
      waitingQ: "asking you",
      idle: "idle",
      gone: "session stopped",
      answer: "Answer its question",
      plan: "Review its plan",
      card: (title) => `Decide on the card \u201C${title}\u201D`,
      look: "Open it to see what it needs"
    }
  },
  zh: {
    ago: agoZh,
    loading: "\u6B63\u5728\u8BFB\u5404\u4E2A\u4F1A\u8BDD\u2026",
    heroTail: " \u4EF6\u4E8B\u5728\u7B49\u4F60",
    staleTail: (n) => ` \xB7 ${n} \u4EF6\u653E\u4E86\u5F88\u4E45`,
    counts: (live, units, running) => `${live} \u4E2A\u4F1A\u8BDD\u5F00\u7740 \xB7 \u6536\u6210 ${units} \u4EF6\u4E8B \xB7 ${running} \u6761\u7EBF\u5728\u5E72`,
    sections: {
      waiting: "\u7B49\u4F60",
      stale: "\u653E\u4E86\u5F88\u4E45 \xB7 \u4F1A\u8BDD\u5DF2\u7ECF\u505C\u4E86",
      working: "Claude \u5728\u5E72 \xB7 \u4E0D\u7528\u4F60\u7BA1",
      resting: "\u505C\u7740 \xB7 \u505A\u5B8C\u4E86"
    },
    chip: { block: "\u5361\u7740\u522B\u4EBA", question: "\u5728\u95EE\u4F60", decide: "\u7B49\u4F60\u5B9A", card: "\u7B49\u4F60\u70B9\u5361\u7247" },
    go: { block: "\u53BB\u56DE\u590D", question: "\u53BB\u56DE\u7B54", decide: "\u53BB\u770B\u770B", card: "\u53BB\u770B\u770B" },
    isHere: "\u4F60\u521A\u5728\u8FD9\u513F",
    waited: (ms) => ms < MIN ? "\u521A\u505C\u4E0B" : `\u7B49\u4E86 ${agoZh(ms)}`,
    idleFor: (ms) => `\u653E\u4E86 ${agoZh(ms)}`,
    parentWaiting: "\u7EDF\u7B79\u5728\u7B49\u4F60",
    delivered: (done, total) => `${done}/${total} \u4EA4\u4E86`,
    allDelivered: (n) => `${n} \u6761\u7EBF\u90FD\u4EA4\u4E86`,
    closeable: "\u53EF\u4EE5\u5173",
    more: (n) => `\u8FD8\u6709 ${n} \u4E2A\uFF0C\u5C55\u5F00`,
    less: "\u6536\u8D77",
    hidden: (n) => `\u53E6\u6709 ${n} \u4E2A\u4F1A\u8BDD\u505C\u4E86\u4E00\u5929\u4EE5\u4E0A\uFF0C\u6CA1\u5728\u7B49\u4F60`,
    unreadableName: "\u8BFB\u4E0D\u5230\u7684\u4F1A\u8BDD",
    unreadable: "\u8BFB\u4E0D\u5230\u8FD9\u4E2A\u4F1A\u8BDD\u7684\u8BB0\u5F55",
    noTranscript: (title) => `\u6CA1\u627E\u5230\u300C${title}\u300D\u7684\u5BF9\u8BDD\u8BB0\u5F55`,
    refreshFailed: (why) => `\u770B\u677F\u8FD9\u6B21\u6CA1\u5237\u65B0\u4E0A\uFF1A${why}`,
    cannotJump: "\u8FD9\u4E2A\u4F1A\u8BDD\u6CA1\u6CD5\u76F4\u63A5\u8DF3\u8FC7\u53BB\uFF0C\u53BB\u4FA7\u680F\u91CC\u627E\u5B83\u3002",
    jumpFailed: "\u6CA1\u8DF3\u8FC7\u53BB\uFF1A\u90A3\u4E2A\u4F1A\u8BDD\u7684\u7A97\u53E3\u53EF\u80FD\u5DF2\u7ECF\u5173\u4E86\u3002",
    demoJump: "\u8FD9\u662F\u6F14\u793A\u6570\u636E\uFF0C\u6CA1\u6709\u771F\u7684\u4F1A\u8BDD\u53EF\u4EE5\u6253\u5F00\u3002",
    demoTag: "\u6F14\u793A",
    band: {
      waiting: (n, name, what, ms) => `${n} \u4EF6\u4E8B\u5728\u7B49\u4F60 \xB7 ${name}${what}\uFF0C${agoZh(ms)} `,
      what: { block: "\u5361\u7740\u522B\u4EBA", question: "\u5728\u95EE\u4F60", other: "\u5728\u7B49\u4F60" },
      none: "\u6B64\u523B\u6CA1\u6709\u4F1A\u8BDD\u5728\u7B49\u4F60",
      noneOthers: "\u522B\u7684\u4F1A\u8BDD\u6CA1\u5728\u7B49\u4F60",
      staleTail: (n) => ` \xB7 ${n} \u4EF6\u653E\u4E86\u5F88\u4E45`,
      open: "\u770B\u677F"
    },
    opened: "\u5DF2\u6253\u5F00\u4F1A\u8BDD\u770B\u677F\u3002",
    demoOn: "\u5DF2\u6362\u6210\u6F14\u793A\u6570\u636E\uFF1A\u770B\u677F\u4E0A\u662F\u7F16\u7684\u4F1A\u8BDD\u3002\u518D\u8F93\u5165\u4E00\u6B21 /switchboard demo \u6362\u56DE\u6765\u3002",
    demoOff: "\u5DF2\u6362\u56DE\u4F60\u81EA\u5DF1\u7684\u4F1A\u8BDD\u3002",
    fallback: {
      untitled: "\u6CA1\u6709\u6807\u9898\u7684\u4F1A\u8BDD",
      busy: "\u5728\u5E72\u6D3B",
      waitingQ: "\u505C\u4E0B\u6765\u95EE\u4F60",
      idle: "\u505C\u7740",
      gone: "\u4F1A\u8BDD\u5DF2\u7ECF\u505C\u4E86",
      answer: "\u56DE\u7B54\u5B83\u7684\u95EE\u9898",
      plan: "\u770B\u5B83\u7684\u65B9\u6848\uFF0C\u6279\u4E0D\u6279",
      card: (title) => `\u5B9A\u4E0D\u5B9A\u5F00\u65B0\u4F1A\u8BDD\u300C${title}\u300D`,
      look: "\u53BB\u770B\u770B\u5B83\u8981\u4F60\u505A\u4EC0\u4E48"
    }
  }
};

// hooks/logic.ts
var BUSY_TEXT_EVERY_MS = 5 * 6e4;
var HERE_MS = 3 * 6e4;
var isTemp = (cwd) => /^(?:\/(?:private\/)?(?:var\/folders|tmp)\/|[A-Za-z]:\\Users\\[^\\]+\\AppData\\Local\\Temp\\)/i.test(
  `${cwd}${cwd.includes("\\") ? "\\" : "/"}`
);

// src/dsh-i18n.ts
var LOCALE_NAMESPACE = "switchboardDsh";
var en = {
  title: "Switchboard",
  settings: "Board settings",
  settingsHint: "Saved for this Harness profile, not just this tab.",
  language: "Board language",
  languageAuto: "Follow Harness",
  languageEn: "English",
  languageZh: "\u4E2D\u6587",
  summaries: "AI summaries",
  summariesHint: "Off uses recorded session facts only. No summary model requests are made.",
  on: "On",
  off: "Off",
  modelMode: "Summary model mode",
  modeOff: "Off \xB7 no model",
  modeFake: "Fake \xB7 local development",
  modeLive: "Live \xB7 configured provider",
  provider: "Provider",
  model: "Model",
  liveWarning: "Live mode with AI summaries enabled sends short session excerpts to the configured provider and may incur charges.",
  openPane: "Open the board",
  openAuto: "Once per selected session",
  openCommand: "Only when requested",
  footerCommand: "Footer slash command",
  footerLabel: "Footer button label",
  footerHint: "Optional. The Host runs this command with its normal access checks.",
  save: "Save settings",
  saving: "Saving\u2026",
  saved: "Settings saved.",
  refresh: "Refresh board",
  demoOn: "Show demo",
  demoOff: "Leave demo",
  diagnostics: "Diagnostics",
  modelCalls: "Model calls",
  cacheHits: "Cache hits",
  unavailable: "Switchboard is not attached to temporary-directory script sessions.",
  empty: "No sessions to display yet.",
  summaryOff: "AI summaries are off \xB7 recorded facts only",
  fakeMode: "Local fake summary model \xB7 no API requests",
  sourceNotice: "Community port of Fstrategy/switchboard \xB7 not an official DeepSeek product.",
  openFailed: "Could not open the board.",
  invalidResponse: "The Switchboard Host returned an invalid response.",
  actionFailed: "The Switchboard action failed.",
  busy: "Another Switchboard action is still running.",
  connectionFailed: "The Switchboard Host could not be reached."
};
var zh = {
  title: "\u4F1A\u8BDD\u770B\u677F",
  settings: "\u770B\u677F\u8BBE\u7F6E",
  settingsHint: "\u4FDD\u5B58\u5230\u5F53\u524D Harness \u914D\u7F6E\uFF0C\u6240\u6709\u4F1A\u8BDD\u5171\u7528\u3002",
  language: "\u770B\u677F\u8BED\u8A00",
  languageAuto: "\u8DDF\u968F Harness",
  languageEn: "English",
  languageZh: "\u4E2D\u6587",
  summaries: "AI \u6458\u8981",
  summariesHint: "\u5173\u95ED\u540E\u53EA\u7528\u4F1A\u8BDD\u8BB0\u5F55\u4E2D\u7684\u4E8B\u5B9E\uFF0C\u4E0D\u53D1\u9001\u6458\u8981\u6A21\u578B\u8BF7\u6C42\u3002",
  on: "\u5F00",
  off: "\u5173",
  modelMode: "\u6458\u8981\u6A21\u578B\u6A21\u5F0F",
  modeOff: "\u5173\u95ED \xB7 \u4E0D\u7528\u6A21\u578B",
  modeFake: "\u5047\u6A21\u578B \xB7 \u672C\u5730\u5F00\u53D1",
  modeLive: "\u771F\u5B9E\u6A21\u578B \xB7 \u5DF2\u914D\u7F6E\u7684\u63D0\u4F9B\u65B9",
  provider: "\u63D0\u4F9B\u65B9",
  model: "\u6A21\u578B",
  liveWarning: "\u5F00\u542F AI \u6458\u8981\u5E76\u9009\u62E9\u771F\u5B9E\u6A21\u578B\u540E\uFF0C\u4F1A\u628A\u4F1A\u8BDD\u77ED\u6458\u5F55\u53D1\u9001\u5230\u6240\u914D\u7F6E\u7684\u63D0\u4F9B\u65B9\uFF0C\u53EF\u80FD\u4EA7\u751F\u8D39\u7528\u3002",
  openPane: "\u6253\u5F00\u770B\u677F",
  openAuto: "\u6BCF\u4E2A\u9009\u4E2D\u4F1A\u8BDD\u81EA\u52A8\u6253\u5F00\u4E00\u6B21",
  openCommand: "\u4EC5\u5728\u624B\u52A8\u8BF7\u6C42\u65F6\u6253\u5F00",
  footerCommand: "\u9875\u811A\u659C\u6760\u547D\u4EE4",
  footerLabel: "\u9875\u811A\u6309\u94AE\u6587\u5B57",
  footerHint: "\u53EF\u9009\uFF0C\u7531 Host \u6309\u901A\u5E38\u7684\u6743\u9650\u68C0\u67E5\u6267\u884C\u3002",
  save: "\u4FDD\u5B58\u8BBE\u7F6E",
  saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
  saved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002",
  refresh: "\u5237\u65B0\u770B\u677F",
  demoOn: "\u67E5\u770B\u6F14\u793A",
  demoOff: "\u9000\u51FA\u6F14\u793A",
  diagnostics: "\u8BCA\u65AD\u4FE1\u606F",
  modelCalls: "\u6A21\u578B\u8C03\u7528",
  cacheHits: "\u7F13\u5B58\u547D\u4E2D",
  unavailable: "\u4E34\u65F6\u76EE\u5F55\u4E2D\u7684\u811A\u672C\u4F1A\u8BDD\u4E0D\u6302\u4F1A\u8BDD\u770B\u677F\u3002",
  empty: "\u6682\u65F6\u6CA1\u6709\u53EF\u663E\u793A\u7684\u4F1A\u8BDD\u3002",
  summaryOff: "AI \u6458\u8981\u5DF2\u5173\u95ED \xB7 \u53EA\u663E\u793A\u8BB0\u5F55\u4E2D\u7684\u4E8B\u5B9E",
  fakeMode: "\u672C\u5730\u5047\u6458\u8981\u6A21\u578B \xB7 \u4E0D\u53D1\u9001 API \u8BF7\u6C42",
  sourceNotice: "Fstrategy/switchboard \u793E\u533A\u79FB\u690D\u7248 \xB7 \u975E DeepSeek \u5B98\u65B9\u51FA\u54C1\u3002",
  openFailed: "\u6CA1\u80FD\u6253\u5F00\u4F1A\u8BDD\u770B\u677F\u3002",
  invalidResponse: "\u4F1A\u8BDD\u770B\u677F Host \u8FD4\u56DE\u4E86\u65E0\u6548\u7ED3\u679C\u3002",
  actionFailed: "\u4F1A\u8BDD\u770B\u677F\u64CD\u4F5C\u5931\u8D25\u3002",
  busy: "\u53E6\u4E00\u4E2A\u770B\u677F\u64CD\u4F5C\u4ECD\u5728\u6267\u884C\u3002",
  connectionFailed: "\u65E0\u6CD5\u8FDE\u63A5\u4F1A\u8BDD\u770B\u677F Host\u3002"
};
var DSH_DICTIONARIES = { en, zh };

// src/styles.css
var styles_default = '/* Native Harness surfaces only. All palette references were queried from Client Theme. */\n.sb-dsh {\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.5;\n  box-sizing: border-box;\n  text-align: start;\n}\n.sb-dsh *, .sb-dsh *::before, .sb-dsh *::after { box-sizing: border-box; }\n.sb-dsh button, .sb-dsh input, .sb-dsh select { font: inherit; }\n.sb-dsh button { cursor: pointer; }\n.sb-dsh button:disabled { cursor: default; opacity: .55; }\n.sb-dsh button:focus-visible, .sb-dsh input:focus-visible, .sb-dsh select:focus-visible,\n.sb-dsh summary:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 2px;\n}\n.sb-dsh .sb-dsh-muted { color: var(--dsw-alias-label-secondary); }\n.sb-dsh .sb-dsh-error { color: var(--dsw-alias-state-error-primary); }\n.sb-dsh .sb-dsh-warn { color: var(--dsw-alias-state-warn-primary); }\n.sb-dsh .sb-dsh-success { color: var(--dsw-alias-state-success-primary); }\n.sb-dsh .sb-dsh-brand { color: var(--dsw-alias-brand-primary); }\n.sb-dsh .sb-dsh-idle { color: var(--dsw-alias-state-idle-primary); }\n.sb-dsh-button, .sb-dsh-icon-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  min-height: 30px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 8px;\n  padding: 4px 10px;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-1);\n  text-decoration: none;\n  text-align: center;\n  flex: none;\n}\n.sb-dsh-button:not(:disabled):hover, .sb-dsh-icon-button:not(:disabled):hover {\n  background: var(--dsw-alias-bg-layer-2);\n  border-color: var(--dsw-alias-border-l2);\n}\n.sb-dsh-button-primary {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n.sb-dsh-button-small { min-height: 26px; padding: 2px 9px; font-size: 12px; }\n.sb-dsh-icon-button { width: 28px; min-height: 28px; padding: 2px; font-size: 19px; }\n.sb-dsh-link-button, .sb-dsh-row-button {\n  border: 0;\n  border-radius: 6px;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-base);\n  text-align: start;\n  padding: 5px 6px;\n  overflow-wrap: anywhere;\n}\n.sb-dsh-link-button { color: var(--dsw-alias-brand-primary); align-self: start; }\n.sb-dsh-link-button:hover, .sb-dsh-row-button:not(:disabled):hover { background: var(--dsw-alias-bg-layer-1); }\n.sb-dsh-row-button { display: flex; align-items: baseline; width: 100%; min-width: 0; }\n.sb-dsh-band-wrap { min-width: 0; padding: 3px 0; }\n.sb-dsh-band { display: flex; align-items: center; gap: 7px; min-width: 0; }\n.sb-dsh-dot { flex: none; font-size: 10px; line-height: 1; }\n.sb-dsh-band-text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.sb-dsh-band-wrap .sb-dsh-message { margin: 4px 0 2px; font-size: 12px; }\n.sb-dsh-pane {\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  overflow: auto;\n  padding: 14px 16px 20px;\n  background: var(--dsw-alias-bg-base);\n  scrollbar-gutter: stable;\n}\n.sb-dsh-pane-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }\n.sb-dsh-pane h1 { font-size: 15px; line-height: 1.4; font-weight: 600; margin: 0; }\n.sb-dsh-toolbar-actions { display: flex; align-items: center; gap: 6px; }\n.sb-dsh-overview { margin-bottom: 18px; }\n.sb-dsh-hero-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }\n.sb-dsh-hero { margin: 0; line-height: 1.4; min-width: 0; }\n.sb-dsh-count { font-size: 28px; font-weight: 650; font-variant-numeric: tabular-nums; }\n.sb-dsh-stale-count { font-size: 12px; }\n.sb-dsh-time { flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }\n.sb-dsh-counts { margin: 4px 0 0; font-size: 12px; }\n.sb-dsh-section { margin-top: 18px; }\n.sb-dsh-section h2 { color: var(--dsw-alias-label-secondary); font-size: 12px; font-weight: 600; margin: 0 0 6px; }\n.sb-dsh-wait-card { margin: 0; padding: 11px 0 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }\n.sb-dsh-wait-card:last-child { border-bottom: 0; }\n.sb-dsh-wait-meta { display: flex; align-items: baseline; flex-wrap: wrap; column-gap: 6px; row-gap: 2px; font-size: 12px; }\n.sb-dsh-chip { font-weight: 600; }\n.sb-dsh-session-name { min-width: 0; overflow-wrap: anywhere; }\n.sb-dsh-ask { font-weight: 600; margin: 6px 0; overflow-wrap: anywhere; white-space: pre-wrap; }\n.sb-dsh-why { margin: 0 0 8px; overflow-wrap: anywhere; white-space: pre-wrap; }\n.sb-dsh-project { padding: 6px 0; }\n.sb-dsh-project-heading { display: block; }\n.sb-dsh-project-note { margin: 2px 6px 4px 18px; overflow-wrap: anywhere; white-space: pre-wrap; }\n.sb-dsh-lines { padding-inline-start: 12px; }\n.sb-dsh-line { gap: 6px; }\n.sb-dsh-line-dot { width: 12px; flex: none; text-align: center; }\n.sb-dsh-single-list { padding-top: 5px; }\n.sb-dsh-message { margin: 10px 0; overflow-wrap: anywhere; white-space: pre-wrap; }\n.sb-dsh-footer-action { margin-top: 14px; }\n.sb-dsh-model-state { font-size: 11px; margin: 16px 0 8px; }\n.sb-dsh-settings, .sb-dsh-diagnostics { border-top: 1px solid var(--dsw-alias-border-l1); margin-top: 14px; padding-top: 10px; }\n.sb-dsh-settings summary, .sb-dsh-diagnostics summary { color: var(--dsw-alias-label-secondary); font-size: 12px; cursor: pointer; width: fit-content; border-radius: 4px; }\n.sb-dsh-settings form { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }\n.sb-dsh-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }\n.sb-dsh-field input, .sb-dsh-field select {\n  width: 100%;\n  min-width: 0;\n  min-height: 32px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 7px;\n  padding: 5px 8px;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-1);\n}\n.sb-dsh-field input:disabled, .sb-dsh-field select:disabled { opacity: .6; }\n.sb-dsh-field-hint { margin: -5px 0 0; font-size: 11px; }\n.sb-dsh-switch-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; }\n.sb-dsh-switch { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 5px; padding: 3px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); }\n.sb-dsh-switch-track { display: inline-flex; align-items: center; width: 30px; height: 18px; padding: 2px; border-radius: 12px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); }\n.sb-dsh-switch-track > span { width: 12px; height: 12px; border-radius: 50%; background: var(--dsw-alias-label-secondary); }\n.sb-dsh-switch[aria-checked="true"] .sb-dsh-switch-track { justify-content: flex-end; border-color: var(--dsw-alias-brand-primary); }\n.sb-dsh-switch[aria-checked="true"] .sb-dsh-switch-track > span { background: var(--dsw-alias-brand-primary); }\n.sb-dsh-settings-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; }\n.sb-dsh-diagnostics { font-size: 11px; color: var(--dsw-alias-label-secondary); }\n.sb-dsh-diagnostics p { margin: 8px 0; }\n.sb-dsh-diagnostics ul { padding-inline-start: 18px; overflow-wrap: anywhere; }\n.sb-dsh-diagnostics li { margin: 4px 0; }\n.sb-dsh-attribution { color: var(--dsw-alias-label-secondary); margin: 18px 0 0; font-size: 10px; }\n@media (max-width: 420px) {\n  .sb-dsh-pane { padding: 12px; }\n  .sb-dsh-stale-count { display: block; }\n  .sb-dsh-band { gap: 5px; }\n}\n@media (pointer: coarse) {\n  .sb-dsh-button, .sb-dsh-icon-button, .sb-dsh-row-button, .sb-dsh-switch { min-height: 36px; }\n  .sb-dsh-field input, .sb-dsh-field select { font-size: 16px; }\n}\n';

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PACKAGE_ID = "@lumir_kumou/switchboard-dsh";
var PANE_KIND = "switchboard";
var POLL_MS = 5e3;
var RPC_TIMEOUT_MS = 45e3;
var RESTING_ROWS = 6;
var messageOf = (error, fallback) => {
  if (error instanceof Error) return error.message.slice(0, 300) || fallback;
  if (typeof error === "string") return error.slice(0, 300) || fallback;
  if (error && typeof error === "object") {
    const record = error;
    for (const key of ["reason", "message", "code"]) {
      if (typeof record[key] === "string" && record[key]) return record[key].slice(0, 300);
    }
  }
  return fallback;
};
var isSnapshot = (value) => {
  if (!value || typeof value !== "object") return false;
  const s = value;
  if (typeof s.eligible !== "boolean" || s.lang !== "en" && s.lang !== "zh" || typeof s.demo !== "boolean" || typeof s.note !== "string" || typeof s.openRevision !== "number" || !s.config || !s.counters || !s.jumpTargets || !Array.isArray(s.diagnostics)) return false;
  if (s.facts !== null && (!s.facts || !Array.isArray(s.facts.sessions))) return false;
  if (s.board !== null && (!s.board || !["waiting", "stale", "projects", "running", "resting", "errors"].every((key) => Array.isArray(s.board[key])))) return false;
  return true;
};
var SessionBoardStore = class {
  constructor(sessionId, env) {
    this.sessionId = sessionId;
    this.env = env;
    this.locale = env.locale();
  }
  state = {
    snapshot: null,
    refreshing: false,
    error: "",
    actionError: "",
    notice: "",
    busy: null
  };
  listeners = /* @__PURE__ */ new Set();
  timer;
  readController;
  actionController;
  readPromise;
  refs = 0;
  disposed = false;
  locale;
  autoOpened = false;
  openRevision;
  localOpen = false;
  getSnapshot = () => this.state;
  subscribe = (listener) => {
    if (this.disposed) return () => {
    };
    const subscription = () => listener();
    this.listeners.add(subscription);
    this.refs++;
    if (this.refs === 1) void this.refresh();
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(subscription);
      this.refs--;
      if (this.refs === 0) this.stop();
    };
  };
  publish(patch) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  copy(key) {
    return DSH_DICTIONARIES[this.state.snapshot?.lang ?? pickLang("auto", this.locale)][key];
  }
  setLocale(locale) {
    if (locale === this.locale || this.disposed) return;
    this.locale = locale;
    this.readController?.abort();
    if (this.refs > 0) {
      const previous = this.readPromise;
      if (previous) void previous.then(() => this.refresh());
      else void this.refresh();
    }
  }
  schedule() {
    if (this.refs === 0 || this.disposed || !this.env.selected(this.sessionId)) return;
    if (this.timer !== void 0) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = void 0;
      void this.refresh();
    }, POLL_MS);
  }
  accept(snapshot) {
    const commandOpen = this.openRevision === void 0 ? snapshot.openRevision > 0 : snapshot.openRevision > this.openRevision;
    this.openRevision = snapshot.openRevision;
    this.publish({ snapshot, error: "" });
    const current = snapshot.facts?.sessions.find((s) => s.id === this.sessionId);
    const eligible = snapshot.eligible && !(current?.cwd && isTemp(current.cwd));
    const automatic = snapshot.config.openPane === "auto" && !this.autoOpened;
    if (!eligible || !this.env.selected(this.sessionId) || this.localOpen || !commandOpen && !automatic) return;
    try {
      this.env.open(this.sessionId);
      this.autoOpened = true;
    } catch (error) {
      this.publish({ actionError: messageOf(error, this.copy("openFailed")) });
    }
  }
  refresh = () => {
    if (this.disposed || this.refs === 0 || !this.env.selected(this.sessionId)) return Promise.resolve();
    if (this.readPromise) return this.readPromise;
    if (this.timer !== void 0) clearTimeout(this.timer);
    this.timer = void 0;
    const controller = new AbortController();
    this.readController = controller;
    this.publish({ refreshing: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(this.copy("connectionFailed")));
    }, RPC_TIMEOUT_MS);
    const clearAbortTimeout = () => clearTimeout(timeout);
    controller.signal.addEventListener("abort", clearAbortTimeout, { once: true });
    const promise = Promise.resolve().then(async () => {
      try {
        const result = await this.env.rpc("snapshot", { sessionId: this.sessionId, locale: this.locale }, controller.signal);
        if (controller.signal.aborted || this.disposed || this.refs === 0) return;
        if (!result.ok) throw new Error(messageOf(result.error, this.copy("connectionFailed")));
        if (!isSnapshot(result.value)) throw new Error(this.copy("invalidResponse"));
        this.accept(result.value);
      } catch (error) {
        if (!this.disposed && this.refs > 0 && (!controller.signal.aborted || timedOut)) {
          this.publish({ error: messageOf(controller.signal.aborted ? controller.signal.reason : error, this.copy("connectionFailed")) });
        }
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", clearAbortTimeout);
        if (this.readController === controller) this.readController = void 0;
        if (this.readPromise === promise) this.readPromise = void 0;
        this.publish({ refreshing: false });
        this.schedule();
      }
    });
    this.readPromise = promise;
    return promise;
  };
  async reloadAfterAction() {
    const previous = this.readPromise;
    if (previous) {
      this.readController?.abort();
      await previous;
    }
    await this.refresh();
  }
  act = async (action, patch) => {
    if (this.disposed || this.refs === 0) return false;
    if (this.state.busy) {
      this.publish({ actionError: this.copy("busy") });
      return false;
    }
    const controller = new AbortController();
    this.actionController = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(this.copy("connectionFailed")));
    }, RPC_TIMEOUT_MS);
    const clearAbortTimeout = () => clearTimeout(timeout);
    controller.signal.addEventListener("abort", clearAbortTimeout, { once: true });
    this.publish({ busy: action, actionError: "", notice: "" });
    try {
      const result = await this.env.rpc("act", {
        sessionId: this.sessionId,
        locale: this.locale,
        action,
        ...patch ? { patch } : {}
      }, controller.signal);
      if (controller.signal.aborted || this.disposed) return false;
      if (!result.ok) throw new Error(messageOf(result.error, this.copy("actionFailed")));
      const value = result.value;
      if (!value || value.ok !== true) throw new Error(messageOf(value?.reason, this.copy("actionFailed")));
      clearTimeout(timeout);
      if (action !== "focus") await this.reloadAfterAction();
      return !controller.signal.aborted && !this.disposed;
    } catch (error) {
      if (!this.disposed && (!controller.signal.aborted || timedOut)) {
        this.publish({ actionError: messageOf(controller.signal.aborted ? controller.signal.reason : error, this.copy("actionFailed")) });
      }
      return false;
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", clearAbortTimeout);
      if (this.actionController === controller) {
        this.actionController = void 0;
        this.publish({ busy: null });
      }
    }
  };
  open = async (demo = false) => {
    const snapshot = this.state.snapshot;
    if (!snapshot?.eligible || !this.env.selected(this.sessionId)) return;
    this.localOpen = true;
    try {
      this.env.open(this.sessionId);
      this.autoOpened = true;
      await this.act(demo ? "demo" : "open");
    } catch (error) {
      this.publish({ actionError: messageOf(error, this.copy("openFailed")) });
    } finally {
      this.localOpen = false;
    }
  };
  jump = async (id) => {
    const snapshot = this.state.snapshot;
    if (!snapshot) return;
    const S = STRINGS[snapshot.lang];
    if (snapshot.demo) {
      this.publish({ notice: S.demoJump, actionError: "" });
      return;
    }
    const target = snapshot.jumpTargets[id];
    if (!target) {
      this.publish({ notice: S.cannotJump, actionError: "" });
      return;
    }
    if (!await this.act("focus", { id }) || !this.env.selected(this.sessionId)) return;
    try {
      this.env.navigate(target);
      this.publish({ notice: "" });
    } catch {
      this.publish({ notice: S.jumpFailed });
    }
  };
  stop() {
    if (this.timer !== void 0) clearTimeout(this.timer);
    this.timer = void 0;
    this.readController?.abort();
    this.actionController?.abort();
    this.localOpen = false;
    this.publish({ refreshing: false, busy: null });
  }
  dispose() {
    this.stop();
    this.disposed = true;
    this.listeners.clear();
  }
};
var ClientRuntime = class {
  locale;
  sidebar;
  localeSource;
  mountedSource;
  translate;
  stores = /* @__PURE__ */ new Map();
  env;
  constructor(ctx) {
    this.locale = ctx.get("locale");
    this.sidebar = ctx.get("sidebarRight");
    this.localeSource = {
      getSnapshot: () => this.locale.getSnapshot(),
      subscribe: (listener) => this.locale.subscribe(listener)
    };
    this.mountedSource = {
      getSnapshot: () => this.sidebar.mounted.getSnapshot(),
      subscribe: (listener) => this.sidebar.mounted.subscribe(listener)
    };
    this.translate = this.locale.bind(LOCALE_NAMESPACE);
    const connection = ctx.get("connection");
    const workspace = ctx.get("uiWorkspace");
    this.env = {
      rpc: (endpoint, payload, signal) => connection.rpc.call("/api", "switchboard-dsh", { method: endpoint, payload }, signal),
      locale: () => this.locale.getSnapshot().active,
      selected: (sessionId) => this.sidebar.mounted.getSnapshot() === sessionId,
      open: (sessionId) => {
        if (this.sidebar.mounted.getSnapshot() !== sessionId) throw new Error(this.translate("openFailed"));
        this.sidebar.openTab(PANE_KIND);
      },
      navigate: (target) => workspace.openSession(target)
    };
  }
  store(sessionId) {
    let store = this.stores.get(sessionId);
    if (!store) {
      store = new SessionBoardStore(sessionId, this.env);
      this.stores.set(sessionId, store);
    }
    return store;
  }
  copy(lang) {
    return (key) => pickLang("auto", this.locale.getSnapshot().active) === lang ? this.translate(key) : DSH_DICTIONARIES[lang][key];
  }
  dispose() {
    for (const store of this.stores.values()) store.dispose();
    this.stores.clear();
  }
};
var noSubscription = () => () => {
};
function useBoard(runtime, sessionId, enabled) {
  const locale = (0, import_react.useSyncExternalStore)(runtime.localeSource.subscribe, runtime.localeSource.getSnapshot);
  const mounted = (0, import_react.useSyncExternalStore)(runtime.mountedSource.subscribe, runtime.mountedSource.getSnapshot);
  const active = enabled && mounted === sessionId;
  const store = (0, import_react.useMemo)(() => runtime.store(sessionId), [runtime, sessionId]);
  const state = (0, import_react.useSyncExternalStore)(active ? store.subscribe : noSubscription, store.getSnapshot);
  (0, import_react.useEffect)(() => {
    if (active) store.setLocale(locale.active);
  }, [store, locale.active, active]);
  const lang = state.snapshot?.lang ?? pickLang("auto", locale.active);
  return { store, state, lang, S: STRINGS[lang], t: runtime.copy(lang) };
}
function bandSummary(board, sessionId, S) {
  const others = board.waiting.filter((w) => w.id !== sessionId);
  const stale = board.stale.filter((w) => w.id !== sessionId);
  const top = others[0];
  const what = top ? top.kind === "block" ? S.band.what.block : top.kind === "question" ? S.band.what.question : S.band.what.other : "";
  const nobody = others.length < board.waiting.length ? S.band.noneOthers : S.band.none;
  return {
    text: top ? S.band.waiting(others.length, top.name, what, top.waitMs) : `${nobody}${stale.length ? S.band.staleTail(stale.length) : ""} `,
    tone: top ? top.kind === "block" ? "error" : "warn" : stale.length ? "warn" : "success"
  };
}
var hhmm = (ms) => {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
function FailureNotice({ state, S }) {
  const notices = [state.snapshot?.note, state.notice].filter(Boolean);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    state.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-message sb-dsh-warn", role: "alert", children: S.refreshFailed(state.error) }) : null,
    state.actionError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-message sb-dsh-error", role: "alert", children: state.actionError }) : null,
    notices.map((notice, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-message sb-dsh-warn", role: "status", children: notice }, `${index}-${notice}`))
  ] });
}
function BoardBand({ sessionId, switchboardRuntime: runtime }) {
  const { store, state, S } = useBoard(runtime, sessionId, true);
  const snapshot = state.snapshot;
  if (!snapshot?.eligible) return null;
  const current = snapshot.facts?.sessions.find((s) => s.id === sessionId);
  if (current?.cwd && isTemp(current.cwd)) return null;
  const line = snapshot.board ? bandSummary(snapshot.board, sessionId, S) : { text: S.loading, tone: "idle" };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh sb-dsh-band-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: styles_default }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-band", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `sb-dsh-dot sb-dsh-${line.tone}`, "aria-hidden": "true", children: "\u25CF" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-band-text", title: line.text, children: line.text }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-button sb-dsh-button-small", type: "button", onClick: () => void store.open(), disabled: state.busy !== null, children: S.band.open })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FailureNotice, { state, S })
  ] });
}
function Section({ title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "sb-dsh-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title }),
    children
  ] });
}
function WaitCard({ item: w, S, jump, disabled }) {
  const when = w.isHere ? S.isHere : w.isLive ? S.waited(w.waitMs) : S.idleFor(w.waitMs);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "sb-dsh-wait-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-wait-meta", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `sb-dsh-chip sb-dsh-${w.kind === "block" ? "error" : "warn"}`, children: S.chip[w.kind] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-session-name", children: w.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "sb-dsh-muted", children: [
        "\xB7 ",
        when
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-ask", children: w.ask }),
    w.why ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-why", children: w.why }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: `sb-dsh-button${w.isLive ? " sb-dsh-button-primary" : ""}`, type: "button", onClick: () => jump(w.id), disabled, children: S.go[w.kind] })
  ] });
}
var DOTS = { wait: "!", run: "\u25CF", bg: "\u25D0", done: "\u2713", gone: "\u2713" };
var LINE_TONE = { wait: "error", run: "brand", bg: "brand", done: "success", gone: "idle" };
function LineRow({ line, jump, disabled }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "sb-dsh-row-button sb-dsh-line", type: "button", onClick: () => jump(line.id), disabled, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `sb-dsh-line-dot sb-dsh-${LINE_TONE[line.state]}`, "aria-hidden": "true", children: DOTS[line.state] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
      line.name,
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-muted", children: line.doing })
    ] })
  ] });
}
function ProjectBlock({ project: p, S, jump, disabled }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "sb-dsh-project", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "sb-dsh-row-button sb-dsh-project-heading", type: "button", onClick: () => jump(p.id), disabled, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: p.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "sb-dsh-muted", children: [
        " \xB7 ",
        S.delivered(p.done, p.lines.length)
      ] }),
      p.isParentWaiting ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "sb-dsh-error", children: [
        " \xB7 ",
        S.parentWaiting
      ] }) : null
    ] }),
    p.note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-project-note sb-dsh-muted", children: p.note }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sb-dsh-lines", children: p.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LineRow, { line, jump, disabled }, line.id)) })
  ] });
}
function SingleRow({ single: s, S, jump, disabled }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-row-button", type: "button", onClick: () => jump(s.id), disabled, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
    s.name,
    " ",
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-muted", children: s.doing }),
    s.isCloseable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "sb-dsh-success", children: [
      " \xB7 ",
      S.closeable
    ] }) : null
  ] }) });
}
function BoardView({ board: b, snapshot, state, store, S }) {
  const [more, setMore] = (0, import_react.useState)(false);
  const active = b.projects.filter((p) => p.isActive);
  const finished = b.projects.filter((p) => !p.isActive);
  const resting = more ? b.resting : b.resting.slice(0, RESTING_ROWS);
  const n = b.waiting.length + b.stale.length;
  const heroTone = n === 0 ? "success" : b.waiting.some((w) => w.kind === "block") ? "error" : b.waiting.length ? "warn" : "";
  const jump = (id) => {
    void store.jump(id);
  };
  const disabled = state.busy !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-overview", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-hero-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "sb-dsh-hero", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { className: `sb-dsh-count sb-dsh-${heroTone}`, children: n }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: S.heroTail }),
          b.stale.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-muted sb-dsh-stale-count", children: S.staleTail(b.stale.length) }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-time", children: snapshot.demo ? S.demoTag : hhmm(b.generatedAt) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-counts", children: S.counts(b.liveCount, b.units, b.linesRunning) })
    ] }),
    b.waiting.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: S.sections.waiting, children: b.waiting.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaitCard, { item: w, S, jump, disabled }, w.id)) }) : null,
    b.stale.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: S.sections.stale, children: b.stale.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaitCard, { item: w, S, jump, disabled }, w.id)) }) : null,
    active.length || b.running.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: S.sections.working, children: [
      active.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectBlock, { project: p, S, jump, disabled }, p.id)),
      b.running.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sb-dsh-single-list", children: b.running.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SingleRow, { single: s, S, jump, disabled }, s.id)) }) : null
    ] }) : null,
    finished.length || resting.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: S.sections.resting, children: [
      finished.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-row-button", type: "button", onClick: () => jump(p.id), disabled, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        p.name,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-muted", children: S.allDelivered(p.lines.length) })
      ] }) }, p.id)),
      resting.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SingleRow, { single: s, S, jump, disabled }, s.id))
    ] }) : null,
    b.resting.length > RESTING_ROWS ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-link-button", type: "button", "aria-expanded": more, onClick: () => setMore((value) => !value), children: more ? S.less : S.more(b.resting.length - RESTING_ROWS) }) : null,
    b.hiddenDormant ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-message", children: S.hidden(b.hiddenDormant) }) : null,
    b.errors.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-message sb-dsh-warn", role: "status", children: b.errors.slice(0, 2).map((e) => S.noTranscript(e.title)).join(" \xB7 ") }) : null,
    snapshot.config.footerCommand ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sb-dsh-footer-action", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-button", type: "button", disabled, onClick: () => void store.act("footer"), children: snapshot.config.footerLabel || `/${snapshot.config.footerCommand.replace(/^\//, "")}` }) }) : null
  ] });
}
function Settings({ snapshot, store, busy, t }) {
  const [draft, setDraft] = (0, import_react.useState)({ ...snapshot.config });
  const [dirty, setDirty] = (0, import_react.useState)(false);
  const dirtyRef = (0, import_react.useRef)(false);
  const [saved, setSaved] = (0, import_react.useState)(false);
  const prefix = (0, import_react.useId)();
  const configKey = JSON.stringify(snapshot.config);
  (0, import_react.useEffect)(() => {
    if (!dirtyRef.current) setDraft({ ...snapshot.config });
  }, [configKey]);
  const change = (key, value) => {
    dirtyRef.current = true;
    setDirty(true);
    setSaved(false);
    setDraft((previous) => ({ ...previous, [key]: value }));
  };
  const save = async () => {
    if (await store.act("configure", { ...draft })) {
      dirtyRef.current = false;
      setDirty(false);
      const refreshed = store.getSnapshot();
      if (!refreshed.error && refreshed.snapshot) setDraft({ ...refreshed.snapshot.config });
      setSaved(true);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "sb-dsh-settings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("settings") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-message", children: t("settingsHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (event) => {
      event.preventDefault();
      void save();
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-language`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("language") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${prefix}-language`, value: draft.language, disabled: busy, onChange: (event) => change("language", event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: t("languageAuto") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "en", children: t("languageEn") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "zh", children: t("languageZh") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-switch-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: `${prefix}-summaries`, children: t("summaries") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "sb-dsh-switch", type: "button", role: "switch", "aria-checked": draft.summaries, "aria-labelledby": `${prefix}-summaries`, "aria-describedby": `${prefix}-summaries-hint`, disabled: busy, onClick: () => change("summaries", !draft.summaries), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-switch-track", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(draft.summaries ? "on" : "off") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-field-hint", id: `${prefix}-summaries-hint`, children: t("summariesHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-mode`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("modelMode") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${prefix}-mode`, value: draft.modelMode, disabled: busy, onChange: (event) => change("modelMode", event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "off", children: t("modeOff") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "fake", children: t("modeFake") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "live", children: t("modeLive") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-provider`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("provider") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${prefix}-provider`, type: "text", autoComplete: "off", spellCheck: false, value: draft.provider, disabled: busy, onChange: (event) => change("provider", event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-model`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("model") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${prefix}-model`, type: "text", autoComplete: "off", spellCheck: false, value: draft.model, disabled: busy, onChange: (event) => change("model", event.target.value) })
      ] }),
      draft.modelMode === "live" && draft.summaries ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-message sb-dsh-warn", children: t("liveWarning") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-open`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("openPane") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${prefix}-open`, value: draft.openPane, disabled: busy, onChange: (event) => change("openPane", event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: t("openAuto") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "command", children: t("openCommand") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-footer`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("footerCommand") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${prefix}-footer`, type: "text", autoComplete: "off", spellCheck: false, value: draft.footerCommand, disabled: busy, onChange: (event) => change("footerCommand", event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "sb-dsh-field", htmlFor: `${prefix}-footer-label`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("footerLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${prefix}-footer-label`, type: "text", autoComplete: "off", value: draft.footerLabel, disabled: busy, onChange: (event) => change("footerLabel", event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-field-hint", children: t("footerHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-settings-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-button sb-dsh-button-primary", type: "submit", disabled: busy || !dirty, children: t(busy ? "saving" : "save") }),
        saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sb-dsh-success", role: "status", children: t("saved") }) : null
      ] })
    ] })
  ] });
}
function BoardPane({ sessionId, useTabInfo, switchboardRuntime: runtime }) {
  const info = useTabInfo();
  const { store, state, lang, S, t } = useBoard(runtime, sessionId, info.tab.visible);
  const snapshot = state.snapshot;
  const b = snapshot?.board;
  const empty = b && !b.waiting.length && !b.stale.length && !b.projects.length && !b.running.length && !b.resting.length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh sb-dsh-pane", lang, "aria-label": t("title"), "aria-busy": state.busy !== null || !snapshot && state.refreshing, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: styles_default }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-pane-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: t("title") }),
      snapshot?.eligible ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sb-dsh-toolbar-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-button sb-dsh-button-small", type: "button", disabled: state.busy !== null, onClick: () => void store.open(true), children: t(snapshot.demo ? "demoOff" : "demoOn") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "sb-dsh-icon-button", type: "button", title: t("refresh"), "aria-label": t("refresh"), disabled: state.refreshing || state.busy !== null, onClick: () => void store.refresh(), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u21BB" }) })
      ] }) : null
    ] }),
    !snapshot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-message", role: "status", children: S.loading }) : !snapshot.eligible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-message", children: t("unavailable") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      b ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoardView, { board: b, snapshot, state, store, S }, sessionId) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-message", role: "status", children: S.loading }),
      empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-message", children: t("empty") }) : null,
      !snapshot.config.summaries || snapshot.config.modelMode === "off" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-model-state", children: t("summaryOff") }) : snapshot.config.modelMode === "fake" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-muted sb-dsh-model-state", children: t("fakeMode") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { snapshot, store, busy: state.busy !== null, t }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "sb-dsh-diagnostics", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("diagnostics") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "sb-dsh-muted", children: [
          t("modelCalls"),
          ": ",
          snapshot.counters.modelCalls,
          " \xB7 ",
          t("cacheHits"),
          ": ",
          snapshot.counters.cacheHits
        ] }),
        snapshot.diagnostics.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: snapshot.diagnostics.map((diagnostic, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: diagnostic }, `${index}-${diagnostic}`)) }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FailureNotice, { state, S }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "sb-dsh-attribution", children: t("sourceNotice") })
  ] });
}
var inject = ["slots", "locale", "connection", "uiWorkspace", "sidebarRight", "sidebarRightTabs"];
function apply(ctx) {
  const slots = ctx.get("slots");
  const locale = ctx.get("locale");
  const tabs = ctx.get("sidebarRightTabs");
  ctx.effect(() => locale.register(LOCALE_NAMESPACE, DSH_DICTIONARIES), "switchboard: locale");
  const runtime = new ClientRuntime(ctx);
  ctx.effect(() => () => runtime.dispose(), "switchboard: polling lifetime");
  ctx.effect(() => tabs.register({
    id: PACKAGE_ID,
    kind: PANE_KIND,
    title: () => runtime.translate("title"),
    guide: [{ id: "switchboard", title: () => runtime.translate("title"), order: 30 }]
  }), "switchboard: native tab type");
  ctx.effect(() => slots.inject("sidebar.right.pane.tab", () => slots.register({
    name: "sidebar.right.pane.tab",
    key: PACKAGE_ID,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ switchboardRuntime: runtime })
  }, BoardPane)), "switchboard: native tab body");
  ctx.effect(() => slots.inject("conversation.input.dock", () => slots.register({
    name: "conversation.input.dock",
    id: PACKAGE_ID,
    order: 30,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ switchboardRuntime: runtime })
  }, BoardBand)), "switchboard: input band");
}
return module.exports;}});
