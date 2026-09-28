/* Sahsih Shopify theme.
 *
 * The same scroll film as the static site (src/app.js), made to work with
 * any number and order of sections, with the theme editor, and with a real
 * Shopify cart. Settings arrive as JSON from snippets/theme-config.liquid.
 *
 * Smooth scrolling (Lenis) drives ScrollTrigger. Every section that shows
 * the jelly stick has an invisible "slot"; as you scroll, the stick travels
 * from slot to slot (see getPose). The WebGL stage is a separate script
 * (sahsih-stage.js) that loads after first paint, and only on pages that
 * have a slot.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { paintBackdrop } from '../backdrop.js';
import { tintTables } from '../tint.js';
import { createBuyForm } from './buy.js';
import { createCart } from './cart.js';
import { deepShade, isHex, lightShade } from './shades.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopMQ = window.matchMedia('(min-width: 900px)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------
   Settings
   ------------------------------------------------------------------ */
function readConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse(($('#sahsih-config') || {}).textContent || '{}');
  } catch {
    cfg = {};
  }
  // Label copy is printed as typed (the defaults are already capitals;
  // forcing capitals would turn units like "15 g" into "15 G").
  const clean = (s) => (typeof s === 'string' ? s.trim() : '');
  const lines = (list) => (Array.isArray(list) ? list.map(clean).filter(Boolean).slice(0, 3) : []);
  const accentFallback = getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff4de0';
  const seen = new Set();
  let flavours = (cfg.flavours || [])
    .filter((f) => f && f.id && !seen.has(f.id) && seen.add(f.id))
    .map((f) => {
      const accent = isHex(f.accent) ? f.accent : '#ff4de0';
      return {
        id: f.id,
        name: f.name || '',
        note: f.note || '',
        accent,
        light: isHex(f.light) ? f.light : lightShade(accent),
        deep: isHex(f.deep) ? f.deep : deepShade(accent),
        stick: f.stick || '',
        box: f.box || '',
      };
    });
  if (!flavours.length) {
    const accent = isHex(accentFallback) ? accentFallback : '#ff4de0';
    flavours = [{ id: 'default', name: '', note: '', accent, light: lightShade(accent), deep: deepShade(accent), stick: '', box: '' }];
  }
  const label = cfg.label || {};
  const back = label.back || {};
  return {
    flavours,
    label: {
      lines: [clean((label.lines || [])[0]), clean((label.lines || [])[1])],
      strap: clean(label.strap),
      rows: (label.rows || []).slice(0, 3).map((r) => ({ icon: (r && r.icon) || 'leaf', title: clean(r && r.title), sub: clean(r && r.sub) })),
      flavourWord: clean(label.flavourWord),
      weight: clean(label.weight),
      back: { big: lines(back.big), small: lines(back.small), fine: lines(back.fine) },
    },
    logo: cfg.logo || '',
    stageSrc: cfg.stageSrc || '',
    enable3d: cfg.enable3d !== false,
    tintWordmark: cfg.tintWordmark !== false,
    motion: { smoothScroll: true, intro: true, reveal: true, ...(cfg.motion || {}) },
    designMode: !!cfg.designMode || !!(window.Shopify && window.Shopify.designMode),
    pageType: cfg.pageType || '',
    cartType: cfg.cartType || 'drawer',
    moneyFormat: cfg.moneyFormat || '${{amount}}',
    routes: { root: '/', cart: '/cart', cartAdd: '/cart/add', cartChange: '/cart/change', cartUpdate: '/cart/update', ...(cfg.routes || {}) },
    strings: {
      added: 'added',
      addToCart: 'Add to cart',
      soldOut: 'Sold out',
      unavailable: 'Unavailable',
      error: 'Something went wrong. Please try again.',
      menu: 'Menu',
      close: 'Close',
      ...(cfg.strings || {}),
    },
  };
}

const CFG = readConfig();
const designMode = CFG.designMode;
const flavourById = (id) => CFG.flavours.find((f) => f.id === id) || null;
if (window.__SAHSIH_DEBUG) window.__sahsih = { gsap, ScrollTrigger, CFG };

function setPageWidth() {
  root.style.setProperty('--page-w', `${root.clientWidth}px`);
}
setPageWidth();

