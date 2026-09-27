/* The sachet: geometry, label textures and material.
 *
 * The pack is modelled as a parametric pillow. u runs across the width,
 * v runs up the length; the front and back faces are two grids that meet
 * at the side edges and inside the crimped end seals. Everything a label
 * or a callout needs to know about the shape comes from `surface()`, so
 * texture coordinates, callout anchors and the mesh always agree.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import leafSvg from '@phosphor-icons/core/assets/bold/leaf-bold.svg';
import dropSvg from '@phosphor-icons/core/assets/bold/drop-bold.svg';
import lightningSvg from '@phosphor-icons/core/assets/bold/lightning-bold.svg';

export const DIM = {
  W: 1, // width
  H: 3.2, // length
  T: 0.2, // half-thickness at the fullest point
  S: 0.27, // length of each crimped end seal
};
const SEAL = DIM.S / DIM.H; // seal length as a fraction of v

const ICONS = { leaf: leafSvg, drop: dropSvg, lightning: lightningSvg };

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const tri = (x) => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1); // 0..1..0 triangle wave

/* A point on the sachet surface. side = 1 front, -1 back. */
export function surface(u, v, side = 1, out = new Vector3()) {
  const { W, H, T } = DIM;
  // 0 in the seals, 1 in the filled body, with soft shoulders.
  const body = smoothstep(SEAL, SEAL + 0.07, v) * smoothstep(SEAL, SEAL + 0.07, 1 - v);
  const puff = Math.pow(Math.sin(Math.PI * u), 0.5);
  let z = T * puff * body;

  // Crimp ridges run across both seals; both faces ripple together.
  const inSeal = 1 - smoothstep(SEAL - 0.01, SEAL + 0.02, Math.min(v, 1 - v));
  const crimp = inSeal * 0.0075 * Math.sin((v * H) / 0.028 * Math.PI * 2);

  // The back carries a vertical fin seal down the middle.
  const fin = side < 0 ? 0.012 * Math.exp(-(((u - 0.5) / 0.018) ** 2)) * body : 0;

  // Faces meet exactly at every outer edge.
  const edge = Math.min(1, u / 0.015, (1 - u) / 0.015, v / 0.006, (1 - v) / 0.006);
  const gap = 0.003 * edge;

  let x = (u - 0.5) * W;
  let y = (v - 0.5) * H;

  // Serrated ends: a triangle wave bites into the last few rows.
  const teeth = 17;
  const bite = 0.032 * tri(u * teeth);
  if (v > 0.985) y -= bite * (v - 0.985) / 0.015;
  if (v < 0.015) y += bite * (0.015 - v) / 0.015;

  // Tear notch: a V cut into the left edge, inside the top seal.
  const vn = 1 - SEAL * 0.5;
  const notch = 0.075 * Math.max(0, 1 - Math.abs(v - vn) / 0.028);
  if (u < 0.2) x += notch * (1 - u / 0.2);

  out.set(x, y, side * (z + gap) + crimp - side * fin);
  return out;
}

