// Quizzy Quiz Writer: write quizzes on a phone or laptop, then send them to the TV app
// or save them as a .quizzy file. Quizzes are kept in this browser (IndexedDB).
import { $, el, toast, store, LETTERS } from "./connection.js";
import { makeZip, readZip } from "./zip.js";
import { processImage, decodeAudio, previewClip, stopPreview, renderClip, formatTime, MAX_CLIP_SECONDS } from "./media.js";
import { convertToOgv } from "./convert.js";
import { SOURCES, hasProxy, download as searchDownload } from "./search.js";

// ---------------------------------------------------------------- storage

let dbPromise;
function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open("quizzy-editor", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("quizzes", { keyPath: "id" });
      req.result.createObjectStore("media");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idb(name, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(name, mode);
    const req = fn(t.objectStore(name));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Storage is full"));
  });
}
const Quizzes = {
  all: () => idb("quizzes", "readonly", (s) => s.getAll()),
  get: (id) => idb("quizzes", "readonly", (s) => s.get(id)),
  put: (q) => idb("quizzes", "readwrite", (s) => s.put(q)),
  del: (id) => idb("quizzes", "readwrite", (s) => s.delete(id)),
};
// Media is stored as {type, data: ArrayBuffer} which every browser handles reliably.
const Media = {
  async get(quizId, file) {
    const rec = await idb("media", "readonly", (s) => s.get(`${quizId}:${file}`));
    return rec ? new Blob([rec.data], { type: rec.type }) : null;
  },
  async put(quizId, file, blob) {
    const data = await blob.arrayBuffer();
    await idb("media", "readwrite", (s) => s.put({ type: blob.type, data }, `${quizId}:${file}`));
  },
  del: (quizId, file) => idb("media", "readwrite", (s) => s.delete(`${quizId}:${file}`)),
  delQuiz: (quizId) => idb("media", "readwrite", (s) => s.delete(IDBKeyRange.bound(`${quizId}:`, `${quizId}:￿`))),
};

// ---------------------------------------------------------------- the TV app (when this page is served by it)

const KEY_STORE = "quizzy.hostkey." + location.host;
const params = new URLSearchParams(location.search);
if (params.get("k")) { store(KEY_STORE, params.get("k")); history.replaceState(null, "", location.pathname + location.hash); }
const tv = { connected: false, key: store(KEY_STORE) || "" };

async function detectTv() {
  if (location.protocol !== "http:") return;
  try {
    const r = await fetch("/api/info", { cache: "no-store" });
    tv.connected = (await r.json()).app === "quizzy";
  } catch (_) {}
}

async function tvQuizzes() {
  try {
    const r = await fetch(`/api/quizzes?k=${encodeURIComponent(tv.key)}`, { cache: "no-store" });
    return r.ok ? await r.json() : [];
  } catch (_) { return []; }
}

// ---------------------------------------------------------------- model helpers

const uid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
const POINTS = [1, 2, 3, 5, 10];
const TIMES = [[0, "No time limit"], [10, "10 seconds"], [20, "20 seconds"], [30, "30 seconds"], [45, "45 seconds"], [60, "1 minute"], [90, "90 seconds"]];
const TYPE_NAMES = { choice: "Multiple choice", tf: "True or false", closest: "Closest number" };

function newQuiz() {
  return { id: uid(), title: "", author: store("quizzy.author") || "", rounds: [newRound(1)], created: Date.now(), updated: Date.now() };
}
function newRound(n) { return { title: `Round ${n}`, questions: [] }; }
function newQuestion(kind = "choice", from) {
  const q = { type: "choice", text: "", options: ["", "", "", ""], answer: null, points: from?.points ?? 1, time: from?.time ?? 0, media: null };
  return setKind(q, kind);
}
function kindOf(q) { return q.type === "closest" ? "closest" : q.tf ? "tf" : "choice"; }
function setKind(q, kind) {
  const was = kindOf(q);
  if (kind === was && q.options) return q;
  if (kind === "closest") { q.type = "closest"; delete q.tf; q.answer = null; q.unit = q.unit || ""; }
  else {
    q.type = "choice";
    if (kind === "tf") { q.tf = true; q.options = ["True", "False"]; q.answer = null; }
    else {
      delete q.tf;
      if (!q.options || was === "tf") q.options = ["", "", "", ""];
      q.answer = null;
    }
  }
  return q;
}

/** What's still missing from a question, or "" if it's ready. */
function problem(q) {
  if (!q.text.trim() && !q.media) return "Needs a question";
  if (q.type === "closest") {
    return q.answer === null || q.answer === "" || isNaN(Number(q.answer)) ? "Needs the right number" : "";
  }
  const filled = q.options.filter((o) => o.trim()).length;
  if (filled < 2) return "Needs at least 2 answers";
  if (q.options.some((o) => !o.trim())) return "Fill in or remove empty answers";
  if (q.answer === null || q.answer < 0 || q.answer >= q.options.length) return "Tap ✓ next to the right answer";
  return "";
}

function countQuestions(quiz) { return quiz.rounds.reduce((n, r) => n + r.questions.length, 0); }
function slug(s) { return (s || "quiz").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "quiz"; }
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------- saving

let quiz = null;
let saveTimer;
function save() {
  if (!quiz) return;
  quiz.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}
async function flush() {
  clearTimeout(saveTimer);
  if (!quiz) return;
  try { await Quizzes.put(JSON.parse(JSON.stringify(quiz))); }
  catch (e) { toast("Couldn't save - is this device's storage full?"); }
}
addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

