// Browser smoke test: node tests/smoke.js [screenshotDir]
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert/strict');
const shots = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: shots ? 2 : 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'cta-drafter.html'));
  const D = await page.evaluate(() => CTACore.EXAMPLES.find((e) => e.id === 'D'));

  await page.fill('#current', D.current);
  await page.fill('#prior', D.prior);
  await page.fill('#study', 'CTA 08/16/2024');
  const outText = await page.$$eval('#out .ln .t', (els) => els.map((e) => e.textContent).join('\n'));
  assert.ok(outText.includes('Sinus of Valsalva (mechanical): 27 x 27 x 27 (28 x 28 x 28)'));
  assert.ok(outText.includes('(prior values from CTA 08/16/2024 in parentheses)'));
  assert.equal(await page.locator('#out .ln.red').count(), 1);
  assert.match(await page.textContent('#status'), /1 line needs review/);

  await page.click('#copyBtn');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.startsWith('The cross-sectional diameters'));
  assert.ok(clip.includes('Infrarenal aorta: 18'));
  if (shots) await page.screenshot({ path: shots + '/light.png', fullPage: true });

  // Numbers-only in a new tab
  await page.click('.addtab');
  assert.equal(await page.locator('.tab:not(.addtab)').count(), 2);
  await page.fill('#prior', D.prior);
  await page.fill('#numbers', '27x27x27 28 29 33 27 26 22 20');
  await page.press('#numbers', 'Enter');
  assert.ok((await page.inputValue('#current')).includes('Sinotubular junction (graft): 28'));

  // Persistence across reload
  await page.reload();
  assert.equal(await page.locator('.tab:not(.addtab)').count(), 2);
  assert.ok((await page.inputValue('#current')).includes('Sinotubular junction (graft): 28'));

  // Reset clears active tab only
  await page.click('#resetBtn');
  assert.equal(await page.inputValue('#current'), '');
  await page.click('.tab:not(.addtab) >> nth=0');
  assert.ok((await page.inputValue('#current')).length > 0);

  // Dark mode
  await page.click('[data-theme-set="dark"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  if (shots) await page.screenshot({ path: shots + '/dark.png', fullPage: true });
  await page.click('[data-theme-set="light"]');

  // Admin: wrong PIN, then right PIN
  await page.click('#adminBtn');
  await page.fill('#pinInput', '1111');
  await page.press('#pinInput', 'Enter');
  assert.equal(await page.isVisible('#admin'), false);
  await page.fill('#pinInput', '147258');
  await page.press('#pinInput', 'Enter');
  assert.equal(await page.isVisible('#admin'), true);
  const n = await page.evaluate(() => CTACore.EXAMPLES.length);
  assert.match(await page.textContent('#adminSummary'), new RegExp(n + ' of ' + n + ' examples pass'));
  if (shots) await page.screenshot({ path: shots + '/admin.png', fullPage: false });

  // Help page
  await page.click('#backBtn');
  await page.click('#helpBtn');
  assert.equal(await page.isVisible('#help'), true);
  const demo = await page.textContent('#helpDemo');
  assert.ok(demo.includes('Sinotubular junction (graft): 28 (27)'));
  assert.ok(demo.includes('Not used from prior: Sinus of Valsalva (mechanical)'));
  assert.ok((await page.textContent('#helpNums')).includes('Sinus of Valsalva (mechanical): 27 x 27 x 27'));
  if (shots) await page.screenshot({ path: shots + '/help.png', fullPage: true });
  await page.click('#helpTry');
  assert.equal(await page.isVisible('#workspace'), true);
  assert.ok((await page.inputValue('#prior')).includes('28 x 28 x 28(29 x 25)'));

  assert.deepEqual(errors, []);
  console.log('smoke OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
