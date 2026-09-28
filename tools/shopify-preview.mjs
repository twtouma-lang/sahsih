#!/usr/bin/env node
/* Local preview of the Shopify theme, for testing without a store.
 *
 *   node tools/shopify-preview.mjs            # http://127.0.0.1:9292
 *
 * Renders the real theme files (layout, JSON templates, sections, snippets,
 * locales) with liquidjs plus mock versions of Shopify's tags, filters and
 * objects, and a mock Ajax Cart API (/cart.js, /cart/add.js,
 * /cart/change.js, /cart/update.js, ?sections=) backed by an in-memory
 * cart. Unknown filters are errors, so a typo cannot slip through.
 *
 * It is a test double, not Shopify: it checks that the theme's Liquid runs,
 * its HTML is sound and its JavaScript works against the documented APIs.
 * Add ?design_mode=1 to any URL to render as the theme editor would.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid, Tag, Value } from 'liquidjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME = path.join(ROOT, 'shopify');
const PORT = Number(process.env.PORT || 9292);

const read = (rel) => fs.readFileSync(path.join(THEME, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel).replace(/^\s*\/\*[\s\S]*?\*\//, ''));
const LOCALE = readJson('locales/en.default.json');

/* ------------------------------------------------------------------
   Settings: schema defaults, then settings_data.json
   ------------------------------------------------------------------ */
function defaultsOf(settings = []) {
  const out = {};
  for (const s of settings) if (s.id && 'default' in s) out[s.id] = s.default;
  return out;
}
function themeSettings(overrides = {}) {
  const schema = readJson('config/settings_schema.json');
  let out = {};
  for (const g of schema.slice(1)) out = { ...out, ...defaultsOf(g.settings) };
  const data = readJson('config/settings_data.json');
  const current = typeof data.current === 'string' ? data.presets[data.current] : data.current;
  return { ...out, ...current, ...overrides };
}

/* ------------------------------------------------------------------
   Mock store
   ------------------------------------------------------------------ */
let nextId = 5000;
const image = (file, w, h, alt = '') => ({ src: `/assets/${file}`, width: w, height: h, alt, aspect_ratio: w / h, id: ++nextId });
const mediaOf = (img) => ({ id: img.id, media_type: 'image', alt: img.alt, preview_image: img, src: img.src, width: img.width, height: img.height, aspect_ratio: img.aspect_ratio });

const FLAVOURS = ['Berry', 'Mango', 'Pineapple', 'Watermelon', 'Citrus'];
const PACKS = [
  ['1 box', 2400],
  ['3 boxes', 7200],
];
const SOLD_OUT = new Set(['Citrus / 3 boxes']);

function buildProducts() {
  const boxes = Object.fromEntries(FLAVOURS.map((f) => [f, image(`box-${f.toLowerCase()}.webp`, 300, 457, `${f} box`)]));
  const sticks = FLAVOURS.map((f) => image(`stick-${f.toLowerCase()}.webp`, 240, 408, `${f} stick`));
  const main = {
    id: 101,
    handle: 'sahsih-hangover-jelly-stick',
    title: 'Sahsih Hangover Jelly Stick',
    type: 'Dietary supplement',
    vendor: 'Sahsih',
    description: '<p>A 15 g jelly stick with milk thistle, electrolytes and B vitamins. Ten sticks per box.</p>',
    options: ['Flavour', 'Pack'],
    media: [...Object.values(boxes), ...sticks].map(mediaOf),
    variants: [],
  };
  for (const f of FLAVOURS) {
    for (const [pack, price] of PACKS) {
      const title = `${f} / ${pack}`;
      main.variants.push({
        id: ++nextId,
        title,
        options: [f, pack],
        option1: f,
        option2: pack,
        price,
        compare_at_price: null,
        available: !SOLD_OUT.has(title),
        featured_image: boxes[f],
        featured_media: mediaOf(boxes[f]),
        sku: `SAH-${f.slice(0, 3).toUpperCase()}-${pack.startsWith('3') ? 3 : 1}`,
      });
    }
  }
  const allBoxes = image('all-boxes.webp', 900, 290, 'All five boxes');
  const set = {
    id: 102,
    handle: 'sahsih-full-set',
    title: 'The Full Set',
    type: 'Dietary supplement',
    vendor: 'Sahsih',
    description: '<p>One box of every flavour. 50 sticks.</p>',
    options: ['Title'],
    media: [mediaOf(allBoxes)],
    variants: [{ id: ++nextId, title: 'Default Title', options: ['Default Title'], option1: 'Default Title', price: 10500, compare_at_price: 12000, available: true, featured_image: null, featured_media: null }],
  };
  const tote = {
    id: 103,
    handle: 'sahsih-tote',
    title: 'Sahsih Tote',
    type: 'Merch',
    vendor: 'Sahsih',
    description: '<p>A bag for the bag.</p>',
    options: ['Title'],
    media: [],
    variants: [{ id: ++nextId, title: 'Default Title', options: ['Default Title'], option1: 'Default Title', price: 1800, compare_at_price: null, available: true, featured_image: null, featured_media: null }],
  };
  return [main, set, tote];
}
const PRODUCTS = buildProducts();
const VARIANTS = new Map();
for (const p of PRODUCTS) for (const v of p.variants) VARIANTS.set(v.id, { product: p, variant: v });

