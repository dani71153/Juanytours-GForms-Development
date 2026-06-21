// ─── Question type map ───────────────────────────────────────────────────────
const Q = {
  0:  { name:'Texto corto',         html:'input[type="text"]',     badge:'b-text',   icon:'fa-font',          fmt:'Texto libre' },
  1:  { name:'Párrafo',             html:'textarea',               badge:'b-para',   icon:'fa-align-left',    fmt:'Texto largo' },
  2:  { name:'Opción múltiple',     html:'input[type="radio"]',    badge:'b-radio',  icon:'fa-circle-dot',    fmt:'Valor exacto de la opción' },
  3:  { name:'Lista desplegable',   html:'select',                 badge:'b-select', icon:'fa-list',          fmt:'Valor exacto de la opción' },
  4:  { name:'Casillas',            html:'input[type="checkbox"]', badge:'b-check',  icon:'fa-square-check',  fmt:'Valor exacto (puede ser múltiple)' },
  5:  { name:'Escala lineal',       html:'input[type="radio"]',    badge:'b-scale',  icon:'fa-sliders',       fmt:'Número de la escala' },
  7:  { name:'Cuadrícula',          html:'(complejo)',             badge:'b-other',  icon:'fa-table-cells',   fmt:'Ver estructura de cuadrícula' },
  9:  { name:'Fecha',               html:'input[type="date"]',     badge:'b-date',   icon:'fa-calendar',      fmt:'YYYY-MM-DD' },
  10: { name:'Hora',                html:'input[type="time"]',     badge:'b-time',   icon:'fa-clock',         fmt:'HH:MM' },
};

let _endpoint = '';

// ─── Tab state ────────────────────────────────────────────────────────────────
// Each tab: { id, title, status:'loading'|'ready'|'error', formData, viewformUrl, shortUrl, error }
const MAX_TABS  = 8;
let   _tabs     = [];
let   _activeId = 'library';
let   _tabSeq   = 0;

// ─── Tab management ───────────────────────────────────────────────────────────
function createFormTab(initialUrl) {
  if (_tabs.length >= MAX_TABS) {
    showToast(`Máximo ${MAX_TABS} formularios abiertos al mismo tiempo`);
    return null;
  }
  const id  = `ft${++_tabSeq}`;
  const tab = { id, title: 'Analizando…', status: 'loading', formData: null, viewformUrl: initialUrl, shortUrl: null, error: '' };
  _tabs.push(tab);
  return tab;
}

function closeTab(id) {
  const idx = _tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  _tabs.splice(idx, 1);
  if (_activeId === id) {
    const next = _tabs[idx] || _tabs[idx - 1];
    activateTab(next ? next.id : 'library');
  } else {
    renderTabBar();
  }
}

