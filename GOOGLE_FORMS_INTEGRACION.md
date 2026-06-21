# Integracion de Google Forms con formulario personalizado

Este documento registra como se integro un Google Forms publico con una pagina HTML propia del sitio JuanyTours, manteniendo control visual del formulario y enviando las respuestas al Google Forms original.

## Objetivo

Reemplazar el iframe visual de Google Forms por un formulario propio en `forms_1.html`, con estilos personalizados, pero enviando las respuestas al mismo formulario de Google.

La URL principal del formulario original es:

```text
https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/viewform?usp=dialog
```

El endpoint de envio usado por Google Forms es la misma URL base, cambiando `viewform` por `formResponse`:

```text
https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/formResponse
```

## Archivos involucrados

El archivo principal creado/modificado fue:

```text
forms_1.html
```

Este archivo contiene:

- Estructura HTML del formulario personalizado.
- CSS embebido para el diseno visual.
- Campos `name="entry.xxxxx"` conectados a Google Forms.
- Envio JavaScript con `fetch` y `mode: 'no-cors'` para mandar datos a Google Forms sin redirigir la pagina.
- JavaScript para mostrar estado de envio y confirmacion.

## Stack de tecnologias

La implementacion usa tecnologias web estandar, sin backend propio.

### Frontend

- HTML5: estructura del formulario, campos, selects, textarea, campos ocultos y formulario `POST`.
- CSS3: diseno visual, layout responsive, grillas, estados visuales, botones, espaciado y adaptacion movil.
- JavaScript vanilla: manejo del evento `submit`, estado de carga, modificacion del textarea antes del envio, reseteo del formulario y confirmacion visual.
- Font Awesome: iconos usados en botones, marca y opciones visuales.
- Google Fonts: tipografias visuales del formulario.
- Choices.js: selector buscable para elegir pais de destino.
- REST Countries API: fuente dinamica para cargar la lista de paises.

### Servicio externo

- Google Forms: almacenamiento final de respuestas.
- Endpoint `formResponse`: destino HTTP al que se envian los datos.

### Herramientas de inspeccion y prueba

- DevTools o inspeccion del HTML publico del formulario.
- Busqueda de `FB_PUBLIC_LOAD_DATA_` en el HTML de Google Forms.
- PowerShell con `Invoke-WebRequest` para probar envios `POST` directos.
- Git para revisar cambios locales.

## Conocimientos necesarios

Para replicar o mantener esta integracion conviene entender:

- Formularios HTML: atributos `action`, `method`, `name`, `value`, `required`.
- Metodo HTTP `POST`: envio de datos desde un formulario hacia un endpoint.
- Codificacion de datos de formulario: pares `name=value`.
- Diferencia entre labels visibles y nombres internos de campos.
- `fetch` con `mode: 'no-cors'`: envio cross-origin sin leer la respuesta.
- Eventos JavaScript: `submit` en formularios y manejo asincrono con `async/await`.
- Restricciones de seguridad del navegador: no se puede leer libremente una respuesta cross-origin de Google Forms.
- Selects y radios: los valores enviados deben coincidir con lo que espera el receptor.
- Responsive design: uso de CSS Grid, `clamp()`, media queries y tamanos fluidos.

## Conceptos clave

### Endpoint

Un endpoint es una URL que recibe una solicitud. En este caso, Google Forms recibe respuestas en:

```text
/formResponse
```

No es una API oficial documentada para integraciones externas, pero es el endpoint usado por el formulario HTML de Google.

### Campos `entry.*`

Cada pregunta de Google Forms tiene un ID interno. Para enviar una respuesta, el campo HTML debe usar ese ID en el atributo `name`.

Ejemplo:

```html
<input name="entry.2123028107" />
```

Si el nombre no coincide, Google Forms ignora el dato o no lo asocia con ninguna pregunta.

### POST tradicional

El navegador toma los campos del formulario y envia sus valores al endpoint:

```text
entry.2123028107=Juan Perez
entry.2047318532=+1 809 000 0000
submit=Submit
```

### Fetch no-cors

La pagina intercepta el submit nativo con `event.preventDefault()` y envia los datos con `fetch`.

```js
await fetch(form.action, {
  method: 'POST',
  mode: 'no-cors',
  body: new URLSearchParams(formData)
});
```

Esto evita que el navegador abra la pagina de respuesta de Google Forms.

### Confirmacion local

