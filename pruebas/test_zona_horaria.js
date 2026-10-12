// Lo que hace la app para poner "hoy" en el campo de fecha:
//   new Date().toISOString().slice(0, 10)
// Lo pruebo a distintas horas, en la zona horaria de Mendoza.
const horas = ["08:00", "15:00", "20:59", "21:00", "22:30", "23:59"];
console.log("Hora en Mendoza | Fecha que pone la app | Fecha real | ");
for (const h of horas) {
  const local = new Date(`2026-10-11T${h}:00-03:00`);
  const queUsaLaApp = local.toISOString().slice(0, 10);
  const real = local.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Mendoza' });
  console.log(`     ${h}      |      ${queUsaLaApp}       | ${real} | ${queUsaLaApp === real ? "ok" : "<<< MAÑANA"}`);
}
