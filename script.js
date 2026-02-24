/**
 * Photon Control - Web Dashboard
 * Each emotion state (Positive/Negative) has its own color and music.
 * Selections are remembered per state and persisted in localStorage.
 */

const DEFAULT_STATE = {
  hue: 30,
  selectedTrack: null,
};

const state = {
  emotion: 'positive',
  positive: { ...DEFAULT_STATE, hue: 30 },
  negative: { ...DEFAULT_STATE, hue: 210 },
};

// Track metadata for audio files
const TRACKS = {
  '0001': 'Bird',
  '0005': 'Bubble',
  '0007': 'Fire',
  '0009': 'Hitting',
  '0013': 'Rain',
  '0015': 'Drilling',
  '0017': 'Cricket',
  '0019': 'Ocean',
  '0021': 'Underwater',
};

let audioElement = null;

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('photon-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.positive) state.positive = { ...DEFAULT_STATE, ...parsed.positive };
      if (parsed.negative) state.negative = { ...DEFAULT_STATE, ...parsed.negative };
    }
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem('photon-state', JSON.stringify({
      positive: state.positive,
      negative: state.negative,
    }));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function getCurrentState() {
  return state[state.emotion];
}

function setCurrentState(updates, personalizing = true) {
  Object.assign(state[state.emotion], updates);
  saveToStorage();
  syncToPhoton(state.emotion, personalizing);
}

function syncToPhoton(emotion, personalizing = false) {
  const s = state[emotion];
  const payload = {
    emotion,
    hue: s.hue,
    selectedTrack: s.selectedTrack || '',
    personalizing: !!personalizing,
  };
  fetch('/api/photon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((d) => Promise.reject(d));
    })
    .catch((err) => console.warn('Photon sync failed:', err?.error || err));
}

function init() {
  loadFromStorage();
  initEmotionToggle();
  initColorSwitcher();
  initMusicPlayer();
  initSaveButton();
  applyStateToUI();
  // Sync saved state to Photon on load (no preview)
  syncToPhoton('negative', false);
  syncToPhoton('positive', false);
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function updateHuePreview(hue) {
  const light = hslToRgb(hue, 60, 50);
  const saturated = hslToRgb(hue, 80, 70);
  const gradientEl = document.getElementById('hue-preview-gradient');
  if (gradientEl) {
    const lightColor = `rgb(${light[0]}, ${light[1]}, ${light[2]})`;
    const satColor = `rgb(${saturated[0]}, ${saturated[1]}, ${saturated[2]})`;
    gradientEl.style.background = `linear-gradient(90deg, ${lightColor} 0%, ${satColor} 25%, ${lightColor} 50%, ${satColor} 75%, ${lightColor} 100%)`;
    gradientEl.style.backgroundSize = '200% 100%';
  }
}

function applyStateToUI() {
  const s = getCurrentState();
  // Hue slider
  const hueSlider = document.getElementById('hue-slider');
  if (hueSlider) {
    hueSlider.value = s.hue;
    updateHuePreview(s.hue);
  }
  // Music — show selected track for this state (don't auto-play)
  stopAudio();
  document.querySelectorAll('.track').forEach((el) => {
    el.classList.toggle('selected', el.dataset.track === s.selectedTrack);
    el.classList.remove('playing');
  });
}

// --- Emotion State ---
function initEmotionToggle() {
  const buttons = document.querySelectorAll('.emotion-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      state.emotion = btn.dataset.emotion;
      applyStateToUI();
      syncToPhoton(state.emotion, false);  // emotion switch = not personalizing
    });
  });
}

// --- Hue Picker ---
function initColorSwitcher() {
  const hueSlider = document.getElementById('hue-slider');
  if (!hueSlider) return;
  hueSlider.addEventListener('input', () => {
    const hue = parseInt(hueSlider.value, 10);
    updateHuePreview(hue);
  });
  hueSlider.addEventListener('change', () => {
    const hue = parseInt(hueSlider.value, 10);
    setCurrentState({ hue });
  });
}

// --- Music Player ---
function initMusicPlayer() {
  document.querySelectorAll('.track').forEach((trackEl) => {
    const playBtn = trackEl.querySelector('.track-play');
    const trackId = trackEl.dataset.track;

    // Select: click track row to choose for this emotion (no play)
    trackEl.addEventListener('click', (e) => {
      if (e.target.closest('.track-play')) return; // play btn has its own handler
      selectTrack(trackId, trackEl);
    });

    // Play: click play button for preview only (doesn't change selection)
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay(trackId, trackEl);
    });
  });
}

function selectTrack(trackId, trackEl) {
  const s = getCurrentState();
  const isDeselecting = s.selectedTrack === trackId;
  const newSelection = isDeselecting ? null : trackId;
  setCurrentState({ selectedTrack: newSelection });
  document.querySelectorAll('.track').forEach((t) => {
    t.classList.toggle('selected', t.dataset.track === newSelection);
  });
}

function togglePlay(trackId, trackEl) {
  const isThisPlaying = trackEl.classList.contains('playing');
  if (isThisPlaying) {
    stopAudio();
    trackEl.classList.remove('playing');
    return;
  }
  stopAudio();
  document.querySelectorAll('.track').forEach((t) => t.classList.remove('playing'));
  trackEl.classList.add('playing');
  playAudio(trackId);
}

function playAudio(trackId) {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.addEventListener('ended', () => {
      document.querySelectorAll('.track').forEach((t) => t.classList.remove('playing'));
      // Keep selected — user's choice for this state stays
    });
  }
  audioElement.src = `music/${trackId}.mp3`;
  audioElement.play().catch((err) => {
    console.warn('Audio playback failed (file may not exist):', trackId, err);
    document.querySelectorAll('.track').forEach((t) => t.classList.remove('playing'));
  });
}

function stopAudio() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.src = '';
  }
}

// --- Save to Device ---
function initSaveButton() {
  const btn = document.getElementById('save-to-device');
  const errEl = document.getElementById('save-error');
  if (!btn) return;

  function showError(msg) {
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
  }
  function clearError() {
    if (errEl) {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  btn.addEventListener('click', () => {
    btn.disabled = true;
    clearError();
    btn.textContent = 'Saving…';
    fetch('/api/photon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save' }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.ok) {
          btn.textContent = 'Saved!';
          clearError();
        } else {
          btn.textContent = 'Failed';
          const msg = data.error || data.details?.error_description || JSON.stringify(data);
          showError(msg);
        }
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Save to Device';
        }, 3000);
      })
      .catch((err) => {
        btn.textContent = 'Failed';
        showError(err?.message || 'Network error — check console');
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Save to Device';
        }, 3000);
      });
  });
}

document.addEventListener('DOMContentLoaded', init);
