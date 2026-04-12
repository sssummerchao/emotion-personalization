/**
 * Photon Control - Web Dashboard
 * Each emotion state (Positive/Negative) has its own color and music.
 * Selections are remembered per state and persisted in localStorage.
 * Device status (master, light, sound) controls which screen and banners to show.
 * data-setup on body: 0–3 = Families A–D. Separate URLs per family.
 */

function getSetupId() {
  const body = document.body;
  const setup = body?.getAttribute?.('data-setup');
  if (setup !== null && setup !== undefined) return parseInt(setup, 10) || 0;
  const params = new URLSearchParams(window.location.search);
  const q = params.get('setup');
  if (q !== null) return parseInt(q, 10) || 0;
  const path = window.location.pathname;
  if (path.includes('family-a')) return 0;
  if (path.includes('family-b')) return 1;
  if (path.includes('family-c')) return 2;
  if (path.includes('family-d')) return 3;
  return 0;
}

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

// Track metadata (DFPlayer file IDs → label). Calm → intense order for sound slider:
const SOUND_STEPS = [
  { id: '0021', label: 'Underwater' },
  { id: '0007', label: 'Fire' },
  { id: '0017', label: 'Cricket' },
  { id: '0019', label: 'Rain' },
  { id: '0013', label: 'River' },
  { id: '0005', label: 'Bubble' },
  { id: '0001', label: 'Bird' },
  { id: '0009', label: 'Hitting' },
  { id: '0015', label: 'Drilling' },
];

const TRACKS = Object.fromEntries(SOUND_STEPS.map((s) => [s.id, s.label]));

/** Matches `::-webkit-slider-thumb` / `::-moz-range-thumb` width on hue + sound sliders */
const SLIDER_THUMB_WIDTH_PX = 70;

/**
 * Horizontal % where the thumb center sits (same geometry browsers use for range inputs).
 * `norm` is 0 at min, 1 at max.
 */
function thumbCenterPercentFromNorm(sliderEl, norm) {
  const w = sliderEl?.offsetWidth ?? 0;
  if (w < 1) return Math.max(0, Math.min(100, norm * 100));
  const t = SLIDER_THUMB_WIDTH_PX;
  const u = Math.max(0, Math.min(1, norm));
  const centerFrac = t / (2 * w) + u * (1 - t / w);
  return Math.max(0, Math.min(100, centerFrac * 100));
}

let sliderPlumbLayoutScheduled = false;
function scheduleSliderPlumbLayout() {
  if (sliderPlumbLayoutScheduled) return;
  sliderPlumbLayoutScheduled = true;
  requestAnimationFrame(() => {
    sliderPlumbLayoutScheduled = false;
    const hueSlider = document.getElementById('hue-slider');
    if (hueSlider) updateHuePlumb(parseInt(hueSlider.value, 10));
    const soundSlider = document.getElementById('sound-slider');
    if (soundSlider) updateSoundStepUI(parseInt(soundSlider.value, 10));
  });
}

function initSliderPlumbSync() {
  window.addEventListener('resize', scheduleSliderPlumbLayout);
  const wrap = document.getElementById('hue-slider-wrap');
  const lane = document.getElementById('sound-slider-lane');
  if (typeof ResizeObserver === 'undefined') return;
  const ro = new ResizeObserver(() => scheduleSliderPlumbLayout());
  if (wrap) ro.observe(wrap);
  if (lane) ro.observe(lane);
}

function trackIdToStepIndex(trackId) {
  if (!trackId) return 0;
  const i = SOUND_STEPS.findIndex((s) => s.id === trackId);
  return i >= 0 ? i : 0;
}

function stepIndexToTrackId(index) {
  const clamped = Math.max(0, Math.min(SOUND_STEPS.length - 1, index | 0));
  return SOUND_STEPS[clamped].id;
}

// Device status: each poll hits Particle (up to 3 ping calls per family). Kept conservative;
// polling pauses while the tab is hidden. Raise interval if you need fewer API operations.
const POLL_INTERVAL_MS = 15000;
const INIT_FETCH_TIMEOUT_MS = 8000;  // hide loading screen after this even if API hangs

let devicePollIntervalId = null;

