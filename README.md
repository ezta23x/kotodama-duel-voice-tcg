<div align="center">

# 言霊デュエル · 言灵对决

**纯前端、零构建依赖的中日双语全双工语音桌游卡牌对战原型**

[![Live Demo](https://img.shields.io/badge/Live_Demo-在线试玩-c99235?style=for-the-badge)](https://ezta23x.github.io/kotodama-duel-voice-tcg/)
[![Zero Build](https://img.shields.io/badge/Build-Zero_Dependencies-2b704c?style=for-the-badge)](#快速启动)
[![Languages](https://img.shields.io/badge/Bilingual-日本語_%2F_中文-5c3f27?style=for-the-badge)](#核心亮点)
[![Voice](https://img.shields.io/badge/Voice-Full--Duplex_%2B_AEC3-b8453a?style=for-the-badge)](#系统架构与二次开发)

[在线试玩](https://ezta23x.github.io/kotodama-duel-voice-tcg/) · [核心亮点](#核心亮点) · [30 秒上手玩法](#30-秒上手玩法) · [快速启动](#快速启动) · [界面一览](#界面一览) · [二次开发指南](#系统架构与二次开发)

<br />

![言灵对决主对战界面](docs/battle-ui.png)

</div>

---

## 简介

**言灵对决（言霊デュエル）** 是一款在浏览器中直接运行的 **26 张卡组、3 奖赏卡制** 回合制语音卡牌对战 Demo。  
玩家可以用 **日语或中文直接开口下达指令**（也支持文字输入与点击操作），系统以毫秒级本地规则解析优先、云端 LLM 兜底，由 **确定性本地引擎** 严格裁定所有战斗规则，并通过 **WebRTC AEC3 硬件回声消除 + 双声线纯日语 TTS（裁判 / 对手）** 实现可随时插话打断（Barge-in）的真实桌游语音对战体验。

> **立即体验**：打开 [https://ezta23x.github.io/kotodama-duel-voice-tcg/](https://ezta23x.github.io/kotodama-duel-voice-tcg/)（推荐使用 **Chrome / Edge** 并允许麦克风权限；不开麦克风也可全程点击或打字游玩）。

---

## 核心亮点

### 沉浸式语音与双语体验
- **全双工实时语音 + 插话打断（Barge-in）**：内置 WebRTC 本地回环将 TTS 音频接入浏览器硬件级 AEC3 回声消除，结合本地 VAD 检测，在裁判或对手播报时也能直接开口打断。
- **Local-First 双语意图识别**：同时支持日语与中文语音/文字指令，内置模糊匹配与 ASR 同音误识别词典；高频操作本地零延迟执行，复杂自然语言或连招交由云端 LLM 兜底；默认 15 秒无操作自动轻声提醒。
- **双声线纯日语播报 + 双语字幕**：裁判与对手拥有独立音色，所有对白、对局记录与战术建议均提供「日语原文 + 中文对照」。

### 桌游质感与多端适配
- **暖木羊皮纸立体 UI + 中日分轨字体**：全界面统一酒馆暖木与羊皮纸高光立体质感；基于 Google Fonts（`Noto Sans JP` / `Shippori Mincho` 与 `Noto Sans SC` / `Noto Serif SC`）实现中日严格分轨渲染，杜绝异体汉字混杂。
- **PC / 手机横屏 / 手机竖屏三端自适应**：
  - 手机端自动适配横屏与竖屏，顶栏提供「全画面（全屏）」切换按钮（手机切换 PC 模式后仍保留且尺寸对齐）。
  - 手机竖屏采用专属防压缩布局：**顶部紧凑奖赏/牌库条 + 全宽主战区 + 横向滑动大卡备战区 + 语音栏置顶紧贴手牌**，单手即可流畅读卡操作。
- **防误触与新手友好**：支持随时开关的新手浮动语音引导、备战区空位实时提示、双档 AI 难度（普通 / 困难），以及「再戦（重开）」与「ターン終了（结束回合）」双语防误触二次确认。

### 极简工程与数据解耦
- **单一数据源驱动**：全部卡牌、技能、牌组、台词、双语规则、LLM 提示词与 ASR 纠错表集中存放在 [`gamedata.json`](./gamedata.json)，支持页面内拖拽热更新。
- **零构建纯静态**：无打包器、无框架依赖，双击脚本本地运行或直接推送 GitHub Pages 即可上线。

---

## 30 秒上手玩法

| 规则维度 | 核心设定 |
| --- | --- |
| **胜利条件** | 双方各 26 张卡组、盖放 **3 张奖赏卡**，先拿满 3 张奖赏卡（或击倒对手场上全部怪兽）获胜 |
| **开局准备** | 起手 5 张（保底含怪兽与能量），自选 1 只怪兽作为首发上场，亮牌后抽 1 张正式开始 |
| **备战区规则** | 己方回合中，手牌有怪兽卡即可**不限次数直接放到备战区**（最多 3 只）；主战怪兽倒下时由备战区补位 |
| **属性克制** | **水克火 → 火克雷 → 雷克水**，命中弱点时伤害 **+20**（狙击对手备战区不计弱点） |
| **ex 王牌怪兽** | 双方各 2 张（`160~170 HP`、3 费高爆发或全后排溅射大招），可直接出场，但被击倒时对手一次拿走 **2 张奖赏卡** |
| **技能特性** | 8 只怪兽各具专属机制：过牌（`+1ドロー`）、重盾减伤（`被ダメ-30`）、备战狙击（`狙撃`）、全后排溅射（`後列10/20`）、自愈（`回復+20`）、狂暴反伤（`反動20`）与弃能爆发（`エネ-1`） |
| **每回合限次** | 贴能量 `1 次` · 支援者卡（补给包 / 召唤笛 / 力量徽章）合计 `1 次` · 撤退 `1 次`（普通弃 1 能、ex 弃 2 能）；普通道具（伤药 / 能量回收）不限次 |

### 常用语音 / 文字指令示例

| 你想做的操作 | 直接说日语 | 或直接说中文 |
| --- | --- | --- |
| 放怪兽到备战区 | 「ミズガメをベンチに出す」 | 「把水龟放到备战区」 |
| 贴能量 | 「炎エネルギーをヒノキツネに貼る」 | 「给炎狐贴火能量」 |
| 使用道具 / 支援者 | 「補給バッグを使う」 / 「きずぐすり」 | 「用补给包抽牌」 / 「给前排吃伤药」 |
| 发动技能攻击 | 「ヒノキツネでひのこ」 | 「用火花攻击」 / 「炎狐放炎弹」 |
| 防御 / 撤退 / 结束 | 「防御」 / 「交代」 / 「ターン終了」 | 「防御姿态」 / 「撤退换雷狮」 / 「结束回合」 |

---

## 快速启动

### 方式一：直接在线试玩（推荐）

访问 GitHub Pages 托管地址（HTTPS 环境原生支持麦克风与 WebRTC AEC3）：  
👉 **[https://ezta23x.github.io/kotodama-duel-voice-tcg/](https://ezta23x.github.io/kotodama-duel-voice-tcg/)**

### 方式二：本地一键运行

由于浏览器安全策略限制 `file://` 协议通过 `fetch()` 读取本地 JSON，推荐使用内置启动脚本（自动寻找可用端口，默认 `8080`，调用系统自带的 `python3` / `python` / `npx serve`）：

```bash
git clone https://github.com/ezta23x/kotodama-duel-voice-tcg.git
cd kotodama-duel-voice-tcg
```

| 平台 | 运行方式 |
| --- | --- |
| **macOS** | 双击 `start.command`（如提示权限不足，终端执行一次 `chmod +x start.command`） |
| **Linux** | 终端运行 `./start.command` 或 `bash start.command` |
| **Windows** | 双击 `start.bat` |

> **离线双击打开**：直接双击 `index.html` 时会弹出引导窗，选择同目录下的 `gamedata.json` 即可游玩（选择一次后会自动缓存在浏览器中）。

### 方式三：部署到你自己的 GitHub Pages

1. Fork 本仓库或将项目文件推送到你的 GitHub 仓库。
2. 进入仓库 **Settings → Pages**，在 **Build and deployment** 选择 **Deploy from a branch** → `main` 分支根目录 `/`。
3. 等待约 30–60 秒部署完成后，打开生成的 HTTPS 链接即可在电脑与手机端访问。

---

## 界面一览

### 1. 主对战牌桌分区

| 区域 | 说明 |
| --- | --- |
| **顶部工具栏** | 回合状态、全屏切换（手机端）、调试日志 `Log`、新手引导开关、重开对局（带二次确认）、图鉴、规则与设置 |
| **敌我双半场** | 奖赏卡进度、可点击查阅的牌库与弃牌堆、战斗区与 3 格备战区（显示 HP、属性弱点、能量珠与实时斩杀/威胁标） |
| **中线次数牌** | 实时追踪本回合 `贴能 1/1`、`支援 1/1`、`撤退 1/1` 使用状态 |
| **手牌与快捷操作** | 支持点击出战/入备战/贴能/用道具及拖拽排序；右侧提供「防御姿态（下回合受击 -30）」与「结束回合」 |
| **语音与对局手账** | 持续通话 / 单次录音 / 文本输入框、实时 AI 战术建议（Tips）、对手与裁判双语气泡及滚动对局记录 |

### 2. 设置与热更新面板

![接口与语音设置面板](docs/settings-ui.png)

点击右上角「設定（设置）」可分别配置 **LLM 指令解析（Gemini）**、**ASR 语音识别（默认SenseTime Nia / Gemini / Chrome）** 与 **TTS 语音合成（默认SenseTime Nia / Vertex Gemini / Chrome）**，切换语音模型时音色选择栏会自动联动为对应模型的可选音色；并支持调整无响应提醒秒数（默认 `15s`）、对手 AI 难度及拖放 `gamedata.json` 实现零代码热更新。

---

## 项目结构

```text
kotodama-duel-voice-tcg/
├── index.html       # 页面骨架、双语字体栈、暖木羊皮纸立体 UI 与三端响应式 CSS
├── app.js           # 9 大核心模块：DebugLog / GuideEngine / ConfigManager / SpecEngine /
│                    # VoiceEngine / NLUEngine / BattleEngine / TableUI / MobileViewportManager
├── gamedata.json    # 唯一游戏数据源（规则、牌组、怪兽/技能、道具、台词、Prompt、ASR 词典）
├── start.command    # macOS / Linux 本地静态服务一键启动脚本
├── start.bat        # Windows 本地静态服务一键启动脚本
├── docs/            # README 演示截图（battle-ui.png / settings-ui.png）
└── README.md        # 项目说明与二次开发文档
```

---

## 系统架构与二次开发

面向需要接入团队自研 **ASR / TTS / LLM** 或二次扩展卡池的研发同学，点击下方展开完整技术文档：

<details open>
<summary><strong>1. 系统架构与全链路数据流（Mermaid 流程图）</strong></summary>

```mermaid
flowchart TD
    A["玩家输入（语音 / 文本 / 点击）"] --> B["VoiceEngine（ASR / VAD / Barge-in）"]
    B --> C["BattleEngine.handleUserInput()"]
    C --> D{"NLUEngine.localParse()\n本地双语规则 & 模糊索引"}
    D -- "命中（毫秒级零延迟）" --> F["标准化 Result JSON\n(transcript / status / actions)"]
    D -- "未命中或纯音频" --> E["NLUEngine.parse()\n云端 LLM 意图解析兜底"]
    E --> F
    F --> G["BattleEngine\n确定性规则引擎 & AI 对手决策"]
    G --> H["TableUI.renderAll()\n牌桌动效 / 手牌 / 双语字幕"]
    G --> I["VoiceEngine.speak()\n双声线日语 TTS 经 WebRTC AEC3 输出"]
```

</details>

<details>
<summary><strong>2. 替换语音识别（ASR）、语音合成（TTS）与大模型（NLU / LLM）接口</strong></summary>

`app.js` 采用单文件 IIFE 模块化分区设计，对接自研服务只需替换以下入口：

#### ① 语音识别（ASR）
- **统一指令入口**：
  ```js
  BattleEngine.handleUserInput({
    text: "ヒノキツネでひのこ", // 识别文本（支持日语或中文）
    audioBase64: null,          // 可选：多模态模型直听音频时传入 Base64
    audioMime: "audio/webm",    // 可选：音频 MIME 类型
    fromVoice: true             // 标记来自语音输入
  });
  ```
- **核心替换点（`VoiceEngine`）**：
  - `startContinuousAsrCall()` / `stopCall()`：全双工持续通话启停。
  - `createNiaAsrSession()`：内置 WebSocket 16kHz PCM 流式 ASR 接入实现（默认接入 SenseTime Nia），收到 final transcript 后调用 `this.callCallback({ text, fromVoice: true })`。
  - `spawnContinuousRec()`：浏览器 Web Speech API 降级通道。
  - `toggleRecord()`：单次按键录音入口。
  - `startVadMonitor()`：本地 `AudioContext + AnalyserNode` 人声检测、650ms 预缓冲与插话打断（`stopPlayback()`）。

#### ② 语音合成（TTS）
- **统一播报入口**：`await VoiceEngine.speak(textJa, role)`（`role`: `"referee" | "rival"`）。
- **核心替换点（`VoiceEngine`）**：
  - `fetchNiaTtsAudioBuffer(text, role)` / `fetchTtsAudioBuffer(text, role)`：分别为 WebSocket 24kHz PCM（默认 SenseTime Nia）与 REST（Vertex Gemini）TTS 接入实现；替换为任意自研 TTS 并返回标准 Web Audio `AudioBuffer`，即可复用整套 `ensureAecOutput()` WebRTC AEC3 回声消除、LRU 缓存、预取与插话打断机制。
  - `speakChrome(text, role)`：浏览器本地 `speechSynthesis` 离线降级通道。

#### ③ 大模型 / 意图识别（NLU / LLM）
- **请求封装（`ConfigManager`）**：`buildRestUrl(model)`、`buildAuthHeaders()`（Gemini LLM），以及 `generateNiaJwt()`（HS256 JWT 签发）。
- **解析逻辑（`NLUEngine`）**：`localParse(...)`（本地规则 + 模糊索引）与 `parse(...)`（云端 Gemini 兜底，由 `SpecEngine.buildSystemPrompt()` 自动拼装 System Prompt）。
- **标准输出协议（支持单步或多步连招 `actions`）**：
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

#### ④ 视口与交互扩展
- `BattleEngine`：包含 `normal`（稳健常规）与 `hard`（整回合联合连招搜索 + 2 回合局势评估）两档 AI 决策引擎。
- `TableUI`：卡牌、特效标签、动效与双语提示渲染。
- `MobileViewportManager`：负责手机端（含手机切 PC 模式）识别与顶栏全屏切换按钮状态同步。

</details>

<details>
<summary><strong>3. <code>gamedata.json</code> 数据结构、参数化效果与热更新指南</strong></summary>

| 顶层字段 | 类型 | 说明 |
| --- | --- | --- |
| `schemaVersion` | `string` | 数据结构版本号（当前 `"2.0"`） |
| `rules` | `{ ja: string[], zh: string[] }` | 规则弹窗展示的双语条目（支持 `**加粗**`） |
| `decks` | `{ player: string[], enemy: string[] }` | 双方初始 26 张标准牌组 |
| `monsters` | `Monster[]` | 怪兽定义（`id`、`side`、`name_ja/zh`、`element`、`hp`、`is_ex`、`skills[]`、`aliases[]`） |
| `items` | `Item[]` | 能量 / 道具 / 支援者定义（`category`、`effect_type`、`desc_ja/zh`、`aliases[]`） |
| `rivalLines` | `Record<string, { ja, zh }[]>` | 按事件分组的对手台词池（自动轮换） |
| `promptInstructions` | `string` | 云端 NLU 系统指令模板 |
| `asrCorrections` | `{ standard, variants[], meaning }[]` | 日语同音误识别与中文别名纠错词典 |

#### 内置参数化效果（免改代码调数值）
在 `items[].effect_type` 或 `monsters[].skills[].effect` 中可直接组合或修改数字后缀：
- `heal_ally_30` / `heal_self_20` → 回复己方或自身指定数值 HP
- `draw_1` / `draw_2` → 发动技能或使用道具时抽指定张数卡牌
- `boost_20` → 本回合攻击增伤指定数值
- `guard_20` / `guard_30` → 发动后下回合受击减伤指定数值
- `bench_splash_10` / `bench_splash_20` → 攻击同时对对手全体备战怪兽造成溅射伤害
- `recoil_20` → 发动技能后自身承受指定数值反伤
- `discard_self_1` → 释放技能后弃置自身指定数量能量
- `switch_enemy_bench` → 强制将对手 1 只备战怪兽拉上战斗区
- `recover_energy` → 从弃牌区（空时从牌库）取回 1 张能量到手牌

#### 热更新方式
- **修改文件**：直接编辑 `gamedata.json` 并刷新页面（内置防缓存参数）。
- **页面内临时测试**：在「設定（设置）」底部拖入自定义 `gamedata.json` 立即生效；点击「初期値に戻す（恢复默认）」即可清除覆盖缓存。

</details>

<details>
<summary><strong>4. 调试日志、浏览器存储键与安全部署建议</strong></summary>

- **全链路调试日志**：点击顶栏 `Log` 打开调试抽屉，支持按 `ALL / ASR / NLU / TTS / AEC / ERR` 过滤，以及一键复制或导出 `log.json`（导出内容不含任何密钥）。
- **浏览器存储键**：
  - `localStorage["elemental_table_api_cfg_v13"]`：LLM / ASR / TTS 引擎、密钥、音色、无响应秒数（默认 `15`）、难度等用户配置
  - `localStorage["kotodama_duel_imported_gamedata_v2"]`：页面手动导入的 `gamedata.json` 覆盖缓存
- **公开发布安全提示**：当前演示版为方便开箱体验内置了默认测试密钥。如用于正式对外公开部署，建议将 `app.js` 中的默认 Key 置空，或将云端推理与语音鉴权改为经由后端代理转发，避免前端密钥被滥用。

</details>
