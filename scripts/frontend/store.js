  // ── 伺服器儲存（Netlify + Neon）─────────────────────────────────
  // 取代舊 D1 同步：伺服器為主，localStorage 只當快取。
  // 推送：saveChats / saveDocuments / saveProjects / 儲存設定 → scheduleSync() → 1.5 秒後把有變動的項目送到伺服器。
  // 拉取：啟動時與按「立即同步」時，以伺服器為準更新本機；本機尚未送出的修改保留並稍後送出。
  var STORE_META_KEY = 'ta_store_meta_v2';
  var syncMeta = { enabled: false, applying: false, busy: false, timer: 0, pending: false, hashes: {}, srv: {}, providersImported: false };
  try {
    var savedStore = JSON.parse(localStorage.getItem(STORE_META_KEY) || '{}');
    if (savedStore && typeof savedStore === 'object') {
      syncMeta.hashes = savedStore.hashes && typeof savedStore.hashes === 'object' ? savedStore.hashes : {};
      syncMeta.srv = savedStore.srv && typeof savedStore.srv === 'object' ? savedStore.srv : {};
      syncMeta.providersImported = !!savedStore.providersImported;
    }
    localStorage.removeItem('ta_sync_meta_v1');
  } catch(eStore) {}
  function saveSyncMeta() {
    try { localStorage.setItem(STORE_META_KEY, JSON.stringify({ hashes: syncMeta.hashes, srv: syncMeta.srv, providersImported: syncMeta.providersImported })); } catch(e) {}
  }
  function setSyncStatus(text, bad) {
    var el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--muted)';
  }
  // localStorage 鍵 → 伺服器 settings 鍵。ta_ephemeral、ta_project_active 是裝置狀態，不上傳。
  var STORE_SETTINGS = {
    ta_custom_prompt: 'custom_prompt', ta_tone: 'tone', ta_len_mode: 'len_mode', ta_auto_search: 'auto_search',
    ta_use_docs: 'use_docs', ta_timezone: 'timezone', ta_adapt: 'adapt',
    ta_prompt_favs: 'prompt_favs', ta_prompt_recent: 'prompt_recent',
    ta_model: 'active_model_id', ta_provider_active: 'active_provider_id',
    ta_theme: 'ui.theme', ta_font: 'ui.font', ta_accent: 'ui.accent', ta_compact_sb: 'ui.compact_sb',
    ta_reduce_motion: 'ui.reduce_motion', ta_show_time: 'ui.show_time', ta_enter_send: 'ui.enter_send',
    ta_confirm_del: 'ui.confirm_del', ta_auto_read: 'ui.auto_read'
  };
  function storeHash(value) {
    var s = typeof value === 'string' ? value : JSON.stringify(value);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return s.length + ':' + h.toString(36);
  }
  async function storeFetch(method, path, body) {
    var opts = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    var res = await fetch(path, opts);
    if (res.status === 401) { location.href = '/login'; throw new Error('請重新登入'); }
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) throw new Error(data.message || data.error || ('HTTP ' + res.status));
    return data;
  }
  window.TA_STORE = { fetch: storeFetch };

  // 本機格式 ↔ 伺服器格式
  function chatForHash(c) {
    return { title: c.title || '', projectId: c.projectId || null, pinned: !!c.pinned, archived: !!c.archived,
      messages: (c.messages || []).map(function(m) { return [m.role, m.content, m.sources || [], m.image || '']; }) };
  }
  function chatToServer(id, c) {
    return { id: id, title: String(c.title || '').slice(0, 300), project_id: c.projectId || null, pinned: !!c.pinned, archived: !!c.archived,
      messages: (c.messages || []).map(function(m) {
        return { role: m.role === 'ai' ? 'assistant' : m.role, content: m.content || '', sources: m.sources || [], at: m.at, image: m.image && String(m.image).length <= 2000 ? m.image : undefined };
      }) };
  }
  function chatFromServer(sc) {
    return { title: sc.title || '', projectId: sc.project_id || null, pinned: !!sc.pinned, archived: !!sc.archived,
      updatedAt: Date.parse(sc.updated_at) || Date.now(),
      messages: (sc.messages || []).map(function(m) {
        var out = { role: m.role === 'assistant' ? 'ai' : m.role, content: m.content || '', sources: m.sources || [], at: Date.parse(m.created_at) || Date.now() };
        if (m.meta && m.meta.image) out.image = m.meta.image;
        return out;
      }) };
  }
  function docForHash(d) { return { t: d.title || '', c: d.content || '', ty: d.type || 'note', p: d.projectId || null }; }
  function docToServer(d) {
    var ty = d.type === 'file' || d.type === 'web' || d.type === 'knowledge' ? d.type : 'note';
    return { id: d.id, title: String(d.title || '').slice(0, 500), content: String(d.content || ''), doc_type: ty, project_id: d.projectId || null,
      data: { legacy_type: d.type || null, created: d.created || null, lang: d.lang || null, size: d.size || null } };
  }
  function docFromServer(sd) {
    var data = sd.data || {};
    return { id: sd.id, title: sd.title || '', content: sd.content || '', type: data.legacy_type || sd.doc_type || 'note',
      projectId: sd.project_id || null, created: data.created || Date.parse(sd.created_at) || Date.now(), lang: data.lang || undefined,
      updatedAt: Date.parse(sd.updated_at) || Date.now() };
  }
  function projectForHash(p) { var c = {}; Object.keys(p).forEach(function(k) { if (k !== 'updatedAt') c[k] = p[k]; }); return c; }
  function projectToServer(p) {
    var data = {};
    Object.keys(p).forEach(function(k) { if (['id', 'name', 'description', 'instructions', 'updatedAt'].indexOf(k) === -1) data[k] = p[k]; });
    return { id: p.id, name: String(p.name || '未命名專案').slice(0, 200), description: p.description || '', instructions: p.instructions || '', data: data };
  }
  function projectFromServer(sp) {
    var p = {};
    var data = sp.data || {};
    Object.keys(data).forEach(function(k) { p[k] = data[k]; });
    p.id = sp.id; p.name = sp.name; p.description = sp.description || ''; p.instructions = sp.instructions || '';
    p.updatedAt = Date.parse(sp.updated_at) || Date.now();
    return p;
  }
  function settingsSnapshot() {
    var out = {};
    Object.keys(STORE_SETTINGS).forEach(function(lk) {
      var v = null;
      try { v = localStorage.getItem(lk); } catch(e) {}
      if (v !== null) out[STORE_SETTINGS[lk]] = v;
    });
    return out;
  }
  function localProfileRaw() { try { return localStorage.getItem('ta_profile') || ''; } catch(e) { return ''; } }

  async function pullSync() {
    if (!syncMeta.enabled || syncMeta.busy) return false;
    syncMeta.busy = true;
    syncMeta.applying = true;
    var imported = 0;
    try {
      // 1) 設定：伺服器有值 → 覆蓋本機；本機有、伺服器沒有 → 稍後推送
      var sres = await storeFetch('GET', '/api/settings');
      var serverSettings = sres.settings || {};
      Object.keys(STORE_SETTINGS).forEach(function(lk) {
        var sk = STORE_SETTINGS[lk];
        if (!(sk in serverSettings)) return;
        var v = serverSettings[sk];
        var str = typeof v === 'string' ? v : JSON.stringify(v);
        var local = localStorage.getItem(lk);
        var h = syncMeta.hashes['setting:' + sk];
        if (local !== null && h && h !== storeHash(local)) return; // 本機有未送出的修改
        try { localStorage.setItem(lk, str); } catch(e) {}
        syncMeta.hashes['setting:' + sk] = storeHash(str);
      });
      selectedModel = localStorage.getItem('ta_model') || selectedModel;
      // 2) 個人資料
      var pres = await storeFetch('GET', '/api/profile');
      if (pres.profile && Object.keys(pres.profile).length) {
        var pstr = JSON.stringify(pres.profile);
        var ph = syncMeta.hashes.profile;
        if (!(ph && ph !== storeHash(localProfileRaw()))) {
          try { localStorage.setItem('ta_profile', pstr); } catch(e) {}
          syncMeta.hashes.profile = storeHash(pstr);
        }
      }
      // 3) 專案
      var prj = (await storeFetch('GET', '/api/projects?limit=2000')).items || [];
      var touchedProjects = false;
      var serverProjectIds = {};
      prj.forEach(function(sp) {
        serverProjectIds[sp.id] = true;
        var local = null, idx = -1;
        for (var i = 0; i < projects.length; i++) if (projects[i] && projects[i].id === sp.id) { local = projects[i]; idx = i; break; }
        var key = 'project:' + sp.id;
        if (local && syncMeta.hashes[key] && syncMeta.hashes[key] !== storeHash(projectForHash(local))) return;
        if (syncMeta.srv[key] === sp.updated_at && local) return;
        var np = projectFromServer(sp);
        if (idx >= 0) projects[idx] = np; else projects.push(np);
        syncMeta.hashes[key] = storeHash(projectForHash(np));
        syncMeta.srv[key] = sp.updated_at;
        touchedProjects = true;
      });
      projects = projects.filter(function(p) {
        if (!p || !p.id || serverProjectIds[p.id]) return true;
        if (syncMeta.hashes['project:' + p.id]) { delete syncMeta.hashes['project:' + p.id]; touchedProjects = true; return false; } // 其他裝置已刪除
        imported++; return true; // 從未上傳 → 保留並推送
      });
      // 4) 文件（知識庫）
      var docs = (await storeFetch('GET', '/api/documents?full=1&limit=2000')).items || [];
      var touchedDocs = false;
      var serverDocIds = {};
      docs.forEach(function(sd) {
        serverDocIds[sd.id] = true;
        var local = null, idx = -1;
        for (var i = 0; i < documents.length; i++) if (documents[i] && documents[i].id === sd.id) { local = documents[i]; idx = i; break; }
        var key = 'doc:' + sd.id;
        if (local && syncMeta.hashes[key] && syncMeta.hashes[key] !== storeHash(docForHash(local))) return;
        if (syncMeta.srv[key] === sd.updated_at && local) return;
        var nd = docFromServer(sd);
        if (idx >= 0) documents[idx] = nd; else documents.push(nd);
        syncMeta.hashes[key] = storeHash(docForHash(nd));
        syncMeta.srv[key] = sd.updated_at;
        touchedDocs = true;
      });
      documents = documents.filter(function(d) {
        if (!d || !d.id || serverDocIds[d.id]) return true;
        if (syncMeta.hashes['doc:' + d.id]) { delete syncMeta.hashes['doc:' + d.id]; touchedDocs = true; return false; }
        imported++; return true;
      });
      // 5) 對話：列表只含標題與時間，有變動的才抓完整內容
      var convs = (await storeFetch('GET', '/api/conversations?limit=1000')).conversations || [];
      var touchedChats = false;
      var serverChatIds = {};
      for (var ci = 0; ci < convs.length; ci++) {
        var sc = convs[ci];
        serverChatIds[sc.id] = true;
        var ckey = 'chat:' + sc.id;
        var lc = chats[sc.id];
        if (lc && syncMeta.hashes[ckey] && syncMeta.hashes[ckey] !== storeHash(chatForHash(lc))) continue;
        if (lc && syncMeta.srv[ckey] === sc.updated_at) continue;
        var full = (await storeFetch('GET', '/api/conversations/' + encodeURIComponent(sc.id))).conversation;
        if (!full) continue;
        var nc = chatFromServer(full);
        chats[sc.id] = nc;
        syncMeta.hashes[ckey] = storeHash(chatForHash(nc));
        syncMeta.srv[ckey] = sc.updated_at;
        touchedChats = true;
      }
      Object.keys(chats).forEach(function(id) {
        var c = chats[id];
        if (!c || c.ephemeral || c.readOnly || serverChatIds[id]) return;
        if (syncMeta.hashes['chat:' + id]) { delete chats[id]; delete syncMeta.hashes['chat:' + id]; touchedChats = true; return; }
        if (c.messages && c.messages.length) imported++;
      });
      if (touchedProjects) { saveProjects(); }
      if (touchedDocs) { saveDocuments(); }
      if (touchedChats) { saveChats(); if (chats[currentChatId]) loadChatView(); }
      if (touchedProjects || touchedDocs || touchedChats) renderSidebar();
      saveSyncMeta();
      setSyncStatus(imported ? ('正在把 ' + imported + ' 項本機資料上傳到伺服器…') : '已與伺服器同步', false);
      return true;
    } catch(e) {
      setSyncStatus('讀取伺服器資料失敗：' + (e && e.message ? e.message : '網路錯誤'), true);
      return false;
    } finally {
      syncMeta.busy = false;
      syncMeta.applying = false;
    }
  }

  async function pushSync() {
    if (!syncMeta.enabled) return false;
    if (syncMeta.busy) { syncMeta.pending = true; return false; }
    syncMeta.busy = true;
    var sent = 0;
    try {
      // 設定
      var snap = settingsSnapshot();
      var patch = {}, any = false;
      Object.keys(snap).forEach(function(sk) {
        if (syncMeta.hashes['setting:' + sk] !== storeHash(snap[sk])) { patch[sk] = snap[sk]; any = true; }
      });
      if (any) {
        await storeFetch('PUT', '/api/settings', { settings: patch });
        Object.keys(patch).forEach(function(sk) { syncMeta.hashes['setting:' + sk] = storeHash(patch[sk]); sent++; });
      }
      // 個人資料
      var praw = localProfileRaw();
      if (praw && syncMeta.hashes.profile !== storeHash(praw)) {
        var pobj = null; try { pobj = JSON.parse(praw); } catch(e) {}
        if (pobj && typeof pobj === 'object') { await storeFetch('PUT', '/api/profile', { profile: pobj }); sent++; }
        syncMeta.hashes.profile = storeHash(praw);
      }
      // 專案（先送，文件與對話會參照）
      var present = {};
      for (var i = 0; i < projects.length; i++) {
        var p = projects[i];
        if (!p || !p.id) continue;
        var key = 'project:' + p.id; present[key] = true;
        var h = storeHash(projectForHash(p));
        if (syncMeta.hashes[key] === h) continue;
        var r = await storeFetch('POST', '/api/projects', projectToServer(p));
        syncMeta.hashes[key] = h; if (r.item) syncMeta.srv[key] = r.item.updated_at; sent++;
      }
      for (var j = 0; j < documents.length; j++) {
        var d = documents[j];
        if (!d || !d.id) continue;
        var dkey = 'doc:' + d.id; present[dkey] = true;
        var dh = storeHash(docForHash(d));
        if (syncMeta.hashes[dkey] === dh) continue;
        var dr = await storeFetch('POST', '/api/documents', docToServer(d));
        syncMeta.hashes[dkey] = dh; if (dr.item) syncMeta.srv[dkey] = dr.item.updated_at; sent++;
      }
      var ids = Object.keys(chats);
      for (var k = 0; k < ids.length; k++) {
        var id = ids[k], c = chats[id];
        if (!c || c.ephemeral || c.readOnly || !c.messages || !c.messages.length) continue;
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) continue;
        var ckey = 'chat:' + id; present[ckey] = true;
        var ch = storeHash(chatForHash(c));
        if (syncMeta.hashes[ckey] === ch) continue;
        var cr = await storeFetch('PUT', '/api/conversations/' + encodeURIComponent(id), chatToServer(id, c));
        syncMeta.hashes[ckey] = ch; if (cr.conversation) syncMeta.srv[ckey] = cr.conversation.updated_at; sent++;
      }
      // 本機刪除 → 伺服器軟刪除
      var kinds = { project: '/api/projects/', doc: '/api/documents/', chat: '/api/conversations/' };
      var hkeys = Object.keys(syncMeta.hashes);
      for (var x = 0; x < hkeys.length; x++) {
        var hk = hkeys[x], type = hk.split(':')[0], hid = hk.slice(type.length + 1);
        if (!kinds[type] || present[hk]) continue;
        if (type === 'chat' && chats[hid]) continue; // 還在但沒有訊息
        await storeFetch('DELETE', kinds[type] + encodeURIComponent(hid));
        delete syncMeta.hashes[hk]; delete syncMeta.srv[hk]; sent++;
      }
      saveSyncMeta();
      setSyncStatus(sent ? ('已儲存到伺服器（' + sent + ' 項）') : '已與伺服器同步', false);
      return true;
    } catch(e) {
      saveSyncMeta();
      setSyncStatus('儲存到伺服器失敗：' + (e && e.message ? e.message : '網路錯誤') + '（資料仍在本機，稍後重試）', true);
      clearTimeout(syncMeta.timer);
      syncMeta.timer = setTimeout(function() { pushSync(); }, 15000);
      return false;
    } finally {
      syncMeta.busy = false;
      if (syncMeta.pending) { syncMeta.pending = false; scheduleSync(); }
    }
  }
  function scheduleSync() {
    if (!syncMeta.enabled || syncMeta.applying) return;
    clearTimeout(syncMeta.timer);
    syncMeta.timer = setTimeout(function() { pushSync(); }, 1500);
  }
  // 舊版瀏覽器內的供應商（含 API Key）→ 伺服器加密保存，成功後從瀏覽器移除 Key。
  async function importLocalProviders() {
    if (syncMeta.providersImported) return 0;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(PROVIDERS_KEY) || '[]'); } catch(e) {}
    if (!Array.isArray(list)) list = [];
    var existing = {};
    SERVER_PROVIDERS.forEach(function(p) { existing[p.id] = true; });
    var n = 0, failed = 0;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || !p.baseUrl) continue;
      var pid = /^[A-Za-z0-9_-]{1,64}$/.test(String(p.id || '')) ? String(p.id) : undefined;
      if (pid && existing[pid]) continue;
      try {
        await storeFetch('POST', '/api/providers', { id: pid, name: p.name || '供應商', base_url: p.baseUrl, api_key: p.apiKey || '', models: p.model ? [p.model] : [] });
        n++;
      } catch(e) { failed++; }
    }
    if (!failed) {
      try { localStorage.removeItem(PROVIDERS_KEY); } catch(e) {}
      syncMeta.providersImported = true;
      saveSyncMeta();
    }
    return n;
  }
  async function syncBootstrap() {
    if (!syncMeta.enabled) { setSyncStatus('此部署未設定伺服器儲存，資料只保存在這個瀏覽器', false); return; }
    setSyncStatus('正在讀取伺服器資料…', false);
    await pullSync();
    try {
      await loadServerProviders();
      if (await importLocalProviders()) await loadServerProviders();
    } catch(e) { setProviderStatus('讀取供應商失敗：' + (e && e.message ? e.message : ''), true); }
    await pushSync();
  }
  function syncNow() {
    if (!syncMeta.enabled) { setSyncStatus('此部署未設定伺服器儲存', true); return; }
    setSyncStatus('同步中…', false);
    pullSync().then(function() { return loadServerProviders(); }).then(function() { return pushSync(); });
  }
