/**
 * Gastos depto - Marcos y Flor
 * v7: comprobantes, servicios que puede pagar cualquiera,
 *     y planilla de finanzas personales creada desde cero.
 */

var ID_PLANILLA = '1Q0cVQKTsfpsR3cZ7_OCCpGE2ur23AAbbTKXZhXys9Ag';

var HOJA_GASTOS = 'Gastos';
var HOJA_SERVICIOS = 'Servicios';
var HOJA_PAGOS_SERV = 'Pagos servicios';
var HOJA_LISTAS = 'Listas';
var HOJA_RESUMEN = 'Resumen';
var HOJA_INGRESOS = 'Ingresos';

var CLAVE_PERSONAL = 'ID_PLANILLA_PERSONAL';

var CONCEPTOS_INGRESO = ['Sueldo', 'Venta', 'Reintegro', 'Regalo', 'Ajuste', 'Otro'];

var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* Estructura de la planilla personal. */
var PERSONAL = {
  Gastos: {
    secciones: [
      ['GASTOS FIJOS', ['Alquiler', 'Servicios', 'Internet', 'Celular',
                        'Transporte', 'Comida', 'Salud', 'Otros fijos']],
      ['GASTOS VARIABLES', ['Ropa', 'Ocio', 'Regalos', 'Cuidado personal',
                            'Mascota', 'Otros variables']],
      ['GASTOS ÚNICOS', ['Muebles/Electro', 'Viajes', 'Reparaciones',
                         'Ajuste', 'Otros únicos']]
    ]
  },
  Ingresos: {
    secciones: [
      ['INGRESOS FIJOS', ['Sueldo', 'Alquileres cobrados', 'Otros fijos']],
      ['INGRESOS VARIABLES', ['Freelance', 'Ventas', 'Reintegros',
                              'Regalos recibidos', 'Intereses', 'Ajuste',
                              'Otros variables']]
    ]
  },
  Ahorros: {
    secciones: [
      ['EN PESOS', ['Caja de ahorro', 'Plazo fijo', 'Fondo money market',
                    'Otros pesos']],
      ['EN DÓLARES', ['Dólares billete', 'Dólar MEP', 'Otros dólares']],
      ['INVERSIONES', ['Acciones/CEDEARs', 'Bonos/Letras', 'Cripto',
                       'Otras inversiones']]
    ]
  }
};


function planilla() {
  return SpreadsheetApp.openById(ID_PLANILLA);
}


/* ---------- Entradas ---------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Web')
    .setTitle('Gastos depto')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Carga rápida')
    .addItem('Abrir panel', 'mostrarPanel')
    .addToUi();
}


function mostrarPanel() {
  var html = HtmlService.createHtmlOutputFromFile('Panel').setTitle('Cargar gasto');
  SpreadsheetApp.getUi().showSidebar(html);
}


/* ---------- Utilidades ---------- */

function ultimaFilaReal(hoja) {
  var valores = hoja.getRange('A1:A2000').getValues();
  for (var i = valores.length - 1; i >= 0; i--) {
    if (valores[i][0] !== '' && valores[i][0] !== null) return i + 1;
  }
  return 1;
}


function aFecha(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new Error('Fecha invalida: "' + texto + '".');
  }
  var p = texto.split('-');
  var ano = Number(p[0]);
  var mes = Number(p[1]);
  var dia = Number(p[2]);
  var fecha = new Date(ano, mes - 1, dia);
  if (fecha.getFullYear() !== ano || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    throw new Error('Fecha invalida: "' + texto + '".');
  }
  return fecha;
}


/**
 * Convierte lo que venga en un numero valido.
 * Acepta "15.000,50", "15000.50", "$ 15 000", "15,50".
 * Si no se puede interpretar, corta con un error claro en vez de
 * escribir NaN en la planilla.
 */
