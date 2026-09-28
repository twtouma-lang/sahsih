/* The add-to-cart form (snippets/buy-form.liquid).
 *
 * Flavour buttons, option cards and the optional bundle card resolve to a
 * variant; the hidden variant dropdown (name="id") always holds the answer,
 * so the form also works as a plain Shopify form.
 */
import { decodeEntities, formatMoney } from './money.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const BUNDLE = '__bundle';

export function createBuyForm(form, { moneyFormat, strings, flavourById, onFlavour, onAdd }) {
  const json = $('[data-buy-json]', form);
  if (!json) return null;
  let data;
  try {
    data = JSON.parse(json.textContent);
  } catch {
    return null;
  }

  const select = $('[data-variant-select]', form);
  const qtyInput = $('[data-qty]', form);
  const totalEl = $('[data-total]', form);
  const compareEl = $('[data-compare]', form);
  const addBtn = $('[data-add]', form);
  const addLabel = $('[data-add-label]', form);
  const errorEl = $('[data-buy-error]', form);
  const hint = $('[data-mixed-hint]', form);
  const groups = $$('[data-option]', form);
  const flavourGroup = $('[data-flavour-field]', form);
  const optionCount = data.variants.length ? data.variants[0].options.length : 0;
  const remembered = [];

  const qty = () => {
    const n = Math.trunc(Number(qtyInput ? qtyInput.value : 1));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 1;
  };

  function selection() {
    const opts = new Array(optionCount);
    let bundle = false;
    groups.forEach((g) => {
      const pos = Number(g.dataset.option);
      const checked = $('input:checked', g);
      if (!checked) return;
      if (checked.value === BUNDLE) bundle = true;
      else opts[pos - 1] = checked.value;
    });
    // While the bundle is picked, keep pricing the other cards with the
    // last pack the customer chose.
    for (let i = 0; i < optionCount; i++) {
      if (opts[i] === undefined && remembered[i] !== undefined) opts[i] = remembered[i];
      else if (opts[i] !== undefined) remembered[i] = opts[i];
    }
    return { opts, bundle };
  }

  const matches = (variant, opts) => variant.options.every((o, i) => opts[i] === undefined || o === opts[i]);
  const findVariant = (opts) => data.variants.find((v) => matches(v, opts)) || null;

  function currentFlavourId() {
    const checked = flavourGroup && $('input:checked', flavourGroup);
    return checked ? checked.dataset.flavour : null;
  }

  function current() {
    const { opts, bundle } = selection();
    if (bundle && data.bundle) return { bundle: true, item: data.bundle, variant: null, opts };
    const variant = findVariant(opts);
    return { bundle: false, item: variant, variant, opts };
  }

  function update({ fromUser = false } = {}) {
    const { bundle, item, variant, opts } = current();
    const n = qty();

    if (item && select) select.value = String(item.id);

    if (addBtn) addBtn.disabled = !item || !item.available;
    if (addLabel) addLabel.textContent = !item ? strings.unavailable : item.available ? strings.addToCart : strings.soldOut;

    if (totalEl) {
      totalEl.textContent = !item ? strings.unavailable : n === 1 ? decodeEntities(item.priceText) : formatMoney(item.price * n, moneyFormat);
    }
    if (compareEl) {
      const show = item && item.compare && item.compare > item.price;
      compareEl.hidden = !show;
      if (show) compareEl.textContent = n === 1 ? decodeEntities(item.compareText) : formatMoney(item.compare * n, moneyFormat);
    }

    // Prices on the option cards, for the current flavour.
    groups.forEach((g) => {
      const pos = Number(g.dataset.option);
      if (g === flavourGroup) return;
      $$('[data-card]', g).forEach((card) => {
        const input = $('input', card);
        if (!input || input.value === BUNDLE) return;
        const trial = opts.slice();
        trial[pos - 1] = input.value;
        const v = findVariant(trial);
        const price = $('[data-card-price]', card);
        if (price) price.textContent = v ? decodeEntities(v.priceText) : strings.unavailable;
        card.classList.toggle('is-unavailable', !v || !v.available);
      });
    });

    // Box photos follow the flavour.
    const flavour = flavourById(currentFlavourId());
    const box = (flavour && flavour.box) || (variant && variant.image) || null;
    if (box) {
      $$('[data-box]', form).forEach((img) => {
        if (img.getAttribute('src') !== box) img.src = box;
      });
    }

    form.classList.toggle('is-mixed', bundle);
    if (hint) hint.hidden = !bundle;

    if (fromUser && data.updateUrl && variant) {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(variant.id));
      window.history.replaceState(window.history.state, '', url.toString());
    }

    form.dispatchEvent(new CustomEvent('sahsih:variant', { bubbles: true, detail: { variant, bundle } }));
  }

  /* Another control (hero dots, flavour list) picked a flavour. */
  function syncFlavour(id) {
    if (!flavourGroup) return;
    const input = $$('input', flavourGroup).find((el) => el.dataset.flavour === id);
    if (!input || input.checked) return;
    input.checked = true;
    update();
  }

  function label(item, bundle) {
    if (bundle) return data.bundle.title;
    if (!item || item.title === 'Default Title') return data.title;
    return item.title;
  }

  form.addEventListener('change', (event) => {
    const target = event.target;
    if (target === qtyInput) {
      qtyInput.value = String(qty());
      update();
      return;
    }
    if (flavourGroup && flavourGroup.contains(target) && target.dataset.flavour) onFlavour(target.dataset.flavour);
    update({ fromUser: true });
  });

  form.addEventListener('input', (event) => {
    if (event.target === qtyInput) update();
  });

  form.addEventListener('click', (event) => {
    const step = event.target.closest('[data-qty-step]');
    if (!step || !qtyInput) return;
    qtyInput.value = String(Math.min(99, Math.max(1, qty() + Number(step.dataset.qtyStep))));
    update();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { bundle, item } = current();
    if (!item || !item.available || !addBtn || addBtn.disabled) return;
    const quantity = qty();
    if (errorEl) errorEl.hidden = true;
    addBtn.classList.add('is-loading');
    addBtn.setAttribute('aria-disabled', 'true');
    try {
      await onAdd({ id: item.id, quantity, title: label(item, bundle), button: addBtn, form });
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = (err && err.message) || strings.error;
        errorEl.hidden = false;
      }
    } finally {
      addBtn.classList.remove('is-loading');
      addBtn.removeAttribute('aria-disabled');
    }
  });

  update();

  return {
    form,
    syncFlavour,
    flavour: currentFlavourId,
    ownsUrl: !!data.updateUrl,
  };
}