Como `mode: 'no-cors'` devuelve una respuesta opaca, la pagina no puede leer el HTML de confirmacion de Google. La confirmacion local indica que el request salio sin error de red; la verificacion definitiva se hace revisando respuestas en Google Forms.

## Tecnicas usadas

### 1. Reemplazo visual del iframe

No se muestra el iframe de Google Forms. Se construye un formulario propio con mejor diseno y control visual.

### 2. Reutilizacion del backend de Google Forms

Aunque el frontend es propio, el almacenamiento sigue siendo Google Forms. Esto evita crear una base de datos o backend.

### 3. Mapeo manual de campos

Se inspecciono el Google Forms original y se mapearon sus preguntas a campos HTML propios usando `entry.*`.

### 4. Envio con fetch no-cors

El formulario conserva `action` y `method`, pero JavaScript intercepta el submit y envia el payload con `fetch`.

```js
event.preventDefault();
await fetch(form.action, {
  method: 'POST',
  mode: 'no-cors',
  body: new URLSearchParams(formData)
});
```

Esto mantiene al usuario dentro de la pagina personalizada.

### 5. Estado de carga

Antes del envio, JavaScript cambia el boton a estado de carga:

```js
submitButton.disabled = true;
submitButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
```

### 6. Campo visual conectado a Google Forms

El selector visual `Estilo de viaje` esta conectado directamente al campo real `entry.1095392009` del Google Forms.

### 7. Validacion nativa del navegador

Se usa `required` y `form.reportValidity()` para validar campos obligatorios antes del envio.

### 8. Prueba directa del endpoint

Se probo el endpoint con `Invoke-WebRequest` para separar problemas de frontend de problemas del formulario de Google.

## Como funciona la integracion

Google Forms recibe respuestas mediante un formulario HTML tradicional con metodo `POST`.

En esta integracion no se carga el iframe visual de Google Forms para que el usuario lo complete. En su lugar:

1. Se usa una pagina HTML propia con diseno personalizado.
2. Se inspecciona el Google Forms publico para encontrar los IDs internos de sus preguntas.
3. Se crean campos HTML con `name="entry.ID"`.
4. Se envia un `POST` al endpoint `formResponse`.
5. Se usa JavaScript para evitar que la pagina redirija a Google despues del envio.

Resumen:

```text
Google Forms visual iframe: no
Formulario propio: si
Endpoint formResponse de Google: si
IDs internos entry.*: si
API oficial de Google Forms: no
Fetch no-cors para evitar redireccion: si
Iframe oculto para evitar redireccion: alternativa anterior
```

Inicialmente se uso un iframe oculto como destino tecnico del formulario. Luego se cambio a `fetch` con `mode: 'no-cors'` porque desde la pagina local el iframe podia dar una confirmacion visual sin garantizar claramente que la respuesta se registrara.

La etiqueta `<form>` personalizada apunta directamente al endpoint de Google:

```html
<form
  class="quote-form"
  id="quoteForm"
  action="https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/formResponse"
  method="POST"
  target="googleFormsTarget"
>
```

La clave esta en que cada campo debe usar el `name` interno que Google Forms espera. Esos nombres tienen formato:

```text
entry.XXXXXXXXXX
```

Por ejemplo:

```html
<input id="name" name="entry.2123028107" type="text" required />
```

Google Forms no usa nombres como `name`, `phone` o `email`; usa IDs internos por pregunta.

## Mapeo de campos

Estos son los campos detectados en el Google Forms original y su equivalente en `forms_1.html`:

| Campo visible | ID usado por Google Forms | Tipo en la pagina |
|---|---:|---|
| Nombre Completo | `entry.2123028107` | `input type="text"` |
| Correo Electronico | `entry.519760710` | `input type="email"` |
| Telefono de Contacto | `entry.2047318532` | `input type="tel"` |
| Destino principal de interes | `entry.1280257100` | `select` buscable en la web; respuesta corta en Google Forms |
| Fecha de Inicio del Viaje | `entry.547457192` | `input type="date"` |
| Fecha de Finalizacion del Viaje | `entry.1775139268` | `input type="date"` |
| Cantidad de personas | `entry.1997944582` | `select` |
| Estilos de Viajes | `entry.1095392009` | `radio` |
| Presupuesto estimado por persona | `entry.111910584` | `select` |
| Descripcion del viaje ideal | `entry.472278065` | `textarea` |

## Opciones exactas de Google Forms

Para preguntas de seleccion multiple o lista, los valores enviados deben coincidir con las opciones reales del Google Forms.

