/**
 * Photon Control - Web Dashboard
 * Each emotion state (Positive/Negative) has its own color, music, and motor speed.
 * Selections are remembered per state and persisted in localStorage.
 */

const SCHEMES = ['pink', 'blue', 'green', 'orange', 'purple', 'red'];
const DEFAULT_STATE = {
  colorScheme: 'orange',
  selectedTrack: null,
  motorSpeed: 50,
};

const state = {
  emotion: 'positive',
  positive: { ...DEFAULT_STATE },
  negative: { ...DEFAULT_STATE },
};

// Track metadata for audio files
const TRACKS = {
  '0001': 'Bird',
  '0003': 'Crowd noise',
  '0005': 'Forest',
  '0007': 'Static noise',
  '0009': 'Hitting',
  '00011': 'River',
  '00013': 'Rain',
  '00015': 'Drilling',
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
    colorScheme: s.colorScheme,
    selectedTrack: s.selectedTrack || '',
    motorSpeed: s.motorSpeed,
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
  initMotorSlider();
  initSaveButton();
  applyStateToUI();
  // Sync saved state to Photon on load (no preview)
  syncToPhoton('negative', false);
  syncToPhoton('positive', false);
}

function applyStateToUI() {
  const s = getCurrentState();
  // Color
  document.body.setAttribute('data-scheme', s.colorScheme);
  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.scheme === s.colorScheme);
  });
  // Music — show selected track for this state (don't auto-play)
  stopAudio();
  document.querySelectorAll('.track').forEach((el) => {
    el.classList.toggle('selected', el.dataset.track === s.selectedTrack);
    el.classList.remove('playing');
  });
  // Motor
  const slider = document.querySelector('.motor-slider');
  if (slider) slider.value = s.motorSpeed;
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

// --- Color Switcher ---
function initColorSwitcher() {
  const body = document.body;
  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scheme = btn.dataset.scheme;
      setCurrentState({ colorScheme: scheme });
      body.setAttribute('data-scheme', scheme);
      document.querySelectorAll('.color-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.scheme === scheme);
      });
    });
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

// --- Motor Slider ---
function initMotorSlider() {
  const slider = document.querySelector('.motor-slider');
  if (!slider) return;

  slider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    setCurrentState({ motorSpeed: value });
  });
}

document.addEventListener('DOMContentLoaded', init);
