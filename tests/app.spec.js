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

// ---------- Google Drive (cartella «RZ Dati») con un Drive finto ----------
// Simula le poche chiamate dell'API Drive v3 usate dall'app: ricerca, cartelle, download, upload multipart / media.
function fakeDrive() {
  const files = { root: { id: 'root', name: 'root', folder: true, parents: [] } };
  let n = 0;
  const add = (name, parent, folder, data, type) => { const id = 'f' + (++n); files[id] = { id, name, parents: [parent], folder: !!folder, data: data || Buffer.alloc(0), type }; return id; };
  const find = (name, parent) => Object.values(files).find(f => f.name === name && f.parents.includes(parent));
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' };
  const handler = async route0 => {
    // come il vero Drive: risponde alle richieste da un altro sito (CORS)
    const route = { request: () => route0.request(), fulfill: o => route0.fulfill({ ...o, headers: { ...CORS, ...(o.headers || {}) } }) };
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, body: '' });
    if (req.headers()['authorization'] !== 'Bearer TOK') return route.fulfill({ status: 401, body: '{}' });
    const json = (o, s) => route.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (m === 'GET' && u.pathname === '/drive/v3/files') {
      const q = u.searchParams.get('q'), nm = /name='((?:[^'\\]|\\.)*)'/.exec(q)[1].replace(/\\(.)/g, '$1'), par = /'([^']+)' in parents/.exec(q)[1];
      const fold = /vnd\.google-apps\.folder/.test(q);
      return json({ files: Object.values(files).filter(f => f.name === nm && f.parents.includes(par) && (!fold || f.folder)).map(f => ({ id: f.id, name: f.name })) });
    }
    if (m === 'POST' && u.pathname === '/drive/v3/files') { const b = JSON.parse(req.postData()); return json({ id: add(b.name, b.parents[0], true) }); }
    let r = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (m === 'GET' && r && u.searchParams.get('alt') === 'media') { const f = files[r[1]]; return route.fulfill({ status: 200, contentType: f.type || 'application/octet-stream', body: f.data }); }
    r = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (m === 'PATCH' && r) { files[r[1]].data = req.postDataBuffer(); files[r[1]].type = req.headers()['content-type']; return json({ id: r[1] }); }
    if (m === 'POST' && u.pathname === '/upload/drive/v3/files') {
      const buf = req.postDataBuffer(), b = /boundary=(\S+)/.exec(req.headers()['content-type'])[1];
      const s = buf.toString('latin1'), p1 = s.indexOf('\r\n\r\n') + 4, e1 = s.indexOf('\r\n--' + b, p1);
      const meta = JSON.parse(Buffer.from(s.slice(p1, e1), 'latin1').toString('utf8'));
      const h2 = s.indexOf('\r\n\r\n', e1) + 4, e2 = s.lastIndexOf('\r\n--' + b + '--');
      const type = /Content-Type: ([^\r]+)/.exec(s.slice(e1, h2))[1];
      return json({ id: add(meta.name, meta.parents[0], false, Buffer.from(s.slice(h2, e2), 'latin1'), type) });
    }
    return route.fulfill({ status: 400, body: 'non gestito: ' + m + ' ' + u.pathname });
  };
  return { files, add, find, handler };
}
// Playwright non intercetta le richieste che passano dal service worker: in queste prove resta spento
// (il service worker dell'app lascia comunque passare senza cache le richieste verso altri siti).
test.describe('Google Drive', () => {
test.use({ serviceWorkers: 'block' });
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

test('Google Drive: unisce i modelli, scarica e carica le immagini, propaga le eliminazioni', async ({ page }, info) => {
  const d = fakeDrive();
  const dir = d.add('RZ Dati', 'root', true), idir = d.add('immagini', dir, true);
  d.add('drv1.jpg', idir, false, JPG, 'image/jpeg');
  const remote = { app: 'rz-dati', schema: 2, models: [
    { id: 'drv1', name: 'Dal Drive', alias: ['DRV ONE'], rtf: 1800, area: 50, lim: 75, t1: .5, t2: 1.5, types: [{ name: 'A', w: 100, n: 2, d: 20 }], cfg: [], wind: [], onlybal: false,
      geo: { w: 600, h: 260, vb: [0, -18, 600, 278], XR: 300, LEY: 90, TEY: 140, TIPX: 560, chord: 200, cdg: 90, livery: false, img: null }, img: 'immagini/drv1.jpg', imgHash: 'x', updatedAt: 5000 },
    { id: 'demo', deleted: true, updatedAt: 9e12 },
  ] };
  d.add('modelli.json', dir, false, Buffer.from(JSON.stringify(remote)), 'application/json');
  await page.route('https://www.googleapis.com/**', d.handler);
  await page.addInitScript(() => { if (!sessionStorage.getItem('gdInit')) { sessionStorage.setItem('gdInit', '1'); localStorage.setItem('rzDrive', JSON.stringify({ tok: 'TOK', exp: Date.now() + 3600e3, on: 1 })); } });
  await openApp(page);
  // un modello locale da eliminare (traccia sul Drive) e uno con immagine da caricare
  await startMenu(page, 'w_arch');
  await page.setInputFiles('#impf', FIXTURE);
  await page.evaluate(() => { const m = DB.models.find(x => x.name === 'Test glider F5J'); m.geo.img = 'data:image/jpeg;base64,/9j/AAAA'; save(); return gdSync(true); });
  const st = await page.evaluate(() => ({ ids: DB.models.map(m => m.id).sort(), img: (DB.models.find(m => m.id === 'drv1') || {}).geo.img || '', alias: (DB.models.find(m => m.id === 'drv1') || {}).alias, txt: document.getElementById('drvst').textContent }));
  expect(st.ids).toContain('drv1');
  expect(st.ids).not.toContain('demo');                       // eliminato su un altro dispositivo
  expect(st.img.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(st.alias).toEqual(['DRV ONE']);
  expect(st.txt).toMatch(/Collegato/);
  const out = JSON.parse(d.find('modelli.json', dir).data.toString('utf8'));
  const byId = Object.fromEntries(out.models.map(m => [m.id, m]));
  expect(out.schema).toBe(2);
  expect(byId.pp2.img).toBe('@pp2');
  expect(byId.demo.deleted).toBe(true);
  expect(byId.drv1.alias).toEqual(['DRV ONE']);
  expect(out.models.every(m => !m.geo || m.geo.img === null)).toBe(true);   // niente immagini dentro modelli.json
  const glider = out.models.find(m => m.name === 'Test glider F5J');
  expect(glider.img).toBe('immagini/' + glider.id + '.jpg');
  expect(d.find(glider.id + '.jpg', idir)).toBeTruthy();       // immagine caricata
  // eliminazione da questo telefono: diventa una traccia sul Drive
  await page.evaluate(id => { DB.models = DB.models.filter(m => m.id !== id); DB.deleted = { ...(DB.deleted || {}), [id]: Date.now() }; save(); return gdSync(true); }, 'drv1');
  const out2 = JSON.parse(d.find('modelli.json', dir).data.toString('utf8'));
  expect(out2.models.find(m => m.id === 'drv1').deleted).toBe(true);
  expect(await csp(page)).toEqual([]);
  expect(info.errors).toEqual([]);
});

test('Google Drive: collegamento scaduto e ritorno da Google con il token', async ({ page }, info) => {
  await page.route('https://accounts.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'google' }));
  await openApp(page);
  await startMenu(page, 'w_arch');
  await expect(page.locator('#drvst')).toHaveText('Non collegato');
  await expect(page.locator('#drvcon')).toBeVisible();
  // il bottone porta a Google con i parametri giusti
  const [req] = await Promise.all([page.waitForRequest(/accounts\.google\.com/), page.click('#drvcon')]);
  const u = new URL(req.url());
  expect(u.searchParams.get('client_id')).toMatch(/apps\.googleusercontent\.com$/);
  expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:8173/RZBallastArchive/');
  expect(u.searchParams.get('response_type')).toBe('token');
  const state = u.searchParams.get('state');
  // ritorno da Google: il token viene tolto dall'indirizzo e salvato
  await page.route('https://www.googleapis.com/**', fakeDrive().handler);
  await page.goto('index.html#access_token=TOK&expires_in=3599&token_type=Bearer&state=' + state);
  await page.waitForFunction(() => !location.hash);
  const gdst = await page.evaluate(() => ({ on: gd.on, tok: gd.tok }));
  expect(gdst).toEqual({ on: 1, tok: 'TOK' });
  await page.waitForFunction(() => gd.last > 0);              // prima sincronizzazione automatica
  expect(info.errors).toEqual([]);
});
});