function aNumero(valor, campo) {
  var nombre = campo || 'monto';

  if (typeof valor === 'number') {
    if (!isFinite(valor)) throw new Error('El ' + nombre + ' no es un numero valido.');
    return valor;
  }

  var t = String(valor === null || valor === undefined ? '' : valor).trim();
  if (t === '') throw new Error('Falta el ' + nombre + '.');

  // Saca simbolos, espacios y todo lo que no sea digito, coma, punto o signo.
  t = t.replace(/[^\d,.\-]/g, '');
  if (t === '' || t === '-') throw new Error('El ' + nombre + ' no es un numero valido.');

  var coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');

  if (coma > -1 && punto > -1) {
    // El ultimo que aparece es el separador decimal.
    if (coma > punto) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (coma > -1) {
    // Una sola coma: decimal si deja 1 o 2 digitos, si no es separador de miles.
    var resto = t.length - coma - 1;
    t = (resto === 1 || resto === 2) ? t.replace(',', '.') : t.replace(/,/g, '');
  } else if (punto > -1) {
    // Un solo punto con 3 digitos atras es separador de miles en Argentina:
    // "15.000" son quince mil, no quince. Los montos con 3 decimales no
    // existen en pesos, asi que la regla es segura aca.
    var resto2 = t.length - punto - 1;
    var variosPuntos = t.indexOf('.') !== punto;
    if (variosPuntos || resto2 === 3) t = t.replace(/\./g, '');
  }

  var n = Number(t);
  if (!isFinite(n)) throw new Error('El ' + nombre + ' no es un numero valido.');

  return n;
}


/**
 * Escribe un numero en una celda y vuelve a leerla para confirmar.
 * Si no quedo, restaura el valor anterior antes de avisar: en la personal
 * las celdas acumulan, y un reintento sumaria sobre el valor malo.
 */
function escribirYVerificar(celda, valor, donde) {
  var anterior = celda.getValue();
  celda.setValue(valor);
  SpreadsheetApp.flush();

  var leido = celda.getValue();
  if (typeof leido !== 'number' || Math.abs(leido - valor) > 0.01) {
    celda.setValue(anterior);
    SpreadsheetApp.flush();
    var restaurado = celda.getValue();
    if (restaurado !== anterior) {
      throw new Error('No se pudo guardar en ' + (donde || 'la planilla') +
                      ' y la celda quedo con "' + restaurado + '". Revisala a mano antes de reintentar.');
    }
    throw new Error('No se pudo guardar en ' + (donde || 'la planilla') +
                    '. Quedo el valor anterior; no se guardo nada.');
  }
  return leido;
}


/**
 * Borra una fila recien escrita cuya relectura no coincidio y avisa.
 * Si la fila quedara, el reintento la duplicaria.
 * ponytail: si habia comprobante, el archivo queda huerfano en la carpeta de
 * comprobantes (el reintento sube otro). Borrarlo si llega a molestar.
 */
function deshacerFila(hoja, fila, columnas, queCosa) {
  hoja.getRange(fila, 1, 1, columnas).clearContent();
  SpreadsheetApp.flush();
  throw new Error(queCosa + ' no quedo bien escrito, asi que no se guardo. Proba de nuevo.');
}


function comoPlata(n) {
  var signo = n < 0 ? '-' : '';
  return signo + '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');
}


/* ---------- Comprobantes ---------- */

/**
 * Guarda un comprobante en el Drive de quien lo sube y devuelve el link.
 * El archivo queda visible para cualquiera que tenga el link, asi la
 * otra persona lo puede abrir desde la planilla.
 */
function guardarComprobante(archivo, nombreSugerido) {
  if (!archivo || !archivo.datos) return '';

  var carpeta = carpetaComprobantes();

  var blob = Utilities.newBlob(
    Utilities.base64Decode(archivo.datos),
    archivo.tipo || 'application/octet-stream',
    nombreSugerido + ' - ' + (archivo.nombre || 'comprobante')
  );

  var file = carpeta.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}


/** Carpeta "Comprobantes depto" en el Drive del usuario que accede. */
function carpetaComprobantes() {
  var nombre = 'Comprobantes depto';
  var carpetas = DriveApp.getFoldersByName(nombre);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(nombre);
}


/* ---------- Datos de apoyo ---------- */

/**
 * Categorías personales que se eligen a mano. Son constantes, no tocan la
 * planilla personal. "Ajuste" queda afuera: lo escribe solo la conciliación.
 */
function categoriasPersonales() {
  var personales = {};
  Object.keys(PERSONAL).forEach(function (hoja) {
    var lista = [];
    PERSONAL[hoja].secciones.forEach(function (s) { lista = lista.concat(s[1]); });
    personales[hoja] = lista.filter(function (c) { return c !== 'Ajuste'; });
  });
  return personales;
}


function obtenerOpciones() {
  var ss = planilla();
  var listas = ss.getSheetByName(HOJA_LISTAS);
  var servicios = ss.getSheetByName(HOJA_SERVICIOS);

  var datos = listas.getRange('A1:D12').getValues();
  var detalles = {};

  for (var col = 1; col < 4; col++) {
    var categoria = datos[0][col];
    if (!categoria) continue;
    var items = [];
    for (var fila = 1; fila < datos.length; fila++) {
      if (datos[fila][col] !== '' && datos[fila][col] !== null) {
        items.push(datos[fila][col]);
      }
    }
    detalles[categoria] = items;
  }

  var nombresServicios = [];
  var colA = servicios.getRange('A2:A10').getValues();
  for (var i = 0; i < colA.length; i++) {
    if (colA[i][0] !== '' && colA[i][0] !== null) nombresServicios.push(colA[i][0]);
  }

  var meses = servicios.getRange('B1:H1').getValues()[0].filter(function (m) {
    return m !== '' && m !== null;
  });

  var personales = categoriasPersonales();

  return {
    categorias: Object.keys(detalles),
    detalles: detalles,
    servicios: nombresServicios,
    meses: meses,
    personales: personales,
    conceptosIngreso: CONCEPTOS_INGRESO,
    yo: miNombre()
  };
}


