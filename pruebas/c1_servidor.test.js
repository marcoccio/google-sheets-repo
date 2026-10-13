const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function armarFilasGastos(PERSONAL) {
  const filas = [];
  filas.push(['Categoría', ...Array(12).fill(''), 'TOTAL']);
  filas.push(['IPC del mes', ...Array(13).fill('')]);
  filas.push(Array(14).fill(''));

  PERSONAL.Gastos.secciones.forEach(([secNombre, categorias]) => {
    filas.push([secNombre, ...Array(13).fill('')]);
    categorias.forEach(cat => {
      const fila = [cat];
      for (let m = 0; m < 12; m++) {
        fila.push(1000);
      }
      fila.push(12000);
      filas.push(fila);
    });
    filas.push(['Subtotal ' + secNombre.toLowerCase(), ...Array(13).fill(0)]);
    filas.push(Array(14).fill(''));
  });
  filas.push(['TOTAL', ...Array(13).fill(0)]);
  return filas;
}

function crearEntorno() {
  const ctxBase = cargarServidor(['Código.js'], {});
  const ID_PLANILLA = ctxBase.ID_PLANILLA;
  const HOJA_GASTOS = ctxBase.HOJA_GASTOS;
  const HOJA_SERVICIOS = ctxBase.HOJA_SERVICIOS;
  const HOJA_PAGOS_SERV = ctxBase.HOJA_PAGOS_SERV;
  const HOJA_INGRESOS = ctxBase.HOJA_INGRESOS;
  const CLAVE_PERSONAL = ctxBase.CLAVE_PERSONAL;
  const PERSONAL = ctxBase.PERSONAL;

  const planillas = {
    [ID_PLANILLA]: {
      [HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']],
      [HOJA_SERVICIOS]: [['Servicio', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']],
      [HOJA_PAGOS_SERV]: [['Fecha', 'Servicio', 'Mes', 'Monto', 'Pagado por']],
      [HOJA_INGRESOS]: [['Fecha', 'Concepto', 'Monto', 'Recibido por']]
    },
    PERSONAL: {
      Gastos: armarFilasGastos(PERSONAL)
    }
  };

  const servicios = crearServicios(planillas);
  servicios.PropertiesService.getUserProperties().setProperty(CLAVE_PERSONAL, 'PERSONAL');
  const ctx = cargarServidor(['Código.js'], servicios);
  return { ctx, servicios };
}

test('C1: guardarGasto con el mismo idEnvio dos veces: queda UNA fila nueva en la hoja y las dos llamadas devuelven el mismo texto', () => {
  const { ctx, servicios } = crearEntorno();
  const envio = {
    idEnvio: 'envio-gasto-1',
    fecha: '2026-10-11',
    monto: '8000',
    categoria: 'Super',
    detalle: 'Supermercado',
    descripcion: 'Compra',
    pagadoPor: 'Marcos',
    division: '50/50'
  };

  const res1 = ctx.guardarGasto(envio);
  const res2 = ctx.guardarGasto(envio);

  const filas = servicios.hoja(ctx.ID_PLANILLA, ctx.HOJA_GASTOS);
  const filasNuevas = filas.slice(1);

  assert.equal(filasNuevas.length, 1);
  assert.equal(res1, res2);
});

test('C1: guardarServicio con el mismo idEnvio dos veces: queda UNA fila nueva en la hoja y las dos llamadas devuelven el mismo texto', () => {
  const { ctx, servicios } = crearEntorno();
  const envio = {
    idEnvio: 'envio-serv-1',
    fecha: '2026-10-11',
    monto: '8000',
    servicio: 'Internet',
    mes: 'Octubre',
    pagadoPor: 'Marcos'
  };

  const res1 = ctx.guardarServicio(envio);
  const res2 = ctx.guardarServicio(envio);

  const filas = servicios.hoja(ctx.ID_PLANILLA, ctx.HOJA_PAGOS_SERV);
  const filasNuevas = filas.slice(1);

  assert.equal(filasNuevas.length, 1);
  assert.equal(res1, res2);
});

test('C1: guardarIngreso con el mismo idEnvio dos veces: queda UNA fila nueva en la hoja y las dos llamadas devuelven el mismo texto', () => {
  const { ctx, servicios } = crearEntorno();
  const envio = {
    idEnvio: 'envio-ing-1',
    fecha: '2026-10-11',
    monto: '8000',
    concepto: 'Sueldo',
    descripcion: 'Mensual',
    recibidoPor: 'Marcos'
  };

  const res1 = ctx.guardarIngreso(envio);
  const res2 = ctx.guardarIngreso(envio);

  const filas = servicios.hoja(ctx.ID_PLANILLA, ctx.HOJA_INGRESOS);
  const filasNuevas = filas.slice(1);

  assert.equal(filasNuevas.length, 1);
  assert.equal(res1, res2);
});

test('C1: guardarMovimientoPersonal con el mismo idEnvio dos veces: la celda de la categoría en el mes 10 (columna K) suma 8000 UNA vez', () => {
  const { ctx, servicios } = crearEntorno();
  const envio = {
    idEnvio: 'envio-pers-1',
    hoja: 'Gastos',
    fecha: '2026-10-11',
    categoria: 'Alquiler',
    monto: '8000',
    descripcion: 'Expensas'
  };

  const previo = 1000;
  ctx.guardarMovimientoPersonal(envio);
  ctx.guardarMovimientoPersonal(envio);

  const filas = servicios.hoja('PERSONAL', 'Gastos');
  const valorFinal = filas[4][10];

  assert.equal(valorFinal, previo + 8000);
});

test('CONTROL: guardarGasto con idEnvio distintos → 2 filas, y la fila escrita tiene en la columna E el número 8000', () => {
  const { ctx, servicios } = crearEntorno();
  const envio1 = {
    idEnvio: 'envio-gasto-a',
    fecha: '2026-10-11',
    monto: '8000',
    categoria: 'Super',
    detalle: 'Supermercado',
    descripcion: 'Compra 1',
    pagadoPor: 'Marcos',
    division: '50/50'
  };
  const envio2 = {
    idEnvio: 'envio-gasto-b',
    fecha: '2026-10-11',
    monto: '8000',
    categoria: 'Super',
    detalle: 'Supermercado',
    descripcion: 'Compra 2',
    pagadoPor: 'Marcos',
    division: '50/50'
  };

  ctx.guardarGasto(envio1);
  ctx.guardarGasto(envio2);

  const filas = servicios.hoja(ctx.ID_PLANILLA, ctx.HOJA_GASTOS);
  const filasNuevas = filas.slice(1);

  assert.equal(filasNuevas.length, 2);
  assert.equal(filasNuevas[0][4], 8000);
  assert.equal(filasNuevas[1][4], 8000);
});

test('CONTROL: guardarMovimientoPersonal una vez → la celda pasa de su valor previo a previo + 8000 y la nota termina en "$8.000"', () => {
  const { ctx, servicios } = crearEntorno();
  const envio = {
    idEnvio: 'envio-pers-ctrl',
    hoja: 'Gastos',
    fecha: '2026-10-11',
    categoria: 'Alquiler',
    monto: '8000',
    descripcion: 'Expensas'
  };

  const previo = 1000;
  ctx.guardarMovimientoPersonal(envio);

  const filas = servicios.hoja('PERSONAL', 'Gastos');
  const valorFinal = filas[4][10];

  assert.equal(valorFinal, previo + 8000);

  const nota = servicios.nota('PERSONAL', 'Gastos', 5, 11);
  assert.ok(nota.endsWith('$8.000'));
});
