// 3.2 (#19), D3: hoja Transferencias (fecha, de, para, monto, descripción).
// Sin cálculo de quién le debe a quién. Son dos personas: "para" es el otro.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargarServidor, cargarHtml, crearDocumento, crearSelect } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function servidor() {
  const base = cargarServidor();
  const servicios = crearServicios({
    [base.ID_PLANILLA]: { Transferencias: [['Fecha', 'De', 'Para', 'Monto', 'Descripción']] }
  });
  return { ctx: cargarServidor(['Código.js'], servicios), filas: () => servicios.hoja(base.ID_PLANILLA, 'Transferencias').slice(1) };
}

const T = { fecha: '2026-10-16', de: 'Flor', monto: '50.000', descripcion: 'Su parte del alquiler' };

test('D3: guardarTransferencia escribe fecha, de, para, monto y descripción', () => {
  const { ctx, filas } = servidor();
  const r = ctx.guardarTransferencia(Object.assign({ idEnvio: 't1' }, T));
  const f = filas()[0];
  assert.equal(Object.prototype.toString.call(f[0]), '[object Date]');
  assert.equal(f[0].getDate(), 16);
  assert.deepEqual(f.slice(1, 5), ['Flor', 'Marcos', 50000, 'Su parte del alquiler']);
  assert.match(r, /Flor.*Marcos.*\$50\.000/);
});

test('D3: el mismo idEnvio escribe una sola vez', () => {
  const { ctx, filas } = servidor();
  const r1 = ctx.guardarTransferencia(Object.assign({ idEnvio: 't2' }, T));
  const r2 = ctx.guardarTransferencia(Object.assign({ idEnvio: 't2' }, T));
  assert.equal(filas().length, 1);
  assert.equal(r2, 'Ya estaba guardado. ' + r1);
});

test('D3: rechaza quien no es Marcos ni Flor, y montos que no son positivos', () => {
  const { ctx, filas } = servidor();
  assert.throws(() => ctx.guardarTransferencia(Object.assign({}, T, { idEnvio: 't3', de: 'Juan' })), /Marcos o Flor/);
  assert.throws(() => ctx.guardarTransferencia(Object.assign({}, T, { idEnvio: 't4', monto: '0' })), /mayor a cero/);
  assert.equal(filas().length, 0);
});

test('D3: la app tiene la pestaña Transferencia y manda el envío por llamar()', async () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'apps-script', 'Web.html'), 'utf8');
  assert.match(html, /id="tabTransferencia"/);
  assert.match(html, /id="formTransferencia"/);

  const doc = crearDocumento();
  doc.elementos.set('deTransferencia', crearSelect('deTransferencia', ['Marcos', 'Flor'], 1));
  doc.getElementById('montoTransferencia').value = '50000';
  doc.getElementById('descripcionTransferencia').value = 'Alquiler';
  doc.getElementById('fechaTransferencia').value = '2026-10-16';
  const ctx = cargarHtml('Web.html', { document: doc, setTimeout: () => 0, clearTimeout: () => {} });

  ctx.cambiar('transferencia');
  assert.ok(!doc.getElementById('formTransferencia').classList.contains('oculto'));
  assert.ok(doc.getElementById('formGasto').classList.contains('oculto'));

  ctx.enviarTransferencia();
  await new Promise(r => setImmediate(r));
  const envio = ctx.llamadas.find(l => l.nombre === 'guardarTransferencia');
  assert.ok(envio, 'no llamó a guardarTransferencia');
  const d = envio.args[0];
  assert.deepEqual([d.fecha, d.de, d.monto, d.descripcion], ['2026-10-16', 'Flor', '50000', 'Alquiler']);
  assert.ok(d.idEnvio, 'tiene que pasar por llamar() con idEnvio');

  envio.exito('Transferencia cargada');
  assert.equal(doc.getElementById('montoTransferencia').value, '');
  assert.equal(doc.getElementById('descripcionTransferencia').value, '');
});

test('D3: monto vacío no llama al servidor', () => {
  const ctx = cargarHtml('Web.html', { setTimeout: () => 0, clearTimeout: () => {} });
  ctx.document.getElementById('montoTransferencia').value = '';
  ctx.enviarTransferencia();
  assert.equal(ctx.llamadas.filter(l => l.nombre === 'guardarTransferencia').length, 0);
  assert.match(ctx.document.getElementById('aviso').className, /error/);
});
