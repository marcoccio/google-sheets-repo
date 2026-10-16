// #61: los comprobantes se llamaban "<detalle> - <archivo>", sin fecha.
// Ahora "AAAA-MM-DD <detalle> - <archivo>", con la fecha del movimiento, y la
// fecha se valida antes de crear el archivo (si no, queda suelto en Drive).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarServidor } = require('./arnes.js');
const { crearServicios } = require('./planilla_falsa.js');

function entorno() {
  const base = cargarServidor();
  const s = crearServicios({ [base.ID_PLANILLA]: {
    [base.HOJA_GASTOS]: [['Fecha', 'Categoría', 'Detalle', 'Descripción', 'Monto', 'Pagado por', 'División']],
    [base.HOJA_PAGOS_SERV]: [['Fecha', 'Servicio', 'Mes', 'Monto', 'Pagado por']],
    [base.HOJA_INGRESOS]: [['Fecha', 'Concepto', 'Monto', 'Recibido por']] } });
  const archivos = [];
  const carpeta = { createFile: blob => { archivos.push(blob.nombre); return { setSharing() {}, getUrl: () => 'https://drive/x' }; } };
  const ctx = cargarServidor(['Código.js'], {
    ...s,
    Utilities: { ...s.Utilities, base64Decode: () => [], newBlob: (bytes, tipo, nombre) => ({ nombre }) },
    DriveApp: { getFoldersByName: () => ({ hasNext: () => true, next: () => carpeta }), createFolder: () => carpeta,
                Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 } }
  });
  return { ctx, archivos };
}
const foto = { nombre: 'IMG_1234.jpg', tipo: 'image/jpeg', datos: 'AAAA' };

test('#61: el comprobante de un gasto lleva la fecha del gasto adelante', () => {
  const { ctx, archivos } = entorno();
  ctx.guardarGasto({ fecha: '2026-10-11', categoria: 'Verduleria', detalle: 'Verduras', descripcion: '',
                     monto: '8000', pagadoPor: 'Flor', division: '50/50', comprobante: foto });
  assert.deepEqual(archivos, ['2026-10-11 Verduras - IMG_1234.jpg']);
});

test('#61: igual en servicios e ingresos', () => {
  const { ctx, archivos } = entorno();
  ctx.guardarServicio({ fecha: '2026-10-05', servicio: 'Internet', mes: 'Octubre', monto: '44000', pagadoPor: 'Marcos', comprobante: foto });
  ctx.guardarIngreso({ fecha: '2026-10-01', concepto: 'Sueldo', descripcion: '', monto: '100', recibidoPor: 'Marcos', comprobante: foto });
  assert.deepEqual(archivos, ['2026-10-05 Internet Octubre - IMG_1234.jpg', '2026-10-01 Sueldo - IMG_1234.jpg']);
});

test('#61: con una fecha inválida no se crea ningún archivo', () => {
  const { ctx, archivos } = entorno();
  assert.throws(() => ctx.guardarGasto({ fecha: '2026-13-45', categoria: 'Varios', detalle: 'Otros', descripcion: '',
                                         monto: '10', pagadoPor: 'Marcos', division: '50/50', comprobante: foto }), /Fecha invalida/);
  assert.deepEqual(archivos, []);
});
