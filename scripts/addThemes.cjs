const fs = require('fs');

let css = fs.readFileSync('public/assets/app.css', 'utf8');

// Update color-scheme
if (!css.includes('html[data-theme="rose"]')) {
  css = css.replace(
    /html\[data-theme="light"\], html\[data-theme="paper"\] \{ color-scheme: light; \}/,
    'html[data-theme="light"], html[data-theme="paper"], html[data-theme="rose"], html[data-theme="lavender"] { color-scheme: light; }'
  );
}

// Add 7 themes before data-font if not present
if (!css.includes('html[data-theme="hacker"]')) {
  const newThemes = `
    html[data-theme="hacker"] { --bg: #000000; --sidebar: #040c04; --elev: #081a08; --elev-2: #0f2b0f; --card: #061406; --input: #020602; --invert: #22c55e; --invert-fg: #000000; --line: rgba(34,197,94,0.2); --line-2: rgba(34,197,94,0.35); --text: #4ade80; --muted: #22c55e; --dim: #15803d; }
    html[data-theme="cyberpunk"] { --bg: #0d021a; --sidebar: #07010e; --elev: #1a0533; --elev-2: #27084d; --card: #130324; --input: #07010e; --invert: #fcee0a; --invert-fg: #0d021a; --line: rgba(255,0,127,0.25); --line-2: rgba(255,0,127,0.4); --text: #00ffff; --muted: #ff007f; --dim: #a200ff; }
    html[data-theme="sunset"] { --bg: #1f101d; --sidebar: #140a13; --elev: #30192d; --elev-2: #43223e; --card: #251323; --input: #140a13; --invert: #fb923c; --invert-fg: #1f101d; --line: rgba(251,146,60,0.18); --line-2: rgba(251,146,60,0.3); --text: #ffedd5; --muted: #fdba74; --dim: #ea580c; }
    html[data-theme="ocean"] { --bg: #061325; --sidebar: #030b17; --elev: #0c2340; --elev-2: #11325b; --card: #081a32; --input: #030b17; --invert: #38bdf8; --invert-fg: #061325; --line: rgba(56,189,248,0.15); --line-2: rgba(56,189,248,0.25); --text: #f0f9ff; --muted: #7dd3fc; --dim: #0284c7; }
    html[data-theme="forest"] { --bg: #07130e; --sidebar: #040c08; --elev: #0e241b; --elev-2: #163628; --card: #0a1913; --input: #040c08; --invert: #22c55e; --invert-fg: #07130e; --line: rgba(34,197,94,0.15); --line-2: rgba(34,197,94,0.25); --text: #ecfdf5; --muted: #6ee7b7; --dim: #10b981; }
    html[data-theme="rose"] { --bg: #fff1f2; --sidebar: #ffe4e6; --elev: #ffffff; --elev-2: #fecdd3; --card: #ffffff; --input: #ffe4e6; --invert: #e11d48; --invert-fg: #ffffff; --line: rgba(225,29,72,0.12); --line-2: rgba(225,29,72,0.22); --text: #4c0519; --muted: #9f1239; --dim: #be123c; --blue: #0284c7; --green: #15803d; --red: #e11d48; --purple: #9333ea; }
    html[data-theme="lavender"] { --bg: #f8f6fc; --sidebar: #f3e8ff; --elev: #ffffff; --elev-2: #e9d5ff; --card: #ffffff; --input: #f3e8ff; --invert: #7e22ce; --invert-fg: #ffffff; --line: rgba(126,34,206,0.12); --line-2: rgba(126,34,206,0.22); --text: #3b0764; --muted: #7e22ce; --dim: #a855f7; --blue: #0284c7; --green: #15803d; --red: #dc2626; --purple: #7e22ce; }
`;
  css = css.replace(/    html\[data-font="sm"\]/, newThemes + '    html[data-font="sm"]');
}

// Add swatches if not present
if (!css.includes('.theme-swatch[data-swatch="hacker"]')) {
  const newSwatches = `
    .theme-swatch[data-swatch="hacker"] { --sw-bg: #000000; --sw-side: #081a08; }
    .theme-swatch[data-swatch="cyberpunk"] { --sw-bg: #0d021a; --sw-side: #ff007f; }
    .theme-swatch[data-swatch="sunset"] { --sw-bg: #1f101d; --sw-side: #ea580c; }
    .theme-swatch[data-swatch="ocean"] { --sw-bg: #061325; --sw-side: #0284c7; }
    .theme-swatch[data-swatch="forest"] { --sw-bg: #07130e; --sw-side: #10b981; }
    .theme-swatch[data-swatch="rose"] { --sw-bg: #fff1f2; --sw-side: #fecdd3; }
    .theme-swatch[data-swatch="lavender"] { --sw-bg: #f8f6fc; --sw-side: #e9d5ff; }
`;
  css = css.replace(/    \.accent-row/, newSwatches + '    .accent-row');
}

fs.writeFileSync('public/assets/app.css', css);

let appJs = fs.readFileSync('public/assets/app.js', 'utf8');

// Add the 7 themes to THEME_COLORS if not present
if (!appJs.includes("hacker: '#000000'")) {
  appJs = appJs.replace(
    "paper: '#f4efe6' };",
    "paper: '#f4efe6', hacker: '#000000', cyberpunk: '#0d021a', sunset: '#1f101d', ocean: '#061325', forest: '#07130e', rose: '#fff1f2', lavender: '#f8f6fc' };"
  );
}

// Add the 7 buttons to the DOM without data-i18n prefix if not present
if (!appJs.includes('data-value=\\"hacker\\"')) {
  const endMarker = '<button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"system\\">';
  const newButtons = `              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"hacker\\"><span class=\\"theme-swatch\\" data-swatch=\\"hacker\\"></span><span>Hacker</span></button>\\n              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"cyberpunk\\"><span class=\\"theme-swatch\\" data-swatch=\\"cyberpunk\\"></span><span>Cyberpunk</span></button>\\n              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"sunset\\"><span class=\\"theme-swatch\\" data-swatch=\\"sunset\\"></span><span>Sunset</span></button>\\n              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"ocean\\"><span class=\\"theme-swatch\\" data-swatch=\\"ocean\\"></span><span>Ocean</span></button>\\n              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"forest\\"><span class=\\"theme-swatch\\" data-swatch=\\"forest\\"></span><span>Forest</span></button>\\n              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"rose\\"><span class=\\"theme-swatch\\" data-swatch=\\"rose\\"></span><span>Rose</span></button>\\n              <button type=\\"button\\" class=\\"theme-card\\" data-pref=\\"ta_theme\\" data-value=\\"lavender\\"><span class=\\"theme-swatch\\" data-swatch=\\"lavender\\"></span><span>Lavender</span></button>\\n              `;
  appJs = appJs.replace(endMarker, newButtons + endMarker);
}

fs.writeFileSync('public/assets/app.js', appJs);
console.log('Themes added!');
