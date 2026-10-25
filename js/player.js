/**
 * WayDrive - Media Player (Plyr) & PDF Viewer
 */

// Universal Media Playback Trigger
window.playMediaStream = (streamUrl, filename, isVideo) => {
    currentMediaUrl = streamUrl;
    currentMediaIsVideo = isVideo;

    const titleEl = document.getElementById('playerTitle');
    if (titleEl) titleEl.textContent = filename || 'Media Stream';

    renderMediaScreen(isVideo, streamUrl);

    const modal = document.getElementById('mediaPlayerModal');
    const card = document.getElementById('mediaPlayerCard');
    if (modal && card) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.classList.add('opacity-100');
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }, 10);
    }
};

window.playMedia = (fileKey, streamUrl, isVideo) => {
    window.playMediaStream(streamUrl, fileKey.split('/').pop(), isVideo);
};

window.openPdfViewer = (pdfUrl, filename) => {
    const titleEl = document.getElementById('pdfViewerTitle');
    const frame = document.getElementById('pdfFrame');
    if (titleEl) titleEl.textContent = filename || 'Document';
    if (frame) frame.src = pdfUrl;

    const modal = document.getElementById('pdfViewerModal');
    const card = document.getElementById('pdfViewerCard');
    if (modal && card) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.classList.add('opacity-100');
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }, 10);
    }
};

window.viewPdf = (fileKey, directUrl) => {
    window.openPdfViewer(directUrl, fileKey.split('/').pop());
};

function initPlyrPlayers() {
    if (typeof Plyr === 'undefined') return;

    if (!plyrVideoInstance) {
        plyrVideoInstance = new Plyr('#videoPlayer', {
            controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'],
            settings: ['speed', 'loop'],
            speed: { selected: playerSpeed, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
        });
    }

    if (!plyrAudioInstance) {
        plyrAudioInstance = new Plyr('#audioPlayer', {
            controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings'],
            settings: ['speed', 'loop'],
            speed: { selected: playerSpeed, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
        });
    }
}

function renderMediaScreen(isVideo, streamUrl) {
    const videoContainer = document.getElementById('videoPlayerContainer');
    const audioContainer = document.getElementById('audioPlayerContainer');
    const typeIcon = document.getElementById('playerTypeIcon');
    const modeBtn = document.getElementById('playerModeToggleBtn');
    const modeText = document.getElementById('playerModeToggleText');
    const videoPlayer = document.getElementById('videoPlayer');
    const audioPlayer = document.getElementById('audioPlayer');

    initPlyrPlayers();

    if (isVideo) {
        videoContainer.classList.remove('hidden');
        audioContainer.classList.add('hidden');
        typeIcon.innerHTML = '<i class="fas fa-video text-amber-400"></i>';
        modeText.textContent = 'Audio';
        modeBtn.querySelector('i').className = 'fas fa-headphones text-xs text-amber-400';

        if (plyrAudioInstance) plyrAudioInstance.pause();
        audioPlayer.src = '';

        if (plyrVideoInstance) {
            plyrVideoInstance.source = {
                type: 'video',
                title: document.getElementById('playerTitle').textContent,
                sources: [{ src: streamUrl, type: 'video/mp4' }]
            };
            plyrVideoInstance.loop = isLoopEnabled;
            plyrVideoInstance.speed = playerSpeed;
            plyrVideoInstance.play().catch(e => console.log("Video autoplay prevented:", e));
        }
    } else {
        videoContainer.classList.add('hidden');
        audioContainer.classList.remove('hidden');
        typeIcon.innerHTML = '<i class="fas fa-music text-amber-400"></i>';
        modeText.textContent = 'Video';
        modeBtn.querySelector('i').className = 'fas fa-video text-xs text-amber-400';

        if (plyrVideoInstance) plyrVideoInstance.pause();
        videoPlayer.src = '';

        if (plyrAudioInstance) {
            plyrAudioInstance.source = {
                type: 'audio',
                title: document.getElementById('playerTitle').textContent,
                sources: [{ src: streamUrl, type: 'audio/mp3' }]
            };
            plyrAudioInstance.loop = isLoopEnabled;
            plyrAudioInstance.speed = playerSpeed;
            plyrAudioInstance.play().catch(e => console.log("Audio autoplay prevented:", e));
        }
    }
}

window.togglePlayerMode = () => {
    if (!currentMediaUrl) return;
    currentMediaIsVideo = !currentMediaIsVideo;
    renderMediaScreen(currentMediaIsVideo, currentMediaUrl);
};

window.openMediaInNewTab = () => {
    if (currentMediaUrl) window.open(currentMediaUrl, '_blank');
};

window.togglePlayerSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playerSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    playerSpeed = speeds[nextIndex];
    document.getElementById('playerSpeedBtn').textContent = playerSpeed + 'x';

    if (plyrVideoInstance) plyrVideoInstance.speed = playerSpeed;
    if (plyrAudioInstance) plyrAudioInstance.speed = playerSpeed;
};

window.togglePlayerLoop = () => {
    isLoopEnabled = !isLoopEnabled;
    localStorage.setItem('ia_player_loop', isLoopEnabled);
    const btn = document.getElementById('playerLoopBtn');
    if (isLoopEnabled) {
        btn.classList.add('text-amber-400', 'bg-amber-500/20', 'border-amber-500/30');
        showToast("Loop mode enabled", "info");
    } else {
        btn.classList.remove('text-amber-400', 'bg-amber-500/20', 'border-amber-500/30');
        showToast("Loop mode disabled", "info");
    }
    if (plyrVideoInstance) plyrVideoInstance.loop = isLoopEnabled;
    if (plyrAudioInstance) plyrAudioInstance.loop = isLoopEnabled;
};

window.togglePlayerPip = async () => {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer || videoPlayer.paused || !document.pictureInPictureEnabled) return;
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            await videoPlayer.requestPictureInPicture();
        }
    } catch (err) {
        console.error("PiP error:", err);
    }
};

