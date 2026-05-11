// Main application logic
let config = {};
let albums = [];
let songs = [];
let singles = [];

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

        // Display library navigation + results
        setupLibraryNavigation();
        displayLibrary();

        // Display songs for any legacy/optional section
        displaySongs();
        // Setup artist video (plays once muted and freezes on last frame)
        setupArtistVideo();
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('featured-content').innerHTML =
            '<p>Error loading content. Please check the configuration.</p>';
    }
}

// Play the artist video once (muted) and freeze on last frame.
function setupArtistVideo() {
    const vid = document.getElementById('artist-video');
    if (!vid) return;

    // Ensure muted for autoplay policies
    vid.muted = true;
    vid.playsInline = true;
    vid.autoplay = true;
    vid.loop = false;

    // Attempt to play. Some browsers block autoplay unless muted.
    const tryPlay = () => {
        const p = vid.play();
        if (p && p.catch) {
            p.catch(err => {
                // ignore playback error; will remain paused until user interacts
                console.warn('Artist video autoplay prevented:', err);
            });
        }
    };

    // When video ends, seek to near-end and pause to show final frame.
    vid.addEventListener('ended', () => {
        try {
            const eps = 0.05;
            const target = Math.max(0, (vid.duration || 0) - eps);
            vid.currentTime = target;
            vid.pause();
        } catch (e) {
            // fallback: just pause
            vid.pause();
        }
    });

    // If metadata loaded and not ended, play
    if (vid.readyState >= 2) {
        tryPlay();
    } else {
        vid.addEventListener('loadedmetadata', tryPlay, { once: true });
    }

    // Also try play on user interaction if autoplay blocked
    ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, tryPlay, { once: true });
    });
}

