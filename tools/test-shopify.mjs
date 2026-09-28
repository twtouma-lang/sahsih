#!/usr/bin/env node
/* End-to-end test of the Shopify theme against the local preview.
 *
 *   node tools/shopify-preview.mjs &     # start the preview first
 *   node tools/test-shopify.mjs [shots-dir]
 *
 * Needs Playwright (npm i -g playwright) and a Chromium build. Checks every
 * page for script errors and walks through buying: flavours, packs, the
 * bundle, sold-out variants, the cart drawer, the cart page, checkout, a
 * phone screen, reduced motion, JavaScript turned off and the theme editor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const { chromium } = playwright;

const BASE = process.env.BASE || 'http://127.0.0.1:9292';
const SHOTS = process.argv[2] || 'dist/theme-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

async function newPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|shopify-assets/.test(m.text())) page.errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon|shopify-assets|\/nope/.test(r.url())) page.errors.push(`http ${r.status()} ${r.url()}`);
  });
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
// The accent the script set (the computed value animates for 0.6 s).
const accent = (page) => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent').trim().toLowerCase());
const text = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await fetch(`${BASE}/__reset`);

/* 1. Home, desktop */
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('has-3d'), null, { timeout: 30000 }).catch(() => {});
  check('home: 3D stage mounted', await page.evaluate(() => document.documentElement.classList.contains('has-3d')));
  await wait(2500);
  await shot(page, '01-home-hero');
  check('home: default accent is Berry', (await accent(page)) === '#ff4de0', await accent(page));

  await page.click('.swatch[data-flavour="mango"]');
  await wait(700);
  check('home: swatch sets accent', (await accent(page)) === '#ff9a2e', await accent(page));
  check('home: logo tinted for Mango', await page.evaluate(() => document.documentElement.classList.contains('is-tinted')));
  check('home: shop form follows flavour', await page.locator('[data-flavour-field] input[data-flavour="mango"]').isChecked());
  check('home: box photos follow flavour', (await page.locator('[data-box]').first().getAttribute('src')).includes('box-mango'));
  await shot(page, '02-home-mango');

  await page.click('.bar__cta');
  await wait(2200);
  await shot(page, '03-home-shop');
  await page.locator('.pack', { hasText: '3 boxes' }).click();
  await wait(200);
  check('shop: pack changes total', (await text(page, '[data-total]')) === '$72.00', await text(page, '[data-total]'));
  await page.click('[data-qty-step="1"]');
  check('shop: quantity doubles total', (await text(page, '[data-total]')) === '$144.00', await text(page, '[data-total]'));
  check('shop: hidden variant select tracks choice', (await page.locator('[data-variant-select]').first().evaluate((s) => s.options[s.selectedIndex].text)).includes('Mango / 3 boxes'));

  await page.click('[data-add]');
  await page.waitForSelector('#cart.is-open', { timeout: 5000 }).catch(() => {});
  check('cart: drawer opens after add', await page.locator('#cart.is-open').isVisible());
  check('cart: drawer shows the line', (await text(page, '#cart .cart-item__variant')).includes('Mango / 3 boxes'));
  check('cart: header count updated', (await text(page, '[data-cart-count]')) === '2', await text(page, '[data-cart-count]'));
  await wait(500);
  await shot(page, '04-cart-drawer');
  await page.click('#cart [data-cart-qty][aria-label^="Increase"]');
  await page.waitForFunction(() => document.querySelector('#cart output')?.textContent.trim() === '3', null, { timeout: 5000 }).catch(() => {});
  check('cart: + in drawer', (await text(page, '#cart output')) === '3');
  check('cart: subtotal re-rendered by server', (await text(page, '.cart__subtotal')).includes('$216.00'), await text(page, '.cart__subtotal'));
  await page.click('#cart .cart-item__remove');
  await page.waitForSelector('#cart .cart__empty', { timeout: 5000 }).catch(() => {});
  check('cart: remove empties drawer', await page.locator('#cart .cart__empty').isVisible());
  check('cart: count back to 0', (await text(page, '[data-cart-count]')) === '0');
  await page.keyboard.press('Escape');
  await wait(600);
  check('cart: Escape closes drawer', await page.locator('#cart').isHidden());

  // Sold out combination
  await page.locator('[data-flavour-field] .chip', { hasText: 'Citrus' }).click();
  await page.locator('.pack', { hasText: '3 boxes' }).click();
  await wait(150);
  check('shop: sold-out variant disables button', await page.locator('[data-add]').isDisabled());
  check('shop: sold-out label', (await text(page, '[data-add-label]')) === 'Sold out');
  check('shop: accent follows chip', (await accent(page)) === '#8fe23f', await accent(page));

  // Bundle (quantity back to 1 first)
  await page.click('[data-qty-step="-1"]');
  await page.locator('.pack--set').click();
  await wait(150);
  check('shop: bundle price', (await text(page, '[data-total]')) === '$105.00', await text(page, '[data-total]'));
  check('shop: bundle compare-at shown', (await page.locator('[data-compare]').isVisible()) && (await text(page, '[data-compare]')) === '$120.00');
  check('shop: bundle dims flavours', await page.locator('[data-buy-form]').evaluate((f) => f.classList.contains('is-mixed')));
  await page.click('[data-add]');
  await page.waitForSelector('#cart.is-open', { timeout: 5000 }).catch(() => {});
  check('cart: bundle added', (await text(page, '#cart .cart-item__name')).includes('The Full Set'));
  await page.click('#cart [data-close-cart].icon-btn');
  await wait(600);

  // Scroll the whole film
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const stops = [0.18, 0.3, 0.42, 0.55, 0.7, 0.85, 1];
  for (const [i, f] of stops.entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(height * f));
    await wait(1400);
    await shot(page, `05-scroll-${i}`);
  }
  check('home: no script errors', page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  await context.close();
}

