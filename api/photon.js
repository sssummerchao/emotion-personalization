/**
 * Vercel serverless function: forwards web state to Particle device
 * Requires env: PARTICLE_ACCESS_TOKEN, PARTICLE_DEVICE_ID (and _SETUP1–3 per family)
 */
import { getMasterDeviceId } from './deviceEnv.js';

export default async function handler(req, res) {
  const token = process.env.PARTICLE_ACCESS_TOKEN;

  // Diagnostic: GET /api/photon shows if env vars are loaded (for debugging)
  if (req.method === 'GET') {
    const d0 = getMasterDeviceId(0);
    const d1 = getMasterDeviceId(1);
    const d2 = getMasterDeviceId(2);
    const d3 = getMasterDeviceId(3);
    const anyMaster = !!(d0 || d1 || d2 || d3);
    return res.status(200).json({
      configured: !!token && anyMaster,
      hasToken: !!token,
      setup0: { hasDeviceId: !!d0 },
      setup1: { hasDeviceId: !!d1 },
      setup2: { hasDeviceId: !!d2 },
      setup3: { hasDeviceId: !!d3 },
      hint: !token ? 'Set PARTICLE_ACCESS_TOKEN' : !anyMaster ? 'Set PARTICLE_DEVICE_ID and/or PARTICLE_DEVICE_ID_SETUP1/2/3' : undefined,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  const { action, emotion, hue, selectedTrack, personalizing, previewDurationSec, setup } = body || {};
  const deviceId = getMasterDeviceId(setup);

  if (!token || !deviceId) {
    return res.status(500).json({
      error: 'Server not configured. Set PARTICLE_ACCESS_TOKEN and the master PARTICLE_DEVICE_ID for this family (or _SETUP1 / _SETUP2 / _SETUP3) in Vercel environment variables.',
    });
  }

  if (action === 'save') {
    const arg = JSON.stringify({ save: true });
    try {
      const resp = await fetch(
        `https://api.particle.io/v1/devices/${deviceId}/setState`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ access_token: token, arg }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const errMsg = data.error_description || data.error || `Particle API error (${resp.status})`;
        return res.status(resp.status).json({
          error: errMsg,
          details: data,
        });
      }
      return res.status(200).json({ ok: true, saved: true });
    } catch (err) {
      console.error('Photon save error:', err);
      return res.status(500).json({ error: 'Failed to reach Particle cloud' });
    }
  }

  if (!emotion || hue === undefined) {
    return res.status(400).json({ error: 'Missing emotion or hue' });
  }

  // Track: send both ID (0001) and number (1) for DFPlayer play(n)
  const trackNum = selectedTrack ? parseInt(selectedTrack, 10) || 1 : 1;
  const argObj = {
    e: emotion,
    h: hue,
    t: selectedTrack || '',
    n: trackNum,
    m: 50,
    p: !!personalizing,
  };
  if (personalizing && previewDurationSec) argObj.d = previewDurationSec;  // 20s preview for admin
  const arg = JSON.stringify(argObj);

  try {
    const resp = await fetch(
      `https://api.particle.io/v1/devices/${deviceId}/setState`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: token,
          arg,
        }),
      }
    );

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const errMsg = data.error_description || data.error || `Particle API error (${resp.status})`;
      return res.status(resp.status).json({
        error: errMsg,
        details: data,
      });
    }
    return res.status(200).json({ ok: true, return_value: data.return_value });
  } catch (err) {
    console.error('Photon API error:', err);
    return res.status(500).json({ error: 'Failed to reach Particle cloud' });
  }
}
