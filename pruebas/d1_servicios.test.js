// 3.1 (#18), D1: cada pago de servicio lleva su división (columna G de Pagos
// servicios). Sin división, 50/50: así siguen andando el panel lateral y las
// versiones anteriores de la app.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargarServidor, cargarHtml, crearDocumento, crearSelect } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function servidor() {
  const base = cargarServidor();
  const servicios = crearServicios({
    [base.ID_PLANILLA]: { [base.HOJA_PAGOS_SERV]: [['Fecha', 'Servicio', 'Mes', 'Monto', 'Pagado por', 'Comprobante', 'División']] }
  });
  return { ctx: cargarServidor(['Código.js'], servicios), filas: () => servicios.hoja(base.ID_PLANILLA, base.HOJA_PAGOS_SERV).slice(1) };
}

const PAGO = { fecha: '2026-10-16', servicio: 'Internet', mes: 'Octubre', monto: '44000', pagadoPor: 'Marcos' };

test('D1: guardarServicio escribe la división en la columna G', () => {
  const { ctx, filas } = servidor();
  ctx.guardarServicio(Object.assign({ idEnvio: 'd1-a', division: 'Solo Flor' }, PAGO));
  assert.equal(filas()[0][6], 'Solo Flor');
});

test('D1: sin división, el pago queda 50/50', () => {
  const { ctx, filas } = servidor();
  ctx.guardarServicio(Object.assign({ idEnvio: 'd1-b' }, PAGO));
  assert.equal(filas()[0][6], '50/50');
});

test('D1: una división que no existe se rechaza y no escribe', () => {
  const { ctx, filas } = servidor();
  assert.throws(() => ctx.guardarServicio(Object.assign({ idEnvio: 'd1-c', division: '70/30' }, PAGO)), /División/);
  assert.equal(filas().length, 0);
});

test('D1: el formulario de servicio tiene División y la manda', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'apps-script', 'Web.html'), 'utf8');
  assert.match(html, /<select[^>]*id="divisionServicio"/);

  const doc = crearDocumento();
  doc.elementos.set('divisionServicio', crearSelect('divisionServicio', ['50/50', 'Solo Marcos', 'Solo Flor'], 2));
  doc.getElementById('montoServicio').value = '44000';
  const ctx = cargarHtml('Web.html', { document: doc, setTimeout: () => 0, clearTimeout: () => {} });
  ctx.enviarServicio();
  return new Promise(r => setImmediate(r)).then(() => {
    const envio = ctx.llamadas.find(l => l.nombre === 'guardarServicio');
    assert.ok(envio, 'no llamó a guardarServicio');
    assert.equal(envio.args[0].division, 'Solo Flor');
  });
});