/* ------------------------------------------------------------------
   Smooth scroll (never in the theme editor, where it fights the editor's
   own scrolling to the selected section)
   ------------------------------------------------------------------ */
let lenis = null;
if (!reduced && !designMode && CFG.motion.smoothScroll) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
const velocity = () => (lenis ? lenis.velocity : 0);

function scrollToTarget(target, { immediate = false } = {}) {
  if (lenis) {
    lenis.scrollTo(target === 0 ? 0 : target, { duration: 1.6, immediate, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else if (target === 0) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } else {
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}

/* ------------------------------------------------------------------
   Stage handle and pointer
   ------------------------------------------------------------------ */
let stage = null;
let stageRequested = false;
const pointer = { x: 0, y: 0 };
if (finePointer) {
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );
}

/* ------------------------------------------------------------------
   Flavour state: one flavour at a time drives the stick, the accent
   colour, the posters, the buy forms and the section tints.
   ------------------------------------------------------------------ */
let flavour = CFG.flavours[0].id;
let buyForms = [];

/* The logo keeps its original colours for the first flavour and is
   recoloured for the others, the way the printed packs are. */
function tintLogo(f) {
  const original = !CFG.tintWordmark || f.id === CFG.flavours[0].id;
  root.classList.toggle('is-tinted', !original);
  if (original) return;
  const [r, g, b] = tintTables(f);
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('tableValues', v);
  };
  set('tint-r', r);
  set('tint-g', g);
  set('tint-b', b);
}

function wobbleLogo() {
  if (reduced) return;
  const art = $$('.wordmark__art');
  if (!art.length) return;
  gsap.fromTo(art, { scaleX: 1.06, scaleY: 0.86 }, { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
}

function setFlavour(id, { quiet = false } = {}) {
  const f = flavourById(id);
  if (!f) return;
  const changed = f.id !== flavour;
  flavour = f.id;
  root.style.setProperty('--accent', f.accent);
  root.style.setProperty('--accent-light', f.light);
  root.dataset.flavour = f.id;
  tintLogo(f);
  if (changed && !quiet) wobbleLogo();
  $$('.swatch').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.flavour === f.id)));
  $$('.flavour-row').forEach((el) => el.classList.toggle('is-current', el.dataset.flavour === f.id));
  if (f.stick) {
    $$('[data-poster]').forEach((img) => {
      if (img.getAttribute('src') !== f.stick) img.src = f.stick;
    });
  }
  buyForms.forEach((b) => b.syncFlavour(f.id));
  if (changed && stage) stage.setFlavour(f.id);
}

document.addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch[data-flavour]');
  if (sw) setFlavour(sw.dataset.flavour);
  const row = e.target.closest('.flavour-row[data-flavour]');
  if (row) {
    setFlavour(row.dataset.flavour);
    // Go to the nearest place to buy: the Shop section, a product form on
    // this page, or the Shop section on the homepage.
    const shop = $('[data-section="shop"]');
    const form = buyForms.find((b) => b.form.isConnected);
    if (shop) scrollToTarget(shop);
    else if (form) scrollToTarget(form.form.closest('[data-section]') || form.form);
    else if (CFG.pageType !== 'index') window.location.href = `${CFG.routes.root.replace(/\/$/, '')}/#shop`;
  }
});
document.addEventListener(
  'pointerover',
  (e) => {
    const row = e.target.closest && e.target.closest('.flavour-row[data-flavour]');
    if (row && finePointer && row.dataset.flavour !== flavour) setFlavour(row.dataset.flavour);
  },
  { passive: true }
);
document.addEventListener('focusin', (e) => {
  const row = e.target.closest && e.target.closest('.flavour-row[data-flavour]');
  if (row && row.dataset.flavour !== flavour) setFlavour(row.dataset.flavour);
});

/* ------------------------------------------------------------------
   Slots and pose: where the stick should be right now
   ------------------------------------------------------------------ */
let slots = [];

function collectSlots() {
  return $$('[data-slot]').map((el) => ({
    el,
    tilt: Number(el.dataset.tilt || 0),
    spin: el.dataset.spin ? Number(el.dataset.spin) : 1,
    face: Number(el.dataset.face || 0),
    glow: el.dataset.glow ? Number(el.dataset.glow) : 0.55,
    fill: el.dataset.fill ? Number(el.dataset.fill) : 0.92,
    st: null,
    last: null,
  }));
}

