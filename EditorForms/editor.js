const EDITOR_KEY = 'gfi:editor';
const PREVIEW_KEY = 'gfi:preview';

const FIELD_TYPES = {
  0: { label: 'Texto corto', icon: 'fa-font', defaultRender: 'text' },
  1: { label: 'Parrafo', icon: 'fa-align-left', defaultRender: 'textarea' },
  2: { label: 'Opcion multiple', icon: 'fa-circle-dot', defaultRender: 'radio' },
  3: { label: 'Dropdown', icon: 'fa-list', defaultRender: 'select' },
  4: { label: 'Casillas', icon: 'fa-square-check', defaultRender: 'checkbox' },
  5: { label: 'Escala', icon: 'fa-sliders', defaultRender: 'radio' },
  9: { label: 'Fecha', icon: 'fa-calendar', defaultRender: 'date' },
  10: { label: 'Hora', icon: 'fa-clock', defaultRender: 'time' },
};

const RENDER_OPTIONS = {
  text: 'Texto',
  textarea: 'Parrafo',
  radio: 'Opcion multiple',
  checkbox: 'Casillas',
  select: 'Dropdown',
  date: 'Fecha',
  time: 'Hora',
};

let editorState = null;
let selectedId = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', initEditor);

function initEditor() {
  editorState = loadEditorState();
  if (!editorState || !Array.isArray(editorState.fields) || !editorState.fields.length) {
    showEmpty();
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('editorApp').style.display = '';
  selectedId = editorState.fields[0].uid;

  bindPropEvents();
  renderAll();
}

function loadEditorState() {
  try {
    const raw = JSON.parse(localStorage.getItem(EDITOR_KEY) || 'null');
    if (!raw) return null;
    return normalizeEditorState(raw);
  } catch (err) {
    console.warn('[EditorForms] Configuracion invalida:', err);
    return null;
  }
}

function normalizeEditorState(raw) {
  return {
    title: raw.title || 'Formulario',
    desc: raw.desc || '',
    endpoint: raw.endpoint || '',
    sourceUrl: raw.sourceUrl || '',
    fields: (raw.fields || []).map((field, index) => normalizeField(field, index)),
  };
}

function normalizeField(field, index) {
  const typeInfo = FIELD_TYPES[field.type] || { defaultRender: 'text' };
  const edit = field.edit || {};
  const options = normalizeOptions(field.options || []);

  return {
    ...field,
    uid: field.uid || `${field.entryId || index}_${index}`,
    originalLabel: field.originalLabel || field.label || `Campo ${index + 1}`,
    label: edit.label || field.label || `Campo ${index + 1}`,
    placeholder: edit.placeholder || field.placeholder || '',
    renderAs: edit.renderAs || field.renderAs || typeInfo.defaultRender,
    width: edit.width || field.width || defaultWidth(field.type),
    hidden: Boolean(edit.hidden || field.hidden),
    options,
  };
}

function normalizeOptions(options) {
  return options.map(option => {
    if (typeof option === 'string') return { label: option, value: option };
    return {
      label: option.label || option.value || '',
      value: option.value || option.label || '',
    };
  }).filter(option => option.value);
}

function defaultWidth(type) {
  return [1, 2, 4, 5, 7].includes(type) ? 'full' : 'half';
}

function renderAll() {
  renderHeader();
  renderFieldList();
  renderPreview();
  renderProps();
}

function renderHeader() {
  document.getElementById('formTitle').textContent = editorState.title;
  const descEl = document.getElementById('formDesc');
  descEl.textContent = editorState.desc;
  descEl.style.display = editorState.desc ? '' : 'none';
  document.getElementById('endpointPill').textContent = shorten(editorState.endpoint);
  document.getElementById('fieldTotal').textContent = editorState.fields.length;
}

function renderFieldList() {
  const list = document.getElementById('fieldList');
  list.innerHTML = editorState.fields.map(field => {
    const info = FIELD_TYPES[field.type] || { label: `Tipo ${field.type}`, icon: 'fa-question' };
    return `
      <button class="ef-field-btn${field.uid === selectedId ? ' is-active' : ''}${field.hidden ? ' is-hidden' : ''}"
              type="button" onclick="selectField('${escA(field.uid)}')">
        <span class="ef-field-btn__icon"><i class="fa-solid ${info.icon}"></i></span>
        <span>
          <strong>${esc(field.label)}</strong>
          <span>${info.label} - ${field.renderAs}${field.hidden ? ' - oculto' : ''}</span>
        </span>
      </button>`;
  }).join('');
}

function renderPreview() {
  const grid = document.getElementById('previewGrid');
  grid.innerHTML = '';
  editorState.fields.forEach(field => {
    const el = buildPreviewField(field);
    grid.appendChild(el);
  });
}

function buildPreviewField(field) {
  const wrapper = document.createElement('div');
  wrapper.className = `ef-field${field.width === 'full' ? ' ef-field--full' : ''}${field.hidden ? ' ef-field--hidden' : ''}${field.uid === selectedId ? ' is-selected' : ''}`;
  wrapper.onclick = () => selectField(field.uid);

  const label = document.createElement('label');
  label.textContent = field.label;
  if (field.required) {
    const req = document.createElement('span');
    req.className = 'ef-required';
    req.textContent = '*';
    label.appendChild(req);
  }
  wrapper.appendChild(label);

  if (field.renderAs === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.name = field.name;
    textarea.placeholder = field.placeholder;
    textarea.required = Boolean(field.required);
    wrapper.appendChild(textarea);
    return wrapper;
  }

  if (field.renderAs === 'select') {
    const select = document.createElement('select');
    select.name = field.name;
    select.required = Boolean(field.required);
    select.appendChild(new Option(field.placeholder || 'Selecciona una opcion', '', true, true));
    field.options.forEach(option => select.appendChild(new Option(option.label, option.value)));
    wrapper.appendChild(select);
    return wrapper;
  }

  if (field.renderAs === 'radio' || field.renderAs === 'checkbox') {
    wrapper.appendChild(buildOptionGroup(field, field.renderAs));
    return wrapper;
  }

  const input = document.createElement('input');
  input.type = ['date', 'time'].includes(field.renderAs) ? field.renderAs : 'text';
  input.name = field.name;
  input.placeholder = field.placeholder;
  input.required = Boolean(field.required);
  wrapper.appendChild(input);
  return wrapper;
}

function buildOptionGroup(field, type) {
  const grid = document.createElement('div');
  grid.className = 'ef-options';

  const options = field.options.length
    ? field.options
    : [{ label: 'Sin opciones detectadas', value: '' }];

  options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'ef-option';
    const input = document.createElement('input');
    input.type = type;
    input.name = field.name;
    input.value = option.value;
    if (field.required && type === 'radio') input.required = true;
    if (index === 0 && type === 'radio') input.checked = true;
    label.appendChild(input);
    label.appendChild(document.createTextNode(option.label));
    grid.appendChild(label);
  });

  return grid;
}

