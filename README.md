# Finanzas Pro — configuración de funciones y del mes

Esta versión agrega un modo básico, controles por función y reglas para decidir qué compromisos entran en la proyección. Las deudas personales quedan fuera por defecto; se pueden incluir por tipo o mediante una excepción por deuda. Los saldos reales, movimientos y pagos no se borran ni se recalculan al ocultar secciones.

Los controles están en **Configuración → Funciones y proyección**. Se guardan por cuenta en los campos `feature_visibility` y `projection_settings` del JSON existente `app_settings.settings`, mediante la función autenticada existente `fp_patch_settings`. No requiere migraciones ni cambios de permisos.

## Desarrollo

```sh
npm ci
npm test
npm run build
npm run test:browser
```

Netlify publica `dist/`. Para una carga manual, comprimir el contenido de esa carpeta, con `index.html` en la raíz del ZIP.

## Base de la versión

El `index.html` histórico del repositorio usa la implementación anterior de Apps Script. La aplicación que estaba publicada en `https://finanzasprodobles.netlify.app/` usa React y Supabase y contiene cambios posteriores. Se conserva esa publicación completa en `vendor/published/`, con su huella en `vendor/baseline.json`, para no perder funciones existentes.

La lógica nueva está en `src/`. `scripts/build.mjs` integra los puntos concretos de navegación, configuración y cálculo mediante el árbol sintáctico de la publicación original. La compilación falla si falta algún punto o cambia la base. Conserva las licencias y produce archivos con nombre según su contenido para actualizar la caché. Cuando se recupere el código fuente completo de la aplicación, estas integraciones pueden trasladarse directamente a sus componentes y servicios.

Las pruebas de navegador usan una cuenta y datos ficticios, e interceptan todos los accesos a Supabase. No escriben en las cuentas reales.