function urlPlanilla() {
  return planilla().getUrl();
}


/**
 * Busca una fila del Resumen por su etiqueta en la columna A.
 * Antes usaba numeros de fila fijos: cuando el Resumen cambio,
 * quedaron apuntando a filas equivocadas.
 */
function filaResumen(hoja, etiqueta) {
  var col = hoja.getRange('A1:A40').getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim().toUpperCase() === etiqueta.toUpperCase()) return i + 1;
  }
  return -1;
}


function obtenerAcumulado() {
  var resumen = planilla().getSheetByName(HOJA_RESUMEN);
  var mesActual = MESES[new Date().getMonth()];

  var cabecera = resumen.getRange('B3:I3').getValues()[0];
  var col = -1;
  for (var i = 0; i < cabecera.length; i++) {
    if (cabecera[i] === mesActual) { col = i + 2; break; }
  }
  if (col === -1) return { mes: mesActual, marcos: '-', flor: '-' };

  function valor(etiqueta) {
    var f = filaResumen(resumen, etiqueta);
    return f === -1 ? '-' : resumen.getRange(f, col).getDisplayValue();
  }

  return {
    mes: mesActual,
    marcos: valor('Puso Marcos en el mes'),
    flor: valor('Puso Flor en el mes'),
    servicios: valor('Servicios del mes'),
    gastos: valor('TOTAL GASTOS DEL MES'),
    ingresos: valor('Ingresos del mes'),
    neto: valor('NETO DEL MES (ingresos - gastos)'),
    marcosAno: valor('ACUMULADO MARCOS'),
    florAno: valor('ACUMULADO FLOR')
  };
}


/* ---------- Quien soy ---------- */

var CLAVE_NOMBRE = 'MI_NOMBRE';

/**
 * Devuelve el nombre de quien esta usando la app.
 * Primero mira si ya eligio uno; si no, lo deduce del mail.
 */
function miNombre() {
  var props = PropertiesService.getUserProperties();
  var guardado = props.getProperty(CLAVE_NOMBRE);
  if (guardado) return { nombre: guardado, seguro: true, mail: mailUsuario() };

  var mail = mailUsuario();
  var texto = String(mail).toLowerCase();

  if (texto.indexOf('flor') !== -1) return { nombre: 'Flor', seguro: true, mail: mail };
  if (texto.indexOf('marcos') !== -1) return { nombre: 'Marcos', seguro: true, mail: mail };

  // No se pudo deducir: la app va a preguntar.
  return { nombre: 'Marcos', seguro: false, mail: mail };
}


function mailUsuario() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}


/** Guarda quien soy, para no volver a preguntar. */
function guardarMiNombre(nombre) {
  if (nombre !== 'Marcos' && nombre !== 'Flor') throw new Error('Nombre invalido.');
  PropertiesService.getUserProperties().setProperty(CLAVE_NOMBRE, nombre);
  return miNombre();
}


/* ---------- Guardar en la planilla compartida ---------- */

/**
 * Corre un guardado una sola vez por envio (C1).
 * Si el cliente corta la espera y reintenta, manda el mismo idEnvio: el
 * reintento espera el lock del primero y devuelve su resultado sin volver a
 * escribir. La clave se chequea y se graba dentro del lock, si no dos
 * intentos simultaneos escriben los dos. Los guardados que fallan no quedan
 * registrados, asi que se pueden reintentar.
 */
function unaVez(d, guardar) {
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);

  try {
    var cache = CacheService.getScriptCache();
    var clave = d && d.idEnvio ? 'envio:' + d.idEnvio : '';
    var previo = clave ? cache.get(clave) : null;
    // Distinto del guardado nuevo: quien queria cargar dos iguales se entera.
    if (previo !== null) return 'Ya estaba guardado. ' + previo;

    var resultado = guardar(d);
    if (clave) cache.put(clave, resultado, 21600);
    return resultado;
  } finally {
    candado.releaseLock();
  }
}

function guardarGasto(d) {
  return unaVez(d, escribirGasto_);
}

function escribirGasto_(d) {
  var monto = aNumero(d.monto);

  // Los ajustes de conciliacion pueden ser negativos (cuando la planilla
  // tiene de mas). El resto de los gastos, no.
  if (!d.permitirNegativo && monto <= 0) {
    throw new Error('El monto tiene que ser mayor a cero.');
  }
  if (monto === 0) throw new Error('El monto no puede ser cero.');

  var hoja = planilla().getSheetByName(HOJA_GASTOS);
  var fila = ultimaFilaReal(hoja) + 1;

  var link = guardarComprobante(d.comprobante, d.detalle || 'Gasto');

  hoja.getRange(fila, 1, 1, 7).setValues([[
    aFecha(d.fecha), d.categoria, d.detalle, d.descripcion,
    monto, d.pagadoPor, d.division
  ]]);

  SpreadsheetApp.flush();
  if (Number(hoja.getRange(fila, 5).getValue()) !== monto) {
    deshacerFila(hoja, fila, 7, 'El gasto');
  }

  if (link) hoja.getRange(fila, 12).setFormula('=HYPERLINK("' + link + '";"Ver")');

  return 'Gasto cargado: ' + d.detalle + ' ' + comoPlata(monto) +
         (link ? ' (con comprobante)' : '');
}


