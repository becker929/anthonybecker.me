const PLAYER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Latest Render</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: #111;
      color: #eee;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2rem;
    }
    h1 { font-size: 0.8rem; color: #555; text-transform: uppercase; letter-spacing: 0.1em; }
    #filename { font-size: 0.8rem; color: #444; font-family: monospace; min-height: 1.2em; }
    audio { width: min(500px, 100%); }
    #status { font-size: 0.7rem; color: #333; min-height: 1em; }
  </style>
</head>
<body>
  <h1>Latest Render</h1>
  <div id="filename">—</div>
  <audio id="player" controls></audio>
  <div id="status"></div>
  <script>
    const player = document.getElementById('player');
    const filenameEl = document.getElementById('filename');
    const statusEl = document.getElementById('status');
    let current = null;

    async function poll() {
      try {
        const res = await fetch('/audio/latest');
        if (!res.ok) return;
        const { key } = await res.json();
        if (key === current) return;
        current = key;
        player.src = '/audio/' + key;
        filenameEl.textContent = key;
        statusEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
        player.load();
        player.play().catch(() => {});
      } catch (_) {}
    }

    poll();
    setInterval(poll, 5000);
  </script>
</body>
</html>`;

function parseRange(header) {
  const m = header.match(/^bytes=(\d+)-(\d*)$/);
  if (!m) return undefined;
  const offset = Number(m[1]);
  const end = m[2] ? Number(m[2]) : undefined;
  return end !== undefined ? { offset, length: end - offset + 1 } : { offset };
}

export function handleAudioPage() {
  return new Response(PLAYER_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function handleAudioLatest(env) {
  const key = await env.AUDIO_KV.get("audio:latest");
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify({ key }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleAudioFile(request, env, filename) {
  const rangeHeader = request.headers.get("Range");
  const rangeOpt = rangeHeader ? parseRange(rangeHeader) : undefined;
  const object = await env.AUDIO_BUCKET.get(
    "audio/" + filename,
    rangeOpt ? { range: rangeOpt } : {},
  );
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");

  return new Response(object.body, {
    status: object.range ? 206 : 200,
    headers,
  });
}
