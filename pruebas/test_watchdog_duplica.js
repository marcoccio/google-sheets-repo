// Simulacion fiel de la funcion llamar() de Web_v9.html.
// El "servidor" falso tarda lo que tardaria una carga con comprobante.
const planilla = [];
let FALLAS_SEGUIDAS = 0;
const ESPERA_MS = 15000;

function servidorFalso(demoraMs, datos, ok) {
  setTimeout(() => { planilla.push(datos); ok("Gasto cargado"); }, demoraMs);
}

function llamar(demoraServidor, datos, alSalirBien, alFallar) {
  let terminado = false;
  const reloj = setTimeout(() => {
    if (terminado) return;
    terminado = true; FALLAS_SEGUIDAS++;
    alFallar({ message: "No respondió el servidor. Probá de nuevo." });
  }, ESPERA_MS);
  servidorFalso(demoraServidor, datos, (r) => {
    if (terminado) return;          // <- la respuesta tardia se ignora...
    terminado = true; clearTimeout(reloj); FALLAS_SEGUIDAS = 0; alSalirBien(r);
  });
}

// Escenario: gasto con foto de comprobante, el servidor tarda 22 s.
const t0 = Date.now(); const ahora = () => ((Date.now()-t0)/1000).toFixed(0)+"s";
console.log("[0s] Usuario guarda: Verdulería $8.000 con foto");
llamar(22000, "Verdulería $8.000", m => console.log(`[${ahora()}] App: ${m}`),
  e => {
    console.log(`[${ahora()}] App: ${e.message}`);
    console.log(`[${ahora()}] Usuario hace caso y toca Guardar de nuevo`);
    llamar(3000, "Verdulería $8.000", m => console.log(`[${ahora()}] App: ${m}`),
                                      e2 => console.log(`[${ahora()}] App: ${e2.message}`));
  });

setTimeout(() => {
  console.log(`\nFilas en la planilla: ${planilla.length}`);
  planilla.forEach((f,i) => console.log(`  fila ${i+1}: ${f}`));
  console.log(planilla.length > 1 ? "\n>>> GASTO DUPLICADO. El usuario vio un error y la planilla tiene el gasto dos veces." : "ok");
}, 26000);
