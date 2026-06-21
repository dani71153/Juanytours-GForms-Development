// Persistencia del estado del inspector entre recargas.
// No guarda la previsualizacion; esa usa la clave separada gfi:preview.
const INSPECTOR_STATE_KEY = 'gfi:inspector-state';

function getInspectorSnapshot() {
  const urlEl = document.getElementById('formUrl');
  const tabs = Array.isArray(_tabs)
    ? _tabs
        .filter(tab => tab && tab.status === 'ready' && tab.formData)
        .slice(0, MAX_TABS)
        .map(tab => ({
          id: tab.id,
          title: tab.title,
          status: 'ready',
          formData: tab.formData,
          viewformUrl: tab.viewformUrl,
          shortUrl: tab.shortUrl || null,
          error: '',
        }))
    : [];

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    activeId: tabs.some(tab => tab.id === _activeId) ? _activeId : 'library',
    tabSeq: typeof _tabSeq === 'number' ? _tabSeq : 0,
    formUrl: urlEl ? urlEl.value : '',
    tabs,
  };
}

function persistInspectorState() {
  try {
    localStorage.setItem(INSPECTOR_STATE_KEY, JSON.stringify(getInspectorSnapshot()));
  } catch (err) {
    console.warn('[Persistencia] No se pudo guardar el estado del inspector:', err);
  }
}

function restoreInspectorState() {
  let state;
  try {
    state = JSON.parse(localStorage.getItem(INSPECTOR_STATE_KEY) || 'null');
  } catch (err) {
    console.warn('[Persistencia] Estado guardado invalido:', err);
    return;
  }

  if (!state || state.version !== 1 || !Array.isArray(state.tabs)) return;

  const restoredTabs = state.tabs
    .filter(tab => tab && tab.status === 'ready' && tab.formData && tab.viewformUrl)
    .slice(0, MAX_TABS)
    .map((tab, index) => ({
      id: tab.id || `ft${index + 1}`,
      title: tab.title || tab.formData.title || 'Formulario',
      status: 'ready',
      formData: tab.formData,
      viewformUrl: tab.viewformUrl,
      shortUrl: tab.shortUrl || null,
      error: '',
    }));

  _tabs = restoredTabs;
  _tabSeq = Math.max(
    Number(state.tabSeq) || 0,
    ...restoredTabs.map(tab => Number(String(tab.id).replace(/^ft/, '')) || 0)
  );

  const urlEl = document.getElementById('formUrl');
  if (urlEl && typeof state.formUrl === 'string') urlEl.value = state.formUrl;

  const activeId = restoredTabs.some(tab => tab.id === state.activeId)
    ? state.activeId
    : 'library';

  activateTab(activeId);
}

function clearInspectorPersistence() {
  localStorage.removeItem(INSPECTOR_STATE_KEY);
}

document.addEventListener('DOMContentLoaded', restoreInspectorState);
