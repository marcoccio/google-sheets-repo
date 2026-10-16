# Plan de implementación

Armado el 12/10/2026 a partir de `TRASPASO_claude_code.md`, del código bajado
con clasp y de una lectura (solo lectura) de la planilla compartida. Cada fila
de las tablas de etapas es un issue de GitHub.

## Lo que cambió respecto del traspaso

| Tema | Traspaso | Verificado ahora |
|---|---|---|
| Qué está desplegado | v9 + Web_v8, "sin verificar" | **Confirmado byte a byte**: `Código.js` = `Codigo_v9.gs`, `Web.html` = `Web_v8.html`, `Panel.html` = `Panel_v2.html`, `Indices.js` = `Indices.gs`. La versión 6 (la de la web app) es igual a HEAD |
| Totales de control | Verificados el 11/10 | **Siguen iguales** el 12/10 (leídos de Resumen con el MCP) |
| D-c, ICL `#ERROR!` | Causa sin diagnosticar | **El BCRA dio de baja la API v3** (HTTP 410, `Indices.js:50`). La v4 funciona: el ICL es `idVariable` 40, la serie viene en `results[0].detalle[]` y el listado está paginado (`limit` 1000, 1610 variables) |
| Zona horaria | H1 solo en el frontend | `appsscript.json` tiene `timeZone: UTC` y la planilla `Etc/UTC`. **Corregido el 13/10:** las notas de la personal salen con la fecha que manda el cliente, así que el día corrido viene de H1 y no del servidor. Lo que sí es del servidor: el mes actual de `obtenerAcumulado` y el 30/04 del ICL (`'GMT-3'` fijo en `Indices.js`, ver 2.14) |
| H1 | 3 usos en `Web.html` | También en `Panel.html:250` (la barra lateral de la planilla) |
| C1, idempotencia | Gastos, servicios e ingresos | **También `guardarMovimientoPersonal`**: pasa por el mismo watchdog, **no tiene lock** y **suma** sobre la celda. Un reintento ahí no agrega una fila: infla un total |
| G2, eliminar el recordatorio | Borrar los disparadores a mano después | El orden importa: hay que borrarlos **antes** de instalar v12. Si v12 entra sin `revisarActividad` y un disparador sigue vivo, falla todos los días a las 20 h y Google le manda un mail de error a su dueño. Se borran a mano, cada uno en su cuenta (issue 2.8) |
| Producción | Una sola | **Dos** (ver `CLAUDE.md`, "Despliegue con clasp"): `clasp push` cambia al instante la barra lateral, las funciones personalizadas y los disparadores. La web app del celular solo cambia con `clasp deploy` |

## Convenciones

- Git sigue `mateware-github`. `main` es lo instalado; `develop` es la
  integración (no se llama `dev` porque git no permite una rama `dev` y
  ramas `dev/...` a la vez); las ramas son `dev/<categoría>/<módulo>/<issue>-<descripción>`;
  los PR van a `develop` por squash, con título `Tipo(scope): descripción`. El
  merge `develop` → `main` se hace al instalar, con tag `vNN` (v12, v13...), que
  sigue la numeración que ya traían los archivos.
- **Labels**: `type:fix`, `type:feat`, `type:refactor`, `type:chore`, `type:test`,
  `type:docs`; `etapa:0` a `etapa:5`; `ejecuta:claude`, `ejecuta:gemini`,
  `ejecuta:marcos`; `toca-produccion` (necesita confirmación de Marcos antes de
  `clasp push`/`deploy` o de cambiar datos); `bloqueado`.
- Cada issue lleva: qué pasa, criterio de aceptación verificable (casi siempre
  una prueba en `pruebas/` que hoy falla y tiene que pasar) y de qué depende.
- Instalación de cada versión: totales de control antes → `clasp push` → probar
  en la URL `/dev` (y en el teléfono si hay cambios de UI) → `clasp deploy` →
  totales de control después. Si algo sale mal: redesplegar la versión anterior.

## Etapas

`#` es el número del plan; cada issue lo lleva entre corchetes al principio
del título (`[2.4] ...`). **Ejecuta** dice quién escribe el
código; Claude revisa y verifica todo lo que hace Gemini.

