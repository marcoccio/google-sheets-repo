process.env.TZ = 'America/Argentina/Mendoza';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarHtml } = require('./arnes.js');

function fechaFija(iso) {
  const tiempoFijo = new Date(iso).getTime();
  return class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(tiempoFijo);
      } else {
        super(...args);
      }
    }
    static now() {
      return tiempoFijo;
    }
  };
}

function probarHora(hora) {
  const iso = `2026-10-11T${hora}:00-03:00`;
  const FechaFija = fechaFija(iso);
  const globales = {
    Date: FechaFija,
    setTimeout: () => {},
    clearTimeout: () => {}
  };

  const ctxWeb = cargarHtml('Web.html', globales);
  ctxWeb.dispararEvento('load');

  assert.equal(ctxWeb.document.getElementById('fecha').value, '2026-10-11');
  assert.equal(ctxWeb.document.getElementById('fechaServicio').value, '2026-10-11');
  assert.equal(ctxWeb.document.getElementById('fechaIngreso').value, '2026-10-11');
  assert.equal(ctxWeb.document.getElementById('fechaPersonal').value, '2026-10-11');
  assert.equal(ctxWeb.document.getElementById('hasta').value, '2026-10-11');
  assert.equal(ctxWeb.document.getElementById('desde').value, '2026-09-11');

  ctxWeb.document.getElementById('fecha').value = '';
  assert.equal(ctxWeb.fechaDe('fecha'), '2026-10-11');
}

test('CONTROL: hora 15:00 en Mendoza', () => {
  probarHora('15:00');
});

test('H1: hora 21:00 en Mendoza', () => {
  probarHora('21:00');
});

test('H1: hora 22:30 en Mendoza', () => {
  probarHora('22:30');
});

test('H1: hora 23:59 en Mendoza', () => {
  probarHora('23:59');
});
