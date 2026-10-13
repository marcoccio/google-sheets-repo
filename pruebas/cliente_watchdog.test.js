const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cargarHtml,
  crearDocumento,
  crearSelect
} = require('./arnes.js');

function crearAmbiente(globalesPersonalizados = {}) {
  let siguienteId = 1;
  const temporizadores = [];

  function setTimeoutFake(fn, ms = 0) {
    const id = siguienteId++;
    temporizadores.push({ id, fn, ms: Number(ms) || 0 });
    return id;
  }

  function clearTimeoutFake(id) {
    const idx = temporizadores.findIndex(t => t.id === id);
    if (idx !== -1) {
      temporizadores.splice(idx, 1);
    }
  }

  function disparar(filtro = () => true) {
    let ejecutado = true;
    while (ejecutado) {
      ejecutado = false;
      const idx = temporizadores.findIndex(filtro);
      if (idx !== -1) {
        const [t] = temporizadores.splice(idx, 1);
        t.fn();
        ejecutado = true;
      }
    }
  }

  let recargas = 0;
  const locationFake = {
    reload: () => {
      recargas++;
    }
  };

  const globales = {
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    location: locationFake,
    ...globalesPersonalizados
  };

  const ctx = cargarHtml('Web.html', globales);

  async function esperarTicks(n = 5) {
    for (let i = 0; i < n; i++) {
      await new Promise(r => setImmediate(r));
    }
  }

  return {
    ctx,
    temporizadores,
    disparar,
    obtenerRecargas: () => recargas,
    esperarTicks
  };
}

