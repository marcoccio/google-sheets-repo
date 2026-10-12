function aFecha(texto) {
  var p = String(texto).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

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


console.log("=== aFecha con entradas reales que puede mandar el cliente ===");
for (const e of ["2026-08-10", "", undefined, "10/08/2026", "2026-13-45"]) {
  const d = aFecha(e);
  console.log(JSON.stringify(e), "->", isNaN(d) ? "Invalid Date (lo acepta igual)" : d.toISOString().slice(0,10));
}

console.log("\n=== aNumero: el codigo real, no la replica ===");
const casos = [["15000",15000],["15.000",15000],["15.000,50",15000.5],["$8.496",8496],
 ["195.962",195962],["15,50",15.5],["15.5",15.5],["1.234.567",1234567],["15000.50",15000.5]];
let ok = 0;
for (const [e, x] of casos) {
  const r = aNumero(e); const b = Math.abs(r - x) < 0.001; ok += b;
  console.log(b ? "OK " : "MAL", JSON.stringify(e).padEnd(13), "->", r);
}
console.log(ok + "/" + casos.length);

console.log("\n=== Lo que manda un <input type=number> en Android ===");
// .value de type=number siempre usa punto decimal y nunca separador de miles
for (const e of ["1.5", "1500", "15.250", "0.5"]) {
  console.log(JSON.stringify(e).padEnd(9), "->", aNumero(e));
}