### Etapa 0 — Base para trabajar sin tocar producción

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 0.1 | Subir el repo a GitHub, crear `develop`, labels y plantillas de issue/PR | chore | claude | — | `main` y `develop` en el remoto; labels creadas |
| 0.2 | Arnés de pruebas: cargar el `.js` real de `apps-script/` en Node con `vm` y stubs mínimos (`SpreadsheetApp`, `LockService`, `CacheService`, `Utilities`, `Session`) | test | **gemini** | 0.1 | `node --test` corre; `aFecha`/`aNumero` salen del código real, no de una copia |
| 0.3 | Pasar las 5 pruebas a `node:test` con `assert` del comportamiento **correcto** | test | **gemini** | 0.2 | Las 5 corren y **fallan** contra v9 (bug presente); el mensaje de cada falla nombra el hallazgo (A1, C1...) |

### Etapa 1 — Urgente en producción (no espera a v12)

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 1.1 | **D-c: el ICL da `#ERROR!` porque el BCRA dio de baja la API v3.** Migrar `Indices.js` a v4 (paginación, `detalle[]`). **Fecha límite: 01/11/2026** | fix | claude | 0.2 | Prueba con una respuesta v4 grabada; después del push, `Alquiler!B14` muestra un porcentaje (leído con el MCP). `toca-produccion` |
| 1.2 | Zona horaria del proyecto y de la planilla en `America/Argentina/Mendoza`, **las dos juntas** | fix | marcos + claude | 1.5 | Fechas de muestra de Gastos y Pagos servicios iguales antes y después; totales de control iguales. `toca-produccion` |
| 1.3 | D-a: corregir la fecha 01/01/1970 de Pagos servicios | fix | marcos | — | Marcos confirma la fecha real. Los totales no cambian (Servicios suma por Mes) |
| 1.4 | D-b: confirmar si el alquiler de septiembre fue $600.000 | chore | marcos | — | Decisión registrada en el issue. Si se corrige, los totales nuevos quedan documentados en el traspaso |
| 1.5 | Las pruebas no modelan la zona horaria de producción: el doble de planilla respeta la zona y las pruebas de fechas corren en `UTC` y en Mendoza | test | **gemini** | — | Mutación: si `formatDate` ignora la zona, falla una prueba |

1.2 va separado de v12 porque cambia cómo se interpretan las fechas en todo el
proyecto: si se cambia solo el script o solo la planilla, cada fecha nueva se
corre un día. Se cambian las dos en el mismo momento y se verifica con datos.

### Etapa 2 — v12: Fase 1 corregida

Arranca copiando `referencia/Codigo_v11.gs` y `Web_v9.html` sobre
`apps-script/` en un commit propio ("base v11, sin arreglos"), para que cada
arreglo se vea como un diff limpio.

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 2.1 | Base v11 + Web_v9 en `apps-script/` | chore | claude | 0.3 | `clasp show-file-status` lista los mismos 6 archivos |
| 2.2 | **A1**: `aFecha` rechaza fechas inválidas e inexistentes | fix | **gemini** | 2.1 | Prueba A1 pasa: `""`, `undefined`, `"10/08/2026"` y `"2026-13-45"` tiran error |
| 2.3 | **A2 + M1**: si la verificación falla, restaurar la celda o borrar la fila antes de tirar el error | fix | claude | 2.1 | Pruebas nuevas con stubs: después del error la celda o la hoja quedan como antes |
| 2.4 | **C1**: clave de idempotencia por envío, chequeada dentro del lock, en los **4** guardados (incluido `guardarMovimientoPersonal`, que hoy no tiene lock); mensaje "No sé si se guardó. Reintentar no duplica."; 45 s si hay adjunto | fix | claude | 2.3 | Prueba C1: el reintento con la misma clave escribe 1 fila; en la personal suma una sola vez |
| 2.5 | **H1**: fechas locales en `Web.html` (3 usos) y `Panel.html:250` | fix | **gemini** | 2.1 | Prueba H1 pasa con `TZ=America/Argentina/Mendoza` a las 21:00, 22:30 y 23:59. No queda ningún `toISOString().slice(0, 10)` |
| 2.6 | **H2**: si hubo adjunto y falló la lectura (más de 8 MB u `onerror`), cortar y no guardar | fix | **gemini** | 2.1 | Prueba H2: con 9 MB no se llama al servidor y el error queda en pantalla |
| 2.7 | **H3 + M2**: el borrador guarda selectores y fechas y se restaura después de `aplicarMiNombre()`; avisa que el comprobante se pierde; botón "Recargar" en vez de `location.reload()` | fix | claude | 2.4 | Prueba H3: vuelve "pagó Flor" |
| 2.8 | **G2**: Marcos y Flor borran a mano, cada uno con su cuenta, el disparador `revisarActividad` en script.google.com/home/triggers | chore | marcos (+ Flor) | — | Los dos confirman que en su lista no queda ningún disparador de este proyecto |
| 2.9 | **B2 + B4**: sacar "Ajuste" de las categorías elegibles a mano de la personal; sacar `maximum-scale=1` | fix | claude | 2.1 | Revisión de diff |
| 2.10 | Instalar v12 | chore | marcos + claude | 2.2–2.9, 2.11–2.18 | Push → prueba en `/dev` (gasto, gasto, personal, servicio) → deploy → totales iguales. Tag `v12`. `toca-produccion`. **Instalado el 16/10/2026** (versión 7) |

