// ─── Storage key (written by form-config.js before opening this page) ─────────
const STORAGE_KEY = 'gfi:preview';

// ─── Field type definitions ───────────────────────────────────────────────────
const FIELD_TYPES = {
  0:  { label: 'Texto corto',       icon: 'fa-font',         isHalf: true  },
  1:  { label: 'Párrafo',           icon: 'fa-align-left',   isHalf: false },
  2:  { label: 'Opción múltiple',   icon: 'fa-circle-dot',   isHalf: false },
  3:  { label: 'Lista desplegable', icon: 'fa-list',         isHalf: true  },
  4:  { label: 'Casillas',          icon: 'fa-square-check', isHalf: false },
  5:  { label: 'Escala lineal',     icon: 'fa-sliders',      isHalf: false },
  7:  { label: 'Cuadrícula',        icon: 'fa-table-cells',  isHalf: false },
  9:  { label: 'Fecha',             icon: 'fa-calendar',     isHalf: true  },
  10: { label: 'Hora',              icon: 'fa-clock',        isHalf: true  },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPreviewFromStorage();
  bindPreviewSync();
});

function loadPreviewFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { showNoData(); return; }

  let config;
  try { config = JSON.parse(raw); }
  catch { showNoData(); return; }

  if (!config.fields || !config.fields.length) { showNoData(); return; }

  buildPage(config);
}

function bindPreviewSync() {
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) loadPreviewFromStorage();
  });

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('gfi-preview');
    channel.addEventListener('message', event => {
      if (event.data && event.data.type === 'preview:update') loadPreviewFromStorage();
    });
  }
}

// ─── Build page ───────────────────────────────────────────────────────────────
function buildPage(config) {
  document.title = `${config.title} | Vista Previa`;
  fillCustomLeftPanel(config);
  fillFormHeader(config);
  buildForm(config);
  document.getElementById('pvNoData').style.display = 'none';
  document.getElementById('pvPage').style.display   = '';
}