function loadFromStorage() {
  try {
    const key = 'photon-state-' + getSetupId();
    const saved = localStorage.getItem(key);
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
    const key = 'photon-state-' + getSetupId();
    localStorage.setItem(key, JSON.stringify({
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
    const q = { setup: getSetupId() };
    if (params.get('master') !== null) q.master = params.get('master');
    if (params.get('light') !== null) q.light = params.get('light');
    if (params.get('sound') !== null) q.sound = params.get('sound');
    const query = '?' + new URLSearchParams(q).toString();
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

function getSaveButtonIdleState() {
  const { master, light, sound } = state.devices;
  const canSave = master && (light || sound);
  return {
    disabled: !canSave,
    label: !canSave ? (master ? 'No devices available' : 'Master offline') : 'Save emotion',
  };
}

function applyDeviceStatus() {
  const { master, light, sound } = state.devices;

  const screenMasterOffline = document.getElementById('screen-master-offline');
  const screenPersonalize = document.getElementById('screen-personalize');

  // Master unreachable: still show personalize so hue/sound changes persist to localStorage and sliders work.
  // Cloud preview/sync stay gated on state.devices.master (syncToPhoton / save).
  if (!master) {
    document.body.classList.add('personalize-master-unreachable');
    if (screenMasterOffline) {
      screenMasterOffline.hidden = false;
      screenMasterOffline.style.display = '';
    }
    if (screenPersonalize) {
      screenPersonalize.hidden = false;
      screenPersonalize.style.display = '';
    }
  } else {
    document.body.classList.remove('personalize-master-unreachable');
    if (screenMasterOffline) {
      screenMasterOffline.hidden = true;
      screenMasterOffline.style.display = 'none';
    }
    if (screenPersonalize) {
      screenPersonalize.hidden = false;
      screenPersonalize.style.display = '';
    }
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

  const saveBtn = document.getElementById('save-to-device');
  if (saveBtn) {
    const idle = getSaveButtonIdleState();
    saveBtn.disabled = idle.disabled;
    saveBtn.classList.toggle('save-disabled', idle.disabled);
    saveBtn.textContent = idle.label;
  }

  scheduleSliderPlumbLayout();
}

function syncToPhoton(emotion, personalizing = false) {
  if (!state.devices.master) return;
  const errEl = document.getElementById('save-error');
  const s = state[emotion];
  const payload = {
    setup: getSetupId(),
    emotion,
    hue: s.hue,
    selectedTrack: s.selectedTrack || '',
    personalizing: !!personalizing,
  };
  if (personalizing) payload.previewDurationSec = 20;  // 20 seconds for admin
  fetch('/api/photon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((d) => Promise.reject(d));
      if (personalizing && errEl) {
        errEl.textContent = '';
        errEl.hidden = true;
      }
    })
    .catch((err) => {
      console.warn('Photon sync failed:', err?.error || err);
      if (personalizing && errEl) {
        errEl.textContent =
          err?.error ||
          (typeof err === 'string' ? err : '') ||
          'Preview could not reach the device. Check Vercel env (PARTICLE_*_SETUP2 / _SETUP3) and token.';
        errEl.hidden = false;
      }
    });
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
  initSoundSlider();
  initSaveButton();
  initSliderPlumbSync();
  applyStateToUI();
  applyDeviceStatus();  // Show master-offline by default (avoids blink when master is offline)
  initDeviceStatus();
  scheduleSliderPlumbLayout();
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

  const pollDeviceStatusOnce = async () => {
    await fetchDeviceStatus();
    applyDeviceStatus();
  };

  const startDevicePolling = () => {
    if (devicePollIntervalId !== null) return;
    devicePollIntervalId = setInterval(pollDeviceStatusOnce, POLL_INTERVAL_MS);
  };

  const stopDevicePolling = () => {
    if (devicePollIntervalId !== null) {
      clearInterval(devicePollIntervalId);
      devicePollIntervalId = null;
    }
  };

  if (!document.hidden) startDevicePolling();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopDevicePolling();
    } else {
      pollDeviceStatusOnce();
      startDevicePolling();
    }
  });
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
  // White base + 20% hue overlay. Firmware: light 30%/55%, saturated 95%/95%.
  const light = hslToRgb(hue, 30, 55);
  const lightSection = document.getElementById('light-section');
  if (lightSection) {
    lightSection.style.setProperty('--light-bg-color', `rgba(${light[0]}, ${light[1]}, ${light[2]}, 0.2)`);
  }
}

function applyStateToUI() {
  const s = getCurrentState();
  const hueSlider = document.getElementById('hue-slider');
  if (hueSlider) {
    hueSlider.value = s.hue;
    updateHuePreview(s.hue);
    updateHuePlumb(s.hue);
  }
  const soundSlider = document.getElementById('sound-slider');
  if (soundSlider) {
    const idx = trackIdToStepIndex(s.selectedTrack);
    soundSlider.value = String(idx);
    updateSoundStepUI(idx);
  }
  updateEmotionPickerUI();
}

function updateHuePlumb(hue) {
  const wrap = document.getElementById('hue-slider-wrap');
  const hueSlider = document.getElementById('hue-slider');
  const h = typeof hue === 'number' ? hue : parseInt(hueSlider?.value || '0', 10);
  if (wrap && hueSlider && !Number.isNaN(h)) {
    const norm = h / 360;
    const pct = thumbCenterPercentFromNorm(hueSlider, norm);
    wrap.style.setProperty('--hue-pct', `${pct}%`);
  }
}

function updateSoundStepUI(stepIndex) {
  const nameEl = document.getElementById('sound-current-name');
  const soundSlider = document.getElementById('sound-slider');
  const lane = document.getElementById('sound-slider-lane');
  const step = SOUND_STEPS[stepIndex];
  if (nameEl && step) nameEl.textContent = step.label;
  if (soundSlider && step) soundSlider.setAttribute('aria-valuetext', step.label);
  if (lane && soundSlider) {
    const norm = Math.max(0, Math.min(1, stepIndex / 8));
    const pct = thumbCenterPercentFromNorm(soundSlider, norm);
    lane.style.setProperty('--sound-pct', `${pct}%`);
  }
  document.querySelectorAll('.sound-step').forEach((el, i) => {
    el.classList.toggle('is-active', i === stepIndex);
  });
  updateSoundCardBackground(stepIndex);
}

/** Card area dot density follows slider: calm = sparse small dots, intense = dense larger dots */
function updateSoundCardBackground(stepIndex) {
  const section = document.getElementById('sound-section');
  if (!section) return;
  const t = Math.max(0, Math.min(1, stepIndex / 8));
  const cell = 28 - t * 19;
  const dot = 0.9 + t * 2.4;
  section.style.setProperty('--sound-card-cell', `${cell}px`);
  section.style.setProperty('--sound-card-dot', `${dot}px`);
}

function updateEmotionPickerUI() {
  document.querySelectorAll('.emotion-pick').forEach((btn) => {
    const em = btn.dataset.emotion;
    const on = state.emotion === em;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = (em === 'positive' ? 'positive' : 'negative').replace(/,/g, '');
  });
}

function initEmotionToggle() {
  updateEmotionPickerUI();
  const buttons = document.querySelectorAll('.emotion-pick');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.emotion = btn.dataset.emotion;
      updateEmotionPickerUI();
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
    updateHuePlumb(hue);
  });
  hueSlider.addEventListener('change', () => {
    const hue = parseInt(hueSlider.value, 10);
    setCurrentState({ hue });
  });
}