// ---------------------------------------------------------------- quiz files

async function buildQuizFile(q) {
  const files = [];
  let skipped = 0;
  const json = { format: 1, id: q.id, title: q.title.trim() || "Untitled quiz", author: q.author.trim(), rounds: [] };
  for (const [ri, r] of q.rounds.entries()) {
    const qs = [];
    for (const x of r.questions) {
      if (problem(x)) { skipped++; continue; }
      const out = { type: x.type, text: x.text.trim(), points: x.points, time: x.time };
      if (x.type === "choice") { out.options = x.options.map((o) => o.trim()); out.answer = x.answer; if (x.tf) out.tf = true; }
      else { out.answer = Number(x.answer); out.unit = (x.unit || "").trim(); }
      if (x.media) {
        const blob = await Media.get(q.id, x.media.file);
        if (blob) {
          out.media = { kind: x.media.kind, file: x.media.file };
          if (x.media.credit) out.media.credit = x.media.credit;
          files.push({ name: x.media.file, data: blob });
          const web = x.media.web && await Media.get(q.id, x.media.web);
          if (web) { out.media.web = x.media.web; files.push({ name: x.media.web, data: web }); }
        }
      }
      qs.push(out);
    }
    if (qs.length) json.rounds.push({ title: r.title.trim() || `Round ${ri + 1}`, questions: qs });
  }
  files.unshift({ name: "quiz.json", data: JSON.stringify(json, null, 1) });
  return { blob: await makeZip(files), skipped, empty: json.rounds.length === 0, name: slug(json.title) + ".quizzy" };
}

async function importQuizFile(blob) {
  let entries;
  try { entries = await readZip(blob); } catch (_) { throw new Error("That isn't a Quizzy quiz file."); }
  const raw = entries.get("quiz.json");
  if (!raw) throw new Error("That isn't a Quizzy quiz file.");
  const data = JSON.parse(new TextDecoder().decode(raw));
  let id = String(data.id || uid());
  const existing = await Quizzes.get(id);
  if (existing && !confirm(`You already have "${existing.title || "Untitled quiz"}" here. Replace it with the version from this file?\n\n(Press Cancel to keep both.)`)) id = uid();
  else if (existing) await Media.delQuiz(id);
  const q = { id, title: data.title || "", author: data.author || "", created: Date.now(), updated: Date.now(), rounds: [] };
  for (const r of data.rounds || []) {
    const round = { title: r.title || "", questions: [] };
    for (const x of r.questions || []) {
      const nq = { type: x.type === "closest" ? "closest" : "choice", text: x.text || "", points: x.points ?? 1, time: x.time ?? 0, media: null };
      if (nq.type === "choice") {
        nq.options = (x.options || []).map(String);
        nq.answer = Number.isInteger(x.answer) ? x.answer : null;
        if (x.tf || (nq.options.length === 2 && nq.options[0] === "True" && nq.options[1] === "False")) nq.tf = true;
      } else { nq.answer = x.answer; nq.unit = x.unit || ""; }
      if (x.media && entries.get(x.media.file)) {
        const bytes = entries.get(x.media.file);
        const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", wav: "audio/wav", mp3: "audio/mpeg", ogv: "video/ogg", ogg: "video/ogg" }[x.media.file.split(".").pop().toLowerCase()] || "";
        await Media.put(id, x.media.file, new Blob([bytes], { type }));
        nq.media = { kind: x.media.kind, file: x.media.file, name: x.media.file.split("/").pop() };
        if (x.media.credit) nq.media.credit = String(x.media.credit);
        if (x.media.web && entries.get(x.media.web)) {
          await Media.put(id, x.media.web, new Blob([entries.get(x.media.web)], { type: "video/mp4" }));
          nq.media.web = x.media.web;
        }
      }
      round.questions.push(nq);
    }
    q.rounds.push(round);
  }
  if (!q.rounds.length) q.rounds.push(newRound(1));
  await Quizzes.put(q);
  return q;
}

function download(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = $("#pick");
    input.value = "";
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

// ---------------------------------------------------------------- views

const app = $("#app");
function view(...children) { app.replaceChildren(...children); window.scrollTo(0, 0); }
function setDock(...buttons) {
  const items = buttons.filter(Boolean);
  $("#dock").classList.toggle("hidden", items.length === 0);
  $("#dock-inner").replaceChildren(...items);
}
function go(path) { location.hash = "#/" + path; }

async function route() {
  stopPreview();
  stopSearchAudio();
  panel = null;
  trim = null;
  if (vtrim) { URL.revokeObjectURL(vtrim.url); vtrim = null; }
  await flush();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "quiz" && parts[1]) {
    if (!quiz || quiz.id !== parts[1]) quiz = await Quizzes.get(parts[1]);
    if (!quiz) return go("");
    if (parts[2] === "q") return questionView(Number(parts[3]), Number(parts[4]));
    return quizView();
  }
  quiz = null;
  return homeView();
}
addEventListener("hashchange", route);

// --- Home: list of quizzes

