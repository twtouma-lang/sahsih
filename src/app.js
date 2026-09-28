/* Sahsih page behaviour.
 *
 * Smooth scrolling (Lenis) drives ScrollTrigger. Every section has an
 * invisible "slot" where the 3D sachet should sit; as you scroll, the
 * sachet travels from slot to slot (see getPose). The WebGL stage itself
 * lives in scripts/stage.js and is loaded after first paint.
 *
 * Hidden starting states are only ever set from here, so the page reads
 * completely without JavaScript and with reduced motion.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { CONFIG, flavourById, packById } from './config.js';
import { createCart, describe, lineKey, money } from './cart.js';
import { paintBackdrop } from './backdrop.js';
import { tintTables } from './tint.js';

gsap.registerPlugin(ScrollTrigger);
if (window.__SAHSIH_DEBUG) window.__sahsih = { gsap, ScrollTrigger };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopMQ = window.matchMedia('(min-width: 900px)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

const asset = (name) => {
  const tpl = $('#assets');
  const img = tpl && tpl.content.querySelector(`[data-asset="${name}"]`);
  return img ? img.getAttribute('src') : null;
};

/* ------------------------------------------------------------------
   Tokens from config, page width
   ------------------------------------------------------------------ */
for (const f of CONFIG.flavours) root.style.setProperty(`--f-${f.id}`, f.accent);
function setPageWidth() {
  root.style.setProperty('--page-w', `${root.clientWidth}px`);
}
setPageWidth();

/* ------------------------------------------------------------------
   Smooth scroll
   ------------------------------------------------------------------ */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
const velocity = () => (lenis ? lenis.velocity : 0);

function scrollToTarget(target, { immediate = false } = {}) {
  const top = target === 0 ? 0 : target;
  if (lenis) lenis.scrollTo(top, { duration: 1.6, immediate, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (top === 0) window.scrollTo({ top: 0, behavior: 'auto' });
  else top.scrollIntoView({ behavior: 'auto', block: 'start' });
}

/* ------------------------------------------------------------------
   Stage handle and pointer
   ------------------------------------------------------------------ */
let stage = null;
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
   Flavour state: one flavour at a time drives the sachet, the accent
   colour, the posters, the shop and the section tints.
   ------------------------------------------------------------------ */
let flavour = CONFIG.defaultFlavour;

/* The logo keeps its original pink and blue for the default flavour and
   is recoloured for the others, the same way the printed packs are. */
function tintLogo(f) {
  const original = f.id === CONFIG.defaultFlavour;
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
  gsap.fromTo(
    '.wordmark__art',
    { scaleX: 1.06, scaleY: 0.86 },
    { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' }
  );
}

function setFlavour(id) {
  const f = flavourById(id);
  if (!f) return;
  const changed = f.id !== flavour;
  flavour = f.id;
  root.style.setProperty('--accent', f.accent);
  root.style.setProperty('--accent-light', f.light);
  root.dataset.flavour = f.id;
  tintLogo(f);
  if (changed) wobbleLogo();
  $$('.swatch').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.flavour === f.id)));
  $$('.flavour-row').forEach((el) => el.classList.toggle('is-current', el.dataset.flavour === f.id));
  $$('input[name="flavour"]').forEach((el) => {
    el.checked = el.value === f.id;
  });
  const poster = asset(`stick-${f.id}`);
  if (poster) $$('[data-poster]').forEach((img) => (img.src = poster));
  const box = asset(`box-${f.id}`);
  if (box) $$('[data-box]').forEach((img) => (img.src = box));
  if (changed && stage) stage.setFlavour(f.id);
  updateTotal();
}

document.addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (sw) setFlavour(sw.dataset.flavour);
  const row = e.target.closest('.flavour-row');
  if (row) {
    setFlavour(row.dataset.flavour);
    const shop = $('#shop');
    if (shop) scrollToTarget(shop);
  }
});
$$('.flavour-row').forEach((row) => {
  row.addEventListener('pointerenter', () => setFlavour(row.dataset.flavour));
  row.addEventListener('focus', () => setFlavour(row.dataset.flavour));
});

/* ------------------------------------------------------------------
   Slots and pose: where the sachet should be right now
   ------------------------------------------------------------------ */
