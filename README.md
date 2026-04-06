# Hector Specter - Musician & Producer Website

A self-contained, configurable website for showcasing music albums and songs. This website is designed for Hector Specter, a musician and music producer, and allows easy updates by simply modifying JSON configuration files.

## Features

- **Configurable Featured Content**: Highlight the latest song or album by updating `config.json`
- **Self-Contained Album Structure**: Each album has its own folder containing:
  - Album metadata (album.json)
  - Album artwork
  - Song subfolders with individual song data
- **Song Organization**: Each song folder contains:
  - Song metadata (song.json)
  - Song artwork
  - Audio file (MP3 or other formats)
- **Responsive Design**: Mobile-friendly layout that works on all devices
- **Modern UI**: Clean, professional design with smooth animations

## Project Structure

```
Hector-specter/
├── index.html              # Main HTML page
├── styles.css              # CSS styles
├── app.js                  # JavaScript application logic
├── config.json             # Main configuration file
└── content/
    └── albums/
        └── [album-name]/
            ├── album.json          # Album metadata
            ├── artwork.jpg         # Album cover art
            └── [song-folders]/
                ├── song.json       # Song metadata
                ├── artwork.jpg     # Song artwork
                └── [audio-file]    # Audio file (e.g., .mp3)
```

## Configuration

### Main Configuration (config.json)

The main configuration file controls which content is featured and which albums are displayed:

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


### Standalone Singles (Optional)

You can also publish songs that are not part of an album by adding a `singles` array in `config.json`:

```json
{
  "singles": [
    "content/singles/night-drive",
    "content/singles/city-lights"
  ]
}
```

Each entry must point to a folder that contains a `song.json` file plus the related artwork/audio files (same structure as an album song folder).

### Album Configuration (album.json)

Each album folder contains an `album.json` file:

```json
{
  "title": "Album Title",
  "year": "2026",
  "releaseDate": "2026-01-15",
  "description": "Album description",
  "artwork": "artwork.jpg",
  "songs": [
    "01-song-folder",
    "02-song-folder"
  ]
}
```

### Song Configuration (song.json)

Each song folder contains a `song.json` file:

```json
{
  "title": "Song Title",
  "duration": "4:23",
  "releaseDate": "2026-01-15",
  "artwork": "artwork.jpg",
  "audioFile": "song-name.mp3",
  "description": "Song description"
}
```

## How to Use

### Viewing the Website

1. Open `index.html` in a web browser
2. For best results, use a local web server:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (with http-server)
   npx http-server
   ```
3. Navigate to `http://localhost:8000` in your browser

### Adding a New Album

1. Create a new folder under `content/albums/` (e.g., `content/albums/new-album`)
2. Add an `album.json` file with the album metadata
3. Add the album artwork as `artwork.jpg`
4. Create subfolders for each song (e.g., `01-song-name`, `02-song-name`)
5. In each song folder, add:
   - `song.json` with song metadata
   - `artwork.jpg` for song artwork
   - Audio file (e.g., `song-name.mp3`)
6. Update `content/albums/new-album/album.json` to list all song folders
7. Add the album path to `config.json` in the `albums` array

### Changing the Featured Content

Edit `config.json` and update the `featured` section:

**To feature an album:**
```json
{
  "featured": {
    "type": "album",
    "path": "content/albums/your-album-name"
  }
}
```

**To feature a song:**
```json
{
  "featured": {
    "type": "song",
    "path": "content/singles/your-single-name"
  }
}
```

## Example Content

The repository includes standalone singles in `content/singles/` (for example: `this-house-is-haunted`, `lean-and-flow`, and `deadly-damsel-epic-poem`) that serve as templates for adding your own releases.

## Customization

### Styling

Edit `styles.css` to customize:
- Colors (current theme: dark with pink/red accents)
- Fonts
- Layout and spacing
- Animations

### Functionality

Edit `app.js` to modify:
- How content is loaded and displayed
- Number of songs shown in the "Latest Songs" section
- How standalone singles are loaded from `config.json`
- Additional features like audio playback

## Browser Compatibility

The website works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## License

See LICENSE file for details.

## Support

For issues or questions, please open an issue on GitHub.