// The Quizlo game in JavaScript, for playing without the app: the TV web page runs this and the
// phones talk to it over WebRTC (see peer.js). It mirrors the Godot app (scripts/game/game.gd,
// scripts/game/quiz.gd and the message handling/views in scripts/main.gd) and speaks the same
// messages, so the phone pages work unchanged with either.
import { readZip } from "./zip.js";
import { qrRows } from "./qr.js";

const PLAYER_COLORS = ["e63946", "2a9d8f", "f4a261", "457b9d", "9b5de5", "ef476f", "06d6a0", "ffd166", "118ab2", "f15bb5", "8ac926", "ff924c"];
const MAX_NAME_LENGTH = 16;
const MAX_PLAYERS = 40;
const FORMAT = 1;
const TYPES = ["choice", "closest"];
const MEDIA_KINDS = ["image", "audio", "video"];
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml",
  wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", ogv: "video/ogg", mp4: "video/mp4", webm: "video/webm" };

const randomToken = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
const approx = (a, b) => Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(a), Math.abs(b));

export function cleanId(s) {
  let out = "";
  for (const ch of String(s)) {
    if (/[a-zA-Z0-9_-]/.test(ch)) out += ch;
    else if (ch === " " && out && !out.endsWith("-")) out += "-";
  }
  return out.slice(0, 64);
}

/** 2 -> "2", 2.5 -> "2.5" */
export function formatNumber(v) {
  if (approx(v, Math.round(v)) && Math.abs(v) < 1e15) return String(Math.round(v));
  return String(Number(v.toFixed(4)));
}

export function cleanName(raw) {
  return String(raw).trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH).trim();
}

// --- Quizzes ---------------------------------------------------------------------------------

function cleanQuestion(q) {
  if (!q || typeof q !== "object") return null;
  const type = String(q.type ?? "choice");
  if (!TYPES.includes(type)) return null;
  const out = { type, text: String(q.text ?? "").trim(), points: Math.max(0, parseInt(q.points ?? 1, 10) || 0),
    time: Math.min(600, Math.max(0, parseInt(q.time ?? 0, 10) || 0)), media: {} };
  if (type === "choice") {
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
    if (options.length < 2 || options.length > 6) return null;
    out.options = options;
    out.answer = Math.min(options.length - 1, Math.max(0, parseInt(q.answer ?? 0, 10) || 0));
  } else {
    const a = q.answer;
    if (!(typeof a === "number" || (typeof a === "string" && a.trim() !== "" && !isNaN(Number(a))))) return null;
    out.answer = Number(a);
    out.unit = String(q.unit ?? "").trim();
  }
  const m = q.media;
  if (m && typeof m === "object" && MEDIA_KINDS.includes(String(m.kind)) && m.file) {
    out.media = { kind: String(m.kind), file: String(m.file) };
    if (m.kind === "video" && typeof m.web === "string" && m.web) out.media.web = m.web;
    if (typeof m.credit === "string" && m.credit.trim()) out.media.credit = m.credit.trim().slice(0, 300);
  }
  if (!out.text && !out.media.kind) return null;
  return out;
}

/** Validates quiz.json data. Throws an Error with a friendly message if it's unusable. */
export function parseQuiz(data) {
  if (!data || typeof data !== "object") throw new Error("The quiz file looks damaged.");
  if ((data.format ?? FORMAT) > FORMAT) throw new Error("This quiz was made with a newer version of Quizlo.");
  const quiz = { id: cleanId(data.id ?? ""), title: String(data.title ?? "").trim() || "Untitled quiz", author: String(data.author ?? "").trim(), rounds: [] };
  if (!quiz.id) quiz.id = cleanId(quiz.title.toLowerCase());
  for (const r of Array.isArray(data.rounds) ? data.rounds : []) {
    if (!r || typeof r !== "object") continue;
    const questions = (Array.isArray(r.questions) ? r.questions : []).map(cleanQuestion).filter(Boolean);
    if (questions.length) quiz.rounds.push({ title: String(r.title ?? "").trim(), questions });
  }
  if (!quiz.rounds.length) throw new Error("This quiz doesn't have any questions yet.");
  quiz.rounds.forEach((r, i) => { if (!r.title) r.title = `Round ${i + 1}`; });
  return quiz;
}