test('C1: el reintento después del timeout reusa idEnvio', async () => {
  const { ctx, disparar, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  disparar(t => t.ms >= 15000);

  ctx.enviarGasto();
  await esperarTicks();

  const envios = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(envios.length, 2, 'Deben registrarse 2 llamadas a guardarGasto');

  const id1 = envios[0].args[0]?.idEnvio;
  const id2 = envios[1].args[0]?.idEnvio;

  assert.equal(typeof id1, 'string');
  assert.notEqual(id1, '');
  assert.equal(typeof id2, 'string');
  assert.notEqual(id2, '');
  assert.equal(id2, id1);
});

test('C1: después de un éxito, otro idEnvio', async () => {
  const { ctx, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  const llamada1 = ctx.llamadas.find(ll => ll.nombre === 'guardarGasto');
  assert.ok(llamada1, 'Debe registrarse la primera llamada a guardarGasto');
  llamada1.exito('Gasto cargado');
  await esperarTicks();

  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  const envios = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(envios.length, 2, 'Deben registrarse 2 llamadas a guardarGasto');

  const id1 = envios[0].args[0]?.idEnvio;
  const id2 = envios[1].args[0]?.idEnvio;

  assert.equal(typeof id1, 'string');
  assert.notEqual(id1, '');
  assert.equal(typeof id2, 'string');
  assert.notEqual(id2, '');
  assert.notEqual(id1, id2);
});

// Regla cambiada en #44: un fallo puede ser de red DESPUES de escribir; el
// servidor solo graba la clave si el guardado termino bien, asi que reusar el
// id es seguro si el anterior fallo de verdad.
test('C1: después de un fallo del servidor, el reintento reusa idEnvio', async () => {
  const { ctx, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  const llamada1 = ctx.llamadas.find(ll => ll.nombre === 'guardarGasto');
  assert.ok(llamada1, 'Debe registrarse la primera llamada a guardarGasto');
  llamada1.fallo({ message: 'x' });
  await esperarTicks();

  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  const envios = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(envios.length, 2, 'Deben registrarse 2 llamadas a guardarGasto');

  const id1 = envios[0].args[0]?.idEnvio;
  const id2 = envios[1].args[0]?.idEnvio;

  assert.equal(typeof id1, 'string');
  assert.notEqual(id1, '');
  assert.equal(typeof id2, 'string');
  assert.notEqual(id2, '');
  assert.equal(id1, id2);
});

test('C1: mensaje del timeout', async () => {
  const { ctx, disparar, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  disparar(t => t.ms >= 15000);

  const aviso = ctx.document.getElementById('aviso');
  assert.match(aviso.textContent, /Reintentar no duplica/);
});

test('C1: 45 s con adjunto', async () => {
  class FakeFileReader {
    readAsDataURL() {
      setImmediate(() => {
        this.result = 'data:image/jpeg;base64,AAAA';
        if (typeof this.onload === 'function') {
          this.onload();
        }
      });
    }
  }

  const { ctx, temporizadores, esperarTicks } = crearAmbiente({
    FileReader: FakeFileReader
  });

  ctx.document.getElementById('archGasto').files = [
    { name: 'a.jpg', size: 1000, type: 'image/jpeg' }
  ];
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  const reloj = temporizadores.find(t => t.ms >= 15000);
  assert.ok(reloj, 'Debe registrarse el reloj del watchdog');
  assert.equal(reloj.ms, 45000);
});

test('CONTROL: 15 s sin adjunto', async () => {
  const { ctx, temporizadores, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  const reloj = temporizadores.find(t => t.ms >= 15000);
  assert.ok(reloj, 'Debe registrarse el reloj del watchdog');
  assert.equal(reloj.ms, 15000);
});

test('M2: nunca recarga sola', async () => {
  const { ctx, disparar, obtenerRecargas, esperarTicks } = crearAmbiente();

  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();
  disparar(t => t.ms >= 15000);

  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();
  disparar(t => t.ms >= 15000);

  disparar();

  assert.equal(obtenerRecargas(), 0);
});

test('H3: el borrador conserva quién pagó y la fecha', () => {
  const S = new Map();
  S.getItem = key => (S.has(String(key)) ? S.get(String(key)) : null);
  S.setItem = (key, val) => S.set(String(key), String(val));
  S.removeItem = key => S.delete(String(key));

  // Página 1
  const doc1 = crearDocumento();
  const pagadoPor1 = crearSelect('pagadoPor', ['Marcos', 'Flor'], 1);
  doc1.elementos.set('pagadoPor', pagadoPor1);
  doc1.getElementById('monto').value = '45000';
  doc1.getElementById('fecha').value = '2026-10-05';

  const ctx1 = cargarHtml('Web.html', {
    document: doc1,
    sessionStorage: S
  });

  ctx1.guardarBorrador();

  // Página 2
  const doc2 = crearDocumento();
  const pagadoPor2 = crearSelect('pagadoPor', ['Marcos', 'Flor'], 0);
  doc2.elementos.set('pagadoPor', pagadoPor2);

  const ctx2 = cargarHtml('Web.html', {
    document: doc2,
    sessionStorage: S
  });

  ctx2.dispararEvento('load');

  const llamadaOpciones = ctx2.llamadas.find(ll => ll.nombre === 'obtenerOpciones');
  assert.ok(llamadaOpciones, 'Debe registrarse la llamada a obtenerOpciones');

  const datosMinimos = {
    yo: { nombre: 'Marcos', seguro: true, mail: 'marcos@example.com' },
    categorias: [],
    servicios: [],
    meses: [],
    personales: { Gastos: [] },
    conceptosIngreso: [],
    detalles: {}
  };

  llamadaOpciones.exito(datosMinimos);

  assert.equal(doc2.getElementById('monto').value, '45000');
  assert.equal(doc2.getElementById('pagadoPor').value, 'Flor');
  assert.equal(doc2.getElementById('fecha').value, '2026-10-05');
});

test('H3: avisa que el comprobante no se recupera', () => {
  const S = new Map();
  S.getItem = key => (S.has(String(key)) ? S.get(String(key)) : null);
  S.setItem = (key, val) => S.set(String(key), String(val));
  S.removeItem = key => S.delete(String(key));

  // Página 1
  const doc1 = crearDocumento();
  const pagadoPor1 = crearSelect('pagadoPor', ['Marcos', 'Flor'], 1);
  doc1.elementos.set('pagadoPor', pagadoPor1);
  doc1.getElementById('monto').value = '45000';
  doc1.getElementById('fecha').value = '2026-10-05';
  doc1.getElementById('archGasto').files = [
    { name: 'recibo.pdf', size: 1000, type: 'application/pdf' }
  ];

  const ctx1 = cargarHtml('Web.html', {
    document: doc1,
    sessionStorage: S
  });

  ctx1.guardarBorrador();

  // Página 2
  const doc2 = crearDocumento();
  const pagadoPor2 = crearSelect('pagadoPor', ['Marcos', 'Flor'], 0);
  doc2.elementos.set('pagadoPor', pagadoPor2);

  const ctx2 = cargarHtml('Web.html', {
    document: doc2,
    sessionStorage: S
  });

  ctx2.dispararEvento('load');

  const llamadaOpciones = ctx2.llamadas.find(ll => ll.nombre === 'obtenerOpciones');
  assert.ok(llamadaOpciones, 'Debe registrarse la llamada a obtenerOpciones');

  const datosMinimos = {
    yo: { nombre: 'Marcos', seguro: true, mail: 'marcos@example.com' },
    categorias: [],
    servicios: [],
    meses: [],
    personales: { Gastos: [] },
    conceptosIngreso: [],
    detalles: {}
  };

  llamadaOpciones.exito(datosMinimos);

  const aviso = doc2.getElementById('aviso');
  assert.match(aviso.textContent, /comprobante/i);
});

test('C1: si la respuesta llega después del timeout, el reintento reusa idEnvio', async () => {
  const { ctx, disparar, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  disparar(t => t.ms >= 15000);
  ctx.llamadas[ctx.llamadas.length - 1].exito('Gasto cargado'); // llega tarde

  ctx.enviarGasto();
  await esperarTicks();

  const envios = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(envios.length, 2);
  assert.equal(envios[1].args[0].idEnvio, envios[0].args[0].idEnvio);
});

test('C1: si cambia el contenido después del timeout, otro idEnvio', async () => {
  const { ctx, disparar, esperarTicks } = crearAmbiente();
  ctx.document.getElementById('monto').value = '8000';
  ctx.enviarGasto();
  await esperarTicks();

  disparar(t => t.ms >= 15000);
  ctx.document.getElementById('monto').value = '9000';
  ctx.enviarGasto();
  await esperarTicks();

  const envios = ctx.llamadas.filter(ll => ll.nombre === 'guardarGasto');
  assert.equal(envios.length, 2);
  assert.notEqual(envios[1].args[0].idEnvio, envios[0].args[0].idEnvio);
});

function almacenamiento() {
  const S = new Map();
  S.getItem = k => (S.has(String(k)) ? S.get(String(k)) : null);
  S.setItem = (k, v) => S.set(String(k), String(v));
  S.removeItem = k => S.delete(String(k));
  return S;
}

const OPCIONES_MINIMAS = {
  yo: { nombre: 'Marcos', seguro: true, mail: 'marcos@example.com' },
  categorias: [], servicios: [], meses: [], personales: { Gastos: [] },
  conceptosIngreso: [], detalles: {}
};

test('M2: con dos cortes seguidos aparece Recargar, y recarga solo al tocarlo', async () => {
  const { ctx, disparar, esperarTicks, obtenerRecargas } = crearAmbiente();
  const boton = ctx.document.getElementById('btnRecargar');
  boton.classList.add('oculto'); // como en el HTML
  ctx.document.getElementById('monto').value = '8000';

  for (let i = 0; i < 2; i++) {
    ctx.enviarGasto();
    await esperarTicks();
    disparar(t => t.ms >= 15000);
  }
  disparar();

  assert.equal(boton.classList.contains('oculto'), false);
  assert.equal(obtenerRecargas(), 0);
  ctx.recargar();
  assert.equal(obtenerRecargas(), 1);
});

test('C1: después de tocar Recargar, el reintento del mismo gasto reusa idEnvio', async () => {
  const S = almacenamiento();

  const p1 = crearAmbiente({ sessionStorage: S });
  p1.ctx.document.getElementById('monto').value = '8000';
  p1.ctx.document.getElementById('fecha').value = '2026-10-11';
  p1.ctx.enviarGasto();
  await p1.esperarTicks();
  p1.disparar(t => t.ms >= 15000);
  p1.ctx.recargar();

  const p2 = crearAmbiente({ sessionStorage: S });
  p2.ctx.dispararEvento('load');
  p2.ctx.llamadas.find(ll => ll.nombre === 'obtenerOpciones').exito(OPCIONES_MINIMAS);
  assert.equal(p2.ctx.document.getElementById('monto').value, '8000');
  p2.ctx.enviarGasto();
  await p2.esperarTicks();

  const id1 = p1.ctx.llamadas.find(ll => ll.nombre === 'guardarGasto').args[0].idEnvio;
  const id2 = p2.ctx.llamadas.find(ll => ll.nombre === 'guardarGasto').args[0].idEnvio;
  assert.equal(id2, id1);
});

test('C1: si había comprobante, el reintento después de Recargar (ya sin él) reusa idEnvio', async () => {
  class LectorFalso {
    readAsDataURL() {
      setImmediate(() => { this.result = 'data:image/jpeg;base64,AAAA'; this.onload(); });
    }
  }
  const S = almacenamiento();

  const p1 = crearAmbiente({ sessionStorage: S, FileReader: LectorFalso });
  p1.ctx.document.getElementById('monto').value = '8000';
  p1.ctx.document.getElementById('fecha').value = '2026-10-11';
  p1.ctx.document.getElementById('archGasto').files = [{ name: 'a.jpg', size: 1000, type: 'image/jpeg' }];
  p1.ctx.enviarGasto();
  await p1.esperarTicks();
  p1.disparar(t => t.ms >= 45000);
  p1.ctx.recargar();

  const p2 = crearAmbiente({ sessionStorage: S });
  p2.ctx.dispararEvento('load');
  p2.ctx.llamadas.find(ll => ll.nombre === 'obtenerOpciones').exito(OPCIONES_MINIMAS);
  p2.ctx.enviarGasto();
  await p2.esperarTicks();

  const id1 = p1.ctx.llamadas.find(ll => ll.nombre === 'guardarGasto').args[0].idEnvio;
  const id2 = p2.ctx.llamadas.find(ll => ll.nombre === 'guardarGasto').args[0].idEnvio;
  assert.equal(id2, id1);
});
