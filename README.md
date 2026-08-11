# Finanzas Pro — React + Vite + Supabase

Primera reconstrucción de Finanzas Pro sobre React/Vite, conectada directamente a Supabase.

## Estado actual

- Login real con Supabase Auth.
- RLS usa el usuario autenticado; no hay `service_role` en el frontend.
- Dashboard leyendo datos migrados.
- Movimientos reales desde `transactions`.
- Tarjetas + planes de cuotas.
- Deudas.
- Recurrentes.
- Ayuda básica.
- Diseño responsive con menú lateral en escritorio y barra inferior móvil.
- Configurado para publicarse bajo `/finanzas/`.

## Desarrollo local

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Importante

La clave incluida es una **Supabase Publishable Key**, no una clave secreta. La seguridad de los datos depende de Supabase Auth + RLS.

No uses una `service_role` o secret key en el navegador.

## GitHub Pages

Todavía no se incluye despliegue automático para `react-v2`, porque el repositorio ya tiene una versión pública en `main`. Primero validar la nueva app y luego decidir cuándo reemplazar producción.

## Validación automática

La rama `react-v2` incluye `.github/workflows/react-v2-ci.yml`. Cada push a esa rama ejecuta `npm install` + `npm run build`, pero **no publica GitHub Pages**. Así podemos validar la nueva app sin reemplazar la web actual.