function activateTab(id) {
  _activeId = id;
  renderTabBar();

  const libPanel = document.getElementById('panel-library');
  const resPanel = document.getElementById('panel-results');

  if (id === 'library') {
    libPanel.style.display = '';
    resPanel.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  libPanel.style.display = 'none';
  resPanel.style.display = '';

  // Reset inner state
  document.getElementById('loadBanner').classList.remove('show');
  document.getElementById('errBanner').classList.remove('show');
  document.getElementById('results').classList.remove('show');
  const saveBtn = document.getElementById('saveTriggerBtn');
  if (saveBtn) saveBtn.style.display = 'none';

  const tab = _tabs.find(t => t.id === id);
  if (!tab) return;

  if (tab.status === 'loading') {
    document.getElementById('loadBanner').classList.add('show');
  } else if (tab.status === 'error') {
    showErr('Error al analizar el formulario', tab.error);
  } else if (tab.status === 'ready') {
    render(tab.formData, tab.viewformUrl, tab.shortUrl);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTabBar() {
  const bar = document.getElementById('tabBar');

  // Update pinned library tab
  const libTab = bar.querySelector('.tab--pinned');
  if (libTab) libTab.classList.toggle('tab--active', _activeId === 'library');

  // Remove all dynamic tabs then rebuild
  bar.querySelectorAll('.tab:not(.tab--pinned)').forEach(el => el.remove());

  _tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `tab${_activeId === tab.id ? ' tab--active' : ''}`;
    btn.innerHTML = `
      <i class="fa-solid ${tab.status === 'loading' ? 'fa-circle-notch fa-spin' : 'fa-file-lines'}"></i>
      <span class="tab-title" title="${esc(tab.title)}">${esc(tab.title)}</span>
      <span class="tab-close" onclick="event.stopPropagation();closeTab('${tab.id}')" title="Cerrar">
        <i class="fa-solid fa-xmark"></i>
      </span>`;
    btn.onclick = () => activateTab(tab.id);
    bar.appendChild(btn);
  });
}

function saveActiveForm() {
  const tab = _tabs.find(t => t.id === _activeId);
  if (tab && tab.formData) openSaveDialog(tab.formData, tab.viewformUrl);
}

// ─── URL helpers ─────────────────────────────────────────────────────────────
function isGoogleForms(url) {
  try {
    const p = new URL(url.trim());
    if (p.hostname === 'forms.gle') return true;
    return (p.hostname === 'docs.google.com' || p.hostname === 'forms.google.com')
        && p.pathname.includes('/forms/');
  } catch { return false; }
}

function isShortened(url) {
  try { return new URL(url.trim()).hostname === 'forms.gle'; }
  catch { return false; }
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
         || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m ? m[1] : null;
}

function toViewformUrl(raw) {
  const p = new URL(raw.trim());
  const base = 'https://docs.google.com';
  let path = p.pathname.replace(/\/$/, '');

  if (path.endsWith('/viewform')) return base + path;

  const vi = path.indexOf('/viewform');
  if (vi !== -1) return base + path.slice(0, vi + '/viewform'.length);

  if (path.includes('/formResponse')) return base + path.replace('/formResponse', '/viewform');

  return base + path + '/viewform';
}

// ─── Fetch via CORS proxy ────────────────────────────────────────────────────
async function fetchHtml(url) {
  const enc = encodeURIComponent(url);

  try {
    const r = await fetch(`https://api.allorigins.win/get?url=${enc}`, { signal: AbortSignal.timeout(18000) });
    if (!r.ok) throw new Error(`allorigins ${r.status}`);
    const j = await r.json();
    if (j && j.contents && j.contents.length > 200) {
      let resolvedUrl = (j.status && j.status.url) ? j.status.url : url;
      if (new URL(resolvedUrl).hostname === 'forms.gle') {
        resolvedUrl = extractCanonical(j.contents) || resolvedUrl;
      }
      return { html: j.contents, resolvedUrl };
    }
    throw new Error('Respuesta vacía de allorigins');
  } catch (e1) {
    try {
      const r = await fetch(`https://corsproxy.io/?${enc}`, { signal: AbortSignal.timeout(18000) });
      if (!r.ok) throw new Error(`corsproxy ${r.status}`);
      const txt = await r.text();
      if (txt.length > 200) {
        const resolvedUrl = extractCanonical(txt) || url;
        return { html: txt, resolvedUrl };
      }
      throw new Error('Respuesta vacía de corsproxy');
    } catch (e2) {
      throw new Error(`No se pudo obtener el formulario.\nProxy 1: ${e1.message}\nProxy 2: ${e2.message}`);
    }
  }
}

// ─── Extract FB_PUBLIC_LOAD_DATA_ ────────────────────────────────────────────
function extractFbData(html) {
  const MARKER = 'FB_PUBLIC_LOAD_DATA_';
  const idx = html.indexOf(MARKER);
  if (idx === -1) throw new Error(
    'No se encontró FB_PUBLIC_LOAD_DATA_ en el HTML. El formulario puede ser privado, requerir inicio de sesión, o la URL no es correcta.'
  );

  const eq = html.indexOf('=', idx + MARKER.length);
  if (eq === -1) throw new Error('Formato inesperado al leer FB_PUBLIC_LOAD_DATA_');

  let start = -1;
  for (let i = eq + 1; i < eq + 30 && i < html.length; i++) {
    if (html[i] === '[') { start = i; break; }
  }
  if (start === -1) throw new Error('No se encontró el inicio del array de datos');

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc)    { esc = false; continue; }
    if (inStr)  { if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') {
      if (--depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); }
        catch (e) { throw new Error(`Error parseando JSON de Google Forms: ${e.message}`); }
      }
    }
  }
  throw new Error('No se pudo extraer el JSON (brackets no balanceados)');
}