window.togglePlayerMinimize = () => {
    const modal = document.getElementById('mediaPlayerModal');
    const card = document.getElementById('mediaPlayerCard');
    const minBtn = document.getElementById('playerMinimizeBtn');
    isPlayerMinimized = !isPlayerMinimized;
    if (isPlayerMinimized) {
        modal.classList.add('minimized');
        card.classList.add('minimized');
        minBtn.innerHTML = '<i class="fas fa-expand-alt text-xs"></i>';
        showToast("Player docked to corner. You can browse while listening!", "success");
    } else {
        modal.classList.remove('minimized');
        card.classList.remove('minimized');
        minBtn.innerHTML = '<i class="fas fa-compress-alt text-xs"></i>';
    }
};

window.closeMediaPlayer = () => {
    if (plyrVideoInstance) plyrVideoInstance.pause();
    if (plyrAudioInstance) plyrAudioInstance.pause();

    const videoPlayer = document.getElementById('videoPlayer');
    const audioPlayer = document.getElementById('audioPlayer');
    if (videoPlayer) videoPlayer.src = '';
    if (audioPlayer) audioPlayer.src = '';

    const modal = document.getElementById('mediaPlayerModal');
    const card = document.getElementById('mediaPlayerCard');

    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    card.classList.remove('scale-100');
    card.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        if (isPlayerMinimized) {
            modal.classList.remove('minimized');
            card.classList.remove('minimized');
            isPlayerMinimized = false;
            document.getElementById('playerMinimizeBtn').innerHTML = '<i class="fas fa-compress-alt text-xs"></i>';
        }
    }, 250);
};

window.closePdfViewer = () => {
    const modal = document.getElementById('pdfViewerModal');
    const card = document.getElementById('pdfViewerCard');
    if (!modal || !card) return;

    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    card.classList.remove('scale-100');
    card.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('pdfFrame').src = '';
    }, 200);
};

function setupVinylRotation() {
    const audioEl = document.getElementById('audioPlayer');
    const audioDiscEl = document.getElementById('audioPlayerDisc');
    if (audioEl && audioDiscEl) {
        audioEl.addEventListener('play', () => {
            audioDiscEl.classList.add('animate-spin-vinyl');
            audioDiscEl.classList.remove('animation-paused');
        });
        audioEl.addEventListener('pause', () => audioDiscEl.classList.add('animation-paused'));
        audioEl.addEventListener('ended', () => {
            audioDiscEl.classList.remove('animate-spin-vinyl');
            audioDiscEl.classList.remove('animation-paused');
        });
    }
}
