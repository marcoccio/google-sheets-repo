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
  versión 6. No cambia con `clasp push`; solo con
  `clasp deploy -i <id> -V <versión>`. Se prueba antes en la URL `/dev`
  (implementación @HEAD). Para volver atrás: redesplegar con `-V 6`.

`clasp pull`, `clasp show-file-status` y `clasp list-deployments` son seguros.
`clasp push` y `clasp deploy` solo con confirmación de Marcos.

El MCP de Google Sheets tiene acceso de lectura a la planilla compartida: sirve
para verificar los totales de control (hoja Resumen) antes y después de
instalar.

## Pruebas

Node 22, sin dependencias ni `package.json`. `node --test` desde la raíz corre
los `pruebas/*.test.js` (no le pases `pruebas/`: Node 22 lo toma como archivo y
falla). Un archivo puntual: `node --test pruebas/arnes.test.js`.

`pruebas/arnes.js` carga el código **real** de `apps-script/` en un contexto
`node:vm` con stubs de los servicios de Google y del navegador
(`cargarServidor`, `cargarHtml`). Las pruebas nuevas usan el arnés; nunca
copian funciones del código.

Los `test_*.js` viejos son scripts que imprimen el bug (sin asserts); el #3 los
pasa a `node:test`:

```bash
node pruebas/test_fecha_y_monto.js                  # A1 + aNumero 9/9
node pruebas/test_watchdog_duplica.js               # C1, tarda 26 s
TZ=America/Argentina/Mendoza node pruebas/test_zona_horaria.js  # H1
node pruebas/test_adjunto_descartado.js             # H2
node pruebas/test_borrador_pagador.js               # H3
```

- `pruebas/test_fecha_y_monto.js` tiene `aFecha`/`aNumero` **copiadas** de
  `Codigo_v11.gs`. Una vez que el código esté en el repo, hay que extraerlas
  del archivo real para que la prueba siga al código.
- Las otras cuatro **simulan** la lógica del frontend (dependen del navegador o
  de `google.script.run`). No reemplazan probar en el teléfono.

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
- Escrituras del servidor van dentro de un lock; la idempotencia de C1 se
  resuelve con una clave por envío chequeada en CacheService dentro del lock.
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
