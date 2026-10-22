import test from 'node:test';
import assert from 'node:assert/strict';
import { visibilityOf, basicVisibility, filterNav, routeEnabled, projectionOf, debtIncluded, filterItems, configPatch } from '../src/feature-settings.mjs';

test('el modo básico deja acceso a la configuración y permite recuperar las funciones', () => {
  const settings = { feature_visibility: basicVisibility() };
  assert.equal(routeEnabled(settings, '/presupuestos'), false);
  assert.equal(routeEnabled(settings, '/configuracion'), true);
  assert.equal(routeEnabled(settings, '/cuentas'), true);
  assert.equal(routeEnabled(settings, '/movimientos?nuevo=1'), true);
  assert.equal(routeEnabled(settings, '/tarjetas?month=2026-11'), true);
  const nav = filterNav([['Extra', [['/presupuestos', null, 'Presupuestos']]], ['Mi cuenta', [['/configuracion', null, 'Configuración']]]], settings);
  assert.deepEqual(nav.map(([label]) => label), ['Mi cuenta']);
  assert.equal(visibilityOf({ feature_visibility: { budgets: true } }).budgets, true);
});
test('una deuda familiar puede excluirse aunque tenga vencimiento, sin modificar el registro', () => {
  const debt = Object.freeze({ id: 'family', debt_type: 'personal', due_on: '2026-11-10', outstanding_amount: 400 });
  assert.equal(debtIncluded({}, debt), false);
  assert.equal(debtIncluded({ projection_settings: { debt_overrides: { family: true } } }, debt), true);
  assert.equal(debt.outstanding_amount, 400);
  assert.equal(debtIncluded({}, { debt_type: 'service' }), true);
});
test('las excepciones por deuda tienen prioridad sobre su tipo, dentro del grupo habilitado', () => {
  const settings = { projection_settings: { debt_types: { loan: true }, debt_overrides: { family: false } } };
  assert.equal(debtIncluded(settings, { id: 'family', debt_type: 'loan' }), false);
  settings.projection_settings.groups = { debts: false };
  settings.projection_settings.debt_overrides.family = true;
  assert.equal(debtIncluded(settings, { id: 'family', debt_type: 'loan' }), false);
});
test('ocultar deudas cambia la interfaz y conserva su inclusión financiera por tipo', () => {
  const settings = { feature_visibility: { debts: false } };
  assert.equal(routeEnabled(settings, '/deudas'), false);
  assert.equal(debtIncluded(settings, { debt_type: 'service' }), true);
});
test('un mes preparado respeta la misma regla de recurrentes y mantiene pagos reales', () => {
  const data = { app_settings: [{ settings: { projection_settings: { groups: { recurring: false } } } }] };
  const items = [
    { type: 'scheduled', id: 'seed', scheduled: { notes: 'FP_MONTH_SEED|recurring|internet|2026-11' } },
    { type: 'recurring', id: 'rule' },
    { type: 'card', cardType: 'recurring', id: 'expected-card' },
    { type: 'card', cardType: 'one_pay', id: 'real-card' },
    { type: 'movement', id: 'actual-payment' },
  ];
  assert.deepEqual(filterItems(data, items).map(item => item.id), ['real-card', 'actual-payment']);
});
test('los ajustes inválidos no desactivan opciones ni se mezclan con otra cuenta', () => {
  assert.equal(visibilityOf({ feature_visibility: { cards: 'false' } }).cards, true);
  assert.equal(projectionOf({ projection_settings: { debt_types: { service: 'no' } } }).debt_types.service, true);
  assert.equal(projectionOf({ projection_settings: { debt_overrides: { family: 'no' } } }).debt_overrides.family, undefined);
  const accountA = configPatch(basicVisibility(), projectionOf({}));
  assert.equal(accountA.feature_visibility.voice, false);
  assert.equal(visibilityOf({}).voice, true);
  assert.equal(debtIncluded({}, { id: 'family', debt_type: 'personal' }), false);
});
