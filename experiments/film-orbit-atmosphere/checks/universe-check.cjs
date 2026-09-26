const { chromium } = require('C:/Users/shr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/shr/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    const initial = await page.evaluate(() => ({ imagePlane: !!document.querySelector('.universe-image-plane'), particles: !!document.querySelector('.universe-particles'), webgl: !!document.querySelector('.universe-image-plane')?.getContext('webgl'), smiley: document.fonts.check('16px SmileySans'), sections: document.querySelectorAll('.universe-section').length, scene: document.documentElement.dataset.universeScene }));
    await page.mouse.move(1280, 180); await page.waitForTimeout(250);
    const pointer = await page.evaluate(() => ({ x: getComputedStyle(document.documentElement).getPropertyValue('--universe-px').trim(), y: getComputedStyle(document.documentElement).getPropertyValue('--universe-py').trim() }));
    await page.evaluate(() => scrollTo(0, document.querySelector('#themes').offsetTop)); await page.waitForTimeout(500);
    const scrolled = await page.evaluate(() => ({ scene: document.documentElement.dataset.universeScene, visible: document.querySelectorAll('.universe-in-view').length, overflow: document.documentElement.scrollWidth > innerWidth }));
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } }); await mobile.goto('http://127.0.0.1:5190/', { waitUntil: 'networkidle' });
    const mobileOk = await mobile.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, canvas: !!document.querySelector('.universe-image-plane') }));
    if (errors.length || !initial.imagePlane || !initial.particles || !initial.webgl || !initial.smiley || initial.sections < 9 || pointer.x === '0' || !scrolled.scene || scrolled.overflow || mobileOk.overflow || !mobileOk.canvas) throw new Error(JSON.stringify({ errors, initial, pointer, scrolled, mobileOk }));
    console.log(`PASS: WebGL image plane, particle layer, Smiley Sans, pointer depth (${pointer.x}, ${pointer.y}), ${initial.sections} sections, scene scroll, mobile width, no JS errors`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