function renderProps() {
  const field = getSelectedField();
  document.getElementById('propsEmpty').style.display = field ? 'none' : '';
  document.getElementById('propsBody').style.display = field ? '' : 'none';
  if (!field) return;

  document.getElementById('propLabel').value = field.label;
  document.getElementById('propPlaceholder').value = field.placeholder || '';
  document.getElementById('propWidth').value = field.width;
  document.getElementById('propHidden').checked = field.hidden;
  document.getElementById('propEntry').textContent = field.name || `entry.${field.entryId}`;
  document.getElementById('propRequired').textContent = field.required ? 'Si' : 'No';

  renderRenderAsOptions(field);
  renderFieldOptions(field);
}

function renderRenderAsOptions(field) {
  const select = document.getElementById('propRenderAs');
  const allowed = allowedRenderTypes(field);
  select.innerHTML = allowed
    .map(type => `<option value="${type}">${RENDER_OPTIONS[type]}</option>`)
    .join('');
  select.value = allowed.includes(field.renderAs) ? field.renderAs : allowed[0];
}

function allowedRenderTypes(field) {
  if (field.options.length) return ['radio', 'select', 'checkbox'];
  if (field.type === 1) return ['textarea', 'text'];
  if (field.type === 9) return ['date', 'text'];
  if (field.type === 10) return ['time', 'text'];
  return ['text', 'textarea'];
}

