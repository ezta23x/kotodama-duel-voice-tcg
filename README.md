# 言灵对决（言霊デュエル）

一款纯前端、零构建依赖的 **日语 / 中文双语语音桌游卡牌对战原型**。  
玩家可通过全双工实时语音（支持日语或中文指令）、文字输入或鼠标点击，在 20 张卡组、3 奖赏卡制的回合制对决中与 AI 对手对战；系统提供纯日语裁判与对手双声线播报、WebRTC 回声消除（AEC3）与人声打断（Barge-in）、新手引导和全链路调试日志。
**在线试玩（GitHub Pages）**：[https://ezta23x.github.io/kotodama-duel-voice-tcg/](https://ezta23x.github.io/kotodama-duel-voice-tcg/)（建议使用 Chrome / Edge 并允许麦克风权限体验全双工语音对战）
---

## 一、核心特性

- **双语语音交互与确定性规则引擎**：支持日语与中文语音/文本输入，内置模糊匹配与 ASR 误识别纠错词典；高频操作走毫秒级本地解析，复杂自然语言回退至 LLM 意图解析，所有规则裁定（抽牌、贴能、支援者限次、撤退、克制、击倒与奖赏卡）完全由本地确定性引擎执行。
- **全双工语音通话 + AEC3 回声消除**：内置 WebRTC 本地回环将 TTS 播放流接入浏览器硬件级回声消除，支持玩家在播报过程中直接插话打断。
- **纯前端数据与代码解耦**：全部卡牌、技能、牌组、对手台词、双语规则、系统提示词与 ASR 纠错表集中存放在唯一的 `gamedata.json` 中，修改 JSON 后刷新页面或拖拽导入即可生效，无需重新编译。
- **零构建部署**：纯静态文件，支持本地一键启动或直接托管至 GitHub Pages / 任意静态服务器。

---

## 二、快速启动

### 1. 本地运行（推荐）

由于浏览器安全策略不允许 `file://` 协议直接通过 `fetch()` 自动加载本地 JSON，请使用目录内提供的一键启动脚本：

| 操作系统 | 启动方式 |
| --- | --- |
| **macOS** | 双击 `start.command`（首次运行若提示权限，可在终端执行一次 `chmod +x start.command`） |
| **Linux** | 在项目目录终端运行 `./start.command` 或 `bash start.command` |
| **Windows** | 双击 `start.bat` |

脚本会自动检测可用端口（默认 `8080`）并使用系统自带的 `python3` / `python` / `npx serve` 启动本地静态服务并打开浏览器。

> **直接双击 `index.html`**：如果直接通过 `file://` 打开页面，系统会弹出引导窗口，点击选择同目录的 `gamedata.json` 即可游玩（选择一次后会自动缓存在浏览器 `localStorage` 中）。

### 2. 在线部署（GitHub Pages）

1. 将整个项目目录推送至 GitHub 仓库。
2. 在仓库 `Settings` → `Pages` 中选择 `Deploy from a branch`（`main` 分支根目录 `/`）。
3. 部署完成后访问生成的 HTTPS 链接即可直接进行网页端测试（HTTPS 环境支持完整的麦克风与 WebRTC AEC3 能力）。

---

## 三、操作界面与功能分区

### 1. 主对战界面

![主对战界面](./docs/battle-ui.png)

主界面采用左侧桌游牌垫 + 右侧语音/对局面板的双栏布局，所有高频操作均可通过**语音指令、文字输入或鼠标点击**完成：

| 界面区域 | 核心功能说明 | 对应代码/DOM 入口 |
| --- | --- | --- |
| **顶部功能栏** | 显示当前回合数，提供调试日志（`Log`）、新手引导开关（ガイド）、重开对局（再戦）、卡牌图鉴（図鑑）、规则说明（ルール）与设置面板（設定） | `#btnToggleLog`、`#btnGuideMode`、`#btnResetMatch`、`#btnOpenCodex`、`#btnOpenRules`、`#btnOpenSettings` |
| **对手区（上半场）** | 展示对手奖赏卡（サイド）、牌库/弃牌堆（点击可查看明细）、备战区与战斗区怪兽（含 HP、属性弱点、已贴能量与技能发动状态） | `TableUI.renderAll()`、`#enemyBenchRow`、`#enemyActiveSlot` |
| **中线状态条** | 实时展示当前回合归属以及本回合「贴能量 / 支援者 / 撤退」剩余次数状态胶囊 | `.mat-divider`、`#turnBadge`、`#turnLimits` |
| **己方区（下半场）** | 展示己方战斗区与备战区怪兽、奖赏卡、牌库与弃牌堆；点击怪兽弹出技能攻击、撤退或防御操作菜单；开启引导模式时浮现不遮挡操作区的教学提示 | `TableUI.renderAll()`、`#playerActiveSlot`、`#playerBenchRow`、`#actionPopover` |
| **底部手牌区** | 横向展示当前手牌（自动按怪兽/道具/能量分类排序，支持点击使用与拖拽调序），右侧配有防御姿态与结束回合快捷按钮 | `#playerHand`、`#btnDefend`、`#btnEndTurn` |
| **右侧语音与记录栏** | 上方为双语语音字幕与滚动对局记录；下方集成全双工持续通话开关、单次录音按钮、文本指令输入框，以及实时 AI 战术建议（Tips / AI戦術） | `#btnLiveCall`、`#btnRecordVoice`、`#cmdInput`、`TableUI.renderLiveTip()` |

### 2. 接口与语音设置面板

![接口与语音设置面板](./docs/settings-ui.png)

点击右上角「設定（设置）」可打开配置弹窗（`#settingsModal`），支持：

- **模型与语音引擎切换**：配置 API 密钥、LLM/ASR 模型、TTS 合成模型，在云端 AI 语音与浏览器本地语音之间自由切换，并分别设置裁判与对手音色。
- **识别与难度选项**：选择 Gemini 音频直传或浏览器语音识别模式、无响应提醒秒数与对手 AI 难度（普通 / 困难），并可点击「音声テスト」即时试听双声线效果。
- **数据热更新**：底部拖放区（`#mdDropzone`）支持直接拖入自定义 `gamedata.json` 覆盖当前卡池与台词，点击「初期値に戻す」即可恢复默认配置。

---

## 四、文件结构

| 文件 | 职责说明 |
| --- | --- |
| `index.html` | 页面骨架、桌面视觉样式（CSS）与全部弹窗/抽屉 DOM 结构（无重复业务数据） |
| `app.js` | 核心运行时，包含 7 大模块：`DebugLog`、`ConfigManager`、`SpecEngine`、`VoiceEngine`、`NLUEngine`、`BattleEngine`、`TableUI` |
| `gamedata.json` | **唯一游戏数据源**：包含双语规则、双方 20 张标准牌组、怪兽/技能定义、道具/能量、对手台词、LLM 提示词、ASR 误识别词典 |
| `start.command` | macOS（双击）与 Linux（终端）共用的本地静态服务启动脚本 |
| `start.bat` | Windows（双击）本地静态服务启动脚本 |
| `docs/` | README 使用的界面演示截图（`battle-ui.png`、`settings-ui.png`） |
| `README.md` | 项目说明与跨团队二次开发接入文档 |

---

## 五、系统架构与数据流

```text
[玩家语音 / 文字 / 点击]
        │
        ▼
  VoiceEngine (ASR / VAD / Barge-in)
        │  { text, audioBase64, audioMime, fromVoice }
        ▼
  BattleEngine.handleUserInput()
        │
        ├──▶ NLUEngine.localParse()   ── 命中本地双语规则/模糊索引（零延迟 Local-First）
        │
        └──▶ NLUEngine.parse()        ── 未命中或纯音频时调用云端 LLM 兜底
        │
        ▼  标准化 Result JSON { transcript, status, actions: [{ type, card_id, skill_name, target }] }
  BattleEngine (确定性规则引擎 & AI 决策)
        │
        ├──▶ TableUI.renderAll()      ── 刷新桌面 UI、手牌、动画与双语字幕
        └──▶ VoiceEngine.speak()      ── 裁判 / 对手双声线日语 TTS 播报（经 AEC3 输出）
```

---

## 六、二次开发与语音组件替换指南（面向研发团队）

`app.js` 采用单文件 IIFE 模块化分区设计，各模块职责清晰。如需将内置的浏览器/云端语音与模型服务替换为团队自研组件（如自研 ASR、TTS、NLU 或私有网关），只需对接以下核心接口：

### 1. 替换语音识别（ASR）

- **唯一指令入口**：所有语音识别结果最终都通过以下方法进入游戏引擎：
  ```js
  BattleEngine.handleUserInput({
    text: "ヒノキツネでひのこ", // 识别文本（支持日语或中文）
    audioBase64: null,          // 可选：当交由多模态模型直接听音时传入 Base64 音频
    audioMime: "audio/webm",    // 可选：音频 MIME 类型
    fromVoice: true             // 标记来自语音输入
  });
  ```
- **需要替换的方法（位于 `VoiceEngine`）**：
  - `VoiceEngine.startContinuousAsrCall()` / `VoiceEngine.stopCall()`：控制全双工持续通话的启停。
  - `VoiceEngine.spawnContinuousRec()`：当前封装了 Web Speech API（`SpeechRecognition`）连续识别；替换为自研流式 ASR（如 WebSocket PCM 推流）时，在收到最终转写句（final transcript）后调用 `this.callCallback({ text, fromVoice: true })` 即可。
  - `VoiceEngine.toggleRecord()`：单次按键录音入口（当前录制音频并交由模型解析）。
  - `VoiceEngine.startVadMonitor()`：基于 `AudioContext` + `AnalyserNode` 的本地人声能量检测（VAD），负责在 TTS 播报期间触发打断（`stopPlayback()`）。若自研 ASR SDK 已内置 VAD/Barge-in，可直接在该处接入 SDK 的 `onSpeechStart` 回调。

### 2. 替换语音合成（TTS）

- **统一播报入口**：游戏内裁判（`role = "referee"`）与对手（`role = "rival"`）的所有语音均经由：
  ```js
  await VoiceEngine.speak(textJa, role); // role: "referee" | "rival"
  ```
- **需要替换的方法（位于 `VoiceEngine`）**：
  - `VoiceEngine.fetchTtsAudioBuffer(text, role)`：当前负责请求云端 TTS 并解码为 `AudioBuffer`。**推荐直接替换此方法**，向团队自研 TTS 服务发送 `text` 与 `role`（可映射到不同音色 ID），返回标准 Web Audio `AudioBuffer`（或 PCM/WAV/MP3 解码结果）。
  - `VoiceEngine.ensureAecOutput()`：负责将 `AudioBufferSourceNode` 通过 WebRTC 本地回环播放，使浏览器的硬件回声消除（AEC3）自动滤除扬声器播放的 TTS 声音。只要保留 `fetchTtsAudioBuffer()` 返回 `AudioBuffer`，即可无痛复用整套 AEC3、打断与播放队列机制。
  - `VoiceEngine.speakChrome(text, role)`：浏览器本地 `speechSynthesis` 降级通道，可按需保留作为断网兜底。

### 3. 替换大模型 / 意图识别（NLU / LLM）

- **请求封装（位于 `ConfigManager`）**：
  - `ConfigManager.buildRestUrl(model)`：组装推理接口 URL。
  - `ConfigManager.buildAuthHeaders()`：组装鉴权请求头（当前通过 `x-goog-api-key` 传递）。
- **解析逻辑（位于 `NLUEngine`）**：
  - `NLUEngine.localParse(text, boardSnapshot, conversationContext)`：本地确定性规则 + 双语别名/编辑距离模糊匹配器（数据自动读取自 `gamedata.json`）。
  - `NLUEngine.parse({ text, audioBase64, audioMime }, boardSnapshot, conversationContext)`：当本地未命中或收到纯音频时触发的云端 NLU 调用；`SpecEngine.buildSystemPrompt()` 会自动将 `gamedata.json` 中的提示词、卡表与误识别词典拼装为 System Prompt。
  - **输出协议**：只需确保云端模型返回以下 JSON 字段即可与 `BattleEngine` 无缝衔接（支持单步或多步连招队列 `actions`）：
    ```json
    {
      "transcript": "识别/修正后的玩家原始发话",
      "status": "execute | clarify | reject | confirm | chat | ignore",
      "actions": [
        {
          "type": "ATTACH_ENERGY | PLAY_BENCH | USE_ITEM | ATTACK | DEFEND | RETREAT | END_TURN | SURRENDER | INSPECT | CANCEL",
          "card_id": "手牌卡牌 ID 或 null",
          "skill_name": "技能日语名（如 ひのこ）或 null",
          "target": "player_active | player_bench_0..2 | enemy_active | enemy_bench_0..2 | null"
        }
      ],
      "reply_ja": "简短日语裁判回复",
      "reply_zh": "对应中文翻译",
      "rival_ja": "可选：对手互动回应（日语）",
      "rival_zh": "可选：对手互动回应（中文）"
    }
    ```

### 4. 界面与业务扩展

- **AI 对手策略**：位于 `BattleEngine` 中的敌方回合逻辑，支持 `normal` / `hard` 两档难度（可在设置或规则弹窗切换）。
- **视觉与动效**：全部样式集中在 `index.html` 顶部 `<style>` 中，卡牌渲染逻辑集中在 `app.js` 的 `TableUI` 模块。

---

## 七、`gamedata.json` 数据结构与扩展指南

`gamedata.json` 是游戏内全部静态配置的唯一数据源，顶层结构如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schemaVersion` | `string` | 数据结构版本号（当前为 `"2.0"`） |
| `rules` | `{ ja: string[], zh: string[] }` | 规则弹窗中展示的日文/中文条目（支持 `**加粗**` 语法） |
| `decks` | `{ player: string[], enemy: string[] }` | 双方初始 20 张标准牌组（填写 `monsters` / `items` 中的 `id`） |
| `monsters` | `Monster[]` | 怪兽卡表，包含 `id`、`side`（`player` / `opponent`）、`name_ja`、`name_zh`、`element`（`fire` / `water` / `thunder`）、`hp`、`is_ex`、`skills[]` 及可选 `aliases[]` |
| `items` | `Item[]` | 能量、道具与支援者卡表，包含 `id`、`category`（`energy` / `item` / `supporter`）、`name_ja`、`name_zh`、`element`、`effect_type`、`desc_ja`、`desc_zh` 及可选 `aliases[]` |
| `rivalLines` | `Record<string, { ja, zh }[]>` | 按事件键（如 `start`、`attack_hit`、`weakness`、`snipe`、`player_ko`、`enemy_ko` 等）分组的对手台词池，同一事件多条时自动轮换 |
| `promptInstructions` | `string` | 发送给云端 NLU 模型的系统指令模板 |
| `asrCorrections` | `{ standard, variants[], meaning }[]` | 日语同音误识别与中文别名纠错词典，启动时自动构建模糊识别索引 |

### 内置参数化效果（免改代码即可调数值）

在 `items[].effect_type` 或 `monsters[].skills[].effect` 中可直接调整数字后缀：

- `heal_ally_30` → 改为 `heal_ally_50` 即可回复 50 HP
- `draw_2` → 改为 `draw_3` 即可抽 3 张牌
- `boost_20` → 改为 `boost_30` 即可本回合增伤 +30
- `guard_20` → 改为 `guard_40` 即可下一次受击减伤 40
- `discard_self_1` → 释放技能后弃置自身 1 张能量（支持任意正整数后缀如 `discard_self_2`）
- `switch_enemy_bench` → 强制将对手 1 只备战怪兽拉上战斗区
- `recover_energy` → 从弃牌区（空时从牌库）取回 1 张能量到手牌

### 数据热更新方式

- **本地服务 / 线上托管**：直接修改 `gamedata.json` 并刷新页面即可生效（内置防缓存参数）。
- **页面内临时测试**：打开右上角「設定（设置）」，将自定义 `gamedata.json` 拖入导入框即可立即覆盖生效；点击「初期値に戻す（恢复默认）」即可清除本地覆盖缓存并重新加载同目录 `gamedata.json`。

---

## 八、调试与部署安全建议

- **全链路调试日志**：点击页面右上角 `Log` 按钮可打开调试抽屉，按 `ALL` / `ASR` / `NLU` / `TTS` / `AEC` / `ERR` 分类过滤，支持一键复制或导出 `log.json` 用于排查语音或规则问题。
- **本地存储键（`localStorage`）**：
  - `elemental_table_api_cfg_v12`：API Key、模型、语速/音色、难度等用户配置
  - `kotodama_duel_imported_gamedata_v2`：通过界面手动导入的 `gamedata.json` 覆盖缓存
- **公开发布安全提示**：当前演示版内置了默认测试 API Key 以便开箱体验。在发布至公开 GitHub 仓库或对外开放测试前，建议将 `app.js` 中的默认测试 Key 置空，或将云端 API 请求改为经由团队后端代理转发，避免前端密钥被滥用。
