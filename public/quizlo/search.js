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
    try {
      data = await get(url);
    } catch (e) {
      throw new Error("Apple Music isn't answering just now - try the Real songs tab.");
    }
  }
  return (data.results || []).filter((r) => r.previewUrl).map((r) => ({
    id: String(r.trackId), title: r.trackName, subtitle: `${r.artistName}${r.collectionName ? ` · ${r.collectionName}` : ""}`,
    thumb: (r.artworkUrl100 || "").replace("100x100", "200x200"), url: r.previewUrl, preview: r.previewUrl,
    duration: 30, song: { title: r.trackName, artist: r.artistName },
    credit: `${r.trackName} by ${r.artistName} · preview via Apple Music`,
  }));
}

// --- Wikimedia Commons videos: uses the smaller ready-made versions Commons keeps ----------------

async function commonsVideos(q) {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=30" +
    `&gsrsearch=${enc(`${q} filetype:video`)}` +
    "&prop=videoinfo&viprop=url|mime|size|extmetadata|derivatives&viurlwidth=400" +
    "&viextmetadatafilter=Artist|LicenseShortName|ObjectName";
  const data = await get(url);
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages.map((p) => {
    const info = (p.videoinfo || [])[0] || {};
    const meta = info.extmetadata || {};
    const title = stripHtml(meta.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
    const artist = stripHtml(meta.Artist?.value);
    // Prefer a ~480p version (much smaller and quicker than the original).
    const derivs = (info.derivatives || []).filter((d) => d.src && d.height && d.height <= 720)
      .sort((a, b) => Math.abs(a.height - 480) - Math.abs(b.height - 480));
    const pick = derivs.find((d) => /mp4/.test(d.type || "")) || derivs[0];
    const url = pick ? pick.src : info.url;
    const size = pick && pick.bandwidth && info.duration ? (pick.bandwidth / 8) * info.duration : info.size;
    return {
      id: String(p.pageid), title, subtitle: artist, thumb: info.thumburl, url, preview: url,
      size, duration: info.duration || 0,
      credit: [title, artist ? `by ${artist}` : "", stripHtml(meta.LicenseShortName?.value), "Wikimedia Commons"].filter(Boolean).join(" · "),
    };
  }).filter((r) => r.url && r.thumb);
}

// --- Internet Archive: trailers, old films, cartoons and more (https://archive.org) ------------

const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

async function archiveVideos(q) {
  const query = `(${q}) AND mediatype:(movies) AND -collection:(tvnews) AND -access-restricted-item:(true)`;
  const url = `https://archive.org/advancedsearch.php?q=${enc(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year` +
    "&rows=30&sort[]=downloads+desc&output=json";
  const data = await get(url);
  return (data.response?.docs || []).map((d) => {
    const title = Array.isArray(d.title) ? d.title[0] : d.title || d.identifier;
    const creator = Array.isArray(d.creator) ? d.creator[0] : d.creator;
    return {
      id: d.identifier, title, subtitle: [creator, d.year].filter(Boolean).join(" · "),
      thumb: `https://archive.org/services/img/${enc(d.identifier)}`,
      credit: `${title}${creator ? ` by ${creator}` : ""} · Internet Archive`,
      // The actual file is only looked up when this result is picked.
      resolve: () => archiveFile(d.identifier),
    };
  });
}

async function archiveFile(id) {
  const meta = await get(`https://archive.org/metadata/${enc(id)}`);
  const files = (meta.files || [])
    .filter((f) => /\.(mp4|m4v|ogv|webm|mpeg4)$/i.test(f.name) && Number(f.size) > 100000 && Number(f.size) <= MAX_VIDEO_BYTES)
    .sort((a, b) => (/\.mp4$/i.test(b.name) - /\.mp4$/i.test(a.name)) || Number(a.size) - Number(b.size));
  if (!files.length) throw new Error("That video is too big to download on a phone - try another one.");
  const f = files[0];
  const url = `https://archive.org/download/${enc(id)}/${f.name.split("/").map(enc).join("/")}`;
  return { url, preview: url, size: Number(f.size), duration: Number(f.length) || 0 };
}

// --- Sources that need an API key, run by the website (see tools/web-host/functions) -----------

const SITE_SEARCH = "/api/quizlo-search";
let siteSources = null;

async function availableSiteSources() {
  if (siteSources) return siteSources;
  try {
    const r = await fetch(`${SITE_SEARCH}?sources=1`, { cache: "no-store" });
    siteSources = r.ok ? (await r.json()).sources || [] : [];
  } catch (_) {
    siteSources = [];
  }
  return siteSources;
}

function siteSearch(source) {
  return async (q) => {
    const r = await fetch(`${SITE_SEARCH}?source=${enc(source)}&q=${enc(q)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 429 ? TOO_MANY : NO_REACH);
    return data.results || [];
  };
}

// --- Deezer previews: 30-second clips of real songs, searched straight from this device -------

async function deezerSongs(q) {
  const url = `https://api.deezer.com/search?q=${enc(q)}&limit=25&output=jsonp`;
  let data;
  try {
    data = await jsonp(url);
  } catch (_) {
    data = await get(`https://api.deezer.com/search?q=${enc(q)}&limit=25`);
  }
  if (data?.error) throw new Error(data.error.code === 4 ? TOO_MANY : "Deezer couldn't search just now - try the Apple Music tab.");
  return (data.data || []).filter((r) => r.preview).map((r) => ({
    id: String(r.id), title: r.title, subtitle: `${r.artist?.name || ""}${r.album?.title ? ` · ${r.album.title}` : ""}`,
    thumb: r.album?.cover_medium || r.album?.cover || "", url: r.preview, preview: r.preview,
    duration: 30, song: { title: r.title_short || r.title, artist: r.artist?.name || "" },
    credit: `${r.title} by ${r.artist?.name || "unknown"} · preview via Deezer`,
  }));
}

export const SOURCES = {
  image: [
    { id: "openverse", name: "Free photos", search: openverseImages, note: "Openly licensed pictures from Openverse." },
    { id: "pixabay-photos", name: "Pixabay", site: true, search: siteSearch("pixabay-photos"), note: "Free stock photos from Pixabay." },
    { id: "pexels-photos", name: "Pexels", site: true, search: siteSearch("pexels-photos"), note: "Free stock photos from Pexels." },
    { id: "commons", name: "Wikimedia", search: (q) => commons(q, "bitmap"), note: "Pictures from Wikimedia Commons." },
  ],
  audio: [
    { id: "deezer", name: "Real songs", search: deezerSongs, note: "30-second previews of real songs from Deezer. For family fun, not for selling or sharing publicly." },
    { id: "itunes", name: "Apple Music", search: itunesSongs, note: "30-second previews of real songs from Apple Music. For family fun, not for selling or sharing publicly." },
    { id: "openverse", name: "Free music & sounds", search: openverseAudio, note: "Openly licensed music and sound effects from Openverse." },
    { id: "commons", name: "Wikimedia", search: (q) => commons(q, "audio"), note: "Sounds and music from Wikimedia Commons." },
  ],
  video: [
    { id: "giphy", name: "Film & TV clips", site: true, search: siteSearch("giphy"), note: "Short clips from films and TV via GIPHY - great for \"name the film\". For family fun, not for selling or sharing publicly." },
    { id: "pixabay", name: "Stock videos", site: true, search: siteSearch("pixabay"), note: "Free stock videos from Pixabay: snow, fireworks, Santa, animals and more." },
    { id: "pexels", name: "Pexels videos", site: true, search: siteSearch("pexels"), note: "Free stock videos from Pexels." },
    { id: "archive", name: "Internet Archive", search: archiveVideos, note: "Old films, cartoons, adverts and trailers from the Internet Archive. Only videos small enough for a phone are used." },
    { id: "commons", name: "Wikimedia", search: commonsVideos, note: "Videos from Wikimedia Commons." },
  ],
};

/** The sources for a kind of media that work here (key-based ones only when the website has keys). */
export async function sourcesFor(kind) {
  const site = await availableSiteSources();
  return SOURCES[kind].filter((s) => !s.site || site.includes(s.id));
}
