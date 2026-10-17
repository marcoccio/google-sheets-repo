// Limpieza post v13: cambiarDestino arma los ids por nombre y la URL de la
// planilla llega con obtenerOpciones (antes era un round trip aparte).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml } = require('./arnes.js');

test('CONTROL: cada sección muestra su zona y marca su botón', () => {
  const ctx = cargarHtml('Web.html', { setTimeout: () => 0, clearTimeout: () => {} });
  const doc = ctx.document;
  for (const [cual, nombre] of [['personal', 'Personal'], ['conciliar', 'Conciliar'], ['depto', 'Depto']]) {
    ctx.irA(cual);
    for (const z of ['Depto', 'Personal', 'Conciliar', 'Ajustes']) {
      assert.equal(doc.getElementById('zona' + z).classList.contains('oculto'), z !== nombre, `${cual}: zona${z}`);
    }
    assert.ok(doc.getElementById('dest' + nombre).classList.contains('activo'));
  }
  ctx.irA('ajustes');
  assert.ok(!doc.getElementById('zonaAjustes').classList.contains('oculto'));
  assert.ok(!doc.getElementById('destDepto').classList.contains('activo'));
});

test('CONTROL: el link a la planilla llega con obtenerOpciones', () => {
  const ctx = cargarHtml('Web.html', { setTimeout: () => 0, clearTimeout: () => {} });
  ctx.dispararEvento('load');
  const opciones = ctx.llamadas.find(l => l.nombre === 'obtenerOpciones');
  opciones.exito({ url: 'https://docs.google.com/x', yo: { nombre: 'Marcos', seguro: true }, categorias: [], detalles: {}, servicios: [], meses: [], personales: { Gastos: [] }, conceptosIngreso: [] });
  assert.equal(ctx.document.getElementById('verPlanilla').href, 'https://docs.google.com/x');
  assert.equal(ctx.llamadas.filter(l => l.nombre === 'urlPlanilla').length, 0);
});
