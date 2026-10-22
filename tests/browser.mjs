import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { fixture, OWNER } from './fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const mime = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, 'dist', relative);
    if (!file.startsWith(path.join(root, 'dist') + path.sep)) throw Error('invalid path');
    let text = await readFile(file);
    if (/\/assets\/main-[\w-]+\.js$/.test(file)) text = Buffer.concat([text, Buffer.from('\n;globalThis.__finanzasTest={month:Df,projection:Of,commitments:iu,cash:Ak,overdue:Af};')]);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); response.end(text);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS', name); }
async function session(owner = OWNER) {
  const data = fixture(owner), errors = [], writes = [];
  let failNextSave = false;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', timezoneId: 'America/Argentina/Buenos_Aires' });
  await context.route('https://lcrbhzfijumbvhmtunqv.supabase.co/**', async route => {
    const request = route.request(), parsed = new URL(request.url());
    if (parsed.pathname === '/auth/v1/user') return route.fulfill({ json: { id: owner, email: 'pruebas@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {} } });
    if (parsed.pathname === '/rest/v1/rpc/fp_patch_settings') {
      const patch = request.postDataJSON()?.p_patch;
      if (failNextSave) { failNextSave = false; return route.fulfill({ status: 500, json: { message: 'Error de guardado simulado' } }); }
      assert.equal(patch.__expected_owner_id, owner);
      const { __expected_owner_id, ...values } = patch;
      writes.push(structuredClone(values));
      const settings = data.app_settings[0].settings;
      data.app_settings[0].settings = { ...settings, ...values,
        ...(values.preferences ? { preferences: { ...settings.preferences, ...values.preferences } } : {}) };
      return route.fulfill({ json: data.app_settings[0].settings });
    }
    const table = parsed.pathname.split('/').at(-1);
    if (request.method() !== 'GET') throw Error('Escritura inesperada: ' + request.method() + ' ' + table);
    let rows = structuredClone(data[table] || []);
    for (const [key, value] of parsed.searchParams) if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
    return route.fulfill({ json: request.headers().accept?.includes('application/vnd.pgrst.object') ? rows[0] || null : rows });
  });
  await context.addInitScript(({ owner }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(new Date('2026-10-23T19:32:00Z').getTime() / 1000);
    const access_token = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: owner, aud: 'authenticated', role: 'authenticated', exp }) + '.test-signature';
    localStorage.setItem('sb-lcrbhzfijumbvhmtunqv-auth-token', JSON.stringify({ access_token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: owner, email: 'pruebas@example.invalid', user_metadata: {} } }));
  }, { owner });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-22T19:32:00Z') });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url + '/#/configuracion');
  await page.getByRole('heading', { name: 'Funciones y proyección', exact: true }).waitFor();
  return { context, page, data, errors, writes, failSave: () => { failNextSave = true; } };
}
try {
  const s = await session(), { page } = s;
  await check('la proyección mensual excluye al familiar y conserva servicios, impuestos y tarjeta', async () => {
    const result = await page.evaluate(data => {
      const month = __finanzasTest.month(data, '2026-11');
      return { outgoing: month.outgoing, incoming: month.incoming, rows: month.rows.map(row => row.label) };
    }, s.data);
    assert.equal(result.outgoing, 475); assert.equal(result.incoming, 30);
    assert(!result.rows.includes('Familiar')); assert(result.rows.includes('Electricidad')); assert(result.rows.includes('Compra con tarjeta'));
  });
  await check('los pagos reales permanecen en caja y en la proyección acumulada', async () => {
    const result = await page.evaluate(data => ({ cash: __finanzasTest.cash(data), projected: __finanzasTest.projection(data, '2026-11').projected }), s.data);
    assert.equal(result.cash, 950); assert.equal(result.projected, 505);
  });
  await check('una deuda excluida sin fecha no deja la proyección incompleta', async () => {
    const data = structuredClone(s.data); data.debts.find(debt => debt.id === 'family').due_on = null;
    const result = await page.evaluate(data => ({ incomplete: __finanzasTest.projection(data, '2026-11').incomplete, undated: __finanzasTest.overdue(data).undated.length }), data);
    assert.equal(result.incomplete, false); assert.equal(result.undated, 0);
  });
  await check('el modo básico se aplica al guardar y oculta módulos y paneles', async () => {
    await page.getByRole('button', { name: 'Usar modo básico', exact: true }).click();
    assert.equal(await page.locator('.sidebar').getByRole('link', { name: 'Presupuestos', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Guardar funciones y proyección', exact: true }).click();
    await page.getByText('Funciones y proyección guardadas para tu cuenta.', { exact: true }).waitFor();
    assert.equal(await page.locator('.sidebar').getByRole('link', { name: 'Presupuestos', exact: true }).count(), 0);
    assert.equal(s.data.app_settings[0].settings.initialized_months[0], '2026-10');
    assert.deepEqual(s.data.app_settings[0].settings.income_sources, []);
    await page.goto(url + '/#/'); await page.getByRole('heading', { name: 'Tu mes, de un vistazo.', exact: true }).waitFor();
    assert.equal(await page.locator('.dashboard-budgets').count(), 0); assert.equal(await page.locator('.year-trend').count(), 0);
    assert.equal(await page.locator('.sidebar').getByRole('link', { name: 'Configuración', exact: true }).count(), 1);
  });
  await check('un enlace directo a una función oculta ofrece volver a activarla', async () => {
    await page.goto(url + '/#/presupuestos'); await page.getByRole('heading', { name: 'Esta función está desactivada', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Configurar funciones', exact: true }).count(), 1);
  });
  await check('las preferencias se conservan después de recargar', async () => {
    await page.goto(url + '/#/configuracion'); await page.reload();
    await page.getByRole('heading', { name: 'Funciones y proyección', exact: true }).waitFor();
    assert.equal(await page.getByRole('switch', { name: 'Presupuestos', exact: true }).isChecked(), false);
  });
  await check('las excepciones por deuda se guardan y cambian el total del mes', async () => {
    await page.getByText('Ajustar cada deuda (4)', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Proyección de Otro familiar', exact: true }).selectOption('exclude');
    await page.getByRole('button', { name: 'Guardar funciones y proyección', exact: true }).click();
    await page.getByText('Funciones y proyección guardadas para tu cuenta.', { exact: true }).waitFor();
    const result = await page.evaluate(data => __finanzasTest.month(data, '2026-11').outgoing, s.data);
    assert.equal(result, 375); assert.equal(s.data.debts.find(debt => debt.id === 'loan').outstanding_amount, 100);
  });
  await check('un fallo de guardado conserva el borrador y no aplica la opción', async () => {
    await page.getByRole('switch', { name: 'Deudas personales o con familiares', exact: true }).check();
    s.failSave(); await page.getByRole('button', { name: 'Guardar funciones y proyección', exact: true }).click();
    await page.getByText('Error de guardado simulado', { exact: true }).waitFor();
    assert.equal(s.data.app_settings[0].settings.projection_settings.debt_types.personal, false);
    assert.equal(await page.getByRole('switch', { name: 'Deudas personales o con familiares', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  });
  await check('Lo que viene muestra los mismos conceptos que el total calculado', async () => {
    await page.goto(url + '/#/lo-que-viene?month=2026-11');
    await page.locator('.upcoming-detail').waitFor();
    const detail = await page.locator('.upcoming-detail').innerText();
    assert(detail.includes('Electricidad')); assert(detail.includes('Compra con tarjeta'));
    assert(!detail.includes('Familiar')); assert(!detail.includes('Otro familiar'));
    await page.goto(url + '/#/configuracion');
    await page.getByRole('heading', { name: 'Funciones y proyección', exact: true }).waitFor();
  });
  await check('se pueden volver a activar todas las funciones', async () => {
    await page.getByRole('button', { name: 'Mostrar todas', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar funciones y proyección', exact: true }).click();
    await page.getByText('Funciones y proyección guardadas para tu cuenta.', { exact: true }).waitFor();
    assert.equal(await page.locator('.sidebar').getByRole('link', { name: 'Presupuestos', exact: true }).count(), 1);
  });
  await check('configuración usable en computadora y celular sin desbordes', async () => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'desborde en ' + width);
      if (width === 1440) assert.equal(await page.locator('.bottom-nav').isVisible(), false);
      await page.locator('.fp-feature-settings').screenshot({ path: path.join(root, `test-results/configuracion-${width}.png`), animations: 'disabled' });
    }
  });
  await check('el panel respeta el tema oscuro de la cuenta', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('dark');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const colors = await page.locator('.fp-feature-settings').evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
    }));
    assert.notEqual(colors.background, 'rgb(255, 255, 255)');
    await page.locator('.fp-feature-settings').screenshot({ path: path.join(root, 'test-results/configuracion-dark.png'), animations: 'disabled' });
  });
  await check('otra cuenta conserva sus propios ajustes', async () => {
    const other = await session('20000000-0000-4000-8000-000000000002');
    assert.equal(await other.page.getByRole('switch', { name: 'Presupuestos', exact: true }).isChecked(), true);
    assert.deepEqual(other.writes, []); await other.context.close();
  });
  assert.deepEqual(s.errors, [], 'errores de ejecución en navegador');
  console.log(`${checks} escenarios de navegador aprobados. Todas las escrituras usaron datos ficticios.`);
  await s.context.close();
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: path.join(root, 'test-results/failure.png'), fullPage: true }).catch(() => {});
    console.error((await page.locator('body').innerText()).slice(0, 4500));
  }
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
