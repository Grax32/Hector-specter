#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const contentDir = path.resolve(__dirname, '..', 'www', 'content');
const albumsDir = path.join(contentDir, 'albums');
const singlesDir = path.join(contentDir, 'singles');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function missing(url) {
  return !url || url.trim() === '';
}

function formatRow(indent, label, releaseDate, spotifyUrl) {
  const dateStr = releaseDate || '(no date)';
  const spotifyStr = missing(spotifyUrl) ? '*** MISSING SPOTIFY URL ***' : spotifyUrl;
  console.log(`${indent}${label}`);
  console.log(`${indent}  Release : ${dateStr}`);
  console.log(`${indent}  Spotify : ${spotifyStr}`);
}

// ── Albums ────────────────────────────────────────────────────────────────────

console.log('='.repeat(60));
console.log('ALBUMS');
console.log('='.repeat(60));

const albumSlugs = fs.readdirSync(albumsDir).filter(d =>
  fs.statSync(path.join(albumsDir, d)).isDirectory()
);

for (const albumSlug of albumSlugs) {
  const albumPath = path.join(albumsDir, albumSlug);
  const album = readJson(path.join(albumPath, 'album.json'));

  if (!album) {
    console.log(`\n[${albumSlug}] — could not read album.json`);
    continue;
  }

  console.log('');
  formatRow('', `[Album] ${album.title}`, album.releaseDate, album.spotifyUrl);

  const songs = album.songs || [];
  for (const songSlug of songs) {
    const song = readJson(path.join(albumPath, songSlug, 'song.json'));
    if (!song) {
      console.log(`  [${songSlug}] — could not read song.json`);
      continue;
    }
    formatRow('  ', `[Track] ${song.title}`, song.releaseDate, song.spotifyUrl);
  }
}

// ── Singles ───────────────────────────────────────────────────────────────────

console.log('');
console.log('='.repeat(60));
console.log('SINGLES');
console.log('='.repeat(60));

const singleSlugs = fs.readdirSync(singlesDir).filter(d =>
  fs.statSync(path.join(singlesDir, d)).isDirectory()
);

for (const singleSlug of singleSlugs) {
  const song = readJson(path.join(singlesDir, singleSlug, 'song.json'));

  if (!song) {
    console.log(`\n[${singleSlug}] — could not read song.json`);
    continue;
  }

  console.log('');
  formatRow('', `[Single] ${song.title}`, song.releaseDate, song.spotifyUrl);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log('='.repeat(60));
console.log('SUMMARY — items missing a Spotify URL');
console.log('='.repeat(60));

let anyMissing = false;

for (const albumSlug of albumSlugs) {
  const albumPath = path.join(albumsDir, albumSlug);
  const album = readJson(path.join(albumPath, 'album.json'));
  if (!album) continue;

  if (missing(album.spotifyUrl)) {
    console.log(`  [Album]  ${album.title} (${album.releaseDate || 'no date'})`);
    anyMissing = true;
  }

  for (const songSlug of (album.songs || [])) {
    const song = readJson(path.join(albumPath, songSlug, 'song.json'));
    if (song && missing(song.spotifyUrl)) {
      console.log(`  [Track]  ${song.title} — ${album.title} (${song.releaseDate || 'no date'})`);
      anyMissing = true;
    }
  }
}

for (const singleSlug of singleSlugs) {
  const song = readJson(path.join(singlesDir, singleSlug, 'song.json'));
  if (song && missing(song.spotifyUrl)) {
    console.log(`  [Single] ${song.title} (${song.releaseDate || 'no date'})`);
    anyMissing = true;
  }
}

if (!anyMissing) {
  console.log('  (none — all items have Spotify URLs)');
}

console.log('');
