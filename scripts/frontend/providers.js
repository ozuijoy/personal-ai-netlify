  // 沒有內建模型：舊的瀏覽器模式只列使用者自己加的模型（ensureModel）。
  var MODELS = [];
  var NO_MODEL_MSG = '請先在設定中新增供應商並選擇模型';
  var PROVIDERS_KEY = 'ta_providers_v1';
  var PROVIDER_ACTIVE_KEY = 'ta_provider_active';
  // 伺服器模式（Netlify + Neon）：供應商與 Key 存在伺服器（Key 加密、不回傳），模型選單依供應商分組。
  // 環境變數供應商（id env-N，source 'env'）唯讀：Key 只在伺服器環境變數，面板只顯示名稱、Base URL 與模型。
  var SERVER_PROVIDERS = [];   // [{id, name, base_url, has_key, api_key_hint, source, readonly, models:[{model_id, display_name}], embed_models:[...]}]
  var MODEL_GROUPS = [];       // [{provider:{id,name,source,readonly,has_key}, models:[{id,name}]}]（只有聊天模型）
  var ENV_PROVIDER_ERRORS = []; // [{index, error}]：PROVIDER_N_* 設定錯誤
  var selectedProviderId = '';
  try { selectedProviderId = localStorage.getItem(PROVIDER_ACTIVE_KEY) || ''; } catch(e) {}
  function serverMode() { return !!(syncMeta && syncMeta.enabled); }
  function findModel(pid, mid) {
    for (var i = 0; i < MODEL_GROUPS.length; i++) {
      var g = MODEL_GROUPS[i];
      if (g.provider.id !== pid) continue;
      for (var j = 0; j < g.models.length; j++) if (g.models[j].id === mid) return { group: g, model: g.models[j] };
    }
    return null;
  }
  async function loadServerProviders() {
    if (!serverMode()) return;
    var r = await storeFetch('GET', '/api/providers');
    SERVER_PROVIDERS = Array.isArray(r.providers) ? r.providers : [];
    ENV_PROVIDER_ERRORS = Array.isArray(r.env_errors) ? r.env_errors : [];
    var g = await storeFetch('GET', '/api/models/grouped');
    MODEL_GROUPS = Array.isArray(g.groups) ? g.groups : [];
    // 不自動選模型：預設模型由使用者在設定中選擇
    refreshProviderSelect();
    renderModelPicker();
    fillDefaultModelSelect();
  }
  function readProviders() {
    if (serverMode()) {
      return SERVER_PROVIDERS.map(function(p) {
        return { id: p.id, name: p.name, baseUrl: p.base_url, apiKey: '', hasKey: !!p.has_key, keyHint: p.api_key_hint || '',
          readonly: !!p.readonly, source: p.source || 'db', note: p.note || '',
          models: (p.models || []).map(function(m) { return m.model_id; }), model: p.models && p.models[0] ? p.models[0].model_id : '',
          embedModels: (p.embed_models || []).map(function(m) { return m.model_id; }) };
      });
    }
    try {
      var list = JSON.parse(localStorage.getItem(PROVIDERS_KEY) || '[]');
      return Array.isArray(list) ? list.filter(function(p) { return p && p.id && p.baseUrl; }) : [];
    } catch(e) { return []; }
  }
  function writeProviders(list) {
    try { localStorage.setItem(PROVIDERS_KEY, JSON.stringify(list)); } catch(e) {}
  }
  function providerById(id) {
    var list = readProviders();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  // 只用於舊的「瀏覽器保存 Key」模式；伺服器模式回傳 null，聊天改送 provider_id。
  function activeProvider() {
    if (serverMode()) return null;
    var list = readProviders();
    if (!list.length) return null;
    var id = localStorage.getItem(PROVIDER_ACTIVE_KEY) || '';
    return providerById(id) || list[0];
  }
  function ensureModel(id) {
    if (!id || serverMode()) return;
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return;
    MODELS.push({ id: id, name: id, desc: '' });
  }
  function parseModelList(text) {
    var seen = {}, out = [];
    String(text || '').split(/[,\n]/).forEach(function(s) { s = s.trim(); if (s && !seen[s] && s.length <= 200) { seen[s] = true; out.push(s); } });
    return out.slice(0, 200);
  }
  function providerFormValues() {
    var get = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var clr = document.getElementById('provider-clear-key');
    return { name: get('provider-name'), baseUrl: get('provider-base'), apiKey: get('provider-key'), model: get('provider-model'), embedModels: get('provider-embed-models'), clearKey: !!(clr && clr.checked) };
  }
  function setProviderStatus(text, bad) {
    var el = document.getElementById('provider-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--green)';
  }
  function editingProviderId() {
    var sel = document.getElementById('provider-active-select');
    return sel && sel.value !== '__new' ? sel.value : '';
  }
  function loadProviderForm(id) {
    var p = id ? providerById(id) : null;
    var set = function(elId, value) { var el = document.getElementById(elId); if (el) el.value = value || ''; };
    set('provider-name', p ? p.name : '');
    set('provider-base', p ? p.baseUrl : '');
    set('provider-key', serverMode() ? '' : (p ? p.apiKey : ''));
    set('provider-model', p ? (serverMode() ? (p.models || []).join(', ') : p.model) : '');
    set('provider-embed-models', p && serverMode() ? (p.embedModels || []).join(', ') : '');
    var ro = !!(p && p.readonly);
    ['provider-name', 'provider-base', 'provider-key', 'provider-model', 'provider-embed-models'].forEach(function(elId) {
      var el = document.getElementById(elId); if (el) el.readOnly = ro;
    });
    ['provider-save-btn', 'provider-delete-btn'].forEach(function(elId) { var el = document.getElementById(elId); if (el) el.disabled = ro; });
    var note = document.getElementById('provider-env-note');
    if (note) { note.style.display = ro ? '' : 'none'; note.textContent = ro ? (p.note || '由環境變數管理') + '：要修改請到部署平台的 PROVIDER_N_* 環境變數，Key 不會傳到瀏覽器。' : ''; }
    var keyEl = document.getElementById('provider-key');
    if (keyEl) keyEl.placeholder = ro ? (p.hasKey ? '由環境變數提供' : '未設定 Key') : serverMode() && p ? (p.hasKey ? ('已加密保存（' + p.keyHint + '），留空表示不變') : '未設定 Key（可留空）') : 'sk-…（自建模型可留空）';
    var clr = document.getElementById('provider-clear-key');
    if (clr) { clr.checked = false; clr.disabled = ro || !(serverMode() && p && p.hasKey); }
    setProviderStatus(ro ? ('由環境變數管理：' + (p.name || p.baseUrl)) : p ? ('編輯中：' + (p.name || p.baseUrl)) : '新增供應商', false);
    var errEl = document.getElementById('provider-env-errors');
    if (errEl) {
      errEl.style.display = ENV_PROVIDER_ERRORS.length ? '' : 'none';
      errEl.textContent = ENV_PROVIDER_ERRORS.length ? '環境變數供應商設定有誤（已略過）：' + ENV_PROVIDER_ERRORS.map(function(e) { return e.error; }).join('；') : '';
    }
  }
  function refreshProviderSelect() {
    var sel = document.getElementById('provider-active-select');
    if (!sel) return;
    var list = readProviders();
    var keep = sel.value;
    var active = serverMode() ? selectedProviderId : (localStorage.getItem(PROVIDER_ACTIVE_KEY) || (list[0] && list[0].id) || '');
    sel.innerHTML = list.map(function(p) {
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name || p.baseUrl) + (p.readonly ? '（環境變數）' : '') + '</option>';
    }).join('') + '<option value="__new">＋ 新增供應商</option>';
    var want = list.some(function(p) { return p.id === keep; }) ? keep : active;
    sel.value = list.some(function(p) { return p.id === want; }) ? want : (list[0] ? list[0].id : '__new');
    loadProviderForm(sel.value === '__new' ? '' : sel.value);
  }
  async function saveProvider() {
    var v = providerFormValues();
    var editing = editingProviderId() ? providerById(editingProviderId()) : null;
    if (editing && editing.readonly) { setProviderStatus('此供應商由環境變數管理，無法在這裡修改', true); return; }
    if (!v.name) v.name = '供應商';
    if (!/^https:\/\//i.test(v.baseUrl)) { setProviderStatus('Base URL 必須是 HTTPS', true); return; }
    try { new URL(v.baseUrl); } catch(e) { setProviderStatus('Base URL 格式不正確', true); return; }
    var models = parseModelList(v.model);
    var embedModels = serverMode() ? parseModelList(v.embedModels) : [];
    if (!models.length && !embedModels.length) { setProviderStatus('請填寫至少一個聊天模型或嵌入模型 ID（多個以逗號分隔）', true); return; }
    if (!serverMode() && !models.length) { setProviderStatus('請填寫至少一個模型 ID（多個以逗號分隔）', true); return; }
    // API Key 可以留空：自建模型或不需驗證的相容閘道。
    if (serverMode()) {
      var currentId = editingProviderId();
      var body = { name: v.name, base_url: v.baseUrl.replace(/\/+$/, ''), models: models, embed_models: embedModels };
      if (v.apiKey) body.api_key = v.apiKey;
      else if (currentId && v.clearKey) { body.api_key = ''; body.clear_key = true; }
      setProviderStatus('儲存中…', false);
      try {
        var r = currentId ? await storeFetch('PATCH', '/api/providers/' + encodeURIComponent(currentId), body)
                          : await storeFetch('POST', '/api/providers', body);
        var saved = r.provider;
        var sel = document.getElementById('provider-active-select');
        if (sel && saved) { sel.innerHTML += '<option value="' + escapeHtml(saved.id) + '"></option>'; sel.value = saved.id; }
        await loadServerProviders();
        if (saved && models.length) setModel(saved.id + '|' + models[0]);
        var keyEl = document.getElementById('provider-key'); if (keyEl) keyEl.value = '';
        setProviderStatus('已儲存：' + v.name + (saved && saved.has_key ? '（Key 已加密）' : '（無 Key）'), false);
      } catch(e) { setProviderStatus(e && e.message ? e.message : '儲存失敗', true); }
      return;
    }
    var list = readProviders();
    var lid = editingProviderId();
    var existing = lid ? providerById(lid) : null;
    var item = { id: existing ? existing.id : ('p' + Date.now()), name: v.name, baseUrl: v.baseUrl.replace(/\/+$/, ''), apiKey: v.apiKey, model: models[0] };
    if (existing) {
      for (var i = 0; i < list.length; i++) if (list[i].id === existing.id) list[i] = item;
    } else list.push(item);
    writeProviders(list);
    localStorage.setItem(PROVIDER_ACTIVE_KEY, item.id);
    ensureModel(item.model);
    var lsel = document.getElementById('provider-active-select');
    if (lsel) lsel.value = item.id;
    setModel(item.model);
    setProviderStatus('已儲存：' + item.name, false);
  }
  async function deleteProvider() {
    var id = editingProviderId();
    if (!id) { setProviderStatus('目前沒有可刪除的供應商', true); return; }
    var target = providerById(id);
    if (target && target.readonly) { setProviderStatus('此供應商由環境變數管理，無法刪除', true); return; }
    if (!confirm('刪除這個供應商設定？')) return;
    if (serverMode()) {
      try { await storeFetch('DELETE', '/api/providers/' + encodeURIComponent(id)); } catch(e) { setProviderStatus(e.message || '刪除失敗', true); return; }
      await loadServerProviders();
      setProviderStatus('已刪除', false);
      return;
    }
    var list = readProviders().filter(function(p) { return p.id !== id; });
    writeProviders(list);
    localStorage.setItem(PROVIDER_ACTIVE_KEY, list[0] ? list[0].id : '');
    refreshProviderSelect();
    setProviderStatus('已刪除', false);
  }
  async function fetchProviderModels(apply) {
    var v = providerFormValues();
    var currentId = editingProviderId();
    var current = currentId ? providerById(currentId) : null;
    var ro = !!(current && current.readonly);
    if (!v.baseUrl) { setProviderStatus('請先填寫 Base URL', true); return; }
    setProviderStatus('正在連線…', false);
    try {
      var data;
      if (serverMode() && currentId && (ro || !v.apiKey)) {
        // 已儲存的供應商：由伺服器解密 Key（或讀環境變數 Key）後代為查詢，Key 不經過瀏覽器
        data = await storeFetch('POST', '/api/providers/' + encodeURIComponent(currentId) + '/discover', {});
      } else {
        var res = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: v.baseUrl, apiKey: v.apiKey }) });
        data = await res.json().catch(function() { return {}; });
        if (!res.ok) throw new Error(data.message || data.error || ('HTTP ' + res.status));
      }
      var models = Array.isArray(data.models) ? data.models : [];
      var list = document.getElementById('provider-model-list');
      if (list) list.innerHTML = models.map(function(m) { return '<option value="' + escapeHtml(m) + '"></option>'; }).join('');
      if (apply && models.length && !ro) {
        var input = document.getElementById('provider-model');
        if (input) input.value = serverMode() ? models.slice(0, 50).join(', ') : models[0];
      }
      setProviderStatus('連線成功，取得 ' + models.length + ' 個模型' + (ro ? '（環境變數供應商的模型清單請改 PROVIDER_N_MODELS / PROVIDER_N_EMBED_MODELS）' : apply && serverMode() && models.length ? '，可刪掉不需要的再儲存' : ''), false);
    } catch(e) {
      setProviderStatus(e && e.message ? e.message : '連線失敗', true);
    }
  }
  function initProviderUI() {
    refreshProviderSelect();
    var sel = document.getElementById('provider-active-select');
    if (sel) sel.addEventListener('change', function() { loadProviderForm(this.value === '__new' ? '' : this.value); });
    var bind = function(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    bind('provider-new-btn', function() { var sel = document.getElementById('provider-active-select'); if (sel) sel.value = '__new'; loadProviderForm(''); });
    bind('provider-save-btn', saveProvider);
    bind('provider-delete-btn', deleteProvider);
    bind('provider-test-btn', function() { fetchProviderModels(false); });
    bind('provider-models-btn', function() { fetchProviderModels(true); });
    var active = activeProvider();
    if (active) { ensureModel(active.model); if (active.model) setModel(active.model); }
  }
