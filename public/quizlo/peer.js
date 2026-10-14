// WebRTC connections for playing Quizlo on the website, without the app. The TV page hosts the game
// (see engine.js) and phones connect straight to it using the game code, via PeerJS. PeerJS's free
// public servers help the devices find each other (and relay if a network blocks direct links);
// the game itself goes directly between the devices.

const PEERJS_SRC = new URL("./vendor/peerjs/peerjs.min.js", import.meta.url).href;
const PREFIX = "quizlo-v1-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export function isCode(s) {
  return /^[A-Z]{4}$/.test(String(s || "").toUpperCase());
}

/** Connection settings. A different signalling server can be set for testing (localStorage). */
function peerOptions() {
  try {
    const custom = JSON.parse(localStorage.getItem("quizlo.peerServer") || "null");
    if (custom) return { debug: 1, ...custom };
  } catch (_) {}
  return { debug: 1 };
}

let loading = null;
export function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PEERJS_SRC;
      s.onload = () => resolve(window.Peer);
      s.onerror = () => { loading = null; reject(new Error("Couldn't load the connection library.")); };
      document.head.append(s);
    });
  }
  return loading;
}

// --- TV side -----------------------------------------------------------------------------------

/** Hosts a game under a code. Phones' messages arrive via onMessage(clientId, msg). */
export class PeerHost {
  constructor(code, { onReady = () => {}, onIdTaken = () => {}, onStatus = () => {}, onConnect, onDisconnect, onMessage, mediaBlob }) {
    Object.assign(this, { code, onReady, onIdTaken, onStatus, onConnect, onDisconnect, onMessage, mediaBlob });
    this.conns = new Map(); // id -> { conn, sent: Set(files), queue: Promise }
    this.nextId = 1;
    this.buffers = new Map(); // file -> Promise<ArrayBuffer>
  }

  async start() {
    const Peer = await loadPeerJs();
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on("open", () => this.onReady());
    peer.on("connection", (conn) => this.accept(conn));
    peer.on("disconnected", () => {
      // Lost the signalling server; existing phones stay connected. Reconnect so new phones can join.
      this.onStatus(false);
      setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 2000);
    });
    peer.on("open", () => this.onStatus(true));
    peer.on("error", (e) => {
      if (e.type === "unavailable-id") { this.stop(); this.onIdTaken(); }
      else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) {
        this.onStatus(false);
        setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 3000);
      }
    });
  }

  stop() {
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
  }

  accept(conn) {
    const id = this.nextId++;
    conn.on("open", () => {
      this.conns.set(id, { conn, sent: new Set(), queue: Promise.resolve() });
      this.onConnect(id);
    });
    conn.on("data", (data) => this.onMessage(id, data));
    const drop = () => { if (this.conns.delete(id)) this.onDisconnect(id); };
    conn.on("close", drop);
    conn.on("error", drop);
  }

  buffer(file) {
    if (!this.buffers.has(file)) {
      const blob = this.mediaBlob(file);
      this.buffers.set(file, blob ? blob.arrayBuffer().then((data) => ({ data, type: blob.type })) : Promise.resolve(null));
    }
    return this.buffers.get(file);
  }

  /** Sends a message, first sending the question's picture (or music/video) to that phone if needed. */
  send(id, msg) {
    const c = this.conns.get(id);
    if (!c) return;
    const files = ["image", "audio", "video"].map((k) => msg?.question?.[k])
      .filter((v) => typeof v === "string" && v.startsWith("media:")).map((v) => v.slice(6));
    c.queue = c.queue.then(async () => {
      if (!c.conn.open) return;
      for (const file of files) {
        if (c.sent.has(file)) continue;
        c.sent.add(file);
        const b = await this.buffer(file);
        if (b) c.conn.send({ t: "blob", file, type: b.type, data: b.data });
      }
      c.conn.send(msg);
    }).catch(() => {});
  }

  /** Forget cached pictures (when a different quiz is loaded). */
  clearMedia() {
    this.buffers.clear();
    for (const c of this.conns.values()) c.sent.clear();
  }
}

// --- Phone side --------------------------------------------------------------------------------

/** Connects a phone page to the TV page hosting game `code`. Same interface as the app connection. */
export class PeerClient {
  constructor(code, { onOpen, onMessage, onStatus = () => {} }) {
    Object.assign(this, { code: code.toUpperCase(), onOpen, onMessage, onStatus });
    this.blobs = new Map();
    this.retry = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !(this.conn && this.conn.open)) this.reconnectSoon(0);
    });
  }

  async start() {
    try {
      const Peer = await loadPeerJs();
      this.Peer = Peer;
      this.newPeer();
    } catch (e) {
      this.onStatus(false, e.message);
    }
  }

  newPeer() {
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
    const peer = new this.Peer(peerOptions());
    this.peer = peer;
    peer.on("open", () => this.connect());
    peer.on("disconnected", () => setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 1000));
    peer.on("error", (e) => {
      if (e.type === "peer-unavailable") this.onStatus(false, "notfound");
      else this.onStatus(false);
      this.reconnectSoon();
    });
  }

  connect() {
    if (this.conn) { try { this.conn.close(); } catch (_) {} }
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    this.conn = conn;
    const timer = setTimeout(() => { if (this.conn === conn && !conn.open) this.reconnectSoon(); }, 15000);
    conn.on("open", () => {
      clearTimeout(timer);
      this.retry = 0;
      this.onStatus(true);
      this.onOpen();
    });
    conn.on("data", (d) => this.receive(d));
    const lost = () => {
      clearTimeout(timer);
      if (this.conn !== conn) return;
      this.onStatus(false);
      this.reconnectSoon();
    };
    conn.on("close", lost);
    conn.on("error", lost);
  }

  reconnectSoon(delay) {
    clearTimeout(this.timer);
    this.retry = Math.min(this.retry + 1, 6);
    this.timer = setTimeout(() => {
      if (!this.peer || this.peer.destroyed) this.newPeer();
      else if (this.peer.disconnected) this.peer.reconnect();
      else this.connect();
    }, delay ?? 800 * this.retry);
  }

  receive(d) {
    if (!d || typeof d !== "object") return;
    if (d.t === "blob") {
      this.blobs.set(d.file, URL.createObjectURL(new Blob([d.data], { type: d.type })));
      return;
    }
    for (const k of ["image", "audio", "video"]) {
      const v = d.question?.[k];
      if (typeof v === "string" && v.startsWith("media:")) d.question[k] = this.blobs.get(v.slice(6)) || "";
    }
    this.onMessage(d);
  }

  send(msg) {
    if (this.conn && this.conn.open) { this.conn.send(msg); return true; }
    return false;
  }
}
