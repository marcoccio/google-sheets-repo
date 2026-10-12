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
var CLAVE_RECORDATORIO = 'RECORDATORIO_ACTIVO';
var CLAVE_DIAS = 'RECORDATORIO_DIAS';

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
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
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
  var p = String(texto).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
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

  // Categorías personales: son constantes, no tocan la planilla personal.
  var personales = {};
  Object.keys(PERSONAL).forEach(function (hoja) {
    var lista = [];
    PERSONAL[hoja].secciones.forEach(function (s) { lista = lista.concat(s[1]); });
    personales[hoja] = lista;
  });

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

function guardarGasto(d) {
  var candado = LockService.getScriptLock();
  candado.waitLock(10000);

  try {
    var hoja = planilla().getSheetByName(HOJA_GASTOS);
    var fila = ultimaFilaReal(hoja) + 1;

    var link = guardarComprobante(d.comprobante, d.detalle || 'Gasto');

    hoja.getRange(fila, 1, 1, 7).setValues([[
      aFecha(d.fecha), d.categoria, d.detalle, d.descripcion,
      Number(d.monto), d.pagadoPor, d.division
    ]]);

    if (link) hoja.getRange(fila, 12).setFormula('=HYPERLINK("' + link + '";"Ver")');

    return 'Gasto cargado: ' + d.detalle + ' ' + comoPlata(Number(d.monto)) +
           (link ? ' (con comprobante)' : '');
  } finally {
    candado.releaseLock();
  }
}


/**
 * Registra el pago de un servicio.
 * Ahora va al registro "Pagos servicios", con quien pago y comprobante.
 * La grilla de la hoja Servicios se actualiza sola.
 */
function guardarServicio(d) {
  var candado = LockService.getScriptLock();
  candado.waitLock(10000);

  try {
    var hoja = planilla().getSheetByName(HOJA_PAGOS_SERV);
    var fila = ultimaFilaReal(hoja) + 1;

    var link = guardarComprobante(d.comprobante, d.servicio + ' ' + d.mes);

    hoja.getRange(fila, 1, 1, 5).setValues([[
      aFecha(d.fecha), d.servicio, d.mes, Number(d.monto), d.pagadoPor
    ]]);

    if (link) hoja.getRange(fila, 6).setFormula('=HYPERLINK("' + link + '";"Ver")');

    return d.servicio + ' de ' + d.mes + ': ' + comoPlata(Number(d.monto)) +
           ' (pagó ' + d.pagadoPor + ')' + (link ? ' con comprobante' : '');
  } finally {
    candado.releaseLock();
  }
}


function guardarIngreso(d) {
  var candado = LockService.getScriptLock();
  candado.waitLock(10000);

  try {
    var hoja = planilla().getSheetByName(HOJA_INGRESOS);
    var fila = ultimaFilaReal(hoja) + 1;

    var link = guardarComprobante(d.comprobante, d.concepto || 'Ingreso');

    hoja.getRange(fila, 1, 1, 4).setValues([[
      aFecha(d.fecha),
      d.concepto + (d.descripcion ? ' - ' + d.descripcion : ''),
      Number(d.monto),
      d.recibidoPor
    ]]);

    if (link) hoja.getRange(fila, 5).setFormula('=HYPERLINK("' + link + '";"Ver")');

    return 'Ingreso cargado: ' + d.concepto + ' ' + comoPlata(Number(d.monto));
  } finally {
    candado.releaseLock();
  }
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

  var celda = hoja.getRange(fila, col);
  var actual = Number(celda.getValue()) || 0;
  celda.setValue(actual + Number(d.monto));

  // La descripción queda como nota, para no perderla.
  if (d.descripcion) {
    var nota = celda.getNote();
    var linea = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM') +
                ': ' + d.descripcion + ' ' + comoPlata(Number(d.monto));
    celda.setNote(nota ? nota + '\n' + linea : linea);
  }

  return d.hoja + ' - ' + d.categoria + ': ' + comoPlata(Number(d.monto)) +
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

  var real = Number(d.montoReal);
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
  var monto = Number(d.monto);

  if (d.destino === 'depto') {
    return guardarGasto({
      fecha: d.fecha,
      categoria: 'Varios',
      detalle: 'Ajuste',
      descripcion: d.descripcion || 'Ajuste de conciliación',
      monto: monto,
      pagadoPor: d.pagadoPor,
      division: d.division || '50/50'
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


/* ---------- Recordatorio ---------- */

function diasAviso() {
  var v = PropertiesService.getUserProperties().getProperty(CLAVE_DIAS);
  return v ? Number(v) : 1;
}


function ultimoMovimiento() {
  var ultima = null;

  function revisar(hoja) {
    if (!hoja) return;
    var datos = hoja.getRange(2, 1, 1999, 1).getValues();
    for (var i = 0; i < datos.length; i++) {
      var f = datos[i][0];
      if (f instanceof Date && (!ultima || f > ultima)) ultima = f;
    }
  }

  var ss = planilla();
  revisar(ss.getSheetByName(HOJA_GASTOS));
  revisar(ss.getSheetByName(HOJA_INGRESOS));
  revisar(ss.getSheetByName(HOJA_PAGOS_SERV));

  return ultima;
}


function estadoRecordatorio() {
  var props = PropertiesService.getUserProperties();
  var activo = props.getProperty(CLAVE_RECORDATORIO) === 'si';
  var ultima = ultimoMovimiento();

  return {
    activo: activo,
    dias: diasAviso(),
    ultimo: ultima
      ? Utilities.formatDate(ultima, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      : 'todavía no hay movimientos',
    mail: Session.getEffectiveUser().getEmail()
  };
}


function activarRecordatorio(dias) {
  desactivarRecordatorio();

  ScriptApp.newTrigger('revisarActividad')
    .timeBased().everyDays(1).atHour(20).create();

  var props = PropertiesService.getUserProperties();
  props.setProperty(CLAVE_RECORDATORIO, 'si');
  props.setProperty(CLAVE_DIAS, String(Number(dias) || 1));

  return estadoRecordatorio();
}


function desactivarRecordatorio() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'revisarActividad') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  PropertiesService.getUserProperties().setProperty(CLAVE_RECORDATORIO, 'no');
  return estadoRecordatorio();
}


function revisarActividad() {
  var mail = Session.getEffectiveUser().getEmail();
  if (!mail) return;

  var ultima = ultimoMovimiento();
  var dias = ultima
    ? Math.floor((new Date() - ultima) / (1000 * 60 * 60 * 24))
    : 999;

  if (dias < diasAviso()) return;

  var url = ScriptApp.getService().getUrl();
  var cuando = ultima
    ? 'El último movimiento cargado es del ' +
      Utilities.formatDate(ultima, Session.getScriptTimeZone(), 'dd/MM/yyyy') + '.'
    : 'Todavía no hay ningún movimiento cargado.';

  MailApp.sendEmail({
    to: mail,
    subject: 'Gastos depto: hace ' + dias + ' día(s) que no cargás nada',
    body: 'Hola,\n\n' + cuando + '\n\n' +
          'Pasaron ' + dias + ' día(s) sin cargar gastos ni ingresos. ' +
          'Si hubo movimientos, es buen momento para anotarlos.\n\n' +
          (url ? 'Cargar ahora: ' + url + '\n\n' : '') +
          'Planilla: ' + planilla().getUrl() + '\n\n' +
          'Para dejar de recibir este aviso, apagá el recordatorio desde la app.\n'
  });
}
