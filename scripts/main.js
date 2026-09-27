/* Sahsih site behaviour.
 *
 * The page is static HTML. This file handles the things that move:
 *   - hash routing between the home and shop views (#home, #shop, plus the
 *     #science and #when anchors, which always live in the home view)
 *   - the cart: line items per box, quantities, a subtotal, persistence in
 *     localStorage and a drawer with proper focus handling
 *   - the ticker pause control, the mobile menu and the scroll reveals
   - motion that needs script: stats counting up, the hero stage tilting
     toward the cursor, and the dot that flies from an Add button to the
     cart (all skipped under prefers-reduced-motion)
 *
 * No dependencies, no build step. Everything is attached with delegated
 * listeners, so new buttons only need the right data- attribute.
 */
(() => {
  'use strict';

  // Editable in one place. Prices are also written into the markup as
  // fallback text so the page still reads correctly with JavaScript off.
  const CONFIG = {
    locale: 'en-US',
    currency: 'USD',
    orderEmail: 'hello@sahsih.com',
    storageKey: 'sahsih-cart-v1',
    products: {
      berry: { name: 'Berry', unit: 'box of 10', price: 24 },
      mango: { name: 'Mango', unit: 'box of 10', price: 24 },
      pineapple: { name: 'Pineapple', unit: 'box of 10', price: 24 },
      watermelon: { name: 'Watermelon', unit: 'box of 10', price: 24 },
      citrus: { name: 'Citrus', unit: 'box of 10', price: 24 },
      bundle: { name: 'The Full Set', unit: 'five boxes', price: 105 },
    },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = new Intl.NumberFormat(CONFIG.locale, {
    style: 'currency',
    currency: CONFIG.currency,
    maximumFractionDigits: 0,
  });
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BASE_TITLE = document.title;

  /* ------------------------------------------------------------------
     Views and routing
     ------------------------------------------------------------------ */
  const views = { home: $('#home'), shop: $('#shop') };
  let currentView = null;

  function setView(name) {
    if (currentView === name) return false;
    currentView = name;
    for (const [key, el] of Object.entries(views)) {
      if (el) el.hidden = key !== name;
    }
    $$('.site-nav a').forEach((link) => {
      const target = link.getAttribute('href').slice(1);
      if (target === name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = name === 'shop' ? `Shop | ${BASE_TITLE}` : BASE_TITLE;
    return true;
  }

  function route(initial) {
    const hash = decodeURIComponent(location.hash.slice(1));
    const name = hash === 'shop' ? 'shop' : 'home';
    const changed = setView(name);
    const anchor = hash && hash !== 'home' && hash !== 'shop' && document.getElementById(hash);

    if (anchor) {
      // The browser only scrolls to an anchor natively when it was visible
      // at the time the hash changed. If we just switched views, do it now.
      if (changed || initial) anchor.scrollIntoView({ block: 'start' });
    } else if (changed && !initial) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const heading = views[name] && views[name].querySelector('h1');
      if (heading) heading.focus({ preventScroll: true });
    }
    closeMenu();
  }

  window.addEventListener('hashchange', () => route(false));

  /* ------------------------------------------------------------------
     Cart state
     ------------------------------------------------------------------ */
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const clean = {};
      for (const [id, qty] of Object.entries(parsed)) {
        if (CONFIG.products[id] && Number.isInteger(qty) && qty > 0) clean[id] = Math.min(qty, 99);
      }
      return clean;
    } catch {
      return {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart));
    } catch {
      // Storage can be unavailable (private mode, blocked). The cart still
      // works for the session.
    }
  }

  const cartCount = () => Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartSubtotal = () =>
    Object.entries(cart).reduce((sum, [id, qty]) => sum + CONFIG.products[id].price * qty, 0);

  function setQty(id, qty) {
    if (!CONFIG.products[id]) return;
    const next = Math.max(0, Math.min(99, Math.trunc(qty)));
    if (next === 0) delete cart[id];
    else cart[id] = next;
    saveCart();
    renderCart();
  }

  function bumpCartButton() {
    const button = $('.cart-button');
    if (!button) return;
    button.classList.remove('is-bumped');
    void button.offsetWidth; // restart the animation
    button.classList.add('is-bumped');
  }

  // A pink dot leaves the button and lands on the cart, then the cart bumps.
  function flyToCart(from) {
    const to = $('.cart-button');
    if (!from || !to || reducedMotion() || typeof from.animate !== 'function') return false;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const size = 14;
    const x0 = a.left + a.width / 2 - size / 2;
    const y0 = a.top + a.height / 2 - size / 2;
    const dx = b.left + b.width / 2 - size / 2 - x0;
    const dy = b.top + b.height / 2 - size / 2 - y0;
    const dot = document.createElement('span');
    dot.className = 'fly';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.left = `${x0}px`;
    dot.style.top = `${y0}px`;
    document.body.appendChild(dot);
    const animation = dot.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(0.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.7 },
      ],
      { duration: 680, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
    animation.finished
      .then(() => {
        dot.remove();
        bumpCartButton();
      })
      .catch(() => dot.remove());
    return true;
  }

  function addToCart(id, from) {
    if (!CONFIG.products[id]) return;
    setQty(id, (cart[id] || 0) + 1);
    toast(`${CONFIG.products[id].name} added to cart`);
    if (!flyToCart(from)) bumpCartButton();
  }

  /* ------------------------------------------------------------------
     Cart rendering
     ------------------------------------------------------------------ */
  const cartEl = $('#cart');
  const itemsEl = $('[data-cart-items]');
  const emptyEl = $('[data-cart-empty]');
  const footEl = $('[data-cart-foot]');
  const subtotalEl = $('[data-cart-subtotal]');
  const orderEl = $('[data-cart-order]');

  function orderMailto() {
    const lines = Object.entries(cart).map(([id, qty]) => {
      const p = CONFIG.products[id];
      return `- ${qty} x ${p.name} (${p.unit}) ${money.format(p.price * qty)}`;
    });
    const body = [
      'Hi Sahsih,',
      '',
      "I'd like to order:",
      ...lines,
      '',
      `Subtotal: ${money.format(cartSubtotal())}`,
      '',
      'Name:',
      'Delivery address:',
      '',
    ].join('\n');
    return `mailto:${CONFIG.orderEmail}?subject=${encodeURIComponent('Sahsih order')}&body=${encodeURIComponent(body)}`;
  }

  function renderCart() {
    const count = cartCount();

    $$('[data-bind="cartCount"]').forEach((el) => {
      el.textContent = String(count);
    });
    $$('.cart-button').forEach((el) => {
      el.classList.toggle('has-items', count > 0);
      el.setAttribute('aria-label', count === 1 ? 'Cart, 1 item' : `Cart, ${count} items`);
    });
    $$('[data-price]').forEach((el) => {
      const p = CONFIG.products[el.dataset.price];
      if (p) el.textContent = money.format(p.price);
    });

    if (!cartEl) return;
    const ids = Object.keys(cart);
    emptyEl.hidden = ids.length > 0;
    itemsEl.hidden = ids.length === 0;
    footEl.hidden = ids.length === 0;

    itemsEl.replaceChildren(
      ...ids.map((id) => {
        const p = CONFIG.products[id];
        const qty = cart[id];
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
          <div class="cart-item__info">
            <span class="cart-item__name">${p.name}</span>
            <span class="cart-item__each">${money.format(p.price)} each, ${p.unit}</span>
          </div>
          <span class="cart-item__total">${money.format(p.price * qty)}</span>
          <div class="qty" role="group" aria-label="Quantity of ${p.name}">
            <button type="button" data-qty="${id}" data-delta="-1" aria-label="Decrease quantity of ${p.name}">−</button>
            <output aria-label="Quantity">${qty}</output>
            <button type="button" data-qty="${id}" data-delta="1" aria-label="Increase quantity of ${p.name}">+</button>
          </div>
          <button type="button" class="cart-item__remove" data-remove="${id}">Remove<span class="visually-hidden"> ${p.name}</span></button>`;
        return li;
      })
    );

    subtotalEl.textContent = money.format(cartSubtotal());
    orderEl.href = orderMailto();
  }

  /* ------------------------------------------------------------------
     Cart drawer
     ------------------------------------------------------------------ */
  const backdropEl = $('.cart-backdrop');
  const pageEl = $('#page');
  let lastFocus = null;

  function openCart() {
    if (!cartEl || !cartEl.hidden) return;
    lastFocus = document.activeElement;
    cartEl.hidden = false;
    backdropEl.hidden = false;
    cartEl.classList.add('is-opening');
    setTimeout(() => cartEl.classList.remove('is-opening'), 900);
    pageEl.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    // Two frames so the transition runs from the off-screen position.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cartEl.classList.add('is-open');
        backdropEl.classList.add('is-open');
      });
    });
    const close = $('[data-close-cart]', cartEl);
    if (close) close.focus();
  }

  function closeCart() {
    if (!cartEl || cartEl.hidden) return;
    cartEl.classList.remove('is-open');
    backdropEl.classList.remove('is-open');
    pageEl.removeAttribute('inert');
    document.body.style.overflow = '';
    const finish = () => {
      cartEl.hidden = true;
      backdropEl.hidden = true;
    };
    if (reducedMotion()) finish();
    else setTimeout(finish, 360);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  const toastEl = $('[data-toast]');
  let toastTimer = 0;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  }

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const menuButton = $('[data-menu]');
  const navEl = $('#site-nav');

  function setMenu(open) {
    if (!menuButton || !navEl) return;
    navEl.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Close' : 'Menu';
  }
  const closeMenu = () => setMenu(false);
  const isMenuOpen = () => Boolean(navEl && navEl.classList.contains('is-open'));

  window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });

  /* ------------------------------------------------------------------
     Ticker pause control
     ------------------------------------------------------------------ */
  const tickerRow = $('[data-ticker]');
  const tickerToggle = $('[data-ticker-toggle]');

  function toggleTicker() {
    if (!tickerRow || !tickerToggle) return;
    const paused = tickerRow.classList.toggle('is-paused');
    tickerToggle.setAttribute('aria-pressed', String(paused));
    tickerToggle.textContent = paused ? 'Play' : 'Pause';
  }

  /* ------------------------------------------------------------------
     Delegated events
     ------------------------------------------------------------------ */
  document.addEventListener('click', (event) => {
    const el = event.target.closest(
      '[data-add], [data-open-cart], [data-close-cart], [data-qty], [data-remove], [data-menu], [data-ticker-toggle]'
    );

    if (el) {
      if (el.hasAttribute('data-add')) addToCart(el.dataset.add, el);
      else if (el.hasAttribute('data-open-cart')) openCart();
      else if (el.hasAttribute('data-close-cart')) closeCart();
      else if (el.hasAttribute('data-qty')) setQty(el.dataset.qty, (cart[el.dataset.qty] || 0) + Number(el.dataset.delta));
      else if (el.hasAttribute('data-remove')) setQty(el.dataset.remove, 0);
      else if (el.hasAttribute('data-menu')) setMenu(!isMenuOpen());
      else if (el.hasAttribute('data-ticker-toggle')) toggleTicker();
      return;
    }

    // Links inside the drawer (the empty-state "Shop the sticks") close it.
    const link = event.target.closest('a[href^="#"]');
    if (link && cartEl && cartEl.contains(link)) closeCart();

    // Tapping outside the open mobile menu closes it.
    if (isMenuOpen() && !event.target.closest('.site-header')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (cartEl && !cartEl.hidden) closeCart();
    else if (isMenuOpen()) {
      closeMenu();
      if (menuButton) menuButton.focus();
    }
  });

  // Keep tabs in sync: an add in one tab shows up in the others.
  window.addEventListener('storage', (event) => {
    if (event.key === CONFIG.storageKey) {
      cart = loadCart();
      renderCart();
    }
  });

  /* ------------------------------------------------------------------
     Scroll reveals (IntersectionObserver, never a scroll listener)
     ------------------------------------------------------------------ */
  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    if (reducedMotion() || target === 0) {
      el.textContent = String(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      // A frame timestamp can precede the start time captured mid-frame.
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function enter(el) {
    el.classList.add('is-in');
    if (el.classList.contains('reveal-count')) $$('[data-count]', el).forEach(countUp);
  }

  const reveals = $$('.reveal, .reveal-cells, .reveal-draw, .reveal-count');
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    reveals.forEach(enter);
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            enter(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    reveals.forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------------
     Hero stage tilt (pointer devices only; writes are batched per frame)
     ------------------------------------------------------------------ */
  const tiltHost = $('[data-tilt]');
  const stage = tiltHost && $('.hero__stage', tiltHost);
  if (stage && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion()) {
    let rect = null;
    let frame = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      frame = 0;
      stage.style.setProperty('--tx', `${(nx * 7).toFixed(2)}deg`);
      stage.style.setProperty('--ty', `${(-ny * 5).toFixed(2)}deg`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    tiltHost.addEventListener('pointerenter', () => {
      rect = tiltHost.getBoundingClientRect();
    });
    tiltHost.addEventListener('pointermove', (event) => {
      if (!rect) rect = tiltHost.getBoundingClientRect();
      nx = (event.clientX - rect.left) / rect.width - 0.5;
      ny = (event.clientY - rect.top) / rect.height - 0.5;
      schedule();
    });
    tiltHost.addEventListener('pointerleave', () => {
      rect = null;
      nx = 0;
      ny = 0;
      schedule();
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  renderCart();
  route(true);
})();
