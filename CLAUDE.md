# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Finanzas del hogar de Marcos y Flor (proyecto personal, no de MateWare): una
planilla compartida "Gastos depto", una web app de Apps Script para cargar
desde el celular, y una planilla "Finanzas personales" privada por persona.

**`TRASPASO_claude_code.md` es la fuente de verdad**: IDs de planillas,
sheetIds, hallazgos de la revisión (C1, A1, A2, H1–H3, M1, M2, B1–B4),
decisiones tomadas, orden de trabajo y totales de control. Leelo antes de
tocar código o datos. Este archivo no lo repite.

## Estado del repo

- `apps-script/` es el espejo del proyecto desplegado y el `rootDir` de
  `.clasp.json` (ahí está el Script ID). Su primer commit es el código bajado
  sin modificar. Los nombres de archivo tienen que quedar planos e iguales a
  los del proyecto (`Código.js`, `Web.html`, `Panel.html`): una subcarpeta
  cambia el nombre remoto y rompe `createHtmlOutputFromFile('Web')`.
- `referencia/` guarda las versiones numeradas que entregó Claude Desktop
  (`Codigo_v9.gs`, `Codigo_v11.gs`, `Web_v8.html`, `Web_v9.html`,
  `Panel_v2.html`, `Indices.gs`). Verificado el 12/10/2026: lo desplegado es
  exactamente v9 + Web_v8 + Panel_v2 + Indices. No se editan.
- `Finanzas.js` es la librería `google-sheets-argento` pegada tal cual. No se
  edita.
- **`PLAN.md`** tiene las etapas, los issues y cómo se delega a Gemini.

## Despliegue con clasp

El script está vinculado a la planilla, así que hay dos "producciones":

- **HEAD**: lo que corre el menú y el `Panel.html` de la planilla, las funciones
  personalizadas (`iclAcumulado`, ...) y los disparadores. **`clasp push`
  cambia HEAD al instante.**
- **Web app (celular)**: la implementación `AKfycby7a82T...` fijada en la
  versión 7 (v12, desde el 16/10/2026). No cambia con `clasp push`; solo con
  `clasp version` + `clasp deploy -i <id> -V <versión>`. Para volver atrás:
  redesplegar con `-V 6` (v9 + Web_v8).
- **La zona del script viaja en el manifiesto de cada versión.** Script y
  planilla tienen que estar en la misma zona (`America/Argentina/Mendoza`
  desde 1.2, #5); si no, cada fecha nueva se corre un día. Las versiones 6 y 7
  están en UTC: volver a ellas exige poner la planilla otra vez en UTC.
- **Se prueba antes en el `/dev` de la implementación @HEAD**,
  `https://script.google.com/macros/s/AKfycbxyTuOSm3xrcuylSuGpA10zp9Eiyknjts5altwLKuo/dev`.
  El `/dev` de la implementación del celular (`AKfycby7a82T.../dev`) sirve la
  versión fijada, no HEAD: probar ahí muestra el código viejo (#66).
- Las ejecuciones (función, estado, duración) se leen con la API
  `processes:listScriptProcesses`: clasp está logueado con un cliente OAuth
  propio que tiene el scope `script.processes`. Sin proyecto de GCP vinculado,
  `clasp logs` no anda.

`clasp pull`, `clasp show-file-status` y `clasp list-deployments` son seguros.
`clasp push` y `clasp deploy` solo con confirmación de Marcos.

El MCP de Google Sheets tiene acceso de lectura a la planilla compartida: sirve
para verificar los totales de control (hoja Resumen) antes y después de
instalar.

## Pruebas

Node 22, sin dependencias ni `package.json`. Todas las pruebas:
`node --test 'pruebas/*.test.js'` (con comillas). Sin el patrón, `node --test`
también levanta cualquier `*.test.js` fuera de `pruebas/` (por ejemplo la
carpeta local `revision-claude-desktop/`), y `node --test pruebas/` falla
porque Node 22 lo toma como archivo. Un archivo puntual:
`node --test pruebas/arnes.test.js`.

`pruebas/arnes.js` carga el código **real** de `apps-script/` en un contexto
`node:vm` con stubs de los servicios de Google y del navegador
(`cargarServidor`, `cargarHtml`). Las pruebas nuevas usan el arnés; nunca
copian funciones del código.

`pruebas/planilla_falsa.js` (`crearServicios`) simula en memoria
SpreadsheetApp, LockService, CacheService, PropertiesService, Session y
Utilities para las pruebas del servidor.

Las pruebas con el código de un hallazgo en el nombre (`A1: ...`, `C1: ...`)
se escriben **antes** del arreglo y fallan hasta que se arregla; las `CONTROL`
pasan siempre. En `develop`, `node --test 'pruebas/*.test.js'` tiene que salir
en verde. La tabla
de archivos está en `README.md`.

La planilla falsa usa la zona `America/Argentina/Mendoza` por defecto, como
producción desde 1.2 (#5) (`crearServicios(planillas, { zona })`). Una prueba que cambia la zona tiene
que poner también `process.env.TZ`: `new Date(a, m, d)` se arma en la zona del
proceso en Node y en la del script en Apps Script.

**En el iframe de Apps Script, `showPicker()` está bloqueado:** no se puede
abrir un desplegable ni un calendario por código (#59, #60).

## Arquitectura (lo que cruza archivos)

- Web app publicada como *Ejecutar como: usuario que accede*: cada uno escribe
  con su propia cuenta. Por eso la migración de la personal (Fase 3) tiene que
  ser un botón dentro de la app, no un script con la cuenta de servicio del MCP.
- Planilla compartida: muchas hojas son **calculadas** (Servicios = SUMIFS
  desde Pagos servicios; Gastos diarios = QUERY; H/I de Gastos con
  ARRAYFORMULA). No escribir encima. El código lee Resumen **por etiqueta**, no
  por número de fila.
- La planilla está en español: las fórmulas usan `;` como separador. Con `,`
  dan `#ERROR!`.
- Escrituras del servidor van por `unaVez()`: lock + `idEnvio` en
  CacheService, chequeado y grabado dentro del mismo lock. La clave se graba
  solo si el guardado terminó bien. El cliente (`llamar()`) reusa el
  `idEnvio` mientras el envío no tenga una respuesta **exitosa** y el
  contenido (sin el adjunto) sea el mismo; los envíos pendientes viajan en el
  borrador. Todo formulario de la web app que escriba pasa por `llamar()`
  (el panel lateral no: corre en la PC, ver #46).
- Montos: `aNumero` aplica la regla argentina (`"15.250"` = quince mil
  doscientos cincuenta). Es acordado, no es bug.

## Reglas

- **No modificar ningún dato de la planilla sin confirmación explícita de
  Marcos.** Cualquier cambio de código o estructura tiene que dejar iguales los
  totales de control del traspaso (§2); si cambian a propósito, documentar los
  nuevos.
- No compartir la planilla personal de Flor con la cuenta de servicio del MCP.
  Para desarrollar la migración, usar la copia de Marcos.
- Nunca guardar números de tarjeta (alcanza con nombre, empresa, banco, cierre
  y vencimiento).
- `Codigo_v11.gs` + `Web_v9.html` (Fase 1) **no se instalan tal cual**: van
  como v12 con los arreglos.