function renderFieldOptions(field) {
  const wrap = document.getElementById('propOptionsWrap');
  const list = document.getElementById('propOptions');
  if (!field.options.length) {
    wrap.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  wrap.style.display = '';
  list.innerHTML = field.options.map(option => `<code>${esc(option.value)}</code>`).join('');
}

function bindPropEvents() {
  bindProp('propLabel', value => updateSelected({ label: value }));
  bindProp('propPlaceholder', value => updateSelected({ placeholder: value }));
  bindProp('propRenderAs', value => updateSelected({ renderAs: value }));
  bindProp('propWidth', value => updateSelected({ width: value }));

  document.getElementById('propHidden').addEventListener('change', event => {
    updateSelected({ hidden: event.target.checked });
  });
}

function bindProp(id, onChange) {
  document.getElementById(id).addEventListener('input', event => onChange(event.target.value));
  document.getElementById(id).addEventListener('change', event => onChange(event.target.value));
}

function updateSelected(patch) {
  const field = getSelectedField();
  if (!field) return;
  Object.assign(field, patch);
  persistSilent();
  renderFieldList();
  renderPreview();
  renderProps();
}

function resetSelectedField() {
  const field = getSelectedField();
  if (!field) return;
  const info = FIELD_TYPES[field.type] || { defaultRender: 'text' };
  field.label = field.originalLabel;
  field.placeholder = '';
  field.renderAs = info.defaultRender;
  field.width = defaultWidth(field.type);
  field.hidden = false;
  persistSilent();
  renderAll();
  toast('Campo restaurado');
}

function selectField(uid) {
  selectedId = uid;
  renderAll();
}

function getSelectedField() {
  return editorState.fields.find(field => field.uid === selectedId) || null;
}

function saveEditorConfig() {
  persistSilent();
  syncPreviewConfig();
  toast('Cambios guardados');
}

function persistSilent() {
  localStorage.setItem(EDITOR_KEY, JSON.stringify(exportEditorState()));
}

function syncPreviewConfig() {
  const previewConfig = buildPreviewConfig();
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(previewConfig));
  console.log('[EditorForms] Preview config saved:', previewConfig);
  notifyPreviewTabs();
}

function notifyPreviewTabs() {
  if (!('BroadcastChannel' in window)) return;
  const channel = new BroadcastChannel('gfi-preview');
  channel.postMessage({ type: 'preview:update', at: Date.now() });
  channel.close();
}

function exportEditorState() {
  return {
    ...editorState,
    fields: editorState.fields.map(field => ({
      ...field,
      edit: {
        label: field.label,
        placeholder: field.placeholder,
        renderAs: field.renderAs,
        width: field.width,
        hidden: field.hidden,
      },
    })),
  };
}

function sendToPreview() {
  saveEditorConfig();
  window.open('../forms-previsualizer/index.html', '_blank');
}

function buildPreviewConfig() {
  return {
    title: editorState.title,
    desc: editorState.desc,
    endpoint: editorState.endpoint,
    fields: editorState.fields
      .filter(field => !field.hidden)
      .map(field => ({
        ...field,
        label: field.label,
        options: field.options.map(option => option.value),
        renderAs: field.renderAs,
        width: field.width,
      })),
  };
}

function showEmpty() {
  document.getElementById('emptyState').style.display = '';
  document.getElementById('editorApp').style.display = 'none';
}

function toast(message) {
  const box = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  box.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-visible'), 1800);
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

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escA(s) {
  return esc(s).replace(/'/g, '&#39;');
}
