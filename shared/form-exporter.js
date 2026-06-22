(function () {
  const FIELD_TYPES = {
    0: 'Texto corto',
    1: 'Parrafo',
    2: 'Opcion multiple',
    3: 'Lista desplegable',
    4: 'Casillas',
    5: 'Escala lineal',
    7: 'Cuadricula',
    9: 'Fecha',
    10: 'Hora',
  };

  const PANEL_LABELS = {
    custom: 'Informacion',
    fields: 'Campos',
    types: 'Tipos de campo',
    endpoint: 'Endpoint',
  };

  function buildOutputs(config) {
    const normalized = normalizeConfig(config);
    return {
      html: buildHtml(normalized),
      css: buildCss(),
      js: buildJs(),
      json: JSON.stringify(normalized, null, 2),
      config: normalized,
    };
  }

  function downloadZip(config) {
    const outputs = buildOutputs(config);
    const blob = createZip([
      { name: 'index.html', content: buildStandaloneHtml(outputs) },
      { name: 'styles.css', content: outputs.css },
      { name: 'script.js', content: outputs.js },
      { name: 'config.json', content: outputs.json },
    ]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugFile(outputs.config.title)}-formulario.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function normalizeConfig(config) {
    const fields = (config.fields || []).map((field, index) => ({
      ...field,
      uid: field.uid || `${field.entryId || index}_${index}`,
      entryId: field.entryId || String(index),
      name: field.name || `entry.${field.entryId || index}`,
      label: field.label || `Campo ${index + 1}`,
      placeholder: field.placeholder || '',
      renderAs: field.renderAs || defaultRender(field),
      width: field.width || defaultWidth(field.type),
      options: normalizeOptions(field.options || []),
    }));

    return {
      title: config.title || 'Formulario',
      desc: config.desc || '',
      endpoint: config.endpoint || '',
      sourceUrl: config.sourceUrl || '',
      panel: normalizePanel(config.panel || {}, config, fields),
      fields,
    };
  }

  function normalizeOptions(options) {
    return options.map(option => {
      if (typeof option === 'string') return option;
      return option.value || option.label || '';
    }).filter(Boolean);
  }

  function normalizePanel(panel, config, fields) {
    return {
      badge: panel.badge ?? 'Google Forms Inspector',
      title: panel.title ?? config.title ?? 'Formulario',
      desc: panel.desc ?? config.desc ?? '',
      items: normalizePanelItems(panel, fields),
    };
  }

  function normalizePanelItems(panel) {
    if (Array.isArray(panel.items)) {
      return panel.items.map((item, index) => normalizePanelItem(item, index)).filter(Boolean);
    }

    const items = [];
    if (panel.instructions) items.push(normalizePanelItem({ source: 'custom', icon: 'i', label: 'Instrucciones', value: panel.instructions }, 0));
    if (panel.showFields !== false) items.push(normalizePanelItem({ source: 'fields', icon: '#', label: 'Campos' }, items.length));
    if (panel.showTypes !== false) items.push(normalizePanelItem({ source: 'types', icon: '*', label: 'Tipos de campo' }, items.length));
    if (panel.showEndpoint !== false) items.push(normalizePanelItem({ source: 'endpoint', icon: '@', label: 'Endpoint' }, items.length));
    return items.length ? items : [
      normalizePanelItem({ source: 'fields', icon: '#', label: 'Campos' }, 0),
      normalizePanelItem({ source: 'types', icon: '*', label: 'Tipos de campo' }, 1),
      normalizePanelItem({ source: 'endpoint', icon: '@', label: 'Endpoint' }, 2),
    ];
  }

  function normalizePanelItem(item, index) {
    if (!item) return null;
    const source = PANEL_LABELS[item.source] ? item.source : 'custom';
    return {
      id: item.id || `panel_${index}`,
      source,
      icon: item.icon || defaultPanelIcon(source),
      label: item.label || PANEL_LABELS[source],
      value: item.value || '',
    };
  }

  function buildHtml(config) {
    const fields = config.fields.map(buildFieldHtml).join('\n\n');
    const panelItems = buildPanelItems(config);
    return `<main class="jt-page">
  <section class="jt-shell">
    <aside class="jt-panel">
      <div class="jt-panel__top">
        ${config.panel.badge ? `<div class="jt-panel__badge">${esc(config.panel.badge)}</div>` : ''}
        <h1>${esc(config.panel.title)}</h1>
        ${config.panel.desc ? `<p>${multiline(config.panel.desc)}</p>` : ''}
      </div>
      ${panelItems ? `<div class="jt-panel__stats">
${indent(panelItems, 8)}
      </div>` : ''}
    </aside>
    <div class="jt-form-wrap">
      <form class="jt-form" id="jtForm" action="${escA(config.endpoint)}" method="POST">
        <div class="jt-form__head">
          <div>
            <h2>${esc(config.title)}</h2>
            ${config.desc ? `<p>${esc(config.desc)}</p>` : ''}
          </div>
          <span class="jt-badge">${config.fields.length} campo${config.fields.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="jt-form__grid">
${indent(fields, 10)}
        </div>
        <input type="hidden" name="fvv" value="1" />
        <input type="hidden" name="pageHistory" value="0" />
        <input type="hidden" name="submit" value="Submit" />
        <div class="jt-form__actions">
          <button class="jt-form__submit" type="submit">Enviar</button>
        </div>
        <div class="jt-form__success" id="jtSuccess" role="status">Formulario enviado correctamente.</div>
        <div class="jt-form__error" id="jtError" role="alert">No se pudo enviar. Intenta nuevamente.</div>
      </form>
    </div>
  </section>
</main>`;
  }

  function buildPanelItems(config) {
    return config.panel.items.map(item => {
      const value = panelItemValue(item, config);
      if (!value) return '';
      return `<div class="jt-stat">
  <span class="jt-stat__icon">${esc(item.icon || defaultPanelIcon(item.source))}</span>
  <div>
    <span>${esc(item.label || PANEL_LABELS[item.source] || 'Informacion')}</span>
    <strong>${multiline(value)}</strong>
  </div>
</div>`;
    }).filter(Boolean).join('\n\n');
  }

  function buildFieldHtml(field) {
    const full = field.width === 'full' ? ' jt-field--full' : '';
    const required = field.required ? ' required' : '';
    const reqMark = field.required ? ' <span aria-hidden="true">*</span>' : '';
    const label = `<label for="jt_${escA(field.entryId)}">${esc(field.label)}${reqMark}</label>`;

    if (field.renderAs === 'textarea') {
      return `<div class="jt-field${full}">
  ${label}
  <textarea id="jt_${escA(field.entryId)}" name="${escA(field.name)}" placeholder="${escA(field.placeholder)}"${required}></textarea>
</div>`;
    }

    if (field.renderAs === 'select') {
      const options = field.options.map(option => `<option value="${escA(option)}">${esc(option)}</option>`).join('\n    ');
      return `<div class="jt-field${full}">
  ${label}
  <select id="jt_${escA(field.entryId)}" name="${escA(field.name)}"${required}>
    <option value="">${esc(field.placeholder || 'Selecciona una opcion')}</option>
    ${options}
  </select>
</div>`;
    }

    if (field.renderAs === 'radio' || field.renderAs === 'checkbox') {
      const options = field.options.length ? field.options : [''];
      const optionsHtml = options.map((option, index) => {
        const id = `jt_${field.entryId}_${index}`;
        const radioRequired = field.required && field.renderAs === 'radio' ? ' required' : '';
        return `<label class="jt-option" for="${escA(id)}">
    <input id="${escA(id)}" type="${field.renderAs}" name="${escA(field.name)}" value="${escA(option)}"${radioRequired} />
    <span>${esc(option || 'Sin opciones detectadas')}</span>
  </label>`;
      }).join('\n  ');
      return `<fieldset class="jt-field jt-field--options${full}">
  <legend>${esc(field.label)}${reqMark}</legend>
  <div class="jt-options">
  ${optionsHtml}
  </div>
</fieldset>`;
    }

    const type = ['date', 'time'].includes(field.renderAs) ? field.renderAs : 'text';
    return `<div class="jt-field${full}">
  ${label}
  <input id="jt_${escA(field.entryId)}" type="${type}" name="${escA(field.name)}" placeholder="${escA(field.placeholder)}"${required} />
</div>`;
  }

  function buildCss() {
    return `*,*::before,*::after{box-sizing:border-box}body{min-height:100vh;margin:0;background:radial-gradient(circle at 12% 16%,rgba(13,154,148,.14),transparent 32%),linear-gradient(135deg,#f8fafc 0%,#eef7f7 50%,#fff 100%);color:#334155;font-family:Inter,system-ui,sans-serif;line-height:1.5}.jt-page{min-height:100vh;padding:clamp(.75rem,2vw,1.5rem);display:grid;place-items:center}.jt-shell{width:min(1120px,100%);display:grid;grid-template-columns:.85fr 1.15fr;background:#fff;border:1px solid rgba(13,31,60,.08);border-radius:28px;box-shadow:0 24px 70px rgba(13,31,60,.16);overflow:hidden;min-height:min(820px,calc(100vh - 3rem))}.jt-panel{position:relative;padding:clamp(1.75rem,4vw,3rem);background:linear-gradient(155deg,#0d1f3c 0%,#0e2647 55%,#0d3a38 100%);color:#fff;display:flex;flex-direction:column;gap:2rem}.jt-panel::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 80%,rgba(13,154,148,.22),transparent 60%);pointer-events:none}.jt-panel__top,.jt-panel__stats{position:relative}.jt-panel__badge{display:inline-flex;width:fit-content;margin-bottom:.9rem;padding:.3rem .75rem;border-radius:999px;background:rgba(13,154,148,.22);border:1px solid rgba(13,154,148,.35);color:rgba(255,255,255,.88);font-size:.72rem;font-weight:700}.jt-panel h1{margin:0;color:#fff;font-family:'Playfair Display',Georgia,serif;font-size:clamp(2.1rem,4vw,3.25rem);line-height:1.05}.jt-panel p{max-width:32rem;margin:1rem 0 0;color:rgba(255,255,255,.72);font-size:.95rem}.jt-panel__stats{display:grid;gap:.7rem}.jt-stat{display:flex;align-items:center;gap:.85rem;padding:.75rem .9rem;border-radius:20px;background:linear-gradient(135deg,rgba(13,154,148,.18),rgba(255,255,255,.08));border:1px solid rgba(13,154,148,.28)}.jt-stat__icon{width:36px;height:36px;display:grid;place-items:center;flex:0 0 auto;border-radius:8px;background:#0d9a94;color:#fff;font-weight:800}.jt-stat span:not(.jt-stat__icon){display:block;color:rgba(255,255,255,.5);font-size:.72rem;font-weight:700}.jt-stat strong{display:block;color:#fff;font-size:.82rem;line-height:1.35;word-break:break-word}.jt-form-wrap{padding:clamp(1.35rem,4vw,3rem);overflow-y:auto}.jt-form{width:100%;margin:0;padding:0;border:0;background:transparent;color:#334155;font-family:Inter,system-ui,sans-serif;box-shadow:none;display:grid;gap:.9rem}.jt-form__head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}.jt-form__head h2{margin:0;color:#0d1f3c;font-family:'Playfair Display',Georgia,serif;font-size:clamp(1.4rem,2.5vw,1.9rem);line-height:1.15}.jt-form__head p{margin:0;color:#64748b;font-size:.875rem}.jt-badge{display:inline-flex;align-items:center;flex:0 0 auto;padding:.45rem .85rem;border-radius:999px;background:#eef9f9;color:#0a7a74;font-size:.72rem;font-weight:700;white-space:nowrap}.jt-form__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:1.35rem;row-gap:1rem}.jt-field{display:grid;gap:.35rem;border:0;padding:0;margin:0;min-width:0}.jt-field--full,.jt-field--options{grid-column:1/-1}.jt-field label,.jt-field legend{color:#0d1f3c;font-size:.875rem;font-weight:600}.jt-field span[aria-hidden=true],.jt-field legend span{color:#ef4444}.jt-field input[type=text],.jt-field input[type=date],.jt-field input[type=time],.jt-field select,.jt-field textarea{width:100%;min-height:44px;padding:.7rem 1rem;border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;color:#334155;font-family:Inter,system-ui,sans-serif;font-size:.875rem;outline:none}.jt-field input:focus,.jt-field select:focus,.jt-field textarea:focus{border-color:#0d9a94;box-shadow:0 0 0 4px rgba(13,154,148,.12);background:#fbffff}.jt-field textarea{min-height:96px;resize:vertical;line-height:1.5}.jt-field select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 1rem center;padding-right:2.5rem}.jt-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.6rem}.jt-option{position:relative}.jt-option input[type=radio],.jt-option input[type=checkbox]{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}.jt-option span{display:flex;align-items:center;justify-content:center;min-height:44px;padding:.55rem .75rem;border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;color:#475569;font-size:.875rem;font-weight:600;text-align:center;cursor:pointer;line-height:1.3;user-select:none}.jt-option input:checked+span,.jt-option span:hover{border-color:#0d9a94;background:#eef9f9;color:#0a7a74}.jt-form__actions{margin-top:1rem;display:flex;gap:.85rem;flex-wrap:wrap}.jt-form__submit{min-height:46px;padding:.72rem 1.2rem;border:0;border-radius:14px;background:#00cf61;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:.875rem;font-weight:700;cursor:pointer;box-shadow:0 12px 25px rgba(0,207,97,.24)}.jt-form__success,.jt-form__error{display:none;margin-top:1rem;padding:.9rem 1.1rem;border-radius:20px;font-size:.875rem;font-weight:600}.jt-form__success{border:1px solid rgba(16,185,129,.28);background:rgba(16,185,129,.08);color:#10b981}.jt-form__error{border:1px solid rgba(239,68,68,.28);background:rgba(239,68,68,.08);color:#ef4444}.jt-form__success.is-visible,.jt-form__error.is-visible{display:flex}@media(max-width:640px){.jt-page{padding:0}.jt-shell{grid-template-columns:1fr;border-radius:0;min-height:100vh}.jt-form__head{flex-direction:column}.jt-form__grid{grid-template-columns:1fr}.jt-field--full,.jt-field--options{grid-column:auto}.jt-options{grid-template-columns:1fr 1fr}.jt-form__submit{width:100%}}`;
  }

  function buildJs() {
    return `const form=document.getElementById('jtForm');const success=document.getElementById('jtSuccess');const error=document.getElementById('jtError');const submit=form.querySelector('.jt-form__submit');form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;const formData=new FormData(form);formData.set('fvv','1');formData.set('pageHistory','0');formData.set('submit','Submit');submit.disabled=true;success.classList.remove('is-visible');error.classList.remove('is-visible');try{await fetch(form.action,{method:'POST',mode:'no-cors',body:new URLSearchParams(formData)});form.reset();success.classList.add('is-visible')}catch(err){error.classList.add('is-visible')}finally{submit.disabled=false}});`;
  }

  function buildStandaloneHtml(outputs) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(outputs.config.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
${outputs.html}
  <script src="script.js"></script>
</body>
</html>`;
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    files.forEach(file => {
      const nameBytes = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(local.buffer);
      writeHeader(view, 0x04034b50, 20, 0, 0, crc, data.length, data.length, nameBytes.length);
      local.set(nameBytes, 30);
      chunks.push(local, data);
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      writeCentralHeader(centralView, crc, data.length, nameBytes.length, offset);
      centralHeader.set(nameBytes, 46);
      central.push(centralHeader);
      offset += local.length + data.length;
    });

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: 'application/zip' });
  }

  function writeHeader(view, signature, version, flags, method, crc, compressedSize, size, nameLength) {
    view.setUint32(0, signature, true);
    view.setUint16(4, version, true);
    view.setUint16(6, flags, true);
    view.setUint16(8, method, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, compressedSize, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameLength, true);
    view.setUint16(28, 0, true);
  }

  function writeCentralHeader(view, crc, size, nameLength, offset) {
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, nameLength, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
  }

  function crc32(data) {
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });

  function panelItemValue(item, config) {
    if (item.source === 'fields') {
      const total = config.fields.length;
      const required = config.fields.filter(field => field.required).length;
      return `${total} campo${total !== 1 ? 's' : ''}${required ? ` - ${required} obligatorio${required !== 1 ? 's' : ''}` : ''}`;
    }
    if (item.source === 'types') return summarizeTypes(config.fields);
    if (item.source === 'endpoint') return shorten(config.endpoint);
    return item.value || '';
  }

  function summarizeTypes(fields) {
    const counts = {};
    fields.forEach(field => {
      const label = FIELD_TYPES[field.type] || `Tipo ${field.type}`;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, count]) => `${count} ${label.toLowerCase()}`)
      .join(' - ');
  }

  function defaultRender(field) {
    if (field.type === 1) return 'textarea';
    if ([2, 5].includes(field.type)) return 'radio';
    if (field.type === 3) return 'select';
    if (field.type === 4) return 'checkbox';
    if (field.type === 9) return 'date';
    if (field.type === 10) return 'time';
    return field.options && field.options.length ? 'select' : 'text';
  }

  function defaultWidth(type) {
    return [1, 2, 4, 5, 7].includes(type) ? 'full' : 'half';
  }

  function defaultPanelIcon(source) {
    return { fields: '#', types: '*', endpoint: '@', custom: 'i' }[source] || 'i';
  }

  function shorten(url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.length > 34 ? '...' + parsed.pathname.slice(-28) : parsed.pathname;
      return parsed.hostname + path;
    } catch {
      return url || 'Sin endpoint';
    }
  }

  function slugFile(value) {
    return String(value || 'formulario')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'formulario';
  }

  function indent(text, spaces) {
    const pad = ' '.repeat(spaces);
    return text.split('\n').map(line => line ? pad + line : line).join('\n');
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escA(value) {
    return esc(value).replace(/'/g, '&#39;');
  }

  function multiline(value) {
    return esc(value).replace(/\r?\n/g, '<br>');
  }

  window.FormExporter = {
    buildOutputs,
    downloadZip,
  };
})();
