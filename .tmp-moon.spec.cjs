const { test } = require('playwright/test');

test('moon page debug', async ({ page }) => {
  page.on('console', msg => console.log(`console:${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`pageerror: ${err.stack || err.message}`));
  page.on('requestfailed', req => console.log(`requestfailed: ${req.url()} ${req.failure()?.errorText || ''}`));

  await page.goto('http://127.0.0.1:4173/ay-evresi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('body:', await page.locator('body').innerText());
});
