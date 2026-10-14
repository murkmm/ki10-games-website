// Online media search for the Quiz Writer: pictures, music and video that can be pulled
// straight into a question.
//
// Requests go straight from the browser where the site allows it. Many media sites don't let web
// pages download their files directly (CORS), so those go through a small proxy at
// /api/quizlo-proxy, provided by the Quizlo TV app, and on the website by a Cloudflare Pages
// Function (see tools/web-host/).

const PROXY = "/api/quizlo-proxy";
let proxyOk = null;

export async function hasProxy() {
  if (proxyOk !== null) return proxyOk;
  try {
    const r = await fetch(`${PROXY}?ping=1`, { cache: "no-store" });
    proxyOk = r.ok && (await r.json()).ok === true;
  } catch (_) {
    proxyOk = false;
  }
  return proxyOk;
}

const TOO_MANY = "Too many searches - wait a minute and try again.";
const NO_REACH = "Couldn't get results from that site right now. Try again in a moment, or try another source.";

async function viaProxy(url, as) {
  if (!(await hasProxy())) throw new Error(NO_REACH);
  const r = await fetch(`${PROXY}?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(r.status === 429 ? TOO_MANY : NO_REACH);
  return as === "json" ? r.json() : r.blob();
}

/** Asks the site directly first (many allow it), and only uses the proxy if that's blocked. */
async function get(url, as = "json") {
  try {
    const r = await fetch(url, { mode: "cors", credentials: "omit" });
    if (r.ok) return as === "json" ? await r.json() : await r.blob();
    if (r.status === 429) throw new Error(TOO_MANY);
  } catch (e) {
    if (e.message === TOO_MANY) throw e;
  }
  return viaProxy(url, as);
}

/** JSONP: the browser loads the results as a script, which needs no proxy (used for Apple). */
let jsonpCount = 0;
function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const name = `quizloJsonp${Date.now()}_${jsonpCount++}`;
    const script = document.createElement("script");
    const finish = (fn, value) => { clearTimeout(timer); delete window[name]; script.remove(); fn(value); };
    const timer = setTimeout(() => finish(reject, new Error("timed out")), timeoutMs);
    window[name] = (data) => finish(resolve, data);
    script.onerror = () => finish(reject, new Error("couldn't load"));
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${name}`;
    document.head.append(script);
  });
}

/** Downloads a search result's file (directly if the site allows it, otherwise via the proxy). */
export function download(url) {
  return get(url, "blob");
}

const stripHtml = (s) => (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const enc = encodeURIComponent;

// --- Openverse: openly licensed images and audio (https://openverse.org) -----------------------

function openverseCredit(r) {
  const lic = r.license ? `CC ${String(r.license).toUpperCase()} ${r.license_version || ""}`.trim() : "";
  return [r.title, r.creator ? `by ${r.creator}` : "", lic].filter(Boolean).join(" · ");
}

async function openverseImages(q) {
  const data = await get(`https://api.openverse.org/v1/images/?q=${enc(q)}&page_size=24&mature=false`);
  return (data.results || []).map((r) => ({
    id: r.id, title: r.title || "Untitled", subtitle: r.creator || "",
    thumb: r.thumbnail || r.url, url: r.url, credit: openverseCredit(r),
  }));
}

async function openverseAudio(q) {
  const data = await get(`https://api.openverse.org/v1/audio/?q=${enc(q)}&page_size=20&mature=false`);
  return (data.results || []).filter((r) => r.url).map((r) => ({
    id: r.id, title: r.title || "Untitled", subtitle: r.creator || "",
    thumb: r.thumbnail || "", url: r.url, preview: r.url,
    duration: r.duration ? r.duration / 1000 : 0, credit: openverseCredit(r),
  }));
}

// --- Wikimedia Commons: photos, sounds and videos (https://commons.wikimedia.org) --------------

async function commons(q, filetype) {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=24" +
    `&gsrsearch=${enc(`${q} filetype:${filetype}`)}` +
    "&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=400" +
    "&iiextmetadatafilter=Artist|LicenseShortName|ObjectName";
  const data = await get(url);
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages.map((p) => {
    const info = (p.imageinfo || [])[0] || {};
    const meta = info.extmetadata || {};
    const title = stripHtml(meta.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
    const artist = stripHtml(meta.Artist?.value);
    let full = info.url;
    // Very large originals: use a 1920px version instead.
    if (filetype === "bitmap" && info.thumburl && (info.size > 8e6 || !/jpe?g|png|webp/.test(info.mime || ""))) {
      full = info.thumburl.replace(/\/\d+px-/, "/1920px-");
    }
    return {
      id: String(p.pageid), title, subtitle: artist, thumb: info.thumburl || info.url, url: full,
      preview: info.url, mime: info.mime, size: info.size,
      credit: [title, artist ? `by ${artist}` : "", stripHtml(meta.LicenseShortName?.value), "Wikimedia Commons"].filter(Boolean).join(" · "),
    };
  }).filter((r) => r.url);
}

// --- Apple Music previews: 30-second clips of real songs (great for "Name that tune") ---------

async function itunesSongs(q) {
  const url = `https://itunes.apple.com/search?term=${enc(q)}&media=music&entity=song&limit=25&country=GB`;
  let data;
  try {
    data = await jsonp(url);
  } catch (_) {
    data = await get(url);
  }
  return (data.results || []).filter((r) => r.previewUrl).map((r) => ({
    id: String(r.trackId), title: r.trackName, subtitle: `${r.artistName}${r.collectionName ? ` · ${r.collectionName}` : ""}`,
    thumb: (r.artworkUrl100 || "").replace("100x100", "200x200"), url: r.previewUrl, preview: r.previewUrl,
    duration: 30, song: { title: r.trackName, artist: r.artistName },
    credit: `${r.trackName} by ${r.artistName} · preview via Apple Music`,
  }));
}

export const SOURCES = {
  image: [
    { id: "openverse", name: "Free photos", search: openverseImages, note: "Openly licensed pictures from Openverse." },
    { id: "commons", name: "Wikimedia", search: (q) => commons(q, "bitmap"), note: "Pictures from Wikimedia Commons." },
  ],
  audio: [
    { id: "itunes", name: "Real songs", search: itunesSongs, note: "30-second previews of real songs from Apple Music. For family fun, not for selling or sharing publicly." },
    { id: "openverse", name: "Free music & sounds", search: openverseAudio, note: "Openly licensed music and sound effects from Openverse." },
    { id: "commons", name: "Wikimedia", search: (q) => commons(q, "audio"), note: "Sounds and music from Wikimedia Commons." },
  ],
  video: [
    { id: "commons", name: "Wikimedia videos", search: (q) => commons(q, "video"), note: "Videos from Wikimedia Commons." },
  ],
};
