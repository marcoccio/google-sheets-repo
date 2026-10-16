// Origen: revision de Claude Desktop del 13/10/2026 (#47).
// D-c bis: idVariableICL no tiene que confundir otra variable con el ICL.
// Hoy busca la subcadena "icl", que también aparece en "ciclo".
// Falla hasta que la búsqueda sea exacta.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');

test('D-c bis: una variable con "ciclo" antes del ICL no se toma por el ICL', () => {
  const listado = { metadata: { resultset: { count: 2 } }, results: [
    { idVariable: 7,  descripcion: 'Tasa de interés de préstamos personales (promedio del ciclo)' },
    { idVariable: 40, descripcion: 'Índice para Contratos de Locación (ICL-Ley 27.551)' } ] };
  const cache = {};
  const ctx = cargarServidor(['Indices.js'], {
    UrlFetchApp: { fetch: () => ({ getContentText: () => JSON.stringify(listado) }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) }
  });
  assert.equal(ctx.idVariableICL(), 40, 'D-c bis: se tomó otra variable por el ICL');
});
