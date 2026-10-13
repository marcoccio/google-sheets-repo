// #60: tocar el campo de fecha no abría el calendario (solo el ícono).
// Decisión de Marcos (13/10/2026): tocar en cualquier parte del campo abre el
// calendario nativo. Es CSS: esta prueba solo verifica que la regla esté; que
// funcione se confirma en el teléfono.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Web.html'), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const regla = sel => {
  const i = css.indexOf(sel);
  return i === -1 ? '' : css.slice(i, css.indexOf('}', i)).replace(/\s+/g, ' ');
};

test('#60: el campo de fecha es la referencia del indicador', () => {
  assert.match(regla('input[type="date"] {'), /position: relative/);
});

test('#60: el indicador del calendario cubre todo el campo, transparente', () => {
  const r = regla('input[type="date"]::-webkit-calendar-picker-indicator');
  assert.match(r, /position: absolute/);
  assert.match(r, /inset: 0/);
  assert.match(r, /width: auto/);
  assert.match(r, /height: auto/);
  assert.match(r, /opacity: 0/);
});