/* A product as Liquid sees it, with a selected variant. */
function productDrop(p, variantId) {
  const selected = p.variants.find((v) => v.id === Number(variantId)) || p.variants.find((v) => v.available) || p.variants[0];
  const prices = p.variants.map((v) => v.price);
  const media = p.media;
  const drop = {
    ...p,
    url: `/products/${p.handle}`,
    price: Math.min(...prices),
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    price_varies: new Set(prices).size > 1,
    compare_at_price: selected.compare_at_price,
    available: p.variants.some((v) => v.available),
    has_only_default_variant: p.variants.length === 1 && p.variants[0].title === 'Default Title',
    featured_image: media[0] ? media[0].preview_image : null,
    featured_media: media[0] || null,
    images: media.map((m) => m.preview_image),
    selected_variant: variantId ? selected : null,
    selected_or_first_available_variant: selected,
    first_available_variant: p.variants.find((v) => v.available) || null,
    options_with_values: p.options.map((name, i) => ({
      name,
      position: i + 1,
      values: [...new Set(p.variants.map((v) => v.options[i]))],
      selected_value: selected.options[i],
    })),
  };
  drop.variants = p.variants.map((v) => ({ ...v, product: undefined }));
  return drop;
}

const productsByHandle = () => Object.fromEntries(PRODUCTS.map((p) => [p.handle, productDrop(p)]));

/* ------------------------------------------------------------------
   Cart
   ------------------------------------------------------------------ */
let cart = { lines: [], note: '' };

function cartDrop() {
  const items = cart.lines.map((line) => {
    const { product, variant } = VARIANTS.get(line.variant_id);
    const p = productDrop(product, variant.id);
    const img = variant.featured_image || p.featured_image;
    return {
      id: variant.id,
      key: line.key,
      quantity: line.quantity,
      variant_id: variant.id,
      product_id: product.id,
      title: p.has_only_default_variant ? product.title : `${product.title} - ${variant.title}`,
      product: p,
      variant,
      url: `/products/${product.handle}?variant=${variant.id}`,
      url_to_remove: `/cart/change?line=${cart.lines.indexOf(line) + 1}&quantity=0`,
      image: img,
      options_with_values: p.has_only_default_variant ? [] : product.options.map((name, i) => ({ name, value: variant.options[i] })),
      properties: {},
      selling_plan_allocation: null,
      line_level_discount_allocations: [],
      original_price: variant.price,
      final_price: variant.price,
      price: variant.price,
      original_line_price: variant.price * line.quantity,
      final_line_price: variant.price * line.quantity,
      line_price: variant.price * line.quantity,
      sku: variant.sku || '',
    };
  });
  const total = items.reduce((s, i) => s + i.final_line_price, 0);
  return {
    token: 'mock-cart',
    note: cart.note,
    attributes: {},
    items,
    item_count: items.reduce((s, i) => s + i.quantity, 0),
    total_price: total,
    original_total_price: total,
    items_subtotal_price: total,
    total_discount: 0,
    requires_shipping: true,
    currency: { iso_code: 'USD' },
    taxes_included: false,
    cart_level_discount_applications: [],
  };
}