// ─── Parse form structure ─────────────────────────────────────────────────────
function parseForm(raw) {
  if (!Array.isArray(raw) || !Array.isArray(raw[1])) throw new Error('Estructura de datos no reconocida');

  const fb = raw[1];

  let title = '';
  const formIdFromRaw = typeof raw[2] === 'string' ? raw[2] : '';
  for (const idx of [1, 8, 3, 6]) {
    const v = fb[idx];
    if (typeof v === 'string' && v && v !== formIdFromRaw && v.length < 300 && !v.startsWith('1FAIpQL')) {
      title = v; break;
    }
  }
  if (!title) title = 'Formulario sin título';

  let desc = '';
  for (const idx of [0, 2, 12]) {
    const v = fb[idx];
    if (typeof v === 'string' && v && v !== title && !v.startsWith('1FAIpQL') && v.length < 2000) {
      desc = v; break;
    }
  }

  const seenIds = new Set();
  const fields  = [];
  walkForFields(raw, fields, seenIds, 0);

  if (!fields.length) {
    console.warn('[GFI] parseForm: no fields found. raw[1] keys:',
      fb.map((v, i) => `[${i}]=${Array.isArray(v) ? 'Array(' + v.length + ')' : typeof v}`).join(', '));
    throw new Error('El formulario no tiene campos con entry ID detectables. Revisa la consola del navegador (F12) para ver la estructura recibida.');
  }
  return { title, desc, fields };
}

function isEntryId(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 10000000;
}

function walkForFields(node, fields, seenIds, depth) {
  if (depth > 14 || !Array.isArray(node)) return;

  if (
    node.length >= 4 &&
    typeof node[0] === 'number' &&
    typeof node[1] === 'string' && node[1].trim() !== '' &&
    typeof node[3] === 'number' && node[3] >= 0 && node[3] <= 12
  ) {
    const label = node[1].trim();
    const type  = node[3];
    const qDesc = typeof node[2] === 'string' ? node[2] : '';

    for (let ei = 4; ei <= 7; ei++) {
      if (!Array.isArray(node[ei])) continue;
      for (const entry of node[ei]) {
        if (!Array.isArray(entry) || !isEntryId(entry[0])) continue;
        if (seenIds.has(entry[0])) continue;
        seenIds.add(entry[0]);

        const required = entry[2] === 1;
        let opts = [];
        for (const oi of [4, 3]) {
          if (Array.isArray(entry[oi])) {
            opts = entry[oi]
              .filter(o => Array.isArray(o) && typeof o[0] === 'string' && o[0] !== '')
              .map(o => o[0]);
            if (opts.length) break;
          }
        }
        fields.push({ label, type, entryId: entry[0], name: `entry.${entry[0]}`, desc: qDesc, required, options: opts });
      }
    }
  }

  for (const child of node) {
    walkForFields(child, fields, seenIds, depth + 1);
  }
}

