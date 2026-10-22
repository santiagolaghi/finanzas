export const OWNER = '10000000-0000-4000-8000-000000000001';
export function fixture(owner = OWNER) {
  const own = records => records.map(record => ({ ...record, owner_id: owner }));
  return {
    __ownerId: owner, __unavailable: [],
    profiles: [{ id: owner, display_name: 'Cuenta de prueba' }],
    people: [], categories: [{ id: 'cat', owner_id: owner, name: 'Servicios', color: '#6d4de3', active: true }], subcategories: [],
    accounts: own([{ id: 'account', name: 'Banco de prueba', opening_balance: 1000, active: true, include_in_available: true, account_type: 'bank', currency: 'ARS' }]),
    transactions: own([
      { id: 'card-purchase', kind: 'expense', concept: 'Compra con tarjeta', amount_total: 200, occurred_on: '2026-10-16', status: 'confirmed', paid_or_received: true, cash_effect: true, economic_effect: true, category_id: 'cat' },
      { id: 'paid-debt', kind: 'expense', concept: 'Pago real a familiar', amount_total: 50, occurred_on: '2026-10-20', status: 'confirmed', paid_or_received: true, cash_effect: true, economic_effect: false, linked_entity_id: 'family', origin_type: 'debt_payment' },
    ]),
    transaction_allocations: own([
      { id: 'card-allocation', transaction_id: 'card-purchase', amount: 200, method: 'credit_card', credit_card_id: 'card', card_cycle_id: 'cycle' },
      { id: 'cash-allocation', transaction_id: 'paid-debt', amount: 50, method: 'transfer', account_id: 'account' },
    ]),
    credit_cards: own([{ id: 'card', bank_name: 'Banco de prueba', card_name: 'Visa', active: true, credit_limit: 10000 }]),
    card_cycles: own([{ id: 'cycle', credit_card_id: 'card', closes_on: '2026-10-20', due_on: '2026-11-05', status: 'open', source: 'confirmed:2026-10' }]),
    debts: own([
      { id: 'family', creditor_name: 'Familiar', concept: 'Préstamo familiar', debt_type: 'personal', original_amount: 450, outstanding_amount: 400, due_on: '2026-11-10', status: 'partial' },
      { id: 'service', creditor_name: 'Electricidad', concept: 'Factura', debt_type: 'service', original_amount: 80, outstanding_amount: 80, due_on: '2026-11-08', status: 'pending' },
      { id: 'tax', creditor_name: 'Municipio', concept: 'Impuesto', debt_type: 'tax', original_amount: 20, outstanding_amount: 20, due_on: '2026-11-15', status: 'pending' },
      { id: 'loan', creditor_name: 'Otro familiar', concept: 'Cargado como préstamo', debt_type: 'loan', original_amount: 100, outstanding_amount: 100, due_on: '2026-11-18', status: 'pending' },
    ]), debt_payments: [], debt_payment_plans: [],
    recurring_rules: own([{ id: 'internet', name: 'Internet', kind: 'expense', expected_amount: 50, expected_day: 12, payment_method: 'transfer', account_id: 'account', starts_on: '2026-11-01', active: true, amount_behavior: 'fixed', category_id: 'cat' }]),
    recurring_matches: [],
    scheduled_expenses: own([{ id: 'phone', name: 'Teléfono programado', amount: 25, due_on: '2026-11-20', status: 'planned', payment_method: 'transfer', account_id: 'account' }]),
    receivables: own([{ id: 'receivable', debtor_name: 'Cobro de prueba', original_amount: 30, outstanding_amount: 30, due_on: '2026-11-23', status: 'pending' }]),
    app_settings: own([{ settings: { preferences: { theme: 'light' }, initialized_months: ['2026-10'], income_sources: [] } }]),
    installment_plans: [], installments: [], account_transfers: [], budgets: [], receivable_payments: [], savings_goals: [], reserved_funds: [], automation_rules: [], reconciliations: [], reconciliation_items: [], tags: [], transaction_tags: [], audit_log: [], goal_contributions: [], transaction_splits: [], receipt_files: [], quick_inbox: [],
  };
}
