// ─── form-db.js — Biblioteca persistente de formularios (IndexedDB) ──────────

const DB_NAME    = 'GFI_Library';
const DB_VERSION = 1;
const STORE      = 'forms';

let _db         = null;
let _pending    = null;   // { formData, viewformUrl } esperando ser guardado
let _existingId = null;   // id del registro duplicado detectado
let _searchQ    = '';     // query de búsqueda activa

// ══════════════════════════════════════════════════════════════════════════════
// IndexedDB — primitivas
// ══════════════════════════════════════════════════════════════════════════════

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ev => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('url',       'url',       { unique: false });
        s.createIndex('status',    'status',    { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = ev => { _db = ev.target.result; resolve(_db); };
    req.onerror   = ev => reject(ev.target.error);
  });
}

// Wrapper genérico: abre una transacción, ejecuta fn(objectStore) → IDBRequest
function _idbTx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t   = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = ev => resolve(ev.target.result);
    req.onerror   = ev => reject(ev.target.error);
  }));
}

const dbGetAll    = ()    => _idbTx('readonly',  s => s.getAll());
const dbGet       = id    => _idbTx('readonly',  s => s.get(id));
const dbFindByUrl = url   => _idbTx('readonly',  s => s.index('url').getAll(url));
const dbPut       = rec   => _idbTx('readwrite', s => s.put(rec));
const dbDel       = id    => _idbTx('readwrite', s => s.delete(id));

// ══════════════════════════════════════════════════════════════════════════════
// Diálogo de guardado
// ══════════════════════════════════════════════════════════════════════════════

async function openSaveDialog(formData, viewformUrl) {
  if (!formData || !viewformUrl) return;
  _pending = { formData, viewformUrl };

  document.getElementById('saveAlias').value = formData.title || '';

  const dupes = await dbFindByUrl(viewformUrl);

  const dupNotice = document.getElementById('saveDupNotice');
  const dupText   = document.getElementById('saveDupText');
  const btnSave   = document.getElementById('saveBtnSave');
  const btnUpdate = document.getElementById('saveBtnUpdate');
  const btnNew    = document.getElementById('saveBtnNew');

  if (dupes.length > 0) {
    _existingId = dupes[0].id;
    dupNotice.style.display = '';
    dupText.textContent = `Ya existe "${dupes[0].alias || dupes[0].title}" con esta URL (${relativeTime(dupes[0].updatedAt)}). ¿Qué deseas hacer?`;
    btnSave.style.display   = 'none';
    btnUpdate.style.display = '';
    btnNew.style.display    = '';
  } else {
    _existingId = null;
    dupNotice.style.display = 'none';
    btnSave.style.display   = '';
    btnUpdate.style.display = 'none';
    btnNew.style.display    = 'none';
  }

  document.getElementById('saveModal').classList.add('show');
  const aliasEl = document.getElementById('saveAlias');
  aliasEl.focus();
  aliasEl.select();
}

function closeSaveDialog() {
  document.getElementById('saveModal').classList.remove('show');
  _pending    = null;
  _existingId = null;
}

async function confirmSave(mode) {
  if (!_pending) return;
  const alias = document.getElementById('saveAlias').value.trim()
    || _pending.formData.title
    || 'Sin nombre';
  const now = new Date().toISOString();

  const record = {
    alias,
    title:     _pending.formData.title || '',
    desc:      _pending.formData.desc  || '',
    url:       _pending.viewformUrl,
    endpoint:  _pending.viewformUrl.replace('/viewform', '/formResponse'),
    fields:    _pending.formData.fields,
    status:    'active',
    createdAt: now,
    updatedAt: now,
  };

  if (mode === 'update' && _existingId !== null) {
    const existing   = await dbGet(_existingId);
    record.id        = _existingId;
    record.createdAt = existing ? existing.createdAt : now;
  }

  await dbPut(record);
  closeSaveDialog();
  showToast(mode === 'update' ? 'Formulario actualizado en la biblioteca' : 'Formulario guardado en la biblioteca');
  renderLibrary();
}

// ══════════════════════════════════════════════════════════════════════════════
// Render de la biblioteca
// ══════════════════════════════════════════════════════════════════════════════

