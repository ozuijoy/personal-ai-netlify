# 第五階段前端修改（一次性；保留以便追溯）。在專案根目錄執行：python3 scripts/frontend/apply-phase5.py
f = open('scripts/frontend/phase5.js').read()
p = 'src/web_decoded.html'
s = open(p).read()


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old))
    s = s.replace(old, new)


rep("\n  var TONES = {", "\n" + f + "\n  var TONES = {")

EMBED = """          <div class="settings-card" id="embed-card" style="margin-top:14px">
            <div class="form-label" style="margin-bottom:6px">語意檢索（嵌入模型）</div>
            <p class="settings-hint" style="margin-top:0">選一個提供 <code>/embeddings</code> 的供應商（例如 OpenAI 的 text-embedding-3-small）。知識庫會同時用關鍵字與語意找段落；Groq 沒有嵌入 API。</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <select id="embed-provider" class="form-input" style="flex:1;min-width:140px"></select>
              <input id="embed-model" class="form-input" style="flex:1;min-width:160px" type="text" placeholder="text-embedding-3-small" autocomplete="off">
            </div>
            <div class="settings-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              <button type="button" id="embed-save-btn" class="topbar-action-btn primary">儲存並測試</button>
              <button type="button" id="embed-run-btn" class="topbar-action-btn">補建索引</button>
            </div>
            <p id="embed-status" class="settings-hint" style="min-height:18px"></p>
          </div>
"""
rep("""          <p class="settings-hint">只允許公開 HTTPS 位址。localhost、私有 IP、<code>.local</code>、<code>.internal</code> 會被拒絕。</p>
        </div>""", """          <p class="settings-hint">只允許公開 HTTPS 位址。localhost、私有 IP、<code>.local</code>、<code>.internal</code> 會被拒絕。</p>
""" + EMBED + """        </div>""")

DATA = """          <div class="settings-card" id="backup-card">
            <div class="form-label" style="margin-bottom:6px">伺服器完整備份</div>
            <p class="settings-hint" style="margin-top:0">包含對話、專案、知識庫、技能、記憶、設定與供應商（不含 API Key 與上傳檔案本體）。</p>
            <div class="settings-actions" style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" id="backup-download-btn" class="topbar-action-btn">下載備份</button>
              <button type="button" id="backup-restore-btn" class="topbar-action-btn">從備份還原</button>
              <input type="file" id="backup-restore-input" accept="application/json,.json" style="display:none">
            </div>
            <p id="backup-status" class="settings-hint" style="min-height:18px"></p>
          </div>
          <div class="settings-card" id="keys-card">
            <div class="form-label" style="margin-bottom:6px">API Key 加密金鑰</div>
            <p class="settings-hint" style="margin-top:0">輪替時把新金鑰設為 ENCRYPTION_KEY、舊的設為 ENCRYPTION_KEY_PREVIOUS，部署後在這裡重新加密。</p>
            <div class="settings-actions"><button type="button" id="rekey-btn" class="topbar-action-btn" style="display:none">重新加密</button></div>
            <p id="keys-status" class="settings-hint" style="min-height:18px"></p>
          </div>
"""
rep("""          <div class="settings-card">
            <div class="settings-actions" style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" id="sync-now-btn" class="topbar-action-btn">與伺服器同步</button>""", DATA + """          <div class="settings-card">
            <div class="settings-actions" style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" id="sync-now-btn" class="topbar-action-btn">與伺服器同步</button>""")

rep("""    if (id === 'pane-memory') loadMemories();""", """    if (id === 'pane-memory') loadMemories();
    if (id === 'pane-providers') loadEmbeddingPane();
    if (id === 'pane-data') { loadKeyStatus(); var bc = document.getElementById('backup-card'); if (bc) bc.style.display = serverMode() ? '' : 'none'; }""")

rep("""    (function bindSkillsMemory() {""", """    (function bindPhase5() {
      var byId = function(id) { return document.getElementById(id); };
      if (byId('embed-save-btn')) byId('embed-save-btn').addEventListener('click', saveEmbeddingConfig);
      if (byId('embed-run-btn')) byId('embed-run-btn').addEventListener('click', function() { runEmbeddingBackfill(false); });
      if (byId('rekey-btn')) byId('rekey-btn').addEventListener('click', rekeyNow);
      if (byId('backup-download-btn')) byId('backup-download-btn').addEventListener('click', downloadServerBackup);
      if (byId('backup-restore-btn')) byId('backup-restore-btn').addEventListener('click', function() { byId('backup-restore-input').click(); });
      if (byId('backup-restore-input')) byId('backup-restore-input').addEventListener('change', function() { var f = this.files && this.files[0]; this.value = ''; restoreServerBackup(f); });
    })();
    (function bindSkillsMemory() {""")

# 新文件寫入後補向量（啟動時、上傳完成後）
rep("""    loadSkills();""", """    loadSkills();
    maybeBackfillEmbeddings();""")
rep("""    return { file: done.file, documentId: done.document_id, truncated: !!done.truncated, extract: ex.extract };""",
    """    setTimeout(maybeBackfillEmbeddings, 0);
    return { file: done.file, documentId: done.document_id, truncated: !!done.truncated, extract: ex.extract };""")

open(p, 'w').write(s)
print('applied')
