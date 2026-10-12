const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml } = require('./arnes.js');

async function esperar(vueltas = 5) {
  for (let i = 0; i < vueltas; i++) {
    await new Promise(r => setImmediate(r));
  }
}

test('H2: archivo de 9 MB', async () => {
  const ctx = cargarHtml('Web.html', {
    setTimeout: () => {},
    clearTimeout: () => {}
  });

  ctx.document.getElementById('monto').value = '8000';
  ctx.document.getElementById('archGasto').files = [{
    name: 'ticket.jpg',
    size: 9 * 1024 * 1024,
    type: 'image/jpeg'
  }];

  ctx.enviarGasto();
  await esperar();

  assert.match(ctx.document.getElementById('aviso').className, /error/);
  assert.match(ctx.document.getElementById('aviso').textContent, /8 MB/);
  const llamadasGasto = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(llamadasGasto.length, 0);
});

test('H2: falla la lectura', async () => {
  class FakeFileReaderError {
    readAsDataURL() {
      setImmediate(() => {
        if (this.onerror) this.onerror();
      });
    }
  }

  const ctx = cargarHtml('Web.html', {
    setTimeout: () => {},
    clearTimeout: () => {},
    FileReader: FakeFileReaderError
  });

  ctx.document.getElementById('monto').value = '8000';
  ctx.document.getElementById('archGasto').files = [{
    name: 'ticket.jpg',
    size: 1 * 1024 * 1024,
    type: 'image/jpeg'
  }];

  ctx.enviarGasto();
  await esperar();

  const llamadasGasto = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(llamadasGasto.length, 0);
  assert.match(ctx.document.getElementById('aviso').className, /error/);
});

test('CONTROL: adjunto válido', async () => {
  class FakeFileReaderValido {
    readAsDataURL() {
      setImmediate(() => {
        this.result = 'data:image/jpeg;base64,AAAA';
        if (this.onload) this.onload();
      });
    }
  }

  const ctx = cargarHtml('Web.html', {
    setTimeout: () => {},
    clearTimeout: () => {},
    FileReader: FakeFileReaderValido
  });

  ctx.document.getElementById('monto').value = '8000';
  ctx.document.getElementById('archGasto').files = [{
    name: 'ticket.jpg',
    size: 1 * 1024 * 1024,
    type: 'image/jpeg'
  }];

  ctx.enviarGasto();
  await esperar();

  const llamadasGasto = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(llamadasGasto.length, 1);
  assert.equal(llamadasGasto[0].args[0].monto, '8000');
  assert.equal(llamadasGasto[0].args[0].comprobante.nombre, 'ticket.jpg');
  assert.equal(llamadasGasto[0].args[0].comprobante.tipo, 'image/jpeg');
  assert.equal(llamadasGasto[0].args[0].comprobante.datos, 'AAAA');
});
