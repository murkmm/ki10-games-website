// Turns photos, songs and videos picked on a phone or laptop into files the TV app can use.

const MAX_IMAGE = 1920;
export const MAX_CLIP_SECONDS = 60;

/** Any photo (including iPhone HEIC in Safari) -> JPEG Blob no bigger than 1920px. */
export async function processImage(file) {
  let source;
  try {
    source = await createImageBitmap(file);
  } catch (_) {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That picture couldn't be opened."));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = source.width, h = source.height;
  const scale = Math.min(1, MAX_IMAGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("That picture couldn't be converted.");
  return blob;
}

let ctx;
function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

/** Song / video file -> decoded AudioBuffer (works for mp3, m4a, wav, and most videos' sound). */
export async function decodeAudio(file) {
  const bytes = await file.arrayBuffer();
  const ac = audioContext();
  return await new Promise((resolve, reject) => {
    const p = ac.decodeAudioData(bytes, resolve, () => reject(new Error("That file's sound couldn't be read.")));
    if (p && p.catch) p.catch(() => {});
  });
}

let previewSource;
/** Plays part of a decoded song so the quiz writer can hear the clip. */
export function previewClip(buffer, start, length, onEnd) {
  stopPreview();
  const ac = audioContext();
  if (ac.state === "suspended") ac.resume();
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(ac.destination);
  src.onended = () => { if (previewSource === src) { previewSource = null; onEnd && onEnd(); } };
  src.start(0, start, length);
  previewSource = src;
}

export function stopPreview() {
  if (previewSource) { try { previewSource.stop(); } catch (_) {} previewSource = null; }
}

/** Cuts a clip out of a song with gentle fades and returns it as a WAV Blob. */
export async function renderClip(buffer, start, length) {
  const rate = 44100;
  const channels = Math.min(2, buffer.numberOfChannels);
  length = Math.min(length, buffer.duration - start, MAX_CLIP_SECONDS);
  const frames = Math.max(1, Math.ceil(length * rate));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OfflineCtx(channels, frames, rate);
  const src = off.createBufferSource();
  src.buffer = buffer;
  const gain = off.createGain();
  const fadeIn = Math.min(0.05, length / 4), fadeOut = Math.min(0.8, length / 4);
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, fadeIn);
  gain.gain.setValueAtTime(1, Math.max(fadeIn, length - fadeOut));
  gain.gain.linearRampToValueAtTime(0, length);
  src.connect(gain);
  gain.connect(off.destination);
  src.start(0, start, length);
  const rendered = await new Promise((resolve, reject) => {
    off.oncomplete = (e) => resolve(e.renderedBuffer);
    const p = off.startRendering();
    if (p && p.then) p.then(resolve, reject);
  });
  return encodeWav(rendered);
}

export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const frames = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  data.setUint32(4, 36 + frames * channels * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, channels, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * channels * 2, true);
  data.setUint16(32, channels * 2, true);
  data.setUint16(34, 16, true);
  writeStr(36, "data");
  data.setUint32(40, frames * channels * 2, true);
  const chans = [];
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: "audio/wav" });
}

export function isTheora(file) {
  return /\.(ogv|ogg)$/i.test(file.name) || file.type === "video/ogg";
}

export function formatTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
