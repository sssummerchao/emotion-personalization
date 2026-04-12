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

/** Trim; empty after trim → undefined (avoids broken Particle calls from pasted newlines/spaces). */
function envId(key) {
  const v = process.env[key];
  if (v == null || typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

function clampSetup(setup) {
  const s = parseInt(setup, 10) || 0;
  return Math.min(Math.max(s, 0), MASTER_KEYS.length - 1);
}

function legacyFamilyCUsesSetup1Slot() {
  // Common misconfig: only PARTICLE_*_SETUP1 is set for "the second home" while using family-c.html (web index 2).
  // If SETUP2 is unset, fall back to SETUP1 so C works; Family B will then share the same IDs (avoid if you use both B and C with different devices).
  if (envId('PARTICLE_DEVICE_ID_SETUP2')) return undefined;
  return envId('PARTICLE_DEVICE_ID_SETUP1');
}

function legacyFamilyDUsesSetup2Slot() {
  if (envId('PARTICLE_DEVICE_ID_SETUP3')) return undefined;
  return envId('PARTICLE_DEVICE_ID_SETUP2');
}

function legacyFamilyDUsesSetup1Slot() {
  if (envId('PARTICLE_DEVICE_ID_SETUP3')) return undefined;
  if (envId('PARTICLE_DEVICE_ID_SETUP2')) return undefined;
  return envId('PARTICLE_DEVICE_ID_SETUP1');
}

/** Web body `setup` (0–3) → clamped index for env lookup */
export function resolveSetup(setup) {
  return clampSetup(setup);
}

export function getMasterDeviceId(setup) {
  const s = clampSetup(setup);
  const id = envId(MASTER_KEYS[s]);
  if (id) return id;
  if (s === 2) return envId('PARTICLE_DEVICE_ID_FAMILY_C') || legacyFamilyCUsesSetup1Slot();
  if (s === 3) {
    return envId('PARTICLE_DEVICE_ID_FAMILY_D')
      || legacyFamilyDUsesSetup2Slot()
      || legacyFamilyDUsesSetup1Slot();
  }
  return undefined;
}

function legacyLightC() {
  if (envId('PARTICLE_LIGHT_DEVICE_ID_SETUP2')) return undefined;
  return envId('PARTICLE_LIGHT_DEVICE_ID_SETUP1');
}

function legacyLightD() {
  if (envId('PARTICLE_LIGHT_DEVICE_ID_SETUP3')) return undefined;
  return envId('PARTICLE_LIGHT_DEVICE_ID_SETUP2');
}

function legacyLightDSetup1() {
  if (envId('PARTICLE_LIGHT_DEVICE_ID_SETUP3')) return undefined;
  if (envId('PARTICLE_LIGHT_DEVICE_ID_SETUP2')) return undefined;
  return envId('PARTICLE_LIGHT_DEVICE_ID_SETUP1');
}

export function getLightDeviceId(setup) {
  const s = clampSetup(setup);
  const id = envId(LIGHT_KEYS[s]);
  if (id) return id;
  if (s === 2) return envId('PARTICLE_LIGHT_DEVICE_ID_FAMILY_C') || legacyLightC();
  if (s === 3) return envId('PARTICLE_LIGHT_DEVICE_ID_FAMILY_D') || legacyLightD() || legacyLightDSetup1();
  return undefined;
}

function legacySoundC() {
  if (envId('PARTICLE_SOUND_DEVICE_ID_SETUP2')) return undefined;
  return envId('PARTICLE_SOUND_DEVICE_ID_SETUP1');
}

function legacySoundD() {
  if (envId('PARTICLE_SOUND_DEVICE_ID_SETUP3')) return undefined;
  return envId('PARTICLE_SOUND_DEVICE_ID_SETUP2');
}

function legacySoundDSetup1() {
  if (envId('PARTICLE_SOUND_DEVICE_ID_SETUP3')) return undefined;
  if (envId('PARTICLE_SOUND_DEVICE_ID_SETUP2')) return undefined;
  return envId('PARTICLE_SOUND_DEVICE_ID_SETUP1');
}

export function getSoundDeviceId(setup) {
  const s = clampSetup(setup);
  const id = envId(SOUND_KEYS[s]);
  if (id) return id;
  if (s === 2) return envId('PARTICLE_SOUND_DEVICE_ID_FAMILY_C') || legacySoundC();
  if (s === 3) return envId('PARTICLE_SOUND_DEVICE_ID_FAMILY_D') || legacySoundD() || legacySoundDSetup1();
  return undefined;
}
