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

  var url = 'https://api.bcra.gob.ar/estadisticas/v3.0/Monetarias';
  var data = JSON.parse(UrlFetchApp.fetch(url).getContentText());

  if (!data.results) throw new Error('No pude leer las variables del BCRA.');

  for (var i = 0; i < data.results.length; i++) {
    var d = String(data.results[i].descripcion).toLowerCase();
    if (d.indexOf('icl') !== -1 || d.indexOf('contratos de locac') !== -1) {
      cache.put('ID_ICL', String(data.results[i].idVariable), 21600);
      return data.results[i].idVariable;
    }
  }

  throw new Error('No encontre el ICL entre las variables del BCRA.');
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

  var id = idVariableICL();
  var inicio = new Date(desde);

  var hasta = new Date();
  var desdeTexto = Utilities.formatDate(inicio, 'GMT-3', 'yyyy-MM-dd');
  var hastaTexto = Utilities.formatDate(hasta, 'GMT-3', 'yyyy-MM-dd');

  var url = 'https://api.bcra.gob.ar/estadisticas/v3.0/Monetarias/' + id +
            '?desde=' + desdeTexto + '&hasta=' + hastaTexto + '&limit=3000';

  var data = JSON.parse(UrlFetchApp.fetch(url).getContentText());

  if (!data.results || data.results.length < 2) {
    throw new Error('El BCRA no devolvio suficientes datos de ICL.');
  }

  // Ordenar por fecha ascendente.
  var serie = data.results.slice().sort(function (a, b) {
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
  var id = idVariableICL();
  var f = fecha ? new Date(fecha) : new Date();
  var texto = Utilities.formatDate(f, 'GMT-3', 'yyyy-MM-dd');

  var url = 'https://api.bcra.gob.ar/estadisticas/v3.0/Monetarias/' + id +
            '?desde=' + texto + '&hasta=' + texto;

  var data = JSON.parse(UrlFetchApp.fetch(url).getContentText());

  if (data.results && data.results.length) return Number(data.results[0].valor);

  throw new Error('No hay dato de ICL para esa fecha.');
}
