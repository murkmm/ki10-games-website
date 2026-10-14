// Runs a whole game inside the TV web page when there's no Quizlo app (playing on the website).
// Keeps the game code, quizzes and scores on this device so a reload carries on where it was.
import { Engine } from "./engine.js";
import { PeerHost, newCode } from "./peer.js";

const STATE_KEY = "quizlo.tv.state";
const SAMPLES = ["starter-quiz", "christmas-sample"]; // built-in quizzes; the first is chosen to start with

// --- Quizzes kept on this TV (IndexedDB) -------------------------------------------------------

let dbp;
function db() {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open("quizlo-tv", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("quizzes");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("quizzes", mode);
    const req = fn(t.objectStore("quizzes"));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}
const saved = {
  all: async () => {
    const keys = await tx("readonly", (s) => s.getAllKeys());
    const values = await tx("readonly", (s) => s.getAll());
    return keys.map((k, i) => [k, values[i]]);
  },
  put: (id, bytes) => tx("readwrite", (s) => s.put(bytes, id)),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
};

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || "null") || {}; } catch (_) { return {}; }
}
function writeState(s) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (_) {}
}

/**
 * Starts hosting. onState(view) is called whenever the screen should change, onMedia(cmd) for
 * "replay"/"stop", onStatus(ok, message) for the connection.
 */
export async function startOnlineTv({ onState, onMedia, onStatus }) {
  const prev = readState();
  let code = prev.code || newCode();
  const hostKey = prev.hostKey || Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  const dir = location.pathname.replace(/[^/]*$/, "");
  const base = `${location.origin}${dir}`;
  const urlsFor = (c) => ({ join: `${base}play.html#${c}`, host: `${base}host.html#${c}-${hostKey}`, joinText: `${location.host}${dir}`.replace(/\/$/, "") });

  let host;
  let saveTimer;
  const engine = new Engine({
    send: (id, m) => host && host.send(id, m),
    urls: urlsFor(code), code, hostKey,
    onChange: () => { onState(engine.tvView()); save(); },
    onMedia,
  });

  // Quizzes: everything sent to this TV before, plus the built-in sample.
  try {
    for (const [, bytes] of await saved.all()) await engine.addQuiz(bytes);
  } catch (_) {}
  for (const id of SAMPLES) {
    if (engine.library.has(id)) continue;
    try {
      const r = await fetch(new URL(`./${id}.quizlo`, import.meta.url).href);
      if (r.ok) await engine.addQuiz(await r.arrayBuffer());
    } catch (_) {}
  }
  const persistLibrary = async () => {
    try {
      const have = new Set((await saved.all()).map(([k]) => k));
      for (const [id, e] of engine.library) if (!have.has(id)) await saved.put(id, e.bytes);
      for (const id of have) if (!engine.library.has(id)) await saved.del(id);
    } catch (_) {}
  };
  const origAdd = engine.addQuiz.bind(engine);
  engine.addQuiz = async (bytes) => { const r = await origAdd(bytes); if (r.ok) { host?.clearMedia(); persistLibrary(); } return r; };
  const origLoad = engine.loadQuiz.bind(engine);
  engine.loadQuiz = async (id) => { host?.clearMedia(); return origLoad(id); };

  // Carry on from before a reload.
  if (prev.quizId && engine.library.has(prev.quizId)) {
    await engine.loadQuiz(prev.quizId);
    if (prev.game) engine.game.restore(prev.game, engine.game.quiz);
  } else {
    engine.game.setQuiz(null);
    if (engine.library.has(SAMPLES[0])) await engine.loadQuiz(SAMPLES[0]);
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const q = engine.game.quiz;
      writeState({ code, hostKey, quizId: q ? q.id : "", game: engine.game.snapshot() });
      persistLibrary();
    }, 300);
  }

  function connect() {
    host = new PeerHost(code, {
      onReady: () => onStatus(true),
      onStatus: (ok) => onStatus(ok, ok ? "" : "Reconnecting..."),
      onIdTaken: () => {
        // Someone else has this code (e.g. this page open twice): pick another.
        code = newCode();
        engine.code = code;
        engine.urls = urlsFor(code);
        engine.qrCache.clear();
        save();
        connect();
        engine.markDirty();
      },
      onConnect: (id) => engine.connected(id),
      onDisconnect: (id) => engine.disconnected(id),
      onMessage: (id, m) => engine.message(id, m),
      mediaBlob: (file) => engine.mediaBlob(file),
    });
    host.start().catch((e) => onStatus(false, e.message));
  }
  connect();
  setInterval(() => engine.game.tick(), 250);
  writeState({ code, hostKey, quizId: engine.game.quiz ? engine.game.quiz.id : "", game: engine.game.snapshot() });
  onState(engine.tvView());

  return {
    engine,
    /** Opening a quiz file on the TV itself (e.g. a laptop). */
    openFile: async (file) => engine.addQuiz(await file.arrayBuffer()),
    newGameCode: () => { writeState({}); location.reload(); },
  };
}
