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
        handleRouteChange();

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

function getReleaseTimestamp(value) {
    if (!value) {
        return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function formatReleaseDate(value) {
    const timestamp = getReleaseTimestamp(value);

    if (!Number.isFinite(timestamp)) {
        return value || '';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(timestamp));
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
    return getReleaseTimestamp(item?.releaseDate);
}

function getReleaseLabel(item) {
    return item?.releaseDate ? formatReleaseDate(item.releaseDate) : (item?.year || '');
}

function isUpcomingRelease(item) {
    const releaseTimestamp = parseReleaseDate(item);
    return Number.isFinite(releaseTimestamp) && releaseTimestamp > Date.now();
}

function shouldShowSpotifyLink(item) {
    const releaseTimestamp = parseReleaseDate(item);
    return Boolean(item?.spotifyUrl) && Number.isFinite(releaseTimestamp) && releaseTimestamp <= Date.now();
}

function setActiveLibraryTypeFilter(filterType) {
    document.querySelectorAll('.library-tab').forEach(tab => {
        tab.classList.toggle('is-active', tab.dataset.typeFilter === filterType);
    });
}

function focusLibraryCard(attributeName, path) {
    showLibraryPage();
    displayLibrary();

    requestAnimationFrame(() => {
        const cards = Array.from(document.querySelectorAll(`[${attributeName}]`));
        const card = cards.find(candidate => candidate.getAttribute(attributeName) === path);

        if (!card) {
            return;
        }

        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('is-focused');
        setTimeout(() => card.classList.remove('is-focused'), 1800);
    });
}

function activateFeaturedItem(item, featured) {
    if (featured.type === 'album') {
        showAlbumDetail(item.path);
        return;
    }

    if (item.albumPath) {
        showAlbumDetail(item.albumPath);
        return;
    }

    if (item.releaseType === 'single') {
        setActiveLibraryTypeFilter('single');
        focusLibraryCard('data-single-path', item.path);
    }
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
    const releaseLabel = getReleaseLabel(item);

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
        <article class="featured-item featured-item-clickable" role="link" tabindex="0" aria-label="Open ${item.title}">
            <div class="featured-artwork">
                <img src="${artworkPath}" alt="${item.title}">
                ${isUpcomingRelease(item) ? '<span class="release-banner release-banner-upcoming">Coming Soon</span>' : ''}
            </div>
            <div class="featured-info">
                <h3>${item.title}</h3>
                <span class="type">${itemType}</span>
                <p><strong>Release Date:</strong> ${releaseLabel}</p>
                ${item.description ? `<p>${item.description}</p>` : ''}
                ${featured.type === 'album' && item.songs ?
                    `<p class="track-count">${item.songs.length} tracks</p>` : ''}
                ${featured.type === 'song' && item.duration ?
                    `<p><strong>Duration:</strong> ${item.duration}</p>` : ''}
                ${mediaHtml}
            </div>
        </article>
    `;

    const featuredItem = featuredContainer.querySelector('.featured-item-clickable');

    if (featuredItem) {
        featuredItem.addEventListener('click', event => {
            if (event.target.closest('a, button, video, audio, input, select, textarea')) {
                return;
            }

            activateFeaturedItem(item, featured);
        });

        featuredItem.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            event.preventDefault();
            activateFeaturedItem(item, featured);
        });
    }
}

function setupLibraryNavigation() {
    const tabs = document.querySelectorAll('.library-tab');
    const searchInput = document.getElementById('library-search');
    const backButton = document.getElementById('album-page-back');

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

    if (backButton) {
        backButton.addEventListener('click', hideAlbumDetail);
    }

    window.addEventListener('hashchange', handleRouteChange);
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
            path: single.path,
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

    libraryResults.innerHTML = sortedItems.map(item => {
        const releaseLabel = item.subtitle ? formatReleaseDate(item.subtitle) : '';

        return `
        <article class="library-card ${item.type === 'album' ? 'library-card-clickable' : ''}" ${item.type === 'album' ? `data-album-path="${item.path}"` : `data-single-path="${item.path}"`}>
            <div class="library-card-artwork">
                ${item.artwork ? `<img src="${item.artwork}" alt="${item.title}">` : ''}
                ${isUpcomingRelease(item) ? '<span class="release-banner release-banner-upcoming">Coming Soon</span>' : ''}
            </div>
            <div class="library-card-info">
                <span class="library-card-type">${item.type === 'album' ? 'Album' : 'Single'}</span>
                <h3>${item.title}</h3>
                ${item.description ? `<p class="description">${item.description}</p>` : ''}
                <div class="library-card-footer">
                    ${releaseLabel ? `<p class="year">${item.type === 'album' ? 'Release Date' : 'Released'}: ${releaseLabel}</p>` : ''}
                    <div class="library-card-actions">
                        ${shouldShowSpotifyLink(item) ? `<a class="media-link media-link-spotify" href="${item.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a>` : ''}
                    </div>
                </div>
            </div>
        </article>
    `;
    }).join('');

    libraryResults.querySelectorAll('.library-card-clickable').forEach(card => {
        card.addEventListener('click', () => {
            const albumPath = card.getAttribute('data-album-path');
            if (albumPath) {
                showAlbumDetail(albumPath);
            }
        });
    });
}

function getAlbumPathFromHash() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#album=')) {
        return '';
    }

    return decodeURIComponent(hash.slice('#album='.length));
}

function showLibraryPage() {
    const featuredSection = document.getElementById('featured');
    const librarySection = document.getElementById('library');
    const albumPage = document.getElementById('album-page');

    if (featuredSection) {
        featuredSection.hidden = false;
    }

    if (librarySection) {
        librarySection.hidden = false;
    }

    if (albumPage) {
        albumPage.hidden = true;
    }
}

function handleRouteChange() {
    const albumPath = getAlbumPathFromHash();
    if (albumPath) {
        showAlbumDetail(albumPath, { updateHash: false });
        return;
    }

    showLibraryPage();
}

function hideAlbumDetail() {
    if (getAlbumPathFromHash()) {
        const { pathname, search } = window.location;
        history.pushState(null, '', `${pathname}${search}`);
    }

    showLibraryPage();
}

function getAlbumSongs(album, albumPath) {
    const albumSongs = songs.filter(song => song.releaseType === 'album' && song.albumPath === albumPath);
    const songsByPath = new Map(albumSongs.map(song => [song.path, song]));
    const orderedSongs = (album.songs || [])
        .map(relativePath => songsByPath.get(`${album.path}/${relativePath}`))
        .filter(Boolean);

    return orderedSongs.length > 0 ? orderedSongs : albumSongs;
}

function renderAlbumSongCard(song, album, index) {
    const artwork = song.artwork ? `${song.path}/${song.artwork}` : (album.artwork ? `${album.path}/${album.artwork}` : '');
    const releaseLabel = song.releaseDate ? formatReleaseDate(song.releaseDate) : '';

    let mediaHtml = '';
    if (song.videoUrl) {
        mediaHtml += `<p><a class="media-link media-link-video" href="${song.videoUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">▶</span>Watch video</a></p>`;
    }

    if (shouldShowSpotifyLink(song)) {
        mediaHtml += `<p><a class="media-link media-link-spotify" href="${song.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a></p>`;
    }

    return `
        <article class="library-card album-song-card">
            ${artwork ? `<img src="${artwork}" alt="${song.title}">` : ''}
            <div class="library-card-info">
                <span class="library-card-type">Track ${String(index + 1).padStart(2, '0')}</span>
                <h3>${song.title}</h3>
                ${releaseLabel ? `<p class="year">Release Date: ${releaseLabel}</p>` : ''}
                ${song.duration ? `<p class="description">Duration: ${song.duration}</p>` : ''}
                ${song.description ? `<p class="description">${song.description}</p>` : ''}
                ${mediaHtml}
            </div>
        </article>
    `;
}

function showAlbumDetail(albumPath, options = {}) {
    const { updateHash = true } = options;

    if (updateHash) {
        const nextHash = `#album=${encodeURIComponent(albumPath)}`;
        if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
            return;
        }
    }

    const album = albums.find(a => a.path === albumPath);
    if (!album) {
        if (getAlbumPathFromHash()) {
            const { pathname, search } = window.location;
            history.replaceState(null, '', `${pathname}${search}`);
        }
        showLibraryPage();
        return;
    }

    const featuredSection = document.getElementById('featured');
    const librarySection = document.getElementById('library');
    const albumPage = document.getElementById('album-page');
    const title = document.getElementById('album-page-title');
    const artwork = document.getElementById('album-page-artwork');
    const subtitle = document.getElementById('album-page-subtitle');
    const songsGrid = document.getElementById('album-page-songs');
    const media = document.getElementById('album-page-media');
    const kicker = albumPage.querySelector('.album-page-kicker');

    if (!albumPage || !title || !artwork || !subtitle || !songsGrid || !media) {
        return;
    }

    const tracksToShow = getAlbumSongs(album, albumPath);

    title.textContent = album.title;
    subtitle.textContent = [getReleaseLabel(album), `${tracksToShow.length} ${tracksToShow.length === 1 ? 'track' : 'tracks'}`]
        .filter(Boolean)
        .join(' • ');

    if (kicker) {
        kicker.textContent = isUpcomingRelease(album) ? 'Coming Soon' : 'Album';
    }

    if (album.artwork) {
        artwork.src = `${album.path}/${album.artwork}`;
        artwork.alt = `${album.title} artwork`;
        artwork.hidden = false;
    } else {
        artwork.hidden = true;
    }

    media.innerHTML = shouldShowSpotifyLink(album)
        ? `<p><a class="media-link media-link-spotify" href="${album.spotifyUrl}" target="_blank" rel="noopener"><span class="media-link-icon" aria-hidden="true">♫</span>Listen on Spotify</a></p>`
        : '';

    albumPage.classList.toggle('is-upcoming', isUpcomingRelease(album));

    if (tracksToShow.length === 0) {
        songsGrid.innerHTML = '<p class="library-empty">No tracks found for this album.</p>';
    } else {
        songsGrid.innerHTML = tracksToShow
            .map((song, index) => renderAlbumSongCard(song, album, index))
            .join('');
    }

    if (featuredSection) {
        featuredSection.hidden = true;
    }

    if (librarySection) {
        librarySection.hidden = true;
    }

    albumPage.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            ${song.releaseDate ? `<p class="duration">Release Date: ${formatReleaseDate(song.releaseDate)}</p>` : ''}
            ${song.duration ? `<p class="duration">Duration: ${song.duration}</p>` : ''}
            ${media}
        </div>
    `;
    }).join('');
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
