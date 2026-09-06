/* Sahsih — site behaviour.
 *
 * The page is static HTML. This file only handles the two things that move:
 * switching between the home and shop views, and the cart counter.
 */

// Editable in one place. Prices are also written into the markup as fallback
// text so the page still reads correctly with JavaScript disabled.
const CONFIG = {
  boxPrice: '$24',
  bundlePrice: '$105',
  bundleSize: 5, // sticks added by "Add the set"
};

const state = {
  view: 'home',
  cart: 0,
};

const views = {
  home: document.getElementById('view-home'),
  shop: document.getElementById('view-shop'),
};

function render() {
  for (const [name, el] of Object.entries(views)) {
    if (el) el.hidden = name !== state.view;
  }
  document.querySelectorAll('[data-bind="cartCount"]').forEach((el) => {
    el.textContent = String(state.cart);
  });
  document.querySelectorAll('[data-bind="boxPrice"]').forEach((el) => {
    el.textContent = CONFIG.boxPrice;
  });
  document.querySelectorAll('[data-bind="bundlePrice"]').forEach((el) => {
    el.textContent = CONFIG.bundlePrice;
  });
}

function setView(view, { scroll = true } = {}) {
  if (state.view === view) return;
  state.view = view;
  render();
  if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
}

function addToCart(n) {
  state.cart += n;
  render();
}

const actions = {
  goHome: () => setView('home'),
  goShop: () => setView('shop'),
  addBox: () => addToCart(1),
  addBundle: () => addToCart(CONFIG.bundleSize),
};

// One delegated listener for every [data-on-click] element in the page.
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-on-click]');
  if (target) {
    const action = actions[target.dataset.onClick];
    if (action) {
      action(target);
      return;
    }
  }

  // The #science and #when anchors live in the home view, but the footer that
  // links to them is always on screen. Go home first, then jump.
  const link = event.target.closest('a[href^="#"]');
  if (link && state.view !== 'home') {
    const id = link.getAttribute('href').slice(1);
    if (document.getElementById(id)) {
      event.preventDefault();
      setView('home', { scroll: false });
      document.getElementById(id).scrollIntoView();
    }
  }
});

// Clickable divs and spans are not focusable by default; make the ones that
// act as buttons reachable by keyboard.
document.querySelectorAll('[data-on-click]').forEach((el) => {
  if (el.tagName === 'A' || el.tagName === 'BUTTON') return;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.click();
    }
  });
});

render();
