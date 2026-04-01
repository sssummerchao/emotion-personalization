/**
 * Vercel serverless: POST threshold updates to Particle devices
 * Requires: PARTICLE_ACCESS_TOKEN, PARTICLE_LIGHT_DEVICE_ID (and _SETUP1–3 per family)
 */
import { getLightDeviceId, getSoundDeviceId } from './deviceEnv.js';

function getDeviceIds(setup) {
  return {
    light: getLightDeviceId(setup),
    sound: getSoundDeviceId(setup),
  };
}

async function callFunction(token, deviceId, fn, arg) {
  if (!token || !deviceId) return { ok: false, error: 'missing device' };
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}/${fn}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: token, arg }),
      }
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: data.error_description || data.error || `Particle API error (${resp.status})` };
    }
    return { ok: true, return_value: data.return_value };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PARTICLE_ACCESS_TOKEN;
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { setup, audio, light } = body || {};
  const deviceIds = getDeviceIds(parseInt(setup, 10) || 0);

  if (!token) {
    return res.status(500).json({
      error: 'Server not configured. Set PARTICLE_ACCESS_TOKEN.',
    });
  }

  const results = { audio: null, light: null };

  if (audio && deviceIds.sound) {
    const arg = JSON.stringify({
      micQuiet: audio.micQuiet,
      micLoud: audio.micLoud,
      dStep: audio.dStep,
    });
    results.audio = await callFunction(token, deviceIds.sound, 'setThresholds', arg);
  }

  if (light && deviceIds.light) {
    const arg = JSON.stringify({
      luxDark: light.luxDark,
      luxBright: light.luxBright,
      soundQuiet: light.soundQuiet,
      soundLoud: light.soundLoud,
    });
    results.light = await callFunction(token, deviceIds.light, 'setThresholds', arg);
  }

  const allOk = (!results.audio || results.audio.ok) && (!results.light || results.light.ok);
  return res.status(allOk ? 200 : 500).json(results);
}