// ─── Render results ───────────────────────────────────────────────────────────
function render(formData, viewformUrl, shortUrl) {
  _endpoint = viewformUrl.replace('/viewform', '/formResponse');

  const saveTrigger = document.getElementById('saveTriggerBtn');
  if (saveTrigger) saveTrigger.style.display = '';

  document.getElementById('resTitle').textContent = formData.title;
  const descEl = document.getElementById('resDesc');
  if (formData.desc) { descEl.textContent = formData.desc; descEl.style.display = ''; }
  else descEl.style.display = 'none';

  const shortNotice = document.getElementById('resShortNotice');
  if (shortUrl) {
    shortNotice.style.display = '';
    document.getElementById('resShortFrom').textContent = shortUrl;
    document.getElementById('resShortTo').textContent   = viewformUrl;
  } else {
    shortNotice.style.display = 'none';
  }

  document.getElementById('resEndpoint').textContent = _endpoint;
  document.getElementById('resCount').textContent =
    `${formData.fields.length} campo${formData.fields.length !== 1 ? 's' : ''}`;

  // Table
  const tbody = document.getElementById('fieldsTbody');
  tbody.innerHTML = '';
  formData.fields.forEach((f, i) => {
    const qt = Q[f.type] || { name:`Tipo ${f.type}`, html:'—', badge:'b-other', icon:'fa-question', fmt:'—' };
    const optsHtml = f.options.length
      ? `<div class="opts">${f.options.map(o => `<span class="opt-tag">${esc(o)}</span>`).join('')}</div>`
      : `<span class="fmt-hint">${qt.fmt}</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:.8rem">${i + 1}</td>
      <td>
        <div class="f-label">${esc(f.label)}${f.required ? ' <span style="color:var(--error)">*</span>' : ''}</div>
        ${f.desc ? `<div class="f-desc">${esc(f.desc)}</div>` : ''}
      </td>
      <td>
        <span class="entry-chip" title="Clic para copiar" onclick="copyText('${f.name}')">${f.name}</span>
      </td>
      <td><span class="badge ${qt.badge}"><i class="fa-solid ${qt.icon}"></i> ${qt.name}</span></td>
      <td>${optsHtml}</td>`;
    tbody.appendChild(tr);
  });

  // JSON export
  const jsonMap = {
    formTitle: formData.title,
    endpoint: _endpoint,
    fields: Object.fromEntries(formData.fields.map(f => {
      const qt = Q[f.type] || {};
      const val = { label: f.label, entry: f.name, type: qt.name || `type_${f.type}`, htmlInput: qt.html || '?', required: f.required };
      if (f.options.length) val.options = f.options;
      return [slug(f.label), val];
    })),
    hiddenFields: { fvv: '1', pageHistory: '0', submit: 'Submit' },
  };
  document.getElementById('jsonOut').textContent = JSON.stringify(jsonMap, null, 2);

  // HTML export
  const fieldLines = formData.fields.map(f => {
    const req     = f.required ? ' required' : '';
    const comment = `<!-- ${esc(f.label)}${f.required ? ' (obligatorio)' : ''} -->`;
    if (f.type === 0)  return `${comment}\n<input type="text" name="${f.name}" placeholder=""${req} />`;
    if (f.type === 1)  return `${comment}\n<textarea name="${f.name}"${req}></textarea>`;
    if (f.type === 9)  return `${comment}\n<input type="date" name="${f.name}"${req} />`;
    if (f.type === 10) return `${comment}\n<input type="time" name="${f.name}"${req} />`;
    if (f.type === 2 || f.type === 4) {
      const tag   = f.type === 2 ? 'radio' : 'checkbox';
      const lines = f.options.map(o => `  <label><input type="${tag}" name="${f.name}" value="${escA(o)}" /> ${esc(o)}</label>`);
      return `${comment}\n${lines.join('\n')}`;
    }
    if (f.type === 3) {
      const opts = f.options.map(o => `  <option value="${escA(o)}">${esc(o)}</option>`).join('\n');
      return `${comment}\n<select name="${f.name}"${req}>\n  <option value="">Selecciona...</option>\n${opts}\n</select>`;
    }
    return `${comment}\n<input type="text" name="${f.name}"${req} />`;
  }).join('\n\n');

  document.getElementById('htmlOut').textContent =
`<form action="${_endpoint}" method="POST">

${fieldLines}

  <!-- Campos ocultos requeridos -->
  <input type="hidden" name="fvv" value="1" />
  <input type="hidden" name="pageHistory" value="0" />
  <input type="hidden" name="submit" value="Submit" />

  <button type="submit">Enviar</button>
</form>`;

  switchExportTab('json');
  document.getElementById('results').classList.add('show');
}

