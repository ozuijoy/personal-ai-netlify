  // ── 檔案上傳（第三階段）──────────────────────────────────────
  // 1) POST /api/files 取得 presigned PUT → 2) 瀏覽器直傳物件儲存（不經 Netlify Function）
  // 3) 瀏覽器抽文字（PDF: pdf.js、DOCX: mammoth、文字檔直接讀）→ 4) POST /api/files/:id/complete 寫入知識庫
  var PDFJS_BASE = window.__TA_PDFJS_BASE || '/assets/vendor/pdfjs-4.10.38/'; // __TA_PDFJS_* 只給測試用
  var MAMMOTH_SRC = '/assets/vendor/mammoth-1.8.0.min.js';
  var MAX_EXTRACT_CHARS = 900000;
  var serverFilesEnabled = false;
  var serverMaxUploadMb = 25;
  var serverFiles = [];
  var pdfjsPromise = null, mammothPromise = null;
  var TEXT_EXT = /\.(txt|md|markdown|json|csv|tsv|log|html?|css|js|mjs|ts|tsx|jsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|sql|xml|ya?ml|toml|ini|srt|vtt)$/i;
  function fileKind(f) {
    var n = String(f.name || '').toLowerCase();
    if (/\.pdf$/.test(n) || f.type === 'application/pdf') return 'pdf';
    if (/\.docx$/.test(n) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (TEXT_EXT.test(n) || /^text\//.test(f.type || '') || f.type === 'application/json') return 'text';
    return 'binary';
  }
  function loadPdfjs() {
    if (window.__TA_PDFJS) return Promise.resolve(window.__TA_PDFJS);
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS_BASE + 'pdf.min.mjs').then(function(lib) {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs';
        return lib;
      }).catch(function(e) { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }
  function loadMammoth() {
    if (window.mammoth) return Promise.resolve(window.mammoth);
    if (!mammothPromise) {
      mammothPromise = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = MAMMOTH_SRC;
        s.onload = function() { window.mammoth ? resolve(window.mammoth) : reject(new Error('mammoth 載入失敗')); };
        s.onerror = function() { mammothPromise = null; reject(new Error('mammoth 載入失敗')); };
        document.head.appendChild(s);
      });
    }
    return mammothPromise;
  }
  // 回傳 { text, extract: 'ok' | 'none' | 'failed', pages?, error? }
  async function extractFileText(f, onStatus) {
    var kind = fileKind(f);
    try {
      if (kind === 'text') {
        var t0 = await f.text();
        return { text: t0.slice(0, MAX_EXTRACT_CHARS), extract: t0.trim() ? 'ok' : 'none' };
      }
      if (kind === 'docx') {
        var mammoth = await loadMammoth();
        var r = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
        var t1 = String(r.value || '').replace(/\n{3,}/g, '\n\n');
        return { text: t1.slice(0, MAX_EXTRACT_CHARS), extract: t1.trim() ? 'ok' : 'none' };
      }
      if (kind === 'pdf') {
        var pdfjs = await loadPdfjs();
        var pdf = await pdfjs.getDocument({
          data: new Uint8Array(await f.arrayBuffer()),
          cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true,
          standardFontDataUrl: PDFJS_BASE + 'standard_fonts/',
          isEvalSupported: false
        }).promise;
        var parts = [], total = 0;
        for (var p = 1; p <= pdf.numPages; p++) {
          if (onStatus) onStatus('抽取文字 ' + p + '/' + pdf.numPages + ' 頁');
          var page = await pdf.getPage(p);
          var tc = await page.getTextContent();
          var line = '';
          tc.items.forEach(function(it) { line += (it.str || '') + (it.hasEOL ? '\n' : ''); });
          parts.push(line.trim());
          total += line.length;
          page.cleanup();
          if (total > MAX_EXTRACT_CHARS) break;
        }
        var pages = pdf.numPages;
        await pdf.destroy();
        var t2 = parts.join('\n\n').slice(0, MAX_EXTRACT_CHARS);
        // 幾乎沒有文字 → 多半是掃描檔（只有圖片），需要 OCR，第一版不處理
        return { text: t2.replace(/\s/g, '').length >= 10 ? t2 : '', extract: t2.replace(/\s/g, '').length >= 10 ? 'ok' : 'none', pages: pages };
      }
      return { text: '', extract: 'none' };
    } catch(e) {
      return { text: '', extract: 'failed', error: (e && e.message ? e.message : '抽取失敗').slice(0, 200) };
    }
  }
  function putWithProgress(url, file, contentType, onProgress) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = function(ev) { if (ev.lengthComputable && onProgress) onProgress(ev.loaded / ev.total); };
      xhr.onload = function() { xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('上傳失敗（HTTP ' + xhr.status + '）')); };
      xhr.onerror = function() { reject(new Error('上傳失敗：無法連線到物件儲存（請確認 CORS 設定）')); };
      xhr.send(file);
    });
  }
  async function uploadFileToServer(f, opts) {
    opts = opts || {};
    var status = opts.onStatus || function() {};
    if (f.size > serverMaxUploadMb * 1048576) throw new Error(f.name + ' 超過 ' + serverMaxUploadMb + ' MB 上限');
    var mime = f.type || (fileKind(f) === 'pdf' ? 'application/pdf' : 'application/octet-stream');
    status('準備上傳 ' + f.name);
    var created = await storeFetch('POST', '/api/files', { filename: f.name, mime: mime, size: f.size, project_id: opts.projectId || null });
    await putWithProgress(created.upload.url, f, created.upload.headers['Content-Type'], function(r) { status('上傳 ' + f.name + ' ' + Math.round(r * 100) + '%'); });
    status('抽取文字 ' + f.name);
    var ex = await extractFileText(f, status);
    var done = await storeFetch('POST', '/api/files/' + encodeURIComponent(created.file.id) + '/complete', {
      title: f.name.replace(/\.[^/.]+$/, ''), text: ex.text, extract: ex.extract, pages: ex.pages, error: ex.error
    });
    return { file: done.file, documentId: done.document_id, truncated: !!done.truncated, extract: ex.extract };
  }
  function setFilesStatus(text, bad) {
    var el = document.getElementById('files-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--muted)';
  }
  function fileStatusLabel(f) {
    if (f.status === 'extracted') return '已加入知識庫';
    if (f.error === 'no_text_layer') return '無文字層（可能是掃描檔）';
    if (f.status === 'failed') return '抽取失敗';
    return '已上傳';
  }
  function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function renderServerFiles() {
    var wrap = document.getElementById('server-files-wrap');
    var box = document.getElementById('server-files-box');
    if (wrap) wrap.style.display = serverFilesEnabled ? '' : 'none';
    if (!box || !serverFilesEnabled) return;
    var list = currentProjectId ? serverFiles.filter(function(f) { return f.project_id === currentProjectId; }) : serverFiles;
    var title = document.getElementById('server-files-title');
    if (title) title.textContent = (currentProjectId ? '此專案的檔案' : '已上傳檔案') + '（' + list.length + '）';
    if (!list.length) { box.innerHTML = '<div class="empty-side">尚無檔案</div>'; return; }
    box.innerHTML = list.map(function(f) {
      return '<div class="server-file-row">' +
        '<div class="server-file-main"><div class="server-file-name">' + escapeHtml(f.filename) + '</div>' +
        '<div class="server-file-meta">' + formatBytes(f.size_bytes) + ' · ' + fileStatusLabel(f) + '</div></div>' +
        '<button type="button" class="mini-x" data-file-dl="' + escapeHtml(f.id) + '" title="下載">↓</button>' +
        '<button type="button" class="mini-x" data-file-del="' + escapeHtml(f.id) + '" title="刪除">✕</button></div>';
    }).join('');
  }
  async function refreshServerFiles() {
    if (!serverFilesEnabled) { renderServerFiles(); return; }
    try {
      serverFiles = (await storeFetch('GET', '/api/files')).files || [];
    } catch(e) { setFilesStatus('讀取檔案清單失敗：' + (e.message || ''), true); }
    renderServerFiles();
  }
  async function downloadServerFile(id) {
    try {
      var r = await storeFetch('GET', '/api/files/' + encodeURIComponent(id) + '/download');
      if (r.url) window.open(r.url, '_blank', 'noopener');
    } catch(e) { setFilesStatus('下載失敗：' + (e.message || ''), true); }
  }
  async function deleteServerFile(id, silent) {
    var f = serverFiles.filter(function(x) { return x.id === id; })[0];
    if (!silent && !confirm('刪除「' + (f ? f.filename : '檔案') + '」？檔案本體與知識庫內容都會刪除。')) return;
    try {
      await storeFetch('DELETE', '/api/files/' + encodeURIComponent(id));
      // 本機快取同步移除對應的知識庫文件
      var before = documents.length;
      documents = documents.filter(function(d) {
        if (d.fileId !== id) return true;
        delete syncMeta.hashes['doc:' + d.id]; delete syncMeta.srv['doc:' + d.id];
        return false;
      });
      if (documents.length !== before) { syncMeta.applying = true; saveDocuments(); syncMeta.applying = false; saveSyncMeta(); }
      serverFiles = serverFiles.filter(function(x) { return x.id !== id; });
      renderServerFiles(); renderKnowledgeList(); renderSidebar();
      setFilesStatus('已刪除', false);
    } catch(e) { setFilesStatus('刪除失敗：' + (e.message || ''), true); }
  }
  async function uploadFilesToServer(files, projectId, onStatus) {
    var ok = 0, notes = [];
    var report = onStatus || function(s, bad) { setFilesStatus(s, bad); };
    for (var i = 0; i < files.length; i++) {
      try {
        var r = await uploadFileToServer(files[i], { projectId: projectId === undefined ? currentProjectId : projectId, onStatus: function(s) { report(s, false); } });
        ok++;
        if (r.extract === 'none') notes.push(files[i].name + '：沒有可抽取的文字');
        else if (r.extract === 'failed') notes.push(files[i].name + '：抽取失敗，只保存檔案');
        else if (r.truncated) notes.push(files[i].name + '：文字超過 90 萬字，只保存前段');
      } catch(e) {
        notes.push(files[i].name + '：' + (e && e.message ? e.message : '失敗'));
      }
    }
    await pullSync();
    await refreshServerFiles();
    renderKnowledgeList(); renderSidebar();
    var summary = '上傳完成 ' + ok + '/' + files.length + (notes.length ? '。' + notes.join('；') : '');
    report(summary, ok !== files.length);
    return summary;
  }
  window.TA_FILES = { extract: extractFileText, upload: uploadFileToServer, refresh: refreshServerFiles };
