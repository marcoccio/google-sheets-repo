// #22: la personal pasa a una hoja Movimientos (una fila por movimiento) y la
// grilla se calcula con SUMIFS. Mientras alguien no migre, se guarda como
// antes (doble modo).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

const ENCABEZADO = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Origen'];

function entorno({ migrada }) {
  const base = cargarServidor();
  const grilla = [['Categoría', ...Array(13).fill('')]];
  base.PERSONAL.Gastos.secciones.forEach(([sec, cats]) => {
    grilla.push([sec]);
    cats.forEach(c => grilla.push([c, ...Array(12).fill(1000)]));
  });
  const hojas = { Gastos: grilla };
  if (migrada) hojas.Movimientos = [ENCABEZADO];
  const servicios = crearServicios({ [base.ID_PLANILLA]: {}, PERSONAL: hojas });
  servicios.PropertiesService.getUserProperties().setProperty(base.CLAVE_PERSONAL, 'PERSONAL');
  const fila = grilla.findIndex(f => f[0] === 'Comida');
  return { ctx: cargarServidor(['Código.js'], servicios), servicios, fila };
}

const MOV = { hoja: 'Gastos', categoria: 'Comida', fecha: '2026-10-17', monto: '8.000', descripcion: 'Super' };

test('#22: con Movimientos, guardar agrega una fila y no toca la grilla', () => {
  const { ctx, servicios, fila } = entorno({ migrada: true });
  const r = ctx.guardarMovimientoPersonal(Object.assign({ idEnvio: 'm1' }, MOV));
  const filas = servicios.hoja('PERSONAL', 'Movimientos').slice(1);
  assert.equal(filas.length, 1);
  assert.equal(filas[0][0].getDate(), 17);
  assert.equal(filas[0][0].getMonth(), 9);
  assert.equal(JSON.stringify(filas[0].slice(1)), JSON.stringify(['Gastos', 'Comida', 'Super', 8000, 'app']));
  assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][10], 1000, 'la celda de octubre no cambia');
  assert.match(r, /Comida.*\$8\.000.*Octubre/);
});

test('#22: con Movimientos, el mismo idEnvio agrega una sola fila', () => {
  const { ctx, servicios } = entorno({ migrada: true });
  ctx.guardarMovimientoPersonal(Object.assign({ idEnvio: 'm2' }, MOV));
  ctx.guardarMovimientoPersonal(Object.assign({ idEnvio: 'm2' }, MOV));
  assert.equal(servicios.hoja('PERSONAL', 'Movimientos').slice(1).length, 1);
});

test('#22: con Movimientos, una categoría que no existe se rechaza y no escribe', () => {
  const { ctx, servicios } = entorno({ migrada: true });
  assert.throws(() => ctx.guardarMovimientoPersonal(Object.assign({}, MOV, { idEnvio: 'm3', categoria: 'Nada' })), /categoría/);
  assert.equal(servicios.hoja('PERSONAL', 'Movimientos').slice(1).length, 0);
});

test('CONTROL: sin Movimientos, guardar suma en la celda como antes', () => {
  const { ctx, servicios, fila } = entorno({ migrada: false });
  ctx.guardarMovimientoPersonal(Object.assign({ idEnvio: 'm4' }, MOV));
  assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][10], 9000);
});

test('#22: la fórmula de una celda suma Movimientos por tipo, categoría y mes de la fila 1', () => {
  const ctx = cargarServidor();
  assert.equal(ctx.formulaCelda('Gastos', 10, 11),
    '=SUMIFS(Movimientos!$E:$E;Movimientos!$B:$B;"Gastos";Movimientos!$C:$C;$A10;' +
    'Movimientos!$A:$A;">="&(EOMONTH(K$1;-1)+1);Movimientos!$A:$A;"<"&(K$1+1))');
});

test('#22: la grilla que arma una planilla nueva ya tiene las fórmulas de Movimientos', () => {
  const base = cargarServidor();
  const servicios = crearServicios({ P: { Ingresos: [] } });
  const ctx = cargarServidor(['Código.js'], servicios);
  const hoja = servicios.SpreadsheetApp.openById('P').getSheetByName('Ingresos');
  const sinFormato = new Proxy({}, { get: () => () => sinFormato });
  const getRange = hoja.getRange.bind(hoja);
  hoja.getRange = (...a) => Object.assign(Object.create(sinFormato), getRange(...a));
  Object.assign(hoja, { setColumnWidth() {}, setFrozenRows() {}, setFrozenColumns() {} });
  ctx.armarHojaMovimientos(hoja, base.PERSONAL.Ingresos.secciones, 2026);

  const filas = servicios.hoja('P', 'Ingresos');
  const r = filas.findIndex(f => f[0] === 'Sueldo');
  assert.equal(filas[r][1], ctx.formulaCelda('Ingresos', r + 1, 2));
  assert.equal(filas[r][12], ctx.formulaCelda('Ingresos', r + 1, 13));
});