async function homeView() {
  setDock();
  const quizzes = (await Quizzes.all()).sort((a, b) => b.updated - a.updated);
  const list = el("div", {});
  if (!quizzes.length) list.append(el("p", { class: "muted" }, "You haven't written any quizzes yet."));
  for (const q of quizzes) {
    const n = countQuestions(q);
    list.append(el("div", { class: "card qcard", onclick: () => go(`quiz/${q.id}`) },
      el("div", { class: "bold", style: "font-size:1.25rem" }, q.title || "Untitled quiz"),
      el("div", { class: "small muted" }, `${n} question${n === 1 ? "" : "s"} · ${q.rounds.length} round${q.rounds.length === 1 ? "" : "s"} · edited ${ago(q.updated)}`)));
  }
  const parts = [
    el("div", { class: "bar" }, el("div", { class: "logo" }, "Quizzy"), el("span", { class: "muted" }, "Quiz Writer")),
  ];
  if (tv.connected) parts.push(el("div", { class: "card" }, "✅ Connected to the Quizzy app on the TV. You can send quizzes straight to it."));
  parts.push(
    el("button", { class: "primary big", onclick: async () => { quiz = newQuiz(); await flush(); go(`quiz/${quiz.id}`); } }, "＋ Write a new quiz"),
    el("h2", { style: "margin-top:24px" }, "My quizzes"),
    list,
    el("div", { class: "btnrow", style: "margin-top:14px" },
      el("button", { class: "ghost", style: "width:100%", onclick: openFile }, "📂 Open a quiz file")),
  );
  if (tv.connected) {
    const box = el("div", { class: "card" }, el("h3", { style: "margin-top:0" }, "Quizzes on the TV"), el("p", { class: "muted small" }, "Loading..."));
    parts.push(box);
    tvQuizzes().then((qs) => {
      box.replaceChildren(el("h3", { style: "margin-top:0" }, "Quizzes on the TV"));
      if (!qs.length) box.append(el("p", { class: "muted small" }, tv.key ? "None yet." : "Open this page from the quiz master screen to see these."));
      for (const q of qs) box.append(el("div", { class: "row", style: "padding:6px 0" },
        el("div", { class: "grow" }, q.title, el("div", { class: "small muted" }, `${q.questions} questions`)),
        el("button", { class: "small", onclick: async () => {
          const r = await fetch(`/api/quiz/${encodeURIComponent(q.id)}.quizzy?k=${encodeURIComponent(tv.key)}`);
          if (!r.ok) return toast("Couldn't copy that quiz.");
          try { const nq = await importQuizFile(await r.blob()); toast("Copied - you can edit it now"); go(`quiz/${nq.id}`); }
          catch (e) { toast(e.message); }
        } }, "Copy here to edit")));
    });
  }
  parts.push(el("div", { class: "tip small", style: "margin-top:20px" },
    "Your quizzes are saved in this web browser on this device. To keep a backup, or to move a quiz to another phone or computer, use 'Save quiz file'.",
    isIos() && !standalone() ? el("div", { style: "margin-top:6px" }, "On iPhone or iPad: tap the Share button then 'Add to Home Screen'. That keeps your quizzes safe and opens this like an app.") : null));
  view(...parts);
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;

async function openFile() {
  const file = await pickFile(".quizzy,application/zip,application/octet-stream");
  if (!file) return;
  try { const q = await importQuizFile(file); toast(`Opened "${q.title || "Untitled quiz"}"`); go(`quiz/${q.id}`); }
  catch (e) { toast(e.message || "That file couldn't be opened."); }
}

// --- Quiz: title, rounds and the list of questions

function quizView() {
  const q = quiz;
  const title = el("input", { class: "title-input", value: q.title, placeholder: "Quiz name, e.g. Christmas Quiz 2026", maxlength: 80 });
  title.oninput = () => { q.title = title.value; save(); };
  const author = el("input", { value: q.author, placeholder: "Your name (optional)", maxlength: 40 });
  author.oninput = () => { q.author = author.value; store("quizzy.author", author.value); save(); };

  const rounds = q.rounds.map((r, ri) => {
    const rt = el("input", { value: r.title, placeholder: `Round ${ri + 1} name, e.g. Christmas Films`, maxlength: 60, style: "font-weight:600" });
    rt.oninput = () => { r.title = rt.value; save(); };
    const list = el("ul", { class: "qlist" });
    r.questions.forEach((x, qi) => {
      const issue = problem(x);
      const icon = x.media ? { image: "🖼 ", audio: "🎵 ", video: "📺 " }[x.media.kind] : "";
      list.append(el("li", {},
        el("button", { class: "open", onclick: () => go(`quiz/${q.id}/q/${ri}/${qi}`) },
          el("span", { class: "num" }, qi + 1),
          el("span", { class: "txt" }, icon + (x.text.trim() || (x.media ? TYPE_NAMES[kindOf(x)] : "(no question yet)"))),
          issue ? el("span", { class: "warn" }, "⚠") : null),
        el("button", { class: "mv", title: "Move up", disabled: qi === 0 && ri === 0, onclick: () => moveQuestion(ri, qi, -1) }, "▲"),
        el("button", { class: "mv", title: "Move down", disabled: qi === r.questions.length - 1 && ri === q.rounds.length - 1, onclick: () => moveQuestion(ri, qi, 1) }, "▼")));
    });
    if (!r.questions.length) list.append(el("li", { class: "muted small", style: "padding:10px 0" }, "No questions in this round yet."));
    return el("div", { class: "card" },
      el("div", { class: "row" }, el("div", { class: "grow" }, rt)),
      list,
      el("div", { class: "btnrow" },
        el("button", { class: "go", onclick: () => addQuestion(ri) }, "＋ Add a question"),
        q.rounds.length > 1 ? el("button", { class: "ghost small", onclick: () => {
          if (r.questions.length && !confirm(`Delete "${r.title || "this round"}" and its ${r.questions.length} question(s)?`)) return;
          for (const x of r.questions) dropMedia(x.media);
          q.rounds.splice(ri, 1); save(); quizView();
        } }, "Delete round") : null));
  });

  const n = countQuestions(q);
  const unfinished = q.rounds.flatMap((r) => r.questions).filter(problem).length;
  view(
    el("div", { class: "bar" }, el("button", { class: "back", onclick: () => go("") }, "‹ My quizzes")),
    el("div", { class: "stack" }, title, author),
    el("p", { class: "muted small" }, `${n} question${n === 1 ? "" : "s"}` + (unfinished ? ` · ⚠ ${unfinished} not finished yet` : " · all ready ✓")),
    ...rounds,
    el("button", { class: "ghost", style: "width:100%;margin-top:14px", onclick: () => { q.rounds.push(newRound(q.rounds.length + 1)); save(); quizView(); } }, "＋ Add another round"),
    el("div", { class: "btnrow", style: "margin-top:30px" },
      el("button", { class: "ghost", onclick: () => exportQuiz("download") }, "💾 Save quiz file"),
      navigator.canShare ? el("button", { class: "ghost", onclick: () => exportQuiz("share") }, "📤 Share quiz file") : null),
    el("button", { class: "danger", style: "width:100%;margin-top:30px", onclick: async () => {
      if (!confirm(`Delete "${q.title || "this quiz"}" from this device? This can't be undone.`)) return;
      await Media.delQuiz(q.id); await Quizzes.del(q.id); quiz = null; go("");
    } }, "Delete this quiz"),
  );
  setDock(tv.connected ? el("button", { class: "primary", onclick: () => exportQuiz("tv") }, "📺 Send to TV") : el("button", { class: "primary", onclick: () => exportQuiz("download") }, "💾 Save quiz file"));
}

function addQuestion(ri) {
  const r = quiz.rounds[ri];
  const last = r.questions[r.questions.length - 1];
  r.questions.push(newQuestion(last ? kindOf(last) : "choice", last));
  save();
  go(`quiz/${quiz.id}/q/${ri}/${r.questions.length - 1}`);
}

function moveQuestion(ri, qi, dir) {
  const rounds = quiz.rounds;
  const [x] = rounds[ri].questions.splice(qi, 1);
  if (dir < 0 && qi === 0) rounds[ri - 1].questions.push(x);
  else if (dir > 0 && qi === rounds[ri].questions.length) rounds[ri + 1].questions.unshift(x);
  else rounds[ri].questions.splice(qi + dir, 0, x);
  save();
  quizView();
}

async function exportQuiz(mode) {
  await flush();
  const unfinished = quiz.rounds.flatMap((r) => r.questions).filter(problem).length;
  if (unfinished && !confirm(`${unfinished} question${unfinished === 1 ? " isn't" : "s aren't"} finished yet and will be left out. Carry on?`)) return;
  toast("Getting your quiz ready...");
  const { blob, empty, name } = await buildQuizFile(quiz);
  if (empty) return toast("Add at least one finished question first.");
  if (mode === "download") return download(blob, name);
  if (mode === "share") {
    const file = new File([blob], name, { type: "application/octet-stream" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: quiz.title });
      else download(blob, name);
    } catch (e) { if (e.name !== "AbortError") download(blob, name); }
    return;
  }
  if (!tv.key) {
    const k = prompt("Type the quiz master code (it's the letters after k= in the quiz master address on the TV):");
    if (!k) return;
    tv.key = k.trim();
    store(KEY_STORE, tv.key);
  }
  try {
    const r = await fetch(`/api/upload?k=${encodeURIComponent(tv.key)}`, { method: "POST", body: blob, headers: { "Content-Type": "application/zip" } });
    const res = await r.json();
    if (r.status === 403) { tv.key = ""; store(KEY_STORE, null); }
    toast(res.ok ? "📺 Sent! It's ready on the TV." : res.error);
  } catch (_) { toast("Couldn't reach the TV - is it still on the same Wi-Fi?"); }
}

