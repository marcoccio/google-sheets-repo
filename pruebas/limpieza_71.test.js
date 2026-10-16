// #71: limpieza de v12. S4: obtenerAcumulado lee solo lo que la app muestra.
// S5: permitirNegativo lo fija el servidor, no el cliente.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

const ENCABEZADO_GASTOS = [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']];

function servidor(hojas) {
  const base = cargarServidor();
  const servicios = crearServicios({ [base.ID_PLANILLA]: hojas(base) });
  return { ctx: cargarServidor(['Código.js'], servicios), servicios, base };
}

test('S4: obtenerAcumulado devuelve solo lo que muestra el encabezado', () => {
  const { ctx } = servidor(base => {
    const mes = base.MESES[new Date().getMonth()];
    return {
      [base.HOJA_RESUMEN]: [
        ['RESUMEN 2026'],
        [],
        ['Concepto', mes],
        ['Servicios del mes', 100],
        ['Gastos diarios del mes', 50],
        ['TOTAL GASTOS DEL MES', 150],
        ['Ingresos del mes', 0],
        ['NETO DEL MES (ingresos - gastos)', -150],
        [],
        ['Puso Marcos en el mes', 90],
        ['Puso Flor en el mes', 60],
        [],
        ['ACUMULADO MARCOS', 900],
        ['ACUMULADO FLOR', 600]
      ]
    };
  });

  const r = ctx.obtenerAcumulado();
  assert.deepEqual(Object.keys(r).sort(), ['flor', 'gastos', 'marcos', 'mes', 'servicios']);
  assert.equal(r.marcos, '90');
  assert.equal(r.flor, '60');
  assert.equal(r.servicios, '100');
  assert.equal(r.gastos, '150');
});

test('S5: guardarGasto desde el cliente rechaza un monto negativo aunque mande permitirNegativo', () => {
  const { ctx, servicios, base } = servidor(b => ({ [b.HOJA_GASTOS]: ENCABEZADO_GASTOS }));
  assert.throws(() => ctx.guardarGasto({
    idEnvio: 's5-1', fecha: '2026-10-11', categoria: 'Varios', detalle: 'Ajuste',
    monto: -500, pagadoPor: 'Marcos', division: '50/50', permitirNegativo: true
  }), /mayor a cero/);
  assert.equal(servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS).slice(1).length, 0);
});

test('S5: el ajuste negativo de la conciliación sigue escribiendo', () => {
  const { ctx, servicios, base } = servidor(b => ({ [b.HOJA_GASTOS]: ENCABEZADO_GASTOS }));
  ctx.registrarAjuste({ idEnvio: 's5-2', destino: 'depto', fecha: '2026-10-11', monto: -500, pagadoPor: 'Marcos' });
  const filas = servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS).slice(1);
  assert.equal(filas.length, 1);
  assert.equal(filas[0][4], -500);
});
