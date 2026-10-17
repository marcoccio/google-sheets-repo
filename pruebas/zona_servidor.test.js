const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function entorno(opciones = {}) {
  const base = cargarServidor();
  const filasPersonal = [['Categoría', ...Array(13).fill('')]];
  base.PERSONAL.Gastos.secciones.forEach(([seccion, categorias]) => {
    filasPersonal.push([seccion]);
    categorias.forEach(c => filasPersonal.push([c, ...Array(12).fill(1000)]));
  });
  const servicios = crearServicios({
    [base.ID_PLANILLA]: {
      [base.HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']],
      [base.HOJA_PAGOS_SERV]: [['Fecha', 'Servicio', 'Mes', 'Monto', 'Pagado por']],
      [base.HOJA_INGRESOS]: [['Fecha', 'Concepto', 'Monto', 'Recibido por']]
    },
    PERSONAL: { Gastos: filasPersonal }
  }, opciones);
  servicios.PropertiesService.getUserProperties().setProperty(base.CLAVE_PERSONAL, 'PERSONAL');
  return { ctx: cargarServidor(['Código.js'], servicios), servicios, base };
}

test('formatDate respeta la zona', () => {
  const servicios = crearServicios();
  const fecha = new Date(Date.UTC(2026, 10, 1, 1, 30));
  assert.equal(servicios.Utilities.formatDate(fecha, 'UTC', 'dd/MM'), '01/11');
  assert.equal(servicios.Utilities.formatDate(fecha, 'America/Argentina/Mendoza', 'dd/MM'), '31/10');
  assert.equal(servicios.Utilities.formatDate(fecha, 'UTC', 'yyyy-MM-dd'), '2026-11-01');
  assert.equal(servicios.Utilities.formatDate(fecha, 'America/Argentina/Mendoza', 'yyyy-MM-dd'), '2026-10-31');
});

test('sin opciones, la zona es la de produccion (Mendoza, desde 1.2)', () => {
  const servicios = crearServicios();
  assert.equal(servicios.Session.getScriptTimeZone(), 'America/Argentina/Mendoza');

  const serviciosConPlanilla = crearServicios({ TEST: {} });
  assert.equal(serviciosConPlanilla.SpreadsheetApp.openById('TEST').getSpreadsheetTimeZone(), 'America/Argentina/Mendoza');
});

for (const zona of ['UTC', 'America/Argentina/Mendoza']) {
  test(`guardarMovimientoPersonal respeta la zona (${zona})`, () => {
    process.env.TZ = zona;
    const { ctx, servicios, base } = entorno({ zona });
    const categoria = base.PERSONAL.Gastos.secciones[0][1][0];
    const fila = servicios.hoja('PERSONAL', 'Gastos').findIndex(f => f[0] === categoria);

    ctx.guardarMovimientoPersonal({
      hoja: 'Gastos',
      categoria,
      fecha: '2026-10-31',
      monto: '8000',
      descripcion: 'x'
    });
    assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][10], 1000 + 8000);
    assert.ok(servicios.nota('PERSONAL', 'Gastos', fila + 1, 11).startsWith('31/10:'));

    ctx.guardarMovimientoPersonal({
      hoja: 'Gastos',
      categoria,
      fecha: '2026-11-01',
      monto: '8000',
      descripcion: 'x'
    });
    assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][11], 1000 + 8000);
    assert.ok(servicios.nota('PERSONAL', 'Gastos', fila + 1, 12).startsWith('01/11:'));
  });
}
