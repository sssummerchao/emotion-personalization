/**
 * Vercel serverless function: returns device connection status
 * GET /api/devices returns { master, light, sound } for UI to show appropriate screens
 * Uses Particle API to check if master device is online; light/sound default to true
 *   until firmware exposes status variables.
 * Query params for testing: ?master=0 | ?light=0 | ?sound=0 (combinations supported)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PARTICLE_ACCESS_TOKEN;
  const deviceId = process.env.PARTICLE_DEVICE_ID;

  // Parse simulation query params
  const q = req.query;
  const parseBool = (v) => v !== '0' && v !== 'false';
  const masterParam = q.master;
  const lightParam = q.light;
  const soundParam = q.sound;

  let master = masterParam === undefined ? null : parseBool(masterParam);
  let light = lightParam === undefined ? null : parseBool(lightParam);
  let sound = soundParam === undefined ? null : parseBool(soundParam);

  // If any sim params provided, build response (default unspec to true for master, true for light/sound)
  if (masterParam !== undefined || lightParam !== undefined || soundParam !== undefined) {
    return res.status(200).json({
      master: master === null ? true : master,
      light: light === null ? true : light,
      sound: sound === null ? true : sound,
    });
  }

  // No sim: try Particle API for master status
  // Default true = allow personalization when we can't determine status (API error, no env, etc.)
  let masterOnline = true;
  if (token && deviceId) {
    try {
      const resp = await fetch(
        `https://api.particle.io/v1/devices/${deviceId}?access_token=${token}`
      );
      const data = await resp.json().catch(() => ({}));
      // Only show offline when we have a valid device response and it reports disconnected
      if (data.id && typeof data.connected === 'boolean') {
        masterOnline = data.connected;
      }
    } catch {
      // On fetch error, keep masterOnline = true so personalization still works
    }
  }

  return res.status(200).json({
    master: masterOnline,
    light: true,
    sound: true,
  });
}
