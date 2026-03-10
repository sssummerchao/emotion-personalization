/**
 * Photon Control - Web Dashboard
 * Each emotion state (Positive/Negative) has its own color and music.
 * Selections are remembered per state and persisted in localStorage.
 * Device status (master, light, sound) controls which screen and banners to show.
 */

const DEFAULT_STATE = {
  hue: 30,
  selectedTrack: null,
};

const state = {
  emotion: 'positive',
  positive: { ...DEFAULT_STATE, hue: 30 },
  negative: { ...DEFAULT_STATE, hue: 210 },
  devices: { master: false, light: true, sound: true },  // assume master offline until API responds (avoids blink)
};

// Track metadata for audio files
const TRACKS = {
  '0001': 'Bird',
  '0005': 'Bubble',
  '0007': 'Fire',
  '0009': 'Hitting',
  '0013': 'River',
  '0015': 'Drilling',
  '0017': 'Cricket',
  '0019': 'Rain',
  '0021': 'Underwater',
};

const POLL_INTERVAL_MS = 10000;
const INIT_FETCH_TIMEOUT_MS = 8000;  // hide loading screen after this even if API hangs

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
  if (state.devices.master) {
    syncToPhoton(state.emotion, personalizing);
  }
}

function parseBool(val) {
  return val !== '0' && val !== 'false';
}

async function fetchDeviceStatus() {
  const params = new URLSearchParams(window.location.search);
  const hasParams = params.get('master') !== null || params.get('light') !== null || params.get('sound') !== null;

  try {
    const q = {};
    if (params.get('master') !== null) q.master = params.get('master');
    if (params.get('light') !== null) q.light = params.get('light');
    if (params.get('sound') !== null) q.sound = params.get('sound');
    const query = Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : '';
    const r = await fetch('/api/devices' + query);
    if (!r.ok) throw new Error('API not ok');
    const data = await r.json();
    state.devices = {
      master: data.master !== false,
      light: data.light !== false,
      sound: data.sound !== false,
    };
  } catch (e) {
    if (hasParams) {
      state.devices = {
        master: params.get('master') === null ? true : parseBool(params.get('master')),
        light: params.get('light') === null ? true : parseBool(params.get('light')),
        sound: params.get('sound') === null ? true : parseBool(params.get('sound')),
      };
    }
  }
  return state.devices;
}

function applyDeviceStatus() {
  const { master, light, sound } = state.devices;

  const screenMasterOffline = document.getElementById('screen-master-offline');
  const screenPersonalize = document.getElementById('screen-personalize');

  if (!master) {
    if (screenMasterOffline) {
      screenMasterOffline.hidden = false;
      screenMasterOffline.style.display = '';
    }
    if (screenPersonalize) {
      screenPersonalize.hidden = true;
      screenPersonalize.style.display = 'none';
    }
    return;
  }

  if (screenMasterOffline) {
    screenMasterOffline.hidden = true;
    screenMasterOffline.style.display = 'none';
  }
  if (screenPersonalize) {
    screenPersonalize.hidden = false;
    screenPersonalize.style.display = '';
  }

  // Light section - when offline: hide entire online block (label + controls), show only offline banner
  const lightSection = document.getElementById('light-section');
  const lightOnlineContent = document.getElementById('light-online-content');
  const lightBanner = document.getElementById('light-offline-banner');
  if (lightOnlineContent && lightBanner) {
    lightOnlineContent.style.display = light ? '' : 'none';
    lightBanner.hidden = light;
    lightBanner.style.setProperty('display', light ? 'none' : 'flex', 'important');
    if (lightSection) {
      lightSection.classList.toggle('light-offline', !light);
      if (light) {
        updateHuePreview(getCurrentState().hue);
      }
    }
  }

  // Sound section - when offline: hide entire online block (label + controls), show only offline banner
  const soundSection = document.getElementById('sound-section');
  const soundOnlineContent = document.getElementById('sound-online-content');
  const soundBanner = document.getElementById('sound-offline-banner');
  if (soundOnlineContent && soundBanner) {
    if (sound) {
      soundOnlineContent.style.removeProperty('display');
    } else {
      soundOnlineContent.style.setProperty('display', 'none', 'important');
    }
    soundBanner.hidden = sound;
    soundBanner.style.setProperty('display', sound ? 'none' : 'flex', 'important');
    if (soundSection) soundSection.classList.toggle('sound-offline', !sound);
  }

  // Save button
  const saveBtn = document.getElementById('save-to-device');
  if (saveBtn) {
    const anyDevice = light || sound;
    saveBtn.disabled = !anyDevice;
    saveBtn.classList.toggle('save-disabled', !anyDevice);
    saveBtn.textContent = !anyDevice ? 'No devices available' : 'Save emotion';
  }
}

function syncToPhoton(emotion, personalizing = false) {
  if (!state.devices.master) return;
  const s = state[emotion];
  const payload = {
    emotion,
    hue: s.hue,
    selectedTrack: s.selectedTrack || '',
    personalizing: !!personalizing,
  };
  if (personalizing) payload.previewDurationSec = 60;  // 1 minute for admin
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

function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('loading-done');
  el.setAttribute('aria-busy', 'false');
  el.addEventListener('transitionend', () => {
    el.style.display = 'none';
  }, { once: true });
}

