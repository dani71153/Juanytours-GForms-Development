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

const DEFAULT_PANEL = {
  badge: 'Google Forms Inspector',
  title: '',
  desc: '',
  items: [],
};

const PANEL_SOURCE_LABELS = {
  custom: 'Personalizado',
  fields: 'Campos',
  types: 'Tipos de campo',
  endpoint: 'Endpoint',
};

let editorState = null;
let selectedId = null;
let toastTimer = null;
let activePanel = 'design';
let draggedFieldId = null;
let undoStack = [];
const MAX_UNDO_STEPS = 40;

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
  activePanel = getInitialPanel();

  bindPropEvents();
  bindPanelEvents();
  renderAll();
}

function getInitialPanel() {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return ['design', 'panel', 'export'].includes(tab) ? tab : 'design';
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
    panel: normalizePanel(raw.panel, raw),
    fields: (raw.fields || []).map((field, index) => normalizeField(field, index)),
  };
}

function normalizePanel(panel, raw) {
  const source = panel || {};
  const base = {
    title: raw.title ?? DEFAULT_PANEL.title,
    desc: raw.desc ?? DEFAULT_PANEL.desc,
    fields: raw.fields || [],
    endpoint: raw.endpoint || '',
  };
  return {
    badge: source.badge ?? DEFAULT_PANEL.badge,
    title: source.title ?? base.title,
    desc: source.desc ?? base.desc,
    items: normalizePanelItems(source, base),
  };
}

function normalizePanelItems(source, base) {
  if (Array.isArray(source.items)) {
    return source.items.map((item, index) => normalizePanelItem(item, index)).filter(Boolean);
  }

  const items = [];
  if (source.instructions) {
    items.push(normalizePanelItem({
      source: 'custom',
      icon: 'i',
      label: 'Instrucciones',
      value: source.instructions,
    }, 0));
  }
  if (source.showFields !== false) {
    items.push(normalizePanelItem({ source: 'fields', icon: '#', label: 'Campos' }, items.length));
  }
  if (source.showTypes !== false) {
    items.push(normalizePanelItem({ source: 'types', icon: '*', label: 'Tipos de campo' }, items.length));
  }
  if (source.showEndpoint !== false) {
    items.push(normalizePanelItem({ source: 'endpoint', icon: '@', label: 'Endpoint' }, items.length));
  }

  if (!items.length) {
    return [
      normalizePanelItem({ source: 'fields', icon: '#', label: 'Campos' }, 0),
      normalizePanelItem({ source: 'types', icon: '*', label: 'Tipos de campo' }, 1),
      normalizePanelItem({ source: 'endpoint', icon: '@', label: 'Endpoint' }, 2),
    ];
  }

  return items;
}

function normalizePanelItem(item, index) {
  if (!item) return null;
  const source = PANEL_SOURCE_LABELS[item.source] ? item.source : 'custom';
  return {
    id: item.id || `panel_${Date.now()}_${index}`,
    source,
    icon: item.icon || defaultPanelIcon(source),
    label: item.label || PANEL_SOURCE_LABELS[source],
    value: item.value || '',
    collapsed: Boolean(item.collapsed),
  };
}

function defaultPanelIcon(source) {
  return {
    fields: '#',
    types: '*',
    endpoint: '@',
    custom: 'i',
  }[source] || 'i';
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
  renderPanelEditor();
  renderExports();
  renderEditorPanel();
  updateUndoButton();
}

function switchEditorPanel(panel) {
  activePanel = ['design', 'panel', 'export'].includes(panel) ? panel : 'design';
  renderEditorPanel();
}