/**
 * Registra el pago de un servicio.
 * Ahora va al registro "Pagos servicios", con quien pago y comprobante.
 * La grilla de la hoja Servicios se actualiza sola.
 */
function guardarServicio(d) {
  return unaVez(d, escribirServicio_);
}

function escribirServicio_(d) {
  var monto = aNumero(d.monto);
  if (monto <= 0) throw new Error('El monto tiene que ser mayor a cero.');

  var hoja = planilla().getSheetByName(HOJA_PAGOS_SERV);
  var fila = ultimaFilaReal(hoja) + 1;

  var link = guardarComprobante(d.comprobante, d.servicio + ' ' + d.mes);

  hoja.getRange(fila, 1, 1, 5).setValues([[
    aFecha(d.fecha), d.servicio, d.mes, monto, d.pagadoPor
  ]]);

  SpreadsheetApp.flush();
  if (Number(hoja.getRange(fila, 4).getValue()) !== monto) {
    deshacerFila(hoja, fila, 5, 'El pago');
  }

  if (link) hoja.getRange(fila, 6).setFormula('=HYPERLINK("' + link + '";"Ver")');

  return d.servicio + ' de ' + d.mes + ': ' + comoPlata(monto) +
         ' (pagó ' + d.pagadoPor + ')' + (link ? ' con comprobante' : '');
}


function guardarIngreso(d) {
  return unaVez(d, escribirIngreso_);
}

function escribirIngreso_(d) {
  var monto = aNumero(d.monto);
  if (monto <= 0) throw new Error('El monto tiene que ser mayor a cero.');

  var hoja = planilla().getSheetByName(HOJA_INGRESOS);
  var fila = ultimaFilaReal(hoja) + 1;

  var link = guardarComprobante(d.comprobante, d.concepto || 'Ingreso');

  hoja.getRange(fila, 1, 1, 4).setValues([[
    aFecha(d.fecha),
    d.concepto + (d.descripcion ? ' - ' + d.descripcion : ''),
    monto,
    d.recibidoPor
  ]]);

  SpreadsheetApp.flush();
  if (Number(hoja.getRange(fila, 3).getValue()) !== monto) {
    deshacerFila(hoja, fila, 4, 'El ingreso');
  }

  if (link) hoja.getRange(fila, 5).setFormula('=HYPERLINK("' + link + '";"Ver")');

  return 'Ingreso cargado: ' + d.concepto + ' ' + comoPlata(monto);
}


/* ---------- Planilla personal ---------- */

function idPersonal() {
  return PropertiesService.getUserProperties().getProperty(CLAVE_PERSONAL);
}


function planillaPersonal() {
  var id = idPersonal();
  if (!id) throw new Error('Todavía no creaste tu planilla personal.');
  return SpreadsheetApp.openById(id);
}


function estadoPersonal() {
  var id = idPersonal();
  if (!id) return { existe: false };

  try {
    var ss = SpreadsheetApp.openById(id);
    return { existe: true, url: ss.getUrl(), nombre: ss.getName() };
  } catch (e) {
    PropertiesService.getUserProperties().deleteProperty(CLAVE_PERSONAL);
    return { existe: false };
  }
}


/**
 * Crea la planilla "Finanzas personales" del usuario que accede.
 * Queda en su Drive, privada. Se arma entera por codigo.
 */
function crearPlanillaPersonal() {
  if (idPersonal()) return estadoPersonal();

  var ano = new Date().getFullYear();
  var ss = SpreadsheetApp.create('Finanzas personales');

  ['Gastos', 'Ingresos', 'Ahorros'].forEach(function (nombre, i) {
    var hoja = (i === 0) ? ss.getSheets()[0] : ss.insertSheet(nombre, i);
    hoja.setName(nombre);
    armarHojaMovimientos(hoja, PERSONAL[nombre].secciones, ano);
  });

  armarResumenPersonal(ss, ano);
  armarAuxPersonal(ss);

  PropertiesService.getUserProperties().setProperty(CLAVE_PERSONAL, ss.getId());

  return { existe: true, url: ss.getUrl(), nombre: ss.getName() };
}


