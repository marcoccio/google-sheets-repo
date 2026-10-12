// Secuencia real de enviarGasto + leerArchivo con una foto de 9 MB.
let pantalla = "";
const mostrar = (t, tipo) => { pantalla = `[${tipo}] ${t}`; console.log("  pantalla ->", pantalla); };
const planilla = [];

function leerArchivo(archivo) {
  return new Promise(resolver => {
    if (!archivo) return resolver(null);
    if (archivo.size > 8 * 1024 * 1024) {
      mostrar('El archivo supera los 8 MB. Probá con una foto más liviana.', 'error');
      return resolver(null);            // <- null = "no hay adjunto"
    }
    resolver({ nombre: archivo.name });
  });
}

function guardarGasto(d) {               // servidor
  planilla.push({ monto: d.monto, comprobante: d.comprobante ? d.comprobante.nombre : "(ninguno)" });
  return "Gasto cargado: Verduras $8.000";
}

console.log("Usuario adjunta una foto de 9 MB y toca Guardar:");
leerArchivo({ name: "ticket.jpg", size: 9 * 1024 * 1024 }).then(comp => {
  const msg = guardarGasto({ monto: 8000, comprobante: comp });
  mostrar(msg, 'ok');
  console.log("\nLo que queda en pantalla:", pantalla);
  console.log("Lo que quedó en la planilla:", planilla);
  console.log("\n>>> El usuario ve 'Gasto cargado' y cree que la foto quedó. No quedó.");
});
