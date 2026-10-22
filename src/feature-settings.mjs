// Account settings live beside the existing preferences in app_settings.settings.
// Visibility never removes records or changes actual balances.
export const FEATURES = Object.freeze([
  { key: 'wallet', label: 'Billetera', route: '/billetera', basic: true },
  { key: 'monthly', label: 'Lo que viene', route: '/lo-que-viene', basic: true },
  { key: 'cards', label: 'Tarjetas y cuotas', route: '/tarjetas', basic: true },
  { key: 'debts', label: 'Deudas', route: '/deudas' },
  { key: 'receivables', label: 'Por cobrar', route: '/por-cobrar' },
  { key: 'recurring', label: 'Recurrentes y servicios', route: '/recurrentes', basic: true },
  { key: 'budgets', label: 'Presupuestos', route: '/presupuestos' },
  { key: 'planning', label: 'Planificación y objetivos', route: '/planificacion' },
  { key: 'voice', label: 'Registro por voz', route: '/voz' },
  { key: 'receipts', label: 'Captura de comprobantes', route: '/capturar' },
  { key: 'shortcuts', label: 'Atajos', route: '/atajos' },
  { key: 'control', label: 'Control', route: '/control' },
  { key: 'charts', label: 'Gráficos del resumen' },
  { key: 'reminders', label: 'Paneles de recordatorios' },
]);
export const PROJECTION_GROUPS = Object.freeze({
  cards: 'Tarjetas y cuotas',
  recurring: 'Recurrentes y servicios',
  scheduled: 'Gastos programados',
  debts: 'Deudas por vencer',
  receivables: 'Cuentas por cobrar',
  incomePlans: 'Ingresos previstos',
});
export const DEBT_TYPES = Object.freeze({
  service: 'Servicios y facturas',
  tax: 'Impuestos',
  purchase: 'Compras pendientes',
  financing: 'Financiaciones',
  loan: 'Préstamos',
  personal: 'Deudas personales o con familiares',
  other: 'Otras deudas',
});
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function settingsOf(value) {
  return value && Object.hasOwn(value, 'app_settings')
    ? record(value.app_settings?.[0]?.settings)
    : record(value);
}
export function visibilityOf(value) {
  const saved = record(settingsOf(value).feature_visibility);
  return Object.fromEntries(FEATURES.map(({ key }) => [key, typeof saved[key] === 'boolean' ? saved[key] : true]));
}
export function basicVisibility() {
  return Object.fromEntries(FEATURES.map(({ key, basic }) => [key, !!basic]));
}
export function moduleEnabled(value, key) { return visibilityOf(value)[key] !== false; }
export function routeFeature(path) {
  if (typeof path !== 'string') return null;
  const clean = path.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  return FEATURES.find(feature => feature.route === clean)?.key || null;
}
export function routeEnabled(value, path) {
  const feature = routeFeature(path);
  return !feature || moduleEnabled(value, feature);
}
export function filterNav(groups, settings) {
  return groups.map(([label, links]) => [label, links.filter(([route]) => routeEnabled(settings, route))])
    .filter(([, links]) => links.length);
}
export function projectionOf(value) {
  const saved = record(settingsOf(value).projection_settings);
  const groups = record(saved.groups), types = record(saved.debt_types);
  return {
    groups: Object.fromEntries(Object.keys(PROJECTION_GROUPS).map(key => [key, typeof groups[key] === 'boolean' ? groups[key] : true])),
    debt_types: Object.fromEntries(Object.keys(DEBT_TYPES).map(key => [key, typeof types[key] === 'boolean' ? types[key] : key !== 'personal'])),
    debt_overrides: Object.fromEntries(Object.entries(record(saved.debt_overrides))
      .filter(([key, value]) => /^[\w-]{1,120}$/.test(key) && typeof value === 'boolean')),
  };
}
export function debtIncluded(value, debt) {
  const config = projectionOf(value);
  if (!config.groups.debts) return false;
  if (debt?.id && Object.hasOwn(config.debt_overrides, debt.id)) return config.debt_overrides[debt.id];
  const type = Object.hasOwn(DEBT_TYPES, debt?.debt_type) ? debt.debt_type : 'other';
  return config.debt_types[type];
}
export function scheduledIncluded(value, scheduled) {
  const { groups } = projectionOf(value);
  if (!groups.scheduled || (scheduled?.payment_method === 'credit_card' && !groups.cards)) return false;
  // Prepared months materialize recurring rules as scheduled expenses.
  if (/^FP_MONTH_SEED\|recurring\|/.test(scheduled?.notes || '') && !groups.recurring) return false;
  return true;
}
export function itemIncluded(data, item) {
  const { groups } = projectionOf(data);
  if (item.type === 'debt') {
    const debt = item.debt || (data.debts || []).find(debt => item.id?.startsWith('debt:' + debt.id + ':'));
    return debtIncluded(data, debt);
  }
  if (item.type === 'card') return groups.cards && (item.cardType !== 'recurring' || groups.recurring);
  if (item.type === 'recurring') return groups.recurring;
  if (item.type === 'scheduled') return scheduledIncluded(data, item.scheduled);
  if (item.type === 'receivable') return groups.receivables;
  if (item.type === 'income_plan') return groups.incomePlans;
  // Recorded movements remain part of the cash ledger.
  return true;
}
export function filterItems(data, items) { return items.filter(item => itemIncluded(data, item)); }
export function projectionData(data) {
  return { ...data, scheduled_expenses: (data.scheduled_expenses || []).filter(item => scheduledIncluded(data, item)) };
}
export function cardSummary(data, items) {
  const included = items.filter(item => item.type === 'card');
  const sum = type => Math.round(included.filter(item => item.cardType === type).reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100;
  return { onePay: sum('one_pay'), installments: sum('installment'), recurrent: sum('recurring'),
    total: Math.round(included.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100,
    items: included.map(({ cardType, ...item }) => ({ ...item, type: cardType })) };
}
export function configPatch(visibility, projection) {
  return { feature_visibility: visibilityOf({ feature_visibility: visibility }),
    projection_settings: projectionOf({ projection_settings: projection }) };
}