### Destino principal

El Google Forms debe tener este campo como respuesta corta para aceptar cualquier pais enviado desde la pagina.

En la web se muestra como un selector buscable con Choices.js. La lista se carga desde REST Countries:

```js
fetch('https://restcountries.com/v3.1/all?fields=name,translations,cca2')
```

Se usa el nombre en espanol cuando esta disponible:

```js
country.translations?.spa?.common || country.name?.common
```

Si Choices.js o REST Countries falla, el formulario conserva un select nativo con una lista minima de respaldo.

Version anterior con valores fijos:

```text
Playas y Sol (Caribe, Sudeste Asiatico, etc.)
Ciudades Historicas y Cultura (Europa, Medio Oriente)
Aventura y Naturaleza (Montanas, Safaris, Parques Nacionales)
Cruceros y Viajes Maritimos
Destinos Exoticos/Lejanos (Antartida, Polinesia, Japon)
Viajes Nacionales
Otro (Por favor, especifique en el mensaje)
```

### Cantidad de viajeros

Valores usados:

```text
1 Persona (Viajero Solitario)
2 Personas
3 - 4 Personas
5 - 8 Personas (Grupo Pequeno)
Mas de 8 Personas (Grupo Grande)
```

### Estilos de Viajes

Valores usados:

```text
Hospedaje
Tours
Boletos Aereos
```

### Presupuesto

Valores usados:

```text
Menos de $1,000
$1,000 - $3,000
$3,001 - $6,000
$6,001 - $10,000
Mas de $10,000
```

## Campos ocultos necesarios

Ademas de los campos visibles, se agregaron campos ocultos que Google Forms espera:

```html
<input type="hidden" name="fvv" value="1" />
<input type="hidden" name="pageHistory" value="0" />
<input type="hidden" name="submit" value="Submit" />
```

El mas importante es:

```html
<input type="hidden" name="submit" value="Submit" />
```

Sin ese campo, Google Forms puede responder con `200 OK`, pero no necesariamente registra la respuesta.

## Envio sin redireccion

Si el formulario se envia directamente a Google Forms, el navegador puede redirigir la pagina actual hacia Google.

La version actual evita esa redireccion interceptando el evento `submit` con JavaScript:

```js
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  // construir payload y enviarlo con fetch
});
```

El envio se hace con:

```js
await fetch(form.action, {
  method: 'POST',
  mode: 'no-cors',
  body: new URLSearchParams(formData)
});
```

`mode: 'no-cors'` permite hacer el POST cross-origin hacia Google Forms desde la pagina. La respuesta queda opaca para JavaScript, por lo que no se puede leer el HTML devuelto por Google, pero el request se envia.

### Alternativa anterior: iframe oculto

Otra tecnica posible es usar:

```html
target="googleFormsTarget"
```

Con:

```html
<iframe name="googleFormsTarget" style="display:none;"></iframe>
```

Eso envia el POST dentro del iframe, mientras la pagina principal se mantiene visible. En esta implementacion se prefirio `fetch no-cors` para controlar mejor el flujo desde JavaScript.

## Confirmacion visual

Como `fetch` con `mode: 'no-cors'` no permite leer el contenido de la respuesta, la confirmacion visual se muestra cuando el request termina sin error de red.

```js
try {
  await fetch(form.action, {
    method: 'POST',
    mode: 'no-cors',
    body: new URLSearchParams(formData)
  });
  form.reset();
  success.classList.add('is-visible');
} catch (sendError) {
  error.classList.add('is-visible');
}
```

Para confirmar al 100% que Google registro una respuesta, se debe verificar la pestaña de respuestas del Google Forms o hacer una prueba directa del endpoint como se describe mas abajo.

## Error encontrado

El primer intento parecia funcionar porque:

- El formulario mostraba mensaje de exito local.
- Google respondia con estado HTTP `200 OK`.
- No aparecia error visible en la pagina.

Pero las respuestas no llegaban a Google Forms.

La causa fue que faltaba el campo:

```html
<input type="hidden" name="submit" value="Submit" />
```

Al probar el envio por terminal, Google devolvia `200 OK`, pero seguia mostrando la pagina del formulario en vez de la confirmacion real.

Cuando se agrego `submit=Submit`, Google devolvio la confirmacion:

```text
Se registro tu respuesta.
```

Despues de ese cambio, el envio quedo registrado correctamente.

## Pruebas realizadas

Se hicieron pruebas enviando datos directamente al endpoint `formResponse`.

