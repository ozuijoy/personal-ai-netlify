(function() {
  var _root = document.getElementById('app');
  if (_root) _root.innerHTML = "<div class=\"ta-app\">\n<div class=\"ta-app\">\n  <div class=\"sidebar-overlay\" id=\"sidebar-overlay\"></div>\n  <aside class=\"ta-sidebar\" id=\"sidebar\">\n    <div class=\"sb-head\">\n      <a href=\"/\" class=\"brand-logo\">\n        <img src=\"/avatar.png\" alt=\"\" class=\"brand-avatar\">\n        <span class=\"brand-title\">Personal AI</span>\n      </a>\n      <button id=\"sidebar-close-btn\" class=\"icon-btn\" title=\"Cerrar\" style=\"display:none\">✕</button>\n    </div>\n    <button id=\"new-chat-btn\" class=\"new-chat-btn\" type=\"button\">\n      <span class=\"nc-main\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><path d=\"M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6\"/><path d=\"M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8 8 16l1.2-4z\"/></svg><span data-i18n=\"newChat\">Nueva conversación</span></span>\n      <kbd class=\"hint\">Ctrl K</kbd>\n    </button>\n    <button id=\"temp-chat-btn\" class=\"new-chat-btn ghost\" type=\"button\">\n      <span class=\"nc-main\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><circle cx=\"12\" cy=\"12\" r=\"9\" stroke-dasharray=\"3 3\"/><path d=\"M12 7v5l3 2\"/></svg><span data-i18n=\"tempChat\">Chat temporal</span></span>\n      <kbd class=\"hint\">Ctrl ⇧ N</kbd>\n    </button>\n    <div class=\"history-search-box\">\n      <input type=\"search\" id=\"history-search\" class=\"history-search-input\" placeholder=\"Buscar…\" autocomplete=\"off\" data-i18n=\"searchPh\" data-i18n-attr=\"placeholder\">\n    </div>\n    <div class=\"sb-tabs\">\n      <button type=\"button\" class=\"sb-tab active\" data-view=\"chats\" id=\"tab-chats\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><path d=\"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z\"/></svg><span data-i18n=\"chats\">Chats</span></button>\n      <button type=\"button\" class=\"sb-tab\" data-view=\"projects\" id=\"tab-projects\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/></svg><span data-i18n=\"projects\">Proyectos</span></button>\n      <button type=\"button\" class=\"sb-tab\" data-view=\"docs\" id=\"tab-docs\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"/><path d=\"M14 3v5h5\"/><path d=\"M9 13h6M9 17h4\"/></svg><span data-i18n=\"docs\">Documentos</span></button>\n      \n      <button type=\"button\" class=\"sb-tab\" data-view=\"prompts\" id=\"tab-prompts\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><path d=\"M4 6h16M4 12h10M4 18h7\"/><path d=\"m17 15 3 3-3 3\"/></svg><span>Prompts</span></button>\n    </div>\n    <div class=\"history-list\" id=\"history-list\"></div>\n    <div class=\"sb-foot\">\n                  <button type=\"button\" id=\"open-settings-btn\" class=\"sb-link\" data-open-settings=\"pane-general\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/></svg><span data-i18n=\"settings\">Ajustes</span></button>\n      \n      <div class=\"sb-account\">\n      <button type=\"button\" class=\"user-pill\" id=\"user-profile-pill\" data-open-settings=\"pane-account\">\n        <div style=\"display:flex;align-items:center;gap:8px;min-width:0\">\n          <div class=\"avatar-letter\" id=\"user-letter\">T</div>\n          <div style=\"min-width:0\">\n            <div class=\"user-info-name\" id=\"user-display-name\">Invitado</div>\n            <div class=\"user-info-tier\" id=\"user-display-tier\">50K tokens / día</div>\n          </div>\n        </div>\n      </button>\n      <div id=\"lang-select\" class=\"lang-picker\" aria-label=\"Language\"></div>\n      </div>\n    </div>\n  </aside>\n\n  <main class=\"ta-main\">\n    <header class=\"ta-topbar\">\n      <div class=\"topbar-left\">\n        <button id=\"sidebar-toggle-btn\" class=\"icon-btn menu-toggle-btn\" type=\"button\" title=\"Menú\" aria-label=\"Menú\">\n          <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"/><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"/></svg>\n        </button>\n        <div class=\"model-picker\" id=\"model-picker\">\n          <button type=\"button\" class=\"model-picker-btn\" id=\"model-picker-btn\" aria-haspopup=\"listbox\" aria-expanded=\"false\">\n            <span class=\"model-picker-label\" id=\"model-picker-label\">GPT OSS 120B</span>\n            <svg class=\"model-picker-caret\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>\n          </button>\n          <div class=\"model-menu\" id=\"model-menu\" role=\"listbox\"></div>\n        </div>\n      </div>\n      <div class=\"topbar-right\">\n        <span id=\"temp-badge\" class=\"temp-badge\" data-i18n=\"tempOn\">Temporal</span>\n        <button id=\"cmd-open-btn\" class=\"topbar-icon-btn\" type=\"button\" title=\"Ctrl+P\" data-i18n=\"commandPalette\" data-i18n-attr=\"title\" aria-label=\"Comandos\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/></svg>\n        </button>\n        <button id=\"export-chat-btn\" class=\"topbar-icon-btn\" type=\"button\" data-i18n=\"exportChat\" data-i18n-attr=\"title\" aria-label=\"Exportar\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12\"/><path d=\"M8 11l4 4 4-4\"/><path d=\"M5 21h14\"/></svg>\n        </button>\n        <button id=\"topbar-auth-btn\" class=\"topbar-action-btn primary\" type=\"button\" data-open-settings=\"pane-general\">\n          <span class=\"avatar-letter\" id=\"topbar-letter\" hidden>T</span>\n          <span id=\"topbar-auth-text\">設定</span>\n        </button>\n      </div>\n    </header>\n    <div class=\"ta-chat-scroll\" id=\"chat-scroll\">\n      <div class=\"ta-chat-wrap\" id=\"chat-container\"></div>\n    </div>\n    <footer class=\"ta-input-dock\">\n      <div class=\"capsule-box\">\n        <div id=\"attached-badge\" class=\"file-badge-preview\">\n          <img id=\"attached-thumb\" alt=\"\" hidden>\n          <span id=\"attached-kind\">Documento</span>\n          <span id=\"attached-name\">documento.txt</span>\n          <button id=\"remove-file-btn\" type=\"button\" style=\"background:none;border:none;color:var(--dim);cursor:pointer\">✕</button>\n        </div>\n        <textarea id=\"prompt-input\" class=\"prompt-textarea\" rows=\"1\" placeholder=\"Pregunta lo que quieras…\" data-i18n=\"askPh\" data-i18n-attr=\"placeholder\"></textarea>\n        <div class=\"dock-controls\">\n          <div class=\"dock-plus\" id=\"dock-plus\">\n            <button type=\"button\" class=\"dock-btn dock-plus-btn\" id=\"dock-plus-btn\" aria-haspopup=\"menu\" aria-expanded=\"false\" aria-controls=\"dock-plus-menu\" aria-label=\"Más opciones\" title=\"Más opciones\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg></button>\n            <div class=\"dock-plus-menu\" id=\"dock-plus-menu\" role=\"menu\" hidden>\n              <button type=\"button\" role=\"menuitem\" class=\"dpm-item\" data-dpm=\"attach\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/></svg><span class=\"dpm-label\">Adjuntar archivo</span></button>\n              <button type=\"button\" role=\"menuitemcheckbox\" aria-checked=\"false\" class=\"dpm-item\" data-dpm=\"web\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18\"/></svg><span class=\"dpm-label\">Buscar en la web</span><span class=\"dpm-check\" aria-hidden=\"true\">✓</span></button>\n              <button type=\"button\" role=\"menuitemcheckbox\" aria-checked=\"false\" class=\"dpm-item\" data-dpm=\"image\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" class=\"sb-ico\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"2\"/><path d=\"m21 16-5-5-9 9\"/></svg><span class=\"dpm-label\">Crear imagen</span><span class=\"dpm-check\" aria-hidden=\"true\">✓</span></button>\n                          </div>\n          </div>\n          <div class=\"control-pills\">\n            <button id=\"web-search-pill\" class=\"dock-pill\" type=\"button\" data-i18n=\"searchWeb\">Buscar</button>\n            <button id=\"image-gen-pill\" class=\"dock-pill\" type=\"button\" data-i18n=\"image\">Imagen</button>\n            <div class=\"length-segmented-pill\" style=\"display:none;\" title=\"Longitud\"><button class=\"length-opt-btn active\" data-len=\"normal\" id=\"len-btn-normal\" type=\"button\" data-i18n=\"normal\">Normal</button></div>\n          </div>\n          <div class=\"dock-action-buttons\">\n            <input type=\"file\" id=\"file-uploader\" style=\"display:none\" accept=\"image/jpeg,image/png,image/webp,image/gif,.txt,.md,.json,.js,.ts,.py,.csv,.log,.html,.css\">\n            <button id=\"attach-file-btn\" class=\"dock-btn\" type=\"button\" title=\"Adjuntar archivo o imagen\" aria-label=\"Adjuntar\" data-i18n=\"attach\" data-i18n-attr=\"title\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/></svg>\n            </button>\n            <button id=\"mic-btn\" class=\"dock-btn\" type=\"button\" title=\"Grabar voz\" aria-label=\"Grabar voz\" data-i18n=\"dictate\" data-i18n-attr=\"title\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"2\" width=\"6\" height=\"12\" rx=\"3\"/><path d=\"M5 11a7 7 0 0 0 14 0\"/><path d=\"M12 18v4\"/><path d=\"M8 22h8\"/></svg>\n            </button>\n            <button id=\"speak-last-btn\" class=\"dock-btn\" type=\"button\" title=\"Leer respuesta\" aria-label=\"Leer\" data-i18n=\"speakLast\" data-i18n-attr=\"title\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 5L6 9H3v6h3l5 4V5z\"/><path d=\"M15.5 8.5a5 5 0 0 1 0 7\"/><path d=\"M18.5 6a8.5 8.5 0 0 1 0 12\"/></svg>\n            </button>\n            <button id=\"send-btn\" class=\"send-submit-btn\" type=\"button\" title=\"Enviar\">\n              <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\"><path d=\"M12 19V5M5 12l7-7 7 7\"/></svg>\n            </button>\n          </div>\n        </div>\n      </div>\n      <p class=\"disclaimer\"><span data-i18n=\"disclaimer\">Personal AI puede equivocarse.</span></p>\n    </footer>\n  </main>\n\n  <aside class=\"art-panel\" id=\"art-panel\" aria-label=\"Artefacto\">\n    <div class=\"art-head\">\n      <div class=\"art-head-top\">\n        <div class=\"art-title-wrap\">\n          <textarea class=\"art-title-input\" id=\"art-title\" maxlength=\"72\" rows=\"2\" placeholder=\"Título corto (máx. 72)\" aria-label=\"Título\">Artifact</textarea>\n          <div class=\"art-title-count\" id=\"art-title-count\">0/72</div>\n        </div>\n        <button type=\"button\" class=\"icon-btn\" id=\"art-close-btn\" title=\"Cerrar\" aria-label=\"Cerrar\">✕</button>\n      </div>\n      <div class=\"art-toolbar\">\n        <select id=\"art-format\" class=\"art-format\" title=\"Formato\" aria-label=\"Formato del artifact\"></select>\n        <button type=\"button\" class=\"topbar-action-btn\" id=\"art-copy-btn\" data-art-i18n=\"copy\">Copiar</button>\n        <button type=\"button\" class=\"topbar-action-btn\" id=\"art-save-btn\">Guardar</button>\n      </div>\n      <div class=\"art-viewbar\">\n        <div class=\"art-view\" role=\"tablist\" aria-label=\"Vista\">\n          <button type=\"button\" class=\"art-view-btn active\" role=\"tab\" aria-selected=\"true\" data-view=\"preview\" id=\"art-view-preview\" data-art-i18n=\"preview\">Vista previa</button>\n          <button type=\"button\" class=\"art-view-btn\" role=\"tab\" aria-selected=\"false\" data-view=\"code\" id=\"art-view-code\" data-art-i18n=\"code\">Código</button>\n        </div>\n        <select id=\"art-version\" class=\"art-format art-version\" aria-label=\"Versión\" hidden></select>\n        <span class=\"art-viewbar-spacer\"></span>\n        <button type=\"button\" class=\"icon-btn art-icon-btn\" id=\"art-download-btn\" data-art-i18n-title=\"download\" title=\"Descargar\" aria-label=\"Descargar\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 4v11\"/><path d=\"m7 10 5 5 5-5\"/><path d=\"M5 20h14\"/></svg></button>\n        <button type=\"button\" class=\"icon-btn art-icon-btn\" id=\"art-fs-btn\" data-art-i18n-title=\"fullscreen\" title=\"Pantalla completa\" aria-label=\"Pantalla completa\" aria-pressed=\"false\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 9V4h5\"/><path d=\"M20 9V4h-5\"/><path d=\"M4 15v5h5\"/><path d=\"M20 15v5h-5\"/></svg></button>\n      </div>\n      \n    </div>\n    <div class=\"art-extras\">\n      <button type=\"button\" class=\"art-extras-toggle\" id=\"art-extras-toggle\">Fuentes, recursos y widgets</button>\n      <div class=\"art-extras-body\" id=\"art-extras-body\" hidden>\n        <label for=\"art-sources\">Fuentes propias (una por línea: Título | https://…)</label>\n        <textarea id=\"art-sources\" placeholder=\"SEC 10-K | https://www.sec.gov/…\"></textarea>\n        <label for=\"art-resources\">Recursos (una por línea)</label>\n        <textarea id=\"art-resources\" placeholder=\"Modelo Excel | https://…\"></textarea>\n        <label for=\"art-widgets\">Widgets (quote:MSFT · note:texto · https://…)</label>\n        <textarea id=\"art-widgets\" placeholder=\"quote:MSFT&#10;note:Riesgo: múltiplo elevado&#10;https://www.tradingview.com/symbols/MSFT/\"></textarea>\n      </div>\n    </div>\n    <div class=\"art-split\" id=\"art-split\">\n      <textarea class=\"art-editor\" id=\"art-editor\" spellcheck=\"false\" placeholder=\"Escribe aquí el contenido. La IA genera una base; tú la editas.\" aria-label=\"Editor del artifact\"></textarea>\n      <iframe class=\"art-preview\" id=\"art-preview\" hidden sandbox=\"allow-scripts allow-forms allow-modals allow-popups\" referrerpolicy=\"no-referrer\" title=\"Vista del artifact\"></iframe>\n    </div>\n  </aside>\n</div>\n\n<div class=\"modal-backdrop\" id=\"modal-settings\">\n  <div class=\"modal-card settings-wide\">\n    <div class=\"modal-header\"><div class=\"modal-title\" data-i18n=\"settings\">Ajustes</div><button class=\"modal-close-btn\" data-modal=\"modal-settings\" type=\"button\" aria-label=\"Cerrar\" data-i18n=\"close\" data-i18n-attr=\"aria-label\">✕</button></div>\n    <div class=\"settings-layout\">\n      <nav class=\"settings-nav\" aria-label=\"設定\">\n        <div class=\"settings-nav-label\">應用程式</div>\n        <button type=\"button\" class=\"settings-nav-btn active\" data-pane=\"pane-general\" data-i18n=\"tabGeneral\">一般</button>\n        <button type=\"button\" class=\"settings-nav-btn\" data-pane=\"pane-providers\">供應商</button>\n        <button type=\"button\" class=\"settings-nav-btn\" data-pane=\"pane-appearance\" data-i18n=\"tabAppearance\">外觀</button>\n        <button type=\"button\" class=\"settings-nav-btn\" data-pane=\"pane-behavior\" data-i18n=\"tabBehavior\">行為</button>\n        <button type=\"button\" class=\"settings-nav-btn\" data-pane=\"pane-customize\" data-i18n=\"tabCustomize\">個人化</button>\n        <div class=\"settings-nav-label\">資料</div>\n        <button type=\"button\" class=\"settings-nav-btn\" data-pane=\"pane-data\" data-i18n=\"tabData\">資料控制</button>\n      </nav>\n      <div class=\"settings-main\">\n        <div id=\"pane-general\" class=\"settings-pane active\">\n          <div class=\"settings-section-title\" data-i18n=\"tabGeneral\">General</div>\n          <p class=\"settings-section-desc\" data-i18n=\"generalDesc\">Idioma, modelo por defecto y longitud de respuesta.</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"language\">Idioma</label>\n            <div id=\"set-lang\" class=\"lang-picker open-down\"></div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"setDefaultModel\">Modelo por defecto</label>\n            <select id=\"set-default-model\" class=\"form-input\"></select>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"setDefaultLength\">Longitud por defecto</label>\n            <div class=\"choice-row\" id=\"set-default-length\">\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_len_mode\" data-value=\"corto\" data-i18n=\"short\">Corto</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_len_mode\" data-value=\"normal\" data-i18n=\"normal\">Normal</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_len_mode\" data-value=\"extendido\" data-i18n=\"long\">Largo</button>\n            </div>\n          </div>\n          <p class=\"settings-hint\">Personal AI · 2026.2 · ai.personal-ai.workers.dev</p>\n        </div>\n\n        <div id=\"pane-account\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabAccount\">Cuenta</div>\n          <p class=\"settings-section-desc\" data-i18n=\"accountDesc\">Tu perfil, plan, correos y acceso.</p>\n          <div id=\"account-guest\" style=\"display:none;text-align:center;padding:18px 8px;\">\n            <p style=\"font-size:0.84rem;color:var(--muted);margin-bottom:12px\" data-i18n=\"needLogin\">Inicia sesión para sincronizar la cuenta.</p>\n            <a href=\"/login\" class=\"topbar-action-btn primary\" style=\"text-decoration:none\" data-i18n=\"signIn\">Acceder</a>\n          </div>\n          <div id=\"account-authed\">\n            <div class=\"settings-card\">\n              <div class=\"settings-kv\">\n                <div class=\"settings-kv-label\" data-i18n=\"displayName\">Nombre</div>\n                <div class=\"settings-kv-control\">\n                  <input type=\"text\" id=\"set-display-name\" class=\"form-input\" maxlength=\"80\" autocomplete=\"name\">\n                </div>\n              </div>\n              <div class=\"settings-kv\">\n                <div class=\"settings-kv-label\" data-i18n=\"emailLabel\">Correo</div>\n                <div class=\"settings-kv-value\" id=\"account-email-display\"></div>\n              </div>\n              <div class=\"settings-kv\">\n                <div class=\"settings-kv-label\" data-i18n=\"tabPlan\">Plan y facturación</div>\n                <span class=\"plan-badge\" id=\"account-plan-badge\">FREE</span>\n              </div>\n            </div>\n\n            <div class=\"settings-block-title\" data-i18n=\"emailPrefs\">Correos</div>\n            <p class=\"settings-hint\" data-i18n=\"emailsHint\">Elige qué correos quieres recibir en tu bandeja.</p>\n            <div class=\"settings-card\">\n              <label class=\"toggle-row\"><span data-i18n=\"notifyProduct\">Novedades de producto</span><input type=\"checkbox\" id=\"set-notify-product\" checked></label>\n              <label class=\"toggle-row\"><span data-i18n=\"notifySecurity\">Alertas de seguridad</span><input type=\"checkbox\" id=\"set-notify-security\" checked></label>\n              <label class=\"toggle-row\"><span data-i18n=\"notifyDigest\">Resumen ocasional</span><input type=\"checkbox\" id=\"set-notify-digest\"></label>\n              <div class=\"settings-actions\">\n                <button type=\"button\" id=\"test-email-btn\" class=\"topbar-action-btn\" data-i18n=\"testEmail\">Enviar correo de prueba</button>\n              </div>\n            </div>\n\n            <p id=\"oauth-pass-hint\" class=\"settings-hint\" style=\"display:none;margin-top:16px\"></p>\n            <div id=\"password-fields\">\n              <div class=\"settings-block-title\" data-i18n=\"passwordSection\">Contraseña</div>\n              <div class=\"settings-card\">\n                <div class=\"form-group\">\n                  <label class=\"form-label\" data-i18n=\"currentPassword\">Contraseña actual</label>\n                  <input type=\"password\" id=\"set-cur-pass\" class=\"form-input\" autocomplete=\"current-password\">\n                </div>\n                <div class=\"form-group\">\n                  <label class=\"form-label\" data-i18n=\"newPassword\">Nueva contraseña</label>\n                  <input type=\"password\" id=\"set-new-pass\" class=\"form-input\" autocomplete=\"new-password\" minlength=\"6\">\n                </div>\n                <div class=\"settings-actions\">\n                  <button type=\"button\" id=\"change-pass-btn\" class=\"topbar-action-btn primary\" data-i18n=\"changePassword\">Cambiar contraseña</button>\n                </div>\n              </div>\n            </div>\n\n            <div class=\"settings-block-title\" data-i18n=\"sessionTitle\">Sesión</div>\n            <div class=\"settings-card\" style=\"padding:16px\">\n              <div class=\"settings-kv-label\" data-i18n=\"logout\">Cerrar sesión</div>\n              <p class=\"settings-kv-sub\" data-i18n=\"sessionHint\">Cierra la sesión en este navegador. El historial local se queda.</p>\n              <button type=\"button\" id=\"settings-logout-btn-legacy\" class=\"logout-big-btn\" data-i18n=\"logout\">Cerrar sesión</button>\n            </div>\n          </div>\n        </div>\n\n        <div id=\"pane-appearance\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabAppearance\">Apariencia</div>\n          <p class=\"settings-section-desc\" data-i18n=\"appearanceDesc\">Tema, tamaño de letra y densidad de la interfaz.</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"appearanceTheme\">Tema</label>\n            <div class=\"theme-grid\">\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"dark\"><span class=\"theme-swatch\" data-swatch=\"dark\"></span><span data-i18n=\"themeDark\">Oscuro</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"gray\"><span class=\"theme-swatch\" data-swatch=\"gray\"></span><span data-i18n=\"themeGray\">Gris</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"dim\"><span class=\"theme-swatch\" data-swatch=\"dim\"></span><span data-i18n=\"themeDim\">Carbón</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"navy\"><span class=\"theme-swatch\" data-swatch=\"navy\"></span><span data-i18n=\"themeNavy\">Marino</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"light\"><span class=\"theme-swatch\" data-swatch=\"light\"></span><span data-i18n=\"themeLight\">Claro</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"paper\"><span class=\"theme-swatch\" data-swatch=\"paper\"></span><span data-i18n=\"themePaper\">Papel</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"hacker\"><span class=\"theme-swatch\" data-swatch=\"hacker\"></span><span>Hacker</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"cyberpunk\"><span class=\"theme-swatch\" data-swatch=\"cyberpunk\"></span><span>Cyberpunk</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"sunset\"><span class=\"theme-swatch\" data-swatch=\"sunset\"></span><span>Sunset</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"ocean\"><span class=\"theme-swatch\" data-swatch=\"ocean\"></span><span>Ocean</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"forest\"><span class=\"theme-swatch\" data-swatch=\"forest\"></span><span>Forest</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"rose\"><span class=\"theme-swatch\" data-swatch=\"rose\"></span><span>Rose</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"lavender\"><span class=\"theme-swatch\" data-swatch=\"lavender\"></span><span>Lavender</span></button>\n              <button type=\"button\" class=\"theme-card\" data-pref=\"ta_theme\" data-value=\"system\"><span class=\"theme-swatch\" data-swatch=\"system\"></span><span data-i18n=\"themeSystem\">Sistema</span></button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"accentLabel\">Acento</label>\n            <div class=\"accent-row\">\n              <button type=\"button\" class=\"accent-dot accent-auto\" data-pref=\"ta_accent\" data-value=\"auto\" title=\"Neutro\" aria-label=\"Neutro\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#38bdf8\" style=\"background:#38bdf8\" title=\"Cielo\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#a1a1aa\" style=\"background:#a1a1aa\" title=\"Gris\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#34d399\" style=\"background:#34d399\" title=\"Menta\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#2dd4bf\" style=\"background:#2dd4bf\" title=\"Teal\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#818cf8\" style=\"background:#818cf8\" title=\"Índigo\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#a78bfa\" style=\"background:#a78bfa\" title=\"Violeta\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#f59e0b\" style=\"background:#f59e0b\" title=\"Ámbar\"></button>\n              <button type=\"button\" class=\"accent-dot\" data-pref=\"ta_accent\" data-value=\"#fb7185\" style=\"background:#fb7185\" title=\"Rosa\"></button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"fontSize\">Tamaño de letra</label>\n            <div class=\"choice-row\">\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_font\" data-value=\"sm\" data-i18n=\"fontSm\">Compacto</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_font\" data-value=\"md\" data-i18n=\"fontMd\">Normal</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_font\" data-value=\"lg\" data-i18n=\"fontLg\">Grande</button>\n            </div>\n          </div>\n          <div class=\"settings-card\">\n            <label class=\"toggle-row\"><span data-i18n=\"compactSidebar\">Barra lateral compacta</span><input type=\"checkbox\" id=\"set-compact-sb\"></label>\n            <label class=\"toggle-row\"><span data-i18n=\"reduceMotion\">Reducir movimiento</span><input type=\"checkbox\" id=\"set-reduce-motion\"></label>\n          </div>\n        </div>\n\n        <div id=\"pane-behavior\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabBehavior\">Comportamiento</div>\n          <p class=\"settings-section-desc\" data-i18n=\"behaviorDesc\">Cómo envía, busca y confirma el workspace.</p>\n          <div class=\"settings-card\">\n            <label class=\"toggle-row\"><span data-i18n=\"enterToSend\">Enter envía el mensaje</span><input type=\"checkbox\" id=\"set-enter-send\" checked></label>\n            <label class=\"toggle-row\"><span data-i18n=\"autoSearch\">Buscar en la web por defecto</span><input type=\"checkbox\" id=\"set-auto-search\"></label>\n            <label class=\"toggle-row\"><span data-i18n=\"showTimestamps\">Mostrar hora en los mensajes</span><input type=\"checkbox\" id=\"set-show-time\"></label>\n            <label class=\"toggle-row\"><span data-i18n=\"confirmDeleteChat\">Confirmar al borrar un chat</span><input type=\"checkbox\" id=\"set-confirm-del\" checked></label>\n            <label class=\"toggle-row\"><span data-i18n=\"autoRead\">Leer en voz alta las respuestas</span><input type=\"checkbox\" id=\"set-auto-read\"></label>\n          </div>\n          <p class=\"settings-hint\" data-i18n=\"autoReadHint\">Al terminar cada respuesta, el navegador la lee. También puedes pulsar el altavoz del compositor o «Escuchar» en cada mensaje.</p>\n        </div>\n\n        <div id=\"pane-customize\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabCustomize\">Personalizar</div>\n          <p class=\"settings-section-desc\" data-i18n=\"customizeDesc\">Instrucciones propias y tono de respuesta.</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"toneLabel\">Tono</label>\n            <div class=\"choice-row\">\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_tone\" data-value=\"auto\" data-i18n=\"toneAuto\">Auto</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_tone\" data-value=\"direct\" data-i18n=\"toneDirect\">Directo</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_tone\" data-value=\"technical\" data-i18n=\"toneTechnical\">Técnico</button>\n              <button type=\"button\" class=\"choice-pill\" data-pref=\"ta_tone\" data-value=\"concise\" data-i18n=\"toneConcise\">Conciso</button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"systemPrompt\">Instrucción de sistema</label>\n            <textarea id=\"custom-system-prompt\" class=\"form-textarea\" placeholder=\"Cómo debe responder Personal AI…\"></textarea>\n          </div>\n          <div class=\"settings-card\">\n            <label class=\"toggle-row\"><span data-i18n=\"useDocsContext\">Usar documentos como memoria</span><input type=\"checkbox\" id=\"set-use-docs\" checked></label>\n            <label class=\"toggle-row\"><span data-i18n=\"adaptOn\">Adaptarse a mí</span><input type=\"checkbox\" id=\"set-adapt\" checked></label>\n          </div>\n          <p class=\"settings-hint\" data-i18n=\"adaptHint\">Personal recuerda cómo te llamas, lo que le pides que no olvide y los temas que sueles tratar. Dile «recuerda que…» o «olvida eso».</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"adaptSummary\">Lo que sé de ti</label>\n            <div id=\"adapt-summary\" class=\"settings-hint\">—</div>\n          </div>\n          <div id=\"adapt-notes\" class=\"settings-card\"></div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"adaptAdd\">Añadir un hecho</label>\n            <div style=\"display:flex;gap:6px\">\n              <input type=\"text\" id=\"adapt-note-input\" class=\"form-input\" style=\"flex:1\" data-i18n=\"adaptAddPh\" data-i18n-attr=\"placeholder\" placeholder=\"Recuerda que…\">\n              <button type=\"button\" id=\"adapt-note-btn\" class=\"topbar-action-btn primary\" data-i18n=\"save\">Guardar</button>\n            </div>\n          </div>\n          <button type=\"button\" id=\"adapt-forget-btn\" class=\"topbar-action-btn\" data-i18n=\"adaptForget\">Olvidar mi perfil</button>\n        </div>\n\n        \n        <div id=\"pane-providers\" class=\"settings-pane\">\n          <div class=\"settings-section-title\">供應商</div>\n          <p class=\"settings-section-desc\">連線到任何 OpenAI 相容的 <code>/chat/completions</code> 服務。金鑰只保存在這個瀏覽器，不會同步到 D1。</p>\n          <p class=\"settings-hint\" id=\"server-default-hint\">若部署設定了 <code>GROQ_API_KEY</code>，未新增供應商時會使用伺服器預設 Groq。</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\">使用中的供應商</label>\n            <div style=\"display:flex;gap:6px\">\n              <select id=\"provider-active-select\" class=\"form-input\" style=\"flex:1\"></select>\n              <button type=\"button\" id=\"provider-new-btn\" class=\"topbar-action-btn\">新增</button>\n            </div>\n          </div>\n          <div class=\"settings-card\">\n            <div class=\"settings-kv\">\n              <div class=\"settings-kv-label\">名稱</div>\n              <div class=\"settings-kv-control\"><input id=\"provider-name\" class=\"form-input\" type=\"text\" maxlength=\"60\" placeholder=\"Groq\"></div>\n            </div>\n            <div class=\"settings-kv\">\n              <div class=\"settings-kv-label\">Base URL</div>\n              <div class=\"settings-kv-control\"><input id=\"provider-base\" class=\"form-input\" type=\"url\" placeholder=\"https://api.groq.com/openai/v1\" autocomplete=\"off\"></div>\n            </div>\n            <div class=\"settings-kv\">\n              <div class=\"settings-kv-label\">API Key</div>\n              <div class=\"settings-kv-control\"><input id=\"provider-key\" class=\"form-input\" type=\"password\" placeholder=\"sk-…\" autocomplete=\"off\"></div>\n            </div>\n            <div class=\"settings-kv\">\n              <div class=\"settings-kv-label\">模型</div>\n              <div class=\"settings-kv-control\"><input id=\"provider-model\" class=\"form-input\" type=\"text\" list=\"provider-model-list\" placeholder=\"openai/gpt-oss-120b\" autocomplete=\"off\"><datalist id=\"provider-model-list\"></datalist></div>\n            </div>\n            <div class=\"settings-actions\" style=\"display:flex;gap:6px;flex-wrap:wrap\">\n              <button type=\"button\" id=\"provider-test-btn\" class=\"topbar-action-btn\">測試連線</button>\n              <button type=\"button\" id=\"provider-models-btn\" class=\"topbar-action-btn\">抓取模型</button>\n              <button type=\"button\" id=\"provider-save-btn\" class=\"topbar-action-btn primary\">儲存</button>\n              <button type=\"button\" id=\"provider-delete-btn\" class=\"topbar-action-btn btn-danger\">刪除</button>\n            </div>\n            <p id=\"provider-status\" class=\"settings-hint\" style=\"min-height:18px\"></p>\n          </div>\n          <p class=\"settings-hint\">只允許公開 HTTPS 位址。localhost、私有 IP、<code>.local</code>、<code>.internal</code> 會被拒絕。</p>\n        </div>\n\n        <div id=\"pane-plan\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabPlan\">Plan y facturación</div>\n          <p class=\"settings-section-desc\" data-i18n=\"planDesc\">Tu plan actual. El cobro con tarjeta llegará cuando se active Stripe.</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"currentPlan\">Plan actual</label>\n            <div><span class=\"plan-badge\" id=\"plan-current-badge\">FREE</span></div>\n          </div>\n          <p class=\"settings-hint\" data-i18n=\"planHint\">Free: 50.000 tokens/día. Enterprise: sin tope (cuentas propias). BYOK: clave Groq en el navegador, sin cuota.</p>\n          <a class=\"topbar-action-btn\" href=\"mailto:owner@personal-ai.workers.dev?subject=Personal%20AI%20Enterprise\" style=\"text-decoration:none;width:fit-content\" data-i18n=\"planContact\">Contactar para Enterprise</a>\n        </div>\n\n        <div id=\"pane-usage\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabUsage\">Uso</div>\n          <p class=\"settings-section-desc\" data-i18n=\"usageDesc\">Consumo diario y cuándo se reinicia el cupo.</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"usageUsed\">Tokens de hoy</label>\n            <div id=\"usage-used\" style=\"font-weight:650\">—</div>\n            <div class=\"usage-bar\"><span id=\"usage-bar-fill\"></span></div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"usageReset\">Reinicio disponible</label>\n            <div id=\"usage-reset\">00:00 UTC</div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"opsToday\">Actividad de hoy (servicio)</label>\n            <div class=\"ops-grid\">\n              <div class=\"ops-stat\"><b id=\"ops-chats\">—</b><span data-i18n=\"opsChats\">Chats</span></div>\n              <div class=\"ops-stat\"><b id=\"ops-images\">—</b><span data-i18n=\"opsImages\">Imágenes</span></div>\n              <div class=\"ops-stat\"><b id=\"ops-voice\">—</b><span data-i18n=\"opsVoice\">Voz</span></div>\n              <div class=\"ops-stat\"><b id=\"ops-ideas\">—</b><span data-i18n=\"opsIdeas\">Ideas</span></div>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"byok\">Clave Groq (BYOK)</label>\n            <input type=\"password\" id=\"user-groq-key\" class=\"form-input\" placeholder=\"gsk_…\" autocomplete=\"off\">\n            <span class=\"settings-hint\" data-i18n=\"byokHint\">Solo se guarda en este navegador.</span>\n          </div>\n        </div>\n\n        <div id=\"pane-ideas\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"ideas\">Qué quieres añadir</div>\n          <p class=\"settings-section-desc\" data-i18n=\"ideasDesc\">Cuéntale a Owner qué función, corrección o mejora quieres. Llega a owner@personal-ai.workers.dev y entra en el informe diario.</p>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"ideaCat\">Tipo</label>\n            <div class=\"choice-row\">\n              <button type=\"button\" class=\"choice-pill active\" data-idea-cat=\"feat\" data-i18n=\"ideaCatFeat\">Función</button>\n              <button type=\"button\" class=\"choice-pill\" data-idea-cat=\"fix\" data-i18n=\"ideaCatFix\">Corrección</button>\n              <button type=\"button\" class=\"choice-pill\" data-idea-cat=\"other\" data-i18n=\"ideaCatOther\">Otro</button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"ideas\">Idea</label>\n            <textarea id=\"idea-text\" class=\"form-input\" rows=\"5\" data-i18n=\"ideasPh\" data-i18n-attr=\"placeholder\" placeholder=\"Quiero que la IA…\"></textarea>\n          </div>\n          <div class=\"form-group\">\n            <label class=\"form-label\" data-i18n=\"ideasEmail\">Tu email (opcional)</label>\n            <input type=\"email\" id=\"idea-email\" class=\"form-input\" autocomplete=\"email\">\n          </div>\n          <input type=\"text\" class=\"hp-field\" id=\"idea-website\" name=\"website\" tabindex=\"-1\" autocomplete=\"off\" aria-hidden=\"true\">\n          <div class=\"settings-actions\">\n            <button type=\"button\" id=\"idea-send-btn\" class=\"topbar-action-btn primary\" data-i18n=\"ideasSend\">Enviar a Owner</button>\n          </div>\n          <p class=\"settings-hint\" id=\"idea-status\"></p>\n        </div>\n\n        <div id=\"pane-data\" class=\"settings-pane\">\n          <div class=\"settings-section-title\" data-i18n=\"tabData\">Controles de datos</div>\n          <p class=\"settings-section-desc\" data-i18n=\"dataDesc\">Exportar, vaciar o no persistir el workspace en este navegador.</p>\n          <div class=\"settings-card\">\n            <label class=\"toggle-row\"><span data-i18n=\"sessionOnly\">No guardar chats al cerrar</span><input type=\"checkbox\" id=\"set-ephemeral\"></label>\n          </div>\n          <p class=\"settings-hint\" data-i18n=\"sessionOnlyHint\">Si está activo, el historial no se escribe en localStorage.</p>\n          <div class=\"settings-card\">\n            <div class=\"settings-actions\">\n              <button type=\"button\" id=\"btn-export-all\" class=\"topbar-action-btn\" data-i18n=\"exportAll\">Exportar chats y documentos</button>\n            </div>\n            <div class=\"settings-actions\">\n              <button type=\"button\" id=\"btn-clear-chats\" class=\"topbar-action-btn\" data-i18n=\"clearChats\">Vaciar historial de chats</button>\n            </div>\n            <div class=\"settings-actions\">\n              <button type=\"button\" id=\"btn-clear-docs\" class=\"topbar-action-btn\" data-i18n=\"empty\">Vaciar documentos</button>\n            </div>\n          </div>\n          <div class=\"settings-card\">\n            <div class=\"settings-actions\" style=\"display:flex;gap:6px;flex-wrap:wrap\">\n              <button type=\"button\" id=\"sync-now-btn\" class=\"topbar-action-btn\">立即同步</button>\n              <button type=\"button\" id=\"settings-logout-btn\" class=\"topbar-action-btn\">登出</button>\n            </div>\n            <p id=\"sync-status\" class=\"settings-hint\" style=\"min-height:18px\">同步尚未啟動</p>\n          </div>\n        </div>\n      </div>\n    </div>\n    <div class=\"modal-footer\">\n      <span id=\"settings-status\" class=\"settings-status\"></span>\n      <button class=\"settings-foot-btn\" data-modal=\"modal-settings\" type=\"button\" data-i18n=\"cancel\">Cancelar</button>\n      <button id=\"save-settings-btn\" class=\"settings-foot-btn primary\" type=\"button\" data-i18n=\"save\">Guardar</button>\n    </div>\n  </div>\n</div>\n\n<div class=\"modal-backdrop\" id=\"modal-profile\">\n  <div class=\"modal-card\">\n    <div class=\"modal-header\"><div class=\"modal-title\">Cuenta</div><button class=\"modal-close-btn\" data-modal=\"modal-profile\" type=\"button\">✕</button></div>\n    <div class=\"modal-body\" id=\"profile-modal-body\"></div>\n  </div>\n</div>\n\n<div class=\"modal-backdrop\" id=\"modal-knowledge\">\n  <div class=\"modal-card\">\n    <div class=\"modal-header\"><div class=\"modal-title\">Nuevo documento</div><button class=\"modal-close-btn\" data-modal=\"modal-knowledge\" type=\"button\">✕</button></div>\n    <div class=\"modal-body\">\n      <div class=\"form-group\">\n        <label class=\"form-label\">Título</label>\n        <input type=\"text\" id=\"train-title\" class=\"form-input\" placeholder=\"Especificación, notas, reglas…\">\n      </div>\n      <div class=\"form-group\">\n        <label class=\"form-label\">Contenido</label>\n        <textarea id=\"train-content\" class=\"form-textarea\" placeholder=\"Pega el texto…\"></textarea>\n      </div>\n      <div style=\"display:flex;justify-content:space-between;align-items:center\">\n        <input type=\"file\" id=\"import-rag-file\" style=\"display:none\" multiple accept=\".txt,.md,.json\">\n        <button type=\"button\" id=\"import-docs-btn\" class=\"topbar-action-btn\">Importar archivos</button>\n        <button id=\"save-knowledge-btn\" class=\"topbar-action-btn primary\" type=\"button\">Guardar</button>\n      </div>\n      <div>\n        <div style=\"display:flex;justify-content:space-between;margin-bottom:8px\">\n          <span class=\"form-label\">Activos (<span id=\"knowledge-count\">0</span>/20)</span>\n          <button id=\"clear-rag-btn\" type=\"button\" style=\"background:none;border:none;color:var(--red);font-size:0.72rem;cursor:pointer\">Vaciar</button>\n        </div>\n        <div id=\"knowledge-list-box\"></div>\n      </div>\n    </div>\n  </div>\n</div>\n\n<div class=\"cmd-overlay\" id=\"cmd-overlay\" role=\"dialog\" aria-label=\"Paleta de comandos\">\n  <div class=\"cmd-box\">\n    <input id=\"cmd-input\" type=\"search\" autocomplete=\"off\" placeholder=\"Ir a un comando…\" data-i18n=\"palettePh\" data-i18n-attr=\"placeholder\">\n    <div id=\"cmd-list\"></div>\n  </div>\n</div>\n\n</div>";


  var currentChatId = Date.now().toString();
  var chats = {};
  try {
    var raw = localStorage.getItem('ta_ai_chats');
    if (raw) chats = JSON.parse(raw);
    if (!chats || typeof chats !== 'object' || Array.isArray(chats)) chats = {};
  } catch(e) { chats = {}; }

  var isGenerating = false;
  var isWebSearch = localStorage.getItem('ta_auto_search') === '1';
  var isImageMode = false;
  var currentLength = localStorage.getItem('ta_len_mode') || 'normal';
  var attachedFile = null;
  var currentUser = { name: 'Owner' };
  var authToken = 'cookie';
  var serverDefaultProvider = null;
  var serverDefaultModel = '';
  (function consumeSocialCallback() {
    try {
      var params = new URLSearchParams(location.search);
      var state = params.get('state') || '';
      if (params.get('auth') !== 'x_callback' && state.indexOf('x_oauth_') !== 0) return;
      var code = params.get('code');
      history.replaceState({}, document.title, '/');
      if (!code) return;
      fetch('/api/auth/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, redirectUri: location.origin + '/?auth=x_callback' })
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok || !res.d.token) return;
          localStorage.setItem('personal_ai_token', res.d.token);
          localStorage.setItem('personal_ai_user', JSON.stringify(res.d.user));
          location.reload();
        }).catch(function () {});
    } catch (e) {}
  })();
  var knowledge = [];
  try {
    var rawK = localStorage.getItem('ta_knowledge');
    if (rawK) knowledge = JSON.parse(rawK);
    if (!Array.isArray(knowledge)) knowledge = [];
  } catch(e) { knowledge = []; }
  var customProviders = [];
  try {
    var rawC = localStorage.getItem('ta_providers');
    if (rawC) customProviders = JSON.parse(rawC);
    if (!Array.isArray(customProviders)) customProviders = [];
  } catch(e) { customProviders = []; }

  var documents = [];
  try {
    var rawD = localStorage.getItem('ta_documents');
    if (rawD) documents = JSON.parse(rawD);
    if (!Array.isArray(documents)) documents = [];
  } catch(e) { documents = []; }
  if (!documents.length && knowledge.length) {
    documents = knowledge.map(function(k, i) {
      return { id: 'doc_mig_' + i, title: k.title || 'Nota', content: k.content || '', type: 'note', created: Date.now(), projectId: null };
    });
  }

  var projects = [];
  try {
    var rawP = localStorage.getItem('ta_projects');
    if (rawP) projects = JSON.parse(rawP);
    if (!Array.isArray(projects)) projects = [];
  } catch(e) { projects = []; }
  var currentProjectId = null;
  try {
    var savedProj = localStorage.getItem('ta_project_active');
    if (savedProj && projects.some(function(p) { return p && p.id === savedProj; })) currentProjectId = savedProj;
  } catch(eAp) {}
  var sidebarView = 'chats';
  var publishedArtifacts = [];
  var abortCtl = null;
  var selectedModel = localStorage.getItem('ta_model') || 'openai/gpt-oss-120b';
  if (selectedModel === 'qwen/qwen3.6-27b' || selectedModel === 'qwen/qwen3.6') {
    selectedModel = 'qwen/qwen3.8-27b';
    try { localStorage.setItem('ta_model', selectedModel); } catch(e) {}
  }
  var MODELS = [
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', desc: 'm120' },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', desc: 'm27' },
    { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', desc: 'm20' }
  ];
  var PROVIDERS_KEY = 'ta_providers_v1';
  var PROVIDER_ACTIVE_KEY = 'ta_provider_active';
  function readProviders() {
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
  function activeProvider() {
    var list = readProviders();
    if (!list.length) return null;
    var id = localStorage.getItem(PROVIDER_ACTIVE_KEY) || '';
    return providerById(id) || list[0];
  }
  function ensureModel(id) {
    if (!id) return;
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return;
    MODELS.push({ id: id, name: id, desc: '' });
  }
  function providerFormValues() {
    var get = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    return { name: get('provider-name'), baseUrl: get('provider-base'), apiKey: get('provider-key'), model: get('provider-model') };
  }
  function setProviderStatus(text, bad) {
    var el = document.getElementById('provider-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--green)';
  }
  function loadProviderForm(id) {
    var p = id ? providerById(id) : null;
    var set = function(elId, value) { var el = document.getElementById(elId); if (el) el.value = value || ''; };
    set('provider-name', p ? p.name : '');
    set('provider-base', p ? p.baseUrl : '');
    set('provider-key', p ? p.apiKey : '');
    set('provider-model', p ? p.model : '');
    setProviderStatus(p ? ('使用中：' + (p.name || p.baseUrl)) : '尚未新增供應商', false);
  }
  function refreshProviderSelect() {
    var sel = document.getElementById('provider-active-select');
    if (!sel) return;
    var list = readProviders();
    var active = localStorage.getItem(PROVIDER_ACTIVE_KEY) || (list[0] && list[0].id) || '';
    sel.innerHTML = list.map(function(p) {
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name || p.baseUrl) + '</option>';
    }).join('') + '<option value="__new">＋ 新增供應商</option>';
    sel.value = list.some(function(p) { return p.id === active; }) ? active : (list[0] ? list[0].id : '__new');
    loadProviderForm(sel.value === '__new' ? '' : sel.value);
  }
  function saveProvider() {
    var v = providerFormValues();
    if (!v.name) v.name = '供應商';
    if (!/^https:\/\//i.test(v.baseUrl)) { setProviderStatus('Base URL 必須是 HTTPS', true); return; }
    try { new URL(v.baseUrl); } catch(e) { setProviderStatus('Base URL 格式不正確', true); return; }
    if (!v.apiKey || v.apiKey.length < 8) { setProviderStatus('請填寫有效的 API Key', true); return; }
    if (!v.model) { setProviderStatus('請填寫模型 ID', true); return; }
    var list = readProviders();
    var sel = document.getElementById('provider-active-select');
    var currentId = sel && sel.value !== '__new' ? sel.value : '';
    var existing = currentId ? providerById(currentId) : null;
    var item = { id: existing ? existing.id : ('p' + Date.now()), name: v.name, baseUrl: v.baseUrl.replace(/\/+$/, ''), apiKey: v.apiKey, model: v.model };
    if (existing) {
      for (var i = 0; i < list.length; i++) if (list[i].id === existing.id) list[i] = item;
    } else list.push(item);
    writeProviders(list);
    localStorage.setItem(PROVIDER_ACTIVE_KEY, item.id);
    ensureModel(item.model);
    if (sel) sel.value = item.id;
    setModel(item.model);
    setProviderStatus('已儲存：' + item.name, false);
  }
  function deleteProvider() {
    var sel = document.getElementById('provider-active-select');
    var id = sel ? sel.value : '';
    if (!id || id === '__new') { setProviderStatus('目前沒有可刪除的供應商', true); return; }
    if (!confirm('刪除這個供應商設定？')) return;
    var list = readProviders().filter(function(p) { return p.id !== id; });
    writeProviders(list);
    localStorage.setItem(PROVIDER_ACTIVE_KEY, list[0] ? list[0].id : '');
    refreshProviderSelect();
    setProviderStatus('已刪除', false);
  }
  async function fetchProviderModels(apply) {
    var v = providerFormValues();
    if (!v.baseUrl || !v.apiKey) { setProviderStatus('請先填寫 Base URL 與 API Key', true); return; }
    setProviderStatus('正在連線…', false);
    try {
      var res = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: v.baseUrl, apiKey: v.apiKey }) });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      var models = Array.isArray(data.models) ? data.models : [];
      var list = document.getElementById('provider-model-list');
      if (list) list.innerHTML = models.map(function(m) { return '<option value="' + escapeHtml(m) + '"></option>'; }).join('');
      if (apply && models.length) {
        var input = document.getElementById('provider-model');
        if (input) input.value = models[0];
      }
      setProviderStatus('連線成功，取得 ' + models.length + ' 個模型', false);
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
  var SYNC_META_KEY = 'ta_sync_meta_v1';
  var syncMeta = { enabled: false, lastCursor: 0, known: { chat: [], doc: [], project: [] }, sent: {}, values: {}, timer: 0, applying: false, busy: false };
  try {
    var savedSync = JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
    if (savedSync && typeof savedSync === 'object') {
      syncMeta.lastCursor = Number(savedSync.lastCursor) || 0;
      syncMeta.sent = savedSync.sent && typeof savedSync.sent === 'object' ? savedSync.sent : {};
      syncMeta.values = savedSync.values && typeof savedSync.values === 'object' ? savedSync.values : {};
      if (savedSync.known && typeof savedSync.known === 'object') {
        ['chat','doc','project'].forEach(function(k) { syncMeta.known[k] = Array.isArray(savedSync.known[k]) ? savedSync.known[k] : []; });
      }
    }
  } catch(eSync) {}
  function saveSyncMeta() {
    try { localStorage.setItem(SYNC_META_KEY, JSON.stringify({ lastCursor: syncMeta.lastCursor, known: syncMeta.known, sent: syncMeta.sent, values: syncMeta.values })); } catch(e) {}
  }
  function setSyncStatus(text, bad) {
    var el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = bad ? 'var(--red)' : 'var(--muted)';
  }
  function syncJson(value) {
    try { return JSON.stringify(value); } catch(e) { return ''; }
  }
  function addSyncChange(changes, key, value, updatedAt, force) {
    if (!force && syncMeta.sent[key] && Number(syncMeta.sent[key]) >= updatedAt) return;
    changes.push({ key: key, value: value, updatedAt: updatedAt, deleted: false });
  }
  function collectSyncChanges(force) {
    var changes = [];
    var present = { chat: {}, doc: {}, project: {} };
    var now = Date.now();
    Object.keys(chats).forEach(function(id) {
      var c = chats[id];
      if (!c || c.ephemeral) return;
      present.chat[id] = true;
      var at = Number(c.updatedAt || c.at || now) || now;
      addSyncChange(changes, 'chat:' + id, syncJson(c), at, force);
    });
    documents.forEach(function(d) {
      if (!d || !d.id) return;
      present.doc[d.id] = true;
      var at = Number(d.updatedAt || now) || now;
      addSyncChange(changes, 'doc:' + d.id, syncJson(d), at, force);
    });
    projects.forEach(function(pr) {
      if (!pr || !pr.id) return;
      present.project[pr.id] = true;
      var at = Number(pr.updatedAt || now) || now;
      addSyncChange(changes, 'project:' + pr.id, syncJson(pr), at, force);
    });
    [['prompt','favs','ta_prompt_favs'],['prompt','recent','ta_prompt_recent'],['setting','custom_prompt','ta_custom_prompt'],['setting','tone','ta_tone'],['setting','len_mode','ta_len_mode'],['setting','auto_search','ta_auto_search'],['setting','use_docs','ta_use_docs']].forEach(function(row) {
      var key = row[0] + ':' + row[1];
      var value = '';
      try { value = localStorage.getItem(row[2]) || ''; } catch(e) {}
      if (!force && syncMeta.values[key] === value) return;
      changes.push({ key: key, value: value, updatedAt: now, deleted: false });
    });
    ['chat','doc','project'].forEach(function(type) {
      (syncMeta.known[type] || []).forEach(function(id) {
        if (present[type][id]) return;
        changes.push({ key: type + ':' + id, value: '', updatedAt: now, deleted: true });
      });
    });
    return changes;
  }
  async function pullSync() {
    if (!syncMeta.enabled || syncMeta.busy) return false;
    syncMeta.busy = true;
    try {
      var res = await fetch('/api/sync?since=' + encodeURIComponent(String(syncMeta.lastCursor || 0)) + '&limit=1000', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) { setSyncStatus('已同步', false); return true; }
      syncMeta.applying = true;
      var touchedChats = false, touchedDocs = false, touchedProjects = false;
      items.forEach(function(item) {
        var key = String(item.key || '');
        var parts = key.split(':');
        var type = parts[0], id = parts.slice(1).join(':');
        if (!id) return;
        if (item.deleted) {
          if (type === 'chat' && chats[id]) { delete chats[id]; touchedChats = true; }
          if (type === 'doc') { var nd = documents.filter(function(d) { return d.id !== id; }); if (nd.length !== documents.length) { documents = nd; touchedDocs = true; } }
          if (type === 'project') { var np = projects.filter(function(pr) { return pr.id !== id; }); if (np.length !== projects.length) { projects = np; touchedProjects = true; } }
        } else if (type === 'chat') {
          try {
            var chat = JSON.parse(item.value);
            if (!chats[id] || Number(item.updatedAt) >= Number(chats[id].updatedAt || 0)) { chats[id] = chat; touchedChats = true; }
          } catch(e) {}
        } else if (type === 'doc') {
          try {
            var doc = JSON.parse(item.value);
            var found = false;
            for (var i = 0; i < documents.length; i++) if (documents[i].id === id) { found = true; if (Number(item.updatedAt) >= Number(documents[i].updatedAt || 0)) documents[i] = doc; break; }
            if (!found) { documents.push(doc); touchedDocs = true; }
          } catch(e) {}
        } else if (type === 'project') {
          try {
            var proj = JSON.parse(item.value);
            var pfound = false;
            for (var j = 0; j < projects.length; j++) if (projects[j].id === id) { pfound = true; if (Number(item.updatedAt) >= Number(projects[j].updatedAt || 0)) projects[j] = proj; break; }
            if (!pfound) { projects.push(proj); touchedProjects = true; }
          } catch(e) {}
        } else if (type === 'prompt') {
          var pkey = id === 'favs' ? 'ta_prompt_favs' : id === 'recent' ? 'ta_prompt_recent' : '';
          if (pkey) { try { localStorage.setItem(pkey, item.value || '[]'); } catch(e) {} }
        } else if (type === 'setting') {
          var skey = { custom_prompt: 'ta_custom_prompt', tone: 'ta_tone', len_mode: 'ta_len_mode', auto_search: 'ta_auto_search', use_docs: 'ta_use_docs' }[id];
          if (skey) { try { localStorage.setItem(skey, item.value || ''); } catch(e) {} }
        }
        syncMeta.sent[key] = Number(item.updatedAt) || 0;
        syncMeta.lastCursor = Math.max(syncMeta.lastCursor || 0, Number(item.updatedAt) || 0);
      });
      if (touchedChats) { saveChats(); renderSidebar(); if (chats[currentChatId]) loadChatView(); }
      if (touchedDocs) { saveDocuments(); renderSidebar(); }
      if (touchedProjects) { saveProjects(); renderSidebar(); }
      saveSyncMeta();
      setSyncStatus('已同步 ' + items.length + ' 項', false);
      return true;
    } catch(e) {
      setSyncStatus('同步失敗：' + (e && e.message ? e.message : '網路錯誤'), true);
      return false;
    } finally {
      syncMeta.busy = false;
      syncMeta.applying = false;
    }
  }
  async function pushSync(force) {
    if (!syncMeta.enabled || syncMeta.busy) return false;
    var changes = collectSyncChanges(!!force);
    if (!changes.length) { setSyncStatus('已同步', false); return true; }
    syncMeta.busy = true;
    try {
      var res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ changes: changes }) });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      changes.forEach(function(ch) {
        if (!ch.deleted) {
          syncMeta.sent[ch.key] = ch.updatedAt;
          syncMeta.values[ch.key] = ch.value;
        }
      });
      var present = { chat: {}, doc: {}, project: {} };
      Object.keys(chats).forEach(function(id) { present.chat[id] = true; });
      documents.forEach(function(d) { if (d && d.id) present.doc[d.id] = true; });
      projects.forEach(function(pr) { if (pr && pr.id) present.project[pr.id] = true; });
      syncMeta.known = { chat: Object.keys(present.chat), doc: Object.keys(present.doc), project: Object.keys(present.project) };
      saveSyncMeta();
      setSyncStatus('已同步 ' + changes.length + ' 項', false);
      return true;
    } catch(e) {
      setSyncStatus('同步失敗：' + (e && e.message ? e.message : '網路錯誤'), true);
      return false;
    } finally {
      syncMeta.busy = false;
    }
  }
  function scheduleSync() {
    if (!syncMeta.enabled || syncMeta.applying) return;
    clearTimeout(syncMeta.timer);
    syncMeta.timer = setTimeout(function() { pushSync(false); }, 1800);
  }
  async function syncBootstrap() {
    if (!syncMeta.enabled) { setSyncStatus('此部署未啟用 D1 同步', false); return; }
    await pullSync();
    await pushSync(false);
  }
  function syncNow() {
    if (!syncMeta.enabled) { setSyncStatus('此部署未啟用 D1 同步', true); return; }
    setSyncStatus('同步中…', false);
    pullSync().then(function() { return pushSync(true); });
  }

  var TONES = {
    auto: '',
    direct: 'Responde de forma directa y sin rodeos.',
    technical: 'Prioriza precisión técnica, nombres de APIs y código.',
    concise: 'Responde en el mínimo de palabras útil.'
  };
  function t(k) { return (window.TA && TA.t) ? TA.t(k) : k; }
  var THEME_COLORS = { dark: '#000000', gray: '#18181b', dim: '#0d1117', navy: '#0b1220', light: '#f4f4f5', paper: '#f4efe6', hacker: '#000000', cyberpunk: '#0d021a', sunset: '#1f101d', ocean: '#061325', forest: '#07130e', rose: '#fff1f2', lavender: '#f8f6fc' };
  var ACCENT_OK = { 'auto': 1, '#38bdf8': 1, '#a1a1aa': 1, '#34d399': 1, '#2dd4bf': 1, '#818cf8': 1, '#a78bfa': 1, '#f59e0b': 1, '#fb7185': 1 };
  function applyAppearance() {
    var theme = localStorage.getItem('ta_theme') || 'dark';
    var resolved = theme;
    if (theme === 'system') {
      resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    if (!THEME_COLORS[resolved]) resolved = 'dark';
    var accent = localStorage.getItem('ta_accent') || 'auto';
    if (!ACCENT_OK[accent]) accent = 'auto';
    document.documentElement.setAttribute('data-theme', resolved);
    if (accent === 'auto') document.documentElement.style.removeProperty('--blue');
    else document.documentElement.style.setProperty('--blue', accent);
    document.documentElement.setAttribute('data-font', localStorage.getItem('ta_font') || 'md');
    document.documentElement.classList.toggle('compact-sb', localStorage.getItem('ta_compact_sb') === '1');
    document.documentElement.classList.toggle('reduce-motion', localStorage.getItem('ta_reduce_motion') === '1');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved] || '#000000');
  }
  applyAppearance();
  if (window.matchMedia) {
    try { window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyAppearance); } catch (e) {}
  }
  if (localStorage.getItem('ta_ephemeral') === '1') chats = {};
  var SEND_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var STOP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/></svg>';
  var currentArtifact = null;
  var artPreviewTimer = 0;
  var artifactDest = 'artifact';
  var shareReadOnly = false;
  var showArchived = false;

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function parseMarkdownFull(src) {
    if (!src) return '';
    var text = src;
    var codeBlocks = [];
    text = text.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, function(match, lang, code) {
      var placeholder = '§§CODEBLOCK_' + codeBlocks.length + '§§';
      var safeLang = lang.trim() || 'code';
      var html = '<div class="code-block-box"><div class="code-block-header"><span>' + escapeHtml(safeLang) + '</span>' +
        '<button class="code-copy-btn" data-code="' + encodeURIComponent(code) + '">Copiar</button></div>' +
        '<pre class="code-block-pre"><code>' + escapeHtml(code) + '</code></pre></div>';
      codeBlocks.push(html);
      return placeholder;
    });
    text = escapeHtml(text);
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, url) {
      return '<div class="ai-image-card"><img src="' + url + '" alt="' + alt + '" class="ai-image-img" data-img-url="' + url + '" loading="lazy">' +
        '<div class="ai-image-footer"><span style="font-size:0.75rem;font-weight:600">' + alt + '</span>' +
        '<a href="' + url + '" target="_blank" download="personal-ai-visual.jpg" class="topbar-action-btn" style="text-decoration:none;padding:3px 8px;font-size:0.7rem">Descargar</a></div></div>';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--blue);text-decoration:none">$1</a>');
    var lines = text.split(/\r?\n/);
    var inTable = false; var tableRows = []; var newLines = [];
    function buildHtmlTable(rows) {
      if (!rows.length) return '';
      var hasSep = rows.some(function(r) { return r.type === 'sep'; });
      var html = '<div class="table-wrapper"><table class="ta-table">';
      var headerDone = false; var tbodyOpen = false;
      for (var r = 0; r < rows.length; r++) {
        var item = rows[r];
        if (item.type === 'sep') { headerDone = true; continue; }
        if (!headerDone && hasSep && r === 0) {
          html += '<thead><tr>';
          for (var c = 0; c < item.cells.length; c++) html += '<th>' + item.cells[c] + '</th>';
          html += '</tr></thead>';
        } else {
          if (!tbodyOpen) { html += '<tbody>'; tbodyOpen = true; }
          html += '<tr>';
          for (var c2 = 0; c2 < item.cells.length; c2++) html += '<td>' + item.cells[c2] + '</td>';
          html += '</tr>';
        }
      }
      if (tbodyOpen) html += '</tbody>';
      return html + '</table></div>';
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) inTable = true;
        if (/^\|(\s*[-:]+[-| :]*)\|$/.test(line)) tableRows.push({ type: 'sep' });
        else tableRows.push({ type: 'row', cells: line.slice(1, -1).split('|').map(function(c) { return c.trim(); }) });
      } else {
        if (inTable) { newLines.push(buildHtmlTable(tableRows)); tableRows = []; inTable = false; }
        newLines.push(lines[i]);
      }
    }
    if (inTable) newLines.push(buildHtmlTable(tableRows));
    text = newLines.join('\n');
    text = text.replace(/(?:^|\n)(?:&gt;|>)\s*([\s\S]*?)(?=\n\n|\n(?!&gt;|>)|$)/g, function(match, quoteContent) {
      return '\n<blockquote class="ta-blockquote">' + quoteContent.replace(/^(?:&gt;|>)\s?/gm, '') + '</blockquote>\n';
    });
    text = text.replace(/^(?:---|___|\*\*\*)\s*$/gm, '<hr class="ta-hr">');
    text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>').replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^# (.*$)/gim, '<h1>$1</h1>');
    text = text.replace(/`([^`]+)`/g, '<code class="ta-inline-code">$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/(?:^|\n)[-•*]\s+([\s\S]*?)(?=\n\n|\n[^-•*\s]|$)/g, function(match) {
      var items = match.trim().split(/\n[-•*]\s+/);
      var listHtml = '<ul class="ta-ul">';
      for (var k = 0; k < items.length; k++) {
        var it = items[k].replace(/^[-•*]\s+/, '').trim();
        if (it) listHtml += '<li>' + it + '</li>';
      }
      return '\n' + listHtml + '</ul>\n';
    });
    text = text.replace(/(?:^|\n)\d+\.\s+([\s\S]*?)(?=\n\n|\n(?!\d+\.)|$)/g, function(match) {
      var items = match.trim().split(/\n\d+\.\s+/);
      var listHtml = '<ol class="ta-ol">';
      for (var k = 0; k < items.length; k++) {
        var it = items[k].replace(/^\d+\.\s+/, '').trim();
        if (it) listHtml += '<li>' + it + '</li>';
      }
      return '\n' + listHtml + '</ol>\n';
    });
    var blocks = text.split(/\n{2,}/);
    text = blocks.map(function(b) {
      var trimmed = b.trim();
      if (!trimmed) return '';
      if (/^<(div|table|blockquote|ul|ol|h[1-6]|hr|pre)/i.test(trimmed) || /^§§CODEBLOCK_\d+§§$/.test(trimmed)) return trimmed;
      return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
    }).join('\n\n');
    for (var c = 0; c < codeBlocks.length; c++) text = text.replace('§§CODEBLOCK_' + c + '§§', codeBlocks[c]);
    return text;
  }

  // Allowlist HTML sanitizer for model/shared content rendered with innerHTML.
  var SAFE_TAGS = { A:1, ABBR:1, B:1, BLOCKQUOTE:1, BR:1, BUTTON:1, CODE:1, DEL:1, DETAILS:1, DIV:1, EM:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, HR:1, I:1, IMG:1, INPUT:1, KBD:1, LI:1, MARK:1, OL:1, P:1, PRE:1, S:1, SMALL:1, SPAN:1, STRONG:1, SUB:1, SUMMARY:1, SUP:1, TABLE:1, TBODY:1, TD:1, TFOOT:1, TH:1, THEAD:1, TR:1, U:1, UL:1 };
  var DROP_TAGS = { SCRIPT:1, STYLE:1, IFRAME:1, OBJECT:1, EMBED:1, LINK:1, META:1, BASE:1, FORM:1, TEXTAREA:1, SELECT:1, SVG:1, MATH:1, TEMPLATE:1, NOSCRIPT:1, FRAME:1, FRAMESET:1, AUDIO:1, VIDEO:1, SOURCE:1, PORTAL:1 };
  var SAFE_ATTRS = { href:1, src:1, alt:1, title:1, 'class':1, style:1, target:1, rel:1, download:1, loading:1, colspan:1, rowspan:1, align:1, start:1, type:1, checked:1, disabled:1, open:1 };
  function safeUrl(v, isImg) {
    var u = String(v || '').replace(/[\u0000-\u0020\u007f-\u009f]+/g, '');
    if (/^(https?:|mailto:|#|\/(?!\/)|\.\/)/i.test(u)) return true;
    if (isImg && /^(data:image\/(png|jpe?g|gif|webp);|blob:)/i.test(u)) return true;
    return !/^[a-z][a-z0-9+.\-]*:/i.test(u) && u.indexOf('//') !== 0;
  }
  function sanitizeHtml(html) {
    // DOMParser documents have no browsing context: nothing runs or loads while we clean.
    var doc = new DOMParser().parseFromString('<!DOCTYPE html><body>' + String(html || ''), 'text/html');
    var root = doc.body;
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.nodeType === 8) { el.remove(); continue; }
        if (el.nodeType !== 1) continue;
        var tag = el.tagName;
        if (DROP_TAGS[tag]) { el.remove(); continue; }
        if (!SAFE_TAGS[tag]) { walk(el); while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); continue; }
        Array.prototype.slice.call(el.attributes).forEach(function (a) {
          var n = a.name.toLowerCase();
          if (!(SAFE_ATTRS[n] || /^data-[\w-]+$/.test(n))) { el.removeAttribute(a.name); return; }
          if ((n === 'href' || n === 'src') && !safeUrl(a.value, tag === 'IMG')) { el.removeAttribute(a.name); return; }
          if (n.indexOf('data-') === 0 && /^\s*javascript:/i.test(a.value)) { el.removeAttribute(a.name); return; }
          if (n === 'style' && /url\s*\(|expression|@import|position\s*:\s*fixed/i.test(a.value)) el.removeAttribute(a.name);
        });
        if (tag === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() !== 'checkbox') { el.remove(); continue; }
        if (tag === 'INPUT') el.setAttribute('disabled', '');
        if (tag === 'BUTTON') el.setAttribute('type', 'button');
        if (tag === 'A' && el.getAttribute('target')) el.setAttribute('rel', 'noopener noreferrer');
        walk(el);
      }
    })(root);
    return root.innerHTML;
  }
  function renderMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      try {
        var rawHtml = marked.parse(text, { gfm: true, breaks: true });
        rawHtml = rawHtml.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="table-wrapper"><table class="ta-table">$1</table></div>');
        rawHtml = rawHtml.replace(/<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g, function(match, lang, code) {
          var safeLang = (lang || 'code').trim();
          var rawCode = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
          return '<div class="code-block-box"><div class="code-block-header"><span>' + escapeHtml(safeLang) + '</span>' +
            '<button class="code-copy-btn" data-code="' + encodeURIComponent(rawCode) + '">Copiar</button></div>' +
            '<pre class="code-block-pre"><code>' + code + '</code></pre></div>';
        });
        rawHtml = rawHtml.replace(/<img\s+src="([^"]*)"\s+alt="([^"]*)"[^>]*>/g, function(match, src, alt) {
          return '<div class="ai-image-card"><img src="' + src + '" alt="' + alt + '" class="ai-image-img" data-img-url="' + src + '" loading="lazy">' +
            '<div class="ai-image-footer"><span style="font-size:0.75rem;font-weight:600">' + alt + '</span>' +
            '<a href="' + src + '" target="_blank" download="personal-ai-visual.jpg" class="topbar-action-btn" style="text-decoration:none;padding:3px 8px;font-size:0.7rem">Descargar</a></div></div>';
        });
        return sanitizeHtml(rawHtml);
      } catch(e) {}
    }
    return sanitizeHtml(parseMarkdownFull(text));
  }

  var currentUtterance = null;
  var speakKeepAlive = null;
  var speakQueue = [];
  var speakActiveBtn = null;

  function resetSpeakButtons() {
    document.querySelectorAll('.speak-msg-btn').forEach(function(b) {
      b.classList.remove('speaking');
      b.innerHTML = '<span>' + t('listen') + '</span>';
    });
    var dockSpeak = document.getElementById('speak-last-btn');
    if (dockSpeak) dockSpeak.classList.remove('speaking');
  }

  function stopSpeakKeepAlive() {
    if (speakKeepAlive) { clearInterval(speakKeepAlive); speakKeepAlive = null; }
  }

  function startSpeakKeepAlive() {
    stopSpeakKeepAlive();
    speakKeepAlive = setInterval(function() {
      if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
        stopSpeakKeepAlive();
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 8000);
  }

  function uiLangBcp47() {
    var id = (window.TA && TA.lang) ? TA.lang() : 'es';
    var map = {
      es: 'es-ES', en: 'en-US', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ca: 'ca-ES',
      zh: 'zh-CN', 'zh-TW': 'zh-TW', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', ru: 'ru-RU',
      nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR', vi: 'vi-VN', th: 'th-TH', uk: 'uk-UA', he: 'he-IL',
      sv: 'sv-SE', da: 'da-DK', fi: 'fi-FI', nb: 'nb-NO', cs: 'cs-CZ', hu: 'hu-HU', ro: 'ro-RO',
      el: 'el-GR', id: 'id-ID', ms: 'ms-MY', fil: 'fil-PH', hr: 'hr-HR', bg: 'bg-BG', fa: 'fa-IR',
      ur: 'ur-PK', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN'
    };
    return map[id] || 'es-ES';
  }
  function pickUiVoice() {
    var want = uiLangBcp47().toLowerCase();
    var prefix = want.slice(0, 2);
    var voices = Array.prototype.slice.call(window.speechSynthesis.getVoices() || []);
    var exact = voices.filter(function(v) { return (v.lang || '').toLowerCase() === want; });
    if (exact.length) return exact[0];
    var pref = voices.filter(function(v) { return (v.lang || '').toLowerCase().indexOf(prefix) === 0; });
    if (pref.length) return pref[0];
    for (var j = 0; j < voices.length; j++) {
      if (voices[j].default) return voices[j];
    }
    return voices[0] || null;
  }

  function splitSpeakChunks(text) {
    var max = 180;
    var parts = [];
    var rest = (text || '').replace(/\s+/g, ' ').trim();
    while (rest.length > max) {
      var slice = rest.slice(0, max);
      var cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '), slice.lastIndexOf(', '), slice.lastIndexOf(' '));
      if (cut < 40) cut = max;
      parts.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  }

  function stopSpeaking() {
    speakQueue = [];
    speakActiveBtn = null;
    currentUtterance = null;
    stopSpeakKeepAlive();
    try { window.speechSynthesis.cancel(); } catch (e) {}
    resetSpeakButtons();
  }

  function speakNextChunk() {
    if (!speakQueue.length) {
      stopSpeakKeepAlive();
      resetSpeakButtons();
      currentUtterance = null;
      speakActiveBtn = null;
      return;
    }
    var chunk = speakQueue.shift();
    var ut = new SpeechSynthesisUtterance(chunk);
    var voice = pickUiVoice();
    if (voice) {
      ut.voice = voice;
      ut.lang = voice.lang;
    } else {
      ut.lang = uiLangBcp47();
    }
    ut.rate = 1.02;
    ut.volume = 1;
    currentUtterance = ut;
    ut.onend = function() {
      if (speakActiveBtn) speakNextChunk();
    };
    ut.onerror = function() {
      if (speakQueue.length) speakNextChunk();
      else {
        stopSpeakKeepAlive();
        resetSpeakButtons();
        currentUtterance = null;
        speakActiveBtn = null;
      }
    };
    startSpeakKeepAlive();
    window.speechSynthesis.speak(ut);
  }

  function speakText(text, btn) {
    if (!('speechSynthesis' in window)) return alert('Este navegador no puede leer en voz alta.');
    if (speakActiveBtn && btn && speakActiveBtn === btn && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    var clean = (text || '')
      .replace(/```[\s\S]*?```/g, ' bloque de código omitido. ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' imagen. ')
      .replace(/https?:\/\/\S+/g, ' enlace. ')
      .replace(/[#*_>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;
    speakActiveBtn = btn;
    speakQueue = splitSpeakChunks(clean);
    if (btn) {
      btn.classList.add('speaking');
      if (!btn.classList.contains('dock-btn')) {
        btn.innerHTML = '<span>' + t('stopListen') + '</span>';
      }
    }
    window.speechSynthesis.getVoices();
    setTimeout(function() {
      if (!speakActiveBtn) return;
      try { window.speechSynthesis.cancel(); } catch (e) {}
      setTimeout(speakNextChunk, 60);
    }, 40);
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function() { window.speechSynthesis.getVoices(); };
  }

  function saveChats() {
    try {
      if (!syncMeta.applying && currentChatId && chats[currentChatId]) chats[currentChatId].updatedAt = Date.now();
      if (localStorage.getItem('ta_ephemeral') === '1') { localStorage.removeItem('ta_ai_chats'); return; }
      var persist = {};
      Object.keys(chats).forEach(function(k) {
        if (chats[k] && !chats[k].ephemeral) persist[k] = chats[k];
      });
      var dump = JSON.parse(JSON.stringify(persist));
      var kept = 0;
      Object.keys(dump).sort(function(a, b) { return Number(b) - Number(a); }).forEach(function(k) {
        var msgs = dump[k] && dump[k].messages;
        if (!Array.isArray(msgs)) return;
        for (var i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i] && msgs[i].image) {
            kept++;
            if (kept > 4) delete msgs[i].image;
          }
        }
      });
      localStorage.setItem('ta_ai_chats', JSON.stringify(dump));
    } catch(e) {}
    scheduleSync();
  }
  function emptyLocalProfile() {
    return { enabled: true, name: '', notes: [], topics: {}, summary: '', turns: 0 };
  }
  function loadLocalProfile() {
    try {
      var raw = localStorage.getItem('ta_profile');
      if (!raw) return emptyLocalProfile();
      var p = JSON.parse(raw);
      return p && typeof p === 'object' ? p : emptyLocalProfile();
    } catch (e) { return emptyLocalProfile(); }
  }
  function saveLocalProfile(p) {
    try { localStorage.setItem('ta_profile', JSON.stringify(p || emptyLocalProfile())); } catch (e) {}
  }
  function adaptEnabled() { return localStorage.getItem('ta_adapt') !== '0'; }
  function renderAdaptPane() {
    var p = loadLocalProfile();
    var sum = document.getElementById('adapt-summary');
    var box = document.getElementById('adapt-notes');
    var toggle = document.getElementById('set-adapt');
    if (toggle) toggle.checked = adaptEnabled();
    if (sum) {
      var bits = [];
      if (p.name) bits.push(p.name);
      if (p.summary) bits.push(p.summary);
      else if (p.notes && p.notes.length) bits.push((p.notes.length) + ' ' + t('adaptAdd').toLowerCase());
      sum.textContent = bits.join(' · ') || t('adaptEmpty');
    }
    if (!box) return;
    box.innerHTML = '';
    (p.notes || []).slice().reverse().forEach(function(n) {
      var row = document.createElement('div');
      row.className = 'settings-kv';
      var meta = [n.category, n.expiresAt ? ('hasta ' + new Date(n.expiresAt).toISOString().slice(0, 10)) : '']
        .filter(Boolean).join(' · ');
      row.innerHTML = '<div><div class="settings-kv-sub" style="color:var(--text)">' + escapeHtml(n.fact || n.text || '') + '</div>' +
        (meta ? '<div class="settings-hint">' + escapeHtml(meta) + '</div>' : '') + '</div>' +
        '<button type="button" class="mini-x" data-del-note="' + escapeHtml(n.id || '') + '">✕</button>';
      box.appendChild(row);
    });
  }
  function postProfile(body) {
    // Personal AI stores the adaptation profile only in this browser. It is
    // optional context for chat, not account data and not a server profile.
    var p = loadLocalProfile();
    body = body && typeof body === 'object' ? body : {};
    if (body.enabled === false) p.enabled = false;
    else if (body.enabled === true) p.enabled = true;
    if (body.forgetAll) p = emptyLocalProfile();
    if (body.note) {
      p.notes = Array.isArray(p.notes) ? p.notes : [];
      p.notes.push({ id: String(Date.now()), text: String(body.note), fact: String(body.note) });
      if (p.notes.length > 50) p.notes = p.notes.slice(-50);
    }
    if (body.deleteNoteId && Array.isArray(p.notes)) {
      p.notes = p.notes.filter(function(n) { return n && n.id !== body.deleteNoteId; });
    }
    saveLocalProfile(p);
    renderAdaptPane();
    return Promise.resolve({ profile: p });
  }
  function pullProfile() {
    renderAdaptPane();
    return Promise.resolve({ profile: loadLocalProfile() });
  }
  function isTempChat() {
    return !!(chats[currentChatId] && chats[currentChatId].ephemeral);
  }
  function updateTempBadge() {
    var badge = document.getElementById('temp-badge');
    if (badge) badge.classList.toggle('on', isTempChat() || localStorage.getItem('ta_ephemeral') === '1');
  }
  function startTempChat() {
    if (shareReadOnly) { shareReadOnly = false; history.replaceState({}, '', '/'); }
    currentChatId = Date.now().toString();
    chats[currentChatId] = { title: t('tempChat'), messages: [], ephemeral: true, projectId: currentProjectId };
    loadChatView();
    renderSidebar();
    updateTempBadge();
    if (window.innerWidth <= 860) toggleSidebar(false);
    var pi = document.getElementById('prompt-input');
    if (pi) pi.focus();
  }
  function saveDocuments() {
    var now = Date.now();
    if (!syncMeta.applying) documents.forEach(function(d) { if (d) d.updatedAt = now; });
    try { localStorage.setItem('ta_documents', JSON.stringify(documents)); } catch(e) {}
    knowledge = documents.map(function(d) { return { title: d.title, content: d.content }; });
    try { localStorage.setItem('ta_knowledge', JSON.stringify(knowledge)); } catch(e) {}
    scheduleSync();
  }
  function saveProjects() {
    var now = Date.now();
    if (!syncMeta.applying) projects.forEach(function(pr) { if (pr) pr.updatedAt = now; });
    try { localStorage.setItem('ta_projects', JSON.stringify(projects)); } catch(e) {}
    scheduleSync();
  }

  function startNewChat() {
    if (shareReadOnly) { shareReadOnly = false; history.replaceState({}, '', '/'); }
    currentChatId = Date.now().toString();
    loadChatView();
    renderSidebar();
    updateTempBadge();
    if (window.innerWidth <= 860) toggleSidebar(false);
  }

  var CHIP_STOP = {
    el:1, la:1, los:1, las:1, un:1, una:1, de:1, del:1, en:1, y:1, o:1, que:1, para:1, con:1, por:1,
    the:1, a:1, an:1, of:1, to:1, and:1, or:1, is:1, it:1, this:1, that:1, hola:1, hey:1, ok:1, si:1,
    me:1, mi:1, tu:1, su:1, al:1, lo:1, se:1, es:1, da:1, um:1, le:1, les:1, des:1, du:1, et:1,
    you:1, we:1, i:1, my:1, your:1, how:1, what:1, why:1, can:1, please:1, gracias:1, como:1
  };

  function chatStamp(id, chat) {
    return Number((chat && (chat.updatedAt || chat.updated)) || id) || 0;
  }

  function firstUserText(chat) {
    if (!chat || !Array.isArray(chat.messages)) return '';
    for (var i = 0; i < chat.messages.length; i++) {
      if (chat.messages[i] && chat.messages[i].role === 'user' && chat.messages[i].content) {
        return String(chat.messages[i].content).replace(/\s+/g, ' ').trim();
      }
    }
    return '';
  }

  function chipTokens(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/https?:\/\/\S+/g, ' ')
      .split(/[^a-z0-9$]+/)
      .filter(function(w) { return w.length > 2 && !CHIP_STOP[w]; });
  }

  function isGenericChipTitle(title) {
    var s = String(title || '').trim().toLowerCase();
    if (!s || s.length < 3) return true;
    return /^(conversaci[oó]n|nueva conversaci[oó]n|new chat|chat|untitled|sin t[ií]tulo|nova conversa)$/i.test(s);
  }

  function recentChatsForRecs(n) {
    return Object.keys(chats)
      .map(function(id) { return chats[id] ? { id: id, c: chats[id] } : null; })
      .filter(function(x) {
        return x && x.c && !x.c.ephemeral && !x.c.archived && x.c.messages && x.c.messages.length;
      })
      .sort(function(a, b) { return chatStamp(b.id, b.c) - chatStamp(a.id, a.c); })
      .slice(0, n)
      .map(function(x) { return x.c; });
  }

  function genericHeroChips() {
    return [
      { label: t('chipDoc'), prompt: t('chipDoc') },
      { label: t('chipArch'), prompt: t('chipArch') },
      { label: t('chipBtc'), prompt: t('chipBtc') },
      { label: t('chipImage'), prompt: t('chipImage') }
    ];
  }

  function recommendHeroChips() {
    var generic = genericHeroChips();
    var recent = recentChatsForRecs(5);
    if (!recent.length) return generic;
    var recs = [];
    var seen = {};
    recent.forEach(function(c) {
      var first = firstUserText(c);
      var title = String(c.title || '').replace(/\s+/g, ' ').trim();
      var label = !isGenericChipTitle(title) ? title.slice(0, 48) : first.slice(0, 48);
      if (!label) return;
      var sig = chipTokens(label).slice(0, 4).join(' ');
      if (!sig || seen[sig]) return;
      seen[sig] = 1;
      var prompt = first
        ? (first.length <= 220 ? first : ((t('chipContinue') || 'Continúa con esto:') + ' ' + label))
        : label;
      recs.push({ label: label, prompt: prompt });
    });
    generic.forEach(function(g) {
      if (recs.length >= 4) return;
      recs.push(g);
    });
    return recs.slice(0, 4);
  }

  function renderHeroChips() {
    return recommendHeroChips().map(function(c) {
      return '<button type="button" class="hero-chip" data-prompt="' + escapeHtml(c.prompt) + '">' + escapeHtml(c.label) + '</button>';
    }).join('');
  }

  function loadChatView() {
    var container = document.getElementById('chat-container');
    if (!container) return;
    var chat = chats[currentChatId];
    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      container.innerHTML = '<div class="ta-hero">' +
        projectHeroHtml() +
        '<img src="/avatar.png" alt="Personal AI" class="hero-logo-img">' +
        '<h1 class="hero-heading">' + t('heroTitle') + '</h1>' +
        '<p class="hero-subheading">' + t('heroSub') + '</p>' +
        '<div class="hero-chips">' + renderHeroChips() + '</div></div>';
      if (window.TAP) { try { TAP.mountHero(); } catch (eTap) {} }
      var phEdit = document.getElementById('proj-hero-edit');
      if (phEdit) phEdit.onclick = function() { var cp = projectById(currentProjectId); if (cp) openProjectModal(cp); };
      var phExit = document.getElementById('proj-hero-exit');
      if (phExit) phExit.onclick = function() { switchProject(null); };
      return;
    }
    container.innerHTML = '';
    chat.messages.forEach(function(m, i) {
      if (m && m.content) {
        try {
          var refs = addMessageToDOM(m.role, m.content, m.sources, m.at, i, m.feedback, m.image);
          if (m.role !== 'user' && refs && refs.contentCol) {
            var hArt = extractArtifact(m.content);
            if (hArt) appendArtifactChip(refs.contentCol, hArt);
          }
        } catch(e) {}
      }
    });
    scrollToEnd();
  }

  function sendQuick(text) {
    var inp = document.getElementById('prompt-input');
    if (!inp) return;
    inp.value = text;
    handleSend();
  }

  function formatMsgTime(at) {
    var d = at ? new Date(at) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function addMessageToDOM(role, content, sources, at, msgIndex, feedback, image) {
    sources = sources || [];
    var container = document.getElementById('chat-container');
    if (!container) return { row: null, textContainer: null, contentCol: null };
    var hero = container.querySelector('.ta-hero');
    if (hero) hero.remove();
    var row = document.createElement('div');
    row.className = 'msg-row ' + (role === 'user' ? 'user' : 'ai');
    var textContainer, contentCol, bubble;
    var showTime = localStorage.getItem('ta_show_time') === '1';
    if (role === 'user') {
      var holder = document.createElement('div');
      holder.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;max-width:78%';
      bubble = document.createElement('div');
      bubble.className = 'user-bubble';
      bubble.style.maxWidth = '100%';
      if (image) {
        var im = document.createElement('img');
        im.src = image;
        im.alt = t('imageAttached') === 'imageAttached' ? 'Imagen' : t('imageAttached');
        im.style.cssText = 'max-width:220px;max-height:180px;object-fit:cover;border-radius:10px;margin:0 0 6px;display:block';
        holder.appendChild(im);
      }
      bubble.textContent = content || '';
      if (!content && image) bubble.style.display = 'none';
      holder.appendChild(bubble);
      var userActs = document.createElement('div');
      userActs.className = 'msg-actions';
      userActs.style.justifyContent = 'flex-end';
      var uCopy = document.createElement('button');
      uCopy.className = 'msg-action-btn';
      uCopy.textContent = t('copy');
      uCopy.onclick = function() {
        navigator.clipboard.writeText(content || '');
        uCopy.textContent = t('copied');
        setTimeout(function() { uCopy.textContent = t('copy'); }, 1800);
      };
      userActs.appendChild(uCopy);
      if (typeof msgIndex === 'number' && !shareReadOnly) {
        var uEdit = document.createElement('button');
        uEdit.className = 'msg-action-btn';
        uEdit.textContent = t('edit');
        uEdit.onclick = function() { editUserAt(msgIndex); };
        userActs.appendChild(uEdit);
      }
      holder.appendChild(userActs);
      if (showTime) {
        var tm = document.createElement('div');
        tm.className = 'msg-time';
        tm.textContent = formatMsgTime(at);
        holder.appendChild(tm);
      }
      row.appendChild(holder);
    } else {
      var avatarCol = document.createElement('div');
      avatarCol.className = 'ai-avatar-col';
      avatarCol.innerHTML = '<img src="/avatar.png" alt="Personal AI" class="ai-avatar-img">';
      contentCol = document.createElement('div');
      contentCol.className = 'ai-content-col';
      textContainer = document.createElement('div');
      textContainer.className = 'prose-ai';
      textContainer.innerHTML = renderMarkdown(content || '');
      contentCol.appendChild(textContainer);
      if (sources && sources.length > 0) {
        var srcBox = document.createElement('div');
        srcBox.className = 'sources-box';
        srcBox.innerHTML = '<div class="sources-title">' + t('sources') + '</div><div class="sources-list">' +
          sources.map(function(s) { return '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener" class="source-tag">' + escapeHtml(s.title) + '</a>'; }).join('') +
          '</div>';
        contentCol.appendChild(srcBox);
      }
      var actions = document.createElement('div');
      actions.className = 'msg-actions';
      var copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn';
      copyBtn.innerHTML = '<span>' + t('copy') + '</span>';
      copyBtn.onclick = function() {
        navigator.clipboard.writeText(content || '');
        copyBtn.innerHTML = '<span style="color:var(--green)">' + t('copied') + '</span>';
        setTimeout(function() { copyBtn.innerHTML = '<span>' + t('copy') + '</span>'; }, 1800);
      };
      actions.appendChild(copyBtn);
      var voiceBtn = document.createElement('button');
      voiceBtn.className = 'msg-action-btn speak-msg-btn';
      voiceBtn.innerHTML = '<span>' + t('listen') + '</span>';
      voiceBtn.onclick = function() { speakText(content || '', voiceBtn); };
      actions.appendChild(voiceBtn);
      var regenBtn = document.createElement('button');
      regenBtn.className = 'msg-action-btn';
      regenBtn.innerHTML = '<span>' + t('regenerate') + '</span>';
      regenBtn.onclick = function() { regenerateLast(); };
      actions.appendChild(regenBtn);
      if (typeof msgIndex === 'number' && !shareReadOnly) {
        var up = document.createElement('button');
        up.className = 'msg-action-btn' + (feedback === 'up' ? ' on' : '');
        up.textContent = t('useful');
        up.onclick = function() { setFeedback(msgIndex, 'up'); };
        var down = document.createElement('button');
        down.className = 'msg-action-btn' + (feedback === 'down' ? ' on' : '');
        down.textContent = t('notUseful');
        down.onclick = function() { setFeedback(msgIndex, 'down'); };
        actions.appendChild(up);
        actions.appendChild(down);
      }
      contentCol.appendChild(actions);
      if (showTime) {
        var tmAi = document.createElement('div');
        tmAi.className = 'msg-time';
        tmAi.textContent = formatMsgTime(at);
        contentCol.appendChild(tmAi);
      }
      row.appendChild(avatarCol);
      row.appendChild(contentCol);
    }
    container.appendChild(row);
    scrollToEnd();
    return { row: row, textContainer: textContainer, contentCol: contentCol };
  }

  function extractArtifact(markdown) {
    if (!markdown) return null;
    var cands = [];
    var re = /```([a-zA-Z0-9_+-]*)[^\n]*\r?\n([\s\S]*?)(?:```|$(?![\s\S]))/g;
    var m;
    while ((m = re.exec(markdown))) {
      var body = (m[2] || '').replace(/\s+$/, '');
      var lang = (m[1] || 'text').trim() || 'text';
      var kind = artifactKind({ lang: lang, content: body });
      var rich = kind === 'html' || kind === 'svg' || kind === 'mermaid';
      if (body.split('\n').length >= 10 || body.length > 360 || (rich && body.length > 80)) {
        cands.push({ lang: lang, content: body, rich: rich, title: guessArtTitle(lang, body) });
      }
      if (m[0].length === 0) re.lastIndex++;
    }
    var best = null;
    cands.forEach(function(c) {
      if (!best || (c.rich && !best.rich) || (c.rich === best.rich && c.content.length > best.content.length)) best = c;
    });
    if (best) {
      var heading = (markdown.match(/^#{1,3}\s+(.+)/m) || [])[1];
      if (heading && /^[<!{\[]/.test((best.title || '').trim())) best.title = clampArtTitle(heading);
      if (/^(<!doctype|<html)/i.test(best.title || '')) {
        var tt = best.content.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
        best.title = clampArtTitle(tt ? tt[1] : (heading || 'HTML · Personal'));
      }
      delete best.rich;
    }
    if (!best && /^#\s+.+/m.test(markdown) && markdown.length > 500) {
      best = { lang: 'markdown', content: markdown, title: clampArtTitle((markdown.match(/^#\s+(.+)/m) || [,'Documento'])[1]) };
    }
    return best;
  }
  function guessArtTitle(lang, body) {
    var first = (body.split('\n').find(function(l) { return l.trim(); }) || '').replace(/^[#/*\s-]+/, '');
    return clampArtTitle(first) || ((lang || 'documento') + ' · Personal');
  }
  function clampArtTitle(value) {
    var s = String(value || '').replace(/\s+/g, ' ').trim();
    if (s.length <= 72) return s;
    var cut = s.slice(0, 72);
    var sp = cut.lastIndexOf(' ');
    return (sp >= 36 ? cut.slice(0, sp) : cut).replace(/[–—:,.-]+$/, '').trim();
  }
  function parseExtraLines(text, kind) {
    return String(text || '').split(/\n/).map(function(line) {
      line = line.trim();
      if (!line) return null;
      if (kind === 'widget') {
        var q = line.match(/^(?:quote|chart):?\s*\$?([A-Za-z0-9.=^-]{1,12})$/i);
        if (q) return { type: /^chart/i.test(line) ? 'chart' : 'quote', symbol: q[1].toUpperCase(), label: q[1].toUpperCase() };
        if (/^\$[A-Za-z]/.test(line)) return { type: 'quote', symbol: line.replace(/^\$/, '').toUpperCase().slice(0, 12) };
        if (/^note:\s*/i.test(line)) return { type: 'note', text: line.replace(/^note:\s*/i, '').slice(0, 280) };
        if (/^https?:\/\//i.test(line)) return { type: 'embed', url: line };
        var wp = line.split('|');
        if (wp.length >= 2) return { type: 'link', label: wp[0].trim(), url: wp.slice(1).join('|').trim() };
        return { type: 'note', text: line.slice(0, 280) };
      }
      var parts = line.split('|');
      if (parts.length >= 2) return { title: clampArtTitle(parts[0]), url: parts.slice(1).join('|').trim() };
      if (/^https?:\/\//i.test(line)) return { title: line, url: line };
      return { title: clampArtTitle(line), url: '' };
    }).filter(Boolean);
  }
  function extrasToText(list, kind) {
    return (list || []).map(function(it) {
      if (kind === 'widget') {
        if (it.type === 'quote' || it.type === 'chart') return (it.type === 'chart' ? 'chart:' : 'quote:') + (it.symbol || '');
        if (it.type === 'note') return 'note:' + (it.text || '');
        if (it.url && it.label) return it.label + ' | ' + it.url;
        return it.url || it.text || '';
      }
      if (it.title && it.url) return it.title + ' | ' + it.url;
      return it.url || it.title || '';
    }).join('\n');
  }
  function readArtExtras() {
    return {
      sources: parseExtraLines((document.getElementById('art-sources') || {}).value, 'source'),
      resources: parseExtraLines((document.getElementById('art-resources') || {}).value, 'resource'),
      widgets: parseExtraLines((document.getElementById('art-widgets') || {}).value, 'widget')
    };
  }
  function fillArtExtras(extras) {
    extras = extras || { sources: [], resources: [], widgets: [] };
    var s = document.getElementById('art-sources');
    var r = document.getElementById('art-resources');
    var w = document.getElementById('art-widgets');
    if (s) s.value = extrasToText(extras.sources, 'source');
    if (r) r.value = extrasToText(extras.resources, 'resource');
    if (w) w.value = extrasToText(extras.widgets, 'widget');
  }
  function updateTitleCount() {
    var title = document.getElementById('art-title');
    var count = document.getElementById('art-title-count');
    if (!title || !count) return;
    var n = (title.value || '').length;
    count.textContent = n + '/72';
  }
  var ART_FORMATS = [
    { id: 'html', label: 'HTML' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'plaintext', label: 'Texto' },
    { id: 'code', label: 'Código' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'python', label: 'Python' },
    { id: 'json', label: 'JSON' },
    { id: 'csv', label: 'CSV / tabla' },
    { id: 'svg', label: 'SVG' },
    { id: 'mermaid', label: 'Mermaid' }
  ];
  function artifactKind(art) {
    var l = String((art && art.lang) || '').toLowerCase();
    var map = { html:'html', htm:'html', react:'html', jsx:'html', markdown:'markdown', md:'markdown', plaintext:'plaintext', text:'plaintext', txt:'plaintext', code:'code', javascript:'javascript', js:'javascript', ts:'javascript', typescript:'javascript', python:'python', py:'python', json:'json', csv:'csv', tsv:'csv', svg:'svg', mermaid:'mermaid', mmd:'mermaid' };
    if (map[l]) return map[l];
    var c = String((art && art.content) || '').trim();
    if (/^<svg[\s>]/i.test(c)) return 'svg';
    if (/^<!doctype html/i.test(c) || /^<html[\s>]/i.test(c)) return 'html';
    if (/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|pie |gantt|mindmap)\b/m.test(c)) return 'mermaid';
    if (/^[\[{]/.test(c)) {
      try { JSON.parse(c); return 'json'; } catch (e) {}
    }
    return 'markdown';
  }
  function fillArtFormatSelect() {
    var sel = document.getElementById('art-format');
    if (!sel || sel.options.length) return;
    ART_FORMATS.forEach(function(f) {
      var o = document.createElement('option');
      o.value = f.id;
      o.textContent = f.label;
      sel.appendChild(o);
    });
  }
  function readArtifactDraft() {
    if (!currentArtifact) currentArtifact = { title: 'Artifact', content: '', lang: 'markdown' };
    var title = document.getElementById('art-title');
    var editor = document.getElementById('art-editor');
    var sel = document.getElementById('art-format');
    if (title) currentArtifact.title = clampArtTitle(title.value || '');
    currentArtifact.extras = readArtExtras();
    if (editor) currentArtifact.content = editor.value || '';
    if (sel && sel.value) currentArtifact.lang = sel.value;
    return currentArtifact;
  }
  function artPreviewShell(body, extraCss) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;background:#fff;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,sans-serif}body{padding:18px 20px;line-height:1.6}' +
      (extraCss || '') + '</style></head><body>' + body + '</body></html>';
  }
  function artCsvTable(text) {
    var rows = String(text || '').trim().split(/\r?\n/).filter(Boolean);
    if (!rows.length) return '<p>CSV vacío</p>';
    var cells = function(line, tag) {
      return line.split(',').map(function(cell) {
        return '<' + tag + '>' + escapeHtml(cell.trim()) + '</' + tag + '>';
      }).join('');
    };
    var html = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>' + cells(rows[0], 'th') + '</tr></thead><tbody>';
    rows.slice(1).forEach(function(r) { html += '<tr>' + cells(r, 'td') + '</tr>'; });
    return html + '</tbody></table>';
  }
  function artPreviewSrcdoc(kind, content) {
    var raw = content || '';
    if (kind === 'html') return raw;
    if (kind === 'svg') {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;height:100%;background:#fff;display:flex;align-items:center;justify-content:center}svg{max-width:96%;max-height:96%}</style></head><body>' + raw + '</body></html>';
    }
    if (kind === 'mermaid') {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script></head><body style="background:#080c14;margin:16px"><pre class="mermaid">' +
        String(raw).replace(/</g, '&lt;') + '</pre><script>mermaid.initialize({startOnLoad:true,theme:"dark",securityLevel:"strict"});<\/script></body></html>';
    }
    if (kind === 'markdown') {
      var html = raw;
      try {
        if (window.marked && typeof marked.parse === 'function') html = sanitizeHtml(marked.parse(raw));
        else html = '<pre>' + escapeHtml(raw) + '</pre>';
      } catch (e) { html = '<pre>' + escapeHtml(raw) + '</pre>'; }
      return artPreviewShell(html, 'pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace}a{color:#0284c7}h1,h2,h3{margin:1.1em 0 .4em}th,td{border:1px solid #e2e8f0;padding:6px 8px}');
    }
    if (kind === 'csv') {
      return artPreviewShell(artCsvTable(raw), 'th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#f8fafc}');
    }
    if (kind === 'json') {
      var pretty = raw;
      try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) {}
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#0c1220;color:#e2e8f0}pre{margin:0;padding:16px;font:13px/1.55 ui-monospace,monospace;white-space:pre-wrap}</style></head><body><pre>' + escapeHtml(pretty) + '</pre></body></html>';
    }
    if (kind === 'plaintext') {
      return artPreviewShell('<p style="white-space:pre-wrap;margin:0">' + escapeHtml(raw) + '</p>');
    }
    return '';
  }
  // Artifact previews load an isolated document from /sandbox/frame (own strict CSP,
  // opaque origin because the iframe sandbox lacks allow-same-origin) and receive
  // their HTML by postMessage. srcdoc would inherit the app's nonce CSP.
  var artFrameSeq = 0;
  function setPreviewFrame(frame, html) {
    if (!frame) return;
    frame._taHtml = typeof html === 'string' ? html : '';
    frame.removeAttribute('srcdoc');
    if (!frame._taHtml) { frame.src = 'about:blank'; return; }
    artFrameSeq += 1;
    frame.src = '/sandbox/frame?n=' + artFrameSeq;
  }
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || d.type !== 'ta-preview-ready') return;
    var frames = document.querySelectorAll('iframe.art-preview, iframe[data-ta-preview]');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.contentWindow && e.source === f.contentWindow && typeof f._taHtml === 'string' && f._taHtml) {
        f.contentWindow.postMessage({ type: 'ta-preview', html: f._taHtml }, '*');
      }
    }
  });
  var artView = 'preview';
  var ART_I18N = {
    es: { preview: 'Vista previa', code: 'Código', download: 'Descargar', fullscreen: 'Pantalla completa', exitfs: 'Salir de pantalla completa', copied: 'Copiado', copy: 'Copiar', version: 'Versión', open: 'Abrir artifact' },
    en: { preview: 'Preview', code: 'Code', download: 'Download', fullscreen: 'Full screen', exitfs: 'Exit full screen', copied: 'Copied', copy: 'Copy', version: 'Version', open: 'Open artifact' },
    ca: { preview: 'Vista prèvia', code: 'Codi', download: 'Baixa', fullscreen: 'Pantalla completa', exitfs: 'Surt de pantalla completa', copied: 'Copiat', copy: 'Copia', version: 'Versió', open: 'Obre l\'artifact' }
  };
  function artT(k) {
    var l = String(document.documentElement.lang || 'es').slice(0, 2);
    var d = ART_I18N[l] || ART_I18N.es;
    return d[k] || ART_I18N.es[k] || k;
  }
  function localizeArtPanel() {
    document.querySelectorAll('[data-art-i18n]').forEach(function(el) { el.textContent = artT(el.getAttribute('data-art-i18n')); });
    document.querySelectorAll('[data-art-i18n-title]').forEach(function(el) {
      var v = artT(el.getAttribute('data-art-i18n-title'));
      el.title = v; el.setAttribute('aria-label', v);
    });
    var vs = document.getElementById('art-version');
    if (vs) vs.setAttribute('aria-label', artT('version'));
    var fs = document.getElementById('art-fs-btn');
    var panel = document.getElementById('art-panel');
    if (fs && panel && panel.classList.contains('fs')) { fs.title = artT('exitfs'); fs.setAttribute('aria-label', artT('exitfs')); }
  }
  function artIsLive(kind) {
    return kind === 'html' || kind === 'svg' || kind === 'mermaid' || kind === 'markdown' || kind === 'json' || kind === 'csv' || kind === 'plaintext';
  }
  function setArtView(view) {
    var live = artIsLive(artifactKind(currentArtifact));
    artView = (view === 'code' || !live) ? 'code' : 'preview';
    var split = document.getElementById('art-split');
    if (split) {
      split.classList.toggle('view-code', artView === 'code');
      split.classList.toggle('view-preview', artView === 'preview');
    }
    document.querySelectorAll('.art-view-btn').forEach(function(b) {
      var on = b.getAttribute('data-view') === artView;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (b.getAttribute('data-view') === 'preview') b.disabled = !live;
    });
    if (artView === 'preview') {
      if (artPreviewTimer) { clearTimeout(artPreviewTimer); artPreviewTimer = 0; }
      readArtifactDraft();
      refreshArtifactPreview();
    }
  }
  function artPushVersion(art, content) {
    if (!art) return;
    if (!Array.isArray(art.versions)) art.versions = [];
    var last = art.versions[art.versions.length - 1];
    if (last && last.content === content) return;
    art.versions.push({ at: Date.now(), content: content });
    if (art.versions.length > 20) art.versions.shift();
  }
  function renderArtVersions() {
    var sel = document.getElementById('art-version');
    if (!sel) return;
    var vs = (currentArtifact && currentArtifact.versions) || [];
    sel.hidden = vs.length < 2;
    sel.innerHTML = '';
    vs.forEach(function(v, i) {
      var o = document.createElement('option');
      o.value = String(i);
      var d = new Date(v.at);
      o.textContent = 'v' + (i + 1) + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      sel.appendChild(o);
    });
    var cur = currentArtifact ? currentArtifact.content : '';
    var idx = vs.length - 1;
    for (var i = vs.length - 1; i >= 0; i--) { if (vs[i].content === cur) { idx = i; break; } }
    if (vs.length) sel.value = String(idx);
  }
  var ART_EXT = { html: ['html', 'text/html'], svg: ['svg', 'image/svg+xml'], markdown: ['md', 'text/markdown'], json: ['json', 'application/json'], csv: ['csv', 'text/csv'], mermaid: ['mmd', 'text/plain'], python: ['py', 'text/x-python'], javascript: ['js', 'text/javascript'], plaintext: ['txt', 'text/plain'], code: ['txt', 'text/plain'] };
  function downloadArtifact() {
    readArtifactDraft();
    if (!currentArtifact) return;
    var kind = artifactKind(currentArtifact);
    var ext = ART_EXT[kind] || ['txt', 'text/plain'];
    var name = (slugifyArtifact(currentArtifact.title) || 'artifact') + '.' + ext[0];
    var blob = new Blob([currentArtifact.content || ''], { type: ext[1] + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  }
  function setArtFullscreen(on) {
    var panel = document.getElementById('art-panel');
    var btn = document.getElementById('art-fs-btn');
    if (!panel) return;
    panel.classList.toggle('fs', !!on);
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var v = artT(on ? 'exitfs' : 'fullscreen');
      btn.title = v; btn.setAttribute('aria-label', v);
    }
  }
  function appendArtifactChip(container, art) {
    if (!container || !art) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'art-chip';
    var kind = artifactKind(art);
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>' +
      '<span class="art-chip-title"></span><span class="art-chip-kind"></span>';
    b.querySelector('.art-chip-title').textContent = art.title || 'Artifact';
    b.querySelector('.art-chip-kind').textContent = kind;
    b.setAttribute('aria-label', artT('open') + ': ' + (art.title || 'Artifact'));
    b.addEventListener('click', function() { openArtifact(art); });
    container.appendChild(b);
  }
  function refreshArtifactPreview() {
    var kind = artifactKind(currentArtifact);
    var live = artIsLive(kind);
    var preview = document.getElementById('art-preview');
    var split = document.getElementById('art-split');
    if (split) split.classList.toggle('no-preview', !live);
    if (!preview) return;
    if (!live) {
      preview.hidden = true;
      setPreviewFrame(preview, '');
      return;
    }
    preview.hidden = false;
    if (artView === 'code') { setPreviewFrame(preview, ''); return; }
    setPreviewFrame(preview, artPreviewSrcdoc(kind, (currentArtifact && currentArtifact.content) || ''));
  }
  function scheduleArtifactPreview() {
    if (artPreviewTimer) clearTimeout(artPreviewTimer);
    artPreviewTimer = setTimeout(function() {
      artPreviewTimer = 0;
      readArtifactDraft();
      refreshArtifactPreview();
    }, 220);
  }
  function requireAccount(action) {
    if (authToken && currentUser && (currentUser.email || currentUser.id)) return true;
    alert('Crea una cuenta o inicia sesión para ' + (action || 'publicar') + '. Las publicaciones van a tu @usuario y no se mezclan con las de otros.');
    if (typeof openSettingsModal === 'function') openSettingsModal('pane-account');
    return false;
  }
  function myHandle() {
    return (currentUser && currentUser.handle) || '';
  }
  function setArtifactDest(dest, persist) {
    artifactDest = dest === 'guide' ? 'guide' : 'artifact';
    if (persist && currentArtifact) currentArtifact.dest = artifactDest;
    document.querySelectorAll('.art-dest-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-dest') === artifactDest);
    });
    var hint = document.getElementById('art-dest-hint');
    var h = myHandle() || 'usuario';
    if (hint) {
      hint.textContent = artifactDest === 'guide'
        ? 'Se publica en Guides: guides.personal-ai.workers.dev/g/slug (URL automática).'
        : 'Se publica en Library: ai.personal-ai.workers.dev/library/slug (URL automática, sin @usuario).';
    }
  }
  function syncArtifactActions() {
    var openBtn = document.getElementById('art-open-btn');
    var unBtn = document.getElementById('art-unpublish-btn');
    var pubBtn = document.getElementById('art-publish-btn');
    var published = !!(currentArtifact && currentArtifact.url);
    if (openBtn) { openBtn.hidden = false; openBtn.disabled = !published; }
    if (unBtn) { unBtn.hidden = false; unBtn.disabled = !published; }
    if (pubBtn) { pubBtn.hidden = false; pubBtn.textContent = published ? 'Actualizar' : 'Publicar'; }
    setArtifactDest((currentArtifact && currentArtifact.dest) || artifactDest, false);
  }
  function openArtifact(art, opts) {
    currentArtifact = art || { title: 'Artifact', content: '', lang: 'markdown', dest: artifactDest };
    if (!currentArtifact.dest) currentArtifact.dest = artifactDest;
    setArtifactDest(currentArtifact.dest, false);
    fillArtFormatSelect();
    var kind = artifactKind(currentArtifact);
    currentArtifact.lang = kind;
    var panel = document.getElementById('art-panel');
    var title = document.getElementById('art-title');
    var editor = document.getElementById('art-editor');
    var sel = document.getElementById('art-format');
    if (title) title.value = clampArtTitle(currentArtifact.title || 'Artifact');
    if (editor) editor.value = currentArtifact.content || '';
    fillArtExtras(currentArtifact.extras);
    updateTitleCount();
    if (sel) sel.value = kind;
    artPushVersion(currentArtifact, currentArtifact.content || '');
    renderArtVersions();
    localizeArtPanel();
    artView = (opts && opts.view) || (artIsLive(kind) ? 'preview' : 'code');
    setArtView(artView);
    syncArtifactActions();
    if (panel) panel.classList.add('open');
    if (opts && opts.focus && editor) {
      editor.focus();
    }
  }
  function closeArtifact() {
    readArtifactDraft();
    var panel = document.getElementById('art-panel');
    var preview = document.getElementById('art-preview');
    if (preview) setPreviewFrame(preview, '');
    setArtFullscreen(false);
    if (panel) panel.classList.remove('open');
  }
  function slugifyArtifact(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }
  async function publishArtifact() {
    readArtifactDraft();
    if (!currentArtifact) return;
    if (!requireAccount('publicar')) return;
    if (!(currentArtifact.content || '').trim()) {
      alert('Escribe algo en el editor antes de publicar.');
      return;
    }
    var dest = artifactDest === 'guide' ? 'guide' : 'artifact';
    currentArtifact.dest = dest;
    currentArtifact.title = clampArtTitle(currentArtifact.title || '');
    var handle = myHandle() || 'usuario';
    var btn = document.getElementById('art-publish-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Publicando…'; }
    try {
      var res = await fetch('/api/artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
        body: JSON.stringify({
          title: currentArtifact.title,
          slug: currentArtifact.slug || '',
          content: currentArtifact.content,
          lang: currentArtifact.lang || 'markdown',
          dest: dest,
          extras: currentArtifact.extras || readArtExtras()
        })
      });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      currentArtifact.slug = data.slug || slug;
      currentArtifact.url = data.url;
      currentArtifact.dest = data.dest || dest;
      currentArtifact.handle = data.handle || handle;
      if (data.user) {
        currentUser = data.user;
        try { localStorage.setItem('personal_ai_user', JSON.stringify(currentUser)); } catch (e) {}
        updateUserUI();
      }
      syncArtifactActions();
      if (data.url && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data.url).catch(function() {});
      }
      if (data.url) window.open(data.url, '_blank', 'noopener');
      if (sidebarView === 'artifacts') loadPublishedArtifacts();
    } catch (err) {
      alert(err.message || 'No se pudo publicar');
      if (btn) btn.textContent = 'Publicar';
    } finally {
      if (btn) btn.disabled = false;
      syncArtifactActions();
    }
  }
  async function unpublishArtifact() {
    if (!currentArtifact || !currentArtifact.slug) return;
    if (!requireAccount('despublicar')) return;
    var dest = currentArtifact.dest === 'guide' ? 'guide' : 'artifact';
    if (!window.confirm('¿Despublicar ' + (currentArtifact.url || currentArtifact.slug) + '?')) return;
    var btn = document.getElementById('art-unpublish-btn');
    if (btn) btn.disabled = true;
    try {
      var res = await fetch('/api/artifact/' + encodeURIComponent(currentArtifact.slug) + '?dest=' + dest, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      currentArtifact.url = '';
      currentArtifact.slug = '';
      syncArtifactActions();
      if (sidebarView === 'artifacts') loadPublishedArtifacts();
    } catch (err) {
      alert(err.message || 'No se pudo despublicar');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleSend() {
    if (isGenerating || shareReadOnly) return;
    var input = document.getElementById('prompt-input');
    if (!input) return;
    var promptText = input.value.trim();
    if (!promptText && !attachedFile) return;
    if (window.TAP && promptText && !TAP.beforeSend(promptText)) return;
    isGenerating = true;
    abortCtl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    setGenerating(true);
    var nl = String.fromCharCode(10);
    var fullPrompt = promptText;
    var pendingImage = null;
    if (attachedFile) {
      if (attachedFile.kind === 'image') {
        pendingImage = attachedFile.dataUrl;
        fullPrompt = promptText || t('imageAttached');
      } else {
        fullPrompt = '[DOCUMENTO ADJUNTO: ' + attachedFile.name + ']:' + nl + attachedFile.content + nl + nl + (promptText || 'Analiza este documento.');
        addDocument({ title: attachedFile.name, content: attachedFile.content, type: 'upload' });
      }
      removeAttachedFile();
    }
    input.value = '';
    autoResize(input);
    if (!chats[currentChatId] || typeof chats[currentChatId] !== 'object') {
      chats[currentChatId] = { title: promptText.slice(0, 42) || 'Conversación', messages: [], projectId: currentProjectId };
    }
    if (!Array.isArray(chats[currentChatId].messages)) chats[currentChatId].messages = [];
    if (chats[currentChatId].title === 'Nueva conversación' && promptText) chats[currentChatId].title = promptText.slice(0, 42);
    var userLabel = promptText || (pendingImage ? t('imageAttached') : 'Documento adjunto');
    chats[currentChatId].messages.push({ role: 'user', content: userLabel, at: Date.now(), image: pendingImage || undefined });
    saveChats();
    renderSidebar();
    addMessageToDOM('user', userLabel, null, Date.now(), chats[currentChatId].messages.length - 1, null, pendingImage);
    var isImgRequest = isImageMode || /^(genera una imagen|dibuja|crea una imagen|haz una foto|imagen de|generate image)/i.test(promptText);
    var msgDom = addMessageToDOM('ai', '');
    var textContainer = msgDom.textContainer;
    var contentCol = msgDom.contentCol;
    if (textContainer) textContainer.innerHTML = '<span class="pulse-cursor"></span>';
    var fullText = '';
    var sources = [];
    var rememberedFacts = [];
    try {
      if (isImgRequest) {
        if (textContainer) textContainer.innerHTML = '<span style="color:var(--purple);font-weight:600;font-size:0.85rem">' + t('genImage') + '</span><span class="pulse-cursor"></span>';
        var imgRes = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abortCtl ? abortCtl.signal : undefined, body: JSON.stringify({ prompt: promptText }) });
        var imgData = await imgRes.json();
        if (imgData.ok && imgData.imageUrl) {
          var imgMd = '![' + (promptText.slice(0, 60) || 'Imagen') + '](' + (imgData.proxyUrl || imgData.imageUrl) + ')';
          if (textContainer) textContainer.innerHTML = renderMarkdown(imgMd);
          chats[currentChatId].messages.push({ role: 'ai', content: imgMd, sources: [], at: Date.now() });
          saveChats();
        } else {
          throw new Error(imgData.error || 'Error al generar imagen');
        }
        return;
      }
      var customPrompt = localStorage.getItem('ta_custom_prompt') || '';
      var provider = activeProvider();
      if (!provider && serverDefaultProvider === false) throw new Error('請先在設定中新增供應商，或設定 GROQ_API_KEY');
      var headers = { 'Content-Type': 'application/json' };
      var snippets = [];
      if (localStorage.getItem('ta_use_docs') !== '0') {
        snippets = documents.filter(function(d) {
          return !currentProjectId || d.projectId === currentProjectId || !d.projectId;
        }).sort(function(x, y) { return (x.projectId === currentProjectId ? 1 : 0) - (y.projectId === currentProjectId ? 1 : 0); }).slice(-6).map(function(d) { return { title: d.title, content: String(d.content || '').slice(0, 2500) }; });
      }
      var langInstr = t('replyLang');
      var toneInstr = TONES[localStorage.getItem('ta_tone') || 'auto'] || '';
      var tzVal = localStorage.getItem('ta_timezone');
      var resolvedTz = (tzVal && tzVal !== 'auto') ? tzVal : (function() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei'; } catch(e) { return 'Asia/Taipei'; }
      })();
      var resolvedModel = provider ? (provider.model || selectedModel) : (serverDefaultModel || selectedModel);
      var payload = {
          prompt: fullPrompt,
          model: resolvedModel,
          custom_prompt: [projectContext(), (window.TAP ? TAP.roleContext() : ''), langInstr, toneInstr, customPrompt].filter(Boolean).join('\n'),
          knowledge_snippets: snippets,
          search_web: isWebSearch && !pendingImage,
          chat_history: chats[currentChatId].messages.slice(-8).map(function(m) {
            return { role: m.role, content: m.content };
          }),
          length_mode: currentLength,
          locale: (window.TA && TA.lang) ? TA.lang() : 'es',
          timezone: resolvedTz,
          client_time: new Date().toISOString(),
          adapt: adaptEnabled(),
          profile: adaptEnabled() ? loadLocalProfile() : undefined
        };
      if (provider) payload.provider = { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: provider.model || selectedModel };
      if (window.TAP) { var tapPreset = TAP.rolePreset(); if (tapPreset) payload.role_preset = tapPreset; }
      if (pendingImage) payload.image = { dataUrl: pendingImage };
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: headers,
        signal: abortCtl ? abortCtl.signal : undefined,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        var errJson = await response.json().catch(function() { return {}; });
        throw new Error(errJson.message || ('HTTP ' + response.status));
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var srcHeader = response.headers.get('x-sources') || '';
      if (srcHeader) {
        try { sources = JSON.parse(decodeURIComponent(srcHeader)) || []; } catch(eSrc) {}
      }
      while (true) {
        var chunkRes = await reader.read();
        if (chunkRes.done) break;
        buffer += decoder.decode(chunkRes.value, { stream: true });
        var lines = buffer.split(nl);
        buffer = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var trimmed = lines[i].trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          var dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') continue;
          try {
            var p = JSON.parse(dataStr);
            if (p.sources) sources = p.sources;
            if (p.profile) saveLocalProfile(p.profile);
            if (p.remembered && p.remembered.length) rememberedFacts = p.remembered;
            var delta = p.content;
            if (!delta && p.choices && p.choices[0]) {
              var choice = p.choices[0];
              delta = (choice.delta && (choice.delta.content || choice.delta.text)) || (choice.message && choice.message.content) || '';
            }
            if (p.error) throw new Error(typeof p.error === 'string' ? p.error : (p.error.message || '供應商錯誤'));
            if (delta) {
              fullText += delta;
              if (textContainer) {
                textContainer.innerHTML = renderMarkdown(fullText) + '<span class="pulse-cursor"></span>';
                scrollToEnd();
              }
            }
          } catch(e) {}
        }
      }
      if (textContainer) textContainer.innerHTML = renderMarkdown(fullText);
      if (rememberedFacts.length && contentCol) {
        var memNote = document.createElement('div');
        memNote.className = 'msg-time';
        memNote.textContent = t('adaptRemembered') + ' ' + rememberedFacts[0];
        contentCol.appendChild(memNote);
      }
      if (sources && sources.length > 0 && contentCol) {
        var srcBox = document.createElement('div');
        srcBox.className = 'sources-box';
        srcBox.innerHTML = '<div class="sources-title">' + t('sources') + '</div><div class="sources-list">' +
          sources.map(function(s) { return '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener" class="source-tag">' + escapeHtml(s.title) + '</a>'; }).join('') +
          '</div>';
        contentCol.appendChild(srcBox);
      }
      chats[currentChatId].messages.push({ role: 'ai', content: fullText, sources: sources, at: Date.now() });
      saveChats();
      if (window.TAP && fullText && promptText) { try { TAP.recordSent(promptText); } catch (eTap2) {} }
      var art = extractArtifact(fullText);
      if (art) {
        var artPanelEl = document.getElementById('art-panel');
        if (currentArtifact && artPanelEl && artPanelEl.classList.contains('open') && artifactKind(currentArtifact) === artifactKind(art) && currentArtifact.content !== art.content && !currentArtifact.url) {
          readArtifactDraft();
          artPushVersion(currentArtifact, currentArtifact.content || '');
          art.versions = (currentArtifact.versions || []).slice();
        }
        appendArtifactChip(contentCol, art);
        openArtifact(art);
      }
      if (localStorage.getItem('ta_auto_read') === '1' && fullText) {
        var lastSpeak = document.querySelector('.msg-row.ai:last-child .speak-msg-btn');
        speakText(fullText, lastSpeak);
      }
    } catch(err) {
      var aborted = err && (err.name === 'AbortError' || /abort/i.test(err.message || ''));
      if (aborted) {
        if (fullText && chats[currentChatId]) {
          chats[currentChatId].messages.push({ role: 'ai', content: fullText, sources: sources || [], at: Date.now() });
          saveChats();
          if (textContainer) textContainer.innerHTML = renderMarkdown(fullText);
        } else if (textContainer) {
          textContainer.innerHTML = '<span style="color:var(--dim)">' + t('stopped') + '</span>';
        }
      } else if (textContainer) {
        textContainer.innerHTML = '<span style="color:var(--red);font-weight:600">' + t('error') + ': ' + escapeHtml(err.message) + '</span>';
      }
    } finally {
      isGenerating = false;
      abortCtl = null;
      setGenerating(false);
      scrollToEnd();
    }
  }

  function setGenerating(on) {
    isGenerating = on;
    var sendBtn = document.getElementById('send-btn');
    if (!sendBtn) return;
    sendBtn.innerHTML = on ? STOP_ICON : SEND_ICON;
    sendBtn.title = on ? t('stopGen') : t('send');
    sendBtn.classList.toggle('stopping', !!on);
    sendBtn.disabled = false;
  }
  function abortGeneration() {
    if (abortCtl) abortCtl.abort();
  }
  function currentModelMeta() {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === selectedModel) return MODELS[i];
    return { id: selectedModel, name: selectedModel || MODELS[0].name, desc: '' };
  }
  function renderModelPicker() {
    var label = document.getElementById('model-picker-label');
    var menu = document.getElementById('model-menu');
    var meta = currentModelMeta();
    if (label) label.textContent = meta.name;
    if (!menu) return;
    menu.innerHTML = MODELS.map(function(m) {
      return '<button type="button" class="model-option' + (m.id === selectedModel ? ' active' : '') + '" data-model="' + m.id + '" role="option">' +
        '<div class="model-option-name">' + m.name + '</div>' +
        '<div class="model-option-desc">' + t(m.desc) + '</div></button>';
    }).join('');
  }
  function setModel(id) {
    selectedModel = id;
    try { localStorage.setItem('ta_model', id); } catch(e) {}
    renderModelPicker();
    var picker = document.getElementById('model-picker');
    if (picker) picker.classList.remove('open');
    var btn = document.getElementById('model-picker-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var k = el.getAttribute('data-i18n');
      var attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, t(k));
        if (attr === 'title') el.setAttribute('aria-label', t(k));
      } else el.textContent = t(k);
    });
    try { if (window.TAP && TAP.localizeRewrite) TAP.localizeRewrite(); } catch (e) {}
    try { localizeDockMenu(); } catch (e) {}
    renderModelPicker();
    var chat = chats[currentChatId];
    if (!chat || !chat.messages || !chat.messages.length) loadChatView();
    renderSidebar();
    updateUserUI();
    fillLangSelect();
  }
  window.TA_applyI18n = applyI18n;
  function fillLangSelect() {
    if (!window.TA || !TA.mountPicker) return;
    TA.mountPicker(document.getElementById('lang-select'));
    TA.mountPicker(document.getElementById('set-lang'));
  }
  function exportChat() {
    var chat = chats[currentChatId];
    if (!chat || !chat.messages || !chat.messages.length) return;
    var md = '# ' + (chat.title || 'Personal AI') + '\n\n';
    chat.messages.forEach(function(m) {
      md += '## ' + (m.role === 'user' ? 'User' : 'Personal AI') + '\n\n' + (m.content || '') + '\n\n';
    });
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (chat.title || 'personal-ai').replace(/[^\w\-]+/g, '_').slice(0, 40) + '.md';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1500);
  }
  function commandItems() {
    return [
      { id: 'new', label: t('newChat'), hint: '⌘K', run: startNewChat },
      { id: 'temp', label: t('tempChat'), hint: '⌘⇧N', run: startTempChat },
      { id: 'settings', label: t('settings'), hint: '⌘,', run: function() { openSettingsModal('pane-general'); } },
      { id: 'export', label: t('exportChat'), run: exportChat },
      { id: 'search', label: t('searchPh'), run: function() { var s = document.getElementById('history-search'); if (s) { toggleSidebar(true); s.focus(); } } }
    ];
  }
  function renderCommandPalette(q) {
    var list = document.getElementById('cmd-list');
    if (!list) return;
    q = (q || '').trim().toLowerCase();
    var items = commandItems().filter(function(c) { return !q || (c.label || '').toLowerCase().indexOf(q) !== -1; });
    list.innerHTML = '';
    items.forEach(function(c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cmd-item' + (i === 0 ? ' active' : '');
      b.innerHTML = '<span>' + escapeHtml(c.label) + '</span>' + (c.hint ? '<kbd>' + escapeHtml(c.hint) + '</kbd>' : '');
      b.onclick = function() { closeCommandPalette(); c.run(); };
      list.appendChild(b);
    });
  }
  function openCommandPalette() {
    var ov = document.getElementById('cmd-overlay');
    var inp = document.getElementById('cmd-input');
    if (!ov) return;
    ov.classList.add('open');
    renderCommandPalette('');
    if (inp) { inp.value = ''; inp.focus(); }
  }
  function closeCommandPalette() {
    var ov = document.getElementById('cmd-overlay');
    if (ov) ov.classList.remove('open');
  }
  function regenerateLast() {
    if (isGenerating) return;
    var chat = chats[currentChatId];
    if (!chat || !chat.messages || chat.messages.length < 2) return;
    var last = chat.messages[chat.messages.length - 1];
    if (last.role === 'ai' || last.role === 'assistant') chat.messages.pop();
    var userMsg = chat.messages[chat.messages.length - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    chat.messages.pop();
    saveChats();
    var inp = document.getElementById('prompt-input');
    if (inp) inp.value = userMsg.content || '';
    handleSend();
  }
  function editUserAt(index) {
    if (isGenerating || shareReadOnly) return;
    var chat = chats[currentChatId];
    if (!chat || !chat.messages || !chat.messages[index] || chat.messages[index].role !== 'user') return;
    var text = chat.messages[index].content || '';
    chat.messages = chat.messages.slice(0, index);
    saveChats();
    loadChatView();
    var inp = document.getElementById('prompt-input');
    if (inp) {
      inp.value = text;
      autoResize(inp);
      inp.focus();
    }
  }
  function setFeedback(index, value) {
    var chat = chats[currentChatId];
    if (!chat || !chat.messages || !chat.messages[index]) return;
    chat.messages[index].feedback = chat.messages[index].feedback === value ? '' : value;
    saveChats();
    loadChatView();
  }
  function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.value.trim() ? Math.min(el.scrollHeight, 180) : 44) + 'px';
  }
  function setLengthMode(mode) {
    currentLength = mode;
    try { localStorage.setItem('ta_len_mode', mode); } catch(e) {}
    ['corto', 'normal', 'extendido'].forEach(function(m) {
      var btn = document.getElementById('len-btn-' + m);
      if (btn) { if (m === mode) btn.classList.add('active'); else btn.classList.remove('active'); }
    });
  }
  var DPM_I18N = {
    es: { more: 'Más opciones', attach: 'Adjuntar archivo', web: 'Buscar en la web', image: 'Crear imagen', providers: 'Conectores' },
    en: { more: 'More options', attach: 'Attach a file', web: 'Search the web', image: 'Create an image', providers: 'Providers' },
    ca: { more: 'Més opcions', attach: 'Adjunta un fitxer', web: 'Cerca al web', image: 'Crea una imatge', providers: 'Providers' }
  };
  function localizeDockMenu() {
    var l = String(document.documentElement.lang || 'es').slice(0, 2);
    var d = DPM_I18N[l] || DPM_I18N.es;
    document.querySelectorAll('.dpm-item').forEach(function(it) {
      var lab = it.querySelector('.dpm-label');
      if (lab) lab.textContent = d[it.getAttribute('data-dpm')] || lab.textContent;
    });
    var b = document.getElementById('dock-plus-btn');
    if (b) { b.title = d.more; b.setAttribute('aria-label', d.more); }
  }
  function syncDockMenu() {
    var w = document.querySelector('.dpm-item[data-dpm="web"]');
    var im = document.querySelector('.dpm-item[data-dpm="image"]');
    if (w) w.setAttribute('aria-checked', isWebSearch ? 'true' : 'false');
    if (im) im.setAttribute('aria-checked', isImageMode ? 'true' : 'false');
    var dc = document.querySelector('.dock-controls');
    if (dc) dc.classList.toggle('has-mode', !!(isWebSearch || isImageMode));
  }
  function setDockMenu(open) {
    var m = document.getElementById('dock-plus-menu');
    var b = document.getElementById('dock-plus-btn');
    if (!m || !b) return;
    m.hidden = !open;
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { syncDockMenu(); var f = m.querySelector('.dpm-item'); if (f) f.focus(); }
  }
  function initDockMenu() {
    var b = document.getElementById('dock-plus-btn');
    var m = document.getElementById('dock-plus-menu');
    if (!b || !m) return;
    localizeDockMenu();
    b.addEventListener('click', function(e) { e.stopPropagation(); setDockMenu(m.hidden); });
    m.addEventListener('click', function(e) {
      var it = e.target.closest('.dpm-item');
      if (!it) return;
      var k = it.getAttribute('data-dpm');
      setDockMenu(false);
      var map = { attach: 'attach-file-btn', web: 'web-search-pill', image: 'image-gen-pill', providers: 'quick-providers-pill' };
      var tgt = document.getElementById(map[k]);
      if (tgt) tgt.click();
      syncDockMenu();
      if (k !== 'attach' && k !== 'providers') b.focus();
    });
    m.addEventListener('keydown', function(e) {
      var items = Array.prototype.slice.call(m.querySelectorAll('.dpm-item'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDockMenu(false); b.focus(); }
      else if (e.key === 'Tab') { setDockMenu(false); }
    });
    document.addEventListener('click', function(e) { if (!m.hidden && !e.target.closest('#dock-plus')) setDockMenu(false); });
    ['web-search-pill', 'image-gen-pill'].forEach(function(id) {
      var p = document.getElementById(id);
      if (p) p.addEventListener('click', function() { setTimeout(syncDockMenu, 0); });
    });
  }
  function toggleWebSearch() {
    isWebSearch = !isWebSearch;
    var btn = document.getElementById('web-search-pill');
    if (btn) { if (isWebSearch) btn.classList.add('active'); else btn.classList.remove('active'); }
  }
  function toggleImageMode() {
    isImageMode = !isImageMode;
    var btn = document.getElementById('image-gen-pill');
    var inp = document.getElementById('prompt-input');
    if (btn) {
      if (isImageMode) { btn.classList.add('active-purple'); if (inp) inp.placeholder = 'Describe la imagen…'; }
      else { btn.classList.remove('active-purple'); if (inp) inp.placeholder = 'Pregunta lo que quieras…'; }
    }
  }
  function toggleSidebar(open) {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebar-overlay');
    var closeBtn = document.getElementById('sidebar-close-btn');
    if (!sb) return;
    if (open) { sb.classList.add('open'); if (ov) ov.classList.add('active'); if (closeBtn) closeBtn.style.display = 'flex'; }
    else { sb.classList.remove('open'); if (ov) ov.classList.remove('active'); if (closeBtn) closeBtn.style.display = 'none'; }
  }

  function dayBucket(ts) {
    var d = new Date(Number(ts));
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (d.getTime() >= start) return t('today');
    if (d.getTime() >= start - 86400000) return t('yesterday');
    if (d.getTime() >= start - 6 * 86400000) return t('week');
    return t('older');
  }

  function setSidebarView(view) {
    sidebarView = view;
    ['chats', 'projects', 'docs', 'artifacts', 'prompts'].forEach(function(v) {
      var el = document.getElementById('tab-' + v);
      if (el) { if (v === view) el.classList.add('active'); else el.classList.remove('active'); }
    });
    if (view === 'artifacts') loadPublishedArtifacts();
    else renderSidebar();
  }

  function renderSidebar(filterText) {
    filterText = (filterText || (document.getElementById('history-search') && document.getElementById('history-search').value) || '').trim().toLowerCase();
    var list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    if (sidebarView === 'projects') return renderProjectsList(list, filterText);
    if (sidebarView === 'docs') return renderDocsList(list, filterText);
    if (sidebarView === 'artifacts') return renderArtifactsList(list, filterText);
    if (sidebarView === 'prompts') { if (window.TAP) TAP.renderSidebar(list, filterText); return; }
    renderHistoryList(list, filterText);
  }

  async function loadPublishedArtifacts() {
    if (!authToken) {
      publishedArtifacts = [];
      renderSidebar();
      return;
    }
    try {
      var res = await fetch('/api/artifact', { headers: { 'Authorization': 'Bearer ' + authToken } });
      var data = await res.json().catch(function() { return {}; });
      publishedArtifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
      if (data.handle && currentUser) {
        currentUser.handle = data.handle;
        try { localStorage.setItem('personal_ai_user', JSON.stringify(currentUser)); } catch (e2) {}
        updateUserUI();
      }
    } catch (e) {
      publishedArtifacts = [];
    }
    renderSidebar();
  }

  async function openPublishedArtifact(slug, dest) {
    if (!authToken || !slug) return;
    try {
      var res = await fetch('/api/artifact/' + encodeURIComponent(slug) + '?dest=' + encodeURIComponent(dest || 'artifact'), {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok || !data.artifact) throw new Error(data.error || 'No se pudo abrir');
      var rec = data.artifact;
      openArtifact({
        title: rec.title,
        content: rec.content,
        lang: rec.lang || 'markdown',
        slug: rec.slug,
        url: rec.url,
        dest: rec.dest || 'artifact',
        handle: rec.handle || '',
        extras: rec.extras || { sources: [], resources: [], widgets: [] }
      }, { focus: true });
    } catch (err) {
      alert(err.message || 'No se pudo abrir el artifact');
    }
  }

  function renderArtifactsList(list, filterText) {
    var neu = document.createElement('button');
    neu.type = 'button';
    neu.className = 'new-chat-btn';
    neu.style.margin = '4px 4px 6px';
    neu.innerHTML = '<span>+ Nuevo artifact</span>';
    neu.addEventListener('click', function() {
      openArtifact({ title: 'Artifact', content: '', lang: 'markdown' }, { focus: true });
    });
    list.appendChild(neu);
    var head = document.createElement('a');
    head.href = '/artifact';
    head.target = '_blank';
    head.rel = 'noopener';
    head.className = 'new-chat-btn ghost';
    head.style.margin = '0 4px 10px';
    head.style.textDecoration = 'none';
    head.innerHTML = '<span>Ver página pública</span>';
    list.appendChild(head);
    if (!authToken) {
      var need = document.createElement('div');
      need.className = 'empty-side';
      need.textContent = 'Crea una cuenta o inicia sesión. Solo verás lo tuyo, firmado con @usuario.';
      list.appendChild(need);
      return;
    }
    var filtered = publishedArtifacts.filter(function(a) {
      if (!filterText) return true;
      return (a.title || '').toLowerCase().includes(filterText) || (a.slug || '').toLowerCase().includes(filterText);
    });
    if (!filtered.length) {
      var emptyA = document.createElement('div');
      emptyA.className = 'empty-side';
      emptyA.textContent = 'Aún no has publicado artifacts.';
      list.appendChild(emptyA);
      return;
    }
    filtered.forEach(function(a) {
      var item = document.createElement('div');
      item.className = 'doc-item art-row';
      var top = document.createElement('div');
      var title = document.createElement('span');
      title.className = 'doc-title';
      title.textContent = a.title || a.slug;
      top.appendChild(title);
      item.appendChild(top);
      var slugEl = document.createElement('div');
      slugEl.className = 'art-row-slug';
      var destLabel = a.dest === 'guide' ? 'Guides' : 'Library';
      slugEl.innerHTML = '<span class="art-row-dest">' + destLabel + '</span> · ' +
        escapeHtml((a.handle ? '@' + a.handle + '/' : '') + a.slug);
      item.appendChild(slugEl);
      var actions = document.createElement('div');
      actions.className = 'art-row-actions';
      var openPub = document.createElement('button');
      openPub.type = 'button';
      openPub.className = 'topbar-action-btn';
      openPub.textContent = 'Abrir';
      openPub.addEventListener('click', function(e) {
        e.stopPropagation();
        window.open(a.url || (a.dest === 'guide'
          ? ('https://guides.personal-ai.workers.dev/u/@' + (a.handle || '') + '/' + a.slug)
          : ('/library/' + a.slug)), '_blank', 'noopener');
      });
      var preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'topbar-action-btn';
      preview.textContent = 'Ver';
      preview.addEventListener('click', function(e) {
        e.stopPropagation();
        openPublishedArtifact(a.slug, a.dest);
      });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'topbar-action-btn';
      del.textContent = 'Despublicar';
      del.addEventListener('click', function(e) {
        e.stopPropagation();
        currentArtifact = { title: a.title, slug: a.slug, url: a.url, content: '', lang: a.lang, dest: a.dest || 'artifact', handle: a.handle };
        unpublishArtifact().then(function() { loadPublishedArtifacts(); });
      });
      actions.appendChild(preview);
      actions.appendChild(openPub);
      actions.appendChild(del);
      item.appendChild(actions);
      item.addEventListener('click', function() { openPublishedArtifact(a.slug, a.dest); });
      list.appendChild(item);
    });
  }

  function renderHistoryList(list, filterText) {
    var keys = Object.keys(chats).sort(function(a, b) {
      var pa = chats[a] && chats[a].pinned ? 1 : 0;
      var pb = chats[b] && chats[b].pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return Number(b) - Number(a);
    });
    keys = keys.filter(function(k) {
      var c = chats[k];
      if (!c) return false;
      if (currentProjectId && c.projectId !== currentProjectId) return false;
      if (!!c.archived !== showArchived) return false;
      if (filterText && !(c.title || '').toLowerCase().includes(filterText)) return false;
      return true;
    });
    var archCount = Object.keys(chats).filter(function(k) { return chats[k] && chats[k].archived; }).length;
    if (archCount || showArchived) {
      var archBar = document.createElement('div');
      archBar.className = 'hist-bar';
      archBar.innerHTML = '<button type="button" class="hist-bar-btn" id="toggle-archived">' +
        (showArchived ? '← ' + t('chats') : t('archived') + (archCount ? ' (' + archCount + ')' : '')) + '</button>';
      list.appendChild(archBar);
    }
    if (currentProjectId) {
      var proj = projects.find(function(p) { return p.id === currentProjectId; });
      var bar = document.createElement('div');
      bar.className = 'proj-bar';
      bar.innerHTML = PROJ_ICON + '<span class="proj-bar-name">' + escapeHtml((proj && proj.name) || '—') + '</span>' +
        '<button type="button" class="hist-bar-btn" id="clear-project-filter">' + escapeHtml(pt('exit')) + '</button>';
      list.appendChild(bar);
    }
    if (!keys.length) {
      var emptyH = document.createElement('div');
      emptyH.className = 'empty-side';
      emptyH.textContent = t('noChats');
      list.appendChild(emptyH);
      return;
    }
    var lastBucket = '';
    keys.forEach(function(k) {
      var bucket = dayBucket(k);
      if (bucket !== lastBucket) {
        var h = document.createElement('div');
        h.className = 'history-section-title';
        h.textContent = bucket;
        list.appendChild(h);
        lastBucket = bucket;
      }
      var item = document.createElement('div');
      item.className = 'history-item' + (k === currentChatId ? ' active' : '');
      item.innerHTML = '<span class="history-title">' + (chats[k].pinned ? '• ' : '') + escapeHtml(chats[k].title || t('chats')) + '</span>' +
        '<button class="history-del-btn" data-arch-id="' + k + '" title="' + (chats[k].archived ? t('unarchive') : t('archive')) + '">▭</button>' +
        '<button class="history-del-btn" data-pin-id="' + k + '" title="' + t('pin') + '">*</button>' +
        '<button class="history-del-btn" data-del-id="' + k + '" title="✕">✕</button>';
      item.onclick = function(e) {
        if (e.target.getAttribute('data-arch-id')) {
          chats[k].archived = !chats[k].archived;
          saveChats();
          renderSidebar();
          return;
        }
        if (e.target.getAttribute('data-pin-id')) {
          chats[k].pinned = !chats[k].pinned;
          saveChats();
          renderSidebar();
          return;
        }
        if (e.target.classList.contains('history-del-btn')) {
          var delId = e.target.getAttribute('data-del-id') || k;
          if (localStorage.getItem('ta_confirm_del') !== '0' && !confirm(t('confirmDeleteOne'))) return;
          delete chats[delId];
          saveChats();
          if (delId === currentChatId) startNewChat();
          else renderSidebar();
          return;
        }
        currentChatId = k;
        loadChatView();
        renderSidebar();
        updateTempBadge();
        if (window.innerWidth <= 860) toggleSidebar(false);
      };
      list.appendChild(item);
    });
  }

  var PROJ_ICON = '<svg class="proj-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>';
  var PROJ_EDIT_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  var PROJ_DEL_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  var PROJ_I18N = {
    es: { emptyTitle: 'Aún no hay proyectos', newProject: 'Nuevo proyecto', editProject: 'Editar proyecto', name: 'Nombre', namePh: 'Ej.: Lanzamiento de la web', desc: 'Descripción', descPh: '¿De qué trata este proyecto?', instr: 'Instrucciones', instrPh: 'Cómo debe responder el asistente en este proyecto: contexto, tono, formato…', role: 'Rol por defecto', files: 'Archivos', filesHint: 'Texto, Markdown, CSV, JSON o código · máx. 200 KB por archivo. Se usan como contexto en los chats del proyecto.', addFiles: 'Añadir archivos', noFiles: 'Sin archivos todavía', remove: 'Quitar', cancel: 'Cancelar', save: 'Guardar', create: 'Crear proyecto', del: 'Eliminar', delTitle: '¿Eliminar el proyecto?', delBody: 'Se eliminarán «{n}» y sus archivos. Las conversaciones se conservan, sin proyecto.', edit: 'Editar', exit: 'Salir', label: 'Proyecto', chatsN: '{n} chats', chat1: '1 chat', filesN: '{n} archivos', file1: '1 archivo', empty: 'Agrupa chats, instrucciones y archivos por tema.', nameReq: 'Ponle un nombre al proyecto.', tooBig: '{f}: demasiado grande (máx. 200 KB)', notText: '{f}: formato no compatible', created: 'Proyecto creado', saved: 'Proyecto guardado', deleted: 'Proyecto eliminado', switched: 'Proyecto activo: {n}', left: 'Sin proyecto activo', ctxHead: 'Contexto del proyecto «{n}»', instrHead: 'Instrucciones del proyecto' },
    en: { emptyTitle: 'No projects yet', newProject: 'New project', editProject: 'Edit project', name: 'Name', namePh: 'e.g. Website launch', desc: 'Description', descPh: 'What is this project about?', instr: 'Instructions', instrPh: 'How the assistant should answer in this project: context, tone, format…', role: 'Default role', files: 'Files', filesHint: 'Text, Markdown, CSV, JSON or code · max 200 KB per file. Used as context in this project’s chats.', addFiles: 'Add files', noFiles: 'No files yet', remove: 'Remove', cancel: 'Cancel', save: 'Save', create: 'Create project', del: 'Delete', delTitle: 'Delete project?', delBody: '“{n}” and its files will be deleted. Conversations are kept, without a project.', edit: 'Edit', exit: 'Exit', label: 'Project', chatsN: '{n} chats', chat1: '1 chat', filesN: '{n} files', file1: '1 file', empty: 'Group chats, instructions and files by topic.', nameReq: 'Give the project a name.', tooBig: '{f}: too large (max 200 KB)', notText: '{f}: unsupported format', created: 'Project created', saved: 'Project saved', deleted: 'Project deleted', switched: 'Active project: {n}', left: 'No active project', ctxHead: 'Context for project “{n}”', instrHead: 'Project instructions' },
    ca: { emptyTitle: 'Encara no hi ha projectes', newProject: 'Nou projecte', editProject: 'Edita el projecte', name: 'Nom', namePh: 'P. ex.: Llançament del web', desc: 'Descripció', descPh: 'De què tracta aquest projecte?', instr: 'Instruccions', instrPh: 'Com ha de respondre l’assistent en aquest projecte: context, to, format…', role: 'Rol per defecte', files: 'Fitxers', filesHint: 'Text, Markdown, CSV, JSON o codi · màx. 200 KB per fitxer. S’usen com a context als xats del projecte.', addFiles: 'Afegeix fitxers', noFiles: 'Encara no hi ha fitxers', remove: 'Treu', cancel: 'Cancel·la', save: 'Desa', create: 'Crea el projecte', del: 'Elimina', delTitle: 'Vols eliminar el projecte?', delBody: 'S’eliminaran «{n}» i els seus fitxers. Les converses es conserven, sense projecte.', edit: 'Edita', exit: 'Surt', label: 'Projecte', chatsN: '{n} xats', chat1: '1 xat', filesN: '{n} fitxers', file1: '1 fitxer', empty: 'Agrupa xats, instruccions i fitxers per tema.', nameReq: 'Posa un nom al projecte.', tooBig: '{f}: massa gran (màx. 200 KB)', notText: '{f}: format no compatible', created: 'Projecte creat', saved: 'Projecte desat', deleted: 'Projecte eliminat', switched: 'Projecte actiu: {n}', left: 'Cap projecte actiu', ctxHead: 'Context del projecte «{n}»', instrHead: 'Instruccions del projecte' }
  };
  function pt(k) {
    var l = (window.TA && TA.lang) ? TA.lang() : 'es';
    var d = PROJ_I18N[l] || PROJ_I18N[l === 'es' || l === 'ca' ? l : 'en'] || PROJ_I18N.en;
    return d[k] != null ? d[k] : PROJ_I18N.en[k];
  }
  function projectById(id) { if (!id) return null; for (var i = 0; i < projects.length; i++) if (projects[i] && projects[i].id === id) return projects[i]; return null; }
  function projectDocs(id) { return documents.filter(function(d) { return d.projectId === id; }); }
  function projCount(n, one, many) { return n === 1 ? pt(one) : pt(many).replace('{n}', n); }
  function projAnnounce(msg) { try { if (window.TAP && TAP._ && TAP._.announce) TAP._.announce(msg); } catch(eA) {} }
  function projectContext() {
    var p = projectById(currentProjectId);
    if (!p) return '';
    var parts = [pt('ctxHead').replace('{n}', p.name)];
    if (p.description) parts.push(String(p.description).slice(0, 300));
    if (p.instructions) parts.push(pt('instrHead') + ':\n' + String(p.instructions).slice(0, 4000));
    return parts.join('\n');
  }
  function projectHeroHtml() {
    var p = projectById(currentProjectId);
    if (!p) return '';
    return '<div class="proj-hero">' + PROJ_ICON + '<span class="proj-hero-label">' + escapeHtml(pt('label')) + '</span>' +
      '<strong class="proj-hero-name">' + escapeHtml(p.name) + '</strong>' +
      '<button type="button" class="hist-bar-btn" id="proj-hero-edit">' + escapeHtml(pt('edit')) + '</button>' +
      '<button type="button" class="hist-bar-btn" id="proj-hero-exit">' + escapeHtml(pt('exit')) + '</button></div>';
  }
  function switchProject(id) {
    var p = projectById(id);
    currentProjectId = p ? p.id : null;
    try { if (currentProjectId) localStorage.setItem('ta_project_active', currentProjectId); else localStorage.removeItem('ta_project_active'); } catch(eS) {}
    if (p && p.role && window.TAP && TAP._ && TAP._.setRole) { try { TAP._.setRole(p.role); } catch(eR) {} }
    var cur = chats[currentChatId];
    if (p && cur && Array.isArray(cur.messages) && cur.messages.length && cur.projectId !== p.id) {
      currentChatId = Date.now().toString();
    }
    sidebarView = 'chats';
    setSidebarView('chats');
    var c2 = chats[currentChatId];
    if (!c2 || !c2.messages || !c2.messages.length) loadChatView();
    projAnnounce(p ? pt('switched').replace('{n}', p.name) : pt('left'));
  }

  function renderProjectsList(list, filterText) {
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'new-chat-btn proj-new-btn';
    head.id = 'new-project-btn';
    head.innerHTML = '<span class="nc-main"><svg class="nc-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>' + escapeHtml(pt('newProject')) + '</span></span>';
    head.onclick = function() { openProjectModal(null); };
    list.appendChild(head);
    var filtered = projects.filter(function(p) {
      if (!p) return false;
      if (!filterText) return true;
      return ((p.name || '') + ' ' + (p.description || '')).toLowerCase().includes(filterText);
    });
    if (!filtered.length) {
      var emptyP = document.createElement('div');
      emptyP.className = 'empty-side proj-empty';
      emptyP.innerHTML = '<strong>' + escapeHtml(pt('emptyTitle')) + '</strong><span>' + escapeHtml(pt('empty')) + '</span>';
      list.appendChild(emptyP);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'proj-cards';
    wrap.setAttribute('role', 'list');
    filtered.forEach(function(p) {
      var nChats = Object.keys(chats).filter(function(k) { return chats[k] && chats[k].projectId === p.id; }).length;
      var nFiles = projectDocs(p.id).length;
      var active = currentProjectId === p.id;
      var card = document.createElement('div');
      card.className = 'proj-card' + (active ? ' active' : '');
      card.setAttribute('role', 'listitem');
      card.setAttribute('data-proj', p.id);
      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'proj-card-main';
      if (active) main.setAttribute('aria-current', 'true');
      main.innerHTML = '<span class="proj-card-ico">' + PROJ_ICON + '</span><span class="proj-card-body">' +
        '<span class="proj-card-name">' + escapeHtml(p.name) + '</span>' +
        (p.description ? '<span class="proj-card-desc">' + escapeHtml(p.description) + '</span>' : '') +
        '<span class="proj-card-meta">' + escapeHtml(projCount(nChats, 'chat1', 'chatsN') + ' · ' + projCount(nFiles, 'file1', 'filesN')) + '</span></span>';
      main.onclick = function() { switchProject(p.id); if (window.innerWidth <= 860) toggleSidebar(false); };
      var acts = document.createElement('div');
      acts.className = 'proj-card-acts';
      var eb = document.createElement('button');
      eb.type = 'button'; eb.className = 'proj-act'; eb.setAttribute('data-proj-edit', p.id);
      eb.setAttribute('aria-label', pt('edit') + ': ' + p.name); eb.title = pt('edit');
      eb.innerHTML = PROJ_EDIT_ICON;
      eb.onclick = function(e) { e.stopPropagation(); openProjectModal(p); };
      var db = document.createElement('button');
      db.type = 'button'; db.className = 'proj-act'; db.setAttribute('data-proj-del', p.id);
      db.setAttribute('aria-label', pt('del') + ': ' + p.name); db.title = pt('del');
      db.innerHTML = PROJ_DEL_ICON;
      db.onclick = function(e) { e.stopPropagation(); confirmDeleteProject(p); };
      acts.appendChild(eb); acts.appendChild(db);
      card.appendChild(main); card.appendChild(acts);
      wrap.appendChild(card);
    });
    list.appendChild(wrap);
  }

  function deleteProject(id) {
    projects = projects.filter(function(x) { return x && x.id !== id; });
    Object.keys(chats).forEach(function(k) { if (chats[k] && chats[k].projectId === id) chats[k].projectId = null; });
    documents = documents.filter(function(d) { return d.projectId !== id; });
    if (currentProjectId === id) { currentProjectId = null; try { localStorage.removeItem('ta_project_active'); } catch(eD) {} }
    saveProjects(); saveChats(); saveDocuments();
    renderSidebar();
    var c = chats[currentChatId];
    if (!c || !c.messages || !c.messages.length) loadChatView();
    var nb = document.getElementById('new-project-btn'); if (nb && sidebarView === 'projects') nb.focus();
    projAnnounce(pt('deleted'));
  }

  function confirmDeleteProject(p) {
    if (!(window.TAP && TAP._ && TAP._.dialog)) { if (window.confirm(pt('delTitle'))) deleteProject(p.id); return; }
    var U = TAP._;
    var d;
    var cancel = U.btn(pt('cancel'), '', function() { d.close(); });
    var del = U.btn(pt('del'), 'primary danger', function() { d.close('ok'); deleteProject(p.id); });
    del.id = 'proj-del-confirm';
    d = U.dialog({
      title: pt('delTitle'),
      body: U.el('p', { class: 'proj-del-body', text: pt('delBody').replace('{n}', p.name) }),
      buttons: [cancel, del],
      initialFocus: cancel,
      returnFocus: document.getElementById('tab-projects') || undefined
    });
    d.card.classList.add('proj-dialog-sm');
  }

  var PROJ_TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|html?|css|js|mjs|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|sh|xml|ya?ml|toml|ini|sql|log)$/i;
  function openProjectModal(p) {
    if (!(window.TAP && TAP._ && TAP._.dialog)) {
      var nm = prompt(t('projName'));
      if (!nm || !nm.trim()) return;
      var np = { id: 'p_' + Date.now(), name: nm.trim().slice(0, 60), description: '', instructions: '', role: '', created: Date.now() };
      projects.unshift(np); saveProjects(); switchProject(np.id);
      return;
    }
    var U = TAP._;
    var editing = !!p;
    var name = U.el('input', { class: 'form-input', type: 'text', maxlength: '60', placeholder: pt('namePh'), autocomplete: 'off', id: 'proj-f-name', required: true });
    var desc = U.el('textarea', { class: 'form-textarea proj-desc', rows: '2', maxlength: '300', placeholder: pt('descPh'), id: 'proj-f-desc' });
    var instr = U.el('textarea', { class: 'form-textarea', rows: '5', maxlength: '4000', placeholder: pt('instrPh'), id: 'proj-f-instr' });
    var role = U.el('select', { class: 'form-input proj-role', id: 'proj-f-role' });
    var roleList = [];
    try { roleList = (U.roles() || []).filter(function(r) { return r.id !== 'custom'; }); } catch(eRl) {}
    roleList.forEach(function(r) { role.appendChild(U.el('option', { value: r.id === 'none' ? '' : r.id, text: r.name })); });
    if (editing) { name.value = p.name || ''; desc.value = p.description || ''; instr.value = p.instructions || ''; role.value = p.role || ''; }
    var err = U.el('p', { class: 'proj-err', role: 'alert', id: 'proj-f-err' });
    var keep = editing ? projectDocs(p.id).map(function(d) { return { id: d.id, title: d.title, size: String(d.content || '').length }; }) : [];
    var removed = {};
    var added = [];
    var fileList = U.el('ul', { class: 'proj-files', id: 'proj-f-files' });
    function paintFiles() {
      fileList.innerHTML = '';
      var items = keep.filter(function(f) { return !removed[f.id]; }).concat(added);
      if (!items.length) { fileList.appendChild(U.el('li', { class: 'proj-file-empty', text: pt('noFiles') })); return; }
      items.forEach(function(f) {
        var kb = Math.max(1, Math.round((f.size || 0) / 1024)) + ' KB';
        var x = U.el('button', { type: 'button', class: 'proj-file-x', 'aria-label': pt('remove') + ': ' + f.title, title: pt('remove'), text: '✕', onclick: function() {
          if (f.id) removed[f.id] = true; else added = added.filter(function(a) { return a !== f; });
          paintFiles();
        } });
        fileList.appendChild(U.el('li', { class: 'proj-file' }, [U.el('span', { class: 'proj-file-name', text: f.title }), U.el('span', { class: 'proj-file-size', text: kb }), x]));
      });
    }
    paintFiles();
    var picker = U.el('input', { type: 'file', multiple: true, class: 'proj-file-input', id: 'proj-f-input', tabindex: '-1', 'aria-hidden': 'true',
      accept: '.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.css,.js,.mjs,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.sh,.xml,.yaml,.yml,.toml,.ini,.sql,.log,text/*' });
    picker.addEventListener('change', function() {
      var fs = Array.prototype.slice.call(picker.files || []);
      var msgs = [];
      var jobs = fs.map(function(f) {
        if (f.size > 200 * 1024) { msgs.push(pt('tooBig').replace('{f}', f.name)); return Promise.resolve(); }
        if (!(PROJ_TEXT_EXT.test(f.name) || /^text\//.test(f.type || ''))) { msgs.push(pt('notText').replace('{f}', f.name)); return Promise.resolve(); }
        return f.text().then(function(txt) {
          if (txt.indexOf('\u0000') !== -1) { msgs.push(pt('notText').replace('{f}', f.name)); return; }
          added.push({ title: f.name.slice(0, 120), content: txt.slice(0, 20000), size: Math.min(txt.length, 20000), lang: (f.name.split('.').pop() || '').toLowerCase() });
        }).catch(function() { msgs.push(pt('notText').replace('{f}', f.name)); });
      });
      Promise.all(jobs).then(function() { picker.value = ''; err.textContent = msgs.join(' · '); paintFiles(); });
    });
    var addBtn = U.el('button', { type: 'button', class: 'settings-foot-btn proj-add-files', id: 'proj-f-add', text: '+ ' + pt('addFiles'), onclick: function() { picker.click(); } });
    var filesGroup = U.el('div', { class: 'form-group proj-files-group' }, [
      U.el('span', { class: 'form-label', id: 'proj-f-files-l', text: pt('files') }),
      U.el('p', { class: 'proj-hint', text: pt('filesHint') }),
      fileList, addBtn, picker
    ]);
    fileList.setAttribute('aria-labelledby', 'proj-f-files-l');
    var rowTop = U.el('div', { class: 'proj-row' }, [U.field(pt('name'), name), roleList.length ? U.field(pt('role'), role) : null]);
    var body = U.el('div', { class: 'proj-form' }, [rowTop, U.field(pt('desc'), desc), U.field(pt('instr'), instr), filesGroup, err]);
    var d;
    function save() {
      var n = name.value.trim();
      if (!n) { err.textContent = pt('nameReq'); name.setAttribute('aria-invalid', 'true'); name.focus(); return; }
      var obj = editing ? p : { id: 'p_' + Date.now() + Math.random().toString(36).slice(2, 6), created: Date.now() };
      obj.name = n.slice(0, 60);
      obj.description = desc.value.trim().slice(0, 300);
      obj.instructions = instr.value.trim().slice(0, 4000);
      obj.role = role.value || '';
      obj.updated = Date.now();
      if (!editing) projects.unshift(obj);
      documents = documents.filter(function(x) { return !removed[x.id]; });
      added.forEach(function(f, i) {
        documents.push({ id: 'doc_' + Date.now() + '_' + i, title: f.title, content: f.content, type: 'file', lang: f.lang, created: Date.now(), projectId: obj.id });
      });
      while (documents.length > 40) {
        var idx = documents.findIndex(function(x) { return !x.projectId; });
        documents.splice(idx === -1 ? 0 : idx, 1);
      }
      saveProjects(); saveDocuments();
      d.close('ok');
      if (!editing) { switchProject(obj.id); if (window.innerWidth <= 860) toggleSidebar(false); }
      else {
        if (currentProjectId === obj.id && obj.role && window.TAP && TAP._ && TAP._.setRole) { try { TAP._.setRole(obj.role); } catch(eR2) {} }
        renderSidebar();
        var cc = chats[currentChatId];
        if (!cc || !cc.messages || !cc.messages.length) loadChatView();
      }
      projAnnounce(editing ? pt('saved') : pt('created'));
    }
    var saveBtn = U.btn(editing ? pt('save') : pt('create'), 'primary', save);
    saveBtn.id = 'proj-f-save';
    var buttons = [U.btn(pt('cancel'), 'proj-cancel', function() { d.close(); }), saveBtn];
    if (editing) {
      var delBtn = U.btn(pt('del'), 'proj-del-link', function() { d.close('del'); confirmDeleteProject(p); });
      buttons.unshift(delBtn);
    }
    name.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    d = U.dialog({ title: editing ? pt('editProject') : pt('newProject'), body: body, buttons: buttons, initialFocus: name, wide: false });
    d.card.classList.add('proj-dialog');
    d.card.id = 'proj-dialog';
  }

  function renderDocsList(list, filterText) {
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'new-chat-btn';
    head.style.margin = '4px 4px 10px';
    head.innerHTML = '<span>+ ' + t('addDoc') + '</span>';
    head.onclick = function() { openKnowledgeModal(); };
    list.appendChild(head);
    var filtered = documents.filter(function(d) {
      if (currentProjectId && d.projectId && d.projectId !== currentProjectId) return false;
      if (filterText && !(d.title || '').toLowerCase().includes(filterText)) return false;
      return true;
    });
    if (!filtered.length) {
      var emptyD = document.createElement('div');
      emptyD.className = 'empty-side';
      emptyD.textContent = t('noDocs');
      list.appendChild(emptyD);
      return;
    }
    filtered.slice().reverse().forEach(function(d) {
      var item = document.createElement('div');
      item.className = 'doc-item';
      item.innerHTML = '<span class="doc-title">' + escapeHtml(d.title || 'Documento') + '</span>' +
        '<button class="mini-x" data-del-doc="' + d.id + '">✕</button>';
      item.onclick = function(e) {
        if (e.target.getAttribute('data-del-doc')) {
          documents = documents.filter(function(x) { return x.id !== d.id; });
          saveDocuments();
          renderSidebar();
          return;
        }
        openArtifact({ title: d.title, content: d.content, lang: d.lang || 'text' }, { focus: true });
      };
      list.appendChild(item);
    });
  }

  function createProject() { openProjectModal(null); }

  function addDocument(doc) {
    documents.push({
      id: 'doc_' + Date.now(),
      title: doc.title || 'Documento',
      content: String(doc.content || '').slice(0, 20000),
      type: doc.type || 'note',
      lang: doc.lang || '',
      created: Date.now(),
      projectId: currentProjectId
    });
    while (documents.length > 40) {
      var evict = documents.findIndex(function(x) { return !x.projectId; });
      documents.splice(evict === -1 ? 0 : evict, 1);
    }
    saveDocuments();
  }

  function scrollToEnd() {
    var s = document.getElementById('chat-scroll');
    if (s) s.scrollTop = s.scrollHeight;
  }

  function paintAttachedBadge(file) {
    var nameEl = document.getElementById('attached-name');
    var kindEl = document.getElementById('attached-kind');
    var thumb = document.getElementById('attached-thumb');
    var badge = document.getElementById('attached-badge');
    if (nameEl) nameEl.textContent = file.name;
    if (kindEl) kindEl.textContent = file.kind === 'image' ? t('image') : t('attached');
    if (thumb) {
      if (file.kind === 'image' && file.dataUrl) {
        thumb.src = file.dataUrl;
        thumb.hidden = false;
      } else {
        thumb.removeAttribute('src');
        thumb.hidden = true;
      }
    }
    if (badge) badge.classList.add('active');
  }
  function compressImageFile(file, maxDim, quality) {
    return new Promise(function(resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function() {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function() {
        URL.revokeObjectURL(url);
        reject(new Error('image'));
      };
      img.src = url;
    });
  }
  function attachDroppedFile(f) {
    if (!f) return;
    if (/^image\//.test(f.type)) {
      if (f.size > 8 * 1024 * 1024) return alert(t('maxImage'));
      compressImageFile(f, 1280, 0.72).then(function(dataUrl) {
        attachedFile = { name: f.name, kind: 'image', dataUrl: dataUrl, mime: 'image/jpeg' };
        paintAttachedBadge(attachedFile);
      }).catch(function() { alert(t('error')); });
      return;
    }
    if (f.size > 250000) return alert('Tamaño máximo: 250 KB.');
    var reader = new FileReader();
    reader.onload = function(ev) {
      attachedFile = { name: f.name, kind: 'text', content: ev.target.result };
      paintAttachedBadge(attachedFile);
    };
    reader.readAsText(f);
  }
  function handleFileUpload(e) {
    var f = e.target.files[0];
    attachDroppedFile(f);
  }
  function removeAttachedFile() {
    attachedFile = null;
    var badge = document.getElementById('attached-badge');
    if (badge) badge.classList.remove('active');
    var thumb = document.getElementById('attached-thumb');
    if (thumb) { thumb.hidden = true; thumb.removeAttribute('src'); }
    var up = document.getElementById('file-uploader');
    if (up) up.value = '';
  }

  var speechRec = null;
  var mediaRec = null;
  var mediaChunks = [];
  var mediaStream = null;
  function stopMicVisual() {
    var btn = document.getElementById('mic-btn');
    if (btn) btn.classList.remove('recording');
  }
  function appendTranscript(text) {
    if (!text) return;
    var inp = document.getElementById('prompt-input');
    if (!inp) return;
    inp.value = (inp.value ? inp.value.replace(/\s+$/, '') + ' ' : '') + text;
    autoResize(inp);
  }
  async function transcribeBlob(blob) {
    var headers = {};
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    var userApiKey = localStorage.getItem('ta_custom_key') || '';
    if (userApiKey) headers['x-groq-user-key'] = userApiKey;
    var fd = new FormData();
    fd.append('file', blob, 'voice.webm');
    var lang = (window.TA && TA.lang) ? TA.lang() : 'es';
    var res = await fetch('/api/transcribe?lang=' + encodeURIComponent(lang), { method: 'POST', headers: headers, body: fd });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) throw new Error(data.error || t('error'));
    return data.text || '';
  }
  function toggleSpeech() {
    var btn = document.getElementById('mic-btn');
    if (speechRec || mediaRec) {
      if (speechRec) { try { speechRec.stop(); } catch (e) {} speechRec = null; }
      if (mediaRec && mediaRec.state !== 'inactive') { try { mediaRec.stop(); } catch (e) {} }
      return;
    }
    stopSpeaking();
    var liveText = '';
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      speechRec = new SpeechRec();
      speechRec.lang = uiLangBcp47();
      speechRec.interimResults = true;
      speechRec.continuous = true;
      speechRec.onstart = function() { if (btn) btn.classList.add('recording'); };
      speechRec.onresult = function(ev) {
        var out = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) out += ev.results[i][0].transcript;
        }
        if (out) { liveText += (liveText ? ' ' : '') + out; appendTranscript(out); }
      };
      speechRec.onerror = function() {};
      try { speechRec.start(); } catch (e) { speechRec = null; }
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (!speechRec) alert(t('voiceUnsupported'));
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      mediaStream = stream;
      mediaChunks = [];
      var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      mediaRec = new MediaRecorder(stream);
      mediaRec.ondataavailable = function(ev) { if (ev.data && ev.data.size) mediaChunks.push(ev.data); };
      mediaRec.onstart = function() { if (btn) btn.classList.add('recording'); };
      mediaRec.onstop = function() {
        stopMicVisual();
        if (mediaStream) mediaStream.getTracks().forEach(function(tr) { tr.stop(); });
        mediaStream = null;
        mediaRec = null;
        if (speechRec) { try { speechRec.stop(); } catch (e2) {} speechRec = null; }
        if (liveText.trim()) return;
        if (!mediaChunks.length) return;
        var blob = new Blob(mediaChunks, { type: mime });
        mediaChunks = [];
        var inp = document.getElementById('prompt-input');
        if (inp) inp.placeholder = t('transcribing');
        transcribeBlob(blob).then(function(text) {
          appendTranscript(text);
          if (inp) inp.placeholder = t('askPh');
        }).catch(function() {
          if (inp) inp.placeholder = t('askPh');
          alert(t('error'));
        });
      };
      mediaRec.start();
      setTimeout(function() {
        if (mediaRec && mediaRec.state === 'recording') mediaRec.stop();
      }, 45000);
    }).catch(function() {
      if (!speechRec) alert(t('voiceUnsupported'));
    });
  }
  function speakLastReply() {
    var chat = chats[currentChatId];
    if (!chat || !chat.messages) return;
    for (var i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'ai' || chat.messages[i].role === 'assistant') {
        var btn = document.getElementById('speak-last-btn');
        speakText(chat.messages[i].content || '', btn);
        return;
      }
    }
  }

  function openModal(id) { var m = document.getElementById(id); if (m) m.classList.add('active'); }
  function closeModal(id) { var m = document.getElementById(id); if (m) m.classList.remove('active'); }
  function showSettingsPane(id) {
    document.querySelectorAll('.settings-pane').forEach(function(p) { p.classList.toggle('active', p.id === id); });
    document.querySelectorAll('.settings-nav-btn').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-pane') === id); });
  }
  function setChoice(pref, value) {
    document.querySelectorAll('[data-pref="' + pref + '"]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-value') === value);
    });
  }
  function planLabel() {
    if (localStorage.getItem('ta_custom_key')) return 'BYOK';
    if (currentUser && currentUser.tier === 'enterprise') return 'ENTERPRISE';
    return 'FREE';
  }
  function refreshUsagePane() {}
  var ideaCat = 'feat';
  function submitIdea() {
    var textEl = document.getElementById('idea-text');
    var mailEl = document.getElementById('idea-email');
    var status = document.getElementById('idea-status');
    var text = textEl ? textEl.value.trim() : '';
    if (text.length < 8) {
      if (status) status.textContent = t('ideaTooShort');
      return;
    }
    var btn = document.getElementById('idea-send-btn');
    if (btn) btn.disabled = true;
    if (btn && btn.getAttribute('data-ticket')) {
      fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: btn.getAttribute('data-ticket'), website: (document.getElementById('idea-website') || {}).value || '' })
      }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
        .then(function(res) {
          if (status) status.textContent = res.ok ? t('ideasOk') : (res.d.error || t('ideasErr'));
          if (res.ok && textEl) textEl.value = '';
          if (btn) { btn.removeAttribute('data-ticket'); btn.textContent = t('ideasSend') || 'Enviar a Owner'; }
        })
        .catch(function() { if (status) status.textContent = t('ideasErr'); })
        .then(function() { if (btn) btn.disabled = false; });
      return;
    }
    fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: text,
        email: (mailEl && mailEl.value) || (currentUser && currentUser.email) || '',
        name: (currentUser && currentUser.name) || '',
        cat: ideaCat,
        website: (document.getElementById('idea-website') || {}).value || ''
      })
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (res.ok && res.d && res.d.needsClick && res.d.ticket) {
          if (btn) { btn.setAttribute('data-ticket', res.d.ticket); btn.textContent = 'Haz clic para enviar el correo'; btn.disabled = false; }
          if (status) status.textContent = 'Confirma que eres una persona: pulsa el botón otra vez para enviar.';
          return;
        }
        if (status) status.textContent = res.ok ? t('ideasOk') : (res.d.message || t('ideasErr'));
        if (res.ok && textEl) textEl.value = '';
        if (btn) btn.disabled = false;
      })
      .catch(function() { if (status) status.textContent = t('ideasErr'); if (btn) btn.disabled = false; });
  }
  function openSettingsModal(tab) {
    if (typeof tab !== 'string') tab = 'pane-general';
    var kEl = document.getElementById('user-groq-key');
    var pEl = document.getElementById('custom-system-prompt');
    if (kEl) kEl.value = localStorage.getItem('ta_custom_key') || '';
    if (pEl) pEl.value = localStorage.getItem('ta_custom_prompt') || '';
    var enterEl = document.getElementById('set-enter-send');
    var autoEl = document.getElementById('set-auto-search');
    if (enterEl) enterEl.checked = localStorage.getItem('ta_enter_send') !== '0';
    if (autoEl) autoEl.checked = localStorage.getItem('ta_auto_search') === '1';
    var autoReadEl = document.getElementById('set-auto-read');
    if (autoReadEl) autoReadEl.checked = localStorage.getItem('ta_auto_read') === '1';
    var ideaMail = document.getElementById('idea-email');
    if (ideaMail && currentUser && currentUser.email && !ideaMail.value) ideaMail.value = currentUser.email;
    var timeEl = document.getElementById('set-show-time');
    var confEl = document.getElementById('set-confirm-del');
    var compactEl = document.getElementById('set-compact-sb');
    var motionEl = document.getElementById('set-reduce-motion');
    var docsEl = document.getElementById('set-use-docs');
    var ephEl = document.getElementById('set-ephemeral');
    if (timeEl) timeEl.checked = localStorage.getItem('ta_show_time') === '1';
    if (confEl) confEl.checked = localStorage.getItem('ta_confirm_del') !== '0';
    if (compactEl) compactEl.checked = localStorage.getItem('ta_compact_sb') === '1';
    if (motionEl) motionEl.checked = localStorage.getItem('ta_reduce_motion') === '1';
    if (docsEl) docsEl.checked = localStorage.getItem('ta_use_docs') !== '0';
    var adaptEl = document.getElementById('set-adapt');
    if (adaptEl) adaptEl.checked = adaptEnabled();
    pullProfile();
    if (ephEl) ephEl.checked = localStorage.getItem('ta_ephemeral') === '1';
    setChoice('ta_theme', localStorage.getItem('ta_theme') || 'dark');
    setChoice('ta_accent', localStorage.getItem('ta_accent') || 'auto');
    setChoice('ta_font', localStorage.getItem('ta_font') || 'md');
    setChoice('ta_len_mode', localStorage.getItem('ta_len_mode') || 'normal');
    setChoice('ta_tone', localStorage.getItem('ta_tone') || 'auto');
    if (window.TA && TA.mountPicker) TA.mountPicker(document.getElementById('set-lang'));
    var modelSel = document.getElementById('set-default-model');
    if (modelSel) {
      modelSel.innerHTML = MODELS.map(function(m) {
        return '<option value="' + m.id + '"' + (m.id === selectedModel ? ' selected' : '') + '>' + m.name + '</option>';
      }).join('');
    }
    var guest = document.getElementById('account-guest');
    var authed = document.getElementById('account-authed');
    if (currentUser && authToken) {
      if (guest) guest.style.display = 'none';
      if (authed) authed.style.display = 'block';
      var nameIn = document.getElementById('set-display-name');
      if (nameIn) nameIn.value = currentUser.name || '';
      var emailIn = document.getElementById('account-email-display');
      if (emailIn) emailIn.textContent = currentUser.email || '';
      var np = document.getElementById('set-notify-product');
      var ns = document.getElementById('set-notify-security');
      if (np) np.checked = currentUser.notifyProduct !== false;
      if (ns) ns.checked = currentUser.notifySecurity !== false;
      var nd = document.getElementById('set-notify-digest');
      if (nd) nd.checked = currentUser.notifyDigest === true;
      var curPass = document.getElementById('set-cur-pass');
      var neu = document.getElementById('set-new-pass');
      if (curPass) { curPass.value = ''; curPass.placeholder = t('currentPassword'); }
      if (neu) { neu.value = ''; neu.placeholder = t('newPassword'); }
      var passWrap = document.getElementById('password-fields');
      var oauthHint = document.getElementById('oauth-pass-hint');
      var oauthOnly = !currentUser.hasPassword && currentUser.provider && currentUser.provider !== 'email';
      if (passWrap) passWrap.style.display = oauthOnly ? 'none' : 'block';
      if (oauthHint) {
        oauthHint.style.display = oauthOnly ? 'block' : 'none';
        oauthHint.textContent = currentUser.provider === 'x' ? t('linkedX') : t('linkedGoogle');
      }
    } else {
      if (guest) guest.style.display = 'block';
      if (authed) authed.style.display = 'none';
    }
    var st = document.getElementById('settings-status');
    if (st) st.style.display = 'none';
    refreshUsagePane();
    showSettingsPane(tab || 'pane-general');
    openModal('modal-settings');
  }
  async function saveSettings() {
    var kEl = document.getElementById('user-groq-key');
    var pEl = document.getElementById('custom-system-prompt');
    var k = kEl ? kEl.value.trim() : '';
    var p = pEl ? pEl.value.trim() : '';
    if (k) localStorage.setItem('ta_custom_key', k); else localStorage.removeItem('ta_custom_key');
    if (p) localStorage.setItem('ta_custom_prompt', p); else localStorage.removeItem('ta_custom_prompt');
    var enterEl = document.getElementById('set-enter-send');
    var autoEl = document.getElementById('set-auto-search');
    localStorage.setItem('ta_enter_send', enterEl && enterEl.checked ? '1' : '0');
    localStorage.setItem('ta_auto_search', autoEl && autoEl.checked ? '1' : '0');
    var autoReadEl = document.getElementById('set-auto-read');
    localStorage.setItem('ta_auto_read', autoReadEl && autoReadEl.checked ? '1' : '0');
    var timeEl = document.getElementById('set-show-time');
    var confEl = document.getElementById('set-confirm-del');
    var compactEl = document.getElementById('set-compact-sb');
    var motionEl = document.getElementById('set-reduce-motion');
    var docsEl = document.getElementById('set-use-docs');
    var ephEl = document.getElementById('set-ephemeral');
    localStorage.setItem('ta_show_time', timeEl && timeEl.checked ? '1' : '0');
    localStorage.setItem('ta_confirm_del', confEl && confEl.checked ? '1' : '0');
    localStorage.setItem('ta_compact_sb', compactEl && compactEl.checked ? '1' : '0');
    localStorage.setItem('ta_reduce_motion', motionEl && motionEl.checked ? '1' : '0');
    localStorage.setItem('ta_use_docs', docsEl && docsEl.checked ? '1' : '0');
    localStorage.setItem('ta_ephemeral', ephEl && ephEl.checked ? '1' : '0');
    var modelSel = document.getElementById('set-default-model');
    if (modelSel && modelSel.value) setModel(modelSel.value);
    applyAppearance();
    if (ephEl && ephEl.checked) saveChats();
    if (autoEl) isWebSearch = !!autoEl.checked;
    var webBtn = document.getElementById('web-search-pill');
    if (webBtn) { if (isWebSearch) webBtn.classList.add('active'); else webBtn.classList.remove('active'); }
    updateUserUI();
    scheduleSync();
    var st = document.getElementById('settings-status');
    if (st) { st.textContent = t('saved'); st.style.display = 'block'; }
    setTimeout(function() { closeModal('modal-settings'); }, 500);
  }
  async function changePasswordFromSettings() {
    if (!authToken) return;
    var cur = (document.getElementById('set-cur-pass') || {}).value || '';
    var neu = (document.getElementById('set-new-pass') || {}).value || '';
    if (neu.length < 6) return alert(t('newPassword'));
    try {
      var res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
        body: JSON.stringify({ currentPassword: cur, newPassword: neu })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      document.getElementById('set-cur-pass').value = '';
      document.getElementById('set-new-pass').value = '';
      var st = document.getElementById('settings-status');
      if (st) { st.textContent = t('saved'); st.style.display = 'block'; }
    } catch (err) { alert(err.message); }
  }
  async function deleteAccountFromSettings() {
    if (!authToken) return;
    if (!confirm(t('deleteConfirm'))) return;
    var oauthOnly = currentUser && !currentUser.hasPassword && currentUser.provider && currentUser.provider !== 'email';
    var pw = oauthOnly ? '' : (prompt(t('currentPassword')) || '');
    try {
      var res = await fetch('/api/auth/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
        body: JSON.stringify({ password: pw })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      logout();
    } catch (err) { alert(err.message); }
  }
  function openProfileModal() {
    openSettingsModal('pane-account');
  }
  function logout() {
    authToken = ''; currentUser = null;
    publishedArtifacts = [];
    try { fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(function() {}); } catch (e) {}
    setTimeout(function() { location.href = '/login'; }, 120);
  }
  function updateUserUI() {
    var nameEl = document.getElementById('user-display-name');
    var tierEl = document.getElementById('user-display-tier');
    var topText = document.getElementById('topbar-auth-text');
    var letter = document.getElementById('user-letter');
    var topLetter = document.getElementById('topbar-letter');
    var topBtn = document.getElementById('topbar-auth-btn');
    if (currentUser && authToken) {
      var name = currentUser.name || currentUser.email;
      if (nameEl) nameEl.textContent = name;
      if (tierEl) {
        if (currentUser.handle) tierEl.textContent = '@' + currentUser.handle;
        else tierEl.textContent = currentUser.tier === 'enterprise' ? 'Enterprise' : t('verified');
      }
      if (topText) topText.textContent = name.split(' ')[0];
      if (letter) letter.textContent = (name[0] || 'T').toUpperCase();
      if (topLetter) { topLetter.hidden = false; topLetter.textContent = (name[0] || 'T').toUpperCase(); }
      if (topBtn) { topBtn.classList.remove('primary'); topBtn.classList.add('topbar-user-btn'); }
      var navOut = document.getElementById('nav-logout-btn');
      if (navOut) navOut.hidden = false;
    } else {
      var byok = localStorage.getItem('ta_custom_key');
      if (byok) {
        if (nameEl) nameEl.textContent = 'BYOK';
        if (tierEl) tierEl.textContent = t('unlimited');
        if (topText) topText.textContent = 'BYOK';
      } else {
        if (nameEl) nameEl.textContent = t('guest');
        if (tierEl) tierEl.textContent = t('tokensDay');
        if (topText) topText.textContent = t('access');
      }
      if (letter) letter.textContent = 'T';
      if (topLetter) topLetter.hidden = true;
      if (topBtn) { topBtn.classList.add('primary'); topBtn.classList.remove('topbar-user-btn'); }
      var navOut2 = document.getElementById('nav-logout-btn');
      if (navOut2) navOut2.hidden = true;
    }
  }

  function openProvidersModal() { renderCustomProviders(); openModal('modal-providers'); }
  function renderCustomProviders() {
    var box = document.getElementById('custom-conn-list');
    if (!box) return;
    if (!customProviders.length) { box.innerHTML = '<div class="empty-side">Sin webhooks propios.</div>'; return; }
    box.innerHTML = customProviders.map(function(c, i) {
      return '<div class="connector-card" style="padding:8px 10px"><div class="connector-info"><div class="connector-name">' + escapeHtml(c.name) + '</div>' +
        '<div class="connector-desc" style="font-family:var(--mono)">' + escapeHtml(c.url) + '</div></div>' +
        '<button data-del-conn-idx="' + i + '" class="del-conn-btn mini-x" style="opacity:1" type="button">✕</button></div>';
    }).join('');
  }
  function addCustomConnector() {
    var nameEl = document.getElementById('custom-conn-name');
    var urlEl = document.getElementById('custom-conn-url');
    var name = nameEl ? nameEl.value.trim() : '';
    var url = urlEl ? urlEl.value.trim() : '';
    if (!name || !url) return alert('Nombre y URL.');
    customProviders.push({ name: name, url: url, active: true });
    try { localStorage.setItem('ta_providers', JSON.stringify(customProviders)); } catch(e) {}
    if (nameEl) nameEl.value = '';
    if (urlEl) urlEl.value = '';
    renderCustomProviders();
  }
  function deleteConnector(idx) {
    customProviders.splice(idx, 1);
    try { localStorage.setItem('ta_providers', JSON.stringify(customProviders)); } catch(e) {}
    renderCustomProviders();
  }

  function openKnowledgeModal() { renderKnowledgeList(); openModal('modal-knowledge'); }
  function renderKnowledgeList() {
    var count = document.getElementById('knowledge-count');
    var box = document.getElementById('knowledge-list-box');
    if (count) count.textContent = documents.length;
    if (!box) return;
    if (!documents.length) { box.innerHTML = '<div class="empty-side">Sin documentos.</div>'; return; }
    box.innerHTML = documents.map(function(item) {
      return '<div style="background:var(--elev);border:1px solid var(--line);padding:6px 8px;border-radius:8px;display:flex;justify-content:space-between;gap:8px">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:0.75rem">' + escapeHtml(item.title) + '</div>' +
        '<button data-del-doc="' + item.id + '" class="del-rag-item-btn mini-x" style="opacity:1" type="button">✕</button></div>';
    }).join('');
  }
  function saveKnowledge() {
    var titleEl = document.getElementById('train-title');
    var contentEl = document.getElementById('train-content');
    var title = titleEl ? titleEl.value.trim() : '';
    var content = contentEl ? contentEl.value.trim() : '';
    if (!content) return alert('Introduce contenido.');
    addDocument({ title: title || 'Nota', content: content, type: 'note' });
    if (titleEl) titleEl.value = '';
    if (contentEl) contentEl.value = '';
    renderKnowledgeList();
    renderSidebar();
  }
  function deleteKnowledgeById(id) {
    documents = documents.filter(function(d) { return d.id !== id; });
    saveDocuments();
    renderKnowledgeList();
    renderSidebar();
  }
  function clearAllKnowledge() {
    if (!confirm(t('confirmClear'))) return;
    documents = [];
    saveDocuments();
    renderKnowledgeList();
    renderSidebar();
  }
  async function handleImportKnowledge(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.size > 200000) continue;
      var txt = await f.text();
      addDocument({ title: f.name.replace(/\.[^/.]+$/, ''), content: txt.slice(0, 8000), type: 'upload' });
    }
    e.target.value = '';
    renderKnowledgeList();
    renderSidebar();
  }

  async function openShareModal() {
    var chat = chats[currentChatId];
    if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) return alert('No hay mensajes para compartir.');
    var input = document.getElementById('share-link-input');
    var toast = document.getElementById('share-toast');
    if (input) input.value = 'Generando enlace…';
    if (toast) toast.style.display = 'none';
    openModal('modal-share');
    try {
      var modelEl = document.getElementById('model-select');
      var res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: chat.title || 'Conversación en Personal AI', messages: chat.messages, model: modelEl ? modelEl.value : 'openai/gpt-oss-120b' })
      });
      var d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Error');
      if (input) { input.value = d.shareUrl; input.select(); }
      await navigator.clipboard.writeText(d.shareUrl).catch(function() {});
      if (toast) toast.style.display = 'block';
    } catch(e) {
      if (input) input.value = 'Error al generar enlace';
    }
  }
  function copyShareLink() {
    var input = document.getElementById('share-link-input');
    if (input && input.value && !input.value.startsWith('Error')) {
      navigator.clipboard.writeText(input.value);
      var toast = document.getElementById('share-toast');
      if (toast) toast.style.display = 'block';
      var btn = document.getElementById('share-copy-btn');
      if (btn) { btn.textContent = 'Copiado'; setTimeout(function() { btn.textContent = 'Copiar'; }, 1800); }
    }
  }

  async function loadSharedIfNeeded() {
    var m = location.pathname.match(/^\/share\/([^/]+)/);
    if (!m) return;
    try {
      var res = await fetch('/api/share/' + encodeURIComponent(m[1]));
      var d = await res.json();
      if (d.ok && d.chat) {
        shareReadOnly = true;
        currentChatId = 'shared_' + m[1];
        chats[currentChatId] = { title: d.chat.title || 'Compartida', messages: d.chat.messages || [], readOnly: true };
        loadChatView();
        var inp = document.getElementById('prompt-input');
        if (inp) { inp.disabled = true; inp.placeholder = 'Conversación compartida (solo lectura)'; }
      }
    } catch(e) {}
  }

  function initApp() {
    try {
      setLengthMode(currentLength);
      fillLangSelect();
      renderModelPicker();
      initProviderUI();
      applyI18n();
      var syncBtn = document.getElementById('sync-now-btn');
      if (syncBtn) syncBtn.addEventListener('click', syncNow);
      fetch('/api/me', { credentials: 'same-origin' })
        .then(function(r) {
          if (r.status === 401) { location.href = '/login'; return null; }
          return r.json();
        })
        .then(function(d) {
          if (d && d.user) {
            currentUser = d.user;
            syncMeta.enabled = !!(d.config && d.config.sync);
            serverDefaultProvider = !!(d.config && d.config.defaultProvider);
            serverDefaultModel = (d.config && d.config.defaultModel) || '';
            if (!activeProvider() && serverDefaultModel) setModel(serverDefaultModel);
            var defaultHint = document.getElementById('server-default-hint');
            if (defaultHint) defaultHint.textContent = serverDefaultProvider ? ('已啟用伺服器預設 Groq（' + (serverDefaultModel || 'openai/gpt-oss-120b') + '）；仍可在下方新增自訂供應商。') : '目前未設定伺服器預設 Groq；請在下方新增 OpenAI 相容供應商。';
            updateUserUI();
            setArtifactDest(artifactDest, false);
            syncBootstrap();
          }
        }).catch(function() {});
      if (isWebSearch) {
        var wsb = document.getElementById('web-search-pill');
        if (wsb) wsb.classList.add('active');
      }
      loadSharedIfNeeded();
    } catch(initErr) { console.error('Init error:', initErr); }

    var newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);
    var tempChatBtn = document.getElementById('temp-chat-btn');
    if (tempChatBtn) tempChatBtn.addEventListener('click', startTempChat);
    var cmdOpenBtn = document.getElementById('cmd-open-btn');
    if (cmdOpenBtn) cmdOpenBtn.addEventListener('click', openCommandPalette);
    var cmdOverlay = document.getElementById('cmd-overlay');
    if (cmdOverlay) cmdOverlay.addEventListener('click', function(e) { if (e.target === cmdOverlay) closeCommandPalette(); });
    var cmdInput = document.getElementById('cmd-input');
    if (cmdInput) {
      cmdInput.addEventListener('input', function() { renderCommandPalette(this.value); });
      cmdInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
        if (e.key === 'Enter') {
          e.preventDefault();
          var first = document.querySelector('#cmd-list .cmd-item');
          if (first) first.click();
        }
      });
    }
    updateTempBadge();
    var historySearch = document.getElementById('history-search');
    if (historySearch) historySearch.addEventListener('input', function() { renderSidebar(this.value.trim()); });
    var sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', function() { toggleSidebar(true); });
    var sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', function() { toggleSidebar(false); });
    var sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', function() { toggleSidebar(false); });
    document.querySelectorAll('.sb-tab').forEach(function(t) {
      t.addEventListener('click', function() { setSidebarView(this.getAttribute('data-view')); });
    });
    document.addEventListener('click', function(e) {
      var n = e.target && e.target.closest ? e.target.closest('[data-open-settings]') : null;
      if (!n) return;
      e.preventDefault();
      var tab = n.getAttribute('data-open-settings') || 'pane-general';
      if (n.id === 'topbar-auth-btn' && !(currentUser && authToken)) {
        window.location.href = '/login';
        return;
      }
      openSettingsModal(tab);
    });
    var openProvidersBtn = document.getElementById('open-providers-btn');
    if (openProvidersBtn) openProvidersBtn.addEventListener('click', openProvidersModal);
    var openRewriteBtn = document.getElementById('open-rewrite-btn');
    if (openRewriteBtn) openRewriteBtn.addEventListener('click', function() { openModal('modal-rewrite'); });
    var quickProvidersPill = document.getElementById('quick-providers-pill');
    if (quickProvidersPill) quickProvidersPill.addEventListener('click', openProvidersModal);
    var openShareBtn = document.getElementById('open-share-btn');
    if (openShareBtn) openShareBtn.addEventListener('click', openShareModal);
    var sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.addEventListener('click', function() {
      if (isGenerating) abortGeneration();
      else handleSend();
    });
    var exportBtn = document.getElementById('export-chat-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportChat);
    var pickerBtn = document.getElementById('model-picker-btn');
    var picker = document.getElementById('model-picker');
    if (pickerBtn && picker) {
      pickerBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var open = picker.classList.toggle('open');
        pickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    var promptInput = document.getElementById('prompt-input');
    if (promptInput) {
      promptInput.addEventListener('keydown', function(e) {
        var enterSends = localStorage.getItem('ta_enter_send') !== '0';
        if (e.key === 'Enter' && !e.shiftKey) {
          if (enterSends && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleSend(); }
          else if (!enterSends && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
        }
      });
      promptInput.addEventListener('input', function() { autoResize(this); });
    }
    var webSearchPill = document.getElementById('web-search-pill');
    if (webSearchPill) webSearchPill.addEventListener('click', toggleWebSearch);
    var imageGenPill = document.getElementById('image-gen-pill');
    if (imageGenPill) imageGenPill.addEventListener('click', toggleImageMode);
    initDockMenu();
    var attachFileBtn = document.getElementById('attach-file-btn');
    var fileUploader = document.getElementById('file-uploader');
    if (attachFileBtn && fileUploader) {
      attachFileBtn.addEventListener('click', function() { fileUploader.click(); });
      fileUploader.addEventListener('change', handleFileUpload);
    }
    var removeFileBtn = document.getElementById('remove-file-btn');
    if (removeFileBtn) removeFileBtn.addEventListener('click', removeAttachedFile);
    var micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.addEventListener('click', toggleSpeech);
    var speakLastBtn = document.getElementById('speak-last-btn');
    if (speakLastBtn) speakLastBtn.addEventListener('click', speakLastReply);
    var ideaSend = document.getElementById('idea-send-btn');
    if (ideaSend) ideaSend.addEventListener('click', submitIdea);
    document.querySelectorAll('[data-idea-cat]').forEach(function(b) {
      b.addEventListener('click', function() {
        ideaCat = b.getAttribute('data-idea-cat') || 'feat';
        document.querySelectorAll('[data-idea-cat]').forEach(function(x) { x.classList.toggle('active', x === b); });
      });
    });
    var openIdeas = document.getElementById('open-ideas-btn');
    if (openIdeas) openIdeas.addEventListener('click', function() { openSettingsModal('pane-ideas'); });
    var adaptToggle = document.getElementById('set-adapt');
    if (adaptToggle) adaptToggle.addEventListener('change', function() {
      localStorage.setItem('ta_adapt', this.checked ? '1' : '0');
      postProfile({ enabled: this.checked });
    });
    var adaptAddBtn = document.getElementById('adapt-note-btn');
    if (adaptAddBtn) adaptAddBtn.addEventListener('click', function() {
      var inp = document.getElementById('adapt-note-input');
      var text = inp ? inp.value.trim() : '';
      if (text.length < 8) return;
      postProfile({ note: text }).then(function() { if (inp) inp.value = ''; });
    });
    var adaptForget = document.getElementById('adapt-forget-btn');
    if (adaptForget) adaptForget.addEventListener('click', function() {
      if (!confirm(t('adaptForget'))) return;
      postProfile({ forgetAll: true });
      saveLocalProfile(emptyLocalProfile());
      renderAdaptPane();
    });
    var adaptNotes = document.getElementById('adapt-notes');
    if (adaptNotes) adaptNotes.addEventListener('click', function(e) {
      var id = e.target && e.target.getAttribute('data-del-note');
      if (!id) return;
      postProfile({ deleteNoteId: id });
    });
    var autoReadLive = document.getElementById('set-auto-read');
    if (autoReadLive) autoReadLive.addEventListener('change', function() {
      localStorage.setItem('ta_auto_read', this.checked ? '1' : '0');
    });
    var capsule = document.querySelector('.capsule-box');
    if (capsule) {
      ;['dragenter', 'dragover'].forEach(function(ev) {
        capsule.addEventListener(ev, function(e) { e.preventDefault(); capsule.classList.add('drag-over'); });
      });
      ;['dragleave', 'drop'].forEach(function(ev) {
        capsule.addEventListener(ev, function(e) { e.preventDefault(); capsule.classList.remove('drag-over'); });
      });
      capsule.addEventListener('drop', function(e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) attachDroppedFile(f);
      });
      capsule.addEventListener('paste', function(e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') === 0) {
            var f = items[i].getAsFile();
            if (f) { e.preventDefault(); attachDroppedFile(f); }
            break;
          }
        }
      });
    }
    var saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    document.querySelectorAll('.settings-nav-btn[data-pane]').forEach(function(btn) {
      btn.addEventListener('click', function() { showSettingsPane(this.getAttribute('data-pane')); });
    });
    document.querySelectorAll('.choice-pill[data-pref], .theme-card[data-pref], .accent-dot[data-pref]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var pref = btn.getAttribute('data-pref');
        var val = btn.getAttribute('data-value');
        localStorage.setItem(pref, val);
        setChoice(pref, val);
        if (pref === 'ta_theme' || pref === 'ta_font' || pref === 'ta_accent') applyAppearance();
        if (pref === 'ta_len_mode') setLengthMode(val);
      });
    });
    var compactEl = document.getElementById('set-compact-sb');
    if (compactEl) compactEl.addEventListener('change', function() {
      localStorage.setItem('ta_compact_sb', this.checked ? '1' : '0');
      applyAppearance();
    });
    var motionEl = document.getElementById('set-reduce-motion');
    if (motionEl) motionEl.addEventListener('change', function() {
      localStorage.setItem('ta_reduce_motion', this.checked ? '1' : '0');
      applyAppearance();
    });
    function doLogout() {
      if (!confirm(t('logoutConfirm'))) return;
      logout();
    }
    var settingsLogout = document.getElementById('settings-logout-btn');
    if (settingsLogout) settingsLogout.addEventListener('click', doLogout);
    var navLogout = document.getElementById('nav-logout-btn');
    if (navLogout) navLogout.addEventListener('click', doLogout);
    var exportBtnAll = document.getElementById('btn-export-all');
    if (exportBtnAll) exportBtnAll.addEventListener('click', function() {
      var payload = { exportedAt: new Date().toISOString(), chats: chats, documents: documents, projects: projects };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'personal-ai-export.json';
      a.click();
      var st = document.getElementById('settings-status');
      if (st) { st.textContent = t('exportOk'); st.style.display = 'block'; }
    });
    var clearChatsBtn = document.getElementById('btn-clear-chats');
    if (clearChatsBtn) clearChatsBtn.addEventListener('click', function() {
      if (!confirm(t('clearChatsConfirm'))) return;
      chats = {};
      saveChats();
      startNewChat();
      var st = document.getElementById('settings-status');
      if (st) { st.textContent = t('clearChatsOk'); st.style.display = 'block'; }
    });
    var clearDocsBtn = document.getElementById('btn-clear-docs');
    if (clearDocsBtn) clearDocsBtn.addEventListener('click', clearAllKnowledge);
    var changePassBtn = document.getElementById('change-pass-btn');
    if (changePassBtn) changePassBtn.addEventListener('click', changePasswordFromSettings);
    var delAccBtn = document.getElementById('delete-account-btn');
    if (delAccBtn) delAccBtn.addEventListener('click', deleteAccountFromSettings);
    var testEmailBtn = document.getElementById('test-email-btn');
    if (testEmailBtn) testEmailBtn.addEventListener('click', async function() {
      if (!authToken) return;
      var st = document.getElementById('settings-status');
      try {
        if (testEmailBtn.getAttribute('data-ticket')) {
          var sent = await fetch('/api/mail/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify({ ticket: testEmailBtn.getAttribute('data-ticket') })
          });
          var sentData = await sent.json();
          if (!sent.ok) throw new Error(sentData.error || t('error'));
          testEmailBtn.removeAttribute('data-ticket');
          testEmailBtn.textContent = t('testEmail') || 'Enviar correo de prueba';
          if (st) { st.textContent = t('testEmailOk'); st.style.display = 'block'; }
          return;
        }
        var res = await fetch('/api/auth/test-email', { method: 'POST', headers: { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' }, body: '{}' });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        if (data.needsClick && data.ticket) {
          testEmailBtn.setAttribute('data-ticket', data.ticket);
          testEmailBtn.textContent = 'Haz clic para enviar el correo';
          if (st) { st.textContent = 'Confirma que eres una persona y pulsa otra vez.'; st.style.display = 'block'; }
          return;
        }
        if (st) { st.textContent = t('testEmailOk'); st.style.display = 'block'; }
      } catch (err) { alert(err.message); }
    });
    var saveKnowledgeBtn = document.getElementById('save-knowledge-btn');
    if (saveKnowledgeBtn) saveKnowledgeBtn.addEventListener('click', saveKnowledge);
    var clearRagBtn = document.getElementById('clear-rag-btn');
    if (clearRagBtn) clearRagBtn.addEventListener('click', clearAllKnowledge);
    var importRagFile = document.getElementById('import-rag-file');
    if (importRagFile) importRagFile.addEventListener('change', handleImportKnowledge);
    var importDocsBtn = document.getElementById('import-docs-btn');
    if (importDocsBtn && importRagFile) importDocsBtn.addEventListener('click', function() { importRagFile.click(); });
    var addCustomConnBtn = document.getElementById('add-custom-conn-btn');
    if (addCustomConnBtn) addCustomConnBtn.addEventListener('click', addCustomConnector);
    var shareCopyBtn = document.getElementById('share-copy-btn');
    if (shareCopyBtn) shareCopyBtn.addEventListener('click', copyShareLink);
    document.getElementById('art-close-btn').addEventListener('click', closeArtifact);
    document.getElementById('art-copy-btn').addEventListener('click', function() {
      readArtifactDraft();
      if (!currentArtifact) return;
      var cb = this;
      var done = function() { cb.textContent = artT('copied'); setTimeout(function() { cb.textContent = artT('copy'); }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(currentArtifact.content || '').then(done, function() {});
    });
    document.querySelectorAll('.art-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { setArtView(btn.getAttribute('data-view')); });
    });
    document.getElementById('art-download-btn').addEventListener('click', downloadArtifact);
    document.getElementById('art-fs-btn').addEventListener('click', function() {
      var panel = document.getElementById('art-panel');
      setArtFullscreen(!(panel && panel.classList.contains('fs')));
    });
    document.getElementById('art-version').addEventListener('change', function() {
      if (!currentArtifact || !currentArtifact.versions) return;
      var v = currentArtifact.versions[Number(this.value)];
      if (!v) return;
      var ed = document.getElementById('art-editor');
      if (ed) ed.value = v.content;
      currentArtifact.content = v.content;
      refreshArtifactPreview();
    });
    document.getElementById('art-save-btn').addEventListener('click', function() {
      readArtifactDraft();
      if (!currentArtifact) return;
      artPushVersion(currentArtifact, currentArtifact.content || '');
      renderArtVersions();
      addDocument({ title: currentArtifact.title, content: currentArtifact.content, type: 'artifact', lang: currentArtifact.lang });
      renderSidebar();
    });
    fillArtFormatSelect();
    document.querySelectorAll('.art-dest-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { setArtifactDest(btn.getAttribute('data-dest'), true); });
    });
    var artFormat = document.getElementById('art-format');
    if (artFormat) {
      artFormat.addEventListener('change', function() {
        readArtifactDraft();
        refreshArtifactPreview();
      });
    }
    var artTitle = document.getElementById('art-title');
    if (artTitle) {
      artTitle.addEventListener('input', function() {
        if (artTitle.value.length > 72) artTitle.value = artTitle.value.slice(0, 72);
        updateTitleCount();
        readArtifactDraft();
      });
    }
    var extrasToggle = document.getElementById('art-extras-toggle');
    var extrasBody = document.getElementById('art-extras-body');
    if (extrasToggle && extrasBody) {
      extrasToggle.addEventListener('click', function() {
        extrasBody.hidden = !extrasBody.hidden;
      });
    }
    ['art-sources', 'art-resources', 'art-widgets'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function() { readArtifactDraft(); });
    });
    var artEditor = document.getElementById('art-editor');
    if (artEditor) {
      artEditor.addEventListener('input', scheduleArtifactPreview);
    }
    var artPublishBtn = document.getElementById('art-publish-btn');
    if (artPublishBtn) artPublishBtn.addEventListener('click', publishArtifact);
    var artUnpublishBtn = document.getElementById('art-unpublish-btn');
    if (artUnpublishBtn) artUnpublishBtn.addEventListener('click', unpublishArtifact);
    var artOpenBtn = document.getElementById('art-open-btn');
    if (artOpenBtn) artOpenBtn.addEventListener('click', function() {
      if (currentArtifact && currentArtifact.url) window.open(currentArtifact.url, '_blank', 'noopener');
    });
    syncArtifactActions();
    document.querySelectorAll('.length-opt-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { var mode = this.getAttribute('data-len'); if (mode) setLengthMode(mode); });
    });
    document.addEventListener('click', function(e) {
      var modelOpt = e.target.closest('.model-option');
      if (modelOpt) { setModel(modelOpt.getAttribute('data-model')); return; }
      var pickerEl = document.getElementById('model-picker');
      if (pickerEl && !pickerEl.contains(e.target)) pickerEl.classList.remove('open');
      if (e.target && e.target.id === 'clear-project-filter') { switchProject(null); return; }
      if (e.target && e.target.id === 'toggle-archived') { showArchived = !showArchived; renderSidebar(); return; }
      var closeBtn = e.target.closest('[data-modal]');
      if (closeBtn && closeBtn.tagName === 'BUTTON') { var mId = closeBtn.getAttribute('data-modal'); if (mId) closeModal(mId); return; }
      if (e.target && e.target.id === 'logout-btn') { logout(); return; }
      var chipBtn = e.target.closest('.hero-chip');
      if (chipBtn) { var p = chipBtn.getAttribute('data-prompt'); if (p) sendQuick(p); return; }
      var imgEl = e.target.closest('.ai-image-img');
      if (imgEl) { var u = imgEl.getAttribute('data-img-url'); if (u) window.open(u, '_blank'); return; }
      var codeCopy = e.target.closest('.code-copy-btn');
      if (codeCopy) {
        navigator.clipboard.writeText(decodeURIComponent(codeCopy.getAttribute('data-code') || '')).then(function() {
          codeCopy.textContent = 'Copiado';
          setTimeout(function() { codeCopy.textContent = 'Copiar'; }, 1800);
        }).catch(function() {});
        return;
      }
      var delRag = e.target.closest('.del-rag-item-btn');
      if (delRag) { var id = delRag.getAttribute('data-del-doc'); if (id) deleteKnowledgeById(id); return; }
      var delConn = e.target.closest('.del-conn-btn');
      if (delConn) { var cIdx = parseInt(delConn.getAttribute('data-del-conn-idx'), 10); if (!isNaN(cIdx)) deleteConnector(cIdx); return; }
    });
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); openSettingsModal('pane-general'); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); openCommandPalette(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); startTempChat(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); startNewChat(); }
      if (e.key === 'Escape') {
        var openM = document.querySelectorAll('.modal-backdrop.active');
        if (openM.length) { openM[openM.length - 1].classList.remove('active'); return; }
        closeCommandPalette();
        var artP = document.getElementById('art-panel');
        if (artP && artP.classList.contains('fs')) { setArtFullscreen(false); return; }
        closeArtifact();
        var p = document.getElementById('model-picker');
        if (p) p.classList.remove('open');
        if (isGenerating) abortGeneration();
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        var pi = document.getElementById('prompt-input');
        if (pi) pi.focus();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
  else initApp();
})();
