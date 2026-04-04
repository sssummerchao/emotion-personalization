/**
 * Photon Calibration Page
 * Real-time mic and lux sensor display; edit thresholds for audio and light devices.
 * Polls on an interval to limit Particle data operations (4 variable GETs per poll).
 * Stops polling when page is closed or hidden.
 */
const POLL_INTERVAL_MS = 10000;   // 10s
let pollIntervalId = null;
let fetchAbortController = null;

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

function particleLightEnvName(setup) {
  const s = parseInt(setup, 10) || 0;
  if (s === 0) return 'PARTICLE_LIGHT_DEVICE_ID';
  return `PARTICLE_LIGHT_DEVICE_ID_SETUP${s}`;
}

function particleSoundEnvName(setup) {
  const s = parseInt(setup, 10) || 0;
  if (s === 0) return 'PARTICLE_SOUND_DEVICE_ID';
  return `PARTICLE_SOUND_DEVICE_ID_SETUP${s}`;
}

/** Main personalization URL for setup index (matches family-a … family-d pages). */
function personalizationPageForSetup(setup) {
  const pages = ['family-a.html', 'family-b.html', 'family-c.html', 'family-d.html'];
  const s = parseInt(setup, 10) || 0;
  return pages[s] || 'family-a.html';
}

function fmt(num) {
  if (num === null || num === undefined) return '—';
  const n = parseFloat(num);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(0);
}

async function fetchSensors() {
  if (fetchAbortController) fetchAbortController.abort();
  fetchAbortController = new AbortController();
  const setup = getSetupId();
  const url = `/api/sensors?setup=${setup}&debug=1`;
  const resp = await fetch(url, { signal: fetchAbortController.signal });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error || `Sensors API error: ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

function updateSensorDisplay(data) {
  const micEl = document.getElementById('sensor-mic');
  const ambientEl = document.getElementById('sensor-ambient');
  const luxEl = document.getElementById('sensor-lux');

  const sound = data?.sound;
  const light = data?.light;

  if (micEl) micEl.textContent = fmt(sound?.mic ?? light?.mic);
  if (ambientEl) ambientEl.textContent = fmt(sound?.ambient);
  if (luxEl) luxEl.textContent = fmt(light?.lux);
}

async function saveThresholds() {
  const errEl = document.getElementById('save-error');
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = '';
  }

  const audio = {
    micQuiet: parseFloat(document.getElementById('audio-micQuiet')?.value) || 400,
    micLoud: parseFloat(document.getElementById('audio-micLoud')?.value) || 600,
    dStep: parseFloat(document.getElementById('audio-dStep')?.value) || 20,
  };
  const light = {
    luxDark: parseFloat(document.getElementById('light-luxDark')?.value) || 40,
    luxBright: parseFloat(document.getElementById('light-luxBright')?.value) || 200,
    soundQuiet: parseFloat(document.getElementById('light-soundQuiet')?.value) || 300,
    soundLoud: parseFloat(document.getElementById('light-soundLoud')?.value) || 1000,
  };

  const setup = getSetupId();
  const resp = await fetch('/api/thresholds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setup, audio, light }),
  });

  const result = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = result?.error || `Failed to save (${resp.status})`;
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
    return;
  }

  const failures = [];
  if (result.audio && !result.audio.ok) failures.push('Audio: ' + (result.audio.error || 'failed'));
  if (result.light && !result.light.ok) failures.push('Light: ' + (result.light.error || 'failed'));

  if (failures.length) {
    if (errEl) {
      errEl.textContent = failures.join('; ');
      errEl.hidden = false;
    }
  } else if (errEl) {
    errEl.textContent = 'Saved.';
    errEl.hidden = false;
    errEl.style.color = 'var(--color-primary)';
    setTimeout(() => { errEl.hidden = true; }, 2000);
  }
}

function setStatus(msg, isError) {
  const el = document.getElementById('sensor-status');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#c00' : 'var(--color-primary)';
  }
}

function poll() {
  const setup = getSetupId();
  fetchSensors()
    .then((data) => {
      updateSensorDisplay(data);
      const debug = data._debug;
      if (debug && (!debug.lightId || !debug.soundId)) {
        const missing = [];
        if (!debug.lightId) missing.push(particleLightEnvName(setup));
        if (!debug.soundId) missing.push(particleSoundEnvName(setup));
        setStatus(`Missing env: ${missing.join(', ')}. Add to .env.local (vercel dev) or Vercel. Use ?setup=N (0–3) or family-a/b/c/d.html.`, true);
      } else if (data.sound || data.light) {
        const hasData = [data.sound?.mic, data.sound?.ambient, data.light?.lux].some(v => v != null);
        const errs = data._debug?.particleErrors;
        if (hasData) {
          setStatus('Connected');
        } else if (errs && errs.length) {
          setStatus(`Particle API: ${errs.join('; ')}. If "variable not found", reflash with firmware that has Particle.variable.`, true);
        } else {
          setStatus('No data yet. Reflash light & audio with firmware that includes Particle.variable("mic","ambient","lux").', true);
        }
      } else {
        setStatus('');
      }
    })
    .catch((err) => {
      if (err?.name === 'AbortError') return;
      updateSensorDisplay({});
      setStatus(`API error: ${err.message}`, true);
    });
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  if (fetchAbortController) {
    fetchAbortController.abort();
    fetchAbortController = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Support setup from URL
  const params = new URLSearchParams(window.location.search);
  const setup = params.get('setup');
  if (setup !== null) document.body.setAttribute('data-setup', setup);

  function startPolling() {
    stopPolling();
    poll();
    pollIntervalId = setInterval(poll, POLL_INTERVAL_MS);
  }

  startPolling();

  // Stop polling when page is closed or hidden; resume when visible again
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  window.addEventListener('pagehide', stopPolling);
  window.addEventListener('beforeunload', stopPolling);

  const saveBtn = document.getElementById('save-thresholds');
  if (saveBtn) saveBtn.addEventListener('click', saveThresholds);

  const questionsLink = document.querySelector('.info-links a[href*="questions"]');
  if (questionsLink) {
    questionsLink.href = 'questions.html?return=' + personalizationPageForSetup(getSetupId());
  }
});