Prueba basica:

```powershell
$body=@{
  'entry.2123028107'='Prueba Codex';
  'entry.2047318532'='+18095550100';
  'entry.1280257100'='Viajes Nacionales';
  'entry.1997944582'='2 Personas';
  'entry.111910584'='Menos de $1,000';
  'entry.472278065'='Prueba de envio desde formulario personalizado';
  'fvv'='1';
  'pageHistory'='0';
  'submit'='Submit'
}

Invoke-WebRequest `
  -Uri "https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/formResponse" `
  -Method Post `
  -Body $body `
  -UseBasicParsing
```

Resultado esperado:

```text
Se registro tu respuesta.
```

Tambien se probo con fechas:

```text
entry.547457192 = 2026-05-10
entry.1775139268 = 2026-05-15
```

Google Forms acepto el formato `YYYY-MM-DD` desde el formulario HTML.

## Requisitos para replicar esta integracion

Para replicarla con otro Google Forms se necesita:

1. Tener la URL publica del formulario.
2. Cambiar `viewform` por `formResponse` para obtener el endpoint de envio.
3. Extraer los IDs `entry.xxxxx` de cada pregunta.
4. Usar esos IDs como atributo `name` en los campos HTML propios.
5. Respetar los valores exactos de opciones multiples o listas.
6. Agregar los campos ocultos `fvv`, `pageHistory` y `submit`.
7. Enviar con `method="POST"`.
8. Usar `fetch` con `mode: 'no-cors'` para evitar redireccion a Google.

## Primer paso: scraping del Google Forms

El primer paso practico para hacer esta integracion es obtener el HTML publico del Google Forms. A esto se le puede llamar scraping o inspeccion del formulario.

La idea es abrir o descargar la pagina publica:

```text
https://docs.google.com/forms/d/e/FORM_ID/viewform
```

Luego se analiza el HTML y JavaScript que Google Forms entrega al navegador. En ese contenido se buscan:

- Titulo del formulario.
- Descripcion.
- Preguntas visibles.
- IDs internos de cada pregunta.
- Opciones de selects, radios o checkboxes.
- Campos ocultos que Google Forms usa para el envio.
- Endpoint real de envio.

La informacion mas importante suele estar en la variable JavaScript:

```js
FB_PUBLIC_LOAD_DATA_
```

Esa variable contiene la representacion interna del formulario. No es una API formal, pero Google la incluye en el HTML para que su propia pagina pueda renderizar el formulario.

Flujo recomendado:

```text
1. Descargar o abrir el HTML publico del Google Forms.
2. Buscar la variable FB_PUBLIC_LOAD_DATA_.
3. Identificar cada pregunta y su ID interno.
4. Identificar las opciones exactas de preguntas cerradas.
5. Convertir cada ID interno en name="entry.ID".
6. Crear el formulario propio con esos name.
7. Probar el POST contra /formResponse.
8. Confirmar que la respuesta aparece en Google Forms.
```

Ejemplo de descarga con PowerShell:

```powershell
Invoke-WebRequest `
  -Uri "https://docs.google.com/forms/d/e/FORM_ID/viewform" `
  -UseBasicParsing
```

Despues de obtener el HTML, se puede buscar:

```text
FB_PUBLIC_LOAD_DATA_
entry.
formResponse
```

Este scraping debe repetirse si el formulario original cambia de forma importante, especialmente si se agregan, eliminan o recrean preguntas.

## Como extraer los IDs entry

Los IDs pueden obtenerse inspeccionando el HTML del Google Forms.

En el HTML aparece una variable llamada:

```js
FB_PUBLIC_LOAD_DATA_
```

Dentro de esa estructura estan los nombres de preguntas y sus IDs. Por ejemplo:

```text
"Nombre Completo" ... [[2123028107,null,0]]
```

Ese ID se convierte en:

```text
entry.2123028107
```

Tambien se pueden buscar directamente patrones como:

```text
entry.
```

### Ejemplo real de extraccion

Para este formulario, los IDs se encontraron leyendo el HTML publico de:

```text
https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/viewform?usp=dialog
```

Dentro de ese HTML, Google Forms incluye una variable JavaScript llamada:

```js
FB_PUBLIC_LOAD_DATA_
```

Esa variable contiene la estructura interna del formulario: titulo, descripcion, preguntas, opciones y los IDs reales que Google espera para recibir respuestas.

Un fragmento simplificado se ve asi:

```js
[
  1984325191,
  "Nombre Completo",
  null,
  0,
  [
    [2123028107, null, 0]
  ],
  ...
]
```

En ese ejemplo:

- `"Nombre Completo"` es el texto visible de la pregunta.
- `2123028107` es el ID interno del campo.
- El nombre que se debe usar en HTML es `entry.2123028107`.

Por eso el campo personalizado queda asi:

```html
<input
  id="name"
  name="entry.2123028107"
  type="text"
  required
/>
```

Google Forms no identifica las respuestas por el texto visible del label. Las identifica por el atributo `name` con formato `entry.ID`.

## Como se ve el formulario enviado a Google Forms

El navegador no envia una pagina HTML completa al endpoint. Envia un formulario `POST` con pares `name=value`.

En HTML, la estructura base se ve asi:

```html
<form
  action="https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/formResponse"
  method="POST"
  target="googleFormsTarget"
>
  <input name="entry.2123028107" value="Juan Perez" />
  <input name="entry.519760710" value="juan@email.com" />
  <input name="entry.2047318532" value="+1 809 000 0000" />

  <select name="entry.1280257100">
    <option value="Viajes Nacionales" selected>Viajes Nacionales</option>
  </select>

  <input name="entry.547457192" value="2026-05-10" />
  <input name="entry.1775139268" value="2026-05-15" />

  <select name="entry.1997944582">
    <option value="2 Personas" selected>2 Personas</option>
  </select>

  <label>
    <input type="radio" name="entry.1095392009" value="Hospedaje" checked />
    Hospedaje
  </label>

  <select name="entry.111910584">
    <option value="Menos de $1,000" selected>Menos de $1,000</option>
  </select>

  <textarea name="entry.472278065">Detalles del viaje</textarea>

  <input type="hidden" name="fvv" value="1" />
  <input type="hidden" name="pageHistory" value="0" />
  <input type="hidden" name="submit" value="Submit" />
</form>
```

Al enviarse, el navegador transforma esos campos en datos de formulario. Conceptualmente se ve asi:

```text
entry.2123028107=Juan Perez
entry.519760710=juan%40email.com
entry.2047318532=%2B1%20809%20000%200000
entry.1280257100=Viajes Nacionales
entry.547457192=2026-05-10
entry.1775139268=2026-05-15
entry.1997944582=2 Personas
entry.1095392009=Hospedaje
entry.111910584=Menos de $1,000
entry.472278065=Detalles del viaje
fvv=1
pageHistory=0
submit=Submit
```

Ese paquete de datos es lo que recibe:

```text
https://docs.google.com/forms/d/e/1FAIpQLSdTsmOljrbOfyws-zHBwdNbMD585n1rlF01kkOnymhwQ75GJw/formResponse
```

El punto critico es que los nombres deben coincidir exactamente con los IDs internos del Google Forms. Por ejemplo, si se envia `name="name"` en vez de `name="entry.2123028107"`, Google Forms no sabra a que pregunta pertenece ese valor.

## Limitaciones

Esta tecnica funciona, pero tiene limitaciones:

- Google Forms no ofrece una API publica formal para este uso.
- Si se cambian preguntas en el Google Forms, los IDs `entry.*` pueden cambiar o dejar de coincidir.
- Si se agregan preguntas obligatorias en Google Forms y no se agregan en la pagina, el envio puede fallar.
- La pagina no puede leer libremente el contenido interno de la respuesta por restricciones de seguridad del navegador.
- `fetch no-cors` evita la redireccion, pero devuelve una respuesta opaca; por eso la confirmacion final debe verificarse en Google Forms.

## Mantenimiento recomendado

Si se modifica el Google Forms original:

1. Volver a revisar los IDs `entry.*`.
2. Verificar que las opciones de selects coincidan exactamente.
3. Hacer una prueba real de envio.
4. Confirmar en Google Forms que la respuesta aparece.
5. Si aparece `200 OK` pero no llega la respuesta, revisar primero que exista `submit=Submit`.

## Resumen tecnico final

La integracion quedo asi:

- Formulario visual propio: `forms_1.html`.
- Destino real: Google Forms `formResponse`.
- Metodo: `POST`.
- Redireccion evitada con `fetch no-cors`.
- Confirmacion local cuando termina el request.
- Campos conectados mediante `entry.*`.
- Campo oculto critico: `submit=Submit`.

Este enfoque permite tener un diseno completamente personalizado sin perder el almacenamiento automatico de respuestas en Google Forms.
