#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function decodeQuotedPrintable(input) {
  const noSoftBreaks = input.replace(/=\r?\n/g, '');
  return noSoftBreaks.replace(/=([0-9A-F]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function toIsoDate(dateText) {
  if (!dateText) return '';
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function extractFirst(regex, text) {
  const m = text.match(regex);
  return m ? m[1] : '';
}

function parseMhtmlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const html = decodeQuotedPrintable(raw);

  const ogTitle = decodeHtmlEntities(
    extractFirst(/<meta\s+property="og:title"\s+content="([^"]+)"/i, html)
  );
  const ogDescription = decodeHtmlEntities(
    extractFirst(/<meta\s+property="og:description"\s+content="([^"]+)"/i, html)
  );
  const ogImage = extractFirst(/<meta\s+property="og:image"\s+content="([^"]+)"/i, html);

  const releaseDateText = extractFirst(/Released\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i, ogDescription);
  const releaseDate = toIsoDate(releaseDateText);

  const upc = extractFirst(/id="js-album-upc"\s+class="info-value">\s*(\d+)\s*</i, html);
  const spotifyUrl = extractFirst(/(https:\/\/open\.spotify\.com\/(?:album|track)\/[^"]+)/i, html);

  const titleMatch = ogTitle.match(/^(.*?)\s+-\s+(.*)$/);
  const artist = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
  const releaseTitle = titleMatch ? decodeHtmlEntities(titleMatch[2]) : ogTitle;

  const trackRegex = /<div\s+class="track-cell\s+track-num"[^>]*>\s*(\d+)\s*<\/div>[\s\S]*?<div\s+class="track-cell\s+track-name">[\s\S]*?<span\s+title="([^"]+)">([\s\S]*?)<\/span>/gi;
  const tracks = [];
  let tm;
  while ((tm = trackRegex.exec(html)) !== null) {
    tracks.push({
      trackNumber: Number(tm[1]),
      title: decodeHtmlEntities(tm[3] || tm[2]),
    });
  }

  const isrcRegex = /<div\s+class="isrc-value">\s*([A-Z0-9]+)\s*<\/div>/gi;
  const isrcs = [];
  let im;
  while ((im = isrcRegex.exec(html)) !== null) {
    isrcs.push(im[1]);
  }

  tracks.forEach((t, i) => {
    t.isrc = isrcs[i] || '';
  });

  return {
    sourceFile: path.basename(filePath),
    artist,
    releaseTitle,
    releaseDateText,
    releaseDate,
    songCount: tracks.length,
    upc,
    spotifyUrl,
    artworkUrl: ogImage,
    tracks,
  };
}

function parseArgs(argv) {
  const args = { raw: '', out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--raw') args.raw = argv[i + 1] || '';
    if (a === '--out') args.out = argv[i + 1] || '';
  }
  return args;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(repoRoot, args.raw || 'www/raw');
  const outPath = path.resolve(repoRoot, args.out || 'scripts/output/catalog.json');

  if (!fs.existsSync(rawDir)) {
    throw new Error(`Raw directory not found: ${rawDir}`);
  }

  const files = fs
    .readdirSync(rawDir)
    .filter((f) => f.toLowerCase().endsWith('.mhtml'))
    .map((f) => path.join(rawDir, f))
    .sort((a, b) => a.localeCompare(b));

  const releases = files.map(parseMhtmlFile);
  const output = {
    generatedAt: new Date().toISOString(),
    sourceDir: path.relative(repoRoot, rawDir).replace(/\\/g, '/'),
    releaseCount: releases.length,
    releases,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Parsed ${releases.length} MHTML files.`);
  console.log(`Wrote catalog: ${path.relative(repoRoot, outPath).replace(/\\/g, '/')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

module.exports = {
  parseMhtmlFile,
  decodeQuotedPrintable,
};