// ─── Main analyze ─────────────────────────────────────────────────────────────
async function analyzeForm() {
  const urlEl = document.getElementById('formUrl');
  const url   = urlEl.value.trim();

  urlEl.classList.remove('err');
  document.getElementById('urlErr').classList.remove('show');

  if (!url) { return showUrlErr('Por favor ingresa una URL de Google Forms.'); }
  if (!isGoogleForms(url)) { return showUrlErr('La URL no corresponde a Google Forms. Verifica el dominio.'); }

  // Normalize for duplicate-tab check
  let normalizedUrl = url;
  if (!isShortened(url)) {
    try { normalizedUrl = toViewformUrl(url); } catch { /* keep original */ }
  }
  const existing = _tabs.find(t => t.viewformUrl === normalizedUrl || t.viewformUrl === url);
  if (existing) {
    activateTab(existing.id);
    showToast('Este formulario ya está abierto');
    return;
  }

  const tab = createFormTab(normalizedUrl);
  if (!tab) return;
  activateTab(tab.id);

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analizando…';

  try {
    const fetchUrl = isShortened(url) ? url : toViewformUrl(url);
    const { html, resolvedUrl } = await fetchHtml(fetchUrl);

    let viewformUrl;
    try { viewformUrl = toViewformUrl(resolvedUrl); }
    catch { viewformUrl = isShortened(url) ? url : toViewformUrl(url); }

    const raw      = extractFbData(html);
    const formData = parseForm(raw);
    const shortUrl = isShortened(url) ? resolvedUrl : null;

    tab.title       = formData.title;
    tab.status      = 'ready';
    tab.formData    = formData;
    tab.viewformUrl = viewformUrl;
    tab.shortUrl    = shortUrl;

    renderTabBar();
    render(formData, viewformUrl, shortUrl);
  } catch (e) {
    tab.title  = 'Error';
    tab.status = 'error';
    tab.error  = e.message;
    renderTabBar();
    showErr('Error al analizar el formulario', e.message);
  } finally {
    document.getElementById('loadBanner').classList.remove('show');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Analizar';
  }
}

// ─── Export tab switcher ──────────────────────────────────────────────────────
function switchExportTab(tab) {
  document.getElementById('tabJson').style.display = tab === 'json' ? '' : 'none';
  document.getElementById('tabHtml').style.display = tab === 'html' ? '' : 'none';
  document.querySelectorAll('.export-tab').forEach(btn => {
    btn.classList.toggle('export-tab--active', btn.dataset.tab === tab);
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showUrlErr(msg) {
  const el = document.getElementById('urlErr');
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('formUrl').classList.add('err');
}
function showErr(title, msg) {
  document.getElementById('errTitle').textContent = title;
  document.getElementById('errMsg').textContent   = msg;
  document.getElementById('errBanner').classList.add('show');
}

// ─── Copy helpers ─────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copiado: ' + (text.length > 40 ? text.slice(0, 40) + '…' : text)));
}
function copyEl(id) {
  copyText(document.getElementById(id).textContent);
  showToast('Copiado al portapapeles');
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function esc(s)  { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escA(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

// Enter key
document.getElementById('formUrl').addEventListener('keydown', e => { if (e.key === 'Enter') analyzeForm(); });
