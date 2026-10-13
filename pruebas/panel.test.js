// #46: el panel lateral manda guardarServicio sin fecha ni quién pagó, y con
// A1 (#9) el servidor lo rechaza. El panel corre desde HEAD: se rompe con el
// clasp push de v12.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargarHtml, cargarServidor, crearDocumento, crearSelect } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

const OPCIONES = {
  yo: { nombre: 'Flor', seguro: true, mail: 'flor@example.com' },
  categorias: ['Super'], detalles: { Super: ['Verduras'] },
  servicios: ['Internet'], meses: ['Octubre'], personales: { Gastos: [] }, conceptosIngreso: []
};

function panel() {
  const doc = crearDocumento();
  doc.elementos.set('pagadoPor', crearSelect('pagadoPor', ['Marcos', 'Flor'], 0));
  doc.elementos.set('pagoServicio', crearSelect('pagoServicio', ['Marcos', 'Flor'], 0));
  const ctx = cargarHtml('Panel.html', { document: doc });
  ctx.dispararEvento('load');
  ctx.llamadas.find(l => l.nombre === 'obtenerOpciones').exito(OPCIONES);
  return { ctx, doc };
}

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('#46: el formulario de servicio del panel tiene fecha y quién pagó', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Panel.html'), 'utf8');
  assert.match(html, /<input[^>]*type="date"[^>]*id="fechaServicio"|<input[^>]*id="fechaServicio"[^>]*type="date"/);
  assert.match(html, /<select[^>]*id="pagoServicio"/);
});

test('#46: enviarServicio manda la fecha local y quién pagó (preseleccionado en el usuario)', () => {
  const { ctx, doc } = panel();
  assert.equal(doc.getElementById('fechaServicio').value, hoyLocal());
  doc.getElementById('montoServicio').value = '45000';
  ctx.enviarServicio();
  const envio = ctx.llamadas.find(l => l.nombre === 'guardarServicio');
  assert.ok(envio, 'no llamó a guardarServicio');
  assert.equal(envio.args[0].fecha, hoyLocal());
  assert.equal(envio.args[0].pagadoPor, 'Flor');
});

test('#46: el gasto del panel también preselecciona al usuario', () => {
  const { ctx, doc } = panel();
  doc.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  assert.equal(ctx.llamadas.find(l => l.nombre === 'guardarGasto').args[0].pagadoPor, 'Flor');
});

test('#46: lo que manda el panel lo acepta el guardarServicio real', () => {
  const { ctx, doc } = panel();
  doc.getElementById('montoServicio').value = '45000';
  ctx.enviarServicio();
  const datos = ctx.llamadas.find(l => l.nombre === 'guardarServicio').args[0];

  const base = cargarServidor();
  const servicios = crearServicios({ [base.ID_PLANILLA]: {
    [base.HOJA_PAGOS_SERV]: [['Fecha', 'Servicio', 'Mes', 'Monto', 'Pagado por']] } });
  const srv = cargarServidor(['Código.js'], servicios);
  srv.guardarServicio(datos);
  const filas = servicios.hoja(base.ID_PLANILLA, base.HOJA_PAGOS_SERV).slice(1);
  assert.equal(filas.length, 1);
  assert.deepEqual([filas[0][1], filas[0][2], filas[0][3], filas[0][4]], ['Internet', 'Octubre', 45000, 'Flor']);
});