/** Reads a .quizlo file. Returns { quiz, media: Map(file -> Blob) }. */
export async function loadQuizFile(bytes) {
  let entries;
  try { entries = await readZip(bytes instanceof Blob ? bytes : new Blob([bytes])); }
  catch (_) { throw new Error("That file isn't a Quizlo quiz file."); }
  const json = entries.get("quiz.json");
  if (!json) throw new Error("That file isn't a Quizlo quiz file (no quiz.json inside).");
  let data;
  try { data = JSON.parse(new TextDecoder().decode(json)); } catch (_) { throw new Error("The quiz file looks damaged."); }
  const quiz = parseQuiz(data);
  const media = new Map();
  for (const [name, b] of entries) {
    if (name.startsWith("media/")) media.set(name, new Blob([b], { type: MIME[name.split(".").pop().toLowerCase()] || "application/octet-stream" }));
  }
  return { quiz, media };
}

export const questionCount = (quiz) => quiz.rounds.reduce((n, r) => n + r.questions.length, 0);

export function answerText(q) {
  if (q.type === "choice") return q.options[q.answer];
  return formatNumber(q.answer) + (q.unit ? " " + q.unit : "");
}

// --- The game state machine (mirrors scripts/game/game.gd) ------------------------------------

export class Game {
  constructor(onChange = () => {}, onMedia = () => {}) {
    this.onChange = onChange;
    this.onMedia = onMedia;
    this.quiz = null;
    this.phase = "idle";
    this.roundI = -1;
    this.qI = -1;
    this.answersOpen = false;
    this.startedAt = 0;
    this.players = new Map();
    this.order = [];
    this.lastResults = new Map();
    this.nextColor = 0;
  }

  changed() { this.onChange(); }

  tick() {
    if (this.phase === "question" && this.answersOpen) {
      const q = this.currentQuestion();
      if (q.time > 0 && this.timeLeftMs() <= 0) { this.answersOpen = false; this.changed(); }
    }
  }

  setQuiz(quiz) {
    this.quiz = quiz;
    this.resetProgress();
    this.phase = quiz ? "lobby" : "idle";
    this.onMedia("stop");
    this.changed();
  }

  restart() {
    this.resetProgress();
    this.phase = this.quiz ? "lobby" : "idle";
    this.onMedia("stop");
    this.changed();
  }

  resetProgress() {
    this.roundI = -1;
    this.qI = -1;
    this.answersOpen = false;
    this.lastResults.clear();
    for (const p of this.players.values()) { p.score = 0; p.answers = {}; }
  }

  addPlayer(raw) {
    let name = cleanName(raw);
    if (!name || this.players.size >= MAX_PLAYERS) return null;
    const base = name;
    for (let n = 2; [...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase()); n++) {
      name = `${base.slice(0, MAX_NAME_LENGTH - 2)} ${n}`;
    }
    const player = { id: randomToken(8), token: randomToken(24), name, color: PLAYER_COLORS[this.nextColor++ % PLAYER_COLORS.length],
      score: 0, answers: {}, connected: 0 };
    this.players.set(player.id, player);
    this.order.push(player.id);
    this.changed();
    return player;
  }

  findByToken(token) {
    for (const p of this.players.values()) if (token && p.token === token) return p;
    return null;
  }

  removePlayer(id) {
    if (this.players.delete(id)) {
      this.order = this.order.filter((x) => x !== id);
      this.lastResults.delete(id);
      this.changed();
    }
  }

  adjustScore(id, delta) {
    const p = this.players.get(id);
    if (p) { p.score += delta; this.changed(); }
  }

  setConnected(id, delta) {
    const p = this.players.get(id);
    if (p) { p.connected = Math.max(0, p.connected + delta); this.changed(); }
  }

  advance() {
    if (!this.quiz) return;
    switch (this.phase) {
      case "lobby": this.roundI = 0; this.phase = "round_intro"; break;
      case "round_intro": this.qI = 0; return this.startQuestion();
      case "question": return this.reveal();
      case "reveal":
        if (this.qI + 1 < this.quiz.rounds[this.roundI].questions.length) { this.qI++; return this.startQuestion(); }
        this.phase = this.roundI + 1 >= this.quiz.rounds.length ? "final" : "scores";
        break;
      case "scores": this.roundI++; this.qI = -1; this.phase = "round_intro"; break;
      default: return;
    }
    this.onMedia("stop");
    this.changed();
  }

