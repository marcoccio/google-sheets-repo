// Origen: revision de Claude Desktop del 13/10/2026 (#44).
// C1-red: si la red se cae DESPUÉS de que el servidor escribió, el reintento
// no tiene que duplicar. Prueba de punta a punta: Web.html real -> Código.js
// real -> planilla simulada. Falla hasta que el cliente deje de liberar el
// idEnvio en el withFailureHandler.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml, cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function servidor() {
  const base = cargarServidor(['Código.js'], {});
  const servicios = crearServicios({ [base.ID_PLANILLA]: {
    [base.HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']] } });
  const ctx = cargarServidor(['Código.js'], servicios);
  const montos = () => servicios.hoja(ctx.ID_PLANILLA, ctx.HOJA_GASTOS).slice(1).map(f => f[4]);
  return { ctx, montos };
}

function cliente() {
  let n = 1;
  const ctx = cargarHtml('Web.html', {
    setTimeout: () => n++, clearTimeout: () => {}, location: { reload() {} }
  });
  const ticks = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
  return { ctx, ticks };
}

test('C1-red: falla de red después de escribir, el reintento no duplica', async () => {
  const s = servidor(), c = cliente();

  c.ctx.document.getElementById('monto').value = '8000';
  c.ctx.enviarGasto(); await c.ticks();
  const primera = c.ctx.llamadas.filter(x => x.nombre === 'guardarGasto').at(-1);
  s.ctx.guardarGasto(primera.args[0]);                       // el servidor escribe...
  primera.fallo({ name: 'NetworkError',                     // ...y la respuesta se pierde
                  message: 'NetworkError: Connection failure due to HTTP 0' });
  await c.ticks();

  c.ctx.document.getElementById('monto').value = '8000';    // el usuario reintenta lo mismo
  c.ctx.enviarGasto(); await c.ticks();
  const segunda = c.ctx.llamadas.filter(x => x.nombre === 'guardarGasto').at(-1);
  s.ctx.guardarGasto(segunda.args[0]);

  assert.deepEqual(s.montos(), [8000], 'C1-red: el gasto quedó duplicado');
});
