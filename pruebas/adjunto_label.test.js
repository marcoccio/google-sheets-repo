const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargarHtml, crearDocumento } = require('./arnes.js');

const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'apps-script', 'Web.html'), 'utf8');

async function esperar(vueltas = 5) {
  for (let i = 0; i < vueltas; i++) {
    await new Promise(r => setImmediate(r));
  }
}

/**
 * En el navegador, asignar textContent a un elemento borra sus hijos. El
 * <input type="file"> vive dentro de su <label>: si el codigo le pisa el
 * texto al label, el input desaparece y getElementById devuelve null (#66).
 */
function documentoConLabels(pares) {
  const doc = crearDocumento();
  const borrados = new Set();
  const obtener = doc.getElementById.bind(doc);
  doc.getElementById = id => (borrados.has(id) ? null : obtener(id));

  for (const [idLabel, idInput] of pares) {
    const bloque = HTML.match(new RegExp(`<label[^>]*id="${idLabel}"[\\s\\S]*?</label>`))[0];
    assert.match(bloque, new RegExp(`id="${idInput}"`), `${idInput} esta dentro de ${idLabel}`);
    Object.defineProperty(obtener(idLabel), 'textContent', {
      get: () => '',
      set: () => borrados.add(idInput)
    });
  }
  return doc;
}

const PARES = [['lblGasto', 'archGasto'], ['lblServicio', 'archServicio'], ['lblIngreso', 'archIngreso']];

test('#66: un gasto despues de otro llega al servidor', async () => {
  const ctx = cargarHtml('Web.html', { document: documentoConLabels(PARES) });

  ctx.document.getElementById('monto').value = '1000';
  ctx.enviarGasto();
  await esperar();
  const gastos = () => ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(gastos().length, 1);
  gastos()[0].exito('Gasto cargado');

  ctx.document.getElementById('monto').value = '2000';
  ctx.enviarGasto();
  await esperar();
  assert.equal(gastos().length, 2);
});

test('#66: el comprobante adjuntado llega al servidor', async () => {
  const ctx = cargarHtml('Web.html', { document: documentoConLabels(PARES) });

  ctx.document.getElementById('archGasto').files = [{ name: 'ticket.jpg', size: 10, type: 'image/jpeg' }];
  ctx.marcarAdjunto('archGasto', 'lblGasto');
  assert.ok(ctx.document.getElementById('archGasto'), 'el input sigue en la pagina');
});