  advanceLabel() {
    switch (this.phase) {
      case "lobby": return "Start the quiz";
      case "round_intro": return "Show first question";
      case "question": return "Reveal the answer";
      case "reveal":
        if (this.qI + 1 < this.quiz.rounds[this.roundI].questions.length) return "Next question";
        return this.roundI + 1 >= this.quiz.rounds.length ? "Show final scores" : "Show scores";
      case "scores": return `Start round ${this.roundI + 2}`;
    }
    return "";
  }

  lockAnswers() {
    if (this.phase === "question" && this.answersOpen) { this.answersOpen = false; this.changed(); }
  }

  startQuestion() {
    this.phase = "question";
    this.answersOpen = true;
    this.startedAt = performance.now();
    this.lastResults.clear();
    this.onMedia("play");
    this.changed();
  }

  reveal() {
    this.answersOpen = false;
    const q = this.currentQuestion();
    const key = this.questionKey();
    this.lastResults.clear();
    const answered = [...this.players.values()].filter((p) => key in p.answers);
    if (q.type === "choice") {
      for (const p of answered) if (Number(p.answers[key]) === q.answer) this.lastResults.set(p.id, q.points);
    } else if (answered.length) {
      const best = Math.min(...answered.map((p) => Math.abs(Number(p.answers[key]) - q.answer)));
      for (const p of answered) if (approx(Math.abs(Number(p.answers[key]) - q.answer), best)) this.lastResults.set(p.id, q.points);
    }
    for (const [pid, pts] of this.lastResults) this.players.get(pid).score += pts;
    this.phase = "reveal";
    this.changed();
  }

  /** Returns "" on success or a short reason. */
  submitAnswer(playerId, key, value) {
    const p = this.players.get(playerId);
    if (!p) return "unknown player";
    if (this.phase !== "question" || key !== this.questionKey()) return "That question has finished.";
    if (!this.answersOpen) return "Time's up!";
    const q = this.currentQuestion();
    if (q.type === "choice") {
      if (typeof value !== "number") return "bad answer";
      const idx = Math.trunc(value);
      if (idx < 0 || idx >= q.options.length) return "bad answer";
      p.answers[key] = idx;
    } else {
      let num = NaN;
      if (typeof value === "number") num = value;
      else if (typeof value === "string" && value.trim() !== "") num = Number(value.trim().replace(",", "."));
      if (!isFinite(num)) return "Please type a number.";
      p.answers[key] = num;
    }
    this.changed();
    return "";
  }

  answeredCount() {
    const key = this.questionKey();
    return [...this.players.values()].filter((p) => key in p.answers).length;
  }

  everyoneAnswered() { return this.players.size > 0 && this.answeredCount() === this.players.size; }

  currentQuestion() {
    return this.quiz?.rounds[this.roundI]?.questions[this.qI] || null;
  }

  questionKey() { return `r${this.roundI}_q${this.qI}`; }

  questionNumber() {
    let n = 0;
    for (let r = 0; r < this.roundI; r++) n += this.quiz.rounds[r].questions.length;
    return n + this.qI + 1;
  }

  timeLeftMs() {
    const q = this.currentQuestion();
    if (!q || q.time <= 0) return -1;
    return Math.max(0, Math.round(q.time * 1000 - (performance.now() - this.startedAt)));
  }

  leaderboard() {
    const list = this.order.map((id) => this.players.get(id)).filter(Boolean).sort((a, b) => b.score - a.score);
    let rank = 0, last = -Infinity;
    return list.map((p, i) => {
      if (p.score !== last) { rank = i + 1; last = p.score; }
      return { id: p.id, name: p.name, score: p.score, color: p.color, rank };
    });
  }

  rankOf(id) { return this.leaderboard().find((e) => e.id === id)?.rank || 0; }

  optionCounts() {
    const q = this.currentQuestion();
    if (!q || q.type !== "choice") return [];
    const counts = q.options.map(() => 0);
    const key = this.questionKey();
    for (const p of this.players.values()) if (key in p.answers) counts[p.answers[key]]++;
    return counts;
  }