// --- One question

let trim = null; // music clip being chosen: {buffer, name, start, length}

function questionView(ri, qi) {
  const r = quiz.rounds[ri];
  const q = r && r.questions[qi];
  if (!q) return go(`quiz/${quiz.id}`);
  const kind = kindOf(q);
  // Only redraw if we're still on this question (slow jobs like video conversion finish later).
  const here = location.hash;
  const rerender = () => { save(); if (location.hash === here) questionView(ri, qi); };

  const seg = el("div", { class: "seg" }, ["choice", "tf", "closest"].map((k) =>
    el("button", { class: k === kind ? "on" : "", onclick: () => { setKind(q, k); rerender(); } }, TYPE_NAMES[k])));

  const text = el("textarea", { rows: 3, placeholder: kind === "tf" ? "e.g. Mince pies used to contain real meat." : kind === "closest" ? "e.g. How many sprouts did Grandad eat last Christmas?" : "e.g. Which reindeer has a red nose?" });
  text.value = q.text;
  text.oninput = () => { q.text = text.value; save(); };

  const parts = [
    el("div", { class: "bar" }, el("button", { class: "back", onclick: () => go(`quiz/${quiz.id}`) }, "‹ Back to quiz"),
      el("span", { class: "muted small", style: "margin-left:auto" }, `${r.title || `Round ${ri + 1}`} · Question ${qi + 1}`)),
    el("label", { class: "field" }, "What kind of question?"), seg,
    el("label", { class: "field" }, kind === "tf" ? "The statement" : "The question"), text,
    el("label", { class: "field" }, "Add a picture, music or video (optional)"), mediaSection(q, ri, qi, rerender),
    el("label", { class: "field" }, kind === "closest" ? "The right answer" : kind === "tf" ? "Is it true or false?" : "The answers (tap ✓ next to the right one)"),
    answerSection(q, kind, rerender),
    el("div", { class: "two" },
      el("div", {}, el("label", { class: "field" }, "Points"), selectFor(POINTS.map((p) => [p, p === 1 ? "1 point" : `${p} points`]), q.points, (v) => { q.points = v; save(); })),
      el("div", {}, el("label", { class: "field" }, "Time limit"), selectFor(TIMES, q.time, (v) => { q.time = v; save(); }))),
    el("p", { class: "small muted" }, "With no time limit, the quiz master decides when to reveal the answer."),
  ];
  const issue = problem(q);
  if (issue) parts.push(el("p", { class: "gold" }, "⚠ " + issue));
  parts.push(el("button", { class: "danger", style: "width:100%;margin-top:24px", onclick: () => {
    if (!confirm("Delete this question?")) return;
    dropMedia(q.media);
    r.questions.splice(qi, 1); save(); go(`quiz/${quiz.id}`);
  } }, "Delete this question"));

  const y = window.scrollY;
  view(...parts);
  window.scrollTo(0, y);
  setDock(
    el("button", { class: "ghost", onclick: () => go(`quiz/${quiz.id}`) }, "✓ Done"),
    el("button", { class: "primary", onclick: () => addQuestion(ri) }, "＋ Next question"),
  );
}

