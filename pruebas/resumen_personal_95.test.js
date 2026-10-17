// #95: la lista "POR CATEGORÍA" del Resumen de la personal tomaba rangos
// corridos una fila desde la segunda sección y perdía la última categoría.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

for (const nombre of ['Gastos', 'Ingresos', 'Ahorros']) {
  test(`#95: los rangos de consultaCategorias('${nombre}') cubren exactamente sus categorías`, () => {
    const base = cargarServidor();
    const servicios = crearServicios({ P: { [nombre]: [] } });
    const ctx = cargarServidor(['Código.js'], servicios);
    const hoja = servicios.SpreadsheetApp.openById('P').getSheetByName(nombre);
    // Solo importa la grilla que arma; el formato no.
    const sinFormato = new Proxy({}, { get: () => () => sinFormato });
    const getRange = hoja.getRange.bind(hoja);
    hoja.getRange = (...a) => Object.assign(Object.create(sinFormato), getRange(...a));
    Object.assign(hoja, { setColumnWidth() {}, setFrozenRows() {}, setFrozenColumns() {} });
    ctx.armarHojaMovimientos(hoja, base.PERSONAL[nombre].secciones, 2026);

    const columnaA = servicios.hoja('P', nombre).map(f => f[0]);
    const categorias = base.PERSONAL[nombre].secciones.flatMap(s => s[1]);
    const enRangos = [];
    for (const [, d, h] of ctx.consultaCategorias(nombre).matchAll(new RegExp(nombre + '!A(\\d+):A(\\d+)', 'g'))) {
      for (let r = Number(d); r <= Number(h); r++) enRangos.push(columnaA[r - 1]);
    }
    assert.equal(JSON.stringify(enRangos), JSON.stringify(categorias));
  });
}
