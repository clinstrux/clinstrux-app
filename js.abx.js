/* ════════════════════════════════════════════════════════════
   abx.js — Antibiotic Stewardship workflow: state, helpers,
            reasoning engine, UI updates, monitoring
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   ABX — STATE
════════════════════════════════════════════════════════════ */

var ABX = {
  wbc:         14.2,
  crp:         88,
  gfr:         52,
  temp:        37.4,
  improvement: 'improving',
  culture:     'pending'
};

var _abxActivePopover = null;

/* ════════════════════════════════════════════════════════════
   ABX — NAVIGATION
════════════════════════════════════════════════════════════ */

function abxShowSection(id, btn) {
  var sections = document.querySelectorAll('#abx-page .dp-section');
  sections.forEach(function(s) { s.classList.remove('active'); });
  var target = document.getElementById(id);
  if (target) target.classList.add('active');

  var navItems = document.querySelectorAll('#abx-page .dp-nav-item');
  navItems.forEach(function(n) { n.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════════════
   ABX — POPOVERS
════════════════════════════════════════════════════════════ */

function abxOpenPopover(key, e) {
  if (e) e.stopPropagation();
  abxClosePopover(_abxActivePopover);
  var pop = document.getElementById('abx-pop-' + key);
  var card = document.getElementById('abx-p-' + key);
  if (!pop || !card) return;

  // Sync slider/select to current ABX state before showing
  if (key === 'wbc')  { var r = document.getElementById('abx-rng-wbc');  if (r) { r.value = ABX.wbc; document.getElementById('abx-rng-wbc-val').textContent = ABX.wbc; } }
  if (key === 'crp')  { var r = document.getElementById('abx-rng-crp');  if (r) { r.value = ABX.crp; document.getElementById('abx-rng-crp-val').textContent = ABX.crp; } }
  if (key === 'gfr')  { var r = document.getElementById('abx-rng-gfr');  if (r) { r.value = ABX.gfr; document.getElementById('abx-rng-gfr-val').textContent = ABX.gfr; } }
  if (key === 'temp') { var r = document.getElementById('abx-rng-temp'); if (r) { r.value = ABX.temp; document.getElementById('abx-rng-temp-val').textContent = parseFloat(ABX.temp).toFixed(1); } }
  if (key === 'improvement') { var s = document.getElementById('abx-sel-improvement'); if (s) s.value = ABX.improvement; }
  if (key === 'culture')     { var s = document.getElementById('abx-sel-culture');     if (s) s.value = ABX.culture; }

  pop.style.display = 'block';
  // Position relative to card
  var rect = card.getBoundingClientRect();
  pop.style.top  = (card.offsetTop + card.offsetHeight + 4) + 'px';
  pop.style.left = card.offsetLeft + 'px';

  _abxActivePopover = key;
}

function abxClosePopover(key) {
  if (!key) return;
  var pop = document.getElementById('abx-pop-' + key);
  if (pop) pop.style.display = 'none';
  if (_abxActivePopover === key) _abxActivePopover = null;
}
/* ════════════════════════════════════════════════════════════
   ABX — APPLY PARAM
════════════════════════════════════════════════════════════ */

function abxApplyParam(key) {
  if (key === 'wbc') {
    var r = document.getElementById('abx-rng-wbc');
    if (r) ABX.wbc = parseFloat(r.value);
  }
  if (key === 'crp') {
    var r = document.getElementById('abx-rng-crp');
    if (r) ABX.crp = parseFloat(r.value);
  }
  if (key === 'gfr') {
    var r = document.getElementById('abx-rng-gfr');
    if (r) ABX.gfr = parseFloat(r.value);
  }
  if (key === 'temp') {
    var r = document.getElementById('abx-rng-temp');
    if (r) ABX.temp = parseFloat(r.value);
  }
  if (key === 'improvement') {
    var s = document.getElementById('abx-sel-improvement');
    if (s) ABX.improvement = s.value;
  }
  if (key === 'culture') {
    var s = document.getElementById('abx-sel-culture');
    if (s) ABX.culture = s.value;
  }
  abxClosePopover(key);
  abxRunReasoningEngine();
}

/* ════════════════════════════════════════════════════════════
   ABX — HELPERS
════════════════════════════════════════════════════════════ */

function abxFeverActive()     { return ABX.temp >= 38.0; }
function abxWbcElevated()     { return ABX.wbc > 11; }
function abxWbcSeverely()     { return ABX.wbc > 20; }
function abxCrpHigh()         { return ABX.crp > 100; }
function abxCrpVeryHigh()     { return ABX.crp > 200; }
function abxGfrImpaired()     { return ABX.gfr < 60; }
function abxGfrSevere()       { return ABX.gfr < 30; }
function abxImproving()       { return ABX.improvement === 'improving'; }
function abxWorsening()       { return ABX.improvement === 'worsening'; }
function abxCultureSensitive(){ return ABX.culture === 'sensitive'; }
function abxCultureResistant(){ return ABX.culture === 'resistant'; }
function abxCultureNoGrowth() { return ABX.culture === 'no-growth'; }
function abxCulturePending()  { return ABX.culture === 'pending'; }

/* ════════════════════════════════════════════════════════════
   ABX — REASONING ENGINE
════════════════════════════════════════════════════════════ */

function abxRunReasoningEngine() {
  abxUpdateParamCards();
  abxUpdateClinicalStatusSummary();
  abxUpdateClinicalImpression();
  abxUpdateRecommendation();
  abxUpdateMonitoring();
}

/* ── 1. Param cards ───────────────────────────────────────────────────────── */
/* ── 1. Param cards ───────────────────────────────────────────────────────── */
function abxUpdateParamCards() {
  function setVal(id, v)  { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id);
    if (!e) return;
    e.className = e.className.replace(/abx-val-\w+/g, '').trim();
    if (cls) e.classList.add(cls);
  }

  // WBC
  var wbcStatus = ABX.wbc > 20 ? 'Severely elevated' : ABX.wbc > 11 ? 'Elevated' : ABX.wbc < 4 ? 'Low — leucopenia' : 'Normal range';
  var wbcCls    = ABX.wbc > 20 ? 'abx-val-red' : ABX.wbc > 11 ? 'abx-val-amber' : ABX.wbc < 4 ? 'abx-val-amber' : 'abx-val-green';
  setVal('abx-val-wbc', ABX.wbc); setVal('abx-status-wbc', wbcStatus); setCls('abx-val-wbc', wbcCls);

  // CRP
  var crpStatus = ABX.crp > 200 ? 'Severely elevated' : ABX.crp > 100 ? 'Significantly elevated' : ABX.crp > 5 ? 'Elevated · trending down' : 'Normal';
  var crpCls    = ABX.crp > 100 ? 'abx-val-red' : ABX.crp > 5 ? 'abx-val-amber' : 'abx-val-green';
  setVal('abx-val-crp', ABX.crp); setVal('abx-status-crp', crpStatus); setCls('abx-val-crp', crpCls);

  // GFR
  var gfrStatus = ABX.gfr < 30 ? 'Severe impairment — dose review' : ABX.gfr < 60 ? 'Mild impairment' : 'Normal — no adjustment';
  var gfrCls    = ABX.gfr < 30 ? 'abx-val-red' : ABX.gfr < 60 ? 'abx-val-amber' : '';
  setVal('abx-val-gfr', ABX.gfr); setVal('abx-status-gfr', gfrStatus); setCls('abx-val-gfr', gfrCls);

  // Temp
  var tempStatus = ABX.temp >= 39.5 ? 'High fever' : ABX.temp >= 38.5 ? 'Moderate fever' : ABX.temp >= 38.0 ? 'Febrile' : 'Afebrile';
  var tempCls    = ABX.temp >= 38.5 ? 'abx-val-red' : ABX.temp >= 38.0 ? 'abx-val-amber' : 'abx-val-green';
  setVal('abx-val-temp', parseFloat(ABX.temp).toFixed(1));
  setVal('abx-status-temp', tempStatus); setCls('abx-val-temp', tempCls);

  // Improvement — from ABX_IMPROVEMENT_LABELS content
  setVal('abx-val-improvement', ABX_IMPROVEMENT_LABELS[ABX.improvement] || ABX.improvement);
  setVal('abx-status-improvement', ABX_IMPROVEMENT_SUBS[ABX.improvement] || '');
  setCls('abx-val-improvement', ABX_IMPROVEMENT_CLS[ABX.improvement] || '');

  // Culture — from ABX_CULTURE_LABELS content
  setVal('abx-val-culture', ABX_CULTURE_LABELS[ABX.culture] || ABX.culture);
  setVal('abx-status-culture', ABX_CULTURE_SUBS[ABX.culture] || '');
  setCls('abx-val-culture', ABX_CULTURE_CLS[ABX.culture] || '');
}


/* ── 2. Clinical Status Summary ──────────────────────────────────────────── */
/* ── 2. Clinical Status Summary ──────────────────────────────────────────── */
function abxUpdateClinicalStatusSummary() {
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/css-val-\w+/g, '').trim();
    if (cls) e.classList.add(cls);
  }

  // Inflammatory trend
  var infVal, infSub, infCls;
  if (abxCrpVeryHigh() || abxWbcSeverely()) {
    infVal = 'Severely elevated'; infSub = 'WBC ' + ABX.wbc + ' · CRP ' + ABX.crp; infCls = 'css-val-red';
  } else if (abxCrpHigh() || abxWbcElevated()) {
    infVal = 'Elevated'; infSub = 'WBC ' + ABX.wbc + ' · CRP ' + ABX.crp; infCls = 'css-val-amber';
  } else {
    infVal = 'Settling'; infSub = 'WBC ' + ABX.wbc + ' · CRP ' + ABX.crp; infCls = 'css-val-green';
  }
  setVal('abx-m-inflam', infVal); setVal('abx-m-inflam-sub', infSub); setCls('abx-m-inflam', infCls);

  // Fever
  var fevVal, fevSub, fevCls;
  if (ABX.temp >= 38.5) {
    fevVal = 'Febrile';   fevSub = ABX.temp.toFixed(1) + '\u00b0C — active fever'; fevCls = 'css-val-red';
  } else if (ABX.temp >= 38.0) {
    fevVal = 'Low-grade'; fevSub = ABX.temp.toFixed(1) + '\u00b0C — borderline';    fevCls = 'css-val-amber';
  } else {
    fevVal = 'Afebrile';  fevSub = ABX.temp.toFixed(1) + '\u00b0C — resolved';     fevCls = 'css-val-green';
  }
  setVal('abx-m-fever', fevVal); setVal('abx-m-fever-sub', fevSub); setCls('abx-m-fever', fevCls);

  // Clinical trajectory — from ABX_CSS_TRAJECTORY content
  var traj = ABX_CSS_TRAJECTORY[ABX.improvement] || ABX_CSS_TRAJECTORY.stable;
  setVal('abx-m-trajectory', traj.val); setVal('abx-m-traj-sub', traj.sub); setCls('abx-m-trajectory', traj.cls);

  // Renal
  var renVal, renSub, renCls;
  if (abxGfrSevere()) {
    renVal = 'Severe impairment'; renSub = 'eGFR ' + ABX.gfr + ' — major dose review'; renCls = 'css-val-red';
  } else if (abxGfrImpaired()) {
    renVal = 'Mild impairment';   renSub = 'eGFR ' + ABX.gfr + ' — dose adj. active'; renCls = 'css-val-amber';
  } else {
    renVal = 'Normal';            renSub = 'eGFR ' + ABX.gfr + ' — no adjustment';    renCls = '';
  }
  setVal('abx-m-renal', renVal); setVal('abx-m-renal-sub', renSub); setCls('abx-m-renal', renCls);

  // Overall text
  var parts = [];
  if (abxWorsening()) {
    parts.push('Patient is clinically deteriorating despite current antimicrobial therapy.');
    parts.push('This constitutes a treatment failure signal and must be escalated urgently.');
  } else if (abxImproving()) {
    parts.push('Patient demonstrates meaningful clinical improvement on Day 3 of IV piperacillin-tazobactam.');
    if (abxWbcElevated() || abxCrpHigh()) parts.push('Inflammatory markers remain elevated but are trending in the right direction.');
    if (!abxFeverActive()) parts.push('Defervescence achieved.');
    parts.push('Clinical improvement is the dominant stewardship signal at this stage.');
  } else {
    parts.push('Patient is clinically stable with limited improvement. Inflammatory markers have not yet significantly settled.');
    parts.push('Continue current therapy and reassess at 48 hours.');
  }
  var overall = document.getElementById('abx-overall-text');
  if (overall) overall.textContent = parts.join(' ');

  // Badge — from ABX_CSS_BADGE content
  var badge = document.getElementById('abx-css-badge');
  var badgeLbl = document.getElementById('abx-css-badge-label');
  var badgeDot = document.getElementById('abx-css-badge-dot');
  if (badge && badgeLbl) {
    badge.className = 'css-overall-badge';
    var badgeData = ABX_CSS_BADGE[ABX.improvement] || ABX_CSS_BADGE.improving;
    if (badgeData.cls) badge.classList.add(badgeData.cls);
    badgeLbl.textContent = badgeData.label;
    if (badgeDot) badgeDot.style.background = abxWorsening() ? 'var(--red)' : abxImproving() ? 'var(--green)' : 'var(--amber)';
  }
}