/** Arma una hoja de meses en columnas con secciones y subtotales. */
function armarHojaMovimientos(hoja, secciones, ano) {
  var filas = [];

  // Fila 1: encabezado con fin de mes.
  var f1 = ['Categoría'];
  for (var m = 1; m <= 12; m++) f1.push(new Date(ano, m, 0));
  f1.push('TOTAL');
  filas.push(f1);

  // Fila 2: IPC (la completa actualizarDatosMercado).
  filas.push(['IPC del mes'].concat(new Array(13).fill('')));
  filas.push(new Array(14).fill(''));

  var r = 4;
  var filasSubtotal = [];

  secciones.forEach(function (sec) {
    filas.push([sec[0]].concat(new Array(13).fill('')));
    r++;
    var inicio = r;

    sec[1].forEach(function (cat) {
      var fila = [cat].concat(new Array(12).fill(''));
      fila.push('=SUM(B' + r + ':M' + r + ')');
      filas.push(fila);
      r++;
    });

    var sub = ['Subtotal ' + sec[0].toLowerCase()];
    for (var c = 0; c < 12; c++) {
      var letra = String.fromCharCode(66 + c);
      sub.push('=SUM(' + letra + inicio + ':' + letra + (r - 1) + ')');
    }
    sub.push('=SUM(B' + r + ':M' + r + ')');
    filas.push(sub);
    filasSubtotal.push(r);
    r++;

    filas.push(new Array(14).fill(''));
    r++;
  });

  var total = ['TOTAL'];
  for (var c2 = 0; c2 < 12; c2++) {
    var l = String.fromCharCode(66 + c2);
    total.push('=' + filasSubtotal.map(function (fs) { return l + fs; }).join('+'));
  }
  total.push('=SUM(B' + r + ':M' + r + ')');
  filas.push(total);

  hoja.getRange(1, 1, filas.length, 14).setValues(filas);

  // Formato.
  hoja.getRange(1, 1, 1, 14)
    .setBackground('#c2410c').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');
  hoja.getRange(1, 2, 1, 12).setNumberFormat('mmm yyyy');
  hoja.getRange(2, 2, 1, 12).setNumberFormat('0.0%');
  hoja.getRange(4, 2, filas.length - 3, 13).setNumberFormat('$#,##0;-$#,##0;');
  hoja.getRange(r, 1, 1, 14).setBackground('#fdece2').setFontWeight('bold');

  filasSubtotal.forEach(function (fs) {
    hoja.getRange(fs, 1, 1, 14).setFontWeight('bold').setFontStyle('italic');
  });

  hoja.setColumnWidth(1, 250);
  for (var cc = 2; cc <= 14; cc++) hoja.setColumnWidth(cc, 105);
  hoja.setFrozenRows(2);
  hoja.setFrozenColumns(1);

  // Marca las filas de seccion.
  var fr = 4;
  secciones.forEach(function (sec) {
    hoja.getRange(fr, 1, 1, 14).setBackground('#f3ebe5').setFontWeight('bold');
    fr += sec[1].length + 3;
  });
}


/**
 * En que fila queda el TOTAL de una hoja personal.
 * Cada seccion ocupa: encabezado + categorias + subtotal + linea en blanco.
 */
function filaTotalDe(nombreHoja) {
  var r = 4;
  PERSONAL[nombreHoja].secciones.forEach(function (s) {
    r += s[1].length + 3;
  });
  return r;
}


function armarResumenPersonal(ss, ano) {
  var hoja = ss.insertSheet('Resumen', 3);

  var filas = [
    ['FINANZAS PERSONALES ' + ano].concat(new Array(13).fill('')),
    new Array(14).fill(''),
    ['Concepto'].concat(
      Array.apply(null, { length: 12 }).map(function (_, i) {
        return '=Gastos!' + String.fromCharCode(66 + i) + '1';
      })
    ).concat(['TOTAL'])
  ];

  function fila(nombre, hojaOrigen, filaOrigen) {
    var f = [nombre];
    for (var i = 0; i < 12; i++) {
      f.push('=' + hojaOrigen + '!' + String.fromCharCode(66 + i) + filaOrigen);
    }
    f.push('=SUM(B' + (filas.length + 1) + ':M' + (filas.length + 1) + ')');
    return f;
  }

  // Fila TOTAL de cada hoja.
  var totalGastos = filaTotalDe('Gastos');
  var totalIngresos = filaTotalDe('Ingresos');
  var totalAhorros = filaTotalDe('Ahorros');

  filas.push(fila('Ingresos', 'Ingresos', totalIngresos));
  filas.push(fila('Gastos', 'Gastos', totalGastos));
  filas.push(fila('Ahorros', 'Ahorros', totalAhorros));

  var disp = ['DISPONIBLE (ingresos - gastos - ahorros)'];
  for (var i = 0; i < 12; i++) {
    var l = String.fromCharCode(66 + i);
    disp.push('=' + l + '4-' + l + '5-' + l + '6');
  }
  disp.push('=N4-N5-N6');
  filas.push(disp);

  var tasa = ['Tasa de ahorro'];
  for (var j = 0; j < 12; j++) {
    var l2 = String.fromCharCode(66 + j);
    tasa.push('=IFERROR(' + l2 + '6/' + l2 + '4;"")');
  }
  tasa.push('=IFERROR(N6/N4;"")');
  filas.push(tasa);

  filas.push(new Array(14).fill(''));
  filas.push(['INGRESOS POR CATEGORÍA', '', '', 'GASTOS POR CATEGORÍA',
              '', '', 'AHORROS POR CATEGORÍA'].concat(new Array(7).fill('')));

  hoja.getRange(1, 1, filas.length, 14).setValues(filas);

  hoja.getRange(11, 1).setFormula(consultaCategorias('Ingresos'));
  hoja.getRange(11, 4).setFormula(consultaCategorias('Gastos'));
  hoja.getRange(11, 7).setFormula(consultaCategorias('Ahorros'));

  hoja.getRange(1, 1, 1, 14).setFontWeight('bold').setFontSize(14);
  hoja.getRange(3, 1, 1, 14)
    .setBackground('#c2410c').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');
  hoja.getRange(3, 2, 1, 12).setNumberFormat('mmm yyyy');
  hoja.getRange(4, 2, 3, 13).setNumberFormat('$#,##0');
  hoja.getRange(7, 1, 1, 14).setBackground('#fdece2').setFontWeight('bold')
    .setNumberFormat('$#,##0');
  hoja.getRange(8, 2, 1, 13).setNumberFormat('0.0%');
  hoja.getRange(10, 1, 1, 14).setBackground('#f3ebe5').setFontWeight('bold');

  hoja.setColumnWidth(1, 260);
  for (var cc = 2; cc <= 14; cc++) hoja.setColumnWidth(cc, 105);
  hoja.setFrozenRows(3);
  hoja.setFrozenColumns(1);
}


