/* ════════════════════════════════════════════════════════════
   poly.js — Polypharmacy Review workflow: state, helpers,
             reasoning engine, UI updates, monitoring
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   POLYPHARMACY REVIEW — STATE
════════════════════════════════════════════════════════════ */

var POLY = {
  meds:         null,
  highrisk:     null,
  interactions: null,
  duplicate:    null,
  ach:          null,
  falls:        null
};

var _polyActivePopover = null;

/* ════════════════════════════════════════════════════════════
   POLY — NAVIGATION
════════════════════════════════════════════════════════════ */

function polyShowSection(id, btn) {
  document.querySelectorAll('#poly-page .dp-section').forEach(function(s) { s.classList.remove('active'); });
  var t = document.getElementById(id); if (t) t.classList.add('active');
  document.querySelectorAll('#poly-page .dp-nav-item').forEach(function(n) { n.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════════════
   POLY — POPOVERS
════════════════════════════════════════════════════════════ */

function polyOpenPopover(key, e) {
  if (e) e.stopPropagation();
  polyClosePopover(_polyActivePopover);
  var pop  = document.getElementById('poly-pop-' + key);
  var card = document.getElementById('poly-p-' + key);
  if (!pop || !card) return;
  // Sync controls to current state
  var syncMap = { meds:'rng', highrisk:'rng', interactions:'rng', ach:'rng' };
  if (syncMap[key] === 'rng') {
    var r = document.getElementById('poly-rng-' + key);
    var v = document.getElementById('poly-rng-' + key + '-val');
    if (r && POLY[key] !== null) { r.value = POLY[key]; if (v) v.textContent = POLY[key]; }
  }
  if (key === 'duplicate') { var s = document.getElementById('poly-sel-duplicate'); if (s) s.value = POLY.duplicate; }
  if (key === 'falls')     { var s = document.getElementById('poly-sel-falls');     if (s) s.value = POLY.falls; }
  pop.style.display = 'block';
  pop.style.top  = (card.offsetTop + card.offsetHeight + 4) + 'px';
  pop.style.left = card.offsetLeft + 'px';
  _polyActivePopover = key;
}

function polyClosePopover(key) {
  if (!key) return;
  var pop = document.getElementById('poly-pop-' + key);
  if (pop) pop.style.display = 'none';
  if (_polyActivePopover === key) _polyActivePopover = null;
}
/* ════════════════════════════════════════════════════════════
   POLY — APPLY PARAM
════════════════════════════════════════════════════════════ */

function polyApplyParam(key) {
  var rngKeys = ['meds','highrisk','interactions','ach'];
  if (rngKeys.indexOf(key) !== -1) {
    var r = document.getElementById('poly-rng-' + key);
    if (r) POLY[key] = parseInt(r.value, 10);
  }
  if (key === 'duplicate') { var s = document.getElementById('poly-sel-duplicate'); if (s) POLY.duplicate = s.value; }
  if (key === 'falls')     { var s = document.getElementById('poly-sel-falls');     if (s) POLY.falls     = s.value; }
  polyClosePopover(key);
  polyRunReasoningEngine();
}

/* ════════════════════════════════════════════════════════════
   POLY — HELPERS
════════════════════════════════════════════════════════════ */

function polyHyperPoly()      { return POLY.meds >= 10; }
function polyHighAch()        { return POLY.ach >= 3; }
function polyVeryHighAch()    { return POLY.ach >= 6; }
function polyFallsHigh()      { return POLY.falls === 'high'; }
function polyFallsModerate()  { return POLY.falls === 'moderate'; }
function polyHasDuplicate()   { return POLY.duplicate === 'yes'; }
function polySigInteractions(){ return POLY.interactions >= 3; }
function polyHighRisk()       { return POLY.highrisk >= 3; }

/* ════════════════════════════════════════════════════════════
   POLY — REASONING ENGINE
════════════════════════════════════════════════════════════ */

function polyIsReady() {
  return POLY.meds !== null;
}

function polyRunReasoningEngine() {
  if (POLY.meds === null) { return; }
  polyUpdateParamCards();
  polyUpdateClinicalStatusSummary();
  polyUpdateClinicalImpression();
  polyUpdateRecommendation();
  polyUpdateMonitoring();
}


/* ── 1. Param cards ───────────────────────────────────────────────────────── */
function polyUpdateParamCards() {
  function setVal(id, v)   { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/abx-val-\w+/g,'').trim();
    if (cls) e.classList.add(cls);
  }
  var medsKey = POLY.meds >= 10 ? 'hyper' : POLY.meds >= 5 ? 'poly' : 'low';
  setVal('poly-val-meds', POLY.meds); setVal('poly-status-meds', POLY_MEDS_LABELS[medsKey]); setCls('poly-val-meds', POLY_MEDS_CLS[medsKey]);
  var hrSub = POLY.highrisk >= 4 ? polyFill(POLY_HIGHRISK_SUBS.very_high, { n: POLY.highrisk }) : POLY.highrisk >= 2 ? POLY_HIGHRISK_SUBS.standard : POLY.highrisk === 1 ? POLY_HIGHRISK_SUBS.one : POLY_HIGHRISK_SUBS.none;
  var hrCls = POLY.highrisk >= 3 ? 'abx-val-red' : POLY.highrisk >= 1 ? 'abx-val-amber' : 'abx-val-green';
  setVal('poly-val-highrisk', POLY.highrisk); setVal('poly-status-highrisk', hrSub); setCls('poly-val-highrisk', hrCls);
  var intSig = POLY.interactions >= 4 ? '2 clinically significant' : POLY.interactions >= 2 ? '1 clinically significant' : 'No significant interactions';
  var intCls = POLY.interactions >= 4 ? 'abx-val-red' : POLY.interactions >= 2 ? 'abx-val-amber' : 'abx-val-green';
  setVal('poly-val-interactions', POLY.interactions); setVal('poly-status-interactions', intSig); setCls('poly-val-interactions', intCls);
  setVal('poly-val-duplicate', POLY.duplicate !== null ? (POLY_DUPLICATE_LABELS[POLY.duplicate] || '') : ''); setVal('poly-status-duplicate', POLY.duplicate !== null ? (POLY_DUPLICATE_SUBS[POLY.duplicate] || '') : ''); setCls('poly-val-duplicate', POLY.duplicate !== null ? (POLY_DUPLICATE_CLS[POLY.duplicate] || '') : '');
  var achKey = POLY.ach >= 6 ? 'very_high' : POLY.ach >= 3 ? 'high' : POLY.ach >= 1 ? 'mild' : 'minimal';
  var achCls = POLY.ach >= 6 ? 'abx-val-red' : POLY.ach >= 3 ? 'abx-val-amber' : '';
  setVal('poly-val-ach', POLY.ach); setVal('poly-status-ach', POLY_ACH_LABELS[achKey]); setCls('poly-val-ach', achCls);
  setVal('poly-val-falls', POLY.falls !== null ? (POLY_FALLS_DISPLAY[POLY.falls] || '') : ''); setVal('poly-status-falls', POLY.falls !== null ? (POLY_FALLS_LABELS[POLY.falls] || '') : ''); setCls('poly-val-falls', POLY.falls !== null ? (POLY_FALLS_CLS[POLY.falls] || '') : '');
}

/* ── 2. Clinical Status Summary ──────────────────────────────────────────── */
function polyUpdateClinicalStatusSummary() {
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/css-val-\w+/g,'').trim();
    if (cls) e.classList.add(cls);
  }
  var burdenKey = polyHyperPoly() ? 'hyper' : POLY.meds >= 5 ? 'poly' : 'low';
  var b = POLY_CSS_BURDEN[burdenKey];
  setVal('poly-m-burden', b.val); setVal('poly-m-burden-sub', POLY.meds + ' medications' + b.sub_suffix); setCls('poly-m-burden', b.cls);
  var achKey = polyVeryHighAch() ? 'very_high' : polyHighAch() ? 'high' : 'low';
  var a = POLY_CSS_ACH[achKey];
  setVal('poly-m-ach', a.val_prefix + POLY.ach + ')'); setVal('poly-m-ach-sub', a.sub); setCls('poly-m-ach', a.cls);
  var fallsData = POLY.falls !== null ? (POLY_CSS_FALLS[POLY.falls] || POLY_CSS_FALLS.low) : POLY_CSS_FALLS.low;
  setVal('poly-m-falls', fallsData.val); setVal('poly-m-falls-sub', fallsData.sub); setCls('poly-m-falls', fallsData.cls);
  var intKey = POLY.interactions >= 4 ? 'high' : POLY.interactions >= 2 ? 'moderate' : 'low';
  var inter = POLY_CSS_INTERACTIONS[intKey];
  setVal('poly-m-interactions', inter.val); setVal('poly-m-interactions-sub', POLY.interactions + ' interactions' + inter.sub_suffix); setCls('poly-m-interactions', inter.cls);
  var parts = [];
  parts.push('Patient carries a ' + (polyHyperPoly() ? 'high' : 'significant') + ' medication burden with ' + POLY.meds + ' concurrent agents' + (polyHighRisk() ? ' including ' + POLY.highrisk + ' high-risk medications' : '') + '.');
  if (polyHighAch()) parts.push('Anticholinergic burden is ' + (polyVeryHighAch() ? 'very high' : 'high') + ' (ACB ' + POLY.ach + ') and represents a significant risk for cognitive impairment and falls in this patient.');
  if (polyFallsHigh()) parts.push('Medication-related falls risk is elevated with multiple fall-risk-increasing drugs present concurrently.');
  if (polySigInteractions()) parts.push('Multiple clinically significant drug interactions require active management.');
  parts.push('Structured deprescribing review is indicated.');
  var el = document.getElementById('poly-overall-text'); if (el) el.textContent = parts.join(' ');
  var badge = document.getElementById('poly-css-badge');
  var lbl   = document.getElementById('poly-css-badge-label');
  if (badge && lbl) {
    badge.className = 'css-overall-badge';
    var badgeKey = (polyHyperPoly() || polyFallsHigh() || polyVeryHighAch()) ? 'high' : (POLY.meds >= 5 || polyHighAch()) ? 'elevated' : 'low';
    var bd = POLY_CSS_BADGE[badgeKey];
    if (bd.cls) badge.classList.add(bd.cls);
    lbl.textContent = bd.label;
  }
}

