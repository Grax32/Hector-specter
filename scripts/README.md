# Scripts

Node scripts to parse DistroKid MHTML exports in `www/raw` and prepare/update site content.

## 1) Build catalog from MHTML

```bash
node scripts/mhtml-catalog.js
```

Optional flags:

- `--raw <path>`: source directory (default: `www/raw`)
- `--out <path>`: output JSON file (default: `scripts/output/catalog.json`)

Example:

```bash
node scripts/mhtml-catalog.js --raw www/raw --out scripts/output/catalog.json
```

## 2) Sync content from catalog

Dry run (no changes):

```bash
node scripts/sync-content-from-catalog.js
```

Apply writes:

```bash
node scripts/sync-content-from-catalog.js --write
```

Optional flags:

- `--catalog <path>`: catalog JSON file (default: `scripts/output/catalog.json`)

## Behavior

- Multi-track releases are written as albums in `www/content/albums/<release-slug>/`.
- One-track releases are written as singles in `www/content/singles/<release-slug>/`.
- `www/config.json` is regenerated from parsed releases.
- Lyrics are not used or generated.
