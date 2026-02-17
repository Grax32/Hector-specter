// Main application logic
let config = {};
let albums = [];
let songs = [];

// Load configuration and initialize the app
async function init() {
    try {
        // Load the main configuration file
        const response = await fetch('config.json');
        config = await response.json();

        // Load all albums
        await loadAlbums();

        // Load all songs (album songs + optional standalone singles)
        await loadSongs();

        // Display featured content
        displayFeatured();

        // Display albums
        displayAlbums();

        // Display songs
        displaySongs();
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('featured-content').innerHTML =
            '<p>Error loading content. Please check the configuration.</p>';
    }
}

// Load all albums from their directories
async function loadAlbums() {
    if (!config.albums || config.albums.length === 0) {
        return;
    }

    for (const albumPath of config.albums.filter(album => album && album.visible)) {
        try {
            const response = await fetch(`${albumPath}/album.json`);
            const albumData = await response.json();
            albumData.path = albumPath;
            albums.push(albumData);
        } catch (error) {
            console.error(`Error loading album from ${albumPath}:`, error);
        }
    }
}

async function loadSongFromPath(fullPath, metadata = {}) {
    try {
        const response = await fetch(`${fullPath}/song.json`);
        const songData = await response.json();
        songData.path = fullPath;
        Object.assign(songData, metadata);
        songs.push(songData);
    } catch (error) {
        console.error(`Error loading song from ${fullPath}:`, error);
    }
}

// Load all songs
async function loadSongs() {
    const seenPaths = new Set();

    for (const album of albums) {
        if (!album.songs || album.songs.length === 0) {
            continue;
        }

        for (const songPath of album.songs) {
            const fullPath = `${album.path}/${songPath}`;
            if (seenPaths.has(fullPath)) {
                continue;
            }

            seenPaths.add(fullPath);
            await loadSongFromPath(fullPath, {
                albumName: album.title,
                albumPath: album.path,
                releaseType: 'album'
            });
        }
    }

    if (!config.singles || config.singles.length === 0) {
        return;
    }

    for (const singlePath of config.singles) {
        if (seenPaths.has(singlePath)) {
            continue;
        }

        seenPaths.add(singlePath);
        await loadSongFromPath(singlePath, {
            albumName: 'Single',
            releaseType: 'single'
        });
    }
}

function parseReleaseDate(item) {
    if (!item || !item.releaseDate) {
        return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(item.releaseDate);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

// Display the featured item (latest release)
function displayFeatured() {
    const featuredContainer = document.getElementById('featured-content');

    if (!config.featured) {
        featuredContainer.innerHTML = '<p>No featured content available.</p>';
        return;
    }

    const featured = config.featured;
    let item = null;
    let itemType = '';

    if (featured.type === 'album') {
        item = albums.find(a => a.path === featured.path);
        itemType = 'Album';
    } else if (featured.type === 'song') {
        item = songs.find(s => s.path === featured.path);
        itemType = item?.releaseType === 'single' ? 'Single' : 'Song';
    }

    if (!item) {
        featuredContainer.innerHTML = '<p>Featured item not found.</p>';
        return;
    }

    const artworkPath = `${item.path}/${item.artwork}`;

    featuredContainer.innerHTML = `
        <div class="featured-item">
            <img src="${artworkPath}" alt="${item.title}">
            <div class="featured-info">
                <h3>${item.title}</h3>
                <span class="type">${itemType}</span>
                <p><strong>Release Date:</strong> ${item.releaseDate || item.year}</p>
                ${item.description ? `<p>${item.description}</p>` : ''}
                ${featured.type === 'album' && item.songs ?
                    `<p class="track-count">${item.songs.length} tracks</p>` : ''}
                ${featured.type === 'song' && item.duration ?
                    `<p><strong>Duration:</strong> ${item.duration}</p>` : ''}
            </div>
        </div>
    `;
}

// Display all albums
function displayAlbums() {
    const albumsList = document.getElementById('albums-list');

    if (albums.length === 0) {
        albumsList.innerHTML = '<p>No albums available.</p>';
        return;
    }

    albumsList.innerHTML = albums.map(album => `
        <div class="album-card">
            <img src="${album.path}/${album.artwork}" alt="${album.title}">
            <div class="album-info">
                <h3>${album.title}</h3>
                <p class="year">${album.year}</p>
                ${album.description ? `<p class="description">${album.description}</p>` : ''}
                ${album.songs ? `<p class="track-count">${album.songs.length} tracks</p>` : ''}
            </div>
        </div>
    `).join('');
}

// Display all songs
function displaySongs() {
    const songsList = document.getElementById('songs-list');

    if (songs.length === 0) {
        songsList.innerHTML = '<p>No songs available.</p>';
        return;
    }

    // Show latest songs (up to 6), sorted by newest release date first.
    const latestSongs = [...songs]
        .sort((a, b) => parseReleaseDate(b) - parseReleaseDate(a))
        .slice(0, 6);

    songsList.innerHTML = latestSongs.map(song => `
        <div class="song-card">
            ${song.artwork ? `<img src="${song.path}/${song.artwork}" alt="${song.title}">` : ''}
            <h3>${song.title}</h3>
            ${song.albumName ? `<p class="album-name">${song.releaseType === 'single' ? 'Release' : 'From'}: ${song.albumName}</p>` : ''}
            ${song.releaseDate ? `<p class="duration">Released: ${song.releaseDate}</p>` : ''}
            ${song.duration ? `<p class="duration">Duration: ${song.duration}</p>` : ''}
        </div>
    `).join('');
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
