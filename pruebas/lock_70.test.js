// #70 (E4): el cliente corta a los 15 s; el servidor tiene que rendirse antes
// con un error claro, sin escribir, para que el reintento con el mismo id ande.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

test('E4: si no toma el lock en 10 s, avisa y no escribe; el reintento escribe una vez', () => {
  const base = cargarServidor();
  const servicios = crearServicios({
    [base.ID_PLANILLA]: { [base.HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']] }
  });
  const esperas = [];
  let tomado = true;
  servicios.LockService.getScriptLock = () => ({
    waitLock(ms) {
      esperas.push(ms);
      // Apps Script tira esto cuando se vence la espera.
      if (tomado) throw new Error('Lock timeout: another process was holding the lock for too long.');
    },
    releaseLock() {}
  });
  const ctx = cargarServidor(['Código.js'], servicios);
  const d = { idEnvio: 'e4', fecha: '2026-10-16', categoria: 'Almacen', detalle: 'Limpieza', monto: 1000, pagadoPor: 'Marcos', division: '50/50' };
  const filas = () => servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS).slice(1);

  assert.throws(() => ctx.guardarGasto(Object.assign({}, d)), /otro guardado/);
  assert.ok(esperas[0] <= 10000, 'espera ' + esperas[0] + ' ms');
  assert.equal(filas().length, 0);

  tomado = false;
  ctx.guardarGasto(Object.assign({}, d));
  ctx.guardarGasto(Object.assign({}, d));
  assert.equal(filas().length, 1);
});
