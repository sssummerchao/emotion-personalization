/**
 * Vercel serverless: GET sensor data (mic, ambient, lux) from Particle devices
 * Requires: PARTICLE_ACCESS_TOKEN, PARTICLE_LIGHT_DEVICE_ID (and _SETUP1–3 per family)
 */
import { getLightDeviceId, getSoundDeviceId } from './deviceEnv.js';

function getDeviceIds(setup) {
  return {
    light: getLightDeviceId(setup),
    sound: getSoundDeviceId(setup),
  };
}

async function getVariable(token, deviceId, name) {
  if (!token || !deviceId) return { value: null, err: null };
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}/${name}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json();
    if (data.result !== undefined) return { value: data.result, err: null };
    return { value: null, err: data.error || data.error_description || `HTTP ${resp.status}` };
  } catch (e) {
    return { value: null, err: String(e.message || e) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PARTICLE_ACCESS_TOKEN;
  const setup = parseInt(req.query?.setup, 10) || 0;
  const { light: lightId, sound: soundId } = getDeviceIds(setup);

  if (!token) {
    return res.status(500).json({
      error: 'PARTICLE_ACCESS_TOKEN not set. For local: add to web/.env.local and run "npx vercel dev". For deployed: set in Vercel → Project → Settings → Environment Variables.',
    });
  }

  const [rLux, rLightMic, rSoundMic, rAmbient] = await Promise.all([
    lightId ? getVariable(token, lightId, 'lux') : { value: null, err: null },
    lightId ? getVariable(token, lightId, 'mic') : { value: null, err: null },
    soundId ? getVariable(token, soundId, 'mic') : { value: null, err: null },
    soundId ? getVariable(token, soundId, 'ambient') : { value: null, err: null },
  ]);

  const out = {
    light: lightId ? { lux: rLux.value, mic: rLightMic.value } : null,
    sound: soundId ? { mic: rSoundMic.value, ambient: rAmbient.value } : null,
    setup,
  };
  if (req.query?.debug === '1' || req.query?.debug === 'true') {
    out._debug = {
      hasToken: !!token,
      lightId: lightId || null,
      soundId: soundId || null,
      particleErrors: [rLux.err, rLightMic.err, rSoundMic.err, rAmbient.err].filter(Boolean),
    };
  }
  return res.status(200).json(out);
}