/* 2. Product page */
{
  await fetch(`${BASE}/__reset`);
  const { context, page } = await newPage();
  await page.goto(`${BASE}/products/sahsih-hangover-jelly-stick`, { waitUntil: 'load' });
  await wait(2500);
  await shot(page, '10-product');
  check('product: 3D is the first gallery item', (await page.locator('[data-gallery-thumb="3d"]').getAttribute('aria-pressed')) === 'true');
  const thumb = page.locator('[data-gallery-thumb]').nth(2);
  await thumb.click();
  check('product: thumbnail shows photo', (await thumb.getAttribute('aria-pressed')) === 'true');
  await page.locator('[data-flavour-field] .chip', { hasText: 'Pineapple' }).click();
  await wait(300);
  check('product: URL tracks variant', page.url().includes('variant='), page.url());
  const activeImg = await page.locator('[data-gallery-item].is-active img').first().getAttribute('src');
  check('product: gallery jumps to flavour photo', activeImg.includes('box-pineapple'), activeImg);
  check('product: accent Pineapple', (await accent(page)) === '#ffd52e');
  await page.click('[data-add]');
  await page.waitForSelector('#cart.is-open', { timeout: 5000 }).catch(() => {});
  check('product: add opens drawer', await page.locator('#cart.is-open').isVisible());
  check('product: no script errors', page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  const variantUrl = page.url();
  await context.close();

  const second = await newPage();
  await second.page.goto(variantUrl, { waitUntil: 'load' });
  await wait(800);
  check('product: deep link keeps flavour', (await accent(second.page)) === '#ffd52e', await accent(second.page));
  check('product: deep link keeps chip', await second.page.locator('[data-flavour-field] input[data-flavour="pineapple"]').isChecked());
  await second.context.close();
}

/* 3. Single-variant and bundle products */
for (const handle of ['sahsih-full-set', 'sahsih-tote']) {
  const { context, page } = await newPage();
  await page.goto(`${BASE}/products/${handle}`, { waitUntil: 'load' });
  await wait(1200);
  await shot(page, `11-product-${handle}`);
  check(`${handle}: add button enabled`, await page.locator('[data-add]').isEnabled());
  check(`${handle}: no script errors`, page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  await context.close();
}

/* 4. Cart page and checkout */
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/cart`, { waitUntil: 'load' });
  await wait(600);
  await shot(page, '20-cart-page');
  const before = await text(page, '.cart__subtotal');
  await page.click('[data-cart-page] [data-cart-qty][aria-label^="Increase"]');
  await page
    .waitForFunction((b) => (document.querySelector('.cart__subtotal')?.textContent || '').replace(/\s+/g, ' ').trim() !== b, before, { timeout: 5000 })
    .catch(() => {});
  check('cart page: + updates subtotal', (await text(page, '.cart__subtotal')) !== before, `${before} -> ${await text(page, '.cart__subtotal')}`);
  await page.click('button[name="checkout"]');
  await page.waitForSelector('#checkout', { timeout: 5000 }).catch(() => {});
  check('cart page: checkout posts to /cart', await page.locator('#checkout').isVisible());
  check('cart page: no script errors', page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  await context.close();
}

/* 5. Other pages */
for (const [name, url] of [
  ['collection', '/collections/all'],
  ['collections', '/collections'],
  ['search', '/search?q=stick'],
  ['contact', '/pages/contact'],
  ['page', '/pages/about'],
  ['blog', '/blogs/news'],
  ['article', '/blogs/news/how-the-stick-came-to-be'],
  ['404', '/nope'],
  ['password', '/password'],
  ['gift-card', '/gift_cards/test'],
]) {
  const { context, page } = await newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: 'load' });
  await wait(1200);
  await shot(page, `30-${name}`);
  check(`${name}: no script errors`, page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${name}: no sideways scroll`, overflow <= 0, `${overflow}px`);
  await context.close();
}