function selectFor(options, value, onChange) {
  const s = el("select", {}, options.map(([v, label]) => el("option", { value: v, selected: v === value }, label)));
  s.onchange = () => onChange(Number(s.value));
  return s;
}

function answerSection(q, kind, rerender) {
  if (kind === "closest") {
    const ans = el("input", { inputmode: "decimal", placeholder: "e.g. 42", value: q.answer ?? "" });
    ans.oninput = () => { q.answer = ans.value.trim().replace(",", ".") === "" ? null : ans.value.trim().replace(",", "."); save(); };
    const unit = el("input", { placeholder: "Unit (optional) e.g. cm, years, sprouts", value: q.unit || "", maxlength: 20 });
    unit.oninput = () => { q.unit = unit.value; save(); };
    return el("div", { class: "stack" }, ans, unit, el("p", { class: "small muted" }, "Everyone types a number. Whoever is closest wins the points (ties share them)."));
  }
  if (kind === "tf") {
    return el("div", { class: "tf" }, ["True", "False"].map((label, i) =>
      el("button", { class: q.answer === i ? "on" : "", onclick: () => { q.answer = i; rerender(); } }, (q.answer === i ? "✓ " : "") + label)));
  }
  const box = el("div", {});
  q.options.forEach((opt, i) => {
    const input = el("input", { value: opt, placeholder: `Answer ${LETTERS[i]}`, maxlength: 80 });
    input.oninput = () => { q.options[i] = input.value; save(); };
    box.append(el("div", { class: "optrow" },
      el("span", { class: `letter opt-${i}` }, LETTERS[i]),
      input,
      el("button", { class: "ok" + (q.answer === i ? " on" : ""), title: "This is the right answer", onclick: () => { q.answer = i; rerender(); } }, "✓"),
      q.options.length > 2 ? el("button", { class: "del", title: "Remove this answer", onclick: () => {
        q.options.splice(i, 1);
        if (q.answer === i) q.answer = null; else if (q.answer > i) q.answer--;
        rerender();
      } }, "✕") : null));
  });
  if (q.options.length < 6) box.append(el("button", { class: "ghost small", style: "margin-top:10px", onclick: () => { q.options.push(""); rerender(); } }, "＋ Add another answer"));
  return box;
}

// What's being added right now (only one at a time):
let panel = null; // choosing / searching: {q, kind, step: "choose"|"search", source, query, results, busy, error}
let vtrim = null; // video clip being chosen: {q, file, url, name, credit, duration, start, length}
let searchAudio = null;

function stopSearchAudio() {
  if (searchAudio) { searchAudio.pause(); searchAudio = null; }
}