function abxUpdateClinicalImpression() {
  var v = { wbc: ABX.wbc, crp: ABX.crp, temp: parseFloat(ABX.temp).toFixed(1), gfr: ABX.gfr };
  var lines = [];

  // 1. Clinical trajectory
  lines.push(ABX_CI.trajectory[ABX.improvement]);

  // 2. Inflammatory markers — contextualised against trajectory
  var markersKey;
  if (abxWbcSeverely() || abxCrpVeryHigh()) {
    markersKey = abxWorsening() ? 'very_high_worsening' : 'very_high_improving';
  } else if (abxWbcElevated() || abxCrpHigh()) {
    markersKey = 'elevated';
  } else {
    markersKey = 'settling';
  }
  var mt = ABX_CI.markers[markersKey];
  lines.push({ tone: mt.tone, text: abxFill(mt.text, v) });

  // 3. Fever
  var feverKey;
  if (ABX.temp >= 38.5) {
    feverKey = 'high';
  } else if (abxFeverActive()) {
    feverKey = abxImproving() ? 'low_grade_improving' : 'low_grade_stable';
  } else {
    feverKey = 'afebrile';
  }
  var ft = ABX_CI.fever[feverKey];
  lines.push({ tone: ft.tone, text: abxFill(ft.text, v) });

  // 4. Culture
  var cultureKeyMap = { resistant: 'resistant', sensitive: 'sensitive', 'no-growth': 'no_growth', pending: 'pending', contaminant: 'pending' };
  var ct = ABX_CI.culture[cultureKeyMap[ABX.culture] || 'pending'];
  lines.push({ tone: ct.tone, text: ct.text });

  // 5. Renal
  if (abxGfrSevere()) {
    var rt = ABX_CI.renal.severe;
    lines.push({ tone: rt.tone, text: abxFill(rt.text, v) });
  } else if (abxGfrImpaired()) {
    var rt = ABX_CI.renal.impaired;
    lines.push({ tone: rt.tone, text: abxFill(rt.text, v) });
  }

  // Conclusion
  var conclusionKey;
  if (abxWorsening()) {
    conclusionKey = 'worsening';
  } else if (abxImproving() && (abxCultureSensitive() || abxCultureNoGrowth())) {
    conclusionKey = 'improving_supported';
  } else if (abxImproving() && abxCulturePending()) {
    conclusionKey = 'improving_pending';
  } else if (abxImproving() && abxCultureResistant()) {
    conclusionKey = 'improving_resistant';
  } else {
    conclusionKey = 'default';
  }

  var parasEl = document.getElementById('abx-ci-paragraphs');
  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }
  var concTextEl = document.getElementById('abx-ci-conclusion-text');
  if (concTextEl) concTextEl.textContent = ABX_CI.conclusions[conclusionKey];
}

