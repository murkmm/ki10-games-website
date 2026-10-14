// The quizzes written in the Quiz Writer, kept in this browser (IndexedDB), and turning them into
// .quizlo files. Shared by the Quiz Writer and the quiz master page (to send a quiz to the TV).
import { makeZip, readZip } from "./zip.js";

export const uid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
export function newRound(n) { return { title: `Round ${n}`, questions: [] }; }
export function kindOf(q) { return q.type === "closest" ? "closest" : q.tf ? "tf" : "choice"; }

// ---------------------------------------------------------------- storage

let dbPromise;
export function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open("quizlo-editor", 1);
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
export const Quizzes = {
  all: () => idb("quizzes", "readonly", (s) => s.getAll()),
  get: (id) => idb("quizzes", "readonly", (s) => s.get(id)),
  put: (q) => idb("quizzes", "readwrite", (s) => s.put(q)),
  del: (id) => idb("quizzes", "readwrite", (s) => s.delete(id)),
};
// Media is stored as {type, data: ArrayBuffer} which every browser handles reliably.
export const Media = {
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

/** What's still missing from a question, or "" if it's ready. */
export function problem(q) {
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

export function countQuestions(quiz) { return quiz.rounds.reduce((n, r) => n + r.questions.length, 0); }
export function slug(s) { return (s || "quiz").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "quiz"; }
// ---------------------------------------------------------------- quiz files

export async function buildQuizFile(q) {
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
  return { blob: await makeZip(files), skipped, empty: json.rounds.length === 0, name: slug(json.title) + ".quizlo" };
}

export async function importQuizFile(blob) {
  let entries;
  try { entries = await readZip(blob); } catch (_) { throw new Error("That isn't a Quizlo quiz file."); }
  const raw = entries.get("quiz.json");
  if (!raw) throw new Error("That isn't a Quizlo quiz file.");
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