function mediaSection(q, ri, qi, rerender) {
  if (trim && trim.q === q) return trimmer(q, rerender);
  if (vtrim && vtrim.q === q) return videoTrimmer(q, rerender);
  if (panel && panel.q === q) return mediaPanel(q, rerender);
  if (!q.media) {
    const open = (kind) => { panel = { q, kind, step: "choose", query: "" }; rerender(); };
    return el("div", { class: "mediabtns" },
      el("button", { class: "ghost", onclick: () => open("image") }, el("span", { class: "ic" }, "🖼"), "Picture"),
      el("button", { class: "ghost", onclick: () => open("audio") }, el("span", { class: "ic" }, "🎵"), "Music"),
      el("button", { class: "ghost", onclick: () => open("video") }, el("span", { class: "ic" }, "📺"), "Video"));
  }
  const box = el("div", { class: "card preview" }, el("p", { class: "muted small", style: "margin-top:0" }, "Loading..."));
  Media.get(quiz.id, q.media.file).then((blob) => {
    if (!blob) { box.replaceChildren(el("p", {}, "This file is missing."), removeBtn()); return; }
    const url = URL.createObjectURL(blob);
    const player = q.media.kind === "image" ? el("img", { src: url, alt: "" })
      : q.media.kind === "audio" ? el("audio", { src: url, controls: true })
      : el("video", { src: url, controls: true, playsinline: true });
    const size = blob.size < 1048576 ? `${Math.max(1, Math.round(blob.size / 1024))} KB` : `${(blob.size / 1048576).toFixed(1)} MB`;
    box.replaceChildren(player,
      el("p", { class: "small muted" }, `${q.media.name || q.media.file} · ${size}` + (q.media.kind === "image" ? "" : " · plays on the TV when the question appears")),
      q.media.credit ? el("p", { class: "small muted" }, "Credit: " + q.media.credit) : null,
      removeBtn());
  });
  function removeBtn() {
    return el("button", { class: "danger small", onclick: () => { dropMedia(q.media); q.media = null; rerender(); } }, "Remove");
  }
  return box;
}

function dropMedia(media) {
  if (!media) return;
  Media.del(quiz.id, media.file);
  if (media.web) Media.del(quiz.id, media.web);
}

async function setMedia(q, kind, blob, ext, name, extra = {}) {
  const file = `media/${uid(8)}.${ext}`;
  await Media.put(quiz.id, file, blob);
  dropMedia(q.media);
  q.media = { kind, file, name, ...extra };
  if (!q.media.credit) delete q.media.credit;
}

// --- Adding from this device

async function addPicture(q, rerender) {
  const file = await pickFile("image/*");
  if (!file) return;
  toast("Adding picture...");
  try { await setMedia(q, "image", await processImage(file), "jpg", file.name); rerender(); }
  catch (e) { toast(e.message || "That picture couldn't be used."); }
}

async function addMusic(q, rerender, file, extra = {}) {
  file = file || await pickFile("audio/*,video/*,.mp3,.m4a,.wav,.aac");
  if (!file) return;
  toast("Opening song...");
  try {
    const buffer = await decodeAudio(file);
    trim = { q, buffer, name: extra.name || (file.name || "Song").replace(/\.[^.]+$/, ""), start: 0,
      length: Math.min(15, Math.floor(buffer.duration)) || 1, credit: extra.credit, song: extra.song };
    rerender();
  } catch (e) { toast(e.message); }
}

async function addVideo(q, rerender, file, extra = {}) {
  file = file || await pickFile("video/*,.ogv,.mov,.mp4,.webm");
  if (!file) return;
  if (file.size > 500 * 1048576) return toast("That video is too big (over 500 MB). Try a shorter one.");
  vtrim = { q, file, url: URL.createObjectURL(file), name: extra.name || (file.name || "Video").replace(/\.[^.]+$/, ""),
    credit: extra.credit, duration: 0, start: 0, length: 10 };
  rerender();
}

// --- Choosing between this device and an online search