function slotPose(s) {
  const r = s.el.getBoundingClientRect();
  // A hidden slot (another photo picked in the product gallery) shrinks
  // the stick away where it last stood.
  if (r.width === 0 && r.height === 0) {
    const last = s.last || { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    return { cx: last.cx, cy: last.cy, h: 0, tilt: s.tilt, spin: s.spin, face: s.face, glow: 0 };
  }
  const pose = {
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    h: r.height * s.fill,
    tilt: s.tilt,
    spin: s.spin,
    face: s.face,
    glow: s.glow,
  };
  s.last = pose;
  return pose;
}

function mix(a, b, t) {
  const o = {};
  for (const k in a) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

const OFFSTAGE = { cx: 0, cy: -2000, h: 0, tilt: 0, spin: 1, face: 0, glow: 0 };

/* Start from the last slot we have fully arrived at, then blend toward
   any slot we are part-way into. */
function getPose() {
  const live = slots.filter((s) => s.el.isConnected);
  if (!live.length) return { ...OFFSTAGE, cx: window.innerWidth / 2 };
  let start = 0;
  for (let i = live.length - 1; i > 0; i--) {
    if (live[i].st && live[i].st.progress >= 1) {
      start = i;
      break;
    }
  }
  let pose = slotPose(live[start]);
  for (let i = start + 1; i < live.length; i++) {
    const p = live[i].st ? live[i].st.progress : 0;
    if (p <= 0) continue;
    pose = mix(pose, slotPose(live[i]), reduced ? (p > 0.5 ? 1 : 0) : smooth(p));
  }
  return pose;
}

/* Clicks and hover on the stick. The slots sit above the canvas. */
let lastHover = null;
let hoverQueued = false;
document.addEventListener('click', (e) => {
  const slot = e.target.closest('[data-slot]');
  if (!slot) return;
  const keyboard = e.detail === 0;
  if (stage && (keyboard || stage.hitTest(e.clientX, e.clientY))) stage.squeeze(1);
  else if (!stage) {
    slot.classList.remove('is-squeezed');
    void slot.offsetWidth;
    slot.classList.add('is-squeezed');
  }
});
if (finePointer) {
  document.addEventListener(
    'pointermove',
    (e) => {
      const slot = e.target.closest && e.target.closest('[data-slot]');
      if (lastHover && lastHover.el !== slot) lastHover.el.classList.remove('is-over');
      if (!slot) {
        lastHover = null;
        return;
      }
      lastHover = { el: slot, x: e.clientX, y: e.clientY };
      if (hoverQueued) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        if (!lastHover || !stage) return;
        lastHover.el.classList.toggle('is-over', stage.hitTest(lastHover.x, lastHover.y));
      });
    },
    { passive: true }
  );
}

/* ------------------------------------------------------------------
   Science callouts: lines from each panel to the ingredient row on the
   actual 3D label, redrawn after every WebGL frame.
   ------------------------------------------------------------------ */
const scienceScenes = new Map();

function scienceScene(section) {
  if (!scienceScenes.has(section)) {
    const callouts = $$('[data-callout]', section);
    scienceScenes.set(section, {
      section,
      svg: $('.callout-lines', section),
      callouts,
      lines: $$('[data-line]', section),
      dots: $$('[data-dot]', section),
      state: callouts.map(() => ({ p: 1 })),
      live: false,
      drawn: false,
    });
  }
  return scienceScenes.get(section);
}

function clearCallouts(scene) {
  if (!scene.drawn) return;
  scene.drawn = false;
  scene.lines.forEach((l) => l.setAttribute('d', ''));
  scene.dots.forEach((d) => (d.style.opacity = '0'));
}