  closestGuesses() {
    const q = this.currentQuestion();
    if (!q || q.type !== "closest") return [];
    const key = this.questionKey();
    return [...this.players.values()].filter((p) => key in p.answers)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, guess: p.answers[key], off: Math.abs(p.answers[key] - q.answer), won: this.lastResults.has(p.id) }))
      .sort((a, b) => a.off - b.off);
  }

  /** Everything needed to carry on after the TV page is reloaded. */
  snapshot() {
    return { phase: this.phase, roundI: this.roundI, qI: this.qI, answersOpen: this.answersOpen, nextColor: this.nextColor,
      players: this.order.map((id) => ({ ...this.players.get(id), connected: 0 })), lastResults: [...this.lastResults] };
  }

  restore(s, quiz) {
    this.quiz = quiz;
    Object.assign(this, { phase: s.phase, roundI: s.roundI, qI: s.qI, answersOpen: !!s.answersOpen, nextColor: s.nextColor });
    this.players = new Map(s.players.map((p) => [p.id, p]));
    this.order = s.players.map((p) => p.id);
    this.lastResults = new Map(s.lastResults);
    if (this.phase === "question") this.startedAt = performance.now(); // a timed question restarts its clock
    if (!quiz) { this.phase = "idle"; this.roundI = this.qI = -1; }
  }
}

// --- The "server": handles phone messages and builds what each screen shows (mirrors main.gd) -

export class Engine {
  /**
   * send(clientId, message) delivers a message to one phone.
   * urls: { join, joinText, host } addresses for the QR codes. code: the game code.
   */
  constructor({ send, urls, code, hostKey, onChange = () => {}, onMedia = () => {} }) {
    this.send = send;
    this.urls = urls;
    this.code = code;
    this.hostKey = hostKey;
    this.onChange = onChange;
    this.library = new Map(); // id -> { summary, bytes }
    this.media = new Map();   // file -> Blob (current quiz)
    this.mediaUrls = new Map();
    this.clients = new Map(); // client id -> { role, pid }
    this.qrCache = new Map();
    this.dirty = false;
    this.game = new Game(() => this.markDirty(), (cmd) => onMedia(cmd));
  }

  markDirty() {
    if (this.dirty) return;
    this.dirty = true;
    queueMicrotask(() => { this.dirty = false; this.broadcast(); this.onChange(); });
  }

  // Quizzes ----------------------------------------------------------------------------------

  async addQuiz(bytes) {
    try {
      const { quiz } = await loadQuizFile(bytes);
      const id = cleanId(quiz.id);
      this.library.set(id, { bytes, summary: { id, title: quiz.title, author: quiz.author, rounds: quiz.rounds.length,
        questions: questionCount(quiz), modified: Date.now() / 1000 } });
      // Re-open it straight away unless a game with another quiz is under way.
      const current = this.game.quiz && cleanId(this.game.quiz.id) === id;
      if (current || ["idle", "lobby", "final"].includes(this.game.phase)) await this.loadQuiz(id);
      this.markDirty();
      return { ok: true, id, title: quiz.title };
    } catch (e) {
      return { ok: false, error: e.message || "That quiz file couldn't be opened." };
    }
  }

  async loadQuiz(id) {
    const entry = this.library.get(id);
    if (!entry) return "That quiz isn't on this TV any more.";
    const { quiz, media } = await loadQuizFile(entry.bytes);
    for (const url of this.mediaUrls.values()) URL.revokeObjectURL(url);
    this.mediaUrls.clear();
    this.media = media;
    this.game.setQuiz(quiz);
    return "";
  }

  /** A URL the TV page can use for a media file of the current quiz. */
  mediaUrl(file) {
    if (!file || !this.media.has(file)) return "";
    if (!this.mediaUrls.has(file)) this.mediaUrls.set(file, URL.createObjectURL(this.media.get(file)));
    return this.mediaUrls.get(file);
  }

  /** The picture for phones (sent along with the state by peer.js). */
  mediaBlob(file) { return this.media.get(file) || null; }

  // Phones -----------------------------------------------------------------------------------

  connected(id) { this.clients.set(id, { role: "", pid: "" }); }

  disconnected(id) {
    const c = this.clients.get(id);
    if (c?.role === "player") this.game.setConnected(c.pid, -1);
    this.clients.delete(id);
  }

