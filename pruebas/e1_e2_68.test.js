// #68. E1: lo que falla DESPUÉS de la escritura verificada (nota, link) no
// puede hacer fallar el guardado: el reintento con el mismo id escribiría de
// nuevo. E2: la personal suma montos guardados como texto, como v9.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function entorno(valorAlquilerOctubre = 1000) {
  const base = cargarServidor();
  const filas = [['Categoría', ...Array(12).fill('')]];
  base.PERSONAL.Gastos.secciones.forEach(([seccion, categorias]) => {
    filas.push([seccion]);
    categorias.forEach(c => filas.push([c, ...Array(12).fill(1000)]));
  });
  const fila = filas.findIndex(f => f[0] === 'Alquiler');
  filas[fila][10] = valorAlquilerOctubre;
  const servicios = crearServicios({
    [base.ID_PLANILLA]: { [base.HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']] },
    PERSONAL: { Gastos: filas }
  });
  servicios.PropertiesService.getUserProperties().setProperty(base.CLAVE_PERSONAL, 'PERSONAL');
  return { ctx: cargarServidor(['Código.js'], servicios), servicios, base, fila };
}

// Hace fallar un método de los rangos que devuelve la planilla `id`.
function romper(servicios, id, metodo) {
  const abrir = servicios.SpreadsheetApp.openById;
  servicios.SpreadsheetApp.openById = idPedido => {
    const ss = abrir(idPedido);
    if (idPedido !== id) return ss;
    const hojaDe = ss.getSheetByName.bind(ss);
    ss.getSheetByName = nombre => {
      const hoja = hojaDe(nombre);
      if (!hoja) return hoja;
      const rangoDe = hoja.getRange.bind(hoja);
      hoja.getRange = (...args) => {
        const r = rangoDe(...args);
        r[metodo] = () => { throw new Error(metodo + ' falló'); };
        return r;
      };
      return hoja;
    };
    return ss;
  };
}

test('E1: si falla la nota después de sumar, el guardado cuenta y el reintento no suma de nuevo', () => {
  const { ctx, servicios, fila } = entorno();
  romper(servicios, 'PERSONAL', 'setNote');
  const envio = { idEnvio: 'e1-nota', hoja: 'Gastos', fecha: '2026-10-11', categoria: 'Alquiler', monto: '8000', descripcion: 'Expensas' };

  const r1 = ctx.guardarMovimientoPersonal(Object.assign({}, envio));
  assert.match(r1, /sin la nota/);
  const r2 = ctx.guardarMovimientoPersonal(Object.assign({}, envio));
  assert.match(r2, /Ya estaba guardado/);
  assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][10], 9000);
});

test('E1: si falla el link del comprobante, el gasto cuenta y el reintento no duplica la fila', () => {
  const { ctx, servicios, base } = entorno();
  ctx.guardarComprobante = () => 'https://drive.google.com/file/d/x/view';
  romper(servicios, base.ID_PLANILLA, 'setFormula');
  const envio = { idEnvio: 'e1-link', fecha: '2026-10-11', categoria: 'Almacen', detalle: 'Limpieza', monto: 2000, pagadoPor: 'Marcos', division: '50/50', comprobante: { nombre: 'a.png', tipo: 'image/png', datos: 'AAAA' } };

  const r1 = ctx.guardarGasto(Object.assign({}, envio));
  assert.match(r1, /sin el link/);
  ctx.guardarGasto(Object.assign({}, envio));
  assert.equal(servicios.hoja(base.ID_PLANILLA, base.HOJA_GASTOS).slice(1).length, 1);
});

test('E2: la personal suma un monto guardado como texto', () => {
  const { ctx, servicios, fila } = entorno('1500');
  ctx.guardarMovimientoPersonal({ idEnvio: 'e2', hoja: 'Gastos', fecha: '2026-10-11', categoria: 'Alquiler', monto: '8000' });
  assert.equal(servicios.hoja('PERSONAL', 'Gastos')[fila][10], 9500);
});
