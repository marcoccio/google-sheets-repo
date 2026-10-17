// CONTROL de los cinco formularios que guardan (gasto, servicio, ingreso,
// transferencia, personal): fijan lo que hacen hoy antes de unificarlos en un
// solo helper (limpieza post v13, grupo C). Tienen que pasar antes y después.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml } = require('./arnes.js');

const esperar = () => new Promise(r => setImmediate(r));

const FORMS = [
  { enviar: 'enviarGasto', btn: 'btnGasto', texto: 'Guardar gasto', monto: 'monto', fn: 'guardarGasto',
    campos: { descripcion: 'x' }, limpia: ['monto', 'descripcion'], arch: ['archGasto', 'lblGasto'], refresca: 'obtenerAcumulado' },
  { enviar: 'enviarServicio', btn: 'btnServicio', texto: 'Guardar servicio', monto: 'montoServicio', fn: 'guardarServicio',
    campos: {}, limpia: ['montoServicio'], arch: ['archServicio', 'lblServicio'], refresca: 'obtenerAcumulado' },
  { enviar: 'enviarIngreso', btn: 'btnIngreso', texto: 'Guardar ingreso', monto: 'montoIngreso', fn: 'guardarIngreso',
    campos: { descripcionIngreso: 'x' }, limpia: ['montoIngreso', 'descripcionIngreso'], arch: ['archIngreso', 'lblIngreso'], refresca: 'obtenerAcumulado' },
  { enviar: 'enviarTransferencia', btn: 'btnTransferencia', texto: 'Guardar transferencia', monto: 'montoTransferencia', fn: 'guardarTransferencia',
    campos: { descripcionTransferencia: 'x' }, limpia: ['montoTransferencia', 'descripcionTransferencia'], arch: null, refresca: null },
  { enviar: 'enviarPersonal', btn: 'btnPersonal', texto: 'Guardar gasto personal', monto: 'montoPersonal', fn: 'guardarMovimientoPersonal',
    campos: { descripcionPersonal: 'x' }, limpia: ['montoPersonal', 'descripcionPersonal'], arch: null, refresca: 'totalesPersonales' }
];

function cargar() {
  return cargarHtml('Web.html', { setTimeout: () => 0, clearTimeout: () => {} });
}

for (const f of FORMS) {
  test(`CONTROL: ${f.enviar} sin monto no llama al servidor`, () => {
    const ctx = cargar();
    ctx[f.enviar]();
    assert.equal(ctx.llamadas.filter(l => l.nombre === f.fn).length, 0);
    assert.match(ctx.document.getElementById('aviso').className, /error/);
    assert.equal(ctx.document.getElementById(f.btn).disabled, false);
  });

  test(`CONTROL: ${f.enviar} guarda, limpia y refresca`, async () => {
    const ctx = cargar();
    const doc = ctx.document;
    doc.getElementById(f.monto).value = '1500';
    for (const [id, v] of Object.entries(f.campos)) doc.getElementById(id).value = v;
    ctx[f.enviar]();
    await esperar();

    assert.equal(doc.getElementById(f.btn).disabled, true, 'el botón queda ocupado');
    const envio = ctx.llamadas.find(l => l.nombre === f.fn);
    assert.ok(envio, 'llama a ' + f.fn);
    assert.equal(envio.args[0].monto, '1500');
    assert.ok(envio.args[0].idEnvio, 'pasa por llamar()');
    if (f.arch) assert.equal(envio.args[0].comprobante, null);

    const antes = ctx.llamadas.length;
    envio.exito('Listo');
    const btn = doc.getElementById(f.btn);
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, f.texto);
    for (const id of f.limpia) assert.equal(doc.getElementById(id).value, '', id + ' se vacía');
    assert.equal(doc.getElementById('aviso').textContent, 'Listo');
    assert.match(doc.getElementById('aviso').className, /ok/);
    const despues = ctx.llamadas.slice(antes).map(l => l.nombre);
    assert.deepEqual(despues, f.refresca ? [f.refresca] : []);
  });

  test(`CONTROL: ${f.enviar} con error suelta el botón y lo muestra`, async () => {
    const ctx = cargar();
    const doc = ctx.document;
    doc.getElementById(f.monto).value = '1500';
    ctx[f.enviar]();
    await esperar();
    ctx.llamadas.find(l => l.nombre === f.fn).fallo({ message: 'No anduvo' });
    assert.equal(doc.getElementById(f.btn).disabled, false);
    assert.equal(doc.getElementById(f.btn).textContent, f.texto);
    assert.equal(doc.getElementById(f.monto).value, '1500', 'el monto no se borra');
    assert.equal(doc.getElementById('aviso').textContent, 'No anduvo');
    assert.match(doc.getElementById('aviso').className, /error/);
  });
}
