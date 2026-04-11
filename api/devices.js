import { getLightDeviceId, getMasterDeviceId, getSoundDeviceId } from './deviceEnv.js';

async function pingDevice(token, deviceId) {
  if (!token || !deviceId) return { online: null };
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}/ping`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json().catch(() => ({}));
    if (typeof data.online === 'boolean') return { online: data.online };
    if (resp.status === 404 || data.error) return { online: false };
    return { online: null };
  } catch {
    return { online: null };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PARTICLE_ACCESS_TOKEN;
  const setup = parseInt(req.query?.setup, 10) || 0;
  const masterId = getMasterDeviceId(setup);
  const lightId = getLightDeviceId(setup);
  const soundId = getSoundDeviceId(setup);

  const q = req.query;
  const parseBool = (v) => v !== '0' && v !== 'false';
  const masterParam = q.master;
  const lightParam = q.light;
  const soundParam = q.sound;
  const debug = q.debug === '1' || q.debug === 'true';

  if (masterParam !== undefined || lightParam !== undefined || soundParam !== undefined) {
    return res.status(200).json({
      master: masterParam === undefined ? true : parseBool(masterParam),
      light: lightParam === undefined ? true : parseBool(lightParam),
      sound: soundParam === undefined ? true : parseBool(soundParam),
    });
  }

  // Without token or master device ID, treat as offline (otherwise UI shows "online" but /api/photon cannot preview — common for Families C/D if SETUP2/SETUP3 env vars are missing).
  let masterOnline = false;
  let lightOnline = true;
  let soundOnline = true;

  const soundPingId = soundId && soundId !== masterId ? soundId : null;
  const [masterResult, lightResult, soundResult] = await Promise.all([
    pingDevice(token, masterId),
    lightId && lightId !== masterId ? pingDevice(token, lightId) : { online: null },
    soundPingId ? pingDevice(token, soundPingId) : { online: null },
  ]);

  if (token && masterId) {
    if (masterResult.online !== null) {
      masterOnline = masterResult.online;
    } else {
      masterOnline = true; // ping inconclusive — allow personalization UI
    }
  }
  if (lightId === masterId) {
    lightOnline = masterOnline;
  } else if (lightResult.online === true) {
    lightOnline = true;
  } else if (lightResult.online === false) {
    lightOnline = false;
  }
  if (soundId === masterId || !soundId) {
    soundOnline = masterOnline;
  } else if (soundResult.online === true) {
    soundOnline = true;
  } else if (soundResult.online === false) {
    soundOnline = false;
  }

  const out = { master: masterOnline, light: lightOnline, sound: soundOnline };
  if (debug) {
    out._debug = {
      hasMasterId: !!masterId,
      hasLightId: !!lightId,
      hasSoundId: !!soundId,
      hasToken: !!token,
      master: masterResult.online,
      light: lightResult.online,
      sound: soundResult.online,
    };
  }
  return res.status(200).json(out);
}
