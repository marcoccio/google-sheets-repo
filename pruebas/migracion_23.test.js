// #23: botón para migrar la personal a Movimientos. Simular no toca nada;
// migrar pasa cada celda con valor a una fila "Saldo anterior a la
// migración", pone las fórmulas, verifica celda por celda y, si algo no da
// igual, deja la planilla como estaba.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor, cargarHtml } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

const TIPOS = ['Gastos', 'Ingresos', 'Ahorros'];

// Grilla como la arma la app: fila 1 con fin de mes, 2 IPC, 3 vacía, y por
// sección encabezado, categorías, subtotal y vacía; al final TOTAL.
function grilla(base, tipo, valores, finDeMes) {
  const filas = [['Categoría', ...finDeMes, 'TOTAL'], ['IPC del mes', ...Array(12).fill(0.02)], []];
  base.PERSONAL[tipo].secciones.forEach(([sec, cats]) => {
    filas.push([sec]);
    cats.forEach(c => filas.push([c, ...Array.from({ length: 12 }, (_, m) => (valores[c] || {})[m] || '')]));
    filas.push(['Subtotal ' + sec.toLowerCase(), '=SUM(...)']);
    filas.push([]);
  });
  filas.push(['TOTAL', '=SUM(...)']);
  return filas;
}

// Calcula las fórmulas de la grilla como lo haría Sheets: suma Movimientos
// por tipo, categoría y mes (lee la fórmula, no la copia del código).
function evaluador(servicios, { error } = {}) {
  return (formula, { hoja, fila, col }) => {
    const m = formula.match(/"(Gastos|Ingresos|Ahorros)";Movimientos!\$C:\$C;\$A(\d+);/);
    if (!m) return formula;
    const datos = servicios.hoja('PERSONAL', hoja);
    const categoria = datos[Number(m[2]) - 1][0];
    const finDeMes = datos[0][col - 1];
    let total = 0;
    for (const f of servicios.hoja('PERSONAL', 'Movimientos').slice(1)) {
      if (f[1] === m[1] && f[2] === categoria &&
          f[0].getFullYear() === finDeMes.getFullYear() && f[0].getMonth() === finDeMes.getMonth()) {
        total += f[4];
      }
    }
    return error && hoja === error.hoja && fila === error.fila ? total + 1 : total;
  };
}

function entorno(opciones = {}) {
  const base = cargarServidor();
  const servicios = crearServicios({ [base.ID_PLANILLA]: {}, PERSONAL: {} }, { zona: 'America/Argentina/Mendoza' });
  servicios.PropertiesService.getUserProperties().setProperty(base.CLAVE_PERSONAL, 'PERSONAL');
  const ctx = cargarServidor(['Código.js'], servicios);
  const finDeMes = Array.from({ length: 12 }, (_, m) => ctx.aFecha(`2026-${String(m + 1).padStart(2, '0')}-01`))
    .map(d => new d.constructor(d.getFullYear(), d.getMonth() + 1, 0));
  const ss = servicios.SpreadsheetApp.openById('PERSONAL');
  const valores = {
    Gastos: { Comida: { 7: 6300, 9: 1000 }, Ajuste: { 9: 50 } },
    Ingresos: { Sueldo: { 9: '500000' } },
    Ahorros: {}
  };
  for (const tipo of TIPOS) {
    const h = ss.insertSheet(tipo);
    const filas = grilla(base, tipo, valores[tipo], finDeMes);
    h.getRange(1, 1, filas.length, 14).setValues(filas.map(f => [...f, ...Array(14 - f.length).fill('')]));
  }
  const resumen = ss.insertSheet('Resumen');
  resumen.getRange(11, 1, 1, 7).setValues([['=VIEJA_I', '', '', '=VIEJA_G', '', '', '=VIEJA_A']]);
  ss.setSpreadsheetTimeZone('Etc/UTC');
  servicios.fallas.formulas = evaluador(servicios, opciones);
  return { ctx, servicios, ss, base };
}

const fila = (servicios, tipo, cat) => servicios.hoja('PERSONAL', tipo).findIndex(f => f[0] === cat);

test('#23: simular informa celdas, totales y zona, y no toca nada', () => {
  const { ctx, servicios, ss } = entorno();
  const antes = JSON.stringify(TIPOS.map(t => servicios.hoja('PERSONAL', t)));
  const r = ctx.simularMigracion();
  assert.equal(r.migrada, false);
  assert.equal(r.zona, 'Etc/UTC');
  assert.equal(r.zonaScript, 'America/Argentina/Mendoza');
  assert.equal(JSON.stringify(r.hojas.map(h => [h.tipo, h.celdas, h.total])),
    JSON.stringify([['Gastos', 3, '$7.350'], ['Ingresos', 1, '$500.000'], ['Ahorros', 0, '$0']]));
  assert.equal(JSON.stringify(TIPOS.map(t => servicios.hoja('PERSONAL', t))), antes);
  assert.equal(ss.getSheetByName('Movimientos'), null);
  assert.equal(ss.getSpreadsheetTimeZone(), 'Etc/UTC');
});

