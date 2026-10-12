# Pruebas de regresión

Cada archivo reproduce un bug encontrado en la revisión.
Hoy todas **muestran el bug**. Cuando el arreglo esté hecho, cada una tiene que
mostrar el comportamiento correcto.

| Archivo | Bug | Cómo correr |
|---|---|---|
| test_fecha_y_monto.js | A1: fechas inválidas aceptadas. También verifica aNumero (9/9 OK) | `node test_fecha_y_monto.js` |
| test_watchdog_duplica.js | C1: el watchdog duplica gastos | `node test_watchdog_duplica.js` (tarda 26 s) |
| test_zona_horaria.js | H1: después de las 21 h pone la fecha de mañana | `TZ=America/Argentina/Mendoza node test_zona_horaria.js` |
| test_adjunto_descartado.js | H2: comprobante >8 MB se descarta en silencio | `node test_adjunto_descartado.js` |
| test_borrador_pagador.js | H3: recuperar el borrador resetea quién pagó | `node test_borrador_pagador.js` |

`test_fecha_y_monto.js` contiene `aFecha` y `aNumero` **copiadas de
Codigo_v11.gs**. Con clasp conviene cambiarlo para que las extraiga del
archivo real del proyecto, así la prueba sigue al código.

Las otras cuatro simulan la lógica del frontend, porque dependen del navegador
o de `google.script.run`. Son fieles a la secuencia del código, pero no
reemplazan probar en el teléfono.
