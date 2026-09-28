/* The Shopify cart: Ajax add and change, the drawer, the cart page, the
 * order note and the header count.
 *
 * Every change asks Shopify to re-render the drawer (and the cart page, when
 * on it) in the same request (Section Rendering API), so prices, discounts
 * and currencies are always formatted by Shopify itself.
 */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function createCart({ routes, strings, lockScroll = () => {}, unlockScroll = () => {}, onCount = () => {} }) {
  const drawer = $('[data-cart-drawer]');
  const backdrop = $('.cart-backdrop');
  const page = $('#page');
  const drawerError = drawer ? $('[data-cart-error]', drawer) : null;

  /* What to re-render with each change. */
  function sectionIds() {
    const ids = [];
    if (drawer) ids.push('cart-drawer');
    const cartPage = $('[data-cart-page]');
    if (cartPage && cartPage.dataset.sectionId) ids.push(cartPage.dataset.sectionId);
    return ids;
  }

  function withSections(body) {
    const ids = sectionIds();
    if (!ids.length) return body;
    return { ...body, sections: ids.join(','), sections_url: window.location.pathname };
  }

  async function post(url, body) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(strings.error);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || (data && typeof data.status === 'number' && data.status >= 400)) {
      const msg = data && (typeof data.description === 'string' ? data.description : data.message);
      throw new Error(msg || strings.error);
    }
    return data || {};
  }

  function setCount(n) {
    if (!Number.isFinite(n)) return;
    $$('[data-cart-count]').forEach((el) => (el.textContent = String(n)));
    $$('.cart-btn').forEach((el) => el.classList.toggle('has-items', n > 0));
    onCount(n);
  }

  /* Swap in fresh HTML from a Section Rendering response. */
  function applySections(sections) {
    if (!sections) return false;
    let applied = false;
    const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
    if (drawer && sections['cart-drawer']) {
      const fresh = parse(sections['cart-drawer']).querySelector('[data-cart-inner]');
      const current = $('[data-cart-inner]', drawer);
      if (fresh && current) {
        current.replaceWith(fresh);
        setCount(Number(fresh.dataset.count));
        applied = true;
      }
    }
    const cartPage = $('[data-cart-page]');
    if (cartPage && sections[cartPage.dataset.sectionId]) {
      const fresh = parse(sections[cartPage.dataset.sectionId]).querySelector('[data-cart-page]');
      if (fresh) {
        cartPage.replaceWith(fresh);
        applied = true;
      }
    }
    return applied;
  }

  async function refresh() {
    try {
      const ids = sectionIds();
      if (ids.length) {
        const url = `${routes.root.replace(/\/$/, '')}/?sections=${encodeURIComponent(ids.join(','))}`;
        const sections = await fetch(url, { credentials: 'same-origin' }).then((r) => r.json());
        applySections(sections);
      }
      const cart = await fetch(`${routes.cart}.js`, { credentials: 'same-origin' }).then((r) => r.json());
      setCount(cart.item_count);
    } catch {
      // Offline or blocked: the server-rendered cart stays as it is.
    }
  }

  function showError(message) {
    const el = drawer && !drawer.hidden ? drawerError : $('[data-cart-page] [data-cart-error]');
    if (!el) return;
    el.textContent = message || strings.error;
    el.hidden = !message;
  }

  function busy(on) {
    if (drawer) drawer.setAttribute('aria-busy', String(on));
    const cartPage = $('[data-cart-page]');
    if (cartPage) cartPage.setAttribute('aria-busy', String(on));
  }

  async function add(items) {
    const data = await post(`${routes.cartAdd}.js`, withSections({ items }));
    if (!applySections(data.sections)) await refresh();
    showError('');
    return data;
  }

  let changing = Promise.resolve();
  function change(key, quantity) {
    // Queue changes so rapid clicks apply in order.
    changing = changing.then(async () => {
      busy(true);
      try {
        const data = await post(`${routes.cartChange}.js`, withSections({ id: key, quantity: Math.max(0, quantity) }));
        if (!applySections(data.sections)) {
          setCount(data.item_count);
          if ($('[data-cart-page]')) window.location.reload();
        }
        showError('');
      } catch (err) {
        showError(err.message);
        await refresh();
      } finally {
        busy(false);
      }
    });
    return changing;
  }

  let noteTimer = 0;
  function saveNote(note) {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      post(`${routes.cartUpdate}.js`, { note }).catch(() => {});
    }, 400);
  }

  /* Drawer */
  let lastFocus = null;
  const isOpen = () => !!drawer && !drawer.hidden;

  function open() {
    if (!drawer || isOpen()) return false;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    if (backdrop) backdrop.hidden = false;
    if (page) page.setAttribute('inert', '');
    lockScroll();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        if (backdrop) backdrop.classList.add('is-open');
      })
    );
    const close = $('[data-close-cart]', drawer);
    if (close) close.focus({ preventScroll: true });
    return true;
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    drawer.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
    if (page) page.removeAttribute('inert');
    unlockScroll();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      if (drawer.classList.contains('is-open')) return;
      drawer.hidden = true;
      if (backdrop) backdrop.hidden = true;
    };
    if (reduce) finish();
    else setTimeout(finish, 460);
    if (restoreFocus && lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  /* Events, delegated so re-rendered HTML needs no re-binding. */
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-cart]');
    if (opener) {
      if (drawer && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        open();
      }
      return;
    }
    if (event.target.closest('[data-close-cart]')) {
      close();
      return;
    }
    const qty = event.target.closest('[data-cart-qty]');
    if (qty && qty.dataset.key) {
      event.preventDefault();
      change(qty.dataset.key, Number(qty.dataset.cartQty));
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-cart-input]');
    if (input && input.dataset.key) {
      const value = Math.max(0, Math.trunc(Number(input.value)));
      if (Number.isFinite(value)) change(input.dataset.key, value);
    }
  });

  document.addEventListener('input', (event) => {
    const note = event.target.closest('[data-cart-note]');
    if (note) saveNote(note.value);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) close();
    // Keep keyboard focus inside the open drawer.
    if (event.key === 'Tab' && isOpen()) {
      const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])', drawer).filter(
        (el) => el.offsetParent !== null
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Coming back with the browser's back button can show a stale page.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) refresh();
  });

  return { add, change, open, close, isOpen, refresh, hasDrawer: () => !!drawer };
}
