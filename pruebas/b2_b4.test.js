// B2: "Ajuste" solo lo carga la conciliación, no se elige a mano.
// B4: maximum-scale=1 desactiva el zoom en el celular (accesibilidad).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');

test('B2: las categorías personales elegibles a mano no incluyen "Ajuste"', () => {
  const ctx = cargarServidor();
  const personales = ctx.categoriasPersonales();
  for (const hoja of Object.keys(ctx.PERSONAL)) {
    assert.ok(personales[hoja].length > 0, hoja);
    assert.ok(!personales[hoja].includes('Ajuste'), hoja);
  }
});

test('CONTROL: "Ajuste" sigue existiendo en la estructura de la personal', () => {
  const ctx = cargarServidor();
  const todas = ctx.PERSONAL.Gastos.secciones.flatMap(s => s[1]);
  assert.ok(todas.includes('Ajuste'));
});

test('B4: el viewport de la web app deja hacer zoom', () => {
  const metas = [];
  const salida = {
    setTitle: () => salida,
    addMetaTag: (nombre, contenido) => { metas.push([nombre, contenido]); return salida; },
    setXFrameOptionsMode: () => salida
  };
  const ctx = cargarServidor(['Código.js'], {
    HtmlService: { createHtmlOutputFromFile: () => salida, XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' } }
  });
  ctx.doGet();
  const viewport = metas.find(m => m[0] === 'viewport');
  assert.ok(viewport, 'falta el meta viewport');
  assert.doesNotMatch(viewport[1], /maximum-scale|user-scalable=no/);
});