test('#23: migrar pasa los saldos a Movimientos, pone fórmulas y deja los totales iguales', () => {
  const { ctx, servicios, ss } = entorno();
  const r = ctx.migrarPersonal({ idEnvio: 'mig-1' });
  assert.match(r, /4 saldos/);

  const mov = servicios.hoja('PERSONAL', 'Movimientos');
  assert.equal(JSON.stringify(mov[0]), JSON.stringify(['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Origen']));
  const comidaAgo = mov.find(f => f[2] === 'Comida' && f[4] === 6300);
  assert.equal(comidaAgo[0].getDate(), 31);
  assert.equal(comidaAgo[0].getMonth(), 7);
  assert.equal(JSON.stringify(comidaAgo.slice(1)), JSON.stringify(['Gastos', 'Comida', 'Saldo anterior a la migración', 6300, 'migrado']));
  assert.ok(mov.find(f => f[2] === 'Sueldo' && f[4] === 500000), 'el texto "500000" se migra como número');

  const r1 = fila(servicios, 'Gastos', 'Comida');
  const formula = servicios.hoja('PERSONAL', 'Gastos')[r1][8];
  assert.equal(formula, ctx.formulaCelda('Gastos', r1 + 1, 9));
  const calculado = ss.getSheetByName('Gastos').getRange(r1 + 1, 2, 1, 12).getValues()[0];
  assert.equal(calculado[7], 6300);
  assert.equal(calculado[9], 1000);
  assert.equal(calculado[0], 0);

  assert.equal(servicios.hoja('PERSONAL', 'Gastos')[1][1], 0.02, 'la fila del IPC no se toca');
  assert.equal(ss.getSpreadsheetTimeZone(), 'America/Argentina/Mendoza');
  const resumen = servicios.hoja('PERSONAL', 'Resumen')[10];
  assert.equal(resumen[0], ctx.consultaCategorias('Ingresos'));
  assert.equal(resumen[3], ctx.consultaCategorias('Gastos'));
  assert.equal(resumen[6], ctx.consultaCategorias('Ahorros'));
});

test('#23: si una celda no da igual, deja la planilla como estaba', () => {
  const { ctx, servicios, ss, base } = entorno();
  const r1 = fila(servicios, 'Gastos', 'Comida');
  servicios.fallas.formulas = evaluador(servicios, { error: { hoja: 'Gastos', fila: r1 + 1 } });
  const antes = JSON.stringify(TIPOS.map(t => servicios.hoja('PERSONAL', t)));

  assert.throws(() => ctx.migrarPersonal({ idEnvio: 'mig-2' }), /como estaba/);
  assert.equal(ss.getSheetByName('Movimientos'), null);
  assert.equal(JSON.stringify(TIPOS.map(t => servicios.hoja('PERSONAL', t))), antes);
  assert.equal(ss.getSpreadsheetTimeZone(), 'Etc/UTC');
  assert.equal(servicios.hoja('PERSONAL', 'Resumen')[10][0], '=VIEJA_I');
  assert.ok(base);
});

test('#23: una planilla ya migrada no se migra dos veces', () => {
  const { ctx } = entorno();
  ctx.migrarPersonal({ idEnvio: 'mig-3' });
  assert.throws(() => ctx.migrarPersonal({ idEnvio: 'mig-4' }), /ya está migrada/);
  assert.equal(ctx.simularMigracion().migrada, true);
});

test('#23: después de migrar, guardar un gasto agrega una fila', () => {
  const { ctx, servicios } = entorno();
  ctx.migrarPersonal({ idEnvio: 'mig-5' });
  const n = servicios.hoja('PERSONAL', 'Movimientos').length;
  ctx.guardarMovimientoPersonal({ idEnvio: 'g1', hoja: 'Gastos', categoria: 'Ropa', fecha: '2026-10-19', monto: '2000' });
  assert.equal(servicios.hoja('PERSONAL', 'Movimientos').length, n + 1);
});

test('#23: Ajustes tiene Simular y, después del informe, Migrar ahora por llamar()', () => {
  const ctx = cargarHtml('Web.html', { setTimeout: () => 0, clearTimeout: () => {} });
  const doc = ctx.document;

  ctx.pedirSimulacion();
  const sim = ctx.llamadas.find(l => l.nombre === 'simularMigracion');
  assert.ok(sim, 'llama a simularMigracion');
  sim.exito({ migrada: false, zona: 'Etc/UTC', zonaScript: 'America/Argentina/Mendoza',
    hojas: [{ tipo: 'Gastos', celdas: 3, total: '$7.350' }, { tipo: 'Ingresos', celdas: 1, total: '$500.000' }, { tipo: 'Ahorros', celdas: 0, total: '$0' }] });
  assert.match(doc.getElementById('informeMigracion').textContent, /Gastos: 3 .*\$7\.350/);
  assert.ok(!doc.getElementById('btnMigrar').classList.contains('oculto'));

  ctx.pedirMigracion();
  const mig = ctx.llamadas.find(l => l.nombre === 'migrarPersonal');
  assert.ok(mig && mig.args[0].idEnvio, 'migra por llamar()');
  mig.exito('Planilla migrada');
  assert.ok(doc.getElementById('btnMigrar').classList.contains('oculto'));
  assert.equal(doc.getElementById('aviso').textContent, 'Planilla migrada');
});

test('#23: con la planilla ya migrada, simular lo dice y no ofrece migrar', () => {
  const ctx = cargarHtml('Web.html', { setTimeout: () => 0, clearTimeout: () => {} });
  ctx.pedirSimulacion();
  ctx.llamadas.find(l => l.nombre === 'simularMigracion').exito({ migrada: true, hojas: [] });
  assert.match(ctx.document.getElementById('informeMigracion').textContent, /ya está migrada/);
  assert.ok(ctx.document.getElementById('btnMigrar').classList.contains('oculto'));
});