const slots = $$('[data-slot]').map((el) => ({
  el,
  tilt: Number(el.dataset.tilt || 0),
  spin: el.dataset.spin ? Number(el.dataset.spin) : 1,
  face: Number(el.dataset.face || 0),
  glow: el.dataset.glow ? Number(el.dataset.glow) : 0.55,
  fill: el.dataset.fill ? Number(el.dataset.fill) : 0.92,
  st: null,
}));

function slotPose(s) {
  const r = s.el.getBoundingClientRect();
  return {
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    h: r.height * s.fill,
    tilt: s.tilt,
    spin: s.spin,
    face: s.face,
    glow: s.glow,
  };
}

function mix(a, b, t) {
  const o = {};
  for (const k in a) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

/* Start from the last slot we have fully arrived at, then blend toward
   any slot we are part-way into. Two rect reads per frame, typically. */
function getPose() {
  let start = 0;
  for (let i = slots.length - 1; i > 0; i--) {
    if (slots[i].st && slots[i].st.progress >= 1) {
      start = i;
      break;
    }
  }
  let pose = slotPose(slots[start]);
  for (let i = start + 1; i < slots.length; i++) {
    const p = slots[i].st ? slots[i].st.progress : 0;
    if (p <= 0) continue;
    pose = mix(pose, slotPose(slots[i]), reduced ? (p > 0.5 ? 1 : 0) : smooth(p));
  }
  return pose;
}

/* Clicks and hover on the sachet. The slots sit above the canvas. */
let hoverQueued = false;
let lastHover = null;
slots.forEach((s) => {
  s.el.addEventListener('click', (e) => {
    const keyboard = e.detail === 0;
    if (stage && (keyboard || stage.hitTest(e.clientX, e.clientY))) stage.squeeze(1);
    else if (!stage) {
      s.el.classList.remove('is-squeezed');
      void s.el.offsetWidth;
      s.el.classList.add('is-squeezed');
    }
  });
  if (finePointer) {
    s.el.addEventListener('pointermove', (e) => {
      lastHover = { el: s.el, x: e.clientX, y: e.clientY };
      if (hoverQueued) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        if (!lastHover || !stage) return;
        lastHover.el.classList.toggle('is-over', stage.hitTest(lastHover.x, lastHover.y));
      });
    });
    s.el.addEventListener('pointerleave', () => {
      s.el.classList.remove('is-over');
      lastHover = null;
    });
  }
});

/* ------------------------------------------------------------------
   Science callouts: lines from each HUD label to the ingredient row on
   the actual 3D label, redrawn after every WebGL frame.
   ------------------------------------------------------------------ */
const callouts = $$('[data-callout]');
const lines = $$('[data-line]');
const dots = $$('[data-dot]');
const lineState = callouts.map(() => ({ p: 1 }));
const calloutSvg = $('.callout-lines');
let calloutsLive = false;
let calloutsDrawn = false;

function clearCallouts() {
  if (!calloutsDrawn) return;
  calloutsDrawn = false;
  lines.forEach((l) => l.setAttribute('d', ''));
  dots.forEach((d) => (d.style.opacity = '0'));
}

function drawCallouts() {
  if (!calloutsLive || !stage || !calloutSvg || !desktopMQ.matches) return clearCallouts();
  calloutsDrawn = true;
  const box = calloutSvg.getBoundingClientRect();
  callouts.forEach((c, i) => {
    const line = lines[i];
    const dot = dots[i];
    const a = stage.project(i);
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
    const p = lineState[i].p * visible;
    line.style.strokeDasharray = `${len} ${len}`;
    line.style.strokeDashoffset = String(len * (1 - p));
    dot.setAttribute('cx', ex.toFixed(1));
    dot.setAttribute('cy', ey.toFixed(1));
    dot.style.opacity = p > 0.96 ? '1' : '0';
  });
}

/* ------------------------------------------------------------------
   Load the 3D stage after first paint
   ------------------------------------------------------------------ */
/* A quick check only: opening a throwaway WebGL context to test support
   costs time on every device. If the browser has WebGL but cannot create a
   context, the stage's own start-up fails and the photos show instead. */
function webglAvailable() {
  return typeof window.WebGLRenderingContext !== 'undefined';
}