// Load all albums from their directories
async function loadAlbums() {
    if (!config.albums || config.albums.length === 0) {
        return;
    }

    for (const albumPath of config.albums) {
        try {
            const response = await fetch(`${albumPath}/album.json`);
            const albumData = await response.json();
            albumData.path = albumPath;
            // Only add albums that are marked as visible (or don't have the visible property, defaulting to true)
            if (albumData.visible !== false) {
                albums.push(albumData);
            }
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
        return songData;
    } catch (error) {
        console.error(`Error loading song from ${fullPath}:`, error);
        return null;
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
        const singleSong = await loadSongFromPath(singlePath, {
            albumName: 'Single',
            releaseType: 'single'
        });

        if (singleSong && singleSong.visible !== false) {
            singles.push(singleSong);
        }
    }
}

function parseReleaseDate(item) {
    if (!item || !item.releaseDate) {
        return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(item.releaseDate);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function shouldShowSpotifyLink(item) {
    const releaseTimestamp = parseReleaseDate(item);
    return Boolean(item?.spotifyUrl) && Number.isFinite(releaseTimestamp) && releaseTimestamp <= Date.now();
}

// Display the featured item (latest release)
function displayFeatured() {
    const featuredContainer = document.getElementById('featured-content');
    
    if (!featuredContainer) {
        return;
    }

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

    let mediaHtml = '';
    if (item.videoFile) {
        mediaHtml += `\n                <video controls class="featured-video">\n                    <source src="${item.path}/${item.videoFile}" type="video/mp4">\n                    Your browser does not support the video tag.\n                </video>`;
    } else if (item.videoUrl) {
        mediaHtml += `\n                <p><a class="media-link media-link-video" href="${item.videoUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">▶</span>Watch video</a></p>`;
    }

    if (shouldShowSpotifyLink(item)) {
        mediaHtml += `\n                <p><a class="media-link media-link-spotify" href="${item.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a></p>`;
    }

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
                ${mediaHtml}
            </div>
        </div>
    `;
}

function setupLibraryNavigation() {
    const tabs = document.querySelectorAll('.library-tab');
    const searchInput = document.getElementById('library-search');
    const closeButton = document.getElementById('album-detail-close');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(button => button.classList.remove('is-active'));
            tab.classList.add('is-active');
            hideAlbumDetail();
            displayLibrary();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            hideAlbumDetail();
            displayLibrary();
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', hideAlbumDetail);
    }
}

function getActiveTypeFilter() {
    const activeTab = document.querySelector('.library-tab.is-active');
    return activeTab?.dataset.typeFilter || 'all';
}

function displayLibrary() {
    const libraryResults = document.getElementById('library-results');
    if (!libraryResults) {
        return;
    }

    const filterType = getActiveTypeFilter();
    const query = (document.getElementById('library-search')?.value || '').trim().toLowerCase();

    const libraryItems = [
        ...albums.map(album => ({
            type: 'album',
            path: album.path,
            title: album.title,
            releaseDate: album.releaseDate || '',
            subtitle: album.releaseDate || album.year || '',
            description: album.description || '',
            spotifyUrl: album.spotifyUrl || '',
            artwork: album.artwork ? `${album.path}/${album.artwork}` : '',
            searchableText: `${album.title || ''} ${album.description || ''} ${album.year || ''} ${album.releaseDate || ''}`.toLowerCase()
        })),
        ...singles.map(single => ({
            type: 'single',
            title: single.title,
            releaseDate: single.releaseDate || '',
            subtitle: single.releaseDate || '',
            description: single.duration ? `Duration: ${single.duration}` : '',
            spotifyUrl: single.spotifyUrl || '',
            artwork: single.artwork ? `${single.path}/${single.artwork}` : '',
            searchableText: `${single.title || ''} ${single.releaseDate || ''} ${single.duration || ''}`.toLowerCase()
        }))
    ];

    const filteredItems = libraryItems.filter(item => {
        const typeMatches = filterType === 'all' || item.type === filterType;
        const textMatches = !query || item.searchableText.includes(query);
        return typeMatches && textMatches;
    });

    const sortedItems = filteredItems.sort((a, b) => {
        const typeRankA = a.type === 'album' ? 0 : 1;
        const typeRankB = b.type === 'album' ? 0 : 1;

        if (typeRankA !== typeRankB) {
            return typeRankA - typeRankB;
        }

        return parseReleaseDate(b) - parseReleaseDate(a);
    });

    if (sortedItems.length === 0) {
        libraryResults.innerHTML = '<p class="library-empty">No matching albums or singles.</p>';
        return;
    }

    libraryResults.innerHTML = sortedItems.map(item => `
        <article class="library-card ${item.type === 'album' ? 'library-card-clickable' : ''}" ${item.type === 'album' ? `data-album-path="${item.path}"` : ''}>
            ${item.artwork ? `<img src="${item.artwork}" alt="${item.title}">` : ''}
            <div class="library-card-info">
                <span class="library-card-type">${item.type === 'album' ? 'Album' : 'Single'}</span>
                <h3>${item.title}</h3>
                ${item.subtitle ? `<p class="year">${item.subtitle}</p>` : ''}
                ${item.description ? `<p class="description">${item.description}</p>` : ''}
                ${shouldShowSpotifyLink(item) ? `<p><a class="media-link media-link-spotify" href="${item.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a></p>` : ''}
            </div>
        </article>
    `).join('');

    libraryResults.querySelectorAll('.library-card-clickable').forEach(card => {
        card.addEventListener('click', () => {
            const albumPath = card.getAttribute('data-album-path');
            if (albumPath) {
                showAlbumDetail(albumPath);
            }
        });
    });
}

function hideAlbumDetail() {
    const detail = document.getElementById('album-detail');
    if (detail) {
        detail.hidden = true;
    }
}

function showAlbumDetail(albumPath) {
    const album = albums.find(a => a.path === albumPath);
    if (!album) {
        return;
    }

    const detail = document.getElementById('album-detail');
    const title = document.getElementById('album-detail-title');
    const tracks = document.getElementById('album-detail-tracks');
    const media = document.getElementById('album-detail-media');

    if (!detail || !title || !tracks || !media) {
        return;
    }

    const albumSongs = songs.filter(song => song.releaseType === 'album' && song.albumPath === albumPath);
    const songsByPath = new Map(albumSongs.map(song => [song.path, song]));
    const orderedSongs = (album.songs || [])
        .map(relativePath => songsByPath.get(`${album.path}/${relativePath}`))
        .filter(Boolean);
    const tracksToShow = orderedSongs.length > 0 ? orderedSongs : albumSongs;

    title.textContent = `${album.title} - Track List`;
    media.innerHTML = shouldShowSpotifyLink(album)
        ? `<p><a class="media-link media-link-spotify" href="${album.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a></p>`
        : '';

    if (tracksToShow.length === 0) {
        tracks.innerHTML = '<li>No tracks found for this album.</li>';
    } else {
        tracks.innerHTML = tracksToShow
            .map(song => `<li>${song.title}${song.duration ? ` (${song.duration})` : ''}</li>`)
            .join('');
    }

    detail.hidden = false;
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display all songs
function displaySongs() {
    const songsList = document.getElementById('songs-list');
    
    if (!songsList) {
        return;
    }

    if (songs.length === 0) {
        songsList.innerHTML = '<p>No songs available.</p>';
        return;
    }

    // Show latest songs (up to 6), sorted by newest release date first.
    const latestSongs = [...songs]
        .sort((a, b) => parseReleaseDate(b) - parseReleaseDate(a))
        .slice(0, 6);

    songsList.innerHTML = latestSongs.map(song => {
        let media = '';
        if (song.videoFile) {
            media += `\n                <video controls class="song-video">\n                    <source src="${song.path}/${song.videoFile}" type="video/mp4">\n                    Your browser does not support the video tag.\n                </video>`;
        } else if (song.videoUrl) {
            media += `\n                <p><a class="media-link media-link-video" href="${song.videoUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">▶</span>Watch video</a></p>`;
        }

        if (shouldShowSpotifyLink(song)) {
            media += `\n                <p><a class="media-link media-link-spotify" href="${song.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a></p>`;
        }

        return `
        <div class="song-card">
            ${song.artwork ? `<img src="${song.path}/${song.artwork}" alt="${song.title}">` : ''}
            <h3>${song.title}</h3>
            ${song.albumName ? `<p class="album-name">${song.releaseType === 'single' ? 'Release' : 'From'}: ${song.albumName}</p>` : ''}
            ${song.releaseDate ? `<p class="duration">Released: ${song.releaseDate}</p>` : ''}
            ${song.duration ? `<p class="duration">Duration: ${song.duration}</p>` : ''}
            ${media}
        </div>
    `;
    }).join('');
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
