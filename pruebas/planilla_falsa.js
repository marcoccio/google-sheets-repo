function parsearA1(a1) {
  const partes = String(a1).split(':');

  function celdaACoord(c) {
    const match = c.trim().match(/^([A-Za-z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Notación A1 inválida: ${c}`);
    }
    const letras = match[1].toUpperCase();
    let col = 0;
    for (let i = 0; i < letras.length; i++) {
      col = col * 26 + (letras.charCodeAt(i) - 64);
    }
    const fila = parseInt(match[2], 10);
    return { fila, col };
  }

  const c1 = celdaACoord(partes[0]);
  if (partes.length === 1) {
    return { fila: c1.fila, col: c1.col, numFilas: 1, numCols: 1 };
  }
  const c2 = celdaACoord(partes[1]);
  const filaInicio = Math.min(c1.fila, c2.fila);
  const colInicio = Math.min(c1.col, c2.col);
  const numFilas = Math.abs(c2.fila - c1.fila) + 1;
  const numCols = Math.abs(c2.col - c1.col) + 1;
  return { fila: filaInicio, col: colInicio, numFilas, numCols };
}

// fallas.relectura: si una celda guarda este valor, al leerla devuelve
// 'basura'. Simula "escribí y la relectura no coincide" (A2, M1).
// fallas.formulas(formula, { hoja, fila, col }): si se define, getValues
// devuelve lo que calcule para cada celda con formula (la planilla falsa no
// calcula nada por si misma).
const fallas = { relectura: undefined, formulas: undefined };

function crearRango(hojaData, fila, col, numFilas, numCols) {
  return {
    get fila() {
      return fila;
    },
    get col() {
      return col;
    },
    get hoja() {
      return hojaData;
    },
    getValues() {
      const resultado = [];
      for (let r = 0; r < numFilas; r++) {
        const filaIdx = fila + r - 1;
        const filaArr = [];
        const filaData = hojaData.filas[filaIdx];
        for (let c = 0; c < numCols; c++) {
          const colIdx = col + c - 1;
          if (filaData && filaData[colIdx] !== undefined) {
            let v = filaData[colIdx];
            if (fallas.formulas && typeof v === 'string' && v.charAt(0) === '=') {
              v = fallas.formulas(v, { hoja: hojaData.nombre, fila: filaIdx + 1, col: colIdx + 1 });
            }
            filaArr.push(fallas.relectura !== undefined && v === fallas.relectura ? 'basura' : v);
          } else {
            filaArr.push('');
          }
        }
        resultado.push(filaArr);
      }
      return resultado;
    },
    setValues(valores) {
      for (let r = 0; r < valores.length; r++) {
        const filaIdx = fila + r - 1;
        while (hojaData.filas.length <= filaIdx) {
          hojaData.filas.push([]);
        }
        const filaData = hojaData.filas[filaIdx];
        for (let c = 0; c < valores[r].length; c++) {
          const colIdx = col + c - 1;
          while (filaData.length <= colIdx) {
            filaData.push('');
          }
          filaData[colIdx] = valores[r][c];
        }
      }
    },
    getValue() {
      const vals = this.getValues();
      return vals[0] && vals[0][0] !== undefined ? vals[0][0] : '';
    },
    setValue(v) {
      this.setValues([[v]]);
    },
    setFormula(f) {
      this.setValue(f);
    },
    // Las formulas se guardan como texto; getFormulas devuelve las que empiezan con '='.
    getFormulas() {
      const evaluar = fallas.formulas;
      fallas.formulas = undefined;
      try {
        return this.getValues().map(f => f.map(v => (typeof v === 'string' && v.charAt(0) === '=') ? v : ''));
      } finally {
        fallas.formulas = evaluar;
      }
    },
    setFormulas(m) {
      this.setValues(m);
    },
    setNumberFormat() {
      return this;
    },
    setFontWeight() {
      return this;
    },
    clearContent() {
      this.setValues(Array.from({ length: numFilas }, () => Array(numCols).fill('')));
    },
    getNote() {
      const clave = `${fila},${col}`;
      return hojaData.notas.get(clave) || '';
    },
    setNote(t) {
      const clave = `${fila},${col}`;
      hojaData.notas.set(clave, String(t));
    },
    getDisplayValue() {
      return String(this.getValue());
    }
  };
}

function crearHojaObj(hojaData) {
  return {
    getName() {
      return hojaData.nombre;
    },
    getRange(...args) {
      if (typeof args[0] === 'string') {
        const { fila, col, numFilas, numCols } = parsearA1(args[0]);
        return crearRango(hojaData, fila, col, numFilas, numCols);
      }
      const fila = args[0];
      const col = args[1];
      const numFilas = args.length > 2 ? args[2] : 1;
      const numCols = args.length > 3 ? args[3] : 1;
      return crearRango(hojaData, fila, col, numFilas, numCols);
    },
    setFrozenRows() {}
  };
}

function crearPlanillaObj(planillaData, zona = 'America/Argentina/Mendoza') {
  return {
    getId() {
      return planillaData.id;
    },
    getName() {
      return `Planilla ${planillaData.id}`;
    },
    getUrl() {
      return `https://docs.google.com/spreadsheets/d/${planillaData.id}`;
    },
    // La zona se guarda en la planilla: setSpreadsheetTimeZone la cambia (#23).
    getSpreadsheetTimeZone() {
      return planillaData.zona || zona;
    },
    setSpreadsheetTimeZone(z) {
      planillaData.zona = z;
    },
    getSheetByName(nombre) {
      const hojaData = planillaData.hojas.get(nombre);
      if (!hojaData) return null;
      return crearHojaObj(hojaData);
    },
    insertSheet(nombre) {
      if (planillaData.hojas.has(nombre)) throw new Error(`Ya existe la hoja ${nombre}`);
      const hojaData = { nombre, filas: [], notas: new Map() };
      planillaData.hojas.set(nombre, hojaData);
      return crearHojaObj(hojaData);
    },
    deleteSheet(hoja) {
      planillaData.hojas.delete(hoja.getName());
    }
  };
}

function crearLock() {
  return {
    waitLock(_ms) {},
    tryLock(_ms) {
      return true;
    },
    releaseLock() {}
  };
}

function crearCache() {
  const store = new Map();
  return {
    get(k) {
      const entry = store.get(String(k));
      if (!entry) return null;
      if (entry.expira && Date.now() > entry.expira) {
        store.delete(String(k));
        return null;
      }
      return entry.valor;
    },
    put(k, v, segundos) {
      const expira = segundos ? Date.now() + segundos * 1000 : null;
      store.set(String(k), { valor: String(v), expira });
    },
    remove(k) {
      store.delete(String(k));
    }
  };
}

function crearPropertiesStore() {
  const store = new Map();
  return {
    getProperty(k) {
      return store.has(String(k)) ? store.get(String(k)) : null;
    },
    setProperty(k, v) {
      store.set(String(k), String(v));
    },
    deleteProperty(k) {
      store.delete(String(k));
    }
  };
}

// En Apps Script new Date(año, mes, día) se arma en la zona del script, y en Node
// en la zona del proceso (process.env.TZ); por eso una prueba que usa opciones.zona
// tiene que poner process.env.TZ igual a esa zona antes de cargar el código.
function crearServicios(planillas = {}, opciones = {}) {
  const zona = (opciones && opciones.zona) || 'America/Argentina/Mendoza';
  const planillasStore = new Map();

  for (const [idPlanilla, hojas] of Object.entries(planillas)) {
    const hojasMap = new Map();
    for (const [nombreHoja, filasOriginales] of Object.entries(hojas)) {
      const filas = filasOriginales.map(fila => [...fila]);
      const notas = new Map();
      hojasMap.set(nombreHoja, {
        nombre: nombreHoja,
        filas,
        notas
      });
    }
    planillasStore.set(idPlanilla, {
      id: idPlanilla,
      hojas: hojasMap
    });
  }

  const SpreadsheetApp = {
    openById(id) {
      const pData = planillasStore.get(id);
      if (!pData) {
        throw new Error(`SpreadsheetApp.openById: Planilla no encontrada con id ${id}`);
      }
      return crearPlanillaObj(pData, zona);
    },
    flush() {}
  };

  const lockCompartido = crearLock();
  const LockService = {
    getScriptLock() {
      return lockCompartido;
    },
    getUserLock() {
      return lockCompartido;
    }
  };

  const cacheCompartida = crearCache();
  const CacheService = {
    getScriptCache() {
      return cacheCompartida;
    },
    getUserCache() {
      return cacheCompartida;
    }
  };

  const userProperties = crearPropertiesStore();
  const scriptProperties = crearPropertiesStore();
  const PropertiesService = {
    getUserProperties() {
      return userProperties;
    },
    getScriptProperties() {
      return scriptProperties;
    }
  };

  const Session = {
    getScriptTimeZone() {
      return zona;
    },
    getEffectiveUser() {
      return {
        getEmail() {
          return 'marcos@example.com';
        }
      };
    },
    getActiveUser() {
      return {
        getEmail() {
          return 'marcos@example.com';
        }
      };
    }
  };

  const Utilities = {
    formatDate(fecha, zona, formato) {
      if (formato !== 'dd/MM' && formato !== 'dd/MM/yyyy' && formato !== 'yyyy-MM-dd') {
        throw new Error(`Formato no soportado: ${formato}`);
      }
      const ts = typeof fecha.getTime === 'function' ? fecha.getTime() : Number(fecha);
      if (Number.isNaN(ts)) {
        throw new Error('Fecha inválida');
      }
      const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone: zona,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = dtf.formatToParts(new Date(ts));
      let yyyy = '';
      let MM = '';
      let dd = '';
      for (const part of parts) {
        if (part.type === 'year') yyyy = part.value;
        else if (part.type === 'month') MM = part.value;
        else if (part.type === 'day') dd = part.value;
      }

      if (formato === 'dd/MM') return `${dd}/${MM}`;
      if (formato === 'dd/MM/yyyy') return `${dd}/${MM}/${yyyy}`;
      if (formato === 'yyyy-MM-dd') return `${yyyy}-${MM}-${dd}`;
    }
  };

  fallas.relectura = undefined;
  fallas.formulas = undefined;

  return {
    fallas,
    SpreadsheetApp,
    LockService,
    CacheService,
    PropertiesService,
    Session,
    Utilities,
    hoja(idPlanilla, nombre) {
      const pData = planillasStore.get(idPlanilla);
      if (!pData) return null;
      const hData = pData.hojas.get(nombre);
      if (!hData) return null;
      return hData.filas;
    },
    nota(idPlanilla, nombre, fila, col) {
      const pData = planillasStore.get(idPlanilla);
      if (!pData) return '';
      const hData = pData.hojas.get(nombre);
      if (!hData) return '';
      return hData.notas.get(`${fila},${col}`) || '';
    }
  };
}

module.exports = {
  crearServicios
};