  async message(id, msg) {
    const c = this.clients.get(id);
    if (!c || !msg || typeof msg !== "object") return;
    const t = String(msg.t || "");
    if (t === "hello") return this.hello(id, c, msg);
    if (t === "join") return this.join(id, c, msg);
    if (c.role === "player") {
      if (t === "answer") {
        const err = this.game.submitAnswer(c.pid, String(msg.q || ""), msg.v);
        if (err) this.send(id, { t: "error", message: err });
      } else if (t === "leave") {
        const pid = c.pid;
        this.unbindEverywhere(pid);
        this.game.removePlayer(pid);
      }
    } else if (c.role === "host") {
      await this.hostCommand(id, t, msg);
    }
  }

  hello(id, c, msg) {
    if (msg.role === "host") {
      if (String(msg.key || "") === this.hostKey) { c.role = "host"; this.sendState(id); }
      else this.send(id, { t: "bad_key" });
      return;
    }
    const player = this.game.findByToken(String(msg.token || ""));
    if (!player) { this.send(id, { t: "need_name", quiz_title: this.game.quiz?.title || "" }); return; }
    this.bind(id, c, player);
  }

  join(id, c, msg) {
    const player = this.game.addPlayer(String(msg.name || ""));
    if (!player) {
      this.send(id, { t: "error", message: cleanName(String(msg.name || "")) ? "Sorry, the game is full." : "Please type your name." });
      return;
    }
    this.send(id, { t: "welcome", token: player.token, name: player.name });
    this.bind(id, c, player);
  }

  bind(id, c, player) {
    if (c.role === "player" && c.pid) this.game.setConnected(c.pid, -1);
    c.role = "player";
    c.pid = player.id;
    this.game.setConnected(player.id, 1);
    this.sendState(id);
  }

  unbindEverywhere(pid) {
    for (const [wid, other] of this.clients) {
      if (other.role === "player" && other.pid === pid) {
        other.role = "";
        other.pid = "";
        this.send(wid, { t: "removed" });
      }
    }
  }

  async hostCommand(id, t, msg) {
    const g = this.game;
    switch (t) {
      case "advance": g.advance(); break;
      case "lock": g.lockAnswers(); break;
      case "replay": g.onMedia("replay"); break;
      case "restart": g.restart(); break;
      case "load": {
        const err = await this.loadQuiz(String(msg.id || ""));
        if (err) this.send(id, { t: "error", message: err });
        break;
      }
      case "upload": {
        const result = await this.addQuiz(msg.data);
        this.send(id, { t: "uploaded", ...result });
        break;
      }
      case "delete_quiz": {
        const qid = String(msg.id || "");
        if (g.quiz && cleanId(g.quiz.id) === qid) g.setQuiz(null);
        this.library.delete(qid);
        this.markDirty();
        break;
      }
      case "adjust": g.adjustScore(String(msg.pid || ""), Math.max(-100, Math.min(100, parseInt(msg.d, 10) || 0))); break;
      case "kick": {
        const pid = String(msg.pid || "");
        this.unbindEverywhere(pid);
        g.removePlayer(pid);
        break;
      }
    }
  }

  // Views ------------------------------------------------------------------------------------

  broadcast() {
    for (const id of this.clients.keys()) this.sendState(id);
  }

  sendState(id) {
    const c = this.clients.get(id);
    if (c?.role === "host") this.send(id, this.hostView());
    else if (c?.role === "player") this.send(id, this.playerView(c.pid));
  }

  questionView(forTv = false) {
    const g = this.game, q = g.currentQuestion();
    if (!q || !["question", "reveal"].includes(g.phase)) return {};
    const view = { key: g.questionKey(), number: g.questionNumber(), total: questionCount(g.quiz), type: q.type, text: q.text,
      points: q.points, open: g.answersOpen, time: q.time, time_left_ms: g.timeLeftMs(), media: q.media.kind || "" };
    if (q.type === "choice") view.options = q.options;
    else view.unit = q.unit || "";
    if (q.media.kind === "image") view.image = forTv ? this.mediaUrl(q.media.file) : `media:${q.media.file}`;
    if (g.phase === "reveal") { view.answer = q.answer; view.answer_text = answerText(q); }
    return view;
  }

