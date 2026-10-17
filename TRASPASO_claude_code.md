# Traspaso a Claude Code — Gastos depto (Marcos y Flor)

Pegá este archivo en la primera sesión de Claude Code, junto con la carpeta
`pruebas/`.

---

## 0. Lo primero que hay que hacer

1. **Bajar el código desplegado con clasp** y guardarlo en git como primer
   commit, **sin modificar nada**.
2. **Compararlo** contra `Codigo_v9.gs` y `Web_v8.html`. Toda la revisión de
   abajo asume que eso es lo desplegado, pero nunca se pudo verificar. Si hay
   diferencias, la revisión puede estar incompleta.
3. Correr las pruebas de `pruebas/` contra el código real.

**Regla general:** no se modifica ningún dato de la planilla sin confirmación
explícita de Marcos.

---

## 1. Qué es el proyecto

Sistema de finanzas de una pareja que vive junta en Mendoza. Tres partes:

1. **Planilla compartida "Gastos depto"** — gastos del hogar, la ven los dos.
2. **Web app en Apps Script** — carga desde el celular. Publicada como
   *Ejecutar como: usuario que accede* + *Cualquier usuario con cuenta de
   Google*. Así cada uno escribe con su cuenta.
3. **Planilla "Finanzas personales"** — una por persona, privada, la crea la app
   en el Drive de cada uno.

Gastos divididos 50/50 desde agosto 2026. Flor es vegana y celíaca: algunas
comidas no se dividen.

---

## 2. IDs y datos fijos

| Qué | ID |
|---|---|
| Planilla compartida | `1Q0cVQKTsfpsR3cZ7_OCCpGE2ur23AAbbTKXZhXys9Ag` |
| Respaldo de la compartida | `1IQvYy8KO2dW5sSecPAH5cR6AlY001F6l_tPmgJRGOyE` |
| Respaldo de la personal de Marcos | `1a4tzW6qFWIVDjhGXZyD7b5mau5ZcxvJxho2U2Z5YzYc` |

Hojas de la compartida (sheetId):

