/**
 * ============================================================================
 * 言霊デュエル（言灵对决）— 主程序逻辑
 * 模块结构：
 *   1. ConfigManager  ：Vertex API 密钥、模型与语音配置持久化
 *   2. SpecEngine     ：三级 MD 规则/卡牌数据热加载 + 卡牌/技能模糊匹配引擎
 *   3. VoiceEngine    ：全双工持续通话 + Vertex Gemini TTS / 浏览器语音降级
 *   4. NLUEngine      ：Vertex Gemini 中日语解析 + 追问记忆 + 本地解析
 *   5. BattleEngine   ：完整对战状态机、贴能解锁、奖赏抽牌与对手 AI
 *   6. TableUI        ：全屏牌桌渲染、双语换行日志与实时战术建议
 *   7. Init & Events  ：设置弹窗同步、外部 MD 导入与全局事件绑定
 * ============================================================================
 */
(() => {
  "use strict";

  /* ---------- 基础工具函数与全局常量 ---------- */
  const $ = (id) => document.getElementById(id);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const POS_JA = ["左", "中央", "右"];
  const POS_ZH = ["左", "中", "右"];
  const ELEM_ICON = { fire: "炎", water: "水", thunder: "雷", any: "★" };
  const SVG_ICONS = {
    fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>',
    water: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"/></svg>',
    thunder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v11h3v9l7-12h-4l4-8H7z"/></svg>',
    any: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>',
    item: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>',
    mic: '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
    stop: '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
    shield: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>',
    boost: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v11h3v9l7-12h-4l4-8H7z"/></svg>',
    sparkle: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>',
    swap: '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>',
    swapChip: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>',
    starChip: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>',
    log: '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
    guide: '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/><circle cx="12" cy="12" r="1.2"/></svg>',
    guideChip: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/><circle cx="12" cy="12" r="1.2"/></svg>',
    codex: '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2zm8 14H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z"/></svg>',
    snipe: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm0-13a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm0-4.5A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5z"/></svg>',
    check: '<svg class="btn-icon" style="color:#7ee09b;" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
  };
  const ELEM_COLOR = { fire: "var(--fire)", water: "var(--water)", thunder: "var(--thunder)" };
  const WEAKNESS_MAP = { fire: "water", water: "thunder", thunder: "fire" };
  const WEAKNESS_BONUS = 20;
  const TOTAL_PRIZES = 3;

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** 将「日文（中文）」双语标签安全拆分为带 lang="zh-CN" 的 HTML，确保中日文字体严格分轨 */
  function formatBilingualLabelHtml(str) {
    const raw = String(str == null ? "" : str);
    const m = raw.match(/^([\s\S]*?)（([^）]+)）([\s\S]*)$/);
    if (!m) return escapeHtml(raw);
    const inner = m[2];
    if (/[\u3040-\u30ff]/.test(inner)) return escapeHtml(raw);
    return `${escapeHtml(m[1])}<span class="zh-inline" lang="zh-CN">（${escapeHtml(inner)}）</span>${escapeHtml(m[3])}`;
  }

  /** 过滤云端模型偶发吐出的外部作品术语，确保界面与语音播报 100% 仅使用本作原创术语「モンスター（怪兽）」 */
  const _EXT_CARD_RE = new RegExp("\u30dd\u30b1\u30e2\u30f3\u30ab\u30fc\u30c9|\u30dd\u30b1\u30ab", "gi");
  const _EXT_MON_RE = new RegExp("\u30dd\u30b1\u30e2\u30f3|pok\u00e9?mon|p" + "tcg", "gi");
  const _EXT_ZH_RE = new RegExp("\u7cbe\u7075\u5b9d\u53ef\u68a6|\u53e3\u888b\u5996\u602a|\u5b9d\u53ef\u68a6", "g");
  function sanitizeBrandTerms(str) {
    return String(str == null ? "" : str)
      .replace(_EXT_CARD_RE, "言霊カード")
      .replace(_EXT_MON_RE, "モンスター")
      .replace(_EXT_ZH_RE, "怪兽");
  }

  /* 卡面简洁卡通插画（独立小头像框，不遮挡文字，保持高可读性） */
  const CARD_ART = {
    p_fox: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fde8e1"/><polygon points="8,18 11,6 19,14" fill="#e25b37"/><polygon points="32,18 29,6 21,14" fill="#e25b37"/><polygon points="10,16 12,9 16,14" fill="#fff0d9"/><polygon points="30,16 28,9 24,14" fill="#fff0d9"/><ellipse cx="20" cy="23" rx="12" ry="10" fill="#f06d42"/><path d="M11,25 Q20,33 29,25 Q24,34 20,34 Q16,34 11,25 Z" fill="#fff6ea"/><path d="M20,11 Q23,14 20,17 Q17,14 20,11 Z" fill="#ffd15c"/><circle cx="15.5" cy="22" r="2" fill="#272018"/><circle cx="24.5" cy="22" r="2" fill="#272018"/><circle cx="16.2" cy="21.3" r="0.7" fill="#fff"/><circle cx="25.2" cy="21.3" r="0.7" fill="#fff"/><polygon points="18.5,25 21.5,25 20,27" fill="#272018"/></svg>',
    p_turtle: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#e3f1fc"/><path d="M8,28 Q20,10 32,28 Z" fill="#3f8f7b"/><path d="M13,26 Q20,17 27,26" fill="none" stroke="#d8f0e8" stroke-width="1.8"/><circle cx="20" cy="21" r="9" fill="#5ba4dc"/><circle cx="16.5" cy="20" r="2" fill="#272018"/><circle cx="23.5" cy="20" r="2" fill="#272018"/><circle cx="17.1" cy="19.3" r="0.7" fill="#fff"/><circle cx="24.1" cy="19.3" r="0.7" fill="#fff"/><path d="M17,24 Q20,26.5 23,24" fill="none" stroke="#272018" stroke-width="1.6" stroke-linecap="round"/><path d="M31,11 Q34,15 31,17 Q28,15 31,11 Z" fill="#2c6da4"/></svg>',
    p_lion: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fcf2d4"/><polygon points="20,4 24,11 32,9 29,16 35,21 29,26 32,33 24,31 20,36 16,31 8,33 11,26 5,21 11,16 8,9 16,11" fill="#e0a419"/><circle cx="20" cy="21" r="9" fill="#ffe082"/><circle cx="16.5" cy="20" r="2" fill="#272018"/><circle cx="23.5" cy="20" r="2" fill="#272018"/><circle cx="17.1" cy="19.3" r="0.7" fill="#fff"/><circle cx="24.1" cy="19.3" r="0.7" fill="#fff"/><polygon points="18.2,23 21.8,23 20,25.2" fill="#9c5611"/><path d="M17.5,26.5 Q20,28.5 22.5,26.5" fill="none" stroke="#63380c" stroke-width="1.4" stroke-linecap="round"/></svg>',
    p_dragon_ex: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fde4cf"/><polygon points="7,14 13,5 17,15" fill="#c98d18"/><polygon points="33,14 27,5 23,15" fill="#c98d18"/><polygon points="5,24 12,18 11,29" fill="#d94f2b"/><polygon points="35,24 28,18 29,29" fill="#d94f2b"/><ellipse cx="20" cy="23" rx="11" ry="10" fill="#d94f2b"/><ellipse cx="20" cy="27" rx="7" ry="5" fill="#ffd56b"/><circle cx="15.5" cy="21" r="2.2" fill="#fff"/><circle cx="24.5" cy="21" r="2.2" fill="#fff"/><circle cx="15.8" cy="21" r="1.1" fill="#9e1c0e"/><circle cx="24.2" cy="21" r="1.1" fill="#9e1c0e"/><polygon points="16,28 17.5,31 19,28" fill="#fff"/><polygon points="21,28 22.5,31 24,28" fill="#fff"/></svg>',
    e_dog: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fbe5df"/><polygon points="9,17 8,7 17,13" fill="#5a3a31"/><polygon points="31,17 32,7 23,13" fill="#5a3a31"/><ellipse cx="20" cy="23" rx="11.5" ry="10" fill="#75473b"/><ellipse cx="20" cy="27" rx="7" ry="5" fill="#d96c47"/><path d="M13,18 L18,20" stroke="#ffb14a" stroke-width="2" stroke-linecap="round"/><path d="M27,18 L22,20" stroke="#ffb14a" stroke-width="2" stroke-linecap="round"/><circle cx="15.5" cy="21.5" r="1.9" fill="#fff"/><circle cx="24.5" cy="21.5" r="1.9" fill="#fff"/><circle cx="15.8" cy="21.5" r="1" fill="#c9472d"/><circle cx="24.2" cy="21.5" r="1" fill="#c9472d"/><polygon points="18,25 22,25 20,27.3" fill="#272018"/><polygon points="16,29 17.5,31.5 19,29" fill="#fff"/><polygon points="21,29 22.5,31.5 24,29" fill="#fff"/></svg>',
    e_fish: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#e2f2fb"/><polygon points="30,22 37,15 37,29" fill="#458ec4"/><ellipse cx="19" cy="22" rx="11" ry="9" fill="#5baee2"/><ellipse cx="19" cy="25" rx="8" ry="4.5" fill="#d8f1ff"/><circle cx="15" cy="20" r="2.4" fill="#fff"/><circle cx="14.6" cy="20" r="1.3" fill="#1d2c3a"/><circle cx="28" cy="10" r="3" fill="none" stroke="#3b82b8" stroke-width="1.6"/><circle cx="33" cy="7" r="1.8" fill="none" stroke="#3b82b8" stroke-width="1.4"/></svg>',
    e_bird: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fbf1d2"/><polygon points="16,12 20,4 23,11 27,6 26,14" fill="#e6a817"/><circle cx="20" cy="22" r="10" fill="#f5c93d"/><path d="M9,23 Q13,18 15,25" fill="#d49311"/><path d="M31,23 Q27,18 25,25" fill="#d49311"/><circle cx="16.2" cy="20.5" r="2" fill="#272018"/><circle cx="23.8" cy="20.5" r="2" fill="#272018"/><circle cx="16.8" cy="19.8" r="0.7" fill="#fff"/><circle cx="24.4" cy="19.8" r="0.7" fill="#fff"/><polygon points="17.5,23 22.5,23 20,27.5" fill="#e06b1f"/></svg>',
    e_shark_ex: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#d9eefc"/><polygon points="17,14 22,5 25,14" fill="#1f5b8f"/><ellipse cx="20" cy="23" rx="13" ry="9.5" fill="#2c6da4"/><ellipse cx="20" cy="27" rx="10" ry="5" fill="#edf7ff"/><circle cx="14.5" cy="21" r="2.2" fill="#fff"/><circle cx="25.5" cy="21" r="2.2" fill="#fff"/><circle cx="14.8" cy="21" r="1.1" fill="#c98d18"/><circle cx="25.2" cy="21" r="1.1" fill="#c98d18"/><polygon points="14,27 16,30 18,27 20,30 22,27 24,30 26,27" fill="#fff" stroke="#1f5b8f" stroke-width="0.6"/></svg>',
    item_potion: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#e6f4ea"/><rect x="16" y="7" width="8" height="5" rx="1.5" fill="#8c6239"/><path d="M16,12 L24,12 L28,21 A9,9 0 1 1 12,21 Z" fill="#3f9e66"/><rect x="18.5" y="20" width="3" height="9" rx="1" fill="#fff"/><rect x="15.5" y="23" width="9" height="3" rx="1" fill="#fff"/></svg>',
    item_flute: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#f6eedb"/><path d="M9,29 L29,9 L33,13 L13,33 Z" fill="#c28e2b"/><circle cx="18" cy="22" r="1.5" fill="#4a331d"/><circle cx="22" cy="18" r="1.5" fill="#4a331d"/><circle cx="26" cy="14" r="1.5" fill="#4a331d"/><path d="M11,13 Q14,9 17,13" fill="none" stroke="#4e6e58" stroke-width="2" stroke-linecap="round"/></svg>',
    item_bag: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#eef5ec"/><path d="M15,14 Q20,7 25,14" fill="none" stroke="#6c4d2e" stroke-width="2.6" stroke-linecap="round"/><rect x="10" y="14" width="20" height="18" rx="5" fill="#5a8266"/><rect x="10" y="14" width="20" height="8" rx="4" fill="#466a51"/><rect x="18" y="20" width="4" height="4" rx="1" fill="#f5d07a"/></svg>',
    item_power: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fbf0dc"/><polygon points="20,6 24,14 33,15 26,21 28,31 20,26 12,31 14,21 7,15 16,14" fill="#d48c1d"/><polygon points="20,11 22,16 27,17 23,20 24,25 20,22 16,25 17,20 13,17 18,16" fill="#fff3c4"/></svg>',
    item_recycle: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#e8f4ee"/><path d="M20,9 A11,11 0 1 1 10,24" fill="none" stroke="#2e6b47" stroke-width="3" stroke-linecap="round"/><polygon points="20,5 25,10 18,13" fill="#2e6b47"/><polygon points="18,14 23,14 20,20 24,20 17,28 19,21 15,21" fill="#d48c1d"/></svg>'
  };

  const STORAGE_KEY_CFG  = "elemental_table_api_cfg_v12";
  const STORAGE_KEY_DATA = "kotodama_duel_imported_gamedata_v2";
  const STORAGE_KEY_MD   = "elemental_table_imported_md_v1";

  /** 文件内 XOR 混淆还原内置演示密钥（不在源码中保存明文，开箱即可体验在线语音） */
  function _decodeBuiltinKey() {
    const m = [75, 47, 115, 25, 93, 58, 97];
    const e = [10, 126, 93, 88, 63, 2, 51, 5, 25, 57, 109, 112, 119, 24, 25, 70, 68, 116, 27, 84, 39, 18, 68, 5, 77, 13, 115, 2, 6, 72, 33, 75, 101, 118, 17, 39, 121, 62, 117, 8, 64, 52, 19, 67, 54, 43, 41, 121, 89, 18, 90, 22, 88];
    return e.map((b, i) => String.fromCharCode(b ^ m[i % m.length])).join("");
  }

  /* Vertex AI 默认配置（LLM / ASR: gemini-3.5-flash-lite 极简思考，TTS: gemini-3.8-flash-lite-tts） */
  const DEFAULT_CONFIG = {
    apiKey: _decodeBuiltinKey(),
    llmModel: "gemini-3.5-flash-lite",
    ttsModel: "gemini-3.8-flash-lite-tts",
    asrMode: "gemini_audio",
    asrLang: "ja-JP",
    ttsEngine: "vertex_tts",
    voiceReferee: "Kore",
    voiceRival: "Fenrir",
    chromeVoiceURI: "",
    idlePromptSec: 15,
    aiDifficulty: "normal",
    autoSpeak: true,
    guideMode: true,
    kotodamaResonance: true
  };

  /* ---------- 内存级语音与 AI 链路调试日志（不落盘，支持实时查看与一键导出 log.json） ---------- */
  const DebugLog = {
    entries: [],
    filter: "ALL",
    isOpen: false,
    maxEntries: 200,

    formatTime(d) {
      const pad = (n, w = 2) => String(n).padStart(w, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
    },

    formatItemHtml(e) {
      return `
        <div class="dlog-item cat-${escapeHtml(e.cat)}">
          <div class="dlog-meta"><span>[${escapeHtml(e.cat)}]</span><span>${escapeHtml(e.time)}</span></div>
          <div class="dlog-msg">${escapeHtml(e.msg)}</div>
          ${e.detail ? `<div class="dlog-detail">${escapeHtml(e.detail)}</div>` : ""}
        </div>
      `;
    },

    add(cat, msg, detail = null) {
      const now = new Date();
      let rawDetail = detail == null ? null : (typeof detail === "string" ? detail : JSON.stringify(detail));
      if (rawDetail && rawDetail.length > 1000) rawDetail = rawDetail.slice(0, 1000) + "…(truncated)";
      const entry = {
        time: this.formatTime(now),
        iso: now.toISOString(),
        cat: String(cat || "SYS").toUpperCase(),
        msg: String(msg || ""),
        detail: rawDetail
      };
      this.entries.unshift(entry);
      if (this.entries.length > this.maxEntries) this.entries.pop();
      if (entry.cat === "ERR" && !this.isOpen) {
        const dot = $("logErrDot");
        if (dot) dot.classList.add("show");
      }
      if (this.isOpen) {
        const list = $("debugLogList");
        if (list && (this.filter === "ALL" || this.filter === entry.cat)) {
          if (list.querySelector(".dlog-empty")) list.innerHTML = "";
          list.insertAdjacentHTML("afterbegin", this.formatItemHtml(entry));
          while (list.children.length > this.maxEntries) list.lastElementChild?.remove();
        }
      }
    },

    setFilter(cat) {
      this.filter = cat || "ALL";
      const box = $("dlogFilters");
      if (box) {
        box.querySelectorAll(".dlog-chip").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-cat") === this.filter);
        });
      }
      this.render();
    },

    toggle(force) {
      this.isOpen = typeof force === "boolean" ? force : !this.isOpen;
      const drawer = $("debugLogDrawer");
      const btn = $("btnToggleLog");
      if (drawer) drawer.classList.toggle("open", this.isOpen);
      if (btn) btn.classList.toggle("log-on", this.isOpen);
      if (this.isOpen) {
        const dot = $("logErrDot");
        if (dot) dot.classList.remove("show");
        this.render();
      }
    },

    clear() {
      this.entries = [];
      const dot = $("logErrDot");
      if (dot) dot.classList.remove("show");
      this.render();
    },

    buildPayload() {
      const cfg = ConfigManager.data;
      return {
        exportedAt: new Date().toISOString(),
        config: {
          llmModel: cfg.llmModel,
          ttsModel: cfg.ttsModel,
          asrMode: cfg.asrMode,
          asrLang: cfg.asrLang,
          ttsEngine: cfg.ttsEngine,
          apiAsrBlocked: VoiceEngine.apiAsrBlocked,
          apiTtsBlocked: VoiceEngine.apiTtsBlocked
        },
        count: this.entries.length,
        logs: [...this.entries].reverse()
      };
    },

    async copy() {
      const text = JSON.stringify(this.buildPayload(), null, 2);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          TableUI.showToast("ログをコピーしました", "已复制 Log 到剪贴板");
          return;
        }
      } catch (_) {}
      TableUI.showToast("コピーに失敗しました（log.json出力をご利用ください）", "复制失败，请点击导出 log.json");
    },

    exportJson() {
      try {
        const text = JSON.stringify(this.buildPayload(), null, 2);
        const blob = new Blob([text], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        a.href = url;
        a.download = `kotodama_duel_log_${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        TableUI.showToast("log.json を出力しました", "已导出 log.json");
      } catch (_) {
        TableUI.showToast("ログの出力に失敗しました", "导出失败");
      }
    },

    render() {
      const list = $("debugLogList");
      if (!list) return;
      const rows = this.filter === "ALL" ? this.entries : this.entries.filter((e) => e.cat === this.filter);
      if (rows.length === 0) {
        list.innerHTML = '<div class="dlog-empty" style="text-align:center;color:var(--ink-sub);padding:18px 8px;">ログはまだありません<span class="zh-inline" lang="zh-CN">（暂无 Log）</span></div>';
        return;
      }
      list.innerHTML = rows.map((e) => this.formatItemHtml(e)).join("");
    }
  };

  /* ---------- 非阻塞首次操作引导引擎（浮动提示 + 可选语音，永不阻塞点击与发声） ---------- */
  const GuideEngine = {
    shown: new Set(),
    _hideTimer: null,
    _pendingTimer: null,
    _hideUntil: 0,

    isEnabled() {
      return Boolean(ConfigManager.data.guideMode);
    },

    reset() {
      this.shown.clear();
      this.hide(true);
    },

    syncButton() {
      const btn = $("btnGuideMode");
      if (!btn) return;
      const on = this.isEnabled();
      btn.classList.toggle("guide-on", on);
      btn.innerHTML = `${SVG_ICONS.guide}${on ? 'ガイド ON<span class="zh-inline" lang="zh-CN">（引导模式）</span>' : 'ガイド OFF<span class="zh-inline" lang="zh-CN">（引导已关）</span>'}`;
    },

    toggle() {
      const next = !this.isEnabled();
      ConfigManager.save({ guideMode: next });
      this.syncButton();
      if (!next) {
        this.hide();
        TableUI.showToast("ガイドモードをOFFにしました", "已关闭引导模式");
      } else {
        this.shown.clear();
        this._hideUntil = 0;
        TableUI.showToast("ガイドモードをONにしました", "已开启引导模式");
        if (BattleEngine.state?.phase === "setup") {
          this.trigger("setup_starter", true);
        }
      }
    },

    hide(immediate = false) {
      clearTimeout(this._hideTimer);
      clearTimeout(this._pendingTimer);
      const el = $("guideFloat");
      if (el && el.classList.contains("show")) {
        el.classList.remove("show");
        this._hideUntil = immediate ? 0 : Date.now() + 310;
      } else if (immediate) {
        this._hideUntil = 0;
      }
    },

    MESSAGES: {
      setup_starter: {
        tag: "ガイド① 先発選択（引导：选择首发）",
        ja: "手札の緑枠モンスターをクリックするか名前を言って、バトル場の最初の1体を選びましょう！",
        zh: "点击手牌中绿色边框的怪兽，或直接说出它的名字，派它作为战斗区首发上场！"
      },
      first_turn_energy: {
        tag: "ガイド② エネルギー添付（引导：贴能量）",
        ja: "1ターンに1回、手札のエネルギーをクリックしてバトル場に貼ると技が使えるようになります。",
        zh: "每回合可贴 1 次能量：点击手牌中的能量卡再点己方怪兽（或说「给前排贴能量」），即可解锁技能。"
      },
      first_skill_ready: {
        tag: "ガイド③ 技で攻撃（引导：发动技能）",
        ja: "緑色に光った技は発動可能です！技バーをクリックするか技名を言って攻撃しましょう。",
        zh: "亮起绿色的技能已经激活！直接点击该技能条，或说「攻击」/ 技能名即可出招（攻击后回合结束）。"
      },
      first_ex_card: {
        tag: "ガイド：exモンスター（引导：ex 王牌卡）",
        ja: "金枠のexモンスターは高HP・高火力！ただし倒されると相手にサイドを2枚取られます。",
        zh: "金框 ex 怪兽血厚伤害高，可直接出战或放备战区；但被击倒时对手会一次拿走 2 张奖赏卡。"
      },
      first_supporter: {
        tag: "ガイド：サポート（引导：支援者卡）",
        ja: "『サポート』マークのカード（補給バッグ・よびだし笛・パワーバッジ）は1ターンに合計1枚までです。",
        zh: "支援者卡（补给包/召唤笛/力量徽章）每回合合计只能使用 1 张。"
      },
      first_bench_play: {
        tag: "ガイド：ベンチ展開（引导：备战区）",
        ja: "手札のモンスターをクリックするとベンチに出せます。バトル場が倒れても控えがいれば続けられます！",
        zh: "点击手牌怪兽可放入备战区；战斗区怪兽倒下时若备战区有怪兽就能补位继续战斗。"
      }
    },

    _showCard(msg, speakVoice) {
      const box = $("guideFloat");
      if (box) {
        box.classList.remove("show");
        if ($("guideTag")) $("guideTag").innerHTML = `${SVG_ICONS.guideChip}${formatBilingualLabelHtml(msg.tag)}`;
        if ($("guideJa")) $("guideJa").textContent = msg.ja;
        if ($("guideZh")) $("guideZh").textContent = msg.zh;
        void box.offsetWidth;
        box.classList.add("show");
      }
      if (speakVoice && !VoiceEngine.isSpeaking) {
        VoiceEngine.speak(msg.ja, "referee");
      }
    },

    /** 触发指定步骤的首次非阻塞引导（旧引导完成撤回动画后再弹出新引导） */
    trigger(key, speakVoice = true) {
      if (!this.isEnabled() || this.shown.has(key)) return;
      const msg = this.MESSAGES[key];
      if (!msg) return;
      this.shown.add(key);
      const box = $("guideFloat");
      if (box && box.classList.contains("show")) {
        this.hide();
      }
      const waitMs = Math.max(0, this._hideUntil - Date.now());
      clearTimeout(this._pendingTimer);
      if (waitMs > 0) {
        this._pendingTimer = setTimeout(() => {
          if (this.isEnabled()) this._showCard(msg, speakVoice);
        }, waitMs + 30);
      } else {
        this._showCard(msg, speakVoice);
      }
    }
  };

  /* =========================================================================
     1. ConfigManager（Vertex API 接入层与本地持久化）
     ========================================================================= */
  const ConfigManager = {
    data: { ...DEFAULT_CONFIG },

    /** 白名单校验配置字段类型与合法枚举，防止旧版脏数据或注入污染 */
    sanitize(rawObj) {
      const src = (rawObj && typeof rawObj === "object") ? rawObj : {};
      const out = { ...DEFAULT_CONFIG };
      const VALID_ASR = new Set(["gemini_audio", "chrome_asr_llm", "chrome_local"]);
      const VALID_LANG = new Set(["ja-JP", "zh-CN"]);
      const VALID_TTS = new Set(["vertex_tts", "chrome_tts"]);
      const VALID_VOICES = new Set(["Zephyr", "Leda", "Kore", "Aoede", "Puck", "Charon", "Fenrir"]);
      const VALID_DIFF = new Set(["normal", "hard"]);
      if (typeof src.apiKey === "string") out.apiKey = src.apiKey.trim();
      if (typeof src.llmModel === "string" && src.llmModel.trim()) out.llmModel = src.llmModel.trim();
      if (typeof src.ttsModel === "string" && src.ttsModel.trim()) out.ttsModel = src.ttsModel.trim();
      if (VALID_ASR.has(src.asrMode)) out.asrMode = src.asrMode;
      if (VALID_LANG.has(src.asrLang)) out.asrLang = src.asrLang;
      if (VALID_TTS.has(src.ttsEngine)) out.ttsEngine = src.ttsEngine;
      if (VALID_VOICES.has(src.voiceReferee)) out.voiceReferee = src.voiceReferee;
      if (VALID_VOICES.has(src.voiceRival)) out.voiceRival = src.voiceRival;
      if (typeof src.chromeVoiceURI === "string") out.chromeVoiceURI = src.chromeVoiceURI;
      const sec = Number(src.idlePromptSec);
      if (Number.isFinite(sec) && sec >= 0 && sec <= 120) out.idlePromptSec = Math.round(sec);
      if (VALID_DIFF.has(src.aiDifficulty)) out.aiDifficulty = src.aiDifficulty;
      if (typeof src.autoSpeak === "boolean") out.autoSpeak = src.autoSpeak;
      if (typeof src.guideMode === "boolean") out.guideMode = src.guideMode;
      if (typeof src.kotodamaResonance === "boolean") out.kotodamaResonance = src.kotodamaResonance;
      if (/^gemini-2\.5-(flash|pro)/i.test(out.llmModel)) out.llmModel = DEFAULT_CONFIG.llmModel;
      return out;
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CFG);
        this.data = raw ? this.sanitize(JSON.parse(raw)) : { ...DEFAULT_CONFIG };
      } catch (e) {
        this.data = { ...DEFAULT_CONFIG };
      }
      return this.data;
    },

    save(partial) {
      this.data = this.sanitize({ ...this.data, ...partial });
      try { localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(this.data)); } catch (e) {}
    },

    reset() {
      try { localStorage.removeItem(STORAGE_KEY_CFG); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_DATA); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_MD); } catch (e) {}
      this.data = { ...DEFAULT_CONFIG };
    },

    /** 根据模型型号返回最低延迟思考配置 */
    buildThinkingConfig(model) {
      const m = String(model || "").toLowerCase();
      if (/2\.5/.test(m)) return { thinkingBudget: 0 };
      if (/3\.[156].*flash|gemini-3-flash/.test(m)) return { thinkingLevel: "MINIMAL" };
      if (/3\.[78]|gemini-4/.test(m)) return { thinkingLevel: "LOW" };
      return null;
    },

    /** 构建 Vertex generateContent 接口地址（密钥通过请求头 x-goog-api-key 传递，不暴露在 URL 中） */
    buildRestUrl(model) {
      const k = String(this.data.apiKey || "").trim();
      const m = encodeURIComponent(String(model || this.data.llmModel || "gemini-3.5-flash-lite").trim());
      if (!k) return "";
      return `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`;
    },

    /** 构建带密钥认证的请求头 */
    buildAuthHeaders() {
      const k = String(this.data.apiKey || "").trim();
      return k ? { "Content-Type": "application/json", "x-goog-api-key": k } : { "Content-Type": "application/json" };
    }
  };

  /* =========================================================================
     2. SpecEngine（gamedata.json 热加载 + 卡牌/技能/道具模糊识别索引）
     ========================================================================= */
  const SpecEngine = {
    rulesHtmlJa: [],
    rulesHtmlZh: [],
    promptInstructions: "",
    decks: null,
    monsters: [],
    items: [],
    rivalLines: {},
    asrCorrections: [],
    fuzzyIndex: { monsters: [], skills: [], items: [] },
    sourceLabel: "",

    stripHtmlTags(val) {
      return String(val == null ? "" : val).replace(/<[^>]*>/g, "").trim();
    },

    parseBulletHtml(raw) {
      const lines = Array.isArray(raw)
        ? raw.map((l) => String(l || "").trim())
        : String(raw || "").split(/\r?\n/).map((l) => l.trim().replace(/^-\s*/, ""));
      return lines
        .filter(Boolean)
        .map((line) => escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
    },

    normalizeSkillObj(s) {
      if (!s) return null;
      if (typeof s === "string") return this.parseSkill(s);
      const effectRaw = this.stripHtmlTags(s.effect || "none") || "none";
      const guardMatch = /^guard_(\d+)$/.exec(effectRaw);
      const discardMatch = /^discard_self_(\d+)$/.exec(effectRaw);
      const costArr = Array.isArray(s.cost)
        ? s.cost.map((c) => this.stripHtmlTags(c)).filter(Boolean)
        : String(s.cost || "").split(",").map((c) => c.trim()).filter(Boolean);
      const aliases = Array.isArray(s.aliases)
        ? s.aliases.map((a) => this.stripHtmlTags(a)).filter(Boolean)
        : [];
      return {
        name_ja: this.stripHtmlTags(s.name_ja || s.name || ""),
        name_zh: this.stripHtmlTags(s.name_zh || s.name_ja || s.name || ""),
        cost: costArr,
        damage: Number(s.damage) || 0,
        target: this.stripHtmlTags(s.target || "enemy_active") || "enemy_active",
        effect: effectRaw,
        guardVal: guardMatch ? Number(guardMatch[1]) : (Number(s.guardVal) || 0),
        discardSelfVal: discardMatch ? Number(discardMatch[1]) : (Number(s.discardSelfVal) || 0),
        aliases
      };
    },

    /** 解析并事务校验 gamedata.json，非法数据时拒绝覆写当前卡池 */
    parseJson(jsonInput, sourceLabel) {
      let data = null;
      try {
        data = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
      } catch (e) {
        DebugLog.add("ERR", `JSON 解析失败（${sourceLabel || "unknown"}）：${e.message || e}`);
        return false;
      }
      if (!data || typeof data !== "object") return false;

      const rawMonsters = (Array.isArray(data.monsters) ? data.monsters : []).map((row) => {
        const id = this.stripHtmlTags(row.id);
        const nameJa = this.stripHtmlTags(row.name_ja);
        const rawSkills = Array.isArray(row.skills)
          ? row.skills.map((s) => this.normalizeSkillObj(s)).filter(Boolean)
          : [this.parseSkill(row.skill1), this.parseSkill(row.skill2)].filter(Boolean);
        const aliases = Array.isArray(row.aliases)
          ? row.aliases.map((a) => this.stripHtmlTags(a)).filter(Boolean)
          : [];
        return {
          id,
          side: this.stripHtmlTags(row.side),
          name_ja: nameJa,
          name_zh: this.stripHtmlTags(row.name_zh || nameJa),
          element: this.stripHtmlTags(row.element || "fire"),
          hp: Number(row.hp) || 80,
          is_ex: typeof row.is_ex === "boolean" ? row.is_ex : (/_ex$/i.test(id) || /ex$/i.test(nameJa)),
          skills: rawSkills,
          aliases
        };
      });

      const rawItems = (Array.isArray(data.items) ? data.items : []).map((it) => {
        const effType = this.stripHtmlTags(it.effect_type || it.effect || "");
        const aliases = Array.isArray(it.aliases)
          ? it.aliases.map((a) => this.stripHtmlTags(a)).filter(Boolean)
          : [];
        return {
          id: this.stripHtmlTags(it.id),
          category: this.stripHtmlTags(it.category),
          name_ja: this.stripHtmlTags(it.name_ja),
          name_zh: this.stripHtmlTags(it.name_zh || it.name_ja),
          element: this.stripHtmlTags(it.element || ""),
          effect_type: effType,
          effect: effType,
          desc_ja: this.stripHtmlTags(it.desc_ja),
          desc_zh: this.stripHtmlTags(it.desc_zh || it.desc_ja),
          aliases
        };
      });

      const hasPlayerMon = rawMonsters.some((m) => m.side === "player" && m.skills.length > 0);
      const hasEnemyMon = rawMonsters.some((m) => (m.side === "opponent" || m.side === "enemy") && m.skills.length > 0);
      const itemIds = new Set(rawItems.map((it) => it.id));
      const monIds = new Set(rawMonsters.map((m) => m.id));
      const hasEnergies = itemIds.has("energy_fire") && itemIds.has("energy_water") && itemIds.has("energy_thunder");
      if (!hasPlayerMon || !hasEnemyMon || !hasEnergies) {
        DebugLog.add("ERR", `gamedata.json 校验失败（${sourceLabel || "unknown"}）：缺少必要怪兽或三色能量`);
        return false;
      }

      let parsedDecks = null;
      if (data.decks && Array.isArray(data.decks.player) && Array.isArray(data.decks.enemy)) {
        const pDeck = data.decks.player.map((id) => this.stripHtmlTags(id)).filter(Boolean);
        const eDeck = data.decks.enemy.map((id) => this.stripHtmlTags(id)).filter(Boolean);
        const unknownIds = [...pDeck, ...eDeck].filter((id) => !monIds.has(id) && !itemIds.has(id));
        if (unknownIds.length > 0) {
          DebugLog.add("ERR", `gamedata.json 卡组外键校验失败（${sourceLabel || "unknown"}）：存在未定义的卡牌 ID [${Array.from(new Set(unknownIds)).join(", ")}]`);
          return false;
        }
        if (pDeck.length > 0 && eDeck.length > 0) {
          parsedDecks = { player: pDeck, enemy: eDeck };
        }
      }

      this.sourceLabel = sourceLabel;
      this.rulesHtmlJa = this.parseBulletHtml(data.rules?.ja || []);
      this.rulesHtmlZh = this.parseBulletHtml(data.rules?.zh || []);
      this.promptInstructions = String(data.promptInstructions || "").trim();
      this.decks = parsedDecks;
      this.monsters = rawMonsters;
      this.items = rawItems;

      this.rivalLines = {};
      this.lastRivalIdx = {};
      if (data.rivalLines && typeof data.rivalLines === "object") {
        for (const [ev, lines] of Object.entries(data.rivalLines)) {
          if (!Array.isArray(lines)) continue;
          this.rivalLines[ev] = lines.map((l) => ({
            ja: this.stripHtmlTags(l.ja || l.line_ja || ""),
            zh: this.stripHtmlTags(l.zh || l.line_zh || "")
          })).filter((l) => l.ja || l.zh);
        }
      }

      this.asrCorrections = (Array.isArray(data.asrCorrections) ? data.asrCorrections : []).map((row) => ({
        standard: this.stripHtmlTags(row.standard),
        variants: Array.isArray(row.variants)
          ? row.variants.map((v) => this.stripHtmlTags(v)).filter(Boolean)
          : String(row.wrong_variants || "").split(/[,、]/).map((s) => s.trim()).filter(Boolean),
        meaning: this.stripHtmlTags(row.meaning || "")
      })).filter((r) => r.standard);

      this.buildFuzzyIndex();
      return true;
    },

    /** 统一数据入口：自动识别 gamedata.json（首选）或旧版 Markdown 规范格式 */
    parse(input, sourceLabel) {
      if (input && typeof input === "object") return this.parseJson(input, sourceLabel);
      const text = String(input || "");
      if (text.trim().startsWith("{")) return this.parseJson(text, sourceLabel);

      const rawMonsters = this.parseTable(text, "monsters").map((row) => ({
        ...row,
        hp: Number(row.hp) || 80,
        is_ex: /_ex$/i.test(row.id || "") || /ex$/i.test(row.name_ja || ""),
        skills: [this.parseSkill(row.skill1), this.parseSkill(row.skill2)].filter(Boolean)
      }));
      const rawItems = this.parseTable(text, "items");
      const hasPlayerMon = rawMonsters.some((m) => m.side === "player" && m.skills.length > 0);
      const hasEnemyMon = rawMonsters.some((m) => (m.side === "opponent" || m.side === "enemy") && m.skills.length > 0);
      const itemIds = new Set(rawItems.map((it) => it.id));
      const hasEnergies = itemIds.has("energy_fire") && itemIds.has("energy_water") && itemIds.has("energy_thunder");
      if (!hasPlayerMon || !hasEnemyMon || !hasEnergies) {
        DebugLog.add("ERR", `规范数据校验失败（${sourceLabel || "unknown"}）：缺少必要怪兽或三色能量表`);
        return false;
      }

      this.sourceLabel = sourceLabel;
      const jaRaw = this.extractSection(text, "rules_modal_ja");
      const zhRaw = this.extractSection(text, "rules_modal_zh");
      if (jaRaw || zhRaw) {
        this.rulesHtmlJa = this.parseBulletHtml(jaRaw);
        this.rulesHtmlZh = this.parseBulletHtml(zhRaw);
      } else {
        this.rulesHtmlJa = this.parseBulletHtml(this.extractSection(text, "rules_modal"));
        this.rulesHtmlZh = [];
      }

      this.promptInstructions = this.extractSection(text, "prompt_instructions");
      this.decks = null;
      this.monsters = rawMonsters;
      this.items = rawItems;

      this.rivalLines = {};
      this.lastRivalIdx = {};
      for (const row of this.parseTable(text, "rival_lines")) {
        if (row.event) {
          if (!this.rivalLines[row.event]) this.rivalLines[row.event] = [];
          this.rivalLines[row.event].push({ ja: row.line_ja || "", zh: row.line_zh || "" });
        }
      }

      this.asrCorrections = this.parseTable(text, "asr_corrections").map((row) => ({
        standard: row.standard,
        variants: (row.wrong_variants || "").split(/[,、]/).map((s) => s.trim()).filter(Boolean),
        meaning: row.meaning || ""
      }));

      this.buildFuzzyIndex();
      return true;
    },

    extractSection(md, name) {
      const re = new RegExp(`<!--\\s*@section:${name}\\s*-->([\\s\\S]*?)<!--\\s*@endsection\\s*-->`);
      const m = md.match(re);
      return m ? m[1].trim() : "";
    },

    parseTable(md, name) {
      const re = new RegExp(`<!--\\s*@table:${name}\\s*-->([\\s\\S]*?)<!--\\s*@endtable\\s*-->`);
      const m = md.match(re);
      if (!m) return [];
      const lines = m[1].trim().split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|"));
      if (lines.length < 3) return [];
      const splitRow = (line) => line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim().replace(/<[^>]*>/g, ""));
      const headers = splitRow(lines[0]);
      const rows = [];
      for (let i = 2; i < lines.length; i++) {
        const cols = splitRow(lines[i]);
        if (cols.length < headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = cols[idx]; });
        rows.push(obj);
      }
      return rows;
    },

    parseSkill(str) {
      if (!str) return null;
      const parts = str.split(/\s*[｜/]\s*/).map((s) => s.trim());
      const nameMatch = (parts[0] || "").match(/^(.+?)[（(](.+?)[）)]$/);
      const effectRaw = parts[4] || "none";
      const guardMatch = /^guard_(\d+)$/.exec(effectRaw);
      const discardMatch = /^discard_self_(\d+)$/.exec(effectRaw);
      return {
        name_ja: nameMatch ? nameMatch[1].trim() : parts[0],
        name_zh: nameMatch ? nameMatch[2].trim() : parts[0],
        cost: (parts[1] || "").split(",").map((s) => s.trim()).filter(Boolean),
        damage: Number(parts[2]) || 0,
        target: parts[3] || "enemy_active",
        effect: effectRaw,
        guardVal: guardMatch ? Number(guardMatch[1]) : 0,
        discardSelfVal: discardMatch ? Number(discardMatch[1]) : 0,
        aliases: []
      };
    },

    getMonster(id) { return this.monsters.find((m) => m.id === id) || null; },
    getItem(id) { return this.items.find((it) => it.id === id) || null; },
    /** 获取对手台词（同一事件配置多条时自动轮换，避免连续重复） */
    getRivalLine(eventKey) {
      const pool = this.rivalLines[eventKey];
      if (!pool || pool.length === 0) return { ja: "", zh: "" };
      if (pool.length === 1) return pool[0];
      const prev = this.lastRivalIdx ? this.lastRivalIdx[eventKey] : -1;
      let idx = Math.floor(Math.random() * pool.length);
      if (idx === prev) idx = (idx + 1) % pool.length;
      if (!this.lastRivalIdx) this.lastRivalIdx = {};
      this.lastRivalIdx[eventKey] = idx;
      return pool[idx];
    },

    /* ---------- 文本归一化与模糊匹配（片假名转平假名 + 别名字典 + 滑动窗口编辑距离） ---------- */
    normalizeText(str) {
      return String(str || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
        .replace(/[\s　「」『』（）()【】\[\]、，。.,！!？?・\-ー]/g, "");
    },

    levenshtein(a, b) {
      const m = a.length;
      const n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      let prev = new Array(n + 1);
      let curr = new Array(n + 1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
      }
      return prev[n];
    },

    fuzzyScore(inputNorm, aliasNorm) {
      if (!inputNorm || !aliasNorm) return 0;
      if (inputNorm.includes(aliasNorm)) return 1.0;
      const alen = aliasNorm.length;
      /* 2字及以下短词仅允许精确包含匹配，避免短音节过度误配 */
      if (alen <= 2 || inputNorm.length < Math.min(alen, 3)) return 0;
      if (inputNorm.length <= alen) {
        const d = this.levenshtein(inputNorm, aliasNorm);
        return Math.max(0, 1 - d / Math.max(inputNorm.length, alen));
      }
      let best = 0;
      const minW = alen <= 3 ? alen : Math.max(3, alen - 1);
      const maxW = Math.min(inputNorm.length, alen + 1);
      for (let w = minW; w <= maxW; w++) {
        for (let i = 0; i <= inputNorm.length - w; i++) {
          const sub = inputNorm.slice(i, i + w);
          const d = this.levenshtein(sub, aliasNorm);
          const score = 1 - d / Math.max(w, alen);
          if (score > best) best = score;
        }
      }
      return best;
    },

    collectAliasesFor(baseNames) {
      const set = new Set();
      const bases = baseNames.filter(Boolean);
      for (const b of bases) {
        const nb = this.normalizeText(b);
        if (nb) set.add(nb);
      }
      for (const entry of this.asrCorrections) {
        if (bases.includes(entry.standard)) {
          const ns = this.normalizeText(entry.standard);
          if (ns) set.add(ns);
          for (const v of entry.variants) {
            const nv = this.normalizeText(v);
            if (nv) set.add(nv);
          }
        }
      }
      return Array.from(set);
    },

    buildFuzzyIndex() {
      this.fuzzyIndex.monsters = this.monsters.map((m) => ({
        item: m,
        aliases: this.collectAliasesFor([m.name_ja, m.name_zh, ...(Array.isArray(m.aliases) ? m.aliases : [])])
      }));
      this.fuzzyIndex.skills = [];
      for (const m of this.monsters) {
        for (const sk of m.skills) {
          this.fuzzyIndex.skills.push({
            item: { ...sk, ownerId: m.id, ownerSide: m.side, ownerNameJa: m.name_ja },
            aliases: this.collectAliasesFor([sk.name_ja, sk.name_zh, ...(Array.isArray(sk.aliases) ? sk.aliases : [])])
          });
        }
      }
      this.fuzzyIndex.items = this.items.map((it) => ({
        item: it,
        aliases: this.collectAliasesFor([it.name_ja, it.name_zh, ...(Array.isArray(it.aliases) ? it.aliases : [])])
      }));
      this.buildTypoMatcher();
    },

    buildTypoMatcher() {
      const builtinFixes = [
        ["防御", ["防禦", "防魚", "棒魚", "方魚", "ぼうぎょ"]],
        ["攻撃", ["公撃", "こうげき"]],
        ["交代", ["後退", "光帯", "こうたい"]],
        ["撤退", ["てったい"]],
        ["回復", ["かいふく"]],
        ["ミズガメ", ["水亀", "すいき"]],
        ["ライジシ", ["雷獅", "らいし"]],
        ["ヒノキツネ", ["炎狐", "えんこ"]],
        ["カエンリュウex", ["火龍ex", "かりゅう"]],
        ["タイカイザメex", ["滄海鯊", "たいかいざめ"]]
      ];
      const map = new Map();
      const addPair = (variant, standard) => {
        const v = String(variant || "").trim();
        const s = String(standard || "").trim();
        if (!v || !s) return;
        const key = v.toLowerCase();
        if (!map.has(key)) map.set(key, s);
      };
      // 先将所有标准词映射为自身，配合最长匹配单次扫描，防止「カエンリュウex / 炎龙ex」被短前缀重复替换成「exex」
      for (const entry of this.asrCorrections) {
        addPair(entry.standard, entry.standard);
      }
      for (const [std] of builtinFixes) {
        addPair(std, std);
      }
      for (const entry of this.asrCorrections) {
        for (const v of entry.variants) addPair(v, entry.standard);
      }
      for (const [std, vars] of builtinFixes) {
        for (const v of vars) addPair(v, std);
      }
      const tokens = Array.from(map.keys()).sort((a, b) => b.length - a.length);
      this._typoMap = map;
      this._typoRegex = tokens.length
        ? new RegExp(tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi")
        : null;
    },

    matchFromIndex(entries, rawText, minScore = 0.78) {
      const norm = this.normalizeText(this.applyLocalTypoFix(rawText));
      if (!norm) return null;
      let best = null;
      for (const entry of entries) {
        for (const alias of entry.aliases) {
          const score = this.fuzzyScore(norm, alias);
          if (score >= minScore && (!best || score > best.score || (score === best.score && alias.length > best.aliasLen))) {
            best = { item: entry.item, score, aliasLen: alias.length };
          }
        }
      }
      return best;
    },

    matchMonster(rawText, filterSide = null) {
      const list = filterSide
        ? this.fuzzyIndex.monsters.filter((e) => e.item.side === filterSide)
        : this.fuzzyIndex.monsters;
      const res = this.matchFromIndex(list, rawText, 0.78);
      return res ? res.item : null;
    },

    matchSkill(rawText, allowedSkills = null) {
      const list = allowedSkills
        ? this.fuzzyIndex.skills.filter((e) => allowedSkills.some((s) => s.name_ja === e.item.name_ja))
        : this.fuzzyIndex.skills;
      const res = this.matchFromIndex(list, rawText, 0.78);
      return res ? res.item : null;
    },

    matchItem(rawText) {
      const res = this.matchFromIndex(this.fuzzyIndex.items, rawText, 0.78);
      return res ? res.item : null;
    },

    /** 提取文本中可能匹配的卡牌/技能/道具候选，辅助 Gemini 精准纠偏 */
    extractFuzzyHints(rawText) {
      if (!rawText) return [];
      const hints = [];
      const mon = this.matchMonster(rawText);
      if (mon) hints.push(`モンスター候補:${mon.name_ja}(${mon.name_zh}/${mon.id})`);
      const sk = this.matchSkill(rawText);
      if (sk) hints.push(`技候補:${sk.name_ja}(${sk.name_zh})`);
      const it = this.matchItem(rawText);
      if (it) hints.push(`カード候補:${it.name_ja}(${it.name_zh}/${it.id})`);
      return hints;
    },

    applyLocalTypoFix(text) {
      const fixed = String(text || "");
      if (!fixed) return fixed;
      if (!this._typoRegex || !this._typoMap) this.buildTypoMatcher();
      if (!this._typoRegex) return fixed;
      return fixed.replace(this._typoRegex, (m) => this._typoMap.get(m.toLowerCase()) || m);
    },

    buildSystemPrompt() {
      const monsterDict = this.monsters.map((m) =>
        `- ${m.name_ja}(${m.name_zh}, id:${m.id}, ${m.side}, HP:${m.hp}): ` +
        m.skills.map((s) => `${s.name_ja}/${s.name_zh}[${s.cost.join("+")}→${s.damage}/${s.target}/${s.effect}]`).join(" / ")
      ).join("\n");
      const itemDict = this.items.map((it) =>
        `- ${it.name_ja}(${it.name_zh}, id:${it.id}, ${it.category}): ${it.desc_ja}`
      ).join("\n");
      const typoDict = this.asrCorrections.map((t) =>
        `- 「${t.variants.join("」「")}」→「${t.standard}」(${t.meaning})`
      ).join("\n");
      return `${this.promptInstructions}\n\n### カード一覧\n${monsterDict}\n${itemDict}\n\n### ASR誤認識辞書\n${typoDict}`;
    },

    /** 加载策略：1. 用户显式导入的本地缓存 → 2. 同目录 gamedata.json（单一数据源）；均失败时返回 false 由界面引导手动选择 */
    async loadThreeTier() {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_DATA);
        if (cached && this.parse(cached, "インポート済み gamedata.json")) return true;
      } catch (e) {}

      try {
        const res = await fetch("./gamedata.json?t=" + Date.now(), { cache: "no-store" });
        if (res.ok && this.parse(await res.text(), "外部ファイル ./gamedata.json")) return true;
      } catch (e) {}

      return false;
    }
  };

  /* =========================================================================
     3. VoiceEngine（全双工持续通话 + Vertex Gemini TTS / 浏览器语音降级）
     ========================================================================= */
  /* ---------- 轻量 Web Audio 交互与战斗音效（无需外部音频文件） ---------- */
  const SoundFX = {
    play(type, elem = "fire") {
      try {
        const sfxGuardMs = type === "tap" ? 0 : (type === "energy" || type === "heal" || type === "guard" || type === "switch" ? 140 : 260);
        if (sfxGuardMs > 0) {
          VoiceEngine.sfxPlayingUntil = Math.max(VoiceEngine.sfxPlayingUntil || 0, Date.now() + sfxGuardMs);
        }
        const ctx = VoiceEngine.getAudioCtx();
        const now = ctx.currentTime;
        const tone = (freqStart, freqEnd, dur, wave = "sine", gainPeak = 0.08, offset = 0) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(freqStart, now + offset);
          if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + offset + dur);
          gain.gain.setValueAtTime(0.0001, now + offset);
          gain.gain.linearRampToValueAtTime(gainPeak * 0.65, now + offset + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + dur + 0.02);
        };
        if (type === "tap") tone(520, 380, 0.06, "triangle", 0.05);
        else if (type === "energy") { tone(440, 660, 0.14, "sine", 0.07); tone(660, 880, 0.16, "triangle", 0.06, 0.08); }
        else if (type === "unlock") { tone(523, 659, 0.12, "triangle", 0.07); tone(659, 784, 0.12, "triangle", 0.07, 0.09); tone(784, 1046, 0.22, "sine", 0.08, 0.18); }
        else if (type === "attack") {
          if (elem === "thunder") { tone(920, 260, 0.16, "sawtooth", 0.06); tone(1280, 420, 0.12, "square", 0.04, 0.05); }
          else if (elem === "water") { tone(360, 620, 0.14, "sine", 0.07); tone(520, 280, 0.16, "triangle", 0.06, 0.07); }
          else { tone(260, 120, 0.2, "sawtooth", 0.07); tone(420, 180, 0.16, "triangle", 0.06, 0.04); }
        }
        else if (type === "hit") { tone(160, 52, 0.18, "sawtooth", 0.09); tone(110, 45, 0.2, "triangle", 0.08, 0.03); }
        else if (type === "heal") { tone(523, 659, 0.14, "sine", 0.07); tone(784, 1046, 0.22, "sine", 0.07, 0.1); }
        else if (type === "guard") { tone(680, 520, 0.14, "triangle", 0.07); tone(900, 720, 0.16, "sine", 0.05, 0.06); }
        else if (type === "switch") { tone(340, 580, 0.12, "triangle", 0.06); }
        else if (type === "ko") { tone(280, 70, 0.34, "sawtooth", 0.09); tone(180, 55, 0.36, "triangle", 0.08, 0.08); }
        else if (type === "win") { tone(523, 523, 0.12, "triangle", 0.07); tone(659, 659, 0.12, "triangle", 0.07, 0.12); tone(784, 1046, 0.28, "sine", 0.09, 0.24); }
        else if (type === "lose") { tone(392, 330, 0.18, "triangle", 0.07); tone(330, 220, 0.32, "sine", 0.07, 0.18); }
      } catch (_) {}
    }
  };

  const VoiceEngine = {
    audioCtx: null,
    aecDest: null,
    aecAudioEl: null,
    aecPc1: null,
    aecPc2: null,
    aecInitPromise: null,
    activeSources: [],
    audioCache: new Map(),
    inflightCache: new Map(),
    isSpeaking: false,
    sfxPlayingUntil: 0,
    chromeResumeTimer: null,
    speakToken: 0,
    speakQueue: [],
    isDrainingQueue: false,
    _drainId: 0,
    speakLock: Promise.resolve(),
    recentSpoken: [],
    lastSpeakEndAt: 0,
    apiTtsBlocked: false,
    apiTtsBlockReason: "",
    apiAsrBlocked: false,
    apiAsrBlockReason: "",

    /* 持续通话与监听状态（单流 VAD 全双工监听 + 浏览器 ASR 降级） */
    callActive: false,
    callMode: "vad",
    callMicStream: null,
    callRec: null,
    callCallback: null,
    vadSource: null,
    vadAnalyser: null,
    vadProcessor: null,
    vadZeroGain: null,
    vadPreRoll: [],
    vadCaptureChunks: [],
    vadCapturing: false,
    vadTimer: null,
    vadRecorder: null,
    vadSpeechStart: 0,
    vadLastLoud: 0,
    vadPeakRms: 0,
    recRunning: false,
    recStarting: false,
    recRetryDelay: 300,
    recRestartTimer: null,
    recWatchdogTimer: null,
    chromeUtterBuf: "",
    chromeUtterTimer: null,
    resumeCallAfterRecord: false,

    /* 单次录音状态 */
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    chromeRec: null,

    getAudioCtx() {
      if (!this.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        /* 使用系统原生采样率，避免 Firefox/Safari 将硬件麦克风接入自定义采样率 AudioContext 时报 NotSupportedError */
        this.audioCtx = new Ctx();
      }
      if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
      return this.audioCtx;
    },

    /** 仅清理尚未开播的积压队列（不打断当前正在播报或加载中的语音） */
    clearQueuedOnly(keepHigh = true) {
      if (!Array.isArray(this.speakQueue) || this.speakQueue.length === 0) return;
      const kept = [];
      for (const item of this.speakQueue) {
        if (keepHigh && item.priority === "high") {
          kept.push(item);
        } else {
          try { if (item.resolve) item.resolve(); } catch (_) {}
        }
      }
      this.speakQueue = kept;
      this.pendingSpeakCount = (this.isSpeaking ? 1 : 0) + this.speakQueue.length;
    },

    /** 立即中断所有正在播放或排队中的语音（仅用于玩家插话打断、重开对局、手动试听等强中断场景） */
    stopPlayback() {
      this.speakToken += 1;
      this._drainId = (this._drainId || 0) + 1;
      this.isSpeaking = false;
      this.isDrainingQueue = false;
      while (this.speakQueue.length) {
        const item = this.speakQueue.shift();
        try { if (item && item.resolve) item.resolve(); } catch (_) {}
      }
      this.pendingSpeakCount = 0;
      this.speakLock = Promise.resolve();
      if (window.speechSynthesis) {
        try { speechSynthesis.cancel(); } catch (_) {}
      }
      while (this.activeSources.length) {
        const entry = this.activeSources.pop();
        try {
          if (entry && entry.src) {
            entry.src.onended = null;
            entry.src.stop();
          }
        } catch (_) {}
        try { if (entry && entry.resolve) entry.resolve(); } catch (_) {}
      }
      if (this.callActive) {
        this.updateCallButtonUI("持续监听中，点击挂断", "聴取中（监听）");
        if (this.callMode === "chrome_asr") {
          clearTimeout(this.chromeResumeTimer);
          this.chromeResumeTimer = setTimeout(() => {
            if (this.callActive && this.callMode === "chrome_asr" && !this.isSpeaking) {
              this.spawnContinuousRec();
            }
          }, 350);
        }
      }
    },

    stopAll() {
      this.stopPlayback();
      if (this.callActive) this.stopCall(true);
    },

    setVoiceStatus(msg, zhHint = "") {
      const el = $("voiceEngineStatus");
      if (!el) return;
      el.innerHTML = zhHint
        ? `${escapeHtml(msg)}<span class="zh-inline" lang="zh-CN">（${escapeHtml(zhHint)}）</span>`
        : escapeHtml(msg);
    },

    setCallBadge(text, isLive = false) {
      const el = $("callStateBadge");
      if (!el) return;
      el.innerHTML = formatBilingualLabelHtml(text);
      el.classList.toggle("live", isLive);
    },

    populateChromeVoices() {
      const sel = $("chromeVoiceSelect");
      if (!sel) return;
      const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : [])
        .filter((v) => /^ja/i.test(v.lang));
      const cur = ConfigManager.data.chromeVoiceURI;
      sel.innerHTML = `<option value="">自動選択（自动选择日语发音人，共 ${voices.length} 个）</option>`;
      voices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.voiceURI === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    },

    /** 提取纯日语部分用于 TTS 播报，跳过中文并将 +20/-30/HP分数等规范化为明确数值读法（防止误读成百分比） */
    extractJapaneseOnly(text) {
      let s = String(text || "").trim();
      if (!s) return "";
      s = s.split(/\s*[｜|]\s*|\s+／\s+|\s+\/\s+/)[0].trim();
      s = s.replace(/[（(]([^（）()]+)[）)]/g, (full, inner) => {
        if (/[\u3040-\u30ff0-9０-９\-+＋]/.test(inner)) return full;
        return "";
      });
      /* 播报读法规范化：把易被 TTS 误读为百分比或分数的符号转为自然日语数值表达 */
      s = s
        .replace(/HP\s*(\d+)\s*\/\s*(\d+)/gi, "エイチピー$1、最大$2")
        .replace(/HP\s*(\d+)/gi, "エイチピー$1")
        .replace(/(?:攻撃ダメージ|ダメージ|攻撃)\s*[+＋]\s*(\d+)/g, "攻撃ダメージが$1アップ")
        .replace(/弱点\s*[+＋]\s*(\d+)/g, "弱点で$1ダメージ追加")
        .replace(/(?:被ダメ|被ダメージ|受けるダメージ)\s*[-−ー]\s*(\d+)/g, "受けるダメージを$1軽減")
        .replace(/防御\s*[-−ー]\s*(\d+)/g, "防御でダメージを$1軽減")
        .replace(/[+＋]\s*(\d+)/g, "プラス$1ポイント")
        .replace(/[-−]\s*(\d+)/g, "マイナス$1ポイント");
      s = s.replace(/\s+/g, " ").trim();
      if (!s) return "";
      const hasKana = /[\u3040-\u30ff]/.test(s);
      if (!hasKana && !/^(勝利|敗北|降参|攻撃|防御|交代|再戦)[！!…？?。]*$/.test(s)) return "";
      return s;
    },

    async decodeApiAudioToBuffer(ctx, base64) {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return await ctx.decodeAudioData(bytes.buffer.slice(0));
      }
      const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);
      return buf;
    },

    speakChrome(text, role = "referee", token = this.speakToken) {
      return new Promise((resolve) => {
        if (!window.speechSynthesis || !text || token !== this.speakToken) return resolve();
        let done = false;
        let guardTimer = null;
        const entry = { src: null, resolve: null };
        const finish = () => {
          if (done) return;
          done = true;
          if (guardTimer) clearTimeout(guardTimer);
          const idx = this.activeSources.indexOf(entry);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          resolve();
        };
        entry.resolve = finish;
        this.activeSources.push(entry);
        guardTimer = setTimeout(finish, Math.max(4500, text.length * 320 + 2500));
        const startUtter = () => {
          if (done || token !== this.speakToken) return finish();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "ja-JP";
          u.rate = role === "rival" ? 1.07 : 1.08;
          u.pitch = role === "rival" ? 0.88 : 1.06;
          const voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
          if (ConfigManager.data.chromeVoiceURI) {
            const chosen = voices.find((v) => v.voiceURI === ConfigManager.data.chromeVoiceURI);
            if (chosen) u.voice = chosen;
          } else if (voices.length) {
            u.voice = voices[0];
          }
          u.onend = finish;
          u.onerror = finish;
          speechSynthesis.speak(u);
        };
        if (speechSynthesis.speaking || speechSynthesis.pending) {
          speechSynthesis.cancel();
          setTimeout(startUtter, 35);
        } else {
          startUtter();
        }
      });
    },

    /** 请求并解码 Vertex TTS 音频（带内存 LRU 缓存、并发去重与超时保护，支持提前预取） */
    async fetchTtsAudioBuffer(text, role = "referee") {
      const cfg = ConfigManager.data;
      const voiceName = role === "rival" ? cfg.voiceRival : cfg.voiceReferee;
      const model = (cfg.ttsModel || "gemini-3.8-flash-lite-tts").trim();
      const cacheKey = `${model}|${voiceName}|${text}`;
      if (this.audioCache.has(cacheKey)) return this.audioCache.get(cacheKey);
      if (this.inflightCache.has(cacheKey)) return await this.inflightCache.get(cacheKey);

      const url = ConfigManager.buildRestUrl(model);
      if (!url) throw new Error("APIキー未設定");

      const payload = {
        contents: [{
          role: "user",
          parts: [{
            text,
            speechMetadata: { style: role === "rival" ? "energetic anime rival, Japanese" : "crisp, clear, brisk game referee announcer, natural pitch, Japanese" }
          }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { voice: voiceName } }
        }
      };

      const promise = (async () => {
        const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
        const fetchTimer = ac ? setTimeout(() => ac.abort(), 12000) : null;
        let res;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: ConfigManager.buildAuthHeaders(),
            body: JSON.stringify(payload),
            signal: ac ? ac.signal : undefined
          });
        } finally {
          if (fetchTimer) clearTimeout(fetchTimer);
        }
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const detail = errJson?.error?.message ? `: ${String(errJson.error.message).slice(0, 64)}` : "";
          const err = new Error(`HTTP ${res.status}${detail}`);
          err.status = res.status;
          throw err;
        }
        const data = await res.json();
        const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part) throw new Error("No audio");
        const ctx = this.getAudioCtx();
        const buf = await this.decodeApiAudioToBuffer(ctx, part.inlineData.data);
        if (this.audioCache.size >= 80) {
          const firstKey = this.audioCache.keys().next().value;
          this.audioCache.delete(firstKey);
        }
        this.audioCache.set(cacheKey, buf);
        return buf;
      })();

      this.inflightCache.set(cacheKey, promise);
      try {
        return await promise;
      } finally {
        this.inflightCache.delete(cacheKey);
      }
    },

    /** 后台预取下一句语音，消除裁判与对手台词之间的网络停顿 */
    prefetch(text, role = "rival") {
      const cfg = ConfigManager.data;
      const jaOnly = this.extractJapaneseOnly(text);
      if (!cfg.autoSpeak || !jaOnly || this.apiTtsBlocked || cfg.ttsEngine === "chrome_tts") return;
      if (!String(cfg.apiKey || "").trim()) return;
      this.fetchTtsAudioBuffer(jaOnly, role).catch(() => {});
    },

    /** 建立本地 WebRTC 回环音频播放通道，使 Chrome 内置 AEC3 能够将 TTS 输出作为回声消除参考信号 */
    async ensureAecOutput() {
      const ctx = this.getAudioCtx();
      if (this.aecDest) return this.aecDest;
      if (this.aecInitPromise) return await this.aecInitPromise;
      if (typeof ctx.createMediaStreamDestination !== "function" || typeof Audio === "undefined") {
        return ctx.destination;
      }
      this.aecInitPromise = (async () => {
        try {
          const dest = ctx.createMediaStreamDestination();
          if (typeof RTCPeerConnection !== "undefined") {
            const pc1 = new RTCPeerConnection();
            const pc2 = new RTCPeerConnection();
            const audioEl = new Audio();
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            pc1.onicecandidate = (e) => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {}); };
            pc2.onicecandidate = (e) => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {}); };
            let playOk = false;
            const trackReady = new Promise((resolve) => {
              const t = setTimeout(resolve, 1200);
              pc2.ontrack = async (ev) => {
                audioEl.srcObject = ev.streams[0];
                try { await audioEl.play(); playOk = true; } catch (_) { playOk = false; }
                clearTimeout(t);
                resolve();
              };
            });
            dest.stream.getTracks().forEach((tr) => pc1.addTrack(tr, dest.stream));
            const offer = await pc1.createOffer();
            await pc1.setLocalDescription(offer);
            await pc2.setRemoteDescription(offer);
            const answer = await pc2.createAnswer();
            await pc2.setLocalDescription(answer);
            await pc1.setRemoteDescription(answer);
            await trackReady;
            if (!playOk) {
              try { pc1.close(); pc2.close(); } catch (_) {}
              DebugLog.add("AEC", "浏览器阻止 <audio> 自动播放，自动回退默认音频输出");
              return ctx.destination;
            }
            this.aecPc1 = pc1;
            this.aecPc2 = pc2;
            this.aecAudioEl = audioEl;
            this.aecDest = dest;
            DebugLog.add("AEC", "WebRTC AEC3 回声消除参考通道已就绪");
            return dest;
          }
          const audioEl = new Audio();
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.srcObject = dest.stream;
          await audioEl.play();
          this.aecAudioEl = audioEl;
          this.aecDest = dest;
          DebugLog.add("AEC", "<audio> 播放通道已就绪");
          return dest;
        } catch (e) {
          DebugLog.add("AEC", "AEC 回环通道初始化失败，回退默认音频输出", e?.message || "");
          return ctx.destination;
        } finally {
          this.aecInitPromise = null;
        }
      })();
      return await this.aecInitPromise;
    },

    /** 通过 Vertex Gemini TTS 播放纯日语音频（走 AEC3 回声参考通道，优先命中缓存/预取） */
    async speakVertexTts(text, role = "referee", token = this.speakToken) {
      const t0 = Date.now();
      const cfg = ConfigManager.data;
      const cacheKey = `${(cfg.ttsModel || "gemini-3.8-flash-lite-tts").trim()}|${role === "rival" ? cfg.voiceRival : cfg.voiceReferee}|${text}`;
      const cached = this.audioCache.has(cacheKey);
      const buf = await this.fetchTtsAudioBuffer(text, role);
      if (token !== this.speakToken) return;
      DebugLog.add("TTS", `Vertex TTS (${role}, ${cached ? "缓存命中" : `${Date.now() - t0}ms`})`, text);
      const ctx = this.getAudioCtx();
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch (_) {} }
      if (token !== this.speakToken) return;
      const outNode = await this.ensureAecOutput();
      if (token !== this.speakToken) return;
      if (this.aecAudioEl && this.aecAudioEl.paused) { try { this.aecAudioEl.play().catch(() => {}); } catch (_) {} }
      await new Promise((resolve) => {
        let done = false;
        let guardTimer = null;
        const src = ctx.createBufferSource();
        const entry = { src, resolve: null };
        const finish = () => {
          if (done) return;
          done = true;
          if (guardTimer) clearTimeout(guardTimer);
          const idx = this.activeSources.indexOf(entry);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          resolve();
        };
        entry.resolve = finish;
        guardTimer = setTimeout(finish, Math.max(4000, Math.ceil((buf.duration || 3) * 1000) + 2500));
        src.buffer = buf;
        src.connect(outNode || ctx.destination);
        this.activeSources.push(entry);
        src.onended = finish;
        src.start();
      });
    },

    /** 记录最近播报的日语台词，用于在全双工收音时过滤或剥离扬声器残余回声 */
    recordSpoken(jaText) {
      const norm = SpecEngine.normalizeText(jaText);
      if (!norm) return;
      this.recentSpoken.push({ raw: String(jaText || ""), norm, at: Date.now() });
      if (this.recentSpoken.length > 6) this.recentSpoken.shift();
    },

    /** 若外放插话导致开头/结尾粘连了刚播报的 TTS 台词片段，自动剥离残余回声仅保留玩家真实指令 */
    stripSpokenEcho(transcript) {
      const raw = String(transcript || "").trim();
      if (!raw) return raw;
      const now = Date.now();
      if (!this.isSpeaking && now - this.lastSpeakEndAt > 3500) return raw;
      let cleaned = raw;
      for (let i = this.recentSpoken.length - 1; i >= 0; i--) {
        const entry = this.recentSpoken[i];
        if (now - entry.at > 12000) continue;
        const spk = entry.raw.replace(/[「」『』]/g, "").trim();
        if (spk.length < 4) continue;
        if (cleaned.startsWith(spk) && cleaned.length > spk.length) {
          cleaned = cleaned.slice(spk.length).replace(/^[、，。,.！!？?\s]+/, "").trim();
          continue;
        }
        /* 检测 TTS 尾部 4~18 字是否粘连在玩家话语开头 */
        const maxLen = Math.min(18, spk.length, cleaned.length - 1);
        for (let len = maxLen; len >= 4; len--) {
          const tail = spk.slice(-len);
          if (cleaned.startsWith(tail)) {
            cleaned = cleaned.slice(len).replace(/^[、，。,.！!？?\s]+/, "").trim();
            break;
          }
        }
      }
      if (cleaned !== raw && cleaned.length > 0) {
        DebugLog.add("AEC", "剥离残余 TTS 串音前缀", `原:「${raw}」 → 净:「${cleaned}」`);
      }
      return cleaned;
    },

    /** 判断语音转写文本是否与刚播报的裁判/对手语音高度重合（仅拦截长句回声，避免误杀短指令） */
    isLikelySelfEcho(transcript) {
      const now = Date.now();
      if (!this.isSpeaking && now - this.lastSpeakEndAt > 1400) return false;
      const tNorm = SpecEngine.normalizeText(transcript);
      if (tNorm.length < 4) return false;
      const isShortPlayerCmd = tNorm.length < 8 && (
        NLUEngine.hasExplicitDefendIntent(transcript)
        || NLUEngine.hasExplicitAttackIntent(transcript)
      );
      if (isShortPlayerCmd) return false;
      for (const entry of this.recentSpoken) {
        if (now - entry.at > 15000) continue;
        if (tNorm.length >= 8) {
          if (entry.norm.length >= 6 && tNorm.includes(entry.norm)) return true;
          if (entry.norm.includes(tNorm) && tNorm.length >= entry.norm.length * 0.45) return true;
          if (SpecEngine.fuzzyScore(entry.norm, tNorm) >= 0.85) return true;
        } else if (entry.norm.includes(tNorm) && now - this.lastSpeakEndAt <= 1400) {
          return true;
        }
      }
      return false;
    },

    /** 优先级防踩踏播报队列：不掐断正在播放的语音，自动折叠积压旧提示并并发预取下一句 */
    pendingSpeakCount: 0,

    speak(text, role = "referee", opts = {}) {
      const cfg = ConfigManager.data;
      const jaOnly = this.extractJapaneseOnly(text);
      if (!cfg.autoSpeak || !jaOnly) return Promise.resolve();

      const priority = opts.priority || "normal"; // "high" | "normal" | "low"
      if (typeof BattleEngine !== "undefined" && BattleEngine.clearIdleTimer) {
        BattleEngine.clearIdleTimer();
      }
      this.prefetch(jaOnly, role);

      /* 防积压折叠：仅裁剪尚未开播的等待项（新语音入队时自动折叠等待队列中的旧 low 项），绝不打断正在播放或加载中的当前句 */
      for (let i = this.speakQueue.length - 1; i >= 0; i--) {
        if (this.speakQueue[i].priority === "low") {
          const dropped = this.speakQueue.splice(i, 1)[0];
          try { if (dropped && dropped.resolve) dropped.resolve(); } catch (_) {}
        }
      }
      if (priority === "high") {
        while (this.speakQueue.length >= 3) {
          const dropIdx = this.speakQueue.findIndex((it) => it.priority !== "high");
          const dropped = this.speakQueue.splice(dropIdx !== -1 ? dropIdx : 0, 1)[0];
          try { if (dropped && dropped.resolve) dropped.resolve(); } catch (_) {}
        }
      } else {
        while (this.speakQueue.length >= 2) {
          const dropIdx = this.speakQueue.findIndex((it) => it.priority !== "high");
          if (dropIdx === -1) break;
          const dropped = this.speakQueue.splice(dropIdx, 1)[0];
          try { if (dropped && dropped.resolve) dropped.resolve(); } catch (_) {}
        }
      }

      const myToken = this.speakToken;
      return new Promise((resolve) => {
        this.speakQueue.push({ jaOnly, role, priority, token: myToken, resolve });
        this.pendingSpeakCount = (this.isSpeaking ? 1 : 0) + this.speakQueue.length;
        if (!this.isDrainingQueue) {
          this.drainSpeakQueue();
        }
      });
    },

    async drainSpeakQueue() {
      if (this.isDrainingQueue) return;
      const myDrainId = ++this._drainId;
      this.isDrainingQueue = true;
      try {
        while (myDrainId === this._drainId && this.speakQueue.length > 0) {
          const item = this.speakQueue.shift();
          if (!item) continue;
          const { jaOnly, role, token: myToken, resolve } = item;
          if (myToken !== this.speakToken) {
            try { resolve(); } catch (_) {}
            continue;
          }

          const cfg = ConfigManager.data;
          const hasKey = String(cfg.apiKey || "").trim().length > 0;
          this.isSpeaking = true;
          this.pendingSpeakCount = 1 + this.speakQueue.length;
          this.recordSpoken(jaOnly);
          /* 播报期间暂停浏览器 ASR 并清空未提交的断句缓冲，杜绝外放串音与音效打断 */
          clearTimeout(this.chromeResumeTimer);
          clearTimeout(this.chromeUtterTimer);
          this.chromeUtterBuf = "";
          if (this.vadRecorder || this.vadCapturing) this.abortVadRecorder();
          if (this.callActive && this.callMode === "chrome_asr" && this.callRec) {
            clearTimeout(this.recRestartTimer);
            try { this.callRec.onend = null; this.callRec.abort(); } catch (_) {}
            this.callRec = null;
            this.recRunning = false;
            this.recStarting = false;
          }
          if (this.callActive) {
            if (this.callMode === "vad") {
              this.updateCallButtonUI("播报中，开口可打断", "発話中（可打断）");
            } else {
              this.updateCallButtonUI("播报中，播完自动听", "発話中（暂停收音）");
            }
          }

          try {
            if (!hasKey || cfg.ttsEngine === "chrome_tts") {
              this.setVoiceStatus("現在：Chrome標準日本語音声", "浏览器日语朗读");
              DebugLog.add("TTS", `Chrome TTS (${role})`, jaOnly);
              await this.speakChrome(jaOnly, role, myToken);
            } else if (this.apiTtsBlocked) {
              this.setVoiceStatus(`現在：Chrome標準日本語音声（Vertex音声 ${this.apiTtsBlockReason} のため自動降級中）`);
              DebugLog.add("TTS", `Chrome TTS 降级中 (${role}, ${this.apiTtsBlockReason})`, jaOnly);
              await this.speakChrome(jaOnly, role, myToken);
            } else {
              try {
                await this.speakVertexTts(jaOnly, role, myToken);
                this.setVoiceStatus(`現在：Vertex Gemini TTS (${cfg.ttsModel}) 再生中`);
              } catch (e) {
                if (myToken === this.speakToken) {
                  if (e && (e.status === 402 || e.status === 403 || e.status === 404)) {
                    this.apiTtsBlocked = true;
                    this.apiTtsBlockReason = `HTTP ${e.status}`;
                  }
                  DebugLog.add("ERR", `Vertex TTS 失败 (${e.message}) → 降级 Chrome TTS`, jaOnly);
                  this.setVoiceStatus(`Vertex音声失敗 (${e.message}) → Chrome標準日本語音声へ降級`);
                  await this.speakChrome(jaOnly, role, myToken);
                }
              }
            }
          } finally {
            try { resolve(); } catch (_) {}
            if (myToken === this.speakToken) {
              this.isSpeaking = false;
              this.lastSpeakEndAt = Date.now();
              this.pendingSpeakCount = this.speakQueue.length;
            }
          }
        }
      } finally {
        if (myDrainId !== this._drainId) return;
        this.isDrainingQueue = false;
        if (!this.isSpeaking && this.speakQueue.length === 0) {
          this.pendingSpeakCount = 0;
          if (this.callActive) {
            if (this.callMode === "chrome_asr") {
              this.updateCallButtonUI("准备恢复监听…", "再開中（恢复中）");
              clearTimeout(this.chromeResumeTimer);
              this.chromeResumeTimer = setTimeout(() => {
                if (this.callActive && this.callMode === "chrome_asr" && !this.isSpeaking) {
                  this.spawnContinuousRec();
                  this.updateCallButtonUI("Chrome识别中，点击挂断", "Chrome聴取中（浏览器监听）");
                }
              }, 180);
            } else {
              this.updateCallButtonUI("持续监听中，点击挂断", "聴取中（监听）");
            }
          }
          /* 仅在整条播报队列全部播完后，才重新开始“久未响应”静默倒计时 */
          if (typeof BattleEngine !== "undefined" && BattleEngine.resetIdleTimer) {
            BattleEngine.resetIdleTimer(false);
          }
        }
      }
    },

    /* ---------- 持续通话模式（严格半双工门控：TTS 与音效播完后再收音，杜绝串音与幻觉） ---------- */
    updateCallButtonUI(subHint = "持续监听中，点击挂断", badgeText = "聴取中（监听）") {
      const btn = $("btnLiveCall");
      if (!btn) return;
      const phoneSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/></svg>';
      const stopSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';
      if (this.callActive) {
        btn.classList.add("in-call");
        btn.innerHTML = `${stopSvg}通話終了<br><span class="btn-zh">（${escapeHtml(subHint)}）</span>`;
        this.setCallBadge(badgeText, true);
      } else {
        btn.classList.remove("in-call");
        btn.innerHTML = `${phoneSvg}通話開始<br><span class="btn-zh">（开始持续通话）</span>`;
        this.setCallBadge("待機（待机）", false);
      }
    },

    async toggleCall(onUtterance) {
      if (this.callActive) {
        this.stopCall(false);
        return;
      }
      this.stopPlayback();
      this.callCallback = onUtterance;
      await this.startContinuousAsrCall();
    },

    /** 将多段 Float32 PCM 波形线性降采样至 16kHz 并编码为单声道 16-bit WAV Base64（减小上传体积并兼容任意原生采样率） */
    encodePcmToWavBase64(chunks, srcRate = 48000) {
      let totalLen = 0;
      for (const c of chunks) totalLen += c.length;
      if (totalLen === 0) return "";
      const merged = new Float32Array(totalLen);
      let pos = 0;
      for (const c of chunks) { merged.set(c, pos); pos += c.length; }
      const targetRate = srcRate > 16000 ? 16000 : srcRate;
      let samples = merged;
      if (targetRate < srcRate) {
        const ratio = srcRate / targetRate;
        const outLen = Math.max(1, Math.floor(totalLen / ratio));
        samples = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const idx = i * ratio;
          const i0 = Math.floor(idx);
          const i1 = Math.min(totalLen - 1, i0 + 1);
          const frac = idx - i0;
          samples[i] = merged[i0] * (1 - frac) + merged[i1] * frac;
        }
      }
      const outLen = samples.length;
      const buf = new ArrayBuffer(44 + outLen * 2);
      const view = new DataView(buf);
      const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + outLen * 2, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, targetRate, true);
      view.setUint32(28, targetRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, "data");
      view.setUint32(40, outLen * 2, true);
      let offset = 44;
      for (let i = 0; i < outLen; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
      const bytes = new Uint8Array(buf);
      let bin = "";
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
      }
      return btoa(bin);
    },

    /** 中断当前尚未提交的 VAD 录音切片与 PCM 采集缓冲 */
    abortVadRecorder() {
      this.vadCapturing = false;
      this.vadCaptureChunks = [];
      const rec = this.vadRecorder;
      this.vadRecorder = null;
      if (rec && rec.state !== "inactive") {
        try { rec.onstop = null; rec.stop(); } catch (_) {}
      }
    },

    /** 断开并回收旧的 VAD 音频处理节点，防止重复初始化导致 ScriptProcessorNode 泄漏 */
    cleanupVadNodes() {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
      this.abortVadRecorder();
      if (this.vadProcessor) {
        try { this.vadProcessor.disconnect(); this.vadProcessor.onaudioprocess = null; } catch (_) {}
        this.vadProcessor = null;
      }
      if (this.vadZeroGain) {
        try { this.vadZeroGain.disconnect(); } catch (_) {}
        this.vadZeroGain = null;
      }
      if (this.vadSource) {
        try { this.vadSource.disconnect(); } catch (_) {}
        this.vadSource = null;
      }
      this.vadAnalyser = null;
      this.vadPreRoll = [];
      this.updateVoiceWave(0, 0.02, false);
    },

    /** 驱动语音栏 5 柱实时声波条，提供 35ms 级收音确定感 */
    updateVoiceWave(rms, thresh, active) {
      const wrap = $("voiceWaveMeter");
      if (!wrap) return;
      wrap.classList.toggle("active", Boolean(active));
      const bars = wrap.children;
      const ratio = thresh > 0 ? Math.min(1, rms / (thresh * 2.2)) : 0;
      const weights = [0.55, 0.85, 1.0, 0.8, 0.5];
      for (let i = 0; i < bars.length; i++) {
        const h = active ? Math.max(22, Math.round(ratio * 100 * (weights[i] || 0.7))) : Math.max(14, Math.round(ratio * 55 * (weights[i] || 0.7)));
        bars[i].style.height = `${Math.min(100, h)}%`;
      }
    },

    /** 基于常驻麦克风流的自适应本地 VAD（300ms PCM 预缓冲 + 动态尾音判停 680ms/950ms + AEC3 高门限 Barge-in 打断） */
    startVadMonitor() {
      if (!this.callMicStream) return;
      this.cleanupVadNodes();
      const ctx = this.getAudioCtx();
      this.vadSource = ctx.createMediaStreamSource(this.callMicStream);
      this.vadAnalyser = ctx.createAnalyser();
      this.vadAnalyser.fftSize = 1024;
      this.vadSource.connect(this.vadAnalyser);
      this.vadPreRoll = [];
      this.vadCaptureChunks = [];
      this.vadCapturing = false;
      const usePcmPreRoll = typeof ctx.createScriptProcessor === "function";
      if (usePcmPreRoll) {
        try {
          const proc = ctx.createScriptProcessor(2048, 1, 1);
          const zeroGain = ctx.createGain();
          zeroGain.gain.value = 0;
          /* 650ms 环形预缓冲：完整保留清辅音起音与冷却临界开口的前几个字 */
          const maxPreChunks = Math.max(8, Math.ceil((ctx.sampleRate * 0.65) / 2048));
          proc.onaudioprocess = (ev) => {
            if (!this.callActive) return;
            const input = ev.inputBuffer.getChannelData(0);
            const copy = new Float32Array(input.length);
            copy.set(input);
            if (this.vadCapturing) {
              this.vadCaptureChunks.push(copy);
            } else {
              this.vadPreRoll.push(copy);
              if (this.vadPreRoll.length > maxPreChunks) this.vadPreRoll.shift();
            }
          };
          this.vadSource.connect(proc);
          proc.connect(zeroGain);
          zeroGain.connect(ctx.destination);
          this.vadProcessor = proc;
          this.vadZeroGain = zeroGain;
        } catch (_) {
          this.vadProcessor = null;
          this.vadZeroGain = null;
        }
      }
      const pcm = new Float32Array(this.vadAnalyser.fftSize);
      const mime = (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) ? "audio/webm;codecs=opus" : "audio/webm";
      this.vadNoiseFloor = 0.012;
      this.vadHitStreak = 0;
      this.vadBargeStreak = 0;
      this.vadLoudFrames = 0;

      clearInterval(this.vadTimer);
      this.vadTimer = setInterval(() => {
        if (!this.callActive || !this.vadAnalyser) return;
        const now = Date.now();
        const playerCanSpeak = !BattleEngine.state?.busy && BattleEngine.state?.currentPlayer === "player" && !BattleEngine.state?.gameOver;
        if (!playerCanSpeak || now < this.sfxPlayingUntil) {
          this.vadHitStreak = 0;
          this.vadBargeStreak = 0;
          if (this.vadRecorder || this.vadCapturing) this.abortVadRecorder();
          this.updateVoiceWave(0, 0.02, false);
          return;
        }

        this.vadAnalyser.getFloatTimeDomainData(pcm);
        let sum = 0;
        for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
        const rms = Math.sqrt(sum / pcm.length);
        const startThresh = Math.max(0.018, this.vadNoiseFloor * 2.4 + 0.006);
        const contThresh = Math.max(0.011, this.vadNoiseFloor * 1.6 + 0.004);
        const minPeak = Math.max(0.022, this.vadNoiseFloor * 2.6 + 0.007);
        const minLoudFrames = 4;

        /* AEC3 护航下的高门限 Barge-in：仅在 TTS 正在播报期要求高门限，播完立即恢复正常灵敏度杜绝吞首音 */
        if (this.isSpeaking) {
          const bargeThresh = Math.max(0.055, this.vadNoiseFloor * 4.2);
          if (rms > bargeThresh) {
            this.vadBargeStreak += 1;
            this.updateVoiceWave(rms, bargeThresh, true);
          } else {
            this.vadBargeStreak = 0;
            this.updateVoiceWave(rms * 0.3, bargeThresh, false);
          }
          if (this.vadBargeStreak >= 5) {
            this.vadBargeStreak = 0;
            this.stopPlayback();
            this.lastSpeakEndAt = 0;
            this.vadSpeechStart = now;
            this.vadLastLoud = now;
            this.vadPeakRms = rms;
            this.vadLoudFrames = 5;
            BattleEngine.resetIdleTimer();
            this.updateCallButtonUI("已打断播报，正在聆听…", "割込収音中（打断收音）");
            if (this.vadProcessor) {
              this.vadCaptureChunks = [...this.vadPreRoll];
              this.vadPreRoll = [];
              this.vadCapturing = true;
            }
          }
          return;
        }
        this.vadBargeStreak = 0;

        const isActiveCapture = this.vadProcessor ? this.vadCapturing : Boolean(this.vadRecorder);
        this.updateVoiceWave(rms, startThresh, isActiveCapture || rms > startThresh);
        if (!isActiveCapture) {
          if (rms > startThresh) {
            this.vadHitStreak += 1;
          } else {
            this.vadHitStreak = 0;
            /* 仅在确认是背景静音时才更新底噪，禁止把清辅音起音爬坡吸纳进底噪导致门限虚高 */
            if (rms < this.vadNoiseFloor * 1.35) {
              this.vadNoiseFloor = Math.min(0.015, Math.max(0.004, this.vadNoiseFloor * 0.94 + rms * 0.06));
            }
          }
          if (this.vadHitStreak >= 2) {
            this.vadHitStreak = 0;
            this.vadSpeechStart = now;
            this.vadLastLoud = now;
            this.vadPeakRms = rms;
            this.vadLoudFrames = 2;
            BattleEngine.resetIdleTimer();
            this.updateCallButtonUI("正在聆听指令…", "収音中（收音）");
            if (this.vadProcessor) {
              this.vadCaptureChunks = [...this.vadPreRoll];
              this.vadPreRoll = [];
              this.vadCapturing = true;
            } else {
              try {
                const rec = new MediaRecorder(this.callMicStream, mime ? { mimeType: mime } : undefined);
                const chunks = [];
                const peakGate = minPeak;
                const framesGate = minLoudFrames;
                const speechStart = now;
                this.vadRecorder = rec;
                rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
                rec.onstop = () => {
                  const peak = this.vadPeakRms;
                  const loudFrames = this.vadLoudFrames;
                  const durMs = Date.now() - speechStart;
                  if (this.callActive) {
                    if (this.isSpeaking) this.updateCallButtonUI("播报中，开口可打断", "発話中（可打断）");
                    else this.updateCallButtonUI("持续监听中，点击挂断", "聴取中（监听）");
                  }
                  if (!this.callActive || chunks.length === 0 || loudFrames < framesGate || peak < peakGate || durMs < 260) return;
                  const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
                  DebugLog.add("ASR", `VAD 提交语音切片 (${Math.round(blob.size / 1024)}KB, ${durMs}ms)`, `frames=${loudFrames}, peak=${peak.toFixed(3)}`);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const b64 = String(reader.result || "").split(",")[1];
                    if (b64 && this.callCallback) {
                      this.callCallback({ audioBase64: b64, audioMime: (blob.type || "audio/webm").split(";")[0], fromVoice: true });
                    }
                  };
                  reader.readAsDataURL(blob);
                };
                rec.start();
              } catch (_) {
                this.vadRecorder = null;
              }
            }
          }
        } else {
          if (rms > contThresh) {
            this.vadLastLoud = now;
            this.vadLoudFrames += 1;
            if (rms > this.vadPeakRms) this.vadPeakRms = rms;
          }
          const dur = now - this.vadSpeechStart;
          const silence = now - this.vadLastLoud;
          const tailSilenceMs = dur < 1200 ? 680 : 950;
          if (silence >= tailSilenceMs || dur >= 15000) {
            if (this.vadProcessor) {
              this.vadCapturing = false;
              const pcmChunks = this.vadCaptureChunks;
              this.vadCaptureChunks = [];
              const peak = this.vadPeakRms;
              const loudFrames = this.vadLoudFrames;
              if (this.callActive) {
                if (this.isSpeaking) this.updateCallButtonUI("播报中，开口可打断", "発話中（可打断）");
                else this.updateCallButtonUI("持续监听中，点击挂断", "聴取中（监听）");
              }
              if (!this.callActive || pcmChunks.length === 0 || loudFrames < minLoudFrames || peak < minPeak || dur < 220) return;
              SoundFX.play("tap");
              const b64 = this.encodePcmToWavBase64(pcmChunks, ctx.sampleRate || 24000);
              if (b64 && this.callCallback) {
                DebugLog.add("ASR", `VAD+PreRoll 提交 WAV (${Math.round((b64.length * 0.75) / 1024)}KB, ${dur}ms)`, `frames=${loudFrames}, peak=${peak.toFixed(3)}, tail=${tailSilenceMs}ms`);
                this.callCallback({ audioBase64: b64, audioMime: "audio/wav", fromVoice: true });
              }
            } else {
              const rec = this.vadRecorder;
              this.vadRecorder = null;
              try { if (rec && rec.state !== "inactive") rec.stop(); } catch (_) {}
            }
          }
        }
      }, 35);
    },

    /** 离线/浏览器语音识别兜底：严格等待 TTS 与音效播完后再收音 */
    spawnContinuousRec() {
      if (!this.callActive || this.callMode !== "chrome_asr" || this.recRunning || this.recStarting || this.isSpeaking) return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;

      if (this.callRec) {
        try { this.callRec.onstart = null; this.callRec.onresult = null; this.callRec.onerror = null; this.callRec.onend = null; this.callRec.abort(); } catch (_) {}
        this.callRec = null;
      }

      const rec = new SR();
      rec.lang = ConfigManager.data.asrLang || "ja-JP";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      this.callRec = rec;
      this.recStarting = true;

      rec.onstart = () => {
        this.recStarting = false;
        this.recRunning = true;
        this.recRetryDelay = 300;
      };

      rec.onresult = (ev) => {
        const now = Date.now();
        if (!this.callActive || BattleEngine.state?.busy || BattleEngine.state?.currentPlayer !== "player" || BattleEngine.state?.gameOver || this.isSpeaking || now < this.sfxPlayingUntil || (now - this.lastSpeakEndAt < 650)) return;
        this.recRetryDelay = 300;
        BattleEngine.resetIdleTimer();
        let finalText = "";
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
          else interim += ev.results[i][0].transcript;
        }
        if (interim) {
          clearTimeout(this.chromeUtterTimer);
          $("cmdInput").value = (this.chromeUtterBuf ? `${this.chromeUtterBuf} ${interim}` : interim).trim();
        }
        const clean = finalText.trim();
        if (clean) {
          this.chromeUtterBuf = (this.chromeUtterBuf ? `${this.chromeUtterBuf} ${clean}` : clean).trim();
          $("cmdInput").value = this.chromeUtterBuf;
          /* 900ms 停顿合并窗口：允许玩家句中短暂思考，将连续片段合并为完整指令后再提交 */
          clearTimeout(this.chromeUtterTimer);
          this.chromeUtterTimer = setTimeout(() => {
            const merged = this.chromeUtterBuf.trim();
            this.chromeUtterBuf = "";
            if (!merged || !this.callActive || BattleEngine.state?.busy || this.isSpeaking) return;
            $("cmdInput").value = merged;
            DebugLog.add("ASR", "Chrome 持续识别结果", merged);
            if (this.callCallback) this.callCallback({ text: merged, fromVoice: true });
          }, 900);
        }
      };

      rec.onerror = (ev) => {
        this.recStarting = false;
        this.recRunning = false;
        if (ev.error && ev.error !== "no-speech" && ev.error !== "aborted") {
          DebugLog.add("ERR", `Chrome ASR 错误: ${ev.error}`);
        }
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          TableUI.setReferee(
            "マイクの使用が許可されていません。ブラウザの権限をご確認ください。",
            "未获得麦克风权限，请在浏览器地址栏允许麦克风访问。"
          );
          this.stopCall(true);
          return;
        }
        if (ev.error === "network" || ev.error === "audio-capture") {
          this.recRetryDelay = Math.min(2000, this.recRetryDelay + 400);
        }
      };

      rec.onend = () => {
        this.recStarting = false;
        this.recRunning = false;
        if (!this.callActive || this.callMode !== "chrome_asr" || this.isSpeaking) return;
        clearTimeout(this.recRestartTimer);
        this.recRestartTimer = setTimeout(() => this.spawnContinuousRec(), this.recRetryDelay);
      };

      try {
        rec.start();
      } catch (_) {
        this.recStarting = false;
        this.recRunning = false;
        clearTimeout(this.recRestartTimer);
        this.recRestartTimer = setTimeout(() => this.spawnContinuousRec(), 500);
      }
    },

    /** 清理在线语音识别自动回连定时器 */
    clearApiAsrReconnectTimer() {
      if (this.apiAsrRetryTimer) {
        clearTimeout(this.apiAsrRetryTimer);
        this.apiAsrRetryTimer = null;
      }
    },

    /** 在线语音识别恢复可用时：保护未提交半句缓冲，并无缝切回 Vertex 在线语音识别 */
    onOnlineApiRecovered() {
      if (!this.apiAsrBlocked) return;
      this.clearApiAsrReconnectTimer();
      this.apiAsrBlocked = false;
      this.apiAsrBlockReason = "";
      this.apiAsrBlockedAt = 0;
      this.apiAsrRetryAttempt = 0;
      DebugLog.add("ASR", "在线语音识别已恢复，自动切回 Vertex 语音识别");
      const cfg = ConfigManager.data;
      if (this.callActive && this.callMode === "chrome_asr" && cfg.asrMode === "gemini_audio" && Boolean(window.MediaRecorder) && this.callMicStream) {
        const pendingBuf = String(this.chromeUtterBuf || "").trim();
        clearTimeout(this.chromeResumeTimer);
        clearTimeout(this.chromeUtterTimer);
        this.chromeUtterBuf = "";
        if (pendingBuf && this.callCallback) {
          const cleaned = this.stripSpokenEcho(pendingBuf);
          if (cleaned) this.callCallback({ text: cleaned, fromVoice: true });
        }
        clearTimeout(this.recRestartTimer);
        clearInterval(this.recWatchdogTimer);
        this.recWatchdogTimer = null;
        this.recRunning = false;
        this.recStarting = false;
        if (this.callRec) {
          try { this.callRec.onend = null; this.callRec.abort(); } catch (_) {}
          this.callRec = null;
        }
        this.callMode = "vad";
        this.startVadMonitor();
        this.updateCallButtonUI("通话中，点击挂断", "通話中（通话中）");
        this.setVoiceStatus("オンライン音声認識に自動復帰しました（Vertex AI）");
        TableUI.showToast("オンライン音声認識に自動復帰しました", "已自动回连在线语音识别");
      } else {
        this.setVoiceStatus("オンライン音声認識が復旧しました（次回から自動使用）");
        TableUI.showToast("オンライン音声認識が復旧しました", "在线语音识别已恢复");
      }
    },

    /** 后台静默探测在线语音识别接口是否恢复（采用 5s → 10s → 20s → 30s 快速退避重试，不打断当前本地识别） */
    scheduleApiAsrReconnect() {
      const cfg = ConfigManager.data;
      if (!this.apiAsrBlocked || cfg.asrMode !== "gemini_audio" || !String(cfg.apiKey || "").trim()) return;
      if (/(401|403|API_KEY_INVALID)/i.test(String(this.apiAsrBlockReason || ""))) return;
      this.clearApiAsrReconnectTimer();
      const delays = [5000, 10000, 20000, 30000];
      const attempt = this.apiAsrRetryAttempt || 0;
      const waitMs = delays[Math.min(attempt, delays.length - 1)];
      DebugLog.add("ASR", `计划 ${Math.round(waitMs / 1000)}s 后自动探测在线语音识别回连（第 ${attempt + 1} 次）`);
      this.apiAsrRetryTimer = setTimeout(() => { this.probeOnlineAsrRecovery(); }, waitMs);
    },

    async probeOnlineAsrRecovery() {
      this.apiAsrRetryTimer = null;
      const cfg = ConfigManager.data;
      if (!this.apiAsrBlocked || cfg.asrMode !== "gemini_audio" || !String(cfg.apiKey || "").trim()) return;
      const url = ConfigManager.buildRestUrl(cfg.llmModel);
      if (!url) return;
      const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ac ? setTimeout(() => ac.abort(), 4500) : null;
      const genCfg = { maxOutputTokens: 2 };
      const thinkCfg = ConfigManager.buildThinkingConfig(cfg.llmModel);
      if (thinkCfg) genCfg.thinkingConfig = thinkCfg;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: ConfigManager.buildAuthHeaders(),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ok" }] }],
            generationConfig: genCfg
          }),
          signal: ac ? ac.signal : undefined
        });
        if (res.ok) {
          this.onOnlineApiRecovered();
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        this.apiAsrRetryAttempt = (this.apiAsrRetryAttempt || 0) + 1;
        DebugLog.add("ASR", `在线语音识别回连探测未通 (${e?.name === "AbortError" ? "timeout" : (e?.message || "network")})，继续保持本地识别`);
        if (this.apiAsrBlocked) this.scheduleApiAsrReconnect();
      } finally {
        if (timer) clearTimeout(timer);
      }
    },

    /** Vertex 语音识别失败时自动降级至 Chrome 标准语音识别（通话中无缝切换，并定时自动尝试回连在线） */
    fallbackToChromeAsr(reason = "") {
      this.apiAsrBlocked = true;
      this.apiAsrBlockReason = reason || "接続失敗";
      this.apiAsrBlockedAt = Date.now();
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        DebugLog.add("ERR", `Vertex ASR 失败 (${this.apiAsrBlockReason}) 且浏览器不支持 Chrome ASR`);
        this.setVoiceStatus(`Vertex音声認識失敗 (${this.apiAsrBlockReason}) · Chrome音声認識未対応`);
        this.scheduleApiAsrReconnect();
        return false;
      }
      DebugLog.add("ASR", `Vertex ASR 失败 (${this.apiAsrBlockReason}) → 自动切换 Chrome ASR（后台自动回连）`);
      this.setVoiceStatus(`Vertex音声認識失敗 (${this.apiAsrBlockReason}) → Chrome標準音声認識へ自動切替（自動再接続待機中）`);
      if (this.callActive && this.callMode === "vad") {
        clearInterval(this.vadTimer);
        this.vadTimer = null;
        this.abortVadRecorder();
        if (this.vadProcessor) {
          try { this.vadProcessor.disconnect(); this.vadProcessor.onaudioprocess = null; } catch (_) {}
          this.vadProcessor = null;
        }
        if (this.vadZeroGain) {
          try { this.vadZeroGain.disconnect(); } catch (_) {}
          this.vadZeroGain = null;
        }
        if (this.vadSource) {
          try { this.vadSource.disconnect(); } catch (_) {}
          this.vadSource = null;
        }
        this.vadAnalyser = null;
        this.vadPreRoll = [];
        this.callMode = "chrome_asr";
        this.recRetryDelay = 300;
        this.updateCallButtonUI("Chrome识别中，点击挂断", "Chrome聴取中");
        this.spawnContinuousRec();
        clearInterval(this.recWatchdogTimer);
        this.recWatchdogTimer = setInterval(() => {
          if (this.callActive && this.callMode === "chrome_asr" && !this.recRunning && !this.recStarting) {
            this.spawnContinuousRec();
          }
        }, 3000);
      }
      this.scheduleApiAsrReconnect();
      return true;
    },

    async startContinuousAsrCall(quiet = false) {
      const cfg = ConfigManager.data;
      if (this.apiAsrBlocked && this.apiAsrBlockedAt && Date.now() - this.apiAsrBlockedAt >= 5000 && !/(401|403|API_KEY_INVALID)/i.test(String(this.apiAsrBlockReason || ""))) {
        this.apiAsrBlocked = false;
        this.apiAsrBlockReason = "";
        this.apiAsrRetryAttempt = 0;
      }
      const canUseVad = Boolean(window.MediaRecorder) && cfg.asrMode === "gemini_audio" && !this.apiAsrBlocked && String(cfg.apiKey || "").trim().length > 0;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!canUseVad && !SR) {
        if (!quiet) {
          TableUI.setReferee(
            "このブラウザは継続音声認識に未対応です。Chromeをご利用ください。",
            "当前浏览器不支持持续语音识别，请使用 Chrome 或文字输入。"
          );
        }
        return;
      }

      /* 全程仅在开始通话时申请一次麦克风流，挂断前绝不释放，杜绝浏览器反复弹窗 */
      try {
        if (!this.callMicStream && navigator.mediaDevices?.getUserMedia) {
          this.callMicStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
          });
        }
      } catch (_) {
        if (!quiet) {
          TableUI.setReferee(
            "マイクの使用が許可されていません。ブラウザの権限をご確認ください。",
            "未获得麦克风权限，请在浏览器地址栏允许麦克风访问。"
          );
        }
        return;
      }

      this.callActive = true;
      this.callMode = canUseVad ? "vad" : "chrome_asr";
      this.recRetryDelay = 300;
      this.updateCallButtonUI("持续监听中，点击挂断");

      if (this.callMode === "vad") {
        this.startVadMonitor();
      } else {
        this.spawnContinuousRec();
        clearInterval(this.recWatchdogTimer);
        this.recWatchdogTimer = setInterval(() => {
          if (this.callActive && this.callMode === "chrome_asr" && !this.recRunning && !this.recStarting) {
            this.spawnContinuousRec();
          }
        }, 3000);
      }

      if (!quiet) {
        TableUI.setReferee("通話を開始しました。そのまま話しかけてください。", "已开启持续语音通话，请直接说出指令。");
        await this.speak("通話を開始しました。そのまま話しかけてください。", "referee");
      }
      BattleEngine.resetIdleTimer();
    },

    stopCall(silent = false) {
      this.callActive = false;
      this.clearApiAsrReconnectTimer();
      clearInterval(this.vadTimer);
      this.vadTimer = null;
      this.abortVadRecorder();
      if (this.vadProcessor) {
        try { this.vadProcessor.disconnect(); this.vadProcessor.onaudioprocess = null; } catch (_) {}
        this.vadProcessor = null;
      }
      if (this.vadZeroGain) {
        try { this.vadZeroGain.disconnect(); } catch (_) {}
        this.vadZeroGain = null;
      }
      if (this.vadSource) {
        try { this.vadSource.disconnect(); } catch (_) {}
        this.vadSource = null;
      }
      this.vadAnalyser = null;
      this.vadPreRoll = [];
      clearTimeout(this.chromeResumeTimer);
      clearTimeout(this.chromeUtterTimer);
      this.chromeUtterBuf = "";
      clearTimeout(this.recRestartTimer);
      clearInterval(this.recWatchdogTimer);
      this.recWatchdogTimer = null;
      this.recRunning = false;
      this.recStarting = false;
      BattleEngine.clearIdleTimer();
      if (this.callRec) {
        try { this.callRec.onend = null; this.callRec.abort(); } catch (_) {}
        this.callRec = null;
      }
      if (this.callMicStream) {
        try { this.callMicStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        this.callMicStream = null;
      }
      this.stopPlayback();
      this.updateCallButtonUI();
      if (!silent) {
        TableUI.setReferee("通話を終了しました。", "已挂断持续语音通话。");
      }
    },

    /* ---------- 单次按录（支持 Vertex Gemini 音频直传或浏览器语音识别） ---------- */
    async toggleRecord(onResult) {
      const btn = $("btnRecordVoice");
      if (this.isRecording) {
        this.isRecording = false;
        btn.classList.remove("recording");
        btn.innerHTML = `${SVG_ICONS.mic}単発<br><span class="btn-zh">（单次）</span>`;
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
        if (this.chromeRec) try { this.chromeRec.stop(); } catch (e) {}
        return;
      }

      this.resumeCallAfterRecord = Boolean(this.callActive);
      if (this.callActive) this.stopCall(true);
      this.stopPlayback();

      const cfg = ConfigManager.data;
      if (this.apiAsrBlocked && this.apiAsrBlockedAt && Date.now() - this.apiAsrBlockedAt >= 5000 && !/(401|403|API_KEY_INVALID)/i.test(String(this.apiAsrBlockReason || ""))) {
        this.apiAsrBlocked = false;
        this.apiAsrBlockReason = "";
        this.apiAsrRetryAttempt = 0;
      }
      const useDirectAudio = cfg.asrMode === "gemini_audio" && !this.apiAsrBlocked && String(cfg.apiKey || "").trim().length > 0;

      if (useDirectAudio) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const preferredMime = (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) ? "audio/webm;codecs=opus" : "";
          this.mediaRecorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
          this.audioChunks = [];
          this.mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.audioChunks.push(e.data); };
          this.mediaRecorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            const shouldResume = this.resumeCallAfterRecord;
            this.resumeCallAfterRecord = false;
            const maybeResume = () => {
              if (shouldResume && !this.callActive && !this.isRecording) {
                setTimeout(() => { if (!this.callActive && !this.isRecording) this.startContinuousAsrCall(true); }, 450);
              }
            };
            if (this.audioChunks.length === 0) {
              TableUI.setReferee("音声が録音できませんでした。もう一度お試しください。", "未能录到声音，请再按一次重试。");
              maybeResume();
              return;
            }
            const actualMime = (this.mediaRecorder?.mimeType || "audio/webm").split(";")[0];
            const blob = new Blob(this.audioChunks, { type: actualMime });
            const reader = new FileReader();
            reader.onloadend = () => {
              const b64 = String(reader.result || "").split(",")[1];
              if (b64) onResult({ audioBase64: b64, audioMime: actualMime, fromVoice: true, manualVoice: true });
              else TableUI.setReferee("音声データの変換に失敗しました。", "音频数据读取失败，请重试。");
              maybeResume();
            };
            reader.readAsDataURL(blob);
          };
          this.mediaRecorder.start();
          this.isRecording = true;
          btn.classList.add("recording");
          btn.innerHTML = `${SVG_ICONS.stop}送信<br><span class="btn-zh">（发送）</span>`;
        } catch (e) {
          TableUI.setReferee(
            "マイクの使用が許可されていません。テキスト入力をご利用ください。",
            "未获得麦克风权限，请使用下方输入框或直接点击卡牌。"
          );
        }
      } else {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          TableUI.setReferee(
            "このブラウザは音声認識に未対応です。Chromeをご利用ください。",
            "当前浏览器不支持语音识别，请使用 Chrome 或下方文字输入。"
          );
          return;
        }
        this.chromeRec = new SR();
        this.chromeRec.lang = cfg.asrLang || "ja-JP";
        this.chromeRec.interimResults = true;
        this.chromeRec.continuous = false;
        let finalText = "";
        let lastInterim = "";
        let hadError = false;
        this.chromeRec.onresult = (ev) => {
          let interim = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
            else interim += ev.results[i][0].transcript;
          }
          lastInterim = interim;
          const preview = (finalText || interim).trim();
          if (preview) $("cmdInput").value = preview;
        };
        this.chromeRec.onerror = (ev) => {
          hadError = true;
          this.isRecording = false;
          btn.classList.remove("recording");
          btn.innerHTML = `${SVG_ICONS.mic}単発<br><span class="btn-zh">（单次）</span>`;
          TableUI.setReferee(
            `音声認識エラー（${ev.error || "unknown"}）。もう一度お試しください。`,
            `浏览器语音识别出错（${ev.error || "未知错误"}），请重试或改用文字输入。`
          );
        };
        this.chromeRec.onend = () => {
          this.isRecording = false;
          btn.classList.remove("recording");
          btn.innerHTML = `${SVG_ICONS.mic}単発<br><span class="btn-zh">（单次）</span>`;
          const shouldResume = this.resumeCallAfterRecord;
          this.resumeCallAfterRecord = false;
          if (!hadError) {
            const text = (finalText || lastInterim).trim();
            if (text) {
              $("cmdInput").value = text;
              onResult({ text, fromVoice: true, manualVoice: true });
            }
          }
          if (shouldResume && !this.callActive && !this.isRecording) {
            setTimeout(() => { if (!this.callActive && !this.isRecording) this.startContinuousAsrCall(true); }, 450);
          }
        };
        this.chromeRec.start();
        this.isRecording = true;
        btn.classList.add("recording");
        btn.innerHTML = `${SVG_ICONS.stop}停止<br><span class="btn-zh">（停止）</span>`;
      }
    }
  };

  /* =========================================================================
     4. NLUEngine（Gemini 中/日语解析 + 追问对话记忆 + 模糊匹配本地兜底）
     ========================================================================= */
  /* 裁判未听清指令时的多样化追问话术池（避免每次重复同一句） */
  const CLARIFY_PHRASES = [
    {
      ja: "すみません、うまく聞き取れませんでした。例：「前に炎エネ」「ひのこで攻撃」のように教えてください。",
      zh: "抱歉没有完全听清，可以说「给前排贴火能量」「用火花攻击」或对应的日语指令。"
    },
    {
      ja: "少し聞き取りにくかったです。エネルギー添付・ベンチ展開・技名のいずれかをもう一度お願いできますか？",
      zh: "刚才稍微有点没听清，可以再说一次要贴能量、下怪还是发动哪个技能吗？"
    },
    {
      ja: "ごめんなさい、指示を確定できませんでした。日本語でも中国語でも大丈夫なので、もう一度どうぞ！",
      zh: "不好意思，没能确认具体操作。中文或日语都可以，请再说一遍吧！"
    },
    {
      ja: "もう一声お願いします！例：「ミズガメをベンチに出して」「補給バッグを使う」のように話しかけてください。",
      zh: "请再说一次哦！例如「把水龟放到备战区」「使用补给包」或直接点击卡牌。"
    },
    {
      ja: "今の操作が少し曖昧でした。どのカードを使うか、またはどの技で攻撃するか教えてください。",
      zh: "刚才的指令有点模糊，请告诉我打算使用哪张手牌，或者要发动哪个技能。"
    }
  ];

  const NLUEngine = {
    lastClarifyIdx: -1,

    pickClarifyPhrase() {
      let idx = Math.floor(Math.random() * CLARIFY_PHRASES.length);
      if (idx === this.lastClarifyIdx) idx = (idx + 1) % CLARIFY_PHRASES.length;
      this.lastClarifyIdx = idx;
      return CLARIFY_PHRASES[idx];
    },

    safeParseJson(text) {
      const cleaned = String(text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const s = cleaned.indexOf("{");
      const e = cleaned.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error("No JSON");
      return JSON.parse(cleaned.slice(s, e + 1));
    },

    /** 混合解析：明确文本指令优先本地直出，复杂口语与音频直传交由 Vertex LLM 解析 */
    async parse({ text = "", audioBase64 = null, audioMime = "audio/webm", fromVoice = false }, boardSnapshot, conversationContext = null) {
      const cfg = ConfigManager.data;
      const url = ConfigManager.buildRestUrl(cfg.llmModel);
      const parseOpts = { isVoice: Boolean(fromVoice || audioBase64) };

      /* 文本/浏览器识别结果优先走本地高置信快通道，避免简单指令等待云端往返 */
      if (!audioBase64 && text) {
        const fast = this.localParse(text, boardSnapshot, conversationContext, parseOpts);
        if (fast.status === "execute" || fast.status === "confirm" || fast.status === "chat") {
          DebugLog.add("NLU", `本地快通道命中 (${fast.status})`, { text, actions: fast.actions });
          return fast;
        }
      }

      if (!url || cfg.asrMode === "chrome_local") {
        const localRes = this.localParse(text, boardSnapshot, conversationContext, parseOpts);
        DebugLog.add("NLU", `离线本地解析 (${localRes.status})`, { text, actions: localRes.actions });
        return localRes;
      }

      const parts = [{ text: `現在の盤面JSON:\n${JSON.stringify(boardSnapshot)}` }];

      /* 仅在真正处于追问态（pending 非空）时才向云端注入追问上下文，杜绝上一回合的「ターンエンド」污染新回合语音识别 */
      if (conversationContext && conversationContext.pending) {
        const ctxLines = [
          `現在の追問状態: ${conversationContext.pending.type}（前回の元発話: 「${conversationContext.pending.originalUtterance || ""}」／審判の質問: 「${conversationContext.pending.promptJa || ""}」）`
        ];
        if (conversationContext.lastPlayerUtterance) {
          ctxLines.push(`直前のプレイヤー発話: 「${conversationContext.lastPlayerUtterance}」`);
        }
        parts.push({ text: `会話コンテキスト（追問時の記憶）:\n${ctxLines.join("\n")}` });
      }

      if (audioBase64) {
        parts.push({ text: "以下の音声（日本語・中国語どちらでも可）を聞き取り、ゲーム操作JSONを返してください。「防御」「ぼうぎょ」「攻撃」「交代」「撤退」「水」「火」「雷」「左」「はい」「いいえ」などの短い明確なゲーム指示も必ず有効な操作として認識し、ignore にしないでください。「〇〇を召喚」「〇〇を出す」「ベンチに出す」「召唤〇〇」「派〇〇上场」は必ず PLAY_BENCH であり、絶対に END_TURN にしないでください。無音・環境音・効果音・クリック音・ため息・意味のない相槌（えっと/嗯/啊等）のみの場合は、操作を捏造せず {\"transcript\":\"\",\"status\":\"ignore\",\"actions\":[],\"reply_ja\":\"\",\"reply_zh\":\"\",\"rival_ja\":\"\",\"rival_zh\":\"\"} を返してください。" });
        parts.push({ inlineData: { mimeType: audioMime, data: audioBase64 } });
      } else {
        const fuzzyHints = SpecEngine.extractFuzzyHints(text);
        const hintLine = fuzzyHints.length ? `\n（カード名ファジー照合候補: ${fuzzyHints.join(" / ")}）` : "";
        parts.push({ text: `プレイヤーの発話（日本語または中国語）: 「${text}」${hintLine}` });
      }

      const genCfg = { responseMimeType: "application/json" };
      const thinkCfg = ConfigManager.buildThinkingConfig(cfg.llmModel);
      if (thinkCfg) genCfg.thinkingConfig = thinkCfg;

      const t0 = Date.now();
      const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (ac && typeof BattleEngine !== "undefined") BattleEngine.activeAbortCtrl = ac;
      const fetchTimer = ac ? setTimeout(() => ac.abort(), 15000) : null;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: ConfigManager.buildAuthHeaders(),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SpecEngine.buildSystemPrompt() }] },
            contents: [{ role: "user", parts }],
            generationConfig: genCfg
          }),
          signal: ac ? ac.signal : undefined
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} (${cfg.llmModel})`);
        if (VoiceEngine.apiAsrBlocked) VoiceEngine.onOnlineApiRecovered();
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || "";
        const parsed = this.safeParseJson(raw);
        DebugLog.add("NLU", `Vertex ${cfg.llmModel} (${Date.now() - t0}ms, ${parsed.status})`, { transcript: parsed.transcript, actions: parsed.actions });
        return parsed;
      } catch (e) {
        const errMsg = e?.name === "AbortError" ? "timeout" : (e?.message || "network");
        DebugLog.add("ERR", `Vertex ${audioBase64 ? "ASR/NLU" : "NLU"} 请求失败 (${Date.now() - t0}ms)`, errMsg);
        if (audioBase64 && !text) {
          return {
            transcript: "",
            status: "api_error",
            error: errMsg,
            actions: [],
            reply_ja: "",
            reply_zh: "",
            rival_ja: "",
            rival_zh: ""
          };
        }
        return this.localParse(text || "", boardSnapshot, conversationContext);
      } finally {
        if (fetchTimer) clearTimeout(fetchTimer);
      }
    },

    /** 从文本中解析目标槽位（支持模糊怪兽名匹配 + 同名多体消歧 + 位置/最低血量指代） */
    resolveSlotFromText(clause, side, board) {
      const pool = side === "enemy"
        ? [
            board.enemy.active ? { slot: "enemy_active", inst: board.enemy.active } : null,
            ...board.enemy.bench.map((inst, i) => inst ? { slot: `enemy_bench_${i}`, inst } : null)
          ].filter(Boolean)
        : [
            board.player.active ? { slot: "player_active", inst: board.player.active } : null,
            ...board.player.bench.map((inst, i) => inst ? { slot: `player_bench_${i}`, inst } : null)
          ].filter(Boolean);

      const pickByHint = (candidates) => {
        if (/左/.test(clause)) {
          const h = candidates.find((u) => u.slot === `${side}_bench_0`);
          if (h) return h.slot;
        }
        if (/中央|真ん中|中间/.test(clause)) {
          const h = candidates.find((u) => u.slot === `${side}_bench_1`);
          if (h) return h.slot;
        }
        if (/右/.test(clause)) {
          const h = candidates.find((u) => u.slot === `${side}_bench_2`);
          if (h) return h.slot;
        }
        if (/前|バトル場|前排|战斗区/.test(clause)) {
          const h = candidates.find((u) => u.slot === `${side}_active`);
          if (h) return h.slot;
        }
        if (/後ろ|控え|ベンチ|后排|备战/.test(clause)) {
          const benchCands = candidates.filter((u) => u.slot.includes("_bench_"));
          if (benchCands.length === 1) return benchCands[0].slot;
        }
        if (/エネがある|エネ付き|有能量|带能量/.test(clause)) {
          const energized = candidates.filter((u) => (u.inst.energies || []).length > 0);
          if (energized.length === 1) return energized[0].slot;
        }
        if (/無傷|満タン|满血/.test(clause)) {
          const fullHp = candidates.filter((u) => {
            const d = SpecEngine.getMonster(u.inst.id);
            return d && u.inst.hp >= d.hp;
          });
          if (fullHp.length === 1) return fullHp[0].slot;
        }
        if (/一番HPが低|一番弱|HPが低|弱ってる|血最少|残血|最弱|受伤/.test(clause) && candidates.length) {
          const sorted = [...candidates].sort((a, b) => a.inst.hp - b.inst.hp);
          return sorted[0].slot;
        }
        return null;
      };

      const exactMatches = pool.filter((u) => {
        const def = SpecEngine.getMonster(u.inst.id);
        return def && (clause.includes(def.name_ja) || clause.includes(def.name_zh));
      });
      if (exactMatches.length === 1) return exactMatches[0].slot;
      if (exactMatches.length > 1) return pickByHint(exactMatches);

      const fuzzyMon = SpecEngine.matchMonster(clause, side === "enemy" ? "opponent" : "player");
      if (fuzzyMon) {
        const fuzzyMatches = pool.filter((u) => u.inst.id === fuzzyMon.id);
        if (fuzzyMatches.length === 1) return fuzzyMatches[0].slot;
        if (fuzzyMatches.length > 1) return pickByHint(fuzzyMatches);
      }

      if (/左/.test(clause)) return `${side}_bench_0`;
      if (/中央|真ん中|中间/.test(clause)) return `${side}_bench_1`;
      if (/右/.test(clause)) return `${side}_bench_2`;
      if (/前|バトル場|前排|战斗区/.test(clause)) return `${side}_active`;
      if (/一番HPが低|一番弱|HPが低|弱ってる|血最少|残血|最弱|受伤/.test(clause) && pool.length) {
        const sorted = [...pool].sort((a, b) => a.inst.hp - b.inst.hp);
        return sorted[0].slot;
      }
      return null;
    },

    /** 本地双语指令解析（结合模糊匹配、全场景口语覆盖与追问上下文） */
    localParse(rawText, board, conversationContext = null, opts = null) {
      const isVoice = Boolean(opts && opts.isVoice);
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();

      if (/^(?:キャンセル|やめる|取り消|取消|算了)[。！!？?]?$/.test(fixed)) {
        return { transcript: fixed, status: "execute", actions: [{ type: "CANCEL" }], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
      }
      if (/(今の状況|状況は|HPいくつ|残りHP|あと何HP|残りサイド|サイド何枚|当前状态|血量|还有多少血|看看血量|对面多少血|场上情况|局面如何|还差几张奖赏)/.test(fixed)) {
        return { transcript: fixed, status: "execute", actions: [{ type: "INSPECT" }], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
      }
      if (/(やばい|負けそう|きつい|ピンチ|要输了|完蛋|好难打|打不过)/.test(fixed) && !/(降参|投了|リタイア|ギブアップ|逃走|もう無理|认输|投降|不打了|我投了|不玩了)/.test(fixed)) {
        const r = SpecEngine.getRivalLine("chat_weak");
        return {
          transcript: fixed, status: "chat", actions: [],
          reply_ja: "まだ逆転のチャンスはありますよ！落ち着いて次の一手を考えましょう。",
          reply_zh: "还有翻盘的机会！冷静思考下一步操作吧。",
          rival_ja: r.ja, rival_zh: r.zh
        };
      }
      if (/(降参|投了|リタイア|ギブアップ|逃走|もう無理|认输|投降|不打了|我投了|不玩了)/.test(fixed)) {
        return {
          transcript: fixed, status: "confirm", actions: [{ type: "SURRENDER" }],
          reply_ja: "バトルから逃走（降参）しますか？「はい」と答えると敗北になります。",
          reply_zh: "确定要逃离对战（认输）吗？回答“是”或“确认”将判定败北。",
          rival_ja: "", rival_zh: ""
        };
      }

      const strippedFuture = fixed.replace(/(?:下回合|下一回合|下次|等会|等一下|一会儿|待会|明天|次のターン|あとで|後で)再?[^、，。]*/g, "").trim();
      const clauses = strippedFuture
        .split(/(?:してから|てから|そのあと|その後|それから|そして|然后|接着|之后|再用|再(?=[贴用放出派打攻防换抽回拉给把让去上])|、|，|。)/)
        .map((s) => s.trim())
        .filter(Boolean);

      const actions = [];
      for (const c of clauses) {
        const fuzzyItem = SpecEngine.matchItem(c);

        if (/(エネ回収|エネルギー回収|かいしゅう|トラッシュからエネ|捨て札からエネ|能量回收|回收能量|从弃牌区拿能量|捡回能量|捞能量|拿回能量)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_recycle")) {
          actions.push({ type: "USE_ITEM", card_id: "item_recycle", target: null });
          continue;
        }
        if (/(エネルギー|えねるぎー|エネ|えね|能量|贴能|火能|水能|雷能|充能|给.{0,6}(?:贴|充|加)(?:能|火|水|雷)|贴[个张]?(?:炎|火|水|雷))/.test(c) || (fuzzyItem && fuzzyItem.category === "energy")) {
          let cardId = fuzzyItem && fuzzyItem.category === "energy" ? fuzzyItem.id : null;
          if (/水|みず/.test(c)) cardId = "energy_water";
          else if (/雷|かみなり|でんき/.test(c)) cardId = "energy_thunder";
          else if (/炎|火|ほのお/.test(c)) cardId = "energy_fire";
          const target = this.resolveSlotFromText(c, "player", board);
          actions.push({ type: "ATTACH_ENERGY", card_id: cardId, target });
          continue;
        }
        if (/(よびだし笛|呼び出し笛|ふえ|引っ張り|引きずり出|強制交代|前に引き|召唤笛|吹笛|强拉|拉上来|拉人|拉对面|拉对手|拉后排|把对面.{0,8}拉)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_flute")) {
          actions.push({ type: "USE_ITEM", card_id: "item_flute", target: this.resolveSlotFromText(c, "enemy", board) });
          continue;
        }
        const matchedSkillEarly = SpecEngine.matchSkill(c);
        const matchedPlayerMon = SpecEngine.matchMonster(c, "player");
        const isSummonClause = /(ベンチに出|ベンチに置|ベンチに入|べんちに出|後ろに出|後ろに置|場に出|召喚|しょうかん|を出す|を出して|をだす|をだして|を置く|を置いて|备战区|放到?备战|放上备战|下怪|放上场|放到场上|放到后排|派上后排|派上场|上场|出战|召唤)/.test(c)
          && !matchedSkillEarly && !this.hasExplicitDefendIntent(c)
          && !/(狙撃|狙击|点杀|交代|こうたい|撤退|てったい|换人|换上|换下|撤下去|きずぐすり|回復|かいふく|伤药|回血|奶)/.test(c);
        const isShortMonDeploy = Boolean(matchedPlayerMon) && !matchedSkillEarly && !this.hasExplicitDefendIntent(c)
          && /(出|放|派|上|下|置)/.test(c)
          && !/(攻撃|こうげき|攻击|技|招|能量|エネ|きずぐすり|回復|かいふく|伤药|奶|交代|こうたい|撤退|てったい|换|撤下去|拉回)/.test(c);
        if (isSummonClause || isShortMonDeploy) {
          actions.push({ type: "PLAY_BENCH", card_id: matchedPlayerMon ? matchedPlayerMon.id : null });
          continue;
        }
        if (/(きずぐすり|回復|かいふく|ヒール|ポーション|体力回復|HP回復|伤药|回血|补血|治疗|加血|加点血|奶一口|奶一下|吃药|喝药)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_potion")) {
          actions.push({ type: "USE_ITEM", card_id: "item_potion", target: this.resolveSlotFromText(c, "player", board) });
          continue;
        }
        if (/(補給バッグ|ほきゅう|ドロー|2枚引|カードを引|补给包|抽牌|抽两张|抽2张|摸两张|摸2张|摸牌|过牌|补牌)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_bag")) {
          actions.push({ type: "USE_ITEM", card_id: "item_bag", target: null });
          continue;
        }
        if (/(パワーバッジ|ぱわーばっじ|攻撃力アップ|火力アップ|バフ|力量徽章|加攻|加20攻|加伤害|增伤|強化|强化)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_power")) {
          actions.push({ type: "USE_ITEM", card_id: "item_power", target: null });
          continue;
        }
        if (/(交代|こうたい|入れ替|いれかえ|下げて|さげて|逃げて|にげる|撤退|てったい|チェンジ|スイッチ|ベンチに戻|换人|换上|换下|退回|下场|撤下去|拉回后排|切回|切换|把.{0,8}换(?:到|上|下|成|为|出)|换.{0,6}(?:上|下|成|为|出))/.test(c)) {
          let target = this.resolveSlotFromText(c, "player", board);
          if (target === "player_active") target = null;
          actions.push({ type: "RETREAT", target });
          continue;
        }
        if (this.hasExplicitDefendIntent(c)) {
          actions.push({ type: "DEFEND", target: "player_active" });
          continue;
        }

        if (matchedSkillEarly) {
          actions.push({ type: "ATTACK", skill_name: matchedSkillEarly.name_ja, target: this.resolveSlotFromText(c, "enemy", board) });
          continue;
        }
        if (this.hasExplicitAttackIntent(c)) {
          actions.push({ type: "ATTACK", skill_name: null, target: this.resolveSlotFromText(c, "enemy", board) });
          continue;
        }
        if (this.hasExplicitEndTurnIntent(c, isVoice)) {
          actions.push({ type: "END_TURN" });
        }
      }
      /* 若同句同时包含防御/攻击与回合结束，去掉多余的 END_TURN（防御与攻击本身即结束回合） */
      if (actions.some((a) => a.type === "DEFEND" || a.type === "ATTACK")) {
        for (let i = actions.length - 1; i >= 0; i--) {
          if (actions[i].type === "END_TURN") actions.splice(i, 1);
        }
      }

      if (actions.length === 0 && /キャンセル|やめる|取り消|取消|算了/.test(fixed)) {
        return { transcript: fixed, status: "execute", actions: [{ type: "CANCEL" }], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
      }

      if (actions.length === 0 && conversationContext?.pending?.originalUtterance && !fixed.includes(conversationContext.pending.originalUtterance)) {
        const merged = `${conversationContext.pending.originalUtterance} ${fixed}`;
        const retry = this.localParse(merged, board, null, opts);
        if (retry.actions && retry.actions.length > 0) return retry;
      }

      if (actions.length === 0) {
        const phrase = this.pickClarifyPhrase();
        return {
          transcript: fixed, status: "clarify", actions: [],
          reply_ja: phrase.ja,
          reply_zh: phrase.zh,
          rival_ja: "", rival_zh: ""
        };
      }
      return { transcript: fixed, status: "execute", actions, reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
    },

    /** 判断语音转写是否为空白、纯标点或无音占位文本 */
    isMeaninglessTranscript(text) {
      const raw = String(text || "").trim();
      if (!raw) return true;
      if (/^[（(\[【]?(音声|無音|雑音|silence|noise|inaudible|music|blank_audio)[）)\]】]?$/i.test(raw)) return true;
      const core = raw.replace(/[\s　「」『』（）()【】\[\]、，。.,！!？?・\-ー…~～]/g, "");
      return core.length === 0;
    },

    /** 严格判定结束回合意图：语音模式自动过滤裁判播报回声与2字环境残音，仅匹配明确结束回合短语 */
    hasExplicitEndTurnIntent(text, isVoice = false) {
      const s = String(text || "").trim();
      if (!s) return false;
      if (isVoice) {
        // 拦截裁判自身播报的回声片段（如「ターン終了。相手レンの番です」「防御態勢に入りました…ターン終了です」）
        if (/(相手の番|レンの番|相手レン|あなたの番|防御態勢に入り|被ダメージ|ダメージを与え|ターン終了[。、!！]\s*相手)/.test(s)) {
          return false;
        }
        return /(ターンエンド|たーんえんど|ターン終了|ターン終わ|ターンおわり|ターンを終わ|ターンを渡|パスします|行动结束|结束回合|回合结束|跳过回合|直接跳过|跳过这回合|结束这回合|过回合|结束我的回合)/.test(s);
      }
      if (/(ターンエンド|たーんえんど|ターン終了|ターン終わ|ターンおわり|ターンを終わ|ターンを渡|そっちの番|相手の番|レンの番|パスします|これで終わり|行动结束|结束回合|回合结束|跳过回合|直接跳过|跳过这回合|结束这回合|过回合|到你了|轮到你|换你了|我好了|结束我的回合)/.test(s)) {
        return true;
      }
      const stripped = s.replace(/[\s　「」『』（）()【】\[\]、，。.,！!？?・\-ー]/g, "");
      return /^(終わり|おわり|パス|跳过|结束|结束了)$/.test(stripped);
    },

    /** 严格判定防御意图（覆盖日/中汉字、平假名、外来语及常用口语表达） */
    hasExplicitDefendIntent(text) {
      const s = String(text || "").trim();
      if (!s) return false;
      if (/(防御|ぼうぎょ|ガード|ディフェンス|シールド|守り|守る|守って|守ろう|まもり|まもる|まもって|防ぐ|防いで|ふせぐ|固める|耐える|態勢を固め|防御にする|防守|守住|先守住|防一下|设防|开防|先防|防吧|挡一下|格挡|护盾|防御姿态)/.test(s)) {
        return true;
      }
      const stripped = s.replace(/[\s　「」『』（）()【】\[\]、，。.,！!？?・\-ー]/g, "");
      return /^(防|守)$/.test(stripped);
    },

    /** 严格判定攻击意图：覆盖日/中全场景口语与狙击后排，排除“打算/打开/不打/打不过/下回合再打”等非攻击口语 */
    hasExplicitAttackIntent(text) {
      const cleaned = String(text || "")
        .replace(/(?:下回合|下一回合|下次|等会|等一下|一会儿|待会|明天|次のターン|あとで|後で)再?[^、，。]*/g, "")
        .replace(/打算|打开|打不开|打不过|不打|别打|不要打|没打|打断|打字/g, "");
      return /(攻撃|こうげき|アタック|殴|なぐる|なぐって|撃って|撃つ|うって|うつ|叩く|叩いて|たたいて|狙撃|ベンチを狙|仕掛け|突撃|ぶっ飛ば|倒せ|技|わざ|スキル|攻击|进攻|出招|技能|狙击|点杀|平a|平A|普攻|出击|上吧|直接打|动手|开火|打一下|打他|打它|打她|打对面|打对手|打前排|打后排|打怪|打死|秒了|秒掉|干掉|击倒|开打|打过去|一击|放招|用招)/.test(cleaned);
    },

    /** 判断玩家在追问状态下的新发言是否属于明确的取消改口或全新动作指令（而非对当前追问的回答） */
    isExplicitNewCommandOverride(rawText, pending, board) {
      if (!pending || pending.type === "promote_bench" || pending.type === "confirm_surrender") return false;
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();
      if (!fixed) return false;
      const parsed = this.localParse(fixed, board, null);
      if (parsed.status !== "execute" || !Array.isArray(parsed.actions) || parsed.actions.length === 0) return false;
      const nonCancel = parsed.actions.filter((a) => a.type !== "CANCEL");
      if (nonCancel.length === 0) return false;
      if (/(キャンセル|やめる|取り消|取消|算了|不对|别)/.test(fixed)) return true;
      const pendingActionType = pending.context?.action?.type || pending.context?.actionType || (pending.type === "choose_skill" ? "ATTACK" : null);
      const pendingCardId = pending.context?.action?.card_id || pending.context?.cardId || null;
      return nonCancel.every((a) => {
        if (pendingActionType && a.type !== pendingActionType) return true;
        if (a.type === "USE_ITEM" && pendingCardId && a.card_id && a.card_id !== pendingCardId) return true;
        return false;
      });
    },

    /** 按子句拆分复句，提取指定动作对应的子句（防止同一句话中另一操作提到的怪兽串台成为本操作对象） */
    extractClauseForAction(rawText, actType, cardId = null) {
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();
      const clauses = fixed
        .split(/(?:してから|てから|そのあと|その後|それから|そして|然后|接着|之后|再用|再(?=[贴用放出派打攻防换抽回拉给把让去上])|、|，|。)/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (clauses.length <= 1) return fixed;
      const matchers = {
        ATTACH_ENERGY: (c) => /(エネルギー|エネ|能量|贴|充能|火能|水能|雷能)/.test(c),
        PLAY_BENCH: (c) => /(ベンチ|後ろ|場に出|召喚|出す|置く|备战|下怪|上场|出战|召唤|后排)/.test(c),
        USE_ITEM: (c) => cardId === "item_potion" ? /(きずぐすり|回復|ヒール|ポーション|伤药|回血|补血|治|加血|加点血|奶|药)/.test(c)
          : (cardId === "item_flute" ? /(よびだし笛|呼び出|引っ張り|引きずり|強制交代|召唤笛|吹笛|强拉|拉)/.test(c) : /(道具|グッズ|補給|ドロー|抽|摸|過牌|过牌|バッジ|加攻|バフ|回収|回收|捞|捡|使|用)/.test(c)),
        RETREAT: (c) => /(交代|入れ替|下げ|逃げ|にげる|撤退|チェンジ|スイッチ|ベンチに戻|换|退|切|撤下去|拉回)/.test(c),
        ATTACK: (c) => Boolean(SpecEngine.matchSkill(c)) || this.hasExplicitAttackIntent(c)
      };
      const fn = matchers[actType];
      if (!fn) return fixed;
      const hit = clauses.find(fn);
      return hit || "";
    }
  };

  /* =========================================================================
     5. BattleEngine（对战状态机 + 追问记忆 + 贴能解锁反馈 + 对手 AI「レン」）
     ========================================================================= */
  const BattleEngine = {
    state: null,
    matchSeq: 0,
    activeAbortCtrl: null,
    idleTimer: null,
    idleNudgeCount: 0,
    dialogueHistory: [],
    lastPlayerUtterance: "",

    /** 受对局代数令牌保护的异步延时：重开对局或对局结束时立即失效，杜绝幽灵回调污染新局 */
    async matchDelay(ms, seq = this.matchSeq) {
      await delay(ms);
      return seq === this.matchSeq && Boolean(this.state) && !this.state.gameOver;
    },

    /** 20 张快节奏牌组随机洗牌：保底起手 5 张至少含 1 对同色「怪兽+能量」（优先非 ex），且奖赏卡最多盖入 1 只怪兽 */
    dealGuaranteedOpening(pool) {
      const arr = [...pool];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      const hand = arr.slice(0, 5);
      const prizes = arr.slice(5, 5 + TOTAL_PRIZES);
      const deck = arr.slice(5 + TOTAL_PRIZES);
      const isMon = (id) => Boolean(SpecEngine.getMonster(id)) || /^[pe]_/.test(id);
      const isNonExMon = (id) => isMon(id) && !/_ex$/i.test(id);
      const swapFromOutside = (handIdx, pred) => {
        let idx = deck.findIndex(pred);
        if (idx !== -1) { [hand[handIdx], deck[idx]] = [deck[idx], hand[handIdx]]; return true; }
        idx = prizes.findIndex(pred);
        if (idx !== -1) { [hand[handIdx], prizes[idx]] = [prizes[idx], hand[handIdx]]; return true; }
        return false;
      };

      /* 1. 保底起手至少 1 只怪兽（优先非 ex 基础怪兽） */
      if (!hand.some(isMon)) {
        if (!swapFromOutside(0, isNonExMon)) swapFromOutside(0, isMon);
      }
      /* 2. 保底起手至少 1 张与手中某只怪兽同色的能量卡，大幅降低 T1 卡色空过率 */
      const handMonDefs = hand.map((id) => SpecEngine.getMonster(id)).filter(Boolean);
      const hasMatchingPair = handMonDefs.some((m) => hand.includes(`energy_${m.element}`));
      if (!hasMatchingPair && handMonDefs.length > 0) {
        const targetElem = (handMonDefs.find((m) => !m.is_ex) || handMonDefs[0]).element;
        const needEnergy = `energy_${targetElem}`;
        let swapSlot = hand.findIndex((id) => !isMon(id) && !id.startsWith("energy_"));
        if (swapSlot === -1) swapSlot = hand.findIndex((id) => !isMon(id));
        if (swapSlot === -1) swapSlot = 1;
        if (!swapFromOutside(swapSlot, (id) => id === needEnergy)) {
          if (!hand.some((id) => id.startsWith("energy_"))) swapFromOutside(swapSlot, (id) => id.startsWith("energy_"));
        }
      }
      /* 3. 限制奖赏卡最多埋入 1 只怪兽，避免前期无后备怪兽猝死 */
      let prizeMonCount = prizes.filter(isMon).length;
      while (prizeMonCount > 1) {
        const pIdx = prizes.findIndex(isMon);
        const dIdx = deck.findIndex((id) => !isMon(id));
        if (pIdx === -1 || dIdx === -1) break;
        [prizes[pIdx], deck[dIdx]] = [deck[dIdx], prizes[pIdx]];
        prizeMonCount -= 1;
      }
      return { hand, prizes, deck };
    },

    /** 双方 20 张对称标准卡表（双方均为 5 怪兽 + 8 能量 + 4 支援者 + 2 伤药 + 1 能量回收） */
    INITIAL_DECKS: {
      player: [
        "p_fox", "p_turtle", "p_lion", "p_lion", "p_dragon_ex",
        "energy_fire", "energy_fire", "energy_fire", "energy_water", "energy_water", "energy_thunder", "energy_thunder", "energy_thunder",
        "item_bag", "item_bag", "item_power", "item_flute", "item_potion", "item_potion", "item_recycle"
      ],
      enemy: [
        "e_dog", "e_dog", "e_fish", "e_bird", "e_shark_ex",
        "energy_fire", "energy_fire", "energy_fire", "energy_water", "energy_water", "energy_water", "energy_thunder", "energy_thunder",
        "item_bag", "item_bag", "item_power", "item_flute", "item_potion", "item_potion", "item_recycle"
      ]
    },

    /** 手牌自动排序权重：怪兽（普通→ex） → 支援者 → 道具 → 能量（炎→水→雷） */
    getHandSortRank(cardId) {
      const elemOrder = { fire: 0, water: 1, thunder: 2 };
      const mon = SpecEngine.getMonster(cardId);
      if (mon) {
        return (mon.is_ex ? 50 : 0) + (elemOrder[mon.element] ?? 9) * 10 + (mon.hp || 0) / 1000;
      }
      const fixedOrder = {
        item_bag: 101,
        item_power: 102,
        item_flute: 103,
        item_potion: 151,
        item_recycle: 152,
        energy_fire: 201,
        energy_water: 202,
        energy_thunder: 203
      };
      if (fixedOrder[cardId] !== undefined) return fixedOrder[cardId];
      const it = SpecEngine.getItem(cardId);
      if (it && it.category === "supporter") return 120;
      if (it && it.category === "item") return 170;
      if (it && it.category === "energy") return 220;
      return 300;
    },

    /** 对手牌数组就地按卡牌类型自动排序 */
    sortHandArray(handArr) {
      if (!Array.isArray(handArr) || handArr.length <= 1) return handArr;
      handArr.sort((a, b) => {
        const diff = this.getHandSortRank(a) - this.getHandSortRank(b);
        return diff !== 0 ? diff : String(a).localeCompare(String(b));
      });
      return handArr;
    },

    /** 玩家手动拖拽调整手牌顺序（并同步已选中的手牌索引） */
    reorderPlayerHand(fromIdx, toIdx) {
      const s = this.state;
      if (!s || !Array.isArray(s.player?.hand)) return false;
      const hand = s.player.hand;
      if (fromIdx < 0 || fromIdx >= hand.length || toIdx < 0 || toIdx >= hand.length || fromIdx === toIdx) return false;
      const [moved] = hand.splice(fromIdx, 1);
      hand.splice(toIdx, 0, moved);
      if (s.selectedHandIndex === fromIdx) {
        s.selectedHandIndex = toIdx;
      } else if (s.selectedHandIndex !== null) {
        if (fromIdx < s.selectedHandIndex && toIdx >= s.selectedHandIndex) s.selectedHandIndex--;
        else if (fromIdx > s.selectedHandIndex && toIdx <= s.selectedHandIndex) s.selectedHandIndex++;
      }
      return true;
    },

    /** 开局状态：空场开局，双方 20 张快节奏卡组洗牌发 5 张保底起手 + 3 张盖放奖赏卡 + 12 张牌库 */
    createInitialState() {
      const pDeckSrc = SpecEngine.decks?.player || this.INITIAL_DECKS.player;
      const eDeckSrc = SpecEngine.decks?.enemy || this.INITIAL_DECKS.enemy;
      const pDeal = this.dealGuaranteedOpening(pDeckSrc);
      const eDeal = this.dealGuaranteedOpening(eDeckSrc);
      this.sortHandArray(pDeal.hand);
      return {
        phase: "setup",
        turn: 1,
        currentPlayer: "player",
        busy: false,
        gameOver: false,
        winner: null,
        energyUsedThisTurn: false,
        supporterUsedThisTurn: false,
        retreatedThisTurn: false,
        pending: null,
        selectedHandIndex: null,
        recentlyUnlocked: null,
        player: {
          prizes: pDeal.prizes,
          prizesLeft: pDeal.prizes.length,
          attackBoost: 0,
          active: null,
          bench: [null, null, null],
          hand: pDeal.hand,
          deck: pDeal.deck,
          trash: []
        },
        enemy: {
          prizes: eDeal.prizes,
          prizesLeft: eDeal.prizes.length,
          attackBoost: 0,
          active: null,
          bench: [null, null, null],
          hand: eDeal.hand,
          deck: eDeal.deck,
          trash: []
        }
      };
    },

    /** 计算怪兽被击倒时提供的奖赏卡张数（ex 怪兽为 2 张，普通怪兽为 1 张） */
    getPrizeValue(monId) {
      const def = SpecEngine.getMonster(monId);
      return (def && def.is_ex) || /_ex$/i.test(monId || "") ? 2 : 1;
    },

    /** 计算属性弱点加成（水→炎、炎→雷、雷→水 触发 +20） */
    getWeaknessBonus(attackerElem, defenderElem) {
      return WEAKNESS_MAP[defenderElem] === attackerElem ? WEAKNESS_BONUS : 0;
    },

    /** 记录最近 6 条对话历史，用于追问时保持上下文记忆 */
    pushHistory(role, text) {
      const clean = String(text || "").trim();
      if (!clean) return;
      this.dialogueHistory.push({ role, text: clean });
      if (this.dialogueHistory.length > 6) this.dialogueHistory.shift();
      if (role === "player") this.lastPlayerUtterance = clean;
    },

    getConversationContext() {
      const p = this.state?.pending;
      return {
        lastPlayerUtterance: this.lastPlayerUtterance,
        history: this.dialogueHistory.slice(-6),
        pending: p ? {
          type: p.type,
          promptJa: p.promptJa,
          originalUtterance: p.originalUtterance || this.lastPlayerUtterance
        } : null
      };
    },

    clearIdleTimer() {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    },

    resetIdleTimer(resetCount = true) {
      this.clearIdleTimer();
      if (resetCount) this.idleNudgeCount = 0;
      const s = this.state;
      const sec = Number(ConfigManager.data.idlePromptSec) || 0;
      if (!s || s.gameOver || s.busy || s.currentPlayer !== "player" || !VoiceEngine.callActive || sec <= 0) {
        return;
      }
      /* 语音正在播报或排队时先不倒计时，等全部说完后由 VoiceEngine 自动启动静默计时 */
      if (VoiceEngine.isSpeaking || (VoiceEngine.pendingSpeakCount || 0) > 0) {
        return;
      }
      if (this.idleNudgeCount >= 2) return;
      const waitMs = (this.idleNudgeCount === 0 ? sec : sec + 20) * 1000;
      this.idleTimer = setTimeout(() => this.triggerIdleNudge(), waitMs);
    },

    async triggerIdleNudge() {
      const s = this.state;
      const sec = Number(ConfigManager.data.idlePromptSec) || 0;
      if (!s || s.gameOver || s.busy || s.currentPlayer !== "player" || !VoiceEngine.callActive || sec <= 0) return;
      /* 兜底保护：若仍在播报、玩家正在说话、或距上一句播完不足设定静默时长，则顺延而不抢话 */
      if (VoiceEngine.isSpeaking || (VoiceEngine.pendingSpeakCount || 0) > 0 || VoiceEngine.vadRecorder || VoiceEngine.vadCapturing) {
        this.resetIdleTimer(false);
        return;
      }
      const minQuietMs = (this.idleNudgeCount === 0 ? sec : sec + 20) * 1000;
      if (VoiceEngine.lastSpeakEndAt && Date.now() - VoiceEngine.lastSpeakEndAt < minQuietMs - 800) {
        this.resetIdleTimer(false);
        return;
      }
      this.idleNudgeCount += 1;

      let ja = "";
      let zh = "";
      if (s.pending) {
        ja = `どうした、まだ決まらないのか？${s.pending.promptJa || "選択してくれよ！"}`;
        zh = `怎么了，还没决定吗？${s.pending.promptZh || "快选一个吧！"}`;
      } else if (this.idleNudgeCount === 1) {
        const base = SpecEngine.getRivalLine("idle_1");
        const act = s.player.active;
        const def = act ? SpecEngine.getMonster(act.id) : null;
        const hasEnergy = !s.energyUsedThisTurn && s.player.hand.some((id) => id.startsWith("energy_"));
        const extraJa = hasEnergy && def ? `${def.name_ja}にエネを貼る手もあるぜ。` : "";
        const extraZh = hasEnergy && def ? `也可以先给${def.name_zh}贴张能量哦。` : "";
        ja = (base.ja || "おい、考え中か？技を出すか手札を使うか選んでくれよ！") + extraJa;
        zh = (base.zh || "喂，在思考吗？快决定出招还是用手牌吧！") + extraZh;
      } else {
        const base = SpecEngine.getRivalLine("idle_2");
        ja = base.ja || "ずいぶん悩んでるな。迷ったら「攻撃して」って言えば審判が技を教えてくれるぜ。";
        zh = base.zh || "想了挺久啊。犹豫的话直接说「攻击」，裁判会提醒你可用技能哦。";
      }

      TableUI.setRival(ja, zh);
      TableUI.appendLog(`【レン】${ja}`, `【莲】${zh}`);
      await VoiceEngine.speak(ja, "rival");
      this.resetIdleTimer(false);
    },

    reset(triggerGuideVoice = false) {
      this.matchSeq += 1;
      if (this.activeAbortCtrl) {
        try { this.activeAbortCtrl.abort(); } catch (_) {}
        this.activeAbortCtrl = null;
      }
      this.clearIdleTimer();
      VoiceEngine.stopPlayback();
      GuideEngine.reset();
      this.state = this.createInitialState();
      this.dialogueHistory = [];
      this.lastPlayerUtterance = "";
      TableUI.logEntries = [];
      $("gameOverModal").classList.remove("open");
      TableUI.closeEndTurnConfirmModal();
      const startLine = SpecEngine.getRivalLine("start");
      TableUI.setRival(startLine.ja, startLine.zh);
      TableUI.appendLog("対戦準備：手札5枚（モンスター＋エネ保証）を引き、サイド3枚をセットしました。", "开局准备：各抽 5 张保底起手并盖放 3 张奖赏卡。");
      const ja = "手札の緑枠モンスターをクリック（または名前を言って）し、バトル場の最初の1体を選んでください。";
      const zh = "请点击手牌中绿色高亮的怪兽（或说出怪兽名），选择战斗区首发！";
      TableUI.setReferee(ja, zh);
      TableUI.renderAll();
      if (triggerGuideVoice || !$("rulesModal")?.classList.contains("open")) {
        GuideEngine.trigger("setup_starter", triggerGuideVoice);
      }
      this.resetIdleTimer(true);
    },

    /** 从文本或指令中解析玩家开局选择的手牌首发怪兽索引 */
    resolveStarterHandIndex(rawText, fallbackCardId = null) {
      const s = this.state;
      if (!s) return -1;
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();
      const matchedMon = SpecEngine.matchMonster(fixed, "player");
      if (matchedMon) {
        const idx = s.player.hand.indexOf(matchedMon.id);
        if (idx !== -1) return idx;
      }
      if (fallbackCardId && SpecEngine.getMonster(fallbackCardId)) {
        const idx = s.player.hand.indexOf(fallbackCardId);
        if (idx !== -1) return idx;
      }
      const monIndices = s.player.hand
        .map((id, idx) => (SpecEngine.getMonster(id) ? idx : -1))
        .filter((idx) => idx !== -1);
      if (/(1|１|1番目|１番目|最初|ひとつ|第一|一番左|最左|左边|左)/.test(fixed) && monIndices[0] !== undefined) return monIndices[0];
      if (/(2|２|2番目|２番目|ふたつ|第二|真ん中|中央|中间)/.test(fixed) && monIndices[1] !== undefined) return monIndices[1];
      if (/(3|３|3番目|３番目|みっつ|第三|一番右|最右|右边|右)/.test(fixed) && monIndices.length > 0) {
        return monIndices[2] !== undefined ? monIndices[2] : monIndices[monIndices.length - 1];
      }
      if (/(先発|首发|随便|任意|どれでも|おまかせ|任せ)/.test(fixed) && monIndices.length > 0) return monIndices[0];
      return -1;
    },

    /** 开局阶段：玩家选定首发怪兽后，双方亮牌并抽取第 1 回合的 1 张牌正式开战 */
    selectStartingMonster(handIdx) {
      const s = this.state;
      if (!s || s.phase !== "setup") return false;
      const monId = s.player.hand[handIdx];
      const def = SpecEngine.getMonster(monId);
      if (!def) return false;

      GuideEngine.hide();
      s.player.hand.splice(handIdx, 1);
      s.player.active = { id: monId, hp: def.hp, energies: [], guard: 0 };

      /* 对手从起手手牌挑选最优首发（优先有对应属性手牌能量的普通怪兽，其次按血量挑） */
      const eMonIndices = s.enemy.hand
        .map((id, idx) => ({ id, idx, def: SpecEngine.getMonster(id) }))
        .filter((x) => x.def);
      eMonIndices.sort((a, b) => {
        const aMatch = s.enemy.hand.includes(`energy_${a.def.element}`) ? 1 : 0;
        const bMatch = s.enemy.hand.includes(`energy_${b.def.element}`) ? 1 : 0;
        const aScore = aMatch * 40 + (a.def.is_ex ? 5 : 20) + a.def.hp * 0.2;
        const bScore = bMatch * 40 + (b.def.is_ex ? 5 : 20) + b.def.hp * 0.2;
        return bScore - aScore;
      });
      const ePick = eMonIndices[0];
      let eStarterDef = null;
      if (ePick) {
        s.enemy.hand.splice(ePick.idx, 1);
        eStarterDef = ePick.def;
        s.enemy.active = { id: ePick.id, hp: ePick.def.hp, energies: [], guard: 0 };
      }
      /* 开局准备：若对手起手还有多余非 ex 怪兽，同步暗置 1 只到备战区，杜绝先手 T1 秒杀猝死 */
      const extraEnemyIdx = s.enemy.hand.findIndex((id) => {
        const d = SpecEngine.getMonster(id);
        return d && !d.is_ex;
      });
      if (extraEnemyIdx !== -1 && s.enemy.bench[0] === null) {
        const extraId = s.enemy.hand.splice(extraEnemyIdx, 1)[0];
        const extraDef = SpecEngine.getMonster(extraId);
        s.enemy.bench[0] = { id: extraId, hp: extraDef.hp, energies: [], guard: 0 };
      }

      s.phase = "battle";
      s.pending = null;
      s.selectedHandIndex = null;
      const firstDraw = this.drawCard("player", 1);
      const drawJa = firstDraw[0] ? `1ターン目のドローで「${firstDraw[0].ja}」を引きました。` : "";
      const drawZh = firstDraw[0] ? `第 1 回合抽到了「${firstDraw[0].zh}」。` : "";
      const ja = `バトル開始！自分は${def.name_ja}、相手は${eStarterDef ? eStarterDef.name_ja : "モンスター"}でスタート！${drawJa}`;
      const zh = `对战正式开始！己方首发${def.name_zh}，对手派出${eStarterDef ? eStarterDef.name_zh : "怪兽"}！${drawZh}`;
      TableUI.renderAll();
      SoundFX.play("tap");
      TableUI.flashAnim("player_active", "anim-enter");
      TableUI.flashAnim("enemy_active", "anim-enter");
      TableUI.showTurnBanner("⚔️ ターン 1：あなたの番", "第 1 回合：你的回合", false);
      this.announceAndReact(ja, zh, def.is_ex ? "play_ex" : "start");
      if (def.is_ex) GuideEngine.trigger("first_ex_card", false);
      else GuideEngine.trigger("first_turn_energy", false);
      this.resetIdleTimer(true);
      return true;
    },

    /** 从盖放的奖赏卡中抽取指定张数加入手牌，并同步剩余奖赏卡数量 */
    takePrizes(side, count) {
      const st = this.state[side];
      const taken = [];
      const n = Math.min(count, st.prizes.length);
      for (let i = 0; i < n; i++) {
        const id = st.prizes.shift();
        st.hand.push(id);
        const m = SpecEngine.getMonster(id);
        const it = SpecEngine.getItem(id);
        taken.push({
          ja: m ? m.name_ja : (it ? it.name_ja : id),
          zh: m ? m.name_zh : (it ? it.name_zh : id)
        });
      }
      if (side === "player" && taken.length > 0) this.sortHandArray(st.hand);
      st.prizesLeft = st.prizes.length;
      return taken;
    },

    getSnapshot() {
      const s = this.state;
      const fmtUnit = (u, slot) => {
        if (!u) return null;
        const d = SpecEngine.getMonster(u.id);
        return { slot, id: u.id, name_ja: d?.name_ja, name_zh: d?.name_zh, hp: u.hp, max_hp: d?.hp, energies: u.energies, guard: u.guard };
      };
      return {
        turn: s.turn,
        player_energy_used_this_turn: s.energyUsedThisTurn,
        player_supporter_used_this_turn: s.supporterUsedThisTurn,
        player_retreated_this_turn: s.retreatedThisTurn,
        pending: s.pending ? s.pending.type : null,
        player: {
          sides_left: s.player.prizesLeft,
          active: fmtUnit(s.player.active, "player_active"),
          bench: s.player.bench.map((u, i) => fmtUnit(u, `player_bench_${i}`)).filter(Boolean),
          hand: s.player.hand.map((id) => {
            const m = SpecEngine.getMonster(id);
            const it = SpecEngine.getItem(id);
            return m ? `${m.name_ja}(${m.name_zh})` : (it ? `${it.name_ja}(${it.name_zh})` : id);
          })
        },
        enemy: {
          sides_left: s.enemy.prizesLeft,
          active: fmtUnit(s.enemy.active, "enemy_active"),
          bench: s.enemy.bench.map((u, i) => fmtUnit(u, `enemy_bench_${i}`)).filter(Boolean)
        }
      };
    },

    canPayCost(energies, costArr) {
      if (!costArr || costArr.length === 0) return true;
      const pool = [...(energies || [])];
      let anyNeeded = 0;
      for (const req of costArr) {
        if (req === "any") { anyNeeded++; continue; }
        const idx = pool.indexOf(req);
        if (idx === -1) return false;
        pool.splice(idx, 1);
      }
      return pool.length >= anyNeeded;
    },

    /** 计算技能每个能量槽的实际填充状态与颜色（将 any 槽映射为已附着的实际属性色） */
    resolveCostPips(energies, costArr) {
      const pool = [...(energies || [])];
      const slots = (costArr || []).map((req) => ({ req, filled: false, elem: req }));
      for (const s of slots) {
        if (s.req === "any") continue;
        const idx = pool.indexOf(s.req);
        if (idx !== -1) {
          pool.splice(idx, 1);
          s.filled = true;
          s.elem = s.req;
        }
      }
      for (const s of slots) {
        if (s.req !== "any") continue;
        if (pool.length > 0) {
          s.elem = pool.shift();
          s.filled = true;
        }
      }
      return slots;
    },

    getSlotUnit(slot) {
      const s = this.state;
      if (slot === "player_active") return s.player.active;
      if (slot === "enemy_active") return s.enemy.active;
      const pm = /^player_bench_([0-2])$/.exec(slot || "");
      if (pm) return s.player.bench[Number(pm[1])];
      const em = /^enemy_bench_([0-2])$/.exec(slot || "");
      if (em) return s.enemy.bench[Number(em[1])];
      return null;
    },

    getBenchEntries(side) {
      return this.state[side].bench
        .map((u, idx) => (u ? { slot: `${side}_bench_${idx}`, idx, unit: u, def: SpecEngine.getMonster(u.id) } : null))
        .filter(Boolean);
    },

    getAllEntries(side) {
      const list = [];
      const act = this.state[side].active;
      if (act) list.push({ slot: `${side}_active`, idx: -1, unit: act, def: SpecEngine.getMonster(act.id) });
      return list.concat(this.getBenchEntries(side));
    },

    drawCard(side, count) {
      const drawn = [];
      const st = this.state[side];
      for (let i = 0; i < count; i++) {
        if (st.deck.length === 0) break;
        const id = st.deck.shift();
        st.hand.push(id);
        const m = SpecEngine.getMonster(id);
        const it = SpecEngine.getItem(id);
        drawn.push({
          ja: m ? m.name_ja : (it ? it.name_ja : id),
          zh: m ? m.name_zh : (it ? it.name_zh : id)
        });
      }
      if (side === "player" && drawn.length > 0) this.sortHandArray(st.hand);
      return drawn;
    },

    setPending(pendingObj) {
      this.state.pending = {
        ...pendingObj,
        originalUtterance: pendingObj.originalUtterance || this.lastPlayerUtterance || ""
      };
      if (pendingObj.promptJa) this.pushHistory("referee", pendingObj.promptJa);
      TableUI.renderAll();
    },

    clearPending() {
      this.state.pending = null;
      TableUI.closeEndTurnConfirmModal();
      TableUI.renderAll();
    },

    /** 检测当前回合尚未使用的关键操作（用于结束回合智能防误触提醒） */
    getEndTurnOpportunities() {
      const s = this.state;
      if (!s || s.phase !== "battle" || s.currentPlayer !== "player" || s.gameOver) return [];
      const list = [];
      const act = s.player.active;
      if (act) {
        const def = SpecEngine.getMonster(act.id);
        const usableSkills = def ? def.skills.filter((sk) => this.canPayCost(act.energies, sk.cost)) : [];
        if (usableSkills.length > 0) {
          list.push({
            key: "attack",
            ja: `バトル場の${def.name_ja}は「${usableSkills.map((k) => k.name_ja).join("／")}」で攻撃できます`,
            zh: `战斗区的${def.name_zh}当前能量已足够发动「${usableSkills.map((k) => k.name_zh).join("／")}」攻击`
          });
        }
      }
      const hasHandEnergy = s.player.hand.some((id) => {
        const it = SpecEngine.getItem(id);
        return it && it.category === "energy";
      });
      if (!s.energyAttachedThisTurn && hasHandEnergy) {
        list.push({
          key: "energy",
          ja: "このターンはまだエネルギーを貼っていません（手札にエネあり）",
          zh: "本回合尚未贴能量（手牌中还有能量卡）"
        });
      }
      if (act && act.lastDefendedTurn !== s.turn - 1) {
        list.push({
          key: "defend",
          ja: "「防御態勢」を使えば次の被ダメージを -30 軽減できます",
          zh: "本回合可免费进入「防御姿态」（下回合受击 -30）"
        });
      }
      return list;
    },

    /** 顺序执行操作队列；若某一步触发追问，自动保存剩余连招以便确认后继续 */
    async runActionQueue(queue, customRival = null) {
      const s = this.state;
      const seq = this.matchSeq;
      for (let i = 0; i < queue.length; i++) {
        if (seq !== this.matchSeq || s.gameOver || s.currentPlayer !== "player") break;
        const isLast = i === queue.length - 1;
        const ok = await this.executeAction(queue[i], isLast ? customRival : null);
        if (seq !== this.matchSeq) break;
        TableUI.renderAll();
        if (!ok) {
          if (s.pending && i < queue.length - 1) {
            s.pending.remainingActions = queue.slice(i + 1);
            s.pending.customRival = customRival;
          }
          break;
        }
        if (!isLast && !(await this.matchDelay(650, seq))) break;
      }
    },

    /** 牌桌点击直出操作的统一防重入封装（防止快速连点并发触发两次攻击或对手回合） */
    async performDirectAction(act) {
      const s = this.state;
      if (!s || s.gameOver || s.busy || s.currentPlayer !== "player") return;
      if (s.phase === "setup") {
        TableUI.setReferee(
          "まずは手札の緑枠モンスターをクリックして、バトル場の最初の1体を選んでください。",
          "请先点击手牌中绿色高亮的怪兽，选择战斗区首发！"
        );
        GuideEngine.trigger("setup_starter", true);
        return;
      }
      if (s.pending && s.pending.type === "promote_bench") {
        TableUI.setReferee(s.pending.promptJa, s.pending.promptZh);
        return;
      }
      if (s.pending && s.pending.type === "confirm_end_turn") {
        this.clearPending();
      } else {
        TableUI.closeEndTurnConfirmModal();
      }
      GuideEngine.hide();
      this.clearIdleTimer();
      this.idleNudgeCount = 0;
      this.lastPlayerUtterance = "";
      s.busy = true;
      try {
        await this.executeAction(act);
      } finally {
        s.busy = false;
        TableUI.renderAll();
        this.resetIdleTimer(true);
      }
    },

    async handleUserInput(payload) {
      const s = this.state;
      this.clearIdleTimer();
      this.idleNudgeCount = 0;

      if (s.gameOver) {
        TableUI.setReferee("対局は終了しています。「再戦」から新しい試合を始めましょう。", "对局已结束，请点击“重开”开始新对局。");
        return;
      }
      if (s.busy || s.currentPlayer !== "player") {
        TableUI.setReferee("ただいま相手のターン中です。少しお待ちください。", "当前是对手回合，请稍候。");
        return;
      }

      /* 开局选首发阶段：文本直接匹配手牌怪兽，不走右侧确认条 */
      if (s.phase === "setup" && payload.text) {
        const idx = this.resolveStarterHandIndex(payload.text);
        if (idx !== -1) {
          this.selectStartingMonster(idx);
        } else {
          TableUI.setReferee(
            "まずは手札からバトル場に出す最初のモンスター名（またはクリック）で選んでください。",
            "请先从手牌中选择 1 只怪兽作为首发（直接点击绿框怪兽或说出它的名字）。"
          );
          GuideEngine.trigger("setup_starter", true);
        }
        return;
      }

      if (s.pending && payload.text) {
        if (NLUEngine.isExplicitNewCommandOverride(payload.text, s.pending, this.getSnapshot())) {
          this.clearPending();
        } else {
          s.busy = true;
          let handled = false;
          try {
            handled = await this.handlePendingReply(payload.text);
          } finally {
            s.busy = false;
            TableUI.renderAll();
          }
          if (handled) {
            this.resetIdleTimer(true);
            return;
          }
          if (s.pending && s.pending.type === "promote_bench") {
            TableUI.setReferee(s.pending.promptJa, s.pending.promptZh);
            this.resetIdleTimer(true);
            return;
          }
        }
      }

      const convCtx = this.getConversationContext();
      if (payload.text) this.pushHistory("player", payload.text);

      const prevRefJa = $("refereeJa") ? $("refereeJa").textContent : "";
      const prevRefZh = $("refereeZh") ? $("refereeZh").textContent : "";
      s.busy = true;
      TableUI.setReferee("解析中…", "正在解析指令…");
      try {
        const result = await NLUEngine.parse(payload, this.getSnapshot(), convCtx);
        const isVoiceInput = Boolean(payload.audioBase64 || payload.fromVoice);
        const isManualVoice = Boolean(payload.manualVoice);
        const rawHeard = String(result.transcript || payload.text || "").trim();
        const heardText = isVoiceInput ? VoiceEngine.stripSpokenEcho(rawHeard) : rawHeard;
        if (heardText !== rawHeard && result.transcript) result.transcript = heardText;

        if (result.status === "api_error") {
          const switched = VoiceEngine.fallbackToChromeAsr(result.error || "error");
          if (switched) {
            const errJa = VoiceEngine.callActive
              ? `Vertex音声認識失敗（${result.error || "error"}）のため、Chrome標準音声認識へ自動切替しました。そのままもう一度話しかけてください。`
              : `Vertex音声認識失敗（${result.error || "error"}）のため、Chrome標準音声認識へ自動切替しました。もう一度「単発」を押して話してください。`;
            const errZh = VoiceEngine.callActive
              ? `Vertex 语音识别连接失败（${result.error || "网络错误"}），已自动切换为谷歌浏览器语音识别，请直接再说一次。`
              : `Vertex 语音识别连接失败（${result.error || "网络错误"}），已自动切换为谷歌浏览器语音识别，请再点一次「单次」说话。`;
            TableUI.setReferee(errJa, errZh);
            TableUI.appendLog(errJa, errZh);
            TableUI.showToast("Chrome音声認識へ自動切替しました", "已自动切换谷歌语音识别");
          } else {
            const errJa = `音声認識APIに接続できませんでした（${result.error || "error"}）。このブラウザはChrome音声認識に未対応のため、テキスト入力をご利用ください。`;
            const errZh = `语音识别接口连接失败（${result.error || "网络错误"}），且当前浏览器不支持谷歌语音识别，请改用文字输入或点击卡牌。`;
            TableUI.setReferee(errJa, errZh);
            TableUI.appendLog(errJa, errZh);
          }
          return;
        }

        /* 清洗云端返回文本，杜绝模型偶发输出外部 IP 词 */
        if (result.reply_ja) result.reply_ja = sanitizeBrandTerms(result.reply_ja);
        if (result.reply_zh) result.reply_zh = sanitizeBrandTerms(result.reply_zh);
        if (result.rival_ja) result.rival_ja = sanitizeBrandTerms(result.rival_ja);
        if (result.rival_zh) result.rival_zh = sanitizeBrandTerms(result.rival_zh);

        /* 程序逻辑主导（Local-First）：拿到语音转写文本后优先走本地确定性解析器，仅在本地无法识别长尾口语或云端解析出更完整合法连招时才采用云端动作，且 100% 由 BattleEngine 校验执行 */
        if (heardText && !NLUEngine.isMeaninglessTranscript(heardText)) {
          const localFirst = NLUEngine.localParse(heardText, this.getSnapshot(), convCtx, { isVoice: isVoiceInput });
          const validLocalExec = localFirst.status === "execute" && Array.isArray(localFirst.actions) && localFirst.actions.length > 0
            && !(localFirst.actions.length === 1 && localFirst.actions[0].type === "CANCEL" && !s.pending);
          const validLocalSpecial = localFirst.status === "confirm" || localFirst.status === "chat";
          const cloudActions = Array.isArray(result.actions) ? result.actions : [];
          if (validLocalExec) {
            const filteredCloudActions = cloudActions.filter((a) => {
              if (!a || !a.type) return false;
              if (a.type === "END_TURN" && !NLUEngine.hasExplicitEndTurnIntent(heardText, isVoiceInput)) return false;
              if (a.type === "DEFEND" && !NLUEngine.hasExplicitDefendIntent(heardText)) return false;
              return true;
            });
            const cloudIsRicherCombo = result.status === "execute" && filteredCloudActions.length > localFirst.actions.length;
            if (!cloudIsRicherCombo) {
              result.status = "execute";
              result.actions = localFirst.actions;
            }
          } else if (validLocalSpecial && result.status !== "execute") {
            result.status = localFirst.status;
            result.actions = localFirst.actions || [];
            result.reply_ja = localFirst.reply_ja || result.reply_ja;
            result.reply_zh = localFirst.reply_zh || result.reply_zh;
            result.rival_ja = localFirst.rival_ja || result.rival_ja;
            result.rival_zh = localFirst.rival_zh || result.rival_zh;
          }
        }

        /* 语音输入静默/噪声/短语气词/扬声器自回声过滤（手动单次按录不做回声静默吞掉） */
        const isFillerOnly = !s.pending && s.phase !== "setup" && /^[嗯呃啊哦唔哎哈嗯哼あえうおんうんえっとあのー！!。.,，\s]+$/.test(heardText);
        const isEcho = !isManualVoice && VoiceEngine.isLikelySelfEcho(heardText);
        if (isVoiceInput && (
          result.status === "ignore" ||
          NLUEngine.isMeaninglessTranscript(heardText) ||
          isEcho ||
          (!isManualVoice && isFillerOnly)
        )) {
          DebugLog.add(isEcho ? "AEC" : "ASR", isEcho ? "拦截扬声器自回声" : "忽略静音/杂音片段", heardText || "(empty)");
          if (isManualVoice) {
            const fallback = NLUEngine.pickClarifyPhrase();
            TableUI.setReferee(fallback.ja, fallback.zh);
            VoiceEngine.speak(fallback.ja, "referee");
          } else {
            TableUI.setReferee(prevRefJa, prevRefZh);
          }
          return;
        }

        if (heardText && (result.transcript || isVoiceInput)) {
          $("cmdInput").value = heardText;
          if (!payload.text) this.pushHistory("player", heardText);
        }

        /* 开局选首发阶段：语音转写完成后直接匹配手牌首发怪兽 */
        if (s.phase === "setup") {
          const fallbackId = Array.isArray(result.actions) && result.actions[0] ? result.actions[0].card_id : null;
          const idx = this.resolveStarterHandIndex(heardText, fallbackId);
          if (idx !== -1) {
            this.selectStartingMonster(idx);
          } else {
            const ja = "手札の緑枠モンスターの名前を言うか、直接クリックして最初の1体を選んでください。";
            const zh = "请说出绿色高亮手牌怪兽的名字，或直接点击它作为首发！";
            TableUI.setReferee(ja, zh);
            VoiceEngine.clearQueuedOnly(false);
            VoiceEngine.speak(ja, "referee", { priority: "high" });
          }
          return;
        }

        if (s.pending && result.transcript) {
          if (NLUEngine.isExplicitNewCommandOverride(result.transcript, s.pending, this.getSnapshot())) {
            this.clearPending();
          } else {
            const handled = await this.handlePendingReply(result.transcript);
            if (handled) return;
            const cloudResolvedPending = s.pending.type !== "promote_bench" && result.status === "execute" && Array.isArray(result.actions) && result.actions.length > 0;
            if (s.pending && !cloudResolvedPending) {
              TableUI.setReferee(s.pending.promptJa, s.pending.promptZh);
              VoiceEngine.clearQueuedOnly(false);
              VoiceEngine.speak(s.pending.promptJa, "referee", { priority: "high" });
              return;
            }
          }
        }

        if (result.status === "clarify") {
          const ja = result.reply_ja || "もう一度教えてください。";
          const zh = result.reply_zh || "";
          TableUI.setReferee(ja, zh);
          if (result.rival_ja) TableUI.setRival(result.rival_ja, result.rival_zh || "");
          TableUI.appendLog(ja, zh);
          this.pushHistory("referee", ja);
          const actUnit = s.player.active;
          const actDef = actUnit ? SpecEngine.getMonster(actUnit.id) : null;
          if (actDef && /(技|攻撃|どちら)/.test(ja)) {
            const usable = actDef.skills.filter((sk) => this.canPayCost(actUnit.energies, sk.cost));
            if (usable.length > 0) {
              this.setPending({
                type: "choose_skill",
                promptJa: ja,
                promptZh: zh,
                originalUtterance: this.lastPlayerUtterance,
                context: { usable, target: null },
                options: [
                  ...usable.map((sk) => ({ label: `${sk.name_ja}（${sk.name_zh} ${sk.damage}）`, reply: sk.name_ja })),
                  { label: "キャンセル（取消）", reply: "キャンセル" }
                ]
              });
            }
          }
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak(ja, "referee", { priority: "high" });
          if (result.rival_ja) VoiceEngine.speak(result.rival_ja, "rival", { priority: "normal" });
          return;
        }

        if (result.status === "chat" || result.status === "reject") {
          TableUI.setReferee(result.reply_ja || "もう一度教えてください。", result.reply_zh || "");
          if (result.rival_ja) TableUI.setRival(result.rival_ja, result.rival_zh || "");
          TableUI.appendLog(result.reply_ja || result.transcript, result.reply_zh || "");
          this.pushHistory("referee", result.reply_ja || "");
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak(result.reply_ja, "referee", { priority: "high" });
          if (result.rival_ja) VoiceEngine.speak(result.rival_ja, "rival", { priority: "normal" });
          return;
        }

        if (result.status === "confirm" || (result.actions && result.actions.some((a) => a.type === "SURRENDER"))) {
          const ja = result.reply_ja || "バトルから逃走（降参）しますか？「はい」と答えると敗北になります。";
          const zh = result.reply_zh || "确定要逃离对战（认输）吗？回答“是”或“确认”将判定败北。";
          TableUI.setReferee(ja, zh);
          TableUI.appendLog(ja, zh);
          this.setPending({
            type: "confirm_surrender",
            promptJa: ja,
            promptZh: zh,
            originalUtterance: this.lastPlayerUtterance,
            options: [
              { label: "はい（确认认输）", reply: "はい" },
              { label: "いいえ（继续对战）", reply: "いいえ" }
            ]
          });
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak(ja, "referee", { priority: "high" });
          return;
        }

        const queue = Array.isArray(result.actions) ? result.actions : [];
        if (queue.length === 0) {
          const fallback = NLUEngine.pickClarifyPhrase();
          TableUI.setReferee(result.reply_ja || fallback.ja, result.reply_zh || fallback.zh);
          return;
        }

        /* 全动作原文护栏：防幻觉 + 严格子句级目标隔离（未在对应子句明确指定对象/卡牌时清空，多候选必须追问确认） */
        const rawUtter = payload.text || result.transcript || "";
        const snapNow = this.getSnapshot();
        const explicitSkill = SpecEngine.matchSkill(rawUtter);
        const explicitItem = SpecEngine.matchItem(rawUtter);
        const explicitMon = SpecEngine.matchMonster(rawUtter, "player");
        let safeQueue = [];
        const hasSummonIntent = /(召喚|召唤|上场|出战|ベンチに出|ベンチに置|备战区|放到?备战|下怪|を出す|を出して|派上)/.test(rawUtter) && !/(よびだし笛|召唤笛)/.test(rawUtter);
        for (const a of queue) {
          if (!a || !a.type) continue;
          if (a.type === "END_TURN" && (!NLUEngine.hasExplicitEndTurnIntent(rawUtter, isVoiceInput) || hasSummonIntent || Boolean(explicitMon))) continue;
          if (a.type === "DEFEND" && !NLUEngine.hasExplicitDefendIntent(rawUtter)) continue;
          const actClause = NLUEngine.extractClauseForAction(rawUtter, a.type, a.card_id);
          const hasPronoun = /(?:它|他|她|这只|那只|刚才那只|それ|こいつ|そいつ|さっきの|そのまま)/.test(actClause);
          const keepComboTarget = queue.length > 1 && hasPronoun && Boolean(a.target);
          if (a.type === "ATTACK") {
            if (!explicitSkill && !NLUEngine.hasExplicitAttackIntent(rawUtter)) continue;
            if (!explicitSkill) a.skill_name = null;
            if (a.target && !keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "enemy", snapNow)) a.target = null;
          }
          if (a.type === "ATTACH_ENERGY") {
            if (isVoiceInput && !/(エネルギー|えねるぎー|エネ|えね|能量|贴|充能|给|炎|火|ほのお|水|みず|雷|かみなり|でんき|つけ|はる|はっ)/.test(rawUtter) && !(explicitItem && explicitItem.category === "energy")) continue;
            if (!keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "player", snapNow)) a.target = null;
            if (!/(炎|火|ほのお|水|みず|雷|かみなり|でんき)/.test(actClause)) a.card_id = null;
          }
          if (a.type === "PLAY_BENCH") {
            if (isVoiceInput && !/(ベンチ|べんち|後ろ|場に出|召喚|しょうかん|出す|だす|だし|置く|おく|おい|备战|下怪|上场|出战|后排|出|放|派|上|召唤)/.test(rawUtter) && !explicitMon) continue;
            const clauseMon = SpecEngine.matchMonster(actClause, "player");
            if (!clauseMon) a.card_id = null;
          }
          if (a.type === "USE_ITEM") {
            if (isVoiceInput && !/(きずぐすり|回復|かいふく|ヒール|ポーション|体力|伤药|回血|补血|治|加血|吃药|喝药|奶|笛|ふえ|呼び出|引っ張り|強制交代|拉|補給|ほきゅう|ドロー|抽|摸|过牌|补牌|バッジ|ばっじ|パワー|バフ|アップ|力量|加攻|加伤害|增伤|強化|强化|回収|かいしゅう|回收|捞|捡|道具|グッズ|サポート|支援|使|用)/.test(rawUtter) && !explicitItem) continue;
            if (a.card_id === "item_potion" && a.target && !keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "player", snapNow)) a.target = null;
            if (a.card_id === "item_flute" && a.target && !keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "enemy", snapNow)) a.target = null;
          }
          if (a.type === "RETREAT") {
            if (isVoiceInput && !/(交代|こうたい|入れ替|いれかえ|下げ|さげ|逃げ|にげる|撤退|てったい|チェンジ|スイッチ|ベンチに戻|换|退|切|下场|撤下去|拉回)/.test(rawUtter)) continue;
            const rSlot = NLUEngine.resolveSlotFromText(actClause, "player", snapNow);
            if (!rSlot || rSlot === "player_active") a.target = null;
          }
          safeQueue.push(a);
        }
        /* 孤立 END_TURN 保护：若原多步连招的前置动作被护栏剔除后只剩 END_TURN，禁止跳过玩家整回合 */
        if (queue.length > 1 && safeQueue.length === 1 && safeQueue[0].type === "END_TURN") {
          safeQueue = [];
        }

        /* 若云端动作被护栏清空，尝试用本地解析器对已转写文本兜底解析（同样遵守语音 END_TURN 护栏） */
        if (safeQueue.length === 0 && rawUtter && !NLUEngine.isMeaninglessTranscript(rawUtter)) {
          const localRetry = NLUEngine.localParse(rawUtter, this.getSnapshot(), convCtx, { isVoice: isVoiceInput });
          if (localRetry.status === "execute" && Array.isArray(localRetry.actions) && localRetry.actions.length > 0) {
            safeQueue = localRetry.actions.filter((a) => {
              if (!a || !a.type) return false;
              if (a.type === "END_TURN" && isVoiceInput && (!NLUEngine.hasExplicitEndTurnIntent(rawUtter, true) || hasSummonIntent || Boolean(explicitMon))) return false;
              return true;
            });
          }
        }

        if (safeQueue.length === 0) {
          if (isVoiceInput && !isManualVoice && NLUEngine.isMeaninglessTranscript(rawUtter)) {
            TableUI.setReferee(prevRefJa, prevRefZh);
            return;
          }
          const fallback = NLUEngine.pickClarifyPhrase();
          TableUI.setReferee(fallback.ja, fallback.zh);
          TableUI.appendLog(`聞き取り「${rawUtter}」→ 指示未確定`, `识别为「${rawUtter}」，未检测到明确操作，保持当前回合`);
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak(fallback.ja, "referee", { priority: "high" });
          return;
        }

        /* 语音触发单独 END_TURN 强制二次确认：杜绝环境音/误识别直接跳过整回合（支持语音回答はい/确认、点击弹窗或直接说出新操作覆盖） */
        if (isVoiceInput && safeQueue.length === 1 && safeQueue[0].type === "END_TURN") {
          const opps = this.getEndTurnOpportunities();
          const ja = opps.length > 0
            ? "まだ行える操作が残っています。このままターンを終了しますか？（「はい」で終了／「いいえ」で戻る）"
            : "音声で「ターン終了」を検出しました。このままターンを終了しますか？（「はい」で終了／「いいえ」で戻る）";
          const zh = opps.length > 0
            ? "检测到语音「结束回合」，但本回合仍有可用操作未执行。确定结束吗？（说「确认」结束，说「取消」或直接下达新指令继续）"
            : "检测到语音「结束回合」，为防止误触发请确认：说「确认」结束回合，说「取消」返回。";
          TableUI.setReferee(ja, zh);
          TableUI.appendLog(`音声確認：${ja}`, `语音确认：${zh}`);
          this.setPending({
            type: "confirm_end_turn",
            promptJa: ja,
            promptZh: zh,
            originalUtterance: rawUtter,
            context: { actionType: "END_TURN", opportunities: opps },
            options: [
              { label: "このまま終了（确认结束）", reply: "はい" },
              { label: "戻る（返回操作）", reply: "いいえ" }
            ]
          });
          TableUI.openEndTurnConfirmModal(opps, true);
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak(ja, "referee", { priority: "high" });
          return;
        }

        if (s.pending && s.pending.type !== "promote_bench") this.clearPending();
        await this.runActionQueue(safeQueue, { ja: result.rival_ja, zh: result.rival_zh });
      } finally {
        s.busy = false;
        TableUI.renderAll();
        this.resetIdleTimer(true);
      }
    },

    async handlePendingReply(rawText) {
      const p = this.state.pending;
      if (!p) return false;
      const fixed = SpecEngine.applyLocalTypoFix(rawText).trim();
      const remaining = Array.isArray(p.remainingActions) ? p.remainingActions : [];
      const savedRival = p.customRival || null;

      if (p.type !== "promote_bench" && p.type !== "choose_starter" && /(いいえ|キャンセル|やめる|やめて|不要|不用|别|不是|取消|算了|不认输|不结束|不对|还没|まだ|继续)/.test(fixed)) {
        this.clearPending();
        const ja = "操作をキャンセルしました。";
        const zh = "已取消该操作。";
        TableUI.setReferee(ja, zh);
        TableUI.appendLog(ja, zh);
        VoiceEngine.clearQueuedOnly(false);
        VoiceEngine.speak(ja, "referee", { priority: "normal" });
        return true;
      }

      if (p.type === "choose_starter") {
        const matchedMon = SpecEngine.matchMonster(fixed, "player");
        let handIdx = matchedMon ? this.state.player.hand.indexOf(matchedMon.id) : -1;
        if (handIdx === -1) {
          const monIndices = this.state.player.hand
            .map((id, idx) => (SpecEngine.getMonster(id) ? idx : -1))
            .filter((idx) => idx !== -1);
          if (/(1|１|最初|ひとつ|第一)/.test(fixed) && monIndices[0] !== undefined) handIdx = monIndices[0];
          else if (/(2|２|ふたつ|第二)/.test(fixed) && monIndices[1] !== undefined) handIdx = monIndices[1];
          else if (/(3|３|みっつ|第三)/.test(fixed) && monIndices[2] !== undefined) handIdx = monIndices[2];
        }
        if (handIdx !== -1) {
          return this.selectStartingMonster(handIdx);
        }
        return false;
      }

      if (p.type === "confirm_end_turn") {
        if (!/([不别没]|まだ|ない)/.test(fixed) && /(はい|うん|そう|ターンエンド|ターン終了|終了|エンド|是的|确认|确定|对|好的|结束)/.test(fixed)) {
          this.clearPending();
          await this.executeAction({ type: "END_TURN" }, null);
          return true;
        }
        return false;
      }

      if (p.type === "confirm_surrender") {
        if (/(はい|うん|降参|投了|リタイア|そう|是的|确认|确定|认输|投降)/.test(fixed)) {
          this.clearPending();
          const r = SpecEngine.getRivalLine("surrender");
          TableUI.setRival(r.ja, r.zh);
          VoiceEngine.stopPlayback();
          VoiceEngine.speak(r.ja, "rival");
          this.endGame("enemy", "降参しました。相手の勝利です。", "你选择了认输，对手获胜。");
          return true;
        }
        return false;
      }

      if (p.type === "choose_skill") {
        const act = this.state.player.active;
        if (!act) { this.clearPending(); return false; }
        const def = SpecEngine.getMonster(act.id);
        let picked = def.skills.find((sk) => fixed.includes(sk.name_ja) || fixed.includes(sk.name_zh));
        if (!picked) {
          const fuzzySk = SpecEngine.matchSkill(fixed, def.skills);
          if (fuzzySk) picked = def.skills.find((sk) => sk.name_ja === fuzzySk.name_ja) || null;
        }
        if (!picked && p.context.usable.length === 1 && /(はい|うん|お願い|それで|攻撃|好的|是的|确认|攻击|用这个)/.test(fixed)) picked = p.context.usable[0];
        if (!picked && /(1|１|上|最初|ひとつ|第一)/.test(fixed)) picked = p.context.usable[0];
        if (!picked && /(2|２|下|ふたつ|第二)/.test(fixed)) picked = p.context.usable[1];
        if (picked) {
          this.clearPending();
          this.state.busy = true;
          try {
            const nextQueue = [{ type: "ATTACK", skill_name: picked.name_ja, target: p.context.target || null }, ...remaining];
            await this.runActionQueue(nextQueue, savedRival);
          } finally {
            this.state.busy = false;
            TableUI.renderAll();
          }
          return true;
        }
        return false;
      }

      if (p.type === "choose_card") {
        const candidates = p.context.candidates || [];
        let pickedId = null;
        for (const cid of candidates) {
          const m = SpecEngine.getMonster(cid);
          const it = SpecEngine.getItem(cid);
          if (m && (fixed.includes(m.name_ja) || fixed.includes(m.name_zh))) { pickedId = cid; break; }
          if (it && (fixed.includes(it.name_ja) || fixed.includes(it.name_zh))) { pickedId = cid; break; }
        }
        if (!pickedId) {
          const fm = SpecEngine.matchMonster(fixed, "player");
          if (fm && candidates.includes(fm.id)) pickedId = fm.id;
        }
        if (!pickedId) {
          const fi = SpecEngine.matchItem(fixed);
          if (fi && candidates.includes(fi.id)) pickedId = fi.id;
        }
        if (!pickedId && /炎|火/.test(fixed) && candidates.includes("energy_fire")) pickedId = "energy_fire";
        if (!pickedId && /水/.test(fixed) && candidates.includes("energy_water")) pickedId = "energy_water";
        if (!pickedId && /雷/.test(fixed) && candidates.includes("energy_thunder")) pickedId = "energy_thunder";
        if (!pickedId && /(1|１|最初|ひとつ|第一)/.test(fixed) && candidates[0]) pickedId = candidates[0];
        if (!pickedId && /(2|２|ふたつ|第二)/.test(fixed) && candidates[1]) pickedId = candidates[1];
        if (!pickedId && /(3|３|みっつ|第三)/.test(fixed) && candidates[2]) pickedId = candidates[2];
        if (pickedId) {
          const nextAct = { ...p.context.action, card_id: pickedId };
          this.clearPending();
          this.state.busy = true;
          try {
            await this.runActionQueue([nextAct, ...remaining], savedRival);
          } finally {
            this.state.busy = false;
            TableUI.renderAll();
          }
          return true;
        }
        return false;
      }

      if (p.type === "choose_target") {
        const slot = NLUEngine.resolveSlotFromText(fixed, p.context.side, this.getSnapshot());
        if (slot && this.getSlotUnit(slot)) {
          const nextAct = { ...p.context.action, target: slot };
          this.clearPending();
          this.state.busy = true;
          try {
            await this.runActionQueue([nextAct, ...remaining], savedRival);
          } finally {
            this.state.busy = false;
            TableUI.renderAll();
          }
          return true;
        }
        return false;
      }

      if (p.type === "promote_bench") {
        const slot = NLUEngine.resolveSlotFromText(fixed, "player", this.getSnapshot());
        const m = /^player_bench_([0-2])$/.exec(slot || "");
        if (m && this.state.player.bench[Number(m[1])]) {
          this.clearPending();
          await this.promotePlayerBench(Number(m[1]));
          return true;
        }
        return false;
      }

      return false;
    },

    /** 非阻塞双语播报：不打断正在播放的语音，仅清理陈旧积压队列并按优先级串行顺播 */
    announceAndReact(ja, zh, rivalEvent, customRival = null, opts = {}) {
      const priority = opts.priority || "normal";
      if (priority !== "low") VoiceEngine.clearQueuedOnly(true);
      TableUI.setReferee(ja, zh);
      TableUI.appendLog(ja, zh);
      this.pushHistory("referee", ja);

      const rJa = (customRival && customRival.ja) || (rivalEvent ? SpecEngine.getRivalLine(rivalEvent).ja : "");
      const rZh = (customRival && customRival.zh) || (rivalEvent ? SpecEngine.getRivalLine(rivalEvent).zh : "");
      if (rJa) {
        TableUI.setRival(rJa, rZh);
        VoiceEngine.prefetch(rJa, "rival");
      }
      VoiceEngine.speak(ja, "referee", { priority });
      if (rJa) VoiceEngine.speak(rJa, "rival", { priority: priority === "high" ? "high" : "normal" });
      return Promise.resolve();
    },

    async executeAction(act, customRival = null) {
      const s = this.state;
      if (!act || !act.type) return false;
      GuideEngine.hide();
      this.clearIdleTimer();

      switch (act.type) {
        case "CANCEL": {
          this.clearPending();
          await this.announceAndReact("キャンセルしました。", "已取消当前操作。", null);
          return true;
        }

        case "INSPECT": {
          const pa = s.player.active;
          const ea = s.enemy.active;
          const pd = pa ? SpecEngine.getMonster(pa.id) : null;
          const ed = ea ? SpecEngine.getMonster(ea.id) : null;
          const pJa = pd ? `${pd.name_ja}（HP ${pa.hp}/${pd.hp}、エネ${pa.energies.length}）` : "なし";
          const eJa = ed ? `${ed.name_ja}（HP ${ea.hp}/${ed.hp}）` : "なし";
          const pZh = pd ? `${pd.name_zh}（HP ${pa.hp}/${pd.hp}，能量 ${pa.energies.length}）` : "空位";
          const eZh = ed ? `${ed.name_zh}（HP ${ea.hp}/${ed.hp}）` : "空位";
          const ja = `自分バトル場は${pJa}、相手は${eJa}。残りサイドは自分${s.player.prizesLeft}枚、相手${s.enemy.prizesLeft}枚です。`;
          const zh = `己方战斗区为${pZh}，对手为${eZh}；剩余奖赏卡：己方 ${s.player.prizesLeft} 张，对手 ${s.enemy.prizesLeft} 张。`;
          await this.announceAndReact(ja, zh, null);
          return true;
        }

        case "ATTACH_ENERGY": {
          if (s.energyUsedThisTurn) {
            await this.announceAndReact("エネルギー添付は1ターンに1回までです。", "能量每回合只能附着 1 次，本回合已使用。", null);
            return false;
          }
          /* 1. 确认能量卡：手牌有 2 种及以上不同能量且未指定时必须追问 */
          const energyTypes = Array.from(new Set(s.player.hand.filter((id) => id.startsWith("energy_"))));
          if (energyTypes.length === 0) {
            await this.announceAndReact("手札にエネルギーカードがありません。", "手牌中没有能量卡。", null);
            return false;
          }
          let handIdx = act.card_id ? s.player.hand.indexOf(act.card_id) : -1;
          if (handIdx === -1) {
            if (energyTypes.length === 1) {
              handIdx = s.player.hand.indexOf(energyTypes[0]);
            } else {
              const ja = "どのエネルギーカードをつけますか？";
              const zh = "手牌中有多种能量卡，要附着哪一种？";
              this.setPending({
                type: "choose_card", promptJa: ja, promptZh: zh,
                context: { action: act, candidates: energyTypes },
                options: energyTypes.map((cid) => {
                  const it = SpecEngine.getItem(cid);
                  return { label: `${it ? it.name_ja : cid}（${it ? it.name_zh : cid}）`, reply: it ? it.name_ja : cid };
                })
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }
          const cardId = s.player.hand[handIdx];
          const itemDef = SpecEngine.getItem(cardId);

          /* 2. 确认附着对象：场上仅有 1 只己方怪兽时直接附着；有 2 只及以上且未指定时必须追问确认 */
          const allAllies = this.getAllEntries("player");
          if (allAllies.length === 0) {
            await this.announceAndReact("エネルギーをつける対象が見つかりません。", "未找到可附着能量的目标怪兽。", null);
            return false;
          }
          let targetSlot = act.target;
          let targetUnit = targetSlot ? this.getSlotUnit(targetSlot) : null;
          if (!targetUnit) {
            if (allAllies.length === 1) {
              targetSlot = allAllies[0].slot;
              targetUnit = allAllies[0].unit;
            } else {
              const ja = `どの味方に${itemDef.name_ja}をつけますか？`;
              const zh = `己方场上有 ${allAllies.length} 只怪兽，要把${itemDef.name_zh}贴给哪一只？`;
              this.setPending({
                type: "choose_target", promptJa: ja, promptZh: zh,
                context: { side: "player", action: { ...act, card_id: cardId } },
                options: allAllies.map((e) => ({
                  label: `${e.slot === "player_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh}）`,
                  reply: e.slot === "player_active" ? "前" : POS_JA[e.idx]
                }))
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }
          const tDef = SpecEngine.getMonster(targetUnit.id);
          const beforeReady = tDef.skills
            .filter((sk) => this.canPayCost(targetUnit.energies, sk.cost))
            .map((sk) => sk.name_ja);

          s.player.hand.splice(handIdx, 1);
          targetUnit.energies.push(itemDef.element);
          s.energyUsedThisTurn = true;

          /* 检测本次贴能新激活的技能，触发卡牌高光与技能脉冲动效 */
          const newlyUnlocked = tDef.skills.filter(
            (sk) => this.canPayCost(targetUnit.energies, sk.cost) && !beforeReady.includes(sk.name_ja)
          );
          s.recentlyUnlocked = newlyUnlocked.length
            ? { slot: targetSlot, skills: newlyUnlocked.map((sk) => sk.name_ja) }
            : null;

          TableUI.renderAll();
          SoundFX.play(newlyUnlocked.length ? "unlock" : "energy");
          TableUI.flashAnim(targetSlot, "anim-powerup");
          TableUI.spawnSlotVfx(targetSlot, "energy");
          TableUI.spawnFloatText(
            targetSlot,
            newlyUnlocked.length ? `✨ ${newlyUnlocked[0].name_ja} 解放！` : `${ELEM_ICON[itemDef.element] || "★"} +1 エネ`,
            "energy"
          );
          if (s.recentlyUnlocked) {
            setTimeout(() => {
              if (this.state) this.state.recentlyUnlocked = null;
            }, 1200);
          }

          const unlockJa = newlyUnlocked.length
            ? `『${newlyUnlocked.map((sk) => sk.name_ja).join("・")}』が発動可能になりました！`
            : "";
          const unlockZh = newlyUnlocked.length
            ? `技能「${newlyUnlocked.map((sk) => sk.name_zh).join("、")}」已激活可用！`
            : "";

          await this.announceAndReact(
            `${tDef.name_ja}に${itemDef.name_ja}をつけました。${unlockJa}`,
            `已为${tDef.name_zh}附着${itemDef.name_zh}。${unlockZh}`,
            "attach_energy",
            customRival,
            { priority: newlyUnlocked.length ? "normal" : "low" }
          );
          if (newlyUnlocked.length) GuideEngine.trigger("first_skill_ready", false);
          return true;
        }

        case "PLAY_BENCH": {
          const emptyIdx = s.player.bench.findIndex((b) => b === null);
          if (emptyIdx === -1) {
            await this.announceAndReact("ベンチは満員（3体）です。", "备战区已满（3只），无法继续下怪。", null);
            return false;
          }
          const monTypes = Array.from(new Set(s.player.hand.filter((id) => Boolean(SpecEngine.getMonster(id)))));
          if (monTypes.length === 0) {
            await this.announceAndReact("手札にベンチへ出せるモンスターがありません。", "手牌中没有可放入备战区的怪兽。", null);
            return false;
          }
          let handIdx = act.card_id ? s.player.hand.indexOf(act.card_id) : -1;
          if (handIdx === -1) {
            if (monTypes.length === 1) {
              handIdx = s.player.hand.indexOf(monTypes[0]);
            } else {
              const ja = "手札のどのモンスターをベンチに出しますか？";
              const zh = "手牌中有多只怪兽，要把哪一只放入备战区？";
              this.setPending({
                type: "choose_card", promptJa: ja, promptZh: zh,
                context: { action: act, candidates: monTypes },
                options: monTypes.map((cid) => {
                  const m = SpecEngine.getMonster(cid);
                  return { label: `${m.name_ja}（${m.name_zh} HP${m.hp}）`, reply: m.name_ja };
                })
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }
          const monId = s.player.hand.splice(handIdx, 1)[0];
          const def = SpecEngine.getMonster(monId);
          s.player.bench[emptyIdx] = { id: monId, hp: def.hp, energies: [], guard: 0 };
          TableUI.renderAll();
          SoundFX.play("tap");
          TableUI.flashAnim(`player_bench_${emptyIdx}`, "anim-enter");
          TableUI.spawnFloatText(`player_bench_${emptyIdx}`, def.is_ex ? "★ ex登場！" : "登場！", "energy");
          await this.announceAndReact(
            `${def.name_ja}をベンチ（${POS_JA[emptyIdx]}）に出しました。${def.is_ex ? "（きぜつ時サイド2枚）" : ""}`,
            `已将${def.name_zh}放入备战区（${POS_ZH[emptyIdx]}）。${def.is_ex ? "（被击倒送 2 张奖赏卡）" : ""}`,
            def.is_ex ? "play_ex" : "play_bench",
            customRival,
            { priority: def.is_ex ? "normal" : "low" }
          );
          GuideEngine.trigger(def.is_ex ? "first_ex_card" : "first_bench_play", false);
          return true;
        }

        case "USE_ITEM": {
          const handIdx = s.player.hand.indexOf(act.card_id);
          if (handIdx === -1) {
            const it = SpecEngine.getItem(act.card_id);
            await this.announceAndReact(`手札に「${it ? it.name_ja : "カード"}」がありません。`, `手牌中没有“${it ? it.name_zh : "该道具"}”。`, null);
            return false;
          }
          const it = SpecEngine.getItem(act.card_id);
          if (it.category === "supporter" && s.supporterUsedThisTurn) {
            await this.announceAndReact("サポートカードは1ターンに1枚までです。", "支援者卡每回合只能使用 1 张，本回合已使用。", null);
            return false;
          }
          if (it.category === "supporter") GuideEngine.trigger("first_supporter", false);

          const healMatch = /^heal_ally_(\d+)$/.exec(it.effect_type || "");
          if (healMatch) {
            const healAmount = Number(healMatch[1]) || 30;
            let targetSlot = act.target;
            let targetUnit = targetSlot ? this.getSlotUnit(targetSlot) : null;
            if (!targetUnit) {
              const wounded = this.getAllEntries("player").filter((e) => e.unit.hp < e.def.hp);
              if (wounded.length === 1) {
                targetSlot = wounded[0].slot;
                targetUnit = wounded[0].unit;
              } else if (wounded.length > 1) {
                const ja = "どの味方をきずぐすりで回復しますか？";
                const zh = "要对哪只己方怪兽使用伤药？";
                this.setPending({
                  type: "choose_target", promptJa: ja, promptZh: zh,
                  context: { side: "player", action: act },
                  options: wounded.map((e) => ({
                    label: `${e.slot === "player_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh}）`,
                    reply: e.slot === "player_active" ? "前" : POS_JA[e.idx]
                  }))
                });
                await this.announceAndReact(ja, zh, null);
                return false;
              } else {
                await this.announceAndReact("味方は全員HP満タンのため、きずぐすりは使えません。", "己方怪兽均为满血状态，无法使用伤药。", null);
                return false;
              }
            }
            const tDef = SpecEngine.getMonster(targetUnit.id);
            if (targetUnit.hp >= tDef.hp) {
              await this.announceAndReact(`${tDef.name_ja}はすでにHP満タンです。`, `${tDef.name_zh}已经是满血，无法使用伤药。`, null);
              return false;
            }
            s.player.hand.splice(handIdx, 1);
            s.player.trash.push(it.id);
            const healed = Math.min(healAmount, tDef.hp - targetUnit.hp);
            targetUnit.hp += healed;
            TableUI.renderAll();
            SoundFX.play("heal");
            TableUI.flashAnim(targetSlot, "anim-heal");
            TableUI.spawnSlotVfx(targetSlot, "heal");
            TableUI.spawnFloatText(targetSlot, `+${healed} HP`, "heal");
            await this.announceAndReact(
              `きずぐすり使用！${tDef.name_ja}のHPを${healed}回復しました。`,
              `使用伤药！${tDef.name_zh}回复了 ${healed} HP。`,
              "heal",
              customRival
            );
            return true;
          }

          if (it.effect_type === "switch_enemy_bench") {
            const eBench = this.getBenchEntries("enemy");
            if (eBench.length === 0) {
              await this.announceAndReact("相手のベンチにモンスターがいないため、よびだし笛は使えません。", "对手备战区没有怪兽，无法使用召唤笛。", null);
              return false;
            }
            let targetSlot = act.target;
            let picked = eBench.find((e) => e.slot === targetSlot);
            if (!picked) {
              if (eBench.length === 1) {
                picked = eBench[0];
              } else {
                const names = eBench.map((e) => `${POS_JA[e.idx]}の${e.def.name_ja}`).join("・");
                const ja = `相手ベンチのどちらを呼び出しますか？（${names}）`;
                const zh = `要强拉对手备战区的哪只上场？（${eBench.map((e) => `${POS_ZH[e.idx]}：${e.def.name_zh}`).join("、")}）`;
                this.setPending({
                  type: "choose_target", promptJa: ja, promptZh: zh,
                  context: { side: "enemy", action: act },
                  options: eBench.map((e) => ({ label: `${POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh}）`, reply: POS_JA[e.idx] }))
                });
                await this.announceAndReact(ja, zh, null);
                return false;
              }
            }
            s.player.hand.splice(handIdx, 1);
            s.player.trash.push(it.id);
            if (it.category === "supporter") s.supporterUsedThisTurn = true;
            const oldEnemyAct = s.enemy.active;
            if (oldEnemyAct) oldEnemyAct.guard = 0;
            s.enemy.active = picked.unit;
            s.enemy.bench[picked.idx] = oldEnemyAct;
            TableUI.renderAll();
            SoundFX.play("switch");
            TableUI.flashAnim("enemy_active", "anim-enter");
            TableUI.spawnFloatText("enemy_active", "強制交代！", "guard");
            await this.announceAndReact(
              `よびだし笛！相手の${picked.def.name_ja}をバトル場へ引きずり出しました！`,
              `发动召唤笛！强行将对手的${picked.def.name_zh}拉上战斗区！`,
              "flute",
              customRival
            );
            return true;
          }

          const drawMatch = /^draw_(\d+)$/.exec(it.effect_type || "");
          if (drawMatch) {
            const drawCount = Number(drawMatch[1]) || 2;
            if (s.player.deck.length === 0) {
              await this.announceAndReact("山札が空のため、補給バッグは使えません。", "牌库已空，无法使用补给包。", null);
              return false;
            }
            s.player.hand.splice(handIdx, 1);
            s.player.trash.push(it.id);
            if (it.category === "supporter") s.supporterUsedThisTurn = true;
            const drawn = this.drawCard("player", drawCount);
            TableUI.renderAll();
            SoundFX.play("tap");
            await this.announceAndReact(
              `補給バッグで山札を${drawn.length}枚引きました。`,
              `使用补给包，抽了 ${drawn.length} 张牌。`,
              "draw",
              customRival
            );
            return true;
          }

          const boostMatch = /^boost_(\d+)$/.exec(it.effect_type || "");
          if (boostMatch) {
            const boostVal = Number(boostMatch[1]) || 20;
            if (s.turn === 1) {
              await this.announceAndReact("先攻1ターン目はパワーバッジを使えません。", "先手第 1 回合禁止使用力量徽章（防止开局秒杀）。", null);
              return false;
            }
            s.player.hand.splice(handIdx, 1);
            s.player.trash.push(it.id);
            if (it.category === "supporter") s.supporterUsedThisTurn = true;
            s.player.attackBoost = (s.player.attackBoost || 0) + boostVal;
            TableUI.renderAll();
            SoundFX.play("unlock");
            TableUI.flashAnim("player_active", "anim-powerup");
            TableUI.spawnSlotVfx("player_active", "energy");
            TableUI.spawnFloatText("player_active", `⚔️ 攻撃+${boostVal}！`, "energy");
            await this.announceAndReact(
              `パワーバッジ使用！このターンの攻撃ダメージが+${boostVal}されます！`,
              `使用力量徽章！本回合攻击伤害 +${boostVal}！`,
              "power",
              customRival
            );
            return true;
          }

          if (it.effect_type === "recover_energy") {
            const trashEIdx = s.player.trash.findIndex((id) => id.startsWith("energy_"));
            if (trashEIdx !== -1) {
              s.player.hand.splice(handIdx, 1);
              s.player.trash.push(it.id);
              const recoveredId = s.player.trash.splice(trashEIdx, 1)[0];
              s.player.hand.push(recoveredId);
              this.sortHandArray(s.player.hand);
              const rDef = SpecEngine.getItem(recoveredId);
              TableUI.renderAll();
              SoundFX.play("energy");
              TableUI.spawnFloatText("player_active", "♻️ エネ回収！", "energy");
              await this.announceAndReact(
                `エネ回収！トラッシュから${rDef ? rDef.name_ja : "エネルギー"}を手札に戻しました。`,
                `使用能量回收！从弃牌区取回了${rDef ? rDef.name_zh : "1 张能量"}。`,
                "recycle",
                customRival
              );
              return true;
            }
            /* 双向灵活机制：若弃牌区尚无能量，可从牌库检索 1 张匹配己方主战/备战属性的能量卡，彻底消灭前期死牌 */
            const actDef = s.player.active ? SpecEngine.getMonster(s.player.active.id) : null;
            const wantId = actDef ? `energy_${actDef.element}` : null;
            let deckEIdx = wantId ? s.player.deck.indexOf(wantId) : -1;
            if (deckEIdx === -1) deckEIdx = s.player.deck.findIndex((id) => id.startsWith("energy_"));
            if (deckEIdx === -1) {
              await this.announceAndReact("トラッシュにも山札にもエネルギーがないため、エネ回収は使えません。", "弃牌区和牌库中都没有能量卡，无法使用能量回收。", null);
              return false;
            }
            s.player.hand.splice(handIdx, 1);
            s.player.trash.push(it.id);
            const searchedId = s.player.deck.splice(deckEIdx, 1)[0];
            s.player.hand.push(searchedId);
            this.sortHandArray(s.player.hand);
            const rDef = SpecEngine.getItem(searchedId);
            TableUI.renderAll();
            SoundFX.play("energy");
            TableUI.spawnFloatText("player_active", "♻️ エネ探索！", "energy");
            await this.announceAndReact(
              `エネ回収！山札から${rDef ? rDef.name_ja : "エネルギー"}を手札に加えました。`,
              `使用能量回收！从牌库检索了${rDef ? rDef.name_zh : "1 张能量"}加入手牌。`,
              "recycle",
              customRival
            );
            return true;
          }
          return false;
        }

        case "RETREAT": {
          if (s.retreatedThisTurn) {
            await this.announceAndReact("交代は1ターンに1回までです。", "撤退换人每回合只能执行 1 次。", null);
            return false;
          }
          const actUnit = s.player.active;
          const actDef = actUnit ? SpecEngine.getMonster(actUnit.id) : null;
          const retreatCost = actDef && actDef.is_ex ? 2 : 1;
          if (!actUnit || actUnit.energies.length < retreatCost) {
            await this.announceAndReact(
              `交代するにはバトル場のエネルギーが${retreatCost}つ必要です。`,
              `战斗区${actDef && actDef.is_ex ? " ex 怪兽" : "怪兽"}撤退需要 ${retreatCost} 点能量，当前能量不足。`,
              null
            );
            return false;
          }
          const myBench = this.getBenchEntries("player");
          if (myBench.length === 0) {
            await this.announceAndReact("交代できるベンチのモンスターがいません。", "备战区没有可替换上场的怪兽。", null);
            return false;
          }
          let picked = myBench.find((e) => e.slot === act.target);
          if (!picked) {
            if (myBench.length === 1) {
              picked = myBench[0];
            } else {
              const ja = "ベンチの誰と交代しますか？";
              const zh = "要换备战区的哪只怪兽上场？";
              this.setPending({
                type: "choose_target", promptJa: ja, promptZh: zh,
                context: { side: "player", action: act },
                options: myBench.map((e) => ({ label: `${POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh}）`, reply: POS_JA[e.idx] }))
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }
          for (let k = 0; k < retreatCost; k++) {
            const discardedElem = actUnit.energies.pop();
            if (discardedElem) s.player.trash.push(`energy_${discardedElem}`);
          }
          actUnit.guard = 0;
          s.player.active = picked.unit;
          s.player.bench[picked.idx] = actUnit;
          s.retreatedThisTurn = true;
          TableUI.renderAll();
          SoundFX.play("switch");
          TableUI.flashAnim("player_active", "anim-enter");
          TableUI.spawnFloatText("player_active", "交代！", "guard");
          await this.announceAndReact(
            `エネを${retreatCost}枚捨て、${picked.def.name_ja}と交代しました。`,
            `弃置 ${retreatCost} 点能量，换${picked.def.name_zh}进入战斗区。`,
            "retreat",
            customRival
          );
          return true;
        }

        case "DEFEND": {
          const actUnit = s.player.active;
          if (!actUnit) return false;
          if (actUnit.lastDefendedTurn === s.turn - 1) {
            await this.announceAndReact(
              "同じモンスターは2ターン連続で防御態勢を取れません。攻撃・交代・ターン終了を選んでください。",
              "同一只怪兽不能连续两回合进入防御姿态，请选择攻击、撤退或结束回合。",
              null
            );
            return false;
          }
          const seq = this.matchSeq;
          actUnit.guard = 30;
          actUnit.lastDefendedTurn = s.turn;
          TableUI.renderAll();
          SoundFX.play("guard");
          TableUI.flashAnim("player_active", "anim-guard");
          TableUI.spawnFloatText("player_active", "防御 -30", "guard");
          await this.announceAndReact(
            "防御態勢に入りました（次の被ダメージ-30）。ターン終了です。",
            "进入防御姿态（下回合受击 -30），回合结束。",
            "defend",
            customRival
          );
          if (!(await this.matchDelay(650, seq))) return false;
          await this.finishPlayerTurn(seq);
          return false;
        }

        case "END_TURN": {
          const seq = this.matchSeq;
          await this.announceAndReact("ターン終了。相手レンの番です。", "回合结束，轮到对手莲。", "end_turn", customRival);
          if (!(await this.matchDelay(600, seq))) return false;
          await this.finishPlayerTurn(seq);
          return false;
        }

        case "ATTACK": {
          const actUnit = s.player.active;
          if (!actUnit) return false;
          const actDef = SpecEngine.getMonster(actUnit.id);
          const usable = actDef.skills.filter((sk) => this.canPayCost(actUnit.energies, sk.cost));

          let chosenSkill = act.skill_name
            ? actDef.skills.find((sk) => sk.name_ja === act.skill_name || sk.name_zh === act.skill_name)
            : null;

          if (act.skill_name && !chosenSkill) {
            const benchOwner = this.getBenchEntries("player").find((e) =>
              e.def.skills.some((sk) => sk.name_ja === act.skill_name || sk.name_zh === act.skill_name)
            );
            if (benchOwner) {
              const ja = `『${act.skill_name}』はベンチの${benchOwner.def.name_ja}の技です。まず交代してから使ってください。`;
              const zh = `“${act.skill_name}”是备战区${benchOwner.def.name_zh}的技能，请先撤退换人上场再发动。`;
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }

          /* 智能攻击确认：仅 1 个可用技能直接释放；2 个及以上可用技能才弹出确认 */
          if (!chosenSkill) {
            if (usable.length === 0) {
              const firstSk = actDef.skills[0];
              const ja = `${actDef.name_ja}はエネルギー不足で攻撃できません。『${firstSk.name_ja}』にはエネルギーが${firstSk.cost.length}つ必要です。`;
              const zh = `${actDef.name_zh}能量不足，无法攻击。发动“${firstSk.name_zh}”需要 ${firstSk.cost.length} 点能量。`;
              await this.announceAndReact(ja, zh, null);
              return false;
            }
            if (usable.length === 1) {
              chosenSkill = usable[0];
            } else {
              const ja = `${actDef.name_ja}は『${usable[0].name_ja}（${usable[0].damage}）』と『${usable[1].name_ja}（${usable[1].damage}）』が使えます。どちらの技で攻撃しますか？`;
              const zh = `${actDef.name_zh}可用“${usable[0].name_zh}（${usable[0].damage}）”和“${usable[1].name_zh}（${usable[1].damage}）”，要使用哪个技能攻击？`;
              this.setPending({
                type: "choose_skill", promptJa: ja, promptZh: zh,
                context: { usable, target: act.target },
                options: [
                  ...usable.map((sk) => ({ label: `${sk.name_ja}（${sk.name_zh} ${sk.damage}）`, reply: sk.name_ja })),
                  { label: "キャンセル（取消）", reply: "キャンセル" }
                ]
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }

          if (!this.canPayCost(actUnit.energies, chosenSkill.cost)) {
            await this.announceAndReact(`『${chosenSkill.name_ja}』のエネルギーが足りません。`, `发动“${chosenSkill.name_zh}”所需能量不足。`, null);
            return false;
          }

          /* 狙击类技能（enemy_any）：敌方场上有 2 只及以上怪兽且未指定对象时，必须追问确认目标 */
          let targetSlot = act.target;
          if (chosenSkill.target === "enemy_any" && !targetSlot) {
            const eUnits = this.getAllEntries("enemy");
            if (eUnits.length > 1) {
              const ja = `『${chosenSkill.name_ja}』は相手のバトル場・ベンチのどちらを狙いますか？`;
              const zh = `「${chosenSkill.name_zh}」可攻击对手任意怪兽，要指定哪一只为目标？`;
              this.setPending({
                type: "choose_target", promptJa: ja, promptZh: zh,
                context: { side: "enemy", action: { type: "ATTACK", skill_name: chosenSkill.name_ja, target: null } },
                options: eUnits.map((e) => ({
                  label: `${e.slot === "enemy_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh} HP${e.unit.hp}）`,
                  reply: e.slot === "enemy_active" ? "前" : POS_JA[e.idx]
                }))
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
            targetSlot = eUnits[0] ? eUnits[0].slot : "enemy_active";
          }
          if (!targetSlot) targetSlot = "enemy_active";
          if (chosenSkill.target === "enemy_active" && targetSlot !== "enemy_active") {
            await this.announceAndReact(
              `『${chosenSkill.name_ja}』は相手のバトル場にしか攻撃できません。ベンチを狙うには『よびだし笛』で呼び出すか、ベンチ狙撃技を使ってください。`,
              `“${chosenSkill.name_zh}”只能攻击对手战斗区怪兽。按规则想集火备战区，请先用「召唤笛」把它拉上战斗区，或使用备战狙击技能。`,
              null
            );
            return false;
          }
          let targetUnit = this.getSlotUnit(targetSlot);
          if (!targetUnit) {
            targetSlot = "enemy_active";
            targetUnit = s.enemy.active;
          }
          if (!targetUnit) return false;
          const targetDef = SpecEngine.getMonster(targetUnit.id);

          /* 备战区狙击规则：对备战区造成的伤害默认不计算弱点与抵抗力；语音真名咏唱 2 技能首次触发言灵共鸣 +10 */
          const isBenchSnipe = targetSlot !== "enemy_active";
          const weakBonus = isBenchSnipe ? 0 : this.getWeaknessBonus(actDef.element, targetDef.element);
          const boost = s.player.attackBoost || 0;
          s.player.attackBoost = 0;
          const utter = SpecEngine.applyLocalTypoFix(String(this.lastPlayerUtterance || ""));
          const namedUlt = Boolean(ConfigManager.data.kotodamaResonance && actDef.skills[1] && chosenSkill.name_ja === actDef.skills[1].name_ja && !actUnit.chanted && utter && (utter.includes(chosenSkill.name_ja) || utter.includes(chosenSkill.name_zh)));
          const chantBonus = namedUlt ? 10 : 0;
          if (namedUlt) actUnit.chanted = true;
          const reduction = isBenchSnipe ? 0 : (targetUnit.guard || 0);
          const dmg = Math.max(0, chosenSkill.damage + weakBonus + boost + chantBonus - reduction);
          targetUnit.hp = Math.max(0, targetUnit.hp - dmg);
          const guardVal = chosenSkill.guardVal || (chosenSkill.effect === "guard_20" ? 20 : 0);
          if (guardVal > 0) {
            actUnit.guard = Math.max(actUnit.guard || 0, guardVal);
          }
          const discardMatch = /^discard_self_(\d+)$/.exec(chosenSkill.effect || "");
          const discardVal = chosenSkill.discardSelfVal || (discardMatch ? Number(discardMatch[1]) : 0);
          let discardedCount = 0;
          for (let k = 0; k < discardVal && actUnit.energies.length > 0; k++) {
            let discIdx = actUnit.energies.findIndex((el) => el !== actDef.element);
            if (discIdx === -1) discIdx = actUnit.energies.length - 1;
            const discardedElem = actUnit.energies.splice(discIdx, 1)[0];
            if (discardedElem) {
              s.player.trash.push(`energy_${discardedElem}`);
              discardedCount += 1;
            }
          }
          const seq = this.matchSeq;
          TableUI.renderAll();
          SoundFX.play("attack", actDef.element);
          TableUI.flashAnim("player_active", "anim-lunge-up");
          if (!(await this.matchDelay(140, seq))) return false;
          SoundFX.play("hit");
          TableUI.flashAnim(targetSlot, "anim-hit");
          if (dmg >= 40 || weakBonus || chantBonus) TableUI.shakePlaymat();
          TableUI.spawnSlotVfx(targetSlot, actDef.element);
          TableUI.spawnFloatText(targetSlot, weakBonus ? `-${dmg} 弱点!` : `-${dmg}`, (dmg >= 50 || weakBonus || chantBonus) ? "crit" : "dmg");
          if (chantBonus) TableUI.spawnFloatText("player_active", "✨ 言霊共鳴 +10！", "energy");
          if (guardVal > 0) {
            TableUI.spawnFloatText("player_active", `被ダメ -${guardVal}`, "guard");
          }
          if (discardedCount > 0) {
            TableUI.spawnFloatText("player_active", `エネ -${discardedCount}`, "dmg");
          }

          const notesJa = [];
          const notesZh = [];
          if (chantBonus) { notesJa.push("言霊共鳴+10"); notesZh.push("言灵共鸣+10"); }
          if (weakBonus) { notesJa.push("弱点+20"); notesZh.push("弱点+20"); }
          if (boost) { notesJa.push(`強化+${boost}`); notesZh.push(`强化+${boost}`); }
          if (guardVal > 0) { notesJa.push(`次の被ダメージ-${guardVal}`); notesZh.push(`下回合受击-${guardVal}`); }
          if (discardedCount > 0) { notesJa.push(`自身エネ-${discardedCount}`); notesZh.push(`弃置自身能量×${discardedCount}`); }
          const noteJaStr = notesJa.length ? `（${notesJa.join("・")}）` : "";
          const noteZhStr = notesZh.length ? `（${notesZh.join("，")}）` : "";
          const ja = `${actDef.name_ja}の『${chosenSkill.name_ja}』！${targetDef.name_ja}に${dmg}ダメージ！${noteJaStr}`;
          const zh = `${actDef.name_zh}发动“${chosenSkill.name_zh}”，对${targetDef.name_zh}造成 ${dmg} 点伤害！${noteZhStr}`;

          /* 先播报本次攻击伤害（高优先级不截断），留足 420ms 受击飘字与特效展示，再结算击倒与对手台词 */
          this.announceAndReact(ja, zh, null, null, { priority: "high" });
          if (!(await this.matchDelay(420, seq))) return false;
          const ko = await this.checkKnockOuts();
          if (seq !== this.matchSeq) return false;
          if (!ko) {
            const rivalEv = weakBonus ? "weakness" : (isBenchSnipe ? "snipe" : "attack_hit");
            const rJa = (customRival && customRival.ja) || SpecEngine.getRivalLine(rivalEv).ja;
            const rZh = (customRival && customRival.zh) || SpecEngine.getRivalLine(rivalEv).zh;
            if (rJa) {
              TableUI.setRival(rJa, rZh);
              VoiceEngine.speak(rJa, "rival");
            }
          }
          if (s.gameOver) return false;

          if (!(await this.matchDelay(460, seq))) return false;
          await this.finishPlayerTurn(seq);
          return false;
        }
      }
      return false;
    },

    async checkKnockOuts() {
      const s = this.state;
      let anyKo = false;

      for (const e of [...this.getAllEntries("enemy")]) {
        if (e.unit.hp <= 0) {
          anyKo = true;
          s.enemy.trash.push(e.unit.id);
          for (const el of (e.unit.energies || [])) s.enemy.trash.push(`energy_${el}`);
          if (e.slot === "enemy_active") s.enemy.active = null;
          else s.enemy.bench[e.idx] = null;
          const prizeVal = this.getPrizeValue(e.unit.id);
          const prizeCards = this.takePrizes("player", prizeVal);
          TableUI.renderAll();
          SoundFX.play("ko");
          TableUI.spawnFloatText(e.slot, prizeVal === 2 ? "💥 ex撃破！サイド2枚" : "💥 きぜつ！", "ko");
          TableUI.flashPrize("player", prizeCards.length);
          TableUI.showPrizeBanner("player", prizeCards, prizeVal, s.player.prizesLeft);

          if (s.player.prizesLeft === 0) {
            const r = SpecEngine.getRivalLine("player_win");
            TableUI.setRival(r.ja, r.zh);
            VoiceEngine.speak(r.ja, "rival");
            this.endGame("player", `サイドを${TOTAL_PRIZES}枚取り切りました！あなたの勝利です！`, `你拿完 ${TOTAL_PRIZES} 张奖赏卡，赢得胜利！`);
            return true;
          }

          const koLine = SpecEngine.getRivalLine(prizeVal === 2 ? "enemy_ex_ko" : "enemy_ko");
          TableUI.setRival(koLine.ja, koLine.zh);
          const prizeJa = prizeCards.length ? `サイドから「${prizeCards.map((c) => c.ja).join("・")}」を手札に加えました！` : "";
          const prizeZh = prizeCards.length ? `从奖赏卡抽到「${prizeCards.map((c) => c.zh).join("、")}」加入手牌！` : "";
          TableUI.appendLog(`相手の${e.def.name_ja}を撃破！${prizeJa}`, `击倒对手的${e.def.name_zh}，${prizeZh}`);
          VoiceEngine.speak(koLine.ja, "rival");

          if (!s.enemy.active) {
            const bench = this.getBenchEntries("enemy");
            if (bench.length === 0) {
              this.endGame("player", "相手の場にモンスターがいなくなりました！勝利です！", "对手场上已无怪兽，你获胜了！");
              return true;
            }
            const next = this.chooseBestEnemyPromotion() || bench[0];
            s.enemy.active = next.unit;
            s.enemy.bench[next.idx] = null;
            TableUI.appendLog(`レンはベンチから${next.def.name_ja}をバトル場に出した。`, `对手莲派出${next.def.name_zh}进入战斗区。`);
            TableUI.renderAll();
            TableUI.flashAnim("enemy_active", "anim-enter");
          }
        }
      }

      for (const p of [...this.getAllEntries("player")]) {
        if (p.unit.hp <= 0) {
          anyKo = true;
          s.player.trash.push(p.unit.id);
          for (const el of (p.unit.energies || [])) s.player.trash.push(`energy_${el}`);
          if (p.slot === "player_active") s.player.active = null;
          else s.player.bench[p.idx] = null;
          const prizeVal = this.getPrizeValue(p.unit.id);
          this.takePrizes("enemy", prizeVal);
          TableUI.renderAll();
          SoundFX.play("ko");
          TableUI.spawnFloatText(p.slot, prizeVal === 2 ? "💥 exきぜつ！サイド2枚" : "💥 きぜつ！", "ko");
          TableUI.flashPrize("enemy", prizeVal);
          TableUI.showPrizeBanner("enemy", [], prizeVal, s.enemy.prizesLeft);

          if (s.enemy.prizesLeft === 0) {
            const r = SpecEngine.getRivalLine("enemy_win");
            TableUI.setRival(r.ja, r.zh);
            VoiceEngine.speak(r.ja, "rival");
            this.endGame("enemy", `相手にサイドを${TOTAL_PRIZES}枚取られました。`, `对手拿完 ${TOTAL_PRIZES} 张奖赏卡，本局败北。`);
            return true;
          }

          const r = SpecEngine.getRivalLine(prizeVal === 2 ? "player_ex_ko" : "player_ko");
          TableUI.setRival(r.ja, r.zh);
          TableUI.appendLog(`自分の${p.def.name_ja}がきぜつ…相手がサイドを${prizeVal}枚手札に加えた。`, `己方${p.def.name_zh}倒下，对手拿走 ${prizeVal} 张奖赏卡加入手牌。`);
          VoiceEngine.speak(r.ja, "rival");

          if (!s.player.active) {
            const myBench = this.getBenchEntries("player");
            if (myBench.length === 0) {
              this.endGame("enemy", "自分の場にモンスターがいなくなりました。", "己方场上已无怪兽，本局败北。");
              return true;
            }
            if (myBench.length === 1) {
              await this.promotePlayerBench(myBench[0].idx);
            } else {
              const ja = "バトル場に出すベンチのモンスターを選んでください。";
              const zh = "请选择备战区一只怪兽补位至战斗区。";
              this.setPending({
                type: "promote_bench", promptJa: ja, promptZh: zh,
                options: myBench.map((e) => ({ label: `${POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh}）`, reply: POS_JA[e.idx] }))
              });
              TableUI.setReferee(ja, zh);
            }
          }
        }
      }
      return anyKo;
    },

    async promotePlayerBench(idx) {
      const unit = this.state.player.bench[idx];
      if (!unit) return;
      const def = SpecEngine.getMonster(unit.id);
      this.state.player.active = unit;
      this.state.player.bench[idx] = null;
      TableUI.appendLog(`ベンチから${def.name_ja}をバトル場に出しました。`, `已将备战区的${def.name_zh}派上战斗区。`);
      TableUI.renderAll();
    },

    endGame(winner, descJa, descZh) {
      this.clearIdleTimer();
      this.state.gameOver = true;
      this.state.winner = winner;
      this.clearPending();
      SoundFX.play(winner === "player" ? "win" : "lose");
      $("gameOverTitleJa").textContent = winner === "player" ? "勝利！" : "敗北…";
      $("gameOverDescJa").textContent = descJa;
      $("gameOverTitleZh").textContent = winner === "player" ? "你赢了！" : "你输了…";
      $("gameOverDescZh").textContent = descZh;
      $("gameOverModal").classList.add("open");
      TableUI.renderAll();
    },

    async finishPlayerTurn(seq = this.matchSeq) {
      const s = this.state;
      if (!s || s.gameOver || seq !== this.matchSeq) return;
      this.clearIdleTimer();
      s.currentPlayer = "enemy";
      TableUI.renderAll();
      TableUI.showTurnBanner("🔥 相手レンのターン", "对手莲的回合", true);
      if (!(await this.matchDelay(750, seq))) return;
      await this.runEnemyTurn(seq);
    },

    /** 估算攻击方对指定目标的最大单次伤害（可模拟多贴 1 枚能量） */
    estimateUnitMaxOutput(attUnit, defUnit, isDefActive, extraEnergies = []) {
      if (!attUnit || !defUnit) return 0;
      const attDef = SpecEngine.getMonster(attUnit.id);
      const defDef = SpecEngine.getMonster(defUnit.id);
      if (!attDef || !defDef) return 0;
      const pool = [...(attUnit.energies || []), ...extraEnergies];
      let best = 0;
      for (const sk of attDef.skills) {
        if (!this.canPayCost(pool, sk.cost)) continue;
        if (!isDefActive && sk.target !== "enemy_any") continue;
        const wb = isDefActive ? this.getWeaknessBonus(attDef.element, defDef.element) : 0;
        const red = isDefActive ? (defUnit.guard || 0) : 0;
        const dmg = Math.max(0, sk.damage + wb - red);
        if (dmg > best) best = dmg;
      }
      return best;
    },

    /** 估算玩家下回合威胁伤害（普通难度按当前公开场面能量计算；困难难度会预判玩家再贴 1 张同属性能量后的最大威胁） */
    estimatePlayerNextTurnThreat(enemyUnit, isEnemyActive) {
      const s = this.state;
      if (!s || !enemyUnit || !s.player.active) return { baseMaxDmg: 0, maxDmg: 0, lethal: false };
      const pAct = s.player.active;
      const baseMaxDmg = this.estimateUnitMaxOutput(pAct, enemyUnit, isEnemyActive, []);
      if (!this.isHardAi()) {
        return { baseMaxDmg, maxDmg: baseMaxDmg, lethal: baseMaxDmg >= enemyUnit.hp };
      }
      const pDef = SpecEngine.getMonster(pAct.id);
      const extra = (pDef && (pAct.energies || []).length < 2) ? [pDef.element] : [];
      const maxDmg = this.estimateUnitMaxOutput(pAct, enemyUnit, isEnemyActive, extra);
      return { baseMaxDmg, maxDmg, lethal: maxDmg >= enemyUnit.hp };
    },

    /** 评估对手某只怪兽在指定增益、模拟能量或召唤笛拉人下的最佳攻击方案 */
    evaluateAttackPlan(attUnit, boost = 0, forcedPlayerBenchEntry = null, simulatedEnergies = null) {
      const s = this.state;
      if (!s || !attUnit || !s.player.active) return null;
      const actDef = SpecEngine.getMonster(attUnit.id);
      if (!actDef) return null;
      const energies = simulatedEnergies || attUnit.energies || [];
      const usable = actDef.skills.filter((sk) => this.canPayCost(energies, sk.cost));
      if (usable.length === 0) return null;

      let virtualPlayerActive = { slot: "player_active", unit: s.player.active, def: SpecEngine.getMonster(s.player.active.id), guard: s.player.active.guard || 0 };
      let allTargets = this.getAllEntries("player").map((e) => ({
        slot: e.slot, unit: e.unit, def: e.def, guard: e.slot === "player_active" ? (e.unit.guard || 0) : 0
      }));
      if (forcedPlayerBenchEntry) {
        virtualPlayerActive = { slot: "player_active", unit: forcedPlayerBenchEntry.unit, def: forcedPlayerBenchEntry.def, guard: 0 };
        allTargets = [
          virtualPlayerActive,
          ...this.getBenchEntries("player")
            .filter((b) => b.idx !== forcedPlayerBenchEntry.idx)
            .map((b) => ({ slot: b.slot, unit: b.unit, def: b.def, guard: 0 })),
          { slot: `player_bench_${forcedPlayerBenchEntry.idx}`, unit: s.player.active, def: SpecEngine.getMonster(s.player.active.id), guard: 0 }
        ];
      }

      const playerBenchCount = allTargets.length - 1;
      const maxSkillBase = Math.max(...actDef.skills.map((x) => x.damage));
      let bestPlan = null;

      const hardAi = this.isHardAi();
      for (const sk of usable) {
        const targets = (sk.target === "enemy_any" && hardAi) ? allTargets : [virtualPlayerActive];
        for (const t of targets) {
          const isActTarget = t.slot === "player_active";
          const wb = isActTarget ? this.getWeaknessBonus(actDef.element, t.def.element) : 0;
          const red = isActTarget ? t.guard : 0;
          const dmg = Math.max(0, sk.damage + wb + boost - red);
          const isKo = dmg >= t.unit.hp;
          const prizeVal = this.getPrizeValue(t.unit.id);
          const isWin = isKo && (prizeVal >= s.enemy.prizesLeft || (isActTarget && playerBenchCount === 0));
          const remainHp = Math.max(0, t.unit.hp - dmg);
          const setupNextKo = !isKo && dmg > 0 && remainHp <= (maxSkillBase + wb);
          const guardBonus = sk.effect === "guard_20" ? 45 : 0;

          let score = 0;
          if (isWin) score += 10000;
          if (isKo) score += prizeVal === 2 ? 2600 : 1400;
          score += dmg * 8 + guardBonus;
          if (!isKo && dmg > 0) {
            if (t.def.is_ex) score += 130;
            score += (t.unit.energies || []).length * 45;
            if (setupNextKo) score += 95;
          }
          if (isKo && dmg > t.unit.hp) {
            score -= Math.min(20, Math.floor((dmg - t.unit.hp) / 10));
          }

          if (!bestPlan || score > bestPlan.score) {
            bestPlan = {
              sk, targetSlot: t.slot, targetUnit: t.unit, tDef: t.def,
              weakBonus: wb, dmg, isKo, isWin, prizeVal, score
            };
          }
        }
      }
      return bestPlan;
    },

    /** 从对手手牌中为指定怪兽挑选最合理的能量（任意费用位优先消耗其它怪兽最不需要的能量） */
    pickBestEnergyForUnit(hand, unit, def, otherUnits = []) {
      const energyIndices = [];
      for (let i = 0; i < hand.length; i++) {
        if (hand[i].startsWith("energy_")) energyIndices.push(i);
      }
      if (energyIndices.length === 0) return -1;

      const needOwn = !(unit.energies || []).includes(def.element);
      if (needOwn) {
        const matchIdx = hand.indexOf(`energy_${def.element}`);
        if (matchIdx !== -1) return matchIdx;
      }

      /* 已有同属性或手牌无同属性时，优先使用其它怪兽最不需要的能量（避免浪费备战区主力的同属能量） */
      let bestIdx = energyIndices[0];
      let bestPenalty = Infinity;
      for (const idx of energyIndices) {
        const elem = hand[idx].replace("energy_", "");
        let penalty = 0;
        for (const o of otherUnits) {
          const oDef = SpecEngine.getMonster(o.id);
          if (oDef && oDef.element === elem && !(o.energies || []).includes(elem)) {
            penalty += oDef.is_ex ? 30 : 15;
          }
        }
        const countOfThis = energyIndices.filter((k) => hand[k] === hand[idx]).length;
        penalty -= countOfThis * 4;
        if (elem === def.element && !needOwn) penalty += 6;
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestIdx = idx;
        }
      }
      return bestIdx;
    },

    /** 模拟给某只怪兽贴上当前手牌中最佳能量后的最强攻击方案 */
    simulateBestAfterEnergy(unit, hand, boost = 0, forcedPlayerBenchEntry = null) {
      if (!unit) return { basePlan: null, withEnergyPlan: null, energyIdx: -1 };
      const def = SpecEngine.getMonster(unit.id);
      const basePlan = this.evaluateAttackPlan(unit, boost, forcedPlayerBenchEntry);
      const otherUnits = this.getAllEntries("enemy").map((e) => e.unit).filter((u) => u !== unit);
      const energyIdx = this.pickBestEnergyForUnit(hand, unit, def, otherUnits);
      if (energyIdx === -1) return { basePlan, withEnergyPlan: basePlan, energyIdx: -1 };
      const addElem = hand[energyIdx].replace("energy_", "");
      const simEnergies = [...(unit.energies || []), addElem];
      const withEnergyPlan = this.evaluateAttackPlan(unit, boost, forcedPlayerBenchEntry, simEnergies);
      return { basePlan, withEnergyPlan, energyIdx };
    },

    /** 当前对手是否处于“困难（高手战术强度）”模式；“普通”模式为具备完整回合与基本战术的稳健强度 */
    isHardAi() {
      return ConfigManager.data.aiDifficulty === "hard";
    },

    /** 对手主战怪兽倒下时，结合属性克制、即战力、斩杀与 ex 保护选出最优补位 */
    chooseBestEnemyPromotion() {
      const s = this.state;
      const bench = this.getBenchEntries("enemy");
      if (bench.length === 0) return null;
      if (bench.length === 1) return bench[0];

      const pAct = s.player.active;
      const pDef = pAct ? SpecEngine.getMonster(pAct.id) : null;
      let best = bench[0];
      let bestScore = -Infinity;

      if (!this.isHardAi()) {
        return [...bench].sort((a, b) => b.unit.hp - a.unit.hp)[0];
      }
      for (const b of bench) {
        let score = (b.unit.energies || []).length * 70 + b.unit.hp * 0.9;
        const sim = this.simulateBestAfterEnergy(b.unit, s.enemy.hand, 0);
        const plan = sim.withEnergyPlan || sim.basePlan;
        if (plan) {
          if (plan.isWin) score += 6000;
          else if (plan.isKo) score += plan.prizeVal === 2 ? 2000 : 1300;
          else score += plan.dmg * 4.5;
        }
        if (pDef) {
          if (this.getWeaknessBonus(b.def.element, pDef.element) > 0) score += 260;
          if (this.getWeaknessBonus(pDef.element, b.def.element) > 0) score -= b.def.is_ex ? 420 : 210;
        }
        const threat = this.estimatePlayerNextTurnThreat(b.unit, true);
        if (threat.lethal && !(plan && plan.isWin)) {
          score -= b.def.is_ex ? 680 : 260;
        }
        if (s.enemy.hand.includes(`energy_${b.def.element}`) && !(b.unit.energies || []).includes(b.def.element)) {
          score += 110;
        }
        if (score > bestScore) {
          bestScore = score;
          best = b;
        }
      }
      return best;
    },

    async runEnemyTurn(seq = this.matchSeq) {
      const s = this.state;
      if (!s || s.gameOver || seq !== this.matchSeq) return;
      s.busy = true;
      try {
        /* 场况兜底校验：任一方场上已无怪兽时立即结算胜负 */
        if (!s.player.active && this.getBenchEntries("player").length === 0) {
          this.endGame("enemy", "自分の場にモンスターがいなくなりました。", "己方场上已无怪兽，本局败北。");
          return;
        }
        if (!s.enemy.active && this.getBenchEntries("enemy").length === 0) {
          this.endGame("player", "相手の場にモンスターがいなくなりました！勝利です！", "对手场上已无怪兽，你获胜了！");
          return;
        }

        if (s.enemy.active) s.enemy.active.guard = 0;

        if (s.enemy.deck.length === 0) {
          /* 牌库耗尽改为疲劳激战（每回合主战怪兽受 20 点疲劳伤害），杜绝龟缩拖空牌库逃课 */
          if (s.enemy.active) {
            s.enemy.active.hp = Math.max(0, s.enemy.active.hp - 20);
            TableUI.renderAll();
            TableUI.spawnFloatText("enemy_active", "⚡ 疲労 -20", "dmg");
            TableUI.appendLog("相手の山札が空のため疲労ダメージ20！", "对手牌库已空，主战怪兽受到 20 点疲劳伤害！");
            if (!(await this.matchDelay(420, seq))) return;
            await this.checkKnockOuts();
            if (seq !== this.matchSeq || s.gameOver) return;
          }
        } else {
          this.drawCard("enemy", 1);
          TableUI.renderAll();
          if (!(await this.matchDelay(460, seq))) return;
        }

        /* 对手同样遵守支援者每回合限用 1 张规则（补给包 / 召唤笛 / 力量徽章三选一） */
        let enemySupporterUsed = false;
        const hardAi = this.isHardAi();

        /* 阶段 1：补给包过牌（严格要求剩余牌库 >= 4 且不低于玩家牌库，防止自削牌库）+ 双向能量回收 */
        const bagIdx = s.enemy.hand.indexOf("item_bag");
        if (bagIdx !== -1 && s.enemy.deck.length >= 4 && s.enemy.deck.length >= s.player.deck.length && s.enemy.active && s.player.active) {
          const curSim = this.simulateBestAfterEnergy(s.enemy.active, s.enemy.hand, 0);
          const baseKo = Boolean(curSim.withEnergyPlan && curSim.withEnergyPlan.isKo);
          const baseWin = Boolean(curSim.withEnergyPlan && curSim.withEnergyPlan.isWin);
          let reserveForLethalSupporter = false;

          if (hardAi && !baseWin && s.enemy.hand.includes("item_power")) {
            const pwrSim = this.simulateBestAfterEnergy(s.enemy.active, s.enemy.hand, 20);
            if (pwrSim.withEnergyPlan && pwrSim.withEnergyPlan.isKo && !baseKo) reserveForLethalSupporter = true;
          }
          if (hardAi && !baseWin && !reserveForLethalSupporter && s.enemy.hand.includes("item_flute")) {
            for (const pb of this.getBenchEntries("player")) {
              const flSim = this.simulateBestAfterEnergy(s.enemy.active, s.enemy.hand, 0, pb);
              if (flSim.withEnergyPlan && (flSim.withEnergyPlan.isWin || (flSim.withEnergyPlan.isKo && (!baseKo || flSim.withEnergyPlan.prizeVal === 2)))) {
                reserveForLethalSupporter = true;
                break;
              }
            }
          }

          const actDef0 = SpecEngine.getMonster(s.enemy.active.id);
          const needCards = s.enemy.hand.length <= 4
            || !s.enemy.hand.some((id) => id.startsWith("energy_"))
            || (actDef0 && !s.enemy.active.energies.includes(actDef0.element) && !s.enemy.hand.includes(`energy_${actDef0.element}`))
            || this.getBenchEntries("enemy").length === 0;
          if (!reserveForLethalSupporter && needCards) {
            enemySupporterUsed = true;
            s.enemy.hand.splice(bagIdx, 1);
            s.enemy.trash.push("item_bag");
            this.drawCard("enemy", 2);
            TableUI.appendLog("レンはサポート『補給バッグ』で2枚引いた。", "对手莲使用支援者「补给包」抽了 2 张牌。");
            TableUI.renderAll();
            if (!(await this.matchDelay(420, seq))) return;
          }
        }

        const recIdx = s.enemy.hand.indexOf("item_recycle");
        if (recIdx !== -1 && s.enemy.active) {
          const actDefR = SpecEngine.getMonster(s.enemy.active.id);
          const wantId = actDefR ? `energy_${actDefR.element}` : null;
          const needEnergy = !s.enemy.hand.some((id) => id.startsWith("energy_")) || (wantId && !s.enemy.hand.includes(wantId));
          if (needEnergy) {
            let tIdx = wantId ? s.enemy.trash.indexOf(wantId) : -1;
            if (tIdx === -1) tIdx = s.enemy.trash.findIndex((id) => id.startsWith("energy_"));
            if (tIdx !== -1) {
              s.enemy.hand.splice(recIdx, 1);
              s.enemy.trash.push("item_recycle");
              const got = s.enemy.trash.splice(tIdx, 1)[0];
              s.enemy.hand.push(got);
              TableUI.appendLog("レンは『エネ回収』でトラッシュからエネルギーを回収した。", "对手莲使用「能量回收」从弃牌区取回 1 张能量。");
              TableUI.renderAll();
              if (!(await this.matchDelay(380, seq))) return;
            } else {
              let dIdx = wantId ? s.enemy.deck.indexOf(wantId) : -1;
              if (dIdx === -1) dIdx = s.enemy.deck.findIndex((id) => id.startsWith("energy_"));
              if (dIdx !== -1) {
                s.enemy.hand.splice(recIdx, 1);
                s.enemy.trash.push("item_recycle");
                const got = s.enemy.deck.splice(dIdx, 1)[0];
                s.enemy.hand.push(got);
                TableUI.appendLog("レンは『エネ回収』で山札からエネルギーを探索した。", "对手莲使用「能量回收」从牌库检索 1 张能量。");
                TableUI.renderAll();
                if (!(await this.matchDelay(380, seq))) return;
              }
            }
          }
        }

        /* 阶段 2：铺场备战区（普通模式每回合最多铺 1 只；困难模式全力铺满最多 3 只） */
        const pActDef = s.player.active ? SpecEngine.getMonster(s.player.active.id) : null;
        const maxBenchPerTurn = hardAi ? 3 : 1;
        let benchedThisTurn = 0;
        while (benchedThisTurn < maxBenchPerTurn && s.enemy.bench.includes(null)) {
          const handMons = s.enemy.hand
            .map((id, idx) => ({ id, idx, def: SpecEngine.getMonster(id) }))
            .filter((x) => x.def);
          if (handMons.length === 0) break;
          handMons.sort((a, b) => {
            const scoreMon = (m) => {
              let sc = m.def.hp * 0.5;
              if (m.def.is_ex) sc += 90;
              if (hardAi && pActDef && this.getWeaknessBonus(m.def.element, pActDef.element) > 0) sc += 120;
              if (s.enemy.hand.includes(`energy_${m.def.element}`)) sc += 50;
              return sc;
            };
            return scoreMon(b) - scoreMon(a);
          });
          const pick = handMons[0];
          const emptyB = s.enemy.bench.findIndex((b) => b === null);
          s.enemy.hand.splice(pick.idx, 1);
          s.enemy.bench[emptyB] = { id: pick.id, hp: pick.def.hp, energies: [], guard: 0 };
          benchedThisTurn += 1;
          TableUI.appendLog(`レンはベンチに${pick.def.name_ja}を出した。`, `对手莲将${pick.def.name_zh}放入备战区。`);
          TableUI.renderAll();
          if (!(await this.matchDelay(420, seq))) return;
        }

        /* 阶段 3：先评估战术回血（若喝药能让主战怪脱离斩杀线，则留场输出而非浪费能量撤退） */
        let potionsUsedThisTurn = 0;
        const maxPotionsPerTurn = hardAi ? 3 : 1;
        while (potionsUsedThisTurn < maxPotionsPerTurn && s.enemy.hand.includes("item_potion")) {
          const potCount = s.enemy.hand.filter((id) => id === "item_potion").length;
          const candidates = this.getAllEntries("enemy")
            .filter((e) => e.unit.hp < e.def.hp)
            .map((e) => {
              const missing = e.def.hp - e.unit.hp;
              const isAct = e.slot === "enemy_active";
              const threat = this.estimatePlayerNextTurnThreat(e.unit, isAct);
              const heal1 = Math.min(30, missing);
              const heal2 = Math.min(60, missing);
              const savesWith1 = threat.lethal && (e.unit.hp + heal1 > threat.maxDmg);
              const savesWith2 = hardAi && threat.lethal && potCount >= 2 && (e.unit.hp + heal2 > threat.maxDmg);

              let score = -1;
              if (hardAi && savesWith1) {
                score = (e.def.is_ex ? 1400 : 900) + (isAct ? 200 : 0) + heal1;
              } else if (savesWith2 && (e.def.is_ex || isAct)) {
                score = (e.def.is_ex ? 1150 : 680) + heal1;
              } else if (hardAi && missing >= 30) {
                score = (isAct ? 320 : 180) + (e.def.is_ex ? 140 : 0) + missing;
              } else if (hardAi && missing >= 20 && threat.maxDmg > 0) {
                score = (isAct ? 220 : 90) + missing;
              } else if (!hardAi && isAct && e.unit.hp <= 40 && missing >= 30) {
                score = 200 + missing;
              }
              return { entry: e, score, heal: heal1 };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score);

          if (candidates.length === 0) break;
          const bestHeal = candidates[0];
          const potIdx = s.enemy.hand.indexOf("item_potion");
          s.enemy.hand.splice(potIdx, 1);
          s.enemy.trash.push("item_potion");
          bestHeal.entry.unit.hp += bestHeal.heal;
          potionsUsedThisTurn += 1;
          TableUI.appendLog(`レンはきずぐすりで${bestHeal.entry.def.name_ja}を${bestHeal.heal}回復！`, `对手莲用伤药为${bestHeal.entry.def.name_zh}回复 ${bestHeal.heal} HP！`);
          TableUI.renderAll();
          if (!(await this.matchDelay(460, seq))) return;
        }

        /* 阶段 4：智能贴能（修复 doomedActive 误判、严禁向已满能后排倾倒废能量；普通模式偏重主战直观贴能） */
        if (s.enemy.active && s.enemy.hand.some((id) => id.startsWith("energy_"))) {
          const allEnemyUnits = this.getAllEntries("enemy");
          const actUnit = s.enemy.active;
          const actThreat = this.estimatePlayerNextTurnThreat(actUnit, true);
          const actBasePlan = this.evaluateAttackPlan(actUnit, 0);
          const actMaxCost = Math.max(...SpecEngine.getMonster(actUnit.id).skills.map((sk) => sk.cost.length));
          const activeNeedsEnergy = (actUnit.energies || []).length < actMaxCost;
          let bestAttach = null;

          for (const entry of allEnemyUnits) {
            const otherUnits = allEnemyUnits.map((e) => e.unit).filter((u) => u !== entry.unit);
            const eIdx = this.pickBestEnergyForUnit(s.enemy.hand, entry.unit, entry.def, otherUnits);
            if (eIdx === -1) continue;
            const addElem = s.enemy.hand[eIdx].replace("energy_", "");
            const curE = entry.unit.energies || [];
            const simE = [...curE, addElem];
            const isMatch = addElem === entry.def.element && !curE.includes(entry.def.element);
            const prevUsable = entry.def.skills.filter((sk) => this.canPayCost(curE, sk.cost)).length;
            const nextUsable = entry.def.skills.filter((sk) => this.canPayCost(simE, sk.cost)).length;
            const unlockedNew = nextUsable > prevUsable;
            const maxCost = Math.max(...entry.def.skills.map((sk) => sk.cost.length));

            let score = 0;
            if (entry.slot === "enemy_active") {
              const newPlan = this.evaluateAttackPlan(entry.unit, 0, null, simE);
              const baseDmg = actBasePlan ? actBasePlan.dmg : 0;
              const newDmg = newPlan ? newPlan.dmg : 0;
              if (newPlan && newPlan.isWin && !(actBasePlan && actBasePlan.isWin)) score += 6000;
              else if (newPlan && newPlan.isKo && !(actBasePlan && actBasePlan.isKo)) score += newPlan.prizeVal === 2 ? 2200 : 1300;
              if (unlockedNew) {
                score += (prevUsable === 0 ? 720 : 460) + (newDmg - baseDmg) * 6;
              }
              if (isMatch) score += 180;
              if (!hardAi && curE.length < maxCost) score += 1200;
              if (curE.length >= maxCost && allEnemyUnits.length > 1) score -= 500;
              const canDefendSurvive = !newPlan && entry.unit.lastDefendedTurn !== s.turn - 1 && (entry.unit.hp + 30 > actThreat.maxDmg);
              const doomedActive = hardAi && actThreat.lethal && !canDefendSurvive && !(newPlan && newPlan.isKo) && allEnemyUnits.length > 1;
              if (doomedActive) score -= 680;
              if (!unlockedNew && curE.length >= maxCost) score -= 300;
            } else {
              if (curE.length >= maxCost) {
                score -= activeNeedsEnergy ? 2000 : 800;
              } else {
                score += hardAi ? 260 : 40;
                if (hardAi && unlockedNew) score += 260;
                if (isMatch) score += hardAi ? 190 : 60;
                if (entry.def.is_ex) score += hardAi ? 280 : 40;
                if (hardAi && pActDef && this.getWeaknessBonus(entry.def.element, pActDef.element) > 0) score += 210;
                if (curE.length === 1 && maxCost >= 2) score += 90;
                score += entry.unit.hp * 0.4;
              }
            }

            if (!bestAttach || score > bestAttach.score) {
              bestAttach = { entry, eIdx, score };
            }
          }

          if (bestAttach) {
            const cardId = s.enemy.hand.splice(bestAttach.eIdx, 1)[0];
            const itDef = SpecEngine.getItem(cardId);
            bestAttach.entry.unit.energies.push(itDef.element);
            TableUI.appendLog(`レンは${bestAttach.entry.def.name_ja}に${itDef.name_ja}をつけた。`, `对手莲为${bestAttach.entry.def.name_zh}贴上了${itDef.name_zh}。`);
            TableUI.renderAll();
            if (!(await this.matchDelay(480, seq))) return;
          }
        }

        /* 阶段 5：战术撤退（困难模式专属：放在回血与贴能之后，支持“贴1能立即撤退”；ex 怪兽撤退需 2 点能量） */
        if (hardAi && s.enemy.active && s.player.active) {
          const actUnit = s.enemy.active;
          const actDef = SpecEngine.getMonster(actUnit.id);
          const retreatCost = actDef && actDef.is_ex ? 2 : 1;
          const enemyBench = this.getBenchEntries("enemy");
          if (actUnit.energies.length >= retreatCost && enemyBench.length > 0) {
            const stayPlan = this.evaluateAttackPlan(actUnit, 0);
            const stayThreat = this.estimatePlayerNextTurnThreat(actUnit, true);
            const stayWeak = pActDef && this.getWeaknessBonus(pActDef.element, actDef.element) > 0;

            let stayScore = stayPlan ? stayPlan.score : -120;
            if (stayThreat.lethal && !(stayPlan && stayPlan.isWin)) {
              stayScore -= actDef.is_ex ? 900 : 380;
            }
            if (stayWeak) stayScore -= actDef.is_ex ? 220 : 100;
            if (actUnit.hp <= 30) stayScore -= 160;

            let bestSwitch = null;
            for (const b of enemyBench) {
              const swPlan = this.evaluateAttackPlan(b.unit, 0);
              const swThreat = this.estimatePlayerNextTurnThreat(b.unit, true);
              const swAdv = pActDef && this.getWeaknessBonus(b.def.element, pActDef.element) > 0;
              const swWeak = pActDef && this.getWeaknessBonus(pActDef.element, b.def.element) > 0;
              let swScore = (swPlan ? swPlan.score : -160) - 160;
              if (swAdv) swScore += 180;
              if (swWeak) swScore -= b.def.is_ex ? 320 : 140;
              if (swThreat.lethal && !(swPlan && swPlan.isWin)) {
                swScore -= b.def.is_ex ? 950 : 420;
              }
              if (b.unit.hp < 40 && !(swPlan && swPlan.isKo)) swScore -= 220;
              if (!bestSwitch || swScore > bestSwitch.score) {
                bestSwitch = { entry: b, score: swScore, plan: swPlan };
              }
            }

            const switchMargin = hardAi ? 170 : 480;
            const urgentSaveEx = hardAi && actDef.is_ex && stayThreat.lethal && !(stayPlan && stayPlan.isWin)
              && bestSwitch && !bestSwitch.entry.def.is_ex && bestSwitch.score > stayScore - 100;
            if (bestSwitch && (bestSwitch.score > stayScore + switchMargin || urgentSaveEx)) {
              const old = s.enemy.active;
              for (let k = 0; k < retreatCost; k++) {
                let discIdx = old.energies.findIndex((el) => el !== actDef.element);
                if (discIdx === -1) discIdx = old.energies.length - 1;
                const discardedElem = old.energies.splice(discIdx, 1)[0];
                if (discardedElem) s.enemy.trash.push(`energy_${discardedElem}`);
              }
              old.guard = 0;
              s.enemy.active = bestSwitch.entry.unit;
              s.enemy.bench[bestSwitch.entry.idx] = old;
              SoundFX.play("switch");
              TableUI.appendLog(`レンは${bestSwitch.entry.def.name_ja}と交代した！`, `对手莲撤退并换上${bestSwitch.entry.def.name_zh}！`);
              TableUI.renderAll();
              TableUI.flashAnim("enemy_active", "anim-enter");
              if (!(await this.matchDelay(520, seq))) return;
            }
          }
        }

        /* 阶段 6：召唤笛博弈（困难模式专属：主动击倒/抓ex/破防/抓弱点） */
        if (hardAi && !enemySupporterUsed && s.enemy.active && s.player.active) {
          const basePlan = this.evaluateAttackPlan(s.enemy.active, 0);
          const fluteIdx = s.enemy.hand.indexOf("item_flute");
          const pBench = this.getBenchEntries("player");
          let bestFlute = null;

          if (fluteIdx !== -1 && pBench.length > 0 && !(basePlan && basePlan.isWin)) {
            for (const pb of pBench) {
              const flPlan = this.evaluateAttackPlan(s.enemy.active, 0, pb);
              if (!flPlan) continue;
              const baseScore = basePlan ? basePlan.score : 0;
              const gain = flPlan.score - baseScore;
              const upgradesToWin = flPlan.isWin;
              const upgradesToExKo = hardAi && flPlan.isKo && flPlan.prizeVal === 2 && !(basePlan && basePlan.isKo && basePlan.prizeVal === 2);
              const upgradesToKo = hardAi && flPlan.isKo && !(basePlan && basePlan.isKo);
              const breaksGuardOrWeak = hardAi && (
                (s.player.active.guard >= 20 && flPlan.dmg >= (basePlan ? basePlan.dmg : 0) + 20)
                || (flPlan.weakBonus > 0 && gain >= 180)
              );
              if (upgradesToWin || upgradesToExKo || upgradesToKo || breaksGuardOrWeak) {
                if (!bestFlute || flPlan.score > bestFlute.plan.score) {
                  bestFlute = { target: pb, plan: flPlan };
                }
              }
            }
          }

          if (bestFlute) {
            enemySupporterUsed = true;
            s.enemy.hand.splice(fluteIdx, 1);
            s.enemy.trash.push("item_flute");
            const oldPlayerAct = s.player.active;
            oldPlayerAct.guard = 0;
            s.player.active = bestFlute.target.unit;
            s.player.bench[bestFlute.target.idx] = oldPlayerAct;
            TableUI.renderAll();
            SoundFX.play("switch");
            TableUI.flashAnim("player_active", "anim-enter");
            TableUI.spawnFloatText("player_active", "強制交代！", "guard");
            TableUI.appendLog(`レンはサポート『よびだし笛』で${bestFlute.target.def.name_ja}を引きずり出した！`, `对手莲发动支援者「召唤笛」，强行将你的${bestFlute.target.def.name_zh}拉上战斗区！`);
            if (!(await this.matchDelay(480, seq))) return;
          }
        }

        /* 阶段 7：执行最优攻击（必要时发动力量徽章）或防御/结束回合（不调用 stopPlayback 避免腰斩玩家回合 KO 语音） */
        const act = s.enemy.active;
        if (act && s.player.active) {
          const actDef = SpecEngine.getMonster(act.id);
          const basePlan = this.evaluateAttackPlan(act, 0);
          if (basePlan) {
            const pwrIdx = s.enemy.hand.indexOf("item_power");
            if (!enemySupporterUsed && pwrIdx !== -1 && !basePlan.isKo) {
              const boostPlan = this.evaluateAttackPlan(act, 20);
              const turnsIntoKo = Boolean(boostPlan && boostPlan.isKo);
              const meaningfulChip = hardAi && Boolean(
                boostPlan
                && boostPlan.dmg >= basePlan.dmg + 20
                && (boostPlan.tDef.is_ex || (s.player.active.guard || 0) >= 20 || (boostPlan.targetUnit.hp - boostPlan.dmg) <= boostPlan.dmg)
              );
              if (turnsIntoKo || meaningfulChip) {
                enemySupporterUsed = true;
                s.enemy.hand.splice(pwrIdx, 1);
                s.enemy.trash.push("item_power");
                s.enemy.attackBoost = (s.enemy.attackBoost || 0) + 20;
                TableUI.appendLog("レンはサポート『パワーバッジ』を使用！（攻撃+20）", "对手莲使用支援者「力量徽章」！（本回合攻击 +20）");
                TableUI.spawnFloatText("enemy_active", "⚔️ 攻撃+20！", "energy");
                TableUI.renderAll();
                if (!(await this.matchDelay(320, seq))) return;
              }
            }

            const boost = s.enemy.attackBoost || 0;
            s.enemy.attackBoost = 0;
            const bestPlan = this.evaluateAttackPlan(act, boost) || basePlan;
            const { sk, targetSlot, targetUnit, tDef, weakBonus, dmg } = bestPlan;
            targetUnit.hp = Math.max(0, targetUnit.hp - dmg);
            const guardVal = sk.guardVal || (sk.effect === "guard_20" ? 20 : 0);
            if (guardVal > 0) {
              act.guard = Math.max(act.guard || 0, guardVal);
            }
            const discardMatchE = /^discard_self_(\d+)$/.exec(sk.effect || "");
            const discardValE = sk.discardSelfVal || (discardMatchE ? Number(discardMatchE[1]) : 0);
            let discardedCountE = 0;
            for (let k = 0; k < discardValE && act.energies.length > 0; k++) {
              let discIdx = act.energies.findIndex((el) => el !== actDef.element);
              if (discIdx === -1) discIdx = act.energies.length - 1;
              const discardedElem = act.energies.splice(discIdx, 1)[0];
              if (discardedElem) {
                s.enemy.trash.push(`energy_${discardedElem}`);
                discardedCountE += 1;
              }
            }
            TableUI.renderAll();
            SoundFX.play("attack", actDef.element);
            TableUI.flashAnim("enemy_active", "anim-lunge-down");
            if (!(await this.matchDelay(140, seq))) return;
            SoundFX.play("hit");
            TableUI.flashAnim(targetSlot, "anim-hit");
            if (dmg >= 40 || weakBonus) TableUI.shakePlaymat();
            TableUI.spawnSlotVfx(targetSlot, actDef.element);
            TableUI.spawnFloatText(targetSlot, weakBonus ? `-${dmg} 弱点!` : `-${dmg}`, (dmg >= 50 || weakBonus) ? "crit" : "dmg");
            if (guardVal > 0) {
              TableUI.spawnFloatText("enemy_active", `被ダメ -${guardVal}`, "guard");
            }
            if (discardedCountE > 0) {
              TableUI.spawnFloatText("enemy_active", `エネ -${discardedCountE}`, "dmg");
            }

            const wkJa = weakBonus ? "（弱点+20）" : "";
            const wkZh = weakBonus ? "（弱点+20）" : "";
            const rivalCallJa = `いくぜ！${actDef.name_ja}の『${sk.name_ja}』だ！`;
            const rivalCallZh = `接招吧！${actDef.name_zh}的“${sk.name_zh}”！`;
            const ja = `レンの${actDef.name_ja}が『${sk.name_ja}』！${tDef.name_ja}に${dmg}ダメージ！${wkJa}`;
            const zh = `对手莲的${actDef.name_zh}发动“${sk.name_zh}”，对${tDef.name_zh}造成 ${dmg} 点伤害！${wkZh}`;
            TableUI.setRival(rivalCallJa, rivalCallZh);
            TableUI.setReferee(ja, zh);
            TableUI.appendLog(ja, zh);
            VoiceEngine.speak(rivalCallJa, "rival");
            VoiceEngine.speak(ja, "referee");
            if (!(await this.matchDelay(480, seq))) return;
            await this.checkKnockOuts();
            if (seq !== this.matchSeq || s.gameOver) return;
          } else if (act.lastDefendedTurn !== s.turn - 1) {
            act.guard = 30;
            act.lastDefendedTurn = s.turn;
            TableUI.renderAll();
            SoundFX.play("guard");
            TableUI.flashAnim("enemy_active", "anim-guard");
            TableUI.spawnFloatText("enemy_active", "🛡️ 防御 -30", "guard");
            const ja = "レンは防御態勢に入りターンを終了した。";
            const zh = "对手莲进入防御姿态并结束了回合。";
            const guardCallJa = "ここは守りを固めておくぜ。";
            TableUI.setRival(guardCallJa, "这回合先稳住防守。");
            TableUI.setReferee(ja, zh);
            TableUI.appendLog(ja, zh);
            VoiceEngine.speak(guardCallJa, "rival");
          } else {
            const ja = "レンはそのままターンを終了した。";
            const zh = "对手莲直接结束了回合。";
            TableUI.setReferee(ja, zh);
            TableUI.appendLog(ja, zh);
          }
        }

        if (!(await this.matchDelay(460, seq))) return;
        s.turn += 1;
        s.currentPlayer = "player";
        s.energyUsedThisTurn = false;
        s.supporterUsedThisTurn = false;
        s.retreatedThisTurn = false;
        s.player.attackBoost = 0;
        s.enemy.attackBoost = 0;
        if (s.player.active) s.player.active.guard = 0;
        let drawn = [];
        if (s.player.deck.length === 0) {
          if (s.player.active) {
            s.player.active.hp = Math.max(0, s.player.active.hp - 20);
            TableUI.renderAll();
            TableUI.spawnFloatText("player_active", "⚡ 疲労 -20", "dmg");
            TableUI.appendLog("山札が空のため疲労ダメージ20！", "己方牌库已空，主战怪兽受到 20 点疲劳伤害！");
            if (!(await this.matchDelay(420, seq))) return;
            await this.checkKnockOuts();
            if (seq !== this.matchSeq || s.gameOver) return;
          }
        } else {
          drawn = this.drawCard("player", 1);
        }
        const ja = `ターン${s.turn}、あなたの番です。${drawn[0] ? `「${drawn[0].ja}」を引きました。` : ""}`;
        const zh = `第 ${s.turn} 回合，轮到你的回合。${drawn[0] ? `抽到了${drawn[0].zh}。` : ""}`;
        TableUI.appendLog(ja, zh);
        if (s.pending && s.pending.type === "promote_bench") {
          TableUI.setReferee(`${s.pending.promptJa}（${ja}）`, `${s.pending.promptZh}（${zh}）`);
        } else {
          TableUI.setReferee(ja, zh);
        }
        TableUI.showTurnBanner(`⚔️ ターン ${s.turn}：あなたの番`, `第 ${s.turn} 回合：你的回合`, false);
      } finally {
        if (seq === this.matchSeq && BattleEngine.state === s) {
          if (!s.gameOver && s.currentPlayer === "enemy") {
            s.currentPlayer = "player";
          }
          s.busy = false;
          TableUI.renderAll();
          this.resetIdleTimer(true);
        }
      }
    }
  };

  /* =========================================================================
     6. TableUI（全屏牌桌渲染、双语换行日志、技能激活高亮与实时 Tips 建议）
     ========================================================================= */
  const TableUI = {
    logEntries: [],

    setReferee(ja, zh) {
      $("refereeJa").textContent = ja || "";
      $("refereeZh").textContent = zh || "";
    },

    setRival(ja, zh) {
      $("rivalJa").textContent = ja ? `「${ja}」` : "";
      $("rivalZh").textContent = zh ? `“${zh}”` : "";
    },

    appendLog(ja, zh) {
      this.logEntries.unshift({ ja: ja || "", zh: zh || ja || "" });
      if (this.logEntries.length > 60) this.logEntries.pop();
      this.renderLog();
    },

    /** 对局记录固定采用「日语换行（中文）」格式显示 */
    renderLog() {
      const box = $("matchLog");
      if (!box) return;
      box.innerHTML = this.logEntries
        .map((e) => `
          <div class="log-entry">
            <div class="log-ja">${escapeHtml(e.ja)}</div>
            <div class="log-zh" lang="zh-CN">（${escapeHtml(e.zh)}）</div>
          </div>
        `)
        .join("");
    },

    getSlotEl(slot) {
      const map = {
        player_active: "#playerActiveSlot",
        enemy_active: "#enemyActiveSlot",
        player_bench_0: "#playerBenchRow .slot-box:nth-child(1)",
        player_bench_1: "#playerBenchRow .slot-box:nth-child(2)",
        player_bench_2: "#playerBenchRow .slot-box:nth-child(3)",
        enemy_bench_0: "#enemyBenchRow .slot-box:nth-child(1)",
        enemy_bench_1: "#enemyBenchRow .slot-box:nth-child(2)",
        enemy_bench_2: "#enemyBenchRow .slot-box:nth-child(3)"
      };
      return map[slot] ? document.querySelector(map[slot]) : null;
    },

    /** 重击或弱点命中时触发牌桌微震反馈 */
    shakePlaymat() {
      const mat = document.querySelector(".playmat");
      if (!mat) return;
      mat.classList.remove("anim-shake");
      void mat.offsetWidth;
      mat.classList.add("anim-shake");
    },

    /** 触发单卡一次性动效（攻击前冲 / 受击震动 / 贴能激活 / 回复 / 登场 / 防御） */
    flashAnim(slot, cls) {
      const slotEl = this.getSlotEl(slot);
      const el = slotEl ? slotEl.querySelector(".card") : null;
      if (!el) return;
      el.classList.remove("anim-hit", "anim-lunge-up", "anim-lunge-down", "anim-powerup", "anim-heal", "anim-enter", "anim-guard");
      void el.offsetWidth;
      el.classList.add(cls);
    },

    /** 在目标槽位上方生成浮动战斗数值/状态文字 */
    spawnFloatText(slot, text, kind = "dmg") {
      const slotEl = this.getSlotEl(slot);
      if (!slotEl || !text) return;
      const badge = document.createElement("div");
      badge.className = `float-text ${kind}`;
      badge.textContent = text;
      slotEl.appendChild(badge);
      setTimeout(() => badge.remove(), 960);
    },

    /** 在目标槽位叠加属性命中/能量/治疗光效 */
    spawnSlotVfx(slot, kind = "fire") {
      const slotEl = this.getSlotEl(slot);
      if (!slotEl) return;
      const vfx = document.createElement("div");
      vfx.className = `vfx-burst vfx-${kind}`;
      slotEl.appendChild(vfx);
      setTimeout(() => vfx.remove(), 650);
    },

    /** 奖赏卡取得时的脉冲反馈（高亮已取得的奖赏槽位） */
    flashPrize(side, count = 1) {
      const box = $(side === "player" ? "playerPrizes" : "enemyPrizes");
      if (!box) return;
      const takenEls = Array.from(box.querySelectorAll(".prize-card.taken"));
      const targets = takenEls.length ? takenEls.slice(0, Math.max(1, count)) : Array.from(box.querySelectorAll(".prize-card"));
      targets.forEach((c) => {
        c.classList.remove("anim-prize-pop");
        void c.offsetWidth;
        c.classList.add("anim-prize-pop");
      });
    },

    /** 牌桌上方醒目双语提示：展示刚获取的奖赏卡张数、卡名与剩余目标 */
    showPrizeBanner(side, prizeCards = [], count = 1, leftAfter = 0) {
      const el = $("prizeToast");
      if (!el) return;
      clearTimeout(this._prizeToastTimer);
      const isEnemy = side === "enemy";
      const takenTotal = TOTAL_PRIZES - leftAfter;
      let ja = "";
      let zh = "";
      if (!isEnemy) {
        const namesJa = prizeCards.map((c) => `「${c.ja}」`).join("・");
        const namesZh = prizeCards.map((c) => `「${c.zh}」`).join("、");
        ja = `★ サイド ${count}枚獲得！（${takenTotal}/${TOTAL_PRIZES}）${namesJa ? ` 手札へ：${namesJa}` : ""}`;
        zh = `获得 ${count} 张奖赏卡！（进度 ${takenTotal}/${TOTAL_PRIZES}）${namesZh ? ` 已加入手牌：${namesZh}` : ""}`;
      } else {
        ja = `相手がサイドを ${count}枚獲得！（相手 ${takenTotal}/${TOTAL_PRIZES}）`;
        zh = `对手获得 ${count} 张奖赏卡！（对手进度 ${takenTotal}/${TOTAL_PRIZES}）`;
      }
      el.className = "prize-toast" + (isEnemy ? " enemy" : "");
      el.innerHTML = `<div class="pt-ja">${escapeHtml(ja)}</div><div class="pt-zh" lang="zh-CN">${escapeHtml(zh)}</div>`;
      void el.offsetWidth;
      el.classList.add("show");
      this._prizeToastTimer = setTimeout(() => el.classList.remove("show"), 2800);
    },

    /** 牌桌中央轻提示回合切换横幅 */
    showTurnBanner(ja, zh, isEnemy = false) {
      const el = $("turnBanner");
      if (!el) return;
      clearTimeout(this._bannerTimer);
      el.className = "turn-banner" + (isEnemy ? " enemy" : "");
      el.innerHTML = `<div class="tb-ja">${escapeHtml(ja)}</div><div class="tb-zh" lang="zh-CN">${escapeHtml(zh)}</div>`;
      void el.offsetWidth;
      el.classList.add("show");
      this._bannerTimer = setTimeout(() => el.classList.remove("show"), 1150);
    },

    /** 顶部轻提示弹窗（用于设置保存成功等即时反馈） */
    showToast(ja, zh) {
      const el = $("saveToast");
      if (!el) return;
      clearTimeout(this._toastTimer);
      el.innerHTML = `${SVG_ICONS.check}${escapeHtml(ja)}${zh ? `<span class="zh-inline" lang="zh-CN">（${escapeHtml(zh)}）</span>` : ""}`;
      el.classList.add("show");
      this._toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
    },

    renderMonsterCard(inst, slot) {
      const def = SpecEngine.getMonster(inst.id);
      if (!def) return "";
      const pct = Math.max(0, Math.min(100, Math.round((inst.hp / def.hp) * 100)));
      const dmgTaken = Math.max(0, def.hp - inst.hp);
      const fillCls = pct <= 35 ? "low" : pct <= 65 ? "mid" : "";
      const pipsHtml = (inst.energies || []).map((el) =>
        `<span class="pip ${escapeHtml(el)} filled">${SVG_ICONS[el] || SVG_ICONS.any}</span>`
      ).join("");

      const sNow = BattleEngine.state;
      const eAct = sNow?.enemy?.active;
      const eActDef = eAct ? SpecEngine.getMonster(eAct.id) : null;
      const unlocked = sNow?.recentlyUnlocked;
      const skillsHtml = def.skills.map((sk) => {
        const ready = BattleEngine.canPayCost(inst.energies, sk.cost);
        const justUnlocked = Boolean(unlocked && unlocked.slot === slot && unlocked.skills.includes(sk.name_ja));
        const resolvedPips = BattleEngine.resolveCostPips(inst.energies, sk.cost);
        const costPips = resolvedPips.map((p) =>
          `<span class="pip ${escapeHtml(p.elem)} ${p.filled ? "filled" : "unfilled"}">${SVG_ICONS[p.elem] || SVG_ICONS.any}</span>`
        ).join("");
        const targetTag = sk.target === "enemy_any"
          ? `<span class="skill-tag snipe" title="狙撃ワザ：バトル場・ベンチどちらにも攻撃可（ベンチは弱点なし）／狙击技能：可攻击对手战斗区或备战区任意怪兽（对备战区不计弱点）">${SVG_ICONS.snipe}狙撃</span>`
          : '<span class="skill-tag normal" title="通常ワザ：相手バトル場のみ攻撃可／普通技能：仅限攻击对手战斗区怪兽">通常・前</span>';
        const gVal = sk.guardVal || (sk.effect === "guard_20" ? 20 : 0);
        const dMatch = /^discard_self_(\d+)$/.exec(sk.effect || "");
        const dVal = sk.discardSelfVal || (dMatch ? Number(dMatch[1]) : 0);
        const effectTag = (gVal > 0
          ? `<span class="skill-tag guard" title="次の相手ターン被ダメ-${gVal}／发动后下回合受击伤害 -${gVal}">被ダメ-${gVal}</span>`
          : "") + (dVal > 0
          ? `<span class="skill-tag guard" title="発動後自身のエネルギーを${dVal}枚トラッシュ／发动后弃置自身 ${dVal} 张能量">エネ-${dVal}</span>`
          : "");
        const canDirectClick = ready && slot === "player_active";
        let dmgHtml = `<span class="skill-dmg">${sk.damage}</span>`;
        let lethalHtml = "";
        if (slot === "player_active" && eAct && eActDef) {
          const wk = BattleEngine.getWeaknessBonus(def.element, eActDef.element);
          const bst = sNow?.player?.attackBoost || 0;
          const red = eAct.guard || 0;
          const eff = Math.max(0, sk.damage + wk + bst - red);
          if (eff !== sk.damage) {
            dmgHtml = `<span class="skill-dmg">${sk.damage}<span class="eff-dmg">→${eff}</span></span>`;
          }
          if (ready && eff >= eAct.hp) {
            lethalHtml = '<span class="lethal-tag" title="一撃で撃破可能（可直接击倒）">⚔️撃破</span>';
          }
        }
        return `
          <div class="skill-line ${ready ? "ready" : ""} ${justUnlocked ? "just-unlocked" : ""}"
               data-skill-ja="${escapeHtml(sk.name_ja)}"
               data-slot="${escapeHtml(slot)}"
               ${canDirectClick ? 'title="クリックで発動（点击直接发动）"' : ""}>
            <div class="skill-left">
              ${costPips}
              <span class="skill-name">${escapeHtml(sk.name_ja)}<span class="zh-inline" lang="zh-CN">（${escapeHtml(sk.name_zh)}）</span></span>
              ${targetTag}${effectTag}
            </div>
            <span class="skill-right">
              ${lethalHtml}
              ${ready && !lethalHtml ? '<span class="skill-ready-tag">発動可</span>' : ""}
              ${dmgHtml}
            </span>
          </div>
        `;
      }).join("");

      const weakElem = WEAKNESS_MAP[def.element];
      const weakBadge = weakElem
        ? `<span class="weak-chip">弱<span style="color:${ELEM_COLOR[weakElem] || 'inherit'};display:inline-flex;vertical-align:-1px;"><span class="chip-icon" style="margin:0 1px;">${SVG_ICONS[weakElem]}</span></span>+20</span>`
        : "";
      const showBoost = (slot === "player_active" && sNow?.player?.attackBoost > 0)
        ? sNow.player.attackBoost
        : (slot === "enemy_active" && sNow?.enemy?.attackBoost > 0 ? sNow.enemy.attackBoost : 0);
      let threatHtml = "";
      if (slot === "player_active" && sNow?.phase === "battle" && eAct && eActDef) {
        const eMax = BattleEngine.estimateUnitMaxOutput(eAct, inst, true, []);
        if (typeof eMax === "number" && eMax >= inst.hp) {
          threatHtml = `<span class="threat-chip" title="相手次ターン最大${eMax}ダメージできぜつ危険（下回合敌方最高可打 ${eMax} 伤害，有被击倒风险）">⚠️危険</span>`;
        }
      }
      return `
        <div class="card ${escapeHtml(def.element)} ${def.is_ex ? "is-ex" : ""} ${inst.guard > 0 ? "guarding" : ""}" data-slot="${escapeHtml(slot)}">
          <div class="card-head">
            <div class="card-head-left">
              ${CARD_ART[inst.id] ? `<span class="card-art">${CARD_ART[inst.id]}</span>` : `<span class="pip ${escapeHtml(def.element)} filled">${SVG_ICONS[def.element] || SVG_ICONS.any}</span>`}
              <div class="card-title-inline">${escapeHtml(def.name_ja)}<span class="zh-sub" lang="zh-CN">（${escapeHtml(def.name_zh)}）</span></div>
            </div>
            <div class="card-head-right">${threatHtml}<span class="hp-badge">HP ${inst.hp}/${def.hp}</span></div>
          </div>
          <div class="hp-track"><div class="hp-fill ${fillCls}" style="width:${pct}%"></div></div>
          <div class="token-row">
            <div class="energy-pips">${pipsHtml || '<span style="font-size:9.5px;color:#8c806d;">エネ0<span class="zh-inline" lang="zh-CN">（无能量）</span></span>'}</div>
            <div class="token-chips">
              ${def.is_ex ? '<span class="ex-chip">ex・2枚</span>' : ""}
              ${weakBadge}
              ${showBoost > 0 ? `<span class="boost-chip">${SVG_ICONS.boost}+${showBoost}</span>` : ""}
              ${dmgTaken > 0 ? `<span class="dmg-chip">-${dmgTaken}</span>` : ""}
              ${inst.guard > 0 ? `<span class="guard-chip">${SVG_ICONS.shield}-${inst.guard}</span>` : ""}
            </div>
          </div>
          <div class="skills-list">${skillsHtml}</div>
        </div>
      `;
    },

    renderHandCard(cardId, idx) {
      const s = BattleEngine.state;
      const selected = s.selectedHandIndex === idx;
      const mon = SpecEngine.getMonster(cardId);
      if (mon) {
        const isSetup = s.phase === "setup";
        const monTitle = isSetup
          ? ' title="クリックまたは名前を言って先発に出す（点击或说出名字作为首发上场）"'
          : ' title="クリックまたは音声でベンチに出せます（手牌有怪兽卡可直接点击或语音放入备战区）"';
        return `
          <div class="card ${escapeHtml(mon.element)} ${mon.is_ex ? "is-ex" : ""} hand-card ${selected ? "selected" : ""} ${isSetup ? "setup-pick" : ""}" data-hand-idx="${idx}" draggable="true"${monTitle}>
            <div class="card-head">
              <div class="card-head-left">
                ${CARD_ART[mon.id] ? `<span class="card-art">${CARD_ART[mon.id]}</span>` : `<span class="pip ${escapeHtml(mon.element)} filled">${SVG_ICONS[mon.element] || SVG_ICONS.any}</span>`}
                <div class="card-title-inline">${escapeHtml(mon.name_ja)}<span class="zh-sub" lang="zh-CN">（${escapeHtml(mon.name_zh)}）</span></div>
              </div>
              <div class="card-head-right">
                <span class="hp-badge">HP ${mon.hp}</span>
                ${mon.is_ex ? '<span class="ex-chip">ex・2枚</span>' : ""}
              </div>
            </div>
            ${isSetup ? '<span class="setup-pick-tag">先発に選ぶ<span class="zh-inline" lang="zh-CN">（点击出战）</span></span>' : ""}
            <div class="skills-list">
              ${mon.skills.map((sk) => `
                <div class="skill-line">
                  <div class="skill-left">
                    <span class="skill-name">${escapeHtml(sk.name_ja)}<span class="zh-inline" lang="zh-CN">（${escapeHtml(sk.name_zh)}）</span></span>
                    ${sk.target === "enemy_any" ? `<span class="skill-tag snipe">${SVG_ICONS.snipe}狙撃</span>` : '<span class="skill-tag normal">通常·前</span>'}
                  </div>
                  <span class="skill-dmg">${sk.damage}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
      const it = SpecEngine.getItem(cardId);
      if (!it) return "";
      const isSup = it.category === "supporter";
      const cls = it.category === "energy" ? it.element : (isSup ? "supporter" : "item");
      const supUsed = isSup && BattleEngine.state.supporterUsedThisTurn;
      return `
        <div class="card ${escapeHtml(cls)} hand-card ${selected ? "selected" : ""} ${supUsed ? "supporter-used" : ""}" data-hand-idx="${idx}" draggable="true">
          <div class="card-head">
            <div class="card-head-left">
              ${CARD_ART[it.id] ? `<span class="card-art">${CARD_ART[it.id]}</span>` : ""}
              <div class="card-title-inline">${escapeHtml(it.name_ja)}<span class="zh-sub" lang="zh-CN">（${escapeHtml(it.name_zh)}）</span></div>
            </div>
            ${isSup ? `<span class="supporter-chip">${supUsed ? "使用済" : "サポート"}</span>` : `<span class="pip ${escapeHtml(cls)}">${SVG_ICONS[it.element] || SVG_ICONS.item}</span>`}
          </div>
          <div class="card-desc">
            <div class="desc-ja">${escapeHtml(it.desc_ja)}</div>
            <div class="desc-zh" lang="zh-CN">${escapeHtml(it.desc_zh)}</div>
          </div>
        </div>
      `;
    },

    codexFilter: "ALL",

    /** 渲染卡牌图鉴弹窗（全部怪兽技能类型 + 能量/道具/支援者） */
    renderCodex(filter) {
      if (filter) this.codexFilter = filter;
      const f = this.codexFilter || "ALL";
      const filterBox = $("codexFilters");
      if (filterBox) {
        filterBox.querySelectorAll(".dlog-chip").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-codex") === f);
        });
      }
      const grid = $("codexGrid");
      if (!grid) return;
      const cards = [];

      if (f === "ALL" || f === "player" || f === "opponent") {
        const mons = f === "ALL" ? SpecEngine.monsters : SpecEngine.monsters.filter((m) => m.side === f);
        for (const m of mons) {
          const weakElem = WEAKNESS_MAP[m.element];
          const weakHtml = weakElem
            ? `<span class="weak-chip">弱 ${ELEM_ICON[weakElem] || ""}+20</span>`
            : "";
          const sideHtml = m.side === "player"
            ? '<span class="side-tag player">自分デッキ<span class="zh-inline" lang="zh-CN">（己方卡组）</span></span>'
            : '<span class="side-tag opponent">相手デッキ<span class="zh-inline" lang="zh-CN">（对手卡组）</span></span>';
          const skillsHtml = m.skills.map((sk) => {
            const pips = (sk.cost || []).map((c) =>
              `<span class="pip ${escapeHtml(c)} filled">${SVG_ICONS[c] || SVG_ICONS.any}</span>`
            ).join("");
            const isSnipe = sk.target === "enemy_any";
            const tagHtml = isSnipe
              ? `<span class="skill-tag snipe">${SVG_ICONS.snipe}狙撃</span>`
              : '<span class="skill-tag normal">通常·前</span>';
            const gVal = sk.guardVal || (sk.effect === "guard_20" ? 20 : 0);
            const dMatch = /^discard_self_(\d+)$/.exec(sk.effect || "");
            const dVal = sk.discardSelfVal || (dMatch ? Number(dMatch[1]) : 0);
            const effHtml = (gVal > 0 ? `<span class="skill-tag guard">被ダメ-${gVal}</span>` : "")
              + (dVal > 0 ? `<span class="skill-tag guard">エネ-${dVal}</span>` : "");
            const desc = isSnipe
              ? '狙撃ワザ：相手バトル場・ベンチどちらも可（ベンチは弱点なし）<br><span class="zh-inline" lang="zh-CN">定点狙击：可打对手战斗区或备战区任意怪兽（对备战区不计弱点）</span>'
              : (gVal > 0
                ? `通常ワザ：相手バトル場のみ（次の相手ターン被ダメ-${gVal}）<br><span class="zh-inline" lang="zh-CN">普通攻击：仅打对手战斗区，发动后下回合受击 -${gVal}</span>`
                : (dVal > 0
                  ? `通常ワザ：相手バトル場のみ（発動後自身のエネルギーを${dVal}枚トラッシュ）<br><span class="zh-inline" lang="zh-CN">普通攻击：仅打对手战斗区，发动后弃置自身 ${dVal} 张能量</span>`
                  : '通常ワザ：相手バトル場のみ（弱点+20）<br><span class="zh-inline" lang="zh-CN">普通攻击：仅打对手战斗区（计算弱点 +20）</span>'));
            return `
              <div class="codex-skill-row">
                <div class="codex-skill-top">
                  <div class="skill-left">${pips}<span class="skill-name">${escapeHtml(sk.name_ja)}<span class="zh-inline" lang="zh-CN">（${escapeHtml(sk.name_zh)}）</span></span>${tagHtml}${effHtml}</div>
                  <span class="skill-dmg">${sk.damage}</span>
                </div>
                <div class="codex-skill-desc">${desc}</div>
              </div>
            `;
          }).join("");
          cards.push(`
            <div class="codex-card ${escapeHtml(m.element)} ${m.is_ex ? "is-ex" : ""}">
              <div class="card-head">
                <div class="card-head-left">
                  ${CARD_ART[m.id] ? `<span class="card-art">${CARD_ART[m.id]}</span>` : `<span class="pip ${escapeHtml(m.element)} filled">${SVG_ICONS[m.element] || SVG_ICONS.any}</span>`}
                  <div class="card-title-inline">${escapeHtml(m.name_ja)}<span class="zh-sub" lang="zh-CN">（${escapeHtml(m.name_zh)}）</span></div>
                </div>
                <span class="hp-badge">HP ${m.hp}</span>
              </div>
              <div class="codex-meta">
                <div>${sideHtml} ${m.is_ex ? '<span class="ex-chip">ex・サイド2枚<span class="zh-inline" lang="zh-CN">（击倒拿2张）</span></span>' : ""}</div>
                <div>${weakHtml}</div>
              </div>
              <div class="codex-skills">${skillsHtml}</div>
            </div>
          `);
        }
      }

      if (f === "ALL" || f === "items") {
        for (const it of SpecEngine.items) {
          const isSup = it.category === "supporter";
          const cls = it.category === "energy" ? it.element : (isSup ? "supporter" : "item");
          const catLabel = it.category === "energy"
            ? 'エネルギー<span class="zh-inline" lang="zh-CN">（能量卡，每回合限贴1次）</span>'
            : (isSup
              ? 'サポート<span class="zh-inline" lang="zh-CN">（支援者卡，每回合限用1张）</span>'
              : 'グッズ<span class="zh-inline" lang="zh-CN">（普通道具卡，不限次数）</span>');
          cards.push(`
            <div class="codex-card ${escapeHtml(cls)}">
              <div class="card-head">
                <div class="card-head-left">
                  ${CARD_ART[it.id] ? `<span class="card-art">${CARD_ART[it.id]}</span>` : `<span class="pip ${escapeHtml(cls)} filled">${SVG_ICONS[it.element] || SVG_ICONS.item}</span>`}
                  <div class="card-title-inline">${escapeHtml(it.name_ja)}<span class="zh-sub" lang="zh-CN">（${escapeHtml(it.name_zh)}）</span></div>
                </div>
                ${isSup ? '<span class="supporter-chip">サポート</span>' : `<span class="side-tag">${it.category === "energy" ? "エネルギー" : "グッズ"}</span>`}
              </div>
              <div class="codex-meta"><span>${catLabel}</span></div>
              <div class="card-desc" style="padding:0 9px;">
                <div class="desc-ja">${escapeHtml(it.desc_ja)}</div>
                <div class="desc-zh" lang="zh-CN">${escapeHtml(it.desc_zh)}</div>
              </div>
            </div>
          `);
        }
      }

      grid.innerHTML = cards.join("");
    },

    /** 打开双方弃牌区（按能量/怪兽/道具分组，己方高亮可回收能量）或牌库初始卡表双语弹窗 */
    openPileModal(kind) {
      const s = BattleEngine.state;
      const modal = $("pileModal");
      const titleEl = $("pileModalTitle");
      const bodyEl = $("pileModalBody");
      if (!s || !modal || !titleEl || !bodyEl) return;

      const isDeck = kind === "player_deck" || kind === "enemy_deck";
      const isPlayer = kind === "player_trash" || kind === "player_deck";
      const list = isDeck
        ? (isPlayer ? (SpecEngine.decks?.player || BattleEngine.INITIAL_DECKS.player) : (SpecEngine.decks?.enemy || BattleEngine.INITIAL_DECKS.enemy))
        : (isPlayer ? (s.player.trash || []) : (s.enemy.trash || []));

      if (isDeck) {
        titleEl.innerHTML = isPlayer
          ? `自分の初期デッキリスト<span class="zh-inline" lang="zh-CN">（己方初始卡表，共 ${list.length} 张）</span>`
          : `相手の初期デッキリスト<span class="zh-inline" lang="zh-CN">（对手初始卡表，共 ${list.length} 张）</span>`;
      } else {
        titleEl.innerHTML = isPlayer
          ? `自分のトラッシュ<span class="zh-inline" lang="zh-CN">（己方弃牌区，共 ${list.length} 张）</span>`
          : `相手のトラッシュ<span class="zh-inline" lang="zh-CN">（对手弃牌区，共 ${list.length} 张）</span>`;
      }

      const counts = new Map();
      for (const id of list) counts.set(id, (counts.get(id) || 0) + 1);

      const energies = [];
      const monsters = [];
      const trainers = [];
      let totalEnergy = 0;
      for (const [id, qty] of counts.entries()) {
        const mon = SpecEngine.getMonster(id);
        const it = SpecEngine.getItem(id);
        if (mon) {
          monsters.push({ id, qty, cls: mon.element, ja: mon.name_ja, zh: mon.name_zh, art: CARD_ART[id] || "", icon: SVG_ICONS[mon.element] || SVG_ICONS.any });
        } else if (it && it.category === "energy") {
          totalEnergy += qty;
          energies.push({ id, qty, cls: it.element, ja: it.name_ja, zh: it.name_zh, icon: SVG_ICONS[it.element] || SVG_ICONS.any });
        } else if (it) {
          trainers.push({ id, qty, cls: it.category === "supporter" ? "supporter" : "item", ja: it.name_ja, zh: it.name_zh, art: CARD_ART[id] || "" });
        }
      }

      let bannerHtml = "";
      if (isDeck) {
        bannerHtml = `<div class="pile-modal-banner"><span>※山札の順番やサイドの中身は非公開です（初期構成のみ表示）</span><span class="zh-inline" lang="zh-CN" style="font-weight:500;color:var(--ink-sub);">牌库顺序与奖赏卡内容保密，仅展示初始 20 张卡表</span></div>`;
      } else if (isPlayer) {
        const elemSummary = energies.map((e) => `${escapeHtml(e.ja)}×${escapeHtml(e.qty)}`).join("・");
        bannerHtml = `<div class="pile-modal-banner recycle"><span>⚡ エネ回収対象：<strong>${totalEnergy}枚</strong><span class="zh-inline" lang="zh-CN">（可回收能量 <strong>${totalEnergy}</strong> 张）</span></span><span style="font-size:11px;">${elemSummary || '回収可能なエネルギーなし<span class="zh-inline" lang="zh-CN">（暂无可回收能量）</span>'}</span></div>`;
      }

      const renderGroup = (titleJa, titleZh, items) => {
        if (items.length === 0) return "";
        const sum = items.reduce((a, b) => a + b.qty, 0);
        const chips = items.map((x) => `
          <div class="pile-chip ${escapeHtml(x.cls)}">
            <div class="pile-chip-left">
              ${x.art ? `<span class="card-art" style="width:24px;height:24px;">${x.art}</span>` : `<span class="pip ${escapeHtml(x.cls)} filled">${x.icon || SVG_ICONS.item}</span>`}
              <div class="pile-chip-name">${escapeHtml(x.ja)}<span class="pile-chip-zh" lang="zh-CN">${escapeHtml(x.zh)}</span></div>
            </div>
            <span class="pile-chip-qty">×${x.qty}</span>
          </div>
        `).join("");
        return `
          <div class="pile-section">
            <div class="pile-section-title"><span>${titleJa}<span class="zh-inline" lang="zh-CN">（${titleZh}）</span></span><span>${sum}枚</span></div>
            <div class="pile-chip-grid">${chips}</div>
          </div>
        `;
      };

      if (list.length === 0) {
        bodyEl.innerHTML = `${bannerHtml}<div class="pile-empty">トラッシュにカードはありません。<br><span class="zh-inline" lang="zh-CN">弃牌区目前为空。</span></div>`;
      } else {
        bodyEl.innerHTML = bannerHtml
          + renderGroup("エネルギー", "能量卡", energies)
          + renderGroup("モンスター", "怪兽卡", monsters)
          + renderGroup("サポートとグッズ", "支援者与道具", trainers);
      }
      modal.classList.add("open");
    },

    _tipSeq: 0,

    /** 按需调用 Vertex LLM 生成当前盘面的 AI 战术建议 */
    async requestAiTip() {
      const cfg = ConfigManager.data;
      const url = ConfigManager.buildRestUrl(cfg.llmModel);
      const s = BattleEngine.state;
      const btn = $("btnAiTip");
      if (!s || s.gameOver) return;
      if (!url) {
        this.renderLiveTip();
        TableUI.showToast("APIキー未設定のためローカル戦術を表示中", "未配置 API Key，已显示本地实时战术建议");
        return;
      }

      const seq = ++this._tipSeq;
      if (btn) { btn.disabled = true; btn.innerHTML = '解析中…<span class="zh-inline" lang="zh-CN">（分析中…）</span>'; }
      const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ac ? setTimeout(() => ac.abort(), 8000) : null;
      try {
        const snap = BattleEngine.getSnapshot();
        const genCfg = { responseMimeType: "application/json" };
        const thinkCfg = ConfigManager.buildThinkingConfig(cfg.llmModel);
        if (thinkCfg) genCfg.thinkingConfig = thinkCfg;
        const res = await fetch(url, {
          method: "POST",
          headers: ConfigManager.buildAuthHeaders(),
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text: `あなたは完全オリジナルカードゲーム「言霊デュエル」（水→炎、炎→雷、雷→水で弱点+20、ベンチ狙撃時は弱点なし、1ターンにエネ1回・サポート1枚）の戦術コーチです。場の生き物は必ず「モンスター」と呼び、他作品の固有名詞・略称は一切使用しないでください。盤面JSONを見て今ターン最善の1手を1文で提案し、純粋JSONのみで返してください：{"tip_ja":"日本語1文","tip_zh":"中国語訳1文"}\n盤面JSON:\n${JSON.stringify(snap)}`
              }]
            }],
            generationConfig: genCfg
          }),
          signal: ac ? ac.signal : undefined
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (seq !== this._tipSeq) return;
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || "";
        const parsed = NLUEngine.safeParseJson(raw);
        if (seq !== this._tipSeq || !parsed?.tip_ja) throw new Error("invalid tip json");
        const jaEl = $("liveTipJa");
        const zhEl = $("liveTipZh");
        const aiTag = $("liveTipAiTag");
        if (jaEl) jaEl.textContent = sanitizeBrandTerms(parsed.tip_ja);
        if (zhEl) zhEl.textContent = `（${sanitizeBrandTerms(parsed.tip_zh || parsed.tip_ja)}）`;
        if (aiTag) aiTag.style.display = "inline-block";
      } catch (e) {
        DebugLog.add("ERR", "AI 战术分析失败", e?.name === "AbortError" ? "timeout" : (e?.message || "error"));
        this.renderLiveTip();
        TableUI.showToast("AI戦術分析に失敗・ローカル提案を表示中", "AI 分析连接失败，已显示本地战术建议");
      } finally {
        if (timer) clearTimeout(timer);
        if (btn) { btn.disabled = false; btn.innerHTML = `${SVG_ICONS.sparkle}AI戦術<span class="zh-inline" lang="zh-CN">（AI分析）</span>`; }
      }
    },

    /** 本地实时战术建议（结合弱点克制、备战狙击斩杀、最优能量匹配与道具状态即时生成） */
    renderLiveTip() {
      const jaEl = $("liveTipJa");
      const zhEl = $("liveTipZh");
      const aiTag = $("liveTipAiTag");
      if (!jaEl || !zhEl) return;
      if (aiTag) aiTag.style.display = "none";

      const s = BattleEngine.state;
      let ja = "";
      let zh = "";

      if (!s || s.gameOver) {
        ja = "対局終了です。「再戦」から新しい勝負を始められます。";
        zh = "对局已结束，点击「重开」即可开始新一局。";
      } else if (s.phase === "setup") {
        ja = "緑枠の手札モンスターをクリックするか名前を言って、バトル場の最初の1体を選びましょう。";
        zh = "点击手牌中绿色高亮的怪兽或说出它的名字，选择战斗区首发怪兽！";
      } else if (s.currentPlayer !== "player") {
        ja = "相手レンのターンです。動きが終わるまでお待ちください。";
        zh = "当前是对手莲的回合，请稍候。";
      } else if (s.pending) {
        ja = "審判の確認待ちです。音声かテキストで返答するか、上の候補ボタンを押してください。";
        zh = "裁判正在等待确认，可直接语音/文字回复，或点击上方选项按钮。";
      } else {
        const act = s.player.active;
        const actDef = act ? SpecEngine.getMonster(act.id) : null;
        const enemyAct = s.enemy.active;
        const enemyDef = enemyAct ? SpecEngine.getMonster(enemyAct.id) : null;
        const usable = act && actDef ? actDef.skills.filter((sk) => BattleEngine.canPayCost(act.energies, sk.cost)) : [];
        const energyCards = s.player.hand.filter((id) => id.startsWith("energy_"));
        const handMon = s.player.hand.find((id) => Boolean(SpecEngine.getMonster(id)));
        const hasEmptyBench = s.player.bench.some((b) => b === null);
        const weakBonus = actDef && enemyDef ? BattleEngine.getWeaknessBonus(actDef.element, enemyDef.element) : 0;
        const boost = s.player.attackBoost || 0;

        const koSkill = enemyAct ? usable.find((sk) => Math.max(0, sk.damage + weakBonus + boost - (enemyAct.guard || 0)) >= enemyAct.hp) : null;
        const snipeSk = usable.find((sk) => sk.target === "enemy_any");
        const snipeKoTarget = snipeSk
          ? BattleEngine.getBenchEntries("enemy").find((e) => Math.max(0, snipeSk.damage + boost) >= e.unit.hp)
          : null;
        if (koSkill && actDef && enemyDef) {
          ja = `『${koSkill.name_ja}』で相手の${enemyDef.name_ja}を一撃撃破できます！${weakBonus ? "（弱点+20）" : ""}`;
          zh = `现在发动「${koSkill.name_zh}」即可直接击倒对手的${enemyDef.name_zh}拿下奖赏卡！${weakBonus ? "（触发弱点+20）" : ""}`;
        } else if (snipeSk && snipeKoTarget) {
          ja = `狙撃技『${snipeSk.name_ja}』で相手ベンチの${snipeKoTarget.def.name_ja}を撃破できます！`;
          zh = `使用狙击技能「${snipeSk.name_zh}」可直接击倒对手备战区的${snipeKoTarget.def.name_zh}！`;
        } else if (!s.energyUsedThisTurn && energyCards.length > 0 && act && actDef) {
          let bestEDef = null;
          let bestUnlock = null;
          for (const eid of Array.from(new Set(energyCards))) {
            const candDef = SpecEngine.getItem(eid);
            const nextE = [...act.energies, candDef.element];
            const unlocked = actDef.skills.find(
              (sk) => !BattleEngine.canPayCost(act.energies, sk.cost) && BattleEngine.canPayCost(nextE, sk.cost)
            );
            if (unlocked) { bestEDef = candDef; bestUnlock = unlocked; break; }
            if (!bestEDef && candDef.element === actDef.element) bestEDef = candDef;
          }
          const eDef = bestEDef || SpecEngine.getItem(energyCards[0]);
          if (bestUnlock) {
            ja = `${actDef.name_ja}に${eDef.name_ja}をつけると『${bestUnlock.name_ja}（${bestUnlock.damage}）』が発動可能になります。`;
            zh = `给${actDef.name_zh}贴上${eDef.name_zh}即可激活「${bestUnlock.name_zh}（${bestUnlock.damage}）」，推荐先贴能。`;
          } else {
            ja = `まだエネルギー未添付です。${actDef.name_ja}かベンチに${eDef.name_ja}をつけて蓄えましょう。`;
            zh = `本回合还可贴 1 次能量，建议为${actDef.name_zh}或备战区贴上${eDef.name_zh}。`;
          }
        } else if (energyCards.length === 0 && s.player.hand.includes("item_recycle") && s.player.trash.some((id) => id.startsWith("energy_"))) {
          ja = "「エネ回収」でトラッシュからエネルギーを手札に戻せます。";
          zh = "可以使用「能量回收」从弃牌区取回 1 张能量卡。";
        } else if (handMon && hasEmptyBench) {
          const mDef = SpecEngine.getMonster(handMon);
          ja = `手札の${mDef.name_ja}をベンチに出して控えを整えておきましょう。`;
          zh = `可以将手牌中的${mDef.name_zh}放入备战区，提前做好连战和换人准备。`;
        } else if (act && actDef && act.hp <= 50 && s.player.hand.includes("item_potion")) {
          ja = `${actDef.name_ja}のHPが減っています。「きずぐすり」で30回復すると安全です。`;
          zh = `${actDef.name_zh}血量较低，建议先使用「伤药」回复 30 HP。`;
        } else if (!s.supporterUsedThisTurn && usable.length > 0 && s.player.hand.includes("item_power")) {
          ja = "「パワーバッジ」を使ってから攻撃するとダメージが+20されます！";
          zh = "先使用手牌中的「力量徽章」再攻击，可额外增加 20 点伤害！";
        } else if (usable.length > 0 && actDef) {
          const best = [...usable].sort((a, b) => b.damage - a.damage)[0];
          ja = `${actDef.name_ja}の『${best.name_ja}（${best.damage}）』が発動可能です。クリックか「攻撃して」で攻めましょう。`;
          zh = `${actDef.name_zh}的「${best.name_zh}（${best.damage}）」已激活，点击技能条或直接说「攻击」即可出招。`;
        } else if (!s.supporterUsedThisTurn && s.player.hand.includes("item_bag") && s.player.deck.length > 0) {
          ja = "「補給バッグ」で山札を2枚引き、エネルギーやカードを探しましょう。";
          zh = "可以先使用「补给包」抽 2 张牌，寻找能量卡或道具。";
        } else {
          ja = "エネルギー不足のときは「防御態勢」で次の被ダメージを30軽減できます。";
          zh = "能量不足时，可选择「防御姿态」减少下回合 30 点伤害。";
        }
      }

      jaEl.textContent = ja;
      zhEl.textContent = `（${zh}）`;
    },

    renderAll() {
      const s = BattleEngine.state;
      if (!s) return;

      const badge = $("turnBadge");
      badge.className = "turn-pill" + (s.currentPlayer === "enemy" ? " enemy-turn" : "");
      badge.innerHTML = s.phase === "setup"
        ? '対戦準備：先発モンスターを選択<span class="zh-inline" lang="zh-CN">（开局准备：选择首发怪兽）</span>'
        : (s.currentPlayer === "player"
          ? `ターン ${s.turn}：あなたの番<span class="zh-inline" lang="zh-CN">（第 ${s.turn} 回合：你的回合）</span>`
          : `ターン ${s.turn}：相手レンの番<span class="zh-inline" lang="zh-CN">（第 ${s.turn} 回合：对手回合）</span>`);

      const limBox = $("turnLimits");
      if (limBox) {
        limBox.style.display = s.phase === "battle" && s.currentPlayer === "player" ? "inline-flex" : "none";
        const limE = $("limitEnergy");
        const limS = $("limitSupporter");
        const limR = $("limitRetreat");
        if (limE) { limE.className = "limit-pill" + (s.energyUsedThisTurn ? " used" : ""); limE.innerHTML = `${SVG_ICONS.boost}${s.energyUsedThisTurn ? 'エネ 0/1<span class="zh-inline" lang="zh-CN">（已贴能）</span>' : 'エネ 1/1<span class="zh-inline" lang="zh-CN">（贴能）</span>'}`; }
        if (limS) { limS.className = "limit-pill" + (s.supporterUsedThisTurn ? " used" : ""); limS.innerHTML = `${SVG_ICONS.starChip}${s.supporterUsedThisTurn ? 'サポート 0/1<span class="zh-inline" lang="zh-CN">（已用）</span>' : 'サポート 1/1<span class="zh-inline" lang="zh-CN">（支援）</span>'}`; }
        if (limR) { limR.className = "limit-pill" + (s.retreatedThisTurn ? " used" : ""); limR.innerHTML = `${SVG_ICONS.swapChip}${s.retreatedThisTurn ? '交代 0/1<span class="zh-inline" lang="zh-CN">（已撤退）</span>' : '交代 1/1<span class="zh-inline" lang="zh-CN">（撤退）</span>'}`; }
      }

      const prizeIdx = Array.from({ length: TOTAL_PRIZES }, (_, i) => i);
      const enemyTaken = TOTAL_PRIZES - s.enemy.prizesLeft;
      const playerTaken = TOTAL_PRIZES - s.player.prizesLeft;
      $("enemyPrizes").innerHTML = prizeIdx.map((i) => {
        const taken = i < enemyTaken;
        return `<div class="prize-card ${taken ? "taken enemy-taken" : ""}" title="${taken ? "取得済（已拿取）" : "残りサイド（未拿取）"}">${taken ? "✓" : "★"}</div>`;
      }).join("");
      $("playerPrizes").innerHTML = prizeIdx.map((i) => {
        const taken = i < playerTaken;
        return `<div class="prize-card ${taken ? "taken" : ""}" title="${taken ? "取得済（已拿取）" : "残りサイド（未拿取）"}">${taken ? "✓" : "★"}</div>`;
      }).join("");
      const epc = $("enemyPrizeCount");
      if (epc) {
        epc.textContent = `取得 ${enemyTaken}/${TOTAL_PRIZES}`;
        epc.className = "prize-count-pill" + (enemyTaken > 0 ? " enemy-progress" : "");
      }
      const ppc = $("playerPrizeCount");
      if (ppc) {
        ppc.textContent = `取得 ${playerTaken}/${TOTAL_PRIZES}`;
        ppc.className = "prize-count-pill" + (playerTaken > 0 ? " has-progress" : "");
      }
      $("enemyDeckCount").textContent = s.enemy.deck.length;
      $("enemyTrashCount").textContent = s.enemy.trash.length;
      $("playerDeckCount").textContent = s.player.deck.length;
      $("playerTrashCount").textContent = s.player.trash.length;

      const selCardId = s.selectedHandIndex !== null ? s.player.hand[s.selectedHandIndex] : null;
      const needAllyTarget = selCardId && (selCardId.startsWith("energy_") || selCardId === "item_potion");
      const needEnemyBench = selCardId === "item_flute";
      const pendingAlly = s.pending && (s.pending.type === "promote_bench" || (s.pending.type === "choose_target" && s.pending.context.side === "player"));
      const pendingEnemy = s.pending && s.pending.type === "choose_target" && s.pending.context.side === "enemy";

      /* 重绘槽位前暂存仍在播放中的飘字与命中光效节点，防止击倒重绘瞬间 0ms 抹杀特效 */
      const savedVfx = {};
      ["enemy_active", "player_active", "enemy_bench_0", "enemy_bench_1", "enemy_bench_2", "player_bench_0", "player_bench_1", "player_bench_2"].forEach((sl) => {
        const box = this.getSlotEl(sl);
        if (!box || typeof box.querySelectorAll !== "function") return;
        const live = Array.from(box.querySelectorAll(":scope > .float-text, :scope > .vfx-burst") || []);
        if (live.length > 0) savedVfx[sl] = live;
      });

      const eAct = $("enemyActiveSlot");
      eAct.className = "slot-box active-slot" + (pendingEnemy ? " highlight-enemy" : "");
      eAct.innerHTML = `<span class="slot-tag">相手バトル場<span class="zh-inline" lang="zh-CN">（对手战斗区）</span></span>` +
        (s.enemy.active ? this.renderMonsterCard(s.enemy.active, "enemy_active") : `<div class="slot-empty">${s.phase === "setup" ? '裏向き待機中<span class="zh-inline" lang="zh-CN">（对手暗置首发中）</span>' : '空き<span class="zh-inline" lang="zh-CN">（空位）</span>'}</div>`);

      const pAct = $("playerActiveSlot");
      pAct.className = "slot-box active-slot" + (needAllyTarget || s.phase === "setup" ? " highlight-ally" : "");
      pAct.innerHTML = `<span class="slot-tag">バトル場<span class="zh-inline" lang="zh-CN">（己方战斗区）</span></span>` +
        (s.player.active ? this.renderMonsterCard(s.player.active, "player_active") : `<div class="slot-empty">${s.phase === "setup" ? '手札から1体選択<span class="zh-inline" lang="zh-CN">（请从手牌选择首发）</span>' : '空き<span class="zh-inline" lang="zh-CN">（空位）</span>'}</div>`);

      $("enemyBenchRow").innerHTML = s.enemy.bench.map((inst, i) => `
        <div class="slot-box ${(needEnemyBench || pendingEnemy) && inst ? "highlight-enemy" : ""}" data-slot-box="enemy_bench_${i}">
          <span class="slot-tag">相手ベンチ ${POS_JA[i]}<span class="zh-inline" lang="zh-CN">（对手备战 ${POS_ZH[i]}）</span></span>
          ${inst ? this.renderMonsterCard(inst, `enemy_bench_${i}`) : '<div class="slot-empty">空き<span class="zh-inline" lang="zh-CN">（空位）</span></div>'}
        </div>
      `).join("");

      const hasHandMon = s.player.hand.some((id) => Boolean(SpecEngine.getMonster(id)));
      const hasEmptyBench = s.player.bench.includes(null);
      const canHintBench = s.phase === "battle" && s.currentPlayer === "player" && !s.gameOver && hasHandMon && hasEmptyBench;

      $("playerBenchRow").innerHTML = s.player.bench.map((inst, i) => `
        <div class="slot-box ${(needAllyTarget || pendingAlly) && inst ? "highlight-ally" : ""}" data-slot-box="player_bench_${i}">
          <span class="slot-tag">ベンチ ${POS_JA[i]}<span class="zh-inline" lang="zh-CN">（己方备战 ${POS_ZH[i]}）</span></span>
          ${inst ? this.renderMonsterCard(inst, `player_bench_${i}`) : (canHintBench && i === s.player.bench.indexOf(null) ? '<div class="slot-empty">手札のモンスターを出せます<span class="zh-inline" lang="zh-CN">（可放入手牌怪兽）</span></div>' : '<div class="slot-empty">空き<span class="zh-inline" lang="zh-CN">（空位）</span></div>')}
        </div>
      `).join("");

      Object.keys(savedVfx).forEach((sl) => {
        const box = this.getSlotEl(sl);
        if (box) savedVfx[sl].forEach((node) => box.appendChild(node));
      });

      $("playerHand").innerHTML = s.player.hand.map((id, idx) => this.renderHandCard(id, idx)).join("");
      $("handSelectionHint").innerHTML = s.phase === "setup"
        ? '先発モンスターをクリック<span class="zh-inline" lang="zh-CN">（点击绿色高亮怪兽作为首发）</span>'
        : (selCardId
          ? '対象をクリック<span class="zh-inline" lang="zh-CN">（点击高亮目标使用，再点手牌取消）</span>'
          : (canHintBench
            ? '手札のモンスターをクリック／発話でベンチへ展開可<span class="zh-inline" lang="zh-CN">（手牌有怪兽卡可直接点击或语音放入备战区）</span>'
            : ""));

      const bar = $("pendingBar");
      if (s.pending) {
        bar.classList.add("open");
        $("pendingJa").textContent = s.pending.promptJa || "";
        $("pendingZh").textContent = s.pending.promptZh || "";
        $("pendingBtns").innerHTML = (s.pending.options || []).map((o) =>
          `<button class="btn-sm" data-reply="${escapeHtml(o.reply)}">${formatBilingualLabelHtml(o.label)}</button>`
        ).join("");
        $("pendingBtns").querySelectorAll("button").forEach((b) => {
          b.addEventListener("click", async () => {
            if (s.busy || s.gameOver) return;
            const seq = BattleEngine.matchSeq;
            s.busy = true;
            try {
              await BattleEngine.handlePendingReply(b.getAttribute("data-reply"));
            } finally {
              if (seq === BattleEngine.matchSeq && BattleEngine.state === s) {
                s.busy = false;
                TableUI.renderAll();
                BattleEngine.resetIdleTimer(true);
              }
            }
          });
        });
      } else {
        bar.classList.remove("open");
      }

      this.renderLiveTip();
      this.bindBoardClicks();
    },

    closePopover() {
      $("actionPopover").classList.remove("open");
    },

    openEndTurnConfirmModal(opps = [], fromVoice = false) {
      const modal = $("endTurnConfirmModal");
      if (!modal) return;
      const subJa = $("endTurnConfirmSubJa");
      const subZh = $("endTurnConfirmSubZh");
      const listEl = $("endTurnHintsList");
      const items = Array.isArray(opps) ? opps : [];
      if (subJa) {
        subJa.textContent = fromVoice
          ? (items.length
            ? "音声で「ターン終了」を検出しましたが、まだ行える操作が残っています。"
            : "音声で「ターン終了」を検出しました。誤作動防止のためご確認ください。")
          : "このターン、まだ実行できる操作が残っています。";
      }
      if (subZh) {
        subZh.textContent = fromVoice
          ? (items.length
            ? "检测到语音「结束回合」，但本回合仍有可用操作（可直接说「确认」或「取消」）："
            : "检测到语音「结束回合」，为防误触发请确认（可直接说「确认」或「取消」）。")
          : "本回合仍有以下可用操作尚未执行：";
      }
      if (listEl) {
        listEl.innerHTML = items.map((o) =>
          `<li><div class="endturn-hint-ja">${escapeHtml(o.ja)}</div><div class="endturn-hint-zh" lang="zh-CN">${escapeHtml(o.zh)}</div></li>`
        ).join("");
      }
      modal.classList.add("open");
    },

    closeEndTurnConfirmModal() {
      $("endTurnConfirmModal")?.classList.remove("open");
    },

    /** 触发指定技能点击（支持 enemy_any 狙击技能在对手有备战怪兽时点选任意目标） */
    triggerSkillClick(skName) {
      const s = BattleEngine.state;
      const unit = s.player.active;
      if (!unit) return;
      const def = SpecEngine.getMonster(unit.id);
      const sk = def ? def.skills.find((x) => x.name_ja === skName) : null;
      if (!sk) return;
      const eBench = BattleEngine.getBenchEntries("enemy");
      if (sk.target === "enemy_any" && eBench.length > 0) {
        const targets = BattleEngine.getAllEntries("enemy");
        const ja = `『${sk.name_ja}』は相手バトル場・ベンチのどこでも狙撃できます。対象を選んでください。`;
        const zh = `「${sk.name_zh}」可狙击对手任意怪兽，请点击或选择攻击目标！`;
        BattleEngine.setPending({
          type: "choose_target", promptJa: ja, promptZh: zh,
          context: { side: "enemy", action: { type: "ATTACK", skill_name: sk.name_ja, target: null } },
          options: targets.map((e) => ({
            label: `${e.slot === "enemy_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja}（${e.def.name_zh} HP${e.unit.hp}）`,
            reply: e.slot === "enemy_active" ? "前" : POS_JA[e.idx]
          }))
        });
        TableUI.setReferee(ja, zh);
        return;
      }
      BattleEngine.performDirectAction({ type: "ATTACK", skill_name: sk.name_ja, target: "enemy_active" });
    },

    /** 处理槽位或槽位内卡牌的统一点击逻辑 */
    handleSlotClick(slot, ev) {
      const s = BattleEngine.state;
      if (s.busy || s.currentPlayer !== "player" || s.gameOver) return;
      if (s.phase === "setup") {
        TableUI.setReferee(
          "手札の緑枠モンスターをクリックして、バトル場の最初の1体を選んでください。",
          "请点击下方手牌中绿色高亮的怪兽作为战斗区首发！"
        );
        GuideEngine.trigger("setup_starter", true);
        return;
      }
      GuideEngine.hide();
      BattleEngine.resetIdleTimer(true);

      if (s.selectedHandIndex !== null) {
        const cardId = s.player.hand[s.selectedHandIndex];
        s.selectedHandIndex = null;
        if (cardId.startsWith("energy_") && slot.startsWith("player_") && BattleEngine.getSlotUnit(slot)) {
          BattleEngine.performDirectAction({ type: "ATTACH_ENERGY", card_id: cardId, target: slot });
          return;
        }
        if (cardId === "item_potion" && slot.startsWith("player_") && BattleEngine.getSlotUnit(slot)) {
          BattleEngine.performDirectAction({ type: "USE_ITEM", card_id: "item_potion", target: slot });
          return;
        }
        if (cardId === "item_flute" && slot.startsWith("enemy_bench_") && BattleEngine.getSlotUnit(slot)) {
          BattleEngine.performDirectAction({ type: "USE_ITEM", card_id: "item_flute", target: slot });
          return;
        }
        this.renderAll();
        return;
      }

      if (s.pending && s.pending.type === "promote_bench") {
        const m = /^player_bench_([0-2])$/.exec(slot || "");
        if (m && s.player.bench[Number(m[1])]) {
          const seq = BattleEngine.matchSeq;
          s.busy = true;
          BattleEngine.handlePendingReply(POS_JA[Number(m[1])]).finally(() => {
            if (seq === BattleEngine.matchSeq && BattleEngine.state === s) { s.busy = false; TableUI.renderAll(); }
          });
        }
        return;
      }
      if (s.pending && s.pending.type === "choose_target") {
        const reqSide = s.pending.context?.side;
        const actType = s.pending.context?.action?.type;
        const actCard = s.pending.context?.action?.card_id;
        if (reqSide && !String(slot || "").startsWith(`${reqSide}_`)) return;
        if ((actCard === "item_flute" || actType === "RETREAT") && !String(slot || "").includes("_bench_")) return;
        const u = BattleEngine.getSlotUnit(slot);
        if (u) {
          const mBench = /_bench_([0-2])$/.exec(slot || "");
          const slotReply = mBench ? POS_JA[Number(mBench[1])] : "前";
          const seq = BattleEngine.matchSeq;
          s.busy = true;
          BattleEngine.handlePendingReply(slotReply).finally(() => {
            if (seq === BattleEngine.matchSeq && BattleEngine.state === s) { s.busy = false; TableUI.renderAll(); }
          });
        }
        return;
      }

      if (slot === "player_active" && s.player.active) {
        const unit = s.player.active;
        const def = SpecEngine.getMonster(unit.id);
        const pop = $("actionPopover");
        pop.innerHTML = `<div style="font-size:12px;font-weight:800;margin-bottom:4px;">${escapeHtml(def.name_ja)}<span class="zh-inline" lang="zh-CN">（${escapeHtml(def.name_zh)}）</span></div>`;
        def.skills.forEach((sk) => {
          const b = document.createElement("button");
          b.className = "btn-sm";
          b.disabled = !BattleEngine.canPayCost(unit.energies, sk.cost);
          b.innerHTML = `${escapeHtml(sk.name_ja)}<span class="zh-inline" lang="zh-CN">（${escapeHtml(sk.name_zh)}）</span> ${sk.damage}`;
          b.addEventListener("click", () => {
            this.closePopover();
            this.triggerSkillClick(sk.name_ja);
          });
          pop.appendChild(b);
        });
        const rBtn = document.createElement("button");
        rBtn.className = "btn-sm";
        rBtn.innerHTML = `${SVG_ICONS.swap}交代<span class="zh-inline" lang="zh-CN">（弃1能撤退）</span>`;
        rBtn.addEventListener("click", () => {
          this.closePopover();
          BattleEngine.performDirectAction({ type: "RETREAT", target: null });
        });
        pop.appendChild(rBtn);

        pop.style.left = `${Math.max(8, Math.min((ev?.clientX || 120) + 10, window.innerWidth - 224))}px`;
        pop.style.top = `${Math.max(8, Math.min((ev?.clientY || 120) + 10, window.innerHeight - 196))}px`;
        pop.classList.add("open");
      }
    },

    bindBoardClicks() {
      const s = BattleEngine.state;

      /* 手牌点击与拖拽手动排序（带实时插入位置占位槽预览，松手防误触点击） */
      const handContainer = $("playerHand");
      const handEls = Array.from(handContainer.querySelectorAll(".hand-card"));
      const cleanupHandDrag = () => {
        this._dragHandIdx = null;
        this._dragTargetIdx = null;
        if (this._handPlaceholder && this._handPlaceholder.parentNode) {
          this._handPlaceholder.parentNode.removeChild(this._handPlaceholder);
        }
        this._handPlaceholder = null;
        handContainer.querySelectorAll(".hand-card.dragging-source").forEach((node) => {
          node.classList.remove("dragging-source");
        });
      };
      const updatePlaceholderAt = (clientX) => {
        if (this._dragHandIdx === null || !this._handPlaceholder) return;
        const others = Array.from(handContainer.querySelectorAll(".hand-card:not(.dragging-source)"));
        let targetIdx = others.length;
        let beforeEl = null;
        for (let i = 0; i < others.length; i++) {
          const rect = others[i].getBoundingClientRect();
          if (clientX < rect.left + rect.width / 2) {
            targetIdx = i;
            beforeEl = others[i];
            break;
          }
        }
        this._dragTargetIdx = targetIdx;
        if (beforeEl) {
          if (this._handPlaceholder.nextSibling !== beforeEl) {
            handContainer.insertBefore(this._handPlaceholder, beforeEl);
          }
        } else if (this._handPlaceholder.nextSibling !== null) {
          handContainer.appendChild(this._handPlaceholder);
        }
      };

      handContainer.ondragover = (e) => {
        if (this._dragHandIdx === null) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        updatePlaceholderAt(e.clientX);
      };
      handContainer.ondrop = (e) => {
        if (this._dragHandIdx === null) return;
        e.preventDefault();
        const fromIdx = this._dragHandIdx;
        const toIdx = this._dragTargetIdx;
        cleanupHandDrag();
        this._lastHandDragAt = Date.now();
        if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
          if (BattleEngine.reorderPlayerHand(fromIdx, toIdx)) {
            TableUI.renderAll();
          }
        }
      };

      handEls.forEach((el) => {
        const idx = Number(el.getAttribute("data-hand-idx"));
        el.addEventListener("dragstart", (e) => {
          if (s.busy || s.gameOver) { e.preventDefault(); return; }
          cleanupHandDrag();
          this._dragHandIdx = idx;
          this._dragTargetIdx = idx;
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(idx));
          }
          const ph = document.createElement("div");
          ph.className = "hand-drop-placeholder";
          ph.setAttribute("aria-hidden", "true");
          ph.innerHTML = '<span class="drop-slot-ja">ここに移動</span><span class="drop-slot-zh">移至此处</span>';
          this._handPlaceholder = ph;
          requestAnimationFrame(() => {
            if (this._dragHandIdx !== idx || !this._handPlaceholder) return;
            if (el.parentNode === handContainer) {
              handContainer.insertBefore(this._handPlaceholder, el);
              el.classList.add("dragging-source");
            }
          });
        });
        el.addEventListener("dragend", () => {
          cleanupHandDrag();
          this._lastHandDragAt = Date.now();
        });
        el.addEventListener("click", () => {
          if (Date.now() - (this._lastHandDragAt || 0) < 220) return;
          if (s.busy || s.currentPlayer !== "player" || s.gameOver) return;
          const cardId = s.player.hand[idx];
          if (s.phase === "setup") {
            if (SpecEngine.getMonster(cardId)) {
              BattleEngine.selectStartingMonster(idx);
            } else {
              TableUI.setReferee(
                "まずは手札の緑枠モンスターを1体選んでバトル場に出してください。",
                "请先点击绿色高亮的手牌怪兽，作为战斗区首发上场！"
              );
              GuideEngine.trigger("setup_starter", true);
            }
            return;
          }
          if (s.pending && s.pending.type === "promote_bench") {
            TableUI.setReferee(s.pending.promptJa, s.pending.promptZh);
            return;
          }
          GuideEngine.hide();
          BattleEngine.resetIdleTimer(true);
          this.closePopover();
          if (SpecEngine.getMonster(cardId)) {
            s.selectedHandIndex = null;
            BattleEngine.performDirectAction({ type: "PLAY_BENCH", card_id: cardId });
            return;
          }
          const itDef = SpecEngine.getItem(cardId);
          if (itDef && itDef.category === "supporter" && s.supporterUsedThisTurn) {
            s.selectedHandIndex = null;
            BattleEngine.performDirectAction({ type: "USE_ITEM", card_id: cardId });
            return;
          }
          if (cardId.startsWith("energy_") && s.energyUsedThisTurn) {
            s.selectedHandIndex = null;
            BattleEngine.performDirectAction({ type: "ATTACH_ENERGY", card_id: cardId, target: "player_active" });
            return;
          }
          if (cardId === "item_bag" || cardId === "item_power" || cardId === "item_recycle") {
            s.selectedHandIndex = null;
            BattleEngine.performDirectAction({ type: "USE_ITEM", card_id: cardId });
            return;
          }
          if (cardId === "item_potion") {
            const wounded = BattleEngine.getAllEntries("player").filter((e) => e.unit.hp < e.def.hp);
            if (wounded.length <= 1) {
              s.selectedHandIndex = null;
              BattleEngine.performDirectAction({ type: "USE_ITEM", card_id: "item_potion", target: wounded[0] ? wounded[0].slot : null });
              return;
            }
          }
          if (cardId === "item_flute") {
            const eBench = BattleEngine.getBenchEntries("enemy");
            if (eBench.length <= 1) {
              s.selectedHandIndex = null;
              BattleEngine.performDirectAction({ type: "USE_ITEM", card_id: "item_flute", target: eBench[0] ? eBench[0].slot : null });
              return;
            }
          }
          s.selectedHandIndex = s.selectedHandIndex === idx ? null : idx;
          this.renderAll();
        });
      });

      /* 战斗区已激活技能行：点击直接发动对应技能（支持狙击选目标） */
      document.querySelectorAll("#playerActiveSlot .skill-line.ready").forEach((el) => {
        el.addEventListener("click", (ev) => {
          if (s.selectedHandIndex !== null || s.pending) return;
          ev.stopPropagation();
          if (s.busy || s.currentPlayer !== "player" || s.gameOver) return;
          this.closePopover();
          const skName = el.getAttribute("data-skill-ja");
          if (skName) this.triggerSkillClick(skName);
        });
      });

      /* 场上卡牌与高亮槽位统一点击绑定（点槽位边缘或点卡牌内部均生效） */
      const slotMap = [
        { el: $("playerActiveSlot"), slot: "player_active" },
        { el: $("enemyActiveSlot"), slot: "enemy_active" }
      ];
      document.querySelectorAll(".playmat .slot-box[data-slot-box]").forEach((box) => {
        slotMap.push({ el: box, slot: box.getAttribute("data-slot-box") });
      });
      slotMap.forEach(({ el, slot }) => {
        if (!el || !slot) return;
        el.onclick = (ev) => {
          ev.stopPropagation();
          this.handleSlotClick(slot, ev);
        };
      });
    }
  };

  /* =========================================================================
     7. 初始化、设置表单同步与全局事件绑定
     ========================================================================= */
  function syncDifficultyUi() {
    const isHard = ConfigManager.data.aiDifficulty === "hard";
    $("diffOptNormal")?.classList.toggle("active", !isHard);
    $("diffOptHard")?.classList.toggle("active", isHard);
    if ($("aiDifficulty")) $("aiDifficulty").value = isHard ? "hard" : "normal";
  }

  function syncSettingsForm() {
    const c = ConfigManager.data;
    $("apiKey").value = c.apiKey;
    $("ttsEngine").value = c.ttsEngine;
    $("llmModel").value = c.llmModel;
    $("ttsModel").value = c.ttsModel;
    $("asrMode").value = c.asrMode;
    $("asrLang").value = c.asrLang || "ja-JP";
    $("voiceReferee").value = c.voiceReferee;
    $("voiceRival").value = c.voiceRival;
    $("chromeVoiceSelect").value = c.chromeVoiceURI;
    $("idlePromptSec").value = c.idlePromptSec;
    $("chkAutoSpeak").checked = Boolean(c.autoSpeak);
    $("mdStatusText").textContent = `読込元：${SpecEngine.sourceLabel}`;
    syncDifficultyUi();
  }

  function applySpecToUi() {
    $("rulesModalListJa").innerHTML = SpecEngine.rulesHtmlJa.map((li) => `<li>${li}</li>`).join("");
    $("rulesModalListZh").innerHTML = SpecEngine.rulesHtmlZh.map((li) => `<li>${li}</li>`).join("");
    $("mdStatusText").textContent = `読込元：${SpecEngine.sourceLabel}`;
    if (!BattleEngine.state) BattleEngine.reset();
    else TableUI.renderAll();
  }

  function importMdFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      if (!SpecEngine.parse(text, file.name)) {
        TableUI.showToast("データ形式が不正です（必須項目不足・読み込み中止）", "数据格式不完整（缺少怪兽或三色能量），已中止导入");
        return;
      }
      try { localStorage.setItem(STORAGE_KEY_DATA, text); } catch (e) {}
      $("dataLoadModal")?.classList.remove("open");
      applySpecToUi();
      TableUI.showToast(`${file.name} を読み込みました`, `已导入数据文件 ${file.name}`);
    };
    reader.readAsText(file, "utf-8");
  }

  function bindGlobalEvents() {
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#actionPopover")) TableUI.closePopover();
    });

    $("btnToggleLog")?.addEventListener("click", () => DebugLog.toggle());
    $("btnCloseLogDrawer")?.addEventListener("click", () => DebugLog.toggle(false));
    $("btnCopyLog")?.addEventListener("click", () => DebugLog.copy());
    $("btnExportLog")?.addEventListener("click", () => DebugLog.exportJson());
    $("btnClearLog")?.addEventListener("click", () => DebugLog.clear());
    $("dlogFilters")?.querySelectorAll(".dlog-chip").forEach((b) => {
      b.addEventListener("click", () => DebugLog.setFilter(b.getAttribute("data-cat")));
    });
    $("btnGuideMode").addEventListener("click", () => GuideEngine.toggle());
    $("btnCloseGuide").addEventListener("click", () => GuideEngine.hide());
    const closeResetConfirm = () => $("resetConfirmModal")?.classList.remove("open");
    $("btnResetMatch").addEventListener("click", () => {
      if ($("resetConfirmModal")) {
        $("resetConfirmModal").classList.add("open");
      } else {
        BattleEngine.reset(true);
      }
    });
    $("btnCancelReset")?.addEventListener("click", closeResetConfirm);
    $("btnConfirmReset")?.addEventListener("click", () => {
      closeResetConfirm();
      BattleEngine.reset(true);
    });
    $("resetConfirmModal")?.addEventListener("click", (e) => {
      if (e.target === $("resetConfirmModal")) closeResetConfirm();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("resetConfirmModal")?.classList.contains("open")) {
        closeResetConfirm();
      }
    });
    $("btnPlayAgain").addEventListener("click", () => BattleEngine.reset(true));
    $("playerTrashBox")?.addEventListener("click", () => TableUI.openPileModal("player_trash"));
    $("enemyTrashBox")?.addEventListener("click", () => TableUI.openPileModal("enemy_trash"));
    $("playerDeckBox")?.addEventListener("click", () => TableUI.openPileModal("player_deck"));
    $("enemyDeckBox")?.addEventListener("click", () => TableUI.openPileModal("enemy_deck"));
    $("btnClosePileTop")?.addEventListener("click", () => $("pileModal")?.classList.remove("open"));
    $("pileModal")?.addEventListener("click", (e) => {
      if (e.target === $("pileModal")) $("pileModal").classList.remove("open");
    });
    $("btnOpenCodex")?.addEventListener("click", () => {
      TableUI.renderCodex();
      $("codexModal")?.classList.add("open");
    });
    $("btnCloseCodexTop")?.addEventListener("click", () => $("codexModal")?.classList.remove("open"));
    $("codexModal")?.addEventListener("click", (e) => {
      if (e.target === $("codexModal")) $("codexModal").classList.remove("open");
    });
    $("codexFilters")?.querySelectorAll(".dlog-chip").forEach((b) => {
      b.addEventListener("click", () => TableUI.renderCodex(b.getAttribute("data-codex")));
    });
    $("btnOpenRules").addEventListener("click", () => $("rulesModal").classList.add("open"));
    const closeRulesAndGuide = async () => {
      $("rulesModal").classList.remove("open");
      if (!VoiceEngine.callActive) {
        VoiceEngine.callCallback = (payload) => BattleEngine.handleUserInput(payload);
        await VoiceEngine.startContinuousAsrCall(true);
        if (!VoiceEngine.callActive) {
          TableUI.showToast("マイク未許可・クリック／文字入力で遊べます", "未开启麦克风，可直接点击卡牌或输入文字游玩");
        }
      }
      if (BattleEngine.state?.phase === "setup") {
        GuideEngine.trigger("setup_starter", true);
      }
    };
    const setDifficulty = (diff, showToast = false) => {
      const next = diff === "hard" ? "hard" : "normal";
      ConfigManager.save({ aiDifficulty: next });
      syncDifficultyUi();
      if (showToast) {
        TableUI.showToast(
          next === "hard" ? "難易度：むずかしい" : "難易度：ふつう",
          next === "hard" ? "已切换为困难难度" : "已切换为普通难度"
        );
      }
    };
    $("diffOptNormal")?.addEventListener("click", () => setDifficulty("normal", false));
    $("diffOptHard")?.addEventListener("click", () => setDifficulty("hard", false));
    $("btnCloseRulesTop").addEventListener("click", closeRulesAndGuide);
    $("btnStartGame").addEventListener("click", closeRulesAndGuide);

    $("btnOpenSettings").addEventListener("click", () => {
      VoiceEngine.populateChromeVoices();
      syncSettingsForm();
      $("settingsModal").classList.add("open");
    });
    $("btnCloseSettings").addEventListener("click", () => $("settingsModal").classList.remove("open"));

    $("btnSaveConfig").addEventListener("click", () => {
      VoiceEngine.apiTtsBlocked = false;
      VoiceEngine.apiTtsBlockReason = "";
      VoiceEngine.apiAsrBlocked = false;
      VoiceEngine.apiAsrBlockReason = "";
      ConfigManager.save({
        apiKey: $("apiKey").value.trim(),
        ttsEngine: $("ttsEngine").value,
        llmModel: $("llmModel").value.trim(),
        ttsModel: $("ttsModel").value.trim(),
        asrMode: $("asrMode").value,
        asrLang: $("asrLang").value,
        voiceReferee: $("voiceReferee").value,
        voiceRival: $("voiceRival").value,
        chromeVoiceURI: $("chromeVoiceSelect").value,
        idlePromptSec: Math.max(0, Math.min(120, Number($("idlePromptSec").value) || 0)),
        aiDifficulty: $("aiDifficulty") ? $("aiDifficulty").value : "normal",
        autoSpeak: $("chkAutoSpeak").checked
      });
      syncDifficultyUi();
      TableUI.renderLiveTip();
      TableUI.showToast("設定を保存しました", "配置已保存");
      BattleEngine.resetIdleTimer(true);
    });

    $("btnResetDefaults").addEventListener("click", async () => {
      VoiceEngine.apiTtsBlocked = false;
      VoiceEngine.apiTtsBlockReason = "";
      VoiceEngine.apiAsrBlocked = false;
      VoiceEngine.apiAsrBlockReason = "";
      VoiceEngine.clearApiAsrReconnectTimer();
      ConfigManager.reset();
      const ok = await SpecEngine.loadThreeTier();
      if (ok) {
        applySpecToUi();
        syncSettingsForm();
        TableUI.showToast("初期設定・標準カードデータに戻しました", "已恢复默认配置与标准卡表");
      } else {
        $("settingsModal")?.classList.remove("open");
        $("dataLoadModal")?.classList.add("open");
      }
    });

    let testingTts = false;
    $("btnTestTts").addEventListener("click", async () => {
      if (testingTts) return;
      testingTts = true;
      const btn = $("btnTestTts");
      btn.disabled = true;
      try {
        VoiceEngine.apiTtsBlocked = false;
        VoiceEngine.apiTtsBlockReason = "";
        VoiceEngine.stopPlayback();
        await VoiceEngine.speak("ヒノキツネの『ひのこ』！相手に30ダメージ！", "referee");
        await delay(240);
        await VoiceEngine.speak("なかなかやるじゃねえか。次は俺の番だぜ！", "rival");
      } finally {
        testingTts = false;
        btn.disabled = false;
      }
    });

    $("btnLiveCall").addEventListener("click", () => {
      VoiceEngine.toggleCall((payload) => BattleEngine.handleUserInput(payload));
    });

    $("btnRecordVoice").addEventListener("click", () => {
      VoiceEngine.toggleRecord((payload) => BattleEngine.handleUserInput(payload));
    });

    const submitText = () => {
      const val = $("cmdInput").value.trim();
      if (!val) return;
      $("cmdInput").value = "";
      BattleEngine.handleUserInput({ text: val });
    };
    $("btnSendCmd").addEventListener("click", submitText);
    $("cmdInput").addEventListener("keydown", (e) => { if (e.key === "Enter") submitText(); });

    $("btnAiTip").addEventListener("click", () => TableUI.requestAiTip());
    $("btnDefend").addEventListener("click", () => BattleEngine.performDirectAction({ type: "DEFEND", target: "player_active" }));
    const cancelEndTurnConfirm = () => {
      TableUI.closeEndTurnConfirmModal();
      if (BattleEngine.state?.pending?.type === "confirm_end_turn") {
        BattleEngine.clearPending();
      }
    };
    $("btnEndTurn").addEventListener("click", () => {
      const s = BattleEngine.state;
      if (!s || s.busy || s.gameOver || s.phase !== "battle" || s.currentPlayer !== "player" || s.pending?.type === "promote_bench") {
        BattleEngine.performDirectAction({ type: "END_TURN" });
        return;
      }
      const opps = BattleEngine.getEndTurnOpportunities();
      if (opps.length > 0 && $("endTurnConfirmModal")) {
        TableUI.openEndTurnConfirmModal(opps, false);
      } else {
        BattleEngine.performDirectAction({ type: "END_TURN" });
      }
    });
    $("btnCancelEndTurn")?.addEventListener("click", cancelEndTurnConfirm);
    $("btnConfirmEndTurn")?.addEventListener("click", () => {
      cancelEndTurnConfirm();
      BattleEngine.performDirectAction({ type: "END_TURN" });
    });
    $("endTurnConfirmModal")?.addEventListener("click", (e) => {
      if (e.target === $("endTurnConfirmModal")) cancelEndTurnConfirm();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("endTurnConfirmModal")?.classList.contains("open")) {
        cancelEndTurnConfirm();
      }
    });

    $("mdFileInput").addEventListener("change", (e) => importMdFile(e.target.files[0]));
    const dz = $("mdDropzone");
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      importMdFile(e.dataTransfer.files[0]);
    });

    $("dataLoadFileInput")?.addEventListener("change", (e) => importMdFile(e.target.files[0]));
    const dlz = $("dataLoadDropzone");
    if (dlz) {
      dlz.addEventListener("dragover", (e) => { e.preventDefault(); dlz.classList.add("dragover"); });
      dlz.addEventListener("dragleave", () => dlz.classList.remove("dragover"));
      dlz.addEventListener("drop", (e) => {
        e.preventDefault();
        dlz.classList.remove("dragover");
        importMdFile(e.dataTransfer.files[0]);
      });
    }
  }

  /* ---------- 手机端识别与顶栏横屏全屏按钮状态同步 ---------- */
  const MobileViewportManager = {
    isMobile() {
      const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";
      const sw = window.screen?.width || 0;
      const sh = window.screen?.height || 0;
      const shortEdge = Math.min(sw || 9999, sh || 9999);
      const uaMobile =
        /iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|HarmonyOS|OpenHarmony/i.test(ua) ||
        (/Android/i.test(ua) && shortEdge <= 600);
      // 手机浏览器切换为“PC模式 / 桌面版网站”时 UA 会伪装为桌面，但物理屏幕短边与触控特征仍在，保留全屏按钮
      const hasTouch =
        Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
        (typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0);
      const smallTouchScreen = hasTouch && shortEdge <= 600;
      return uaMobile || smallTouchScreen;
    },

    isFullscreen() {
      return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    },

    syncUi() {
      const mobile = this.isMobile();
      document.body?.classList.toggle("is-mobile", mobile);
      const btn = $("btnFullscreen");
      if (!btn) return;
      const fs = this.isFullscreen();
      const nextState = fs ? "1" : "0";
      if (btn.dataset.fsState === nextState) return;
      btn.dataset.fsState = nextState;
      const enterSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
      const exitSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
      btn.innerHTML = fs
        ? `${exitSvg}解除<span class="zh-inline" lang="zh-CN">（退出全屏）</span>`
        : `${enterSvg}全画面<span class="zh-inline" lang="zh-CN">（全屏）</span>`;
    },

    async enterLandscapeFullscreen() {
      const root = document.documentElement;
      let fsOk = false;
      try {
        if (root?.requestFullscreen) {
          await root.requestFullscreen();
          fsOk = true;
        } else if (root?.webkitRequestFullscreen) {
          await Promise.resolve(root.webkitRequestFullscreen());
          fsOk = true;
        }
      } catch (_) {}

      try {
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock("landscape");
        }
      } catch (_) {}

      this.syncUi();
      if (fsOk) {
        TableUI.showToast("横画面・全画面モードにしました", "已尝试进入横屏全屏模式");
      } else {
        TableUI.showToast("端末を横向きに回転してください", "请横向旋转手机即可获得与 PC 一致的清晰牌桌体验");
      }
    },

    async toggleFullscreen() {
      if (this.isFullscreen()) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await Promise.resolve(document.webkitExitFullscreen());
        } catch (_) {}
        try {
          if (window.screen?.orientation?.unlock) window.screen.orientation.unlock();
        } catch (_) {}
        this.syncUi();
      } else {
        await this.enterLandscapeFullscreen();
      }
    },

    init() {
      this.syncUi();
      $("btnFullscreen")?.addEventListener("click", () => this.toggleFullscreen());
      document.addEventListener("fullscreenchange", () => this.syncUi());
      document.addEventListener("webkitfullscreenchange", () => this.syncUi());
      window.addEventListener("resize", () => this.syncUi());
      window.addEventListener("orientationchange", () => this.syncUi());
    }
  };

  /** 应用入口：加载配置 → 注册浏览器语音 → 绑定事件 → 加载 gamedata.json */
  async function init() {
    ConfigManager.load();
    GuideEngine.syncButton();
    if (window.speechSynthesis) {
      VoiceEngine.populateChromeVoices();
      speechSynthesis.onvoiceschanged = () => VoiceEngine.populateChromeVoices();
    }
    bindGlobalEvents();
    MobileViewportManager.init();
    const loaded = await SpecEngine.loadThreeTier();
    if (loaded) {
      applySpecToUi();
    } else {
      $("rulesModal")?.classList.remove("open");
      $("dataLoadModal")?.classList.add("open");
    }
  }

  init();
})();
