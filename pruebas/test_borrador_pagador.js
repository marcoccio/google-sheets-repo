// Secuencia de carga de la pagina en Web_v9 tras una recarga por el watchdog.
// Marcos estaba cargando un gasto que pagó Flor.
const form = { monto: "", pagadoPor: "Marcos" };      // valores por defecto del HTML
const borrador = { monto: "45000" };                  // guardarBorrador() solo guarda montos y descripciones
const YO = "Marcos";

// linea 815: recuperarBorrador() corre sincronico al cargar
Object.assign(form, borrador);
// linea 803: obtenerOpciones() vuelve despues -> iniciar() -> aplicarMiNombre()
form.pagadoPor = YO;

console.log("Antes de la recarga: monto 45000, pagó Flor");
console.log("Después de recuperar:", form);
console.log(">>> El monto vuelve, pero 'pagó' quedó en Marcos. Si guarda sin mirar, se atribuye mal.");
