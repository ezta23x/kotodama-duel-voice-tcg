/**
 * ============================================================================
 * 言霊デュエル（言灵对决）— 主程序逻辑
 * 模块结构：
 *   1. ConfigManager  ：Gemini LLM 与SenseTime Nia ASR/TTS 配置持久化及 HS256 JWT 签发
 *   2. SpecEngine     ：三级 MD/JSON 规则与卡牌数据热加载 + 卡牌/技能模糊匹配引擎
 *   3. VoiceEngine    ：全双工持续通话 + SenseTime Nia 流式 ASR/TTS + Vertex / 浏览器语音降级
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
    sword: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.92 5H5l9 9 1-.94m4.96 6.06l-.84.84a.996.996 0 0 1-1.41 0l-3.12-3.12-2.68 2.66-1.41-1.41 1.42-1.42L3 7.75V3h4.75l8.92 8.92 1.42-1.42 1.41 1.41-2.67 2.67 3.12 3.12c.4.4.4 1.03.01 1.42z"/></svg>',
    warn: '<svg class="chip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z"/></svg>',
    recycle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>',
    healPlus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 10h-5V5h-4v5H5v4h5v5h4v-5h5z"/></svg>',
    drawCard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 3H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 14H9V6h9v11zM4 7H2v13c0 1.1.9 2 2 2h12v-2H4V7z"/></svg>',
    splash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.2 5.4L20 6l-3.6 4.8L22 14l-5.8.6L18 20l-5.2-2.6L10 22l-.6-5.8L4 17l3.2-4.8L2 9l5.8-.6L6 3l5.2 2.8z"/></svg>',
    prizeStar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.7 5.9 6.5.7-4.8 4.4 1.3 6.4L12 16.7 6.3 19.9l1.3-6.4-4.8-4.4 6.5-.7z"/></svg>',
    prizeCheck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    hudWave: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="voice-hud-wave-bar" x="2" y="9" width="2.6" height="6" rx="1.3" fill="currentColor"/><rect class="voice-hud-wave-bar" x="6.5" y="5" width="2.6" height="14" rx="1.3" fill="currentColor"/><rect class="voice-hud-wave-bar" x="11" y="3" width="2.6" height="18" rx="1.3" fill="currentColor"/><rect class="voice-hud-wave-bar" x="15.5" y="6" width="2.6" height="12" rx="1.3" fill="currentColor"/><rect class="voice-hud-wave-bar" x="20" y="9" width="2.6" height="6" rx="1.3" fill="currentColor"/></svg>',
    hudSpinner: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="36 22"/></svg>',
    check: '<svg class="btn-icon" style="color:#7ee09b;" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
  };
  const ELEM_COLOR = { fire: "var(--fire)", water: "var(--water)", thunder: "var(--thunder)" };
  const WEAKNESS_MAP = { fire: "water", water: "thunder", thunder: "fire" };
  const WEAKNESS_BONUS = 20;
  const TOTAL_PRIZES = 3;

  function getUiLang() {
    return (typeof ConfigManager !== "undefined" && ConfigManager.data && ConfigManager.data.uiLang === "zh") ? "zh" : "ja";
  }

  /** 全局单语言文案选择函数（默认日语 ja，切换中文 zh 时纯净显示中文） */
  function t(jaText, zhText) {
    return getUiLang() === "zh" ? String(zhText == null ? (jaText || "") : zhText) : String(jaText == null ? (zhText || "") : jaText);
  }

  function tPos(idx) {
    return getUiLang() === "zh" ? (POS_ZH[idx] || "") : (POS_JA[idx] || "");
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** 将「日文（中文）」双语标签按当前界面语言纯净提取单语言文本 */
  function formatBilingualLabelHtml(str) {
    const raw = String(str == null ? "" : str);
    const m = raw.match(/^([\s\S]*?)（([^）]+)）([\s\S]*)$/);
    if (!m) return escapeHtml(raw);
    const inner = m[2];
    if (/[\u3040-\u30ff]/.test(inner)) return escapeHtml(raw);
    return getUiLang() === "zh" ? escapeHtml(inner) : escapeHtml(`${m[1]}${m[3]}`.trim());
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

  /* 卡面简洁卡通插画（独立小头像框，高对比轮廓，兼具可爱感与物种辨识度） */
  const CARD_ART = {
    p_fox: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fde8e1"/><path d="M27,29 Q36,24 35,14 Q32,18 30,17 Q29,12 26,15 Q26,23 23,29 Z" fill="#ff9436" stroke="#c94b24" stroke-width="0.9"/><path d="M33,17 Q34.5,15 34.2,13.5 Q32,15.5 31.8,17.2 Z" fill="#ffe169"/><polygon points="7.5,19 10.5,5.5 19,14" fill="#df552e"/><polygon points="32.5,19 29.5,5.5 21,14" fill="#df552e"/><polygon points="9.8,16.5 11.8,8.8 16.5,14" fill="#fff0d9"/><polygon points="30.2,16.5 28.2,8.8 23.5,14" fill="#fff0d9"/><path d="M7.5,24 L10.5,22 L9,26.5 L13,27 L27,27 L31,26.5 L29.5,22 L32.5,24 Q31,32 20,34.5 Q9,32 7.5,24 Z" fill="#f06d42"/><ellipse cx="20" cy="22.5" rx="11.5" ry="9.5" fill="#f06d42"/><path d="M10.5,24.5 Q20,33.5 29.5,24.5 Q24.5,34.5 20,34.5 Q15.5,34.5 10.5,24.5 Z" fill="#fff6ea"/><path d="M20,9.5 Q23.8,13.5 20,17.2 Q16.2,13.5 20,9.5 Z" fill="#ff9a2e"/><path d="M20,12 Q22,14.5 20,16.8 Q18,14.5 20,12 Z" fill="#ffe169"/><circle cx="15.3" cy="21.8" r="2" fill="#272018"/><circle cx="24.7" cy="21.8" r="2" fill="#272018"/><circle cx="16" cy="21.1" r="0.72" fill="#fff"/><circle cx="25.4" cy="21.1" r="0.72" fill="#fff"/><polygon points="18.3,25.2 21.7,25.2 20,27.3" fill="#272018"/></svg>',
    p_turtle: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#dff2fc"/><path d="M31.5,23.5 Q37.5,20.5 36.2,14.5 Q33.2,18 32,20 Z" fill="#2c7ab8"/><path d="M34.5,17 Q36,15 35.4,13.5" fill="none" stroke="#8ad5ff" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="17.5" cy="29.5" rx="4.2" ry="3.2" fill="#3a89c9"/><ellipse cx="28" cy="29.5" rx="4.2" ry="3.2" fill="#3a89c9"/><path d="M13,25.5 C12.5,12.5 21,9 28.5,11.5 C34,13.5 35.5,21 33.5,25.5 Z" fill="#2d8c6e" stroke="#1d5f4a" stroke-width="1.1"/><path d="M17.5,12.2 L20.5,18.5 L15,24.5 M25.5,11.5 L24.5,18.5 L29.5,24.5 M20.5,18.5 L24.5,18.5" fill="none" stroke="#7de0be" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.2,25.2 Q23.5,28.5 34.4,25.2" fill="none" stroke="#f3e5be" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="10.8" cy="18.2" rx="6.4" ry="5.5" fill="#4da3e3" stroke="#286ca1" stroke-width="1"/><path d="M8,22.5 Q12,24.5 16,22.5" fill="none" stroke="#bde6ff" stroke-width="1.4" stroke-linecap="round"/><circle cx="9.2" cy="16.8" r="1.85" fill="#1e242b"/><circle cx="9.7" cy="16.1" r="0.68" fill="#fff"/><path d="M5.8,19.8 Q8.5,21.8 11.4,20.2" fill="none" stroke="#1e242b" stroke-width="1.25" stroke-linecap="round"/><path d="M10.8,5.8 Q13.2,9 10.8,11.2 Q8.4,9 10.8,5.8 Z" fill="#3288cc"/></svg>',
    p_lion: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fcf2d4"/><circle cx="20" cy="22" r="14" fill="#cc7a10"/><circle cx="11" cy="14" r="5" fill="#d98a14"/><circle cx="29" cy="14" r="5" fill="#d98a14"/><circle cx="8.5" cy="22" r="5" fill="#d98a14"/><circle cx="31.5" cy="22" r="5" fill="#d98a14"/><circle cx="12" cy="30" r="5" fill="#c4710e"/><circle cx="28" cy="30" r="5" fill="#c4710e"/><circle cx="20" cy="32.5" r="5" fill="#c4710e"/><circle cx="20" cy="11" r="5.5" fill="#e09418"/><circle cx="11.5" cy="11.2" r="4.2" fill="#f7c852" stroke="#b5670c" stroke-width="1.2"/><circle cx="11.5" cy="11.4" r="2.1" fill="#c97228"/><circle cx="28.5" cy="11.2" r="4.2" fill="#f7c852" stroke="#b5670c" stroke-width="1.2"/><circle cx="28.5" cy="11.4" r="2.1" fill="#c97228"/><ellipse cx="20" cy="22.5" rx="9.4" ry="8.6" fill="#ffdc73"/><polygon points="20.6,14.3 18.4,17.3 20.1,17.3 19.2,19.7 21.8,16.6 20.1,16.6" fill="#d9531e"/><ellipse cx="17.2" cy="26.2" rx="3.5" ry="2.6" fill="#fff6db"/><ellipse cx="22.8" cy="26.2" rx="3.5" ry="2.6" fill="#fff6db"/><path d="M13.5,18.7 L17.3,19.6" stroke="#8a4b0f" stroke-width="1.3" stroke-linecap="round"/><path d="M26.5,18.7 L22.7,19.6" stroke="#8a4b0f" stroke-width="1.3" stroke-linecap="round"/><circle cx="15.8" cy="21.4" r="1.9" fill="#272018"/><circle cx="24.2" cy="21.4" r="1.9" fill="#272018"/><circle cx="16.4" cy="20.7" r="0.65" fill="#fff"/><circle cx="24.8" cy="20.7" r="0.65" fill="#fff"/><polygon points="17.8,23.5 22.2,23.5 20,25.8" fill="#7a3e0e"/><path d="M17.2,27.2 Q18.6,28.5 20,27.0 Q21.4,28.5 22.8,27.2" fill="none" stroke="#63380c" stroke-width="1.3" stroke-linecap="round"/><path d="M11.8,25.2 L14.5,25.7 M12.2,27.2 L14.7,26.9 M28.2,25.2 L25.5,25.7 M27.8,27.2 L25.3,26.9" stroke="#8a4b0f" stroke-width="1.05" stroke-linecap="round"/></svg>',
    p_dragon_ex: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fce0c8"/><polygon points="2.5,12 13,18 11,31 5,25 3,19" fill="#b32d18"/><polygon points="4.5,14.5 12,19 10,27.5 6.5,23" fill="#f29a38"/><polygon points="37.5,12 27,18 29,31 35,25 37,19" fill="#b32d18"/><polygon points="35.5,14.5 28,19 30,27.5 33.5,23" fill="#f29a38"/><path d="M15,12 Q10,6.5 9.5,3.5 Q13.5,5.5 17.8,10.5 Z" fill="#e6aa28" stroke="#9e620b" stroke-width="0.8"/><path d="M25,12 Q30,6.5 30.5,3.5 Q26.5,5.5 22.2,10.5 Z" fill="#e6aa28" stroke="#9e620b" stroke-width="0.8"/><polygon points="20,6 22.2,11 17.8,11" fill="#ff9429"/><polygon points="12.5,13.5 20,10.5 27.5,13.5 29.5,21.5 25.2,32.5 20,35.5 14.8,32.5 10.5,21.5" fill="#d4391f" stroke="#8a1b0c" stroke-width="1"/><polygon points="14.5,27 20,25 25.5,27 24,33 20,35 16,33" fill="#ffd466"/><polygon points="16.2,15 20,13.2 23.8,15 22.4,24.5 20,26 17.6,24.5" fill="#b52612"/><polygon points="12.5,18.2 17.4,19.8 16,22.2 12.2,20.8" fill="#fff07a"/><polygon points="27.5,18.2 22.6,19.8 24,22.2 27.8,20.8" fill="#fff07a"/><polygon points="14.4,18.8 15.6,19.2 14.9,21.8 13.8,21.3" fill="#9e1c0e"/><polygon points="25.6,18.8 24.4,19.2 25.1,21.8 26.2,21.3" fill="#9e1c0e"/><circle cx="18" cy="24.2" r="0.8" fill="#4a1008"/><circle cx="22" cy="24.2" r="0.8" fill="#4a1008"/><path d="M14.5,27.6 Q20,30.2 25.5,27.6" fill="none" stroke="#61180d" stroke-width="1.3"/><polygon points="15.5,27.8 16.8,30.6 18.1,28.1" fill="#fff"/><polygon points="24.5,27.8 23.2,30.6 21.9,28.1" fill="#fff"/></svg>',
    e_dog: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fae2da"/><polygon points="8,18 6.5,5.5 16.5,12" fill="#4a2b23"/><polygon points="32,18 33.5,5.5 23.5,12" fill="#4a2b23"/><polygon points="9.2,16 8.5,8.2 14.5,12.5" fill="#ff8a30"/><polygon points="30.8,16 31.5,8.2 25.5,12.5" fill="#ff8a30"/><polygon points="7,24 10,16 14,12 20,10.5 26,12 30,16 33,24 28,33.5 20,36 12,33.5" fill="#3d231c"/><path d="M10.5,26 L13.5,28 L12,32 M29.5,26 L26.5,28 L28,32 M20,11 L18.5,14.5 L21.5,14.5 Z" fill="none" stroke="#ff7a29" stroke-width="1.3" stroke-linecap="round"/><polygon points="11.5,16.5 20,13.5 28.5,16.5 27.2,26.5 20,32.5 12.8,26.5" fill="#704034"/><ellipse cx="20" cy="26.5" rx="5.8" ry="4.6" fill="#d97852"/><polygon points="13.2,18.2 17.8,20.2 15.8,22.2 12.8,20.6" fill="#ffe166"/><polygon points="26.8,18.2 22.2,20.2 24.2,22.2 27.2,20.6" fill="#ffe166"/><circle cx="15.3" cy="20.4" r="1" fill="#8f180b"/><circle cx="24.7" cy="20.4" r="1" fill="#8f180b"/><path d="M18,24 L22,24 L20,26.4 Z" fill="#231814"/><path d="M16.2,28.5 Q20,27.2 23.8,28.5" fill="none" stroke="#231814" stroke-width="1.25" stroke-linecap="round"/><polygon points="16.8,28.4 17.9,31 19,28.4" fill="#fff"/><polygon points="23.2,28.4 22.1,31 21,28.4" fill="#fff"/></svg>',
    e_fish: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#dff1fb"/><circle cx="7.5" cy="11.5" r="2.7" fill="#eef9ff" stroke="#3182bd" stroke-width="1.3"/><circle cx="6.7" cy="10.6" r="0.7" fill="#fff"/><circle cx="5.2" cy="6.8" r="1.6" fill="#eef9ff" stroke="#3182bd" stroke-width="1.2"/><path d="M14,15 Q19,7.5 26,12.5 L23,17.5 Z" fill="#327eb8"/><path d="M18,28.5 Q21,34.5 25.5,31.5 L22.5,27 Z" fill="#327eb8"/><polygon points="27,22 36,13.5 34.2,22 36,30.5" fill="#398bc7" stroke="#246496" stroke-width="0.9" stroke-linejoin="round"/><ellipse cx="18" cy="22" rx="10.8" ry="8.2" fill="#52ace6" stroke="#246496" stroke-width="1"/><path d="M8.8,24 Q18,29.5 27.2,24 Q24,29.8 18,29.8 Q12,29.8 8.8,24 Z" fill="#d9f2ff"/><path d="M19.5,19.5 Q21.5,22 19.5,24.5 M23,19.8 Q24.8,22 23,24.2" fill="none" stroke="#9ad7fa" stroke-width="1.3" stroke-linecap="round"/><circle cx="12.8" cy="20.2" r="2.5" fill="#fff"/><circle cx="12.3" cy="20.2" r="1.35" fill="#182838"/><circle cx="12.9" cy="19.5" r="0.6" fill="#fff"/><ellipse cx="8.2" cy="22.8" rx="1.2" ry="1.5" fill="#235c8c"/></svg>',
    e_bird: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fbf0cc"/><polygon points="3,17 13,20 12.5,27 5.5,25.5 7,22.5 3.8,21.5" fill="#d68f0e"/><polygon points="37,17 27,20 27.5,27 34.5,25.5 33,22.5 36.2,21.5" fill="#d68f0e"/><polygon points="13.5,13 15.5,5.5 18.8,10 21.5,3.5 23.5,10.2 27.2,5.8 26.5,13.5" fill="#f2b318" stroke="#9e6b06" stroke-width="0.8" stroke-linejoin="round"/><polygon points="15.5,11.5 21,5.8 24.5,11.8" fill="#ffea6b"/><ellipse cx="20" cy="22.5" rx="9.5" ry="9" fill="#f7c936" stroke="#b37b0c" stroke-width="0.9"/><path d="M11.5,19 L17.5,21 L15.5,24 L11,22 Z" fill="#6b4b08"/><path d="M28.5,19 L22.5,21 L24.5,24 L29,22 Z" fill="#6b4b08"/><circle cx="15.2" cy="20.6" r="1.9" fill="#fff"/><circle cx="24.8" cy="20.6" r="1.9" fill="#fff"/><circle cx="15.6" cy="20.7" r="1.05" fill="#1e1810"/><circle cx="24.4" cy="20.7" r="1.05" fill="#1e1810"/><polygon points="16.8,22.8 23.2,22.8 20,29" fill="#e65e10" stroke="#9c3804" stroke-width="0.7" stroke-linejoin="round"/><polygon points="17.6,23.2 22.4,23.2 20,25.2" fill="#ff9036"/></svg>',
    e_shark_ex: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#d6ecfc"/><path d="M17.5,13.5 C18.5,6.5 22,3.5 25.5,4.2 C23.5,8.2 24.5,11.5 26,13.8 Z" fill="#164b7a" stroke="#0d3152" stroke-width="0.9"/><polygon points="4.5,28 11.5,22 12.5,29.5" fill="#195285"/><polygon points="35.5,28 28.5,22 27.5,29.5" fill="#195285"/><path d="M7.5,23.5 C8,14 13.5,10.5 20,10.5 C26.5,10.5 32,14 32.5,23.5 C32,30.5 26.5,34 20,34 C13.5,34 8,30.5 7.5,23.5 Z" fill="#2569a1" stroke="#133d63" stroke-width="1"/><path d="M9.5,25.5 C12.5,32.5 27.5,32.5 30.5,25.5 C27,28 13,28 9.5,25.5 Z" fill="#eef8ff"/><path d="M9.2,21.5 Q10.4,23.2 9.2,25 M10.9,21.8 Q12,23.3 10.9,24.8" fill="none" stroke="#103457" stroke-width="1.1" stroke-linecap="round"/><path d="M30.8,21.5 Q29.6,23.2 30.8,25 M29.1,21.8 Q28,23.3 29.1,24.8" fill="none" stroke="#103457" stroke-width="1.1" stroke-linecap="round"/><polygon points="11.5,17.2 17,19.4 14.5,21.2 11.5,19.6" fill="#ffd859"/><polygon points="28.5,17.2 23,19.4 25.5,21.2 28.5,19.6" fill="#ffd859"/><circle cx="14.5" cy="19.3" r="0.9" fill="#0f243b"/><circle cx="25.5" cy="19.3" r="0.9" fill="#0f243b"/><path d="M12.5,24.5 Q20,21.5 27.5,24.5 Q27,31.2 20,31.2 Q13,31.2 12.5,24.5 Z" fill="#0f243b"/><polygon points="14,24.2 15.5,27 17,23.7 18.5,26.8 20,23.4 21.5,26.8 23,23.7 24.5,27 26,24.2" fill="#fff"/><polygon points="15,29.6 16.5,27.3 18,29.9 20,27.2 22,29.9 23.5,27.3 25,29.6" fill="#fff"/></svg>',
    item_potion: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#e6f4ea"/><rect x="16" y="7" width="8" height="5" rx="1.5" fill="#8c6239"/><path d="M16,12 L24,12 L28,21 A9,9 0 1 1 12,21 Z" fill="#3f9e66"/><rect x="18.5" y="20" width="3" height="9" rx="1" fill="#fff"/><rect x="15.5" y="23" width="9" height="3" rx="1" fill="#fff"/></svg>',
    item_flute: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#f6eedb"/><path d="M9,29 L29,9 L33,13 L13,33 Z" fill="#c28e2b"/><circle cx="18" cy="22" r="1.5" fill="#4a331d"/><circle cx="22" cy="18" r="1.5" fill="#4a331d"/><circle cx="26" cy="14" r="1.5" fill="#4a331d"/><path d="M11,13 Q14,9 17,13" fill="none" stroke="#4e6e58" stroke-width="2" stroke-linecap="round"/></svg>',
    item_bag: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#eef5ec"/><path d="M15,14 Q20,7 25,14" fill="none" stroke="#6c4d2e" stroke-width="2.6" stroke-linecap="round"/><rect x="10" y="14" width="20" height="18" rx="5" fill="#5a8266"/><rect x="10" y="14" width="20" height="8" rx="4" fill="#466a51"/><rect x="18" y="20" width="4" height="4" rx="1" fill="#f5d07a"/></svg>',
    item_power: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#fbf0dc"/><polygon points="20,6 24,14 33,15 26,21 28,31 20,26 12,31 14,21 7,15 16,14" fill="#d48c1d"/><polygon points="20,11 22,16 27,17 23,20 24,25 20,22 16,25 17,20 13,17 18,16" fill="#fff3c4"/></svg>',
    item_recycle: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#e8f4ee"/><path d="M20,9 A11,11 0 1 1 10,24" fill="none" stroke="#2e6b47" stroke-width="3" stroke-linecap="round"/><polygon points="20,5 25,10 18,13" fill="#2e6b47"/><polygon points="18,14 23,14 20,20 24,20 17,28 19,21 15,21" fill="#d48c1d"/></svg>'
  };

  const STORAGE_KEY_CFG  = "elemental_table_api_cfg_v14";
  const STORAGE_KEY_DATA = "kotodama_duel_imported_gamedata_v2";
  const STORAGE_KEY_MD   = "elemental_table_imported_md_v1";

  /** 文件内 XOR 混淆还原内置演示密钥（不在源码中保存明文，开箱即可体验在线语音） */
  function _decodeBuiltinKey() {
    const m = [75, 47, 115, 25, 93, 58, 97];
    const e = [10, 126, 93, 88, 63, 2, 51, 5, 25, 57, 109, 112, 119, 24, 25, 70, 68, 116, 27, 84, 39, 18, 68, 5, 77, 13, 115, 2, 6, 72, 33, 75, 101, 118, 17, 39, 121, 62, 117, 8, 64, 52, 19, 67, 54, 43, 41, 121, 89, 18, 90, 22, 88];
    return e.map((b, i) => String.fromCharCode(b ^ m[i % m.length])).join("");
  }

  function _decodeBuiltinNiaAk() {
    const m = [83, 39, 109, 29, 77, 61, 103];
    const e = [96, 106, 56, 103, 52, 122, 61, 1, 116, 4, 82, 23, 114, 11, 9, 83, 36, 104, 57, 91, 55, 7, 16, 10, 122, 123, 4];
    return e.map((b, i) => String.fromCharCode(b ^ m[i % m.length])).join("");
  }

  function _decodeBuiltinNiaSk() {
    const m = [71, 53, 113, 31, 89, 43, 97];
    const e = [0, 112, 50, 78, 19, 66, 23, 12, 4, 67, 78, 40, 98, 18, 1, 88, 71, 70, 12, 102, 0, 20, 67, 64, 115, 19, 76, 23, 126, 66, 62, 121];
    return e.map((b, i) => String.fromCharCode(b ^ m[i % m.length])).join("");
  }

  /* 默认配置：界面默认日语 ja，LLM 保持 Vertex Gemini，ASR 与 TTS 默认使用 SenseTime Nia 语音引擎 */
  const DEFAULT_CONFIG = {
    uiLang: "ja",
    apiKey: _decodeBuiltinKey(),
    llmModel: "gemini-3.5-flash-lite",
    ttsModel: "gemini-3.8-flash-lite-tts",
    asrMode: "nia_asr",
    asrLang: "ja-JP",
    niaAk: _decodeBuiltinNiaAk(),
    niaSk: _decodeBuiltinNiaSk(),
    niaAsrLang: "",
    niaAsrLangManual: false,
    ttsEngine: "nia_tts",
    niaVoiceReferee: "female_xiaowan",
    niaVoiceRival: "male_zichen",
    niaVoiceRefereeZh: "female_luna",
    niaVoiceRivalZh: "male_xingye",
    voiceReferee: "Kore",
    voiceRival: "Fenrir",
    chromeVoiceURI: "",
    chromeVoiceRivalURI: "",
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
          niaAsrLang: cfg.niaAsrLang,
          ttsEngine: cfg.ttsEngine,
          niaVoiceReferee: cfg.niaVoiceReferee,
          niaVoiceRival: cfg.niaVoiceRival,
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
        list.innerHTML = `<div class="dlog-empty" style="text-align:center;color:var(--ink-sub);padding:18px 8px;">${escapeHtml(t("ログはまだありません", "暂无调试日志"))}</div>`;
        return;
      }
      list.innerHTML = rows.map((e) => this.formatItemHtml(e)).join("");
    }
  };

  /* ---------- 非阻塞首次操作引导引擎（浮动提示 + 可选语音，永不阻塞点击与发声） ---------- */
  const GuideEngine = {
    shown: new Set(),
    lastGuideKey: null,
    _hideTimer: null,
    _pendingTimer: null,
    _hideUntil: 0,

    isEnabled() {
      return Boolean(ConfigManager.data.guideMode);
    },

    reset() {
      this.shown.clear();
      this.lastGuideKey = null;
      this.hide(true);
    },

    syncButton() {
      const btn = $("btnGuideMode");
      if (!btn) return;
      const on = this.isEnabled();
      btn.classList.toggle("guide-on", on);
      btn.innerHTML = `${SVG_ICONS.guide}${escapeHtml(on ? t("ガイド ON", "引导 ON") : t("ガイド OFF", "引导 OFF"))}`;
    },

    /** 根据当前盘面阶段智能选择最应展示的引导项（用于关闭引导后重新开启时立即恢复） */
    pickContextualGuideKey() {
      const s = (typeof BattleEngine !== "undefined") ? BattleEngine.state : null;
      if (!s || s.gameOver) return this.lastGuideKey || "setup_starter";
      if (s.phase === "setup") return "setup_starter";
      if (!s.energyUsedThisTurn && Array.isArray(s.player?.hand) && s.player.hand.some((id) => id.startsWith("energy_"))) {
        return "first_turn_energy";
      }
      const act = s.player?.active;
      const actDef = act ? SpecEngine.getMonster(act.id) : null;
      if (act && actDef && actDef.skills.some((sk) => BattleEngine.canPayCost(act.energies, sk.cost))) {
        return "first_skill_ready";
      }
      const hasHandMon = Array.isArray(s.player?.hand) && s.player.hand.some((id) => Boolean(SpecEngine.getMonster(id)));
      const hasEmptyBench = Array.isArray(s.player?.bench) && s.player.bench.includes(null);
      if (hasHandMon && hasEmptyBench) return "first_bench_play";
      if (this.lastGuideKey && this.MESSAGES[this.lastGuideKey]) return this.lastGuideKey;
      return "first_turn_energy";
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
        const restoreKey = this.pickContextualGuideKey();
        if (restoreKey) {
          this.trigger(restoreKey, true);
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
        tag: "ガイド：サポート（引导：支援卡）",
        ja: "『サポート』マークのカード（補給バッグ・よびだし笛・パワーバッジ）は1ターンに合計1枚までです。",
        zh: "支援卡（补给包/召唤笛/力量徽章）每回合合计只能使用 1 张。"
      },
      first_bench_play: {
        tag: "ガイド：ベンチ展開（引导：备战区）",
        ja: "手札のモンスターをクリックするとベンチに出せます。バトル場が倒れても控えがいれば続けられます！",
        zh: "点击手牌怪兽可放入备战区；战斗区怪兽倒下时若备战区有怪兽就能补位继续战斗。"
      }
    },

    _showCard(msg, speakVoice, key = "") {
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
        const prio = key === "setup_starter" ? "high" : "low";
        VoiceEngine.speak({ ja: msg.ja, zh: msg.zh }, "referee", { priority: prio, interruptible: true });
      }
    },

    /** 语言切换时同步刷新当前可见引导浮窗的标题标签 */
    syncVisibleCard() {
      const msg = this.lastGuideKey ? this.MESSAGES[this.lastGuideKey] : null;
      if (msg && $("guideTag")) {
        $("guideTag").innerHTML = `${SVG_ICONS.guideChip}${formatBilingualLabelHtml(msg.tag)}`;
      }
    },

    /** 触发指定步骤的首次非阻塞引导（旧引导完成撤回动画后再弹出新引导） */
    trigger(key, speakVoice = true) {
      const msg = this.MESSAGES[key];
      if (!msg) return;
      this.lastGuideKey = key;
      if (!this.isEnabled() || this.shown.has(key)) return;
      this.shown.add(key);
      const box = $("guideFloat");
      if (box && box.classList.contains("show")) {
        this.hide();
      }
      const waitMs = Math.max(0, this._hideUntil - Date.now());
      clearTimeout(this._pendingTimer);
      if (waitMs > 0) {
        this._pendingTimer = setTimeout(() => {
          if (this.isEnabled()) this._showCard(msg, speakVoice, key);
        }, waitMs + 30);
      } else {
        this._showCard(msg, speakVoice, key);
      }
    }
  };

  /* =========================================================================
     1. ConfigManager（Gemini LLM 与SenseTime Nia ASR/TTS 接入层、JWT 签发与持久化）
     ========================================================================= */
  const ConfigManager = {
    data: { ...DEFAULT_CONFIG },
    _niaJwtCache: null,

    /** 白名单校验配置字段类型与合法枚举，防止旧版脏数据或注入污染 */
    sanitize(rawObj) {
      const src = (rawObj && typeof rawObj === "object") ? rawObj : {};
      const out = { ...DEFAULT_CONFIG };
      const VALID_UI_LANG = new Set(["ja", "zh"]);
      const VALID_ASR = new Set(["nia_asr", "gemini_audio", "chrome_asr_llm", "chrome_local"]);
      const VALID_LANG = new Set(["ja-JP", "zh-CN"]);
      const VALID_NIA_LANG = new Set(["", "ja", "zh"]);
      const VALID_TTS = new Set(["nia_tts", "vertex_tts", "chrome_tts"]);
      const VALID_VOICES = new Set(["Zephyr", "Leda", "Kore", "Aoede", "Puck", "Charon", "Fenrir"]);
      const VALID_NIA_VOICES_JA = new Set([
        "female_xiaowan", "female_luna", "female_meihe", "female_lora", "female_shuying",
        "male_zichen", "male_haru", "male_shantian", "male_youzhen"
      ]);
      const VALID_NIA_VOICES_ZH = new Set([
        "child_0001_a", "female_0003_a", "female_0006_a", "female_0018_b", "female_0027_a", "female_0030_e", "female_0036_a", "female_duoduo", "female_kexin", "female_lingling", "female_lingxi", "female_luna", "female_mengmeng", "female_nuannuan", "female_qinghe", "female_ruanruan", "female_ruoyan", "female_ruyan", "female_tangtang", "female_weiyang", "female_xiaocheng", "female_xiaohe", "female_xiaoli", "female_xiaolin", "female_xiaomo", "female_xiaotang", "female_xiaotao", "female_xiaoyou", "female_xiaoyou_v5i", "female_youyou", "female_zengtong", "female_zhinuann", "female_zhirou", "male_ahao", "male_chenlang", "male_cixingnansheng", "male_hexiao", "male_huaijin", "male_jingheng", "male_lingchuan", "male_linzhou", "male_mili", "male_nanfeng", "male_qingmu", "male_tianhe", "male_wanzhou", "male_xiaobei", "male_xiaoyang", "male_xingye", "male_xuanzhao", "male_yian", "male_yunshen", "male_yunzheng"
      ]);
      const VALID_DIFF = new Set(["normal", "hard"]);
      if (VALID_UI_LANG.has(src.uiLang)) out.uiLang = src.uiLang;
      if (typeof src.apiKey === "string") out.apiKey = src.apiKey.trim();
      if (typeof src.llmModel === "string" && src.llmModel.trim()) out.llmModel = src.llmModel.trim();
      if (typeof src.ttsModel === "string" && src.ttsModel.trim()) out.ttsModel = src.ttsModel.trim();
      if (typeof src.niaAk === "string") out.niaAk = src.niaAk.trim();
      if (typeof src.niaSk === "string") out.niaSk = src.niaSk.trim();
      if (VALID_ASR.has(src.asrMode)) out.asrMode = src.asrMode;
      if (typeof src.niaAsrLangManual === "boolean") out.niaAsrLangManual = src.niaAsrLangManual;
      if (out.niaAsrLangManual && VALID_NIA_LANG.has(src.niaAsrLang)) {
        out.niaAsrLang = src.niaAsrLang;
      } else {
        out.niaAsrLang = "";
      }
      if (VALID_LANG.has(src.asrLang)) out.asrLang = src.asrLang;
      else out.asrLang = out.uiLang === "zh" ? "zh-CN" : "ja-JP";
      if (VALID_TTS.has(src.ttsEngine)) out.ttsEngine = src.ttsEngine;
      if (VALID_NIA_VOICES_JA.has(src.niaVoiceReferee)) out.niaVoiceReferee = src.niaVoiceReferee;
      if (VALID_NIA_VOICES_JA.has(src.niaVoiceRival)) out.niaVoiceRival = src.niaVoiceRival;
      if (VALID_NIA_VOICES_ZH.has(src.niaVoiceRefereeZh)) out.niaVoiceRefereeZh = src.niaVoiceRefereeZh;
      if (VALID_NIA_VOICES_ZH.has(src.niaVoiceRivalZh)) out.niaVoiceRivalZh = src.niaVoiceRivalZh;
      if (VALID_VOICES.has(src.voiceReferee)) out.voiceReferee = src.voiceReferee;
      if (VALID_VOICES.has(src.voiceRival)) out.voiceRival = src.voiceRival;
      if (typeof src.chromeVoiceURI === "string") out.chromeVoiceURI = src.chromeVoiceURI;
      if (typeof src.chromeVoiceRivalURI === "string") out.chromeVoiceRivalURI = src.chromeVoiceRivalURI;
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
      this._niaJwtCache = null;
      return this.data;
    },

    save(partial) {
      this.data = this.sanitize({ ...this.data, ...partial });
      this._niaJwtCache = null;
      try { localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(this.data)); } catch (e) {}
    },

    reset() {
      try { localStorage.removeItem(STORAGE_KEY_CFG); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_DATA); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_MD); } catch (e) {}
      this.data = { ...DEFAULT_CONFIG };
      this._niaJwtCache = null;
    },

    hasNiaCredentials() {
      return Boolean(String(this.data.niaAk || "").trim() && String(this.data.niaSk || "").trim());
    },

    /** Uint8Array → Base64URL（无填充） */
    _base64UrlBytes(bytes) {
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    },

    /** 纯 JS SHA-256（仅当非 HTTPS/localhost 环境缺少 crypto.subtle 时兜底） */
    _sha256Fallback(msgBytes) {
      const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ];
      let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
      let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
      const len = msgBytes.length;
      const bitLenHi = Math.floor((len * 8) / 0x100000000);
      const bitLenLo = (len * 8) >>> 0;
      const totalLen = ((len + 9 + 63) >> 6) << 6;
      const buf = new Uint8Array(totalLen);
      buf.set(msgBytes, 0);
      buf[len] = 0x80;
      const dv = new DataView(buf.buffer);
      dv.setUint32(totalLen - 8, bitLenHi, false);
      dv.setUint32(totalLen - 4, bitLenLo, false);
      const w = new Uint32Array(64);
      const rotr = (x, n) => (x >>> n) | (x << (32 - n));
      for (let off = 0; off < totalLen; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
        for (let i = 16; i < 64; i++) {
          const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
          const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          const ch = (e & f) ^ ((~e) & g);
          const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
          const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const t2 = (S0 + maj) >>> 0;
          h = g; g = f; f = e; e = (d + t1) >>> 0;
          d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
      }
      const out = new Uint8Array(32);
      const odv = new DataView(out.buffer);
      [h0, h1, h2, h3, h4, h5, h6, h7].forEach((val, idx) => odv.setUint32(idx * 4, val, false));
      return out;
    },

    _hmacSha256Fallback(keyBytes, dataBytes) {
      let k = keyBytes;
      if (k.length > 64) k = this._sha256Fallback(k);
      const block = new Uint8Array(64);
      block.set(k, 0);
      const oPad = new Uint8Array(64 + 32);
      const iPad = new Uint8Array(64 + dataBytes.length);
      for (let i = 0; i < 64; i++) {
        oPad[i] = block[i] ^ 0x5c;
        iPad[i] = block[i] ^ 0x36;
      }
      iPad.set(dataBytes, 64);
      const innerHash = this._sha256Fallback(iPad);
      oPad.set(innerHash, 64);
      return this._sha256Fallback(oPad);
    },

    /** 签发SenseTime Nia HS256 JWT（支持 Web Crypto 与纯 JS 兜底，带 28 分钟缓存） */
    async generateNiaJwt() {
      const ak = String(this.data.niaAk || "").trim();
      const sk = String(this.data.niaSk || "").trim();
      if (!ak || !sk) throw new Error("Nia AK/SK 未設定");
      const nowSec = Math.floor(Date.now() / 1000);
      const credSig = `${ak}|${sk.length}|${sk.slice(0, 4)}|${sk.slice(-4)}`;
      if (this._niaJwtCache && this._niaJwtCache.credSig === credSig && this._niaJwtCache.exp - nowSec > 120) {
        return this._niaJwtCache.token;
      }
      const enc = new TextEncoder();
      const headerB64 = this._base64UrlBytes(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
      const exp = nowSec + 1800;
      const payloadB64 = this._base64UrlBytes(enc.encode(JSON.stringify({ iss: ak, exp, nbf: nowSec - 5 })));
      const signingInput = `${headerB64}.${payloadB64}`;
      const keyBytes = enc.encode(sk);
      const dataBytes = enc.encode(signingInput);
      let sigBytes;
      if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.importKey === "function") {
        const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
        sigBytes = new Uint8Array(sigBuf);
      } else {
        sigBytes = this._hmacSha256Fallback(keyBytes, dataBytes);
      }
      const token = `${signingInput}.${this._base64UrlBytes(sigBytes)}`;
      this._niaJwtCache = { credSig, token, exp };
      return token;
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

    /** 构建 Vertex SSE 流式接口地址（streamGenerateContent?alt=sse） */
    buildStreamRestUrl(model) {
      const k = String(this.data.apiKey || "").trim();
      const m = encodeURIComponent(String(model || this.data.llmModel || "gemini-3.5-flash-lite").trim());
      if (!k) return "";
      return `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:streamGenerateContent?alt=sse`;
    },

    /** 构建带密钥认证的请求头 */
    buildAuthHeaders() {
      const k = String(this.data.apiKey || "").trim();
      return k ? { "Content-Type": "application/json", "x-goog-api-key": k } : { "Content-Type": "application/json" };
    },

    /** 统一 Vertex SSE 流式文本调用（支持 onDelta 实时回调，流式失败或无 body.getReader 时自动回退非流式接口） */
    async streamVertexText(model, payload, opts = {}) {
      const streamUrl = this.buildStreamRestUrl(model);
      const restUrl = this.buildRestUrl(model);
      if (!restUrl) throw new Error("missing apiKey");
      const headers = this.buildAuthHeaders();
      const bodyStr = JSON.stringify(payload);
      const onDelta = typeof opts.onDelta === "function" ? opts.onDelta : null;

      if (streamUrl && typeof ReadableStream !== "undefined") {
        try {
          const res = await fetch(streamUrl, {
            method: "POST",
            headers,
            body: bodyStr,
            signal: opts.signal
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} (${model})`);
          if (res.body && typeof res.body.getReader === "function") {
            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buf = "";
            let fullText = "";
            const consumeLine = (rawLine) => {
              const line = rawLine.trim();
              if (!line || !line.startsWith("data:")) return;
              const jsonStr = line.slice(5).trim();
              if (!jsonStr || jsonStr === "[DONE]") return;
              try {
                const chunk = JSON.parse(jsonStr);
                const parts = chunk?.candidates?.[0]?.content?.parts;
                if (Array.isArray(parts)) {
                  for (const p of parts) {
                    if (p && typeof p.text === "string" && p.text) {
                      fullText += p.text;
                      if (onDelta) onDelta(p.text, fullText);
                    }
                  }
                }
              } catch (_) {}
            };
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split(/\r?\n/);
              buf = lines.pop() || "";
              for (const ln of lines) consumeLine(ln);
            }
            if (buf.trim()) consumeLine(buf);
            if (fullText) return { text: fullText, streamed: true };
          }
        } catch (err) {
          if (err?.name === "AbortError") throw err;
          /* 若流式端点暂不可用或被代理截断，平滑回退到标准非流式接口 */
        }
      }

      const res = await fetch(restUrl, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: opts.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${model})`);
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || "";
      if (raw && onDelta) onDelta(raw, raw);
      return { text: raw, streamed: false };
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

    /** 统一解析技能特效字段（支持 guard_N / discard_self_N / heal_self_N / draw_N / bench_splash_N / recoil_N 及组合） */
    parseSkillEffects(effectRaw) {
      const fx = { guardVal: 0, discardSelfVal: 0, healSelfVal: 0, drawVal: 0, benchSplashVal: 0, recoilVal: 0 };
      const parts = String(effectRaw || "none").split(/[+,|]/).map((x) => x.trim()).filter(Boolean);
      for (const p of parts) {
        let m;
        if ((m = /^guard_(\d+)$/.exec(p))) fx.guardVal = Math.max(fx.guardVal, Number(m[1]));
        else if ((m = /^discard_self_(\d+)$/.exec(p))) fx.discardSelfVal += Number(m[1]);
        else if ((m = /^heal_self_(\d+)$/.exec(p))) fx.healSelfVal += Number(m[1]);
        else if ((m = /^draw_(\d+)$/.exec(p))) fx.drawVal += Number(m[1]);
        else if ((m = /^bench_splash_(\d+)$/.exec(p))) fx.benchSplashVal = Math.max(fx.benchSplashVal, Number(m[1]));
        else if ((m = /^recoil_(\d+)$/.exec(p))) fx.recoilVal += Number(m[1]);
      }
      return fx;
    },

    normalizeSkillObj(s) {
      if (!s) return null;
      if (typeof s === "string") return this.parseSkill(s);
      const effectRaw = this.stripHtmlTags(s.effect || "none") || "none";
      const fx = this.parseSkillEffects(effectRaw);
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
        guardVal: fx.guardVal || (Number(s.guardVal) || 0),
        discardSelfVal: fx.discardSelfVal || (Number(s.discardSelfVal) || 0),
        healSelfVal: fx.healSelfVal || (Number(s.healSelfVal) || 0),
        drawVal: fx.drawVal || (Number(s.drawVal) || 0),
        benchSplashVal: fx.benchSplashVal || (Number(s.benchSplashVal) || 0),
        recoilVal: fx.recoilVal || (Number(s.recoilVal) || 0),
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
      const fx = this.parseSkillEffects(effectRaw);
      return {
        name_ja: nameMatch ? nameMatch[1].trim() : parts[0],
        name_zh: nameMatch ? nameMatch[2].trim() : parts[0],
        cost: (parts[1] || "").split(",").map((s) => s.trim()).filter(Boolean),
        damage: Number(parts[2]) || 0,
        target: parts[3] || "enemy_active",
        effect: effectRaw,
        ...fx,
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

    /* 业界拼音音素归并表（平翘舌 zh/z、ch/c、sh/s，前后鼻音 in/ing、en/eng、an/ang，n/l 统一映射，零依赖解决“蕾丝→雷狮”等中文 ASR 同音/近音误识别） */
    ZH_PHONETIC_MAP: (() => {
      const groups = {
        lei: "雷蕾类累垒泪擂磊", si: "狮丝思师诗施湿司私死四似斯撕",
        yan: "炎严盐延演眼烟岩颜言研沿掩燕", hu: "狐湖虎胡壶呼护忽弧糊",
        sui: "水睡税岁碎随遂虽", gui: "龟贵规鬼归硅桂柜跪",
        long: "龙隆笼拢聋咙弄农", quan: "犬圈权全拳泉劝券",
        pao: "泡跑炮抛袍刨", yu: "鱼雨玉语羽宇欲遇域愈",
        dian: "电点店垫殿典颠", niao: "鸟尿袅",
        cang: "沧仓藏苍舱昌厂场唱", hai: "海害孩还亥", sa: "鲨沙杀纱傻啥萨",
        huo: "火活货伙获或豁", hua: "花化华画话划滑",
        dan: "弹蛋单淡但担胆诞", qiang: "枪强墙抢腔呛",
        tie: "铁贴帖叠", jia: "甲假加家架价佳驾", ke: "壳可克客科刻课颗",
        ji: "击鸡基机极级急集寄技记给济计", ting: "霆停挺听庭廷亭厅",
        tu: "突图途土吐兔涂", xi: "袭西希吸洗喜戏系细席息",
        san: "伤商尚上山闪善扇三散", yao: "药要咬摇耀腰遥邀",
        bu: "补不步部布捕", bao: "包宝报抱爆薄保",
        zao: "召找照造早遭澡招朝", huan: "唤换环还欢缓幻患", di: "笛敌迪底地弟第低递",
        li: "力丽利理立里离例粒", liang: "量亮良凉粮两辆", hui: "徽灰回会挥毁汇惠", zang: "章张长障掌帐脏藏",
        neng: "能嫩农", sou: "收手首守受售瘦搜",
        bao2: "暴爆抱报", feng: "风封峰蜂疯丰", lang: "浪朗狼廊郎",
        chong: "冲充重虫崇", zhuang: "撞装壮状庄", pen: "喷盆", se: "射设社色涩涉",
        xuan: "旋宣悬选轩", wo: "涡窝我握卧", shan: "闪善扇山", xing: "星兴行形型醒"
      };
      const map = Object.create(null);
      for (const [code, chars] of Object.entries(groups)) {
        const normCode = code.replace(/\d+$/, "");
        for (const ch of chars) map[ch] = normCode;
      }
      return map;
    })(),

    /** 将中文片段转为模糊拼音音素序列（无法映射的字符保留原文，保留边界避免跨词误拼） */
    toZhPhonetic(str) {
      const clean = String(str || "").replace(/[\s　「」『』（）()【】\[\]、，。.,！!？?・\-ー]/g, "");
      if (!clean || !/[\u4e00-\u9fff]/.test(clean)) return "";
      const out = [];
      for (const ch of clean) {
        out.push(this.ZH_PHONETIC_MAP[ch] || ch.toLowerCase());
      }
      return out.join("|");
    },

    /** 日语 Mora 音拍归一化（片假名→平假名、去长音、统一 じ/ぢ・ず/づ・お/を、合并长元音） */
    toJaPhonetic(str) {
      return this.normalizeText(str)
        .replace(/ぢ/g, "じ")
        .replace(/づ/g, "ず")
        .replace(/を/g, "お")
        .replace(/おう|おお/g, "お")
        .replace(/えい|ええ/g, "え")
        .replace(/うう/g, "う")
        .replace(/ああ/g, "あ")
        .replace(/いい/g, "い")
        .replace(/っ/g, "");
    },

    /** 去浊音/半浊音用于 4 拍以上日语词的宽容音素匹配（如 ひのきずね → ひのきつね） */
    stripJaVoicing(str) {
      const map = {
        が:"か",ぎ:"き",ぐ:"く",げ:"け",ご:"こ",
        ざ:"さ",じ:"し",ず:"す",ぜ:"せ",ぞ:"そ",
        だ:"た",ぢ:"ち",づ:"つ",で:"て",ど:"と",
        ば:"は",び:"ひ",ぶ:"ふ",べ:"へ",ぼ:"ほ",
        ぱ:"は",ぴ:"ひ",ぷ:"ふ",ぺ:"へ",ぽ:"ほ"
      };
      return String(str || "").replace(/[が-ござ-ぞだ-どば-ぽ]/g, (c) => map[c] || c);
    },

    /** 判断原文是否带有卡牌操作语境（用于门控 2 字中文同音模糊匹配，防日常闲聊误触发） */
    hasGameActionContext(rawText) {
      return /(出|放|派|上|下|备战|贴|能|打|攻|用|换|撤|拉|奶|回血|治疗|技能|招|前排|后排|战斗区|左|中|右|防御|ベンチ|エネ|攻撃|交代|回復|使う|出す|貼|付)/.test(String(rawText || ""));
    },

    fuzzyScore(inputNorm, aliasNorm) {
      if (!inputNorm || !aliasNorm) return 0;
      if (inputNorm.includes(aliasNorm)) return 1.0;
      const alen = aliasNorm.length;
      /* 日语 4 拍以上支持音拍归一化与清浊音宽容匹配 */
      const inJa = this.toJaPhonetic(inputNorm);
      const alJa = this.toJaPhonetic(aliasNorm);
      if (alJa.length >= 3 && inJa.includes(alJa)) return 0.96;
      if (alJa.length >= 4) {
        const inBase = this.stripJaVoicing(inJa);
        const alBase = this.stripJaVoicing(alJa);
        if (inBase.includes(alBase)) return 0.92;
      }
      /* 3字及以下短词字面仅允许精确包含（避免短词 1 字编辑距离撞车），同音词由 matchFromIndex 音素通道在语境下单独处理 */
      if (alen <= 3 || inputNorm.length < alen) return 0;
      if (inputNorm.length <= alen) {
        const d = this.levenshtein(inputNorm, aliasNorm);
        return Math.max(0, 1 - d / Math.max(inputNorm.length, alen));
      }
      let best = 0;
      const minW = Math.max(3, alen - 1);
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
      const makeZhPhonetics = (names) => {
        const res = [];
        const seen = new Set();
        for (const n of names) {
          const clean = String(n || "").replace(/[\s\-a-zA-Z0-9]/g, "");
          if (clean.length >= 2 && /^[\u4e00-\u9fff]+$/.test(clean)) {
            const ph = this.toZhPhonetic(clean);
            if (ph && !seen.has(ph)) {
              seen.add(ph);
              res.push({ ph, charLen: clean.length });
            }
          }
        }
        return res;
      };
      this.fuzzyIndex.monsters = this.monsters.map((m) => ({
        item: m,
        aliases: this.collectAliasesFor([m.name_ja, m.name_zh, ...(Array.isArray(m.aliases) ? m.aliases : [])]),
        zhPhonetics: makeZhPhonetics([m.name_zh, ...(Array.isArray(m.aliases) ? m.aliases : [])])
      }));
      this.fuzzyIndex.skills = [];
      for (const m of this.monsters) {
        for (const sk of m.skills) {
          this.fuzzyIndex.skills.push({
            item: { ...sk, ownerId: m.id, ownerSide: m.side, ownerNameJa: m.name_ja },
            aliases: this.collectAliasesFor([sk.name_ja, sk.name_zh, ...(Array.isArray(sk.aliases) ? sk.aliases : [])]),
            zhPhonetics: makeZhPhonetics([sk.name_zh, ...(Array.isArray(sk.aliases) ? sk.aliases : [])])
          });
        }
      }
      this.fuzzyIndex.items = this.items.map((it) => ({
        item: it,
        aliases: this.collectAliasesFor([it.name_ja, it.name_zh, ...(Array.isArray(it.aliases) ? it.aliases : [])]),
        zhPhonetics: makeZhPhonetics([it.name_zh, ...(Array.isArray(it.aliases) ? it.aliases : [])])
      }));
      this.buildTypoMatcher();
    },

    buildTypoMatcher() {
      const builtinFixes = [
        ["防御", ["防禦", "ぼうぎょ"]],
        ["攻撃", ["こうげき"]],
        ["交代", ["こうたい"]],
        ["撤退", ["てったい"]],
        ["回復", ["かいふく"]],
        ["ミズガメ", ["水亀"]],
        ["カエンリュウex", ["火龍ex"]],
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

    getActiveCardIdSet() {
      const set = new Set();
      const s = (typeof BattleEngine !== "undefined") ? BattleEngine.state : null;
      if (!s) return set;
      if (Array.isArray(s.player?.hand)) s.player.hand.forEach((id) => set.add(id));
      if (s.player?.active?.id) set.add(s.player.active.id);
      if (Array.isArray(s.player?.bench)) s.player.bench.forEach((u) => { if (u?.id) set.add(u.id); });
      if (s.enemy?.active?.id) set.add(s.enemy.active.id);
      if (Array.isArray(s.enemy?.bench)) s.enemy.bench.forEach((u) => { if (u?.id) set.add(u.id); });
      return set;
    },

    matchFromIndex(entries, rawText, minScore = 0.78, preferIds = null) {
      const fixed = this.applyLocalTypoFix(rawText);
      const norm = this.normalizeText(fixed);
      if (!norm) return null;
      const activeSet = preferIds || this.getActiveCardIdSet();
      const inZhPh = this.toZhPhonetic(fixed);
      const hasActionCtx = this.hasGameActionContext(fixed);
      let best = null;
      for (const entry of entries) {
        const itemId = entry.item?.id || entry.item?.ownerId || "";
        const inActive = Boolean(itemId && activeSet.has(itemId));
        for (const alias of entry.aliases) {
          const score = this.fuzzyScore(norm, alias);
          if (score < minScore) continue;
          const rankScore = score + (inActive ? 0.03 : 0);
          if (!best || rankScore > best.rankScore || (rankScore === best.rankScore && alias.length > best.aliasLen)) {
            best = { item: entry.item, score, rankScore, aliasLen: alias.length };
          }
        }
        /* 中文拼音音素通道：解决“蕾丝→雷狮”“严虎→炎狐”“上药→伤药”等平翘舌/同音误识别；2字短词要求场上/手牌存在或具动作语境 */
        if (inZhPh && Array.isArray(entry.zhPhonetics)) {
          const paddedIn = `|${inZhPh}|`;
          for (const zp of entry.zhPhonetics) {
            if (zp.charLen <= 2 && !inActive && !hasActionCtx) continue;
            if (paddedIn.includes(`|${zp.ph}|`)) {
              const score = zp.charLen >= 3 ? 0.94 : 0.91;
              const rankScore = score + (inActive ? 0.03 : 0);
              if (!best || rankScore > best.rankScore || (rankScore === best.rankScore && zp.charLen > best.aliasLen)) {
                best = { item: entry.item, score, rankScore, aliasLen: zp.charLen };
              }
            }
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

    /** 从同一句中按出现顺序提取所有提及的怪兽（兼容中文拼音音素 + 日语清浊音/长音归一，支持“把雷狮和水龟放到备战区”“ライシシとミズガメをベンチに出して”等复数指令） */
    matchAllMonsters(rawText, filterSide = null) {
      const fixed = this.applyLocalTypoFix(rawText);
      const norm = this.normalizeText(fixed);
      if (!norm) return [];
      const normJaPh = this.stripJaVoicing(this.toJaPhonetic(norm));
      const list = filterSide
        ? this.fuzzyIndex.monsters.filter((e) => e.item.side === filterSide)
        : this.fuzzyIndex.monsters;
      const activeSet = this.getActiveCardIdSet();
      const inZhPh = this.toZhPhonetic(fixed);
      const paddedZhPh = inZhPh ? `|${inZhPh}|` : "";
      const hasActionCtx = this.hasGameActionContext(fixed);
      const found = [];
      for (const entry of list) {
        const mon = entry.item;
        const inActive = Boolean(mon?.id && activeSet.has(mon.id));
        let bestPos = Infinity;
        let bestScore = 0;
        for (const alias of entry.aliases) {
          if (!alias) continue;
          const idx = norm.indexOf(alias);
          if (idx !== -1) {
            const sc = alias.length >= 3 ? 1.0 : 0.92;
            if (idx < bestPos || (idx === bestPos && sc > bestScore)) {
              bestPos = idx;
              bestScore = sc;
            }
          } else if (alias.length >= 3 && normJaPh) {
            const aJaPh = this.stripJaVoicing(this.toJaPhonetic(alias));
            if (aJaPh.length >= 3) {
              const jIdx = normJaPh.indexOf(aJaPh);
              if (jIdx !== -1) {
                const sc = 0.93;
                if (jIdx < bestPos || (jIdx === bestPos && sc > bestScore)) {
                  bestPos = jIdx;
                  bestScore = sc;
                }
              }
            }
          }
        }
        if (paddedZhPh && Array.isArray(entry.zhPhonetics)) {
          for (const zp of entry.zhPhonetics) {
            if (zp.charLen <= 2 && !inActive && !hasActionCtx) continue;
            const pIdx = paddedZhPh.indexOf(`|${zp.ph}|`);
            if (pIdx !== -1) {
              const sc = zp.charLen >= 3 ? 0.94 : 0.91;
              if (pIdx < bestPos || (pIdx === bestPos && sc > bestScore)) {
                bestPos = pIdx;
                bestScore = sc;
              }
            }
          }
        }
        if (bestScore >= 0.85) {
          found.push({ item: mon, pos: bestPos, score: bestScore });
        }
      }
      found.sort((a, b) => a.pos - b.pos || b.score - a.score);
      return found.map((f) => f.item);
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
    activeStreamCancels: [],
    audioCache: new Map(),
    inflightCache: new Map(),
    niaStreams: new Map(),
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

    /* 持续通话与监听状态（单流 VAD 全双工监听 + SenseTime Nia 流式 ASR + 浏览器 ASR 降级） */
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
    vadNiaSession: null,
    vadTimer: null,
    vadRecorder: null,
    vadSpeechStart: 0,
    vadLastLoud: 0,
    vadPeakRms: 0,
    vadContStreak: 0,
    recRunning: false,
    recStarting: false,
    recRetryDelay: 300,
    recRestartTimer: null,
    recWatchdogTimer: null,
    chromeUtterBuf: "",
    chromeUtterTimer: null,
    resumeCallAfterRecord: false,
    vadSimultaneousMode: false,
    vadLoudBargeStreak: 0,
    vadLastAsrText: "",
    vadLastAsrChangeAt: 0,
    vadGotFinal: false,

    /* 单次录音状态 */
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    chromeRec: null,
    singleNiaSession: null,
    singleNiaStop: null,

    /* 各 TTS 引擎可用音色目录（按界面语言自动联动，仅显示纯名称） */
    VOICE_CATALOG: {
      nia_tts_ja: [
        { value: "female_xiaowan", label: "小婉" },
        { value: "female_luna", label: "Luna" },
        { value: "female_meihe", label: "美和" },
        { value: "female_lora", label: "Lora" },
        { value: "female_shuying", label: "疏影" },
        { value: "male_zichen", label: "子宸" },
        { value: "male_haru", label: "Haru" },
        { value: "male_shantian", label: "山田" },
        { value: "male_youzhen", label: "悠真" }
      ],
      nia_tts_zh: [
        { value: "child_0001_a", label: "乐乐" },
        { value: "female_0003_a", label: "傲娇少女" },
        { value: "female_0006_a", label: "温柔御姐" },
        { value: "female_0018_b", label: "森系少女" },
        { value: "female_0027_a", label: "魅力姐姐" },
        { value: "female_0030_e", label: "贴心女人" },
        { value: "female_0036_a", label: "青春女声" },
        { value: "female_duoduo", label: "朵朵" },
        { value: "female_kexin", label: "可昕" },
        { value: "female_lingling", label: "玲玲" },
        { value: "female_lingxi", label: "灵汐" },
        { value: "female_luna", label: "luna" },
        { value: "female_mengmeng", label: "萌萌" },
        { value: "female_nuannuan", label: "暖暖" },
        { value: "female_qinghe", label: "青禾" },
        { value: "female_ruanruan", label: "软软" },
        { value: "female_ruoyan", label: "若颜" },
        { value: "female_ruyan", label: "如烟" },
        { value: "female_tangtang", label: "糖糖" },
        { value: "female_weiyang", label: "未央" },
        { value: "female_xiaocheng", label: "小程" },
        { value: "female_xiaohe", label: "小荷" },
        { value: "female_xiaoli", label: "小栗" },
        { value: "female_xiaolin", label: "小琳" },
        { value: "female_xiaomo", label: "小莫" },
        { value: "female_xiaotang", label: "小汤" },
        { value: "female_xiaotao", label: "小桃" },
        { value: "female_xiaoyou", label: "小柚" },
        { value: "female_xiaoyou_v5i", label: "小柚" },
        { value: "female_youyou", label: "悠悠" },
        { value: "female_zengtong", label: "曾彤" },
        { value: "female_zhinuann", label: "知暖" },
        { value: "female_zhirou", label: "知柔" },
        { value: "male_ahao", label: "阿豪" },
        { value: "male_chenlang", label: "晨朗" },
        { value: "male_cixingnansheng", label: "磁性男声" },
        { value: "male_hexiao", label: "何萧" },
        { value: "male_huaijin", label: "怀瑾" },
        { value: "male_jingheng", label: "景珩" },
        { value: "male_lingchuan", label: "凌川" },
        { value: "male_linzhou", label: "林舟" },
        { value: "male_mili", label: "弥狸" },
        { value: "male_nanfeng", label: "南风" },
        { value: "male_qingmu", label: "青木" },
        { value: "male_tianhe", label: "天何" },
        { value: "male_wanzhou", label: "晚舟" },
        { value: "male_xiaobei", label: "小北" },
        { value: "male_xiaoyang", label: "晓阳" },
        { value: "male_xingye", label: "星野" },
        { value: "male_xuanzhao", label: "玄昭" },
        { value: "male_yian", label: "亦安" },
        { value: "male_yunshen", label: "云深" },
        { value: "male_yunzheng", label: "云峥" }
      ],
      vertex_tts: [
        { value: "Kore", label: "Kore" },
        { value: "Fenrir", label: "Fenrir" },
        { value: "Zephyr", label: "Zephyr" },
        { value: "Leda", label: "Leda" },
        { value: "Aoede", label: "Aoede" },
        { value: "Puck", label: "Puck" },
        { value: "Charon", label: "Charon" }
      ]
    },

    /** 获取当前生效的 SenseTime Nia ASR 语种（默认自动识别中日双语 ""；仅手动锁定时强制单语） */
    getEffectiveNiaAsrLang() {
      const cfg = ConfigManager.data;
      if (cfg.niaAsrLangManual) return String(cfg.niaAsrLang || "");
      return getUiLang() === "zh" ? "zh" : "ja";
    },

    /** 获取当前生效的 Chrome ASR 语种 */
    getEffectiveChromeAsrLang() {
      const cfg = ConfigManager.data;
      if (cfg.niaAsrLangManual && cfg.asrLang) return cfg.asrLang;
      return getUiLang() === "zh" ? "zh-CN" : "ja-JP";
    },

    getAudioCtx() {
      if (!this.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        /* 使用系统原生采样率，避免 Firefox/Safari 将硬件麦克风接入自定义采样率 AudioContext 时报 NotSupportedError */
        this.audioCtx = new Ctx();
      }
      if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
      return this.audioCtx;
    },

    /** 仅清理尚未开播的积压队列（不打断当前正在播报或加载中的语音；可选择保留最新 1 条对手台词避免被新回合点击误杀） */
    clearQueuedOnly(keepHigh = true, keepLatestRival = false) {
      if (!Array.isArray(this.speakQueue) || this.speakQueue.length === 0) return;
      let lastRivalIdx = -1;
      if (keepLatestRival) {
        for (let i = this.speakQueue.length - 1; i >= 0; i--) {
          if (this.speakQueue[i].role === "rival") { lastRivalIdx = i; break; }
        }
      }
      const kept = [];
      for (let i = 0; i < this.speakQueue.length; i++) {
        const item = this.speakQueue[i];
        if ((keepHigh && item.priority === "high") || (keepLatestRival && i === lastRivalIdx)) {
          kept.push(item);
        } else {
          try { if (item.resolve) item.resolve(); } catch (_) {}
        }
      }
      this.speakQueue = kept;
      this.pendingSpeakCount = (this.isSpeaking ? 1 : 0) + this.speakQueue.length;
    },

    /** 立即关闭尚未完成或已脱离监听的 SenseTime Nia 流式 TTS WebSocket，避免并发堆积报错 */
    abortNiaTtsStreams(onlyUnattached = false) {
      for (const s of Array.from(this.niaStreams.values())) {
        if (!s || s.done) continue;
        if (onlyUnattached && s.listeners && s.listeners.size > 0) continue;
        try { if (typeof s.abort === "function") s.abort(); } catch (_) {}
      }
    },

    /** 立即中断所有正在播放或排队中的语音（仅用于玩家插话打断、重开对局、手动试听等强中断场景） */
    stopPlayback() {
      this.speakToken += 1;
      this._drainId = (this._drainId || 0) + 1;
      this.isSpeaking = false;
      this.isDrainingQueue = false;
      this.currentSpeakItem = null;
      this.abortNiaTtsStreams(false);
      while (this.speakQueue.length) {
        const item = this.speakQueue.shift();
        try { if (item && item.resolve) item.resolve(); } catch (_) {}
      }
      this.pendingSpeakCount = 0;
      this.speakLock = Promise.resolve();
      if (window.speechSynthesis) {
        try { speechSynthesis.cancel(); } catch (_) {}
      }
      while (this.activeStreamCancels.length) {
        const cancelFn = this.activeStreamCancels.pop();
        try { if (typeof cancelFn === "function") cancelFn(); } catch (_) {}
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
        this.updateCallButtonUI("listen");
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

    /** 切换语言时不停播丢弃，而是将当前正在播放与排队中的所有语音项无缝切换为新语言重新播报 */
    replayCurrentQueueInLang(newLang) {
      const targetLang = newLang === "zh" ? "zh" : "ja";
      const snapshot = [];
      if (this.isSpeaking && this.currentSpeakItem) {
        snapshot.push(this.currentSpeakItem);
      }
      if (Array.isArray(this.speakQueue) && this.speakQueue.length > 0) {
        for (const q of this.speakQueue) snapshot.push(q);
      }
      if (snapshot.length === 0) return false;

      /* 仅终止当前音频流与旧播放令牌，关闭不再需要的 Nia WS 连接，并保留原 Promise resolve 链以新语言重新入队 */
      this.speakToken += 1;
      this._drainId = (this._drainId || 0) + 1;
      this.isSpeaking = false;
      this.isDrainingQueue = false;
      this.currentSpeakItem = null;
      this.speakQueue = [];
      this.abortNiaTtsStreams(false);
      if (window.speechSynthesis) {
        try { speechSynthesis.cancel(); } catch (_) {}
      }
      while (this.activeStreamCancels.length) {
        const cancelFn = this.activeStreamCancels.pop();
        try { if (typeof cancelFn === "function") cancelFn(); } catch (_) {}
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

      const newToken = this.speakToken;
      for (let i = 0; i < snapshot.length; i++) {
        const old = snapshot[i];
        old._replaying = true;
        const rawForLang = targetLang === "zh"
          ? (old.zhText || old.jaText || old.spokenText || "")
          : (old.jaText || old.zhText || old.spokenText || "");
        const spokenText = this.extractSpokenText(rawForLang, targetLang);
        if (!spokenText) {
          try { if (old.resolve) old.resolve(); } catch (_) {}
          continue;
        }
        if (i === 0) {
          this.prefetch(spokenText, old.role, targetLang);
        } else if (i === 1) {
          const r = old.role;
          const st = spokenText;
          setTimeout(() => {
            if (this.speakToken === newToken) this.prefetch(st, r, targetLang);
          }, 320 * i);
        }
        this.speakQueue.push({
          spokenText,
          jaText: old.jaText || "",
          zhText: old.zhText || "",
          role: old.role,
          lang: targetLang,
          priority: old.priority || "normal",
          token: newToken,
          resolve: old.resolve
        });
      }
      this.pendingSpeakCount = this.speakQueue.length;
      if (this.speakQueue.length > 0 && !this.isDrainingQueue) {
        this.drainSpeakQueue();
      }
      return true;
    },

    stopAll() {
      this.stopPlayback();
      if (this.singleNiaSession) {
        try { this.singleNiaSession.abort(); } catch (_) {}
        this.singleNiaSession = null;
      }
      if (this.singleNiaStop) {
        const fn = this.singleNiaStop;
        this.singleNiaStop = null;
        try { fn(true); } catch (_) {}
      }
      if (this.isRecording) {
        this.isRecording = false;
        const btn = $("btnRecordVoice");
        if (btn) {
          btn.classList.remove("recording");
          btn.innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
        }
      }
      if (this.callActive) this.stopCall(true);
    },

    setVoiceStatus(msg, zhHint = "") {
      const el = $("voiceEngineStatus");
      if (!el) return;
      el.textContent = getUiLang() === "zh" ? (zhHint || msg || "") : (msg || "");
    },

    setCallBadge(text, isLive = false) {
      const el = $("callStateBadge");
      if (!el) return;
      el.innerHTML = formatBilingualLabelHtml(text);
      el.classList.toggle("live", isLive);
    },

    getVoiceOptionsForEngine(engine, lang = getUiLang()) {
      if (engine === "nia_tts") {
        return lang === "zh" ? this.VOICE_CATALOG.nia_tts_zh : this.VOICE_CATALOG.nia_tts_ja;
      }
      if (engine === "vertex_tts") return this.VOICE_CATALOG.vertex_tts;
      const re = lang === "zh" ? /^zh/i : /^ja/i;
      const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : [])
        .filter((v) => re.test(v.lang));
      return [
        { value: "", label: lang === "zh" ? `自动选择中文发音人（共 ${voices.length} 个）` : `自動選択（日本語 ${voices.length}種）` },
        ...voices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` }))
      ];
    },

    populateChromeVoices() {
      if ($("ttsEngine")?.value === "chrome_tts" && typeof populateVoiceSelectsForEngine === "function") {
        populateVoiceSelectsForEngine("chrome_tts");
      }
    },

    /** 按当前语言提取并规范化待朗读台词（日语模式提取日语，中文模式保留中文并规范化数值读法） */
    extractSpokenText(text, lang = getUiLang()) {
      let s = String(text || "").trim();
      if (!s) return "";
      s = s.split(/\s*[｜|]\s*|\s+／\s+|\s+\/\s+/)[0].trim();
      if (lang === "zh") {
        s = s
          .replace(/HP\s*(\d+)\s*\/\s*(\d+)/gi, "血量$1，最大$2")
          .replace(/HP\s*(\d+)/gi, "血量$1")
          .replace(/(?:攻击伤害|伤害)\s*[+＋]\s*(\d+)/g, "攻击伤害增加$1点")
          .replace(/弱点\s*[+＋]\s*(\d+)/g, "触发弱点追加$1点伤害")
          .replace(/(?:受击|被击|伤害)\s*[-−ー]\s*(\d+)/g, "受击伤害减少$1点")
          .replace(/[+＋]\s*(\d+)/g, "加$1")
          .replace(/[-−]\s*(\d+)/g, "减$1")
          .replace(/\s+/g, " ")
          .trim();
        return s;
      }
      s = s.replace(/[（(]([^（）()]+)[）)]/g, (full, inner) => {
        if (/[\u3040-\u30ff0-9０-９\-+＋]/.test(inner)) return full;
        return "";
      });
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

    extractJapaneseOnly(text) {
      return this.extractSpokenText(text, "ja");
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

    speakChrome(text, role = "referee", token = this.speakToken, lang = getUiLang()) {
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
          u.lang = lang === "zh" ? "zh-CN" : "ja-JP";
          u.rate = role === "rival" ? 1.07 : 1.08;
          u.pitch = role === "rival" ? 0.88 : 1.06;
          const re = lang === "zh" ? /^zh/i : /^ja/i;
          const voices = speechSynthesis.getVoices().filter((v) => re.test(v.lang));
          const wantedUri = role === "rival"
            ? (ConfigManager.data.chromeVoiceRivalURI || ConfigManager.data.chromeVoiceURI)
            : ConfigManager.data.chromeVoiceURI;
          if (wantedUri) {
            const chosen = voices.find((v) => v.voiceURI === wantedUri);
            if (chosen) u.voice = chosen;
            else if (voices.length) u.voice = voices[0];
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

    /** 请求并解码 Vertex TTS 音频（带内存 LRU 缓存、并发去重与超时保护，支持日/中双语） */
    async fetchTtsAudioBuffer(text, role = "referee", lang = getUiLang()) {
      const cfg = ConfigManager.data;
      const voiceName = role === "rival" ? cfg.voiceRival : cfg.voiceReferee;
      const model = (cfg.ttsModel || "gemini-3.8-flash-lite-tts").trim();
      const langTag = lang === "zh" ? "Chinese" : "Japanese";
      const cacheKey = `${model}|${langTag}|${voiceName}|${text}`;
      if (this.audioCache.has(cacheKey)) return this.audioCache.get(cacheKey);
      if (this.inflightCache.has(cacheKey)) return await this.inflightCache.get(cacheKey);

      const url = ConfigManager.buildRestUrl(model);
      if (!url) throw new Error("APIキー未設定");

      const payload = {
        contents: [{
          role: "user",
          parts: [{
            text,
            speechMetadata: { style: role === "rival" ? `energetic anime rival, ${langTag}` : `crisp, clear, brisk game referee announcer, natural pitch, ${langTag}` }
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

    /** 创建或复用一条 SenseTime Nia WebSocket 流式 TTS 会话（日语传 JAPANESE + 日语音色，中文传 ZH_CN + 中文音色） */
    ensureNiaTtsStream(text, role = "referee", lang = getUiLang()) {
      const cfg = ConfigManager.data;
      const isZh = lang === "zh";
      const niaLang = isZh ? "ZH_CN" : "JAPANESE";
      const voiceId = isZh
        ? (role === "rival" ? (cfg.niaVoiceRivalZh || "male_xingye") : (cfg.niaVoiceRefereeZh || "female_luna"))
        : (role === "rival" ? (cfg.niaVoiceRival || "male_zichen") : (cfg.niaVoiceReferee || "female_xiaowan"));
      const cacheKey = `nia|${niaLang}|${voiceId}|${text}`;
      if (this.audioCache.has(cacheKey)) {
        return { cachedBuffer: this.audioCache.get(cacheKey), cacheKey, voiceId, niaLang };
      }
      if (this.niaStreams.has(cacheKey)) {
        return this.niaStreams.get(cacheKey);
      }
      if (!ConfigManager.hasNiaCredentials()) {
        throw new Error("Nia AK/SK 未設定");
      }

      if (this.niaStreams.size >= 2) {
        this.abortNiaTtsStreams(true);
      }

      const stream = {
        cacheKey,
        voiceId,
        niaLang,
        chunks: [],
        totalBytes: 0,
        done: false,
        aborted: false,
        error: null,
        buffer: null,
        listeners: new Set(),
        ws: null,
        abort: null,
        t0: Date.now(),
        tFirstAudio: 0,
        promise: null
      };
      this.niaStreams.set(cacheKey, stream);

      const notify = (type, payload) => {
        for (const fn of Array.from(stream.listeners)) {
          try { fn(type, payload); } catch (_) {}
        }
      };

      stream.promise = (async () => {
        let idleTimer = null;
        let maxTimer = null;
        let settled = false;
        let wsResolve = null;
        const clearTimers = () => {
          if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
          if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
        };

        stream.abort = () => {
          if (stream.aborted || stream.done) return;
          stream.aborted = true;
          stream.done = true;
          this.niaStreams.delete(cacheKey);
          clearTimers();
          try { if (stream.ws && stream.ws.readyState < 2) stream.ws.close(); } catch (_) {}
          notify("aborted", null);
          if (!settled) {
            settled = true;
            if (wsResolve) wsResolve();
          }
        };

        try {
          const jwt = await ConfigManager.generateNiaJwt();
          if (stream.aborted) return null;
          const url = `wss://nia.sensetime.com/biz/tts/ws?jwt=${encodeURIComponent(jwt)}`;
          await new Promise((resolve, reject) => {
            wsResolve = resolve;
            const fail = (err) => {
              if (settled || stream.aborted) return;
              settled = true;
              clearTimers();
              try { if (stream.ws && stream.ws.readyState < 2) stream.ws.close(); } catch (_) {}
              reject(err);
            };
            const finishOk = () => {
              if (settled || stream.aborted) return;
              settled = true;
              clearTimers();
              try { if (stream.ws && stream.ws.readyState < 2) stream.ws.close(); } catch (_) {}
              if (stream.totalBytes < 4) return reject(new Error("Nia TTS empty audio"));
              resolve();
            };
            const armIdleTimer = (ms = 12000) => {
              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => fail(new Error("Nia TTS timeout")), ms);
            };
            armIdleTimer(12000);
            maxTimer = setTimeout(() => {
              if (stream.totalBytes > 100) finishOk();
              else fail(new Error("Nia TTS timeout"));
            }, 25000);

            let ws = null;
            try {
              ws = new WebSocket(url);
            } catch (e) {
              return fail(e);
            }
            if (stream.aborted) {
              try { if (ws.readyState < 2) ws.close(); } catch (_) {}
              if (!settled) { settled = true; clearTimers(); resolve(); }
              return;
            }
            stream.ws = ws;
            ws.binaryType = "arraybuffer";
            ws.onopen = () => {
              if (stream.aborted) {
                try { if (ws.readyState < 2) ws.close(); } catch (_) {}
                return;
              }
              try {
                /* 按角色注入差异化韵律参数：裁判清脆利落，对手「莲」更有热血挑衅张力 */
                const personaProsody = role === "rival"
                  ? { speed: 1.12, volume: 2, pitch: -2 }
                  : { speed: 1.06, volume: 0, pitch: 1 };
                ws.send(JSON.stringify({
                  type: "start",
                  config: {
                    voice_id: voiceId,
                    language: niaLang,
                    speed: personaProsody.speed,
                    volume: personaProsody.volume,
                    pitch: personaProsody.pitch,
                    format: "pcm",
                    sample_rate: 24000,
                    stream_output: true,
                    text_type: "PLAIN",
                    output_subtitles: false,
                    disable_tn: false
                  }
                }));
              } catch (e) {
                fail(e);
              }
            };
            ws.onmessage = (ev) => {
              if (stream.aborted) return;
              if (ev.data instanceof ArrayBuffer) {
                const u8 = new Uint8Array(ev.data);
                if (u8.byteLength > 0) {
                  if (!stream.tFirstAudio) stream.tFirstAudio = Date.now() - stream.t0;
                  armIdleTimer(10000);
                  stream.chunks.push(u8);
                  stream.totalBytes += u8.byteLength;
                  notify("chunk", u8);
                }
                return;
              }
              if (typeof ev.data === "string") {
                let msg = null;
                try { msg = JSON.parse(ev.data); } catch (_) { return; }
                if (msg.type === "started") {
                  try {
                    ws.send(JSON.stringify({ type: "text", text, is_last: true }));
                    ws.send(JSON.stringify({ type: "finish" }));
                  } catch (e) {
                    fail(e);
                  }
                } else if (msg.type === "finished") {
                  finishOk();
                } else if (msg.type === "error") {
                  const err = new Error(msg.message || msg.code || "Nia TTS error");
                  err.code = msg.code || "";
                  if (/401|403|AUTH|TOKEN|UNAUTH|FORBID/i.test(String(msg.code || msg.message || ""))) {
                    err.status = 401;
                  }
                  fail(err);
                }
              }
            };
            ws.onerror = () => { if (!stream.aborted) fail(new Error("Nia TTS WebSocket error")); };
            ws.onclose = (ev) => {
              if (!settled && !stream.aborted) {
                if (stream.totalBytes > 100 && ev.code === 1000) finishOk();
                else fail(new Error(`Nia TTS closed (${ev.code})`));
              }
            };
          });

          if (stream.aborted) return null;

          const merged = new Uint8Array(stream.totalBytes);
          let off = 0;
          for (const c of stream.chunks) { merged.set(c, off); off += c.length; }
          const ctx = this.getAudioCtx();
          const sampleCount = Math.floor(merged.byteLength / 2);
          const dv = new DataView(merged.buffer, merged.byteOffset, sampleCount * 2);
          const float32 = new Float32Array(sampleCount);
          for (let i = 0; i < sampleCount; i++) float32[i] = dv.getInt16(i * 2, true) / 32768;
          const buf = ctx.createBuffer(1, sampleCount, 24000);
          buf.copyToChannel(float32, 0);
          if (this.audioCache.size >= 80) {
            const firstKey = this.audioCache.keys().next().value;
            this.audioCache.delete(firstKey);
          }
          this.audioCache.set(cacheKey, buf);
          stream.buffer = buf;
          stream.done = true;
          this.niaStreams.delete(cacheKey);
          notify("done", buf);
          return buf;
        } catch (err) {
          stream.error = err;
          stream.done = true;
          this.niaStreams.delete(cacheKey);
          notify("error", err);
          throw err;
        }
      })();
      stream.promise.catch(() => {});
      return stream;
    },

    /** 获取完整 SenseTime Nia 24kHz PCM AudioBuffer（复用流式会话与 LRU 缓存） */
    async fetchNiaTtsAudioBuffer(text, role = "referee", lang = getUiLang()) {
      const s = this.ensureNiaTtsStream(text, role, lang);
      if (s.cachedBuffer) return s.cachedBuffer;
      return await s.promise;
    },

    /** 后台预取下一句语音，消除裁判与对手台词之间的网络停顿 */
    prefetch(text, role = "rival", lang = getUiLang()) {
      const cfg = ConfigManager.data;
      const spoken = this.extractSpokenText(text, lang);
      if (!cfg.autoSpeak || !spoken || this.apiTtsBlocked || cfg.ttsEngine === "chrome_tts") return;
      if (cfg.ttsEngine === "nia_tts") {
        if (!ConfigManager.hasNiaCredentials() || this.niaStreams.size >= 2) return;
        try { this.ensureNiaTtsStream(spoken, role, lang); } catch (_) {}
        return;
      }
      if (!String(cfg.apiKey || "").trim()) return;
      this.fetchTtsAudioBuffer(spoken, role, lang).catch(() => {});
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

    /** 获取统一主音量 GainNode（用于 critical 高优打断时 120ms 平滑淡出，杜绝硬切爆音与突兀截断） */
    getVoiceGainNode(ctx, outNode) {
      const target = outNode || ctx.destination;
      if (!this.masterGain || this._masterGainCtx !== ctx) {
        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(1, ctx.currentTime);
        this.masterGain.connect(target);
        this._masterGainCtx = ctx;
        this._masterGainTarget = target;
      } else if (this._masterGainTarget !== target) {
        try { this.masterGain.disconnect(); } catch (_) {}
        this.masterGain.connect(target);
        this._masterGainTarget = target;
      }
      return this.masterGain;
    },

    /** 平滑淡出后终止当前播放（独立旧 GainNode 淡出 + 新语音立得满音量通道，杜绝新旧语音增益竞争） */
    fadeOutAndStopPlayback(fadeMs = 120) {
      if (!this.isSpeaking && this.activeSources.length === 0) {
        this.stopPlayback();
        return;
      }
      const ctx = this.audioCtx;
      const oldGain = this.masterGain;
      if (ctx && oldGain && ctx.state === "running" && this.activeSources.length > 0) {
        /* 立即剥离旧 GainNode 专供淡出，后续新语音自动创建满音量新 GainNode，零竞态 */
        this.masterGain = null;
        this._masterGainTarget = null;
        try {
          const now = ctx.currentTime;
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(Math.max(0.05, oldGain.gain.value || 1), now);
          oldGain.gain.linearRampToValueAtTime(0.001, now + fadeMs / 1000);
        } catch (_) {}
        const sourcesToStop = this.activeSources.slice();
        const cancelsToRun = this.activeStreamCancels.slice();
        const oldStreamsToAbort = Array.from(this.niaStreams.values());
        this.activeSources = [];
        this.activeStreamCancels = [];
        this.speakToken += 1;
        this._drainId = (this._drainId || 0) + 1;
        this.isSpeaking = false;
        this.isDrainingQueue = false;
        this.currentSpeakItem = null;
        oldStreamsToAbort.forEach((s) => {
          if (s && !s.done && s.listeners && s.listeners.size === 0 && typeof s.abort === "function") {
            try { s.abort(); } catch (_) {}
          }
        });
        while (this.speakQueue.length) {
          const item = this.speakQueue.shift();
          try { if (item && item.resolve) item.resolve(); } catch (_) {}
        }
        this.pendingSpeakCount = 0;
        if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (_) {} }
        setTimeout(() => {
          for (const cancelFn of cancelsToRun) { try { if (typeof cancelFn === "function") cancelFn(); } catch (_) {} }
          for (const s of oldStreamsToAbort) { try { if (s && !s.done && typeof s.abort === "function") s.abort(); } catch (_) {} }
          for (const entry of sourcesToStop) {
            try { if (entry && entry.src) { entry.src.onended = null; entry.src.stop(); } } catch (_) {}
            try { if (entry && entry.resolve) entry.resolve(); } catch (_) {}
          }
          try { oldGain.disconnect(); } catch (_) {}
        }, fadeMs);
        return;
      }
      this.stopPlayback();
    },

    /** 统一通过 WebAudio + GainNode + AEC3 回声参考通道播放 AudioBuffer */
    async playAudioBuffer(buf, token = this.speakToken) {
      const ctx = this.getAudioCtx();
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch (_) {} }
      if (token !== this.speakToken) return;
      const outNode = await this.ensureAecOutput();
      if (token !== this.speakToken) return;
      if (this.aecAudioEl && this.aecAudioEl.paused) { try { this.aecAudioEl.play().catch(() => {}); } catch (_) {} }
      const gainNode = this.getVoiceGainNode(ctx, outNode);
      try { gainNode.gain.setValueAtTime(1, ctx.currentTime); } catch (_) {}
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
        src.connect(gainNode);
        this.activeSources.push(entry);
        src.onended = finish;
        src.start();
      });
    },

    /** 通过 SenseTime Nia 流式 TTS 边下边播纯日语音频（首包即开播 + 预取无缝衔接 + AEC3 回声参考通道） */
    async speakNiaTts(text, role = "referee", token = this.speakToken, lang = getUiLang()) {
      const t0 = Date.now();
      const s = this.ensureNiaTtsStream(text, role, lang);
      const voiceId = s.voiceId;
      if (s.cachedBuffer) {
        if (token !== this.speakToken) return;
        DebugLog.add("TTS", `SenseTime Nia TTS (${role}/${voiceId}, 缓存命中)`, text);
        await this.playAudioBuffer(s.cachedBuffer, token);
        return;
      }

      const ctx = this.getAudioCtx();
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch (_) {} }
      if (token !== this.speakToken) return;
      const outNode = await this.ensureAecOutput();
      if (token !== this.speakToken) return;
      if (s.done && s.buffer && !s.error) {
        DebugLog.add("TTS", `SenseTime Nia TTS (${role}/${voiceId}, 预取命中)`, text);
        await this.playAudioBuffer(s.buffer, token);
        return;
      }
      if (this.aecAudioEl && this.aecAudioEl.paused) { try { this.aecAudioEl.play().catch(() => {}); } catch (_) {} }

      await new Promise((resolve, reject) => {
        let settled = false;
        let carryByte = null;
        let nextPlayTime = 0;
        let startedPlayback = false;
        let scheduledCount = 0;
        let endedCount = 0;
        let streamDone = false;
        let loggedFirst = false;
        let guardTimer = null;
        const localEntries = [];

        const cleanup = () => {
          if (guardTimer) { clearTimeout(guardTimer); guardTimer = null; }
          s.listeners.delete(onStreamEvent);
          const cIdx = this.activeStreamCancels.indexOf(cancelPlayback);
          if (cIdx !== -1) this.activeStreamCancels.splice(cIdx, 1);
        };

        const finishOk = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        const finishErr = (err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        };

        const cancelPlayback = () => {
          if (settled) return;
          for (const entry of localEntries) {
            try {
              if (entry && entry.src) {
                entry.src.onended = null;
                entry.src.stop();
              }
            } catch (_) {}
            const aIdx = this.activeSources.indexOf(entry);
            if (aIdx !== -1) this.activeSources.splice(aIdx, 1);
          }
          localEntries.length = 0;
          finishOk();
          if (s.listeners.size === 0 && !s.done && typeof s.abort === "function") {
            s.abort();
          }
        };

        const rearmGuard = () => {
          if (guardTimer) clearTimeout(guardTimer);
          const remainMs = startedPlayback ? Math.max(0, Math.ceil((nextPlayTime - ctx.currentTime) * 1000)) : 12000;
          guardTimer = setTimeout(() => {
            if (scheduledCount > 0) finishOk();
            else finishErr(new Error("Nia TTS stream playback timeout"));
          }, Math.max(4500, remainMs + 3000));
        };

        /* 按语种深度防抖缓冲：日语流式模型包间抖动显著大于中文，首播攒够 600ms (28800B)/批处理 300ms (14400B) 且欠载恢复补足 220ms 安全垫，彻底消除连环卡顿 */
        const INITIAL_PREBUF_BYTES = lang === "ja" ? 28800 : 8640;
        const BATCH_FLUSH_BYTES = lang === "ja" ? 14400 : 5760;
        const LEAD_IN_SEC = lang === "ja" ? 0.18 : 0.12;
        const UNDERRUN_PAD_SEC = lang === "ja" ? 0.22 : 0.08;
        let pendingChunks = [];
        let pendingBytesLen = 0;

        const checkAllFinished = () => {
          if (settled) return;
          if (token !== this.speakToken) { cancelPlayback(); return; }
          if (streamDone && pendingBytesLen === 0 && endedCount >= scheduledCount) {
            finishOk();
          }
        };

        const flushPcmBatch = (force = false) => {
          if (settled || token !== this.speakToken || pendingBytesLen === 0) return;
          const threshold = startedPlayback ? BATCH_FLUSH_BYTES : INITIAL_PREBUF_BYTES;
          if (!force && pendingBytesLen < threshold) return;

          const total = pendingBytesLen + (carryByte !== null ? 1 : 0);
          const merged = new Uint8Array(total);
          let off = 0;
          if (carryByte !== null) {
            merged[off++] = carryByte;
            carryByte = null;
          }
          for (const c of pendingChunks) {
            merged.set(c, off);
            off += c.byteLength;
          }
          pendingChunks = [];
          pendingBytesLen = 0;

          let bytes = merged;
          if (bytes.byteLength % 2 === 1) {
            carryByte = bytes[bytes.byteLength - 1];
            bytes = bytes.subarray(0, bytes.byteLength - 1);
          }
          const sampleCount = bytes.byteLength >> 1;
          if (sampleCount <= 0) return;

          const dv = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
          const float32 = new Float32Array(sampleCount);
          for (let i = 0; i < sampleCount; i++) float32[i] = dv.getInt16(i * 2, true) / 32768;

          const now = ctx.currentTime;
          let didUnderrun = false;
          if (!startedPlayback) {
            startedPlayback = true;
            nextPlayTime = now + LEAD_IN_SEC;
            if (!loggedFirst) {
              loggedFirst = true;
              const ttfa = Date.now() - t0;
              DebugLog.add("TTS", `SenseTime Nia 流式 TTS (${role}/${voiceId}, 首声 ${ttfa}ms)`, text);
            }
          } else if (nextPlayTime < now + 0.025) {
            nextPlayTime = now + UNDERRUN_PAD_SEC;
            didUnderrun = true;
          }

          /* 首包或欠载重同步时加 5ms 平滑淡入，尾端加 2ms 微淡出防止切片爆音 */
          if (didUnderrun || scheduledCount === 0) {
            const fade = Math.min(120, sampleCount);
            for (let i = 0; i < fade; i++) float32[i] *= i / fade;
          }
          if (force && sampleCount > 64) {
            const tail = Math.min(48, sampleCount);
            for (let i = 0; i < tail; i++) float32[sampleCount - 1 - i] *= i / tail;
          }

          const buf = ctx.createBuffer(1, sampleCount, 24000);
          buf.copyToChannel(float32, 0);

          const gainNode = this.getVoiceGainNode(ctx, outNode);
          try { gainNode.gain.setValueAtTime(1, ctx.currentTime); } catch (_) {}
          const src = ctx.createBufferSource();
          const entry = { src, resolve: null };
          src.buffer = buf;
          src.connect(gainNode);
          this.activeSources.push(entry);
          localEntries.push(entry);
          scheduledCount += 1;
          src.onended = () => {
            const aIdx = this.activeSources.indexOf(entry);
            if (aIdx !== -1) this.activeSources.splice(aIdx, 1);
            endedCount += 1;
            checkAllFinished();
          };
          src.start(nextPlayTime);
          nextPlayTime += buf.duration;
          rearmGuard();
        };

        const enqueuePcmChunk = (u8) => {
          if (settled || token !== this.speakToken || !u8 || u8.byteLength === 0) return;
          pendingChunks.push(u8);
          pendingBytesLen += u8.byteLength;
          flushPcmBatch(false);
        };

        const onStreamEvent = (type, payload) => {
          if (settled) return;
          if (token !== this.speakToken) { cancelPlayback(); return; }
          if (type === "aborted") {
            finishOk();
            return;
          }
          if (type === "chunk") {
            enqueuePcmChunk(payload);
          } else if (type === "done") {
            streamDone = true;
            flushPcmBatch(true);
            if (scheduledCount === 0) {
              if (payload && payload.duration > 0) {
                finishOk();
              } else {
                finishErr(new Error("Nia TTS empty stream"));
              }
            } else {
              rearmGuard();
              checkAllFinished();
            }
          } else if (type === "error") {
            streamDone = true;
            flushPcmBatch(true);
            if (scheduledCount > 0) {
              rearmGuard();
              checkAllFinished();
            } else {
              finishErr(payload || new Error("Nia TTS stream error"));
            }
          }
        };

        this.activeStreamCancels.push(cancelPlayback);
        rearmGuard();

        /* 合并调度后台预取阶段已到达的 PCM 分片（平滑衔接零卡顿） */
        const existingChunks = s.chunks.slice();
        for (const c of existingChunks) enqueuePcmChunk(c);

        if (s.done) {
          streamDone = true;
          flushPcmBatch(true);
          if (s.error && scheduledCount === 0) {
            finishErr(s.error);
          } else {
            checkAllFinished();
          }
        } else {
          s.listeners.add(onStreamEvent);
        }
      });
    },

    /** 通过 Vertex Gemini TTS 播放音频（按界面语言播报日语或中文，走 AEC3 回声参考通道） */
    async speakVertexTts(text, role = "referee", token = this.speakToken, lang = getUiLang()) {
      const t0 = Date.now();
      const cfg = ConfigManager.data;
      const langTag = lang === "zh" ? "Chinese" : "Japanese";
      const cacheKey = `${(cfg.ttsModel || "gemini-3.8-flash-lite-tts").trim()}|${langTag}|${role === "rival" ? cfg.voiceRival : cfg.voiceReferee}|${text}`;
      const cached = this.audioCache.has(cacheKey);
      const buf = await this.fetchTtsAudioBuffer(text, role, lang);
      if (token !== this.speakToken) return;
      DebugLog.add("TTS", `Vertex TTS (${role}/${langTag}, ${cached ? "缓存命中" : `${Date.now() - t0}ms`})`, text);
      await this.playAudioBuffer(buf, token);
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
      if (typeof BattleEngine !== "undefined" && BattleEngine.state?.phase === "setup"
        && BattleEngine.resolveStarterHandIndex(transcript) !== -1) {
        return false;
      }
      const tNorm = SpecEngine.normalizeText(transcript);
      if (tNorm.length < 4) return false;
      const isShortPlayerCmd = tNorm.length < 10 && (
        NLUEngine.hasExplicitDefendIntent(transcript)
        || NLUEngine.hasExplicitAttackIntent(transcript)
        || Boolean(SpecEngine.matchMonster(transcript, "player"))
        || Boolean(SpecEngine.matchSkill(transcript))
        || Boolean(SpecEngine.matchItem(transcript))
        || Boolean(NLUEngine.resolveEnergyCardFromText(transcript))
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
    /** 4 级语音优先级：critical(胜负终局120ms淡出强占) > high(击倒/追问/首句，子句边界优雅让位) > normal(常规行动) > low(引导/回合提示) */
    PRIORITY_RANK: { low: 0, normal: 1, high: 2, critical: 3 },
    pendingSpeakCount: 0,
    currentSpeakItem: null,

    /** 将过长单句（>34字）按自然标点拆分为语义子句节点，既避免常规短句多次建连造成停顿，又允许高优语音在自然标点处优雅接管 */
    splitIntoClauses(text, lang = getUiLang()) {
      const s = String(text || "").trim();
      if (!s || s.length <= 34) return s ? [s] : [];
      const rawParts = s.match(/[^。！？!?；;，,、]+[。！？!?；;，,、]*/g) || [s];
      const merged = [];
      for (const part of rawParts) {
        const p = part.trim();
        if (!p) continue;
        if (merged.length > 0 && (p.length < 7 || merged[merged.length - 1].length < 8)) {
          merged[merged.length - 1] += p;
        } else {
          merged.push(p);
        }
      }
      return merged.length > 0 ? merged : [s];
    },

    speak(textOrPair, role = "referee", opts = {}) {
      const cfg = ConfigManager.data;
      const lang = opts.lang || getUiLang();
      const isPair = Boolean(textOrPair && typeof textOrPair === "object");
      const jaText = isPair ? String(textOrPair.ja || "") : String(opts.ja || (lang === "ja" ? textOrPair || "" : ""));
      const zhText = isPair ? String(textOrPair.zh || "") : String(opts.zh || (lang === "zh" ? textOrPair || "" : ""));
      const rawText = isPair
        ? (lang === "zh" ? (zhText || jaText) : (jaText || zhText))
        : String(textOrPair || "");
      const spokenText = this.extractSpokenText(rawText, lang);
      if (!cfg.autoSpeak || !spokenText) return Promise.resolve();

      const priority = opts.priority || "normal"; // "critical" | "high" | "normal" | "low"
      const interruptible = Boolean(opts.interruptible || priority === "low");
      const rank = this.PRIORITY_RANK[priority] ?? 1;
      if (typeof BattleEngine !== "undefined" && BattleEngine.clearIdleTimer) {
        BattleEngine.clearIdleTimer();
      }

      /* Tier 3 (critical)：胜负结算/认输，120ms 平滑淡出当前语音后立即接管，不硬切不爆音 */
      if (priority === "critical") {
        this.fadeOutAndStopPlayback(120);
      } else if (priority === "low") {
        if (this.isSpeaking || this.speakQueue.length > 0) {
          return Promise.resolve();
        }
      } else {
        /* 若当前正在播报最低优可打断追问/催促，更高优播报立即 90ms 淡出抢占；否则在子句边界让位 */
        if (this.isSpeaking && this.currentSpeakItem) {
          const curRank = this.PRIORITY_RANK[this.currentSpeakItem.priority] ?? 1;
          if (this.currentSpeakItem.interruptible && rank > curRank) {
            this.fadeOutAndStopPlayback(90);
          } else if (rank > curRank) {
            this.currentSpeakItem.preemptAfterClause = true;
          }
        }
        for (let i = this.speakQueue.length - 1; i >= 0; i--) {
          const qRank = this.PRIORITY_RANK[this.speakQueue[i].priority] ?? 1;
          if (qRank < rank || (priority === "normal" && this.speakQueue[i].role === role && qRank <= rank)) {
            const dropped = this.speakQueue.splice(i, 1)[0];
            try { if (dropped && dropped.resolve) dropped.resolve(); } catch (_) {}
          }
        }
        const maxBeforePush = priority === "high" ? 3 : 2;
        while (this.speakQueue.length >= maxBeforePush) {
          let dropIdx = this.speakQueue.findIndex((it) => (this.PRIORITY_RANK[it.priority] ?? 1) < 2 && it.role !== "rival");
          if (dropIdx === -1) dropIdx = this.speakQueue.findIndex((it) => (this.PRIORITY_RANK[it.priority] ?? 1) < 2);
          if (dropIdx === -1) {
            if (priority === "high") dropIdx = 0;
            else break;
          }
          const dropped = this.speakQueue.splice(dropIdx, 1)[0];
          try { if (dropped && dropped.resolve) dropped.resolve(); } catch (_) {}
        }
      }

      const clauses = this.splitIntoClauses(spokenText, lang);
      if (!opts.deferPrefetch && clauses[0]) this.prefetch(clauses[0], role, lang);

      const myToken = this.speakToken;
      return new Promise((resolve) => {
        this.speakQueue.push({ spokenText, jaText, zhText, role, lang, priority, interruptible, preemptAfterClause: false, token: myToken, resolve });
        this.pendingSpeakCount = (this.isSpeaking ? 1 : 0) + this.speakQueue.length;
        if (!this.isDrainingQueue) {
          this.drainSpeakQueue();
        }
      });
    },

    async _speakSingleChunk(chunkText, role, myToken, lang) {
      const cfg = ConfigManager.data;
      const hasKey = String(cfg.apiKey || "").trim().length > 0;
      const hasNia = ConfigManager.hasNiaCredentials();
      if (cfg.ttsEngine === "chrome_tts") {
        this.setVoiceStatus("現在：Chrome標準音声", "当前：浏览器内置语音朗读");
        DebugLog.add("TTS", `Chrome TTS (${role}/${lang})`, chunkText);
        await this.speakChrome(chunkText, role, myToken, lang);
      } else if (cfg.ttsEngine === "nia_tts") {
        if (!hasNia || this.apiTtsBlocked) {
          const reason = !hasNia ? "Nia AK/SK 未設定" : this.apiTtsBlockReason;
          this.setVoiceStatus(`現在：Chrome標準音声（SenseTime Nia ${reason}）`, `当前：浏览器语音降级（SenseTime Nia ${reason}）`);
          DebugLog.add("TTS", `Chrome TTS 降级中 (${role}/${lang}, ${reason})`, chunkText);
          await this.speakChrome(chunkText, role, myToken, lang);
        } else {
          try {
            await this.speakNiaTts(chunkText, role, myToken, lang);
            const vid = lang === "zh"
              ? (role === "rival" ? cfg.niaVoiceRivalZh : cfg.niaVoiceRefereeZh)
              : (role === "rival" ? cfg.niaVoiceRival : cfg.niaVoiceReferee);
            this.setVoiceStatus(`現在：SenseTime Nia TTS (${vid})`, `当前：SenseTime Nia TTS (${vid})`);
          } catch (e) {
            if (myToken === this.speakToken) {
              if (e && (e.status === 401 || e.status === 402 || e.status === 403)) {
                this.apiTtsBlocked = true;
                this.apiTtsBlockReason = e.code || `HTTP ${e.status}`;
              }
              DebugLog.add("ERR", `SenseTime Nia TTS 失败 (${e.message}) → 降级 Chrome TTS`, chunkText);
              this.setVoiceStatus(`SenseTime Nia 失敗 (${e.message}) → Chrome降級`, `SenseTime Nia 失败 (${e.message}) → 已降级浏览器朗读`);
              await this.speakChrome(chunkText, role, myToken, lang);
            }
          }
        }
      } else if (!hasKey) {
        this.setVoiceStatus("現在：Chrome標準音声", "Vertex Key 未填写，使用浏览器朗读");
        DebugLog.add("TTS", `Chrome TTS (${role}/${lang})`, chunkText);
        await this.speakChrome(chunkText, role, myToken, lang);
      } else if (this.apiTtsBlocked) {
        this.setVoiceStatus(`現在：Chrome標準音声（Vertex ${this.apiTtsBlockReason}）`, `当前：浏览器语音降级（Vertex ${this.apiTtsBlockReason}）`);
        DebugLog.add("TTS", `Chrome TTS 降级中 (${role}/${lang}, ${this.apiTtsBlockReason})`, chunkText);
        await this.speakChrome(chunkText, role, myToken, lang);
      } else {
        try {
          await this.speakVertexTts(chunkText, role, myToken, lang);
          this.setVoiceStatus(`現在：Vertex Gemini TTS (${cfg.ttsModel})`, `当前：Vertex Gemini TTS (${cfg.ttsModel})`);
        } catch (e) {
          if (myToken === this.speakToken) {
            if (e && (e.status === 402 || e.status === 403 || e.status === 404)) {
              this.apiTtsBlocked = true;
              this.apiTtsBlockReason = `HTTP ${e.status}`;
            }
            DebugLog.add("ERR", `Vertex TTS 失败 (${e.message}) → 降级 Chrome TTS`, chunkText);
            this.setVoiceStatus(`Vertex失敗 (${e.message}) → Chrome降級`, `Vertex 失败 (${e.message}) → 已降级浏览器朗读`);
            await this.speakChrome(chunkText, role, myToken, lang);
          }
        }
      }
    },

    async drainSpeakQueue() {
      if (this.isDrainingQueue) return;
      const myDrainId = ++this._drainId;
      this.isDrainingQueue = true;
      try {
        while (myDrainId === this._drainId && this.speakQueue.length > 0) {
          const item = this.speakQueue.shift();
          if (!item) continue;
          const { spokenText, role, lang, token: myToken, resolve } = item;
          if (myToken !== this.speakToken) {
            try { resolve(); } catch (_) {}
            continue;
          }
          this.currentSpeakItem = item;
          this.isSpeaking = true;
          /* 低优可打断追问/催促（clarify/idle）跳过 700ms 打断锁，允许玩家 0ms 随时开口打断 */
          if (item.interruptible) this.bargeInGuardUntil = 0;
          this.pendingSpeakCount = 1 + this.speakQueue.length;
          this.recordSpoken(spokenText);
          clearTimeout(this.chromeResumeTimer);
          clearTimeout(this.chromeUtterTimer);
          this.chromeUtterBuf = "";
          /* 全双工 Nia 模式下允许 TTS 边播边维持 ASR 流式识别，不中断正在进行的收音会话 */
          if (this.vadRecorder || ((this.vadCapturing || this.vadNiaSession) && ConfigManager.data.asrMode !== "nia_asr")) this.abortVadRecorder();
          if (this.callActive && this.callMode === "chrome_asr" && this.callRec) {
            clearTimeout(this.recRestartTimer);
            try { this.callRec.onend = null; this.callRec.abort(); } catch (_) {}
            this.callRec = null;
            this.recRunning = false;
            this.recStarting = false;
          }
          if (this.callActive) {
            this.updateCallButtonUI(this.callMode === "vad" ? "speaking_vad" : "speaking_chrome");
          }

          try {
            const clauses = this.splitIntoClauses(spokenText, lang);
            for (let ci = 0; ci < clauses.length; ci++) {
              if (myToken !== this.speakToken) break;
              /* 提前预取下一个子句，保证多子句朗读零停顿，同时在每句边界检查高优让位标记 */
              if (ci + 1 < clauses.length && !item.preemptAfterClause) {
                this.prefetch(clauses[ci + 1], role, lang);
              }
              await this._speakSingleChunk(clauses[ci], role, myToken, lang);
              if (item.preemptAfterClause) {
                DebugLog.add("TTS", `子句边界优雅让位 (${role}/${item.priority})`, `已完成「${clauses[ci]}」，让位给更高优播报`);
                break;
              }
            }
          } finally {
            if (this.currentSpeakItem === item) this.currentSpeakItem = null;
            if (!item._replaying) {
              try { resolve(); } catch (_) {}
            }
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
              this.updateCallButtonUI("resuming");
              clearTimeout(this.chromeResumeTimer);
              this.chromeResumeTimer = setTimeout(() => {
                if (this.callActive && this.callMode === "chrome_asr" && !this.isSpeaking) {
                  this.spawnContinuousRec();
                  this.updateCallButtonUI("chrome_listen");
                }
              }, 180);
            } else {
              this.updateCallButtonUI("listen");
            }
          }
          if (typeof BattleEngine !== "undefined" && BattleEngine.resetIdleTimer) {
            BattleEngine.resetIdleTimer(false);
          }
        }
      }
    },

    /* ---------- 持续通话模式（全双工 AEC3 + 实时 HUD 状态同步） ---------- */
    updateCallButtonUI(stateKey = "listen") {
      const btn = $("btnLiveCall");
      if (!btn) return;
      const phoneSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/></svg>';
      const stopSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';
      const badgeMap = {
        listen: t("聴取中", "监听中"),
        capturing: t("収音中", "收音中"),
        barge: t("割込収音", "打断收音"),
        speaking_vad: t("発話中", "播报中"),
        speaking_chrome: t("発話中", "播报中"),
        resuming: t("再開中", "恢复中"),
        chrome_listen: t("Chrome聴取", "浏览器监听")
      };
      if (this.callActive) {
        btn.classList.add("in-call");
        btn.innerHTML = `${stopSvg}${escapeHtml(t("通話終了", "结束通话"))}`;
        this.setCallBadge(badgeMap[stateKey] || t("聴取中", "监听中"), true);
      } else {
        btn.classList.remove("in-call");
        btn.innerHTML = `${phoneSvg}${escapeHtml(t("通話開始", "开始通话"))}`;
        this.setCallBadge(t("待機", "待机"), false);
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
          const winStart = i * ratio;
          const winEnd = winStart + ratio;
          const idxStart = Math.floor(winStart);
          const idxEnd = Math.min(totalLen, Math.floor(winEnd));
          let sum = 0;
          let wSum = 0;
          if (idxStart >= idxEnd) {
            sum = merged[Math.min(totalLen - 1, idxStart)];
            wSum = 1;
          } else {
            const firstWeight = (idxStart + 1) - winStart;
            sum += merged[idxStart] * firstWeight;
            wSum += firstWeight;
            for (let k = idxStart + 1; k < idxEnd; k++) {
              sum += merged[k];
              wSum += 1;
            }
            const lastWeight = winEnd - idxEnd;
            if (lastWeight > 1e-6 && idxEnd < totalLen) {
              sum += merged[idxEnd] * lastWeight;
              wSum += lastWeight;
            }
          }
          samples[i] = wSum > 0 ? (sum / wSum) : 0;
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

    /** 创建一次SenseTime Nia 流式语音识别会话（实时将任意采样率 Float32 PCM 降采样为 16kHz Int16LE 并按 100ms 帧流式上送） */
    createNiaAsrSession(opts = {}) {
      const lang = typeof opts.lang === "string" ? opts.lang : this.getEffectiveNiaAsrLang();
      const onPartial = typeof opts.onPartial === "function" ? opts.onPartial : null;
      const FRAME_BYTES = 1920; // 16kHz * 2B * 60ms 低延迟实时流式帧
      const frameQueue = [];
      let pendingBuf = new Uint8Array(0);
      let resampleTail = new Float32Array(0);
      let resamplePhase = 0;
      let envPeak = 0.08;

      let ws = null;
      let started = false;
      let ending = false;
      let endSent = false;
      let aborted = false;
      let settled = false;
      let flushTimer = null;
      let endWaitTimer = null;
      let connectTimer = null;
      let lastErr = null;

      const finalSegments = [];
      let lastPartial = "";
      let finishResolve = null;
      let finishReject = null;

      const cleanupTimers = () => {
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
        if (endWaitTimer) { clearTimeout(endWaitTimer); endWaitTimer = null; }
        if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
      };

      const closeWsSafe = () => {
        try { if (ws && ws.readyState < 2) ws.close(); } catch (_) {}
      };

      const getTranscript = () => {
        const joined = finalSegments.join("").trim();
        if (joined && lastPartial && !joined.endsWith(lastPartial)) return `${joined}${lastPartial}`.trim();
        return (joined || lastPartial || "").trim();
      };

      const resolveDone = () => {
        if (settled) return;
        settled = true;
        cleanupTimers();
        closeWsSafe();
        if (finishResolve) finishResolve(getTranscript());
      };

      const rejectFail = (err) => {
        lastErr = err instanceof Error ? err : new Error(String(err || "Nia ASR error"));
        if (settled) return;
        settled = true;
        cleanupTimers();
        closeWsSafe();
        if (finishReject) finishReject(lastErr);
      };

      const appendPcmBytes = (bytes) => {
        if (!bytes || bytes.length === 0) return;
        const merged = new Uint8Array(pendingBuf.length + bytes.length);
        merged.set(pendingBuf, 0);
        merged.set(bytes, pendingBuf.length);
        let off = 0;
        while (merged.length - off >= FRAME_BYTES) {
          frameQueue.push(merged.slice(off, off + FRAME_BYTES));
          off += FRAME_BYTES;
        }
        pendingBuf = merged.slice(off);
      };

      const trySendEnd = () => {
        if (!started || !ending || endSent || !ws || ws.readyState !== 1) return;
        if (frameQueue.length > 0) return;
        if (pendingBuf.length > 0) {
          try { ws.send(pendingBuf); } catch (_) {}
          pendingBuf = new Uint8Array(0);
        }
        // 追加 96ms（3072B，按 <=1920B 分帧）尾音零填充，让流式 ASR 充分解码最后一音节后再关闭
        const zeroPad = [new Uint8Array(1920), new Uint8Array(1152)];
        for (const pad of zeroPad) {
          try { ws.send(pad); } catch (_) {}
        }
        endSent = true;
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
        try {
          ws.send(JSON.stringify({ type: "end" }));
        } catch (e) {
          rejectFail(e);
          return;
        }
        const hasTextNow = Boolean(getTranscript());
        const waitMs = (finalSegments.length > 0 && !lastPartial) ? 350 : (lastPartial ? 900 : (hasTextNow ? 650 : 1200));
        endWaitTimer = setTimeout(() => resolveDone(), waitMs);
      };

      const drainFrames = (maxCount = Infinity) => {
        if (aborted || settled || !started || !ws || ws.readyState !== 1) return false;
        let sentCount = 0;
        while (sentCount < maxCount && frameQueue.length > 0) {
          const frame = frameQueue.shift();
          try {
            ws.send(frame);
            sentCount += 1;
          } catch (e) {
            rejectFail(e);
            return false;
          }
        }
        if (ending && frameQueue.length === 0) trySendEnd();
        return true;
      };

      const startPacer = () => {
        if (flushTimer) return;
        flushTimer = setInterval(() => {
          drainFrames(4);
        }, 25);
      };

      (async () => {
        try {
          const jwt = await ConfigManager.generateNiaJwt();
          if (aborted || settled) return;
          const url = `wss://nia.sensetime.com/biz/asr/ws?jwt=${encodeURIComponent(jwt)}`;
          ws = new WebSocket(url);
          ws.binaryType = "arraybuffer";
          connectTimer = setTimeout(() => {
            if (!started && !aborted && !settled) rejectFail(new Error("Nia ASR connect timeout"));
          }, 7000);
          ws.onopen = () => {
            if (aborted || settled) { closeWsSafe(); return; }
            try {
              ws.send(JSON.stringify({
                type: "start",
                language: lang,
                format: "pcm_s16le",
                sample_rate: 16000,
                channels: 1,
                server_vad: false
              }));
            } catch (e) {
              rejectFail(e);
            }
          };
          ws.onmessage = (ev) => {
            if (aborted || settled || typeof ev.data !== "string") return;
            let msg = null;
            try { msg = JSON.parse(ev.data); } catch (_) { return; }
            if (msg.type === "started") {
              started = true;
              if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
              drainFrames(6);
              startPacer();
              if (ending && frameQueue.length === 0) trySendEnd();
            } else if (msg.type === "partial") {
              const t = String(msg.text || "").trim();
              if (t) {
                lastPartial = t;
                if (onPartial) onPartial(getTranscript(), false);
              }
            } else if (msg.type === "final") {
              const t = String(msg.text || "").trim();
              if (t) finalSegments.push(t);
              lastPartial = "";
              const preview = getTranscript();
              if (preview && onPartial) onPartial(preview, true);
              if (ending && endSent) {
                clearTimeout(endWaitTimer);
                endWaitTimer = setTimeout(() => resolveDone(), 180);
              }
            } else if (msg.type === "finished") {
              resolveDone();
            } else if (msg.type === "error") {
              const err = new Error(msg.message || msg.code || "Nia ASR error");
              err.code = msg.code || "";
              if (/401|403|AUTH|TOKEN|UNAUTH|FORBID/i.test(String(msg.code || msg.message || ""))) {
                err.status = 401;
              }
              rejectFail(err);
            }
          };
          ws.onerror = () => {
            if (!aborted && !settled) rejectFail(new Error("Nia ASR WebSocket error"));
          };
          ws.onclose = (ev) => {
            if (aborted || settled) return;
            if (endSent || (started && getTranscript())) {
              resolveDone();
            } else {
              rejectFail(new Error(`Nia ASR closed (${ev.code})`));
            }
          };
        } catch (e) {
          if (!aborted && !settled) rejectFail(e);
        }
      })();

      return {
        /** 喂入一段 Float32 单声道音频：抗混叠积分降采样至 16kHz Int16LE，并对轻声说话温和自适应增益 */
        pushFloat32(float32Chunk, srcRate = 48000) {
          if (aborted || ending || settled || !float32Chunk || float32Chunk.length === 0) return;
          const rate = srcRate > 0 ? srcRate : 48000;
          const step = rate / 16000;
          let chunkPeak = 0;
          for (let i = 0; i < float32Chunk.length; i++) {
            const a = Math.abs(float32Chunk[i]);
            if (a > chunkPeak) chunkPeak = a;
          }
          if (chunkPeak > envPeak) envPeak = envPeak * 0.75 + chunkPeak * 0.25;
          else envPeak = envPeak * 0.96 + chunkPeak * 0.04;
          const gain = (chunkPeak >= 0.014 && envPeak < 0.36) ? Math.min(2.2, 0.36 / Math.max(envPeak, 0.06)) : 1;

          const tailLen = resampleTail.length;
          const combined = new Float32Array(tailLen + float32Chunk.length);
          if (tailLen > 0) combined.set(resampleTail, 0);
          combined.set(float32Chunk, tailLen);
          const totalLen = combined.length;

          let pos = resamplePhase;
          const maxOut = Math.ceil(totalLen / Math.max(step, 0.5)) + 2;
          const out = new Int16Array(maxOut);
          let outCount = 0;

          if (step > 1.01) {
            while (pos + step <= totalLen) {
              const winStart = pos;
              const winEnd = pos + step;
              const idxStart = Math.floor(winStart);
              const idxEnd = Math.floor(winEnd);
              let sum = 0;
              if (idxStart === idxEnd) {
                sum = combined[idxStart] * step;
              } else {
                const firstWeight = (idxStart + 1) - winStart;
                sum += combined[idxStart] * firstWeight;
                for (let k = idxStart + 1; k < idxEnd; k++) sum += combined[k];
                const lastWeight = winEnd - idxEnd;
                if (lastWeight > 1e-6 && idxEnd < totalLen) sum += combined[idxEnd] * lastWeight;
              }
              let sample = (sum / step) * gain;
              if (gain > 1) sample = sample / (1 + 0.15 * Math.abs(sample));
              const clamped = Math.max(-1, Math.min(1, sample));
              out[outCount++] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
              pos += step;
            }
          } else {
            while (pos + 1 < totalLen) {
              const i0 = Math.floor(pos);
              const frac = pos - i0;
              let sample = (combined[i0] * (1 - frac) + combined[i0 + 1] * frac) * gain;
              if (gain > 1) sample = sample / (1 + 0.15 * Math.abs(sample));
              const clamped = Math.max(-1, Math.min(1, sample));
              out[outCount++] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
              pos += step;
            }
          }

          const keepFrom = Math.max(0, Math.min(totalLen, Math.floor(pos)));
          resampleTail = combined.slice(keepFrom);
          resamplePhase = pos - keepFrom;

          if (outCount > 0) {
            appendPcmBytes(new Uint8Array(out.buffer, 0, outCount * 2));
            if (started) drainFrames(4);
          }
        },

        /** 结束收音，发完缓冲队列与 end 指令并等待最终识别文本 */
        finish() {
          if (aborted) return Promise.resolve("");
          if (settled) {
            if (lastErr) return Promise.reject(lastErr);
            return Promise.resolve(getTranscript());
          }
          ending = true;
          return new Promise((resolve, reject) => {
            finishResolve = resolve;
            finishReject = reject;
            if (started && frameQueue.length === 0) {
              trySendEnd();
            } else if (!started) {
              // 仍在进行 WS 握手：最长再等待 5 秒
              clearTimeout(endWaitTimer);
              endWaitTimer = setTimeout(() => {
                if (!started) rejectFail(new Error("Nia ASR handshake timeout"));
                else resolveDone();
              }, 5000);
            }
          });
        },

        /** 静默丢弃本次会话（用于噪声误触发、打断或挂断） */
        abort() {
          if (aborted) return;
          aborted = true;
          settled = true;
          cleanupTimers();
          closeWsSafe();
          if (finishResolve) finishResolve("");
        }
      };
    },

    /** 判断当前识别文本结尾是否停在连接词/助词或半截宾语上，避免在玩家连招或思考停顿时过早截断（不匹配 〜て/〜して 完整祈使结尾） */
    isIncompleteTrailingPhrase(text) {
      const s = String(text || "").trim().replace(/[、，,。.！!？?]+$/, "");
      if (!s) return true;
      if (/(?:然后|接着|之后|随后|并且|而且|但是|不过|顺便|接下来|另外|同时|还有|先把|先给|先用|先贴|先上|再把|再给|再用|再贴|再上|先|再|把|给|向|对|用|让|派|将|替|帮|拖|拉|换|贴|の|を|に|へ|で|と|が|は|も|から|まで|てから|してから|そして|それから|あとで|そのあと|つぎに|次に|まず)$/.test(s)) {
        return true;
      }
      if (/(?:然后|接着|之后|随后|顺便|接下来)(?:把|给|对|向|替)?(?:[^，。！？,.!?]{0,6}(?:炎狐|水龟|雷狮|炎龙|熔岩犬|泡沫鱼|电光鸟|沧海鲨|前排|后排|己方|我方|自己|对面|对手|对方|左边|右边|1号|2号|一号|二号))$/.test(s)) {
        return true;
      }
      return false;
    },

    /** 判断文本末尾是否已到达攻击/技能/防御/结束回合等明确收尾指令 */
    hasTerminalCommandTail(text) {
      const s = String(text || "").trim().replace(/[、，,。.！!？?]+$/, "");
      if (!s) return false;
      const tail = s.slice(-16);
      if (/(?:攻撃|こうげき|アタック|防御|ぼうぎょ|ガード|守る|まもる|守って|ターン終了|パス|終わり|攻击|进攻|开打|战斗(?!区)|发动攻击|展开攻击|防守|防御(?!区)|结束回合|过回合|过牌结束)$/.test(tail)) {
        return true;
      }
      return Boolean(typeof SpecEngine !== "undefined" && SpecEngine.matchSkill && SpecEngine.matchSkill(tail));
    },

    /** 判断当前是否像“伤药/能量/召唤笛/换人”等尚未收尾的连招准备阶段 */
    looksLikeOngoingCombo(text) {
      const s = String(text || "").trim();
      if (!s || this.hasTerminalCommandTail(s)) return false;
      return /(?:伤药|回血|补血|加血|きずぐすり|能量|エネ|召唤笛|よびだし笛|强拉|换人|撤退|にげる|道具|补给|力量徽章|回收|换怪)/.test(s);
    },

    /** 中断当前尚未提交的 VAD 录音切片、Nia 流式会话与 PCM 采集缓冲 */
    abortVadRecorder() {
      this.vadCapturing = false;
      this.vadSimultaneousMode = false;
      this.vadLoudBargeStreak = 0;
      this.vadContStreak = 0;
      this.vadLastAsrText = "";
      this.vadLastAsrChangeAt = 0;
      this.vadGotFinal = false;
      this.vadCaptureChunks = [];
      if (this.vadNiaSession) {
        try { this.vadNiaSession.abort(); } catch (_) {}
        this.vadNiaSession = null;
      }
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
              if (this.vadNiaSession) {
                this.vadNiaSession.pushFloat32(copy, ctx.sampleRate || 48000);
              }
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
      this.vadContStreak = 0;
      const normAsrKey = (txt) => String(txt || "").replace(/[\s、，。.,！!？?…]+/g, "");

      clearInterval(this.vadTimer);
      this.vadTimer = setInterval(() => {
        if (!this.callActive || !this.vadAnalyser) return;
        const now = Date.now();
        const playerCanSpeak = !BattleEngine.state?.busy && BattleEngine.state?.currentPlayer === "player" && !BattleEngine.state?.gameOver;
        if (!playerCanSpeak) {
          this.vadHitStreak = 0;
          this.vadBargeStreak = 0;
          this.vadContStreak = 0;
          if (this.vadRecorder || this.vadCapturing) this.abortVadRecorder();
          this.updateVoiceWave(0, 0.02, false);
          return;
        }
        if (now < this.sfxPlayingUntil && !this.vadCapturing && !this.vadRecorder) {
          this.vadHitStreak = 0;
          this.vadBargeStreak = 0;
          this.updateVoiceWave(0, 0.02, false);
          return;
        }

        this.vadAnalyser.getFloatTimeDomainData(pcm);
        let sum = 0;
        for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
        const rms = Math.sqrt(sum / pcm.length);
        const startThresh = Math.max(0.018, this.vadNoiseFloor * 2.4 + 0.006);
        const contThresh = this.isSpeaking
          ? Math.max(0.018, this.vadNoiseFloor * 2.0 + 0.006)
          : Math.max(0.013, this.vadNoiseFloor * 1.7 + 0.004);
        const minPeak = Math.max(0.022, this.vadNoiseFloor * 2.6 + 0.007);
        const minLoudFrames = 4;

        /* 全双工边播边识别（Nia 模式）：TTS 播放期间同步开启流式 ASR 试听，确认非回声有效人声后再平滑淡出打断 TTS */
        if (this.isSpeaking) {
          const isLowInterruptible = Boolean(this.currentSpeakItem && this.currentSpeakItem.interruptible);
          const allowEasyBarge = isLowInterruptible || (typeof BattleEngine !== "undefined" && BattleEngine.state?.phase === "setup");
          if (!this.vadCapturing && !allowEasyBarge && this.bargeInGuardUntil && now < this.bargeInGuardUntil) {
            this.vadBargeStreak = 0;
            this.vadLoudBargeStreak = 0;
            this.updateVoiceWave(rms * 0.2, 0.08, false);
            return;
          }
          const useFullDuplexNia = Boolean(this.vadProcessor && ConfigManager.data.asrMode === "nia_asr");
          if (useFullDuplexNia) {
            const probeThresh = allowEasyBarge
              ? Math.max(0.015, this.vadNoiseFloor * 1.9 + 0.004)
              : Math.max(0.022, this.vadNoiseFloor * 2.4 + 0.005);
            const strongBargeThresh = allowEasyBarge
              ? Math.max(0.028, this.vadNoiseFloor * 2.6 + 0.006)
              : Math.max(0.052, this.vadNoiseFloor * 3.8);
            if (!this.vadCapturing) {
              if (rms > probeThresh) {
                this.vadBargeStreak += 1;
                this.updateVoiceWave(rms, probeThresh, true);
              } else {
                this.vadBargeStreak = 0;
                this.updateVoiceWave(rms * 0.3, probeThresh, false);
              }
              if (this.vadBargeStreak >= 2) {
                this.vadBargeStreak = 0;
                this.vadLoudBargeStreak = rms > strongBargeThresh ? 1 : 0;
                this.vadContStreak = 0;
                this.vadSimultaneousMode = !allowEasyBarge;
                this.vadLastAsrText = "";
                this.vadLastAsrChangeAt = 0;
                this.vadGotFinal = false;
                this.vadSpeechStart = now;
                this.vadLastLoud = now;
                this.vadPeakRms = rms;
                this.vadLoudFrames = 2;
                const keepPreChunks = Math.max(2, Math.ceil(((ctx.sampleRate || 48000) * 0.26) / 2048));
                this.vadCaptureChunks = this.vadPreRoll.slice(-keepPreChunks);
                this.vadPreRoll = [];
                this.vadCapturing = true;
                if (allowEasyBarge) {
                  this.fadeOutAndStopPlayback(70);
                  this.lastSpeakEndAt = 0;
                  BattleEngine.resetIdleTimer();
                  this.updateCallButtonUI("barge");
                  TableUI.showVoiceHud("listening", "…");
                  DebugLog.add("AEC", "开局/引导语音快速说话打断", `rms=${rms.toFixed(3)}`);
                }
                if (this.vadNiaSession) { try { this.vadNiaSession.abort(); } catch (_) {} }
                const niaSess = this.createNiaAsrSession({
                  lang: this.getEffectiveNiaAsrLang(),
                  onPartial: (txt, isFinal) => {
                    const cleaned = this.stripSpokenEcho(txt);
                    if (!cleaned || NLUEngine.isMeaninglessTranscript(cleaned) || this.isLikelySelfEcho(cleaned)) return;
                    if (normAsrKey(cleaned) !== normAsrKey(this.vadLastAsrText)) {
                      this.vadLastAsrChangeAt = Date.now();
                    }
                    this.vadLastAsrText = cleaned;
                    if (isFinal) this.vadGotFinal = true;
                    if (this.vadSimultaneousMode && this.isSpeaking) {
                      this.vadSimultaneousMode = false;
                      this.vadLoudBargeStreak = 0;
                      this.fadeOutAndStopPlayback(100);
                      this.lastSpeakEndAt = 0;
                      BattleEngine.resetIdleTimer();
                      this.updateCallButtonUI("barge");
                      DebugLog.add("AEC", "边播边识别触发语义打断", cleaned);
                    }
                    if ($("cmdInput")) $("cmdInput").value = cleaned;
                    TableUI.showVoiceHud("listening", cleaned);
                  }
                });
                const sr = ctx.sampleRate || 48000;
                for (const c of this.vadCaptureChunks) niaSess.pushFloat32(c, sr);
                this.vadNiaSession = niaSess;
              }
              return;
            }
            /* 已在边播边识别试听中：若持续大声插话（防高延迟网络首字偏慢），约 110ms 后平滑淡出打断 TTS */
            if (this.vadSimultaneousMode) {
              if (rms > strongBargeThresh) {
                this.vadLoudBargeStreak += 1;
                if (this.vadLoudBargeStreak >= 3) {
                  this.vadSimultaneousMode = false;
                  this.vadLoudBargeStreak = 0;
                  this.fadeOutAndStopPlayback(100);
                  this.lastSpeakEndAt = 0;
                  BattleEngine.resetIdleTimer();
                  this.updateCallButtonUI("barge");
                  TableUI.showVoiceHud("listening", "…");
                  DebugLog.add("AEC", "强音量快速打断 TTS", `rms=${rms.toFixed(3)}`);
                }
              } else {
                this.vadLoudBargeStreak = 0;
              }
            }
            /* 落入下方活跃收音尾音判停逻辑，实现真正的边播边识别 */
          } else {
            const bargeThresh = allowEasyBarge
              ? Math.max(0.018, this.vadNoiseFloor * 2.0 + 0.005)
              : Math.max(0.036, this.vadNoiseFloor * 3.0);
            const strongBargeThresh = allowEasyBarge
              ? Math.max(0.032, this.vadNoiseFloor * 2.8 + 0.006)
              : Math.max(0.062, this.vadNoiseFloor * 4.5);
            if (rms > bargeThresh) {
              this.vadBargeStreak += 1;
              this.updateVoiceWave(rms, bargeThresh, true);
            } else {
              this.vadBargeStreak = 0;
              this.updateVoiceWave(rms * 0.3, bargeThresh, false);
            }
            if ((allowEasyBarge && this.vadBargeStreak >= 2) || this.vadBargeStreak >= 3 || (rms > strongBargeThresh && this.vadBargeStreak >= 2)) {
              this.vadBargeStreak = 0;
              this.fadeOutAndStopPlayback(100);
              this.lastSpeakEndAt = 0;
              this.vadSpeechStart = now;
              this.vadLastLoud = now;
              this.vadPeakRms = rms;
              this.vadLoudFrames = 5;
              BattleEngine.resetIdleTimer();
              this.updateCallButtonUI("barge");
              TableUI.showVoiceHud("listening", "…");
              if (this.vadProcessor) {
                this.vadCaptureChunks = [...this.vadPreRoll];
                this.vadPreRoll = [];
                this.vadCapturing = true;
              }
            }
            return;
          }
        } else {
          this.vadBargeStreak = 0;
          this.vadLoudBargeStreak = 0;
        }

        const isActiveCapture = this.vadProcessor ? this.vadCapturing : Boolean(this.vadRecorder);
        this.updateVoiceWave(rms, startThresh, isActiveCapture || rms > startThresh);
        if (!isActiveCapture) {
          if (rms > startThresh) {
            this.vadHitStreak += 1;
          } else {
            this.vadHitStreak = 0;
            /* 仅在确认是背景静音时才更新底噪，允许适应中等风扇/空调环境声同时防止爬坡吸纳起音 */
            if (rms < this.vadNoiseFloor * 1.4) {
              this.vadNoiseFloor = Math.min(0.028, Math.max(0.004, this.vadNoiseFloor * 0.94 + rms * 0.06));
            }
          }
          if (this.vadHitStreak >= 2) {
            this.vadHitStreak = 0;
            this.vadContStreak = 0;
            this.vadLastAsrText = "";
            this.vadLastAsrChangeAt = 0;
            this.vadGotFinal = false;
            this.vadSpeechStart = now;
            this.vadLastLoud = now;
            this.vadPeakRms = rms;
            this.vadLoudFrames = 2;
            BattleEngine.resetIdleTimer();
            this.updateCallButtonUI("capturing");
            TableUI.showVoiceHud("listening", "…");
            if (this.vadProcessor) {
              this.vadCaptureChunks = [...this.vadPreRoll];
              this.vadPreRoll = [];
              this.vadCapturing = true;
              if (ConfigManager.data.asrMode === "nia_asr") {
                if (this.vadNiaSession) { try { this.vadNiaSession.abort(); } catch (_) {} }
                const niaSess = this.createNiaAsrSession({
                  lang: this.getEffectiveNiaAsrLang(),
                  onPartial: (txt, isFinal) => {
                    const cleanTxt = String(txt || "").trim();
                    if (cleanTxt) {
                      if (normAsrKey(cleanTxt) !== normAsrKey(this.vadLastAsrText)) {
                        this.vadLastAsrChangeAt = Date.now();
                      }
                      this.vadLastAsrText = cleanTxt;
                    }
                    if (isFinal && cleanTxt) this.vadGotFinal = true;
                    if (cleanTxt && $("cmdInput")) $("cmdInput").value = cleanTxt;
                    if (cleanTxt) TableUI.showVoiceHud("listening", cleanTxt);
                  }
                });
                const sr = ctx.sampleRate || 48000;
                for (const c of this.vadCaptureChunks) niaSess.pushFloat32(c, sr);
                this.vadNiaSession = niaSess;
              }
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
                    if (this.isSpeaking) this.updateCallButtonUI("speaking_vad");
                    else this.updateCallButtonUI("listen");
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
          const strongVoice = rms > Math.max(contThresh * 1.25, this.vadPeakRms * 0.35);
          if (rms > contThresh) {
            this.vadContStreak = (this.vadContStreak || 0) + 1;
            if (this.vadContStreak >= 2 || strongVoice) {
              this.vadLastLoud = now;
              this.vadLoudFrames += 1;
            }
            if (rms > this.vadPeakRms) this.vadPeakRms = rms;
          } else {
            this.vadContStreak = 0;
          }
          const dur = now - this.vadSpeechStart;
          const silence = now - this.vadLastLoud;
          const asrTxt = this.vadLastAsrText || "";
          const isSetupPhase = typeof BattleEngine !== "undefined" && BattleEngine.state?.phase === "setup";
          const incompleteTail = asrTxt ? this.isIncompleteTrailingPhrase(asrTxt) : false;
          const hasTerminalTail = asrTxt ? this.hasTerminalCommandTail(asrTxt) : false;
          const looksCombo = asrTxt ? this.looksLikeOngoingCombo(asrTxt) : false;
          const tailSilenceMs = isSetupPhase
            ? (incompleteTail ? 1800 : 1200)
            : (incompleteTail
                ? 2200
                : (hasTerminalTail
                    ? (dur < 1200 ? 1100 : 1250)
                    : (looksCombo ? 1800 : 1600)));
          const asrIdleMs = this.vadLastAsrChangeAt ? (now - this.vadLastAsrChangeAt) : 0;
          const asrStableLimit = isSetupPhase
            ? (incompleteTail ? 2200 : 1400)
            : (incompleteTail ? 2800 : (hasTerminalTail ? 1600 : (looksCombo ? 2100 : 1900)));
          /* 声学静音 + ASR 文本稳定双信号联合判停：长连招中间自然停顿（~1s）不截断，明确终结词或停顿足够久才提交 */
          const asrTextStableDone = Boolean(
            asrTxt
            && dur >= 500
            && asrIdleMs >= asrStableLimit
            && rms < Math.max(0.045, this.vadNoiseFloor * 3.2, this.vadPeakRms * 0.55)
          );
          if ((dur >= 380 && silence >= tailSilenceMs) || asrTextStableDone || dur >= 18000) {
            if (this.vadProcessor) {
              const wasSimultaneous = Boolean(this.vadSimultaneousMode);
              this.vadCapturing = false;
              this.vadSimultaneousMode = false;
              this.vadLoudBargeStreak = 0;
              this.vadContStreak = 0;
              this.vadLastAsrText = "";
              this.vadLastAsrChangeAt = 0;
              this.vadGotFinal = false;
              const pcmChunks = this.vadCaptureChunks;
              this.vadCaptureChunks = [];
              const niaSession = this.vadNiaSession;
              this.vadNiaSession = null;
              const peak = this.vadPeakRms;
              const loudFrames = this.vadLoudFrames;
              if (this.callActive) {
                if (this.isSpeaking) this.updateCallButtonUI("speaking_vad");
                else this.updateCallButtonUI("listen");
              }
              if (!this.callActive || pcmChunks.length === 0 || loudFrames < minLoudFrames || peak < minPeak || dur < 220) {
                if (niaSession) niaSession.abort();
                return;
              }
              if (!wasSimultaneous) SoundFX.play("tap");
              if (niaSession) {
                const durCaptured = dur;
                const sampleRateUsed = ctx.sampleRate || 48000;
                let cachedWavB64 = null;
                const getFallbackWavBase64 = () => {
                  if (cachedWavB64 !== null) return cachedWavB64;
                  if (pcmChunks.length === 0 || durCaptured > 16000) {
                    cachedWavB64 = "";
                    return cachedWavB64;
                  }
                  cachedWavB64 = this.encodePcmToWavBase64(pcmChunks, sampleRateUsed) || "";
                  return cachedWavB64;
                };
                niaSession.finish().then((transcript) => {
                  const rawClean = String(transcript || "").trim();
                  const clean = wasSimultaneous ? this.stripSpokenEcho(rawClean) : rawClean;
                  if (!clean || (wasSimultaneous && (NLUEngine.isMeaninglessTranscript(clean) || this.isLikelySelfEcho(clean)))) {
                    const canAudioRescue = !wasSimultaneous && loudFrames >= 6 && durCaptured >= 450 && Boolean(ConfigManager.buildRestUrl(ConfigManager.data.llmModel));
                    const rescueWav = canAudioRescue ? getFallbackWavBase64() : "";
                    if (rescueWav && this.callActive && this.callCallback) {
                      DebugLog.add("ASR", `Nia 转写为空 (${durCaptured}ms)，启用原始音频多模态兜底`, `frames=${loudFrames}, peak=${peak.toFixed(3)}`);
                      TableUI.showVoiceHud("llm", t("音声再解析中…", "音频复核解析中…"));
                      this.callCallback({ audioBase64: rescueWav, audioMime: "audio/wav", fromVoice: true });
                      return;
                    }
                    DebugLog.add(wasSimultaneous ? "AEC" : "ASR", wasSimultaneous ? `边播边识别忽略回声/杂音 (${durCaptured}ms)` : `SenseTime Nia 流式识别结果为空 (${durCaptured}ms)`, rawClean || `frames=${loudFrames}, peak=${peak.toFixed(3)}`);
                    return;
                  }
                  if (wasSimultaneous) {
                    SoundFX.play("tap");
                    if (this.isSpeaking) {
                      this.fadeOutAndStopPlayback(100);
                      this.lastSpeakEndAt = 0;
                    }
                  }
                  if ($("cmdInput")) $("cmdInput").value = clean;
                  DebugLog.add("ASR", `SenseTime Nia 流式识别完成 (${durCaptured}ms)`, clean);
                  if (this.callActive && this.callCallback) {
                    this.callCallback({
                      text: clean,
                      fromVoice: true,
                      fallbackAudioGetter: getFallbackWavBase64,
                      fallbackAudioMime: "audio/wav"
                    });
                  }
                }).catch((err) => {
                  const reason = err?.code || err?.message || "Nia ASR 接続失敗";
                  DebugLog.add("ERR", `SenseTime Nia 流式识别失败 (${reason})`);
                  const switched = this.fallbackToChromeAsr(reason);
                  if (switched) {
                    TableUI.showToast("Chrome音声認識へ自動切替しました", "SenseTime Nia 识别失败，已自动切换浏览器语音识别");
                  }
                });
              } else {
                const b64 = this.encodePcmToWavBase64(pcmChunks, ctx.sampleRate || 24000);
                if (b64 && this.callCallback) {
                  DebugLog.add("ASR", `VAD+PreRoll 提交 WAV (${Math.round((b64.length * 0.75) / 1024)}KB, ${dur}ms)`, `frames=${loudFrames}, peak=${peak.toFixed(3)}, tail=${tailSilenceMs}ms`);
                  this.callCallback({ audioBase64: b64, audioMime: "audio/wav", fromVoice: true });
                }
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

    /** 语种切换或设置保存后重启正在运行的 Chrome 持续语音识别 */
    restartChromeAsrIfNeeded() {
      if (!this.callActive || this.callMode !== "chrome_asr") return;
      clearTimeout(this.recRestartTimer);
      clearTimeout(this.chromeResumeTimer);
      if (this.callRec) {
        try {
          this.callRec.onstart = null;
          this.callRec.onresult = null;
          this.callRec.onerror = null;
          this.callRec.onend = null;
          this.callRec.abort();
        } catch (_) {}
        this.callRec = null;
      }
      this.recRunning = false;
      this.recStarting = false;
      if (!this.isSpeaking) {
        setTimeout(() => {
          if (this.callActive && this.callMode === "chrome_asr" && !this.isSpeaking) {
            this.spawnContinuousRec();
          }
        }, 120);
      }
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
      rec.lang = this.getEffectiveChromeAsrLang();
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
          const preview = (this.chromeUtterBuf ? `${this.chromeUtterBuf} ${interim}` : interim).trim();
          $("cmdInput").value = preview;
          TableUI.showVoiceHud("listening", preview);
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

    /** 在线语音识别恢复可用时：保护未提交半句缓冲，并无缝切回SenseTime Nia / Vertex 在线语音识别 */
    onOnlineApiRecovered() {
      if (!this.apiAsrBlocked) return;
      this.clearApiAsrReconnectTimer();
      this.apiAsrBlocked = false;
      this.apiAsrBlockReason = "";
      this.apiAsrBlockedAt = 0;
      this.apiAsrRetryAttempt = 0;
      const cfg = ConfigManager.data;
      const engineName = cfg.asrMode === "nia_asr" ? "SenseTime Nia" : "Vertex AI";
      DebugLog.add("ASR", `在线语音识别已恢复，自动切回 ${engineName} 语音识别`);
      const canReturnVad = this.callMicStream && (
        (cfg.asrMode === "nia_asr" && ConfigManager.hasNiaCredentials() && typeof WebSocket !== "undefined")
        || (cfg.asrMode === "gemini_audio" && Boolean(window.MediaRecorder) && String(cfg.apiKey || "").trim().length > 0)
      );
      if (this.callActive && this.callMode === "chrome_asr" && canReturnVad) {
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
        this.updateCallButtonUI("listen");
        this.setVoiceStatus(`オンライン音声認識に自動復帰しました（${engineName}）`);
        TableUI.showToast("オンライン音声認識に自動復帰しました", `已自动回连 ${engineName} 语音识别`);
      } else {
        this.setVoiceStatus(`オンライン音声認識が復旧しました（${engineName}・次回から自動使用）`);
        TableUI.showToast("オンライン音声認識が復旧しました", `${engineName} 语音识别已恢复`);
      }
    },

    /** 后台静默探测在线语音识别接口是否恢复（采用 5s → 10s → 20s → 30s 快速退避重试，不打断当前本地识别） */
    scheduleApiAsrReconnect() {
      const cfg = ConfigManager.data;
      const isNia = cfg.asrMode === "nia_asr" && ConfigManager.hasNiaCredentials();
      const isGemini = cfg.asrMode === "gemini_audio" && String(cfg.apiKey || "").trim().length > 0;
      if (!this.apiAsrBlocked || (!isNia && !isGemini)) return;
      if (/(401|403|API_KEY_INVALID|AUTH|UNAUTH|FORBID)/i.test(String(this.apiAsrBlockReason || ""))) return;
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
      if (!this.apiAsrBlocked) return;
      if (cfg.asrMode === "nia_asr") {
        if (!ConfigManager.hasNiaCredentials() || typeof WebSocket === "undefined") return;
        try {
          const jwt = await ConfigManager.generateNiaJwt();
          await new Promise((resolve, reject) => {
            let done = false;
            const ws = new WebSocket(`wss://nia.sensetime.com/biz/asr/ws?jwt=${encodeURIComponent(jwt)}`);
            const t = setTimeout(() => {
              if (!done) { done = true; try { ws.close(); } catch (_) {} reject(new Error("timeout")); }
            }, 4500);
            ws.onopen = () => {
              try {
                ws.send(JSON.stringify({ type: "start", language: "", format: "pcm_s16le", sample_rate: 16000, channels: 1, server_vad: false }));
              } catch (e) {
                if (!done) { done = true; clearTimeout(t); reject(e); }
              }
            };
            ws.onmessage = (ev) => {
              if (done || typeof ev.data !== "string") return;
              try {
                const msg = JSON.parse(ev.data);
                if (msg.type === "started") {
                  done = true; clearTimeout(t); try { ws.close(); } catch (_) {} resolve();
                } else if (msg.type === "error") {
                  done = true; clearTimeout(t); try { ws.close(); } catch (_) {} reject(new Error(msg.message || msg.code || "error"));
                }
              } catch (_) {}
            };
            ws.onerror = () => { if (!done) { done = true; clearTimeout(t); reject(new Error("network")); } };
            ws.onclose = (ev) => { if (!done) { done = true; clearTimeout(t); reject(new Error(`closed ${ev.code}`)); } };
          });
          this.onOnlineApiRecovered();
        } catch (e) {
          this.apiAsrRetryAttempt = (this.apiAsrRetryAttempt || 0) + 1;
          DebugLog.add("ASR", `SenseTime Nia 语音识别回连探测未通 (${e?.message || "network"})，继续保持本地识别`);
          if (this.apiAsrBlocked) this.scheduleApiAsrReconnect();
        }
        return;
      }
      if (cfg.asrMode !== "gemini_audio" || !String(cfg.apiKey || "").trim()) return;
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

    /** 在线语音识别（SenseTime Nia / Vertex）失败时自动降级至 Chrome 标准语音识别（通话中无缝切换，并定时自动尝试回连） */
    fallbackToChromeAsr(reason = "") {
      this.apiAsrBlocked = true;
      this.apiAsrBlockReason = reason || "接続失敗";
      this.apiAsrBlockedAt = Date.now();
      const engineName = ConfigManager.data.asrMode === "nia_asr" ? "SenseTime Nia" : "Vertex";
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        DebugLog.add("ERR", `${engineName} ASR 失败 (${this.apiAsrBlockReason}) 且浏览器不支持 Chrome ASR`);
        this.setVoiceStatus(`${engineName}音声認識失敗 (${this.apiAsrBlockReason}) · Chrome音声認識未対応`);
        this.scheduleApiAsrReconnect();
        return false;
      }
      DebugLog.add("ASR", `${engineName} ASR 失败 (${this.apiAsrBlockReason}) → 自动切换 Chrome ASR（后台自动回连）`);
      this.setVoiceStatus(`${engineName}音声認識失敗 (${this.apiAsrBlockReason}) → Chrome標準音声認識へ自動切替（自動再接続待機中）`);
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
        this.updateCallButtonUI("chrome_listen");
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
      const canUseNiaVad = cfg.asrMode === "nia_asr" && !this.apiAsrBlocked && ConfigManager.hasNiaCredentials() && typeof WebSocket !== "undefined";
      const canUseGeminiVad = Boolean(window.MediaRecorder) && cfg.asrMode === "gemini_audio" && !this.apiAsrBlocked && String(cfg.apiKey || "").trim().length > 0;
      const canUseVad = canUseNiaVad || canUseGeminiVad;
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
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
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
      this.updateCallButtonUI("listen");
      if (ConfigManager.data.asrMode === "nia_asr") {
        ConfigManager.generateNiaJwt().catch(() => {});
      }

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

    /* ---------- 单次按录（支持SenseTime Nia 流式识别 / Vertex Gemini 音频直传 / 浏览器语音识别） ---------- */
    async toggleRecord(onResult) {
      const btn = $("btnRecordVoice");
      if (this.isRecording) {
        this.isRecording = false;
        btn.classList.remove("recording");
        btn.innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
        if (this.singleNiaStop) {
          const stopFn = this.singleNiaStop;
          this.singleNiaStop = null;
          stopFn();
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
        if (this.chromeRec) try { this.chromeRec.stop(); } catch (e) {}
        return;
      }

      this.resumeCallAfterRecord = Boolean(this.callActive);
      if (this.callActive) this.stopCall(true);
      this.stopPlayback();

      const cfg = ConfigManager.data;
      if (this.apiAsrBlocked && this.apiAsrBlockedAt && Date.now() - this.apiAsrBlockedAt >= 5000 && !/(401|403|API_KEY_INVALID|AUTH|UNAUTH|FORBID)/i.test(String(this.apiAsrBlockReason || ""))) {
        this.apiAsrBlocked = false;
        this.apiAsrBlockReason = "";
        this.apiAsrRetryAttempt = 0;
      }
      const useNiaStream = cfg.asrMode === "nia_asr" && !this.apiAsrBlocked && ConfigManager.hasNiaCredentials() && typeof WebSocket !== "undefined";
      const useDirectAudio = cfg.asrMode === "gemini_audio" && !this.apiAsrBlocked && String(cfg.apiKey || "").trim().length > 0;

      if (useNiaStream) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
          });
          const ctx = this.getAudioCtx();
          if (ctx.state === "suspended") { try { await ctx.resume(); } catch (_) {} }
          const src = ctx.createMediaStreamSource(stream);
          const proc = ctx.createScriptProcessor(2048, 1, 1);
          const zeroGain = ctx.createGain();
          zeroGain.gain.value = 0;
          TableUI.showVoiceHud("listening", "…");
          const singleStartAt = Date.now();
          let singleSpeechAt = 0;
          let singleLastLoudAt = 0;
          let singleLastRms = 0;
          let singleLastText = "";
          let singleLastTextAt = 0;
          let singleGotFinal = false;
          let singleAutoTimer = null;
          const singleRate = ctx.sampleRate || 48000;
          const maxSingleChunks = Math.ceil((singleRate * 16) / 2048);
          const singlePcmChunks = [];
          let singleLoudFrames = 0;
          const session = this.createNiaAsrSession({
            lang: this.getEffectiveNiaAsrLang(),
            onPartial: (txt, isFinal) => {
              const cleanTxt = String(txt || "").trim();
              if (cleanTxt && cleanTxt !== singleLastText) {
                singleLastText = cleanTxt;
                singleLastTextAt = Date.now();
                if (!singleSpeechAt) singleSpeechAt = singleLastTextAt;
              }
              if (isFinal && cleanTxt) singleGotFinal = true;
              if (cleanTxt && $("cmdInput")) $("cmdInput").value = cleanTxt;
              if (cleanTxt) TableUI.showVoiceHud("listening", cleanTxt);
            }
          });
          this.singleNiaSession = session;
          let stopped = false;
          proc.onaudioprocess = (ev) => {
            if (stopped) return;
            const input = ev.inputBuffer.getChannelData(0);
            let sumSq = 0;
            for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
            const rms = Math.sqrt(sumSq / input.length);
            singleLastRms = rms;
            if (rms > 0.016) {
              const tNow = Date.now();
              if (!singleSpeechAt) singleSpeechAt = tNow;
              singleLastLoudAt = tNow;
              singleLoudFrames += 1;
            }
            const copy = new Float32Array(input.length);
            copy.set(input);
            if (singlePcmChunks.length < maxSingleChunks) singlePcmChunks.push(copy);
            session.pushFloat32(copy, singleRate);
          };
          src.connect(proc);
          proc.connect(zeroGain);
          zeroGain.connect(ctx.destination);

          /* 单次模式智能自动提交：说完停顿后自动结束并提交，连接词结尾自动宽限，也可随时手动点发送 */
          singleAutoTimer = setInterval(() => {
            if (stopped) return;
            const tNow = Date.now();
            const totalElapsed = tNow - singleStartAt;
            if (!singleSpeechAt && !singleLastText) {
              if (totalElapsed >= 7000 && this.isRecording && this.singleNiaStop) {
                this.isRecording = false;
                btn.classList.remove("recording");
                btn.innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
                const fn = this.singleNiaStop; this.singleNiaStop = null; fn(false);
              }
              return;
            }
            const speechDur = tNow - (singleSpeechAt || singleStartAt);
            const silenceMs = singleLastLoudAt ? (tNow - singleLastLoudAt) : 0;
            const incomplete = singleLastText ? this.isIncompleteTrailingPhrase(singleLastText) : false;
            const tailLimit = incomplete ? 1350 : (singleGotFinal ? 680 : 880);
            const textIdleMs = singleLastTextAt ? (tNow - singleLastTextAt) : 0;
            const textLimit = incomplete ? 1900 : (singleGotFinal ? 950 : 1350);
            const shouldAutoSubmit = (speechDur >= 450 && singleLastText && silenceMs >= tailLimit)
              || (speechDur >= 550 && singleLastText && textIdleMs >= textLimit && singleLastRms < 0.032)
              || totalElapsed >= 12000;
            if (shouldAutoSubmit && this.isRecording && this.singleNiaStop) {
              this.isRecording = false;
              btn.classList.remove("recording");
              btn.innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
              const fn = this.singleNiaStop; this.singleNiaStop = null; fn(false);
            }
          }, 100);

          this.singleNiaStop = async (silentAbort = false) => {
            if (stopped) return;
            stopped = true;
            if (singleAutoTimer) { clearInterval(singleAutoTimer); singleAutoTimer = null; }
            try { proc.disconnect(); proc.onaudioprocess = null; } catch (_) {}
            try { zeroGain.disconnect(); } catch (_) {}
            try { src.disconnect(); } catch (_) {}
            try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
            this.singleNiaSession = null;
            if (silentAbort) {
              this.resumeCallAfterRecord = false;
              try { session.abort(); } catch (_) {}
              return;
            }
            const shouldResume = this.resumeCallAfterRecord;
            this.resumeCallAfterRecord = false;
            const maybeResume = () => {
              if (shouldResume && !this.callActive && !this.isRecording) {
                setTimeout(() => { if (!this.callActive && !this.isRecording) this.startContinuousAsrCall(true); }, 450);
              }
            };
            try {
              let cachedSingleWav = null;
              const getSingleFallbackWav = () => {
                if (cachedSingleWav !== null) return cachedSingleWav;
                if (singlePcmChunks.length === 0) {
                  cachedSingleWav = "";
                  return cachedSingleWav;
                }
                cachedSingleWav = this.encodePcmToWavBase64(singlePcmChunks, singleRate) || "";
                return cachedSingleWav;
              };
              const text = String(await session.finish() || "").trim();
              if (text) {
                if ($("cmdInput")) $("cmdInput").value = text;
                DebugLog.add("ASR", "SenseTime Nia 单次识别完成", text);
                onResult({
                  text,
                  fromVoice: true,
                  manualVoice: true,
                  fallbackAudioGetter: getSingleFallbackWav,
                  fallbackAudioMime: "audio/wav"
                });
              } else if (singleLoudFrames >= 4 && Boolean(ConfigManager.buildRestUrl(ConfigManager.data.llmModel))) {
                const rescueWav = getSingleFallbackWav();
                if (rescueWav) {
                  DebugLog.add("ASR", "Nia 单次转写为空，启用原始音频多模态兜底", `frames=${singleLoudFrames}`);
                  TableUI.showVoiceHud("llm", t("音声再解析中…", "音频复核解析中…"));
                  onResult({ audioBase64: rescueWav, audioMime: "audio/wav", fromVoice: true, manualVoice: true });
                } else {
                  TableUI.setReferee("音声が認識できませんでした。もう一度お試しください。", "未能识别到有效语音，请再按一次重试。");
                }
              } else {
                TableUI.setReferee("音声が認識できませんでした。もう一度お試しください。", "未能识别到有效语音，请再按一次重试。");
              }
            } catch (err) {
              const reason = err?.code || err?.message || "Nia ASR 接続失敗";
              DebugLog.add("ERR", `SenseTime Nia 单次识别失败 (${reason})`);
              const switched = this.fallbackToChromeAsr(reason);
              TableUI.setReferee(
                switched
                  ? `SenseTime Nia 音声認識失敗（${reason}）のため Chrome 音声認識へ切替しました。もう一度お試しください。`
                  : `SenseTime Nia 音声認識失敗（${reason}）。テキスト入力をご利用ください。`,
                switched
                  ? `SenseTime Nia 识别失败（${reason}），已自动切换浏览器语音识别，请再按一次重试。`
                  : `SenseTime Nia 识别失败（${reason}），请改用文字输入或点击卡牌。`
              );
            } finally {
              maybeResume();
            }
          };

          this.isRecording = true;
          btn.classList.add("recording");
          btn.innerHTML = `${SVG_ICONS.stop}${escapeHtml(t("送信", "发送"))}`;
        } catch (e) {
          TableUI.setReferee(
            "マイクの使用が許可されていません。テキスト入力をご利用ください。",
            "未获得麦克风权限，请使用下方输入框或直接点击卡牌。"
          );
        }
      } else if (useDirectAudio) {
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
          btn.innerHTML = `${SVG_ICONS.stop}${escapeHtml(t("送信", "发送"))}`;
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
        this.chromeRec.lang = this.getEffectiveChromeAsrLang();
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
          btn.innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
          TableUI.setReferee(
            `音声認識エラー（${ev.error || "unknown"}）。もう一度お試しください。`,
            `浏览器语音识别出错（${ev.error || "未知错误"}），请重试或改用文字输入。`
          );
        };
        this.chromeRec.onend = () => {
          this.isRecording = false;
          btn.classList.remove("recording");
          btn.innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
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
        btn.innerHTML = `${SVG_ICONS.stop}${escapeHtml(t("停止", "停止"))}`;
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

    /** 混合解析：明确文本指令优先本地直出，复杂口语/误识别文本自动附带原始音频由多模态 Gemini 兜底复核 */
    async parse({ text = "", audioBase64 = null, audioMime = "audio/webm", fromVoice = false, fallbackAudioGetter = null, fallbackAudioMime = "audio/wav" }, boardSnapshot, conversationContext = null) {
      const cfg = ConfigManager.data;
      const url = ConfigManager.buildRestUrl(cfg.llmModel);
      const parseOpts = { isVoice: Boolean(fromVoice || audioBase64) };

      /* 文本/流式识别结果优先走本地 0ms 快通道：全部子句均命中或离线模式时直出；若含未识别子句且配置了云端 LLM 则交由云端补全 */
      if (!audioBase64 && text) {
        const fast = this.localParse(text, boardSnapshot, conversationContext, parseOpts);
        const hasUnmatched = Array.isArray(fast._unmatchedClauses) && fast._unmatchedClauses.length > 0;
        const canShortCircuit = fast.status === "confirm" || fast.status === "chat"
          || (fast.status === "execute" && (!hasUnmatched || !url || cfg.asrMode === "chrome_local"));
        if (canShortCircuit) {
          DebugLog.add("NLU", `本地快通道命中 (${fast.status})`, { text, actions: fast.actions });
          if (typeof TableUI !== "undefined" && TableUI.showVoiceHud) {
            TableUI.showVoiceHud("fast", text);
          }
          return fast;
        }
      }

      if (!url || cfg.asrMode === "chrome_local") {
        const localRes = this.localParse(text, boardSnapshot, conversationContext, parseOpts);
        DebugLog.add("NLU", `离线本地解析 (${localRes.status})`, { text, actions: localRes.actions });
        if (typeof TableUI !== "undefined" && TableUI.hideVoiceHud) TableUI.hideVoiceHud();
        return localRes;
      }

      if (typeof TableUI !== "undefined" && TableUI.showVoiceHud) {
        TableUI.showVoiceHud("llm", text || t("音声データ", "语音音频"));
      }

      /* 精简发往 LLM 的盘面快照，压缩输入 token 数以显著降低首字与整体解析延迟 */
      const compactUnit = (u) => u ? { id: u.id, hp: u.hp, e: u.energies } : null;
      const compactBoard = boardSnapshot ? {
        turn: boardSnapshot.turn,
        phase: boardSnapshot.phase,
        used: { e: boardSnapshot.energyUsedThisTurn, s: boardSnapshot.supporterUsedThisTurn, r: boardSnapshot.retreatedThisTurn },
        p: {
          act: compactUnit(boardSnapshot.player?.active),
          ben: (boardSnapshot.player?.bench || []).map(compactUnit),
          hand: boardSnapshot.player?.hand || []
        },
        e: {
          act: compactUnit(boardSnapshot.enemy?.active),
          ben: (boardSnapshot.enemy?.bench || []).map(compactUnit)
        }
      } : {};
      const parts = [{ text: `盤面:${JSON.stringify(compactBoard)}` }];

      /* 仅在真正处于追问态（pending 非空）时才向云端注入追问上下文，杜绝上一回合污染 */
      if (conversationContext && conversationContext.pending) {
        const ctxLines = [
          `追問状態: ${conversationContext.pending.type}（元発話:「${conversationContext.pending.originalUtterance || ""}」／質問:「${conversationContext.pending.promptJa || ""}」）`
        ];
        if (conversationContext.lastPlayerUtterance) {
          ctxLines.push(`直前発話:「${conversationContext.lastPlayerUtterance}」`);
        }
        parts.push({ text: `追問コンテキスト:\n${ctxLines.join("\n")}` });
      }

      const rescueB64 = (!audioBase64 && typeof fallbackAudioGetter === "function") ? fallbackAudioGetter() : "";
      const usedAudioRescue = Boolean(!audioBase64 && rescueB64);
      if (audioBase64) {
        parts.push({ text: "以下の音声（日本語・中国語どちらでも可）を聞き取り、ゲーム操作JSONを返してください。「防御」「ぼうぎょ」「攻撃」「交代」「撤退」「水」「火」「雷」「左」「はい」「いいえ」などの短い明確なゲーム指示も必ず有効な操作として認識し、ignore にしないでください。「〇〇を召喚」「〇〇を出す」「ベンチに出す」「召唤〇〇」「派〇〇上场」は必ず PLAY_BENCH であり、絶対に END_TURN にしないでください。無音・環境音・効果音・クリック音・ため息・意味のない相槌（えっと/嗯/啊等）のみの場合は、操作を捏造せず {\"transcript\":\"\",\"status\":\"ignore\",\"actions\":[],\"reply_ja\":\"\",\"reply_zh\":\"\",\"rival_ja\":\"\",\"rival_zh\":\"\"} を返してください。" });
        parts.push({ inlineData: { mimeType: audioMime, data: audioBase64 } });
      } else if (rescueB64) {
        const fuzzyHints = SpecEngine.extractFuzzyHints(text);
        const hintLine = fuzzyHints.length ? `\n（候補: ${fuzzyHints.join(" / ")}）` : "";
        parts.push({ text: `参考ASR文字起こし:「${text}」（誤認識の可能性あり。必ず添付音声の実際の発音を優先して正確に聞き取り、ゲーム操作JSONを返してください）${hintLine}` });
        parts.push({ inlineData: { mimeType: fallbackAudioMime || "audio/wav", data: rescueB64 } });
        DebugLog.add("NLU", "Nia 文本未命中本地快通道，附带原始音频多模态复核", text);
      } else {
        const fuzzyHints = SpecEngine.extractFuzzyHints(text);
        const hintLine = fuzzyHints.length ? `\n（候補: ${fuzzyHints.join(" / ")}）` : "";
        parts.push({ text: `発話:「${text}」${hintLine}` });
      }

      const genCfg = {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 260
      };
      const thinkCfg = ConfigManager.buildThinkingConfig(cfg.llmModel);
      if (thinkCfg) genCfg.thinkingConfig = thinkCfg;

      const t0 = Date.now();
      const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (ac && typeof BattleEngine !== "undefined") BattleEngine.activeAbortCtrl = ac;
      let timedOut = false;
      const fetchTimer = ac ? setTimeout(() => { timedOut = true; ac.abort(); }, 8000) : null;
      try {
        if (!this._cachedSysPrompt || this._cachedSysPromptSource !== SpecEngine.sourceLabel) {
          this._cachedSysPrompt = SpecEngine.buildSystemPrompt();
          this._cachedSysPromptSource = SpecEngine.sourceLabel;
        }
        const uiLangNow = getUiLang();
        const replyKey = uiLangNow === "zh" ? "reply_zh" : "reply_ja";
        const replyRe = new RegExp(`"${replyKey}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
        let prefetchedReply = false;
        const streamRes = await ConfigManager.streamVertexText(cfg.llmModel, {
          systemInstruction: { parts: [{ text: this._cachedSysPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: genCfg
        }, {
          signal: ac ? ac.signal : undefined,
          onDelta: (_delta, acc) => {
            if (prefetchedReply) return;
            const m = acc.match(replyRe);
            if (m && m[1]) {
              prefetchedReply = true;
              try {
                const replyText = JSON.parse(`"${m[1]}"`);
                if (replyText && replyText.length >= 2) {
                  const firstClause = VoiceEngine.splitIntoClauses(replyText, uiLangNow)[0] || replyText;
                  VoiceEngine.prefetch(firstClause, "referee", uiLangNow);
                }
              } catch (_) {}
            }
          }
        });
        if (VoiceEngine.apiAsrBlocked && cfg.asrMode === "gemini_audio") VoiceEngine.onOnlineApiRecovered();
        const parsed = this.safeParseJson(streamRes.text || "");
        if (usedAudioRescue) parsed._usedAudioRescue = true;
        DebugLog.add("NLU", `Vertex ${cfg.llmModel}${streamRes.streamed ? " [SSE]" : ""} (${Date.now() - t0}ms, ${parsed.status})`, { transcript: parsed.transcript, actions: parsed.actions });
        return parsed;
      } catch (e) {
        const isUserCancelled = e?.name === "AbortError" && !timedOut;
        if (isUserCancelled) {
          DebugLog.add("NLU", `已取消旧 LLM 解析 (${Date.now() - t0}ms)`, "被玩家新操作或重开安全抢占");
          return { transcript: "", status: "aborted", actions: [], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
        }
        const errMsg = timedOut ? "timeout" : (e?.message || "network");
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
        if (ac && typeof BattleEngine !== "undefined" && BattleEngine.activeAbortCtrl === ac) {
          BattleEngine.activeAbortCtrl = null;
        }
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
        if (/中央|真ん中|中间|中位|备战中|(?:^|[\s・,，、])中(?:$|[\s・,，、])/.test(clause)) {
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
      if (/中央|真ん中|中间|中位|备战中|(?:^|[\s・,，、])中(?:$|[\s・,，、])/.test(clause)) return `${side}_bench_1`;
      if (/右/.test(clause)) return `${side}_bench_2`;
      if (/前|バトル場|前排|战斗区/.test(clause)) return `${side}_active`;
      if (/一番HPが低|一番弱|HPが低|弱ってる|血最少|残血|最弱|受伤/.test(clause) && pool.length) {
        const sorted = [...pool].sort((a, b) => a.inst.hp - b.inst.hp);
        return sorted[0].slot;
      }
      return null;
    },

    /** 升级版多步顺序指令切分器：支持标点/连词 + 日语动词て形无标点连读 + 中文无标点连读边界（不拆散[道具+对象]短语，精准识别上药/上能/召唤笛拖换/战斗） */
    splitComboClauses(fixedText) {
      let s = String(fixedText || "").trim();
      if (!s) return [];
      /* 1. 日语动作动词 て形无标点连读边界（如 〜をベンチに出して〜に炎エネをつけて〜で攻撃） */
      s = s.replace(
        /(出して|だして|置いて|おいて|入れて|いれて|つけて|付けて|貼って|はって|使って|つかって|飲んで|のんで|引いて|ひいて|回収して|回復して|かいふくして|交代して|入れ替えて|引きずり出して|呼び出して|呼んで|よんで|攻撃して|防御して|ぼうぎょして)(?=[\u3040-\u30ff\u4e00-\u9fffA-Za-z0-9]{2,})/g,
        "$1|SPLIT|"
      );
      /* 2. 中文无标点连读边界（兼容 applyLocalTypoFix 归一化词，保留“用伤药给炎狐回血”“用召唤笛拖对手换怪物”等动宾完整性） */
      s = s.replace(
        /(放到?(?:备战区?|ベンチ)|放后排|放上场|下怪|上场|(?:(?:贴|充|上|加|附着?)[个张点]?(?:(?:火|炎|水|雷)?(?:能量?|エネルギー|エネ))|贴能|充能|(?:火|炎|水|雷)能)|(?:(?:给|用|使|吃|喝|嗑)?(?:伤药|きずぐすり)(?:回血|补血|加血|治疗)?|回血|补血|加血)|(?:(?:用|使|吹)?(?:召唤笛|呼叫笛|よびだし笛)(?:(?:把|拖|拉|让|叫|逼)(?:对手|对方|对面)?[^，。！？,.!?]{0,10}(?:换(?:到|成)?(?:怪物|怪兽|精灵|怪|人|卡|前排)?|拉上[来场]?|拖上[来场]?|拽上[来场]?|出来|上来|出战))?|拖(?:对手|对面|对方)换(?:怪物|怪兽|精灵|怪|人)|强制换人)|(?:(?:用|使)?(?:补给包|補給バッグ|力量徽章|パワーバッジ|能量回收|エネ回収)|抽两?张?牌?|加攻|增伤)|撤退|换人)(?=(?:然后|接着|之后|随后|最后|并且|而且|顺便|并|再|去)?(?:给[^，。！？,.!?回补治]{1,4}(?:贴|充|上|加|用|吃|喝|吹|放|换)|把[^，。！？,.!?]{1,5}(?:贴|放|派|换|拉|拖)|用|使|吃|喝|吹|贴|充|上[个张点]?(?:药|伤药|きずぐすり|火|炎(?!狐|龙)|水(?!龟)|雷(?!狮|鸟)|电|能|エネルギー|エネ|场)|加(?:一个?|一?张|一?点|[个张点])?(?:能|火|水|雷|电|攻|血)|补|抽|摸|派|放|发动|召唤笛|呼叫笛|よびだし笛|伤药|きずぐすり|补给包|補給バッグ|力量徽章|パワーバッジ|能量回收|エネ回収|(?:炎|水|雷)?エネルギー|(?:火|炎|水|雷|电)能量?|战斗(?!区)|攻击|进攻|开打|开战|防御(?!区)|防守|守住|撤退|结束回合))/g,
        "$1|SPLIT|"
      );
      return s
        .split(/(?:\|SPLIT\||してから|てから|そのあと|その後|それから|そして|あとで|次に|然后|接着|之后|随后|并且|而且|顺便|接下来|另外|同时|最后(?=(?:用|使|贴|上|放|出|派|打|攻|防|守|换|撤|抽|回|吹|战|发动))|再用|再(?=[贴上用放出派打攻防守换撤抽回拉吹给把让去开战])|、|，|,|。|！|!)/)
        .map((seg) => seg.trim())
        .filter(Boolean);
    },

    /** 基于当前手牌与战斗区盘面解析口语简写技能（1技能/2技能/大招/必殺技/上の技/下の技） */
    resolveColloquialSkillFromClause(clause, board) {
      const act = board?.player?.active;
      if (!act) return null;
      const def = SpecEngine.getMonster(act.id);
      if (!def || !Array.isArray(def.skills) || def.skills.length === 0) return null;
      if (/(?:1技能|一技能|第一技能|第一个技能|1番目の技|１番目の技|1番上の技|１番上の技|上の技|最初の技|上面的技能|第一个招)/.test(clause)) {
        return def.skills[0] || null;
      }
      if (/(?:2技能|二技能|第二技能|第二个技能|2番目の技|２番目の技|下の技|大招|必殺技|必杀技|终极技|大技|下面的技能|第二个招)/.test(clause)) {
        return def.skills[1] || def.skills[0] || null;
      }
      return null;
    },

    /** 识别问句与盘面状态查询（防止「我有火能量吗」「前排有能量吗」「エネルギーある？」误触贴能/道具/攻击） */
    isQuestionOrStatusQuery(rawText) {
      const s = String(rawText || "").trim();
      if (!s) return false;
      if (/(有没有|还有没有|有.*吗|够不够|能.*吗|可以.*吗|能不能|是不是|几个|几张|多少|啥属性|什么属性|缺什么|差几个|差多少)/.test(s)) return true;
      if (/(ある[？?]?$|ありますか|いる[？?]?$|足りる|足りますか|何枚|いくつ|どのくらい|使える[？?]?$|使えますか|倒せる[？?]?$|倒せますか|持ってる[？?]?$|持っていますか)/.test(s)) return true;
      if (/[？?]$/.test(s) && !/(攻撃|攻击|貼|贴|出|使|交代|撤退|終了|结束)/.test(s)) return true;
      return false;
    },

    /** 从玩家口语或ASR文本中提取明确指定的能量卡ID（剥离怪兽名与技能名后再判断属性/颜色/谐音，防止“给水龟加火能量”被水龟元素误导） */
    resolveEnergyCardFromText(rawText) {
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();
      if (!fixed) return null;
      if (/炎エネルギー/.test(fixed)) return "energy_fire";
      if (/水エネルギー/.test(fixed)) return "energy_water";
      if (/雷エネルギー/.test(fixed)) return "energy_thunder";
      const scrubbed = fixed
        .replace(/(?:カエンリュウ|タイカイザメ)(?:\s*ex)?|ヒノキツネ|ミズガメ|ライジシ|マグマ犬|アワウオ|エレキ鳥|炎龙(?:\s*ex)?|火龙(?:\s*ex)?|沧海鲨(?:\s*ex)?|炎狐|火狐狸?|水龟|小水龟|乌龟|海龟|雷狮|电狮|喷火龙|熔岩犬|泡沫鱼|泡泡鱼|电光鸟|大鲨鱼/gi, " ")
        .replace(/メテオ炎|かえん弾|みず撃ち|こうら壁|でんき玉|フレア爪|ひのこ|サンダー|火花|炎弹|水击|甲壳壁|电球|落雷|烈焰爪|陨星炎/gi, " ");
      if (/(?:雷|电|闪电|电气|雷电|黄|かみなり|でんき|電気|きいろ|サンダー|イエロー|\bthunder\b|\belectric\b|\byellow\b|(?:类|累|来|店)(?=(?:的|系)?能))/i.test(scrubbed)) {
        return "energy_thunder";
      }
      if (/(?:水|冰|蓝|青|みず|あお|ウォーター|ブルー|\bwater\b|\bblue\b|(?:谁|税|睡)(?=(?:的|系)?能))/i.test(scrubbed)) {
        return "energy_water";
      }
      if (/(?:炎|火|火焰|烈火|赤|红|ほのお|あか|ファイア|ファイアー|レッド|\bfire\b|\bred\b|(?:活|伙|货)(?=(?:的|系)?能))/i.test(scrubbed)) {
        return "energy_fire";
      }
      return null;
    },

    /** 本地双语指令解析（结合盘面上下文 0ms 口语快通道、无标点多步连招拆解与模糊匹配） */
    localParse(rawText, board, conversationContext = null, opts = null) {
      const isVoice = Boolean(opts && opts.isVoice);
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();

      if (/^(?:キャンセル|やめる|取り消|取消|算了)[。！!？?]?$/.test(fixed)) {
        return { transcript: fixed, status: "execute", actions: [{ type: "CANCEL" }], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
      }
      if (/(今の状況|状況は|HPいくつ|残りHP|あと何HP|残りサイド|サイド何枚|当前状态|血量|还有多少血|看看血量|对面多少血|场上情况|局面如何|还差几张奖赏)/.test(fixed)) {
        return { transcript: fixed, status: "execute", actions: [{ type: "INSPECT" }], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
      }
      if (this.isQuestionOrStatusQuery(fixed)) {
        return { transcript: fixed, status: "clarify", actions: [], reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "" };
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
      const clauses = this.splitComboClauses(strippedFuture);

      /* 辅助：从当前真实手牌提取合法卡牌，支持口语简写与复数批量操作 0ms 补全 */
      const liveHand = (typeof BattleEngine !== "undefined" && BattleEngine.state?.player?.hand) ? BattleEngine.state.player.hand : [];
      const handMonIds = liveHand.filter((id) => Boolean(SpecEngine.getMonster(id)));
      const uniqueHandEnergies = Array.from(new Set(liveHand.filter((id) => id.startsWith("energy_"))));
      const uniqueHandMons = Array.from(new Set(handMonIds));
      const uniqueHandTools = Array.from(new Set(liveHand.filter((id) => {
        const it = SpecEngine.getItem(id);
        return it && it.category !== "energy";
      })));
      const emptyBenchCount = Math.max(0, 3 - (Array.isArray(board?.player?.bench) ? board.player.bench.filter(Boolean).length : 0));
      const parsePluralCount = (clause, maxAvail) => {
        const cap = Math.max(1, maxAvail || 1);
        if (/(全部|所有|全都|统统|一起|全員|ぜんぶ|すべて|まとめて|みんな|(?<![不别没])都(?:放|出|派|上|下|用|喝|吃|使|给|贴))/.test(clause)) return cap;
        if (/(三[张只个次瓶回枚体]|3[张只个次瓶回枚体]|３[枚体回])/.test(clause)) return Math.min(3, cap);
        if (/(两[张只个次瓶回枚体]|二[张只个次瓶回枚体]|2[张只个次瓶回枚体]|２[枚体回])/.test(clause)) return Math.min(2, cap);
        return 1;
      };

      const actions = [];
      const unmatchedEntries = [];
      const isFillerClause = (seg) => {
        const core = String(seg || "").replace(/[\s　「」『』（）()【】\[\]、，。.,！!？?・\-ー…~～]/g, "");
        return !core || /^(?:好的|可以|行|嗯|啊|呀|吧|呢|哦|嘛|哈|呐|好吗|行吗|一下|えっと|えー|まあ|あの|はい|うん)$/.test(core);
      };
      for (let ci = 0; ci < clauses.length; ci++) {
        const c = clauses[ci];
        const fuzzyItem = SpecEngine.matchItem(c);

        if (/(エネ回収|エネルギー回収|かいしゅう|トラッシュからエネ|捨て札からエネ|能量回收|回收能量|从弃牌区拿能量|捡回能量|捞能量|拿回能量)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_recycle")) {
          const handCnt = liveHand.filter((id) => id === "item_recycle").length;
          const repeat = parsePluralCount(c, handCnt || 1);
          for (let r = 0; r < repeat; r++) actions.push({ type: "USE_ITEM", card_id: "item_recycle", target: null, _clause: c, _clauseIdx: ci });
          continue;
        }
        if (/(エネルギー|えねるぎー|エネ|えね|能量|贴能|火能|水能|雷能|炎能|电能|闪电能量|雷电能量|火焰能量|火系能量|水系能量|雷系能量|电系能量|充能|(?:加|上|贴|充)(?:一个?|一?张|一?点|一?颗|[个张点颗])?(?:电|闪电|红|蓝|黄|火|炎(?!狐|龙)|水(?!龟)|雷(?!狮|鸟))的?(?:能|能量)?|给.{0,6}(?:贴|充|加|上)(?:能|火|水|雷|电)|贴[个张]?(?:炎|火|水|雷|电)|貼って|はって|付けて|つけて|贴上|给它贴)/.test(c) || (fuzzyItem && fuzzyItem.category === "energy")) {
          const cardId = this.resolveEnergyCardFromText(c) || (fuzzyItem && fuzzyItem.category === "energy" ? fuzzyItem.id : null);
          const target = this.resolveSlotFromText(c, "player", board);
          actions.push({ type: "ATTACH_ENERGY", card_id: cardId, target, _clause: c, _clauseIdx: ci });
          continue;
        }
        if (/(よびだし笛|呼び出し笛|ふえ|引っ張り|引きずり出|強制交代|前に引き|召唤笛|呼叫笛|笛子|吹笛|吹口?哨|哨子|强拉|强迫.{0,4}换|强行.{0,4}换|拖.{0,4}(?:对手|对方|对面|敌方|后排)|拉.{0,4}(?:对手|对方|对面)|拉上来|拉出来|拉上场|拽.{0,4}(?:上来|出来)|逼.{0,3}(?:对手|对面|对方)换|(?:对手|对面|对方).{0,4}换(?:怪物?|怪兽|精灵|人|卡)|把(?:对手|对面|对方).{0,8}(?:拉|拖|拽|换))/.test(c) || (fuzzyItem && fuzzyItem.id === "item_flute")) {
          actions.push({ type: "USE_ITEM", card_id: "item_flute", target: this.resolveSlotFromText(c, "enemy", board), _clause: c });
          continue;
        }
        const matchedSkillEarly = SpecEngine.matchSkill(c) || this.resolveColloquialSkillFromClause(c, board);
        const allMatchedPlayerMons = SpecEngine.matchAllMonsters(c, "player");
        const matchedPlayerMon = allMatchedPlayerMons[0] || SpecEngine.matchMonster(c, "player");
        const isSummonClause = /(ベンチに出|ベンチに置|ベンチに入|べんちに出|後ろに出|後ろに置|場に出|召喚|しょうかん|を出す|を出して|をだす|をだして|を置く|を置いて|备战区|放到?备战|放上备战|下怪|放上场|放到场上|放到后排|派上后排|派上场|上场|出战|召唤|^(?:出して|置いて|放下去|放上去)$)/.test(c)
          && !matchedSkillEarly && !this.hasExplicitDefendIntent(c)
          && !/(狙撃|狙击|点杀|交代|こうたい|撤退|てったい|换人|换上|换下|撤下去|きずぐすり|回復|かいふく|伤药|上药|回血|奶|对手|对面|对方|拖|强拉|吹笛)/.test(c);
        const isShortMonDeploy = Boolean(matchedPlayerMon) && !matchedSkillEarly && !this.hasExplicitDefendIntent(c)
          && /(出|放|派|上|下|置)/.test(c)
          && !/(攻撃|こうげき|攻击|战斗|技|招|能量|エネ|きずぐすり|回復|かいふく|伤药|上药|奶|交代|こうたい|撤退|てったい|换|撤下去|拉回)/.test(c);
        if (isSummonClause || isShortMonDeploy) {
          const hasPluralAll = /(全部|所有|全都|统统|一起|能放的|全員|ぜんぶ|すべて|まとめて|みんな|(?<![不别没])都(?:放|出|派|上|下|置))/.test(c);
          const explicitCount = /(三[张只个回枚体]|3[张只个回枚体]|３[枚体])/.test(c) ? 3 : (/(两[张只个回枚体]|二[张只个回枚体]|2[张只个回枚体]|２[枚体])/.test(c) ? 2 : 0);
          if (allMatchedPlayerMons.length >= 2) {
            /* 点名多只怪兽一次放备战区（如“把雷狮和水龟放到备战区”“ライシシとミズガメをベンチに出して”） */
            const remainingHand = handMonIds.slice();
            let pushed = 0;
            for (const m of allMatchedPlayerMons) {
              if (emptyBenchCount > 0 && pushed >= emptyBenchCount) break;
              const idx = remainingHand.indexOf(m.id);
              if (remainingHand.length === 0 || idx !== -1) {
                if (idx !== -1) remainingHand.splice(idx, 1);
                actions.push({ type: "PLAY_BENCH", card_id: m.id, _plural: true, _clause: c });
                pushed += 1;
              }
            }
            if (pushed === 0) actions.push({ type: "PLAY_BENCH", card_id: allMatchedPlayerMons[0].id, _clause: c });
          } else if (matchedPlayerMon && (hasPluralAll || explicitCount >= 2)) {
            /* 点名同一种怪兽多只（如“把两只雷狮都放到备战区”） */
            const copiesInHand = handMonIds.filter((id) => id === matchedPlayerMon.id).length;
            const want = hasPluralAll ? (copiesInHand || 1) : Math.min(explicitCount, copiesInHand || explicitCount);
            const cap = emptyBenchCount > 0 ? Math.min(want, emptyBenchCount) : 1;
            for (let k = 0; k < cap; k++) actions.push({ type: "PLAY_BENCH", card_id: matchedPlayerMon.id, _plural: true, _clause: c });
          } else if (!matchedPlayerMon && (hasPluralAll || explicitCount >= 2) && handMonIds.length > 0) {
            /* 批量将手牌全部或指定数量怪兽放入备战区（如“把所有怪兽放到备战区”“手札のモンスターを全部ベンチに出して”） */
            const want = hasPluralAll ? handMonIds.length : Math.min(explicitCount, handMonIds.length);
            const cap = emptyBenchCount > 0 ? Math.min(want, emptyBenchCount) : 1;
            for (let k = 0; k < cap; k++) actions.push({ type: "PLAY_BENCH", card_id: handMonIds[k], _plural: true, _clause: c });
          } else {
            const deployId = matchedPlayerMon ? matchedPlayerMon.id : (uniqueHandMons.length === 1 ? uniqueHandMons[0] : null);
            actions.push({ type: "PLAY_BENCH", card_id: deployId, _clause: c });
          }
          continue;
        }
        if (/(きずぐすり|回復|かいふく|ヒール|ポーション|体力回復|HP回復|伤药|上药|回血|补血|治疗|加血|加点血|奶一口|奶一下|吃药|喝药|嗑药|用个?药|吃瓶?药|喝[口瓶]?药|贴伤药|飲む|飲んで|のむ|のんで)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_potion")) {
          const handCnt = liveHand.filter((id) => id === "item_potion").length;
          const repeat = parsePluralCount(c, handCnt || 1);
          const target = this.resolveSlotFromText(c, "player", board);
          for (let r = 0; r < repeat; r++) actions.push({ type: "USE_ITEM", card_id: "item_potion", target, _clause: c });
          continue;
        }
        if (/(補給バッグ|ほきゅう|ドロー|2枚引|カードを引|补给包|抽牌|抽两张|抽2张|摸两张|摸2张|摸牌|过牌|补牌)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_bag")) {
          actions.push({ type: "USE_ITEM", card_id: "item_bag", target: null, _clause: c });
          continue;
        }
        if (/(パワーバッジ|ぱわーばっじ|攻撃力アップ|火力アップ|バフ|力量徽章|加攻|加20攻|加伤害|增伤|強化|强化)/.test(c) || (fuzzyItem && fuzzyItem.id === "item_power")) {
          const handCnt = liveHand.filter((id) => id === "item_power").length;
          const repeat = parsePluralCount(c, handCnt || 1);
          for (let r = 0; r < repeat; r++) actions.push({ type: "USE_ITEM", card_id: "item_power", target: null, _clause: c });
          continue;
        }
        if (/^(?:使う|使って|つかう|つかって|用一下|使用道具|用道具)$/.test(c) && uniqueHandTools.length === 1) {
          actions.push({ type: "USE_ITEM", card_id: uniqueHandTools[0], target: null, _clause: c });
          continue;
        }
        if (/(交代|こうたい|入れ替|いれかえ|下げて|さげて|逃げて|にげる|撤退|てったい|チェンジ|スイッチ|ベンチに戻|换人|换上|换下|退回|下场|撤下去|拉回后排|切回|切换|把.{0,8}换(?:到|上|下|成|为|出)|换.{0,6}(?:上|下|成|为|出))/.test(c)
          && !/(?:对手|对面|对方|敌方)/.test(c)) {
          let target = this.resolveSlotFromText(c, "player", board);
          if (target === "player_active") target = null;
          actions.push({ type: "RETREAT", target, _clause: c });
          continue;
        }
        if (this.hasExplicitDefendIntent(c)) {
          actions.push({ type: "DEFEND", target: "player_active", _clause: c });
          continue;
        }

        if (matchedSkillEarly) {
          actions.push({ type: "ATTACK", skill_name: matchedSkillEarly.name_ja, target: this.resolveSlotFromText(c, "enemy", board), _clause: c });
          continue;
        }
        if (this.hasExplicitAttackIntent(c)) {
          actions.push({ type: "ATTACK", skill_name: null, target: this.resolveSlotFromText(c, "enemy", board), _clause: c });
          continue;
        }
        if (this.hasExplicitEndTurnIntent(c, isVoice)) {
          actions.push({ type: "END_TURN", _clause: c });
          continue;
        }
        if (!isFillerClause(c)) unmatchedEntries.push({ text: c, idx: ci });
      }
      /* 合并相邻能量属性补充子句（如“我要加能量，火的”“火能量，贴给炎狐”），再按单一手牌能量兜底 */
      const consumedUnmatched = new Set();
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a || a.type !== "ATTACH_ENERGY") continue;
        if (!a.card_id || !a.target) {
          for (const ue of unmatchedEntries) {
            if (consumedUnmatched.has(ue.idx)) continue;
            if (ue.idx === a._clauseIdx + 1 || ue.idx === a._clauseIdx - 1) {
              const eCard = !a.card_id ? this.resolveEnergyCardFromText(ue.text) : null;
              const eTarget = !a.target ? this.resolveSlotFromText(ue.text, "player", board) : null;
              if (eCard || eTarget) {
                if (eCard) a.card_id = eCard;
                if (eTarget) a.target = eTarget;
                a._clause = ue.idx < a._clauseIdx ? `${ue.text} ${a._clause}` : `${a._clause} ${ue.text}`;
                consumedUnmatched.add(ue.idx);
                if (a.card_id && a.target) break;
              }
            }
          }
        }
        const nextAct = actions[i + 1];
        if (nextAct && nextAct.type === "ATTACH_ENERGY" && nextAct._clauseIdx === a._clauseIdx + 1) {
          const conflictCard = Boolean(a.card_id && nextAct.card_id && a.card_id !== nextAct.card_id);
          const conflictTarget = Boolean(a.target && nextAct.target && a.target !== nextAct.target);
          if (!conflictCard && !conflictTarget) {
            if (!a.card_id && nextAct.card_id) a.card_id = nextAct.card_id;
            if (!a.target && nextAct.target) a.target = nextAct.target;
            a._clause = `${a._clause} ${nextAct._clause}`;
            actions.splice(i + 1, 1);
            i -= 1;
          }
        }
      }
      for (const a of actions) {
        if (a && a.type === "ATTACH_ENERGY" && !a.card_id && uniqueHandEnergies.length === 1) {
          a.card_id = uniqueHandEnergies[0];
        }
        if (a && "_clauseIdx" in a) delete a._clauseIdx;
      }
      const unmatchedClauses = unmatchedEntries
        .filter((ue) => !consumedUnmatched.has(ue.idx))
        .map((ue) => ue.text);
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
      return {
        transcript: fixed, status: "execute", actions,
        reply_ja: "", reply_zh: "", rival_ja: "", rival_zh: "",
        _matchedCount: actions.length,
        _totalClauses: clauses.length,
        _unmatchedClauses: unmatchedClauses
      };
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

    /** 严格判定攻击意图：覆盖日/中全场景口语、“战斗”与狙击后排，排除“战斗区/打算/打开/不打/打不过/下回合再打”等非攻击口语 */
    hasExplicitAttackIntent(text) {
      const cleaned = String(text || "")
        .replace(/(?:下回合|下一回合|下次|等会|等一下|一会儿|待会|明天|次のターン|あとで|後で)再?[^、，。]*/g, "")
        .replace(/(?:[己敌双]方)?战斗区|打算|打开|打不开|打不过|不打|别打|不要打|没打|打断|打字/g, "");
      return /(攻撃|こうげき|アタック|殴|なぐる|なぐって|撃って|撃つ|うって|うつ|叩く|叩いて|たたいて|狙撃|ベンチを狙|仕掛け|突撃|ぶっ飛ば|倒せ|技|わざ|スキル|大招|必殺技|必杀技|攻击|进攻|战斗(?!区)|去战斗|进战斗|进入战斗|开始战斗|直接战斗|战斗吧|开战|出招|技能|狙击|点杀|平a|平A|普攻|出击|上吧|直接打|动手|开火|打一下|打他|打它|打她|打对面|打对手|打前排|打后排|打怪|打死|秒了|秒掉|干掉|击倒|开打|打过去|一击|放招|用招|用技能打)/.test(cleaned);
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

    /** 按子句拆分复句，提取指定动作对应的子句（复用升级版无标点切分器，防止前后步怪兽目标串台） */
    extractClauseForAction(rawText, actType, cardId = null) {
      const fixed = SpecEngine.applyLocalTypoFix(rawText || "").trim();
      const clauses = this.splitComboClauses(fixed);
      if (clauses.length <= 1) return fixed;
      const matchers = {
        ATTACH_ENERGY: (c) => /(エネルギー|エネ|能量|贴|充能|上能|火能|水能|雷能|炎能|电能|闪电能量|雷电能量|上火|上水|上雷|上电|加火|加水|加雷|加电|貼って|付けて|つけて)/.test(c),
        PLAY_BENCH: (c) => /(ベンチ|後ろ|場に出|召喚|出す|出して|置く|置いて|备战|下怪|上场|出战|召唤|后排)/.test(c),
        USE_ITEM: (c) => cardId === "item_potion" ? /(きずぐすり|回復|ヒール|ポーション|伤药|上药|回血|补血|治|加血|加点血|奶|药|飲む|飲んで)/.test(c)
          : (cardId === "item_flute" ? /(よびだし笛|呼び出|引っ張り|引きずり|強制交代|召唤笛|呼叫笛|笛子|吹笛|强拉|拖|换怪|拉)/.test(c) : /(道具|グッズ|補給|ドロー|抽|摸|過牌|过牌|バッジ|加攻|バフ|回収|回收|捞|捡|使|用)/.test(c)),
        RETREAT: (c) => /(交代|入れ替|下げ|逃げ|にげる|撤退|チェンジ|スイッチ|ベンチに戻|换|退|切|撤下去|拉回)/.test(c) && !/(?:对手|对面|对方)/.test(c),
        ATTACK: (c) => Boolean(SpecEngine.matchSkill(c)) || /(?:1技能|2技能|一技能|二技能|上の技|下の技|大招|必殺技|必杀技)/.test(c) || this.hasExplicitAttackIntent(c),
        DEFEND: (c) => this.hasExplicitDefendIntent(c),
        END_TURN: (c) => this.hasExplicitEndTurnIntent(c, false)
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
    nluSeq: 0,
    activeAbortCtrl: null,
    idleTimer: null,

    /** 安全取消正在飞行中的云端 LLM 解析请求，确保手动点卡/新语音/重开绝不被旧响应反噬 */
    cancelPendingNlu() {
      this.nluSeq += 1;
      if (this.activeAbortCtrl) {
        try { this.activeAbortCtrl.abort(); } catch (_) {}
        this.activeAbortCtrl = null;
      }
      if (this.state) this.state.nluInFlight = false;
      if (typeof TableUI !== "undefined" && TableUI.hideVoiceHud) TableUI.hideVoiceHud();
    },
    idleNudgeCount: 0,
    dialogueHistory: [],
    lastPlayerUtterance: "",

    /** 受对局代数令牌保护的异步延时：重开对局或对局结束时立即失效，杜绝幽灵回调污染新局 */
    async matchDelay(ms, seq = this.matchSeq) {
      await delay(ms);
      return seq === this.matchSeq && Boolean(this.state) && !this.state.gameOver;
    },

    /** 26 张快节奏牌组随机洗牌：保底起手 5 张至少含 1 对同色「怪兽+能量」（优先非 ex），且奖赏卡最多盖入 1 只怪兽 */
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

    /** 双方 26 张对称标准卡表（双方均为 8 怪兽含双 ex + 10 能量 + 5 支援者 + 1 伤药 + 2 能量回收） */
    INITIAL_DECKS: {
      player: [
        "p_fox", "p_fox", "p_turtle", "p_turtle", "p_lion", "p_lion", "p_dragon_ex", "p_dragon_ex",
        "energy_fire", "energy_fire", "energy_fire", "energy_fire",
        "energy_water", "energy_water", "energy_water",
        "energy_thunder", "energy_thunder", "energy_thunder",
        "item_bag", "item_bag", "item_flute", "item_flute", "item_power", "item_potion", "item_recycle", "item_recycle"
      ],
      enemy: [
        "e_dog", "e_dog", "e_fish", "e_fish", "e_bird", "e_bird", "e_shark_ex", "e_shark_ex",
        "energy_fire", "energy_fire", "energy_fire",
        "energy_water", "energy_water", "energy_water", "energy_water",
        "energy_thunder", "energy_thunder", "energy_thunder",
        "item_bag", "item_bag", "item_flute", "item_flute", "item_power", "item_potion", "item_recycle", "item_recycle"
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

    /** 开局状态：空场开局，双方 26 张快节奏卡组洗牌发 5 张保底起手 + 3 张盖放奖赏卡 + 18 张牌库 */
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
      await VoiceEngine.speak({ ja, zh }, "rival", { priority: "low", interruptible: true });
      this.resetIdleTimer(false);
    },

    openingRivalLine: null,
    openingChallengeSpoken: false,

    /** 在开局引导第一句播完后，无缝衔接到对手莲的开局邀战台词 */
    speakOpeningChallenge() {
      if (this.openingChallengeSpoken) return;
      const line = this.openingRivalLine || SpecEngine.getRivalLine("start");
      if (!line || (!line.ja && !line.zh)) return;
      this.openingChallengeSpoken = true;
      const lang = getUiLang();
      const firstChunk = VoiceEngine.splitIntoClauses(t(line.ja, line.zh), lang)[0] || t(line.ja, line.zh);
      VoiceEngine.bargeInGuardUntil = 0;
      VoiceEngine.speak({ ja: line.ja, zh: line.zh }, "rival", { priority: "high", interruptible: true, lang, deferPrefetch: true });
      const seq = this.matchSeq;
      const expectedToken = VoiceEngine.speakToken;
      setTimeout(() => {
        if (seq !== this.matchSeq || VoiceEngine.speakToken !== expectedToken) return;
        VoiceEngine.prefetch(firstChunk, "rival", lang);
      }, 350);
    },

    reset(triggerGuideVoice = false) {
      this.matchSeq += 1;
      this.cancelPendingNlu();
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
      this.openingRivalLine = startLine;
      this.openingChallengeSpoken = false;
      TableUI.setRival(startLine.ja, startLine.zh);
      TableUI.appendLog("対戦準備：手札5枚（モンスター＋エネ保証）を引き、サイド3枚をセットしました。", "开局准备：各抽 5 张保底起手并盖放 3 张奖赏卡。");
      const ja = "手札の緑枠モンスターをクリック（または名前を言って）し、バトル場の最初の1体を選んでください。";
      const zh = "请点击手牌中绿色高亮的怪兽（或说出怪兽名），选择战斗区首发！";
      TableUI.setReferee(ja, zh);
      TableUI.renderAll();
      if (triggerGuideVoice || !$("rulesModal")?.classList.contains("open")) {
        GuideEngine.trigger("setup_starter", triggerGuideVoice);
        if (triggerGuideVoice) this.speakOpeningChallenge();
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

      /* 对手从起手手牌挑选最优首发（普通优先有对应能量的普通怪；困难模式兼顾与玩家首发的属性克制） */
      const eMonIndices = s.enemy.hand
        .map((id, idx) => ({ id, idx, def: SpecEngine.getMonster(id) }))
        .filter((x) => x.def);
      const hardOpening = this.isHardAi();
      eMonIndices.sort((a, b) => {
        const calcOpenScore = (x) => {
          const match = s.enemy.hand.includes(`energy_${x.def.element}`) ? 1 : 0;
          let sc = match * 40 + (x.def.is_ex ? 5 : 20) + x.def.hp * 0.2;
          if (hardOpening && def) {
            if (this.getWeaknessBonus(x.def.element, def.element) > 0) sc += 38;
            if (this.getWeaknessBonus(def.element, x.def.element) > 0) sc -= x.def.is_ex ? 45 : 26;
          }
          return sc;
        };
        return calcOpenScore(b) - calcOpenScore(a);
      });
      const ePick = eMonIndices[0];
      let eStarterDef = null;
      if (ePick) {
        s.enemy.hand.splice(ePick.idx, 1);
        eStarterDef = ePick.def;
        s.enemy.active = { id: ePick.id, hp: ePick.def.hp, energies: [], guard: 0 };
      }
      /* 开局准备：困难模式若起手还有多余怪兽，同步暗置 1 只到备战区蓄能；普通模式留待对手自己回合再铺场 */
      if (hardOpening) {
        const extraEnemyIdx = s.enemy.hand.findIndex((id) => Boolean(SpecEngine.getMonster(id)));
        if (extraEnemyIdx !== -1 && s.enemy.bench[0] === null) {
          const extraId = s.enemy.hand.splice(extraEnemyIdx, 1)[0];
          const extraDef = SpecEngine.getMonster(extraId);
          s.enemy.bench[0] = { id: extraId, hp: extraDef.hp, energies: [], guard: 0 };
        }
      }

      s.phase = "battle";
      s.pending = null;
      s.selectedHandIndex = null;
      const firstDraw = this.drawCard("player", 1);
      const drawJa = firstDraw[0] ? `1ターン目のドローで「${firstDraw[0].ja}」を引きました。` : "";
      const drawZh = firstDraw[0] ? `第 1 回合抽到了「${firstDraw[0].zh}」。` : "";
      const startVoiceJa = `バトル開始！自分は${def.name_ja}、相手は${eStarterDef ? eStarterDef.name_ja : "モンスター"}でスタート！`;
      const ja = `${startVoiceJa}${drawJa}`;
      const zh = `对战正式开始！己方首发${def.name_zh}，对手派出${eStarterDef ? eStarterDef.name_zh : "怪兽"}！${drawZh}`;
      TableUI.renderAll();
      SoundFX.play("tap");
      TableUI.flashAnim("player_active", "anim-enter");
      TableUI.flashAnim("enemy_active", "anim-enter");
      const startVoiceZh = `对战正式开始！己方首发${def.name_zh}，对手派出${eStarterDef ? eStarterDef.name_zh : "怪兽"}！`;
      TableUI.showTurnBanner("ターン 1：あなたの番", "第 1 回合：你的回合", false);
      /* 选定首发后立即终止已过时的“请选择首发”引导语音，并以高优播报裁判开幕 + 对手开场第一句话 */
      VoiceEngine.stopPlayback();
      this.announceAndReact(ja, zh, def.is_ex ? "play_ex" : "start", null, { priority: "high", interruptible: true, speakJa: startVoiceJa, speakZh: startVoiceZh });
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

    /** 诊断能量不足的 4 种精确状态：0 能量 / 缺指定属性 / 仅缺总数 / 既缺属性又缺总数 */
    diagnoseEnergyShortage(attachedEnergies, costArr) {
      const attached = Array.isArray(attachedEnergies) ? attachedEnergies : [];
      const cost = Array.isArray(costArr) ? costArr : [];
      const total = attached.length;
      const needTotal = cost.length;
      const pool = [...attached];
      const missingTypedMap = {};
      for (const req of cost) {
        if (req === "any") continue;
        const idx = pool.indexOf(req);
        if (idx !== -1) {
          pool.splice(idx, 1);
        } else {
          missingTypedMap[req] = (missingTypedMap[req] || 0) + 1;
        }
      }
      const missingTyped = Object.entries(missingTypedMap).map(([elem, count]) => ({ elem, count }));
      const shortTotal = Math.max(0, needTotal - total);
      let kind = "ok";
      if (total === 0 && needTotal > 0) kind = "no_energy";
      else if (missingTyped.length > 0 && shortTotal === 0) kind = "missing_element";
      else if (missingTyped.length === 0 && shortTotal > 0) kind = "short_total";
      else if (missingTyped.length > 0 && shortTotal > 0) kind = "missing_both";
      return { kind, total, needTotal, shortTotal, missingTyped };
    },

    /** 基于 4 态能量诊断生成自然双语播报与短角标 */
    buildEnergyShortageReply(monDef, skillDef, attachedEnergies) {
      const elemNameJa = { fire: "炎エネルギー", water: "水エネルギー", thunder: "雷エネルギー", any: "無色エネルギー" };
      const elemNameZh = { fire: "火能量", water: "水能量", thunder: "雷能量", any: "任意能量" };
      const diag = this.diagnoseEnergyShortage(attachedEnergies, skillDef?.cost || []);
      const costSummaryJa = (() => {
        const counts = {};
        for (const c of (skillDef?.cost || [])) counts[c] = (counts[c] || 0) + 1;
        return Object.entries(counts).map(([el, n]) => `${elemNameJa[el] || el}${n}つ`).join("と");
      })();
      const costSummaryZh = (() => {
        const counts = {};
        for (const c of (skillDef?.cost || [])) counts[c] = (counts[c] || 0) + 1;
        return Object.entries(counts).map(([el, n]) => `${n}点${elemNameZh[el] || el}`).join("和");
      })();
      const missingJa = diag.missingTyped.map(({ elem, count }) => `${elemNameJa[elem] || elem}${count > 1 ? `${count}つ` : ""}`).join("・");
      const missingZh = diag.missingTyped.map(({ elem, count }) => `${count > 1 ? `${count}点` : ""}${elemNameZh[elem] || elem}`).join("、");
      const mJa = monDef?.name_ja || "バトル場のモンスター";
      const mZh = monDef?.name_zh || "战斗区怪兽";
      const sJa = skillDef?.name_ja || "ワザ";
      const sZh = skillDef?.name_zh || "技能";

      if (diag.kind === "no_energy") {
        return {
          ...diag,
          badgeJa: "エネ未添付",
          badgeZh: "未贴能量",
          ja: `${mJa}にはまだエネルギーがついていません。『${sJa}』には${costSummaryJa}が必要です。`,
          zh: `${mZh}目前还没有附着任何能量，发动「${sZh}」需要${costSummaryZh}。`
        };
      }
      if (diag.kind === "missing_element") {
        return {
          ...diag,
          badgeJa: "属性不足",
          badgeZh: "缺少属性",
          ja: `${mJa}はエネルギー枚数は足りていますが、${missingJa}が不足しているため『${sJa}』は使えません。`,
          zh: `${mZh}的能量总数已够，但缺少${missingZh}，无法发动「${sZh}」。`
        };
      }
      if (diag.kind === "short_total") {
        return {
          ...diag,
          badgeJa: `あと${diag.shortTotal}エネ`,
          badgeZh: `还差${diag.shortTotal}能`,
          ja: `${mJa}は属性エネルギーは揃っていますが、合計があと${diag.shortTotal}つ足りません（現在${diag.total}/${diag.needTotal}）。`,
          zh: `${mZh}的指定属性已满足，但总能量还差 ${diag.shortTotal} 点（当前 ${diag.total}/${diag.needTotal}）。`
        };
      }
      return {
        ...diag,
        badgeJa: "属性・枚数不足",
        badgeZh: "缺属性且缺数",
        ja: `${mJa}は${missingJa}が足りず、合計もあと${diag.shortTotal}つ不足しています（現在${diag.total}/${diag.needTotal}）。`,
        zh: `${mZh}缺少${missingZh}，且总能量还差 ${diag.shortTotal} 点（当前 ${diag.total}/${diag.needTotal}）。`
      };
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
      if (!s.energyUsedThisTurn && hasHandEnergy) {
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

    /** 顺序执行操作队列；若某一步触发追问，自动保存剩余连招以便确认后继续；若可跳过的前置步骤因盘面不满足而失败，保留提示后继续执行后续步骤 */
    async runActionQueue(queue, customRival = null) {
      const s = this.state;
      const seq = this.matchSeq;
      for (let i = 0; i < queue.length; i++) {
        if (seq !== this.matchSeq || s.gameOver || s.currentPlayer !== "player") break;
        const act = queue[i];
        const isLast = i === queue.length - 1;
        const ok = await this.executeAction(act, isLast ? customRival : null);
        if (seq !== this.matchSeq) break;
        TableUI.renderAll();
        if (!ok) {
          if (s.pending && i < queue.length - 1) {
            s.pending.remainingActions = queue.slice(i + 1);
            s.pending.customRival = customRival;
            break;
          }
          if (s.pending || s.gameOver || s.currentPlayer !== "player") break;
          const isTurnOrFatalStep = act?.type === "ATTACK" || act?.type === "DEFEND" || act?.type === "END_TURN";
          if (!isTurnOrFatalStep && !isLast) {
            if (!(await this.matchDelay(450, seq))) break;
            continue;
          }
          break;
        }
        if (!isLast && !(await this.matchDelay(650, seq))) break;
      }
    },

    /** 牌桌点击直出操作的统一防重入封装（允许安全抢占等待中的云端 LLM 解析，绝不互相干扰） */
    async performDirectAction(act) {
      const s = this.state;
      if (!s || s.gameOver || s.currentPlayer !== "player") return;
      if (s.nluInFlight) {
        this.cancelPendingNlu();
      } else if (s.busy) {
        return;
      }
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
      /* 若上一句语音仍在等待云端 LLM 解析，新指令直接安全抢占并取消旧请求，绝不冲突 */
      if (s.nluInFlight && !s.busy && s.currentPlayer === "player") {
        this.cancelPendingNlu();
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
      const myMatchSeq = this.matchSeq;
      const myNluSeq = ++this.nluSeq;
      s.nluInFlight = true;
      TableUI.setReferee("解析中…", "正在解析指令…");
      let acquiredExecLock = false;
      try {
        const result = await NLUEngine.parse(payload, this.getSnapshot(), convCtx);
        /* 若等待 LLM 期间玩家已手动操作、说出新指令、重开或切换回合，直接静默丢弃过期结果，零干扰 */
        if (myMatchSeq !== this.matchSeq || myNluSeq !== this.nluSeq || result.status === "aborted" || this.state !== s || s.gameOver || s.currentPlayer !== "player") {
          return;
        }
        s.nluInFlight = false;
        s.busy = true;
        acquiredExecLock = true;
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
          /* 当玩家在提问/盘面咨询且云端已明确回复 chat/reject 时，绝不用本地解析覆盖云端回答 */
          const cloudHandledQuestion = NLUEngine.isQuestionOrStatusQuery(heardText) && (result.status === "chat" || result.status === "reject");
          if (validLocalExec && !cloudHandledQuestion) {
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
          } else if (validLocalSpecial && result.status !== "execute" && !cloudHandledQuestion) {
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
            VoiceEngine.speak({ ja: fallback.ja, zh: fallback.zh }, "referee", { priority: "low", interruptible: true });
          } else {
            TableUI.setReferee(prevRefJa, prevRefZh);
          }
          return;
        }

        if (heardText && (result.transcript || isVoiceInput)) {
          if (!payload.text) this.pushHistory("player", heardText);
          /* 识别结果已派发，立即清空输入框，避免旧语音文本残留 */
          if ($("cmdInput")) $("cmdInput").value = "";
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
            VoiceEngine.speak({ ja, zh }, "referee", { priority: "high" });
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
              VoiceEngine.speak({ ja: s.pending.promptJa, zh: s.pending.promptZh }, "referee", { priority: "high" });
              return;
            }
          }
        }

        if (result.status === "clarify") {
          const ja = result.reply_ja || "もう一度教えてください。";
          const zh = result.reply_zh || "请再说一次。";
          TableUI.setReferee(ja, zh);
          if (result.rival_ja || result.rival_zh) TableUI.setRival(result.rival_ja || "", result.rival_zh || "");
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
                  ...usable.map((sk) => ({ labelJa: `${sk.name_ja} (${sk.damage})`, labelZh: `${sk.name_zh} (${sk.damage})`, reply: sk.name_ja })),
                  { labelJa: "キャンセル", labelZh: "取消", reply: "キャンセル" }
                ]
              });
            }
          }
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak({ ja, zh }, "referee", { priority: "low", interruptible: true });
          if (result.rival_ja || result.rival_zh) VoiceEngine.speak({ ja: result.rival_ja, zh: result.rival_zh }, "rival", { priority: "low", interruptible: true });
          return;
        }

        if (result.status === "chat" || result.status === "reject") {
          TableUI.setReferee(result.reply_ja || "もう一度教えてください。", result.reply_zh || "请再说一次。");
          if (result.rival_ja || result.rival_zh) TableUI.setRival(result.rival_ja || "", result.rival_zh || "");
          TableUI.appendLog(result.reply_ja || result.transcript, result.reply_zh || result.transcript);
          this.pushHistory("referee", result.reply_ja || "");
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak({ ja: result.reply_ja, zh: result.reply_zh }, "referee", { priority: "high" });
          if (result.rival_ja || result.rival_zh) VoiceEngine.speak({ ja: result.rival_ja, zh: result.rival_zh }, "rival", { priority: "normal" });
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
              { labelJa: "はい（降参）", labelZh: "确认认输", reply: "はい" },
              { labelJa: "いいえ（続行）", labelZh: "继续对战", reply: "いいえ" }
            ]
          });
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak({ ja, zh }, "referee", { priority: "high" });
          return;
        }

        const queue = Array.isArray(result.actions) ? result.actions : [];
        if (queue.length === 0) {
          const fallback = NLUEngine.pickClarifyPhrase();
          TableUI.setReferee(result.reply_ja || fallback.ja, result.reply_zh || fallback.zh);
          return;
        }

        /* 全动作原文护栏：防幻觉 + 严格子句级目标隔离（多模态音频复核纠偏后优先使用纠正后的 transcript，未指定对象/卡牌时清空） */
        const rawUtter = (result._usedAudioRescue && result.transcript) ? result.transcript : (payload.text || result.transcript || "");
        const snapNow = this.getSnapshot();
        const explicitSkill = SpecEngine.matchSkill(rawUtter);
        const explicitItem = SpecEngine.matchItem(rawUtter);
        const explicitMon = SpecEngine.matchMonster(rawUtter, "player");
        let safeQueue = [];
        const hasSummonIntent = /(召喚|召唤|上场|出战|ベンチに出|ベンチに置|备战区|放到?备战|下怪|を出す|を出して|派上)/.test(rawUtter) && !/(よびだし笛|召唤笛)/.test(rawUtter);
        for (const a of queue) {
          if (!a || !a.type) continue;
          const actClause = (typeof a._clause === "string" && a._clause.trim())
            ? a._clause
            : NLUEngine.extractClauseForAction(rawUtter, a.type, a.card_id);
          a._clause = actClause;
          if (a.type === "END_TURN" && (
            !NLUEngine.hasExplicitEndTurnIntent(actClause || rawUtter, isVoiceInput)
            || ((hasSummonIntent || Boolean(explicitMon)) && !NLUEngine.hasExplicitEndTurnIntent(actClause || rawUtter, true))
          )) continue;
          if (a.type === "DEFEND" && !NLUEngine.hasExplicitDefendIntent(rawUtter)) continue;
          const hasPronoun = /(?:它|他|她|这只|那只|刚才那只|それ|こいつ|そいつ|さっきの|そのまま)/.test(actClause);
          const keepComboTarget = queue.length > 1 && hasPronoun && Boolean(a.target);
          if (a.type === "ATTACK") {
            if (!explicitSkill && !NLUEngine.hasExplicitAttackIntent(rawUtter) && !/(打|撃|うって|撃って|殴|なぐ|やれ|いけ|行け|使って|つかって|発動|はつどう|技|わざ|ワザ|倒せ|たおせ)/.test(rawUtter)) continue;
            if (!explicitSkill) a.skill_name = null;
            if (a.target && !keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "enemy", snapNow)) a.target = null;
          }
          if (a.type === "ATTACH_ENERGY") {
            if (isVoiceInput && !/(エネルギー|えねるぎー|エネ|えね|能量|贴|充能|上能|上火|上水|上雷|加|电|闪电|雷电|红|蓝|黄|给|炎|火|ほのお|水|みず|雷|かみなり|でんき|貼|張|付|つけ|はる|はっ|あげ|渡|チャージ|装)/.test(rawUtter) && !(explicitItem && explicitItem.category === "energy")) continue;
            if (!keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "player", snapNow)) a.target = null;
            const explicitEnergyCard = NLUEngine.resolveEnergyCardFromText(actClause);
            if (explicitEnergyCard) a.card_id = explicitEnergyCard;
            else a.card_id = null;
          }
          if (a.type === "PLAY_BENCH") {
            if (isVoiceInput && !/(ベンチ|べんち|後ろ|控え|ひかえ|場に出|召喚|しょうかん|出|だす|だし|置|おく|おい|並|ならべ|呼|よぶ|セット|备战|下怪|上场|出战|后排|放|派|上|召唤)/.test(rawUtter) && !explicitMon) continue;
            if (!a._plural) {
              const clauseMons = SpecEngine.matchAllMonsters(actClause, "player");
              const matchedId = clauseMons.some((m) => m.id === a.card_id) ? a.card_id : (clauseMons[0]?.id || null);
              if (!matchedId) a.card_id = null;
            }
          }
          if (a.type === "USE_ITEM") {
            if (isVoiceInput && !/(きずぐすり|回復|かいふく|ヒール|ポーション|体力|傷薬|伤药|上药|吃药|喝药|嗑药|用个?药|贴伤药|回血|补血|治|加血|奶|飲|のむ|笛|ふえ|呼叫笛|哨|呼び出|引っ張り|強制交代|拉|拖|吹|换怪|補給|ほきゅう|ドロー|引|ひく|抽|摸|过牌|补牌|バッジ|ばっじ|パワー|バフ|アップ|力量|加攻|加伤害|增伤|強化|强化|回収|かいしゅう|回収|回收|捞|捡|戻|もど|道具|グッズ|サポート|支援|使|つかう|つかって|用)/.test(rawUtter) && !explicitItem) continue;
            if (a.card_id === "item_potion" && a.target && !keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "player", snapNow)) a.target = null;
            if (a.card_id === "item_flute" && a.target && !keepComboTarget && !NLUEngine.resolveSlotFromText(actClause, "enemy", snapNow)) a.target = null;
          }
          if (a.type === "RETREAT") {
            if (isVoiceInput && !/(交代|こうたい|入れ替|いれかえ|下|さげ|さが|逃げ|にげる|にげ|撤退|てったい|チェン|スイッチ|バトン|戻|もど|引|ひく|换|退|切|下场|撤下去|拉回)/.test(rawUtter)) continue;
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
              const ec = (typeof a._clause === "string" && a._clause.trim()) ? a._clause : rawUtter;
              if (a.type === "END_TURN" && isVoiceInput && (!NLUEngine.hasExplicitEndTurnIntent(ec, true) || ((hasSummonIntent || Boolean(explicitMon)) && !NLUEngine.hasExplicitEndTurnIntent(ec, true)))) return false;
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
          VoiceEngine.speak({ ja: fallback.ja, zh: fallback.zh }, "referee", { priority: "low", interruptible: true });
          return;
        }

        /* 语音触发单独 END_TURN 强制二次确认 */
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
              { labelJa: "このまま終了", labelZh: "确认结束", reply: "はい" },
              { labelJa: "戻る", labelZh: "返回操作", reply: "いいえ" }
            ]
          });
          TableUI.openEndTurnConfirmModal(opps, true);
          VoiceEngine.clearQueuedOnly(false);
          VoiceEngine.speak({ ja, zh }, "referee", { priority: "high" });
          return;
        }

        if (s.pending && s.pending.type !== "promote_bench") this.clearPending();
        await this.runActionQueue(safeQueue, { ja: result.rival_ja, zh: result.rival_zh });
      } finally {
        if (myNluSeq === this.nluSeq) s.nluInFlight = false;
        if (acquiredExecLock) {
          if (Boolean(payload.audioBase64 || payload.fromVoice) && $("cmdInput")) $("cmdInput").value = "";
          s.busy = false;
          TableUI.renderAll();
          this.resetIdleTimer(true);
        }
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
        VoiceEngine.speak({ ja, zh }, "referee", { priority: "normal" });
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
          VoiceEngine.speak({ ja: r.ja, zh: r.zh }, "rival", { priority: "critical" });
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
        if (!pickedId) {
          const resolvedEnergy = NLUEngine.resolveEnergyCardFromText(fixed);
          if (resolvedEnergy && candidates.includes(resolvedEnergy)) pickedId = resolvedEnergy;
        }
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

    /** 非阻塞双语播报：错峰预取对手语音防双 WS 争抢，并保存完整双语文本支持语言切换实时重播 */
    announceAndReact(ja, zh, rivalEvent, customRival = null, opts = {}) {
      const priority = opts.priority || "normal";
      const lang = getUiLang();
      const refJa = opts.speakJa || ja || "";
      const refZh = opts.speakZh || zh || "";
      const spokenReferee = t(refJa, refZh);
      const rJa = (customRival && customRival.ja) || (rivalEvent ? SpecEngine.getRivalLine(rivalEvent).ja : "");
      const rZh = (customRival && customRival.zh) || (rivalEvent ? SpecEngine.getRivalLine(rivalEvent).zh : "");
      const spokenRival = t(rJa, rZh);
      if (priority !== "low") VoiceEngine.clearQueuedOnly(true, !spokenRival);
      TableUI.setReferee(ja, zh);
      TableUI.appendLog(ja, zh);
      this.pushHistory("referee", ja);

      if (rJa || rZh) {
        TableUI.setRival(rJa, rZh);
      }
      if (priority === "high" && spokenReferee && spokenRival && !opts.interruptible) {
        /* 仅保留 700ms 启动防爆音窗口，之后允许玩家随时开口灵敏打断 */
        VoiceEngine.bargeInGuardUntil = Math.max(VoiceEngine.bargeInGuardUntil || 0, Date.now() + 700);
      }
      if (spokenReferee) VoiceEngine.speak({ ja: refJa, zh: refZh }, "referee", { priority, interruptible: opts.interruptible, lang });
      if (spokenRival) {
        const rivalPriority = priority === "high" ? "high" : "normal";
        const firstRivalChunk = VoiceEngine.splitIntoClauses(spokenRival, lang)[0] || spokenRival;
        VoiceEngine.speak({ ja: rJa, zh: rZh }, "rival", { priority: rivalPriority, interruptible: opts.interruptible, lang, deferPrefetch: true });
        const expectedToken = VoiceEngine.speakToken;
        /* 错峰 350ms 预取对手语音首句，避免 0ms 并发两条 Nia TTS WS 互相争抢带宽 */
        setTimeout(() => {
          if (VoiceEngine.speakToken === expectedToken) {
            VoiceEngine.prefetch(firstRivalChunk, "rival", lang);
          }
        }, 350);
      }
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
            TableUI.flashDeny("player_active", "エネ添付済", "本回合已贴能");
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
          if (act.card_id && handIdx === -1) {
            const reqIt = SpecEngine.getItem(act.card_id);
            const availJa = energyTypes.map((cid) => SpecEngine.getItem(cid)?.name_ja || cid).join("・");
            const availZh = energyTypes.map((cid) => SpecEngine.getItem(cid)?.name_zh || cid).join("、");
            const reqJa = reqIt ? reqIt.name_ja : act.card_id;
            const reqZh = reqIt ? reqIt.name_zh : act.card_id;
            TableUI.flashDeny("player_active", "指定エネなし", "无此能量卡");
            await this.announceAndReact(
              `手札に${reqJa}がありません（手札にあるのは${availJa}です）。`,
              `手牌中没有${reqZh}（当前手牌只有${availZh}）。`,
              null
            );
            return false;
          }
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
                  return { labelJa: it ? it.name_ja : cid, labelZh: it ? it.name_zh : cid, reply: it ? it.name_ja : cid };
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
          let targetSlot = act.target || (act._clause ? NLUEngine.resolveSlotFromText(act._clause, "player", this.getSnapshot()) : null);
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
                  labelJa: `${e.slot === "player_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja}`,
                  labelZh: `${e.slot === "player_active" ? "前" : POS_ZH[e.idx]}・${e.def.name_zh}`,
                  reply: e.slot === "player_active" ? "前" : POS_JA[e.idx],
                  slot: e.slot
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
            newlyUnlocked.length
              ? t(`${newlyUnlocked[0].name_ja} 解放！`, `${newlyUnlocked[0].name_zh} 解锁！`)
              : t(`${ELEM_ICON[itemDef.element] || ""} +1 エネ`, `${ELEM_ICON[itemDef.element] || ""} +1 能量`),
            "energy",
            newlyUnlocked.length ? "sparkle" : (itemDef.element || "any")
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
            TableUI.flashDeny("player_bench_1", "ベンチ満員", "备战区已满");
            await this.announceAndReact("ベンチは満員（3体）です。", "备战区已满（3只），无法继续下怪。", null);
            return false;
          }
          const monTypes = Array.from(new Set(s.player.hand.filter((id) => Boolean(SpecEngine.getMonster(id)))));
          if (monTypes.length === 0) {
            await this.announceAndReact("手札にベンチへ出せるモンスターがありません。", "手牌中没有可放入备战区的怪兽。", null);
            return false;
          }
          let handIdx = act.card_id ? s.player.hand.indexOf(act.card_id) : -1;
          if (act.card_id && handIdx === -1) {
            const reqMon = SpecEngine.getMonster(act.card_id);
            const availJa = monTypes.map((cid) => SpecEngine.getMonster(cid)?.name_ja || cid).join("・");
            const availZh = monTypes.map((cid) => SpecEngine.getMonster(cid)?.name_zh || cid).join("、");
            const reqJa = reqMon ? reqMon.name_ja : act.card_id;
            const reqZh = reqMon ? reqMon.name_zh : act.card_id;
            TableUI.flashDeny("player_bench_0", "手札に不在", "手牌无此怪");
            await this.announceAndReact(
              `手札に${reqJa}がありません（手札にあるのは${availJa}です）。`,
              `手牌中没有${reqZh}（当前手牌只有${availZh}）。`,
              null
            );
            return false;
          }
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
                  return { labelJa: `${m.name_ja} (HP${m.hp})`, labelZh: `${m.name_zh} (HP${m.hp})`, reply: m.name_ja };
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
          TableUI.spawnFloatText(`player_bench_${emptyIdx}`, def.is_ex ? t("ex登場！", "ex 登场！") : t("登場！", "登场！"), "energy", def.is_ex ? "prizeStar" : null);
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
            TableUI.flashDeny("player_active", "サポート済", "本回合已用支援卡");
            await this.announceAndReact("サポートカードは1ターンに1枚までです。", "支援卡每回合只能使用 1 张，本回合已使用。", null);
            return false;
          }
          if (it.category === "supporter") GuideEngine.trigger("first_supporter", false);

          const healMatch = /^heal_ally_(\d+)$/.exec(it.effect_type || "");
          if (healMatch) {
            const healAmount = Number(healMatch[1]) || 30;
            let targetSlot = act.target || (act._clause ? NLUEngine.resolveSlotFromText(act._clause, "player", this.getSnapshot()) : null);
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
                    labelJa: `${e.slot === "player_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja}`,
                    labelZh: `${e.slot === "player_active" ? "前" : POS_ZH[e.idx]}・${e.def.name_zh}`,
                    reply: e.slot === "player_active" ? "前" : POS_JA[e.idx],
                    slot: e.slot
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
              TableUI.flashDeny(targetSlot, "HP満タン", "已满血");
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
            TableUI.spawnFloatText(targetSlot, `+${healed} HP`, "heal", "healPlus");
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
            let targetSlot = act.target || (act._clause ? NLUEngine.resolveSlotFromText(act._clause, "enemy", this.getSnapshot()) : null);
            if (targetSlot === "enemy_active") targetSlot = null;
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
                  options: eBench.map((e) => ({
                    labelJa: `${POS_JA[e.idx]}・${e.def.name_ja}`,
                    labelZh: `${POS_ZH[e.idx]}・${e.def.name_zh}`,
                    reply: POS_JA[e.idx],
                    slot: e.slot
                  }))
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
            TableUI.spawnFloatText("enemy_active", t("強制交代！", "强制换人！"), "guard", "swapChip");
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
              TableUI.flashDeny("player_active", "先攻1T不可", "先手T1不可用");
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
            TableUI.spawnFloatText("player_active", t(`攻撃+${boostVal}！`, `攻击+${boostVal}！`), "energy", "sword");
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
              TableUI.spawnFloatText("player_active", t("エネ回収！", "能量回收！"), "energy", "recycle");
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
            TableUI.spawnFloatText("player_active", t("エネ探索！", "检索能量！"), "energy", "recycle");
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
            TableUI.flashDeny("player_active", "交代済", "本回合已撤退");
            await this.announceAndReact("交代は1ターンに1回までです。", "撤退换人每回合只能执行 1 次。", null);
            return false;
          }
          const actUnit = s.player.active;
          const actDef = actUnit ? SpecEngine.getMonster(actUnit.id) : null;
          const retreatCost = actDef && actDef.is_ex ? 2 : 1;
          if (!actUnit || actUnit.energies.length < retreatCost) {
            const curCnt = actUnit ? actUnit.energies.length : 0;
            const monJa = actDef ? actDef.name_ja : "バトル場のモンスター";
            const monZh = actDef ? actDef.name_zh : "战斗区怪兽";
            TableUI.flashDeny("player_active", curCnt === 0 ? "エネ未添付" : `エネ不足 (${curCnt}/${retreatCost})`, curCnt === 0 ? "未贴能量" : `能量不足 (${curCnt}/${retreatCost})`);
            const ja = curCnt === 0
              ? `${monJa}にはエネルギーがついていないため交代できません（${retreatCost}つ必要）。`
              : `${monJa}のエネルギーは現在${curCnt}つで、交代にはあと${retreatCost - curCnt}つ必要です。`;
            const zh = curCnt === 0
              ? `${monZh}身上还没有附着任何能量，无法撤退（需要 ${retreatCost} 点能量）。`
              : `${monZh}当前只有 ${curCnt} 点能量，撤退还差 ${retreatCost - curCnt} 点。`;
            await this.announceAndReact(ja, zh, null);
            return false;
          }
          const myBench = this.getBenchEntries("player");
          if (myBench.length === 0) {
            TableUI.flashDeny("player_active", "控えなし", "备战区无怪");
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
                options: myBench.map((e) => ({
                  labelJa: `${POS_JA[e.idx]}・${e.def.name_ja}`,
                  labelZh: `${POS_ZH[e.idx]}・${e.def.name_zh}`,
                  reply: POS_JA[e.idx],
                  slot: e.slot
                }))
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
          TableUI.spawnFloatText("player_active", t("交代！", "换人！"), "guard", "swapChip");
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
          TableUI.spawnFloatText("player_active", t("防御 -30", "防御 -30"), "guard", "shield");
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
              const diag = this.buildEnergyShortageReply(actDef, firstSk, actUnit.energies);
              TableUI.flashDeny("player_active", diag.badgeJa, diag.badgeZh);
              await this.announceAndReact(diag.ja, diag.zh, null);
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
                  ...usable.map((sk) => ({ labelJa: `${sk.name_ja} (${sk.damage})`, labelZh: `${sk.name_zh} (${sk.damage})`, reply: sk.name_ja })),
                  { labelJa: "キャンセル", labelZh: "取消", reply: "キャンセル" }
                ]
              });
              await this.announceAndReact(ja, zh, null);
              return false;
            }
          }

          if (!this.canPayCost(actUnit.energies, chosenSkill.cost)) {
            const diag = this.buildEnergyShortageReply(actDef, chosenSkill, actUnit.energies);
            TableUI.flashDeny("player_active", diag.badgeJa, diag.badgeZh);
            await this.announceAndReact(diag.ja, diag.zh, null);
            return false;
          }

          /* 狙击类技能（enemy_any）：敌方场上有 2 只及以上怪兽且未指定对象时，必须追问确认目标；常规攻击前基于实时盘面重解目标，防止召唤笛刚换上场的怪兽仍按旧备战槽拒打 */
          let targetSlot = act.target;
          const liveEnemyTarget = act._clause ? NLUEngine.resolveSlotFromText(act._clause, "enemy", this.getSnapshot()) : null;
          if (liveEnemyTarget) {
            targetSlot = liveEnemyTarget;
          } else if (chosenSkill.target === "enemy_active" && targetSlot && targetSlot !== "enemy_active"
            && !/(后排|备战|ベンチ|控え|左|中央|真ん中|中间|右)/.test(act._clause || "")) {
            targetSlot = "enemy_active";
          }
          if (chosenSkill.target === "enemy_any" && !targetSlot) {
            const eUnits = this.getAllEntries("enemy");
            if (eUnits.length > 1) {
              const ja = `『${chosenSkill.name_ja}』は相手のバトル場・ベンチのどちらを狙いますか？`;
              const zh = `「${chosenSkill.name_zh}」可攻击对手任意怪兽，要指定哪一只为目标？`;
              this.setPending({
                type: "choose_target", promptJa: ja, promptZh: zh,
                context: { side: "enemy", action: { type: "ATTACK", skill_name: chosenSkill.name_ja, target: null } },
                options: eUnits.map((e) => ({
                  labelJa: `${e.slot === "enemy_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja} (HP${e.unit.hp})`,
                  labelZh: `${e.slot === "enemy_active" ? "前" : POS_ZH[e.idx]}・${e.def.name_zh} (HP${e.unit.hp})`,
                  reply: e.slot === "enemy_active" ? "前" : POS_JA[e.idx],
                  slot: e.slot
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
          const fx = SpecEngine.parseSkillEffects(chosenSkill.effect);
          const guardVal = chosenSkill.guardVal || fx.guardVal;
          const discardVal = chosenSkill.discardSelfVal || fx.discardSelfVal;
          const healSelfVal = chosenSkill.healSelfVal || fx.healSelfVal;
          const drawVal = chosenSkill.drawVal || fx.drawVal;
          const splashVal = chosenSkill.benchSplashVal || fx.benchSplashVal;
          const recoilVal = chosenSkill.recoilVal || fx.recoilVal;

          const splashedSlots = [];
          if (splashVal > 0) {
            for (const b of this.getBenchEntries("enemy")) {
              b.unit.hp = Math.max(0, b.unit.hp - splashVal);
              splashedSlots.push(b.slot);
            }
          }
          if (guardVal > 0) {
            actUnit.guard = Math.max(actUnit.guard || 0, guardVal);
          }
          let healedAmt = 0;
          if (healSelfVal > 0 && actUnit.hp < actDef.hp) {
            healedAmt = Math.min(healSelfVal, actDef.hp - actUnit.hp);
            actUnit.hp += healedAmt;
          }
          let drawnCards = [];
          if (drawVal > 0) {
            drawnCards = this.drawCard("player", drawVal);
          }
          if (recoilVal > 0) {
            actUnit.hp = Math.max(0, actUnit.hp - recoilVal);
          }
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
          if (dmg >= 40 || weakBonus || chantBonus || splashedSlots.length > 0) TableUI.shakePlaymat();
          TableUI.spawnSlotVfx(targetSlot, actDef.element);
          TableUI.spawnFloatText(targetSlot, weakBonus ? t(`-${dmg} 弱点!`, `-${dmg} 弱点!`) : `-${dmg}`, (dmg >= 50 || weakBonus || chantBonus) ? "crit" : "dmg", weakBonus ? "bolt" : null);
          for (const sl of splashedSlots) {
            TableUI.flashAnim(sl, "anim-hit");
            TableUI.spawnFloatText(sl, t(`-${splashVal} 拡散`, `-${splashVal} 溅射`), "dmg", "splash");
          }
          if (chantBonus) TableUI.spawnFloatText("player_active", t("言霊共鳴 +10！", "言灵共鸣 +10！"), "energy", "sparkle");
          if (guardVal > 0) TableUI.spawnFloatText("player_active", t(`被ダメ -${guardVal}`, `减伤 -${guardVal}`), "guard", "shield");
          if (healedAmt > 0) { SoundFX.play("heal"); TableUI.spawnFloatText("player_active", `+${healedAmt} HP`, "heal", "healPlus"); }
          if (drawnCards.length > 0) TableUI.spawnFloatText("player_active", t(`+${drawnCards.length} ドロー`, `抽 +${drawnCards.length} 牌`), "energy", "drawCard");
          if (recoilVal > 0) TableUI.spawnFloatText("player_active", t(`反動 -${recoilVal}`, `反伤 -${recoilVal}`), "dmg", "warn");
          if (discardedCount > 0) TableUI.spawnFloatText("player_active", t(`エネ -${discardedCount}`, `弃能 -${discardedCount}`), "dmg", "bolt");

          const notesJa = [];
          const notesZh = [];
          if (chantBonus) { notesJa.push("言霊共鳴+10"); notesZh.push("言灵共鸣+10"); }
          if (weakBonus) { notesJa.push("弱点+20"); notesZh.push("弱点+20"); }
          if (boost) { notesJa.push(`強化+${boost}`); notesZh.push(`强化+${boost}`); }
          if (splashedSlots.length > 0) { notesJa.push(`相手ベンチ全体にも${splashVal}ダメージ`); notesZh.push(`对手全部备战区溅射 ${splashVal} 伤害`); }
          if (guardVal > 0) { notesJa.push(`次の被ダメージ-${guardVal}`); notesZh.push(`下回合受击-${guardVal}`); }
          if (healedAmt > 0) { notesJa.push(`自身HP+${healedAmt}`); notesZh.push(`自身回复 ${healedAmt} HP`); }
          if (drawnCards.length > 0) { notesJa.push(`${drawnCards.length}枚ドロー`); notesZh.push(`抽 ${drawnCards.length} 张牌`); }
          if (recoilVal > 0) { notesJa.push(`反動${recoilVal}ダメージ`); notesZh.push(`自身反伤 ${recoilVal}`); }
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
            const rivalEv = splashedSlots.length > 0
              ? "splash"
              : (guardVal >= 30
                ? "heavy_guard"
                : (drawnCards.length > 0
                  ? "draw_skill"
                  : (weakBonus ? "weakness" : (isBenchSnipe ? "snipe" : "attack_hit"))));
            const rJa = (customRival && customRival.ja) || SpecEngine.getRivalLine(rivalEv).ja || SpecEngine.getRivalLine("attack_hit").ja;
            const rZh = (customRival && customRival.zh) || SpecEngine.getRivalLine(rivalEv).zh || SpecEngine.getRivalLine("attack_hit").zh;
            if (rJa || rZh) {
              TableUI.setRival(rJa, rZh);
              VoiceEngine.speak({ ja: rJa, zh: rZh }, "rival");
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

      const deadEnemies = this.getAllEntries("enemy").filter((e) => e.unit.hp <= 0);
      for (const e of deadEnemies) {
        anyKo = true;
        s.enemy.trash.push(e.unit.id);
        for (const el of (e.unit.energies || [])) s.enemy.trash.push(`energy_${el}`);
        if (e.slot === "enemy_active") s.enemy.active = null;
        else s.enemy.bench[e.idx] = null;
        const prizeVal = this.getPrizeValue(e.unit.id);
        const prizeCards = this.takePrizes("player", prizeVal);
        TableUI.renderAll();
        SoundFX.play("ko");
        TableUI.spawnFloatText(e.slot, prizeVal === 2 ? t("ex撃破！サイド2枚", "击倒 ex！奖赏 2 张") : t("きぜつ！", "击倒！"), "ko");
        TableUI.flashPrize("player", prizeCards.length);
        TableUI.showPrizeBanner("player", prizeCards, prizeVal, s.player.prizesLeft);

        if (s.player.prizesLeft === 0) {
          const r = SpecEngine.getRivalLine("player_win");
          TableUI.setRival(r.ja, r.zh);
          VoiceEngine.speak({ ja: r.ja, zh: r.zh }, "rival", { priority: "critical" });
          this.endGame("player", `サイドを${TOTAL_PRIZES}枚取り切りました！あなたの勝利です！`, `你拿完 ${TOTAL_PRIZES} 张奖赏卡，赢得胜利！`);
          return true;
        }

        const koLine = SpecEngine.getRivalLine(prizeVal === 2 ? "enemy_ex_ko" : "enemy_ko");
        TableUI.setRival(koLine.ja, koLine.zh);
        const prizeJa = prizeCards.length ? `サイドから「${prizeCards.map((c) => c.ja).join("・")}」を手札に加えました！` : "";
        const prizeZh = prizeCards.length ? `从奖赏卡抽到「${prizeCards.map((c) => c.zh).join("、")}」加入手牌！` : "";
        TableUI.appendLog(`相手の${e.def.name_ja}を撃破！${prizeJa}`, `击倒对手的${e.def.name_zh}，${prizeZh}`);
        VoiceEngine.speak({ ja: koLine.ja, zh: koLine.zh }, "rival", { priority: "high" });
      }
      if (deadEnemies.length > 0 && !s.enemy.active) {
        const bench = this.getBenchEntries("enemy").filter((b) => b.unit.hp > 0);
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

      const deadPlayers = this.getAllEntries("player").filter((p) => p.unit.hp <= 0);
      for (const p of deadPlayers) {
        anyKo = true;
        s.player.trash.push(p.unit.id);
        for (const el of (p.unit.energies || [])) s.player.trash.push(`energy_${el}`);
        if (p.slot === "player_active") s.player.active = null;
        else s.player.bench[p.idx] = null;
        const prizeVal = this.getPrizeValue(p.unit.id);
        this.takePrizes("enemy", prizeVal);
        TableUI.renderAll();
        SoundFX.play("ko");
        TableUI.spawnFloatText(p.slot, prizeVal === 2 ? t("exきぜつ！サイド2枚", "ex 倒下！对手拿 2 张") : t("きぜつ！", "倒下！"), "ko");
        TableUI.flashPrize("enemy", prizeVal);
        TableUI.showPrizeBanner("enemy", [], prizeVal, s.enemy.prizesLeft);

        if (s.enemy.prizesLeft === 0) {
          const r = SpecEngine.getRivalLine("enemy_win");
          TableUI.setRival(r.ja, r.zh);
          VoiceEngine.speak({ ja: r.ja, zh: r.zh }, "rival", { priority: "critical" });
          this.endGame("enemy", `相手にサイドを${TOTAL_PRIZES}枚取られました。`, `对手拿完 ${TOTAL_PRIZES} 张奖赏卡，本局败北。`);
          return true;
        }

        const r = SpecEngine.getRivalLine(prizeVal === 2 ? "player_ex_ko" : "player_ko");
        TableUI.setRival(r.ja, r.zh);
        TableUI.appendLog(`自分の${p.def.name_ja}がきぜつ…相手がサイドを${prizeVal}枚手札に加えた。`, `己方${p.def.name_zh}倒下，对手拿走 ${prizeVal} 张奖赏卡加入手牌。`);
        VoiceEngine.speak({ ja: r.ja, zh: r.zh }, "rival", { priority: "high" });
      }
      if (deadPlayers.length > 0 && !s.player.active) {
        const myBench = this.getBenchEntries("player").filter((b) => b.unit.hp > 0);
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
            options: myBench.map((e) => ({
              labelJa: `${POS_JA[e.idx]}・${e.def.name_ja}`,
              labelZh: `${POS_ZH[e.idx]}・${e.def.name_zh}`,
              reply: POS_JA[e.idx],
              slot: e.slot
            }))
          });
          TableUI.setReferee(ja, zh);
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
      TableUI.showTurnBanner("レンのターン", "对手莲的回合", true);
      if (!(await this.matchDelay(1250, seq))) return;
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
      const pMaxCost = pDef ? Math.max(...pDef.skills.map((sk) => sk.cost.length)) : 2;
      const extra = (pDef && (pAct.energies || []).length < pMaxCost) ? [pDef.element] : [];
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

      const playerBenchTargets = allTargets.slice(1);
      const playerBenchCount = playerBenchTargets.length;
      const maxSkillBase = Math.max(...actDef.skills.map((x) => x.damage));
      let bestPlan = null;

      const hardAi = this.isHardAi();
      for (const sk of usable) {
        const fx = SpecEngine.parseSkillEffects(sk.effect);
        const guardVal = sk.guardVal || fx.guardVal;
        const discardCost = sk.discardSelfVal || fx.discardSelfVal;
        const healVal = sk.healSelfVal || fx.healSelfVal;
        const drawVal = sk.drawVal || fx.drawVal;
        const splashVal = sk.benchSplashVal || fx.benchSplashVal;
        const recoilVal = sk.recoilVal || fx.recoilVal;
        const targets = (sk.target === "enemy_any" && hardAi) ? allTargets : [virtualPlayerActive];
        for (const t of targets) {
          const isActTarget = t.slot === "player_active";
          const wb = isActTarget ? this.getWeaknessBonus(actDef.element, t.def.element) : 0;
          const red = isActTarget ? t.guard : 0;
          const dmg = Math.max(0, sk.damage + wb + boost - red);
          const isKo = dmg >= t.unit.hp;
          const prizeVal = this.getPrizeValue(t.unit.id);
          let totalPrizes = isKo ? prizeVal : 0;
          let splashScore = 0;
          if (splashVal > 0) {
            for (const b of playerBenchTargets) {
              splashScore += splashVal * 6;
              if (b.unit.hp <= splashVal) {
                const bpv = this.getPrizeValue(b.unit.id);
                totalPrizes += bpv;
                splashScore += bpv === 2 ? 2200 : 1200;
              }
            }
          }
          const isWin = totalPrizes >= s.enemy.prizesLeft || (isKo && isActTarget && playerBenchCount === 0);
          const remainHp = Math.max(0, t.unit.hp - dmg);
          const setupNextKo = !isKo && dmg > 0 && remainHp <= (maxSkillBase + wb);

          let score = 0;
          if (isWin) score += 10000;
          if (isKo) score += prizeVal === 2 ? 2600 : 1400;
          score += dmg * 8 + splashScore;
          score += guardVal * 2.5;
          score += Math.min(healVal, actDef.hp - attUnit.hp) * 5;
          score += drawVal * 95;
          if (recoilVal > 0 && !isWin) {
            score -= recoilVal * 4;
            if (attUnit.hp <= recoilVal) score -= actDef.is_ex ? 2200 : 1100;
          }
          if (!isKo && dmg > 0) {
            if (t.def.is_ex) score += 130;
            score += (t.unit.energies || []).length * 45;
            if (setupNextKo) score += 95;
          }
          if (isKo && dmg > t.unit.hp) {
            score -= Math.min(20, Math.floor((dmg - t.unit.hp) / 10));
          }
          if (hardAi && discardCost > 0 && !isWin) {
            score -= isKo ? discardCost * 70 : discardCost * 35;
          }

          if (!bestPlan || score > bestPlan.score) {
            bestPlan = {
              sk, targetSlot: t.slot, targetUnit: t.unit, tDef: t.def,
              weakBonus: wb, dmg, isKo, isWin, prizeVal: totalPrizes || prizeVal, score
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

    /** 困难 AI 2 回合前瞻：估算玩家下回合（再贴 1 能或撤退换主力后）对我方前排与备战区的反击威胁 */
    evalEnemyCounterThreat(simEnemy, simPlayer) {
      if (!simEnemy.active || !simPlayer.active) {
        return { maxDmgToActive: 0, activeLethal: false, oppCanWin: false, worstBenchLoss: 0 };
      }
      const myAct = simEnemy.active;
      const myDef = SpecEngine.getMonster(myAct.id);
      const myBenchCnt = simEnemy.bench.filter(Boolean).length;
      let maxDmgToActive = 0;
      let oppCanWin = false;
      let worstBenchLoss = 0;

      const checkAttacker = (attUnit, allowExtraEnergy) => {
        const aDef = SpecEngine.getMonster(attUnit.id);
        if (!aDef) return;
        const maxC = Math.max(...aDef.skills.map((sk) => sk.cost.length));
        const pool = (allowExtraEnergy && (attUnit.energies || []).length < maxC)
          ? [...(attUnit.energies || []), aDef.element]
          : [...(attUnit.energies || [])];
        for (const sk of aDef.skills) {
          if (!this.canPayCost(pool, sk.cost)) continue;
          const fx = SpecEngine.parseSkillEffects(sk.effect);
          const dmg = Math.max(0, sk.damage + this.getWeaknessBonus(aDef.element, myDef.element) - (myAct.guard || 0));
          if (dmg > maxDmgToActive) maxDmgToActive = dmg;
          let prizes = dmg >= myAct.hp ? (myDef.is_ex ? 2 : 1) : 0;
          if (fx.benchSplashVal > 0) {
            for (const b of simEnemy.bench) {
              if (!b) continue;
              const bd = SpecEngine.getMonster(b.id);
              if (b.hp <= fx.benchSplashVal) {
                const bpv = bd && bd.is_ex ? 2 : 1;
                prizes += bpv;
                worstBenchLoss = Math.max(worstBenchLoss, bpv);
              }
            }
          }
          if (prizes >= simPlayer.prizesLeft || (dmg >= myAct.hp && myBenchCnt === 0)) oppCanWin = true;
          if (sk.target === "enemy_any") {
            for (const b of simEnemy.bench) {
              if (!b) continue;
              const bd = SpecEngine.getMonster(b.id);
              if (sk.damage >= b.hp) {
                const pv = bd && bd.is_ex ? 2 : 1;
                worstBenchLoss = Math.max(worstBenchLoss, pv);
                if (pv >= simPlayer.prizesLeft) oppCanWin = true;
              }
            }
          }
        }
      };

      checkAttacker(simPlayer.active, true);
      const pActDef = SpecEngine.getMonster(simPlayer.active.id);
      const pRetCost = pActDef && pActDef.is_ex ? 2 : 1;
      if ((simPlayer.active.energies || []).length >= pRetCost) {
        for (const pb of simPlayer.bench) {
          if (pb) checkAttacker(pb, true);
        }
      }
      return { maxDmgToActive, activeLethal: maxDmgToActive >= myAct.hp, oppCanWin, worstBenchLoss };
    },

    /** 困难 AI 核心：整回合联合连招搜索（穷举 贴能目标 × 撤退换人 × 支援者[召唤笛/力量徽章] × 攻击/狙击/防御，配 2 回合局势评估，< 1ms 完成） */
    planHardEnemyTurn(suppUsedAlready = false) {
      const s = this.state;
      if (!s || !s.enemy.active || !s.player.active) return null;
      const cloneSide = (sideObj) => ({
        hand: [...sideObj.hand],
        prizesLeft: sideObj.prizesLeft,
        active: sideObj.active ? { ...sideObj.active, energies: [...(sideObj.active.energies || [])] } : null,
        bench: sideObj.bench.map((u) => (u ? { ...u, energies: [...(u.energies || [])] } : null))
      });
      const getSimEntries = (sideObj, prefix) => {
        const res = [];
        if (sideObj.active) res.push({ slot: `${prefix}_active`, idx: -1, unit: sideObj.active, def: SpecEngine.getMonster(sideObj.active.id) });
        sideObj.bench.forEach((u, i) => {
          if (u) res.push({ slot: `${prefix}_bench_${i}`, idx: i, unit: u, def: SpecEngine.getMonster(u.id) });
        });
        return res;
      };

      const hasEnergy = s.enemy.hand.some((id) => id.startsWith("energy_"));
      const enemyEntries0 = this.getAllEntries("enemy");
      const attachSlots = hasEnergy ? enemyEntries0.map((e) => e.slot) : [null];
      const hasFlute = !suppUsedAlready && s.enemy.hand.includes("item_flute");
      const hasPower = !suppUsedAlready && s.enemy.hand.includes("item_power");

      let bestPlan = null;

      for (const attachSlot of attachSlots) {
        const s1E = cloneSide(s.enemy);
        let attachEnergyId = null;
        if (attachSlot) {
          const entries1 = getSimEntries(s1E, "enemy");
          const targetEntry = entries1.find((e) => e.slot === attachSlot);
          if (!targetEntry) continue;
          const others = entries1.map((e) => e.unit).filter((u) => u !== targetEntry.unit);
          const eIdx = this.pickBestEnergyForUnit(s1E.hand, targetEntry.unit, targetEntry.def, others);
          if (eIdx === -1) continue;
          attachEnergyId = s1E.hand.splice(eIdx, 1)[0];
          targetEntry.unit.energies.push(attachEnergyId.replace("energy_", ""));
        }

        const retreatOpts = [-1];
        if (s1E.active) {
          const actDef1 = SpecEngine.getMonster(s1E.active.id);
          const rCost = actDef1 && actDef1.is_ex ? 2 : 1;
          if (s1E.active.energies.length >= rCost) {
            s1E.bench.forEach((b, i) => { if (b) retreatOpts.push(i); });
          }
        }

        for (const retreatIdx of retreatOpts) {
          const s2E = cloneSide(s1E);
          if (retreatIdx !== -1) {
            const old = s2E.active;
            const oldDef = SpecEngine.getMonster(old.id);
            const rCost = oldDef && oldDef.is_ex ? 2 : 1;
            for (let k = 0; k < rCost; k++) {
              let di = old.energies.findIndex((el) => el !== oldDef.element);
              if (di === -1) di = old.energies.length - 1;
              old.energies.splice(di, 1);
            }
            old.guard = 0;
            s2E.active = s2E.bench[retreatIdx];
            s2E.bench[retreatIdx] = old;
          }

          const suppOpts = [{ type: "none" }];
          if (hasPower) suppOpts.push({ type: "power" });
          if (hasFlute) {
            s.player.bench.forEach((pb, i) => { if (pb) suppOpts.push({ type: "flute", benchIdx: i }); });
          }

          for (const supp of suppOpts) {
            const s3E = cloneSide(s2E);
            const s3P = cloneSide(s.player);
            let boost = 0;
            let cardPenalty = 0;
            if (supp.type === "power") {
              boost = 20;
              cardPenalty = 55;
            } else if (supp.type === "flute") {
              const oldP = s3P.active;
              oldP.guard = 0;
              s3P.active = s3P.bench[supp.benchIdx];
              s3P.bench[supp.benchIdx] = oldP;
              cardPenalty = 65;
            }

            const act = s3E.active;
            const actDef = SpecEngine.getMonster(act.id);
            const usable = actDef.skills.filter((sk) => this.canPayCost(act.energies, sk.cost));
            const pTargets = getSimEntries(s3P, "player");
            const endActions = [];
            for (const sk of usable) {
              const tgts = sk.target === "enemy_any" ? pTargets : [pTargets[0]];
              for (const t of tgts) {
                endActions.push({ kind: "attack", sk, targetSlot: t.slot, targetIdx: t.idx });
              }
            }
            if (act.lastDefendedTurn !== s.turn - 1) {
              endActions.push({ kind: "defend" });
            }
            if (endActions.length === 0) endActions.push({ kind: "pass" });

            for (const ea of endActions) {
              if (supp.type === "power" && ea.kind !== "attack") continue;
              const simE = cloneSide(s3E);
              const simP = cloneSide(s3P);
              const simAct = simE.active;
              let bonusScore = -cardPenalty;
              let prizesGained = 0;
              let mySelfDead = false;
              let isImmediateWin = false;

              if (ea.kind === "attack") {
                const sk = ea.sk;
                const fx = SpecEngine.parseSkillEffects(sk.effect);
                const tgt = ea.targetSlot === "player_active" ? simP.active : simP.bench[ea.targetIdx];
                const tgtDef = SpecEngine.getMonster(tgt.id);
                const isActT = ea.targetSlot === "player_active";
                const wb = isActT ? this.getWeaknessBonus(actDef.element, tgtDef.element) : 0;
                const dmg = Math.max(0, sk.damage + wb + boost - (isActT ? (tgt.guard || 0) : 0));
                tgt.hp = Math.max(0, tgt.hp - dmg);
                if (fx.benchSplashVal > 0) {
                  for (const b of simP.bench) if (b) b.hp = Math.max(0, b.hp - fx.benchSplashVal);
                }
                if (fx.guardVal > 0) simAct.guard = Math.max(simAct.guard || 0, fx.guardVal);
                if (fx.healSelfVal > 0) simAct.hp = Math.min(actDef.hp, simAct.hp + fx.healSelfVal);
                if (fx.drawVal > 0) bonusScore += fx.drawVal * 115;
                if (fx.recoilVal > 0) simAct.hp = Math.max(0, simAct.hp - fx.recoilVal);
                for (let k = 0; k < fx.discardSelfVal && simAct.energies.length > 0; k++) {
                  let di = simAct.energies.findIndex((el) => el !== actDef.element);
                  if (di === -1) di = simAct.energies.length - 1;
                  simAct.energies.splice(di, 1);
                }

                if (simP.active.hp <= 0) {
                  prizesGained += this.getPrizeValue(simP.active.id);
                  simP.active = null;
                }
                for (let i = 0; i < 3; i++) {
                  if (simP.bench[i] && simP.bench[i].hp <= 0) {
                    prizesGained += this.getPrizeValue(simP.bench[i].id);
                    simP.bench[i] = null;
                  }
                }
                const pSurvBench = simP.bench.filter(Boolean);
                if (prizesGained >= simE.prizesLeft || (!simP.active && pSurvBench.length === 0)) {
                  isImmediateWin = true;
                } else if (!simP.active && pSurvBench.length > 0) {
                  pSurvBench.sort((a, b) => ((b.energies.length * 60 + b.hp) - (a.energies.length * 60 + a.hp)));
                  const prom = pSurvBench[0];
                  simP.bench[simP.bench.indexOf(prom)] = null;
                  simP.active = prom;
                }

                if (!isImmediateWin && simAct.hp <= 0) {
                  mySelfDead = true;
                  const pv = actDef.is_ex ? 2 : 1;
                  bonusScore -= pv * 2100;
                  if (pv >= simP.prizesLeft || simE.bench.filter(Boolean).length === 0) bonusScore -= 12000;
                }
              } else if (ea.kind === "defend") {
                simAct.guard = 30;
              }

              let score = bonusScore;
              if (isImmediateWin) {
                score += 50000;
              } else {
                score += prizesGained * 2200;
                if (simE.prizesLeft - prizesGained === 1) score += 320;

                for (const pe of getSimEntries(simP, "player")) {
                  const dmgRatio = (pe.def.hp - pe.unit.hp) / pe.def.hp;
                  const val = pe.def.is_ex ? 900 : 480;
                  score -= (1 - dmgRatio) * val + pe.unit.energies.length * 140;
                  if (pe.unit.hp <= 60) score += pe.def.is_ex ? 220 : 110;
                }

                for (const me of getSimEntries(simE, "enemy")) {
                  const maxC = Math.max(...me.def.skills.map((sk) => sk.cost.length));
                  const usefulE = Math.min(me.unit.energies.length, maxC);
                  const val = me.def.is_ex ? 950 : 460;
                  score += (me.unit.hp / me.def.hp) * val;
                  score += usefulE * (me.def.is_ex ? 245 : 155);
                  if (me.def.is_ex && me.unit.energies.length >= 3) score += 340;
                  if (me.def.is_ex && me.unit.energies.length === 2) score += 170;
                  if (me.unit.energies.includes(me.def.element)) score += 90;
                  if (me.unit.energies.length > maxC) score -= (me.unit.energies.length - maxC) * 140;
                }

                if (retreatIdx !== -1) score -= 90;

                if (!mySelfDead) {
                  const threat = this.evalEnemyCounterThreat(simE, simP);
                  if (threat.oppCanWin) {
                    score -= 9500;
                  } else if (threat.activeLethal) {
                    const actD = SpecEngine.getMonster(simE.active.id);
                    const losePrize = actD && actD.is_ex ? 2 : 1;
                    score -= losePrize * 1550 + simE.active.energies.length * 140;
                  } else {
                    score -= threat.maxDmgToActive * 4.5;
                  }
                  if (threat.worstBenchLoss > 0) score -= threat.worstBenchLoss * 900;
                }
              }

              if (!bestPlan || score > bestPlan.score) {
                bestPlan = { attachSlot, attachEnergyId, retreatIdx, supp, endAction: ea, score };
              }
            }
          }
        }
      }
      return bestPlan;
    },

    /** 统一执行对手选定攻击（含 6 种技能特效、特效飘字、彩蛋台词与击倒结算） */
    async executeEnemySkillAttack(act, actDef, sk, targetSlot, targetUnit, tDef, boost, seq) {
      const s = this.state;
      const isActTarget = targetSlot === "player_active";
      const weakBonus = isActTarget ? this.getWeaknessBonus(actDef.element, tDef.element) : 0;
      const red = isActTarget ? (targetUnit.guard || 0) : 0;
      const dmg = Math.max(0, sk.damage + weakBonus + boost - red);
      targetUnit.hp = Math.max(0, targetUnit.hp - dmg);
      const fxE = SpecEngine.parseSkillEffects(sk.effect);
      const guardVal = sk.guardVal || fxE.guardVal;
      const discardValE = sk.discardSelfVal || fxE.discardSelfVal;
      const healValE = sk.healSelfVal || fxE.healSelfVal;
      const drawValE = sk.drawVal || fxE.drawVal;
      const splashValE = sk.benchSplashVal || fxE.benchSplashVal;
      const recoilValE = sk.recoilVal || fxE.recoilVal;

      const splashedSlotsE = [];
      if (splashValE > 0) {
        for (const pb of this.getBenchEntries("player")) {
          pb.unit.hp = Math.max(0, pb.unit.hp - splashValE);
          splashedSlotsE.push(pb.slot);
        }
      }
      if (guardVal > 0) act.guard = Math.max(act.guard || 0, guardVal);
      let healedE = 0;
      if (healValE > 0 && act.hp < actDef.hp) {
        healedE = Math.min(healValE, actDef.hp - act.hp);
        act.hp += healedE;
      }
      let drawnE = 0;
      if (drawValE > 0) drawnE = this.drawCard("enemy", drawValE).length;
      if (recoilValE > 0) act.hp = Math.max(0, act.hp - recoilValE);
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
      if (!(await this.matchDelay(140, seq))) return false;
      SoundFX.play("hit");
      TableUI.flashAnim(targetSlot, "anim-hit");
      if (dmg >= 40 || weakBonus || splashedSlotsE.length > 0) TableUI.shakePlaymat();
      TableUI.spawnSlotVfx(targetSlot, actDef.element);
      TableUI.spawnFloatText(targetSlot, weakBonus ? t(`-${dmg} 弱点!`, `-${dmg} 弱点!`) : `-${dmg}`, (dmg >= 50 || weakBonus) ? "crit" : "dmg", weakBonus ? "bolt" : null);
      for (const sl of splashedSlotsE) {
        TableUI.flashAnim(sl, "anim-hit");
        TableUI.spawnFloatText(sl, t(`-${splashValE} 拡散`, `-${splashValE} 溅射`), "dmg", "splash");
      }
      if (guardVal > 0) TableUI.spawnFloatText("enemy_active", t(`被ダメ -${guardVal}`, `减伤 -${guardVal}`), "guard", "shield");
      if (healedE > 0) { SoundFX.play("heal"); TableUI.spawnFloatText("enemy_active", `+${healedE} HP`, "heal", "healPlus"); }
      if (drawnE > 0) TableUI.spawnFloatText("enemy_active", t(`+${drawnE} ドロー`, `抽 +${drawnE} 牌`), "energy", "drawCard");
      if (recoilValE > 0) TableUI.spawnFloatText("enemy_active", t(`反動 -${recoilValE}`, `反伤 -${recoilValE}`), "dmg", "warn");
      if (discardedCountE > 0) TableUI.spawnFloatText("enemy_active", t(`エネ -${discardedCountE}`, `弃能 -${discardedCountE}`), "dmg", "bolt");

      const eNotesJa = [];
      const eNotesZh = [];
      if (weakBonus) { eNotesJa.push("弱点+20"); eNotesZh.push("弱点+20"); }
      if (splashedSlotsE.length > 0) { eNotesJa.push(`ベンチ全体にも${splashValE}ダメージ`); eNotesZh.push(`己方备战区全员受溅射 ${splashValE}`); }
      if (guardVal > 0) { eNotesJa.push(`次の被ダメ-${guardVal}`); eNotesZh.push(`下回合受击-${guardVal}`); }
      if (healedE > 0) { eNotesJa.push(`HP+${healedE}回復`); eNotesZh.push(`自身回复 ${healedE} HP`); }
      if (drawnE > 0) { eNotesJa.push(`${drawnE}枚ドロー`); eNotesZh.push(`抽 ${drawnE} 张牌`); }
      if (recoilValE > 0) { eNotesJa.push(`反動${recoilValE}`); eNotesZh.push(`自身反伤 ${recoilValE}`); }
      if (discardedCountE > 0) { eNotesJa.push(`エネ-${discardedCountE}`); eNotesZh.push(`弃置能量×${discardedCountE}`); }
      const wkJa = eNotesJa.length ? `（${eNotesJa.join("・")}）` : "";
      const wkZh = eNotesZh.length ? `（${eNotesZh.join("，")}）` : "";

      let easter = null;
      if (actDef.is_ex && sk.cost.length >= 3) easter = SpecEngine.getRivalLine("enemy_ex_ult");
      else if (recoilValE > 0) easter = SpecEngine.getRivalLine("enemy_recoil");
      else if (splashedSlotsE.length > 0) easter = SpecEngine.getRivalLine("enemy_splash");

      const rivalCallJa = (easter && easter.ja) || `いくぜ！${actDef.name_ja}の『${sk.name_ja}』だ！`;
      const rivalCallZh = (easter && easter.zh) || `接招吧！${actDef.name_zh}的“${sk.name_zh}”！`;
      const ja = `レンの${actDef.name_ja}が『${sk.name_ja}』！${tDef.name_ja}に${dmg}ダメージ！${wkJa}`;
      const zh = `对手莲的${actDef.name_zh}发动“${sk.name_zh}”，对${tDef.name_zh}造成 ${dmg} 点伤害！${wkZh}`;
      TableUI.setRival(rivalCallJa, rivalCallZh);
      TableUI.setReferee(ja, zh);
      TableUI.appendLog(ja, zh);
      VoiceEngine.speak({ ja: rivalCallJa, zh: rivalCallZh }, "rival");
      VoiceEngine.speak({ ja, zh }, "referee");
      if (!(await this.matchDelay(480, seq))) return false;
      await this.checkKnockOuts();
      return seq === this.matchSeq && !s.gameOver;
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
            TableUI.spawnFloatText("enemy_active", t("疲労 -20", "疲劳 -20"), "dmg", "bolt");
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

        const tryEnemyEnergyRecycle = async () => {
          const recIdx = s.enemy.hand.indexOf("item_recycle");
          if (recIdx === -1 || !s.enemy.active) return true;
          const actDefR = SpecEngine.getMonster(s.enemy.active.id);
          let wantId = actDefR ? `energy_${actDefR.element}` : null;
          if (hardAi) {
            const needEx = this.getAllEntries("enemy").find(
              (e) => e.def.is_ex && !(e.unit.energies || []).includes(e.def.element) && !s.enemy.hand.includes(`energy_${e.def.element}`)
            );
            if (needEx) wantId = `energy_${needEx.def.element}`;
            else if (actDefR && (s.enemy.active.energies || []).includes(actDefR.element)) {
              const needyBench = this.getBenchEntries("enemy")
                .filter((b) => !(b.unit.energies || []).includes(b.def.element) && !s.enemy.hand.includes(`energy_${b.def.element}`))
                .sort((a, b) => (b.def.is_ex ? 1 : 0) - (a.def.is_ex ? 1 : 0));
              if (needyBench[0]) wantId = `energy_${needyBench[0].def.element}`;
            }
          }
          const needEnergy = !s.enemy.hand.some((id) => id.startsWith("energy_")) || (wantId && !s.enemy.hand.includes(wantId));
          if (!needEnergy) return true;
          let tIdx = wantId ? s.enemy.trash.indexOf(wantId) : -1;
          if (tIdx === -1) tIdx = s.enemy.trash.findIndex((id) => id.startsWith("energy_"));
          if (tIdx !== -1) {
            s.enemy.hand.splice(recIdx, 1);
            s.enemy.trash.push("item_recycle");
            const got = s.enemy.trash.splice(tIdx, 1)[0];
            s.enemy.hand.push(got);
            TableUI.appendLog("レンは『エネ回収』でトラッシュからエネルギーを回収した。", "对手莲使用「能量回收」从弃牌区取回 1 张能量。");
            TableUI.renderAll();
            return await this.matchDelay(380, seq);
          }
          let dIdx = wantId ? s.enemy.deck.indexOf(wantId) : -1;
          if (dIdx === -1) dIdx = s.enemy.deck.findIndex((id) => id.startsWith("energy_"));
          if (dIdx !== -1) {
            s.enemy.hand.splice(recIdx, 1);
            s.enemy.trash.push("item_recycle");
            const got = s.enemy.deck.splice(dIdx, 1)[0];
            s.enemy.hand.push(got);
            TableUI.appendLog("レンは『エネ回収』で山札からエネルギーを探索した。", "对手莲使用「能量回收」从牌库检索 1 张能量。");
            TableUI.renderAll();
            return await this.matchDelay(380, seq);
          }
          return true;
        };

        /* ===== 困难模式专属：铺场 + 能量回收 + 前瞻判断是否过牌 + 伤药 + 整回合联合连招搜索 ===== */
        if (hardAi && s.enemy.active && s.player.active) {
          const pActDefH = SpecEngine.getMonster(s.player.active.id);
          const benchAllAvailable = async () => {
            while (s.enemy.bench.includes(null)) {
              const handMons = s.enemy.hand
                .map((id, idx) => ({ id, idx, def: SpecEngine.getMonster(id) }))
                .filter((x) => x.def);
              if (handMons.length === 0) break;
              handMons.sort((a, b) => {
                const sc = (m) => (m.def.is_ex ? 140 : 0) + m.def.hp * 0.5
                  + (pActDefH && this.getWeaknessBonus(m.def.element, pActDefH.element) > 0 ? 110 : 0)
                  + (s.enemy.hand.includes(`energy_${m.def.element}`) ? 50 : 0);
                return sc(b) - sc(a);
              });
              const pick = handMons[0];
              const emptyB = s.enemy.bench.findIndex((b) => b === null);
              s.enemy.hand.splice(pick.idx, 1);
              s.enemy.bench[emptyB] = { id: pick.id, hp: pick.def.hp, energies: [], guard: 0 };
              TableUI.appendLog(`レンはベンチに${pick.def.name_ja}を出した。`, `对手莲将${pick.def.name_zh}放入备战区。`);
              TableUI.renderAll();
              if (!(await this.matchDelay(360, seq))) return false;
            }
            return true;
          };

          if (!(await benchAllAvailable())) return;
          while (s.enemy.hand.includes("item_recycle")) {
            const beforeRecCnt = s.enemy.hand.filter((id) => id === "item_recycle").length;
            if (!(await tryEnemyEnergyRecycle())) return;
            if (s.enemy.hand.filter((id) => id === "item_recycle").length === beforeRecCnt) break;
          }

          /* 补给包决策：先探查当前手牌是否存在召唤笛/力量徽章斩杀，无必杀且手牌/能量偏紧时先抽 2 扩充选择面 */
          const bagIdxH = s.enemy.hand.indexOf("item_bag");
          if (bagIdxH !== -1 && s.enemy.deck.length >= 3) {
            const probePlan = this.planHardEnemyTurn(false);
            const hasImmediateWin = probePlan && probePlan.score >= 40000;
            const hasSuppKo = probePlan && probePlan.supp && probePlan.supp.type !== "none" && probePlan.score >= 2100;
            const needBag = !hasImmediateWin && !hasSuppKo
              && (s.enemy.hand.length <= 5 || !s.enemy.hand.some((id) => id.startsWith("energy_")));
            if (needBag) {
              enemySupporterUsed = true;
              s.enemy.hand.splice(bagIdxH, 1);
              s.enemy.trash.push("item_bag");
              this.drawCard("enemy", 2);
              TableUI.appendLog("レンはサポート『補給バッグ』で2枚引いた。", "对手莲使用支援卡「补给包」抽了 2 张牌。");
              TableUI.renderAll();
              if (!(await this.matchDelay(400, seq))) return;
              if (!(await benchAllAvailable())) return;
              if (s.enemy.hand.includes("item_recycle")) {
                if (!(await tryEnemyEnergyRecycle())) return;
              }
            }
          }

          /* 伤药决策：优先救助前排与高价值 ex */
          while (s.enemy.hand.includes("item_potion")) {
            const wounded = this.getAllEntries("enemy")
              .filter((e) => e.unit.hp < e.def.hp)
              .map((e) => {
                const miss = e.def.hp - e.unit.hp;
                const sc = (miss >= 30 ? 300 : 0) + (e.def.is_ex ? 220 : 0) + (e.slot === "enemy_active" ? 160 : 0) + miss;
                return { entry: e, sc, heal: Math.min(30, miss) };
              })
              .filter((x) => x.sc >= 300)
              .sort((a, b) => b.sc - a.sc);
            if (wounded.length === 0) break;
            const bestH = wounded[0];
            s.enemy.hand.splice(s.enemy.hand.indexOf("item_potion"), 1);
            s.enemy.trash.push("item_potion");
            bestH.entry.unit.hp += bestH.heal;
            TableUI.appendLog(`レンはきずぐすりで${bestH.entry.def.name_ja}を${bestH.heal}回復！`, `对手莲用伤药为${bestH.entry.def.name_zh}回复 ${bestH.heal} HP！`);
            TableUI.renderAll();
            if (!(await this.matchDelay(400, seq))) return;
          }

          /* 联合连招规划并按序执行（贴能 → 撤退 → 召唤笛/力量徽章 → 攻击/防御） */
          const hardPlan = this.planHardEnemyTurn(enemySupporterUsed);
          if (hardPlan) {
            if (hardPlan.attachSlot && hardPlan.attachEnergyId) {
              const eIdx = s.enemy.hand.indexOf(hardPlan.attachEnergyId);
              const tgtEntry = this.getAllEntries("enemy").find((e) => e.slot === hardPlan.attachSlot);
              if (eIdx !== -1 && tgtEntry) {
                const cardId = s.enemy.hand.splice(eIdx, 1)[0];
                const itDef = SpecEngine.getItem(cardId);
                tgtEntry.unit.energies.push(itDef.element);
                TableUI.appendLog(`レンは${tgtEntry.def.name_ja}に${itDef.name_ja}をつけた。`, `对手莲为${tgtEntry.def.name_zh}贴上了${itDef.name_zh}。`);
                TableUI.renderAll();
                if (!(await this.matchDelay(440, seq))) return;
              }
            }

            if (hardPlan.retreatIdx !== -1 && s.enemy.bench[hardPlan.retreatIdx]) {
              const old = s.enemy.active;
              const oldDef = SpecEngine.getMonster(old.id);
              const rCost = oldDef && oldDef.is_ex ? 2 : 1;
              for (let k = 0; k < rCost; k++) {
                let discIdx = old.energies.findIndex((el) => el !== oldDef.element);
                if (discIdx === -1) discIdx = old.energies.length - 1;
                const discardedElem = old.energies.splice(discIdx, 1)[0];
                if (discardedElem) s.enemy.trash.push(`energy_${discardedElem}`);
              }
              const incoming = s.enemy.bench[hardPlan.retreatIdx];
              const incomingDef = SpecEngine.getMonster(incoming.id);
              old.guard = 0;
              s.enemy.active = incoming;
              s.enemy.bench[hardPlan.retreatIdx] = old;
              SoundFX.play("switch");
              TableUI.appendLog(`レンは${incomingDef.name_ja}と交代した！`, `对手莲撤退并换上${incomingDef.name_zh}！`);
              TableUI.renderAll();
              TableUI.flashAnim("enemy_active", "anim-enter");
              if (!(await this.matchDelay(480, seq))) return;
            }

            let hardBoost = 0;
            if (hardPlan.supp && hardPlan.supp.type === "power" && s.enemy.hand.includes("item_power")) {
              enemySupporterUsed = true;
              s.enemy.hand.splice(s.enemy.hand.indexOf("item_power"), 1);
              s.enemy.trash.push("item_power");
              hardBoost = 20;
              TableUI.appendLog("レンはサポート『パワーバッジ』を使用！（攻撃+20）", "对手莲使用支援卡「力量徽章」！（本回合攻击 +20）");
              TableUI.spawnFloatText("enemy_active", t("攻撃+20！", "攻击+20！"), "energy", "sword");
              TableUI.renderAll();
              if (!(await this.matchDelay(320, seq))) return;
            } else if (hardPlan.supp && hardPlan.supp.type === "flute" && s.enemy.hand.includes("item_flute") && s.player.bench[hardPlan.supp.benchIdx]) {
              enemySupporterUsed = true;
              s.enemy.hand.splice(s.enemy.hand.indexOf("item_flute"), 1);
              s.enemy.trash.push("item_flute");
              const pulledUnit = s.player.bench[hardPlan.supp.benchIdx];
              const pulledDef = SpecEngine.getMonster(pulledUnit.id);
              const oldPlayerAct = s.player.active;
              oldPlayerAct.guard = 0;
              s.player.active = pulledUnit;
              s.player.bench[hardPlan.supp.benchIdx] = oldPlayerAct;
              TableUI.renderAll();
              SoundFX.play("switch");
              TableUI.flashAnim("player_active", "anim-enter");
              TableUI.spawnFloatText("player_active", t("強制交代！", "强制换人！"), "guard", "swapChip");
              TableUI.appendLog(`レンはサポート『よびだし笛』で${pulledDef.name_ja}を引きずり出した！`, `对手莲发动支援卡「召唤笛」，强行将你的${pulledDef.name_zh}拉上战斗区！`);
              if (!(await this.matchDelay(480, seq))) return;
            }

            const actH = s.enemy.active;
            const actDefH = SpecEngine.getMonster(actH.id);
            const ea = hardPlan.endAction;
            if (ea && ea.kind === "attack" && s.player.active) {
              const targetUnit = ea.targetSlot === "player_active" ? s.player.active : s.player.bench[ea.targetIdx];
              const realSlot = targetUnit ? ea.targetSlot : "player_active";
              const realUnit = targetUnit || s.player.active;
              const realDef = SpecEngine.getMonster(realUnit.id);
              const ok = await this.executeEnemySkillAttack(actH, actDefH, ea.sk, realSlot, realUnit, realDef, hardBoost, seq);
              if (!ok) return;
            } else if (ea && ea.kind === "defend" && actH.lastDefendedTurn !== s.turn - 1) {
              actH.guard = 30;
              actH.lastDefendedTurn = s.turn;
              TableUI.renderAll();
              SoundFX.play("guard");
              TableUI.flashAnim("enemy_active", "anim-guard");
              TableUI.spawnFloatText("enemy_active", t("防御 -30", "防御 -30"), "guard", "shield");
              const ja = "レンは防御態勢に入りターンを終了した。";
              const zh = "对手莲进入防御姿态并结束了回合。";
              const guardCallJa = "ここは守りを固めておくぜ。";
              const guardCallZh = "这回合先稳住防守。";
              TableUI.setRival(guardCallJa, guardCallZh);
              TableUI.setReferee(ja, zh);
              TableUI.appendLog(ja, zh);
              VoiceEngine.speak({ ja: guardCallJa, zh: guardCallZh }, "rival");
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
          if (s.player.active) s.player.active.guard = 0;

          if (s.player.deck.length === 0) {
            if (s.player.active) {
              s.player.active.hp = Math.max(0, s.player.active.hp - 20);
              TableUI.renderAll();
              TableUI.spawnFloatText("player_active", t("疲労 -20", "疲劳 -20"), "dmg", "bolt");
              TableUI.appendLog("自分の山札が空のため疲労ダメージ20！", "己方牌库已空，主战怪兽受到 20 点疲劳伤害！");
              if (!(await this.matchDelay(420, seq))) return;
              await this.checkKnockOuts();
              if (seq !== this.matchSeq || s.gameOver) return;
            }
            const fatigueJa = `ターン${s.turn}、あなたの番です。`;
            const fatigueZh = `第 ${s.turn} 回合，轮到你的回合。`;
            TableUI.showTurnBanner(`ターン ${s.turn} · あなたのターン`, `第 ${s.turn} 回合 · 你的回合`, false);
            if (s.pending && s.pending.type === "promote_bench") {
              TableUI.setReferee(`${s.pending.promptJa}（${fatigueJa}）`, `${s.pending.promptZh}（${fatigueZh}）`);
            } else {
              TableUI.setReferee(fatigueJa, fatigueZh);
              VoiceEngine.speak({ ja: fatigueJa, zh: fatigueZh }, "referee", { priority: "low" });
            }
          } else {
            const drawn = this.drawCard("player", 1);
            TableUI.renderAll();
            const dJa = drawn[0] ? `「${drawn[0].ja}」を引きました。` : "";
            const dZh = drawn[0] ? `抽到了「${drawn[0].zh}」。` : "";
            TableUI.showTurnBanner(`ターン ${s.turn} · あなたのターン`, `第 ${s.turn} 回合 · 你的回合`, false);
            TableUI.setReferee(`あなたのターンです！${dJa}`, `轮到你的回合了！${dZh}`);
            TableUI.appendLog(`ターン ${s.turn} 開始：${dJa}`, `第 ${s.turn} 回合开始：${dZh}`);
            VoiceEngine.speak({ ja: `あなたのターンです！${dJa}`, zh: `轮到你的回合了！${dZh}` }, "referee", { priority: "low" });
          }
          TableUI.renderAll();
          this.resetIdleTimer(true);
          return;
        }

        /* ===== 普通模式：自然直观的节奏打法（约 75% 一般玩家胜率，与困难模式形成清晰梯度） ===== */
        /* 阶段 1：手牌紧张时使用补给包；手中无能量时尝试从弃牌区回收 1 张能量 */
        const bagIdx = s.enemy.hand.indexOf("item_bag");
        if (bagIdx !== -1 && s.enemy.deck.length >= 5 && s.enemy.hand.length <= 3 && s.enemy.active && s.player.active) {
          enemySupporterUsed = true;
          s.enemy.hand.splice(bagIdx, 1);
          s.enemy.trash.push("item_bag");
          this.drawCard("enemy", 2);
          TableUI.appendLog("レンはサポート『補給バッグ』で2枚引いた。", "对手莲使用支援卡「补给包」抽了 2 张牌。");
          TableUI.renderAll();
          if (!(await this.matchDelay(420, seq))) return;
        }
        const recIdxN = s.enemy.hand.indexOf("item_recycle");
        if (recIdxN !== -1 && !s.enemy.hand.some((id) => id.startsWith("energy_"))) {
          const tIdxN = s.enemy.trash.findIndex((id) => id.startsWith("energy_"));
          if (tIdxN !== -1) {
            s.enemy.hand.splice(recIdxN, 1);
            s.enemy.trash.push("item_recycle");
            const got = s.enemy.trash.splice(tIdxN, 1)[0];
            s.enemy.hand.push(got);
            TableUI.appendLog("レンは『エネ回収』でトラッシュからエネルギーを回収した。", "对手莲使用「能量回收」从弃牌区取回 1 张能量。");
            TableUI.renderAll();
            if (!(await this.matchDelay(380, seq))) return;
          }
        }

        /* 阶段 2：铺场备战区（普通模式最多维持 2 只备战且优先放常规怪，不抢铺 ex 压场） */
        const curBenchCountN = s.enemy.bench.filter(Boolean).length;
        if (curBenchCountN < 2 && s.enemy.bench.includes(null)) {
          const handMons = s.enemy.hand
            .map((id, idx) => ({ id, idx, def: SpecEngine.getMonster(id) }))
            .filter((x) => x.def);
          if (handMons.length > 0) {
            handMons.sort((a, b) => (a.def.is_ex ? 1 : 0) - (b.def.is_ex ? 1 : 0));
            const pick = handMons[0];
            const emptyB = s.enemy.bench.findIndex((b) => b === null);
            s.enemy.hand.splice(pick.idx, 1);
            s.enemy.bench[emptyB] = { id: pick.id, hp: pick.def.hp, energies: [], guard: 0 };
            TableUI.appendLog(`レンはベンチに${pick.def.name_ja}を出した。`, `对手莲将${pick.def.name_zh}放入备战区。`);
            TableUI.renderAll();
            if (!(await this.matchDelay(420, seq))) return;
          }
        }

        /* 阶段 3：主战残血时使用 1 瓶伤药 */
        if (s.enemy.active && s.enemy.hand.includes("item_potion")) {
          const actDefP = SpecEngine.getMonster(s.enemy.active.id);
          const missingP = actDefP ? (actDefP.hp - s.enemy.active.hp) : 0;
          if (actDefP && s.enemy.active.hp <= 40 && missingP >= 30) {
            const healAmt = Math.min(30, missingP);
            s.enemy.hand.splice(s.enemy.hand.indexOf("item_potion"), 1);
            s.enemy.trash.push("item_potion");
            s.enemy.active.hp += healAmt;
            TableUI.appendLog(`レンはきずぐすりで${actDefP.name_ja}を${healAmt}回復！`, `对手莲用伤药为${actDefP.name_zh}回复 ${healAmt} HP！`);
            TableUI.renderAll();
            if (!(await this.matchDelay(460, seq))) return;
          }
        }

        /* 阶段 4：直观给当前前排主战怪贴能（优先匹配前排属性，不做备战蓄能与能量色保留精算） */
        if (s.enemy.active && s.enemy.hand.some((id) => id.startsWith("energy_"))) {
          const actUnit = s.enemy.active;
          const actDefE = SpecEngine.getMonster(actUnit.id);
          if (actDefE) {
            let eIdx = !(actUnit.energies || []).includes(actDefE.element)
              ? s.enemy.hand.indexOf(`energy_${actDefE.element}`)
              : -1;
            if (eIdx === -1) eIdx = s.enemy.hand.findIndex((id) => id.startsWith("energy_"));
            if (eIdx !== -1) {
              const cardId = s.enemy.hand.splice(eIdx, 1)[0];
              const itDef = SpecEngine.getItem(cardId);
              actUnit.energies.push(itDef.element);
              TableUI.appendLog(`レンは${actDefE.name_ja}に${itDef.name_ja}をつけた。`, `对手莲为${actDefE.name_zh}贴上了${itDef.name_zh}。`);
              TableUI.renderAll();
              if (!(await this.matchDelay(480, seq))) return;
            }
          }
        }

        /* 阶段 5：正面进攻（选择前排最高基础伤技能，有力量徽章直接交；无法攻击时防御 -30） */
        const act = s.enemy.active;
        if (act && s.player.active) {
          const actDef = SpecEngine.getMonster(act.id);
          const usableSkills = actDef
            ? actDef.skills.filter((sk) => this.canPayCost(act.energies, sk.cost)).sort((a, b) => b.damage - a.damage)
            : [];
          if (usableSkills.length > 0) {
            const sk = usableSkills[0];
            const pwrIdx = s.enemy.hand.indexOf("item_power");
            if (!enemySupporterUsed && pwrIdx !== -1) {
              enemySupporterUsed = true;
              s.enemy.hand.splice(pwrIdx, 1);
              s.enemy.trash.push("item_power");
              s.enemy.attackBoost = (s.enemy.attackBoost || 0) + 20;
              TableUI.appendLog("レンはサポート『パワーバッジ』を使用！（攻撃+20）", "对手莲使用支援卡「力量徽章」！（本回合攻击 +20）");
              TableUI.spawnFloatText("enemy_active", t("攻撃+20！", "攻击+20！"), "energy", "sword");
              TableUI.renderAll();
              if (!(await this.matchDelay(320, seq))) return;
            }
            const boost = s.enemy.attackBoost || 0;
            s.enemy.attackBoost = 0;
            const targetUnit = s.player.active;
            const tDef = SpecEngine.getMonster(targetUnit.id);
            const ok = await this.executeEnemySkillAttack(act, actDef, sk, "player_active", targetUnit, tDef, boost, seq);
            if (!ok) return;
          } else if (act.lastDefendedTurn !== s.turn - 1) {
            act.guard = 30;
            act.lastDefendedTurn = s.turn;
            TableUI.renderAll();
            SoundFX.play("guard");
            TableUI.flashAnim("enemy_active", "anim-guard");
            TableUI.spawnFloatText("enemy_active", t("防御 -30", "防御 -30"), "guard", "shield");
            const ja = "レンは防御態勢に入りターンを終了した。";
            const zh = "对手莲进入防御姿态并结束了回合。";
            const guardCallJa = "ここは守りを固めておくぜ。";
            TableUI.setRival(guardCallJa, "这回合先稳住防守。");
            TableUI.setReferee(ja, zh);
            TableUI.appendLog(ja, zh);
            VoiceEngine.speak({ ja: guardCallJa, zh: "这回合先稳住防守。" }, "rival");
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
            TableUI.spawnFloatText("player_active", t("疲労 -20", "疲劳 -20"), "dmg", "bolt");
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
        TableUI.showTurnBanner(`ターン ${s.turn}：あなたの番`, `第 ${s.turn} 回合：你的回合`, false);
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

    /** 触发单卡一次性动效（攻击前冲 / 受击震动 / 贴能激活 / 回复 / 登场 / 防御 / 拒绝微抖） */
    flashAnim(slot, cls) {
      const slotEl = this.getSlotEl(slot);
      const el = slotEl ? slotEl.querySelector(".card") : null;
      if (!el) return;
      el.classList.remove("anim-hit", "anim-lunge-up", "anim-lunge-down", "anim-powerup", "anim-heal", "anim-enter", "anim-guard", "anim-deny");
      void el.offsetWidth;
      el.classList.add(cls);
    },

    /** 操作受限（能量不足 / 次数已用 / 满员 / 满血等）的视觉拒绝抖动 + 飘字反馈 */
    flashDeny(slot, jaLabel, zhLabel) {
      const slotEl = this.getSlotEl(slot);
      const target = (slotEl && slotEl.querySelector(".card")) || slotEl;
      if (target) {
        target.classList.remove("anim-deny");
        void target.offsetWidth;
        target.classList.add("anim-deny");
      }
      SoundFX.play("tap");
      this.spawnFloatText(slot, t(jaLabel, zhLabel), "warn");
    },

    /** 在目标槽位上方生成带矢量 SVG 图标的浮动战斗数值/状态文字 */
    spawnFloatText(slot, text, kind = "dmg", iconKey = null) {
      const slotEl = this.getSlotEl(slot);
      if (!slotEl || !text) return;
      const badge = document.createElement("div");
      badge.className = `float-text ${kind}`;
      const iconSvg = iconKey && SVG_ICONS[iconKey] ? `<span class="float-icon">${SVG_ICONS[iconKey]}</span>` : "";
      badge.innerHTML = `${iconSvg}<span>${escapeHtml(text)}</span>`;
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
        ja = `サイド ${count}枚獲得！（${takenTotal}/${TOTAL_PRIZES}）${namesJa ? ` 手札へ：${namesJa}` : ""}`;
        zh = `获得 ${count} 张奖赏卡！（进度 ${takenTotal}/${TOTAL_PRIZES}）${namesZh ? ` 已加入手牌：${namesZh}` : ""}`;
      } else {
        ja = `相手がサイドを ${count}枚獲得！（相手 ${takenTotal}/${TOTAL_PRIZES}）`;
        zh = `对手获得 ${count} 张奖赏卡！（对手进度 ${takenTotal}/${TOTAL_PRIZES}）`;
      }
      const starHtml = `<span class="toast-icon">${SVG_ICONS.prizeStar}</span>`;
      el.className = "prize-toast" + (isEnemy ? " enemy" : "");
      el.innerHTML = `<div class="pt-ja">${starHtml}${escapeHtml(ja)}</div><div class="pt-zh" lang="zh-CN">${starHtml}${escapeHtml(zh)}</div>`;
      void el.offsetWidth;
      el.classList.add("show");
      this._prizeToastTimer = setTimeout(() => el.classList.remove("show"), 2800);
    },

    /** 牌桌中央轻提示回合切换横幅（约 1.95s 从容停留 + 0.32s 平滑淡出，不阻塞点击操作） */
    showTurnBanner(ja, zh, isEnemy = false) {
      const el = $("turnBanner");
      if (!el) return;
      clearTimeout(this._bannerTimer);
      el.className = "turn-banner" + (isEnemy ? " enemy" : "");
      el.innerHTML = `<div class="tb-ja">${escapeHtml(ja)}</div><div class="tb-zh" lang="zh-CN">${escapeHtml(zh)}</div>`;
      void el.offsetWidth;
      el.classList.add("show");
      this._bannerTimer = setTimeout(() => el.classList.remove("show"), 1950);
    },

    /** 顶部轻提示弹窗（用于设置保存成功等即时反馈） */
    showToast(ja, zh) {
      const el = $("saveToast");
      if (!el) return;
      clearTimeout(this._toastTimer);
      el.innerHTML = `${SVG_ICONS.check}${escapeHtml(t(ja, zh))}`;
      el.classList.add("show");
      this._toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
    },

    /** 实时语音收音与解析状态 HUD 浮层（listening / fast / llm） */
    showVoiceHud(mode = "listening", text = "") {
      const hud = $("voiceHud");
      const iconEl = $("voiceHudIcon");
      const labelEl = $("voiceHudLabel");
      const textEl = $("voiceHudText");
      if (!hud || !labelEl || !textEl) return;
      clearTimeout(this._hudTimer);
      hud.classList.remove("hud-listening", "hud-fast", "hud-llm");
      const cleanText = String(text || "").trim();
      if (mode === "fast") {
        hud.classList.add("hud-fast");
        if (iconEl) iconEl.innerHTML = SVG_ICONS.bolt;
        labelEl.textContent = t("実行：", "已执行：");
        textEl.textContent = cleanText ? `「${cleanText}」` : "";
        hud.classList.add("show");
        this._hudTimer = setTimeout(() => hud.classList.remove("show"), 1500);
      } else if (mode === "llm") {
        hud.classList.add("hud-llm");
        if (iconEl) iconEl.innerHTML = SVG_ICONS.hudSpinner;
        labelEl.textContent = t("AI解析中：", "AI 意图解析中：");
        textEl.textContent = cleanText ? `「${cleanText}」` : "…";
        hud.classList.add("show");
        this._hudTimer = setTimeout(() => hud.classList.remove("show"), 16000);
      } else {
        hud.classList.add("hud-listening");
        if (iconEl) iconEl.innerHTML = SVG_ICONS.hudWave;
        labelEl.textContent = t("聴取中：", "正在聆听：");
        textEl.textContent = cleanText ? `「${cleanText}」` : "…";
        hud.classList.add("show");
        this._hudTimer = setTimeout(() => hud.classList.remove("show"), 12000);
      }
    },

    hideVoiceHud() {
      clearTimeout(this._hudTimer);
      $("voiceHud")?.classList.remove("show");
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
          ? `<span class="skill-tag snipe" title="${escapeHtml(t("狙撃ワザ：バトル場・ベンチどちらにも攻撃可（ベンチは弱点なし）", "狙击技能：可攻击对手战斗区或备战区任意怪兽（对备战区不计弱点）"))}">${SVG_ICONS.snipe}${escapeHtml(t("狙撃", "狙击"))}</span>`
          : "";
        const effectTag = this.buildSkillEffectTags(sk);
        const canDirectClick = ready && slot === "player_active";
        let isLethal = false;
        let dmgInner = `${sk.damage}`;
        if (slot === "player_active" && eAct && eActDef) {
          const wk = BattleEngine.getWeaknessBonus(def.element, eActDef.element);
          const bst = sNow?.player?.attackBoost || 0;
          const red = eAct.guard || 0;
          const eff = Math.max(0, sk.damage + wk + bst - red);
          if (eff !== sk.damage) {
            dmgInner = `${sk.damage}<span class="eff-dmg">→${eff}</span>`;
          }
          if (ready && eff >= eAct.hp) {
            isLethal = true;
          }
        }
        const dmgHtml = isLethal
          ? `<span class="skill-dmg is-lethal" title="${escapeHtml(t("一撃で撃破可能", "可直接击倒"))}">${SVG_ICONS.sword}${dmgInner}</span>`
          : `<span class="skill-dmg">${dmgInner}</span>`;
        return `
          <div class="skill-line ${ready ? "ready" : ""} ${justUnlocked ? "just-unlocked" : ""}"
               data-skill-ja="${escapeHtml(sk.name_ja)}"
               data-slot="${escapeHtml(slot)}"
               ${canDirectClick ? `title="${escapeHtml(t("クリックで発動", "点击直接发动"))}"` : ""}>
            <div class="skill-left">
              ${costPips}
              <span class="skill-name">${escapeHtml(t(sk.name_ja, sk.name_zh))}</span>
              ${targetTag}${effectTag}
            </div>
            <span class="skill-right">${dmgHtml}</span>
          </div>
        `;
      }).join("");

      const weakElem = WEAKNESS_MAP[def.element];
      const weakBadge = weakElem
        ? `<span class="weak-chip">${escapeHtml(t("弱", "弱"))}<span style="color:${ELEM_COLOR[weakElem] || "inherit"};display:inline-flex;vertical-align:-1px;"><span class="chip-icon" style="margin:0 1px;">${SVG_ICONS[weakElem]}</span></span>+20</span>`
        : "";
      const showBoost = (slot === "player_active" && sNow?.player?.attackBoost > 0)
        ? sNow.player.attackBoost
        : (slot === "enemy_active" && sNow?.enemy?.attackBoost > 0 ? sNow.enemy.attackBoost : 0);
      let isThreat = false;
      let threatTitle = "";
      if (slot === "player_active" && sNow?.phase === "battle" && eAct && eActDef) {
        const eMax = BattleEngine.estimateUnitMaxOutput(eAct, inst, true, []);
        if (typeof eMax === "number" && eMax >= inst.hp) {
          isThreat = true;
          threatTitle = t(`相手次ターン最大${eMax}ダメージできぜつ危険`, `下回合敌方最高可打 ${eMax} 伤害，有被击倒风险`);
        }
      }
      return `
        <div class="card ${escapeHtml(def.element)} ${def.is_ex ? "is-ex" : ""} ${inst.guard > 0 ? "guarding" : ""}" data-slot="${escapeHtml(slot)}">
          <div class="card-head">
            <div class="card-head-left">
              ${CARD_ART[inst.id] ? `<span class="card-art">${CARD_ART[inst.id]}</span>` : `<span class="pip ${escapeHtml(def.element)} filled">${SVG_ICONS[def.element] || SVG_ICONS.any}</span>`}
              <div class="card-title-inline">${escapeHtml(t(def.name_ja, def.name_zh))}</div>
            </div>
            <div class="card-head-right">
              <span class="hp-badge ${isThreat ? "is-threat" : ""}"${threatTitle ? ` title="${escapeHtml(threatTitle)}"` : ""}>${isThreat ? SVG_ICONS.warn : ""}HP ${inst.hp}/${def.hp}</span>
            </div>
          </div>
          <div class="hp-track"><div class="hp-fill ${fillCls}" style="width:${pct}%"></div></div>
          <div class="token-row">
            <div class="energy-pips">${pipsHtml || `<span class="energy-zero">${escapeHtml(t("エネ0", "无能"))}</span>`}</div>
            <div class="token-chips">
              ${def.is_ex ? `<span class="ex-chip">ex</span>` : ""}
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
        const weakElem = WEAKNESS_MAP[mon.element];
        const weakBadge = weakElem
          ? `<span class="weak-chip">${escapeHtml(t("弱", "弱"))}<span style="color:${ELEM_COLOR[weakElem] || "inherit"};display:inline-flex;vertical-align:-1px;"><span class="chip-icon" style="margin:0 1px;">${SVG_ICONS[weakElem]}</span></span>+20</span>`
          : "";
        const monTitle = isSetup
          ? ` title="${escapeHtml(t("クリックまたは名前を言って先発に出す", "点击或说出名字作为首发上场"))}"`
          : ` title="${escapeHtml(t("クリックまたは音声でベンチに出せます", "可直接点击或语音放入备战区"))}"`;
        return `
          <div class="card ${escapeHtml(mon.element)} ${mon.is_ex ? "is-ex" : ""} hand-card ${selected ? "selected" : ""} ${isSetup ? "setup-pick" : ""}" data-hand-idx="${idx}" draggable="true"${monTitle}>
            <div class="card-head">
              <div class="card-head-left">
                ${CARD_ART[mon.id] ? `<span class="card-art">${CARD_ART[mon.id]}</span>` : `<span class="pip ${escapeHtml(mon.element)} filled">${SVG_ICONS[mon.element] || SVG_ICONS.any}</span>`}
                <div class="card-title-inline">${escapeHtml(t(mon.name_ja, mon.name_zh))}</div>
              </div>
              <div class="card-head-right">
                <span class="hp-badge">HP ${mon.hp}</span>
              </div>
            </div>
            <div class="hp-track"><div class="hp-fill" style="width:100%"></div></div>
            <div class="token-row">
              <div class="energy-pips">${isSetup ? `<span class="setup-badge">${escapeHtml(t("先発可", "可首发"))}</span>` : `<span class="energy-zero">${escapeHtml(t("手札", "手牌"))}</span>`}</div>
              <div class="token-chips">
                ${mon.is_ex ? `<span class="ex-chip">ex</span>` : ""}
                ${weakBadge}
              </div>
            </div>
            <div class="skills-list">
              ${mon.skills.map((sk) => `
                <div class="skill-line">
                  <div class="skill-left">
                    ${(sk.cost || []).map((c) => `<span class="pip ${escapeHtml(c)} filled">${SVG_ICONS[c] || SVG_ICONS.any}</span>`).join("")}
                    <span class="skill-name">${escapeHtml(t(sk.name_ja, sk.name_zh))}</span>
                    ${sk.target === "enemy_any" ? `<span class="skill-tag snipe">${SVG_ICONS.snipe}${escapeHtml(t("狙撃", "狙击"))}</span>` : ""}${this.buildSkillEffectTags(sk)}
                  </div>
                  <span class="skill-right"><span class="skill-dmg">${sk.damage}</span></span>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
      const it = SpecEngine.getItem(cardId);
      if (!it) return "";
      const isSup = it.category === "supporter";
      const isEnergy = it.category === "energy";
      const cls = isEnergy ? it.element : (isSup ? "supporter" : "item");
      const supUsed = isSup && BattleEngine.state.supporterUsedThisTurn;
      const catChip = isSup
        ? `<span class="supporter-chip">${escapeHtml(supUsed ? t("使用済", "已用") : t("サポート", "支援"))}</span>`
        : (isEnergy
          ? `<span class="energy-cat-chip ${escapeHtml(cls)}">${escapeHtml(t("エネ", "能量"))}</span>`
          : `<span class="item-cat-chip">${escapeHtml(t("グッズ", "道具"))}</span>`);
      const watermarkHtml = isEnergy && SVG_ICONS[it.element]
        ? `<span class="energy-watermark ${escapeHtml(cls)}" aria-hidden="true">${SVG_ICONS[it.element]}</span>`
        : "";
      return `
        <div class="card ${escapeHtml(cls)} hand-card util-card ${isEnergy ? "energy-card" : ""} ${selected ? "selected" : ""} ${supUsed ? "supporter-used" : ""}" data-hand-idx="${idx}" draggable="true">
          <div class="card-head">
            <div class="card-head-left">
              ${CARD_ART[it.id] ? `<span class="card-art">${CARD_ART[it.id]}</span>` : ""}
              <div class="card-title-inline">${escapeHtml(t(it.name_ja, it.name_zh))}</div>
            </div>
            <div class="card-head-right">${catChip}</div>
          </div>
          <div class="card-desc">
            <div class="desc-ja">${escapeHtml(it.desc_ja)}</div>
            <div class="desc-zh" lang="zh-CN">${escapeHtml(it.desc_zh)}</div>
          </div>
          ${watermarkHtml}
        </div>
      `;
    },

    buildSkillEffectTags(sk) {
      const fx = SpecEngine.parseSkillEffects(sk.effect);
      const gVal = sk.guardVal || fx.guardVal;
      const dVal = sk.discardSelfVal || fx.discardSelfVal;
      const hVal = sk.healSelfVal || fx.healSelfVal;
      const drVal = sk.drawVal || fx.drawVal;
      const spVal = sk.benchSplashVal || fx.benchSplashVal;
      const rcVal = sk.recoilVal || fx.recoilVal;
      let html = "";
      if (spVal > 0) html += `<span class="skill-tag splash" title="${escapeHtml(t(`相手ベンチ全員にも${spVal}ダメージ`, `同时对对手全体备战怪兽造成 ${spVal} 溅射伤害`))}">${escapeHtml(t(`後列${spVal}`, `后排${spVal}`))}</span>`;
      if (gVal > 0) html += `<span class="skill-tag guard" title="${escapeHtml(t(`次の相手ターン被ダメ-${gVal}`, `发动后下回合受击伤害 -${gVal}`))}">${escapeHtml(t(`被ダメ-${gVal}`, `减伤-${gVal}`))}</span>`;
      if (hVal > 0) html += `<span class="skill-tag heal" title="${escapeHtml(t(`自身のHPを${hVal}回復`, `发动后回复自身 ${hVal} HP`))}">${escapeHtml(t(`回復+${hVal}`, `回复+${hVal}`))}</span>`;
      if (drVal > 0) html += `<span class="skill-tag draw" title="${escapeHtml(t(`山札から${drVal}枚ドロー`, `发动后额外抽 ${drVal} 张牌`))}">${escapeHtml(t(`+${drVal}ドロー`, `抽${drVal}牌`))}</span>`;
      if (rcVal > 0) html += `<span class="skill-tag recoil" title="${escapeHtml(t(`自身にも反動${rcVal}ダメージ`, `发动后自身承受 ${rcVal} 反伤`))}">${escapeHtml(t(`反動${rcVal}`, `反伤${rcVal}`))}</span>`;
      if (dVal > 0) html += `<span class="skill-tag recoil" title="${escapeHtml(t(`発動後自身のエネルギーを${dVal}枚トラッシュ`, `发动后弃置自身 ${dVal} 张能量`))}">${escapeHtml(t(`エネ-${dVal}`, `弃能-${dVal}`))}</span>`;
      return html;
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
            ? `<span class="side-tag player">${escapeHtml(t("自分デッキ", "己方卡组"))}</span>`
            : `<span class="side-tag opponent">${escapeHtml(t("相手デッキ", "对手卡组"))}</span>`;
          const skillsHtml = m.skills.map((sk) => {
            const pips = (sk.cost || []).map((c) =>
              `<span class="pip ${escapeHtml(c)} filled">${SVG_ICONS[c] || SVG_ICONS.any}</span>`
            ).join("");
            const isSnipe = sk.target === "enemy_any";
            const tagHtml = isSnipe
              ? `<span class="skill-tag snipe">${SVG_ICONS.snipe}${escapeHtml(t("狙撃", "狙击"))}</span>`
              : `<span class="skill-tag normal">${escapeHtml(t("通常・前", "普通・前"))}</span>`;
            const fx = SpecEngine.parseSkillEffects(sk.effect);
            const gVal = sk.guardVal || fx.guardVal;
            const dVal = sk.discardSelfVal || fx.discardSelfVal;
            const hVal = sk.healSelfVal || fx.healSelfVal;
            const drVal = sk.drawVal || fx.drawVal;
            const spVal = sk.benchSplashVal || fx.benchSplashVal;
            const rcVal = sk.recoilVal || fx.recoilVal;
            const effHtml = this.buildSkillEffectTags(sk);
            const jaExtras = [];
            const zhExtras = [];
            if (spVal > 0) { jaExtras.push(`相手ベンチ全員にも${spVal}ダメージ`); zhExtras.push(`对手全部备战区额外溅射 ${spVal} 伤害`); }
            if (gVal > 0) { jaExtras.push(`次の相手ターン被ダメ-${gVal}`); zhExtras.push(`下回合受击 -${gVal}`); }
            if (hVal > 0) { jaExtras.push(`自身のHPを${hVal}回復`); zhExtras.push(`自身回复 ${hVal} HP`); }
            if (drVal > 0) { jaExtras.push(`山札を${drVal}枚引く`); zhExtras.push(`额外抽 ${drVal} 张牌`); }
            if (rcVal > 0) { jaExtras.push(`自身に反動${rcVal}ダメージ`); zhExtras.push(`自身反伤 ${rcVal}`); }
            if (dVal > 0) { jaExtras.push(`発動後自身のエネルギーを${dVal}枚トラッシュ`); zhExtras.push(`发动后弃置自身 ${dVal} 张能量`); }
            const baseJa = isSnipe ? "狙撃ワザ：相手バトル場・ベンチどちらも可（ベンチは弱点なし）" : "通常ワザ：相手バトル場のみ（弱点+20）";
            const baseZh = isSnipe ? "定点狙击：可打对手战斗区或备战区任意怪兽（对备战区不计弱点）" : "普通攻击：仅打对手战斗区（计算弱点 +20）";
            const desc = escapeHtml(t(
              `${baseJa}${jaExtras.length ? `／${jaExtras.join("・")}` : ""}`,
              `${baseZh}${zhExtras.length ? `；${zhExtras.join("，")}` : ""}`
            ));
            return `
              <div class="codex-skill-row">
                <div class="codex-skill-top">
                  <div class="skill-left">${pips}<span class="skill-name">${escapeHtml(t(sk.name_ja, sk.name_zh))}</span>${tagHtml}${effHtml}</div>
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
                  <div class="card-title-inline">${escapeHtml(t(m.name_ja, m.name_zh))}</div>
                </div>
                <span class="hp-badge">HP ${m.hp}</span>
              </div>
              <div class="codex-meta">
                <div>${sideHtml} ${m.is_ex ? `<span class="ex-chip">${escapeHtml(t("ex・サイド2枚", "ex・击倒拿2奖"))}</span>` : ""}</div>
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
            ? escapeHtml(t("エネルギー", "能量卡"))
            : (isSup
              ? escapeHtml(t("サポート", "支援卡"))
              : escapeHtml(t("グッズ", "道具卡")));
          cards.push(`
            <div class="codex-card ${escapeHtml(cls)}">
              <div class="card-head">
                <div class="card-head-left">
                  ${CARD_ART[it.id] ? `<span class="card-art">${CARD_ART[it.id]}</span>` : `<span class="pip ${escapeHtml(cls)} filled">${SVG_ICONS[it.element] || SVG_ICONS.item}</span>`}
                  <div class="card-title-inline">${escapeHtml(t(it.name_ja, it.name_zh))}</div>
                </div>
                ${isSup ? `<span class="supporter-chip">${escapeHtml(t("サポート", "支援"))}</span>` : `<span class="side-tag">${escapeHtml(it.category === "energy" ? t("エネルギー", "能量") : t("グッズ", "道具"))}</span>`}
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

    /** 打开双方弃牌区（按能量/怪兽/道具分组，己方高亮可回收能量）或牌库初始卡表弹窗 */
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
        titleEl.textContent = isPlayer
          ? t(`自分の初期デッキリスト（計${list.length}枚）`, `己方初始卡表（共 ${list.length} 张）`)
          : t(`相手の初期デッキリスト（計${list.length}枚）`, `对手初始卡表（共 ${list.length} 张）`);
      } else {
        titleEl.textContent = isPlayer
          ? t(`自分のトラッシュ（計${list.length}枚）`, `己方弃牌区（共 ${list.length} 张）`)
          : t(`相手のトラッシュ（計${list.length}枚）`, `对手弃牌区（共 ${list.length} 张）`);
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
        bannerHtml = `<div class="pile-modal-banner"><span>${escapeHtml(t(`※山札の順番やサイドの中身は非公開です（初期${list.length}枚のみ表示）`, `牌库顺序与奖赏卡内容保密，仅展示初始 ${list.length} 张卡表`))}</span></div>`;
      } else if (isPlayer) {
        const elemSummary = energies.map((e) => `${escapeHtml(t(e.ja, e.zh))}×${escapeHtml(e.qty)}`).join(t("・", "、"));
        bannerHtml = `<div class="pile-modal-banner recycle"><span style="display:inline-flex;align-items:center;gap:4px;">${SVG_ICONS.boost}${escapeHtml(t("エネ回収対象：", "可回收能量："))}<strong>${totalEnergy}${escapeHtml(t("枚", " 张"))}</strong></span><span style="font-size:12px;">${elemSummary || escapeHtml(t("回収可能なエネルギーなし", "暂无可回收能量"))}</span></div>`;
      }

      const renderGroup = (titleJa, titleZh, items) => {
        if (items.length === 0) return "";
        const sum = items.reduce((a, b) => a + b.qty, 0);
        const chips = items.map((x) => `
          <div class="pile-chip ${escapeHtml(x.cls)}">
            <div class="pile-chip-left">
              ${x.art ? `<span class="card-art" style="width:24px;height:24px;">${x.art}</span>` : `<span class="pip ${escapeHtml(x.cls)} filled">${x.icon || SVG_ICONS.item}</span>`}
              <div class="pile-chip-name">${escapeHtml(t(x.ja, x.zh))}</div>
            </div>
            <span class="pile-chip-qty">×${x.qty}</span>
          </div>
        `).join("");
        return `
          <div class="pile-section">
            <div class="pile-section-title"><span>${escapeHtml(t(titleJa, titleZh))}</span><span>${sum}${escapeHtml(t("枚", " 张"))}</span></div>
            <div class="pile-chip-grid">${chips}</div>
          </div>
        `;
      };

      if (list.length === 0) {
        bodyEl.innerHTML = `${bannerHtml}<div class="pile-empty">${escapeHtml(t("トラッシュにカードはありません。", "弃牌区目前为空。"))}</div>`;
      } else {
        bodyEl.innerHTML = bannerHtml
          + renderGroup("エネルギー", "能量卡", energies)
          + renderGroup("モンスター", "怪兽卡", monsters)
          + renderGroup("サポートとグッズ", "支援卡与道具", trainers);
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
      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-loading");
        btn.innerHTML = `${SVG_ICONS.hudSpinner}${escapeHtml(t("解析中…", "分析中…"))}`;
      }
      const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ac ? setTimeout(() => ac.abort(), 8000) : null;
      try {
        const snap = BattleEngine.getSnapshot();
        const genCfg = { responseMimeType: "application/json" };
        const thinkCfg = ConfigManager.buildThinkingConfig(cfg.llmModel);
        if (thinkCfg) genCfg.thinkingConfig = thinkCfg;
        const jaEl = $("liveTipJa");
        const zhEl = $("liveTipZh");
        const aiTag = $("liveTipAiTag");
        const extractPartialJsonField = (acc, key) => {
          const m = acc.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`));
          if (!m) return "";
          return m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        };
        const streamRes = await ConfigManager.streamVertexText(cfg.llmModel, {
          contents: [{
            role: "user",
            parts: [{
              text: `あなたは完全オリジナルカードゲーム「言霊デュエル」（水→炎、炎→雷、雷→水で弱点+20、ベンチ狙撃時は弱点なし、1ターンにエネ1回・サポート1枚）の戦術コーチです。場の生き物は必ず「モンスター」と呼び、他作品の固有名詞・略称は一切使用しないでください。盤面JSONを見て今ターン最善の1手を1文で提案し、純粋JSONのみで返してください：{"tip_ja":"日本語1文","tip_zh":"中国語訳1文"}\n盤面JSON:\n${JSON.stringify(snap)}`
            }]
          }],
          generationConfig: genCfg
        }, {
          signal: ac ? ac.signal : undefined,
          onDelta: (_delta, acc) => {
            if (seq !== this._tipSeq) return;
            const pJa = extractPartialJsonField(acc, "tip_ja");
            const pZh = extractPartialJsonField(acc, "tip_zh");
            if (pJa && jaEl) jaEl.textContent = sanitizeBrandTerms(pJa);
            if (pZh && zhEl) zhEl.textContent = sanitizeBrandTerms(pZh);
            if ((pJa || pZh) && aiTag) aiTag.style.display = "inline-block";
          }
        });
        if (seq !== this._tipSeq) return;
        const parsed = NLUEngine.safeParseJson(streamRes.text || "");
        if (seq !== this._tipSeq || !parsed?.tip_ja) throw new Error("invalid tip json");
        if (jaEl) jaEl.textContent = sanitizeBrandTerms(parsed.tip_ja);
        if (zhEl) zhEl.textContent = sanitizeBrandTerms(parsed.tip_zh || parsed.tip_ja);
        if (aiTag) aiTag.style.display = "inline-block";
      } catch (e) {
        DebugLog.add("ERR", "AI 战术分析失败", e?.name === "AbortError" ? "timeout" : (e?.message || "error"));
        this.renderLiveTip();
        TableUI.showToast("AI戦術分析に失敗・ローカル提案を表示中", "AI战术分析失败，已显示本地建议");
      } finally {
        if (timer) clearTimeout(timer);
        if (btn) {
          btn.disabled = false;
          btn.classList.remove("is-loading");
          btn.innerHTML = `${SVG_ICONS.sparkle}${escapeHtml(t("AI戦術", "AI战术"))}`;
        }
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
      zhEl.textContent = zh;
    },

    renderAll() {
      const s = BattleEngine.state;
      if (!s) return;

      const badge = $("turnBadge");
      badge.className = "turn-pill" + (s.currentPlayer === "enemy" ? " enemy-turn" : "");
      badge.textContent = s.phase === "setup"
        ? t("対戦準備：先発を選択", "开局准备：选择首发")
        : (s.currentPlayer === "player"
          ? t(`ターン ${s.turn}：あなたの番`, `第 ${s.turn} 回合：你的回合`)
          : t(`ターン ${s.turn}：レンの番`, `第 ${s.turn} 回合：莲的回合`));

      const limBox = $("turnLimits");
      if (limBox) {
        limBox.style.display = s.phase === "battle" && s.currentPlayer === "player" ? "inline-flex" : "none";
        const limE = $("limitEnergy");
        const limS = $("limitSupporter");
        const limR = $("limitRetreat");
        if (limE) { limE.className = "limit-pill" + (s.energyUsedThisTurn ? " used" : ""); limE.innerHTML = `${SVG_ICONS.boost}${escapeHtml(s.energyUsedThisTurn ? t("エネ 0/1", "贴能 0/1") : t("エネ 1/1", "贴能 1/1"))}`; }
        if (limS) { limS.className = "limit-pill" + (s.supporterUsedThisTurn ? " used" : ""); limS.innerHTML = `${SVG_ICONS.starChip}${escapeHtml(s.supporterUsedThisTurn ? t("サポート 0/1", "支援 0/1") : t("サポート 1/1", "支援 1/1"))}`; }
        if (limR) { limR.className = "limit-pill" + (s.retreatedThisTurn ? " used" : ""); limR.innerHTML = `${SVG_ICONS.swapChip}${escapeHtml(s.retreatedThisTurn ? t("交代 0/1", "撤退 0/1") : t("交代 1/1", "撤退 1/1"))}`; }
      }

      const prizeIdx = Array.from({ length: TOTAL_PRIZES }, (_, i) => i);
      const enemyTaken = TOTAL_PRIZES - s.enemy.prizesLeft;
      const playerTaken = TOTAL_PRIZES - s.player.prizesLeft;
      const prizeTakenTip = escapeHtml(t("取得済", "已拿取"));
      const prizeLeftTip = escapeHtml(t("残りサイド", "未拿取"));
      $("enemyPrizes").innerHTML = prizeIdx.map((i) => {
        const taken = i < enemyTaken;
        return `<div class="prize-card ${taken ? "taken enemy-taken" : ""}" title="${taken ? prizeTakenTip : prizeLeftTip}">${taken ? SVG_ICONS.prizeCheck : SVG_ICONS.prizeStar}</div>`;
      }).join("");
      $("playerPrizes").innerHTML = prizeIdx.map((i) => {
        const taken = i < playerTaken;
        return `<div class="prize-card ${taken ? "taken" : ""}" title="${taken ? prizeTakenTip : prizeLeftTip}">${taken ? SVG_ICONS.prizeCheck : SVG_ICONS.prizeStar}</div>`;
      }).join("");
      const epc = $("enemyPrizeCount");
      if (epc) {
        epc.textContent = `${t("取得", "已拿")} ${enemyTaken}/${TOTAL_PRIZES}`;
        epc.className = "prize-count-pill" + (enemyTaken > 0 ? " enemy-progress" : "");
      }
      const ppc = $("playerPrizeCount");
      if (ppc) {
        ppc.textContent = `${t("取得", "已拿")} ${playerTaken}/${TOTAL_PRIZES}`;
        ppc.className = "prize-count-pill" + (playerTaken > 0 ? " has-progress" : "");
      }
      $("enemyDeckCount").textContent = s.enemy.deck.length;
      $("enemyTrashCount").textContent = s.enemy.trash.length;
      $("playerDeckCount").textContent = s.player.deck.length;
      $("playerTrashCount").textContent = s.player.trash.length;

      const selCardId = s.selectedHandIndex !== null ? s.player.hand[s.selectedHandIndex] : null;
      const isWoundedUnit = (u) => {
        if (!u) return false;
        const d = SpecEngine.getMonster(u.id);
        return Boolean(d && u.hp < d.hp);
      };
      const needEnergyAlly = Boolean(selCardId && selCardId.startsWith("energy_"));
      const needPotionAlly = selCardId === "item_potion";
      const needEnemyBench = selCardId === "item_flute";
      const pendingAlly = s.pending && (s.pending.type === "promote_bench" || (s.pending.type === "choose_target" && s.pending.context.side === "player"));
      const pendingEnemy = s.pending && s.pending.type === "choose_target" && s.pending.context.side === "enemy";
      const pendingSlots = new Set((s.pending?.options || []).map((o) => o.slot).filter(Boolean));
      const highlightEnemyActive = Boolean(
        s.enemy.active && pendingEnemy && (pendingSlots.size ? pendingSlots.has("enemy_active") : s.pending?.context?.action?.card_id !== "item_flute")
      );
      const highlightPlayerActive = Boolean(
        s.phase === "setup"
        || (needEnergyAlly && s.player.active)
        || (needPotionAlly && isWoundedUnit(s.player.active))
        || (pendingAlly && s.player.active && (pendingSlots.size ? pendingSlots.has("player_active") : s.pending?.type !== "promote_bench" && s.pending?.context?.action?.type !== "RETREAT"))
      );

      /* 重绘槽位前暂存仍在播放中的飘字与命中光效节点，防止击倒重绘瞬间 0ms 抹杀特效 */
      const savedVfx = {};
      ["enemy_active", "player_active", "enemy_bench_0", "enemy_bench_1", "enemy_bench_2", "player_bench_0", "player_bench_1", "player_bench_2"].forEach((sl) => {
        const box = this.getSlotEl(sl);
        if (!box || typeof box.querySelectorAll !== "function") return;
        const live = Array.from(box.querySelectorAll(":scope > .float-text, :scope > .vfx-burst") || []);
        if (live.length > 0) savedVfx[sl] = live;
      });

      const eAct = $("enemyActiveSlot");
      eAct.className = "slot-box active-slot" + (highlightEnemyActive ? " highlight-enemy" : "");
      eAct.innerHTML = `<span class="slot-tag">${escapeHtml(t("相手バトル場", "对手战斗区"))}</span>` +
        (s.enemy.active ? this.renderMonsterCard(s.enemy.active, "enemy_active") : `<div class="slot-empty">${escapeHtml(s.phase === "setup" ? t("裏向き待機中", "对手暗置首发中") : t("空き", "空位"))}</div>`);

      const pAct = $("playerActiveSlot");
      pAct.className = "slot-box active-slot" + (highlightPlayerActive ? " highlight-ally" : "");
      pAct.innerHTML = `<span class="slot-tag">${escapeHtml(t("自分バトル場", "己方战斗区"))}</span>` +
        (s.player.active ? this.renderMonsterCard(s.player.active, "player_active") : `<div class="slot-empty">${escapeHtml(s.phase === "setup" ? t("手札から1体選択", "请从手牌选择首发") : t("空き", "空位"))}</div>`);

      $("enemyBenchRow").innerHTML = s.enemy.bench.map((inst, i) => `
        <div class="slot-box ${(needEnemyBench || (pendingEnemy && (pendingSlots.size ? pendingSlots.has(`enemy_bench_${i}`) : true))) && inst ? "highlight-enemy" : ""}" data-slot-box="enemy_bench_${i}">
          <span class="slot-tag">${escapeHtml(t(`相手ベンチ ${POS_JA[i]}`, `对手备战 ${POS_ZH[i]}`))}</span>
          ${inst ? this.renderMonsterCard(inst, `enemy_bench_${i}`) : `<div class="slot-empty">${escapeHtml(t("空き", "空位"))}</div>`}
        </div>
      `).join("");

      const hasHandMon = s.player.hand.some((id) => Boolean(SpecEngine.getMonster(id)));
      const hasEmptyBench = s.player.bench.includes(null);
      const canHintBench = s.phase === "battle" && s.currentPlayer === "player" && !s.gameOver && hasHandMon && hasEmptyBench;

      $("playerBenchRow").innerHTML = s.player.bench.map((inst, i) => `
        <div class="slot-box ${((needEnergyAlly || (needPotionAlly && isWoundedUnit(inst)) || (pendingAlly && (pendingSlots.size ? pendingSlots.has(`player_bench_${i}`) : true)))) && inst ? "highlight-ally" : ""}" data-slot-box="player_bench_${i}">
          <span class="slot-tag">${escapeHtml(t(`ベンチ ${POS_JA[i]}`, `己方备战 ${POS_ZH[i]}`))}</span>
          ${inst ? this.renderMonsterCard(inst, `player_bench_${i}`) : (canHintBench && i === s.player.bench.indexOf(null) ? `<div class="slot-empty">${escapeHtml(t("手札のモンスターを出せます", "可放入手牌怪兽"))}</div>` : `<div class="slot-empty">${escapeHtml(t("空き", "空位"))}</div>`)}
        </div>
      `).join("");

      Object.keys(savedVfx).forEach((sl) => {
        const box = this.getSlotEl(sl);
        if (box) savedVfx[sl].forEach((node) => box.appendChild(node));
      });

      $("playerHand").innerHTML = s.player.hand.map((id, idx) => this.renderHandCard(id, idx)).join("");
      $("handSelectionHint").textContent = s.phase === "setup"
        ? t("先発モンスターをクリック", "点击绿色高亮怪兽作为首发")
        : (selCardId
          ? t("対象をクリック（再クリックで取消）", "点击高亮目标使用，再点手牌取消")
          : (canHintBench
            ? t("手札のモンスターをクリック／発話でベンチへ展開可", "手牌有怪兽卡可直接点击或语音放入备战区")
            : ""));

      const bar = $("pendingBar");
      if (s.pending) {
        bar.classList.add("open");
        $("pendingJa").textContent = s.pending.promptJa || "";
        $("pendingZh").textContent = s.pending.promptZh || "";
        $("pendingBtns").innerHTML = (s.pending.options || []).map((o) => {
          const btnLabel = (o.labelJa || o.labelZh)
            ? escapeHtml(t(o.labelJa || o.label, o.labelZh || o.label))
            : formatBilingualLabelHtml(o.label);
          return `<button class="btn-sm" data-reply="${escapeHtml(o.reply)}">${btnLabel}</button>`;
        }).join("");
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
            labelJa: `${e.slot === "enemy_active" ? "前" : POS_JA[e.idx]}・${e.def.name_ja} (HP${e.unit.hp})`,
            labelZh: `${e.slot === "enemy_active" ? "前" : POS_ZH[e.idx]}・${e.def.name_zh} (HP${e.unit.hp})`,
            reply: e.slot === "enemy_active" ? "前" : POS_JA[e.idx],
            slot: e.slot
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
        pop.innerHTML = `<div style="font-size:13px;font-weight:800;margin-bottom:4px;">${escapeHtml(t(def.name_ja, def.name_zh))}</div>`;
        def.skills.forEach((sk) => {
          const b = document.createElement("button");
          b.className = "btn-sm";
          b.disabled = !BattleEngine.canPayCost(unit.energies, sk.cost);
          b.textContent = `${t(sk.name_ja, sk.name_zh)} ${sk.damage}`;
          b.addEventListener("click", () => {
            this.closePopover();
            this.triggerSkillClick(sk.name_ja);
          });
          pop.appendChild(b);
        });
        const rBtn = document.createElement("button");
        rBtn.className = "btn-sm";
        rBtn.innerHTML = `${SVG_ICONS.swap}${escapeHtml(t("交代（エネ消費）", "撤退换人"))}`;
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
      const updatePlaceholderAt = (clientX, clientY) => {
        if (this._dragHandIdx === null || !this._handPlaceholder) return;
        const isVertical = window.getComputedStyle(handContainer).flexDirection === "column";
        const others = Array.from(handContainer.querySelectorAll(".hand-card:not(.dragging-source)"));
        let targetIdx = others.length;
        let beforeEl = null;
        for (let i = 0; i < others.length; i++) {
          const rect = others[i].getBoundingClientRect();
          const hit = isVertical
            ? clientY < rect.top + rect.height / 2
            : clientX < rect.left + rect.width / 2;
          if (hit) {
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
        updatePlaceholderAt(e.clientX, e.clientY);
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
  let settingsTtsEnginePrev = "nia_tts";
  let settingsAsrLangTouched = false;
  let settingsVoiceDraft = {
    nia_tts_ja: { referee: DEFAULT_CONFIG.niaVoiceReferee, rival: DEFAULT_CONFIG.niaVoiceRival },
    nia_tts_zh: { referee: DEFAULT_CONFIG.niaVoiceRefereeZh, rival: DEFAULT_CONFIG.niaVoiceRivalZh },
    vertex_tts: { referee: DEFAULT_CONFIG.voiceReferee, rival: DEFAULT_CONFIG.voiceRival },
    chrome_tts: { referee: "", rival: "" }
  };
  let savedConfigDuringTtsTest = false;

  function getVoiceDraftKey(engine, lang = getUiLang()) {
    if (engine === "nia_tts") return lang === "zh" ? "nia_tts_zh" : "nia_tts_ja";
    return engine;
  }

  function syncDifficultyUi() {
    const isHard = ConfigManager.data.aiDifficulty === "hard";
    $("diffOptNormal")?.classList.toggle("active", !isHard);
    $("diffOptHard")?.classList.toggle("active", isHard);
    if ($("aiDifficulty")) $("aiDifficulty").value = isHard ? "hard" : "normal";
  }

  function populateVoiceSelectsForEngine(engine) {
    const refSel = $("voiceReferee");
    const rivSel = $("voiceRival");
    if (!refSel || !rivSel) return;
    const lang = getUiLang();
    const draftKey = getVoiceDraftKey(engine, lang);
    const opts = VoiceEngine.getVoiceOptionsForEngine(engine, lang);
    const fill = (sel, wanted, fallbackIdx) => {
      sel.innerHTML = "";
      opts.forEach((o) => {
        const el = document.createElement("option");
        el.value = o.value;
        el.textContent = o.label;
        sel.appendChild(el);
      });
      const valid = opts.some((o) => o.value === wanted);
      if (valid) sel.value = wanted;
      else if (opts[fallbackIdx]) sel.value = opts[fallbackIdx].value;
      else if (opts[0]) sel.value = opts[0].value;
    };
    const draft = settingsVoiceDraft[draftKey] || { referee: "", rival: "" };
    const defaultRivIdx = engine === "nia_tts" ? Math.min(5, opts.length - 1) : (engine === "vertex_tts" ? Math.min(1, opts.length - 1) : 0);
    fill(refSel, draft.referee, 0);
    fill(rivSel, draft.rival, defaultRivIdx);
    settingsVoiceDraft[draftKey] = { referee: refSel.value, rival: rivSel.value };

    const tag = $("voiceEngineTag");
    if (tag) {
      const langTag = lang === "zh" ? "ZH_CN" : "JAPANESE";
      if (engine === "nia_tts") tag.textContent = `· SenseTime Nia ${langTag} (${opts.length}${t("種", "种")})`;
      else if (engine === "vertex_tts") tag.textContent = `· Vertex (${opts.length}${t("種", "种")})`;
      else tag.textContent = `· Chrome (${Math.max(0, opts.length - 1)}${t("種", "种")})`;
    }
  }

  function syncSettingsVisibility() {
    const asr = $("asrMode")?.value || "nia_asr";
    const tts = $("ttsEngine")?.value || "nia_tts";

    const asrBadgeMap = {
      nia_asr: "SenseTime Nia",
      gemini_audio: t("Gemini 直接", "Gemini 直传"),
      chrome_asr_llm: "Chrome + Gemini",
      chrome_local: t("オフライン", "离线本地")
    };
    if ($("asrEngineBadge")) $("asrEngineBadge").textContent = asrBadgeMap[asr] || asr;

    $("niaAsrLangWrap")?.classList.toggle("cfg-hidden", asr !== "nia_asr");
    $("chromeAsrLangWrap")?.classList.toggle("cfg-hidden", asr !== "chrome_asr_llm" && asr !== "chrome_local");
    $("geminiAsrHintWrap")?.classList.toggle("cfg-hidden", asr !== "gemini_audio");

    // 只要 ASR 或 TTS 任一使用SenseTime Nia，即展示 Nia AccessKey 区域
    $("niaCredsBlock")?.classList.toggle("cfg-hidden", asr !== "nia_asr" && tts !== "nia_tts");

    $("ttsModelField")?.classList.toggle("cfg-hidden", tts !== "vertex_tts");
    $("ttsEngineHintField")?.classList.toggle("cfg-hidden", tts === "vertex_tts");
    if ($("ttsEngineHintText")) {
      const langLabel = getUiLang() === "zh" ? "ZH_CN" : "JAPANESE";
      $("ttsEngineHintText").textContent = tts === "nia_tts"
        ? t(`SenseTime Nia 24kHz (${langLabel}) · 声質自動連動`, `SenseTime Nia 24kHz (${langLabel}) · 音色随语言自动联动`)
        : t("ブラウザ内蔵音声 · 下のリスト自動連動", "浏览器内置朗读 · 音色随语言自动联动");
    }
  }

  function clearSecretDomFields() {
    ["apiKey", "niaAk", "niaSk"].forEach((id) => {
      const el = $(id);
      if (el) { el.value = ""; el.disabled = true; }
    });
  }

  function closeSettingsModal() {
    $("settingsModal")?.classList.remove("open");
    clearSecretDomFields();
  }

  function syncSettingsForm(includeSecrets = false) {
    const c = ConfigManager.data;
    const modalOpen = includeSecrets || Boolean($("settingsModal")?.classList.contains("open"));
    if (modalOpen) {
      if ($("apiKey")) { $("apiKey").disabled = false; $("apiKey").value = c.apiKey; }
      if ($("niaAk")) { $("niaAk").disabled = false; $("niaAk").value = c.niaAk; }
      if ($("niaSk")) { $("niaSk").disabled = false; $("niaSk").value = c.niaSk; }
    } else {
      clearSecretDomFields();
    }
    if ($("llmModel")) $("llmModel").value = c.llmModel;
    if ($("niaAsrLang")) $("niaAsrLang").value = VoiceEngine.getEffectiveNiaAsrLang();
    if ($("ttsEngine")) $("ttsEngine").value = c.ttsEngine;
    if ($("ttsModel")) $("ttsModel").value = c.ttsModel;
    if ($("asrMode")) $("asrMode").value = c.asrMode;
    if ($("asrLang")) $("asrLang").value = VoiceEngine.getEffectiveChromeAsrLang();
    if ($("idlePromptSec")) $("idlePromptSec").value = c.idlePromptSec;
    if ($("chkAutoSpeak")) $("chkAutoSpeak").checked = Boolean(c.autoSpeak);
    if ($("mdStatusText")) $("mdStatusText").textContent = `${t("読込元：", "数据源：")}${SpecEngine.sourceLabel}`;
    settingsAsrLangTouched = false;
    settingsVoiceDraft = {
      nia_tts_ja: { referee: c.niaVoiceReferee, rival: c.niaVoiceRival },
      nia_tts_zh: { referee: c.niaVoiceRefereeZh, rival: c.niaVoiceRivalZh },
      vertex_tts: { referee: c.voiceReferee, rival: c.voiceRival },
      chrome_tts: { referee: c.chromeVoiceURI, rival: c.chromeVoiceRivalURI || c.chromeVoiceURI }
    };
    settingsTtsEnginePrev = c.ttsEngine;
    populateVoiceSelectsForEngine(c.ttsEngine);
    syncSettingsVisibility();
    syncDifficultyUi();
  }

  /** 同步所有 <select> 下拉框选项为当前纯净单语言（HTML <option> 不支持内部 span 隐藏，必须动态更新） */
  function syncSelectOptionsLanguage() {
    const setOptMap = (selectId, labels) => {
      const sel = $(selectId);
      if (!sel || !sel.options) return;
      for (let i = 0; i < sel.options.length; i++) {
        const opt = sel.options[i];
        if (Object.prototype.hasOwnProperty.call(labels, opt.value)) {
          opt.textContent = labels[opt.value];
        }
      }
    };
    setOptMap("aiDifficulty", {
      normal: t("ふつう", "普通"),
      hard: t("むずかしい", "困难")
    });
    setOptMap("niaAsrLang", {
      "": t("自動判別（日・中）", "自动双语识别"),
      ja: t("日本語 (ja)", "日语 (ja)"),
      zh: t("中国語 (zh)", "中文 (zh)")
    });
    setOptMap("asrLang", {
      "ja-JP": t("日本語 (ja-JP)", "日语 (ja-JP)"),
      "zh-CN": t("中国語 (zh-CN)", "中文 (zh-CN)")
    });
    setOptMap("asrMode", {
      nia_asr: "SenseTime Nia",
      gemini_audio: t("Gemini 音声直接解析", "Gemini 音频直传"),
      chrome_asr_llm: t("Chrome 音声認識 → Gemini", "Chrome 识别 → Gemini"),
      chrome_local: t("オフラインローカル解析", "离线本地解析")
    });
    setOptMap("ttsEngine", {
      nia_tts: "SenseTime Nia TTS",
      vertex_tts: "Vertex Gemini TTS",
      chrome_tts: t("Chrome 標準音声", "浏览器内置语音")
    });
  }

  /** 全局语言切换（同步 DOM、规则页、设置弹窗与下拉框、TTS 音色目录、ASR 语种与全牌桌文案） */
  function applyUiLanguage(lang, opts = {}) {
    const next = lang === "zh" ? "zh" : "ja";
    const prev = ConfigManager.data.uiLang;
    const settingsOpen = Boolean($("settingsModal")?.classList.contains("open"));
    if (settingsOpen && $("voiceReferee") && $("voiceRival")) {
      const prevTts = $("ttsEngine")?.value || settingsTtsEnginePrev;
      const prevKey = getVoiceDraftKey(prevTts, prev);
      settingsVoiceDraft[prevKey] = {
        referee: $("voiceReferee").value,
        rival: $("voiceRival").value
      };
    }
    if (!opts.skipSave) {
      const patch = { uiLang: next };
      if (!ConfigManager.data.niaAsrLangManual) {
        patch.niaAsrLang = "";
        patch.asrLang = next === "zh" ? "zh-CN" : "ja-JP";
      }
      ConfigManager.save(patch);
    }
    document.body.setAttribute("data-lang", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "ja";
    document.title = next === "zh" ? "言灵对决 — 语音卡牌对战" : "言霊デュエル — 音声カードバトル";

    document.querySelectorAll("[data-set-lang]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-set-lang") === next);
    });
    if ($("cmdInput")) {
      $("cmdInput").placeholder = next === "zh" ? "输入指令" : "コマンド入力";
    }
    if ($("btnRecordVoice") && !VoiceEngine.isRecording) {
      $("btnRecordVoice").innerHTML = `${SVG_ICONS.mic}${escapeHtml(t("単発", "单次"))}`;
    }
    if ($("btnAiTip") && !$("btnAiTip").disabled) {
      $("btnAiTip").innerHTML = `${SVG_ICONS.sparkle}${escapeHtml(t("AI戦術", "AI战术"))}`;
    }
    syncSelectOptionsLanguage();
    GuideEngine.syncButton();
    GuideEngine.syncVisibleCard();
    VoiceEngine.updateCallButtonUI();
    MobileViewportManager.syncUi();
    if (settingsOpen) {
      /* 设置弹窗打开时保留用户未保存的编辑内容，仅联动语种选项、音色目录与状态提示 */
      if (!settingsAsrLangTouched && !ConfigManager.data.niaAsrLangManual) {
        if ($("niaAsrLang")) $("niaAsrLang").value = next === "zh" ? "zh" : "ja";
        if ($("asrLang")) $("asrLang").value = next === "zh" ? "zh-CN" : "ja-JP";
      }
      populateVoiceSelectsForEngine($("ttsEngine")?.value || settingsTtsEnginePrev);
      syncSettingsVisibility();
    } else {
      syncSettingsForm();
    }
    if ($("mdStatusText") && SpecEngine.sourceLabel) $("mdStatusText").textContent = `${t("読込元：", "数据源：")} ${SpecEngine.sourceLabel}`;
    if ($("actionPopover")) $("actionPopover").classList.remove("open");
    if (BattleEngine.state) TableUI.renderAll();
    if ($("codexModal")?.classList.contains("open")) TableUI.renderCodex();
    if (!opts.silent && prev !== next) {
      if (!ConfigManager.data.niaAsrLangManual && !settingsAsrLangTouched) {
        VoiceEngine.restartChromeAsrIfNeeded();
      }
      VoiceEngine.replayCurrentQueueInLang(next);
      TableUI.showToast("日本語に切り替えました", "已切换为中文界面与中文配音");
    }
  }

  function applySpecToUi() {
    $("rulesModalListJa").innerHTML = SpecEngine.rulesHtmlJa.map((li) => `<li>${li}</li>`).join("");
    $("rulesModalListZh").innerHTML = SpecEngine.rulesHtmlZh.map((li) => `<li>${li}</li>`).join("");
    if ($("mdStatusText")) $("mdStatusText").textContent = `${t("読込元：", "数据源：")}${SpecEngine.sourceLabel}`;
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
        BattleEngine.speakOpeningChallenge();
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
      $("settingsModal").classList.add("open");
      syncSettingsForm(true);
    });
    $("btnCloseSettings").addEventListener("click", () => closeSettingsModal());
    $("settingsModal")?.addEventListener("click", (e) => {
      if (e.target === $("settingsModal")) closeSettingsModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("settingsModal")?.classList.contains("open")) {
        closeSettingsModal();
      }
    });

    /* 全局 3 处 SVG 语言切换入口统一绑定（顶栏 / 规则弹窗 / 设置弹窗） */
    document.querySelectorAll("[data-set-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetLang = btn.getAttribute("data-set-lang");
        if (targetLang) applyUiLanguage(targetLang);
      });
    });

    /* 用户手动调整 ASR 语种时标记 manual 锁，避免后续切界面语言覆盖其手动偏好 */
    $("niaAsrLang")?.addEventListener("change", () => { settingsAsrLangTouched = true; });
    $("asrLang")?.addEventListener("change", () => { settingsAsrLangTouched = true; });

    /* 切换 ASR / TTS 引擎时实时联动参数区与同一组音色下拉框 */
    $("asrMode")?.addEventListener("change", () => syncSettingsVisibility());
    $("ttsEngine")?.addEventListener("change", () => {
      const prevKey = getVoiceDraftKey(settingsTtsEnginePrev);
      if (prevKey && $("voiceReferee") && $("voiceRival")) {
        settingsVoiceDraft[prevKey] = {
          referee: $("voiceReferee").value,
          rival: $("voiceRival").value
        };
      }
      const next = $("ttsEngine").value;
      settingsTtsEnginePrev = next;
      populateVoiceSelectsForEngine(next);
      syncSettingsVisibility();
    });
    $("voiceReferee")?.addEventListener("change", () => {
      const curKey = getVoiceDraftKey($("ttsEngine")?.value || settingsTtsEnginePrev);
      if (!settingsVoiceDraft[curKey]) settingsVoiceDraft[curKey] = { referee: "", rival: "" };
      settingsVoiceDraft[curKey].referee = $("voiceReferee").value;
    });
    $("voiceRival")?.addEventListener("change", () => {
      const curKey = getVoiceDraftKey($("ttsEngine")?.value || settingsTtsEnginePrev);
      if (!settingsVoiceDraft[curKey]) settingsVoiceDraft[curKey] = { referee: "", rival: "" };
      settingsVoiceDraft[curKey].rival = $("voiceRival").value;
    });

    const readSettingsFormPatch = () => {
      const curTts = $("ttsEngine")?.value || "nia_tts";
      const curKey = getVoiceDraftKey(curTts);
      if ($("voiceReferee") && $("voiceRival")) {
        settingsVoiceDraft[curKey] = {
          referee: $("voiceReferee").value,
          rival: $("voiceRival").value
        };
      }
      const niaLangVal = $("niaAsrLang") ? $("niaAsrLang").value : VoiceEngine.getEffectiveNiaAsrLang();
      const isManual = settingsAsrLangTouched || Boolean(ConfigManager.data.niaAsrLangManual);
      return {
        apiKey: ($("apiKey")?.value || "").trim(),
        llmModel: ($("llmModel")?.value || "").trim(),
        niaAk: ($("niaAk")?.value || "").trim(),
        niaSk: ($("niaSk")?.value || "").trim(),
        niaAsrLang: niaLangVal,
        niaAsrLangManual: isManual,
        asrMode: $("asrMode")?.value || "nia_asr",
        asrLang: $("asrLang")?.value || VoiceEngine.getEffectiveChromeAsrLang(),
        ttsEngine: curTts,
        ttsModel: ($("ttsModel")?.value || "").trim(),
        niaVoiceReferee: settingsVoiceDraft.nia_tts_ja.referee,
        niaVoiceRival: settingsVoiceDraft.nia_tts_ja.rival,
        niaVoiceRefereeZh: settingsVoiceDraft.nia_tts_zh.referee,
        niaVoiceRivalZh: settingsVoiceDraft.nia_tts_zh.rival,
        voiceReferee: settingsVoiceDraft.vertex_tts.referee,
        voiceRival: settingsVoiceDraft.vertex_tts.rival,
        chromeVoiceURI: settingsVoiceDraft.chrome_tts.referee,
        chromeVoiceRivalURI: settingsVoiceDraft.chrome_tts.rival,
        idlePromptSec: Math.max(0, Math.min(120, Number($("idlePromptSec")?.value) || 0)),
        aiDifficulty: $("aiDifficulty") ? $("aiDifficulty").value : "normal",
        autoSpeak: Boolean($("chkAutoSpeak")?.checked)
      };
    };

    $("btnSaveConfig").addEventListener("click", () => {
      savedConfigDuringTtsTest = true;
      const prevAsr = ConfigManager.data.asrMode;
      const prevAsrLang = ConfigManager.data.asrLang;
      const prevNiaAk = ConfigManager.data.niaAk;
      const prevNiaSk = ConfigManager.data.niaSk;
      VoiceEngine.apiTtsBlocked = false;
      VoiceEngine.apiTtsBlockReason = "";
      VoiceEngine.apiAsrBlocked = false;
      VoiceEngine.apiAsrBlockReason = "";
      VoiceEngine.clearApiAsrReconnectTimer();
      ConfigManager.save(readSettingsFormPatch());
      settingsAsrLangTouched = false;
      syncDifficultyUi();
      TableUI.renderLiveTip();
      TableUI.showToast("設定を保存しました", "配置已保存");
      BattleEngine.resetIdleTimer(true);
      const asrChanged = prevAsr !== ConfigManager.data.asrMode
        || prevNiaAk !== ConfigManager.data.niaAk
        || prevNiaSk !== ConfigManager.data.niaSk;
      if (VoiceEngine.callActive && asrChanged) {
        VoiceEngine.stopCall(true);
        VoiceEngine.startContinuousAsrCall(true);
      } else if (VoiceEngine.callActive && prevAsrLang !== ConfigManager.data.asrLang) {
        VoiceEngine.restartChromeAsrIfNeeded();
      }
    });

    $("btnResetDefaults").addEventListener("click", async () => {
      savedConfigDuringTtsTest = true;
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
        closeSettingsModal();
        $("dataLoadModal")?.classList.add("open");
      }
    });

    let testingTts = false;
    $("btnTestTts").addEventListener("click", async () => {
      if (testingTts) return;
      testingTts = true;
      savedConfigDuringTtsTest = false;
      const btn = $("btnTestTts");
      btn.disabled = true;
      const prevCfg = { ...ConfigManager.data };
      const previewCfg = ConfigManager.sanitize({ ...prevCfg, ...readSettingsFormPatch(), autoSpeak: true });
      ConfigManager.data = previewCfg;
      ConfigManager._niaJwtCache = null;
      try {
        VoiceEngine.apiTtsBlocked = false;
        VoiceEngine.apiTtsBlockReason = "";
        VoiceEngine.stopPlayback();
        const lang = getUiLang();
        await VoiceEngine.speak({ ja: "ヒノキツネの『ひのこ』！相手に30ダメージ！", zh: "炎狐发动火花！对对手造成30点伤害！" }, "referee", { lang });
        await delay(240);
        await VoiceEngine.speak({ ja: "なかなかやるじゃねえか。次は俺の番だぜ！", zh: "挺能干的嘛，接下来轮到我出招了！" }, "rival", { lang });
      } finally {
        if (!savedConfigDuringTtsTest) {
          ConfigManager.data = prevCfg;
          ConfigManager._niaJwtCache = null;
        }
        testingTts = false;
        btn.disabled = false;
      }
    });

    $("btnLiveCall").addEventListener("click", () => {
      VoiceEngine.toggleCall((payload) => BattleEngine.handleUserInput(payload));
    });

    if ($("btnRecordVoice")) {
      $("btnRecordVoice").addEventListener("click", () => {
        VoiceEngine.toggleRecord((payload) => BattleEngine.handleUserInput(payload));
      });
    }

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

    /* 防 Mac 触控板双指左滑误触发浏览器历史后退：在手牌与牌桌容器拦截横向滚轮与边界手势 */
    bindTrackpadSwipeGuard();
  }

  function bindTrackpadSwipeGuard() {
    const isHorizScrollable = (el) => el && el.scrollWidth > el.clientWidth + 1;
    const findScrollableX = (node) => {
      let cur = node && node.nodeType === 1 ? node : node?.parentElement;
      while (cur && cur !== document.documentElement && cur !== document.body) {
        if (isHorizScrollable(cur)) {
          const ovX = window.getComputedStyle(cur).overflowX;
          if (ovX === "auto" || ovX === "scroll" || cur.tagName === "INPUT" || cur.tagName === "TEXTAREA") {
            return cur;
          }
        }
        cur = cur.parentElement;
      }
      return null;
    };
    window.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      const scroller = findScrollableX(e.target);
      if (scroller) {
        const atLeft = scroller.scrollLeft <= 0 && e.deltaX < 0;
        const atRight = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1 && e.deltaX > 0;
        if (atLeft || atRight) {
          e.preventDefault();
        } else {
          scroller.scrollLeft += e.deltaX;
          e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
    }, { passive: false });

    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 8) return;
      const hand = e.target?.closest?.("#playerHand, .hand-cards");
      if (hand && isHorizScrollable(hand)) {
        const atLeft = hand.scrollLeft <= 0 && dx > 0;
        const atRight = hand.scrollLeft + hand.clientWidth >= hand.scrollWidth - 1 && dx < 0;
        if (atLeft || atRight) e.preventDefault();
      } else if (touchStartX < 36 && dx > 0) {
        e.preventDefault();
      }
    }, { passive: false });
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
      const lang = getUiLang();
      const nextState = `${fs ? "1" : "0"}_${lang}`;
      if (btn.dataset.fsState === nextState) return;
      btn.dataset.fsState = nextState;
      const enterSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
      const exitSvg = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
      btn.innerHTML = fs
        ? `${exitSvg}${escapeHtml(t("解除", "退出全屏"))}`
        : `${enterSvg}${escapeHtml(t("全画面", "全屏"))}`;
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

  /** 应用入口：加载配置 → 注册浏览器语音 → 绑定事件 → 加载 gamedata.json → 单帧揭示规则弹窗并移除启动防闪屏遮罩 */
  async function init() {
    ConfigManager.load();
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
    applyUiLanguage(ConfigManager.data.uiLang, { silent: true, skipSave: true });
    document.body.classList.add("app-ready");
    const splash = $("bootSplash");
    if (splash) {
      const FIXED_SPLASH_MS = 1400;
      const elapsed = Date.now() - (typeof window.__bootStartAt === "number" ? window.__bootStartAt : Date.now());
      const remain = Math.max(0, FIXED_SPLASH_MS - elapsed);
      setTimeout(() => {
        requestAnimationFrame(() => {
          splash.classList.add("fade-out");
          setTimeout(() => splash.remove(), 480);
        });
      }, remain);
    }
  }

  init();
})();