/* ── 3. Clinical Impression ──────────────────────────────────────────────── */
function polyUpdateClinicalImpression() {
  var v = { meds: POLY.meds, ach: POLY.ach, interactions: POLY.interactions };
  var lines = [];
  var burdenKey = polyHyperPoly() ? 'hyper' : POLY.meds >= 5 ? 'poly' : 'low';
  var bt = POLY_CI.burden[burdenKey];
  lines.push({ tone: bt.tone, text: polyFill(bt.text, v) });
  if (polyVeryHighAch())  lines.push({ tone: POLY_CI.ach.very_high.tone, text: polyFill(POLY_CI.ach.very_high.text, v) });
  else if (polyHighAch()) lines.push({ tone: POLY_CI.ach.high.tone,      text: polyFill(POLY_CI.ach.high.text, v) });
  if (polyFallsHigh())        lines.push({ tone: POLY_CI.falls.high.tone,     text: POLY_CI.falls.high.text });
  else if (polyFallsModerate()) lines.push({ tone: POLY_CI.falls.moderate.tone, text: POLY_CI.falls.moderate.text });
  if (POLY.interactions >= 4)      lines.push({ tone: POLY_CI.interactions.many.tone, text: polyFill(POLY_CI.interactions.many.text, v) });
  else if (POLY.interactions >= 2) lines.push({ tone: POLY_CI.interactions.some.tone, text: polyFill(POLY_CI.interactions.some.text, v) });
  if (polyHasDuplicate()) lines.push({ tone: POLY_CI.duplicate.tone, text: POLY_CI.duplicate.text });
  var conclusionKey = (polyHyperPoly() && polyFallsHigh() && polyHighAch()) ? 'urgent'
    : (polyHyperPoly() || polyFallsHigh()) ? 'high'
    : (polyHighAch() || polySigInteractions()) ? 'targeted' : 'routine';
  var parasEl = document.getElementById('poly-ci-paragraphs');
  if (parasEl) parasEl.innerHTML = lines.map(function(l) { return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>'; }).join('');
  var concEl = document.getElementById('poly-ci-conclusion-text');
  if (concEl) concEl.textContent = POLY_CI.conclusions[conclusionKey];
}

/* ── 4. Recommendation ───────────────────────────────────────────────────── */
function polyUpdateRecommendation() {
  function setText(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setHTML(id, v) { var e = document.getElementById(id); if (e) e.innerHTML = v; }
  var t, action, state, rationale, conf, confLabel, confDesc, chips;
  if (polyHyperPoly() && polyFallsHigh() && polyHighAch()) {
    t = POLY_REC.urgent; action = t.action; state = t.state; conf = t.conf; confLabel = t.confLabel; confDesc = t.confDesc;
    rationale = polyFill(POLY_REC_URGENT_RATIONALE, { ach: POLY.ach, highrisk: POLY.highrisk, duplicate_text: polyHasDuplicate() ? 'duplicate antihypertensive therapy' : 'complex drug interactions' });
    chips = t.chip_stopp + t.chip_beers + (polySigInteractions() ? t.chip_serotonin : '') + (polyHighAch() ? t.chip_ach : '') + (polyFallsHigh() ? t.chip_falls : '') + (polyHasDuplicate() ? t.chip_duplicate : '');
  } else if (polyFallsHigh() || polySigInteractions()) {
    t = POLY_REC.prompt; action = t.action; state = t.state; conf = t.conf; confLabel = t.confLabel; confDesc = t.confDesc;
    rationale = polyFill(t.rationale, { falls_text: polyFallsHigh() ? 'elevated falls risk from multiple FRIDs ' : '', interactions_text: polySigInteractions() ? 'and clinically significant drug interactions ' : '' });
    chips = POLY_REC.urgent.chip_stopp + POLY_REC.urgent.chip_beers + (polySigInteractions() ? POLY_REC.urgent.chip_serotonin : '') + (polyFallsHigh() ? POLY_REC.urgent.chip_falls : '');
  } else if (polyHighAch() || polyHasDuplicate()) {
    t = POLY_REC.targeted; action = t.action; state = t.state; conf = t.conf; confLabel = t.confLabel; confDesc = t.confDesc;
    rationale = polyFill(t.rationale, { ach_text: polyHighAch() ? 'Anticholinergic burden (ACB ' + POLY.ach + ') is above the threshold for harm in older adults. ' : '', duplicate_text: polyHasDuplicate() ? 'Duplicate therapeutic class prescribing should be reviewed and confirmed as intentional. ' : '' });
    chips = POLY_REC.urgent.chip_stopp + POLY_REC.urgent.chip_beers + (polyHighAch() ? POLY_REC.urgent.chip_ach : '') + (polyHasDuplicate() ? POLY_REC.urgent.chip_duplicate : '');
  } else {
    t = POLY_REC.routine; action = t.action; state = t.state; conf = t.conf; confLabel = t.confLabel; confDesc = t.confDesc; rationale = t.rationale;
    chips = POLY_REC.urgent.chip_stopp + POLY_REC.urgent.chip_beers;
  }
  setHTML('poly-rec-action', action); setText('poly-rec-state', state); setText('poly-rec-rationale', rationale);
  setText('poly-conf-pct', conf + '%'); setText('poly-conf-label', confLabel); setText('poly-conf-desc', confDesc);
  var bar = document.getElementById('poly-conf-bar'); if (bar) bar.style.width = conf + '%';
  var chipsEl = document.getElementById('poly-chips'); if (chipsEl) chipsEl.innerHTML = chips;
  var targets = (polyFallsHigh() || polyHighAch()) ? 3 : (polyFallsModerate() || POLY.interactions >= 2) ? 2 : 1;
  if (polyHasDuplicate()) targets += 1;
  var tEl = document.getElementById('poly-mon-targets'); if (tEl) tEl.textContent = targets;
}

/* ── 5. Monitoring ───────────────────────────────────────────────────────── */
function polyUpdateMonitoring() {
  // Static schedule — no dynamic content required
}