  roundView() {
    const g = this.game;
    if (!g.quiz || g.roundI < 0 || g.roundI >= g.quiz.rounds.length) return {};
    return { number: g.roundI + 1, of: g.quiz.rounds.length, title: g.quiz.rounds[g.roundI].title };
  }

  leaderboardView() {
    return this.game.leaderboard().map((e) => ({ id: e.id, name: e.name, score: e.score, rank: e.rank, color: e.color }));
  }

  playerView(pid) {
    const g = this.game, p = g.players.get(pid);
    if (!p) return { t: "removed" };
    const view = { t: "state", phase: g.phase, quiz_title: g.quiz?.title || "",
      me: { name: p.name, score: p.score, color: p.color, rank: g.rankOf(pid) },
      player_count: g.players.size, round: this.roundView(), question: this.questionView() };
    const key = g.questionKey();
    if (key in p.answers && ["question", "reveal"].includes(g.phase)) view.my_answer = p.answers[key];
    if (g.phase === "reveal") view.gained = g.lastResults.get(pid) || 0;
    if (["scores", "final"].includes(g.phase)) view.leaderboard = this.leaderboardView();
    return view;
  }

  hostView() {
    const g = this.game, key = g.questionKey();
    const players = g.leaderboard().map((e) => {
      const p = g.players.get(e.id);
      const entry = { id: p.id, name: p.name, score: p.score, rank: e.rank, color: p.color, online: p.connected > 0, answered: key in p.answers };
      if (key in p.answers && ["question", "reveal"].includes(g.phase)) entry.answer = p.answers[key];
      if (g.phase === "reveal") entry.gained = g.lastResults.get(p.id) || 0;
      return entry;
    });
    const q = this.questionView();
    const current = g.currentQuestion();
    if (q.key) { q.answer = current.answer; q.answer_text = answerText(current); }
    return { t: "state", phase: g.phase, online: true, code: this.code,
      quiz: g.quiz ? { id: cleanId(g.quiz.id), title: g.quiz.title, rounds: g.quiz.rounds.length, questions: questionCount(g.quiz) } : {},
      quizzes: [...this.library.values()].map((e) => e.summary).sort((a, b) => b.modified - a.modified),
      players, round: this.roundView(), question: q, answered: g.answeredCount(), advance_label: g.advanceLabel(),
      join_url: this.urls.joinText, addresses: 1, version: "web" };
  }

  qr(url) {
    if (!this.qrCache.has(url)) this.qrCache.set(url, qrRows(url) || []);
    return this.qrCache.get(url);
  }

  /** What the TV page draws (same shape as the app's tv_view). */
  tvView() {
    const g = this.game, key = g.questionKey();
    const players = g.order.map((id) => g.players.get(id)).filter(Boolean).map((p) => ({ id: p.id, name: p.name, color: p.color,
      online: p.connected > 0, answered: key in p.answers && ["question", "reveal"].includes(g.phase), won: g.phase === "reveal" && g.lastResults.has(p.id) }));
    const view = { t: "state", phase: g.phase, online: true, code: this.code, quiz_title: g.quiz?.title || "",
      join_url: this.urls.join, join_text: this.urls.joinText, host_url: this.urls.host,
      join_qr: this.qr(this.urls.join), host_qr: this.qr(this.urls.host), addresses: 1, server_error: "", players, round: this.roundView() };
    if (g.quiz && g.roundI >= 0 && g.roundI < g.quiz.rounds.length) view.round.questions = g.quiz.rounds[g.roundI].questions.length;
    const q = this.questionView(true), current = g.currentQuestion();
    if (q.key) {
      q.answered = g.answeredCount();
      q.everyone = g.everyoneAnswered();
      if (current.media.kind === "audio") q.audio = this.mediaUrl(current.media.file);
      else if (current.media.kind === "video") q.video = this.mediaUrl(current.media.web || current.media.file);
      if (g.phase === "reveal") {
        q.credit = current.media.credit || "";
        q.counts = g.optionCounts();
        q.guesses = g.closestGuesses().map((x) => ({ name: x.name, color: x.color, guess: x.guess, won: x.won }));
      }
      view.question = q;
    }
    if (["scores", "final"].includes(g.phase)) view.leaderboard = this.leaderboardView();
    return view;
  }
}