/** Consulta que ordena las categorias de una hoja por total anual. */
function consultaCategorias(nombreHoja) {
  var secciones = PERSONAL[nombreHoja].secciones;
  var partes = [];
  var r = 5;

  secciones.forEach(function (sec) {
    var fin = r + sec[1].length - 1;
    partes.push(nombreHoja + '!A' + r + ':A' + fin + '\\' +
                nombreHoja + '!N' + r + ':N' + fin);
    r = fin + 3;
  });

  return '=IFERROR(QUERY({' + partes.join(';') +
         '};"select Col1, Col2 where Col2 > 0 order by Col2 desc";0);"Sin datos todavía")';
}


function armarAuxPersonal(ss) {
  var hoja = ss.insertSheet('Aux', 4);

  hoja.getRange('A1:C19').setValues([
    ['COTIZACIONES Y DATOS', '', ''],
    ['Se actualizan solos desde la app', '', ''],
    ['', '', ''],
    ['Concepto', 'Compra', 'Venta'],
    ['Dólar oficial', '', ''],
    ['Dólar blue', '', ''],
    ['Dólar MEP (bolsa)', '', ''],
    ['Contado con liqui', '', ''],
    ['Dólar tarjeta', '', ''],
    ['Dólar cripto', '', ''],
    ['', '', ''],
    ['Concepto', 'Valor', ''],
    ['Inflación último mes (%)', '', ''],
    ['UVA', '', ''],
    ['Riesgo país', '', ''],
    ['', '', ''],
    ['Última actualización', '', ''],
    ['', '', ''],
    ['Nota', 'Se refresca al abrir la app o desde Ajustes.', '']
  ]);

  hoja.getRange('A1:C1').setFontWeight('bold').setFontSize(13);
  hoja.getRange('A4:C4').setBackground('#c2410c').setFontColor('#ffffff').setFontWeight('bold');
  hoja.getRange('A12:C12').setBackground('#c2410c').setFontColor('#ffffff').setFontWeight('bold');
  hoja.getRange('B5:C10').setNumberFormat('$#,##0.00');
  hoja.setColumnWidth(1, 240);
  hoja.setColumnWidth(2, 140);
  hoja.setColumnWidth(3, 140);
}


/**
 * Trae cotizaciones e inflacion y las escribe en la planilla personal.
 * Reemplaza a las funciones personalizadas: como la planilla se crea
 * por codigo, no tiene un script propio adonde vivirian.
 */
/**
 * Solo actualiza si el dato tiene mas de 12 horas.
 * Asi entrar a la pestana Personal no espera a las APIs cada vez.
 */
function actualizarDatosMercadoSiHaceFalta() {
  try {
    var aux = planillaPersonal().getSheetByName('Aux');
    if (!aux) return 'Sin hoja Aux.';

    var ultima = aux.getRange(17, 2).getValue();
    if (ultima instanceof Date) {
      var horas = (new Date() - ultima) / (1000 * 60 * 60);
      if (horas < 12) return 'Los datos ya estaban al dia.';
    }
    return actualizarDatosMercado();
  } catch (e) {
    return 'No pude actualizar: ' + e.message;
  }
}


