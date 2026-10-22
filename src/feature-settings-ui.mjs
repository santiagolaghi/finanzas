import { FEATURES, PROJECTION_GROUPS, DEBT_TYPES, visibilityOf, basicVisibility, moduleEnabled,
  routeEnabled, projectionOf, debtIncluded, configPatch } from './feature-settings.mjs';

export function createFeatureUI({ React, useSettings, Link, Button, money }) {
  const h = React.createElement;
  function Toggle({ label, help, checked, disabled, onChange }) {
    return h('label', { className: 'fp-toggle' },
      h('span', null, h('b', null, label), help && h('small', null, help)),
      h('input', { type: 'checkbox', role: 'switch', checked, disabled,
        onChange: event => onChange(event.target.checked) }));
  }
  function SettingsPanel({ data }) {
    const { settings, save, ready, error } = useSettings();
    const [visibility, setVisibility] = React.useState(() => visibilityOf(settings));
    const [projection, setProjection] = React.useState(() => projectionOf(settings));
    const [dirty, setDirty] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => {
      if (!dirty) { setVisibility(visibilityOf(settings)); setProjection(projectionOf(settings)); }
    }, [settings, dirty]);
    const unavailable = !ready || !!error || data?.__unavailable?.includes('app_settings');
    function change(fn) { fn(); setDirty(true); setMessage(''); }
    function setGroup(key, value) {
      change(() => setProjection(previous => ({ ...previous, groups: { ...previous.groups, [key]: value } })));
    }
    function setType(key, value) {
      change(() => setProjection(previous => ({ ...previous, debt_types: { ...previous.debt_types, [key]: value } })));
    }
    function setOverride(id, value) {
      change(() => setProjection(previous => {
        const next = { ...previous.debt_overrides };
        if (value === 'default') delete next[id]; else next[id] = value === 'include';
        return { ...previous, debt_overrides: next };
      }));
    }
    async function submit() {
      setPending(true); setMessage(''); setFailed(false);
      try {
        const patch = configPatch(visibility, projection);
        const result = await save({}, patch);
        if (JSON.stringify(configPatch(visibilityOf(result), projectionOf(result))) !== JSON.stringify(patch))
          throw Error('No se pudo confirmar el guardado. Volvé a intentarlo.');
        setVisibility(visibilityOf(result)); setProjection(projectionOf(result)); setDirty(false);
        setMessage('Funciones y proyección guardadas para tu cuenta.');
      } catch (problem) { setFailed(true); setMessage(problem?.message || 'No se pudieron guardar los cambios.'); }
      finally { setPending(false); }
    }
    const debts = (data?.debts || []).filter(debt => Number(debt.outstanding_amount) > 0 && debt.status !== 'cancelled');
    return h('section', { className: 'fp-feature-settings', 'aria-labelledby': 'fp-features-title' },
      h('header', null, h('span', { className: 'eyebrow' }, 'SOLO LO QUE USÁS'),
        h('h3', { id: 'fp-features-title' }, 'Funciones y proyección'),
        h('p', null, 'Elegí las funciones que querés ver y, por separado, qué conceptos cuentan para el mes. Se guarda en tu cuenta.')),
      unavailable && h('p', { className: 'notice danger', role: 'alert' }, 'Esperá a que cargue la configuración o reintentá antes de guardar.'),
      h('fieldset', { className: 'fp-settings-fieldset', disabled: pending || unavailable },
        h('div', { className: 'fp-config-columns' },
          h('section', { 'aria-labelledby': 'fp-visibility-title' },
            h('h4', { id: 'fp-visibility-title' }, 'Qué funciones ves'),
            h('p', { className: 'fp-help' }, 'El modo básico deja Resumen, Movimientos, Billetera, Lo que viene, Tarjetas y Recurrentes. Configuración, cuentas, categorías y ayuda siguen a mano.'),
            h('div', { className: 'fp-presets' },
              h(Button, { type: 'button', onClick: () => change(() => setVisibility(basicVisibility())) }, 'Usar modo básico'),
              h(Button, { type: 'button', onClick: () => change(() => setVisibility(visibilityOf({}))) }, 'Mostrar todas')),
            h('div', { className: 'fp-switch-list' }, FEATURES.map(feature => h(Toggle, { key: feature.key,
              label: feature.label, checked: visibility[feature.key],
              onChange: value => change(() => setVisibility(previous => ({ ...previous, [feature.key]: value }))) }))),
            h('p', { className: 'fp-help' }, 'Ocultar una función conserva sus datos. Sus importes siguen contando hasta que los excluyas en la proyección.')),
          h('section', { id: 'fp-projection', 'aria-labelledby': 'fp-projection-title' },
            h('h4', { id: 'fp-projection-title' }, 'Qué incluye el mes'),
            h('p', { className: 'fp-help' }, 'Estas reglas se aplican a las proyecciones de todos los meses y a Lo que viene. Una fecha de vencimiento no obliga a incluir una deuda.'),
            h('div', { className: 'fp-switch-list' }, Object.entries(PROJECTION_GROUPS).map(([key, label]) =>
              h(Toggle, { key, label, checked: projection.groups[key], onChange: value => setGroup(key, value) }))),
            h('h4', null, 'Tipos de deuda que cuentan'),
            h('div', { className: 'fp-switch-list' }, Object.entries(DEBT_TYPES).map(([key, label]) =>
              h(Toggle, { key, label, checked: projection.debt_types[key], disabled: !projection.groups.debts,
                onChange: value => setType(key, value) }))),
            h('p', { className: 'fp-help' }, 'Las deudas personales o familiares quedan fuera por defecto. Servicios, facturas, impuestos y tarjetas siguen incluidos.'),
            h('details', { className: 'fp-debt-options' },
              h('summary', null, 'Ajustar cada deuda (' + debts.length + ')'),
              h('p', { className: 'fp-help' }, 'Elegí una excepción si una deuda está cargada con otro tipo. Para incluirla también debe estar activo “Deudas por vencer”.'),
              debts.length ? debts.map(debt => {
                const override = Object.hasOwn(projection.debt_overrides, debt.id) ? projection.debt_overrides[debt.id] ? 'include' : 'exclude' : 'default';
                const included = debtIncluded({ projection_settings: projection }, debt);
                return h('label', { key: debt.id, className: 'fp-debt-option' },
                  h('span', null, h('b', null, debt.creditor_name || debt.concept || 'Deuda'),
                    h('small', null, [debt.concept, DEBT_TYPES[debt.debt_type] || 'Otra deuda', included ? 'Cuenta en el mes' : 'Fuera del mes'].filter(Boolean).join(' · ')),
                    h('small', { className: 'money' }, money(Number(debt.outstanding_amount)))),
                  h('select', { value: override, disabled: !projection.groups.debts,
                    'aria-label': 'Proyección de ' + (debt.creditor_name || debt.concept || 'deuda'), onChange: event => setOverride(debt.id, event.target.value) },
                    h('option', { value: 'default' }, 'Según su tipo'), h('option', { value: 'include' }, 'Incluir en el mes'), h('option', { value: 'exclude' }, 'Dejar fuera del mes')));
              }) : h('p', { className: 'fp-help' }, 'No tenés deudas pendientes.')),
            h('p', { className: 'fp-help' }, 'El saldo real de tus cuentas y los pagos registrados se conservan. Excluir una deuda de la proyección no la cancela.'))),
        h('footer', { className: 'fp-config-footer' },
          h('span', { className: 'fp-help' }, dirty ? 'Cambios sin guardar' : 'Ajustes de tu cuenta'),
          h('div', { className: 'fp-presets' },
            h(Button, { disabled: !dirty, onClick: () => { setVisibility(visibilityOf(settings)); setProjection(projectionOf(settings)); setDirty(false); setMessage(''); } }, 'Descartar'),
            h(Button, { className: 'primary', disabled: !dirty || pending || unavailable, onClick: submit }, pending ? 'Guardando…' : 'Guardar funciones y proyección')))),
      message && h('p', { className: 'notice ' + (failed ? 'danger' : 'success'), role: failed ? 'alert' : 'status' }, message));
  }
  function Module({ name, children }) {
    const { settings } = useSettings();
    return moduleEnabled(settings, name) ? children : null;
  }
  function RouteGate({ path, children }) {
    const { settings } = useSettings();
    return routeEnabled(settings, path) ? children : h('section', { className: 'panel fp-disabled' },
      h('h2', null, 'Esta función está desactivada'),
      h('p', null, 'Podés volver a activarla desde Configuración. Tus datos se conservan.'),
      h(Link, { to: '/configuracion#fp-features-title', className: 'primary' }, 'Configurar funciones'),
      h(Link, { to: '/', className: 'secondary' }, 'Volver al resumen'));
  }
  function wrapLink(Original, navigation = false) {
    return React.forwardRef(function FeatureLink(props, ref) {
      const { settings } = useSettings();
      const path = typeof props.to === 'string' ? props.to : props.to?.pathname;
      if (routeEnabled(settings, path)) return h(Original, { ...props, ref });
      const action = /(?:^|\s)(?:primary|secondary|circle-btn|text-button|btn)(?:\s|$)/.test(props.className || '');
      // A hidden module must not erase a creditor or a bill's name in the monthly detail.
      return navigation || action ? null : h('span', { className: props.className }, props.children);
    });
  }
  function ProjectionNote() {
    const { settings } = useSettings(), projection = projectionOf(settings);
    const excluded = Object.values(projection.groups).some(value => !value) || Object.values(projection.debt_types).some(value => !value) || Object.keys(projection.debt_overrides).length;
    return h('div', { className: 'fp-projection-note' },
      h('span', null, excluded ? 'Proyección según tus reglas. ' : 'Todos los tipos incluidos. ',
        !projection.debt_types.personal && !Object.values(projection.debt_overrides).some(Boolean) ? 'Deudas personales fuera del mes.' : ''),
      h(Link, { to: '/configuracion#fp-projection', className: 'text-link' }, 'Configurar qué cuenta'));
  }
  return { element: h, SettingsPanel, Module, RouteGate, wrapLink, ProjectionNote };
}