function drawCallouts() {
  scienceScenes.forEach((scene) => {
    if (!scene.section.isConnected) {
      scienceScenes.delete(scene.section);
      return;
    }
    if (!scene.live || !stage || !scene.svg || !desktopMQ.matches) return clearCallouts(scene);
    scene.drawn = true;
    const box = scene.svg.getBoundingClientRect();
    scene.callouts.forEach((c, i) => {
      const line = scene.lines[i];
      const dot = scene.dots[i];
      if (!line || !dot) return;
      const a = stage.project(Math.min(i, 2));
      const r = c.getBoundingClientRect();
      const fromRight = r.left > box.left + box.width / 2;
      const sx = (fromRight ? r.left : r.right) - box.left;
      const sy = r.top + 30 - box.top;
      const ex = a.x - box.left;
      const ey = a.y - box.top;
      const kx = sx + (fromRight ? -40 : 40);
      line.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} L${kx.toFixed(1)},${sy.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`);
      const len = line.getTotalLength();
      const visible = a.facing > 0.15 ? 1 : 0;
      const p = scene.state[i].p * visible;
      line.style.strokeDasharray = `${len} ${len}`;
      line.style.strokeDashoffset = String(len * (1 - p));
      dot.setAttribute('cx', ex.toFixed(1));
      dot.setAttribute('cy', ey.toFixed(1));
      dot.style.opacity = p > 0.96 ? '1' : '0';
    });
  });
}

/* ------------------------------------------------------------------
   The 3D stage. It starts loading as soon as this script runs (the layout
   also preloads it), only on pages with a slot. While it loads the flat
   photos stay hidden (.stage-on in the CSS); they are shown straight away
   if this device cannot draw 3D or the script fails (.no-3d).
   ------------------------------------------------------------------ */
function showPosters() {
  if (!root.classList.contains('has-3d')) root.classList.add('no-3d');
}

/* A quick check only: opening a throwaway WebGL context to test support
   costs time on every device. If the browser has WebGL but cannot create a
   context, the stage's own start-up fails and the photos show instead. */
function webglAvailable() {
  return typeof window.WebGLRenderingContext !== 'undefined';
}

function mountStage() {
  const canvas = $('#stage');
  if (stage) return;
  if (!window.SahsihStage || !canvas) return showPosters();
  try {
    stage = window.SahsihStage.mount({
      canvas,
      getPose,
      getVelocity: velocity,
      getPointer: () => pointer,
      logoSrc: CFG.logo,
      reducedMotion: reduced,
      mobile: !desktopMQ.matches,
      initialFlavour: flavour,
      flavours: CFG.flavours,
      label: CFG.label,
      onFrame: drawCallouts,
      onReady: () => {
        root.classList.remove('no-3d');
        root.classList.add('has-3d');
        if (!reduced && stage) stage.squeeze(0.9);
      },
    });
  } catch (err) {
    stage = null;
    console.error('Sahsih 3D stage could not start', err);
  }
  if (!stage) showPosters();
}

function loadStage() {
  if (stageRequested) return;
  if (!CFG.enable3d || !$('#stage') || !CFG.stageSrc) return showPosters();
  if (!slots.some((s) => s.el.dataset.slot !== 'footer')) return;
  stageRequested = true;
  if (!webglAvailable()) return showPosters();
  if (window.SahsihStage) return mountStage();
  const s = document.createElement('script');
  s.src = CFG.stageSrc;
  s.async = true;
  s.onload = mountStage;
  s.onerror = showPosters;
  document.head.appendChild(s);
}

/* ------------------------------------------------------------------
   Hero: night backdrop, intro, counters
   ------------------------------------------------------------------ */
function paintHeroes(scope = document) {
  $$('.hero', scope).forEach((hero) => {
    const far = $('[data-bokeh="far"]', hero);
    const near = $('[data-bokeh="near"]', hero);
    if (far && near) paintBackdrop({ far, near }, { mobile: !desktopMQ.matches });
  });
}

function countUp(scope = document, animate = true) {
  $$('[data-count]', scope).forEach((el, i) => {
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.countFrom || 0);
    if (!Number.isFinite(to)) return;
    if (reduced || !animate || !Number.isFinite(from)) {
      el.textContent = String(to);
      return;
    }
    const o = { v: from };
    el.textContent = String(from);
    gsap.to(o, {
      v: to,
      duration: 1.6,
      delay: 0.5 + i * 0.12,
      ease: 'power3.out',
      onUpdate: () => (el.textContent = String(Math.round(o.v))),
    });
  });
}

function intro() {
  const hero = $('.hero');
  if (reduced || !CFG.motion.intro || !hero) return countUp(document, !reduced);
  const q = (sel) => $$(sel, hero);
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  const bar = $('.bar');
  if (bar) tl.from(bar, { yPercent: -100, autoAlpha: 0, duration: 0.9, clearProps: 'transform,opacity,visibility' }, 0);
  const add = (targets, vars, at) => {
    if (targets.length) tl.from(targets, vars, at);
  };
  add(q('.hero__bg'), { autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, 0);
  add(q('[data-wordmark] .wordmark__art'), { yPercent: -35, scaleY: 1.3, scaleX: 0.82, autoAlpha: 0, duration: 1.5, ease: 'elastic.out(1, 0.45)' }, 0.1);
  add(q('.hero__title .line > span'), { yPercent: 110, duration: 1, stagger: 0.09 }, 0.35);
  add(q('.hud__panel'), { x: 40, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.45);
  add(q('.swatch'), { scale: 0, duration: 0.6, stagger: 0.06, ease: 'back.out(2.2)', clearProps: 'transform' }, 0.6);
  add(q('.hero__intro > *'), { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.7);
  add(q('.hero__hint'), { autoAlpha: 0, duration: 0.8 }, 1.1);
  countUp(hero);
}

/* ------------------------------------------------------------------
   Scroll choreography, rebuilt whenever the sections change (theme
   editor) and per breakpoint by gsap.matchMedia.
   ------------------------------------------------------------------ */
let mm = null;
let footerLanded = false;

function buildScenes() {
  if (mm) mm.revert();
  slots = collectSlots();
  mm = gsap.matchMedia();
  mm.add(
    {
      desktop: '(min-width: 900px)',
      mobile: '(max-width: 899px)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions;
      const motion = !reduce;
      const reveals = motion && CFG.motion.reveal && !designMode;

      const reveal = (group) => {
        if (!reveals) return;
        const items = $$('[data-reveal-item]', group);
        gsap.from(items.length ? items : group, {
          y: 56,
          autoAlpha: 0,
          skewY: 3,
          duration: 1.1,
          ease: 'power4.out',
          stagger: 0.08,
          clearProps: 'opacity,visibility,transform',
          scrollTrigger: { trigger: group, start: 'top 82%', once: true },
        });
      };

      const slotTrigger = (s, section) => {
        if (!s || s === slots[0]) return;
        const trigger = s.el.dataset.trigger ? $(s.el.dataset.trigger) : section || s.el.closest('[data-section]') || s.el;
        s.st = ScrollTrigger.create({
          trigger,
          start: s.el.dataset.enter || 'top 88%',
          end: s.el.dataset.settle || 'top 18%',
        });
      };
      const slotIn = (section) => slots.find((s) => section.contains(s.el));

      // Hero parallax.
      if (motion) {
        $$('.hero').forEach((hero) => {
          const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
          const art = $('[data-wordmark] .wordmark__art', hero);
          if (art) tl.to(art, { yPercent: desktop ? -40 : -20, scale: 0.9, autoAlpha: 0.15, ease: 'none' }, 0);
          const near = $('.hero__bokeh--near', hero);
          const far = $('.hero__bokeh--far', hero);
          if (near) tl.to(near, { yPercent: -14, ease: 'none' }, 0);
          if (far) tl.to(far, { yPercent: -5, ease: 'none' }, 0);
          const hud = $('.hud', hero);
          if (hud) tl.to(hud, { y: -140, autoAlpha: 0, ease: 'none' }, 0);
          const heroIntro = $('.hero__intro', hero);
          if (heroIntro) tl.to(heroIntro, { y: -80, ease: 'none' }, 0);
        });
      }

      // Everything else, section by section in page order, so pinned
      // sections push the triggers below them correctly.
      $$('main [data-section], main [data-reveal]').forEach((el) => {
        if (!el.hasAttribute('data-section')) {
          if (!el.closest('main [data-section]')) reveal(el);
          return;
        }
        const section = el;
        const type = section.dataset.section;
        $$('[data-reveal]', section).forEach(reveal);

        if (type === 'flavours' && reveals) {
          const rows = $$('.flavour-row', section);
          if (rows.length) {
            gsap.from(rows, {
              x: -50,
              autoAlpha: 0,
              duration: 0.9,
              ease: 'power3.out',
              stagger: 0.07,
              clearProps: 'opacity,visibility,transform',
              scrollTrigger: { trigger: $('.flavour-list', section) || section, start: 'top 85%', once: true },
            });
          }
        }

        slotTrigger(slotIn(section), section);

        if (type === 'science') {
          const scene = scienceScene(section);
          const stageEl = $('.science__stage', section);
          const slotEl = $('.slot--science', section);
          if (desktop && motion && stageEl) {
            scene.state.forEach((l) => (l.p = 0));
            const sci = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: '+=150%',
                pin: stageEl,
                scrub: 0.6,
                anticipatePin: 1,
                onToggle: (self) => (scene.live = self.isActive),
              },
            });
            if (slotEl) sci.fromTo(slotEl, { scale: 0.74 }, { scale: 1.12, ease: 'none', duration: 1 }, 0);
            scene.callouts.forEach((c, i) => {
              const at = 0.1 + i * 0.25;
              sci.fromTo(c, { autoAlpha: 0, x: i === 1 ? 50 : -50 }, { autoAlpha: 1, x: 0, duration: 0.14, ease: 'power2.out' }, at);
              sci.fromTo(scene.state[i], { p: 0 }, { p: 1, duration: 0.14, ease: 'none' }, at + 0.07);
            });
            sci.to({}, { duration: 0.1 });
          } else if (desktop && stageEl) {
            scene.state.forEach((l) => (l.p = 1));
            ScrollTrigger.create({
              trigger: stageEl,
              start: 'top 20%',
              end: 'bottom 80%',
              onToggle: (self) => (scene.live = self.isActive),
            });
          }
        }

        if (type === 'when') {
          const steps = $$('[data-step]', section);
          const n = Math.max(1, steps.length);
          const setStep = (progress) => {
            const active = Math.min(n - 1, Math.floor(progress * n));
            steps.forEach((s, i) => s.classList.toggle('is-on', i <= active));
          };
          const stageEl = $('.when__stage', section);
          const slotEl = $('.slot--when', section);
          const fill = $('.timeline__fill', section);
          if (desktop && motion && stageEl && n > 1) {
            setStep(0);
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: `+=${60 + n * 36}%`,
                pin: stageEl,
                scrub: 0.6,
                anticipatePin: 1,
                onUpdate: (self) => setStep(self.progress),
              },
            });
            const edge = 50 / n;
            if (slotEl) tl.fromTo(slotEl, { left: `${edge}%` }, { left: `${100 - edge}%`, ease: 'none', duration: 1 }, 0);
            if (fill) tl.fromTo(fill, { scaleX: edge / 100 }, { scaleX: 1 - edge / 100, ease: 'none', duration: 1 }, 0);
          } else {
            steps.forEach((s) => s.classList.add('is-on'));
            if (reveals && steps.length) {
              gsap.from(steps, {
                y: 40,
                autoAlpha: 0,
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.12,
                clearProps: 'opacity,visibility,transform',
                scrollTrigger: { trigger: $('.steps', section) || section, start: 'top 80%', once: true },
              });
            }
          }
        }
      });

      // Footer: the stick lands on the logo.
      const footerSlot = slots.find((s) => s.el.dataset.slot === 'footer');
      const footerStage = $('.footer__stage');
      if (footerSlot && footerStage) {
        footerSlot.el.dataset.enter = 'top bottom';
        footerSlot.el.dataset.settle = 'bottom bottom';
        slotTrigger(footerSlot, footerStage);
        ScrollTrigger.create({
          trigger: footerStage,
          start: 'top bottom',
          end: 'bottom bottom',
          onUpdate: (self) => {
            if (self.progress > 0.97 && !footerLanded) {
              footerLanded = true;
              if (stage && motion) stage.squeeze(0.8);
            } else if (self.progress < 0.7) footerLanded = false;
          },
        });
      }
      if (reveals && footerStage) {
        const art = $('.wordmark--footer', footerStage);
        if (art) {
          gsap.from(art, {
            yPercent: 40,
            autoAlpha: 0,
            duration: 1.2,
            ease: 'power4.out',
            clearProps: 'opacity,visibility,transform',
            scrollTrigger: { trigger: footerStage, start: 'top 80%', once: true },
          });
        }
      }

      // Nav state for links to sections on this page.
      $$('.nav a[href*="#"]').forEach((a) => {
        const target = sameHashTarget(a);
        if (!target || target === 0) return;
        ScrollTrigger.create({
          trigger: target,
          start: 'top 55%',
          end: 'bottom 45%',
          onToggle: (self) => {
            if (self.isActive) a.setAttribute('aria-current', 'true');
            else if (a.getAttribute('aria-current') === 'true') a.removeAttribute('aria-current');
          },
        });
      });

      return () => {
        slots.forEach((s) => (s.st = null));
        scienceScenes.forEach((scene) => (scene.live = false));
      };
    }
  );
  loadStage();
}

/* Pointer parallax on the night scene. */
if (finePointer && !reduced) {
  let queued = false;
  let px = 0;
  let py = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        $$('.hero__bokeh--near').forEach((el) => gsap.to(el, { x: px * -60, y: py * -30, duration: 1.2, ease: 'power3.out', overwrite: 'auto' }));
        $$('.hero__bokeh--far').forEach((el) => gsap.to(el, { x: px * -18, duration: 1.6, ease: 'power3.out', overwrite: 'auto' }));
      });
    },
    { passive: true }
  );
}

/* ------------------------------------------------------------------
   Cart, toast, fly-to-cart
   ------------------------------------------------------------------ */
const cart = createCart({
  routes: CFG.routes,
  strings: CFG.strings,
  lockScroll: () => lenis && lenis.stop(),
  unlockScroll: () => lenis && lenis.start(),
});

const toastEl = $('[data-toast]');
let toastTimer = 0;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
}

function bump() {
  const b = $('.cart-btn');
  if (!b) return;
  b.classList.remove('is-bumped');
  void b.offsetWidth;
  b.classList.add('is-bumped');
}

function flyToCart(from) {
  const to = $('.cart-btn');
  if (!from || !to || reduced || typeof from.animate !== 'function') return false;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!b.width) return false;
  const x0 = a.left + a.width / 2 - 7;
  const y0 = a.top + a.height / 2 - 7;
  const dx = b.left + b.width / 2 - 7 - x0;
  const dy = b.top + b.height / 2 - 7 - y0;
  const dot = document.createElement('span');
  dot.className = 'fly-dot';
  dot.setAttribute('aria-hidden', 'true');
  dot.style.left = `${x0}px`;
  dot.style.top = `${y0}px`;
  document.body.appendChild(dot);
  dot
    .animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.5 - 140}px) scale(1.3)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.4)` },
      ],
      { duration: 760, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    )
    .finished.then(() => {
      dot.remove();
      bump();
    })
    .catch(() => dot.remove());
  return true;
}

async function addToCart({ id, quantity, title, button }) {
  await cart.add([{ id, quantity }]);
  if (stage) stage.squeeze(1);
  if (CFG.cartType === 'page') {
    window.location.href = CFG.routes.cart;
    return;
  }
  const flew = CFG.cartType === 'drawer' && cart.hasDrawer() ? false : flyToCart(button);
  if (!flew) bump();
  if (CFG.cartType === 'drawer' && cart.hasDrawer()) cart.open();
  else toast(`${quantity} × ${title} ${CFG.strings.added}`);
}

/* ------------------------------------------------------------------
   Buy forms and product galleries
   ------------------------------------------------------------------ */
function initBuyForms(scope = document) {
  buyForms = buyForms.filter((b) => b.form.isConnected);
  $$('[data-buy-form]', scope).forEach((form) => {
    if (form.dataset.ready) return;
    const b = createBuyForm(form, {
      moneyFormat: CFG.moneyFormat,
      strings: CFG.strings,
      flavourById,
      onFlavour: (id) => setFlavour(id),
      onAdd: addToCart,
    });
    if (!b) return;
    form.dataset.ready = 'true';
    buyForms.push(b);
  });
}

function initGalleries(scope = document) {
  $$('[data-gallery]', scope).forEach((gallery) => {
    if (gallery.dataset.ready) return;
    gallery.dataset.ready = 'true';
    const show = (key) => {
      const item = $(`[data-gallery-item="${key}"]`, gallery);
      if (!item) return false;
      $$('[data-gallery-item]', gallery).forEach((el) => {
        const on = el === item;
        el.hidden = !on;
        el.classList.toggle('is-active', on);
        if (!on) $$('video', el).forEach((v) => v.pause());
      });
      $$('[data-gallery-thumb]', gallery).forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.galleryThumb === key)));
      return true;
    };
    gallery.addEventListener('click', (e) => {
      const thumb = e.target.closest('[data-gallery-thumb]');
      if (thumb) show(thumb.dataset.galleryThumb);
    });
    const section = gallery.closest('[data-product-section]');
    if (section) {
      section.addEventListener('sahsih:variant', (e) => {
        const v = e.detail && e.detail.variant;
        const active = $('[data-gallery-item].is-active', gallery);
        if (!v || !v.media || (active && active.dataset.galleryItem === '3d')) return;
        show(String(v.media));
      });
    }
  });
}

