# 第四階段前端修改（一次性；保留以便追溯）。在專案根目錄執行：python3 scripts/frontend/apply-phase4.py
f = open('scripts/frontend/skills-memory.js').read()
p = 'src/web_decoded.html'
s = open(p).read()


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old))
    s = s.replace(old, new)


rep("\n  var TONES = {", "\n" + f + "\n  var TONES = {")

# 設定導覽
rep("""        <button type="button" class="settings-nav-btn" data-pane="pane-customize" data-i18n="tabCustomize">個人化</button>""",
    """        <button type="button" class="settings-nav-btn" data-pane="pane-customize" data-i18n="tabCustomize">個人化</button>
        <button type="button" class="settings-nav-btn" data-pane="pane-skills">技能</button>
        <button type="button" class="settings-nav-btn" data-pane="pane-memory">記憶</button>""")

PANES = """        <div id="pane-skills" class="settings-pane">
          <div class="settings-section-title">技能</div>
          <p class="settings-section-desc">技能是一段固定指示，由伺服器在對話時加入。可設定每次都用、訊息含關鍵字時用，或在輸入框旁手動選用。</p>
          <p class="settings-hint" id="skills-offline" style="display:none">技能需要伺服器資料庫（DATABASE_URL）。</p>
          <div id="skills-online">
            <label class="toggle-row"><span>在對話中使用技能</span><input type="checkbox" id="set-use-skills" checked></label>
            <div id="skills-list" style="margin:10px 0"></div>
            <div class="settings-card">
              <div class="form-label" id="skill-f-title" style="margin-bottom:8px">新增技能</div>
              <div class="form-group"><label class="form-label" for="skill-f-name">名稱</label><input id="skill-f-name" class="form-input" type="text" maxlength="200" placeholder="例：翻譯助手"></div>
              <div class="form-group"><label class="form-label" for="skill-f-desc">說明（選填）</label><input id="skill-f-desc" class="form-input" type="text" maxlength="2000" placeholder="一句話說明用途"></div>
              <div class="form-group"><label class="form-label" for="skill-f-instr">指示</label><textarea id="skill-f-instr" class="form-textarea" rows="5" maxlength="50000" placeholder="例：翻成英文，保留原文段落，專有名詞附原文。"></textarea></div>
              <div class="form-group"><label class="form-label" for="skill-f-trigger">何時使用</label>
                <select id="skill-f-trigger" class="form-input"><option value="manual">手動選用</option><option value="keyword">訊息含關鍵字時</option><option value="always">每次對話</option></select></div>
              <div class="form-group" id="skill-f-keywords-row" style="display:none"><label class="form-label" for="skill-f-keywords">關鍵字（逗號分隔）</label><input id="skill-f-keywords" class="form-input" type="text" placeholder="翻譯, translate"></div>
              <div style="display:flex;gap:6px;justify-content:flex-end">
                <button type="button" id="skill-f-cancel" class="topbar-action-btn">清除</button>
                <button type="button" id="skill-f-save" class="topbar-action-btn primary">儲存技能</button>
              </div>
            </div>
            <p class="settings-hint" id="skills-status" style="min-height:18px"></p>
          </div>
        </div>
        <div id="pane-memory" class="settings-pane">
          <div class="settings-section-title">記憶</div>
          <p class="settings-section-desc">記憶是關於你的事實與偏好，伺服器會挑相關的加入對話。只有你按「記住」或自己新增的內容才會保存。</p>
          <p class="settings-hint" id="memory-offline" style="display:none">記憶需要伺服器資料庫（DATABASE_URL）。</p>
          <div id="memory-online">
            <label class="toggle-row"><span>在對話中使用記憶</span><input type="checkbox" id="set-use-memory" checked></label>
            <label class="toggle-row"><span>回覆後建議可記住的事（會多呼叫一次模型）</span><input type="checkbox" id="set-mem-suggest" checked></label>
            <div class="settings-card" style="margin-top:10px">
              <div class="form-group"><label class="form-label" for="mem-f-content">新增記憶</label><textarea id="mem-f-content" class="form-textarea" rows="2" maxlength="4000" placeholder="例：使用者偏好條列式回答"></textarea></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <select id="mem-f-kind" class="form-input" style="flex:1;min-width:110px"><option value="fact">事實</option><option value="preference">偏好</option><option value="instruction">指示</option><option value="note">備註</option></select>
                <select id="mem-f-scope" class="form-input" style="flex:2;min-width:150px"></select>
                <button type="button" id="mem-f-save" class="topbar-action-btn primary">記住</button>
              </div>
            </div>
            <div class="form-label" style="margin:12px 0 8px">已保存（<span id="memory-count">0</span>）</div>
            <div id="memory-list"></div>
            <p class="settings-hint" id="memory-status" style="min-height:18px"></p>
          </div>
        </div>
"""
rep("""        <div id="pane-data" class="settings-pane">""", PANES + """        <div id="pane-data" class="settings-pane">""")

# 輸入框旁的技能選單
rep("""            <button id="image-gen-pill" class="dock-pill" type="button" data-i18n="image">Imagen</button>""",
    """            <button id="image-gen-pill" class="dock-pill" type="button" data-i18n="image">Imagen</button>
            <select id="skill-pill" class="dock-pill skill-pill" aria-label="技能" hidden></select>""")

