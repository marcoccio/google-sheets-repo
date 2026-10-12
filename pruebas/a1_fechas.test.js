const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');

test('CONTROL: aNumero: casos reales', () => {
  const ctx = cargarServidor();
  const casos = [
    ['15000', 15000],
    ['15.000', 15000],
    ['15.000,50', 15000.5],
    ['$8.496', 8496],
    ['195.962', 195962],
    ['15,50', 15.5],
    ['15.5', 15.5],
    ['1.234.567', 1234567],
    ['15000.50', 15000.5],
    ['1.5', 1.5],
    ['1500', 1500],
    ['15.250', 15250],
    ['0.5', 0.5]
  ];

  for (const [entrada, esperado] of casos) {
    const obtenido = ctx.aNumero(entrada);
    assert.ok(
      Math.abs(obtenido - esperado) < 0.001,
      `aNumero(${JSON.stringify(entrada)}) debió ser ${esperado}, dio ${obtenido}`
    );
  }
});

test('CONTROL: A1: aFecha acepta 2026-08-10', () => {
  const ctx = cargarServidor();
  const d = ctx.aFecha('2026-08-10');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 10);
});

test('A1: aFecha rechaza ""', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha('');
  });
});

test('A1: aFecha rechaza undefined', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha(undefined);
  });
});

test('A1: aFecha rechaza null', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha(null);
  });
});

test('A1: aFecha rechaza "10/08/2026"', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha('10/08/2026');
  });
});

test('A1: aFecha rechaza "2026-13-45"', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha('2026-13-45');
  });
});

test('A1: aFecha rechaza "2026-02-30"', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha('2026-02-30');
  });
});

test('A1: aFecha rechaza "2026-8-10"', () => {
  const ctx = cargarServidor();
  assert.throws(() => {
    ctx.aFecha('2026-8-10');
  });
});