Agregados el 13/10/2026 después de la revisión de Claude Desktop
(`revision-claude-desktop/`). Van en v12 porque el `clasp push` los expone o
porque tocan el mismo contrato de `idEnvio`:

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 2.11 | **C1-red**: el `idEnvio` se libera solo si el servidor contestó **bien** (cambia la regla de 2.4) | fix | claude | — | Prueba de punta a punta: falla de red después de escribir → el reintento no duplica |
| 2.12 | Conciliación por `llamar()`, con `idEnvio` hasta `guardarGasto`/`guardarMovimientoPersonal` | fix | claude | 2.11 | El mismo ajuste dos veces escribe una vez, por los dos destinos |
| 2.13 | Panel lateral: servicio con fecha y quién pagó; nombre preseleccionado | fix | **gemini** | — | `guardarServicio` real acepta lo que manda el panel |
| 2.14 | ICL: búsqueda exacta por descripción; fechas en la zona **de la planilla** | fix | claude | — | Variable con "ciclo" no confunde; después del push `B14` lee desde `2026-05-01` |
| 2.15 | "Ya estaba guardado" cuando el servidor descarta un duplicado | feat | claude | — | El duplicado responde distinto y escribe una vez |
| 2.16 | Enter en el monto solo cierra el teclado (se saca el salto; **G4 queda sin efecto**) | fix | claude | — | No mueve el foco ni llama a `showPicker` |
| 2.17 | Tocar el campo de fecha abre el calendario nativo | fix | claude | — | Confirmado en el teléfono |
| 2.18 | Comprobantes con la fecha del movimiento en el nombre | feat | claude | — | `AAAA-MM-DD <detalle> - <archivo>`; fecha validada antes de crear el archivo |

2.16 a 2.18 salieron de la prueba de Marcos en `/dev` del 13/10/2026.
Decisiones de esa prueba que no llevan issue:

- **Detalle del encabezado:** "Gastos del mes" sigue mostrando el TOTAL GASTOS
  DEL MES del Resumen. Se revisa más adelante.
- **Meses del servicio:** el desplegable muestra solo los meses que tiene la
  hoja Servicios (junio a diciembre de 2026). Es correcto: un mes sin columna
  no se sumaría en ningún lado. El cambio de año (2027) se plantea cuando
  haga falta.