function initSoundSlider() {
  const soundSlider = document.getElementById('sound-slider');
  if (!soundSlider) return;

  soundSlider.addEventListener('input', () => {
    const idx = parseInt(soundSlider.value, 10);
    updateSoundStepUI(idx);
  });
  soundSlider.addEventListener('change', () => {
    const idx = parseInt(soundSlider.value, 10);
    const trackId = stepIndexToTrackId(idx);
    setCurrentState({ selectedTrack: trackId });
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
      body: JSON.stringify({
        action: 'save',
        setup: getSetupId(),
        positive: { hue: state.positive.hue, selectedTrack: state.positive.selectedTrack || '' },
        negative: { hue: state.negative.hue, selectedTrack: state.negative.selectedTrack || '' },
      }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.ok) {
          btn.textContent = 'Emotion saved!';
          clearError();
        } else {
          const idle = getSaveButtonIdleState();
          btn.textContent = idle.label;
          const msg = data.error || data.details?.error_description || JSON.stringify(data);
          showError(msg);
        }
        setTimeout(() => {
          const idle = getSaveButtonIdleState();
          btn.disabled = idle.disabled;
          btn.classList.toggle('save-disabled', idle.disabled);
          btn.textContent = idle.label;
        }, 3000);
      })
      .catch((err) => {
        const idle = getSaveButtonIdleState();
        btn.textContent = idle.label;
        showError(err?.message || 'Network error — check console');
        setTimeout(() => {
          const idle2 = getSaveButtonIdleState();
          btn.disabled = idle2.disabled;
          btn.classList.toggle('save-disabled', idle2.disabled);
          btn.textContent = idle2.label;
        }, 3000);
      });
  });
}

document.addEventListener('DOMContentLoaded', init);