function init() {
  loadFromStorage();
  initEmotionToggle();
  initColorSwitcher();
  initMusicPlayer();
  initSaveButton();
  applyStateToUI();
  applyDeviceStatus();  // Show master-offline by default (avoids blink when master is offline)
  initDeviceStatus();
}

async function initDeviceStatus() {
  const params = new URLSearchParams(window.location.search);
  const hasParams = params.get('master') !== null || params.get('light') !== null || params.get('sound') !== null;
  if (hasParams) {
    state.devices = {
      master: params.get('master') === null ? true : parseBool(params.get('master')),
      light: params.get('light') === null ? true : parseBool(params.get('light')),
      sound: params.get('sound') === null ? true : parseBool(params.get('sound')),
    };
  }
  const fetchWithTimeout = () =>
    Promise.race([
      fetchDeviceStatus(),
      new Promise((resolve) => setTimeout(resolve, INIT_FETCH_TIMEOUT_MS)),
    ]);
  await fetchWithTimeout();
  applyDeviceStatus();
  if (state.devices.master) {
    syncToPhoton('negative', false);
    syncToPhoton('positive', false);
  }
  hideLoadingScreen();
  setInterval(async () => {
    await fetchDeviceStatus();
    applyDeviceStatus();
  }, POLL_INTERVAL_MS);
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
  // Match firmware: light (40% sat, 45% lightness), saturated (95% sat, 75% lightness)
  const light = hslToRgb(hue, 40, 45);
  const saturated = hslToRgb(hue, 95, 75);
  const lightSection = document.getElementById('light-section');
  if (lightSection) {
    lightSection.style.setProperty('--light-bg-light', `rgb(${light[0]}, ${light[1]}, ${light[2]})`);
    lightSection.style.setProperty('--light-bg-saturated', `rgb(${saturated[0]}, ${saturated[1]}, ${saturated[2]})`);
  }
}

function applyStateToUI() {
  const s = getCurrentState();
  const hueSlider = document.getElementById('hue-slider');
  if (hueSlider) {
    hueSlider.value = s.hue;
    updateHuePreview(s.hue);
  }
  document.querySelectorAll('.track-chip').forEach((el) => {
    el.classList.toggle('selected', el.dataset.track === s.selectedTrack);
  });
  updateEmotionIcons();
}

function updateEmotionIcons() {
  const posIcon = document.querySelector('.emotion-btn[data-emotion="positive"] .emotion-icon');
  const negIcon = document.querySelector('.emotion-btn[data-emotion="negative"] .emotion-icon');
  const positiveActive = state.emotion === 'positive';
  if (posIcon) posIcon.src = positiveActive ? 'assets/positive-white.png' : 'assets/positive-blue.png';
  if (negIcon) negIcon.src = positiveActive ? 'assets/negative-blue.png' : 'assets/negative-white.png';
}

function initEmotionToggle() {
  updateEmotionIcons();
  const buttons = document.querySelectorAll('.emotion-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.devices.master) return;
      buttons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      state.emotion = btn.dataset.emotion;
      updateEmotionIcons();
      applyStateToUI();
      syncToPhoton(state.emotion, false);
    });
  });
}

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

function initMusicPlayer() {
  document.querySelectorAll('.track-chip').forEach((trackEl) => {
    const trackId = trackEl.dataset.track;
    trackEl.addEventListener('click', () => selectTrack(trackId, trackEl));
  });
}

function selectTrack(trackId, trackEl) {
  if (!state.devices.master) return;
  const s = getCurrentState();
  const isDeselecting = s.selectedTrack === trackId;
  const newSelection = isDeselecting ? null : trackId;
  setCurrentState({ selectedTrack: newSelection });
  document.querySelectorAll('.track-chip').forEach((t) => {
    t.classList.toggle('selected', t.dataset.track === newSelection);
  });
}

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
    if (btn.disabled) return;
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
          btn.textContent = 'Emotion saved!';
          clearError();
        } else {
          btn.textContent = state.devices.light || state.devices.sound ? 'Save emotion' : 'No devices available';
          const msg = data.error || data.details?.error_description || JSON.stringify(data);
          showError(msg);
        }
        setTimeout(() => {
          btn.disabled = !(state.devices.light || state.devices.sound);
          btn.classList.toggle('save-disabled', btn.disabled);
          btn.textContent = btn.disabled ? 'No devices available' : 'Save emotion';
        }, 3000);
      })
      .catch((err) => {
        btn.textContent = state.devices.light || state.devices.sound ? 'Save emotion' : 'No devices available';
        showError(err?.message || 'Network error — check console');
        setTimeout(() => {
          btn.disabled = !(state.devices.light || state.devices.sound);
          btn.classList.toggle('save-disabled', btn.disabled);
          btn.textContent = btn.disabled ? 'No devices available' : 'Save emotion';
        }, 3000);
      });
  });
}

document.addEventListener('DOMContentLoaded', init);
