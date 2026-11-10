# 第三階段前端修改（一次性；保留以便追溯）。在專案根目錄執行：python3 scripts/frontend/apply-phase3.py
f = open('scripts/frontend/files.js').read()
p = 'src/web_decoded.html'
s = open(p).read()


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:90], s.count(old))
    s = s.replace(old, new)


rep("\n  var TONES = {", "\n" + f + "\n  var TONES = {")
rep("""  function docForHash(d) { return { t: d.title || '', c: d.content || '', ty: d.type || 'note', p: d.projectId || null }; }""",
    """  function docForHash(d) { return { t: d.title || '', c: d.content || '', ty: d.type || 'note', p: d.projectId || null, f: d.fileId || null }; }""")
rep("""    return { id: sd.id, title: sd.title || '', content: sd.content || '', type: data.legacy_type || sd.doc_type || 'note',
      projectId: sd.project_id || null,""", """    var out = { id: sd.id, title: sd.title || '', content: sd.content || '', type: data.legacy_type || sd.doc_type || 'note',
      projectId: sd.project_id || null,""")
rep("""      updatedAt: Date.parse(sd.updated_at) || Date.now() };
  }
  function projectForHash""", """      updatedAt: Date.parse(sd.updated_at) || Date.now() };
    if (sd.file_id) { out.fileId = sd.file_id; out.fullLength = Number(sd.length) || 0; if (data.file) out.file = data.file; }
    return out;
  }
  function projectForHash""")
rep("""      var docs = (await storeFetch('GET', '/api/documents?full=1&limit=2000')).items || [];""",
    """      var docs = (await storeFetch('GET', '/api/documents?full=compact&limit=2000')).items || [];""")
rep("""        var dkey = 'doc:' + d.id; present[dkey] = true;
        var dh = storeHash(docForHash(d));""", """        var dkey = 'doc:' + d.id; present[dkey] = true;
        if (d.fileId) continue; // 檔案抽出的文件由伺服器管理，本機只有前 3000 字，不回寫
        var dh = storeHash(docForHash(d));""")
rep("""      content: String(doc.content || '').slice(0, 20000),""", """      content: String(doc.content || '').slice(0, serverMode() ? 200000 : 20000),""")
rep("""while (documents.length > 40) {""", """while (!serverMode() && documents.length > 40) {""", 2)
rep("""  async function handleImportKnowledge(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    for""", """  async function handleImportKnowledge(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    if (serverFilesEnabled) {
      var picked = Array.prototype.slice.call(files);
      e.target.value = '';
      await uploadFilesToServer(picked);
      return;
    }
    for""")
rep("""        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:0.75rem">' + escapeHtml(item.title) + '</div>' +""",
    """        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:0.75rem">' + (item.fileId ? '<span class="doc-file-tag">檔案</span>' : '') + escapeHtml(item.title) + '</div>' +""")
rep("""  function deleteKnowledgeById(id) {
    documents = documents.filter""", """  function deleteKnowledgeById(id) {
    var target = documents.filter(function(d) { return d.id === id; })[0];
    if (target && target.fileId && serverFilesEnabled) { deleteServerFile(target.fileId); return; }
    documents = documents.filter""")
rep("""        if (e.target.getAttribute('data-del-doc')) {
          documents = documents.filter(function(x) { return x.id !== d.id; });""", """        if (e.target.getAttribute('data-del-doc')) {
          if (d.fileId && serverFilesEnabled) { deleteServerFile(d.fileId); return; }
          documents = documents.filter(function(x) { return x.id !== d.id; });""")
rep("""    if (!documents.length) { box.innerHTML = '<div class="empty-side">Sin documentos.</div>'; return; }""",
    """    renderServerFiles();
    if (!documents.length) { box.innerHTML = '<div class="empty-side">Sin documentos.</div>'; return; }""")
