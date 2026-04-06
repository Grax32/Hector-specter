#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'release';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const args = { catalog: '', write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--catalog') args.catalog = argv[i + 1] || '';
    if (a === '--write') args.write = true;
  }
  return args;
}

function buildSong(track, release) {
  return {
    title: track.title,
    duration: '',
    releaseDate: release.releaseDate || '',
    artwork: '',
    audioFile: '',
    videoFile: '',
    description: '',
    spotifyUrl: release.songCount === 1 ? (release.spotifyUrl || '') : '',
    videoUrl: '',
    isrc: track.isrc || '',
    upc: release.upc || '',
  };
}

function formatPath(p) {
  return p.replace(/\\/g, '/');
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const wwwDir = path.join(repoRoot, 'www');
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = path.resolve(repoRoot, args.catalog || 'scripts/output/catalog.json');

  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Catalog not found: ${catalogPath}. Run scripts/mhtml-catalog.js first.`);
  }

  const catalog = readJson(catalogPath);
  const releases = Array.isArray(catalog.releases) ? catalog.releases : [];

  const albumPaths = [];
  const singlePaths = [];
  const plans = [];

  for (const release of releases) {
    const tracks = Array.isArray(release.tracks) ? release.tracks : [];
    const releaseSlug = slugify(release.releaseTitle);

    if (tracks.length > 1) {
      const albumRel = path.join('content', 'albums', releaseSlug);
      const albumAbs = path.join(wwwDir, albumRel);
      const songFolders = [];

      tracks
        .slice()
        .sort((a, b) => a.trackNumber - b.trackNumber)
        .forEach((track, idx) => {
          const num = String(idx + 1).padStart(2, '0');
          const trackSlug = slugify(track.title);
          const folder = `${num}-${trackSlug}`;
          songFolders.push(folder);

          const songAbs = path.join(albumAbs, folder, 'song.json');
          plans.push({
            type: 'write-json',
            path: songAbs,
            data: buildSong(track, release),
          });
        });

      plans.push({
        type: 'write-json',
        path: path.join(albumAbs, 'album.json'),
        data: {
          title: release.releaseTitle,
          year: (release.releaseDate || '').slice(0, 4) || '',
          releaseDate: release.releaseDate || '',
          description: '',
          artwork: 'artwork.svg',
          songs: songFolders,
        },
      });

      if (!fs.existsSync(path.join(albumAbs, 'artwork.svg'))) {
        plans.push({
          type: 'write-text',
          path: path.join(albumAbs, 'artwork.svg'),
          data: '<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><rect width="500" height="500" fill="#111827"/><text x="250" y="260" font-family="Arial, sans-serif" font-size="38" fill="#f9fafb" text-anchor="middle">' + release.releaseTitle.replace(/[<>&]/g, '') + '</text></svg>\n',
        });
      }

      albumPaths.push(formatPath(albumRel));
    } else if (tracks.length === 1) {
      const singleRel = path.join('content', 'singles', releaseSlug);
      const singleAbs = path.join(wwwDir, singleRel, 'song.json');
      plans.push({
        type: 'write-json',
        path: singleAbs,
        data: buildSong(tracks[0], release),
      });
      singlePaths.push(formatPath(singleRel));
    }
  }

  const latestAlbum = releases
    .filter((r) => (r.tracks || []).length > 1)
    .sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')))[0];
  const latestSingle = releases
    .filter((r) => (r.tracks || []).length === 1)
    .sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')))[0];

  const featured = latestAlbum
    ? { type: 'album', path: `content/albums/${slugify(latestAlbum.releaseTitle)}` }
    : latestSingle
      ? { type: 'song', path: `content/singles/${slugify(latestSingle.releaseTitle)}` }
      : { type: 'song', path: '' };

  const configPath = path.join(wwwDir, 'config.json');
  plans.push({
    type: 'write-json',
    path: configPath,
    data: {
      featured,
      albums: albumPaths,
      singles: singlePaths,
    },
  });

  if (!args.write) {
    console.log('Dry run complete. No files were changed.');
    console.log(`Planned writes: ${plans.length}`);
    console.log('Run with --write to apply changes.');
    return;
  }

  for (const plan of plans) {
    if (plan.type === 'write-json') writeJson(plan.path, plan.data);
    if (plan.type === 'write-text') {
      fs.mkdirSync(path.dirname(plan.path), { recursive: true });
      fs.writeFileSync(plan.path, plan.data, 'utf8');
    }
  }

  console.log(`Applied ${plans.length} writes.`);
  console.log(`Updated ${formatPath(path.relative(repoRoot, configPath))}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