rep("""    .model-group-empty { padding: 4px 10px 8px; }""", """    .model-group-empty { padding: 4px 10px 8px; }
    .sm-row { display: flex; align-items: center; gap: 8px; background: var(--elev); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; }
    .sm-row.sm-off { opacity: 0.55; }
    .sm-main { flex: 1; min-width: 0; }
    .sm-title { font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sm-title.sm-wrap { white-space: normal; word-break: break-word; }
    .sm-meta { font-size: 0.7rem; color: var(--dim); margin-top: 2px; }
    .sm-row .mini-x { opacity: 1; }
    .sm-pin { background: none; border: none; cursor: pointer; color: var(--dim); font-size: 0.95rem; padding: 0 2px; }
    .sm-pin.on { color: var(--accent, #f5b301); }
    .skill-pill { appearance: none; -webkit-appearance: none; max-width: 160px; cursor: pointer; }
    .skill-pill.active { border-color: var(--accent, currentColor); }
    .mem-suggest { margin-top: 10px; border: 1px dashed var(--line); border-radius: 10px; padding: 8px 10px; }
    .mem-suggest-title { font-size: 0.75rem; color: var(--dim); margin-bottom: 6px; }
    .mem-suggest-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .mem-suggest-text { flex: 1; font-size: 0.8rem; }
    .applied-skills { opacity: 0.75; }""")

# 設定同步鍵
rep("""    ta_confirm_del: 'ui.confirm_del', ta_auto_read: 'ui.auto_read'
  };""", """    ta_confirm_del: 'ui.confirm_del', ta_auto_read: 'ui.auto_read',
    ta_use_skills: 'use_skills', ta_use_memory: 'use_memory', ta_mem_suggest: 'memory_suggest'
  };""")

# 聊天 payload
rep("""      if (useServerProvider) payload.provider_id = selectedProviderId;
      else if (provider)""", """      serverContextPayload(payload);
      if (useServerProvider) payload.provider_id = selectedProviderId;
      else if (provider)""")
rep("""      chats[currentChatId].messages.push({ role: 'ai', content: fullText, sources: sources, at: Date.now() });
      saveChats();
      if (window.TAP && fullText && promptText)""", """      chats[currentChatId].messages.push({ role: 'ai', content: fullText, sources: sources, at: Date.now() });
      saveChats();
      showAppliedContext(contentCol, response);
      if (fullText) suggestMemories(contentCol, chats[currentChatId].messages.slice(), useServerProvider ? selectedProviderId : '', resolvedModel);
      if (window.TAP && fullText && promptText)""")

# 切換設定分頁時載入
rep("""  function showSettingsPane(id) {
    document.querySelectorAll('.settings-pane').forEach(function(p) { p.classList.toggle('active', p.id === id); });""",
    """  function showSettingsPane(id) {
    if (id === 'pane-skills') loadSkills();
    if (id === 'pane-memory') loadMemories();
    document.querySelectorAll('.settings-pane').forEach(function(p) { p.classList.toggle('active', p.id === id); });""")

# 事件綁定
rep("""    if (addCustomConnBtn) addCustomConnBtn.addEventListener('click', addCustomConnector);""",
    """    if (addCustomConnBtn) addCustomConnBtn.addEventListener('click', addCustomConnector);
    (function bindSkillsMemory() {
      var byId = function(id) { return document.getElementById(id); };
      if (byId('skill-f-save')) byId('skill-f-save').addEventListener('click', saveSkillForm);
      if (byId('skill-f-cancel')) byId('skill-f-cancel').addEventListener('click', function() { fillSkillForm(null); smSetStatus('skills-status', ''); });
      if (byId('skill-f-trigger')) byId('skill-f-trigger').addEventListener('change', syncSkillKeywordField);
      if (byId('set-use-skills')) byId('set-use-skills').addEventListener('change', function() { setPref('ta_use_skills', this.checked); renderSkillPill(); });
      if (byId('set-use-memory')) byId('set-use-memory').addEventListener('change', function() { setPref('ta_use_memory', this.checked); renderMemoryPane(); });
      if (byId('set-mem-suggest')) byId('set-mem-suggest').addEventListener('change', function() { setPref('ta_mem_suggest', this.checked); });
      if (byId('mem-f-save')) byId('mem-f-save').addEventListener('click', saveMemoryForm);
      if (byId('skill-pill')) byId('skill-pill').addEventListener('change', function() {
        if (this.value) localStorage.setItem('ta_active_skill', this.value); else localStorage.removeItem('ta_active_skill');
        this.classList.toggle('active', !!this.value);
      });
      var sl = byId('skills-list');
      if (sl) {
        sl.addEventListener('click', function(e) {
          var ed = e.target.closest('[data-skill-edit]'); if (ed) { fillSkillForm(skillsCache.filter(function(x) { return x.id === ed.getAttribute('data-skill-edit'); })[0]); return; }
          var dl = e.target.closest('[data-skill-del]'); if (dl) { deleteSkill(dl.getAttribute('data-skill-del')); }
        });
        sl.addEventListener('change', function(e) {
          var tg = e.target.closest('[data-skill-toggle]'); if (tg) toggleSkill(tg.getAttribute('data-skill-toggle'), tg.checked);
        });
      }
      var ml = byId('memory-list');
      if (ml) ml.addEventListener('click', function(e) {
        var pn = e.target.closest('[data-mem-pin]'); if (pn) { pinMemory(pn.getAttribute('data-mem-pin')); return; }
        var ed = e.target.closest('[data-mem-edit]'); if (ed) { editMemory(ed.getAttribute('data-mem-edit')); return; }
        var dl = e.target.closest('[data-mem-del]'); if (dl) deleteMemory(dl.getAttribute('data-mem-del'));
      });
    })();""")

# 啟動後載入技能（輸入框選單）
rep("""    await pushSync();
    if (serverFilesEnabled) refreshServerFiles();""", """    await pushSync();
    if (serverFilesEnabled) refreshServerFiles();
    loadSkills();""")

open(p, 'w').write(s)
print('applied')
