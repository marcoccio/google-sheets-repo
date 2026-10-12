# Gastos depto

Web app de Apps Script y planillas de finanzas del hogar. El contexto completo
está en `TRASPASO_claude_code.md`, el plan en `PLAN.md` y las reglas para
trabajar en `CLAUDE.md`.

## Pruebas

```bash
node --test                               # todas
node --test pruebas/c1_servidor.test.js   # un archivo
```

Node 22, sin dependencias. `pruebas/arnes.js` carga el código **real** de
`apps-script/` en `node:vm`; `pruebas/planilla_falsa.js` simula los servicios
de Google del lado del servidor.

Cada prueba que reproduce un bug lleva el código del hallazgo en el nombre
(`A1: ...`, `C1: ...`) y **falla hasta que se arregla**. Las que empiezan con
`CONTROL` tienen que pasar siempre.

| Archivo | Hallazgos |
|---|---|
| `a1_fechas.test.js` | A1, y `aNumero` como control |
| `h1_zona_horaria.test.js` | H1 (fija `TZ=America/Argentina/Mendoza` sola) |
| `h2_adjunto.test.js` | H2 |
| `c1_servidor.test.js` | C1 del lado del servidor |
| `cliente_watchdog.test.js` | C1 del lado del cliente, M2, H3 |
| `indices.test.js` | D-c (ICL en la API v4) |

Las pruebas del cliente simulan el navegador: no reemplazan probar en el
teléfono.
