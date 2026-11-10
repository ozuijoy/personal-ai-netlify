  // ── 技能與 Memory（第四階段）─────────────────────────────────
  // 技能、Memory 只存在伺服器（不進 localStorage），由伺服器在聊天時注入。
  // Memory 建議：回覆後請模型找出值得記住的事，**使用者按「記住」才寫入**。
  var skillsCache = [];
  var memoriesCache = [];
  var editingSkillId = null;
  var MEM_KIND_LABEL = { fact: '事實', preference: '偏好', instruction: '指示', note: '備註' };
  var SKILL_TRIGGER_LABEL = { always: '每次對話', keyword: '關鍵字', manual: '手動選用' };
  function prefOn(key) { return localStorage.getItem(key) !== '0'; }
  function setPref(key, on) {
    try { localStorage.setItem(key, on ? '1' : '0'); } catch(e) {}
    if (typeof scheduleSync === 'function') scheduleSync();
  }
  function activeSkillId() { return localStorage.getItem('ta_active_skill') || ''; }
  function projectName(id) {
    var p = (projects || []).filter(function(x) { return x.id === id; })[0];
    return p ? p.name : '';
  }
  function smSetStatus(id, text, bad) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--muted)';
  }

  // ---- 技能 ----
  async function loadSkills() {
    if (!serverMode()) { renderSkillsPane(); return; }
    try { skillsCache = (await storeFetch('GET', '/api/skills?limit=500')).items || []; }
    catch(e) { smSetStatus('skills-status', '讀取技能失敗：' + (e.message || ''), true); }
    renderSkillsPane();
    renderSkillPill();
  }
  function renderSkillsPane() {
    var off = document.getElementById('skills-offline');
    var on = document.getElementById('skills-online');
    if (off) off.style.display = serverMode() ? 'none' : '';
    if (on) on.style.display = serverMode() ? '' : 'none';
    var useEl = document.getElementById('set-use-skills');
    if (useEl) useEl.checked = prefOn('ta_use_skills');
    var box = document.getElementById('skills-list');
    if (!box) return;
    if (!skillsCache.length) { box.innerHTML = '<div class="empty-side">還沒有技能。技能是一段固定指示，例如「翻譯時附上原文」。</div>'; return; }
    box.innerHTML = skillsCache.map(function(s) {
      var trig = SKILL_TRIGGER_LABEL[s.trigger_mode] || s.trigger_mode;
      if (s.trigger_mode === 'keyword' && s.keywords && s.keywords.length) trig += '：' + s.keywords.join('、');
      return '<div class="sm-row' + (s.enabled ? '' : ' sm-off') + '">' +
        '<label class="sm-check" title="啟用"><input type="checkbox" data-skill-toggle="' + escapeHtml(s.id) + '"' + (s.enabled ? ' checked' : '') + '></label>' +
        '<div class="sm-main"><div class="sm-title">' + escapeHtml(s.name) + '</div><div class="sm-meta">' + escapeHtml(trig) + (s.description ? ' · ' + escapeHtml(s.description) : '') + '</div></div>' +
        '<button type="button" class="topbar-action-btn" data-skill-edit="' + escapeHtml(s.id) + '">編輯</button>' +
        '<button type="button" class="mini-x" data-skill-del="' + escapeHtml(s.id) + '" title="刪除">✕</button></div>';
    }).join('');
  }
  function fillSkillForm(s) {
    editingSkillId = s ? s.id : null;
    document.getElementById('skill-f-name').value = s ? s.name : '';
    document.getElementById('skill-f-desc').value = s ? (s.description || '') : '';
    document.getElementById('skill-f-instr').value = s ? (s.instructions || '') : '';
    document.getElementById('skill-f-trigger').value = s ? s.trigger_mode : 'manual';
    document.getElementById('skill-f-keywords').value = s && s.keywords ? s.keywords.join(', ') : '';
    document.getElementById('skill-f-title').textContent = s ? '編輯技能' : '新增技能';
    syncSkillKeywordField();
  }
  function syncSkillKeywordField() {
    var row = document.getElementById('skill-f-keywords-row');
    var trig = document.getElementById('skill-f-trigger');
    if (row && trig) row.style.display = trig.value === 'keyword' ? '' : 'none';
  }
  async function saveSkillForm() {
    var name = document.getElementById('skill-f-name').value.trim();
    var instr = document.getElementById('skill-f-instr').value.trim();
    var trig = document.getElementById('skill-f-trigger').value;
    var keywords = document.getElementById('skill-f-keywords').value.split(/[,，、\n]/).map(function(x) { return x.trim(); }).filter(Boolean);
    if (!name) return smSetStatus('skills-status', '請輸入技能名稱', true);
    if (!instr) return smSetStatus('skills-status', '請輸入技能指示', true);
    if (trig === 'keyword' && !keywords.length) return smSetStatus('skills-status', '關鍵字觸發需要至少一個關鍵字', true);
    var body = { name: name, description: document.getElementById('skill-f-desc').value.trim(), instructions: instr, trigger_mode: trig, keywords: keywords };
    try {
      if (editingSkillId) await storeFetch('PATCH', '/api/skills/' + encodeURIComponent(editingSkillId), body);
      else { body.enabled = true; await storeFetch('POST', '/api/skills', body); }
      fillSkillForm(null);
      smSetStatus('skills-status', '已儲存', false);
      await loadSkills();
    } catch(e) { smSetStatus('skills-status', '儲存失敗：' + (e.message || ''), true); }
  }
  async function toggleSkill(id, on) {
    try { await storeFetch('PATCH', '/api/skills/' + encodeURIComponent(id), { enabled: on }); await loadSkills(); }
    catch(e) { smSetStatus('skills-status', '更新失敗：' + (e.message || ''), true); }
  }
  async function deleteSkill(id) {
    var s = skillsCache.filter(function(x) { return x.id === id; })[0];
    if (!confirm('刪除技能「' + (s ? s.name : '') + '」？')) return;
    try {
      await storeFetch('DELETE', '/api/skills/' + encodeURIComponent(id));
      if (activeSkillId() === id) localStorage.removeItem('ta_active_skill');
      if (editingSkillId === id) fillSkillForm(null);
      await loadSkills();
    } catch(e) { smSetStatus('skills-status', '刪除失敗：' + (e.message || ''), true); }
  }
  // 輸入框旁的技能選單：列出手動與關鍵字技能，選了就在之後的訊息都套用，直到改回「無」
  function renderSkillPill() {
    var sel = document.getElementById('skill-pill');
    if (!sel) return;
    var usable = skillsCache.filter(function(s) { return s.enabled && s.trigger_mode !== 'always'; });
    if (!serverMode() || !prefOn('ta_use_skills') || !usable.length) { sel.hidden = true; return; }
    var cur = activeSkillId();
    if (cur && !usable.some(function(s) { return s.id === cur; })) { cur = ''; localStorage.removeItem('ta_active_skill'); }
    sel.innerHTML = '<option value="">技能：無</option>' + usable.map(function(s) {
      return '<option value="' + escapeHtml(s.id) + '"' + (s.id === cur ? ' selected' : '') + '>技能：' + escapeHtml(s.name) + '</option>';
    }).join('');
    sel.hidden = false;
    sel.classList.toggle('active', !!cur);
  }

  // ---- Memory ----
  async function loadMemories() {
    if (!serverMode()) { renderMemoryPane(); return; }
    try { memoriesCache = (await storeFetch('GET', '/api/memories?limit=1000')).items || []; }
    catch(e) { smSetStatus('memory-status', '讀取記憶失敗：' + (e.message || ''), true); }
    renderMemoryPane();
  }
  function renderMemoryPane() {
    var off = document.getElementById('memory-offline');
    var on = document.getElementById('memory-online');
    if (off) off.style.display = serverMode() ? 'none' : '';
    if (on) on.style.display = serverMode() ? '' : 'none';
    var useEl = document.getElementById('set-use-memory');
    var sugEl = document.getElementById('set-mem-suggest');
    if (useEl) useEl.checked = prefOn('ta_use_memory');
    if (sugEl) { sugEl.checked = prefOn('ta_mem_suggest'); sugEl.disabled = !prefOn('ta_use_memory'); }
    var scope = document.getElementById('mem-f-scope');
    if (scope) {
      var pn = currentProjectId ? projectName(currentProjectId) : '';
      scope.innerHTML = '<option value="">全部對話</option>' + (pn ? '<option value="' + escapeHtml(currentProjectId) + '">只在專案「' + escapeHtml(pn) + '」</option>' : '');
    }
    var count = document.getElementById('memory-count');
    if (count) count.textContent = memoriesCache.length;
    var box = document.getElementById('memory-list');
    if (!box) return;
    if (!memoriesCache.length) { box.innerHTML = '<div class="empty-side">還沒有記憶。聊天時若出現值得記住的事，會先詢問你。</div>'; return; }
    box.innerHTML = memoriesCache.map(function(m) {
      var meta = (MEM_KIND_LABEL[m.kind] || m.kind) + (m.project_id ? ' · 專案：' + escapeHtml(projectName(m.project_id) || '（已刪除）') : '');
      return '<div class="sm-row">' +
        '<button type="button" class="sm-pin' + (m.pinned ? ' on' : '') + '" data-mem-pin="' + escapeHtml(m.id) + '" title="' + (m.pinned ? '取消釘選' : '釘選（每次都帶入）') + '">★</button>' +
        '<div class="sm-main"><div class="sm-title sm-wrap">' + escapeHtml(m.content) + '</div><div class="sm-meta">' + meta + '</div></div>' +
        '<button type="button" class="topbar-action-btn" data-mem-edit="' + escapeHtml(m.id) + '">編輯</button>' +
        '<button type="button" class="mini-x" data-mem-del="' + escapeHtml(m.id) + '" title="刪除">✕</button></div>';
    }).join('');
  }
  async function addMemory(content, kind, projectId) {
    content = String(content || '').trim();
    if (!content) throw new Error('請輸入內容');
    var r = await storeFetch('POST', '/api/memories', { content: content.slice(0, 4000), kind: kind || 'fact', project_id: projectId || null });
    memoriesCache.unshift(r.item);
    return r.item;
  }
  async function saveMemoryForm() {
    var el = document.getElementById('mem-f-content');
    try {
      await addMemory(el.value, document.getElementById('mem-f-kind').value, document.getElementById('mem-f-scope').value);
      el.value = '';
      smSetStatus('memory-status', '已記住', false);
      await loadMemories();
    } catch(e) { smSetStatus('memory-status', e.message || '儲存失敗', true); }
  }
  async function editMemory(id) {
    var m = memoriesCache.filter(function(x) { return x.id === id; })[0];
    if (!m) return;
    var next = prompt('編輯記憶', m.content);
    if (next == null) return;
    next = next.trim();
    if (!next) return deleteMemory(id, true);
    try { await storeFetch('PATCH', '/api/memories/' + encodeURIComponent(id), { content: next }); await loadMemories(); }
    catch(e) { smSetStatus('memory-status', '更新失敗：' + (e.message || ''), true); }
  }
  async function pinMemory(id) {
    var m = memoriesCache.filter(function(x) { return x.id === id; })[0];
    if (!m) return;
    try { await storeFetch('PATCH', '/api/memories/' + encodeURIComponent(id), { pinned: !m.pinned }); await loadMemories(); }
    catch(e) { smSetStatus('memory-status', '更新失敗：' + (e.message || ''), true); }
  }
  async function deleteMemory(id, skipConfirm) {
    if (!skipConfirm && !confirm('刪除這條記憶？')) return;
    try { await storeFetch('DELETE', '/api/memories/' + encodeURIComponent(id)); await loadMemories(); }
    catch(e) { smSetStatus('memory-status', '刪除失敗：' + (e.message || ''), true); }
  }

  // ---- 聊天整合 ----
  function serverContextPayload(payload) {
    if (!serverMode()) return payload;
    payload.project_id = currentProjectId || null;
    payload.use_skills = prefOn('ta_use_skills');
    payload.use_memory = prefOn('ta_use_memory');
    var sk = activeSkillId();
    if (sk && payload.use_skills) payload.skill_ids = [sk];
    return payload;
  }
  function showAppliedContext(contentCol, response) {
    if (!contentCol || !response || !serverMode()) return;
    var names = [];
    try { names = JSON.parse(decodeURIComponent(response.headers.get('x-skills') || '%5B%5D')) || []; } catch(e) {}
    if (!names.length) return;
    var note = document.createElement('div');
    note.className = 'msg-time applied-skills';
    note.textContent = '已套用技能：' + names.join('、');
    contentCol.appendChild(note);
  }
  // 只在使用者訊息看起來在談自己時才問模型，避免每則回覆都多花一次呼叫
  var MEM_HINT = /我|俺|本人|記住|記得|以後|往後|偏好|喜歡|討厭|習慣|\bI\b|\bI'm\b|\bmy\b|\bme\b|remember|prefer/i;
  function shouldSuggestMemory(userText) {
    return serverMode() && prefOn('ta_use_memory') && prefOn('ta_mem_suggest') && String(userText || '').trim().length >= 6 && MEM_HINT.test(userText);
  }
  async function suggestMemories(contentCol, chatMessages, providerId, model) {
    var last = chatMessages[chatMessages.length - 2];
    if (!contentCol || !last || !shouldSuggestMemory(last.content)) return;
    var data;
    try {
      data = await storeFetch('POST', '/api/memories/suggest', {
        provider_id: providerId || undefined, model: model,
        messages: chatMessages.slice(-4).map(function(m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 2000) }; })
      });
    } catch(e) { return; }
    var list = (data && data.suggestions) || [];
    if (!list.length) return;
    var box = document.createElement('div');
    box.className = 'mem-suggest';
    box.innerHTML = '<div class="mem-suggest-title">要記住這些嗎？</div>' + list.map(function(s, i) {
      return '<div class="mem-suggest-row" data-i="' + i + '"><span class="mem-suggest-text">' + escapeHtml(s.content) + '</span>' +
        '<button type="button" class="topbar-action-btn primary" data-mem-accept="' + i + '">記住</button>' +
        '<button type="button" class="topbar-action-btn" data-mem-skip="' + i + '">略過</button></div>';
    }).join('');
    box.addEventListener('click', async function(e) {
      var acc = e.target.closest('[data-mem-accept]');
      var skip = e.target.closest('[data-mem-skip]');
      var btn = acc || skip;
      if (!btn) return;
      var row = btn.closest('.mem-suggest-row');
      var s = list[Number(btn.getAttribute(acc ? 'data-mem-accept' : 'data-mem-skip'))];
      if (acc) {
        btn.disabled = true;
        try { await addMemory(s.content, s.kind, null); row.innerHTML = '<span class="mem-suggest-text">已記住：' + escapeHtml(s.content) + '</span>'; }
        catch(err) { btn.disabled = false; row.title = err.message || ''; return; }
      } else {
        row.remove();
      }
      if (!box.querySelector('[data-mem-accept]')) setTimeout(function() { if (box.querySelectorAll('.mem-suggest-row').length === 0) box.remove(); }, 0);
    });
    contentCol.appendChild(box);
  }
  window.TA_SM = { loadSkills: loadSkills, loadMemories: loadMemories };