rep("""      accept: '.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.css,.js,.mjs,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.sh,.xml,.yaml,.yml,.toml,.ini,.sql,.log,text/*' });
    picker.addEventListener('change', function() {
      var fs = Array.prototype.slice.call(picker.files || []);
      var msgs = [];""", """      accept: (serverFilesEnabled ? '.pdf,.docx,' : '') + '.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.css,.js,.mjs,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.sh,.xml,.yaml,.yml,.toml,.ini,.sql,.log,text/*' });
    picker.addEventListener('change', function() {
      var fs = Array.prototype.slice.call(picker.files || []);
      var msgs = [];
      if (serverFilesEnabled) {
        // 伺服器模式：先暫存 File，按「儲存」後直傳物件儲存並抽文字
        fs.forEach(function(f) {
          if (f.size > serverMaxUploadMb * 1048576) { msgs.push(f.name + ' 超過 ' + serverMaxUploadMb + ' MB'); return; }
          added.push({ title: f.name.slice(0, 120), size: f.size, file: f });
        });
        picker.value = ''; err.textContent = msgs.join(' · '); paintFiles();
        return;
      }""")
rep("""      if (!editing) projects.unshift(obj);
      documents = documents.filter(function(x) { return !removed[x.id]; });
      added.forEach(function(f, i) {""", """      if (!editing) projects.unshift(obj);
      var rawFiles = added.filter(function(a) { return a.file; }).map(function(a) { return a.file; });
      added = added.filter(function(a) { return !a.file; });
      documents.forEach(function(x) { if (removed[x.id] && x.fileId && serverFilesEnabled) deleteServerFile(x.fileId, true); });
      documents = documents.filter(function(x) { return !removed[x.id] || (x.fileId && serverFilesEnabled); });
      added.forEach(function(f, i) {""")
rep("""      saveProjects(); saveDocuments();
      d.close('ok');""", """      saveProjects(); saveDocuments();
      if (rawFiles.length) {
        // 專案要先存在伺服器（檔案的 project_id 才有效），再上傳
        projAnnounce('上傳 ' + rawFiles.length + ' 個檔案中…');
        pushSync().then(function() {
          return uploadFilesToServer(rawFiles, obj.id, function(msg) { projAnnounce(msg); });
        });
      }
      d.close('ok');""")
rep("""<input type="file" id="import-rag-file" style="display:none" multiple accept=".txt,.md,.json">""",
    """<input type="file" id="import-rag-file" style="display:none" multiple accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.tsv,.log,.html,.htm,.xml,.yaml,.yml,.js,.ts,.py,.css,.sql,.srt">""")
rep("""        <div id="knowledge-list-box"></div>
      </div>""", """        <div id="knowledge-list-box"></div>
      </div>
      <div id="server-files-wrap" style="display:none">
        <div style="display:flex;justify-content:space-between;margin:12px 0 8px">
          <span class="form-label" id="server-files-title">已上傳檔案</span>
        </div>
        <div id="server-files-box"></div>
        <p class="settings-hint" id="files-status" style="min-height:18px"></p>
        <p class="settings-hint">PDF、DOCX、純文字會在瀏覽器抽出文字後加入知識庫；掃描型 PDF 沒有文字層，只保存檔案。</p>
      </div>""")
rep("""    .model-group-empty { padding: 4px 10px 8px; }""", """    .model-group-empty { padding: 4px 10px 8px; }
    .server-file-row { background: var(--elev); border: 1px solid var(--line); padding: 6px 8px; border-radius: 8px; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .server-file-main { flex: 1; min-width: 0; }
    .server-file-name { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .server-file-meta { font-size: 0.68rem; color: var(--dim); }
    .server-file-row .mini-x { opacity: 1; }
    .doc-file-tag { font-size: 0.62rem; border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; margin-right: 6px; color: var(--dim); }""")
rep("""            syncMeta.enabled = !!(d.config && d.config.storage);""", """            syncMeta.enabled = !!(d.config && d.config.storage);
            serverFilesEnabled = !!(d.config && d.config.files);
            serverMaxUploadMb = (d.config && d.config.max_upload_mb) || 25;""")
rep("""      if (delRag) { var id = delRag.getAttribute('data-del-doc'); if (id) deleteKnowledgeById(id); return; }""",
    """      if (delRag) { var id = delRag.getAttribute('data-del-doc'); if (id) deleteKnowledgeById(id); return; }
      var fileDl = e.target.closest('[data-file-dl]');
      if (fileDl) { downloadServerFile(fileDl.getAttribute('data-file-dl')); return; }
      var fileDel = e.target.closest('[data-file-del]');
      if (fileDel) { deleteServerFile(fileDel.getAttribute('data-file-del')); return; }""")
rep("""    await pushSync();
  }
  function syncNow() {""", """    await pushSync();
    if (serverFilesEnabled) refreshServerFiles();
  }
  function syncNow() {""")
open(p, 'w').write(s)
print('applied')
