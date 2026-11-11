// Test end-to-end di RZ Ballast Archive (Playwright). Avvio: npm test
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'backup-netlify-v21.json');

// Raccoglie le violazioni CSP e gli errori JavaScript di ogni pagina.
test.beforeEach(async ({ page }, info) => {
  info.csp = []; info.errors = [];
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + e.blockedURI));
  });
  page.on('pageerror', e => info.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') info.errors.push(m.text()); });
});

async function openApp(page) {
  await page.goto('index.html');
  await expect(page.locator('#w_go')).toBeVisible();
}
async function startMenu(page, item) {
  await page.click('#w_go');
  await page.locator('#wmenu.on').waitFor();
  await page.click('#' + item);
  await expect(page.locator('#splash')).toHaveClass(/hide/);
}
const csp = page => page.evaluate(() => window.__csp);

// ---------- CSP ----------
test('tools/csp.py --check: hash degli script inline aggiornati', () => {
  execFileSync('python3', [path.join(__dirname, '..', 'tools', 'csp.py'), '--check'], { stdio: 'pipe' });
});

test('la CSP è presente e non permette script inline arbitrari né eval', async ({ page }) => {
  await openApp(page);
  const policy = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  const scriptSrc = policy.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'));
  expect(scriptSrc).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).not.toContain("'unsafe-eval'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'none'");
});

test('nessuna violazione CSP né errore usando tutte le pagine', async ({ page }, info) => {
  await openApp(page);
  await startMenu(page, 'w_last');
  await page.click('#wp'); await page.click('#wp');
  await page.click('#godet');
  await page.click('#fsopen'); await page.click('#fsclose');
  await page.click('#back');
  await page.click('#mpick'); await page.click('#cf_btn button:last-child');
  await page.click('#homebtn');
  await startMenu(page, 'w_setup');
  await page.click('[data-acc="#f08a00"]'); await page.click('[data-bg="dark"]');
  await page.click('#homebtn');
  await startMenu(page, 'w_arch');
  await page.click('[data-a=edit][data-id=pp2]');
  await page.click('.q[data-h=f_td]'); await page.click('#hc');
  await page.click('#homebtn');
  await page.click('#w_go'); await page.click('#w_guide');
  expect(await csp(page)).toEqual([]);
  expect(info.errors).toEqual([]);
});

test('la CSP blocca codice iniettato nella pagina', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<img src="data:," onerror="window.__pwn=1">';
    document.body.append(d);
    const s = document.createElement('script'); s.textContent = 'window.__pwn2=1'; document.body.append(s);
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [window.__pwn, window.__pwn2])).toEqual([undefined, undefined]);
  expect((await csp(page)).length).toBeGreaterThan(0);
});

// ---------- innerHTML: i nomi scritti dall'utente non diventano HTML ----------
test('nomi con HTML/script nei modelli importati restano testo', async ({ page }, info) => {
  const evil = '<img src=x onerror="window.__pwn=1">';
  const file = info.outputPath('evil.json');
  const base = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const m = JSON.parse(JSON.stringify(base.models[1]));
  m.id = 'evil1'; m.name = 'Evil ' + evil; m.types[0].name = evil; m.updatedAt = Date.now();
  fs.writeFileSync(file, JSON.stringify({ app: 'rz-ballast-archive', schema: 1, models: [m] }));
  await openApp(page);
  await startMenu(page, 'w_arch');
  await page.setInputFiles('#impf', file);
  await expect(page.locator('#datamsg')).toContainText('1');
  await page.click('.nm[data-sel=evil1]');                  // pagina del vento
  await page.click('#mpick'); await page.click('#cf_btn button:last-child');
  await page.click('#godet'); await page.click('#back');
  await page.click('#homebtn'); await startMenu(page, 'w_setup');   // tabella configurazioni
  await page.click('#homebtn'); await startMenu(page, 'w_arch');
  await page.click('[data-a=edit][data-id=evil1]');          // scheda modello
  await expect(page.locator('#mlist')).toContainText('<img src=x');
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  expect(info.errors).toEqual([]);
});

