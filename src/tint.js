/* One colour curve for every tinted Sahsih logo (the page wordmark and the
 * label printed on the 3D sachet). Input is the artwork's luminance, 0..1;
 * output blends the flavour's deep, accent and light colours so the
 * original's body tone lands exactly on the flavour colour, its shading on
 * the deep tone and its highlights on the light tone. Result: as saturated
 * and as glossy as the original pink-and-blue logo.
 */
const hexRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function tintRamp(flavour) {
  const deep = hexRgb(flavour.deep);
  const accent = hexRgb(flavour.accent);
  const light = hexRgb(flavour.light);
  // The original logo's pink body sits near luminance 0.58, its blue
  // shading near 0.43 and its specular highlights above 0.85.
  const BODY = 0.58;
  return (lum) => {
    const l = Math.min(1, Math.max(0, lum));
    if (l < BODY) return mix(deep, accent, l / BODY);
    return mix(accent, light, Math.pow((l - BODY) / (1 - BODY), 1.35));
  };
}

/* Lookup tables for an SVG feComponentTransfer, one string per channel. */
export function tintTables(flavour, steps = 32) {
  const ramp = tintRamp(flavour);
  const out = [[], [], []];
  for (let i = 0; i < steps; i++) {
    const c = ramp(i / (steps - 1));
    for (let k = 0; k < 3; k++) out[k].push(c[k].toFixed(3));
  }
  return out.map((t) => t.join(' '));
}
