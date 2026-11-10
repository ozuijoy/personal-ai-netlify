(function () {
  var LANGS = [{"id":"es","native":"Español","rtl":false,"top":true},{"id":"en","native":"English","rtl":false,"top":true},{"id":"zh","native":"中文（简体）","rtl":false,"top":true},{"id":"zh-TW","native":"中文（繁體）","rtl":false,"top":false},{"id":"hi","native":"हिन्दी","rtl":false,"top":true},{"id":"ar","native":"العربية","rtl":true,"top":true},{"id":"bn","native":"বাংলা","rtl":false,"top":true},{"id":"pt","native":"Português","rtl":false,"top":true},{"id":"ru","native":"Русский","rtl":false,"top":true},{"id":"ur","native":"اردو","rtl":true,"top":true},{"id":"id","native":"Bahasa Indonesia","rtl":false,"top":false},{"id":"de","native":"Deutsch","rtl":false,"top":false},{"id":"ja","native":"日本語","rtl":false,"top":false},{"id":"mr","native":"मराठी","rtl":false,"top":false},{"id":"vi","native":"Tiếng Việt","rtl":false,"top":false},{"id":"te","native":"తెలుగు","rtl":false,"top":false},{"id":"tr","native":"Türkçe","rtl":false,"top":false},{"id":"ta","native":"தமிழ்","rtl":false,"top":false},{"id":"ko","native":"한국어","rtl":false,"top":false},{"id":"fa","native":"فارسی","rtl":true,"top":false},{"id":"fil","native":"Filipino","rtl":false,"top":false},{"id":"it","native":"Italiano","rtl":false,"top":false},{"id":"th","native":"ไทย","rtl":false,"top":false},{"id":"pl","native":"Polski","rtl":false,"top":false},{"id":"uk","native":"Українська","rtl":false,"top":false},{"id":"ms","native":"Bahasa Melayu","rtl":false,"top":false},{"id":"nl","native":"Nederlands","rtl":false,"top":false},{"id":"ro","native":"Română","rtl":false,"top":false},{"id":"el","native":"Ελληνικά","rtl":false,"top":false},{"id":"hu","native":"Magyar","rtl":false,"top":false},{"id":"cs","native":"Čeština","rtl":false,"top":false},{"id":"sv","native":"Svenska","rtl":false,"top":false},{"id":"bg","native":"Български","rtl":false,"top":false},{"id":"da","native":"Dansk","rtl":false,"top":false},{"id":"fi","native":"Suomi","rtl":false,"top":false},{"id":"nb","native":"Norsk","rtl":false,"top":false},{"id":"hr","native":"Hrvatski","rtl":false,"top":false},{"id":"he","native":"עברית","rtl":true,"top":false},{"id":"fr","native":"Français","rtl":false,"top":true},{"id":"ca","native":"Català","rtl":false,"top":false}];
  var TOP = ["en","zh","hi","es","ar","fr","bn","pt","ru","ur"];
  var PACK = window.TA_PACK || {};
  var IDS = LANGS.map(function (l) { return l.id; });
  var BY = {};
  LANGS.forEach(function (l) { BY[l.id] = l; });

  function normalize(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (BY[s]) return s;
    var lower = s.toLowerCase().replace('_', '-');
    if (BY[lower]) return lower;
    if (lower.indexOf('zh-hant') === 0 || lower.indexOf('zh-tw') === 0 || lower.indexOf('zh-hk') === 0) return 'zh-TW';
    if (lower.indexOf('zh') === 0) return 'zh';
    if (lower === 'tl' || lower.indexOf('fil') === 0) return 'fil';
    if (lower === 'no' || lower === 'nn' || lower.indexOf('nb') === 0) return 'nb';
    if (lower === 'iw' || lower.indexOf('he') === 0) return 'he';
    if (lower === 'in' || lower.indexOf('id') === 0) return 'id';
    if (lower.indexOf('pt') === 0) return 'pt';
    if (lower.indexOf('en') === 0) return 'en';
    if (lower.indexOf('es') === 0) return 'es';
    if (lower.indexOf('fr') === 0) return 'fr';
    if (lower.indexOf('de') === 0) return 'de';
    if (lower.indexOf('it') === 0) return 'it';
    if (lower.indexOf('ar') === 0) return 'ar';
    if (lower.indexOf('fa') === 0) return 'fa';
    if (lower.indexOf('ur') === 0) return 'ur';
    if (lower.indexOf('ms') === 0) return 'ms';
    var two = lower.slice(0, 2);
    return BY[two] ? two : '';
  }

  function allNav() {
    var list = [];
    try {
      if (navigator.languages && navigator.languages.length) list = navigator.languages;
      else if (navigator.language) list = [navigator.language];
      else if (navigator.userLanguage) list = [navigator.userLanguage];
    } catch (e) {}
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var n = normalize(list[i]);
      if (n && out.indexOf(n) < 0) out.push(n);
    }
    return out;
  }

  function geoLang() {
    try {
      var g = window.TA_GEO || {};
      return normalize(g.lang || '');
    } catch (e) { return ''; }
  }

  function preferRegional(regional, navs) {
    if (!regional) return false;
    if (navs.indexOf(regional) >= 0) return true;
    if (regional === 'ca' && (navs.indexOf('es') >= 0 || !navs.length)) return true;
    if (regional === 'zh-TW') {
      for (var i = 0; i < navs.length; i++) if (navs[i] === 'zh' || navs[i] === 'zh-TW') return true;
    }
    return false;
  }

  function detect() {
    try {
      var stored = localStorage.getItem('ta_lang');
      if (stored) {
        var fromStore = normalize(stored);
        if (fromStore) return fromStore;
      }
    } catch (e) {}
    var navs = allNav();
    var geo = geoLang();
    if (preferRegional(geo, navs)) return geo;
    if (navs[0]) return navs[0];
    var htmlLang = document.documentElement.getAttribute('lang') || '';
    var fromHtml = normalize(htmlLang);
    if (fromHtml) return fromHtml;
    return 'es';
  }

  function nameOf(id) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].id === id) return LANGS[i].native;
    return id;
  }
  function topIds(cur) {
    var out = TOP.slice();
    function pin(id) {
      id = normalize(id);
      if (!id || out.indexOf(id) >= 0) return;
      out.unshift(id);
    }
    pin(cur);
    pin(geoLang());
    return out;
  }
  function restIds(cur) {
    var top = topIds(cur);
    return IDS.filter(function (id) { return top.indexOf(id) < 0; });
  }

  function mountPicker(el) {
    if (!el || !el.getAttribute) return;
    if (!el._taPicker) {
      el.classList.add('lang-picker');
      el.innerHTML = '<button type="button" class="lang-picker-btn" aria-haspopup="listbox" aria-expanded="false"></button><div class="lang-menu" role="listbox"></div>';
      var btn = el.querySelector('.lang-picker-btn');
      var menu = el.querySelector('.lang-menu');
      var expanded = false;
      function close() {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
      function optionHtml(id) {
        var cur = IDS[idx];
        return '<button type="button" class="lang-opt' + (id === cur ? ' active' : '') + '" data-lang="' + id + '" role="option">' +
          '<span class="lang-opt-name">' + nameOf(id) + '</span></button>';
      }
      function paint() {
        var cur = IDS[idx];
        btn.innerHTML = '<span class="lang-opt-name">' + nameOf(cur) + '</span>';
        var html = topIds(cur).map(optionHtml).join('');
        if (expanded) {
          html += '<div class="lang-sep"></div>' + restIds(cur).map(optionHtml).join('');
          html += '<button type="button" class="lang-more" data-more="less">' + t('showLess') + '</button>';
        } else {
          html += '<button type="button" class="lang-more" data-more="more">' + t('showMore') + '</button>';
        }
        menu.innerHTML = html;
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = !menu.classList.contains('open');
        document.querySelectorAll('.lang-menu.open').forEach(function (m) { if (m !== menu) m.classList.remove('open'); });
        menu.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) paint();
      });
      menu.addEventListener('click', function (e) {
        e.stopPropagation();
        var more = e.target.closest('[data-more]');
        if (more) {
          expanded = more.getAttribute('data-more') === 'more';
          paint();
          return;
        }
        var opt = e.target.closest('[data-lang]');
        if (!opt) return;
        setLang(opt.getAttribute('data-lang'));
        expanded = false;
        close();
        paint();
      });
      document.addEventListener('click', function (e) {
        if (!el.contains(e.target)) close();
      });
      el._taPicker = { paint: paint, close: close };
    }
    el._taPicker.paint();
  }

  var idx = 0;
  function t(k) {
    if (PACK[k] != null && PACK[k] !== '') return PACK[k];
    return k;
  }

  function setLang(code) {
    var n = normalize(code) || code;
    var i = IDS.indexOf(n);
    if (i < 0 || n === IDS[idx]) return;
    try { localStorage.setItem('ta_lang', n); } catch (e) {}
    document.cookie = 'ta_lang=' + n + ';path=/;max-age=31536000;SameSite=Lax';
    
    var path = window.location.pathname;
    var parts = path.split('/');
    if (parts[1]) {
      var currentPrefix = normalize(parts[1]);
      if (currentPrefix && IDS.indexOf(currentPrefix) >= 0) {
        parts[1] = n;
        window.location.href = parts.join('/') + window.location.search + window.location.hash;
        return;
      }
    }
    window.location.reload();
  }

  var lang = detect();
  idx = IDS.indexOf(lang);
  if (idx < 0) { lang = 'es'; idx = 0; }
  document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : lang;
  document.documentElement.dir = LANGS[idx].rtl ? 'rtl' : 'ltr';

  window.TA = {
    CODES: IDS,
    NAMES: LANGS.map(function (l) { return l.native; }),
    LANGS: LANGS,
    TOP: ["en","zh","hi","es","ar","fr","bn","pt","ru","ur"],
    lang: function () { return IDS[idx]; },
    t: t,
    setLang: setLang,
    mountPicker: mountPicker,
    PACK: PACK
  };
})();
