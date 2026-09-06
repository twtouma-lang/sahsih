/* Sahsih — site behaviour.
 *
 * The page is static HTML. This file handles the things that move:
 * routing between the home and shop views, the cart counter, the scroll
 * reveals, the header state, and the compact menu.
 *
 * Three conventions connect the markup to this file:
 *   data-on-click="goShop"   runs the named action from `actions`
 *   data-bind="cartCount"    element whose text is kept in sync with state
 *   data-nav="shop"          nav item marked current for that view
 *
 * Everything animated here is expressed as a class change, so the timings
 * and curves stay in styles/site.css and nothing is duplicated.
 */

/* Editable in one place. Prices are also written into the markup as
   fallback text so the page reads correctly with JavaScript disabled. */
const CONFIG = {
  boxPrice: '$24',
  bundlePrice: '$105',
  bundleSize: 5,  // sticks added by "Add the set"
};

/* Must match --dur / --dur-slow in styles/site.css. */
const TIMING = {
  viewOut: 200,
  toast: 2600,
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  view: 'home',
  cart: 0,
};

const views = {
  home: document.getElementById('view-home'),
  shop: document.getElementById('view-shop'),
};

const header = document.getElementById('hdr');
const progress = document.getElementById('progress');
const menu = document.getElementById('menu');
const burger = document.querySelector('.burger');
const toast = document.getElementById('toast');

/* ---------------------------------------------------------------
   Rendering
   --------------------------------------------------------------- */

function setText(binding, value) {
  document.querySelectorAll('[data-bind="' + binding + '"]').forEach((el) => {
    el.textContent = value;
  });
}

function render() {
  setText('cartCount', String(state.cart));
  setText('boxPrice', CONFIG.boxPrice);
  setText('bundlePrice', CONFIG.bundlePrice);

  document.querySelectorAll('[data-nav]').forEach((el) => {
    if (el.dataset.nav === state.view) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

/* ---------------------------------------------------------------
   Views — cross-faded rather than swapped, so switching never snaps
   --------------------------------------------------------------- */

let switching = false;

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    el.hidden = key !== name;
    el.classList.remove('is-leaving', 'is-entering');
  });
}

function setView(name, options) {
  const opts = options || {};
  const scroll = opts.scroll !== false;
  const next = views[name];
  if (!next || state.view === name) return;

  const current = views[state.view];
  state.view = name;
  render();
  closeMenu();

  if (reduceMotion.matches || !current || switching) {
    showView(name);
    if (scroll) window.scrollTo(0, 0);
    return;
  }

  switching = true;
  current.classList.add('is-leaving');

  window.setTimeout(() => {
    current.hidden = true;
    current.classList.remove('is-leaving');

    next.hidden = false;
    next.classList.add('is-entering');
    if (scroll) window.scrollTo(0, 0);

    // Two frames: one to apply the entering state, one to release it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.classList.remove('is-entering');
        switching = false;
      });
    });
  }, TIMING.viewOut);
}

/* ---------------------------------------------------------------
   Routing — #shop for the shop view, #science / #when / #set anchors
   --------------------------------------------------------------- */

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const behavior = reduceMotion.matches ? 'auto' : 'smooth';
  // Wait for the incoming view to be laid out before measuring.
  window.setTimeout(() => {
    el.scrollIntoView({ behavior: behavior, block: 'start' });
  }, switching ? TIMING.viewOut + 40 : 0);
}

function viewOf(el) {
  const owner = el.closest('.view');
  return owner && owner.id === 'view-shop' ? 'shop' : 'home';
}

function applyRoute(options) {
  const opts = options || {};
  const id = decodeURIComponent(window.location.hash.replace('#', ''));

  if (!id) {
    setView('home', { scroll: opts.scroll !== false });
    return;
  }
  if (id === 'shop') {
    setView('shop', { scroll: opts.scroll !== false });
    return;
  }

  const target = document.getElementById(id);
  if (!target) {
    setView('home', { scroll: false });
    return;
  }

  setView(viewOf(target), { scroll: false });
  scrollToId(id);
}

