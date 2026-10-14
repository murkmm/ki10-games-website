// Connects a phone page to the game and reconnects automatically (phones drop connections
// whenever the screen locks). Two kinds of game:
//  - the Quizlo app on the home Wi-Fi: a WebSocket to the app that served this page
//  - played on the website: WebRTC straight to the TV page, found by the game code in the link
//    (e.g. play.html#ABCD), see peer.js

/** The game code from the link (play.html#ABCD or host.html#ABCD-key), or "" when using the app. */
export function gameCode() {
  const m = location.hash.match(/^#([A-Za-z]{4})(?:-([\w]+))?$/);
  return m ? m[1].toUpperCase() : "";
}

/** The quiz master code in a host.html#ABCD-key link. */
export function linkHostKey() {
  const m = location.hash.match(/^#[A-Za-z]{4}-([\w]+)$/);
  return m ? m[1] : "";
}

/** True when this page was served by the Quizlo app (rather than the website). */
let appCheck = null;
export function servedByApp() {
  if (!appCheck) {
    appCheck = location.protocol !== "http:" ? Promise.resolve(false)
      : fetch("/api/info", { cache: "no-store" }).then((r) => r.json()).then((j) => j.app === "quizlo").catch(() => false);
  }
  return appCheck;
}

export class Connection {
  constructor(opts) {
    const code = opts.code ?? gameCode();
    if (code) {
      import("./peer.js").then(({ PeerClient }) => {
        this.impl = new PeerClient(code, opts);
        this.impl.start();
      });
    } else {
      this.impl = new AppConnection(opts);
    }
  }

  send(msg) {
    return this.impl ? this.impl.send(msg) : false;
  }
}

/** WebSocket to the Quizlo app on the home network. */
class AppConnection {
  constructor({ onOpen, onMessage, onStatus }) {
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.retry = 0;
    const port = Number(location.port || 80) + 1;
    this.url = `ws://${location.hostname}:${port}`;
    this.connect();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && (!this.ws || this.ws.readyState > 1)) this.connect();
    });
  }

  connect() {
    clearTimeout(this.timer);
    try { if (this.ws) this.ws.close(); } catch (_) {}
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.onStatus(true); this.onOpen(); };
    ws.onmessage = (e) => { try { this.onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.onStatus(false);
      this.retry = Math.min(this.retry + 1, 5);
      this.timer = setTimeout(() => this.connect(), 600 * this.retry);
    };
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(msg)); return true; }
    return false;
  }
}

export function $(sel, root = document) { return root.querySelector(sel); }

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c.nodeType ? c : String(c));
  return node;
}

let toastTimer;
export function toast(text) {
  let t = document.querySelector(".toast");
  if (!t) { t = el("div", { class: "toast" }); document.body.append(t); }
  t.textContent = text;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3000);
}

export function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch (_) { return null; }
}

// Keeps phone screens awake during the quiz where supported.
export async function keepAwake() {
  try {
    if ("wakeLock" in navigator && document.visibilityState === "visible") await navigator.wakeLock.request("screen");
  } catch (_) {}
}
document.addEventListener("visibilitychange", keepAwake);

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
  return n + s;
}

export function formatNumber(v) {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
}

/**
 * A player's round picture: their selfie, their emoji, or the first letter of their name, on their
 * colour. p: { name, color, emoji?, photo? }. With images: true, emoji are drawn from web/emoji/
 * pictures (for TV browsers that don't have colour emoji). A photo of "self" is this phone's own.
 */
export function face(p, size = 44, { images = false, cls = "" } = {}) {
  const node = el("span", { class: "dot face " + cls, style: `background:#${p.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px` });
  const photo = p.photo === "self" ? (store("quizlo.photo") ? "data:image/jpeg;base64," + store("quizlo.photo") : "") : p.photo;
  if (photo) node.append(el("img", { src: photo, alt: "" }));
  else if (p.emoji && images) node.append(el("img", { src: "emoji/" + emojiFile(p.emoji), alt: p.emoji, class: "emo" }));
  else if (p.emoji) node.append(el("span", { class: "emo", style: `font-size:${Math.round(size * 0.62)}px` }, p.emoji));
  else node.append(String(p.name || "?").slice(0, 1).toUpperCase());
  return node;
}

function emojiFile(e) {
  return [...e].map((c) => c.codePointAt(0).toString(16)).filter((h) => h !== "fe0f").join("-") + ".png";
}
