// D-c (#4): el BCRA dio de baja la API v3 (HTTP 410) y el ICL quedo en #ERROR!.
// El BCRA falso reproduce la forma real de la v4, verificada el 12/10/2026:
// listado paginado (count 1610, limit por defecto 1000) y la serie en
// results[0].detalle[], de la fecha mas nueva a la mas vieja.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');

const BASE = 'https://api.bcra.gob.ar/estadisticas/';

const VARIABLES = [];
for (let i = 1; i <= 1200; i++) {
  VARIABLES.push({ idVariable: i + 100, descripcion: 'Variable ' + i });
}
VARIABLES.push({ idVariable: 75, descripcion: 'Oro, divisas, colocaciones a plazo y otros activos de reserva' });
VARIABLES.push({ idVariable: 40, descripcion: 'Índice para Contratos de Locación (base 30.6.20=1)' });

const SERIE_ICL = [
  { fecha: '2026-10-12', valor: 36.79 },
  { fecha: '2026-07-01', valor: 34.5 },
  { fecha: '2026-05-01', valor: 32.13 }
];

function bcraFalso() {
  const pedidos = [];
  function fetch(url) {
    pedidos.push(url);
    const u = new URL(url);
    if (u.pathname.includes('/v3.0/')) {
      throw new Error('Request failed for https://api.bcra.gob.ar returned code 410');
    }
    let cuerpo;
    if (u.pathname === '/estadisticas/v4.0/Monetarias') {
      const offset = Number(u.searchParams.get('offset') || 0);
      const limit = Math.min(Number(u.searchParams.get('limit') || 1000), 3000);
      cuerpo = {
        status: 200,
        metadata: { resultset: { count: VARIABLES.length, offset, limit } },
        results: VARIABLES.slice(offset, offset + limit)
      };
    } else if (u.pathname === '/estadisticas/v4.0/Monetarias/40') {
      const desde = u.searchParams.get('desde');
      const hasta = u.searchParams.get('hasta');
      const detalle = SERIE_ICL.filter(p => p.fecha >= desde && p.fecha <= hasta);
      cuerpo = {
        status: 200,
        metadata: { resultset: { count: detalle.length, offset: 0, limit: 1000 } },
        results: [{ idVariable: 40, detalle }]
      };
    } else {
      throw new Error('URL no esperada: ' + url);
    }
    return { getContentText: () => JSON.stringify(cuerpo) };
  }
  return { fetch, pedidos };
}

// La fecha la arma la planilla en SU zona (DATE(2026;5;1) = medianoche en esa
// zona). Indices.js tiene que formatearla en esa misma zona (#47).
function cargar(zonaPlanilla = 'America/Argentina/Mendoza') {
  const bcra = bcraFalso();
  const ctx = cargarServidor(['Indices.js'], {
    UrlFetchApp: { fetch: bcra.fetch },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => zonaPlanilla }) },
    Utilities: {
      formatDate: (fecha, zona, formato) => {
        assert.equal(formato, 'yyyy-MM-dd');
        // Apps Script acepta 'GMT-3'; Intl lo escribe 'Etc/GMT+3' (signo invertido).
        const tz = zona === 'GMT-3' ? 'Etc/GMT+3' : zona;
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(fecha);
      }
    }
  });
  return { ctx, pedidos: bcra.pedidos };
}

test('idVariableICL encuentra el ICL aunque este en la segunda pagina del listado', () => {
  const { ctx } = cargar();
  assert.equal(ctx.idVariableICL(), 40);
});

test('iclAcumulado usa la API v4 y da el cociente entre el ultimo y el primer valor', () => {
  const { ctx, pedidos } = cargar();
  // Mediodia UTC: el mismo dia en GMT-3, sin depender de la zona del host.
  const desde = new Date(Date.UTC(2026, 4, 1, 12));
  const r = ctx.iclAcumulado(desde);
  assert.ok(Math.abs(r - (36.79 / 32.13 - 1)) < 1e-12, 'dio ' + r);
  assert.ok(pedidos.every(u => !u.includes('/v3.0/')), 'sigue llamando a la v3');
});

test('icl devuelve el valor de una fecha puntual', () => {
  const { ctx } = cargar();
  assert.equal(ctx.icl(new Date(Date.UTC(2026, 6, 1, 12))), 34.5);
});

test('#47: con la planilla en UTC, el 01/05 se consulta como 2026-05-01 y no como 30/04', () => {
  const { ctx, pedidos } = cargar('Etc/UTC');
  ctx.iclAcumulado(new Date(Date.UTC(2026, 4, 1))); // DATE(2026;5;1) en una planilla en UTC
  const serie = pedidos.find(u => u.includes('/Monetarias/40'));
  assert.match(serie, /desde=2026-05-01/);
});