function cartJson() {
  const c = cartDrop();
  return {
    ...c,
    items: c.items.map((i) => ({
      id: i.id,
      key: i.key,
      quantity: i.quantity,
      variant_id: i.variant_id,
      product_id: i.product_id,
      title: i.title,
      price: i.price,
      line_price: i.line_price,
      final_line_price: i.final_line_price,
      url: i.url,
      image: i.image ? i.image.src : null,
      handle: i.product.handle,
      product_title: i.product.title,
      variant_title: i.variant.title === 'Default Title' ? null : i.variant.title,
    })),
  };
}

function addToCart(id, quantity) {
  const found = VARIANTS.get(Number(id));
  if (!found) return { status: 404, message: 'Cart Error', description: 'Cannot find variant' };
  if (!found.variant.available) {
    return { status: 422, message: 'Cart Error', description: `${found.product.title} - ${found.variant.title} is already sold out.` };
  }
  const q = Math.max(1, Math.trunc(Number(quantity) || 1));
  let line = cart.lines.find((l) => l.variant_id === found.variant.id);
  if (line) line.quantity += q;
  else {
    line = { variant_id: found.variant.id, quantity: q, key: `${found.variant.id}:${Math.random().toString(16).slice(2, 10)}` };
    cart.lines.push(line);
  }
  if (line.quantity > 20) {
    line.quantity = 20;
    return { status: 422, message: 'Cart Error', description: `You can only add 20 ${found.variant.title} to the cart.` };
  }
  return { ok: true, line };
}

function changeCart({ id, line, quantity }) {
  let target = null;
  if (typeof id === 'string' && id.includes(':')) target = cart.lines.find((l) => l.key === id);
  else if (id) target = cart.lines.find((l) => l.variant_id === Number(id));
  else if (line) target = cart.lines[Number(line) - 1];
  if (!target) return { status: 400, message: 'Cart Error', description: 'No valid id or line parameter.' };
  const q = Math.max(0, Math.trunc(Number(quantity)));
  if (q === 0) cart.lines = cart.lines.filter((l) => l !== target);
  else target.quantity = Math.min(q, 20);
  return { ok: true };
}

/* ------------------------------------------------------------------
   Liquid engine with Shopify's tags and filters
   ------------------------------------------------------------------ */
const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  extname: '.liquid',
  strictFilters: true,
  ownPropertyOnly: false,
  cache: false,
});

const money = (cents, fmt = '${{amount}}') => {
  const v = (Number(cents) || 0) / 100;
  const amount = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fmt.replace(/\{\{\s*amount\s*\}\}/, amount);
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const handleize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9À-ɏ]+/g, '-')
    .replace(/^-+|-+$/g, '');
const named = (args) => {
  const out = {};
  const positional = [];
  for (const a of args) {
    if (Array.isArray(a)) out[a[0]] = a[1];
    else positional.push(a);
  }
  return { out, positional };
};
const srcOf = (img) => (img && typeof img === 'object' ? img.src || (img.preview_image && img.preview_image.src) : img);

function translate(key, args) {
  const { out } = named(args);
  let node = key.split('.').reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), LOCALE);
  if (node === undefined) throw new Error(`Missing translation: ${key}`);
  if (typeof node === 'object') {
    if (!('count' in out)) throw new Error(`Plural translation ${key} used without count`);
    node = Number(out.count) === 1 ? node.one : node.other;
  }
  const html = key.endsWith('_html');
  return String(node).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => {
    if (!(name in out)) throw new Error(`Translation ${key} needs ${name}`);
    return html ? String(out[name]) : esc(out[name]);
  });
}