async function renderLibrary() {
  const container = document.getElementById('libList');
  if (!container) return;

  let all = await dbGetAll();

  // Activos primero, luego por fecha desc
  all.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  // Filtro de búsqueda
  const q = _searchQ.toLowerCase();
  const visible = q
    ? all.filter(r =>
        (r.alias || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.url   || '').toLowerCase().includes(q)
      )
    : all;

  // Contador en el encabezado
  const countEl = document.getElementById('libCount');
  if (countEl) countEl.textContent = all.length
    ? `${all.length} guardado${all.length !== 1 ? 's' : ''}`
    : '';

  if (!visible.length) {
    container.innerHTML = `
      <div class="lib-empty">
        <i class="fa-solid fa-database"></i>
        <p>${q
          ? 'Sin resultados para esa búsqueda.'
          : 'Aún no hay formularios guardados.<br>Analiza uno y haz clic en <strong>Guardar en biblioteca</strong>.'
        }</p>
      </div>`;
    return;
  }

  container.innerHTML = visible.map(r => `
    <div class="lib-item${r.status === 'archived' ? ' lib-item--archived' : ''}">
      <div class="lib-item-info">
        <div class="lib-item-top">
          <span class="lib-badge lib-badge--${r.status}">
            <i class="fa-solid ${r.status === 'active' ? 'fa-circle-check' : 'fa-box-archive'}"></i>
            ${r.status === 'active' ? 'Activo' : 'Archivado'}
          </span>
          <span class="lib-alias">${esc(r.alias)}</span>
        </div>
        ${r.title && r.title !== r.alias ? `<div class="lib-title">${esc(r.title)}</div>` : ''}
        <div class="lib-meta">
          <span title="${esc(r.url)}"><i class="fa-solid fa-link"></i> ${esc(truncateUrl(r.url))}</span>
          <span><i class="fa-solid fa-table-list"></i> ${r.fields.length} campo${r.fields.length !== 1 ? 's' : ''}</span>
          <span><i class="fa-regular fa-clock"></i> ${relativeTime(r.updatedAt)}</span>
        </div>
      </div>
      <div class="lib-item-actions">
        <button class="btn-lib btn-lib--load"    onclick="loadSaved(${r.id})"     title="Cargar en el inspector">
          <i class="fa-solid fa-upload"></i> Cargar
        </button>
        <button class="btn-lib btn-lib--export"  onclick="exportOne(${r.id})"     title="Exportar como JSON">
          <i class="fa-solid fa-download"></i>
        </button>
        <button class="btn-lib btn-lib--archive" onclick="toggleArchive(${r.id})" title="${r.status === 'active' ? 'Archivar' : 'Reactivar'}">
          <i class="fa-solid ${r.status === 'active' ? 'fa-box-archive' : 'fa-box-open'}"></i>
        </button>
        <button class="btn-lib btn-lib--delete"  onclick="deleteSaved(${r.id})"   title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// Acciones de ítems
// ══════════════════════════════════════════════════════════════════════════════

async function loadSaved(id) {
  const record = await dbGet(id);
  if (!record) return;

  // Si ya está abierto en una pestaña, solo activarla
  const existing = _tabs.find(t => t.viewformUrl === record.url);
  if (existing) {
    activateTab(existing.id);
    showToast(`"${record.alias}" ya está abierto`);
    return;
  }

  if (_tabs.length >= MAX_TABS) {
    showToast(`Máximo ${MAX_TABS} formularios abiertos al mismo tiempo`);
    return;
  }

  const tabId = `ft${++_tabSeq}`;
  const tab = {
    id:          tabId,
    title:       record.alias || record.title,
    status:      'ready',
    formData:    { title: record.title, desc: record.desc || '', fields: record.fields },
    viewformUrl: record.url,
    shortUrl:    null,
    error:       '',
  };
  _tabs.push(tab);
  renderTabBar();
  activateTab(tabId);

  document.getElementById('formUrl').value = record.url;
  if (typeof persistInspectorState === 'function') persistInspectorState();
  showToast(`"${record.alias}" cargado desde la biblioteca`);
}

async function toggleArchive(id) {
  const record = await dbGet(id);
  if (!record) return;
  record.status    = record.status === 'active' ? 'archived' : 'active';
  record.updatedAt = new Date().toISOString();
  await dbPut(record);
  showToast(record.status === 'active' ? 'Formulario reactivado' : 'Formulario archivado');
  renderLibrary();
}

async function deleteSaved(id) {
  const record = await dbGet(id);
  if (!record) return;
  if (!confirm(`¿Eliminar "${record.alias || record.title}"? Esta acción no se puede deshacer.`)) return;
  await dbDel(id);
  showToast('Formulario eliminado de la biblioteca');
  renderLibrary();
}

// ══════════════════════════════════════════════════════════════════════════════
// Exportar / Importar
// ══════════════════════════════════════════════════════════════════════════════

async function exportOne(id) {
  const record = await dbGet(id);
  if (!record) return;
  const filename = `${slugLib(record.alias || record.title)}-${dateTag()}.json`;
  downloadJSON([record], filename);
  showToast(`Exportado: ${filename}`);
}

async function exportAllForms() {
  const all = await dbGetAll();
  if (!all.length) { showToast('No hay formularios guardados para exportar'); return; }
  const filename = `gfi-biblioteca-${dateTag()}.json`;
  downloadJSON(all, filename);
  showToast(`${all.length} formulario${all.length !== 1 ? 's' : ''} exportado${all.length !== 1 ? 's' : ''}`);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerImport() {
  document.getElementById('importFileInput').click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // permite importar el mismo archivo de nuevo

  let data;
  try { data = JSON.parse(await file.text()); }
  catch { showToast('Archivo JSON inválido'); return; }

  if (!Array.isArray(data)) data = [data];
  const valid = data.filter(r => r.url && Array.isArray(r.fields));
  if (!valid.length) { showToast('El archivo no contiene formularios válidos'); return; }

  let created = 0, updated = 0;
  const now = new Date().toISOString();

  for (const item of valid) {
    const { id: _dropped, ...rest } = item;
    const dupes = await dbFindByUrl(item.url);
    if (dupes.length > 0) {
      await dbPut({ ...rest, id: dupes[0].id, createdAt: dupes[0].createdAt, updatedAt: now });
      updated++;
    } else {
      await dbPut({ ...rest, createdAt: item.createdAt || now, updatedAt: now });
      created++;
    }
  }

  showToast(`Importados: ${created} nuevo${created !== 1 ? 's' : ''}, ${updated} actualizado${updated !== 1 ? 's' : ''}`);
  renderLibrary();
}

// ══════════════════════════════════════════════════════════════════════════════
// Búsqueda
// ══════════════════════════════════════════════════════════════════════════════

function handleLibSearch(e) {
  _searchQ = e.target.value.trim();
  renderLibrary();
}

// ══════════════════════════════════════════════════════════════════════════════
// Utilidades
// ══════════════════════════════════════════════════════════════════════════════

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m <  1)  return 'ahora mismo';
  if (m < 60)  return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `hace ${d} día${d !== 1 ? 's' : ''}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} mes${mo !== 1 ? 'es' : ''}`;
}

function truncateUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const p = pathname.length > 38 ? pathname.slice(0, 36) + '…' : pathname;
    return hostname + p;
  } catch { return url.slice(0, 55); }
}

function slugLib(s) {
  return (String(s || 'formulario')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)) || 'formulario';
}

function dateTag() { return new Date().toISOString().slice(0, 10); }

// ══════════════════════════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════════════════════════

async function initLibrary() {
  await openDB();
  await renderLibrary();

  document.getElementById('libSearch')
    ?.addEventListener('input', handleLibSearch);

  // Cerrar modal al hacer clic en el overlay
  document.getElementById('saveModal')
    ?.addEventListener('click', e => { if (e.target.id === 'saveModal') closeSaveDialog(); });

  // Cerrar modal con Escape
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSaveDialog(); });

  // Enter en el campo de alias confirma el guardado (si no hay duplicado)
  document.getElementById('saveAlias')
    ?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const btnSave = document.getElementById('saveBtnSave');
      if (btnSave && btnSave.style.display !== 'none') confirmSave();
    });
}

document.addEventListener('DOMContentLoaded', initLibrary);
