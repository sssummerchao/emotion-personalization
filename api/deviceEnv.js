/**
 * Map setup index (0–3) to Particle device ID env vars — Families A–D.
 * Web setup index is not the same as firmware PHOTON_SETUP_ID: Families C & D use
 * PARTICLE_*_SETUP2 and PARTICLE_*_SETUP3 here (Pair 1 devices still use photon/state/1 in firmware).
 */
const MASTER_KEYS = [
  'PARTICLE_DEVICE_ID',
  'PARTICLE_DEVICE_ID_SETUP1',
  'PARTICLE_DEVICE_ID_SETUP2',
  'PARTICLE_DEVICE_ID_SETUP3',
];
const LIGHT_KEYS = [
  'PARTICLE_LIGHT_DEVICE_ID',
  'PARTICLE_LIGHT_DEVICE_ID_SETUP1',
  'PARTICLE_LIGHT_DEVICE_ID_SETUP2',
  'PARTICLE_LIGHT_DEVICE_ID_SETUP3',
];
const SOUND_KEYS = [
  'PARTICLE_SOUND_DEVICE_ID',
  'PARTICLE_SOUND_DEVICE_ID_SETUP1',
  'PARTICLE_SOUND_DEVICE_ID_SETUP2',
  'PARTICLE_SOUND_DEVICE_ID_SETUP3',
];

function clampSetup(setup) {
  const s = parseInt(setup, 10) || 0;
  return Math.min(Math.max(s, 0), MASTER_KEYS.length - 1);
}

export function getMasterDeviceId(setup) {
  const s = clampSetup(setup);
  const id = process.env[MASTER_KEYS[s]];
  if (id) return id;
  // Optional aliases if SETUP2/SETUP3 were not added in Vercel
  if (s === 2) return process.env.PARTICLE_DEVICE_ID_FAMILY_C;
  if (s === 3) return process.env.PARTICLE_DEVICE_ID_FAMILY_D;
  return undefined;
}

export function getLightDeviceId(setup) {
  const s = clampSetup(setup);
  const id = process.env[LIGHT_KEYS[s]];
  if (id) return id;
  if (s === 2) return process.env.PARTICLE_LIGHT_DEVICE_ID_FAMILY_C;
  if (s === 3) return process.env.PARTICLE_LIGHT_DEVICE_ID_FAMILY_D;
  return undefined;
}

export function getSoundDeviceId(setup) {
  const s = clampSetup(setup);
  const id = process.env[SOUND_KEYS[s]];
  if (id) return id;
  if (s === 2) return process.env.PARTICLE_SOUND_DEVICE_ID_FAMILY_C;
  if (s === 3) return process.env.PARTICLE_SOUND_DEVICE_ID_FAMILY_D;
  return undefined;
}