const hexToRgb = (hex) => {
  const h = String(hex).replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const filters = {
  t: (key, ...args) => translate(key, args),
  asset_url: (name) => {
    if (!fs.existsSync(path.join(THEME, 'assets', name))) throw new Error(`Missing asset ${name}`);
    return `/assets/${name}?v=1`;
  },
  shopify_asset_url: (name) => `/shopify-assets/${name}`,
  image_url: (img, ...args) => {
    const src = srcOf(img);
    if (!src) throw new Error('image_url on an empty image');
    const { out } = named(args);
    return `${src}${src.includes('?') ? '&' : '?'}width=${out.width || ''}`;
  },
  image_tag: (url, ...args) => {
    const { out } = named(args);
    const attrs = Object.entries({ width: 300, height: 300, ...out })
      .filter(([k]) => !['widths', 'preload'].includes(k))
      .map(([k, v]) => `${k}="${esc(v)}"`)
      .join(' ');
    return `<img src="${esc(url)}" ${attrs}>`;
  },
  stylesheet_tag: (url) => `<link href="${esc(url)}" rel="stylesheet" type="text/css" media="all" />`,
  preload_tag: (url, ...args) => {
    const { out } = named(args);
    return `<link href="${esc(url)}" rel="preload" as="${esc(out.as)}"${out.type ? ` type="${esc(out.type)}"` : ''}${out.crossorigin ? ' crossorigin="anonymous"' : ''}>`;
  },
  placeholder_svg_tag: (name, cls) => `<svg class="${esc(cls || '')}" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg"><rect width="525" height="525"/></svg>`,
  link_to: (text, url) => `<a href="${esc(url)}">${text}</a>`,
  time_tag: (d, ...args) => {
    const date = d instanceof Date ? d : new Date(d);
    return `<time datetime="${date.toISOString()}">${date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</time>`;
  },
  money: (c) => money(c),
  money_with_currency: (c) => `${money(c)} USD`,
  money_without_currency: (c) => money(c, '{{amount}}'),
  handleize,
  handle: handleize,
  color_to_hex: (c) => {
    if (!c || !/^#[0-9a-f]{3,6}$/i.test(String(c))) throw new Error(`color_to_hex on ${c}`);
    return String(c).toLowerCase();
  },
  color_modify: (c, prop, value) => {
    if (prop !== 'alpha') throw new Error(`color_modify ${prop} not mocked`);
    const [r, g, b] = hexToRgb(c);
    return `rgba(${r}, ${g}, ${b}, ${value})`;
  },
  color_lighten: (c, amount) => {
    const [r, g, b] = hexToRgb(c).map((v) => Math.min(255, v + (255 * Number(amount)) / 100));
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  },
  default_errors: (errors) => `<ul><li>${esc(errors && errors.messages ? Object.values(errors.messages).join(' ') : 'Error')}</li></ul>`,
  payment_button: (form) => {
    if (!form || form.type !== 'product') throw new Error('payment_button outside a product form');
    return '<div class="shopify-payment-button"><button type="button" class="shopify-payment-button__button shopify-payment-button__button--unbranded">Buy it now</button></div>';
  },
  payment_type_svg_tag: (type) => `<svg class="payment-icon" aria-label="${esc(type)}"></svg>`,
  structured_data: (obj) => JSON.stringify({ '@context': 'http://schema.org/', '@type': obj && obj.variants ? 'Product' : 'Article', name: obj && obj.title }),
  format_code: (code) => String(code).replace(/(.{4})/g, '$1 ').trim(),
  video_tag: () => '<video controls></video>',
  external_video_tag: () => '<iframe title="video"></iframe>',
  date: (d, ...args) => {
    const date = d === 'now' ? new Date() : new Date(d);
    const { out, positional } = named(args);
    if (positional[0] === '%Y') return String(date.getFullYear());
    if (out.format || positional[0] === undefined) return date.toDateString();
    return date.toISOString();
  },
};
for (const [name, fn] of Object.entries(filters)) engine.registerFilter(name, fn);

/* Splits "a, b: 'x, y', c" at top-level commas. */
function splitArgs(s) {
  const out = [];
  let cur = '';
  let q = null;
  let depth = 0;
  for (const ch of s) {
    if (q) {
      if (ch === q) q = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
    } else if (ch === '(' || ch === '[') {
      depth++;
      cur += ch;
    } else if (ch === ')' || ch === ']') {
      depth--;
      cur += ch;
    } else if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function blockTag(name, onRender) {
  return class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.args = token.args;
      this.tpls = [];
      const stream = liquid.parser
        .parseStream(remainTokens)
        .on(`tag:end${name}`, () => stream.stop())
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => {
          throw new Error(`tag ${name} not closed`);
        });
      stream.start();
      this.setup && this.setup(liquid);
    }
    *render(ctx, emitter) {
      yield* onRender.call(this, ctx, emitter);
    }
  };
}

engine.registerTag(
  'schema',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      while (remainTokens.length) {
        const t = remainTokens.shift();
        if (t.name === 'endschema') return;
      }
      throw new Error('schema not closed');
    }
    *render() {}
  }
);

