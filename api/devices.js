/** Max seconds since last contact to consider device online. Particle keep-alive ~25–30s. */
const STALE_THRESHOLD_SEC = 90;

function parseTimestamp(ts) {
  if (!ts || typeof ts !== 'string') return null;
  const ms = new Date(ts).getTime();
  return isNaN(ms) ? null : ms;
}

async function fetchDeviceStatus(token, deviceId, forDebug) {
  if (!token || !deviceId) return { online: null };
  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}?access_token=${token}`
    );
    const data = await resp.json().catch(() => ({}));
    if (!data.id) return { online: null };

    const online = data.online ?? data.connected;
    if (typeof online !== 'boolean') return { online: null };

    // Trust online: false. When online: true, check freshness—Particle can be slow to update.
    let result = online;
    const lastHeardMs = parseTimestamp(data.last_heard) ?? parseTimestamp(data.last_handshake_at);
    if (online && lastHeardMs) {
      const ageSec = (Date.now() - lastHeardMs) / 1000;
      if (ageSec > STALE_THRESHOLD_SEC) result = false; // stale → offline
    }

    const out = { online: result };
    if (forDebug) {
      out._raw = {
        online,
        last_heard: data.last_heard ?? null,
        last_handshake_at: data.last_handshake_at ?? null,
        age_sec: lastHeardMs ? Math.round((Date.now() - lastHeardMs) / 1000) : null,
      };
    }
    return out;
  } catch {}
  return { online: null };
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

  const masterResult = await fetchDeviceStatus(token, masterId, debug);
  if (masterResult.online !== null) masterOnline = masterResult.online;

  let lightResult = { online: null };
  if (lightId) {
    lightResult = await fetchDeviceStatus(token, lightId, debug);
    if (lightResult.online !== null) lightOnline = lightResult.online;
  }

  let soundResult = { online: null };
  if (soundId) {
    soundResult = await fetchDeviceStatus(token, soundId, debug);
    if (soundResult.online !== null) soundOnline = soundResult.online;
  }

  const out = { master: masterOnline, light: lightOnline, sound: soundOnline };
  if (debug) {
    out._debug = {
      hasMasterId: !!masterId,
      hasLightId: !!lightId,
      hasSoundId: !!soundId,
      hasToken: !!token,
      master: masterResult._raw,
      light: lightResult._raw,
      sound: soundResult._raw,
    };
  }
  return res.status(200).json(out);
}
