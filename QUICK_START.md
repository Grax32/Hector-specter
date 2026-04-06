# Quick Start Guide

## Viewing the Website

1. **Option 1: Direct File Access** (may have CORS issues)
   - Simply open `index.html` in a web browser

2. **Option 2: Using Python** (recommended)
   ```bash
   python3 -m http.server 8000
   ```
   Then visit: http://localhost:8000

3. **Option 3: Using Node.js**
   ```bash
   npx http-server
   ```
   Then visit the URL shown in the terminal

## Updating Featured Content

Edit `config.json`:

```json
{
  "featured": {
    "type": "song",
    "path": "content/singles/this-house-is-haunted"
  },
  "albums": [],
  "singles": [
    "content/singles/this-house-is-haunted",
    "content/singles/lean-and-flow"
  ]
}
```

## Adding a New Album

1. Create folder: `content/albums/your-album-name/`
2. Add `album.json`:
   ```json
   {
     "title": "Your Album Title",
     "year": "2026",
     "releaseDate": "2026-01-15",
     "description": "Album description",
     "artwork": "artwork.jpg",
     "songs": ["01-song-name", "02-song-name"]
   }
   ```
3. Add album artwork as `artwork.jpg`
4. Create song folders and add their content
5. Update `config.json` to include the new album

## Adding a New Song

1. Create folder: `content/albums/album-name/01-song-name/`
2. Add `song.json`:
   ```json
   {
     "title": "Song Title",
     "duration": "4:23",
     "releaseDate": "2026-01-15",
     "artwork": "artwork.jpg",
     "audioFile": "song.mp3",
     "description": "Song description"
   }
   ```
3. Add song artwork as `artwork.jpg`
4. Add audio file (e.g., `song.mp3`)
5. Update parent `album.json` to include the song folder name

## File Requirements

- **Album artwork**: JPG/PNG/SVG, recommended 500x500px or larger
- **Song artwork**: JPG/PNG/SVG, recommended 500x500px or larger
- **Audio files**: MP3 or any web-compatible format

## Customization

- **Colors**: Edit `styles.css` (look for color values like `#e94560`)
- **Layout**: Edit `styles.css` grid properties
- **Functionality**: Edit `app.js` to modify behavior
- **Content order**: Latest Songs are automatically sorted by `releaseDate` (newest first)

## Tips

- Use consistent naming for folders (e.g., `01-song-name`, `02-song-name`)
- Keep descriptions concise and engaging
- Ensure all artwork is the same aspect ratio for best results
- Test locally before deploying


## Adding a Standalone Single (Optional)

1. Create folder: `content/singles/your-single-name/`
2. Add `song.json` (same fields as album songs)
3. Add artwork and audio files
4. Add the folder path to `config.json` under `singles`