engine.registerTag(
  'layout',
  class extends Tag {
    *render() {}
  }
);

engine.registerTag(
  'style',
  blockTag('style', function* (ctx, emitter) {
    emitter.write('<style data-shopify>');
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    emitter.write('</style>');
  })
);

const FORM_ACTIONS = {
  product: '/cart/add',
  customer: '/contact#contact_form',
  contact: '/contact#contact_form',
  localization: '/localization',
  storefront_password: '/password',
  new_comment: '/blogs/news/comments',
};

const FormTag = blockTag('form', function* (ctx, emitter) {
  const parts = splitArgs(this.args);
  const type = parts[0].replace(/^['"]|['"]$/g, '');
  if (!(type in FORM_ACTIONS)) throw new Error(`Unknown form type ${type}`);
  const attrs = {};
  let object = null;
  for (const part of parts.slice(1)) {
    const m = part.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.+)$/s);
    if (m) attrs[m[1]] = yield new Value(m[2], this.liquid).value(ctx, false);
    else object = yield new Value(part, this.liquid).value(ctx, false);
  }
  if (type === 'product' && !(object && object.variants)) throw new Error('form product without a product');
  const attrText = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
  emitter.write(`<form method="post" action="${FORM_ACTIONS[type]}" accept-charset="UTF-8"${type === 'product' ? ' enctype="multipart/form-data"' : ''} ${attrText}>`);
  emitter.write(`<input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`);
  ctx.push({ form: { type, errors: null, 'posted_successfully?': false, email: '', name: '', body: '', phone: '', author: '' } });
  yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
  ctx.pop();
  emitter.write('</form>');
});
engine.registerTag('form', FormTag);

engine.registerTag(
  'paginate',
  blockTag('paginate', function* (ctx, emitter) {
    const m = this.args.match(/^(.+?)\s+by\s+(.+)$/);
    if (!m) throw new Error(`bad paginate: ${this.args}`);
    const list = yield new Value(m[1], this.liquid).value(ctx, false);
    const size = yield new Value(m[2], this.liquid).value(ctx, false);
    if (!Number(size)) throw new Error('paginate size is not a number');
    const items = Array.isArray(list) ? list.length : 0;
    ctx.push({ paginate: { current_page: 1, current_offset: 0, items, page_size: Number(size), pages: Math.max(1, Math.ceil(items / size)), parts: [], previous: null, next: null } });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop();
  })
);

engine.registerTag(
  'sections',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.group = token.args.trim().replace(/^['"]|['"]$/g, '');
    }
    *render(ctx, emitter) {
      const globals = ctx.globals;
      const html = yield renderGroup(this.group, globals);
      emitter.write(html);
    }
  }
);

/* ------------------------------------------------------------------
   Sections and templates
   ------------------------------------------------------------------ */
function schemaOf(type) {
  const src = read(`sections/${type}.liquid`);
  const m = src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return { src, schema: m ? JSON.parse(m[1]) : null };
}

function resolveSetting(def, value, globals) {
  if (value === undefined || value === '') {
    if (['product', 'collection', 'page', 'blog', 'link_list', 'image_picker', 'url', 'video'].includes(def.type)) return null;
    return value === undefined ? null : value;
  }
  if (def.type === 'product') return globals.all_products[value] || null;
  if (def.type === 'link_list') return globals.linklists[value] || null;
  return value;
}

async function renderSection(type, id, data, globals, groupClass = '') {
  const { src, schema } = schemaOf(type);
  const defs = schema ? schema.settings || [] : [];
  const settings = {};
  for (const def of defs) {
    if (!def.id) continue;
    const raw = data.settings && def.id in data.settings ? data.settings[def.id] : def.default;
    settings[def.id] = resolveSetting(def, raw, globals);
  }
  const blocks = (data.block_order || []).map((bid) => {
    const b = data.blocks[bid];
    const bdef = (schema.blocks || []).find((x) => x.type === b.type) || { settings: [] };
    const bs = {};
    for (const def of bdef.settings || []) {
      if (!def.id) continue;
      const raw = b.settings && def.id in b.settings ? b.settings[def.id] : def.default;
      bs[def.id] = resolveSetting(def, raw, globals);
    }
    return {
      id: bid,
      type: b.type,
      settings: bs,
      shopify_attributes: globals.request.design_mode ? `data-shopify-editor-block="${esc(JSON.stringify({ id: bid, type: b.type }))}"` : '',
    };
  });
  const section = { id, settings, blocks };
  const html = await engine.parseAndRender(src, { section }, { globals });
  const tag = (schema && schema.tag) || 'div';
  const cls = ['shopify-section', groupClass, schema && schema.class].filter(Boolean).join(' ');
  return `<${tag} id="shopify-section-${id}" class="${cls}">${html}</${tag}>`;
}