// ─── Left panel ──────────────────────────────────────────────────────────────
function fillLeftPanel(config) {
  document.getElementById('pvTitle').textContent = config.title;

  const descEl = document.getElementById('pvDesc');
  if (config.desc) { descEl.textContent = config.desc; descEl.style.display = ''; }
  else              { descEl.style.display = 'none'; }

  const totalFields = config.fields.length;
  const reqFields   = config.fields.filter(f => f.required).length;
  const typeSummary = summarizeTypes(config.fields);

  document.getElementById('pvStats').innerHTML = `
    <div class="pv-stat">
      <div class="pv-stat__icon"><i class="fa-solid fa-list-check"></i></div>
      <div>
        <div class="pv-stat__label">Campos</div>
        <div class="pv-stat__value">
          ${totalFields} campo${totalFields !== 1 ? 's' : ''}
          ${reqFields ? `<span style="opacity:.6;font-size:.7rem"> · ${reqFields} obligatorio${reqFields !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
    </div>
    ${typeSummary ? `
    <div class="pv-stat">
      <div class="pv-stat__icon"><i class="fa-solid fa-shapes"></i></div>
      <div>
        <div class="pv-stat__label">Tipos de campo</div>
        <div class="pv-stat__value" style="font-size:.78rem">${typeSummary}</div>
      </div>
    </div>` : ''}
    <div class="pv-stat">
      <div class="pv-stat__icon"><i class="fa-solid fa-paper-plane"></i></div>
      <div>
        <div class="pv-stat__label">Endpoint</div>
        <div class="pv-stat__value" style="font-size:.7rem;opacity:.8">${esc(truncateUrl(config.endpoint))}</div>
      </div>
    </div>`;
}

function summarizeTypes(fields) {
  const counts = {};
  fields.forEach(f => {
    const label = (FIELD_TYPES[f.type] || { label: `Tipo ${f.type}` }).label;
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts).map(([name, n]) => `${n} ${name.toLowerCase()}`).join(' · ');
}

// ─── Form header ──────────────────────────────────────────────────────────────
function fillCustomLeftPanel(config) {
  const panel = normalizePanel(config);
  const badgeEl = document.getElementById('pvPanelBadge');
  badgeEl.innerHTML = panel.badge
    ? `<i class="fa-solid fa-magnifying-glass-chart"></i> ${esc(panel.badge)}`
    : '';
  badgeEl.style.display = panel.badge ? '' : 'none';

  document.getElementById('pvTitle').textContent = panel.title;

  const descEl = document.getElementById('pvDesc');
  if (panel.desc) { descEl.textContent = panel.desc; descEl.style.display = ''; }
  else            { descEl.style.display = 'none'; }

  const instructionsEl = document.getElementById('pvPanelInstructions');
  instructionsEl.style.display = 'none';

  const stats = panel.items.map(item => {
    const value = getPanelItemValue(item, config);
    if (!value) return '';
    return `
    <div class="pv-stat">
      <div class="pv-stat__icon">${esc(item.icon || defaultPanelIcon(item.source))}</div>
      <div>
        <div class="pv-stat__label">${esc(item.label || 'Informacion')}</div>
        <div class="pv-stat__value" style="font-size:.78rem">${multilineHtml(value)}</div>
      </div>
    </div>`;
  }).filter(Boolean);

  const statsEl = document.getElementById('pvStats');
  statsEl.innerHTML = stats.join('');
  statsEl.style.display = stats.length ? '' : 'none';
}

function normalizePanel(config) {
  const panel = config.panel || {};
  return {
    badge: panel.badge ?? 'Google Forms Inspector',
    title: panel.title ?? config.title,
    desc: panel.desc ?? config.desc ?? '',
    items: normalizePanelItems(panel),
  };
}

function normalizePanelItems(panel) {
  if (Array.isArray(panel.items)) {
    return panel.items.map((item, index) => ({
      id: item.id || `panel_${index}`,
      source: ['custom', 'fields', 'types', 'endpoint'].includes(item.source) ? item.source : 'custom',
      icon: item.icon || defaultPanelIcon(item.source),
      label: item.label || panelSourceLabel(item.source),
      value: item.value || '',
    }));
  }

  const items = [];
  if (panel.instructions) items.push({ source: 'custom', icon: 'i', label: 'Instrucciones', value: panel.instructions });
  if (panel.showFields !== false) items.push({ source: 'fields', icon: '#', label: 'Campos', value: '' });
  if (panel.showTypes !== false) items.push({ source: 'types', icon: '*', label: 'Tipos de campo', value: '' });
  if (panel.showEndpoint !== false) items.push({ source: 'endpoint', icon: '@', label: 'Endpoint', value: '' });
  return items;
}

function getPanelItemValue(item, config) {
  if (item.source === 'fields') {
    const totalFields = config.fields.length;
    const reqFields = config.fields.filter(field => field.required).length;
    return `${totalFields} campo${totalFields !== 1 ? 's' : ''}${reqFields ? ` - ${reqFields} obligatorio${reqFields !== 1 ? 's' : ''}` : ''}`;
  }
  if (item.source === 'types') return summarizeTypes(config.fields);
  if (item.source === 'endpoint') return truncateUrl(config.endpoint);
  return item.value || '';
}

function defaultPanelIcon(source) {
  return { fields: '#', types: '*', endpoint: '@', custom: 'i' }[source] || 'i';
}

function panelSourceLabel(source) {
  return { fields: 'Campos', types: 'Tipos de campo', endpoint: 'Endpoint', custom: 'Informacion' }[source] || 'Informacion';
}

function fillFormHeader(config) {
  document.getElementById('pvFormTitle').textContent = config.title;
  const n = config.fields.length;
  document.getElementById('pvFieldCount').innerHTML =
    `<i class="fa-solid fa-list-check"></i> ${n} campo${n !== 1 ? 's' : ''}`;

  const subEl = document.getElementById('pvFormSub');
  subEl.textContent = config.desc || 'Completa el formulario y envía para probar el flujo completo.';
  subEl.style.display = '';
}

// ─── Form builder ─────────────────────────────────────────────────────────────
// Mirrors forms_1.html structure: action + method on the form element,
// hidden fields as DOM children of the form, actions outside the field grid.
function buildForm(config) {
  const oldForm = document.getElementById('pvForm');
  const form = oldForm.cloneNode(false);
  oldForm.replaceWith(form);

  form.action = config.endpoint;
  form.method = 'POST';

  // Register FIRST — before building fields — so a field error never blocks this
  form.addEventListener('submit', handleSubmit);
  form.addEventListener('input', () => {
    document.getElementById('pvSuccess').classList.remove('is-visible');
    document.getElementById('pvError').classList.remove('is-visible');
  });

  // Field grid
  const grid = document.createElement('div');
  grid.className = 'pv-grid';
  config.fields.forEach((field, i) => {
    try {
      grid.appendChild(buildField(field));
    } catch (err) {
      console.error(`[Previsualizer] Error building field ${i} (type ${field.type}):`, err, field);
    }
  });
  form.appendChild(grid);

  // Hidden fields — setAttribute sets defaultValue so form.reset() keeps them
  [['fvv', '1'], ['pageHistory', '0'], ['submit', 'Submit']].forEach(([name, val]) => {
    const inp = document.createElement('input');
    inp.type = 'hidden';
    inp.setAttribute('name', name);
    inp.setAttribute('value', val);
    form.appendChild(inp);
  });

  const actions = document.createElement('div');
  actions.className = 'pv-actions';
  actions.innerHTML = `
    <button type="submit" class="pv-btn pv-btn--primary" id="pvSubmit">
      <i class="fa-solid fa-paper-plane"></i> Enviar formulario
    </button>
    <button type="button" class="pv-btn pv-btn--secondary" onclick="resetForm()">
      <i class="fa-solid fa-rotate-left"></i> Limpiar
    </button>`;
  form.appendChild(actions);

  const note = document.createElement('p');
  note.className = 'pv-form-note';
  note.textContent = 'Al enviar, la respuesta se registrará en Google Forms real.';
  form.appendChild(note);

  console.log('[Previsualizer] Form built. Endpoint:', config.endpoint);
}

// ─── Single field builder ─────────────────────────────────────────────────────
function buildField(field) {
  const info   = FIELD_TYPES[field.type];
  const isFull = field.width === 'full' || (field.width !== 'half' && (info ? !info.isHalf : true));

  const wrapper     = document.createElement('div');
  wrapper.className = `pv-field${isFull ? ' pv-field--full' : ''}`;

  const label     = document.createElement('label');
  label.htmlFor   = `f_${field.entryId}`;
  label.innerHTML = `${esc(field.label)}${field.required ? '<span class="pv-required">*</span>' : ''}`;
  wrapper.appendChild(label);

  if (field.desc) {
    const hint       = document.createElement('span');
    hint.className   = 'pv-field-hint';
    hint.textContent = field.desc;
    wrapper.appendChild(hint);
  }

  switch (field.renderAs || field.type) {
    case 'text':     buildText(wrapper, field);                     break;
    case 'textarea': buildTextarea(wrapper, field);                 break;
    case 'radio':    buildOptions(wrapper, field, 'radio');         break;
    case 'checkbox': buildOptions(wrapper, field, 'checkbox');      break;
    case 'select':   buildSelect(wrapper, field);                   break;
    case 'date':     buildDateOrTime(wrapper, field, 'date');       break;
    case 'time':     buildDateOrTime(wrapper, field, 'time');       break;
    case 0:  buildText(wrapper, field);                      break;
    case 1:  buildTextarea(wrapper, field);                  break;
    case 2:  buildOptions(wrapper, field, 'radio');          break;
    case 3:  buildSelect(wrapper, field);                    break;
    case 4:  buildOptions(wrapper, field, 'checkbox');       break;
    case 5:  buildScale(wrapper, field);                     break;
    case 9:  buildDateOrTime(wrapper, field, 'date');        break;
    case 10: buildDateOrTime(wrapper, field, 'time');        break;
    default: buildText(wrapper, field);                      break;
  }

  return wrapper;
}

function buildText(wrapper, field) {
  const inp    = document.createElement('input');
  inp.type     = 'text';
  inp.name     = field.name;
  inp.id       = `f_${field.entryId}`;
  inp.placeholder = field.placeholder || '';
  inp.required = !!field.required;
  wrapper.appendChild(inp);
}

function buildTextarea(wrapper, field) {
  const ta    = document.createElement('textarea');
  ta.name     = field.name;
  ta.id       = `f_${field.entryId}`;
  ta.placeholder = field.placeholder || '';
  ta.required = !!field.required;
  ta.rows     = 4;
  wrapper.appendChild(ta);
}

function buildSelect(wrapper, field) {
  const sel    = document.createElement('select');
  sel.name     = field.name;
  sel.id       = `f_${field.entryId}`;
  sel.required = !!field.required;

  const placeholder = document.createElement('option');
  placeholder.setAttribute('value', '');
  placeholder.textContent = 'Selecciona una opción…';
  placeholder.disabled = true;
  if (field.placeholder) placeholder.textContent = field.placeholder;
  placeholder.selected = true;
  placeholder.hidden   = true;
  sel.appendChild(placeholder);

  field.options.forEach(opt => {
    const o = new Option(opt, opt);
    sel.appendChild(o);
  });

  wrapper.appendChild(sel);
}

function buildOptions(wrapper, field, inputType) {
  wrapper.querySelector('label').removeAttribute('for');

  const opts = field.options.length ? field.options : ['Opción 1', 'Opción 2'];
  const grid = document.createElement('div');
  grid.className = 'pv-options';

  opts.forEach((opt, i) => {
    const id  = `f_${field.entryId}_${i}`;
    const lbl = document.createElement('label');
    lbl.className = 'pv-option';

    const inp    = document.createElement('input');
    inp.type     = inputType;
    inp.name     = field.name;
    inp.value    = opt;
    inp.id       = id;
    if (field.required && inputType === 'radio') inp.required = true;

    const span     = document.createElement('span');
    span.className = 'pv-option__label';
    span.textContent = opt;

    lbl.appendChild(inp);
    lbl.appendChild(span);
    grid.appendChild(lbl);
  });

  wrapper.appendChild(grid);
}

function buildScale(wrapper, field) {
  wrapper.querySelector('label').removeAttribute('for');

  const values = field.options.length ? field.options : ['1', '2', '3', '4', '5'];
  const grid   = document.createElement('div');
  grid.className = 'pv-options pv-options--scale';

  values.forEach((val, i) => {
    const id  = `f_${field.entryId}_${i}`;
    const lbl = document.createElement('label');
    lbl.className = 'pv-option';

    const inp    = document.createElement('input');
    inp.type     = 'radio';
    inp.name     = field.name;
    inp.value    = val;
    inp.id       = id;

    const span     = document.createElement('span');
    span.className = 'pv-option__label';
    span.textContent = val;

    lbl.appendChild(inp);
    lbl.appendChild(span);
    grid.appendChild(lbl);
  });

  wrapper.appendChild(grid);

  if (values.length >= 2) {
    const hint     = document.createElement('div');
    hint.className = 'pv-scale-hint';
    hint.innerHTML = `<span>${esc(values[0])}</span><span>${esc(values[values.length - 1])}</span>`;
    wrapper.appendChild(hint);
  }
}

function buildDateOrTime(wrapper, field, type) {
  const inp    = document.createElement('input');
  inp.type     = type;
  inp.name     = field.name;
  inp.id       = `f_${field.entryId}`;
  inp.required = !!field.required;
  wrapper.appendChild(inp);
}

// ─── Submit handler ───────────────────────────────────────────────────────────
// Pattern mirrors forms_1.html exactly: reportValidity → FormData → set hidden
// fields → fetch(form.action) → show success/error.
async function handleSubmit(e) {
  e.preventDefault();

  const form      = e.currentTarget;
  const submitBtn = document.getElementById('pvSubmit');
  const success   = document.getElementById('pvSuccess');
  const error     = document.getElementById('pvError');

  // reportValidity: checks constraints AND shows browser error UI — same as forms_1.html
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  // Set explicitly to guarantee they're always present — same as forms_1.html
  formData.set('fvv', '1');
  formData.set('pageHistory', '0');
  formData.set('submit', 'Submit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando…';
  success.classList.remove('is-visible');
  error.classList.remove('is-visible');

  try {
    await fetch(form.action, {
      method: 'POST',
      mode:   'no-cors',
      body:   new URLSearchParams(formData),
    });

    form.reset();
    success.classList.add('is-visible');
    document.querySelector('.pv-form-wrap').scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    document.getElementById('pvErrorMsg').textContent =
      err.message || 'Revisa tu conexión e intenta nuevamente.';
    error.classList.add('is-visible');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar formulario';
  }
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetForm() {
  document.getElementById('pvForm').reset();
  document.getElementById('pvSuccess').classList.remove('is-visible');
  document.getElementById('pvError').classList.remove('is-visible');
}

// ─── No-data fallback ─────────────────────────────────────────────────────────
function clearPreviewStorage() {
  localStorage.removeItem(STORAGE_KEY);
  showNoData();
}

function downloadPreviewZip() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    showNoData();
    return;
  }

  try {
    const config = JSON.parse(raw);
    if (!window.FormExporter) throw new Error('Exportador no disponible');
    window.FormExporter.downloadZip(config);
  } catch (err) {
    console.warn('[Previsualizer] No se pudo descargar el ZIP:', err);
    showNoData();
  }
}

function showNoData() {
  document.getElementById('pvNoData').style.display = '';
  document.getElementById('pvPage').style.display   = 'none';
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function multilineHtml(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 40 ? '…' + u.pathname.slice(-32) : u.pathname;
    return u.hostname + path;
  } catch { return url; }
}
