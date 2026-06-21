# JuanyTours — Forms Development

Herramientas para integrar Google Forms con formularios HTML personalizados, sin iframes y con diseño propio.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `forms_1.html` | Formulario de cotización de viajes con diseño propio que envía respuestas a Google Forms |
| `form-config.html` | Herramienta de inspección: analiza cualquier Google Form público y extrae el mapeo de campos |

---

## Cómo funciona la integración

Google Forms recibe respuestas vía `POST` a un endpoint `/formResponse`. Cada pregunta tiene un ID interno con formato `entry.XXXXXXXXXX`. En lugar de mostrar el iframe de Google, se construye un formulario HTML propio que envía datos directamente a ese endpoint.

```
Formulario propio  →  POST /formResponse  →  Google Forms almacena la respuesta
```

El envío usa `fetch` con `mode: 'no-cors'` para evitar que el navegador redirija a Google:

```js
await fetch(endpointUrl, {
  method: 'POST',
  mode: 'no-cors',
  body: new URLSearchParams(formData)
});
```

Tres campos ocultos son obligatorios para que Google registre la respuesta:

```html
<input type="hidden" name="fvv" value="1" />
<input type="hidden" name="pageHistory" value="0" />
<input type="hidden" name="submit" value="Submit" />
```

Sin `submit=Submit`, Google responde `200 OK` pero no guarda nada.

---

## Uso del inspector (`form-config.html`)

1. Abre `form-config.html` en el navegador.
2. Pega la URL del Google Form. Formatos aceptados:
   - `https://docs.google.com/forms/d/e/FORM_ID/viewform`
   - `https://docs.google.com/forms/d/e/FORM_ID/formResponse`
   - URL de edición del formulario
   - Enlace acortado `https://forms.gle/XXXX`
3. Haz clic en **Analizar**.
4. El inspector devuelve:
   - Endpoint de envío listo para copiar
   - Tabla de campos con `entry.ID`, tipo de pregunta, HTML sugerido y opciones exactas
   - JSON exportable con el mapeo completo
   - Esqueleto HTML del formulario listo para personalizar

### Cómo funciona internamente

El inspector obtiene el HTML del formulario a través de un proxy CORS (`allorigins.win` con fallback a `corsproxy.io`) y extrae la variable `FB_PUBLIC_LOAD_DATA_` que Google incrusta en cada formulario público. Esa variable contiene la estructura interna completa: títulos, IDs de preguntas, tipos de campo y opciones de selección.

---

## Stack

- HTML5 + CSS3 + JavaScript vanilla (sin frameworks ni build tools)
- [Tom Select](https://tom-select.js.org/) — selector de países con búsqueda
- [REST Countries API](https://restcountries.com/) — lista dinámica de países
- [Font Awesome 6](https://fontawesome.com/) — iconografía
- [Google Fonts](https://fonts.google.com/) — Inter + Playfair Display
- Google Forms como backend de almacenamiento

---

## Limitaciones

- Los entry IDs cambian si se **recrean** preguntas en Google Forms (editarlas no cambia el ID).
- Formularios privados o que requieren inicio de sesión no pueden analizarse con el inspector.
- `fetch no-cors` devuelve una respuesta opaca; la confirmación real debe verificarse en la pestaña de respuestas de Google Forms.
- Los proxies CORS gratuitos pueden ser lentos o tener límites de uso.

---

## Mantenimiento

Si se modifica el Google Form original:

1. Abrir `form-config.html` y analizar la nueva URL.
2. Comparar los `entry.ID` — solo cambian si se elimina y recrea una pregunta.
3. Actualizar los atributos `name` en el formulario HTML.
4. Probar un envío real y verificar en Google Forms que la respuesta llegó.