async function renderGroup(group, globals) {
  const data = readJson(`sections/${group}.json`);
  const parts = [];
  for (const key of data.order) {
    parts.push(await renderSection(data.sections[key].type, `sections--1__${key}`, data.sections[key], globals, `shopify-section-group-${group}`));
  }
  return parts.join('');
}

async function renderTemplate(name, globals) {
  if (name === 'gift_card') {
    return engine.parseAndRender(read('templates/gift_card.liquid'), {}, { globals });
  }
  const tpl = readJson(`templates/${name}.json`);
  const layout = tpl.layout === undefined ? 'theme' : tpl.layout;
  const parts = [];
  for (const key of tpl.order) parts.push(await renderSection(tpl.sections[key].type, `template--1__${key}`, tpl.sections[key], globals));
  const content = parts.join('');
  if (!layout) return content;
  return engine.parseAndRender(read(`layout/${layout}.liquid`), {}, { globals: { ...globals, content_for_layout: content } });
}

/* ------------------------------------------------------------------
   Globals per request
   ------------------------------------------------------------------ */
function baseGlobals(url, pageType, extra = {}) {
  const designMode = url.searchParams.get('design_mode') === '1';
  const overrides = {};
  for (const [k, v] of url.searchParams) {
    if (k.startsWith('setting.')) overrides[k.slice(8)] = v === 'true' ? true : v === 'false' ? false : v;
  }
  const all_products = productsByHandle();
  const collectionAll = {
    id: 1,
    handle: 'all',
    title: 'All products',
    url: '/collections/all',
    description: '<p>Everything we make.</p>',
    products: Object.values(all_products),
    products_count: PRODUCTS.length,
    all_products_count: PRODUCTS.length,
    featured_image: null,
    sort_by: url.searchParams.get('sort_by') || null,
    default_sort_by: 'manual',
    sort_options: [
      { value: 'manual', name: 'Featured' },
      { value: 'price-ascending', name: 'Price, low to high' },
      { value: 'price-descending', name: 'Price, high to low' },
    ],
    filters: [],
  };
  return {
    settings: themeSettings(overrides),
    shop: {
      name: 'Sahsih',
      email: 'hello@sahsih.com',
      description: 'Hangover jelly sticks.',
      url: `http://127.0.0.1:${PORT}`,
      money_format: '${{amount}}',
      currency: 'USD',
      policies: [
        { title: 'Refund policy', url: '/policies/refund-policy' },
        { title: 'Privacy policy', url: '/policies/privacy-policy' },
      ],
      enabled_payment_types: ['visa', 'master'],
      taxes_included: false,
      shipping_policy: null,
      customer_accounts_enabled: true,
      password_message: 'Launching soon.',
    },
    routes: {
      root_url: '/',
      cart_url: '/cart',
      cart_add_url: '/cart/add',
      cart_change_url: '/cart/change',
      cart_update_url: '/cart/update',
      search_url: '/search',
      all_products_collection_url: '/collections/all',
      collections_url: '/collections',
      account_url: '/account',
      account_login_url: '/account/login',
    },
    request: { locale: { iso_code: 'en' }, page_type: pageType, design_mode: designMode, origin: `http://127.0.0.1:${PORT}`, path: url.pathname },
    localization: {
      available_countries: [{ iso_code: 'US', name: 'United States', currency: { iso_code: 'USD', symbol: '$' } }],
      available_languages: [{ iso_code: 'en', endonym_name: 'English' }],
      country: { iso_code: 'US' },
      language: { iso_code: 'en' },
    },
    cart: cartDrop(),
    all_products,
    collections: [collectionAll],
    collection: null,
    linklists: {},
    customer: null,
    page_title: 'Sahsih',
    page_description: 'Hangover jelly sticks.',
    page_image: null,
    canonical_url: `http://127.0.0.1:${PORT}${url.pathname}`,
    current_tags: null,
    current_page: 1,
    additional_checkout_buttons: true,
    content_for_additional_checkout_buttons: '<div class="dynamic-checkout-mock"></div>',
    content_for_header: designMode ? '<script>window.Shopify = { designMode: true };</script>' : '',
    ...extra,
    _collectionAll: collectionAll,
  };
}

