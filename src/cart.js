/* Cart: line items per flavour and pack, quantities, a subtotal,
 * persistence in localStorage, and the drawer with focus handling.
 * Checkout is not live, so the order goes out as a pre-filled email.
 */
import { CONFIG, flavourById, packById } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const money = new Intl.NumberFormat(CONFIG.locale, {
  style: 'currency',
  currency: CONFIG.currency,
  maximumFractionDigits: 0,
});

/* A line key is "pack:flavour", or just "set" for the mixed pack. */
export function lineKey(packId, flavourId) {
  const pack = packById(packId);
  return pack.mixed ? pack.id : `${pack.id}:${flavourId}`;
}

export function describe(key) {
  const [packId, flavourId] = key.split(':');
  const pack = CONFIG.packs.find((p) => p.id === packId);
  if (!pack) return null;
  const flavour = flavourId ? CONFIG.flavours.find((f) => f.id === flavourId) : null;
  if (!pack.mixed && !flavour) return null;
  return {
    name: pack.mixed ? pack.name : `${flavour.name}, ${pack.name}`,
    unit: pack.mixed ? `${pack.sticks} sticks, ${pack.note.toLowerCase()}` : `${pack.sticks} sticks`,
    price: pack.price,
    color: flavour ? flavour.accent : null,
  };
}

export function createCart({ onChange = () => {}, lockScroll = () => {}, unlockScroll = () => {} } = {}) {
  let lines = load();

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const clean = {};
      for (const [key, qty] of Object.entries(parsed)) {
        if (describe(key) && Number.isInteger(qty) && qty > 0) clean[key] = Math.min(qty, 99);
      }
      return clean;
    } catch {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(lines));
    } catch {
      // Storage can be blocked; the cart still works for this visit.
    }
  }

  const count = () => Object.values(lines).reduce((a, b) => a + b, 0);
  const subtotal = () => Object.entries(lines).reduce((sum, [k, q]) => sum + describe(k).price * q, 0);

  function setQty(key, qty) {
    if (!describe(key)) return;
    const next = Math.max(0, Math.min(99, Math.trunc(qty)));
    if (next === 0) delete lines[key];
    else lines[key] = next;
    save();
    render();
  }

  function add(packId, flavourId, qty = 1) {
    const key = lineKey(packId, flavourId);
    setQty(key, (lines[key] || 0) + qty);
    return describe(key);
  }

  /* Rendering */
  const drawer = $('#cart');
  const backdrop = $('.cart-backdrop');
  const itemsEl = $('[data-cart-items]');
  const emptyEl = $('[data-cart-empty]');
  const footEl = $('[data-cart-foot]');
  const subtotalEl = $('[data-cart-subtotal]');
  const orderEl = $('[data-cart-order]');
  const page = $('#page');

  function mailto() {
    const rows = Object.entries(lines).map(([k, q]) => {
      const d = describe(k);
      return `- ${q} x ${d.name} (${d.unit}) ${money.format(d.price * q)}`;
    });
    const body = [
      'Hi Sahsih,',
      '',
      "I'd like to order:",
      ...rows,
      '',
      `Subtotal: ${money.format(subtotal())}`,
      '',
      'Name:',
      'Delivery address:',
      '',
    ].join('\n');
    return `mailto:${CONFIG.orderEmail}?subject=${encodeURIComponent('Sahsih order')}&body=${encodeURIComponent(body)}`;
  }

  function render() {
    const n = count();
    $$('[data-bind="cartCount"]').forEach((el) => {
      el.textContent = String(n);
    });
    $$('.cart-btn').forEach((el) => {
      el.classList.toggle('has-items', n > 0);
      el.setAttribute('aria-label', n === 1 ? 'Cart, 1 item' : `Cart, ${n} items`);
    });
    if (!drawer) return;
    const keys = Object.keys(lines);
    emptyEl.hidden = keys.length > 0;
    itemsEl.hidden = keys.length === 0;
    footEl.hidden = keys.length === 0;
    itemsEl.replaceChildren(
      ...keys.map((k) => {
        const d = describe(k);
        const q = lines[k];
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.style.setProperty(
          '--dot',
          d.color || `conic-gradient(${CONFIG.flavours.map((f) => f.accent).join(', ')}, ${CONFIG.flavours[0].accent})`
        );
        li.innerHTML = `
          <span class="cart-item__dot" aria-hidden="true"></span>
          <div class="cart-item__info">
            <span class="cart-item__name">${d.name}</span>
            <span class="cart-item__each">${money.format(d.price)} each, ${d.unit}</span>
          </div>
          <span class="cart-item__total">${money.format(d.price * q)}</span>
          <div class="stepper" role="group" aria-label="Quantity of ${d.name}">
            <button type="button" data-line="${k}" data-delta="-1" aria-label="Decrease quantity of ${d.name}">&minus;</button>
            <output aria-label="Quantity">${q}</output>
            <button type="button" data-line="${k}" data-delta="1" aria-label="Increase quantity of ${d.name}">+</button>
          </div>
          <button type="button" class="cart-item__remove" data-remove="${k}">Remove<span class="visually-hidden"> ${d.name}</span></button>`;
        return li;
      })
    );
    subtotalEl.textContent = money.format(subtotal());
    orderEl.href = mailto();
    onChange(n);
  }

  /* Drawer */
  let lastFocus = null;
  function open() {
    if (!drawer || !drawer.hidden) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    backdrop.hidden = false;
    page.setAttribute('inert', '');
    lockScroll();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        backdrop.classList.add('is-open');
      })
    );
    const close = $('[data-close-cart]', drawer);
    if (close) close.focus();
  }

  function close() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    page.removeAttribute('inert');
    unlockScroll();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      drawer.hidden = true;
      backdrop.hidden = true;
    };
    if (reduce) finish();
    else setTimeout(finish, 460);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  document.addEventListener('click', (event) => {
    const t = event.target.closest('[data-open-cart], [data-close-cart], [data-close-cart-link], [data-line], [data-remove]');
    if (!t) return;
    if (t.hasAttribute('data-open-cart')) open();
    else if (t.hasAttribute('data-close-cart') || t.hasAttribute('data-close-cart-link')) close();
    else if (t.hasAttribute('data-line')) setQty(t.dataset.line, (lines[t.dataset.line] || 0) + Number(t.dataset.delta));
    else if (t.hasAttribute('data-remove')) setQty(t.dataset.remove, 0);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer && !drawer.hidden) close();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === CONFIG.storageKey) {
      lines = load();
      render();
    }
  });

  render();
  return { add, open, close, count };
}