| Hoja | sheetId | Nota |
|---|---|---|
| Gastos | 0 | Una fila por gasto. H/I con ARRAYFORMULA |
| Servicios | 1383057097 | **Grilla calculada** con SUMIFS desde Pagos servicios. No escribir encima |
| Resumen | 1415306215 | El código lo lee **por etiqueta**, no por número de fila |
| Gastos diarios | 858890175 | Vista QUERY, no se escribe |
| Listas | 367536799 | Oculta. Rangos con nombre para los desplegables |
| Ingresos | 1657384976 | Vacía |
| Alquiler | 1548067557 | Proyección IPC/ICL |
| Pagos servicios | 1039886389 | Un pago por fila, con quién pagó |
| Transferencias | 1569968795 | Creada el 16/10/2026 (D3, #19): Fecha, De, Para, Monto, Descripción. Solo registro, sin cálculo de deudas |
| Tarjetas | 1409396207 | Vacía, para la Fase 4 |
| Compras en cuotas | 773169151 | Vacía, para la Fase 4 |

**Trampa de configuración regional:** la planilla está en español, así que las
fórmulas usan `;` como separador, no `,`. Una fórmula con comas da `#ERROR!`.

**Alquiler:** contrato desde 01/05/2026, $600.000, se actualiza cada 6 meses
por el peor entre IPC e ICL. **Próxima actualización: 01/11/2026.**

### Totales de control

Verificados el 11/10/2026. Cualquier cambio de código o de estructura tiene
que dejarlos iguales:

| Concepto | Valor |
|---|---|
| Servicios, total | $3.359.110 |
| Gastos diarios, total | $727.178 |
| TOTAL GASTOS | $4.086.288 |
| Acumulado Marcos | $2.912.008 |
| Acumulado Flor | $1.174.280 |

---

## 3. Estado del código

| Archivo | Estado |
|---|---|
| `Codigo_v9.gs` + `Web_v8.html` | **Desplegado** (supuesto, sin verificar) |
| `Codigo_v11.gs` + `Web_v9.html` | Fase 1. **Nunca instalada. No instalar tal cual** |
| `Indices.gs` | Funciones IPC/ICL para la hoja Alquiler |
| Código de cuotas (Fase 4) | **Se perdió.** Nunca se entregó; hay que reescribirlo |

---

## 4. Hallazgos de la revisión

Todo verificado ejecutando código, no por lectura. Las pruebas están en
`pruebas/`.

### CRÍTICO

**C1 — El watchdog de la Fase 1 duplica gastos.** *(Web_v9, sin instalar)*
Si el servidor tarda más de 15 s, la app dice "probá de nuevo", pero el servidor
sigue y escribe. El reintento duplica. Pasa con cargas lentas pero exitosas, y
subir un comprobante es lo que las vuelve lentas.
*Prueba:* `test_watchdog_duplica.js` → 2 filas.
*Arreglo:* clave de idempotencia por envío, reusada en el reintento. El
servidor la chequea dentro del lock (CacheService) y, si ya la procesó,
devuelve el resultado anterior sin escribir. Mensaje: "No sé si se guardó.
Reintentar no duplica". Límite de 45 s si hay adjunto.

### ALTO

**A1 — El servidor acepta fechas inválidas.** *(Desplegado)*
`aFecha("")` da fecha inválida y se guarda igual. `aFecha("2026-13-45")` da
14/02/2027 sin error.
*Evidencia en los datos:* Pagos servicios tiene una fila con fecha
**01/01/1970** (Cooperativa Eléctrica, agosto, $102.900). Los totales no se
afectan porque Servicios suma por la columna Mes.
*Arreglo:* validar `AAAA-MM-DD` y comprobar que la fecha armada devuelva el
mismo día, mes y año.

**A2 — `escribirYVerificar` miente y deja la celda corrupta.** *(Fase 1)*
Dice "no se guardó nada" después de haber escrito. En la personal las celdas
acumulan, así que un reintento suma sobre el valor malo.
*Arreglo:* restaurar el valor anterior antes de lanzar el error.

**H1 — Después de las 21 h la app pone la fecha de mañana.** *(Desplegado)*
`new Date().toISOString().slice(0,10)` devuelve UTC. Argentina es UTC-3. Un
gasto cargado a las 22 h del último día del mes cae en el mes siguiente.
*Prueba:* `TZ=America/Argentina/Mendoza node test_zona_horaria.js`.
*Arreglo:* armar la fecha con `getFullYear()`, `getMonth()` y `getDate()`
locales. Hay 3 usos de `toISOString` en el HTML.

**H2 — Un comprobante de más de 8 MB se descarta en silencio.** *(Desplegado)*
`leerArchivo` muestra el error y devuelve `null`. El llamador lo toma como "sin
adjunto", guarda igual, y "Gasto cargado" tapa el error. `lector.onerror` hace
lo mismo.
*Prueba:* `test_adjunto_descartado.js`.
*Arreglo:* si hubo adjunto y falló la lectura, **cortar la carga** y no
guardar.

### MEDIO

**M1 — La verificación de fila deja la fila escrita.** *(Fase 1)*
En guardarGasto/Servicio/Ingreso, si la relectura falla se lanza el error pero
la fila queda. Reintento = duplicado.
*Arreglo:* borrar la fila recién escrita antes del error. Se resuelve junto
con C1.

**M2 — Recarga automática dentro del iframe de Apps Script.** *(Fase 1)*
`location.reload()` desde un temporizador, en un iframe con sandbox. **No
verificado** cómo se comporta sin acción del usuario.
*Arreglo:* reemplazar por un botón "Recargar".

**H3 — Recuperar el borrador resetea quién pagó.** *(Fase 1)*
El borrador guarda montos y descripciones, no los selectores. Después,
`iniciar()` → `aplicarMiNombre()` pone "pagó" en el usuario actual. Si Marcos
cargaba un gasto que pagó Flor, vuelve el monto pero con "pagó Marcos".
*Prueba:* `test_borrador_pagador.js`.
*Arreglo:* guardar también los selectores y las fechas, y restaurarlos
**después** de `aplicarMiNombre()`. El comprobante no se puede restaurar;
avisarlo.

### BAJO

- **B1** — `"15.250"` se interpreta como 15.250 pesos (regla argentina,
  acordada).
- **B2** — "Ajuste" aparece como categoría elegible a mano en la personal.
- **B3** — Comprobantes con link público. Diferido por decisión (G3).
- **B4** — `maximum-scale=1` en el viewport desactiva el zoom. Accesibilidad.

### Sin verificar (hay que probar en el teléfono)

- Que Enter dispare `keydown` en el teclado de Android y que `showPicker()`
  abra el menú después del `blur()` + 60 ms.
- El comportamiento real de M2.

### Verificado bien

Diff v9→v11 limpio. Etiquetas del Resumen coinciden con la planilla. Todas las
hojas existen. `aNumero` 9/9 con el código real. Regex de `fechaDe` correcta.
Sin inyección: todo dato del servidor se muestra con `textContent`.

---

## 5. Problemas en los datos (pendientes de confirmación)

**D-a. Fecha 01/01/1970** en Pagos servicios (ver A1). Corregir la fecha.

**D-b. Alquiler de septiembre en $950.000.** Pagos servicios tiene en
septiembre: $600.000 Marcos + $300.000 Flor + $50.000 Flor. Probablemente
reintegros de Flor cargados como pago de alquiler (el caso que motiva las
Transferencias). **Marcos tiene que confirmar** si el alquiler fue $600.000
antes de tocar nada. Si se corrige, los totales de control cambian a
propósito: documentar los nuevos.

**D-c. El ICL da `#ERROR!`** en la hoja Alquiler (IPC sí anda: 8,03%). Arrastra
el error a la proyección. Causa sin diagnosticar: hace falta el texto del error
de la celda. Tiene fecha límite: 01/11.

---

## 6. Decisiones ya tomadas

| Punto | Decisión |
|---|---|
| G1 refrescar | Watchdog, **con idempotencia** (ver C1) |
| G2 recordatorio | **Eliminar.** Después borrar los disparadores a mano en script.google.com/home/triggers, cada uno con su cuenta |
| G3 compartir desde Android | No en esta iteración |
| G4 Enter | Sí, con `showPicker()` (usan Chrome actualizado) |
| D1 servicios 50/50 | Columna División en Pagos servicios; los pagos existentes pasan a "50/50"; filas Parte Marcos / Parte Flor en Servicios |
| D2 desplegable | Solo total de servicios y total de gastos del mes |
| D3 transferencias | Hoja Transferencias (fecha, de, para, monto, descripción). **Sin** cálculo de quién le debe a quién, en ningún lado |
| P1 personal por filas | Hoja Movimientos + grilla con SUMIFS. Migrar parseando notas, **primero en una copia**, comparar totales celda por celda |
| P2 tarjetas | Compra compartida con tarjeta: va a la personal **del dueño de la tarjeta** y a la compartida como pagada por él. **Cuota completa en ambas.** Datos: cuotas, interés, moneda, descripción |
| P3 validación | Normalizar el monto en el servidor y releer la celda |

---

## 7. Orden de trabajo

1. **clasp clone** + commit inicial + comparar contra v9/v8.
2. **Fase 1 corregida (v12):** Fase 1 + C1, A1, A2, M1, M2, H1, H2, H3.
   Las pruebas de `pruebas/` tienen que pasar a mostrar el comportamiento
   correcto. Instalar y verificar los totales de control.
3. **Fase 2:** D1 y D3. Resolver D-a y D-b con confirmación.
4. **Fase 3 (P1):** migración de la personal como **botón dentro de la app**,
   con modo simulación que muestra el informe sin tocar nada.
5. **Fase 4 (P2):** tarjetas y cuotas. Reescribir el backend.

D-c (ICL) se puede hacer en paralelo, cuando llegue el texto del error.

---

## 8. Restricciones importantes

**Privacidad de las planillas personales.** No compartir la planilla de Flor
con la cuenta de servicio del MCP: la clave está en la PC de Marcos, así que
equivaldría a darle acceso a él. Por eso la migración (Fase 3) tiene que ser
un botón de la app que cada uno corre con su propia cuenta. Para desarrollarla,
usar la copia de Marcos.

**Estructura de la planilla personal** (la usa la migración):

- Columnas B a M = enero a diciembre, N = total.
- Fila 1: fechas de fin de mes. Fila 2: IPC.
- **Gastos:** fijos en filas 5–12, variables 16–21, únicos 25–29, TOTAL fila 32.
- **Ingresos:** fijos 5–7, variables 11–17, TOTAL fila 20.
- **Ahorros:** pesos 5–8, dólares 12–14, inversiones 18–21, TOTAL fila 24.
- Las notas de celda tienen el formato `dd/MM: descripción $monto`, una por
  línea.

**Ciclo de tarjeta** (para reescribir la Fase 4). Regla ya probada:

- Si el día de compra es mayor que el de cierre, pasa al mes siguiente.
- Si el vencimiento cae antes que el cierre, se paga un mes después.

| Compra | Cierre | Vence | 1.ª cuota |
|---|---|---|---|
| 20/08/2026 | 25 | 10 | Sep 2026 |
| 28/08/2026 | 25 | 10 | Oct 2026 |
| 05/08/2026 | 25 | 28 | Ago 2026 |
| 30/12/2026 | 25 | 10 | Feb 2027 |

El Resumen ya tiene la fila "Cuotas del mes" (en cero) y las fórmulas de "Puso
Marcos/Flor" ya suman las cuotas por pagador. Solo falta el código.

**Nunca guardar números de tarjeta.** Nombre, empresa, banco, cierre y
vencimiento alcanzan.