/* ------------------------------------------------------------------
   Navigation: same-page anchors, mobile menu, auto-submitting selects
   ------------------------------------------------------------------ */
function sameHashTarget(a) {
  const href = a.getAttribute('href');
  if (!href || !href.includes('#')) return null;
  let url;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  const here = window.location.pathname.replace(/\/$/, '');
  const there = url.pathname.replace(/\/$/, '');
  if (url.origin !== window.location.origin || there !== here || !url.hash || url.hash === '#') return null;
  const id = decodeURIComponent(url.hash.slice(1));
  if (id === 'top') return 0;
  return document.getElementById(id);
}

const menuBtn = $('[data-menu]');
const nav = $('[data-nav]');
function setMenu(open) {
  if (!menuBtn || !nav) return;
  nav.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? CFG.strings.close : CFG.strings.menu;
}
if (menuBtn) menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
desktopMQ.addEventListener('change', () => setMenu(false));

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const target = sameHashTarget(a);
  if (target === null) return;
  e.preventDefault();
  setMenu(false);
  if (a.hasAttribute('data-cart-continue')) cart.close({ restoreFocus: false });
  scrollToTarget(target);
  if (target && target !== 0) history.replaceState(null, '', `#${target.id}`);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) {
    setMenu(false);
    menuBtn.focus();
  }
  if (e.key === 'Escape') $$('.nav__group[open]').forEach((d) => d.removeAttribute('open'));
});

