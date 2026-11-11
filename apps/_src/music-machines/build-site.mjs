// Builds the three machines into the apps folder given as the first argument: one index.html plus app.js each, React bundled in.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const outRoot = process.argv[2];
const css = readFileSync('src/style.css', 'utf8');
const nav = `
.sitenav { max-width: 560px; margin: 0 auto 28px; padding: 0 16px; display: flex; flex-wrap: wrap; gap: 6px 18px; font: 14px/1.4 system-ui, sans-serif; }
.sitenav a { color: #c9c9c4; padding: 8px 0; }
.sitenav a[aria-current] { color: #fff; font-weight: 600; text-decoration: none; }
html[class] .app { margin-bottom: 16px; }`;
const apps = [
  ['src/App.tsx', 'onset', 'Onset Rhythm Machine', 'A rhythm machine for walking through every 16th-note pattern, one sound at a time.', 'family=Barlow+Condensed:ital,wght@1,800&family=Barlow+Semi+Condensed:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=VT323'],
  ['src/ChordApp.tsx', 'cadence', 'Cadence Chord Machine', 'A chord machine for exploring key-relative progressions by rule.', 'family=Michroma&family=Share+Tech+Mono&family=Titillium+Web:wght@400;600'],
  ['src/ComboApp.tsx', 'pairing', 'Pairing Machine', 'Pairs rhythms from Onset with progressions from Cadence, favoring the ones with hearts.', 'family=IBM+Plex+Mono:wght@400;500&family=Saira+Condensed:wght@700&family=Saira+Semi+Condensed:wght@400;500;600;700&family=Saira+Stencil+One'],
];
for (const [entry, out, title, desc, fonts] of apps) {
  const res = await build({ entryPoints: [entry], bundle: true, minify: true, write: false, target: 'es2020', format: 'iife', jsx: 'transform', define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none' });
  const links = [['/apps/', 'All apps'], ...apps.map((a) => [`/apps/${a[1]}/`, a[1][0].toUpperCase() + a[1].slice(1)])]
    .map(([href, label]) => `<a href="${href}"${href === `/apps/${out}/` ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('\n  ');
  const html = `<!doctype html>
<html lang="en" class="m-${out}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Anthony Becker</title>
<meta name="description" content="${desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet">
<style>
${css}
${readFileSync(`src/themes/${out}.css`, 'utf8')}
${nav}
</style>
</head>
<body>
<div id="root"></div>
<nav class="sitenav" aria-label="Apps">
  ${links}
</nav>
<script src="app.js"></script>
</body>
</html>
`;
  mkdirSync(`${outRoot}/${out}`, { recursive: true });
  writeFileSync(`${outRoot}/${out}/index.html`, html);
  writeFileSync(`${outRoot}/${out}/app.js`, res.outputFiles[0].text);
  console.log(out, html.length, res.outputFiles[0].text.length);
}