// ---------- backup ----------
test('un backup della versione Netlify si importa nella nuova app', async ({ page }) => {
  await openApp(page);
  await startMenu(page, 'w_arch');
  await page.setInputFiles('#impf', FIXTURE);
  await expect(page.locator('#datamsg')).toContainText(/2 .*· 1 /);   // 2 nuovi, 1 aggiornato
  const models = await page.evaluate(() => DB.models.map(m => [m.id, m.name, m.rtf]));
  expect(models).toEqual(expect.arrayContaining([
    ['pp2', 'Pike Precision 2 F3G', 2010],
    [expect.any(String), 'Test glider F5J', 1450],
    ['demo', 'DEMO · Modello esempio', 1500],
  ]));
});

test('esporta e reimporta il backup (andata e ritorno)', async ({ page }, info) => {
  await openApp(page);
  await startMenu(page, 'w_arch');
  await page.setInputFiles('#impf', FIXTURE);
  const before = await page.evaluate(() => JSON.stringify(DB.models.map(m => [m.id, m.name, m.rtf, m.cfg])));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expbtn')]);
  const file = info.outputPath('backup.json'); await dl.saveAs(file);
  await page.evaluate(() => resetAll());
  expect(await page.evaluate(() => DB.models.length)).toBe(1);
  await page.setInputFiles('#impf', file);
  const after = await page.evaluate(() => JSON.stringify(DB.models.map(m => [m.id, m.name, m.rtf, m.cfg])));
  expect(after).toBe(before);
});

test('tabelle Excel: esporta un .xlsx valido e lo reimporta', async ({ page }, info) => {
  await openApp(page);
  await startMenu(page, 'w_setup');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xlsbtn')]);
  const file = info.outputPath('t.xlsx'); await dl.saveAs(file);
  expect(fs.readFileSync(file).subarray(0, 2).toString()).toBe('PK');
  await page.setInputFiles('#xlsf', file);
  await expect(page.locator('#xmsg')).toContainText('1');   // «1 già presenti»
});

// ---------- funzioni principali ----------
test('vento → configurazione: il ΔCdG è la prima informazione', async ({ page }) => {
  await openApp(page);
  await startMenu(page, 'w_last');
  await expect(page.locator('#mbig')).toHaveText('Pike Precision 2 F3G');
  for (let i = 0; i < 6; i++) await page.click('#wp');
  await expect(page.locator('#wv')).toHaveText('3');
  await expect(page.locator('#cg')).toHaveText(/[+-]?\d+\.\d\d mm/);
  const order = await page.evaluate(() => {
    const r = document.querySelector('#p1 .card:nth-of-type(3)');
    return [...r.querySelectorAll('#cg, #wt, #bt')].map(e => e.id);
  });
  expect(order[0]).toBe('cg');
});

// ---------- GitHub Pages (sottocartella), installazione e offline ----------
test('manifest e service worker funzionano in una sottocartella e offline', async ({ page, context }) => {
  await openApp(page);
  const man = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    const j = await (await fetch(href)).json();
    return { href, start: new URL(j.start_url, href).href, scope: new URL(j.scope, href).href, icons: j.icons.map(i => new URL(i.src, href).href) };
  });
  expect(man.start).toMatch(/\/RZBallastArchive\/index\.html$/);
  expect(man.scope).toMatch(/\/RZBallastArchive\/$/);
  for (const u of man.icons) expect((await page.request.get(u)).ok()).toBeTruthy();
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/RZBallastArchive\/$/);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#w_go')).toBeVisible();
  await startMenu(page, 'w_last');
  await expect(page.locator('#mbig')).toHaveText('Pike Precision 2 F3G');
  await context.setOffline(false);
});