// Close desktop dropdowns when clicking elsewhere.
document.addEventListener('click', (e) => {
  $$('.nav__group[open]').forEach((d) => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-autosubmit]');
  if (sel && sel.form) sel.form.submit();
});

/* ------------------------------------------------------------------
   Theme editor
   ------------------------------------------------------------------ */
let rebuildTimer = 0;
function rebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    buildScenes();
    ScrollTrigger.refresh();
  }, 60);
}

function initSection(scope) {
  paintHeroes(scope);
  countUp(scope, false);
  initBuyForms(scope);
  initGalleries(scope);
  setFlavour(flavour, { quiet: true });
}

if (designMode) {
  document.addEventListener('shopify:section:load', (e) => {
    initSection(e.target);
    rebuild();
  });
  document.addEventListener('shopify:section:unload', rebuild);
  document.addEventListener('shopify:section:reorder', rebuild);
  document.addEventListener('shopify:block:select', (e) => {
    const details = e.target.closest && e.target.closest('details');
    if (details) details.open = true;
  });
}

/* ------------------------------------------------------------------
   Resize
   ------------------------------------------------------------------ */
let resizeTimer = 0;
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  setPageWidth();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Phones fire resize when the address bar hides; only repaint on real width changes.
    if (window.innerWidth !== lastWidth) {
      lastWidth = window.innerWidth;
      paintHeroes();
    }
    ScrollTrigger.refresh();
  }, 200);
});

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */
paintHeroes();
initBuyForms();
initGalleries();

// Start the 3D straight away, before fonts and scroll scenes.
slots = collectSlots();
loadStage();

// On a product page the page takes the product's flavour; elsewhere the first.
const productForm = buyForms.find((b) => b.ownsUrl && b.flavour());
setFlavour(productForm ? productForm.flavour() : flavour, { quiet: true });

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))]).then(() => {
  buildScenes();
  if (CFG.pageType === 'index' || $('.hero')) intro();
  else countUp();
  ScrollTrigger.refresh();
  if (window.location.hash && window.location.hash.length > 1) {
    let target = null;
    try {
      target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    } catch {
      target = null;
    }
    if (target) requestAnimationFrame(() => scrollToTarget(target, { immediate: true }));
  }
});

