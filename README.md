# Gastos depto

Web app de Apps Script y planillas de finanzas del hogar. El contexto completo
está en `TRASPASO_claude_code.md`, el plan en `PLAN.md` y las reglas para
trabajar en `CLAUDE.md`.

## Pruebas

```bash
node --test 'pruebas/*.test.js'           # todas
node --test pruebas/c1_servidor.test.js   # un archivo
```

Node 22, sin dependencias. `pruebas/arnes.js` carga el código **real** de
`apps-script/` en `node:vm`; `pruebas/planilla_falsa.js` simula los servicios
de Google del lado del servidor.

Cada prueba que reproduce un bug lleva el código del hallazgo en el nombre
(`A1: ...`, `C1: ...`) y **falla hasta que se arregla**. Las que empiezan con
`CONTROL` tienen que pasar siempre.

| Archivo | Qué cubre |
|---|---|
| `arnes.test.js` | El arnés mismo |
| `a1_fechas.test.js` | A1, y `aNumero` como control |
| `a2_m1_verificacion.test.js` | A2 + M1: si la relectura falla, la planilla queda como antes |
| `b2_b4.test.js` | B2 (Ajuste no se elige a mano), B4 (zoom) |
| `c1_servidor.test.js` | C1 del lado del servidor, "Ya estaba guardado" (#48) |
| `c1_red.test.js` | C1 con corte de red después de escribir (#44) |
| `cliente_watchdog.test.js` | C1 del lado del cliente, cortes de espera (E3, #69) |
| `lock_70.test.js` | Espera del lock de 10 s (#70) |
| `e1_e2_68.test.js` | Fallas después de escribir; montos como texto (#68) |
| `h1_zona_horaria.test.js` | H1 (fija `TZ=America/Argentina/Mendoza` sola) |
| `h2_adjunto.test.js` | H2 |
| `zona_servidor.test.js` | La planilla falsa respeta la zona |
| `zona_1_2.test.js` | 1.2: el manifiesto en `America/Argentina/Mendoza` |
| `indices.test.js` | ICL en la API v4, fechas en la zona de la planilla (#47) |
| `icl_falso_positivo.test.js` | El ICL no se confunde con "ciclo" (#47) |
| `conciliacion.test.js` | Ajuste por `llamar()` con idEnvio (#45) |
| `enter.test.js` | Enter en el monto (#59) |
| `fecha_calendario.test.js` | El campo de fecha abre el calendario (#60) |
| `comprobante.test.js` | Fecha en el nombre del comprobante (#61) |
| `adjunto_label.test.js` | El input del comprobante no se borra (#66) |
| `limpieza_71.test.js` | Acumulado y negativos (#71) |
| `d1_servicios.test.js` | División de los servicios (D1, #18) |
| `d3_transferencias.test.js` | Transferencias (D3, #19) |
| `navegacion.test.js` | Secciones de la app y link a la planilla |

Las pruebas del cliente simulan el navegador: no reemplazan probar en el
teléfono.
