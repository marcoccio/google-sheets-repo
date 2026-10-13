// A2 y M1: cuando la relectura no coincide con lo escrito, el servidor avisa
// el error pero deja la planilla como antes. Si no, el reintento duplica la
// fila (M1) o suma sobre un valor malo (A2).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function entorno() {
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
  });
  servicios.PropertiesService.getUserProperties().setProperty(base.CLAVE_PERSONAL, 'PERSONAL');
  return { ctx: cargarServidor(['Código.js'], servicios), servicios, base };
}

// Filas con algo escrito, sin contar el encabezado.
const filasConDatos = filas => filas.slice(1).filter(f => f.some(v => v !== '' && v !== undefined));

const casosM1 = [
  ['guardarGasto', 'HOJA_GASTOS', { categoria: 'Super', detalle: 'Verduras', descripcion: '', pagadoPor: 'Marcos', division: '50/50' }],
  ['guardarServicio', 'HOJA_PAGOS_SERV', { servicio: 'Internet', mes: 'Octubre', pagadoPor: 'Marcos' }],
  ['guardarIngreso', 'HOJA_INGRESOS', { concepto: 'Sueldo', descripcion: '', recibidoPor: 'Marcos' }]
];

for (const [funcion, constHoja, campos] of casosM1) {
  test(`M1: ${funcion} borra la fila si la relectura falla`, () => {
    const { ctx, servicios, base } = entorno();
    servicios.fallas.relectura = 8000;
    assert.throws(() => ctx[funcion]({ fecha: '2026-10-11', monto: '8000', ...campos }));
    assert.deepEqual(filasConDatos(servicios.hoja(base.ID_PLANILLA, base[constHoja])), []);
  });
}

test('A2: guardarMovimientoPersonal deja la celda como estaba si la relectura falla', () => {
  const { ctx, servicios, base } = entorno();
  const categoria = base.PERSONAL.Gastos.secciones[0][1][0];
  const fila = servicios.hoja('PERSONAL', 'Gastos').findIndex(f => f[0] === categoria);
  servicios.fallas.relectura = 9000; // 1000 previo + 8000
  assert.throws(
    () => ctx.guardarMovimientoPersonal({ hoja: 'Gastos', categoria, fecha: '2026-10-11', monto: '8000', descripcion: 'x' }),
    /No se pudo guardar/
  );
  assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][10], 1000); // columna K = octubre
  assert.equal(servicios.nota('PERSONAL', 'Gastos', fila + 1, 11), '');
});

test('CONTROL: sin falla de relectura, guardarGasto escribe una fila', () => {
  const { ctx, servicios, base } = entorno();
  ctx.guardarGasto({ fecha: '2026-10-11', monto: '8000', ...casosM1[0][2] });
  assert.equal(filasConDatos(servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS)).length, 1);
});
