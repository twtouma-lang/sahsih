/* The hero's night scene: out-of-focus city lights over a wet street.
 *
 * Painted once into two canvases (far lights with their reflections, and
 * a few big foreground bokeh discs) and repainted on resize. The page moves
 * the two layers at different speeds with the pointer and the scroll, which
 * reads as depth without any per-frame drawing.
 */

// Small seeded PRNG so the scene is the same on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [
  [255, 179, 92], // sodium amber
  [255, 179, 92],
  [255, 241, 214], // warm white
  [255, 77, 224], // pink neon
  [255, 77, 224],
  [63, 108, 255], // blue
  [52, 224, 208], // teal
  [255, 59, 107], // red tail light
];

function disc(ctx, x, y, r, [cr, cg, cb], a, ring = false) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  if (ring) {
    // Bokeh discs: flat body, brighter rim, soft falloff.
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.55})`);
    g.addColorStop(0.82, `rgba(${cr},${cg},${cb},${a * 0.7})`);
    g.addColorStop(0.93, `rgba(${cr},${cg},${cb},${a})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  } else {
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
    g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${a * 0.45})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function sizeCanvas(canvas, dpr) {
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export function paintBackdrop({ far, near }, { mobile = false } = {}) {
  if (!far || !near) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const rnd = mulberry32(20260927);

  /* Far layer: the street. */
  {
    const { ctx, w, h } = sizeCanvas(far, dpr);
    const horizon = h * 0.64;
    const unit = Math.min(w, h * 1.6) / 1000;

    // Haze glow along the horizon.
    const haze = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.6);
    haze.addColorStop(0, 'rgba(120, 40, 140, 0.28)');
    haze.addColorStop(1, 'rgba(120, 40, 140, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    const count = mobile ? 70 : 150;
    const lights = [];
    for (let i = 0; i < count; i++) {
      // Rows of lights recede toward the horizon: smaller and denser up close to it.
      const depth = rnd();
      const y = horizon - (0.02 + depth * depth * 0.3) * h;
      const x = rnd() * w;
      const r = (3 + (1 - depth) * 5 + rnd() * 6) * unit * 1.4;
      const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
      const a = 0.35 + rnd() * 0.55;
      disc(ctx, x, y, r * 2.2, color, a * 0.5);
      disc(ctx, x, y, r * 0.8, [255, 255, 255], a * 0.35);
      lights.push({ x, y, r, color, a });
    }

    // Reflections on wet tarmac: broken vertical streaks under each light.
    for (const l of lights) {
      if (rnd() < 0.35) continue;
      const len = (0.08 + rnd() * 0.3) * h;
      const width = l.r * (1.2 + rnd());
      const top = horizon + (horizon - l.y) * 0.15;
      const segments = 3 + Math.floor(rnd() * 4);
      for (let s = 0; s < segments; s++) {
        const y0 = top + (len / segments) * s + rnd() * 6 * unit;
        const y1 = y0 + (len / segments) * (0.4 + rnd() * 0.5);
        const fade = 1 - s / segments;
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        const [cr, cg, cb] = l.color;
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${l.a * 0.22 * fade})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(l.x - width / 2, y0, width, y1 - y0);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // A darker band for the kerb, then the wet ground fading to black.
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, 'rgba(6, 6, 10, 0)');
    ground.addColorStop(0.05, 'rgba(6, 6, 10, 0.35)');
    ground.addColorStop(1, 'rgba(6, 6, 6, 0.55)');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);
  }

  /* Near layer: big soft discs, as if a lens were focused on the pack. */
  {
    const { ctx, w, h } = sizeCanvas(near, dpr);
    const unit = Math.min(w, h * 1.6) / 1000;
    ctx.globalCompositeOperation = 'lighter';
    const count = mobile ? 7 : 16;
    for (let i = 0; i < count; i++) {
      // Keep the middle clearer so the sachet stays the subject.
      let x = rnd() * w;
      if (Math.abs(x - w / 2) < w * 0.14) x += (x < w / 2 ? -1 : 1) * w * 0.18;
      const y = h * (0.15 + rnd() * 0.75);
      const r = (40 + rnd() * 110) * unit * 1.3;
      const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
      disc(ctx, x, y, r, color, 0.08 + rnd() * 0.12, true);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