/* 6. Phone */
{
  await fetch(`${BASE}/__reset`);
  const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await wait(3000);
  await shot(page, '40-phone-hero');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone: no sideways scroll', overflow <= 0, `${overflow}px`);
  await page.click('[data-menu]');
  check('phone: menu opens', await page.locator('[data-nav].is-open').isVisible());
  await shot(page, '41-phone-menu');
  await page.locator('[data-nav] a', { hasText: 'Shop' }).click();
  await wait(1800);
  check('phone: menu closes on link', !(await page.locator('[data-nav].is-open').count()));
  await shot(page, '42-phone-shop');
  await page.locator('[data-add]').scrollIntoViewIfNeeded();
  await page.click('[data-add]');
  await page.waitForSelector('#cart.is-open', { timeout: 5000 }).catch(() => {});
  await wait(600);
  await shot(page, '43-phone-drawer');
  check('phone: drawer opens', await page.locator('#cart.is-open').isVisible());
  const width = await page.locator('#cart').evaluate((el) => el.getBoundingClientRect().width);
  check('phone: drawer fits screen', width <= 390, `${width}px`);
  for (const f of [0.25, 0.5, 0.75, 1]) {
    await page.keyboard.press('Escape');
    await page.evaluate((y) => window.scrollTo(0, y * document.documentElement.scrollHeight), f);
    await wait(900);
    await shot(page, `44-phone-${f}`);
  }
  check('phone: no script errors', page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  await context.close();
}

/* 7. Reduced motion */
{
  const { context, page } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await wait(2000);
  check('reduced: no smooth scrolling', !(await page.evaluate(() => document.documentElement.classList.contains('lenis'))));
  check('reduced: no pinned scenes', (await page.locator('.pin-spacer').count()) === 0);
  check('reduced: counters show final values', (await text(page, '.hud__value')) === '15');
  await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-section="science"]').offsetTop));
  await wait(800);
  await shot(page, '50-reduced-science');
  check('reduced: no script errors', page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  await context.close();
}

/* 8. JavaScript off: the form still sells */
{
  await fetch(`${BASE}/__reset`);
  const { context, page } = await newPage({ javaScriptEnabled: false });
  await page.goto(`${BASE}/products/sahsih-hangover-jelly-stick`, { waitUntil: 'load' });
  await shot(page, '60-nojs-product');
  const select = page.locator('select[name="id"]');
  check('no-JS: variant dropdown visible', await select.isVisible());
  const value = await select.evaluate((s) => [...s.options].find((o) => o.text.includes('Watermelon / 3 boxes')).value);
  await select.selectOption(value);
  await page.fill('input[name="quantity"]', '2');
  await Promise.all([page.waitForURL('**/cart'), page.click('[data-add]')]);
  check('no-JS: add lands on cart page', (await page.locator('.cart-item__variant').first().innerText()).includes('Watermelon / 3 boxes'));
  await shot(page, '61-nojs-cart');
  await context.close();
}

/* 9. Theme editor */
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/?design_mode=1`, { waitUntil: 'load' });
  await wait(2500);
  check('editor: smooth scroll off', !(await page.evaluate(() => document.documentElement.classList.contains('lenis'))));
  const html = await (await fetch(`${BASE}/?design_mode=1`)).text();
  const reloaded = await page.evaluate(async (fresh) => {
    const id = 'shopify-section-template--1__shop';
    const old = document.getElementById(id);
    old.dispatchEvent(new CustomEvent('shopify:section:unload', { bubbles: true }));
    const doc = new DOMParser().parseFromString(fresh, 'text/html');
    const next = document.importNode(doc.getElementById(id), true);
    old.replaceWith(next);
    next.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    return {
      ready: next.querySelector('[data-buy-form]').dataset.ready === 'true',
      total: next.querySelector('[data-total]').textContent,
    };
  }, html);
  check('editor: reloaded section re-initialises', reloaded.ready, JSON.stringify(reloaded));
  await page.locator('#shopify-section-template--1__shop').scrollIntoViewIfNeeded();
  await wait(800);
  await page.locator('.pack', { hasText: '3 boxes' }).click();
  check('editor: reloaded form works', (await text(page, '[data-total]')) === '$72.00');
  const removed = await page.evaluate(async () => {
    const el = document.getElementById('shopify-section-template--1__science');
    el.dispatchEvent(new CustomEvent('shopify:section:unload', { bubbles: true }));
    el.remove();
    await new Promise((r) => setTimeout(r, 400));
    return document.querySelectorAll('[data-slot]').length;
  });
  check('editor: removing a section keeps the page alive', removed > 0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(1200);
  await shot(page, '70-editor-after-remove');
  check('editor: no script errors', page.errors.length === 0, page.errors.slice(0, 5).join(' | '));
  await context.close();
}

/* 10. The page opens straight into 3D: no flat photo while it loads */
{
  const { context, page } = await newPage();
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await wait(300);
  const early = await page.evaluate(() => {
    const img = document.querySelector('.slot--hero .slot__poster');
    return { opacity: img ? getComputedStyle(img).opacity : null, cls: document.documentElement.className };
  });
  check('3D first: photo hidden while 3D loads', early.opacity === '0', JSON.stringify(early));
  await page.waitForFunction(() => document.documentElement.classList.contains('has-3d'), null, { timeout: 30000 }).catch(() => {});
  check('3D first: stick appears', await page.evaluate(() => document.documentElement.classList.contains('has-3d')), `${Date.now() - t0} ms in software rendering`);
  check('3D first: photos stay hidden after', (await page.locator('.slot--hero .slot__poster').evaluate((i) => getComputedStyle(i).opacity)) === '0');
  await context.close();
}

/* 11. No WebGL: the photos show at once */
{
  const noGl = await chromium.launch({ executablePath, args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const context = await noGl.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await wait(1500);
  const state = await page.evaluate(() => ({
    no3d: document.documentElement.classList.contains('no-3d'),
    opacity: getComputedStyle(document.querySelector('.slot--hero .slot__poster')).opacity,
  }));
  check('no WebGL: photos shown straight away', state.no3d && Number(state.opacity) > 0.5, JSON.stringify(state));
  await wait(700);
  await page.screenshot({ path: path.join(SHOTS, '80-no-webgl.png') });
  check('no WebGL: no script errors', errors.length === 0, errors.join(' | '));
  await noGl.close();
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
