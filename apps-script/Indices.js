/**
 * Indices para la actualizacion del alquiler.
 * Se agregan al proyecto de la planilla "Gastos depto".
 *
 * Requiere que tambien este cargado finanzas.gs (la libreria
 * google-sheets-argento), porque usa su funcion bcraVariables().
 */


/**
 * IPC acumulado desde una fecha hasta hoy.
 * Multiplica las variaciones mensuales del IPC.
 *
 * @param {Date} desde Fecha de la ultima actualizacion.
 * @return {number} Variacion acumulada (0.35 = 35%).
 * @customfunction
 */
function ipcAcumulado(desde) {
  if (!desde) throw new Error('Falta la fecha de inicio.');

  var url = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion';
  var datos = JSON.parse(UrlFetchApp.fetch(url).getContentText());

  var inicio = new Date(desde);
  var factor = 1;

  for (var i = 0; i < datos.length; i++) {
    var f = new Date(datos[i].fecha + 'T00:00:00');
    if (f > inicio) {
      factor = factor * (1 + Number(datos[i].valor) / 100);
    }
  }

  return factor - 1;
}


// La v3 se dio de baja (HTTP 410) en 2026. Si la v4 corre la misma suerte,
// el error de la celda lo va a decir con el mismo codigo.
var BCRA_MONETARIAS = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias';

/**
 * Busca el ID de la variable ICL en el BCRA.
 * No lo hardcodea: lo busca por descripcion, asi sigue andando
 * aunque el BCRA reordene sus variables.
 *
 * @return {number} El idVariable del ICL.
 */
function idVariableICL() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('ID_ICL');
  if (guardado) return Number(guardado);

  // El listado viene paginado (1000 por pagina, mas de 1600 variables).
  var offset = 0, total = 1;
  while (offset < total) {
    var data = JSON.parse(UrlFetchApp.fetch(BCRA_MONETARIAS + '?limit=1000&offset=' + offset)
                                     .getContentText());
    if (!data.results || !data.metadata) throw new Error('No pude leer las variables del BCRA.');

    for (var i = 0; i < data.results.length; i++) {
      // Comienzo exacto: una subcadena como "icl" tambien esta en "ciclo".
      var d = String(data.results[i].descripcion).toLowerCase();
      if (d.indexOf('índice para contratos de locación') === 0) {
        cache.put('ID_ICL', String(data.results[i].idVariable), 21600);
        return data.results[i].idVariable;
      }
    }

    total = data.metadata.resultset.count;
    offset += data.results.length;
    if (!data.results.length) break;
  }

  throw new Error('No encontre el ICL entre las variables del BCRA.');
}


/**
 * Fecha 'yyyy-MM-dd' en la zona de la planilla. La fecha la arma la planilla
 * (DATE(2026;5;1) es medianoche en SU zona): formatearla en otra la corre un
 * dia, como el 30/04 que daba con 'GMT-3' fijo y la planilla en UTC.
 */
function diaDePlanilla(fecha) {
  var zona = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(fecha, zona, 'yyyy-MM-dd');
}


/** Valores del ICL entre dos fechas 'yyyy-MM-dd', en el orden que los da el BCRA. */
function serieICL(desdeTexto, hastaTexto) {
  var url = BCRA_MONETARIAS + '/' + idVariableICL() +
            '?desde=' + desdeTexto + '&hasta=' + hastaTexto + '&limit=3000';
  var data = JSON.parse(UrlFetchApp.fetch(url).getContentText());
  return (data.results && data.results[0] && data.results[0].detalle) || [];
}


/**
 * ICL acumulado desde una fecha hasta hoy.
 * El ICL es un indice de nivel, asi que se calcula como cociente.
 *
 * @param {Date} desde Fecha de la ultima actualizacion.
 * @return {number} Variacion acumulada (0.35 = 35%).
 * @customfunction
 */
function iclAcumulado(desde) {
  if (!desde) throw new Error('Falta la fecha de inicio.');

  var inicio = new Date(desde);

  var hasta = new Date();
  var desdeTexto = diaDePlanilla(inicio);
  var hastaTexto = diaDePlanilla(hasta);

  var datos = serieICL(desdeTexto, hastaTexto);

  if (datos.length < 2) {
    throw new Error('El BCRA no devolvio suficientes datos de ICL.');
  }

  // Ordenar por fecha ascendente.
  var serie = datos.slice().sort(function (a, b) {
    return new Date(a.fecha) - new Date(b.fecha);
  });

  var primero = Number(serie[0].valor);
  var ultimo = Number(serie[serie.length - 1].valor);

  if (!primero) throw new Error('Valor de ICL invalido.');

  return (ultimo / primero) - 1;
}


/**
 * Devuelve el ICL de una fecha puntual.
 *
 * @param {Date} fecha La fecha a consultar.
 * @return {number} El valor del indice.
 * @customfunction
 */
function icl(fecha) {
  var f = fecha ? new Date(fecha) : new Date();
  var texto = diaDePlanilla(f);

  var datos = serieICL(texto, texto);

  if (datos.length) return Number(datos[0].valor);

  throw new Error('No hay dato de ICL para esa fecha.');
}
