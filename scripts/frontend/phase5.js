  // ── 語意檢索、金鑰、備份（第五階段）──────────────────────────
  var embedRunning = false;
  function p5Status(id, text, bad) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--muted)';
  }
  function embedStatusText(st) {
    if (!st.vector_available) return '資料庫尚未啟用 pgvector（需套用 0002_vectors）。';
    if (!st.configured) return '未使用：知識庫只用關鍵字檢索。要開啟語意檢索，請選擇供應商與嵌入模型後按「儲存並測試」。';
    return '已索引 ' + st.embedded + ' / ' + st.total + ' 段' + (st.pending ? '，' + st.pending + ' 段待處理' : '') + '（' + st.model + (st.dims ? '，' + st.dims + ' 維' : '') + '）';
  }
  function kwStatusText(st) {
    var eng = st.engine === 'bm25' ? '目前使用：中文斷詞＋BM25' : '目前使用：二字組';
    if (st.mode !== 'bigram' && !st.bm25_available) eng += '（資料庫尚未啟用 BM25，需在 Neon 套用 0004_cjk_bm25）';
    return eng;
  }
  async function loadKeywordPane() {
    var card = document.getElementById('kw-card');
    if (!card) return;
    card.style.display = serverMode() ? '' : 'none';
    if (!serverMode()) return;
    try {
      var st = (await storeFetch('GET', '/api/search/status')).status;
      document.getElementById('kw-mode').value = st.mode || 'auto';
      p5Status('kw-status', kwStatusText(st), st.mode !== 'bigram' && !st.bm25_available);
    } catch(e) { p5Status('kw-status', '讀取失敗：' + (e.message || ''), true); }
  }
  async function saveKeywordMode() {
    var mode = document.getElementById('kw-mode').value;
    try {
      var r = await storeFetch('PUT', '/api/search/config', { keyword: mode });
      p5Status('kw-status', '已儲存。' + kwStatusText(r.status), r.status.mode !== 'bigram' && !r.status.bm25_available);
    } catch(e) { p5Status('kw-status', '儲存失敗：' + (e.message || ''), true); }
  }
  async function loadEmbeddingPane() {
    var card = document.getElementById('embed-card');
    if (!card) return;
    card.style.display = serverMode() ? '' : 'none';
    if (!serverMode()) return;
    var sel = document.getElementById('embed-provider');
    var st;
    try { st = (await storeFetch('GET', '/api/embeddings/status')).status; }
    catch(e) { p5Status('embed-status', '讀取失敗：' + (e.message || ''), true); return; }
    // 每個供應商（環境變數與面板）只列它的嵌入模型；聊天模型不出現在這裡。也可以自由輸入。
    var opts = (Array.isArray(st.options) ? st.options : []).map(function(o) {
      return { id: o.provider.id, name: o.provider.name + (o.provider.readonly ? '（環境變數）' : ''), models: o.models || [] };
    });
    sel.innerHTML = '<option value="">不使用（只用關鍵字）</option>' + opts.map(function(p) {
      return '<option value="' + escapeHtml(p.id) + '"' + (st.provider_id === p.id ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
    }).join('');
    var fillEmbedModels = function(fillFirst) {
      var o = null;
      for (var i = 0; i < opts.length; i++) if (opts[i].id === sel.value) o = opts[i];
      var dl = document.getElementById('embed-model-list');
      if (dl) dl.innerHTML = (o ? o.models : []).map(function(m) { return '<option value="' + escapeHtml(m) + '"></option>'; }).join('');
      var input = document.getElementById('embed-model');
      if (fillFirst && input && o && o.models.length && o.models.indexOf(input.value) < 0) input.value = o.models[0];
    };
    sel.onchange = function() { fillEmbedModels(true); };
    document.getElementById('embed-model').value = st.model || '';
    fillEmbedModels(false);
    document.getElementById('embed-run-btn').disabled = !st.configured || !st.pending;
    p5Status('embed-status', embedStatusText(st), !st.vector_available);
  }
  async function saveEmbeddingConfig() {
    var pid = document.getElementById('embed-provider').value;
    var model = document.getElementById('embed-model').value.trim();
    if (pid && !model) return p5Status('embed-status', '請輸入嵌入模型名稱，例如 text-embedding-3-small', true);
    p5Status('embed-status', pid ? '測試嵌入模型…' : '關閉中…');
    try {
      var r = await storeFetch('PUT', '/api/embeddings/config', { provider_id: pid || null, model: model });
      p5Status('embed-status', embedStatusText(r.status));
      if (r.config && r.status.pending) runEmbeddingBackfill(false);
      else loadEmbeddingPane();
    } catch(e) { p5Status('embed-status', '設定失敗：' + (e.message || ''), true); }
  }
  // 前端迴圈：每次請求伺服器最多處理約 40 秒，直到沒有待處理段落
  async function runEmbeddingBackfill(silent) {
    if (embedRunning || !serverMode()) return;
    embedRunning = true;
    try {
      for (var round = 0; round < 500; round++) {
        var r = await storeFetch('POST', '/api/embeddings/backfill', {});
        if (!silent) p5Status('embed-status', '建立索引中… 剩 ' + r.remaining + ' / ' + r.total + ' 段');
        if (!r.remaining || !r.done) break;
      }
      if (!silent) loadEmbeddingPane();
    } catch(e) {
      if (!silent) p5Status('embed-status', '建立索引失敗：' + (e.message || ''), true);
    } finally { embedRunning = false; }
  }
  async function maybeBackfillEmbeddings() {
    if (!serverMode()) return;
    try {
      var st = (await storeFetch('GET', '/api/embeddings/status')).status;
      if (st.configured && st.pending) runEmbeddingBackfill(true);
    } catch(e) {}
  }

  async function loadKeyStatus() {
    var card = document.getElementById('keys-card');
    if (!card) return;
    card.style.display = serverMode() ? '' : 'none';
    if (!serverMode()) return;
    try {
      var k = (await storeFetch('GET', '/api/admin/keys')).keys;
      var parts = Object.keys(k.versions).map(function(v) { return v + '：' + k.versions[v] + ' 個'; });
      var text = '目前金鑰版本 ' + k.current + '。' + (parts.length ? '已加密的 Key：' + parts.join('、') + '。' : '尚無已儲存的 Key。');
      if (k.unreadable.length) text += ' 無法解密的版本：' + k.unreadable.join('、') + '（請設定 ENCRYPTION_KEY_PREVIOUS）。';
      else if (k.outdated) text += ' 有 ' + k.outdated + ' 個 Key 使用舊金鑰，可重新加密。';
      p5Status('keys-status', text, !!k.unreadable.length);
      document.getElementById('rekey-btn').style.display = k.outdated && !k.unreadable.length ? '' : 'none';
    } catch(e) { p5Status('keys-status', '讀取失敗：' + (e.message || ''), true); }
  }
  async function rekeyNow() {
    try {
      var r = await storeFetch('POST', '/api/admin/rekey', {});
      p5Status('keys-status', '已重新加密 ' + r.rekeyed + ' 個 Key' + (r.failed.length ? '，' + r.failed.length + ' 個失敗' : '') + '。', !!r.failed.length);
      setTimeout(loadKeyStatus, 1200);
    } catch(e) { p5Status('keys-status', '重新加密失敗：' + (e.message || ''), true); }
  }

  var BACKUP_BATCH_BYTES = 3000000;
  async function downloadServerBackup() {
    var btn = document.getElementById('backup-download-btn');
    btn.disabled = true;
    try {
      var meta = await storeFetch('GET', '/api/backup');
      var out = { format: meta.format, version: meta.version, exported_at: new Date().toISOString(), tables: {} };
      for (var i = 0; i < meta.tables.length; i++) {
        var table = meta.tables[i];
        out.tables[table] = [];
        var cursor = '';
        do {
          p5Status('backup-status', '匯出 ' + table + '…（' + out.tables[table].length + ' 列）');
          var page = await storeFetch('GET', '/api/backup?table=' + encodeURIComponent(table) + '&cursor=' + encodeURIComponent(cursor || ''));
          Array.prototype.push.apply(out.tables[table], page.rows || []);
          cursor = page.next_cursor;
        } while (cursor);
      }
      var blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'personal-ai-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      var total = 0;
      Object.keys(out.tables).forEach(function(t) { total += out.tables[t].length; });
      p5Status('backup-status', '備份完成：' + total + ' 列。API Key 不含在備份中，還原後需重新輸入。');
    } catch(e) { p5Status('backup-status', '匯出失敗：' + (e.message || ''), true); }
    finally { btn.disabled = false; }
  }
  async function restoreServerBackup(file) {
    if (!file) return;
    var data;
    try { data = JSON.parse(await file.text()); } catch(e) { return p5Status('backup-status', '檔案不是有效的 JSON', true); }
    if (!data || data.format !== 'personal-ai-backup' || !data.tables) return p5Status('backup-status', '這不是 Personal AI 的備份檔', true);
    if (!confirm('從備份還原？相同 id 的資料會被備份內容覆寫，其他資料保留。')) return;
    try {
      var meta = await storeFetch('GET', '/api/backup');
      var count = 0;
      for (var i = 0; i < meta.tables.length; i++) {
        var table = meta.tables[i];
        var rows = data.tables[table] || [];
        var batch = [], bytes = 0;
        var flush = async function() {
          if (!batch.length) return;
          var r = await storeFetch('POST', '/api/backup/restore', { table: table, rows: batch });
          count += r.restored || 0;
          batch = []; bytes = 0;
          p5Status('backup-status', '還原 ' + table + '…（共 ' + count + ' 列）');
        };
        for (var j = 0; j < rows.length; j++) {
          var size = JSON.stringify(rows[j]).length * 3;
          if (batch.length && (bytes + size > BACKUP_BATCH_BYTES || batch.length >= 500)) await flush();
          batch.push(rows[j]); bytes += size;
        }
        await flush();
      }
      p5Status('backup-status', '還原完成：' + count + ' 列。重新整理頁面以載入。');
      maybeBackfillEmbeddings();
    } catch(e) { p5Status('backup-status', '還原失敗：' + (e.message || ''), true); }
  }
