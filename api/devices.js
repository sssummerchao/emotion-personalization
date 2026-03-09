/**
 * Vercel serverless function: returns device connection status
 * GET /api/devices returns { master, light, sound } for UI to show appropriate screens
 * Uses Particle API to check each device's connected status.
 * Env vars: PARTICLE_ACCESS_TOKEN, PARTICLE_DEVICE_ID (master),
 *   PARTICLE_LIGHT_DEVICE_ID, PARTICLE_SOUND_DEVICE_ID (optional)
 * Query params for testing: ?master=0 | ?light=0 | ?sound=0
 */
async function fetchDeviceConnected(token, deviceId) {
  if (!token || !deviceId) return null;
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}?access_token=${token}`
    );
    const data = await resp.json().catch(() => ({}));
    if (data.id && typeof data.connected === 'boolean') return data.connected;
  } catch {}
  return null; // unknown
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

  const masterResult = await fetchDeviceConnected(token, masterId);
  if (masterResult !== null) masterOnline = masterResult;

  if (lightId) {
    const lightResult = await fetchDeviceConnected(token, lightId);
    if (lightResult !== null) lightOnline = lightResult;
  }

  if (soundId) {
    const soundResult = await fetchDeviceConnected(token, soundId);
    if (soundResult !== null) soundOnline = soundResult;
  }

  return res.status(200).json({
    master: masterOnline,
    light: lightOnline,
    sound: soundOnline,
  });
}