function actualizarDatosMercado() {
  var ss = planillaPersonal();
  var aux = ss.getSheetByName('Aux');
  if (!aux) return 'Esta planilla no tiene hoja Aux.';

  // Dólares.
  try {
    var dolares = JSON.parse(
      UrlFetchApp.fetch('https://dolarapi.com/v1/dolares').getContentText());

    var mapa = { oficial: 5, blue: 6, bolsa: 7, contadoconliqui: 8, tarjeta: 9, cripto: 10 };

    dolares.forEach(function (d) {
      var fila = mapa[String(d.casa).toLowerCase()];
      if (!fila) return;
      if (d.compra) aux.getRange(fila, 2).setValue(d.compra);
      if (d.venta) aux.getRange(fila, 3).setValue(d.venta);
    });
  } catch (e) { /* se ignora */ }

  // Inflación mensual: última + serie del año para la fila 2 de cada hoja.
  try {
    var inf = JSON.parse(UrlFetchApp.fetch(
      'https://api.argentinadatos.com/v1/finanzas/indices/inflacion').getContentText());

    inf.sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });
    aux.getRange(13, 2).setValue(inf[inf.length - 1].valor);

    var ano = new Date().getFullYear();
    var porMes = {};
    inf.forEach(function (x) {
      var f = new Date(x.fecha + 'T00:00:00');
      if (f.getFullYear() === ano) porMes[f.getMonth()] = Number(x.valor) / 100;
    });

    ['Gastos', 'Ingresos', 'Ahorros'].forEach(function (nombre) {
      var hoja = ss.getSheetByName(nombre);
      if (!hoja) return;
      for (var m = 0; m < 12; m++) {
        if (porMes[m] !== undefined) hoja.getRange(2, m + 2).setValue(porMes[m]);
      }
    });
  } catch (e) { /* se ignora */ }

  // UVA y riesgo país.
  try {
    var uva = JSON.parse(UrlFetchApp.fetch(
      'https://api.argentinadatos.com/v1/finanzas/indices/uva').getContentText());
    uva.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    aux.getRange(14, 2).setValue(uva[0].valor);
  } catch (e) { /* se ignora */ }

  try {
    var rp = JSON.parse(UrlFetchApp.fetch(
      'https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais').getContentText());
    rp.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    aux.getRange(15, 2).setValue(rp[0].valor);
  } catch (e) { /* se ignora */ }

  aux.getRange(17, 2).setValue(new Date());
  aux.getRange(17, 2).setNumberFormat('dd/mm/yyyy HH:mm');

  return 'Cotizaciones actualizadas.';
}


/** Olvida la planilla personal vinculada, para empezar de cero. */
function desvincularPersonal() {
  PropertiesService.getUserProperties().deleteProperty(CLAVE_PERSONAL);
  return { existe: false };
}


function vincularPlanillaPersonal(texto) {
  var id = String(texto).trim();
  var m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) id = m[1];

  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('No pude abrir esa planilla. Revisá el link o el ID.');
  }

  PropertiesService.getUserProperties().setProperty(CLAVE_PERSONAL, ss.getId());
  return { existe: true, url: ss.getUrl(), nombre: ss.getName() };
}


/**
 * Guarda un movimiento personal en la grilla de meses.
 * hoja: 'Gastos' | 'Ingresos' | 'Ahorros'
 * Suma al valor que ya haya en esa celda.
 */
function guardarMovimientoPersonal(d) {
  return unaVez(d, escribirMovimientoPersonal_);
}

function escribirMovimientoPersonal_(d) {
  var ss = planillaPersonal();
  var hoja = ss.getSheetByName(d.hoja);
  if (!hoja) throw new Error('No encontré la hoja "' + d.hoja + '".');

  var fecha = aFecha(d.fecha);
  var col = fecha.getMonth() + 2;

  // Busca la fila de la categoría.
  var nombres = hoja.getRange('A1:A40').getValues();
  var fila = -1;
  for (var i = 0; i < nombres.length; i++) {
    if (nombres[i][0] === d.categoria) { fila = i + 1; break; }
  }
  if (fila === -1) throw new Error('No encontré la categoría "' + d.categoria + '".');

  var monto = aNumero(d.monto);
  if (monto <= 0) throw new Error('El monto tiene que ser mayor a cero.');

  var celda = hoja.getRange(fila, col);
  var previo = celda.getValue();
  var actual = (typeof previo === 'number' && isFinite(previo)) ? previo : 0;

  // Escribe y relee: si no quedo, avisa en vez de decir que se guardo.
  escribirYVerificar(celda, actual + monto,
                     d.hoja + ' > ' + d.categoria + ' > ' + MESES[fecha.getMonth()]);

  // La descripción queda como nota, para no perderla.
  if (d.descripcion) {
    var nota = celda.getNote();
    var linea = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM') +
                ': ' + d.descripcion + ' ' + comoPlata(monto);
    celda.setNote(nota ? nota + '\n' + linea : linea);
  }

  return d.hoja + ' - ' + d.categoria + ': ' + comoPlata(monto) +
         ' en ' + MESES[fecha.getMonth()];
}