async function page(url) {
  const p = url.pathname.replace(/\/$/, '') || '/';
  if (p === '/') return renderTemplate('index', baseGlobals(url, 'index'));
  let m = p.match(/^\/products\/([\w-]+)$/);
  if (m) {
    const raw = PRODUCTS.find((x) => x.handle === m[1]);
    if (!raw) return null;
    const product = productDrop(raw, url.searchParams.get('variant'));
    return renderTemplate('product', baseGlobals(url, 'product', { product, page_title: product.title, page_image: product.featured_image }));
  }
  if (p === '/collections/all') {
    const g = baseGlobals(url, 'collection');
    g.collection = g._collectionAll;
    return renderTemplate('collection', g);
  }
  if (p === '/collections') return renderTemplate('list-collections', baseGlobals(url, 'list-collections'));
  if (p === '/cart') return renderTemplate('cart', baseGlobals(url, 'cart'));
  if (p === '/search') {
    const q = url.searchParams.get('q');
    const results = q ? Object.values(productsByHandle()).filter((x) => x.title.toLowerCase().includes(q.toLowerCase())).map((x) => ({ ...x, object_type: 'product' })) : [];
    return renderTemplate('search', baseGlobals(url, 'search', { search: { performed: !!q, terms: q || '', results, results_count: results.length } }));
  }
  if (p === '/pages/contact') {
    return renderTemplate('page.contact', baseGlobals(url, 'page', { page: { title: 'Contact', content: '<p>Questions, wholesale, press.</p>', handle: 'contact' } }));
  }
  if (p === '/pages/about') {
    return renderTemplate('page', baseGlobals(url, 'page', { page: { title: 'About', content: '<h2>Why</h2><p>Because mornings.</p><ul><li>One</li><li>Two</li></ul>', handle: 'about' } }));
  }
  const article = {
    title: 'How the stick came to be',
    handle: 'how-the-stick-came-to-be',
    url: '/blogs/news/how-the-stick-came-to-be',
    published_at: '2026-09-01T10:00:00Z',
    author: 'Sahsih',
    excerpt: '',
    content: '<p>It started with a bad Sunday.</p><p>Then a better Monday.</p>',
    image: image('all-boxes.webp', 900, 290, 'Boxes'),
    tags: ['launch', 'story'],
    comments_count: 0,
    comments: [],
  };
  const blog = { title: 'Journal', url: '/blogs/news', handle: 'news', articles: [article, { ...article, title: 'Five flavours', image: null }], 'comments_enabled?': true, 'moderated?': true };
  if (p === '/blogs/news') return renderTemplate('blog', baseGlobals(url, 'blog', { blog }));
  if (p === '/blogs/news/how-the-stick-came-to-be') return renderTemplate('article', baseGlobals(url, 'article', { blog, article }));
  if (p === '/password') return renderTemplate('password', baseGlobals(url, 'password'));
  if (p === '/gift_cards/test') {
    return renderTemplate('gift_card', baseGlobals(url, 'gift_card', { gift_card: { balance: 5000, initial_value: 5000, enabled: true, expired: false, expires_on: null, code: 'ABCD1234EFGH5678', qr_identifier: 'x', pass_url: null } }));
  }
  if (p === '/404' || true) return renderTemplate('404', baseGlobals(url, '404'));
}

async function sectionsJson(ids, pathname) {
  const url = new URL(`http://x${pathname || '/'}`);
  const pageType = pathname && pathname.startsWith('/cart') ? 'cart' : 'index';
  const globals = baseGlobals(url, pageType);
  const out = {};
  for (const id of ids) {
    if (!id) continue;
    if (id === 'cart-drawer') out[id] = await renderSection('cart-drawer', 'cart-drawer', {}, globals);
    else if (id.endsWith('__main') && pageType === 'cart') out[id] = await renderSection('main-cart', id, readJson('templates/cart.json').sections.main, globals);
    else out[id] = null;
  }
  return out;
}

