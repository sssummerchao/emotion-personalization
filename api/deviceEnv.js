/**
 * Map setup index (0–3) to Particle device ID env vars — Families A–D.
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
  return process.env[MASTER_KEYS[clampSetup(setup)]];
}

export function getLightDeviceId(setup) {
  return process.env[LIGHT_KEYS[clampSetup(setup)]];
}

export function getSoundDeviceId(setup) {
  return process.env[SOUND_KEYS[clampSetup(setup)]];
}