/** Totales personales del año en curso. */
function totalesPersonales() {
  if (!idPersonal()) return null;

  try {
    var ss = planillaPersonal();

    function totalDe(nombre) {
      var hoja = ss.getSheetByName(nombre);
      if (!hoja) return 0;
      // Busca la fila TOTAL por texto, asi funciona aunque la planilla
      // tenga filas agregadas a mano.
      var col = hoja.getRange('A1:A60').getValues();
      for (var i = col.length - 1; i >= 0; i--) {
        if (String(col[i][0]).trim() === 'TOTAL') {
          return Number(hoja.getRange(i + 1, 14).getValue()) || 0;
        }
      }
      return 0;
    }

    var g = totalDe('Gastos');
    var ing = totalDe('Ingresos');
    var ah = totalDe('Ahorros');

    return {
      gastos: comoPlata(g),
      ingresos: comoPlata(ing),
      ahorros: comoPlata(ah),
      neto: comoPlata(ing - g - ah)
    };
  } catch (e) {
    return null;
  }
}


/* ---------- Conciliación ---------- */

function conciliar(d) {
  var desde = aFecha(d.desde);
  var hasta = aFecha(d.hasta);
  hasta.setHours(23, 59, 59);

  var gastos = 0, ingresos = 0;

  if (d.destino === 'depto') {
    var hg = planilla().getSheetByName(HOJA_GASTOS);
    var dg = hg.getRange('A2:E2000').getValues();
    for (var i = 0; i < dg.length; i++) {
      if (dg[i][0] instanceof Date && dg[i][0] >= desde && dg[i][0] <= hasta) {
        if (typeof dg[i][4] === 'number') gastos += dg[i][4];
      }
    }

    var hs = planilla().getSheetByName(HOJA_PAGOS_SERV);
    var ds = hs.getRange('A2:D2000').getValues();
    for (var s = 0; s < ds.length; s++) {
      if (ds[s][0] instanceof Date && ds[s][0] >= desde && ds[s][0] <= hasta) {
        if (typeof ds[s][3] === 'number') gastos += ds[s][3];
      }
    }

    var hi = planilla().getSheetByName(HOJA_INGRESOS);
    var di = hi.getRange('A2:C2000').getValues();
    for (var j = 0; j < di.length; j++) {
      if (di[j][0] instanceof Date && di[j][0] >= desde && di[j][0] <= hasta) {
        if (typeof di[j][2] === 'number') ingresos += di[j][2];
      }
    }
  } else {
    // Personal: se compara por mes completo, que es la unidad de la grilla.
    var ssp = planillaPersonal();
    var m1 = desde.getMonth(), m2 = hasta.getMonth();

    function sumar(nombre) {
      var hoja = ssp.getSheetByName(nombre);
      if (!hoja) return 0;
      var col = hoja.getRange('A1:A40').getValues();
      for (var k = col.length - 1; k >= 0; k--) {
        if (col[k][0] === 'TOTAL') {
          var vals = hoja.getRange(k + 1, 2, 1, 12).getValues()[0];
          var t = 0;
          for (var mm = m1; mm <= m2; mm++) t += Number(vals[mm]) || 0;
          return t;
        }
      }
      return 0;
    }

    gastos = sumar('Gastos');
    ingresos = sumar('Ingresos');
  }

  var real = aNumero(d.montoReal, 'total real');
  var diferencia = real - gastos;

  return {
    gastos: comoPlata(gastos),
    ingresos: comoPlata(ingresos),
    real: comoPlata(real),
    diferencia: comoPlata(diferencia),
    diferenciaNumero: diferencia,
    hayDiferencia: Math.abs(diferencia) >= 1,
    mensaje: Math.abs(diferencia) < 1
      ? 'La planilla coincide con la realidad.'
      : (diferencia > 0
          ? 'Falta cargar ' + comoPlata(diferencia) + ' de gastos.'
          : 'La planilla tiene ' + comoPlata(-diferencia) + ' de más.')
  };
}


function registrarAjuste(d) {
  var monto = aNumero(d.monto);

  if (d.destino === 'depto') {
    return guardarGasto({
      fecha: d.fecha,
      categoria: 'Varios',
      detalle: 'Ajuste',
      descripcion: d.descripcion || 'Ajuste de conciliación',
      monto: monto,
      pagadoPor: d.pagadoPor,
      division: d.division || '50/50',
      permitirNegativo: true
    });
  }

  return guardarMovimientoPersonal({
    fecha: d.fecha,
    hoja: monto >= 0 ? 'Gastos' : 'Ingresos',
    categoria: 'Ajuste',
    descripcion: d.descripcion || 'Ajuste de conciliación',
    monto: Math.abs(monto)
  });
}

/**
 * Nota: el recordatorio por mail se eliminó en esta versión.
 * Si quedaron disparadores creados por versiones anteriores, hay que
 * borrarlos a mano en script.google.com/home/triggers, con cada cuenta.
 */
