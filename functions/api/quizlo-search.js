// Cloudflare Pages Function: GET /api/quizlo-search?source=<pexels|pexels-photos|giphy>&q=<words>
//
// Searches that need an API key, so the key stays on the server. Each source only switches on once
// its key is added in Cloudflare (Pages project -> Settings -> Variables and Secrets):
//   PEXELS_API_KEY  free from https://www.pexels.com/api/  (stock videos and photos)
//   GIPHY_API_KEY   free from https://developers.giphy.com/  (short film & TV clips)
// GET /api/quizlo-search?sources=1 lists the sources that are switched on.

function sources(env) {
  const list = [];
  if (env.PEXELS_API_KEY) list.push('pexels', 'pexels-photos');
  if (env.GIPHY_API_KEY) list.push('giphy');
  return list;
}

function slugTitle(url) {
  const m = String(url || '').match(/\/(?:video|photo)\/([a-z0-9-]+?)-\d+\/?$/i);
  return m ? m[1].replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '';
}

async function pexelsVideos(q, key) {
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=24&size=small`, {
    headers: { Authorization: key },
  });
  if (!r.ok) throw new Error(`Pexels answered ${r.status}`);
  const data = await r.json();
  return (data.videos || [])
    .map((v) => {
      // The smallest mp4 that still looks fine on a TV.
      const files = (v.video_files || [])
        .filter((f) => f.file_type === 'video/mp4' && f.width)
        .sort((a, b) => a.width - b.width);
      const file = files.find((f) => Math.min(f.width, f.height) >= 480) || files[files.length - 1];
      if (!file) return null;
      const title = slugTitle(v.url) || 'Pexels video';
      return {
        id: String(v.id),
        title,
        subtitle: v.user?.name || '',
        thumb: v.image,
        url: file.link,
        preview: file.link,
        duration: v.duration || 0,
        credit: `${title} · video by ${v.user?.name || 'unknown'} on Pexels`,
      };
    })
    .filter(Boolean);
}

async function pexelsPhotos(q, key) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=24`, {
    headers: { Authorization: key },
  });
  if (!r.ok) throw new Error(`Pexels answered ${r.status}`);
  const data = await r.json();
  return (data.photos || []).map((p) => ({
    id: String(p.id),
    title: p.alt || slugTitle(p.url) || 'Pexels photo',
    subtitle: p.photographer || '',
    thumb: p.src?.medium,
    url: p.src?.large2x || p.src?.large || p.src?.original,
    credit: `Photo by ${p.photographer || 'unknown'} on Pexels`,
  }));
}

async function giphyClips(q, key) {
  const r = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=24&rating=pg`
  );
  if (!r.ok) throw new Error(`GIPHY answered ${r.status}`);
  const data = await r.json();
  return (data.data || [])
    .map((g) => {
      const mp4 = g.images?.original?.mp4 || g.images?.fixed_height?.mp4;
      if (!mp4) return null;
      return {
        id: g.id,
        title: g.title || 'GIPHY clip',
        subtitle: g.username || '',
        thumb: g.images?.fixed_height_still?.url || g.images?.original_still?.url,
        url: mp4,
        preview: g.images?.fixed_height?.mp4 || mp4,
        size: Number(g.images?.original?.mp4_size || 0),
        credit: `${g.title || 'Clip'} · via GIPHY`,
      };
    })
    .filter(Boolean);
}

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  if (params.has('sources')) return Response.json({ sources: sources(env) });
  const source = params.get('source') || '';
  const q = (params.get('q') || '').trim().slice(0, 100);
  if (!q) return Response.json({ results: [] });
  try {
    let results;
    if (source === 'pexels' && env.PEXELS_API_KEY) results = await pexelsVideos(q, env.PEXELS_API_KEY);
    else if (source === 'pexels-photos' && env.PEXELS_API_KEY) results = await pexelsPhotos(q, env.PEXELS_API_KEY);
    else if (source === 'giphy' && env.GIPHY_API_KEY) results = await giphyClips(q, env.GIPHY_API_KEY);
    else return Response.json({ error: "That search isn't switched on." }, { status: 404 });
    return Response.json({ results }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