function mediaPanel(q, rerender) {
  const p = panel;
  const close = () => { stopSearchAudio(); panel = null; rerender(); };
  const heading = { image: "🖼 Add a picture", audio: "🎵 Add music", video: "📺 Add a video" }[p.kind];
  if (p.step === "choose") {
    const fromDevice = () => { panel = null; ({ image: addPicture, audio: addMusic, video: addVideo })[p.kind](q, rerender); rerender(); };
    return el("div", { class: "card stack" },
      el("div", { class: "bold" }, heading),
      el("div", { class: "two" },
        el("button", { class: "ghost", style: "min-height:84px", onclick: fromDevice }, "📁 From this device"),
        el("button", { class: "ghost", style: "min-height:84px", onclick: () => { p.step = "search"; p.source = SOURCES[p.kind][0].id; rerender(); } }, "🔎 Search online")),
      el("button", { class: "ghost small", onclick: close }, "Cancel"));
  }

  const sources = SOURCES[p.kind];
  const src = sources.find((s) => s.id === p.source) || sources[0];
  const input = el("input", { type: "search", value: p.query, enterkeyhint: "search",
    placeholder: { image: "e.g. reindeer, Big Ben, Elf film", audio: "e.g. Last Christmas, Mariah Carey", video: "e.g. snow, fireworks" }[p.kind] });
  const go = () => { p.query = input.value; runSearch(rerender); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  const parts = [el("div", { class: "bold" }, heading)];
  if (sources.length > 1) {
    parts.push(el("div", { class: "seg", style: `grid-template-columns: repeat(${sources.length}, 1fr)` }, sources.map((s) =>
      el("button", { class: s.id === src.id ? "on" : "", onclick: () => { stopSearchAudio(); p.source = s.id; p.results = null; p.error = ""; p.query = input.value; if (p.query.trim()) runSearch(rerender); else rerender(); } }, s.name))));
  }
  parts.push(el("div", { class: "row" }, el("div", { class: "grow" }, input), el("button", { class: "primary", onclick: go }, "Search")));
  if (p.busy) parts.push(el("div", { class: "center" }, el("div", { class: "spinner" }), el("p", { class: "muted small" }, p.busy === true ? "Searching..." : p.busy)));
  else if (p.error) parts.push(el("p", { class: "gold" }, p.error));
  else if (p.results) parts.push(p.results.length ? resultsView(q, p, rerender) : el("p", { class: "muted" }, "Nothing found - try different words."));
  parts.push(el("p", { class: "small muted" }, src.note));
  parts.push(el("button", { class: "ghost small", onclick: close }, "Cancel"));
  return el("div", { class: "card stack" }, ...parts);
}

async function runSearch(rerender) {
  const p = panel;
  if (!p || !p.query.trim()) return;
  stopSearchAudio();
  p.busy = true; p.error = ""; p.results = null;
  rerender();
  try {
    const src = SOURCES[p.kind].find((s) => s.id === p.source) || SOURCES[p.kind][0];
    if (src.needsProxy && !(await hasProxy())) throw new Error("Song search works on the Quizzy website, or when this page is opened from the TV app.");
    p.results = await src.search(p.query.trim());
  } catch (e) {
    p.error = (e && e.message && !/fetch|network/i.test(e.message)) ? e.message : "The search didn't work - check this device is online and try again.";
  }
  if (panel === p) { p.busy = false; rerender(); }
}

function resultsView(q, p, rerender) {
  const use = async (r) => {
    stopSearchAudio();
    if (r.size && r.size > 300 * 1048576) return toast("That one is too big to download - try another.");
    p.busy = p.kind === "video" ? "Downloading video..." : "Downloading...";
    rerender();
    try {
      const blob = await searchDownload(r.url);
      const ext = (r.url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i) || [, "bin"])[1];
      const file = new File([blob], `${r.title}.${ext}`, { type: blob.type });
      if (panel !== p) return;
      panel = null;
      if (p.kind === "image") {
        await setMedia(q, "image", await processImage(file), "jpg", r.title, { credit: r.credit });
        rerender();
      } else if (p.kind === "audio") {
        await addMusic(q, rerender, file, { name: r.title, credit: r.credit, song: r.song });
      } else {
        await addVideo(q, rerender, file, { name: r.title, credit: r.credit });
      }
    } catch (e) {
      if (panel === null) panel = p;
      p.busy = false;
      p.error = "Couldn't download that one - try another.";
      rerender();
    }
  };
  if (p.kind === "audio") {
    return el("div", { class: "songs" }, p.results.map((r) => {
      const play = el("button", { class: "ghost small", title: "Listen" }, "▶");
      play.onclick = () => {
        if (searchAudio && searchAudio.dataset.id === r.id) { stopSearchAudio(); play.textContent = "▶"; return; }
        stopSearchAudio();
        document.querySelectorAll(".songs .playing").forEach((b) => { b.textContent = "▶"; b.classList.remove("playing"); });
        searchAudio = new Audio(r.preview || r.url);
        searchAudio.dataset.id = r.id;
        searchAudio.play().catch(() => toast("Couldn't play that preview."));
        searchAudio.onended = () => { play.textContent = "▶"; };
        play.textContent = "■"; play.classList.add("playing");
      };
      return el("div", { class: "song" },
        r.thumb ? el("img", { src: r.thumb, alt: "", loading: "lazy" }) : el("div", { class: "noart" }, "🎵"),
        el("div", { class: "grow" }, el("div", { class: "bold" }, r.title), el("div", { class: "small muted" }, r.subtitle + (r.duration ? ` · ${formatTime(r.duration)}` : ""))),
        play,
        el("button", { class: "go small", onclick: () => use(r) }, "Use"));
    }));
  }
  return el("div", { class: "results" }, p.results.map((r) =>
    el("button", { title: r.title, onclick: () => use(r) },
      el("img", { src: r.thumb, alt: r.title, loading: "lazy", referrerpolicy: "no-referrer" }),
      p.kind === "video" ? el("span", { class: "tag" }, "▶") : null)));
}

// --- Choosing the bit of a song to play

function trimmer(q, rerender) {
  const dur = trim.buffer.duration;
  const lengths = [5, 10, 15, 20, 30, 45, 60].filter((l) => l <= Math.max(5, Math.ceil(dur)));
  const startLabel = el("span", { class: "bold" }, formatTime(trim.start));
  const slider = el("input", { type: "range", min: 0, max: Math.max(0, dur - 1), step: 0.5, value: trim.start });
  slider.oninput = () => { trim.start = Number(slider.value); startLabel.textContent = formatTime(trim.start); };
  const len = selectFor(lengths.map((l) => [l, `${l} seconds`]), lengths.includes(trim.length) ? trim.length : lengths[lengths.length - 1], (v) => { trim.length = v; });
  trim.length = Number(len.value);
  const play = el("button", { class: "ghost" }, "▶ Listen");
  let playing = false;
  play.onclick = () => {
    if (playing) { stopPreview(); playing = false; play.textContent = "▶ Listen"; return; }
    previewClip(trim.buffer, trim.start, Math.min(trim.length, MAX_CLIP_SECONDS), () => { playing = false; play.textContent = "▶ Listen"; });
    playing = true; play.textContent = "■ Stop";
  };
  const saveBtn = el("button", { class: "primary", onclick: async () => {
    stopPreview();
    saveBtn.disabled = true; saveBtn.textContent = "Saving...";
    try {
      const wav = await renderClip(trim.buffer, trim.start, trim.length);
      await setMedia(q, "audio", wav, "wav", `${trim.name} (${formatTime(trim.start)}, ${trim.length}s)`, { credit: trim.credit });
      if (trim.song) nameThatTune(q, trim.song);
      trim = null; rerender();
    } catch (e) { toast("Couldn't save that clip."); saveBtn.disabled = false; saveBtn.textContent = "Save this clip"; }
  } }, "Save this clip");
  return el("div", { class: "card stack" },
    el("div", { class: "bold" }, "🎵 Choose which bit to play"),
    el("div", { class: "small muted" }, `${trim.name} · ${formatTime(dur)} long`),
    el("div", {}, "Start at ", startLabel), slider,
    el("div", {}, "Play for"), len,
    el("div", { class: "btnrow" }, play, saveBtn,
      el("button", { class: "ghost small", onclick: () => { stopPreview(); trim = null; rerender(); } }, "Cancel")));
}

