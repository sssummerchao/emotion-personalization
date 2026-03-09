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

/** Fallback when Ping returns false: if GET says online, trust it (avoids false offline from Ping timeout). */
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
    return online;
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

  const soundPingId = soundId && soundId !== masterId ? soundId : null;
  const [masterResult, lightResult, soundResult] = await Promise.all([
    pingDevice(token, masterId),
    lightId && lightId !== masterId ? pingDevice(token, lightId) : { online: null },
    soundPingId ? pingDevice(token, soundPingId) : { online: null },
  ]);

  if (masterResult.online !== null) masterOnline = masterResult.online;
  if (lightId === masterId) {
    lightOnline = masterOnline;
  } else if (lightResult.online === true) {
    lightOnline = true;
  } else if (lightResult.online === false) {
    const lightGet = await getDeviceOnline(token, lightId);
    lightOnline = lightGet === false ? false : true;  // assume online if GET can't confirm offline
  }
  if (soundId === masterId || !soundId) {
    soundOnline = masterOnline;
  } else if (soundResult.online === true) {
    soundOnline = true;
  } else if (soundResult.online === false) {
    const soundGet = await getDeviceOnline(token, soundId);
    soundOnline = soundGet === false ? false : true;  // assume online if GET can't confirm offline
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
