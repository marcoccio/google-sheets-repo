const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SERVICIOS_DEFAULT = [
  'SpreadsheetApp',
  'LockService',
  'CacheService',
  'PropertiesService',
  'Utilities',
  'Session',
  'DriveApp',
  'ScriptApp',
  'HtmlService',
  'UrlFetchApp',
  'MailApp'
];

function crearStubServicio(nombre) {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined;
      return function () {
        throw new Error(`Stub no configurado: ${nombre}.${String(prop)}`);
      };
    }
  });
}

function crearRunner(llamadas = [], exito = null, fallo = null) {
  const target = {
    llamadas,
    withSuccessHandler(fn) {
      return crearRunner(llamadas, fn, fallo);
    },
    withFailureHandler(fn) {
      return crearRunner(llamadas, exito, fn);
    }
  };

  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === 'llamadas') return t.llamadas;
      if (prop === 'withSuccessHandler') return t.withSuccessHandler;
      if (prop === 'withFailureHandler') return t.withFailureHandler;
      if (typeof prop === 'symbol') return Reflect.get(t, prop, receiver);

      return function (...args) {
        t.llamadas.push({
          nombre: String(prop),
          args,
          exito,
          fallo
        });
      };
    }
  });
}

function crearElementoFalso(id = '') {
  const clases = new Set();
  const classList = {
    add(...tokens) {
      for (const t of tokens) clases.add(t);
    },
    remove(...tokens) {
      for (const t of tokens) clases.delete(t);
    },
    toggle(token, force) {
      if (force !== undefined) {
        if (force) {
          clases.add(token);
          return true;
        } else {
          clases.delete(token);
          return false;
        }
      }
      if (clases.has(token)) {
        clases.delete(token);
        return false;
      } else {
        clases.add(token);
        return true;
      }
    },
    contains(token) {
      return clases.has(token);
    }
  };

  const atributos = new Map();
  return {
    id,
    value: '',
    className: '',
    selectedIndex: 0,
    textContent: '',
    innerHTML: '',
    href: '',
    checked: false,
    disabled: false,
    files: [],
    style: {},
    dataset: {},
    options: [],
    classList,
    addEventListener: () => {},
    focus: () => {},
    blur: () => {},
    click: () => {},
    showPicker: () => {},
    scrollIntoView: () => {},
    setAttribute: (nombre, valor) => atributos.set(nombre, String(valor)),
    getAttribute: nombre => (atributos.has(nombre) ? atributos.get(nombre) : null),
    removeAttribute: nombre => atributos.delete(nombre),
    appendChild: () => {},
    querySelector: () => crearElementoFalso()
  };
}

/**
 * Un <select> falso: `value` sigue a `selectedIndex` como en el navegador.
 * Uso: doc.elementos.set('pagadoPor', crearSelect('pagadoPor', ['Marcos', 'Flor']))
 */
function crearSelect(id, textos, elegido = 0) {
  const sel = crearElementoFalso(id);
  delete sel.value;
  sel.options = textos.map(t => ({ textContent: t, value: t }));
  sel.selectedIndex = elegido;
  Object.defineProperty(sel, 'value', {
    enumerable: true,
    get() { return sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].value : ''; },
    set(v) { sel.selectedIndex = sel.options.findIndex(o => o.value === String(v)); }
  });
  return sel;
}

function crearDocumento() {
  const elementos = new Map();
  return {
    elementos,
    getElementById(id) {
      if (!elementos.has(id)) {
        elementos.set(id, crearElementoFalso(id));
      }
      return elementos.get(id);
    },
    querySelector() {
      return crearElementoFalso();
    },
    createElement() {
      return crearElementoFalso();
    }
  };
}

function crearSessionStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    }
  };
}

function cargarServidor(archivos = ['Código.js'], globales = {}) {
  const sandbox = {
    console
  };

  for (const servicio of SERVICIOS_DEFAULT) {
    sandbox[servicio] = crearStubServicio(servicio);
  }

  Object.assign(sandbox, globales);

  const ctx = vm.createContext(sandbox);

  for (const archivo of archivos) {
    const ruta = path.resolve(__dirname, '..', 'apps-script', archivo);
    const contenido = fs.readFileSync(ruta, 'utf8');
    vm.runInContext(contenido, ctx, { filename: ruta });
  }

  return ctx;
}

function cargarHtml(archivo, globales = {}) {
  const ruta = path.resolve(__dirname, '..', 'apps-script', archivo);
  const html = fs.readFileSync(ruta, 'utf8');

  const reScript = /<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;
  while ((match = reScript.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  const codigo = scripts.join('\n');

  const listeners = new Map();
  const windowObj = {
    addEventListener(tipo, fn) {
      if (!listeners.has(tipo)) {
        listeners.set(tipo, []);
      }
      listeners.get(tipo).push(fn);
    }
  };

  function dispararEvento(tipo, evento = {}) {
    const lista = listeners.get(tipo) || [];
    for (const fn of lista.slice()) {
      fn.call(windowObj, evento);
    }
  }

  const doc = crearDocumento();
  const runner = crearRunner();
  const storage = crearSessionStorage();
  const hostHistory = {
    pushState: () => {},
    replaceState: () => {}
  };

  const sandbox = {
    window: windowObj,
    document: doc,
    google: {
      script: {
        run: runner
      }
    },
    sessionStorage: storage,
    history: hostHistory,
    setTimeout,
    clearTimeout,
    console,
    dispararEvento,
    llamadas: runner.llamadas
  };

  windowObj.window = windowObj;
  windowObj.document = doc;
  windowObj.google = sandbox.google;
  windowObj.sessionStorage = storage;
  windowObj.history = hostHistory;
  windowObj.setTimeout = setTimeout;
  windowObj.clearTimeout = clearTimeout;
  windowObj.console = console;
  windowObj.dispararEvento = dispararEvento;

  Object.assign(sandbox, globales);
  if (globales.document) windowObj.document = globales.document;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(codigo, ctx, { filename: ruta });

  return ctx;
}

module.exports = {
  cargarServidor,
  cargarHtml,
  crearDocumento,
  crearSelect,
  crearRunner
};
