/**
 * Vercel serverless function: forwards web state to Particle device
 * Requires env: PARTICLE_ACCESS_TOKEN, PARTICLE_DEVICE_ID
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PARTICLE_ACCESS_TOKEN;
  const deviceId = process.env.PARTICLE_DEVICE_ID;

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
  const { emotion, colorScheme, selectedTrack, motorSpeed } = body || {};
  if (!emotion || !colorScheme) {
    return res.status(400).json({ error: 'Missing emotion or colorScheme' });
  }

  const arg = JSON.stringify({
    e: emotion,
    c: colorScheme,
    t: selectedTrack || '',
    m: motorSpeed ?? 50,
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

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data.error || 'Particle API error',
        details: data,
      });
    }
    return res.status(200).json({ ok: true, return_value: data.return_value });
  } catch (err) {
    console.error('Photon API error:', err);
    return res.status(500).json({ error: 'Failed to reach Particle cloud' });
  }
}