Agregados el 14/10/2026 en la auditoría de v12 (#67), después de que la prueba
en `/dev` se colgara (#66):

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 2.19 | En `/dev` la pantalla queda en "Guardando": el `textContent` del label borraba el input del comprobante (#72) | fix | claude | — | Gasto, gasto, personal, servicio sin trabas en `/dev` |
| 2.20 | Auditoría de v12 contra lo instalado | chore | claude | — | Cada hallazgo con issue propio o descartado |
| 2.21 | **E1 + E2**: lo que falla después de la escritura verificada no hace fallar el guardado; la personal suma montos guardados como texto | fix | **gemini 4** | 2.20 | El reintento no duplica; "1500" + 8000 = 9500 |
| 2.22 | Sacar el borrador y el botón Recargar (E3, E5; H3 y M2 dejan de aplicar) | fix | **gemini 4** | 2.20 | Solo los cortes de espera cuentan como fallas |
| 2.23 | `waitLock` a 10 s, antes del corte de 15 s del cliente (E4) | fix | claude | 2.20 | Sin lock: error claro, no escribe |
| 2.24 | Limpieza: comentarios, un manejador de error, `fechaLocal`, acumulado, `permitirNegativo` en el servidor | refactor | **gemini 4** | 2.20 | `guardarGasto` desde el cliente rechaza negativos |

Fuera de v12: **2.25 (#73)**, subir el comprobante directo del navegador a
Drive. Decisión de Marcos del 16/10; queda para después de v12.

### Etapa 3 — Fase 2: servicios 50/50 y transferencias

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 3.1 | **D1**: columna División en Pagos servicios (los pagos existentes pasan a "50/50"); filas Parte Marcos / Parte Flor en Servicios (D2 ya está en Web_v9) | feat | claude | 2.10 | Marcos aprueba el cambio de estructura antes de aplicarlo; totales de control iguales |
| 3.2 | **D3**: hoja Transferencias (fecha, de, para, monto, descripción) y formulario en la app. **Sin** cálculo de quién le debe a quién | feat | claude (servidor) + gemini (formulario) | 2.10 | Prueba de `guardarTransferencia` con idempotencia (reusa 2.4) |
| 3.5 | Aviso cuando los dos cargan la misma compra (mismo monto, fecha y categoría, otra persona) | feat | claude | 2.10 | Avisa y deja confirmar. **Congelado** (fuera de v13) |
| 3.3 | Instalar v13 | chore | marcos + claude | 1.2, 3.1, 3.2, 1.3, 1.4 | Igual que 2.10, con una transferencia en la prueba de `/dev`. `toca-produccion` |

**Alcance de v13** (decisión de Marcos, 16/10/2026): 1.2, 3.1 y 3.2, en el
milestone `v13`. 3.4 (`estadoEnvio`, #49) se **descartó**: con v12 los
guardados tardan menos de 5 s y el lock corta a 10 s, así que el caso es muy
raro. 3.5 (#50) y #73 (comprobante directo a Drive) quedan congelados. Qué
etapa grande va después (4 o 5) se decide cuando v13 esté instalada.

### Etapa 4 — Fase 3: personal por filas (P1)

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 4.1 | Parser de notas `dd/MM: descripción $monto` (una por línea), con montos en regla argentina vía `aNumero` | feat | **gemini** | 2.10 | Pruebas con notas reales sacadas de la copia de Marcos, incluidas líneas que no matchean (se reportan, no se descartan) |
| 4.2 | Hoja Movimientos + grilla con SUMIFS | feat | claude | 4.1 | En la copia: la grilla nueva da lo mismo que la vieja, celda por celda |
| 4.3 | Botón de migración en la app, con **modo simulación** que muestra el informe sin tocar nada; verifica y fija la zona horaria de la planilla personal | feat | claude | 4.1, 4.2 | Simulación sobre la copia de Marcos: diferencia 0 en cada celda (filas 5–32 de Gastos, 5–20 de Ingresos, 5–24 de Ahorros) |
| 4.4 | Migración real: primero Marcos, después Flor con su propia cuenta | chore | marcos (+ Flor) | 4.3 | Informe de cada uno archivado en el issue. `toca-produccion` |

Las notas cargadas **antes de v12** pueden tener el día corrido si se cargaron
después de las 21 h (H1): la nota **y la columna**. El parser no puede saberlo.
La migración conserva el mes de la columna para que los totales cuadren, y el
informe marca esas notas como "fecha no confiable" en vez de presentarlas como
correctas. Además, cada planilla personal tiene la zona de la cuenta que la
creó: la migración la verifica y la fija (4.3).

### Etapa 5 — Fase 4: tarjetas y cuotas (P2)

| # | Issue | Tipo | Ejecuta | Depende | Criterio de aceptación |
|---|---|---|---|---|---|
| 5.1 | `primeraCuota(fechaCompra, cierre, vencimiento)` | feat | **gemini** | 2.10 | Pasan los 4 casos de la tabla del traspaso, más fin de año y febrero |
| 5.2 | Backend: tarjetas (nombre, empresa, banco, cierre, vencimiento; **nunca** el número) y compras en cuotas en la personal del dueño y en la compartida. En USD se carga la **tasa a la que se consiguieron los dólares** | feat | claude | 5.1 | Las filas "Cuotas del mes" y "Puso Marcos/Flor" del Resumen dan lo esperado con un caso de prueba en la copia |
| 5.3 | Formulario de compra en cuotas; muestra **solo las tarjetas de quien paga** | feat | **gemini** | 5.2 | Revisión + prueba en `/dev` |
| 5.5 | Suscripciones (mensual, con tarjeta, hasta la baja) y compra única (= 1 cuota) | feat | claude | 5.1, 5.2 | Alta, cargo en el mes según cierre, baja |
| 5.4 | Instalar v14 | chore | marcos + claude | 5.2, 5.3, 5.5 | Igual que 2.10. `toca-produccion` |

### Fuera de este plan

- **B1** (`"15.250"` = 15.250 pesos): acordado, no se toca.
- **B3** (comprobantes con link público): diferido por la decisión G3.
- **Escanear tickets**: pedido original, **descartado** el 13/10/2026 por la
  dificultad de implementarlo.
- **`Finanzas.js`**: la librería también llama a la API v3 del BCRA (`bcra()`,
  `bcraVariables()`), así que esas funciones están rotas. Ninguna fórmula
  nuestra las usa; si alguna vez hacen falta, se actualiza la librería
  completa, no se parchea.

## Delegación a Gemini

Se siguen las reglas de la skill `gestion-agentes-gemini`. Lo propio de este
repo:

**Qué se delega.** Solo issues con `ejecuta:gemini`: lógica pura o de UI acotada,
con una prueba en `pruebas/` que ya existe y hoy falla. Lo que exige criterio
(idempotencia, migración, cambios de estructura de la planilla) lo hace Claude.
Un issue que falla dos veces delegado pasa a `ejecuta:claude` (escalación 7.4
de la skill).

**Workspace.** El agente no ve el repo. Claude copia a una carpeta de salida
fuera del repo (`~/agy-trabajo/gastos/<issue>/`) solo el archivo que hay que
modificar, la prueba y el arnés de `pruebas/`. Nunca `referencia/`, el
traspaso ni `.clasp.json`.

**Lanzamiento.**

```
bash ~/.claude/skills/gestion-agentes-gemini/scripts/agy-run.sh issue<N> ~/agy-trabajo/gastos/prompt-<N>.txt ~/agy-trabajo/gastos/<N> "Gemini 4 Argon (High)"
```

El modelo va explícito: el default del lanzador ("Gemini 3.1 Pro (High)") ya no
existe en `agy`. Desde agy 1.4.0 (16/10/2026) se usa **Gemini 4 Argon (High)**:
hizo #68, #69 y #71 sin correcciones, con las pruebas escritas antes por Claude.
Con
`run_in_background`; el progreso se sigue en `<issue>.log`.

**Bloque de herramientas** (al principio de cada prompt):

```
HERRAMIENTAS (ya instaladas y verificadas; usá solo estas, con estos comandos):
- Pruebas: `node --test 'pruebas/*.test.js'` desde la raíz (Node 22, sin
  dependencias). Es la única forma de verificar tu trabajo; pegá la salida completa en tu respuesta.
- Archivos: leé con tu herramienta de lectura; escribí solo en esta carpeta.
- RAM: tenés 1 GB; esta tarea no necesita más.

PROHIBIDO:
- Instalar software (npm, npx, pip, apt) o agregar un package.json.
- Ejecutar clasp o cualquier comando que hable con Google.
- Acceder a la red.
- Modificar las pruebas para que pasen. Si una prueba te parece mal, detenete
  y explicalo.
- Dejar procesos en segundo plano.
```

**Prompt.** Los seis bloques de la skill (contexto, tarea, fuente, formato,
restricciones, verificación). La tarea es el texto del issue; la fuente, los
archivos copiados con números de línea; el formato, el archivo modificado y la
salida de `node --test`. Las restricciones estándar de la skill se copian
textuales.

**Verificación de Claude, siempre, antes de abrir el PR:**

1. Copiar el archivo devuelto a la rama del issue y correr `node --test 'pruebas/*.test.js'` en el repo: tiene que pasar todo, no solo la prueba del issue.
2. `git diff`: ningún cambio fuera de lo que pide el issue (Gemini tiende a
   "mejorar" lo que no se le pidió).
3. Comprobar que no se tocaron las pruebas.
4. `grep -o '"tool_name":"[^"]*"' <issue>.jsonl | sort | uniq -c`: que haya
   corrido `node --test` de verdad.
5. Dejar en el PR qué se verificó.