/* ── 4. Recommendation ───────────────────────────────────────────────────── */
function abxUpdateRecommendation() {
  function setEl(id, v) { var e = document.getElementById(id); if (e) e.innerHTML = v; }
  function setText(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  var t, conf, confLabel, confDesc, chip3, chip4, deescTarget, prereq;

  if (abxWorsening()) {
    t = ABX_REC.escalate;
    chip4 = abxGfrSevere() ? t.chip4_renal : t.chip4_standard;
    setEl('abx-rec-action', t.action); setText('abx-rec-state', t.state);
    setText('abx-rec-rationale', t.rationale);
    setText('abx-conf-pct', t.conf + '%'); setText('abx-conf-label', t.confLabel);
    setText('abx-conf-desc', t.confDesc);
    var bar = document.getElementById('abx-conf-bar'); if (bar) bar.style.width = t.conf + '%';
    setEl('abx-deesc-target', t.deescTarget); setEl('abx-prerequisite', t.prereq);
    var chipsRow = document.querySelector('#abx-section-recommendation .ds-primary-ev-chips');
    if (chipsRow) chipsRow.innerHTML = t.chip1 + t.chip2 + t.chip3 + chip4;
    var s1 = document.getElementById('abx-wn-deesc-state'); if(s1){s1.textContent=t.wn_deesc_state; s1.className=t.wn_deesc_cls;}
    var s2 = document.getElementById('abx-wn-esc-state');   if(s2){s2.textContent=t.wn_esc_state;   s2.className=t.wn_esc_cls;}
    var r1 = document.getElementById('abx-wn-deesc');       if(r1) r1.textContent=t.wn_deesc_reason;
    var r2 = document.getElementById('abx-wn-esc');         if(r2) r2.textContent=t.wn_esc_reason;
    var r3 = document.getElementById('abx-wn-continue');    if(r3) r3.textContent=t.wn_continue_reason;
    var ci = document.getElementById('abx-wn-culture-item');if(ci) ci.textContent=t.wn_culture_item;

  } else if (ABX.improvement === 'stable' && !abxCultureSensitive() && !abxCultureNoGrowth()) {
    t = ABX_REC.reassess;
    chip4 = abxGfrImpaired() ? t.chip4_renal : t.chip4_standard;
    setEl('abx-rec-action', t.action); setText('abx-rec-state', t.state);
    setText('abx-rec-rationale', t.rationale);
    setText('abx-conf-pct', t.conf + '%'); setText('abx-conf-label', t.confLabel);
    setText('abx-conf-desc', t.confDesc);
    var bar = document.getElementById('abx-conf-bar'); if (bar) bar.style.width = t.conf + '%';
    setEl('abx-deesc-target', t.deescTarget); setEl('abx-prerequisite', t.prereq);
    var chipsRow = document.querySelector('#abx-section-recommendation .ds-primary-ev-chips');
    if (chipsRow) chipsRow.innerHTML = t.chip1 + t.chip2 + t.chip3 + chip4;
    var s1 = document.getElementById('abx-wn-deesc-state'); if(s1){s1.textContent=t.wn_deesc_state; s1.className=t.wn_deesc_cls;}
    var s2 = document.getElementById('abx-wn-esc-state');   if(s2){s2.textContent=t.wn_esc_state;   s2.className=t.wn_esc_cls;}
    var r1 = document.getElementById('abx-wn-deesc');       if(r1) r1.textContent=t.wn_deesc_reason;
    var r2 = document.getElementById('abx-wn-esc');         if(r2) r2.textContent=t.wn_esc_reason;
    var r3 = document.getElementById('abx-wn-continue');    if(r3) r3.textContent=t.wn_continue_reason;
    var ci = document.getElementById('abx-wn-culture-item');if(ci) ci.textContent=t.wn_culture_item;

  } else {
    // De-escalation (default for improving patient)
    t = ABX_REC.deescalate;
    var strong = abxCultureSensitive() || abxCultureNoGrowth();
    conf       = strong ? t.conf_strong        : t.conf_standard;
    confLabel  = strong ? t.confLabel_strong   : t.confLabel_standard;
    confDesc   = strong ? t.confDesc_strong    : t.confDesc_standard;
    chip3      = abxCulturePending() ? t.chip3_pending : (abxCultureSensitive() ? t.chip3_sensitive : t.chip3_no_growth);
    chip4      = abxGfrImpaired()    ? t.chip4_renal   : t.chip4_standard;
    prereq     = (abxCultureSensitive() || abxCultureNoGrowth()) ? t.prereq_confirmed : t.prereq_pending;
    var wn_culture = abxCulturePending() ? t.wn_culture_item_pending : (abxCultureSensitive() ? t.wn_culture_item_sensitive : t.wn_culture_item_no_growth);

    // Build rationale inline (uses live values)
    var rationale = 'Patient is clinically improving with '
      + (!abxFeverActive() ? 'defervescence, ' : '')
      + 'tolerating oral intake, and mobilising. '
      + (abxCrpHigh() ? 'Inflammatory markers remain elevated but are on a downward trend — biochemical lag behind clinical response is expected and should not delay step-down in an improving patient. ' : 'Inflammatory markers are settling. ')
      + (abxCultureNoGrowth() ? 'Seventy-two hour blood cultures show no growth, removing the microbiological argument for continued broad-spectrum IV cover. ' : abxCultureSensitive() ? 'Culture has identified a sensitive organism amenable to narrow-spectrum oral therapy. ' : 'Oral step-down to amoxicillin-clavulanate should be considered once culture data is available. ')
      + (abxGfrImpaired() ? 'Dose adjustment for renal impairment is maintained throughout.' : '');

    setEl('abx-rec-action', t.action); setText('abx-rec-state', strong ? 'Strongly supported' : 'Clinically supported');
    setText('abx-rec-rationale', rationale);
    setText('abx-conf-pct', conf + '%'); setText('abx-conf-label', confLabel);
    setText('abx-conf-desc', confDesc);
    var bar = document.getElementById('abx-conf-bar'); if (bar) bar.style.width = conf + '%';
    setEl('abx-deesc-target', t.deescTarget); setEl('abx-prerequisite', prereq);
    var chipsRow = document.querySelector('#abx-section-recommendation .ds-primary-ev-chips');
    if (chipsRow) chipsRow.innerHTML = t.chip1 + t.chip2 + chip3 + chip4;
    var s1 = document.getElementById('abx-wn-deesc-state'); if(s1){s1.textContent=t.wn_deesc_state; s1.className=t.wn_deesc_cls;}
    var s2 = document.getElementById('abx-wn-esc-state');   if(s2){s2.textContent=t.wn_esc_state;   s2.className=t.wn_esc_cls;}
    var r1 = document.getElementById('abx-wn-deesc');       if(r1) r1.textContent=t.wn_deesc_reason;
    var r2 = document.getElementById('abx-wn-esc');         if(r2) r2.textContent=t.wn_esc_reason;
    var r3 = document.getElementById('abx-wn-continue');    if(r3) r3.textContent=t.wn_continue_reason;
    var ci = document.getElementById('abx-wn-culture-item');if(ci) ci.textContent=wn_culture;
  }
}

/* ── 5. Monitoring ───────────────────────────────────────────────────────── */
function abxUpdateMonitoring() {
  var rdEl   = document.getElementById('abx-rd-piptz');
  var rdNote = document.getElementById('abx-rd-piptz-note');
  if (rdEl) {
    var dKey = abxGfrSevere() ? 'severe' : abxGfrImpaired() ? 'impaired' : 'normal';
    var d = ABX_RENAL_DOSING[dKey];
    rdEl.textContent  = d.label;
    rdEl.className    = 'renal-dosing-val' + (dKey !== 'normal' ? ' renal-dosing-val-amber' : '');
    if (rdNote) rdNote.textContent = d.note;
  }

  var flag1 = document.getElementById('abx-flag-1');
  if (flag1) {
    if (abxCultureResistant())  flag1.innerHTML = '<span class="mn-contra-x">\u26a0</span> Resistant organism confirmed — broad-spectrum IV must be maintained. Consult microbiology urgently.';
    else if (abxCultureNoGrowth()) flag1.innerHTML = '<span class="mn-contra-x">\u2139</span> Culture negative at 72hr — supports de-escalation if clinical criteria met.';
    else if (abxCultureSensitive()) flag1.innerHTML = '<span class="mn-contra-x">\u2139</span> Sensitive organism — narrow-spectrum oral step-down is microbiologically supported.';
    else flag1.innerHTML = '<span class="mn-contra-x">\u26a0</span> Culture-negative at 72hr — reassess empirical spectrum. Consider narrowing if clinical picture supports.';
  }

  var flagR = document.getElementById('abx-flag-renal');
  if (flagR) {
    if (abxGfrSevere())   flagR.innerHTML = '<span class="mn-contra-x">\u26a0</span> Severe renal impairment (eGFR ' + ABX.gfr + ') — urgent dose review required. Avoid all nephrotoxic agents.';
    else if (abxGfrImpaired()) flagR.innerHTML = '<span class="mn-contra-x">\u26a0</span> eGFR ' + ABX.gfr + ' — monitor for acute kidney injury during course. Stop all nephrotoxic agents if eGFR falls >20%.';
    else flagR.innerHTML = '<span class="mn-contra-x">\u2139</span> Renal function normal (eGFR ' + ABX.gfr + '). Continue standard monitoring throughout antimicrobial course.';
  }
}
