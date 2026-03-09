/** Ping: reliable for offline, but can timeout and wrongly return false for online devices. */
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

/** GET device info: fast, good for online detection. When online=true + recent last_heard, trust it. */
const STALE_SEC = 120;
async function getDeviceOnline(token, deviceId) {
  if (!token || !deviceId) return null;
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json().catch(() => ({}));
    const online = data.online ?? data.connected;
    if (typeof online !== 'boolean') return null;
    if (!online) return false;
    const lastHeard = data.last_heard || data.last_handshake_at;
    if (lastHeard) {
      const age = (Date.now() - new Date(lastHeard).getTime()) / 1000;
      if (age > STALE_SEC) return false;
    }
    return true;
  } catch {
    return null;
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

  // Master: Ping. Light/sound: GET (faster, more reliable for online detection; Ping can timeout).
  const [masterResult, lightGet, soundGet] = await Promise.all([
    pingDevice(token, masterId),
    lightId && lightId !== masterId ? getDeviceOnline(token, lightId) : Promise.resolve(null),
    soundId && soundId !== masterId ? getDeviceOnline(token, soundId) : Promise.resolve(null),
  ]);

  if (masterResult.online !== null) masterOnline = masterResult.online;
  if (lightId === masterId) {
    lightOnline = masterOnline;
  } else if (lightGet !== null) {
    lightOnline = lightGet;
  }
  if (soundId === masterId || !soundId) {
    soundOnline = masterOnline;
  } else if (soundGet !== null) {
    soundOnline = soundGet;
  }

  const out = { master: masterOnline, light: lightOnline, sound: soundOnline };
  if (debug) {
    out._debug = {
      hasMasterId: !!masterId,
      hasLightId: !!lightId,
      hasSoundId: !!soundId,
      hasToken: !!token,
      master: masterResult.online,
      light: lightGet,
      sound: soundGet,
    };
  }
  return res.status(200).json(out);
}