/* ------------------------------------------------------------------
   HTTP
   ------------------------------------------------------------------ */
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const type = req.headers['content-type'] || '';
      if (type.includes('application/json')) {
        try {
          return resolve(JSON.parse(data || '{}'));
        } catch {
          return resolve({});
        }
      }
      if (type.includes('multipart/form-data')) {
        const out = {};
        for (const m of data.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)) out[m[1]] = m[2];
        return resolve(out);
      }
      resolve(Object.fromEntries(new URLSearchParams(data)));
    });
  });
}

const log = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (status, type, text) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(text);
  };
  const json = (status, obj) => send(status, 'application/json', JSON.stringify(obj));
  try {
    if (url.pathname.startsWith('/assets/')) {
      const file = path.join(THEME, 'assets', path.basename(url.pathname));
      if (!fs.existsSync(file)) return send(404, 'text/plain', 'missing asset');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
      return fs.createReadStream(file).pipe(res);
    }
    if (url.pathname.startsWith('/shopify-assets/')) {
      // Files Shopify hosts itself (the gift card QR script, wallet badge).
      return send(200, url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript', url.pathname.endsWith('.svg') ? '<svg xmlns="http://www.w3.org/2000/svg"/>' : '');
    }
    if (url.pathname === '/__log') return json(200, log);
    if (url.pathname === '/__reset') {
      cart = { lines: [], note: '' };
      return json(200, { ok: true });
    }
    if (url.pathname === '/cart.js') return json(200, cartJson());
    if (req.method === 'POST') {
      const b = await body(req);
      log.push({ path: url.pathname, body: b });
      const sectionIds = (Array.isArray(b.sections) ? b.sections : String(b.sections || '').split(',')).map((s) => s.trim()).filter(Boolean);
      if (url.pathname === '/cart/add.js') {
        const items = b.items || [{ id: b.id, quantity: b.quantity }];
        const added = [];
        for (const it of items) {
          const r = addToCart(it.id, it.quantity);
          if (!r.ok) return json(r.status, r);
          added.push(it);
        }
        const sections = sectionIds.length ? await sectionsJson(sectionIds, b.sections_url) : undefined;
        return json(200, { items: added, sections });
      }
      if (url.pathname === '/cart/change.js') {
        const r = changeCart(b);
        if (!r.ok) return json(r.status, r);
        const sections = sectionIds.length ? await sectionsJson(sectionIds, b.sections_url) : undefined;
        return json(200, { ...cartJson(), sections });
      }
      if (url.pathname === '/cart/update.js') {
        if ('note' in b) cart.note = String(b.note);
        return json(200, cartJson());
      }
      if (url.pathname === '/cart/add') {
        const r = addToCart(b.id, b.quantity || 1);
        if (!r.ok) return send(r.status, 'text/plain', r.description);
        res.writeHead(302, { Location: '/cart' });
        return res.end();
      }
      if (url.pathname === '/cart') {
        if ('checkout' in b) return send(200, 'text/html', '<!doctype html><title>Checkout</title><h1 id="checkout">Checkout reached</h1>');
        for (const [k, v] of Object.entries(b)) {
          if (k === 'updates[]') {
            // single-line mock: apply to the first line
            if (cart.lines[0]) changeCart({ line: 1, quantity: v });
          }
          if (k === 'note') cart.note = v;
        }
        res.writeHead(302, { Location: '/cart' });
        return res.end();
      }
      res.writeHead(302, { Location: url.pathname });
      return res.end();
    }
    if (url.pathname === '/cart/change') {
      changeCart({ line: url.searchParams.get('line'), quantity: url.searchParams.get('quantity') });
      res.writeHead(302, { Location: '/cart' });
      return res.end();
    }
    if (url.searchParams.has('sections')) {
      return json(200, await sectionsJson(url.searchParams.get('sections').split(','), url.pathname));
    }
    const html = await page(url);
    if (html === null) return send(404, 'text/html', await renderTemplate('404', baseGlobals(url, '404')));
    return send(200, 'text/html; charset=utf-8', html);
  } catch (err) {
    console.error(`${req.method} ${req.url}\n${err.stack || err}`);
    send(500, 'text/plain', `Render error: ${err.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Sahsih theme preview on http://127.0.0.1:${PORT}`));
