/* Personal AI — prompt tools (starters, roles, variables, favourites, recents).
   Client-side only; data lives in localStorage. The visual builder is lazy-loaded
   from /assets/prompt-builder.js the first time it is opened. */
(function () {
  'use strict';
  var LS = {
    role: 'ta_prompt_role', roleCustom: 'ta_prompt_role_custom', favs: 'ta_prompt_favs',
    recent: 'ta_prompt_recent', cat: 'ta_prompt_cat'
  };
  var VAR_RE = /\[[A-ZÁÉÍÓÚÑÜÇÀÈÒÏ][A-ZÁÉÍÓÚÑÜÇÀÈÒÏ0-9 _.\/º-]{1,40}\]/g;

  function lang() {
    var l = 'es';
    try { l = (window.TA && TA.lang) ? TA.lang() : (document.documentElement.lang || 'es'); } catch (e) {}
    l = String(l || 'es').toLowerCase().split('-')[0];
    return (l === 'es' || l === 'en' || l === 'ca') ? l : 'en';
  }
  function rawLang() {
    try { return String((window.TA && TA.lang) ? TA.lang() : document.documentElement.lang || 'es').toLowerCase(); } catch (e) { return 'es'; }
  }

  /* ---------- strings ---------- */
  var S = {
    es: {
      role: 'Rol', roleTitle: 'Rol del asistente', noRole: 'Sin rol', customRole: 'Rol personalizado…',
      customRoleTitle: 'Rol personalizado', customRoleLabel: 'Describe el rol (se envía como contexto del sistema)',
      customRolePh: 'Ej.: Actúa como abogado laboralista en España. Cita la normativa aplicable.',
      roleActive: 'Rol activo', builder: 'Constructor', builderTitle: 'Constructor de prompts',
      saveFav: 'Guardar como favorito', favName: 'Nombre', favText: 'Prompt', favNamePh: 'Ej.: Revisión de código',
      save: 'Guardar', cancel: 'Cancelar', close: 'Cerrar', del: 'Eliminar', edit: 'Editar', use: 'Usar',
      favs: 'Favoritos', recents: 'Recientes', clearRecents: 'Borrar recientes', addFav: 'Nuevo favorito',
      noFavs: 'Aún no hay favoritos. Guarda un prompt con la estrella del cuadro de texto.',
      noRecents: 'Los últimos 5 prompts enviados aparecerán aquí.', editFav: 'Editar favorito',
      confirmDel: '¿Eliminar este favorito?', reuse: 'Reutilizar y editar', starIt: 'Guardar en favoritos',
      vars: 'Variables', varsLeft: function (n) { return n === 1 ? 'Queda 1 variable por rellenar' : 'Quedan ' + n + ' variables por rellenar'; },
      varsHint: 'Tab: siguiente · Mayús+Tab: anterior',
      varsWarn: function (list) { return 'Aún hay variables sin rellenar: ' + list + '. Rellénalas o pulsa Enviar otra vez para enviar igualmente.'; },
      emptyFav: 'Escribe un prompt antes de guardarlo.', saved: 'Guardado en favoritos',
      cats: 'Categorías de prompts', starters: 'Ideas para empezar', fill: 'Rellenar',
      rewriteName: 'Rewrite', rewriteDesc: 'Reescribe, corrige y traduce textos',
      prompts: 'Prompts'
    },
    en: {
      role: 'Role', roleTitle: 'Assistant role', noRole: 'No role', customRole: 'Custom role…',
      customRoleTitle: 'Custom role', customRoleLabel: 'Describe the role (sent as system context)',
      customRolePh: 'E.g. Act as an employment lawyer in Spain. Cite the applicable regulations.',
      roleActive: 'Active role', builder: 'Builder', builderTitle: 'Prompt builder',
      saveFav: 'Save as favourite', favName: 'Name', favText: 'Prompt', favNamePh: 'E.g. Code review',
      save: 'Save', cancel: 'Cancel', close: 'Close', del: 'Delete', edit: 'Edit', use: 'Use',
      favs: 'Favourites', recents: 'Recent', clearRecents: 'Clear recent', addFav: 'New favourite',
      noFavs: 'No favourites yet. Save a prompt with the star in the message box.',
      noRecents: 'Your last 5 sent prompts will appear here.', editFav: 'Edit favourite',
      confirmDel: 'Delete this favourite?', reuse: 'Reuse and edit', starIt: 'Save to favourites',
      vars: 'Variables', varsLeft: function (n) { return n === 1 ? '1 variable left to fill' : n + ' variables left to fill'; },
      varsHint: 'Tab: next · Shift+Tab: previous',
      varsWarn: function (list) { return 'Some variables are still unfilled: ' + list + '. Fill them in or press Send again to send anyway.'; },
      emptyFav: 'Write a prompt before saving it.', saved: 'Saved to favourites',
      cats: 'Prompt categories', starters: 'Starters', fill: 'Fill',
      rewriteName: 'Rewrite', rewriteDesc: 'Rewrite, proofread and translate text',
      prompts: 'Prompts'
    },
    ca: {
      role: 'Rol', roleTitle: "Rol de l'assistent", noRole: 'Sense rol', customRole: 'Rol personalitzat…',
      customRoleTitle: 'Rol personalitzat', customRoleLabel: 'Descriu el rol (s’envia com a context del sistema)',
      customRolePh: 'Ex.: Actua com a advocat laboralista a Espanya. Cita la normativa aplicable.',
      roleActive: 'Rol actiu', builder: 'Constructor', builderTitle: 'Constructor de prompts',
      saveFav: 'Desa com a preferit', favName: 'Nom', favText: 'Prompt', favNamePh: 'Ex.: Revisió de codi',
      save: 'Desa', cancel: 'Cancel·la', close: 'Tanca', del: 'Elimina', edit: 'Edita', use: 'Usa',
      favs: 'Preferits', recents: 'Recents', clearRecents: 'Esborra els recents', addFav: 'Nou preferit',
      noFavs: 'Encara no hi ha preferits. Desa un prompt amb l’estrella del quadre de text.',
      noRecents: 'Els últims 5 prompts enviats apareixeran aquí.', editFav: 'Edita el preferit',
      confirmDel: 'Vols eliminar aquest preferit?', reuse: 'Reutilitza i edita', starIt: 'Desa als preferits',
      vars: 'Variables', varsLeft: function (n) { return n === 1 ? 'Queda 1 variable per omplir' : 'Queden ' + n + ' variables per omplir'; },
      varsHint: 'Tab: següent · Maj+Tab: anterior',
      varsWarn: function (list) { return 'Encara hi ha variables per omplir: ' + list + '. Omple-les o prem Envia un altre cop per enviar igualment.'; },
      emptyFav: 'Escriu un prompt abans de desar-lo.', saved: 'Desat als preferits',
      cats: 'Categories de prompts', starters: 'Idees per començar', fill: 'Omple',
      rewriteName: 'Rewrite', rewriteDesc: 'Reescriu, corregeix i tradueix textos',
      prompts: 'Prompts'
    }
  };
  var REWRITE_DESC = {
    fr: 'Réécrit, corrige et traduit vos textes', de: 'Texte umschreiben, korrigieren und übersetzen',
    it: 'Riscrive, corregge e traduce testi', pt: 'Reescreve, corrige e traduz textos'
  };
  function s(k) { var p = S[lang()]; return p[k] != null ? p[k] : S.en[k]; }

  /* ---------- roles ---------- */
  var ROLES = {
    es: [
      { id: 'none', name: 'Sin rol' },
      { id: 'dev', name: 'Programador senior', preset: 'developer', ctx: 'Actúa como un programador senior con 15 años de experiencia. Prioriza código correcto, seguro y mantenible; explica las decisiones técnicas y señala casos límite.' },
      { id: 'fin', name: 'Analista financiero', preset: 'finops', ctx: 'Actúa como un analista financiero. Usa cifras y supuestos explícitos, tablas cuando ayuden, distingue datos de estimaciones y señala los riesgos.' },
      { id: 'writer', name: 'Redactor/a', preset: 'general', ctx: 'Actúa como redactor/a profesional. Cuida la claridad, el ritmo y el tono, y adapta el texto al público objetivo.' },
      { id: 'teacher', name: 'Profesor/a', preset: 'general', ctx: 'Actúa como profesor/a paciente. Explica de lo simple a lo complejo, con ejemplos y preguntas para comprobar la comprensión.' },
      { id: 'cv', name: 'Revisor de CV', preset: 'general', ctx: 'Actúa como revisor de CV y reclutador técnico. Evalúa impacto, logros medibles, palabras clave para ATS y claridad, y da mejoras concretas.' },
      { id: 'sec', name: 'Sysadmin / ciberseguridad', preset: 'security', ctx: 'Actúa como sysadmin senior y experto en ciberseguridad. Prioriza la seguridad y el mínimo privilegio, da comandos verificables e incluye un plan de vuelta atrás.' },
      { id: 'custom', name: 'Personalizado' }
    ],
    en: [
      { id: 'none', name: 'No role' },
      { id: 'dev', name: 'Senior developer', preset: 'developer', ctx: 'Act as a senior software engineer with 15 years of experience. Prioritise correct, secure and maintainable code; explain technical decisions and point out edge cases.' },
      { id: 'fin', name: 'Financial analyst', preset: 'finops', ctx: 'Act as a financial analyst. Use figures and explicit assumptions, tables where helpful, separate data from estimates and flag the risks.' },
      { id: 'writer', name: 'Copywriter', preset: 'general', ctx: 'Act as a professional writer. Focus on clarity, rhythm and tone, and adapt the text to the target audience.' },
      { id: 'teacher', name: 'Teacher', preset: 'general', ctx: 'Act as a patient teacher. Go from simple to complex, with examples and questions that check understanding.' },
      { id: 'cv', name: 'CV reviewer', preset: 'general', ctx: 'Act as a CV reviewer and technical recruiter. Assess impact, measurable achievements, ATS keywords and clarity, and give concrete improvements.' },
      { id: 'sec', name: 'Sysadmin / security', preset: 'security', ctx: 'Act as a senior sysadmin and cybersecurity expert. Prioritise security and least privilege, give verifiable commands and include a rollback plan.' },
      { id: 'custom', name: 'Custom' }
    ],
    ca: [
      { id: 'none', name: 'Sense rol' },
      { id: 'dev', name: 'Programador sènior', preset: 'developer', ctx: 'Actua com un programador sènior amb 15 anys d’experiència. Prioritza codi correcte, segur i mantenible; explica les decisions tècniques i assenyala els casos límit.' },
      { id: 'fin', name: 'Analista financer', preset: 'finops', ctx: 'Actua com un analista financer. Fes servir xifres i supòsits explícits, taules quan ajudin, distingeix dades d’estimacions i assenyala els riscos.' },
      { id: 'writer', name: 'Redactor/a', preset: 'general', ctx: 'Actua com a redactor/a professional. Cuida la claredat, el ritme i el to, i adapta el text al públic objectiu.' },
      { id: 'teacher', name: 'Professor/a', preset: 'general', ctx: 'Actua com a professor/a pacient. Explica del més simple al més complex, amb exemples i preguntes per comprovar la comprensió.' },
      { id: 'cv', name: 'Revisor de CV', preset: 'general', ctx: 'Actua com a revisor de CV i reclutador tècnic. Avalua l’impacte, els èxits mesurables, les paraules clau per a ATS i la claredat, i dona millores concretes.' },
      { id: 'sec', name: 'Sysadmin / ciberseguretat', preset: 'security', ctx: 'Actua com a sysadmin sènior i expert en ciberseguretat. Prioritza la seguretat i el mínim privilegi, dona ordres verificables i inclou un pla de marxa enrere.' },
      { id: 'custom', name: 'Personalitzat' }
    ]
  };
  function roles() { return ROLES[lang()]; }
  function roleById(id) { var r = roles(); for (var i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return r[0]; }

  /* ---------- starters ---------- */
  var STARTERS = {
    es: [
      { id: 'code', name: 'Código', items: [
        ['Revisión de código', 'Revisa este código en [LENGUAJE] buscando bugs, problemas de seguridad y de rendimiento. Devuelve una lista priorizada y el código corregido:\n\n[CÓDIGO]'],
        ['Tests unitarios', 'Escribe tests unitarios con [FRAMEWORK] para esta función, cubriendo casos límite y errores:\n\n[CÓDIGO]'],
        ['Explicar y refactorizar', 'Explica paso a paso qué hace este código y propón una refactorización más legible, sin cambiar su comportamiento:\n\n[CÓDIGO]'],
        ['Diseñar arquitectura', 'Diseña la arquitectura de [PRODUCTO] para [Nº USUARIOS] usuarios: componentes, base de datos, colas, despliegue y coste mensual estimado.']
      ] },
      { id: 'biz', name: 'Negocio', items: [
        ['Viabilidad financiera', 'Analiza la viabilidad financiera de [PROYECTO]: ingresos esperados, costes, punto de equilibrio y los 3 principales riesgos.'],
        ['Análisis DAFO', 'Haz un análisis DAFO de [EMPRESA] en el sector [SECTOR] en forma de tabla, con una recomendación final.'],
        ['Comparar opciones', 'Compara [OPCIÓN A] y [OPCIÓN B] para [OBJETIVO] en una tabla con pros, contras, coste y una recomendación.'],
        ['Resumen ejecutivo', 'Resume este informe en 5 puntos clave para un comité de dirección y añade las decisiones que hay que tomar:\n\n[TEXTO]']
      ] },
      { id: 'write', name: 'Escritura', items: [
        ['Email profesional', 'Escribe un email con tono [TONO] a [DESTINATARIO] para [OBJETIVO]. Máximo 150 palabras, con asunto.'],
        ['Post de LinkedIn', 'Redacta un post de LinkedIn sobre [TEMA] para [PÚBLICO]: gancho inicial, 3 ideas y una llamada a la acción.'],
        ['Mejorar un texto', 'Mejora la claridad y el estilo de este texto sin cambiar su significado. Indica después los 3 cambios más importantes:\n\n[TEXTO]'],
        ['Generar una imagen', 'Genera una imagen de [ESCENA] en estilo [ESTILO], con iluminación [ILUMINACIÓN] y formato [HORIZONTAL/VERTICAL].']
      ] },
      { id: 'learn', name: 'Aprender', items: [
        ['Explicar un concepto', 'Explícame [CONCEPTO] para alguien con nivel [NIVEL], con una analogía y un ejemplo práctico.'],
        ['Plan de estudio', 'Crea un plan de estudio de [SEMANAS] semanas para aprender [TEMA], con objetivos semanales, recursos y ejercicios.'],
        ['Test de repaso', 'Hazme 10 preguntas tipo test sobre [TEMA], de dificultad creciente, con las respuestas y una breve explicación al final.']
      ] },
      { id: 'career', name: 'Carrera', items: [
        ['Revisar CV', 'Revisa mi CV para el puesto de [PUESTO]: dame las 3 mejoras prioritarias y una versión optimizada para ATS.\n\n[CV]'],
        ['Preparar entrevista', 'Prepárame para una entrevista de [PUESTO] en [EMPRESA]: 10 preguntas probables y cómo responderlas con el método STAR.'],
        ['Carta de presentación', 'Escribe una carta de presentación para [PUESTO] en [EMPRESA] destacando [LOGRO PRINCIPAL]. Máximo 250 palabras.']
      ] },
      { id: 'ops', name: 'Sistemas', items: [
        ['Auditar configuración', 'Audita esta configuración de [SERVICIO] y lista los riesgos de seguridad por severidad, con la corrección de cada uno:\n\n[CONFIGURACIÓN]'],
        ['Script con errores', 'Escribe un script en [BASH/POWERSHELL] que [TAREA], con manejo de errores, registro y comentarios.'],
        ['Mitigar vulnerabilidad', 'Explica cómo mitigar [VULNERABILIDAD] en [ENTORNO] con pasos concretos, comandos y cómo verificar que está resuelto.']
      ] },
      { id: 'master', name: 'Maestras', items: [
        ['Experto con estructura', 'Actúa como un experto en [ÁREA]. Tu objetivo es ayudarme a [OBJETIVO]. Para ello, sigue estrictamente esta estructura en tu respuesta: 1. Análisis previo, 2. Paso a paso detallado y 3. Posibles riesgos o alternativas. Mantén un tono [TONO] y sé directo.'],
        ['Revisión en dos fases', 'Revisa el siguiente texto/código bajo los criterios de [CLARIDAD / EFICIENCIA / ESTILO]. No lo reescribas todo directamente a menos que sea necesario; primero haz una lista con los 3 principales puntos de mejora y luego proporciona la versión optimizada.\n\n[TEXTO O CÓDIGO]']
      ] }
    ],
    en: [
      { id: 'code', name: 'Code', items: [
        ['Code review', 'Review this [LANGUAGE] code for bugs, security and performance issues. Return a prioritised list and the fixed code:\n\n[CODE]'],
        ['Unit tests', 'Write unit tests with [FRAMEWORK] for this function, covering edge cases and errors:\n\n[CODE]'],
        ['Explain and refactor', 'Explain step by step what this code does and suggest a more readable refactor that keeps its behaviour:\n\n[CODE]'],
        ['Design an architecture', 'Design the architecture of [PRODUCT] for [NO. OF USERS] users: components, database, queues, deployment and estimated monthly cost.']
      ] },
      { id: 'biz', name: 'Business', items: [
        ['Financial viability', 'Analyse the financial viability of [PROJECT]: expected revenue, costs, break-even point and the top 3 risks.'],
        ['SWOT analysis', 'Write a SWOT analysis of [COMPANY] in the [SECTOR] sector as a table, with a final recommendation.'],
        ['Compare options', 'Compare [OPTION A] and [OPTION B] for [GOAL] in a table with pros, cons, cost and a recommendation.'],
        ['Executive summary', 'Summarise this report in 5 key points for a leadership team and list the decisions to make:\n\n[TEXT]']
      ] },
      { id: 'write', name: 'Writing', items: [
        ['Professional email', 'Write a [TONE] email to [RECIPIENT] to [GOAL]. 150 words max, with a subject line.'],
        ['LinkedIn post', 'Write a LinkedIn post about [TOPIC] for [AUDIENCE]: opening hook, 3 ideas and a call to action.'],
        ['Improve a text', 'Improve the clarity and style of this text without changing its meaning. Then list the 3 most important changes:\n\n[TEXT]'],
        ['Generate an image', 'Generate an image of [SCENE] in [STYLE] style, with [LIGHTING] lighting and [LANDSCAPE/PORTRAIT] format.']
      ] },
      { id: 'learn', name: 'Learn', items: [
        ['Explain a concept', 'Explain [CONCEPT] to someone at [LEVEL] level, with an analogy and a practical example.'],
        ['Study plan', 'Create a [WEEKS]-week study plan to learn [TOPIC], with weekly goals, resources and exercises.'],
        ['Practice quiz', 'Give me 10 multiple-choice questions about [TOPIC], increasing in difficulty, with answers and a short explanation at the end.']
      ] },
      { id: 'career', name: 'Career', items: [
        ['Review my CV', 'Review my CV for the [ROLE] position: give me the top 3 improvements and an ATS-optimised version.\n\n[CV]'],
        ['Interview prep', 'Prepare me for a [ROLE] interview at [COMPANY]: 10 likely questions and how to answer them with the STAR method.'],
        ['Cover letter', 'Write a cover letter for [ROLE] at [COMPANY] highlighting [KEY ACHIEVEMENT]. 250 words max.']
      ] },
      { id: 'ops', name: 'Systems', items: [
        ['Audit a config', 'Audit this [SERVICE] configuration and list the security risks by severity, with the fix for each one:\n\n[CONFIGURATION]'],
        ['Robust script', 'Write a [BASH/POWERSHELL] script that [TASK], with error handling, logging and comments.'],
        ['Mitigate a vulnerability', 'Explain how to mitigate [VULNERABILITY] in [ENVIRONMENT] with concrete steps, commands and how to verify the fix.']
      ] },
      { id: 'master', name: 'Master', items: [
        ['Structured expert', 'Act as an expert in [FIELD]. Your goal is to help me [GOAL]. To do so, strictly follow this structure in your answer: 1. Prior analysis, 2. Detailed step by step, and 3. Possible risks or alternatives. Keep a [TONE] tone and be direct.'],
        ['Two-phase review', 'Review the following text/code against the criteria of [CLARITY / EFFICIENCY / STYLE]. Do not rewrite everything straight away unless necessary; first list the 3 main points for improvement and then provide the optimised version.\n\n[TEXT OR CODE]']
      ] }
    ],
    ca: [
      { id: 'code', name: 'Codi', items: [
        ['Revisió de codi', 'Revisa aquest codi en [LLENGUATGE] buscant errors, problemes de seguretat i de rendiment. Torna una llista prioritzada i el codi corregit:\n\n[CODI]'],
        ['Tests unitaris', 'Escriu tests unitaris amb [FRAMEWORK] per a aquesta funció, cobrint casos límit i errors:\n\n[CODI]'],
        ['Explicar i refactoritzar', 'Explica pas a pas què fa aquest codi i proposa una refactorització més llegible, sense canviar-ne el comportament:\n\n[CODI]'],
        ['Dissenyar arquitectura', 'Dissenya l’arquitectura de [PRODUCTE] per a [NOMBRE D’USUARIS] usuaris: components, base de dades, cues, desplegament i cost mensual estimat.']
      ] },
      { id: 'biz', name: 'Negoci', items: [
        ['Viabilitat financera', 'Analitza la viabilitat financera de [PROJECTE]: ingressos esperats, costos, punt d’equilibri i els 3 riscos principals.'],
        ['Anàlisi DAFO', 'Fes una anàlisi DAFO de [EMPRESA] al sector [SECTOR] en forma de taula, amb una recomanació final.'],
        ['Comparar opcions', 'Compara [OPCIÓ A] i [OPCIÓ B] per a [OBJECTIU] en una taula amb pros, contres, cost i una recomanació.'],
        ['Resum executiu', 'Resumeix aquest informe en 5 punts clau per a un comitè de direcció i afegeix les decisions que cal prendre:\n\n[TEXT]']
      ] },
      { id: 'write', name: 'Escriptura', items: [
        ['Correu professional', 'Escriu un correu amb to [TO] a [DESTINATARI] per [OBJECTIU]. Màxim 150 paraules, amb assumpte.'],
        ['Publicació a LinkedIn', 'Redacta una publicació de LinkedIn sobre [TEMA] per a [PÚBLIC]: ganxo inicial, 3 idees i una crida a l’acció.'],
        ['Millorar un text', 'Millora la claredat i l’estil d’aquest text sense canviar-ne el significat. Indica després els 3 canvis més importants:\n\n[TEXT]'],
        ['Generar una imatge', 'Genera una imatge de [ESCENA] en estil [ESTIL], amb il·luminació [IL·LUMINACIÓ] i format [HORITZONTAL/VERTICAL].']
      ] },
      { id: 'learn', name: 'Aprendre', items: [
        ['Explicar un concepte', 'Explica’m [CONCEPTE] per a algú amb nivell [NIVELL], amb una analogia i un exemple pràctic.'],
        ['Pla d’estudi', 'Crea un pla d’estudi de [SETMANES] setmanes per aprendre [TEMA], amb objectius setmanals, recursos i exercicis.'],
        ['Test de repàs', 'Fes-me 10 preguntes tipus test sobre [TEMA], de dificultat creixent, amb les respostes i una breu explicació al final.']
      ] },
      { id: 'career', name: 'Carrera', items: [
        ['Revisar el CV', 'Revisa el meu CV per al lloc de [LLOC]: dona’m les 3 millores prioritàries i una versió optimitzada per a ATS.\n\n[CV]'],
        ['Preparar entrevista', 'Prepara’m per a una entrevista de [LLOC] a [EMPRESA]: 10 preguntes probables i com respondre-les amb el mètode STAR.'],
        ['Carta de presentació', 'Escriu una carta de presentació per a [LLOC] a [EMPRESA] destacant [ÈXIT PRINCIPAL]. Màxim 250 paraules.']
      ] },
      { id: 'ops', name: 'Sistemes', items: [
        ['Auditar configuració', 'Audita aquesta configuració de [SERVEI] i llista els riscos de seguretat per severitat, amb la correcció de cadascun:\n\n[CONFIGURACIÓ]'],
        ['Script robust', 'Escriu un script en [BASH/POWERSHELL] que [TASCA], amb gestió d’errors, registre i comentaris.'],
        ['Mitigar vulnerabilitat', 'Explica com mitigar [VULNERABILITAT] a [ENTORN] amb passos concrets, ordres i com verificar que està resolt.']
      ] },
      { id: 'master', name: 'Mestres', items: [
        ['Expert amb estructura', 'Actua com un expert en [ÀREA]. El teu objectiu és ajudar-me a [OBJECTIU]. Per fer-ho, segueix estrictament aquesta estructura a la teva resposta: 1. Anàlisi prèvia, 2. Pas a pas detallat i 3. Possibles riscos o alternatives. Mantén un to [TO] i sigues directe.'],
        ['Revisió en dues fases', 'Revisa el text/codi següent segons els criteris de [CLAREDAT / EFICIÈNCIA / ESTIL]. No ho reescriguis tot directament si no cal; primer fes una llista amb els 3 punts de millora principals i després proporciona la versió optimitzada.\n\n[TEXT O CODI]']
      ] }
    ]
  };

  /* ---------- storage ---------- */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsJson(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function favs() { return lsJson(LS.favs).filter(function (f) { return f && typeof f.text === 'string'; }); }
  function setFavs(a) { lsSet(LS.favs, JSON.stringify(a.slice(0, 100))); }
  function recents() { return lsJson(LS.recent).filter(function (r) { return typeof r === 'string' && r; }).slice(0, 5); }

  /* ---------- helpers ---------- */
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var ICON = {
    star: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    role: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    build: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l2 2 3-4"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    del: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };
  function input() { return document.getElementById('prompt-input'); }
  function fire(n) { try { n.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
  function announce(msg) {
    var live = document.getElementById('tap-live');
    if (!live) { live = el('div', { id: 'tap-live', class: 'tap-sr', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(live); }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }
  function closeSidebarIfMobile() {
    var sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('open') && window.matchMedia('(max-width: 860px)').matches) {
      var ov = document.getElementById('sidebar-overlay');
      if (ov) ov.click();
    }
  }

  /* ---------- variables ---------- */
  function findVars(text) {
    var out = [], m;
    VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, token: m[0] });
    return out;
  }
  function selectVar(v) {
    var n = input(); if (!n || !v) return;
    n.focus();
    n.setSelectionRange(v.start, v.end);
    syncMirror();
  }
  function insertPrompt(text) {
    var n = input(); if (!n) return;
    n.value = text;
    fire(n);
    var vars = findVars(text);
    closeSidebarIfMobile();
    if (vars.length) selectVar(vars[0]);
    else { n.focus(); n.setSelectionRange(text.length, text.length); }
    refresh();
    if (vars.length) announce(s('varsLeft')(vars.length) + '. ' + s('varsHint'));
  }

  var mirror, varsBar, warnState = { text: null, at: 0 };
  function ensureWrap() {
    var n = input();
    if (!n || n.parentNode.classList.contains('tap-input-wrap')) return;
    var wrap = el('div', { class: 'tap-input-wrap' });
    n.parentNode.insertBefore(wrap, n);
    mirror = el('div', { class: 'tap-mirror', 'aria-hidden': 'true' });
    wrap.appendChild(mirror);
    wrap.appendChild(n);
    varsBar = el('div', { class: 'tap-vars', id: 'tap-vars', hidden: true });
    wrap.parentNode.insertBefore(varsBar, wrap.nextSibling);
    n.setAttribute('aria-describedby', ((n.getAttribute('aria-describedby') || '') + ' tap-vars').trim());
    n.addEventListener('input', function () { warnState.text = null; refresh(); });
    n.addEventListener('scroll', syncScroll);
    n.addEventListener('keydown', onKey);
    n.addEventListener('click', onClickInside);
    if (window.ResizeObserver) new ResizeObserver(syncMirror).observe(n);
  }
  var PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent', 'tabSize',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'textTransform'];
  function syncMirror() {
    var n = input(); if (!n || !mirror) return;
    var vars = findVars(n.value);
    if (!vars.length) { mirror.hidden = true; mirror.textContent = ''; return; }
    mirror.hidden = false;
    var cs = getComputedStyle(n);
    PROPS.forEach(function (p) { mirror.style[p] = cs[p]; });
    mirror.style.width = n.clientWidth + 'px';
    mirror.style.height = n.clientHeight + 'px';
    mirror.style.top = n.offsetTop + 'px';
    mirror.style.left = n.offsetLeft + 'px';
    var t = n.value, html = '', last = 0, ss = n.selectionStart, se = n.selectionEnd;
    vars.forEach(function (v) {
      var cur = (ss === v.start && se === v.end) ? ' tap-cur' : '';
      html += esc(t.slice(last, v.start)) + '<mark class="tap-mark' + cur + '">' + esc(v.token) + '</mark>';
      last = v.end;
    });
    html += esc(t.slice(last)) + '\u200b';
    mirror.innerHTML = html;
    syncScroll();
  }
  function syncScroll() { var n = input(); if (n && mirror) mirror.scrollTop = n.scrollTop; }
  function renderVarsBar() {
    var n = input(); if (!n || !varsBar) return;
    var vars = findVars(n.value);
    varsBar.innerHTML = '';
    if (!vars.length) { varsBar.hidden = true; return; }
    varsBar.hidden = false;
    varsBar.appendChild(el('span', { class: 'tap-vars-label', text: s('varsLeft')(vars.length) }));
    var seen = {};
    vars.forEach(function (v) {
      if (seen[v.token]) return; seen[v.token] = 1;
      varsBar.appendChild(el('button', {
        type: 'button', class: 'tap-var-chip', text: v.token, 'aria-label': s('fill') + ' ' + v.token,
        onclick: function () { var cur = findVars(input().value).filter(function (x) { return x.token === v.token; })[0]; selectVar(cur); }
      }));
    });
    varsBar.appendChild(el('span', { class: 'tap-vars-hint', text: s('varsHint') }));
  }
  function refresh() { syncMirror(); renderVarsBar(); var w = document.getElementById('tap-warn'); if (w && !warnState.text) w.remove(); }
  function onKey(e) {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
    var n = input(), vars = findVars(n.value);
    if (!vars.length) return;
    var target = null;
    if (e.shiftKey) {
      for (var i = vars.length - 1; i >= 0; i--) if (vars[i].end <= n.selectionStart && !(vars[i].start === n.selectionStart)) { target = vars[i]; break; }
    } else {
      for (var j = 0; j < vars.length; j++) if (vars[j].start >= n.selectionEnd || (vars[j].start > n.selectionStart && vars[j].start < n.selectionEnd)) { target = vars[j]; break; }
    }
    if (!target) return; // normal Tab behaviour: no keyboard trap
    e.preventDefault();
    selectVar(target);
  }
  function onClickInside() {
    var n = input();
    if (n.selectionStart !== n.selectionEnd) return;
    var p = n.selectionStart;
    var hit = findVars(n.value).filter(function (v) { return p > v.start && p < v.end; })[0];
    if (hit) n.setSelectionRange(hit.start, hit.end);
    syncMirror();
  }
  document.addEventListener('selectionchange', function () { if (document.activeElement === input()) syncMirror(); });

  function beforeSend(text) {
    var vars = findVars(String(text || ''));
    if (!vars.length) return true;
    var now = Date.now();
    if (warnState.text === text && now - warnState.at < 20000) { warnState.text = null; var w0 = document.getElementById('tap-warn'); if (w0) w0.remove(); return true; }
    warnState = { text: text, at: now };
    var uniq = [];
    vars.forEach(function (v) { if (uniq.indexOf(v.token) < 0) uniq.push(v.token); });
    var w = document.getElementById('tap-warn');
    if (!w) { w = el('div', { id: 'tap-warn', class: 'tap-warn', role: 'alert' }); if (varsBar) varsBar.parentNode.insertBefore(w, varsBar); }
    w.textContent = s('varsWarn')(uniq.join(', '));
    selectVar(vars[0]);
    return false;
  }

  /* ---------- roles: state + composer chip ---------- */
  function currentRoleId() { var id = lsGet(LS.role, 'none'); return roleById(id).id === id ? id : 'none'; }
  function roleContext() {
    var id = currentRoleId();
    if (id === 'none') return '';
    var label = lang() === 'en' ? '[ACTIVE ROLE]' : (lang() === 'ca' ? '[ROL ACTIU]' : '[ROL ACTIVO]');
    if (id === 'custom') { var c = lsGet(LS.roleCustom, '').trim(); return c ? label + ': ' + c.slice(0, 1200) : ''; }
    return label + ': ' + roleById(id).ctx;
  }
  function rolePreset() {
    var id = currentRoleId();
    if (id === 'none') return null;
    if (id === 'custom') return lsGet(LS.roleCustom, '').trim() ? 'general' : null;
    return roleById(id).preset || 'general';
  }
  function roleLabel(id) {
    if (id === 'custom') { var c = lsGet(LS.roleCustom, '').trim(); return roleById('custom').name + (c ? ': ' + c.slice(0, 28) + (c.length > 28 ? '…' : '') : ''); }
    return roleById(id).name;
  }
  function paintRole() {
    var sel = document.getElementById('tap-role-select');
    var pill = document.getElementById('tap-role-pill');
    if (!sel || !pill) return;
    var id = currentRoleId();
    sel.value = id;
    var cOpt = sel.querySelector('option[value="custom"]');
    if (cOpt) cOpt.textContent = id === 'custom' ? roleLabel('custom') : s('customRole');
    pill.classList.toggle('active', id !== 'none');
    pill.title = s('roleActive') + ': ' + roleLabel(id);
  }
  function setRole(id) { lsSet(LS.role, id); paintRole(); announce(s('roleActive') + ': ' + roleLabel(id)); }
  function mountComposer() {
    var pills = document.querySelector('.control-pills');
    if (!pills || document.getElementById('tap-role-pill')) return;
    var sel = el('select', { id: 'tap-role-select', class: 'tap-role-select', 'aria-label': s('roleTitle') });
    roles().forEach(function (r) { sel.appendChild(el('option', { value: r.id, text: r.id === 'custom' ? s('customRole') : r.name })); });
    var prev = currentRoleId();
    sel.addEventListener('focus', function () { prev = currentRoleId(); });
    sel.addEventListener('change', function () {
      var v = sel.value;
      if (v === 'custom') { openCustomRole(prev); return; }
      setRole(v);
    });
    var pill = el('label', { class: 'dock-pill tap-role-pill', id: 'tap-role-pill', for: 'tap-role-select' });
    pill.innerHTML = ICON.role + '<span class="tap-sr">' + esc(s('role')) + '</span>';
    pill.appendChild(sel);
    var b = el('button', { type: 'button', class: 'dock-pill tap-builder-pill', id: 'tap-builder-pill', 'aria-haspopup': 'dialog', title: s('builderTitle') });
    b.innerHTML = ICON.build + '<span class="tap-pill-txt">' + esc(s('builder')) + '</span>';
    b.addEventListener('click', function () { openBuilder(); });
    var f = el('button', { type: 'button', class: 'dock-pill tap-fav-pill', id: 'tap-fav-pill', 'aria-haspopup': 'dialog', 'aria-label': s('saveFav'), title: s('saveFav') });
    f.innerHTML = ICON.star;
    f.addEventListener('click', function () {
      var t = (input() && input().value.trim()) || '';
      if (!t) { announce(s('emptyFav')); input() && input().focus(); return; }
      openFavDialog({ text: t });
    });
    pills.insertBefore(f, pills.firstChild);
    pills.insertBefore(b, pills.firstChild);
    pills.insertBefore(pill, pills.firstChild);
    paintRole();
  }

  /* ---------- dialog (focus trap) ---------- */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function dialog(opts) {
    var opener = document.activeElement;
    var id = 'tap-dlg-' + Math.random().toString(36).slice(2, 8);
    var back = el('div', { class: 'tap-backdrop' });
    var card = el('div', { class: 'modal-card tap-dialog' + (opts.wide ? ' tap-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-t' });
    var head = el('div', { class: 'modal-header' }, [
      el('h2', { class: 'modal-title', id: id + '-t', text: opts.title }),
      el('button', { type: 'button', class: 'modal-close-btn tap-x', 'aria-label': s('close'), text: '✕', onclick: function () { close(); } })
    ]);
    var body = el('div', { class: 'modal-body' }, [opts.body]);
    var foot = el('div', { class: 'modal-footer' }, opts.buttons || []);
    card.appendChild(head); card.appendChild(body); card.appendChild(foot);
    back.appendChild(card);
    var app = document.querySelector('.ta-app');
    var closed = false;
    function close(reason) {
      if (closed) return; closed = true;
      back.remove();
      if (app) app.removeAttribute('inert');
      document.documentElement.classList.remove('tap-modal-open');
      if (opts.onClose) opts.onClose(reason);
      var r = opts.returnFocus || opener;
      if (r && document.contains(r) && r.focus) r.focus();
    }
    back.addEventListener('mousedown', function (e) { if (e.target === back) close('backdrop'); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('esc'); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(card.querySelectorAll(FOCUSABLE), function (x) { return x.offsetParent !== null || x === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(back);
    if (app) app.setAttribute('inert', '');
    document.documentElement.classList.add('tap-modal-open');
    var firstField = opts.initialFocus || card.querySelector('.modal-body ' + FOCUSABLE) || card.querySelector(FOCUSABLE);
    if (firstField) firstField.focus();
    return { close: close, card: card, body: body };
  }
  function btn(text, cls, onclick) { return el('button', { type: 'button', class: 'settings-foot-btn' + (cls ? ' ' + cls : ''), text: text, onclick: onclick }); }
  function field(label, ctrl) {
    var fid = ctrl.id || ('tap-f-' + Math.random().toString(36).slice(2, 8));
    ctrl.id = fid;
    return el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: fid, text: label }), ctrl]);
  }

  function openCustomRole(prev) {
    var ta = el('textarea', { class: 'form-textarea', rows: '4', maxlength: '1200', placeholder: s('customRolePh') });
    ta.value = lsGet(LS.roleCustom, '');
    var ok = false;
    var d = dialog({
      title: s('customRoleTitle'), body: field(s('customRoleLabel'), ta),
      returnFocus: document.getElementById('tap-role-select'),
      buttons: [btn(s('cancel'), '', function () { d.close(); }), btn(s('save'), 'primary', function () {
        var v = ta.value.trim();
        if (!v) { ta.focus(); return; }
        lsSet(LS.roleCustom, v); ok = true; setRole('custom'); d.close();
      })],
      onClose: function () { if (!ok) { lsSet(LS.role, prev || 'none'); paintRole(); } }
    });
  }

  function openFavDialog(opts) {
    var name = el('input', { class: 'form-input', type: 'text', maxlength: '60', placeholder: s('favNamePh'), autocomplete: 'off' });
    var text = el('textarea', { class: 'form-textarea', rows: '6' });
    name.value = opts.name || (opts.text || '').replace(/\s+/g, ' ').slice(0, 40);
    text.value = opts.text || '';
    var body = el('div', { class: 'tap-col' }, [field(s('favName'), name), field(s('favText'), text)]);
    var d = dialog({
      title: opts.id ? s('editFav') : s('saveFav'), body: body,
      buttons: [btn(s('cancel'), '', function () { d.close(); }), btn(s('save'), 'primary', function () {
        var n = name.value.trim(), t = text.value.trim();
        if (!t) { text.focus(); return; }
        if (!n) n = t.replace(/\s+/g, ' ').slice(0, 40);
        var a = favs();
        if (opts.id) a = a.map(function (f) { return f.id === opts.id ? { id: f.id, name: n, text: t, at: Date.now() } : f; });
        else a.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, text: t, at: Date.now() });
        setFavs(a); d.close(); announce(s('saved')); rerenderSidebar();
      })]
    });
    setTimeout(function () { name.select(); }, 30);
  }

  /* ---------- recents ---------- */
  function recordSent(text) {
    text = String(text || '').trim();
    if (!text || text.length > 8000) return;
    var a = recents().filter(function (r) { return r !== text; });
    a.unshift(text);
    lsSet(LS.recent, JSON.stringify(a.slice(0, 5)));
    rerenderSidebar();
  }

  /* ---------- sidebar view ---------- */
  function rerenderSidebar() {
    var tab = document.getElementById('tab-prompts');
    var list = document.getElementById('history-list');
    if (tab && tab.classList.contains('active') && list) {
      var q = document.getElementById('history-search');
      renderSidebar(list, q ? q.value : '');
    }
  }
  function itemRow(title, sub, onUse, actions) {
    var row = el('div', { class: 'tap-item', role: 'listitem' });
    var main = el('button', { type: 'button', class: 'tap-item-main', title: s('reuse'), onclick: onUse }, [
      el('span', { class: 'tap-item-title', text: title }),
      sub ? el('span', { class: 'tap-item-sub', text: sub }) : null
    ]);
    row.appendChild(main);
    var act = el('div', { class: 'tap-item-actions' });
    actions.forEach(function (a) { var b = el('button', { type: 'button', class: 'tap-icon-btn', 'aria-label': a.label + ': ' + title, title: a.label, onclick: a.fn }); b.innerHTML = a.icon; act.appendChild(b); });
    row.appendChild(act);
    return row;
  }
  function renderSidebar(list, filter) {
    if (!list) return;
    list.innerHTML = '';
    var q = String(filter || '').trim().toLowerCase();
    var match = function (x) { return !q || String(x).toLowerCase().indexOf(q) >= 0; };
    var wrap = el('div', { class: 'tap-side' });
    var h1 = el('div', { class: 'tap-side-head' }, [
      el('h2', { class: 'tap-side-title', id: 'tap-side-favs', text: s('favs') }),
      el('button', { type: 'button', class: 'tap-link-btn', text: '+ ' + s('addFav'), 'aria-haspopup': 'dialog', onclick: function () { openFavDialog({ text: (input() && input().value.trim()) || '' }); } })
    ]);
    wrap.appendChild(h1);
    var fl = el('div', { class: 'tap-list', role: 'list', 'aria-labelledby': 'tap-side-favs' });
    var F = favs().filter(function (f) { return match(f.name + ' ' + f.text); });
    if (!F.length) fl.appendChild(el('p', { class: 'empty-side', text: s('noFavs') }));
    F.forEach(function (f) {
      fl.appendChild(itemRow(f.name || f.text.slice(0, 40), f.text.replace(/\s+/g, ' ').slice(0, 70), function () { insertPrompt(f.text); }, [
        { label: s('edit'), icon: ICON.edit, fn: function () { openFavDialog(f); } },
        { label: s('del'), icon: ICON.del, fn: function () { if (window.confirm(s('confirmDel'))) { setFavs(favs().filter(function (x) { return x.id !== f.id; })); rerenderSidebar(); } } }
      ]));
    });
    wrap.appendChild(fl);
    var R = recents().filter(match);
    var h2 = el('div', { class: 'tap-side-head' }, [el('h2', { class: 'tap-side-title', id: 'tap-side-rec', text: s('recents') })]);
    if (recents().length) h2.appendChild(el('button', { type: 'button', class: 'tap-link-btn', text: s('clearRecents'), onclick: function () { lsSet(LS.recent, '[]'); rerenderSidebar(); announce(s('clearRecents')); } }));
    wrap.appendChild(h2);
    var rl = el('div', { class: 'tap-list', role: 'list', 'aria-labelledby': 'tap-side-rec' });
    if (!R.length) rl.appendChild(el('p', { class: 'empty-side', text: s('noRecents') }));
    R.forEach(function (r) {
      rl.appendChild(itemRow(r.replace(/\s+/g, ' ').slice(0, 60), '', function () { insertPrompt(r); }, [
        { label: s('starIt'), icon: ICON.star, fn: function () { openFavDialog({ text: r }); } }
      ]));
    });
    wrap.appendChild(rl);
    list.appendChild(wrap);
  }
  function mountSidebar() {
    var tabs = document.querySelector('.sb-tabs');
    if (tabs && !document.getElementById('tab-prompts')) {
      var b = el('button', { type: 'button', class: 'sb-tab', 'data-view': 'prompts', id: 'tab-prompts', text: s('prompts') });
      tabs.appendChild(b);
      tabs.classList.add('tap-5');
    }
    localizeRewrite();
  }
  function localizeRewrite() {
    var rl = rawLang().split('-')[0];
    var rd = (S[rl] && S[rl].rewriteDesc) || REWRITE_DESC[rl] || S.en.rewriteDesc;
    document.querySelectorAll('.ta-rewrite-desc').forEach(function (d) { d.textContent = rd; });
    var rb = document.getElementById('open-rewrite-btn');
    if (rb) rb.title = rd;
    var cb = document.getElementById('open-providers-btn');
    if (cb) cb.title = ({ es: 'Herramientas y fuentes conectadas al chat', ca: 'Eines i fonts connectades al xat' })[rl] || 'Tools and sources connected to the chat';
    var ol = document.getElementById('rewrite-open-link');
    if (ol) ol.textContent = ({ es: 'Abrir', ca: 'Obre' })[rl] || 'Open';
  }

  /* ---------- hero starters ---------- */
  function starterCats() { return STARTERS[lang()]; }
  function highlightPreview(text) {
    var flat = text.replace(/\s+/g, ' ').trim();
    var out = '', last = 0;
    findVars(flat).forEach(function (v) { out += esc(flat.slice(last, v.start)) + '<span class="tap-var-ink">' + esc(v.token) + '</span>'; last = v.end; });
    return out + esc(flat.slice(last));
  }
  function mountHero(container) {
    container = container || document.querySelector('.ta-hero .hero-chips');
    if (!container || container.getAttribute('data-tap') === '1') return;
    container.setAttribute('data-tap', '1');
    container.className = 'tap-starters';
    container.innerHTML = '';
    var cats = starterCats();
    var cur = lsGet(LS.cat, cats[0].id);
    if (!cats.some(function (c) { return c.id === cur; })) cur = cats[0].id;
    var tl = el('div', { class: 'tap-cats', role: 'tablist', 'aria-label': s('cats') });
    var panel = el('div', { class: 'tap-grid', role: 'tabpanel', id: 'tap-starter-panel', tabindex: '-1' });
    function paint() {
      Array.prototype.forEach.call(tl.children, function (b) {
        var on = b.getAttribute('data-cat') === cur;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        if (on) panel.setAttribute('aria-labelledby', b.id);
      });
      panel.innerHTML = '';
      var c = cats.filter(function (x) { return x.id === cur; })[0];
      c.items.forEach(function (it) {
        var card = el('button', { type: 'button', class: 'tap-starter' });
        card.innerHTML = '<span class="tap-starter-title">' + esc(it[0]) + '</span><span class="tap-starter-text">' + highlightPreview(it[1]) + '</span>';
        card.addEventListener('click', function () { insertPrompt(it[1]); });
        panel.appendChild(card);
      });
    }
    cats.forEach(function (c, i) {
      var b = el('button', { type: 'button', role: 'tab', class: 'tap-cat', id: 'tap-cat-' + c.id, 'data-cat': c.id, 'aria-controls': 'tap-starter-panel', text: c.name });
      b.addEventListener('click', function () { cur = c.id; lsSet(LS.cat, cur); paint(); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, idx = i;
        if (k === 'ArrowRight') idx = (i + 1) % cats.length;
        else if (k === 'ArrowLeft') idx = (i - 1 + cats.length) % cats.length;
        else if (k === 'Home') idx = 0;
        else if (k === 'End') idx = cats.length - 1;
        else return;
        e.preventDefault();
        cur = cats[idx].id; lsSet(LS.cat, cur); paint();
        tl.children[idx].focus();
      });
      tl.appendChild(b);
    });
    container.appendChild(tl);
    container.appendChild(panel);
    paint();
  }

  /* ---------- builder (lazy) ---------- */
  var builderLoading = null;
  function openBuilder(prefill) {
    if (window.TAPBuilder) { window.TAPBuilder.open(prefill); return; }
    if (!builderLoading) {
      var v = '';
      try { var me = document.querySelector('script[src*="/assets/prompts.js"]'); var m = me && me.src.match(/\?v=([^&]+)/); if (m) v = '?v=' + m[1]; } catch (e) {}
      builderLoading = new Promise(function (res, rej) {
        var sc = document.createElement('script');
        sc.src = '/assets/prompt-builder.js' + v; sc.async = true;
        sc.onload = res; sc.onerror = function () { builderLoading = null; rej(); };
        document.head.appendChild(sc);
      });
    }
    builderLoading.then(function () { if (window.TAPBuilder) window.TAPBuilder.open(prefill); });
  }

  /* ---------- boot ---------- */
  function init() {
    ensureWrap();
    mountComposer();
    mountSidebar();
    mountHero();
    refresh();
  }

  window.TAP = {
    init: init, mountHero: mountHero, beforeSend: beforeSend, roleContext: roleContext, rolePreset: rolePreset,
    recordSent: recordSent, renderSidebar: renderSidebar, openBuilder: openBuilder, insertPrompt: insertPrompt,
    findVars: findVars, refresh: refresh, localizeRewrite: localizeRewrite,
    _: { s: s, lang: lang, roles: roles, currentRoleId: currentRoleId, roleById: roleById, dialog: dialog, setRole: setRole, btn: btn, field: field, el: el, esc: esc, openFavDialog: openFavDialog, input: input, announce: announce }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