function renderEditorPanel() {
  document.getElementById('panelDesign').style.display = activePanel === 'design' ? '' : 'none';
  document.getElementById('panelSide').style.display = activePanel === 'panel' ? '' : 'none';
  document.getElementById('panelExport').style.display = activePanel === 'export' ? '' : 'none';
  document.getElementById('tabDesign').classList.toggle('is-active', activePanel === 'design');
  document.getElementById('tabPanel').classList.toggle('is-active', activePanel === 'panel');
  document.getElementById('tabExport').classList.toggle('is-active', activePanel === 'export');
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

function renderPanelEditor() {
  const panel = editorState.panel;
  document.getElementById('panelBadge').value = panel.badge;
  document.getElementById('panelTitle').value = panel.title;
  document.getElementById('panelDesc').value = panel.desc;
  renderPanelItemsEditor();
  renderPanelPreview();
}

function renderPanelItemsEditor() {
  const list = document.getElementById('panelItems');
  list.innerHTML = editorState.panel.items.map((item, index) => {
    const autoValue = getPanelItemValue(item, editorState);
    return `
      <article class="ef-panel-item">
        <div class="ef-panel-item__head">
          <div class="ef-panel-item__title">
            <span class="ef-panel-item__icon">${esc(item.icon)}</span>
            <span>${esc(item.label || PANEL_SOURCE_LABELS[item.source])}</span>
          </div>
          <div class="ef-panel-item__actions">
            <button class="ef-icon-btn ef-icon-btn--sm" type="button" onclick="togglePanelItem('${escA(item.id)}')" title="${item.collapsed ? 'Expandir' : 'Colapsar'}">
              <i class="fa-solid ${item.collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>
            </button>
            <button class="ef-mini-btn" type="button" onclick="removePanelItem('${escA(item.id)}')">Borrar</button>
          </div>
        </div>

        <div class="ef-panel-item__grid${item.collapsed ? ' is-collapsed' : ''}">
          <label class="ef-control">
            <span>Icono</span>
            <input type="text" maxlength="3" value="${escA(item.icon)}" oninput="updatePanelItem('${escA(item.id)}', { icon: this.value })" />
          </label>

          <label class="ef-control">
            <span>Fuente</span>
            <select onchange="updatePanelItem('${escA(item.id)}', { source: this.value })">
              ${Object.entries(PANEL_SOURCE_LABELS).map(([value, label]) => `<option value="${value}"${item.source === value ? ' selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>

          <label class="ef-control ef-control--full">
            <span>Etiqueta</span>
            <input type="text" value="${escA(item.label)}" oninput="updatePanelItem('${escA(item.id)}', { label: this.value })" />
          </label>

          <label class="ef-control ef-control--full">
            <span>Contenido</span>
            <textarea ${item.source === 'custom' ? '' : 'disabled'} oninput="updatePanelItem('${escA(item.id)}', { value: this.value })">${esc(item.source === 'custom' ? item.value : autoValue)}</textarea>
          </label>

          ${item.source === 'custom' ? '' : `<p class="ef-panel-item__hint">Este contenido se calcula automaticamente al exportar.</p>`}
        </div>
      </article>`;
  }).join('');
}

function renderPanelPreview() {
  const panel = editorState.panel;
  const badge = document.getElementById('panelPreviewBadge');
  const title = document.getElementById('panelPreviewTitle');
  const desc = document.getElementById('panelPreviewDesc');
  const items = document.getElementById('panelPreviewItems');

  badge.textContent = panel.badge;
  badge.style.display = panel.badge ? '' : 'none';
  title.textContent = panel.title || editorState.title;
  desc.textContent = panel.desc;
  desc.style.display = panel.desc ? '' : 'none';
  items.innerHTML = buildPanelItemsHtml(editorState, 'preview');
  items.style.display = items.innerHTML ? '' : 'none';
}

function buildPreviewField(field) {
  const wrapper = document.createElement('div');
  wrapper.className = `ef-field${field.width === 'full' ? ' ef-field--full' : ''}${field.hidden ? ' ef-field--hidden' : ''}${field.uid === selectedId ? ' is-selected' : ''}`;
  wrapper.draggable = !field.hidden;
  wrapper.dataset.uid = field.uid;
  wrapper.onclick = () => selectField(field.uid);
  wrapper.addEventListener('dragstart', event => startFieldDrag(event, field.uid));
  wrapper.addEventListener('dragover', event => dragOverField(event, field.uid));
  wrapper.addEventListener('dragleave', event => event.currentTarget.classList.remove('is-drop-target'));
  wrapper.addEventListener('drop', event => dropField(event, field.uid));
  wrapper.addEventListener('dragend', finishFieldDrag);

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

function startFieldDrag(event, uid) {
  draggedFieldId = uid;
  selectedId = uid;
  document.getElementById('previewGrid').classList.add('is-reordering');
  event.currentTarget.classList.add('is-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', uid);
  renderFieldList();
}

function dragOverField(event, targetId) {
  if (!draggedFieldId || draggedFieldId === targetId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.ef-field.is-drop-target').forEach(el => {
    if (el !== event.currentTarget) el.classList.remove('is-drop-target');
  });
  event.currentTarget.classList.add('is-drop-target');
}

function dropField(event, targetId) {
  event.preventDefault();
  event.currentTarget.classList.remove('is-drop-target');
  const sourceId = event.dataTransfer.getData('text/plain') || draggedFieldId;
  if (!sourceId || sourceId === targetId) return;

  const rect = event.currentTarget.getBoundingClientRect();
  const isAfter = event.clientY > rect.top + rect.height / 2;
  moveField(sourceId, targetId, isAfter);
}

function finishFieldDrag() {
  draggedFieldId = null;
  document.getElementById('previewGrid').classList.remove('is-reordering');
  document.querySelectorAll('.ef-field.is-dragging, .ef-field.is-drop-target').forEach(el => {
    el.classList.remove('is-dragging', 'is-drop-target');
  });
}

function moveField(sourceId, targetId, insertAfter) {
  const from = editorState.fields.findIndex(field => field.uid === sourceId);
  const target = editorState.fields.findIndex(field => field.uid === targetId);
  if (from < 0 || target < 0 || from === target) return;

  pushUndoState();
  const [field] = editorState.fields.splice(from, 1);
  let to = editorState.fields.findIndex(entry => entry.uid === targetId);
  if (insertAfter) to += 1;
  editorState.fields.splice(to, 0, field);
  selectedId = sourceId;
  persistSilent();
  renderFieldList();
  renderPreview();
  renderProps();
  renderPanelPreview();
  renderExports();
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

function bindPanelEvents() {
  bindPanelProp('panelBadge', value => updatePanel({ badge: value }));
  bindPanelProp('panelTitle', value => updatePanel({ title: value }));
  bindPanelProp('panelDesc', value => updatePanel({ desc: value }));
}

function bindProp(id, onChange) {
  document.getElementById(id).addEventListener('input', event => onChange(event.target.value));
  document.getElementById(id).addEventListener('change', event => onChange(event.target.value));
}

function bindPanelProp(id, onChange) {
  document.getElementById(id).addEventListener('input', event => onChange(event.target.value));
}

function pushUndoState() {
  const snapshot = JSON.stringify(exportEditorState());
  if (undoStack[undoStack.length - 1] === snapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
  updateUndoButton();
}

function undoEditorChange() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    updateUndoButton();
    return;
  }

  try {
    editorState = normalizeEditorState(JSON.parse(snapshot));
    if (!editorState.fields.some(field => field.uid === selectedId)) {
      selectedId = editorState.fields[0]?.uid || null;
    }
    persistSilent();
    renderAll();
    toast('Cambio deshecho');
  } catch (err) {
    console.warn('[EditorForms] No se pudo deshacer:', err);
    updateUndoButton();
  }
}

function updateUndoButton() {
  const button = document.getElementById('undoBtn');
  if (button) button.disabled = !undoStack.length;
}

function updateSelected(patch) {
  const field = getSelectedField();
  if (!field) return;
  pushUndoState();
  Object.assign(field, patch);
  persistSilent();
  renderFieldList();
  renderPreview();
  renderProps();
  renderPanelPreview();
  renderExports();
}

function updatePanel(patch) {
  pushUndoState();
  Object.assign(editorState.panel, patch);
  persistSilent();
  renderPanelPreview();
  renderExports();
}

function addPanelItem() {
  pushUndoState();
  editorState.panel.items.push(normalizePanelItem({
    source: 'custom',
    icon: 'i',
    label: 'Informacion',
    value: 'Escribe aqui la informacion adicional.',
  }, editorState.panel.items.length));
  persistSilent();
  renderPanelItemsEditor();
  renderPanelPreview();
  renderExports();
}

function updatePanelItem(id, patch) {
  const item = editorState.panel.items.find(entry => entry.id === id);
  if (!item) return;
  pushUndoState();
  Object.assign(item, patch);
  if (patch.source) {
    item.icon = defaultPanelIcon(patch.source);
    item.label = PANEL_SOURCE_LABELS[patch.source] || item.label;
  }
  persistSilent();
  if (patch.source) renderPanelItemsEditor();
  renderPanelPreview();
  renderExports();
}

function removePanelItem(id) {
  pushUndoState();
  editorState.panel.items = editorState.panel.items.filter(item => item.id !== id);
  persistSilent();
  renderPanelItemsEditor();
  renderPanelPreview();
  renderExports();
}

function togglePanelItem(id) {
  const item = editorState.panel.items.find(entry => entry.id === id);
  if (!item) return;
  item.collapsed = !item.collapsed;
  persistSilent();
  renderPanelItemsEditor();
}

function resetSelectedField() {
  const field = getSelectedField();
  if (!field) return;
  pushUndoState();
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

function resetPanelSettings() {
  pushUndoState();
  editorState.panel = normalizePanel(null, editorState);
  persistSilent();
  renderPanelEditor();
  renderExports();
  toast('Panel restaurado');
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
  updateUndoButton();
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
    panel: { ...editorState.panel },
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
    panel: { ...editorState.panel },
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

function renderExports() {
  const outputs = buildExportOutputs();
  document.getElementById('exportHtml').textContent = outputs.html;
  document.getElementById('exportCss').textContent = outputs.css;
  document.getElementById('exportJs').textContent = outputs.js;
  document.getElementById('exportJson').textContent = outputs.json;
}

function buildExportOutputs() {
  const config = buildPreviewConfig();
  if (window.FormExporter) {
    try {
      return window.FormExporter.buildOutputs(config);
    } catch (err) {
      console.warn('[EditorForms] Exportador compartido fallo, usando fallback local:', err);
    }
  }
  return {
    html: generateHtmlExport(config),
    css: generateCssExport(),
    js: generateJsExport(),
    json: JSON.stringify(config, null, 2),
  };
}

function generateHtmlExport(config) {
  const fieldHtml = config.fields.map(generateFieldHtml).join('\n\n');
  const panel = normalizeExportPanel(config);
  const panelItems = buildPanelItemsHtml(config, 'export');
  return `<main class="jt-page">
  <section class="jt-shell">
    <aside class="jt-panel">
      <div class="jt-panel__top">
        ${panel.badge ? `<div class="jt-panel__badge">${esc(panel.badge)}</div>` : ''}
        <h1>${esc(panel.title)}</h1>
        ${panel.desc ? `<p>${multilineHtml(panel.desc)}</p>` : ''}
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
${indent(fieldHtml, 10)}
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

function buildPanelItemsHtml(config, mode = 'export') {
  const panel = normalizeExportPanel(config);
  const statClass = mode === 'preview' ? 'ef-panel-preview__stat' : 'jt-stat';
  return panel.items.map(item => {
    const value = getPanelItemValue(item, config);
    if (!value) return '';
    const iconHtml = mode === 'preview'
      ? `<em>${esc(item.icon || defaultPanelIcon(item.source))}</em>`
      : `<span class="jt-stat__icon">${esc(item.icon || defaultPanelIcon(item.source))}</span>`;
    return `<div class="${statClass}">
  ${iconHtml}
  <div>
    <span>${esc(item.label || PANEL_SOURCE_LABELS[item.source] || 'Informacion')}</span>
    <strong>${multilineHtml(value)}</strong>
  </div>
</div>`;
  }).filter(Boolean).join('\n\n');
}

function normalizeExportPanel(config) {
  return normalizePanel(config.panel, {
    title: config.title,
    desc: config.desc,
    endpoint: config.endpoint,
    fields: config.fields,
  });
}

function getPanelItemValue(item, config) {
  if (item.source === 'fields') {
    const totalFields = config.fields.length;
    const reqFields = config.fields.filter(field => field.required).length;
    return `${totalFields} campo${totalFields !== 1 ? 's' : ''}${reqFields ? ` - ${reqFields} obligatorio${reqFields !== 1 ? 's' : ''}` : ''}`;
  }
  if (item.source === 'types') return summarizeExportTypes(config.fields);
  if (item.source === 'endpoint') return shorten(config.endpoint);
  return item.value || '';
}

function summarizeExportTypes(fields) {
  const counts = {};
  fields.forEach(field => {
    const info = FIELD_TYPES[field.type] || { label: `Tipo ${field.type}` };
    counts[info.label] = (counts[info.label] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, count]) => `${count} ${label.toLowerCase()}`)
    .join(' - ');
}

function generateFieldHtml(field) {
  const full = field.width === 'full' ? ' jt-field--full' : '';
  const required = field.required ? ' required' : '';
  const reqMark = field.required ? ' <span aria-hidden="true">*</span>' : '';
  const label = `<label for="jt_${escA(field.entryId)}">${esc(field.label)}${reqMark}</label>`;

  if (field.renderAs === 'textarea') {
    return `<div class="jt-field${full}">
  ${label}
  <textarea id="jt_${escA(field.entryId)}" name="${escA(field.name)}" placeholder="${escA(field.placeholder || '')}"${required}></textarea>
</div>`;
  }

  if (field.renderAs === 'select') {
    const options = field.options
      .map(option => `<option value="${escA(option)}">${esc(option)}</option>`)
      .join('\n    ');
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

  const inputType = ['date', 'time'].includes(field.renderAs) ? field.renderAs : 'text';
  return `<div class="jt-field${full}">
  ${label}
  <input id="jt_${escA(field.entryId)}" type="${inputType}" name="${escA(field.name)}" placeholder="${escA(field.placeholder || '')}"${required} />
</div>`;
}

function generateCssExport() {
  return `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  margin: 0;
  padding: 0;
  background:
    radial-gradient(circle at 12% 16%, rgba(13, 154, 148, .14), transparent 32%),
    linear-gradient(135deg, #f8fafc 0%, #eef7f7 50%, #ffffff 100%);
  color: #334155;
  font-family: Inter, system-ui, sans-serif;
  line-height: 1.5;
}

.jt-page {
  min-height: 100vh;
  padding: clamp(.75rem, 2vw, 1.5rem);
  display: grid;
  place-items: center;
}

.jt-shell {
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: .85fr 1.15fr;
  background: #ffffff;
  border: 1px solid rgba(13, 31, 60, .08);
  border-radius: 28px;
  box-shadow: 0 24px 70px rgba(13, 31, 60, .16);
  overflow: hidden;
  min-height: min(820px, calc(100vh - 3rem));
}

.jt-panel {
  position: relative;
  padding: clamp(1.75rem, 4vw, 3rem);
  background: linear-gradient(155deg, #0d1f3c 0%, #0e2647 55%, #0d3a38 100%);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.jt-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 80%, rgba(13, 154, 148, .22), transparent 60%);
  pointer-events: none;
}

.jt-panel__top,
.jt-panel__instructions,
.jt-panel__stats {
  position: relative;
}

.jt-panel__badge {
  display: inline-flex;
  width: fit-content;
  margin-bottom: .9rem;
  padding: .3rem .75rem;
  border-radius: 999px;
  background: rgba(13, 154, 148, .22);
  border: 1px solid rgba(13, 154, 148, .35);
  color: rgba(255, 255, 255, .88);
  font-size: .72rem;
  font-weight: 700;
}

.jt-panel h1 {
  margin: 0;
  color: #ffffff;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2.1rem, 4vw, 3.25rem);
  line-height: 1.05;
}

.jt-panel p {
  max-width: 32rem;
  margin: 1rem 0 0;
  color: rgba(255, 255, 255, .72);
  font-size: .95rem;
}

.jt-panel__instructions {
  padding: .85rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .1);
  color: rgba(255, 255, 255, .76);
  font-size: .9rem;
  line-height: 1.55;
}

.jt-panel__stats {
  display: grid;
  gap: .7rem;
}

.jt-stat {
  display: flex;
  align-items: center;
  gap: .85rem;
  padding: .75rem .9rem;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(13, 154, 148, .18), rgba(255, 255, 255, .08));
  border: 1px solid rgba(13, 154, 148, .28);
}

.jt-stat__icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #0d9a94;
  color: #ffffff;
  font-weight: 800;
}

.jt-stat span:not(.jt-stat__icon) {
  display: block;
  color: rgba(255, 255, 255, .5);
  font-size: .72rem;
  font-weight: 700;
}

.jt-stat strong {
  display: block;
  color: #ffffff;
  font-size: .82rem;
  line-height: 1.35;
  word-break: break-word;
}

.jt-form-wrap {
  padding: clamp(1.35rem, 4vw, 3rem);
  overflow-y: auto;
}

.jt-form {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #334155;
  font-family: Inter, system-ui, sans-serif;
  box-shadow: none;
  display: grid;
  gap: .9rem;
}

.jt-form__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.jt-form__head h2 {
  margin: 0;
  color: #0d1f3c;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.4rem, 2.5vw, 1.9rem);
  font-weight: 700;
  line-height: 1.15;
}

.jt-form__head p {
  margin: 0;
  color: #64748b;
  font-size: .875rem;
}

.jt-badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  padding: .45rem .85rem;
  border-radius: 999px;
  background: #eef9f9;
  color: #0a7a74;
  font-size: .72rem;
  font-weight: 700;
  white-space: nowrap;
}

.jt-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1.35rem;
  row-gap: 1rem;
}

.jt-field {
  display: grid;
  gap: .35rem;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.jt-field--full,
.jt-field--options {
  grid-column: 1 / -1;
}

.jt-field label,
.jt-field legend {
  color: #0d1f3c;
  font-size: .875rem;
  font-weight: 600;
  cursor: default;
}

.jt-field span[aria-hidden="true"],
.jt-field legend span {
  color: #ef4444;
}

.jt-field input[type="text"],
.jt-field input[type="date"],
.jt-field input[type="time"],
.jt-field select,
.jt-field textarea {
  width: 100%;
  min-height: 44px;
  padding: .7rem 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
  color: #334155;
  font-family: Inter, system-ui, sans-serif;
  font-size: .875rem;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}

.jt-field input[type="text"]:focus,
.jt-field input[type="date"]:focus,
.jt-field input[type="time"]:focus,
.jt-field select:focus,
.jt-field textarea:focus {
  border-color: #0d9a94;
  box-shadow: 0 0 0 4px rgba(13, 154, 148, .12);
  background: #fbffff;
}

.jt-field textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.5;
}

.jt-field input::placeholder,
.jt-field textarea::placeholder {
  color: #94a3b8;
}

.jt-field select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  padding-right: 2.5rem;
}

.jt-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: .6rem;
}

.jt-option {
  position: relative;
}

.jt-option input[type="radio"],
.jt-option input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 1px;
  height: 1px;
}

.jt-option span {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;
  min-height: 44px;
  padding: .55rem .75rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
  color: #475569;
  font-size: .875rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all .15s ease;
  line-height: 1.3;
  user-select: none;
}

.jt-option input:checked + span {
  border-color: #0d9a94;
  background: #eef9f9;
  color: #0a7a74;
  box-shadow: 0 0 0 4px rgba(13, 154, 148, .22);
}

.jt-option span:hover {
  border-color: #0d9a94;
  background: #eef9f9;
  color: #0a7a74;
}

.jt-form__actions {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: .85rem;
  flex-wrap: wrap;
}

.jt-form__submit {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .55rem;
  padding: .72rem 1.2rem;
  border: 0;
  border-radius: 14px;
  background: #00cf61;
  color: #ffffff;
  font-family: Inter, system-ui, sans-serif;
  font-size: .875rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 12px 25px rgba(0, 207, 97, .24);
  transition: opacity .15s ease, box-shadow .15s ease, background .15s ease;
}

.jt-form__submit:hover {
  opacity: .9;
}

.jt-form__submit:disabled {
  opacity: .65;
  cursor: not-allowed;
  box-shadow: none;
}

.jt-form__success,
.jt-form__error {
  display: none;
  align-items: center;
  gap: .85rem;
  margin-top: 1rem;
  padding: .9rem 1.1rem;
  border-radius: 20px;
  font-size: .875rem;
  font-weight: 600;
}

.jt-form__success {
  border: 1px solid rgba(16, 185, 129, .28);
  background: rgba(16, 185, 129, .08);
  color: #10b981;
}

.jt-form__error {
  border: 1px solid rgba(239, 68, 68, .28);
  background: rgba(239, 68, 68, .08);
  color: #ef4444;
}

.jt-form__success.is-visible,
.jt-form__error.is-visible {
  display: flex;
}

@media (max-width: 640px) {
  body {
    padding: 0;
  }

  .jt-page {
    padding: 0;
  }

  .jt-shell {
    grid-template-columns: 1fr;
    border-radius: 0;
    min-height: 100vh;
  }

  .jt-panel {
    min-height: auto;
  }

  .jt-form__head {
    flex-direction: column;
  }

  .jt-form__grid {
    grid-template-columns: 1fr;
  }

  .jt-field--full,
  .jt-field--options {
    grid-column: auto;
  }

  .jt-options {
    grid-template-columns: 1fr 1fr;
  }

  .jt-form__submit {
    width: 100%;
  }
}`;
}

function generateJsExport() {
  return `const form = document.getElementById('jtForm');
const success = document.getElementById('jtSuccess');
const error = document.getElementById('jtError');
const submit = form.querySelector('.jt-form__submit');

form.addEventListener('submit', async event => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  formData.set('fvv', '1');
  formData.set('pageHistory', '0');
  formData.set('submit', 'Submit');

  submit.disabled = true;
  success.classList.remove('is-visible');
  error.classList.remove('is-visible');

  try {
    await fetch(form.action, {
      method: 'POST',
      mode: 'no-cors',
      body: new URLSearchParams(formData),
    });

    form.reset();
    success.classList.add('is-visible');
  } catch (err) {
    error.classList.add('is-visible');
  } finally {
    submit.disabled = false;
  }
});`;
}

function copyExport(kind) {
  const ids = { html: 'exportHtml', css: 'exportCss', js: 'exportJs', json: 'exportJson' };
  const el = document.getElementById(ids[kind]);
  if (!el) return;
  copyText(el.textContent, `${kind.toUpperCase()} copiado`);
}

function copyFullExport() {
  const outputs = buildExportOutputs();
  const full = [
    '<!-- HTML -->',
    outputs.html,
    '',
    '<style>',
    outputs.css,
    '</style>',
    '',
    '<script>',
    outputs.js,
    '<' + '/script>',
  ].join('\n');
  copyText(full, 'Export completo copiado');
}

function downloadExportZip() {
  if (window.FormExporter) {
    window.FormExporter.downloadZip(buildPreviewConfig());
    toast('ZIP descargado');
    return;
  }

  const outputs = buildExportOutputs();
  const files = [
    { name: 'index.html', content: buildStandaloneHtml(outputs) },
    { name: 'styles.css', content: outputs.css },
    { name: 'script.js', content: outputs.js },
    { name: 'config.json', content: outputs.json },
  ];
  const blob = createZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugFile(editorState.title)}-formulario.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('ZIP descargado');
}

function buildStandaloneHtml(outputs) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(editorState.title)}</title>
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
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

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
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function copyText(text, message) {
  navigator.clipboard.writeText(text)
    .then(() => toast(message))
    .catch(() => toast('No se pudo copiar'));
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(line => line ? pad + line : line).join('\n');
}

function slugFile(value) {
  return String(value || 'formulario')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'formulario';
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

function multilineHtml(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}
