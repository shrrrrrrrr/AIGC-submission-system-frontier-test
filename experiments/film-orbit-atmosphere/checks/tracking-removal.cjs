const { chromium } = require('C:/Users/shr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/shr/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => ({ tracking: document.querySelectorAll('#tracking').length, previous: document.querySelectorAll('#previous').length, next: document.querySelectorAll('#next').length }));
    if (errors.length || result.tracking !== 0 || result.previous !== 1 || result.next !== 1) throw new Error(JSON.stringify({ errors, result }));
    console.log('PASS: tracking toggle removed at runtime; previous/next controls remain; no JS errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
