// Keeps a WebSocket open to the Quizzy app and reconnects automatically
// (phones drop connections whenever the screen locks).
export class Connection {
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
