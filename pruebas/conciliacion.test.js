// #45: el ajuste de la conciliación iba con google.script.run directo, sin
// control de tiempo ni idEnvio. Un corte o un doble toque podía duplicarlo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml, cargarServidor, crearDocumento, crearSelect } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function servidor() {
  const base = cargarServidor();
  const personal = [['Categoría']];
  for (const hoja of ['Gastos', 'Ingresos']) {
    base.PERSONAL[hoja].secciones.forEach(([, categorias]) =>
      categorias.forEach(c => personal.push([c, ...Array(12).fill(0)])));
  }
  const servicios = crearServicios({
    [base.ID_PLANILLA]: { [base.HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']] },
    PERSONAL: { Gastos: personal.map(f => f.slice()), Ingresos: personal.map(f => f.slice()) }
  });
  servicios.PropertiesService.getUserProperties().setProperty(base.CLAVE_PERSONAL, 'PERSONAL');
  return { ctx: cargarServidor(['Código.js'], servicios), servicios, base };
}

test('#45: registrarAjuste al depto con el mismo idEnvio escribe una sola fila', () => {
  const { ctx, servicios, base } = servidor();
  const d = { idEnvio: 'aj-1', destino: 'depto', fecha: '2026-10-11', monto: -500, pagadoPor: 'Marcos', division: '50/50' };
  ctx.registrarAjuste(d);
  ctx.registrarAjuste(d);
  assert.equal(servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS).slice(1).length, 1);
});

test('#45: registrarAjuste a la personal con el mismo idEnvio suma una sola vez', () => {
  const { ctx, servicios } = servidor();
  const d = { idEnvio: 'aj-2', destino: 'personal', fecha: '2026-10-11', monto: 700 };
  ctx.registrarAjuste(d);
  ctx.registrarAjuste(d);
  const fila = servicios.hoja('PERSONAL', 'Gastos').find(f => f[0] === 'Ajuste');
  assert.equal(fila[10], 700); // columna K = octubre
});

function cliente() {
  const relojes = [];
  const doc = crearDocumento();
  doc.elementos.set('destinoConciliar', crearSelect('destinoConciliar', ['depto', 'personal']));
  doc.elementos.set('pagadoAjuste', crearSelect('pagadoAjuste', ['Marcos', 'Flor']));
  doc.getElementById('hasta').value = '2026-10-11';
  const ctx = cargarHtml('Web.html', {
    document: doc,
    setTimeout: (fn, ms) => { relojes.push({ fn, ms }); return relojes.length; },
    clearTimeout: () => {},
    location: { reload() {} }
  });
  ctx.ULTIMA_CONCILIACION = { diferenciaNumero: -500 };
  return { ctx, relojes };
}

test('#45: cargarAjuste manda idEnvio y tiene control de tiempo', () => {
  const { ctx, relojes } = cliente();
  ctx.cargarAjuste();
  const envio = ctx.llamadas.find(l => l.nombre === 'registrarAjuste');
  assert.ok(envio, 'no llamó a registrarAjuste');
  assert.equal(typeof envio.args[0].idEnvio, 'string');
  assert.ok(relojes.some(r => r.ms >= 15000), 'sin control de tiempo');
});

test('#45: si se corta la espera, el reintento del ajuste reusa idEnvio', () => {
  const { ctx, relojes } = cliente();
  ctx.cargarAjuste();
  relojes.find(r => r.ms >= 15000).fn();
  ctx.cargarAjuste();
  const envios = ctx.llamadas.filter(l => l.nombre === 'registrarAjuste');
  assert.equal(envios.length, 2);
  assert.equal(envios[1].args[0].idEnvio, envios[0].args[0].idEnvio);
});

test('CONTROL: conciliar del depto suma gastos y servicios del rango, e ingresos aparte', () => {
  const base = cargarServidor();
  const servicios = crearServicios({
    [base.ID_PLANILLA]: {
      [base.HOJA_GASTOS]: [['Fecha', 'Cat', 'Det', 'Desc', 'Monto']],
      [base.HOJA_PAGOS_SERV]: [['Fecha', 'Servicio', 'Mes', 'Monto']],
      [base.HOJA_INGRESOS]: [['Fecha', 'Concepto', 'Monto']]
    }
  });
  const ctx = cargarServidor(['Código.js'], servicios);
  // Las fechas se arman adentro del contexto: conciliar compara con instanceof Date.
  const f = ctx.aFecha;
  servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS).push(
    [f('2026-10-01'), '', '', '', 1000], [f('2026-10-31'), '', '', '', 2000], [f('2026-11-01'), '', '', '', 9999], ['', '', '', '', 5]);
  servicios.hoja(base.ID_PLANILLA, base.HOJA_PAGOS_SERV).push(
    [f('2026-10-15'), 'Internet', 'Octubre', 300], [f('2026-09-30'), 'Internet', 'Septiembre', 7777]);
  servicios.hoja(base.ID_PLANILLA, base.HOJA_INGRESOS).push([f('2026-10-20'), 'Sueldo', 500]);

  const r = ctx.conciliar({ destino: 'depto', desde: '2026-10-01', hasta: '2026-10-31', montoReal: '3300' });
  assert.equal(r.gastos, ctx.comoPlata(3300));
  assert.equal(r.ingresos, ctx.comoPlata(500));
  assert.equal(r.hayDiferencia, false);
});
