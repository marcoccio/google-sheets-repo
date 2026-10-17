const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cargarServidor,
  cargarHtml,
  crearRunner
} = require('./arnes.js');

test('1. cargarServidor() expone aFecha como función y aFecha(\'2026-08-10\') da año 2026, mes 7 y día 10', () => {
  const ctx = cargarServidor();
  assert.equal(typeof ctx.aFecha, 'function');
  const d = ctx.aFecha('2026-08-10');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 10);
});

test('2. ctx.ID_PLANILLA es \'1Q0cVQKTsfpsR3cZ7_OCCpGE2ur23AAbbTKXZhXys9Ag\'', () => {
  const ctx = cargarServidor();
  assert.equal(ctx.ID_PLANILLA, '1Q0cVQKTsfpsR3cZ7_OCCpGE2ur23AAbbTKXZhXys9Ag');
});

test('3. Sin globales, ctx.planilla() lanza un error cuyo mensaje contiene SpreadsheetApp.openById', () => {
  const ctx = cargarServidor();
  assert.throws(
    () => ctx.planilla(),
    /SpreadsheetApp\.openById/
  );
});

test('4. Con { SpreadsheetApp: { openById: id => ({ id }) } }, ctx.planilla().id es el ID de la prueba 2', () => {
  const ctx = cargarServidor(['Código.js'], {
    SpreadsheetApp: { openById: id => ({ id }) }
  });
  assert.equal(ctx.planilla().id, '1Q0cVQKTsfpsR3cZ7_OCCpGE2ur23AAbbTKXZhXys9Ag');
});

test('5. cargarServidor([\'Indices.js\']) expone ipcAcumulado, iclAcumulado e icl como funciones', () => {
  const ctx = cargarServidor(['Indices.js']);
  assert.equal(typeof ctx.ipcAcumulado, 'function');
  assert.equal(typeof ctx.iclAcumulado, 'function');
  assert.equal(typeof ctx.icl, 'function');
});

test('6. cargarHtml(\'Web.html\'): expone fechaDe y enviarGasto como funciones; después de ctx.dispararEvento(\'load\'), ctx.document.getElementById(\'fecha\').value cumple /^\\d{4}-\\d{2}-\\d{2}$/ y ctx.llamadas contiene una llamada con nombre === \'obtenerOpciones\' y exito de tipo función', () => {
  const ctx = cargarHtml('Web.html');
  assert.equal(typeof ctx.fechaDe, 'function');
  assert.equal(typeof ctx.enviarGasto, 'function');

  ctx.dispararEvento('load');

  assert.match(ctx.document.getElementById('fecha').value, /^\d{4}-\d{2}-\d{2}$/);
  const llamada = ctx.llamadas.find(ll => ll.nombre === 'obtenerOpciones');
  assert.ok(llamada, 'Debe registrarse una llamada a obtenerOpciones');
  assert.equal(typeof llamada.exito, 'function');
});

test('8. Runner: crearRunner() encadenado registra nombre, args y los dos handlers como se describe arriba', () => {
  const runner = crearRunner();
  const handlerExito = () => {};
  const handlerFallo = () => {};
  runner.withSuccessHandler(handlerExito).withFailureHandler(handlerFallo).servidorMetodo('x');
  assert.equal(runner.llamadas.length, 1);
  assert.deepEqual(runner.llamadas[0], {
    nombre: 'servidorMetodo',
    args: ['x'],
    exito: handlerExito,
    fallo: handlerFallo
  });
});
