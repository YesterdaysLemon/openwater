export const presets = {
  trade: { wind: 12, swell: 1.2, sun: 35, foam: .45, rain: 0, cloud: .38, night: 0, warmth: 0 },
  golden: { wind: 8, swell: .8, sun: 6, foam: .25, rain: 0, cloud: .28, night: 0, warmth: 1 },
  storm: { wind: 26, swell: 2.9, sun: 20, foam: .9, rain: .8, cloud: .94, night: 0, warmth: 0 },
  moon: { wind: 7, swell: .7, sun: 24, foam: .2, rain: 0, cloud: .25, night: 1, warmth: 0 },
};
export const ranges = { wind: [0, 30], swell: [.15, 3.5], sun: [2, 75], foam: [0, 1], rain: [0, 1] };
export function readState(search = '') {
  const p = new URLSearchParams(search);
  const weather = Object.hasOwn(presets, p.get('weather')) ? p.get('weather') : 'trade';
  const state = { ...presets[weather], weather, view: 'cove', ship: true, quality: 'balanced' };
  if (['cove', 'sea', 'sail'].includes(p.get('view'))) state.view = p.get('view');
  if (['balanced', 'high', 'ultra'].includes(p.get('quality'))) state.quality = p.get('quality');
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (p.has(key) && Number.isFinite(Number(p.get(key)))) state[key] = Math.max(min, Math.min(max, Number(p.get(key))));
  }
  if (p.get('ship') === '0') state.ship = false;
  return state;
}
export function writeState(state) {
  const p = new URLSearchParams({ weather: state.weather, view: state.view });
  for (const key of Object.keys(ranges)) p.set(key, String(state[key]));
  p.set('ship', state.ship ? '1' : '0');
  return p.toString();
}
// Same deterministic directional spectrum is used on the CPU for buoyancy and in GLSL.
export function sampleWave(x, z, time, swell = 1.2, wind = 12) {
  let height = 0;
  for (let i = 0; i < 12; i++) {
    const angle = .58 + Math.sin(i * 1.913) * 1.22;
    const k = .14 * Math.pow(1.36, i);
    const a = .43 * Math.pow(.66, i) * swell;
    const phase = k * (Math.cos(angle) * x + Math.sin(angle) * z) - Math.sqrt(9.81 * k) * time * (.65 + wind * .026) + i * 2.43;
    height += a * Math.sin(phase);
  }
  return height;
}