/** After picking a real song: fill in "Name that tune!" and put the title in as a right answer. */
function nameThatTune(q, song) {
  if (!q.text.trim()) q.text = "Name that tune!";
  if (q.type === "choice" && !q.tf && q.options.every((o) => !o.trim())) {
    const i = Math.floor(Math.random() * q.options.length);
    q.options[i] = song.title.slice(0, 80);
    q.answer = i;
    toast("Added the song title as the right answer - now fill in some wrong ones!");
  }
}

// --- Choosing the bit of a video to show (then converting it for the TV)

function videoTrimmer(q, rerender) {
  const t = vtrim;
  const lengths = [5, 10, 15, 20, 30, 45, 60];
  const video = el("video", { src: t.url, controls: true, playsinline: true, preload: "metadata" });
  const startLabel = el("span", { class: "bold" }, formatTime(t.start));
  const info = el("div", { class: "small muted" }, t.name + (t.duration ? ` · ${formatTime(t.duration)} long` : ""));
  const slider = el("input", { type: "range", min: 0, max: Math.max(1, (t.duration || 600) - 1), step: 0.5, value: t.start });
  video.addEventListener("loadedmetadata", () => {
    if (isFinite(video.duration) && video.duration > 0) {
      t.duration = video.duration;
      slider.max = Math.max(0, t.duration - 1);
      info.textContent = `${t.name} · ${formatTime(t.duration)} long`;
    }
  });
  video.addEventListener("error", () => { info.textContent = `${t.name} · can't be previewed here, but it can still be converted`; });
  slider.oninput = () => {
    t.start = Number(slider.value);
    startLabel.textContent = formatTime(t.start);
    try { video.currentTime = t.start; } catch (_) {}
  };
  video.addEventListener("timeupdate", () => { if (!video.paused && video.currentTime > t.start + t.length) video.pause(); });
  const len = selectFor(lengths.map((l) => [l, `${l} seconds`]), t.length, (v) => { t.length = v; });
  const watch = el("button", { class: "ghost", onclick: () => { try { video.currentTime = t.start; video.play(); } catch (_) {} } }, "▶ Watch this bit");
  const status = el("div", { class: "small muted" }, "The video is converted on this device so the TV can play it. The first time, this downloads a 32 MB converter.");
  const bar = el("div", { class: "progress hidden" }, el("div", {}));
  const convert = el("button", { class: "primary" }, "Convert & save");
  const sound = el("button", { class: "ghost small", onclick: () => { URL.revokeObjectURL(t.url); vtrim = null; addMusic(q, rerender, t.file, { name: t.name, credit: t.credit }); } }, "🎵 Use just the sound");
  const cancel = el("button", { class: "ghost small", onclick: () => { URL.revokeObjectURL(t.url); vtrim = null; rerender(); } }, "Cancel");
  convert.onclick = async () => {
    video.pause();
    for (const b of [convert, sound, cancel, watch]) b.disabled = true;
    convert.textContent = "Converting...";
    bar.classList.remove("hidden");
    try {
      const length = t.duration ? Math.max(1, Math.min(t.length, Math.ceil(t.duration - t.start))) : t.length;
      const { ogv, mp4 } = await convertToOgv(t.file, t.start, length,
        (f) => { bar.firstChild.style.width = `${Math.round(f * 100)}%`; status.textContent = `Converting... ${Math.round(f * 100)}%`; },
        (msg) => { status.textContent = msg; });
      await setMedia(q, "video", ogv, "ogv", `${t.name} (${formatTime(t.start)}, ${length}s)`, { credit: t.credit });
      if (mp4) {
        // A copy browsers can play, for the TV web page (AirPlay / casting).
        const web = q.media.file.replace(/\.ogv$/, ".mp4");
        await Media.put(quiz.id, web, mp4);
        q.media.web = web;
      }
      URL.revokeObjectURL(t.url);
      if (vtrim === t) vtrim = null;
      save();
      rerender();
    } catch (e) {
      status.textContent = e.message || "That video couldn't be converted.";
      for (const b of [convert, sound, cancel, watch]) b.disabled = false;
      convert.textContent = "Try again";
    }
  };
  return el("div", { class: "card stack vtrim" },
    el("div", { class: "bold" }, "📺 Choose which bit to show"),
    video, info,
    el("div", {}, "Start at ", startLabel), slider,
    el("div", {}, "Show for"), len,
    el("div", { class: "btnrow" }, watch, convert),
    bar, status,
    el("div", { class: "btnrow" }, sound, cancel));
}

// ---------------------------------------------------------------- start

(async () => {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
  await detectTv();
  try { await db(); }
  catch (_) { view(el("div", { class: "card" }, "This browser won't let Quizzy save quizzes. If you're in a private/incognito window, please open this page in a normal window.")); return; }
  route();
})();
