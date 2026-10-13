// Converts any video (iPhone .mov, .mp4, .webm...) into an .ogv clip the TV app can play,
// using ffmpeg compiled to WebAssembly. Everything happens on this device; nothing is uploaded.
import { FFmpeg } from "./vendor/ffmpeg/index.js";

const CORE_VERSION = "0.12.10";
const CORE_BASES = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];
export const MAX_VIDEO_SECONDS = 60;

let ffmpeg = null;
let loading = null;

async function downloadAsBlobUrl(url, type, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !onBytes) return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(got, total);
  }
  return URL.createObjectURL(new Blob(chunks, { type }));
}

/** Loads the converter (a one-off ~32 MB download, then cached by the browser). */
export function loadConverter(onStatus = () => {}) {
  if (ffmpeg) return Promise.resolve(ffmpeg);
  if (loading) return loading;
  loading = (async () => {
    let lastError;
    for (const base of CORE_BASES) {
      try {
        onStatus("Getting the video converter ready...");
        const coreURL = await downloadAsBlobUrl(`${base}/ffmpeg-core.js`, "text/javascript");
        const wasmURL = await downloadAsBlobUrl(`${base}/ffmpeg-core.wasm`, "application/wasm", (got, total) => {
          onStatus(total ? `Downloading the video converter... ${Math.round((got / total) * 100)}% (first time only)` : "Downloading the video converter (first time only)...");
        });
        const ff = new FFmpeg();
        await ff.load({ coreURL, wasmURL });
        ffmpeg = ff;
        return ff;
      } catch (e) {
        lastError = e;
      }
    }
    loading = null;
    throw new Error("Couldn't download the video converter. Check this device is online and try again." + (lastError ? ` (${lastError.message || lastError})` : ""));
  })();
  return loading;
}

/**
 * Cuts `length` seconds starting at `start` out of a video and converts it to Ogg Theora + Vorbis,
 * at most 854 pixels on its longest side (plenty for a TV, and quick to convert).
 * onProgress(fraction 0..1) is called as it goes. Returns a Blob (video/ogg).
 */
export async function convertToOgv(file, start, length, onProgress = () => {}, onStatus = () => {}) {
  const ff = await loadConverter(onStatus);
  onStatus("Converting video...");
  length = Math.max(1, Math.min(length, MAX_VIDEO_SECONDS));
  const ext = (file.name.match(/\.([a-z0-9]{1,5})$/i) || [, "mp4"])[1].toLowerCase();
  const input = `input.${ext}`;
  // Mounting avoids copying a big video into memory (important on iPhones); fall back to copying.
  let inputPath = input;
  let mounted = false;
  try {
    await ff.createDir("/in").catch(() => {});
    await ff.mount("WORKERFS", { files: [new File([file], input, { type: file.type })] }, "/in");
    inputPath = `/in/${input}`;
    mounted = true;
  } catch (_) {
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
  }
  const onProg = ({ time }) => {
    // time is in microseconds of output written so far.
    if (time > 0) onProgress(Math.min(1, time / 1e6 / length));
  };
  ff.on("progress", onProg);
  try {
    const code = await ff.exec([
      "-ss", String(start), "-t", String(length), "-i", inputPath,
      "-vf", "scale=w=854:h=854:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
      "-c:v", "libtheora", "-q:v", "7",
      "-c:a", "libvorbis", "-q:a", "4", "-ac", "2", "-ar", "44100",
      "-y", "out.ogv",
    ]);
    if (code !== 0) throw new Error("That video couldn't be converted.");
    const data = await ff.readFile("out.ogv");
    if (!data || data.length < 1000) throw new Error("That video couldn't be converted.");
    onProgress(1);
    return new Blob([data], { type: "video/ogg" });
  } finally {
    ff.off("progress", onProg);
    await ff.deleteFile("out.ogv").catch(() => {});
    if (mounted) await ff.unmount("/in").catch(() => {});
    else await ff.deleteFile(input).catch(() => {});
  }
}