function navigate(hash) {
  const next = hash ? '#' + hash : window.location.pathname + window.location.search;
  const same = (window.location.hash || '') === (hash ? '#' + hash : '');
  if (!same) {
    window.history.pushState({}, '', next);
  }
  applyRoute();
}

/* ---------------------------------------------------------------
   Cart
   --------------------------------------------------------------- */

let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.querySelector('.toast__text').textContent = message;
  toast.classList.add('is-shown');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-shown'), TIMING.toast);
}

function bumpCount() {
  document.querySelectorAll('.hdr__count').forEach((el) => {
    el.classList.remove('is-bumped');
    void el.offsetWidth;  // restart the keyframe
    el.classList.add('is-bumped');
  });
}

function addToCart(n, label) {
  state.cart += n;
  render();
  bumpCount();
  showToast(label + ' added · cart ' + state.cart);
}

/* ---------------------------------------------------------------
   Compact menu
   --------------------------------------------------------------- */

function setMenu(open) {
  if (!header || !menu) return;
  header.classList.toggle('is-open', open);
  menu.toggleAttribute('inert', !open);
  if (burger) burger.setAttribute('aria-expanded', String(open));
}

function closeMenu() { setMenu(false); }

/* ---------------------------------------------------------------
   Actions
   --------------------------------------------------------------- */

const actions = {
  goHome: () => navigate(''),
  goShop: () => navigate('shop'),
  addBox: (el) => addToCart(1, (el && el.dataset.flavour) || 'Box'),
  addBundle: (el) => addToCart(CONFIG.bundleSize, (el && el.dataset.flavour) || 'The Full Set'),
  toggleMenu: () => setMenu(!header.classList.contains('is-open')),
};

/* One delegated listener for every [data-on-click] element in the page. */
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-on-click]');
  if (trigger) {
    const action = actions[trigger.dataset.onClick];
    if (action) {
      event.preventDefault();
      action(trigger);
      return;
    }
  }

  // In-page anchors are routed, so a link to #science works from either
  // view and a link to #set brings the shop view with it.
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.hasAttribute('data-on-click')) return;
  const id = link.getAttribute('href').slice(1);
  if (!id) return;
  if (id !== 'shop' && !document.getElementById(id)) return;
  event.preventDefault();
  navigate(id);
});

/* The logo is an image acting as a button; give it Enter and Space. */
document.querySelectorAll('[data-on-click]').forEach((el) => {
  const tag = el.tagName;
  if (tag === 'A' || tag === 'BUTTON') return;
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.click();
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

window.addEventListener('popstate', () => applyRoute({ scroll: false }));

/* ---------------------------------------------------------------
   Scroll reveals
   --------------------------------------------------------------- */

const revealables = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  revealables.forEach((el) => observer.observe(el));
} else {
  revealables.forEach((el) => el.classList.add('is-in'));
}

/* ---------------------------------------------------------------
   Header state and scroll progress — one rAF-throttled listener
   --------------------------------------------------------------- */

let ticking = false;

function onScroll() {
  const y = window.scrollY || window.pageYOffset;
  if (header) header.classList.toggle('is-scrolled', y > 8);

  if (progress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(y / max, 1) : 0;
    progress.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
  }
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(onScroll);
}, { passive: true });

/* Keep --header-h honest so anchor scrolling clears the sticky bar. */
function measureHeader() {
  if (!header) return;
  const h = Math.round(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

if ('ResizeObserver' in window && header) {
  new ResizeObserver(measureHeader).observe(header);
} else {
  window.addEventListener('resize', measureHeader, { passive: true });
}

/* Leaving the compact breakpoint should not strand an open menu. */
window.matchMedia('(min-width: 881px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});

/* ---------------------------------------------------------------
   Boot
   --------------------------------------------------------------- */

closeMenu();
measureHeader();
render();
onScroll();
applyRoute({ scroll: false });
