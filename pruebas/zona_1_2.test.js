// 1.2 (#5): el script y la planilla van en la zona de Mendoza, las dos juntas.
// La zona del script viaja en el manifiesto de cada version desplegada: si
// queda en UTC con la planilla en Mendoza, cada fecha nueva se corre un dia.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('1.2: el manifiesto del script esta en America/Argentina/Mendoza', () => {
  const manifiesto = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'apps-script', 'appsscript.json'), 'utf8'));
  assert.equal(manifiesto.timeZone, 'America/Argentina/Mendoza');
});
