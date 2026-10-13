// #59: Enter en el monto movía el foco al desplegable y lo intentaba abrir con
// showPicker(), que el iframe de Apps Script bloquea: la pantalla quedaba
// trabada. Decisión de Marcos (13/10/2026): Enter solo cierra el teclado.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml, crearDocumento } = require('./arnes.js');

function pantalla() {
  const doc = crearDocumento();
  const registro = [];
  const listeners = {};
  for (const id of ['monto', 'montoServicio', 'montoIngreso', 'montoPersonal']) {
    const el = doc.getElementById(id);
    el.addEventListener = (tipo, fn) => { listeners[id + ':' + tipo] = fn; };
    el.blur = () => registro.push(id + '.blur');
  }
  for (const id of ['categoria', 'servicio', 'conceptoIngreso', 'categoriaPersonal']) {
    const el = doc.getElementById(id);
    el.focus = () => registro.push(id + '.focus');
    el.showPicker = () => registro.push(id + '.showPicker');
  }
  const relojes = [];
  const ctx = cargarHtml('Web.html', {
    document: doc,
    setTimeout: fn => { relojes.push(fn); return relojes.length; },
    clearTimeout: () => {}
  });
  ctx.dispararEvento('load');
  return { listeners, registro, relojes };
}

for (const id of ['monto', 'montoServicio', 'montoIngreso', 'montoPersonal']) {
  test(`#59: Enter en ${id} solo cierra el teclado`, () => {
    const { listeners, registro, relojes } = pantalla();
    const tecla = listeners[id + ':keydown'];
    let prevenido = false;
    if (tecla) tecla({ key: 'Enter', preventDefault: () => { prevenido = true; } });
    relojes.splice(0).forEach(fn => fn());
    assert.deepEqual(registro, [id + '.blur'], 'Enter no debe mover el foco ni abrir el desplegable');
    assert.ok(prevenido, 'Enter no debe enviar nada por defecto');
  });
}
