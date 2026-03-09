/**
 * Uses Particle Ping API - actively checks if device responds. Most reliable method.
 * GET /v1/devices/:id can report stale "online: true"; Ping actually reaches the device.
 */
async function pingDevice(token, deviceId) {
  if (!token || !deviceId) return { online: null };
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}/ping`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json().catch(() => ({}));
    if (typeof data.online === 'boolean') return { online: data.online };
    // Particle may return { ok: false } or error when offline
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
  const masterId = process.env.PARTICLE_DEVICE_ID;
  const lightId = process.env.PARTICLE_LIGHT_DEVICE_ID;
  const soundId = process.env.PARTICLE_SOUND_DEVICE_ID;

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

  // Fetch each device from Particle; null = unknown → default true (allow use)
  let masterOnline = true;
  let lightOnline = true;
  let soundOnline = true;

  // Ping all devices in parallel for accurate real-time status
  const [masterResult, lightResult, soundResult] = await Promise.all([
    pingDevice(token, masterId),
    lightId ? pingDevice(token, lightId) : { online: null },
    soundId ? pingDevice(token, soundId) : { online: null },
  ]);

  if (masterResult.online !== null) masterOnline = masterResult.online;
  if (lightResult.online !== null) lightOnline = lightResult.online;
  if (soundResult.online !== null) soundOnline = soundResult.online;

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