/* While the 3D loads, the flat photos stay hidden (.stage-on in the CSS);
   they appear straight away if this device cannot draw 3D (.no-3d). */
function showPosters() {
  if (!root.classList.contains('has-3d')) root.classList.add('no-3d');
}

function mountStage() {
  if (stage) return;
  if (!window.SahsihStage) return showPosters();
  try {
    stage = window.SahsihStage.mount({
      canvas: $('#stage'),
      getPose,
      getVelocity: velocity,
      getPointer: () => pointer,
      logoSrc: asset('logo'),
      reducedMotion: reduced,
      mobile: !desktopMQ.matches,
      initialFlavour: flavour,
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
  if (!webglAvailable()) return showPosters();
  if (window.SahsihStage) return mountStage();
  const s = document.createElement('script');
  s.src = 'scripts/stage.js';
  s.async = true;
  s.onload = mountStage;
  s.onerror = showPosters;
  document.head.appendChild(s);
}

/* ------------------------------------------------------------------
   Hero: backdrop, intro sequence, HUD counters, parallax
   ------------------------------------------------------------------ */
const bokeh = { far: $('[data-bokeh="far"]'), near: $('[data-bokeh="near"]') };
function paint() {
  paintBackdrop(bokeh, { mobile: !desktopMQ.matches });
}
paint();

function countUp() {
  $$('[data-count]').forEach((el, i) => {
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.countFrom || 0);
    if (reduced) {
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
  if (reduced) return countUp();
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.bar', { yPercent: -100, autoAlpha: 0, duration: 0.9 }, 0)
    .from('.hero__bg', { autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, 0)
    .from('[data-wordmark] .wordmark__art', { yPercent: -35, scaleY: 1.3, scaleX: 0.82, autoAlpha: 0, duration: 1.5, ease: 'elastic.out(1, 0.45)' }, 0.1)
    .from('.hero__title .line > span', { yPercent: 110, duration: 1, stagger: 0.09 }, 0.35)
    .from('.hud__panel', { x: 40, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.45)
    .from('.swatch', { scale: 0, duration: 0.6, stagger: 0.06, ease: 'back.out(2.2)', clearProps: 'transform' }, 0.6)
    .from('.hero__intro > *', { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.7)
    .from('.hero__hint', { autoAlpha: 0, duration: 0.8 }, 1.1);
  countUp();
}

/* ------------------------------------------------------------------
   Scroll choreography (rebuilt per breakpoint by gsap.matchMedia)
   ------------------------------------------------------------------ */
const steps = $$('[data-step]');
function setStep(progress) {
  const active = progress < 0.3 ? 0 : progress < 0.7 ? 1 : 2;
  steps.forEach((s, i) => {
    s.classList.toggle('is-on', i <= active);
    s.classList.toggle('is-current', i === active);
  });
}

let footerLanded = false;
const mm = gsap.matchMedia();
mm.add(
  {
    desktop: '(min-width: 900px)',
    mobile: '(max-width: 899px)',
    reduce: '(prefers-reduced-motion: reduce)',
  },
  (ctx) => {
    const { desktop, reduce } = ctx.conditions;
    const motion = !reduce;

    // Hero parallax.
    if (motion) {
      gsap
        .timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
        // Animate the art, not its wrapper: the wrapper's CSS translate centres it.
        .to('[data-wordmark] .wordmark__art', { yPercent: desktop ? -40 : -20, scale: desktop ? 0.9 : 1, autoAlpha: 0.15, ease: 'none' }, 0)
        .to('.hero__bokeh--near', { yPercent: -14, ease: 'none' }, 0)
        .to('.hero__bokeh--far', { yPercent: -5, ease: 'none' }, 0)
        .to('.hud', { y: -140, autoAlpha: 0, ease: 'none' }, 0)
        .to('.hero__intro', { y: -80, ease: 'none' }, 0);
    }

    // Reveals, in document order so pinned sections below measure correctly.
    const reveal = (group) => {
      if (!motion) return;
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

    // Slot transitions are created in page order too.
    const slotTrigger = (s) => {
      const el = s.el.dataset.trigger ? $(s.el.dataset.trigger) : s.el.closest('[data-section]');
      s.st = ScrollTrigger.create({
        trigger: el,
        start: s.el.dataset.enter || 'top 88%',
        end: s.el.dataset.settle || 'top 18%',
      });
    };

    const byName = (name) => slots.find((s) => s.el.dataset.slot === name);

    // Flavours
    $$('.flavours [data-reveal]').forEach(reveal);
    if (motion) {
      gsap.from('.flavour-row', {
        x: -50,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.07,
        clearProps: 'opacity,visibility,transform',
        scrollTrigger: { trigger: '.flavour-list', start: 'top 85%', once: true },
      });
    }
    slotTrigger(byName('flavours'));

    // Science
    $$('.science [data-reveal]').forEach(reveal);
    slotTrigger(byName('science'));
    if (desktop && motion) {
      lineState.forEach((l) => (l.p = 0));
      // Lines only while the scene is pinned: after that the sachet leaves.
      const sci = gsap.timeline({
        scrollTrigger: {
          trigger: '.science',
          start: 'top top',
          end: '+=150%',
          pin: '.science__stage',
          scrub: 0.6,
          anticipatePin: 1,
          onToggle: (self) => (calloutsLive = self.isActive),
        },
      });
      sci.fromTo('.slot--science', { scale: 0.74 }, { scale: 1.12, ease: 'none', duration: 1 }, 0);
      callouts.forEach((c, i) => {
        const at = 0.1 + i * 0.25;
        sci.fromTo(c, { autoAlpha: 0, x: i === 1 ? 50 : -50 }, { autoAlpha: 1, x: 0, duration: 0.14, ease: 'power2.out' }, at);
        sci.fromTo(lineState[i], { p: 0 }, { p: 1, duration: 0.14, ease: 'none' }, at + 0.07);
      });
      sci.to({}, { duration: 0.1 });
    } else if (desktop) {
      lineState.forEach((l) => (l.p = 1));
      ScrollTrigger.create({
        trigger: '.science__stage',
        start: 'top 20%',
        end: 'bottom 80%',
        onToggle: (self) => (calloutsLive = self.isActive),
      });
    }

    // When to take
    $$('.when [data-reveal]').forEach(reveal);
    slotTrigger(byName('when'));
    // Desktop and phones alike: the section holds while the stick travels
    // the timeline (phones swap the step text under the rail, see .is-scene).
    if (motion) {
      $$('.when').forEach((w) => w.classList.add('is-scene'));
      setStep(0);
      gsap
        .timeline({
          scrollTrigger: {
            trigger: '.when',
            start: 'top top',
            end: desktop ? '+=170%' : '+=150%',
            pin: '.when__stage',
            scrub: 0.6,
            anticipatePin: 1,
            onUpdate: (self) => setStep(self.progress),
          },
        })
        .fromTo('.slot--when', { left: '16.7%' }, { left: '83.3%', ease: 'none', duration: 1 }, 0)
        .fromTo('.timeline__fill', { scaleX: 0.167 }, { scaleX: 0.833, ease: 'none', duration: 1 }, 0);
    } else {
      setStep(1);
      steps.forEach((s) => s.classList.add('is-on'));
      if (motion) {
        gsap.from('.step', {
          y: 40,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          clearProps: 'opacity,visibility,transform',
          scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true },
        });
      }
    }

    // Shop
    $$('.shop [data-reveal]').forEach(reveal);
    slotTrigger(byName('shop'));

    // Footer: the sachet lands on the wordmark.
    const footer = byName('footer');
    footer.el.dataset.trigger = '.footer__stage';
    footer.el.dataset.enter = 'top bottom';
    footer.el.dataset.settle = 'bottom bottom';
    slotTrigger(footer);
    ScrollTrigger.create({
      trigger: '.footer__stage',
      start: footer.el.dataset.enter,
      end: footer.el.dataset.settle,
      onUpdate: (self) => {
        if (self.progress > 0.97 && !footerLanded) {
          footerLanded = true;
          if (stage && motion) stage.squeeze(0.8);
        } else if (self.progress < 0.7) footerLanded = false;
      },
    });
    if (motion) {
      gsap.from('.wordmark--footer', {
        yPercent: 40,
        autoAlpha: 0,
        duration: 1.2,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.footer__stage', start: 'top 80%', once: true },
      });
    }

    // Nav state
    $$('.nav a').forEach((a) => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      ScrollTrigger.create({
        trigger: target,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (self.isActive) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        },
      });
    });

    return () => {
      slots.forEach((s) => (s.st = null));
      calloutsLive = false;
      $$('.when').forEach((w) => w.classList.remove('is-scene'));
    };
  }
);

/* Pointer parallax on the night scene. */
if (finePointer && !reduced) {
  const nearX = gsap.quickTo('.hero__bokeh--near', 'x', { duration: 1.2, ease: 'power3.out' });
  const nearY = gsap.quickTo('.hero__bokeh--near', 'y', { duration: 1.2, ease: 'power3.out' });
  const farX = gsap.quickTo('.hero__bokeh--far', 'x', { duration: 1.6, ease: 'power3.out' });
  window.addEventListener(
    'pointermove',
    (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      nearX(x * -60);
      nearY(y * -30);
      farX(x * -18);
    },
    { passive: true }
  );
}

/* ------------------------------------------------------------------
   Shop
   ------------------------------------------------------------------ */
const form = $('[data-buy]');
const qtyOut = $('[data-qty]');
const totalOut = $('[data-total]');
let qty = 1;

$$('[data-pack-price]').forEach((el) => {
  const p = packById(el.dataset.packPrice);
  if (p) el.textContent = money.format(p.price);
});

function currentPack() {
  const checked = form && form.querySelector('input[name="pack"]:checked');
  return packById(checked ? checked.value : CONFIG.packs[0].id);
}

function updateTotal() {
  if (!totalOut) return;
  const pack = currentPack();
  totalOut.textContent = money.format(pack.price * qty);
  if (qtyOut) qtyOut.textContent = String(qty);
  if (form) form.classList.toggle('is-mixed', !!pack.mixed);
}

if (form) {
  form.addEventListener('change', (e) => {
    if (e.target.name === 'flavour') setFlavour(e.target.value);
    updateTotal();
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step-qty]');
    if (!b) return;
    qty = clamp(qty + Number(b.dataset.stepQty), 1, 20);
    updateTotal();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pack = currentPack();
    const added = cart.add(pack.id, flavour, qty);
    const d = describe(lineKey(pack.id, flavour)) || added;
    toast(`${qty} × ${d.name} added`);
    const btn = form.querySelector('[type="submit"]');
    if (!flyToCart(btn)) bump();
    if (stage) stage.squeeze(1);
  });
}

/* ------------------------------------------------------------------
   Cart, toast, fly-to-cart
   ------------------------------------------------------------------ */
const cart = createCart({
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

/* ------------------------------------------------------------------
   Navigation: anchors, mobile menu
   ------------------------------------------------------------------ */
const menuBtn = $('[data-menu]');
const nav = $('#nav');
function setMenu(open) {
  if (!menuBtn || !nav) return;
  nav.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'Close' : 'Menu';
}
if (menuBtn) menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
desktopMQ.addEventListener('change', () => setMenu(false));

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  const href = a.getAttribute('href');
  if (href === '#') return;
  const target = href === '#top' ? 0 : $(href);
  if (target === null) return;
  e.preventDefault();
  setMenu(false);
  scrollToTarget(target);
  if (href === '#main') $('#main').focus({ preventScroll: true });
  history.replaceState(null, '', href);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) {
    setMenu(false);
    menuBtn.focus();
  }
});

/* ------------------------------------------------------------------
   Resize
   ------------------------------------------------------------------ */
/* Phones fire resize whenever the address bar shows or hides during a
   scroll; recalculating the whole film then makes scrolling stutter, so
   only real width changes (rotation, window resize) count. */
let resizeTimer = 0;
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  setPageWidth();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    paint();
    ScrollTrigger.refresh();
  }, 200);
});

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */
setFlavour(CONFIG.defaultFlavour);
updateTotal();

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))]).then(() => {
  intro();
  ScrollTrigger.refresh();
  if (location.hash && location.hash.length > 1) {
    const target = $(location.hash);
    if (target) requestAnimationFrame(() => scrollToTarget(target, { immediate: true }));
  }
});

// Start the 3D straight away (index.html also preloads it).
loadStage();