/* Two-faced parametric mesh with groups: 0 = front, 1 = back. */
export function createGeometry({ segU = 72, segV = 260 } = {}) {
  const verts = (segU + 1) * (segV + 1);
  const pos = new Float32Array(verts * 2 * 3);
  const uv = new Float32Array(verts * 2 * 2);
  const idx = [];
  const p = new Vector3();

  for (let face = 0; face < 2; face++) {
    const side = face === 0 ? 1 : -1;
    const base = face * verts;
    for (let j = 0; j <= segV; j++) {
      // Denser rows near the ends so the serration and crimp stay crisp.
      const t = j / segV;
      const v = t < 0.5 ? 0.5 * Math.pow(2 * t, 1.25) : 1 - 0.5 * Math.pow(2 * (1 - t), 1.25);
      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        surface(u, v, side, p);
        const k = base + j * (segU + 1) + i;
        pos.set([p.x, p.y, p.z], k * 3);
        uv.set([face === 0 ? u : 1 - u, v], k * 2);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = base + j * (segU + 1) + i;
        const b = a + 1;
        const c = a + segU + 1;
        const d = c + 1;
        if (side > 0) idx.push(a, b, d, a, d, c);
        else idx.push(a, d, b, a, c, d);
      }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const half = segU * segV * 6;
  geo.addGroup(0, half, 0);
  geo.addGroup(half, half, 1);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------------
   Label textures
   ------------------------------------------------------------------ */
const TEX_W = 720;
const TEX_H = Math.round(TEX_W * (DIM.H / DIM.W));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const iconCache = new Map();
function icon(name, color) {
  const key = `${name}:${color}`;
  if (!iconCache.has(key)) {
    const svg = ICONS[name].replace(/currentColor/g, color);
    iconCache.set(key, loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  }
  return iconCache.get(key);
}

const hexToRgb = (hex) => {
  const c = new Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
};

/* Gradient-map the glossy wordmark into the flavour's colours,
   keeping its highlights and shading. */
function tintLogo(logo, flavour, width) {
  const h = Math.round((logo.naturalHeight / logo.naturalWidth) * width);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(logo, 0, 0, width, h);
  const img = ctx.getImageData(0, 0, width, h);
  const d = img.data;
  const deep = hexToRgb(flavour.deep);
  const mid = hexToRgb(flavour.accent);
  const light = hexToRgb(flavour.light);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = Math.min(1, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255 * 1.25);
    let r;
    let g;
    let b;
    if (l < 0.55) {
      const t = l / 0.55;
      r = deep[0] + (mid[0] - deep[0]) * t;
      g = deep[1] + (mid[1] - deep[1]) * t;
      b = deep[2] + (mid[2] - deep[2]) * t;
    } else {
      const t = (l - 0.55) / 0.45;
      r = mid[0] + (light[0] - mid[0]) * t;
      g = mid[1] + (light[1] - mid[1]) * t;
      b = mid[2] + (light[2] - mid[2]) * t;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function crimpBand(ctx, y0, y1, flavour) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#15151b');
  g.addColorStop(1, '#0c0c10');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, TEX_W, y1 - y0);
  // Fine horizontal crimp lines, tinted with the flavour.
  const step = Math.max(4, Math.round(TEX_H * (0.028 / DIM.H)));
  for (let y = y0; y < y1; y += step) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, y, TEX_W, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + step / 2, TEX_W, 2);
  }
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = flavour.accent;
  ctx.fillRect(0, y0, TEX_W, y1 - y0);
  ctx.restore();
}

function swoosh(ctx, flavour, corner) {
  // A glossy jelly drip in the corner, like the printed pack.
  const top = corner === 'top';
  const sealPx = SEAL * TEX_H;
  ctx.save();
  if (!top) {
    ctx.translate(TEX_W, TEX_H);
    ctx.rotate(Math.PI);
  }
  const y0 = sealPx - 4;
  const grad = ctx.createLinearGradient(TEX_W * 0.5, y0, TEX_W, y0 + TEX_H * 0.17);
  grad.addColorStop(0, flavour.light);
  grad.addColorStop(0.35, flavour.accent);
  grad.addColorStop(1, flavour.deep);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(TEX_W * 0.48, y0);
  ctx.bezierCurveTo(TEX_W * 0.72, y0 + 10, TEX_W * 0.7, y0 + TEX_H * 0.07, TEX_W * 0.86, y0 + TEX_H * 0.1);
  ctx.bezierCurveTo(TEX_W * 0.95, y0 + TEX_H * 0.12, TEX_W * 0.93, y0 + TEX_H * 0.17, TEX_W, y0 + TEX_H * 0.19);
  ctx.lineTo(TEX_W, y0);
  ctx.closePath();
  ctx.fill();
  // Highlight along the drip edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(TEX_W * 0.62, y0 + 12);
  ctx.bezierCurveTo(TEX_W * 0.72, y0 + 30, TEX_W * 0.74, y0 + TEX_H * 0.06, TEX_W * 0.84, y0 + TEX_H * 0.085);
  ctx.stroke();
  // Two droplets.
  ctx.fillStyle = flavour.accent;
  for (const [x, y, r] of [
    [0.8, 0.135, 12],
    [0.9, 0.2, 8],
  ]) {
    ctx.beginPath();
    ctx.arc(TEX_W * x, y0 + TEX_H * (y - 0.03), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(TEX_W * x - r * 0.35, y0 + TEX_H * (y - 0.03) - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flavour.accent;
  }
  ctx.restore();
}

function text(ctx, str, x, y, { font, color = '#fff', spacing = 0, align = 'center' } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/* Where things sit on the front label, as fractions from the top. */
export const LABEL_LAYOUT = {
  logo: 0.2,
  line1: 0.345,
  line2: 0.382,
  strap: 0.418,
  rows: [0.49, 0.565, 0.64],
  name: 0.745,
  flavourWord: 0.79,
  weight: 0.855,
};

export async function drawFront(flavour, logo, copy) {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext('2d');
  const L = LABEL_LAYOUT;
  const sealPx = SEAL * TEX_H;

  // Body: near-black film with a faint vertical sheen.
  const body = ctx.createLinearGradient(0, 0, TEX_W, 0);
  body.addColorStop(0, '#07070a');
  body.addColorStop(0.5, '#121218');
  body.addColorStop(1, '#07070a');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  swoosh(ctx, flavour, 'top');
  swoosh(ctx, flavour, 'bottom');
  crimpBand(ctx, 0, sealPx, flavour);
  crimpBand(ctx, TEX_H - sealPx, TEX_H, flavour);

  // Wordmark.
  if (logo) {
    const w = TEX_W * 0.86;
    const tinted = tintLogo(logo, flavour, Math.round(w));
    ctx.drawImage(tinted, (TEX_W - w) / 2, TEX_H * L.logo - tinted.height / 2);
  }

  text(ctx, copy.lines[0], TEX_W / 2, TEX_H * L.line1, { font: '800 62px Archivo', spacing: 5 });
  text(ctx, copy.lines[1], TEX_W / 2, TEX_H * L.line2, { font: '800 62px Archivo', spacing: 5 });
  text(ctx, copy.strap, TEX_W / 2, TEX_H * L.strap, {
    font: '600 20px "JetBrains Mono", monospace',
    color: 'rgba(255,255,255,0.72)',
    spacing: 2,
  });

  // Hairlines above and below the ingredient rows.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(TEX_W * 0.12, TEX_H * (L.rows[0] - 0.04), TEX_W * 0.76, 2);
  ctx.fillRect(TEX_W * 0.12, TEX_H * (L.rows[2] + 0.04), TEX_W * 0.76, 2);

  for (let i = 0; i < copy.rows.length; i++) {
    const row = copy.rows[i];
    const y = TEX_H * L.rows[i];
    const img = await icon(row.icon, flavour.accent);
    ctx.drawImage(img, TEX_W * 0.14, y - 34, 68, 68);
    text(ctx, row.title, TEX_W * 0.31, y - 15, { font: '800 38px Archivo', align: 'left', spacing: 1 });
    text(ctx, row.sub, TEX_W * 0.31, y + 22, {
      font: '600 22px "JetBrains Mono", monospace',
      color: 'rgba(255,255,255,0.62)',
      align: 'left',
      spacing: 1,
    });
  }

  // Flavour name, in the flavour.
  ctx.save();
  ctx.shadowColor = flavour.accent;
  ctx.shadowBlur = 24;
  text(ctx, flavour.name.toUpperCase(), TEX_W / 2, TEX_H * L.name, {
    font: 'condensed 900 118px Archivo',
    color: flavour.accent,
    spacing: 2,
  });
  ctx.restore();
  text(ctx, 'FLAVOUR', TEX_W / 2, TEX_H * L.flavourWord, {
    font: '700 26px "JetBrains Mono", monospace',
    color: flavour.light,
    spacing: 8,
  });
  text(ctx, copy.weight, TEX_W / 2, TEX_H * L.weight, {
    font: '700 24px "JetBrains Mono", monospace',
    color: 'rgba(255,255,255,0.8)',
    spacing: 2,
  });

  return c;
}

export function drawBack(flavour, logo) {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext('2d');
  const sealPx = SEAL * TEX_H;

  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Fin seal down the middle.
  const fin = ctx.createLinearGradient(TEX_W * 0.46, 0, TEX_W * 0.54, 0);
  fin.addColorStop(0, '#0b0b0f');
  fin.addColorStop(0.5, '#1d1d25');
  fin.addColorStop(1, '#0b0b0f');
  ctx.fillStyle = fin;
  ctx.fillRect(TEX_W * 0.46, 0, TEX_W * 0.08, TEX_H);

  crimpBand(ctx, 0, sealPx, flavour);
  crimpBand(ctx, TEX_H - sealPx, TEX_H, flavour);

  if (logo) {
    const w = TEX_W * 0.5;
    const tinted = tintLogo(logo, flavour, Math.round(w));
    ctx.globalAlpha = 0.9;
    ctx.drawImage(tinted, (TEX_W - w) / 2, TEX_H * 0.2 - tinted.height / 2);
    ctx.globalAlpha = 1;
  }

  const lines = [
    ['800 30px Archivo', '#fff', 'TEAR AT THE NOTCH.'],
    ['800 30px Archivo', '#fff', 'SQUEEZE. CARRY ON.'],
    ['600 19px "JetBrains Mono", monospace', 'rgba(255,255,255,0.6)', 'DIETARY SUPPLEMENT · 15 g'],
    ['600 19px "JetBrains Mono", monospace', 'rgba(255,255,255,0.6)', 'NO WATER NEEDED'],
    ['600 17px "JetBrains Mono", monospace', 'rgba(255,255,255,0.45)', 'FULL INGREDIENT PANEL AND'],
    ['600 17px "JetBrains Mono", monospace', 'rgba(255,255,255,0.45)', 'ALLERGEN STATEMENT TO BE'],
    ['600 17px "JetBrains Mono", monospace', 'rgba(255,255,255,0.45)', 'CONFIRMED BEFORE LAUNCH.'],
  ];
  let y = TEX_H * 0.36;
  for (const [font, color, s] of lines) {
    text(ctx, s, TEX_W / 2, y, { font, color, spacing: 1 });
    y += font.startsWith('800') ? 44 : 34;
  }

  ctx.fillStyle = flavour.accent;
  ctx.fillRect(TEX_W * 0.18, TEX_H * 0.72, TEX_W * 0.64, 10);
  text(ctx, flavour.name.toUpperCase(), TEX_W / 2, TEX_H * 0.77, {
    font: 'condensed 900 72px Archivo',
    color: flavour.accent,
    spacing: 2,
  });
  return c;
}

/* Roughness (G) and metalness (B): the seals read as crimped foil,
   the body as glossy printed film. */
export function drawSurfaceMap() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 512;
  const ctx = c.getContext('2d');
  const seal = Math.round(SEAL * 512);
  ctx.fillStyle = 'rgb(0, 72, 36)'; // body: roughness ~0.28, metalness ~0.14
  ctx.fillRect(0, 0, 32, 512);
  ctx.fillStyle = 'rgb(0, 96, 210)'; // seals: roughness ~0.38, metalness ~0.82
  ctx.fillRect(0, 0, 32, seal);
  ctx.fillRect(0, 512 - seal, 32, seal);
  return c;
}

export function makeTexture(canvas, renderer) {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.minFilter = LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------
   Material with squeeze, bend and twist in the vertex shader
   ------------------------------------------------------------------ */
export function createMaterial({ map, surfaceMap, uniforms, back = false }) {
  const mat = new MeshPhysicalMaterial({
    map,
    roughnessMap: surfaceMap,
    metalnessMap: surfaceMap,
    roughness: 1,
    metalness: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    envMapIntensity: 1.25,
    sheen: 0,
    specularIntensity: 1,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const decl = /* glsl */ `
      uniform float uSqueeze;
      uniform float uBend;
      uniform float uTwist;
      vec2 sahsihRotate(vec2 p, float a) { float c = cos(a); float s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
    `;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${decl}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        {
          float yn0 = position.y / ${(DIM.H / 2).toFixed(3)};
          objectNormal.xz = sahsihRotate(objectNormal.xz, uTwist * yn0);
        }`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float yn = transformed.y / ${(DIM.H / 2).toFixed(3)};
          float pinch = exp(-yn * yn * 5.0);
          float body = 1.0 - smoothstep(0.78, 0.86, abs(yn));
          transformed.z *= 1.0 - uSqueeze * 0.78 * pinch * body + uSqueeze * 0.55 * (1.0 - pinch) * body;
          transformed.x *= 1.0 + uSqueeze * 0.14 * pinch;
          transformed.y *= 1.0 + uSqueeze * 0.035;
          transformed.x += uBend * (yn * yn - 0.35) * 0.55;
          transformed.z += uBend * 0.18 * (1.0 - yn * yn);
          transformed.xz = sahsihRotate(transformed.xz, uTwist * yn);
        }`
      );
  };
  mat.customProgramCacheKey = () => (back ? 'sahsih-back' : 'sahsih-front');
  return mat;
}
