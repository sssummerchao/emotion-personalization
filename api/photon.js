/**
 * Vercel serverless function: forwards web state to Particle device
 * Requires env: PARTICLE_ACCESS_TOKEN, PARTICLE_DEVICE_ID
 */
export default async function handler(req, res) {
  const token = process.env.PARTICLE_ACCESS_TOKEN;
  const deviceId = process.env.PARTICLE_DEVICE_ID;

  // Diagnostic: GET /api/photon shows if env vars are loaded (for debugging)
  if (req.method === 'GET') {
    const hasToken = !!token;
    const hasDeviceId = !!deviceId;
    return res.status(200).json({
      configured: hasToken && hasDeviceId,
      hasToken,
      hasDeviceId,
      hint: !hasToken || !hasDeviceId
        ? 'Add variables in Project Settings (not Team), then redeploy'
        : undefined,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!token || !deviceId) {
    return res.status(500).json({
      error: 'Server not configured. Set PARTICLE_ACCESS_TOKEN and PARTICLE_DEVICE_ID in Vercel environment variables.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  const { action, emotion, hue, selectedTrack, motorSpeed, personalizing } = body || {};

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
  const arg = JSON.stringify({
    e: emotion,
    h: hue,
    t: selectedTrack || '',
    n: trackNum,
    m: motorSpeed ?? 50,
    p: !!personalizing,
  });

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
