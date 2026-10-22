import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);
const vendor = path.join(root, 'vendor/published');
const out = path.join(root, 'dist');
const baseline = await readFile(path.join(vendor, 'assets/main-4BD2VXAC.js'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(root, 'vendor/baseline.json'), 'utf8'));
if (hash(baseline) !== manifest.main_sha256_prefix) throw Error('La base publicada cambió. Revisá los puntos de integración antes de compilar.');
const ast = parse(baseline, { ecmaVersion: 'latest', sourceType: 'module' });
const edits = [], counts = {};
const insert = (at, text) => edits.push({ start: at, end: at, text });
const replace = (start, end, text) => edits.push({ start, end, text });
const source = node => baseline.slice(node.start, node.end);
const functions = new Map(ast.body.filter(node => node.type === 'FunctionDeclaration').map(node => [node.id.name, node]));
function wrap(name, alias, body) {
  const fn = functions.get(name);
  if (!fn) throw Error('No se encontró la integración: ' + name);
  replace(fn.id.start, fn.id.end, alias);
  insert(fn.end, '\n' + body + '\n');
}
wrap('iu', 'fpAllCommitments', 'function iu(e,t){return fpFilterItems(e,fpAllCommitments(e,t));}');
wrap('Af', 'fpOriginalOverdue', 'function Af(e){const r=fpOriginalOverdue(e);return {...r,undated:r.undated.filter(x=>fpDebtIncluded(e,x.debt))};}');
wrap('Lg', 'fpOriginalTotals', 'function Lg(e,t){const r=fpOriginalTotals(e,t);return {...r,cards:fpCardSummary(e,iu(e,t))};}');
wrap('Df', 'fpOriginalMonth', 'function Df(e,t){const r=fpOriginalMonth(fpProjectionData(e),t);return {...r,incomePlans:fpProjectionOf(e).groups.incomePlans?r.incomePlans:[]};}');
wrap('Of', 'fpOriginalProjection', 'function Of(e,t){return fpOriginalProjection(fpProjectionData(e),t);}');
wrap('fu', 'fpOriginalNotices', 'function fu(e,t=re(),a){return fpModuleEnabled(e,"reminders")?fpOriginalNotices(e,t,a).filter(x=>fpRouteEnabled(e,x.route)):[];}');
const shell = functions.get('zC');
insert(shell.body.start + 1, 'let fpShellSettings=Jr().settings;');
const moduleClasses = {
  'panel category-ranking': 'charts', 'panel year-trend': 'charts',
  'panel dashboard-budgets': 'budgets', 'panel dashboard-reminders': 'reminders',
};
const isObject = node => node?.type === 'ObjectExpression';
const property = (node, key) => node?.properties?.find(p => p.type === 'Property' && (p.key.name || p.key.value) === key)?.value;
function enclose(node, prefix) { insert(node.start, prefix); insert(node.end, ')'); }
function walk(node, owner) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') owner = node.id.name;
  if (node.type === 'Literal' && owner === 'Uw' && typeof node.value === 'string') {
    const labels = { 'Guardar ajustes': 'Guardar preferencias', 'Todo guardado': 'Preferencias guardadas',
      'Cambios sin guardar': 'Preferencias sin guardar', 'Finanzas Pro · Versión 33.2.0 ': 'Finanzas Pro · Versión 33.3.0 ' };
    if (Object.hasOwn(labels, node.value)) replace(node.start, node.end, JSON.stringify(labels[node.value]));
  }
  if (node.type === 'CallExpression') {
    if (owner === 'zC' && node.callee.type === 'MemberExpression' && node.callee.object.name === 'UC' && node.callee.property.name === 'map') {
      replace(node.callee.object.start, node.callee.object.end, 'fpFilterNav(UC,fpShellSettings)'); counts.navigation = (counts.navigation || 0) + 1;
    }
    const [type, props] = node.arguments;
    if (isObject(props)) {
      const className = property(props, 'className')?.value;
      const children = property(props, 'children');
      if (moduleClasses[className]) {
        enclose(node, `fpUi.element(fpUi.Module,{name:${JSON.stringify(moduleClasses[className])}},`);
        counts[className] = (counts[className] || 0) + 1;
      }
      if (owner === 'zC' && type?.name === 'FC') enclose(node, 'fpUi.element(fpUi.Module,{name:"reminders"},');
      if (owner === 'zC' && type?.name === 'jC') {
        enclose(node, 'fpUi.element(fpUi.Module,{name:"cards"},fpUi.element(fpUi.Module,{name:"reminders"},');
        insert(node.end, ')');
      }
      if (owner === 'zC' && type?.name === 'Ph') {
        enclose(node, 'fpUi.element(fpUi.RouteGate,{path:c.pathname},'); counts.routeGate = (counts.routeGate || 0) + 1;
      }
      if (owner === 'Uw' && className === 'settings-grid' && children?.type === 'ArrayExpression') {
        insert(children.start + 1, 'fpUi.element(fpUi.SettingsPanel,{data:y}),'); counts.settings = (counts.settings || 0) + 1;
      }
      if (['page-stack dashboard-new', 'page-stack upcoming-page'].includes(className) && children?.type === 'ArrayExpression') {
        const at = children.elements[1]?.start ?? children.end - 1;
        insert(at, 'fpUi.element(fpUi.ProjectionNote,{}),'); counts.projectionNotes = (counts.projectionNotes || 0) + 1;
      }
      if (owner === 'ww' && className === 'panel projection-panel' && children?.type === 'ArrayExpression') {
        insert(children.start + 1, 'fpUi.element(fpUi.ProjectionNote,{}),'); counts.walletNote = (counts.walletNote || 0) + 1;
      }
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (['start', 'end'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, owner));
    else if (value && typeof value === 'object') walk(value, owner);
  }
}
walk(ast, null);
for (const key of ['navigation', 'routeGate', 'settings', ...Object.keys(moduleClasses)]) {
  if (counts[key] !== 1) throw Error(`Integración ambigua ${key}: ${counts[key] || 0}`);
}
if (counts.projectionNotes !== 2 || counts.walletNote !== 1) throw Error('Falta la explicación de las reglas de proyección.');
const boot = baseline.indexOf('qw.default.createRoot(');
if (boot < 0) throw Error('No se encontró el inicio de React.');
insert(boot, 'var fpUi=fpCreateUI({React:lt,useSettings:Jr,Link:we,Button:w,money:T});bn=fpUi.wrapLink(bn,true);we=fpUi.wrapLink(we);\n');
let patched = baseline;
for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'assets'), { recursive: true });
await cp(vendor, out, { recursive: true });
await rm(path.join(out, 'assets/main-4BD2VXAC.js'));
const core = await readFile(path.join(root, 'src/feature-settings.mjs'), 'utf8');
const coreName = `feature-settings-${hash(core)}.mjs`;
let ui = await readFile(path.join(root, 'src/feature-settings-ui.mjs'), 'utf8');
ui = ui.replace("'./feature-settings.mjs'", JSON.stringify('./' + coreName));
const uiName = `feature-settings-ui-${hash(ui)}.mjs`;
const css = await readFile(path.join(root, 'src/feature-settings.css'), 'utf8');
const cssName = `feature-settings-${hash(css)}.css`;
const imports = `import {filterItems as fpFilterItems,debtIncluded as fpDebtIncluded,cardSummary as fpCardSummary,projectionData as fpProjectionData,projectionOf as fpProjectionOf,moduleEnabled as fpModuleEnabled,routeEnabled as fpRouteEnabled,filterNav as fpFilterNav} from './${coreName}';\nimport {createFeatureUI as fpCreateUI} from './${uiName}';\n`;
patched = imports + patched;
parse(patched, { ecmaVersion: 'latest', sourceType: 'module' });
const mainName = `main-${hash(patched)}.js`;
await writeFile(path.join(out, 'assets', coreName), core);
await writeFile(path.join(out, 'assets', uiName), ui);
await writeFile(path.join(out, 'assets', cssName), css);
await writeFile(path.join(out, 'assets', mainName), patched);
let html = await readFile(path.join(vendor, 'index.html'), 'utf8');
html = html.replace('main-4BD2VXAC.js', mainName).replace('</head>', `<link rel="stylesheet" href="./assets/${cssName}"/></head>`);
await writeFile(path.join(out, 'index.html'), html);
await writeFile(path.join(out, '_redirects'), '/* /index.html 200\n');
await writeFile(path.join(out, '_headers'), '/index.html\n  Cache-Control: public, max-age=0, must-revalidate\n/sw.js\n  Cache-Control: no-cache\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
const assets = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', ...(await readdir(path.join(out, 'assets'))).map(name => './assets/' + name)];
// Keep capture/share-target and notification handling from the published PWA.
let worker = await readFile(path.join(vendor, 'sw.js'), 'utf8');
if (!/const CACHE='[^']+';/.test(worker) || !/const CORE=\[[^\n]*\];/.test(worker)) throw Error('El worker original cambió.');
worker = worker.replace(/const CACHE='[^']+';/, `const CACHE='finanzas-pro-33.3.0-${hash(patched)}';`)
  .replace(/const CORE=\[[^\n]*\];/, 'const CORE=' + JSON.stringify(assets) + ';');
await writeFile(path.join(out, 'sw.js'), worker);
await writeFile(path.join(out, 'version.json'), JSON.stringify({ version: '33.3.0', main: mainName, baseline: manifest.main_sha256_prefix }));
console.log('Build 33.3.0: funciones, navegación y proyección integradas.');
