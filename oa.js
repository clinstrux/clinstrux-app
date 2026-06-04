/* ════════════════════════════════════════════════════════════
   oa.js — Osteoarthritis workflow: state, helpers, reasoning,
           UI updates, longitudinal engine, clinical assessment
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   CLINSTRUX PATIENT PARAMETER ENGINE v1.0
   All reasoning logic is client-side and parameter-driven.
   No chatbot. No AI summary. Pure clinical rule engine.
══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   SECTION 1 — PATIENT STATE
════════════════════════════════════════════════════════════ */

var P = {
  egfr:   58,
  gi:     'ulcer',          // none | dyspepsia | ulcer | ulcer-recent | bleed
  bp:     128,
  cv:     'mod',            // low | mod | high | very-high
  pain:   6,
  age:    68,
  failed: '2nsaid',         // none | physio | apap | 1nsaid | 2nsaid | multi
  adh:    'partial',        // good | partial | poor | unknown
  sed:    'high',           // none | mod | high | fall
  intol:  'both-nsaid'      // none | gi-nsaid | bp-nsaid | both-nsaid | apap | multi
};


/* ════════════════════════════════════════════════════════════
   SECTION 2 — NAVIGATION & UI TABS
════════════════════════════════════════════════════════════ */

function showSection(id, btn) {
  var page = document.getElementById('workflow-page');
  if (!page) return;
  page.querySelectorAll('.dp-section').forEach(function(s) { s.classList.remove('active'); });
  page.querySelectorAll('.dp-nav-item').forEach(function(b) { b.classList.remove('active'); });
  var target = document.getElementById('section-' + id);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showNoteTab(id, btn) {
  document.querySelectorAll('.cn-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.cn-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('cn-panel-' + id).classList.add('active');
  btn.classList.add('active');
}

function setEvFilter(btn) {
  document.querySelectorAll('.ev-filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
}


/* ════════════════════════════════════════════════════════════
   SECTION 3 — POPOVER SYSTEM
════════════════════════════════════════════════════════════ */

var _activePopover = null;

// Maps each param key to its DOM input id and type
var POPOVER_INPUTS = {
  egfr:  { id: 'rng-egfr',    type: 'range', valId: 'rng-egfr-val' },
  bp:    { id: 'rng-bp',      type: 'range', valId: 'rng-bp-val'   },
  pain:  { id: 'rng-pain',    type: 'range', valId: 'rng-pain-val' },
  age:   { id: 'rng-age',     type: 'range', valId: 'rng-age-val'  },
  gi:    { id: 'sel-gi',      type: 'select' },
  cv:    { id: 'sel-cv',      type: 'select' },
  failed:{ id: 'sel-failed',  type: 'select' },
  adh:   { id: 'sel-adh',     type: 'select' },
  sed:   { id: 'sel-sed',     type: 'select' },
  intol: { id: 'sel-intol',   type: 'select' }
};

function openPopover(key, evt) {
  evt.stopPropagation();
  if (_activePopover) closePopover(_activePopover);

  // Sync current P value into the popover input
  var cfg = POPOVER_INPUTS[key];
  if (cfg) {
    var el = document.getElementById(cfg.id);
    if (el) {
      el.value = P[key];
      if (cfg.type === 'range' && cfg.valId) {
        document.getElementById(cfg.valId).textContent = P[key];
      }
    }
  }

  var pop = document.getElementById('pop-' + key);
  var trigger = evt.currentTarget;
  var rect = trigger.getBoundingClientRect();

  pop.style.display = 'block';
  pop.classList.add('open');

  var top = rect.bottom + 6;
  var left = rect.left;
  if (left + 240 > window.innerWidth - 10) left = window.innerWidth - 250;
  if (top + 200 > window.innerHeight) top = rect.top - 200 - 6;
  pop.style.top  = top  + 'px';
  pop.style.left = left + 'px';

  _activePopover = key;
}

function closePopover(key) {
  var pop = document.getElementById('pop-' + key);
  if (pop) { pop.classList.remove('open'); pop.style.display = 'none'; }
  _activePopover = null;
}

function applyParam(key) {
  var cfg = POPOVER_INPUTS[key];
  if (!cfg) return;
  var el = document.getElementById(cfg.id);
  if (!el) return;
  P[key] = cfg.type === 'range' ? parseInt(el.value) : el.value;
  closePopover(key);
  runReasoningEngine();
  updateHandoffMeta();
  updatePolypharmacyPanel();
}

function dismissUpdateBanner() {
  document.getElementById('ip-update-banner').classList.remove('visible');
}


/* ════════════════════════════════════════════════════════════
   SECTION 4 — SCORING & RISK HELPERS
════════════════════════════════════════════════════════════ */

function egfrRisk() {
  if (P.egfr >= 60) return 'low';
  if (P.egfr >= 45) return 'mild';
  if (P.egfr >= 30) return 'moderate';
  return 'severe';
}

function giRisk() {
  var m = { none: 'low', dyspepsia: 'low', ulcer: 'high', 'ulcer-recent': 'very-high', bleed: 'very-high' };
  return m[P.gi] || 'high';
}

function bpControl() {
  if (P.bp < 130) return 'controlled';
  if (P.bp < 150) return 'mildly-elevated';
  if (P.bp < 170) return 'elevated';
  return 'uncontrolled';
}

function ageFlag()             { return P.age >= 65; }
function apapContraindicated() { return P.intol === 'apap' || P.intol === 'multi'; }
function multimodalFailure()   { return P.failed === 'multi'; }
function acetaminophenFailed() { return P.failed === 'apap' || P.failed === 'multi'; }

function nsaidContraindicated() {
  return giRisk() === 'very-high' ||
    giRisk() === 'high' ||
    egfrRisk() === 'severe' ||
    (egfrRisk() === 'moderate' && P.intol !== 'none') ||
    bpControl() === 'uncontrolled' ||
    P.intol === 'both-nsaid' || P.intol === 'gi-nsaid' || P.intol === 'bp-nsaid' || P.intol === 'multi';
}

function opioidAvoidable() {
  return P.sed === 'high' || P.sed === 'fall' || (ageFlag() && P.sed !== 'none');
}

function computeComplexity() {
  var score = 0;
  if      (P.egfr < 30) score += 20;
  else if (P.egfr < 45) score += 15;
  else if (P.egfr < 60) score += 8;

  if      (P.gi === 'bleed')        score += 20;
  else if (P.gi === 'ulcer-recent') score += 18;
  else if (P.gi === 'ulcer')        score += 12;
  else if (P.gi === 'dyspepsia')    score += 5;

  if      (P.bp >= 170) score += 15;
  else if (P.bp >= 150) score += 10;
  else if (P.bp >= 130) score += 5;

  if      (P.cv === 'very-high') score += 12;
  else if (P.cv === 'high')      score += 8;
  else if (P.cv === 'mod')       score += 4;

  if      (P.pain >= 9) score += 8;
  else if (P.pain >= 7) score += 5;

  if      (P.age >= 80) score += 8;
  else if (P.age >= 65) score += 5;

  if      (P.failed === 'multi') score += 10;
  else if (P.failed === 'apap')  score += 8;
  else if (P.failed === '2nsaid')score += 5;

  if (P.adh === 'poor') score += 5;

  if      (P.sed === 'fall') score += 5;
  else if (P.sed === 'high') score += 3;

  return Math.min(score, 100);
}


/* ════════════════════════════════════════════════════════════
   SECTION 5 — LABEL & CSS-CLASS HELPERS
════════════════════════════════════════════════════════════ */

// -- Label maps moved to data/oa-content.js --

// -- Label functions --
function egfrLabel() {
  var r = egfrRisk();
  if (r === 'low') return 'Normal / mild';
  if (r === 'mild') return 'Mild impairment';
  if (r === 'moderate') return 'Moderate CKD';
  return 'Severe — high risk';
}

function giLabel()       { return GI_LABELS[P.gi]; }
function giRiskLabel()   { return GI_RISK_LABELS[P.gi]; }
function bpLabel()       { return P.bp + ' mmHg systolic'; }
function bpRiskLabel() {
  var c = bpControl();
  if (c === 'controlled')      return 'Controlled';
  if (c === 'mildly-elevated') return 'Mildly elevated';
  if (c === 'elevated')        return 'Elevated — monitor';
  return 'Uncontrolled — flag';
}
function cvLabel()       { return CV_LABELS[P.cv]; }
function cvRiskLabel()   { return CV_RISK_LABELS[P.cv]; }
function painLabel()     { return P.pain + ' / 10'; }
function painRiskLabel() {
  if (P.pain <= 3) return 'Mild';
  if (P.pain <= 6) return 'Moderate';
  if (P.pain <= 8) return 'Severe';
  return 'Very severe';
}
function ageLabel()      { return P.age + ' years'; }
function ageRiskLabel()  { return ageFlag() ? '≥65 flag active' : 'No age flag'; }
function failedLabel()   { return FAILED_LABELS[P.failed]; }
function failedRiskLabel(){ return FAILED_RISK_LABELS[P.failed]; }
function adhLabel()      { return ADH_LABELS[P.adh]; }
function adhRiskLabel()  { return ADH_RISK_LABELS[P.adh]; }
function sedLabel()      { return SED_LABELS[P.sed]; }
function sedRiskLabel()  { return SED_RISK_LABELS[P.sed]; }
function intolLabel()    { return INTOL_LABELS[P.intol]; }
function intolRiskLabel(){ return INTOL_RISK_LABELS[P.intol]; }

// -- CSS class helpers --
function egfrClass()      { var r = egfrRisk(); return r==='low'?'ip-val-ok': r==='mild'?'ip-val-warning':'ip-val-danger'; }
function giClass()        { return giRisk()==='low' ? 'ip-val-ok' : 'ip-val-danger'; }
function bpClass()        { var c = bpControl(); return c==='controlled'?'ip-val-ok': c==='uncontrolled'?'ip-val-danger':'ip-val-warning'; }
function egfrParamClass() { var r = egfrRisk(); return r==='low'?'': r==='mild'?'ip-warning':'ip-danger'; }
function giParamClass()   { return giRisk()==='low' ? '' : 'ip-danger'; }
function bpParamClass()   { var c = bpControl(); return c==='controlled'?'': c==='uncontrolled'?'ip-danger':'ip-warning'; }
function egfrRiskClass()  { var r = egfrRisk(); return r==='low'?'r-low':'r-mod'; }
function giRiskClass()    { var r = giRisk(); return r==='low'?'r-low': r==='high'||r==='very-high'?'r-high':'r-mod'; }
function bpRiskClass()    { var c = bpControl(); return c==='controlled'?'r-low': c==='uncontrolled'?'r-high':'r-mod'; }


/* ════════════════════════════════════════════════════════════
   SECTION 6 — REASONING BUILDERS
   (buildPrimaryRec, buildNsaidReasoning, buildOpioidReasoning,
    buildFollowupUrgency)
════════════════════════════════════════════════════════════ */

function buildPrimaryRec() {
  var drug, state, rationale, confPct, confLabel, confDesc;
  var t; // content template reference

  if (apapContraindicated()) {
    if (!nsaidContraindicated() && P.cv !== 'very-high') {
      t = OA_REC.apap_intol_nsaid;
      drug = t.drug; state = t.state; confPct = t.confPct;
      confLabel = t.confLabel; confDesc = t.confDesc; rationale = t.rationale;
    } else {
      t = OA_REC.specialist;
      drug = t.drug; state = t.state; confPct = t.confPct;
      confLabel = t.confLabel; confDesc = t.confDesc; rationale = t.rationale;
    }
  } else if (nsaidContraindicated()) {
    t = OA_REC.apap_nsaid_contraind;
    drug = t.drug; state = t.state; confPct = t.confPct;
    confLabel = t.confLabel; confDesc = t.confDesc;
    var r = t.rationale_base;
    if (giRisk() === 'very-high') r += t.rationale_gi_very_high;
    else if (giRisk() === 'high') r += t.rationale_gi_high;
    if (P.egfr < 45) r += oaFill(t.rationale_renal_severe, { egfr: P.egfr });
    else if (P.egfr < 60) r += oaFill(t.rationale_renal_mild, { egfr: P.egfr });
    if (ageFlag()) r += oaFill(t.rationale_age, { age: P.age });
    if (bpControl() === 'uncontrolled') r += oaFill(t.rationale_bp, { bp: P.bp });
    if (P.intol === 'both-nsaid') r += t.rationale_intol;
    rationale = r;
  } else if (P.pain >= 8 && P.failed !== 'none' && P.failed !== 'physio') {
    t = OA_REC.apap_nsaid_combo;
    drug = t.drug; state = t.state; confPct = t.confPct;
    confLabel = t.confLabel; confDesc = t.confDesc;
    rationale = oaFill(t.rationale, { pain: P.pain });
  } else {
    t = OA_REC.apap_standard;
    drug = t.drug; state = t.state; confPct = t.confPct;
    confLabel = t.confLabel; confDesc = t.confDesc;
    rationale = oaFill(t.rationale, { pain: P.pain });
  }

  // Complexity and adherence confidence adjustments
  var complexity = computeComplexity();
  if (complexity > 75) confPct = Math.max(confPct - 10, 35);
  if (P.adh === 'poor') confPct = Math.max(confPct - 5, 35);

  var confBand = '';
  var uncertaintyQualifier = '';

  if (P.adh === 'partial' || P.adh === 'unknown') {
    confPct = Math.max(confPct - 5, 35);
    confBand = ' ±6%';
    uncertaintyQualifier = 'Adherence history unverified — outcome confidence is reduced until fixed-schedule use is confirmed at Week 2.';
  }
  if (P.adh === 'poor') {
    confBand = ' ±8%';
    uncertaintyQualifier = 'Poor and unverified adherence significantly limits treatment response predictability. Efficacy assessment requires confirmed adherence.';
  }
  if (P.egfr >= 50 && P.egfr <= 62) {
    confPct = Math.max(confPct - 4, 35);
    if (!confBand) confBand = ' ±5%';
    if (!uncertaintyQualifier) uncertaintyQualifier = 'Borderline eGFR (G2/G3a) without trend data — renal trajectory direction is unconfirmed. Escalation window may narrow if declining.';
    else uncertaintyQualifier += ' Renal trajectory also unconfirmed at this stage.';
  }

  return { drug, state, rationale, confPct, confLabel, confDesc, confBand, uncertaintyQualifier };
}


function buildNsaidReasoning() {
  var reasons = [];
  var state, reason;
  var c = OA_NSAID;

  if (nsaidContraindicated()) {
    if (giRisk() === 'very-high') {
      state  = c.contraind.state;
      reason = c.contraind.reason_very_high_gi;
      reasons.push({ id: 'dyn-nsaid-gi', text: P.gi === 'bleed' ? c.contraind.gi_bleed : c.contraind.gi_ulcer_recent });
    } else if (giRisk() === 'high') {
      state  = c.contraind.state;
      reason = c.contraind.reason_high_gi;
      var intolDetail = (P.intol === 'both-nsaid' || P.intol === 'gi-nsaid') ? 'ibuprofen, diclofenac both failed' : 'intolerance documented';
      reasons.push({ id: 'dyn-nsaid-gi', text: oaFill(c.contraind.gi_high_intol, { intol_detail: intolDetail }) });
    } else {
      state  = c.contraind.state;
      reason = c.contraind.reason_default;
      reasons.push({ id: 'dyn-nsaid-gi', text: c.contraind.gi_present });
    }

    if (bpControl() === 'uncontrolled') {
      reasons.push({ id: 'dyn-nsaid-bp', text: oaFill(c.contraind.bp_uncontrolled, { bp: P.bp }) });
    } else if (P.intol === 'bp-nsaid' || P.intol === 'both-nsaid') {
      reasons.push({ id: 'dyn-nsaid-bp', text: c.contraind.bp_intol });
    } else {
      reasons.push({ id: 'dyn-nsaid-bp', text: c.contraind.bp_cv_monitor });
    }

    if (P.egfr < 30) {
      reasons.push({ id: 'dyn-nsaid-renal', text: oaFill(c.contraind.renal_severe, { egfr: P.egfr }) });
    } else if (P.egfr < 45) {
      reasons.push({ id: 'dyn-nsaid-renal', text: oaFill(c.contraind.renal_moderate, { egfr: P.egfr }) });
    } else {
      reasons.push({ id: 'dyn-nsaid-renal', text: oaFill(c.contraind.renal_mild, { egfr: P.egfr }) });
    }

    reasons.push({ id: 'dyn-nsaid-age', text: ageFlag()
      ? oaFill(c.contraind.age_beers,    { age: P.age })
      : oaFill(c.contraind.age_no_flag,  { age: P.age }) });
  } else {
    state  = c.conditional.state;
    reason = c.conditional.reason;
    reasons.push({ id: 'dyn-nsaid-gi',    text: oaFill(c.conditional.gi, { gi_label: giLabel().toLowerCase() }) });
    reasons.push({ id: 'dyn-nsaid-bp',    text: oaFill(c.conditional.bp, { bp_risk: bpRiskLabel(), bp: P.bp }) });
    reasons.push({ id: 'dyn-nsaid-renal', text: oaFill(c.conditional.renal, { egfr: P.egfr }) });
    reasons.push({ id: 'dyn-nsaid-age',   text: ageFlag()
      ? oaFill(c.conditional.age_flag,    { age: P.age })
      : oaFill(c.conditional.age_no_flag, { age: P.age }) });
  }

  return { state, reason, reasons };
}

function buildOpioidReasoning() {
  var avoidable  = opioidAvoidable();
  var multimodal = multimodalFailure();
  var c = OA_OPIOID;

  if (multimodal && !avoidable) {
    return { state: 'Escalation Option', reason: 'Multimodal pharmacotherapy failure noted — low-dose opioid may be considered with specialist oversight and careful fall-risk assessment.' };
  }

  var reason;
  if (P.sed === 'fall') {
    reason = c.avoid_falls.reason;
  } else if (P.sed === 'high') {
    reason = c.avoid_preference.reason;
  } else if (ageFlag() && P.sed !== 'none') {
    reason = 'Age ' + P.age + ' with sedation concern — opioid metabolite clearance and fall-risk profile make opioids an unfavorable choice.';
  } else {
    reason = c.not_indicated.reason;
  }

  return { state: avoidable ? c.avoid_falls.state : c.caution.state, reason };
}

function buildFollowupUrgency() {
  var complexity = computeComplexity();
  if (complexity >= 75) return { wk2: 'Week 1', wk4: 'Week 2–3', tone: 'Compress follow-up intervals — high complexity profile requires accelerated reassessment.' };
  if (P.pain >= 8)      return { wk2: 'Week 2', wk4: 'Week 3–4', tone: 'Severe pain warrants early reassessment checkpoint.' };
  return { wk2: 'Week 2', wk4: 'Week 4', tone: 'Standard follow-up intervals appropriate for this risk profile.' };
}


/* ════════════════════════════════════════════════════════════
   SECTION 7 — DOM UPDATE HELPERS
   (flashElement, setText, setInnerHTML on single element)
════════════════════════════════════════════════════════════ */

function flashElement(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('dynamic-updated'); void el.offsetWidth; el.classList.add('dynamic-updated'); }
}

function setEl(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElHtml(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setElClass(id, cls) {
  var el = document.getElementById(id);
  if (el) el.className = cls;
}


/* ════════════════════════════════════════════════════════════
   SECTION 8 — PARAM TILE UPDATES
════════════════════════════════════════════════════════════ */

function updateParamTiles() {
  function setTile(id, valText, riskText, valClass, riskClass, paramClass) {
    var el    = document.getElementById('ip-' + id);
    var valEl = document.getElementById('ip-val-' + id);
    var rskEl = document.getElementById('ip-risk-' + id);
    if (valEl) { valEl.textContent = valText; valEl.className = 'ip-param-value ' + valClass; }
    if (rskEl) { rskEl.textContent = riskText; rskEl.className = 'ip-param-risk ' + riskClass; }
    if (el)    el.className = 'ip-param ' + paramClass;
  }

  setTile('egfr', P.egfr + ' mL/min', egfrLabel(),
    egfrClass(),
    egfrRisk()==='low'?'r-low': egfrRisk()==='mild'?'r-mod':'r-high',
    egfrParamClass());

  setTile('gi', giLabel(), giRiskLabel(),
    P.gi==='none'?'ip-val-ok':'ip-val-danger',
    giRiskClass(),
    giParamClass());

  setTile('bp', P.bp + ' mmHg', bpRiskLabel(),
    bpClass(), bpRiskClass(), bpParamClass());

  setTile('cv', cvLabel(), cvRiskLabel(),
    P.cv==='low'?'ip-val-ok': P.cv==='mod'?'ip-val-warning':'ip-val-danger',
    P.cv==='low'?'r-low': P.cv==='mod'?'r-mod':'r-high',
    P.cv==='very-high'?'ip-danger': P.cv==='high'?'ip-warning':'');

  setTile('pain', P.pain + ' / 10', painRiskLabel(),
    P.pain<=4?'ip-val-ok': P.pain<=7?'ip-val-warning':'ip-val-danger',
    P.pain<=4?'r-low': P.pain<=7?'r-mod':'r-high',
    P.pain>=8?'ip-danger': P.pain>=6?'ip-warning':'');

  setTile('age', P.age + ' years', ageRiskLabel(),
    ageFlag()?'ip-val-warning':'ip-val-ok',
    ageFlag()?'r-mod':'r-low',
    ageFlag()?'ip-warning':'');

  setTile('failed', failedLabel(), failedRiskLabel(),
    P.failed==='none'||P.failed==='physio'?'ip-val-ok': P.failed==='multi'?'ip-val-danger':'ip-val-warning',
    P.failed==='none'||P.failed==='physio'?'r-low': P.failed==='multi'?'r-high':'r-mod',
    P.failed==='multi'?'ip-danger': P.failed==='apap'||P.failed==='2nsaid'?'ip-warning':'');

  setTile('adh', adhLabel(), adhRiskLabel(),
    P.adh==='good'?'ip-val-ok': P.adh==='poor'?'ip-val-danger':'ip-val-warning',
    P.adh==='good'?'r-low': P.adh==='poor'?'r-high':'r-mod',
    P.adh==='poor'?'ip-warning':'');

  setTile('sed', sedLabel(), sedRiskLabel(),
    P.sed==='none'?'ip-val-ok': P.sed==='fall'?'ip-val-danger':'ip-val-warning',
    P.sed==='none'?'r-low': P.sed==='fall'?'r-high':'r-mod',
    P.sed==='fall'?'ip-danger': P.sed==='high'?'ip-warning':'');

  setTile('intol', intolLabel(), intolRiskLabel(),
    P.intol==='none'?'ip-val-ok': P.intol==='multi'||P.intol==='apap'?'ip-val-danger':'ip-val-warning',
    P.intol==='none'?'r-low': P.intol==='multi'||P.intol==='apap'?'r-high':'r-mod',
    P.intol==='multi'||P.intol==='apap'?'ip-danger': P.intol!=='none'?'ip-warning':'');
}


/* ════════════════════════════════════════════════════════════
   SECTION 9 — COMPLEXITY BAR
════════════════════════════════════════════════════════════ */

function updateComplexityBar() {
  var score  = computeComplexity();
  var fill   = document.getElementById('ip-complexity-fill');
  var scoreEl = document.getElementById('ip-complexity-score');
  var descEl  = document.getElementById('ip-complexity-desc');

  if (fill)    fill.style.width = score + '%';
  if (scoreEl) scoreEl.textContent = score;

  var color, desc;
  if      (score >= 80) { color = 'var(--red)';   desc = '— Critical complexity. Multiple active absolute contraindications. Specialist input likely required.'; }
  else if (score >= 60) { color = 'var(--amber)';  desc = '— High-complexity multifactorial profile. Multiple active contraindications.'; }
  else if (score >= 35) { color = 'var(--blue)';   desc = '— Moderate complexity. Careful monitoring required. Standard escalation pathways available.'; }
  else                  { color = 'var(--green)';  desc = '— Lower complexity. Straightforward analgesic pathway available.'; }

  if (fill)    { fill.style.background = color; }
  if (scoreEl) { scoreEl.style.color = color; }
  if (descEl)  { descEl.textContent = desc; }
}


/* ════════════════════════════════════════════════════════════
   SECTION 10 — MONITORING CONTRAINDICATIONS
════════════════════════════════════════════════════════════ */

function updateContraindications() {
  var renalEl = document.getElementById('dyn-contra-renal');
  var bpEl    = document.getElementById('dyn-contra-bp');
  var sedEl   = document.getElementById('dyn-contra-sed');

  if (renalEl) {
    if (P.egfr < 30) {
      renalEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active warning:</strong> eGFR ' + P.egfr + ' — NSAIDs absolutely contraindicated. Acetaminophen dose reduction required. Nephrology referral threshold approaching.';
      renalEl.style.color = 'var(--red)'; renalEl.style.fontWeight = '600';
    } else if (P.egfr < 45) {
      renalEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Elevated risk:</strong> eGFR ' + P.egfr + ' (moderate CKD) — NSAIDs unsafe at this renal function. Monitor closely. Avoid escalation without nephrology input.';
      renalEl.style.color = 'var(--amber)'; renalEl.style.fontWeight = '600';
    } else {
      renalEl.innerHTML = '<span class="mn-contra-x">✕</span> eGFR &lt;30 — avoid NSAIDs entirely; acetaminophen dose reduction required. Current eGFR ' + P.egfr + ' — monitor trajectory.';
      renalEl.style.color = ''; renalEl.style.fontWeight = '';
    }
  }

  if (bpEl) {
    if (bpControl() === 'uncontrolled') {
      bpEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active flag:</strong> BP ' + P.bp + ' mmHg — NSAID initiation contraindicated. Review amlodipine dose. Do not escalate to NSAID until BP &lt;150 mmHg.';
      bpEl.style.color = 'var(--red)'; bpEl.style.fontWeight = '600';
    } else {
      bpEl.innerHTML = '<span class="mn-contra-x">✕</span> Uncontrolled hypertension (SBP &gt;160) — avoid NSAIDs until BP controlled. Current BP: ' + P.bp + ' mmHg (' + bpRiskLabel() + ')';
      bpEl.style.color = bpControl() === 'elevated' ? 'var(--amber)' : '';
      bpEl.style.fontWeight = bpControl() === 'elevated' ? '600' : '';
    }
  }

  if (sedEl) {
    if (P.sed === 'fall') {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> <strong>Active fall risk:</strong> Sedating agents (opioids, duloxetine, gabapentinoids) are contraindicated without formal fall risk assessment and specialist sign-off.';
      sedEl.style.color = 'var(--red)'; sedEl.style.fontWeight = '600';
    } else if (P.sed === 'high') {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Patient expressly refuses sedating agents — sedation concern documented. All neuromodulators require explicit patient consent and counselling on sedation risk before initiation.';
      sedEl.style.color = 'var(--amber)'; sedEl.style.fontWeight = '600';
    } else if (P.sed === 'none') {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Sedation tolerance documented — patient accepts sedating agents if benefit is explained. Standard sedation monitoring applies.';
      sedEl.style.color = 'var(--green)'; sedEl.style.fontWeight = '';
    } else {
      sedEl.innerHTML = '<span class="mn-contra-x">✕</span> Sedating agents (opioids, high-dose duloxetine) without fall-risk assessment — patient prefers non-sedating agents; discussion required before initiating.';
      sedEl.style.color = ''; sedEl.style.fontWeight = '';
    }
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 11 — RENAL DOSING BLOCK
════════════════════════════════════════════════════════════ */

function updateRenalDosingBlock() {
  var apapVal  = document.getElementById('dyn-rd-apap-val');
  var apapNote = document.getElementById('dyn-rd-apap-note');
  var nsaidVal = document.getElementById('dyn-rd-nsaid-val');
  var nsaidNote = document.getElementById('dyn-rd-nsaid-note');
  var opioidVal = document.getElementById('dyn-rd-opioid-val');
  var opioidNote = document.getElementById('dyn-rd-opioid-note');
  var trajNote  = document.getElementById('dyn-rd-trajectory-note');
  if (!apapVal) return;

  // Acetaminophen ceiling
  if (P.egfr < 30) {
    apapVal.style.color = 'var(--red)'; apapVal.textContent = '2 g/day max (eGFR ' + P.egfr + ')';
    apapNote.textContent = 'Severe CKD — reduce to 2 g/day, extend dosing interval to every 6–8 hours. Monitor LFTs. Nephrology input mandatory.';
  } else if (P.egfr < 45) {
    apapVal.style.color = 'var(--red)'; apapVal.textContent = '2.5 g/day max (eGFR ' + P.egfr + ')';
    apapNote.textContent = 'Moderate CKD — max 2.5 g/day. Consider every 6-hour dosing intervals. Monitor LFTs at 4 weeks.';
  } else if (P.egfr < 60) {
    apapVal.style.color = 'var(--amber)'; apapVal.textContent = '3 g/day max (eGFR ' + P.egfr + ')';
    apapNote.textContent = 'Older adult + G3a CKD ceiling. Reduce to 2 g/day if eGFR drops below 30. Monitor trajectory 6-weekly.';
  } else {
    apapVal.style.color = 'var(--green)'; apapVal.textContent = '3–4 g/day (age-adjusted)';
    apapNote.textContent = 'eGFR ≥60 — renal function not dose-limiting. Older adult ceiling (3 g/day) applies based on age ' + P.age + '.';
  }

  // NSAID status
  if (P.egfr < 30) {
    nsaidVal.style.color = 'var(--red)'; nsaidVal.textContent = 'Absolutely contraindicated';
    nsaidNote.textContent = 'Severe renal impairment — all oral and topical NSAIDs contraindicated. Prostaglandin inhibition at this eGFR is nephrotoxic. No exceptions.';
  } else if (P.egfr < 45) {
    nsaidVal.style.color = 'var(--red)'; nsaidVal.textContent = 'Contraindicated (eGFR ' + P.egfr + ')';
    nsaidNote.textContent = 'NSAIDs unsafe at eGFR <45 — meaningful impairment of autoregulatory renal perfusion. Risk of AKI. Topical NSAIDs: monitor closely.';
  } else if (nsaidContraindicated()) {
    nsaidVal.style.color = 'var(--red)'; nsaidVal.textContent = 'Avoid (intolerance + risk)';
    nsaidNote.textContent = 'eGFR ' + P.egfr + ' permits conditional NSAID use on renal grounds, but documented GI and BP intolerance make NSAIDs unsafe. Renal concern adds to contraindication stack.';
  } else {
    nsaidVal.style.color = 'var(--amber)'; nsaidVal.textContent = 'Conditional (eGFR ' + P.egfr + ')';
    nsaidNote.textContent = 'eGFR ≥' + P.egfr + ' — NSAID use conditionally permissible with close monitoring. eGFR recheck at 2 and 6 weeks if initiated. Stop if eGFR falls ≥15%.';
  }

  // Opioid/adjunct risk
  if (P.egfr < 30) {
    opioidVal.style.color = 'var(--red)'; opioidVal.textContent = 'High accumulation risk';
    opioidNote.textContent = 'Active morphine-6-glucuronide accumulation. Gabapentinoids require severe dose reduction. Specialist guidance mandatory.';
  } else if (P.egfr < 45) {
    opioidVal.style.color = 'var(--red)'; opioidVal.textContent = 'Moderate accumulation risk';
    opioidNote.textContent = 'M6G accumulation begins. Opioids require dose reduction and extended intervals. Gabapentinoids need CrCl-based dose adjustment.';
  } else if (P.egfr < 60) {
    opioidVal.style.color = 'var(--amber)'; opioidVal.textContent = 'Emerging risk (eGFR ' + P.egfr + ')';
    opioidNote.textContent = 'eGFR 58 — approaching M6G accumulation threshold. Avoid opioids unless unavoidable. Gabapentin/pregabalin dose reduction required at eGFR <60.';
  } else {
    opioidVal.style.color = 'var(--muted)'; opioidVal.textContent = 'Standard monitoring';
    opioidNote.textContent = 'eGFR ≥60 — no opioid metabolite accumulation concern on renal grounds. Sedation risk (patient-reported) remains the primary opioid barrier.';
  }

  // Trajectory note
  if (trajNote) {
    var threshEgfr = Math.round(P.egfr * 0.85);
    if (P.egfr < 45) {
      trajNote.textContent = 'eGFR ' + P.egfr + ' — actively monitoring for further decline. Nephrology co-management threshold approaching. Next check: 4 weeks.';
    } else if (P.egfr < 60) {
      trajNote.textContent = 'Current eGFR ' + P.egfr + ' (G3a range). A 15% decline from baseline would bring eGFR to approximately ' + threshEgfr + ' mL/min — crossing into G3b, tightening all dose thresholds. Next eGFR check due at 6 weeks.';
    } else {
      trajNote.textContent = 'eGFR ' + P.egfr + ' currently above G3a threshold. Annual monitoring appropriate unless clinical deterioration. Renal dose adjustments become relevant if eGFR falls below 60 mL/min.';
    }
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 12 — MAIN REASONING ENGINE
════════════════════════════════════════════════════════════ */

function runReasoningEngine() {
  updateParamTiles();
  updateComplexityBar();
  updateClinicalStatusSummary();
  updateClinicalImpression();

  var rec    = buildPrimaryRec();
  var nsaidR = buildNsaidReasoning();

  // 1. Primary recommendation
  var primaryDrugEl = document.getElementById('dyn-primary-drug');
  if (primaryDrugEl) { primaryDrugEl.innerHTML = rec.drug.replace('\n', '<br>'); flashElement('dyn-primary-drug'); }
  var stateEl = document.getElementById('dyn-primary-state');
  if (stateEl) { stateEl.textContent = rec.state; flashElement('dyn-primary-state'); }
  var ratEl = document.getElementById('dyn-primary-rationale');
  if (ratEl) { ratEl.textContent = rec.rationale; flashElement('dyn-primary-rationale'); }

  // 2. Confidence strip
  var pctEl = document.getElementById('dyn-conf-pct');
  if (pctEl) {
    var bandEl = document.getElementById('dyn-conf-band');
    if (bandEl) bandEl.textContent = rec.confBand || '';
    pctEl.childNodes[0].textContent = rec.confPct + '%';
    flashElement('dyn-conf-pct');
  }
  setEl('dyn-conf-label', rec.confLabel);
  setEl('dyn-conf-desc', rec.confDesc);

  var barEl = document.getElementById('dyn-conf-bar');
  if (barEl) barEl.style.width = rec.confPct + '%';

  var qualEl = document.getElementById('dyn-conf-qualifier');
  if (qualEl) {
    if (rec.uncertaintyQualifier) {
      qualEl.textContent = rec.uncertaintyQualifier;
      qualEl.style.display = 'flex';
    } else {
      qualEl.style.display = 'none';
    }
  }

  if (pctEl) {
    if      (rec.confPct >= 70) pctEl.style.color = 'rgba(80,210,145,0.95)';
    else if (rec.confPct >= 55) pctEl.style.color = 'rgba(230,165,50,0.9)';
    else                        pctEl.style.color = 'rgba(255,120,100,0.9)';
  }

  // 3. Decision drivers summary
  var drivers = [];
  if (giRisk() !== 'low')       drivers.push(giRisk()==='very-high' ? 'Critical GI risk' : 'High GI risk');
  if (ageFlag())                 drivers.push('Age ' + P.age + ' (≥65 flag)');
  if (P.intol !== 'none')        drivers.push('Documented drug intolerance');
  if (egfrRisk() !== 'low')      drivers.push('Renal impairment (eGFR ' + P.egfr + ')');
  if (bpControl() !== 'controlled') drivers.push('BP management (' + P.bp + ' mmHg)');
  if (P.pain >= 8)               drivers.push('Severe pain (' + P.pain + '/10)');
  if (P.failed === 'multi')      drivers.push('Multimodal failure');
  if (P.adh === 'poor')          drivers.push('Adherence concern');
  drivers.push('Long-term management goal');

  var driversEl = document.getElementById('dyn-drivers-summary');
  if (driversEl) { driversEl.textContent = drivers.join(' · '); flashElement('dyn-drivers-summary'); }

  // 4. NSAID why-not
  var nsaidState = document.getElementById('dyn-nsaid-state');
  if (nsaidState) {
    nsaidState.textContent = nsaidR.state;
    nsaidState.className = 'wn-col-state ' + (nsaidR.state === 'Avoid' ? 'avoid' : 'cond');
  }
  var nsaidReason = document.getElementById('dyn-nsaid-reason');
  if (nsaidReason) { nsaidReason.textContent = nsaidR.reason; flashElement('dyn-nsaid-reason'); }
  nsaidR.reasons.forEach(function(r) {
    var el = document.getElementById(r.id);
    if (el) el.innerHTML = r.text;
  });

  // 5. Opioid reasoning
  var opioidR = buildOpioidReasoning();
  var opioidState = document.getElementById('dyn-opioid-state');
  if (opioidState) {
    opioidState.textContent = opioidR.state;
    opioidState.className = 'wn-col-state ' + (opioidR.state === 'Avoid' ? 'avoid' : 'esc');
  }
  setEl('dyn-opioid-reason', opioidR.reason);

  // 6. Opioid renal note
  var opioidRenal = document.getElementById('dyn-opioid-renal');
  if (opioidRenal) {
    if      (P.egfr < 30) opioidRenal.textContent = 'Severe renal impairment (eGFR ' + P.egfr + ') — opioid metabolite accumulation is a critical safety concern; morphine-6-glucuronide clearance severely compromised';
    else if (P.egfr < 45) opioidRenal.textContent = 'Moderate renal impairment (eGFR ' + P.egfr + ') — opioid metabolite clearance significantly reduced; dose reduction mandatory if ever initiated';
    else                  opioidRenal.textContent = 'Renal metabolite clearance — eGFR ' + P.egfr + ' limits elimination of opioid metabolites (esp. morphine-6-glucuronide)';
  }

  // 7. Opioid stage note
  var opioidStage = document.getElementById('dyn-opioid-stage');
  if (opioidStage) {
    if (multimodalFailure())    opioidStage.textContent = 'Multimodal failure documented — low-dose opioid may warrant specialist consideration if patient sedation profile changes';
    else if (P.failed === 'apap') opioidStage.textContent = 'Acetaminophen failed — escalation pathway narrows; opioids remain deprioritized pending topical NSAID and duloxetine trial (if sedation concern resolved)';
    else                        opioidStage.textContent = 'No clinical indication at this stage — pain severity (' + P.pain + '/10) and prior treatment history do not yet justify opioid pathway';
  }

  // 8. Monitoring contraindications + renal dosing block
  updateContraindications();
  updateRenalDosingBlock();

  // 9. Evidence badge
  var evBadge = document.querySelector('.dp-evidence-badge');
  if (evBadge) {
    var complexity = computeComplexity();
    var shieldSvg = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ';
    if (complexity >= 75) {
      evBadge.style.background = 'rgba(184,50,41,0.07)';
      evBadge.style.color = 'var(--red)';
      evBadge.style.borderColor = 'rgba(184,50,41,0.2)';
      evBadge.innerHTML = shieldSvg + 'Evidence: Moderate — Complex';
    } else if (complexity >= 50) {
      evBadge.style.background = 'rgba(184,122,0,0.07)';
      evBadge.style.color = 'var(--amber)';
      evBadge.style.borderColor = 'rgba(184,122,0,0.2)';
      evBadge.innerHTML = shieldSvg + 'Evidence: Moderate';
    } else {
      evBadge.style.background = '';
      evBadge.style.color = 'var(--green)';
      evBadge.style.borderColor = '';
      evBadge.innerHTML = shieldSvg + 'Evidence: High';
    }
  }

  // 10. Update banner
  var banner = document.getElementById('ip-update-banner');
  if (banner) {
    var msgs = [];
    msgs.push(nsaidContraindicated() ? 'NSAID pathway: contraindicated' : 'NSAID pathway: conditional');
    if (apapContraindicated()) msgs.push('Acetaminophen: affected');
    msgs.push('Confidence: ' + rec.confPct + '%');
    setEl('ip-update-text', 'Reasoning updated — ' + msgs.join(' · '));
    banner.classList.add('visible');
  }

  // 11. Stale indicator on downstream sections
  ['section-summary', 'section-drivers', 'section-monitoring'].forEach(function(id) {
    var sec = document.getElementById(id);
    if (sec) {
      sec.classList.add('reason-stale');
      setTimeout(function() { sec.classList.remove('reason-stale'); }, 3000);
    }
  });

  // 12. Clinical reasoning panel
  updateClinicalReasoningPanel(rec, nsaidR);

  // 13. Review Objective Banner
  updateReviewObjectiveBanner(rec);

  // 14. Pharmacist Intervention Panel
  updateInterventionPanel(rec);
}


/* ════════════════════════════════════════════════════════════
   SECTION 13 — CLINICAL REASONING PANEL
════════════════════════════════════════════════════════════ */

var _isFirstRun = true;

// Snapshot of previous state for change detection
var _prev = {
  recDrug:       null,
  nsaidState:    null,
  nsaidWasContra:null,
  egfr:          null,
  gi:            null,
  bp:            null,
  pain:          null,
  adh:           null,
  giRisk:        null,
  bpControl:     null,
  apapContra:    null,
  multimodal:    null,
  complexity:    null
};

function setCrSignal(signalId, sevClass, valId, valText, subId, subText) {
  var signal = document.getElementById(signalId);
  if (signal) {
    signal.className = 'cr-signal ' + sevClass;
    signal.classList.add('cr-updated');
    setTimeout(function() { if (signal) signal.classList.remove('cr-updated'); }, 800);
    var dot = signal.querySelector('.cr-signal-label-dot');
    if (dot) {
      dot.className = 'cr-signal-label-dot';
      if      (sevClass === 'sev-red')   dot.classList.add('dot-red');
      else if (sevClass === 'sev-amber') dot.classList.add('dot-amber');
      else if (sevClass === 'sev-green') dot.classList.add('dot-green');
      else                               dot.classList.add('dot-blue');
    }
  }
  setEl(valId, valText);
  if (subId) setEl(subId, subText);
}

function updateClinicalReasoningPanel(rec, nsaidR) {
  var changed = !_isFirstRun && (
    rec.drug    !== _prev.recDrug    ||
    nsaidR.state !== _prev.nsaidState ||
    P.egfr !== _prev.egfr || P.gi !== _prev.gi ||
    P.bp   !== _prev.bp   || P.pain !== _prev.pain ||
    P.adh  !== _prev.adh
  );

  // 1. Primary Clinical Concern
  var concernVal, concernSub, concernSev;
  if (giRisk() === 'very-high') {
    concernVal = 'Active / recent GI bleeding risk';
    concernSub = 'Absolute contraindication to NSAIDs · Immediate GI monitoring priority';
    concernSev = 'sev-red';
  } else if (P.egfr < 30) {
    concernVal = 'Severe renal impairment (eGFR ' + P.egfr + ')';
    concernSub = 'Narrows entire analgesic pathway · Opioid metabolite accumulation risk';
    concernSev = 'sev-red';
  } else if (giRisk() === 'high' && egfrRisk() !== 'low') {
    concernVal = 'Compound GI + renal risk';
    concernSub = 'Prior peptic ulcer · eGFR ' + P.egfr + ' · NSAID intolerance ×' + (P.intol === 'none' ? '0' : P.intol === 'multi' || P.intol === 'both-nsaid' ? '2' : '1');
    concernSev = 'sev-red';
  } else if (giRisk() === 'high') {
    concernVal = 'GI bleeding risk — primary NSAID barrier';
    concernSub = 'Prior peptic ulcer · Documented NSAID-induced GI intolerance';
    concernSev = 'sev-red';
  } else if (P.pain >= 8 && multimodalFailure()) {
    concernVal = 'Severe pain + multimodal failure';
    concernSub = 'Limited safe escalation options remain · Specialist input may be needed';
    concernSev = 'sev-red';
  } else if (apapContraindicated() && nsaidContraindicated()) {
    concernVal = 'Both primary analgesic pathways compromised';
    concernSub = 'Acetaminophen + NSAID both contraindicated · Requires specialist review';
    concernSev = 'sev-red';
  } else if (P.pain >= 8) {
    concernVal = 'Severe pain (' + P.pain + '/10) — analgesic adequacy';
    concernSub = 'Pain severity strains available non-opioid options · Monitor response closely';
    concernSev = 'sev-amber';
  } else if (ageFlag() && P.adh === 'poor') {
    concernVal = 'Age ≥65 + poor adherence';
    concernSub = 'Subtherapeutic dosing probable · Outcomes assessment unreliable at Week 4';
    concernSev = 'sev-amber';
  } else {
    concernVal = 'Moderate pain with manageable risk profile';
    concernSub = 'GI risk present but controlled · Standard monitoring applies';
    concernSev = 'sev-amber';
  }
  setCrSignal('crs-primary-concern', concernSev, 'crs-concern-val', concernVal, 'crs-concern-sub', concernSub);

  // 2. Highest Monitoring Priority
  var monitorVal, monitorSub, monitorSev;
  if (P.egfr < 30) {
    monitorVal = 'eGFR — severe impairment requires weekly review';
    monitorSub = 'Opioid metabolite accumulation · All renally-cleared drugs at risk';
    monitorSev = 'sev-red';
  } else if (P.egfr < 45) {
    monitorVal = 'eGFR — moderate impairment (eGFR ' + P.egfr + ')';
    monitorSub = 'Review at 2 weeks · Flag any further decline ≥5 mL/min';
    monitorSev = 'sev-red';
  } else if (giRisk() === 'very-high') {
    monitorVal = 'GI symptoms — active/recent bleed history';
    monitorSub = 'Any new GI symptoms require immediate reassessment · Hold analgesic pathway';
    monitorSev = 'sev-red';
  } else if (bpControl() === 'uncontrolled') {
    monitorVal = 'Blood pressure (' + P.bp + ' mmHg) — uncontrolled';
    monitorSub = 'Recheck before any analgesic initiation · Target &lt;140/90 before escalation';
    monitorSev = 'sev-red';
  } else if (P.egfr < 60) {
    monitorVal = 'Renal function (eGFR ' + P.egfr + ')';
    monitorSub = 'Check at 2 and 6 weeks · Flag if eGFR drops &gt;10%';
    monitorSev = 'sev-amber';
  } else if (P.adh === 'poor') {
    monitorVal = 'Medication adherence — inconsistent use documented';
    monitorSub = 'Confirm PRN vs. scheduled dosing · NRS response unreliable without regular dosing';
    monitorSev = 'sev-amber';
  } else if (giRisk() === 'high') {
    monitorVal = 'GI status — prior peptic ulcer';
    monitorSub = 'Monitor for dyspepsia, dark stool, abdominal pain · Annual endoscopy if on long-term analgesics';
    monitorSev = 'sev-amber';
  } else {
    monitorVal = 'Pain response at Week 2 (NRS)';
    monitorSub = 'Failure to reach NRS ≤4 opens escalation pathway review';
    monitorSev = 'sev-green';
  }
  setCrSignal('crs-monitor-priority', monitorSev, 'crs-monitor-val', monitorVal, 'crs-monitor-sub', monitorSub);

  // 3. Main Treatment Constraint
  var constraintVal, constraintSub, constraintSev;
  if (apapContraindicated() && nsaidContraindicated()) {
    constraintVal = 'Both NSAID and acetaminophen pathways closed';
    constraintSub = 'No safe first-line pharmacological option available · Specialist referral required';
    constraintSev = 'sev-red';
  } else if (nsaidContraindicated()) {
    var constraintReasons = [];
    if (giRisk() !== 'low') constraintReasons.push('GI risk');
    if (bpControl() !== 'controlled' || P.intol === 'bp-nsaid' || P.intol === 'both-nsaid') constraintReasons.push('BP intolerance');
    if (ageFlag()) constraintReasons.push('age ≥65 (Beers)');
    if (P.egfr < 45) constraintReasons.push('eGFR ' + P.egfr);
    constraintVal = 'NSAID pathway closed';
    constraintSub = constraintReasons.join(' + ') || 'Multiple converging contraindications';
    constraintSev = 'sev-red';
  } else if (opioidAvoidable()) {
    constraintVal = 'Opioid pathway: avoid — sedation + renal risk';
    constraintSub = 'Patient refuses sedation · eGFR ' + P.egfr + ' limits metabolite clearance';
    constraintSev = 'sev-amber';
  } else if (P.sed === 'fall') {
    constraintVal = 'Sedation agents contraindicated';
    constraintSub = 'High fall risk · Patient explicitly refuses · Duloxetine and opioids deprioritized';
    constraintSev = 'sev-amber';
  } else if (apapContraindicated()) {
    constraintVal = 'Acetaminophen pathway affected';
    constraintSub = 'Documented intolerance · NSAID fallback applies with caution';
    constraintSev = 'sev-amber';
  } else {
    constraintVal = 'No absolute constraint — pathway open';
    constraintSub = 'Acetaminophen first-line available · Monitor per standard protocol';
    constraintSev = 'sev-green';
  }
  setCrSignal('crs-constraint', constraintSev, 'crs-constraint-val', constraintVal, 'crs-constraint-sub', constraintSub);

  // 4. Most Significant Escalation Trigger
  var triggerVal, triggerSub, triggerSev;
  if (multimodalFailure()) {
    triggerVal = 'Multimodal failure — escalation pathway active';
    triggerSub = 'All non-opioid options exhausted · Specialist review required for next step';
    triggerSev = 'sev-red';
  } else if (P.pain >= 8) {
    triggerVal = 'Severe pain already present (NRS ' + P.pain + '/10)';
    triggerSub = 'Combination therapy threshold met · Consider topical NSAID adjunct now';
    triggerSev = 'sev-amber';
  } else if (P.failed === 'apap') {
    triggerVal = 'Acetaminophen failed — escalation needed';
    triggerSub = 'Move to topical NSAID + consider duloxetine if neuropathic features present';
    triggerSev = 'sev-amber';
  } else if (P.failed === '2nsaid') {
    triggerVal = '2 NSAIDs failed — limited escalation options';
    triggerSub = 'Combination acetaminophen + topical NSAID · Duloxetine if neuropathic component';
    triggerSev = 'sev-amber';
  } else {
    var triggerItems = [];
    if (P.pain < 8) triggerItems.push('NRS ≥8');
    triggerItems.push('acetaminophen failure at Week 4');
    triggerVal = triggerItems.join(' or ');
    triggerSub = 'Would open topical NSAID ' + (nsaidContraindicated() ? '' : 'or low-dose systemic NSAID ') + 'combination pathway';
    triggerSev = 'sev-amber';
  }
  setCrSignal('crs-escalation-trigger', triggerSev, 'crs-trigger-val', triggerVal, 'crs-trigger-sub', triggerSub);

  // 5. Key Longitudinal Concern
  var longVal, longSub, longSev;
  if (P.adh === 'poor') {
    longVal = 'Adherence — poor, inconsistent use documented';
    longSub = 'Subtherapeutic exposure expected · Week 4 NRS response unreliable · Reframe adherence plan';
    longSev = 'sev-red';
  } else if (P.egfr < 45) {
    longVal = 'Progressive renal decline — long-term analgesic access';
    longSub = 'eGFR ' + P.egfr + ' · Further decline may close additional pathways · Annual nephrology review';
    longSev = 'sev-red';
  } else if (P.adh === 'mod') {
    longVal = 'Adherence — inconsistent PRN dosing pattern';
    longSub = 'Subtherapeutic use limits outcome assessment at Week 4';
    longSev = 'sev-amber';
  } else if (ageFlag() && P.egfr < 60) {
    longVal = 'Age ≥65 + baseline renal impairment';
    longSub = 'Renal function likely to decline over time · Annual eGFR review · Analgesic pathway may narrow';
    longSev = 'sev-amber';
  } else if (giRisk() !== 'low') {
    longVal = 'GI status — prior peptic ulcer history';
    longSub = 'Long-term analgesic use requires annual GI reassessment';
    longSev = 'sev-amber';
  } else {
    longVal = 'Mobility and function — primary patient goal';
    longSub = 'Track NRS, stair-climbing capacity, and walking distance at each review';
    longSev = 'sev-blue';
  }
  setCrSignal('crs-longitudinal', longSev, 'crs-longitudinal-val', longVal, 'crs-longitudinal-sub', longSub);

  // 6. Current Risk Balance
  var balanceVal, balancePill, balancePillClass, balanceSev;
  var complexity = computeComplexity();
  if (apapContraindicated() && nsaidContraindicated()) {
    balanceVal = 'Unfavorable — no safe standard pathway';
    balancePill = 'Specialist referral required';
    balancePillClass = 'cr-risk-balance rb-unfavorable';
    balanceSev = 'sev-red';
  } else if (complexity >= 75) {
    balanceVal = 'Caution — high-complexity profile';
    balancePill = 'Acetaminophen: best available option';
    balancePillClass = 'cr-risk-balance rb-caution';
    balanceSev = 'sev-amber';
  } else if (nsaidContraindicated()) {
    balanceVal = 'Manageable — within acetaminophen pathway';
    balancePill = 'NSAID risk exceeds benefit · Acetaminophen favorable';
    balancePillClass = 'cr-risk-balance rb-favorable';
    balanceSev = 'sev-green';
  } else {
    balanceVal = 'Favorable — within safe pathway';
    balancePill = 'Acetaminophen: low systemic risk';
    balancePillClass = 'cr-risk-balance rb-favorable';
    balanceSev = 'sev-green';
  }
  setCrSignal('crs-risk-balance', balanceSev, 'crs-balance-val', balanceVal, null, null);
  var pillEl = document.getElementById('crs-balance-pill');
  if (pillEl) { pillEl.textContent = balancePill; pillEl.className = balancePillClass; }

  // 7. Change detection & causality
  var changeRow  = document.getElementById('cr-change-row');
  var changeText = document.getElementById('cr-change-text');
  if (changed && changeRow && changeText) {
    var changeMsg = '';
    var triggerNote = '';
    var changeFactors = [];

    if (rec.drug !== _prev.recDrug) {
      if (nsaidContraindicated() && !_prev.nsaidWasContra) {
        changeFactors.push('NSAID pathway newly contraindicated — recommendation locked to acetaminophen');
        if      (giRisk() === 'very-high' && _prev.giRisk !== 'very-high')   triggerNote = 'GI risk escalated to very-high — NSAIDs are now an absolute contraindication. NSAID escalation has been removed from the pathway entirely.';
        else if (bpControl() === 'uncontrolled' && _prev.bpControl !== 'uncontrolled') triggerNote = 'BP rose to uncontrolled range (' + P.bp + ' mmHg) — NSAID initiation is now unsafe. Amlodipine efficacy would be further compromised. NSAID pathway closed.';
        else if (P.egfr < 30 && _prev.egfr >= 30)  triggerNote = 'eGFR dropped below 30 — NSAIDs are absolutely contraindicated at this renal function. Prostaglandin-dependent renal perfusion is critically impaired.';
        else if (P.egfr < 45 && _prev.egfr >= 45)  triggerNote = 'eGFR crossed below 45 — moderate renal impairment now makes NSAID use clinically unsafe. Renal pathway risk now outweighs any analgesic benefit.';
        else                                         triggerNote = 'Combined contraindication profile has closed the NSAID pathway. GI risk + renal + BP factors are now compounding.';
      } else if (!nsaidContraindicated() && _prev.nsaidWasContra) {
        changeFactors.push('NSAID pathway reopened — risk profile has improved');
        triggerNote = 'Contraindication profile has partially resolved. NSAIDs are no longer absolutely contraindicated, but remain a secondary option due to residual risk factors.';
      } else if (apapContraindicated() && !_prev.apapContra) {
        changeFactors.push('Acetaminophen intolerance newly documented — recommendation pathway shifted');
        triggerNote = 'Acetaminophen intolerance documented. This eliminates the primary first-line option. The workflow has shifted to the NSAID or specialist pathway.';
      } else if (P.pain >= 8 && _prev.pain < 8) {
        changeFactors.push('Pain crossed severe threshold (NRS ' + P.pain + '/10) — combination pathway activated');
        triggerNote = 'Pain severity crossed the severe threshold. Acetaminophen monotherapy is now insufficient at this intensity. Combination with topical NSAID is now the recommended first-line approach.';
      } else if (multimodalFailure() && !_prev.multimodal) {
        changeFactors.push('Multimodal failure documented — escalation protocol applies');
        triggerNote = 'All non-opioid pathways have been exhausted. Specialist referral is now the appropriate next step before any further pharmacotherapy is initiated.';
      }
      changeMsg = changeFactors.join('. ') || 'Treatment pathway shifted based on updated patient parameters.';
    } else {
      var shiftFactors = [];
      if (P.egfr  !== _prev.egfr)  shiftFactors.push('eGFR: ' + _prev.egfr + ' → ' + P.egfr + ' mL/min (renal risk ' + (P.egfr < _prev.egfr ? 'worsened' : 'improved') + ')');
      if (P.gi    !== _prev.gi)    shiftFactors.push('GI risk reclassified: ' + giLabel());
      if (P.bp    !== _prev.bp)    shiftFactors.push('BP updated: ' + P.bp + ' mmHg (' + bpRiskLabel() + ')');
      if (P.pain  !== _prev.pain)  shiftFactors.push('Pain NRS: ' + _prev.pain + ' → ' + P.pain);
      if (P.adh   !== _prev.adh)   shiftFactors.push('Adherence pattern: ' + adhLabel());
      changeMsg = shiftFactors.length
        ? 'Recommendation unchanged — constraint weighting updated. ' + shiftFactors.join('; ') + '. Review monitoring priorities.'
        : 'Pathway risk profile updated — monitoring requirements and escalation triggers have been recalculated.';
    }

    changeText.textContent = changeMsg;
    changeRow.classList.add('visible');

    var triggerNoteEl   = document.getElementById('ds-trigger-note');
    var triggerNoteText = document.getElementById('ds-trigger-note-text');
    if (triggerNoteEl && triggerNoteText) {
      if (triggerNote && rec.drug !== _prev.recDrug) {
        triggerNoteText.textContent = triggerNote;
        triggerNoteEl.classList.add('visible');
      } else {
        triggerNoteEl.classList.remove('visible');
      }
    }

    buildCausalityPanel();

    var updInd = document.getElementById('cr-updated-indicator');
    if (updInd) {
      updInd.classList.add('visible');
      setTimeout(function() { updInd.classList.remove('visible'); }, 4000);
    }
  } else if (!changed && !_isFirstRun) {
    if (changeRow) changeRow.classList.remove('visible');
    var tnEl = document.getElementById('ds-trigger-note');
    if (tnEl) tnEl.classList.remove('visible');
    var cpEl = document.getElementById('cr-causality-panel');
    if (cpEl) cpEl.classList.remove('visible');
  }

  updateTradeoffStrip();
  updateEscalationTags();

  // Save state snapshot
  _prev.nsaidWasContra = nsaidContraindicated();
  _prev.recDrug        = rec.drug;
  _prev.nsaidState     = nsaidR.state;
  _prev.egfr           = P.egfr;
  _prev.gi             = P.gi;
  _prev.bp             = P.bp;
  _prev.pain           = P.pain;
  _prev.adh            = P.adh;
  _prev.giRisk         = giRisk();
  _prev.bpControl      = bpControl();
  _prev.apapContra     = apapContraindicated();
  _prev.multimodal     = multimodalFailure();
  _prev.complexity     = computeComplexity();
  _isFirstRun = false;
}


/* ════════════════════════════════════════════════════════════
   SECTION 14 — CAUSALITY PANEL
════════════════════════════════════════════════════════════ */

function buildCausalityPanel() {
  var panel = document.getElementById('cr-causality-panel');
  var rows  = document.getElementById('cr-causality-rows');
  if (!panel || !rows) return;

  var items = [];

  if (_prev.egfr !== null && P.egfr !== _prev.egfr) {
    var egfrDir    = P.egfr < _prev.egfr ? 'worse' : 'better';
    var egfrEffect = '';
    if      (P.egfr < 30  && _prev.egfr >= 30)  egfrEffect = 'NSAIDs now absolutely contraindicated · acetaminophen dose ceiling applies';
    else if (P.egfr < 45  && _prev.egfr >= 45)  egfrEffect = 'NSAID pathway unsafe · renal monitoring frequency increased';
    else if (P.egfr >= 60 && _prev.egfr < 60)   egfrEffect = 'Renal risk flag cleared · monitoring interval can be relaxed';
    else                                          egfrEffect = 'Renal risk reclassified · monitoring threshold adjusted';
    items.push({ param:'eGFR', dotClass: egfrDir==='worse'?'dot-red':'dot-green',
      change: _prev.egfr + ' → ' + P.egfr + ' mL/min', dir: egfrDir, effect: egfrEffect });
  }

  if (_prev.gi !== null && P.gi !== _prev.gi) {
    var giDir    = (P.gi==='bleed'||P.gi==='ulcer-recent') ? 'worse' : (P.gi==='none' ? 'better' : 'neutral');
    var giEffect = '';
    if      (giRisk()==='very-high' && _prev.giRisk!=='very-high') giEffect = 'GI risk now critical — NSAIDs are an absolute contraindication; escalation pathway closed';
    else if (giRisk()==='high'      && _prev.giRisk==='low')       giEffect = 'NSAID pathway deprioritized — GI monitoring required at every visit';
    else if (giRisk()==='low'       && _prev.giRisk!=='low')       giEffect = 'GI contraindication resolved — NSAID pathway may now be considered with PPI cover';
    else                                                             giEffect = 'GI risk weighting updated · NSAID reasoning recalculated';
    items.push({ param:'GI History', dotClass: giDir==='worse'?'dot-red': giDir==='better'?'dot-green':'dot-amber',
      change: giLabel(), dir: giDir, effect: giEffect });
  }

  if (_prev.bp !== null && P.bp !== _prev.bp) {
    var bpDir    = P.bp > _prev.bp ? 'worse' : 'better';
    var bpEffect = '';
    if      (bpControl()==='uncontrolled' && _prev.bpControl!=='uncontrolled') bpEffect = 'BP uncontrolled — NSAIDs now contraindicated; amlodipine efficacy risk elevated';
    else if (bpControl()==='controlled'   && _prev.bpControl!=='controlled')   bpEffect = 'BP now controlled — BP-based NSAID contraindication resolved';
    else                                                                         bpEffect = 'BP risk tier changed (' + bpRiskLabel() + ') · NSAID eligibility recalculated';
    items.push({ param:'Blood Pressure', dotClass: bpDir==='worse'?'dot-red':'dot-green',
      change: _prev.bp + ' → ' + P.bp + ' mmHg', dir: bpDir, effect: bpEffect });
  }

  if (_prev.pain !== null && P.pain !== _prev.pain) {
    var painDir    = P.pain > _prev.pain ? 'worse' : 'better';
    var painEffect = '';
    if      (P.pain >= 8 && _prev.pain < 8)  painEffect = 'Severe pain threshold crossed — combination therapy (acetaminophen + topical NSAID) is now indicated';
    else if (P.pain < 8  && _prev.pain >= 8)  painEffect = 'Pain below severe threshold — acetaminophen monotherapy pathway reactivated';
    else if (P.pain >= 6 && _prev.pain < 6)   painEffect = 'Moderate pain confirmed — fixed TID dosing schedule should be enforced';
    else                                        painEffect = 'Analgesic adequacy threshold reassessed at new severity level';
    items.push({ param:'Pain NRS', dotClass: painDir==='worse'?'dot-red':'dot-green',
      change: _prev.pain + '/10 → ' + P.pain + '/10', dir: painDir, effect: painEffect });
  }

  if (_prev.adh !== null && P.adh !== _prev.adh) {
    var adhDir    = P.adh==='poor' ? 'worse' : P.adh==='good' ? 'better' : 'neutral';
    var adhEffect = '';
    if      (P.adh === 'poor') adhEffect = 'Poor adherence shifts pathway toward simplified regimens; Week 4 NRS response is unreliable without consistent dosing';
    else if (P.adh === 'good') adhEffect = 'Good adherence restores validity of treatment response assessment; NRS outcomes now interpretable';
    else                        adhEffect = 'Inconsistent PRN use — fixed schedule counselling required before escalation is considered';
    items.push({ param:'Adherence', dotClass: adhDir==='worse'?'dot-amber':'dot-green',
      change: adhLabel(), dir: adhDir, effect: adhEffect });
  }

  if (items.length === 0) { panel.classList.remove('visible'); return; }

  rows.innerHTML = '';
  items.forEach(function(item) {
    var dirClass = item.dir==='worse'?'cr-delta-worse': item.dir==='better'?'cr-delta-better':'cr-delta-neutral';
    var dotBg    = item.dotClass.indexOf('red')>-1?'var(--red)': item.dotClass.indexOf('green')>-1?'var(--green)':'var(--amber)';
    rows.innerHTML += '<div class="cr-causality-row">' +
      '<div class="cr-causality-param"><span class="cr-causality-param-dot" style="background:' + dotBg + '"></span>' + item.param + '</div>' +
      '<div class="cr-causality-change"><span class="cr-delta-val ' + dirClass + '">' + item.change + '</span></div>' +
      '<div class="cr-causality-effect">' + item.effect + '</div>' +
      '</div>';
  });
  panel.classList.add('visible');
}


/* ════════════════════════════════════════════════════════════
   SECTION 15 — TRADE-OFF STRIP & ESCALATION TAGS
════════════════════════════════════════════════════════════ */

function updateTradeoffStrip() {
  var strip  = document.getElementById('cr-tradeoff-strip');
  var text   = document.getElementById('cr-tradeoff-text');
  var deprio = document.getElementById('cr-tradeoff-deprioritized');
  if (!strip || !text || !deprio) return;

  strip.className = 'cr-tradeoff-strip';

  var cls, msg, dep;
  if (apapContraindicated() && nsaidContraindicated()) {
    cls = 'strip-red'; msg = 'All standard pathways compromised — specialist assessment required before any analgesic is initiated'; dep = 'No safe first-line available';
  } else if (P.egfr < 30) {
    cls = 'strip-red'; msg = 'Renal protection is the overriding constraint — all analgesics are deprioritized pending nephrology input; pain tolerance is being traded for organ safety'; dep = 'NSAIDs + acetaminophen ceiling active';
  } else if (giRisk() === 'very-high') {
    cls = 'strip-red'; msg = 'GI safety is the absolute constraint — maximum GI protection is required; analgesic efficacy is fully subordinated to bleeding risk avoidance'; dep = 'Systemic NSAID pathway closed';
  } else if (multimodalFailure()) {
    cls = 'strip-red'; msg = 'Multimodal failure — pain control need is now the dominant factor; specialist oversight is required before any further pharmacotherapy'; dep = 'Standard pathway exhausted';
  } else if (nsaidContraindicated() && P.adh === 'poor') {
    cls = 'strip-amber'; msg = 'Adherence is now the binding clinical variable — analgesic selection is constrained by GI risk, but therapeutic outcomes are primarily limited by dosing consistency'; dep = 'NSAID escalation + PRN dosing both deprioritized';
  } else if (nsaidContraindicated()) {
    cls = 'strip-amber';
    var reasons = [];
    if (giRisk() !== 'low') reasons.push('GI bleed risk');
    if (P.intol === 'both-nsaid' || P.intol === 'bp-nsaid') reasons.push('BP intolerance documented');
    if (ageFlag()) reasons.push('Beers flag');
    msg = 'GI safety is the binding constraint — analgesic efficacy is being traded for gastrointestinal protection' + (reasons.length ? ' (' + reasons.join(' + ') + ')' : '');
    dep = 'NSAID escalation deprioritized';
  } else if (P.pain >= 8) {
    cls = 'strip-amber'; msg = 'Pain severity is now driving the decision — the trade-off has shifted toward adequate analgesia; combination therapy is now clinically justified despite residual risks'; dep = 'Acetaminophen monotherapy insufficient';
  } else if (bpControl() === 'elevated' || bpControl() === 'mildly-elevated') {
    cls = 'strip-amber'; msg = 'Cardiovascular stability is the active co-constraint — BP management and analgesic safety are competing; amlodipine interaction risk is being monitored'; dep = 'NSAID + high BP combination avoided';
  } else if (P.adh === 'poor') {
    cls = 'strip-amber'; msg = 'Adherence is the primary clinical variable — the therapeutic question is no longer which drug, but whether any drug is being taken consistently enough to assess'; dep = 'Complex regimens deprioritized';
  } else {
    cls = 'strip-green'; msg = 'Risk profile is manageable within the acetaminophen pathway — safety and efficacy goals are currently compatible'; dep = 'No pathways actively deprioritized';
  }

  strip.classList.add(cls);
  text.textContent  = msg;
  deprio.textContent = dep;
}

function updateEscalationTags() {
  function setEscTag(id, text, cls) {
    var el = document.getElementById('ip-esc-' + id);
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.className = 'ip-escalation-tag visible ' + cls;
    } else {
      el.className = 'ip-escalation-tag';
      el.textContent = '';
    }
  }

  if      (P.egfr < 30) setEscTag('egfr', 'NSAIDs: absolute CI', 'esc-critical');
  else if (P.egfr < 45) setEscTag('egfr', 'NSAID-unsafe zone', 'esc-critical');
  else if (P.egfr < 60) setEscTag('egfr', 'Monitor closely', 'esc-monitor');
  else                  setEscTag('egfr', null);

  if      (giRisk() === 'very-high') setEscTag('gi', 'NSAID: absolute CI', 'esc-critical');
  else if (giRisk() === 'high')      setEscTag('gi', 'NSAID pathway closed', 'esc-critical');
  else if (P.gi === 'dyspepsia')     setEscTag('gi', 'Monitor on escalation', 'esc-monitor');
  else                               setEscTag('gi', null);

  if      (bpControl() === 'uncontrolled') setEscTag('bp', 'NSAID: unsafe', 'esc-critical');
  else if (bpControl() === 'elevated')     setEscTag('bp', 'Monitor BP', 'esc-monitor');
  else                                     setEscTag('bp', null);
}


/* ════════════════════════════════════════════════════════════
   SECTION 16 — REVIEW OBJECTIVE BANNER
════════════════════════════════════════════════════════════ */

function updateReviewObjectiveBanner(rec) {
  var objectiveEl = document.getElementById('rob-objective-text');
  var concernEl   = document.getElementById('rob-concern-text');
  var actionEl    = document.getElementById('rob-action-text');
  var actionAltEl = document.getElementById('rob-action-alt');
  if (!objectiveEl) return;

  var objective;
  if (apapContraindicated() && nsaidContraindicated()) {
    objective = 'Identifying safe analgesic pathway when both primary pharmacological options are contraindicated — specialist referral criteria';
  } else if (apapContraindicated()) {
    objective = 'Evaluating NSAID-based analgesic initiation under compound renal and GI risk — monitoring burden assessment';
  } else if (multimodalFailure()) {
    objective = 'Reviewing analgesic options after multimodal pharmacotherapy failure — assessing opioid pathway candidacy and monitoring requirements';
  } else if (P.pain >= 8) {
    objective = 'Managing severe pain under constrained escalation pathway — balancing analgesic adequacy against GI and renal safety';
  } else if (P.egfr < 45) {
    objective = 'Assessing analgesic safety under moderate-to-severe renal impairment — renal dose adjustment and pathway restriction review';
  } else if (egfrRisk() !== 'low' && giRisk() !== 'low') {
    objective = 'Evaluating analgesic safety under compound renal and GI constraint — assessing acetaminophen adequacy and escalation threshold';
  } else if (giRisk() !== 'low') {
    objective = 'Balancing analgesic efficacy against GI safety — reviewing therapy initiation and monitoring frequency in high-risk GI profile';
  } else {
    objective = 'Reviewing analgesic initiation in polypharmacy context — assessing drug interactions, monitoring burden, and escalation readiness';
  }
  objectiveEl.textContent = objective;

  var concern;
  if      (P.egfr < 30)                                      concern = 'Severe renal impairment (eGFR ' + P.egfr + ') · Analgesic pathway critically narrowed';
  else if (apapContraindicated() && nsaidContraindicated())   concern = 'Both primary analgesic pathways closed · Specialist review required';
  else if (giRisk() === 'very-high')                          concern = 'Active GI bleeding risk · All NSAIDs absolutely contraindicated';
  else if (P.egfr < 45 && giRisk() !== 'low')                concern = 'Compound renal + GI risk · NSAID pathway closed · Escalation pathway narrowing';
  else if (P.egfr < 60 && giRisk() !== 'low')                concern = 'Progressive renal decline · NSAID pathway closed';
  else if (P.pain >= 8 && nsaidContraindicated())             concern = 'Severe pain · Escalation options severely constrained';
  else if (egfrRisk() !== 'low')                              concern = 'Renal impairment (eGFR ' + P.egfr + ') · Monitoring burden elevated';
  else if (giRisk() !== 'low')                                concern = 'GI safety risk · NSAID class contraindicated';
  else                                                         concern = 'Polypharmacy burden · Adherence and interaction monitoring required';
  concernEl.textContent = concern;

  var action, actionAlt;
  if (apapContraindicated() && nsaidContraindicated()) {
    action = 'Initiate specialist referral — no safe first-line analgesic available';
    actionAlt = 'Deprescribing review + pain team input';
  } else if (apapContraindicated()) {
    action = 'Consider low-dose NSAID + PPI cover — monitor renal and GI closely';
    actionAlt = 'Review in 2 weeks — eGFR + GI symptoms';
  } else if (multimodalFailure()) {
    action = 'Reassess opioid pathway candidacy — specialist oversight recommended';
    actionAlt = 'Consider deprescribing concurrent agents before opioid initiation';
  } else if (P.egfr < 45) {
    action = 'Dose-adjust acetaminophen — max ' + (P.egfr < 30 ? '2' : '2.5') + ' g/day — reassess renal function at 2 weeks';
    actionAlt = 'Avoid all NSAIDs — renal risk prohibitive';
  } else if (P.pain >= 8 && !apapContraindicated()) {
    action = 'Escalate to topical diclofenac gel if acetaminophen inadequate at Week 4';
    actionAlt = 'Monitor NRS at Week 2 before escalation decision';
  } else {
    action = 'Initiate acetaminophen TID — obtain baseline eGFR today';
    actionAlt = 'Review at Week 2 before escalation decision';
  }
  actionEl.textContent = action;
  if (actionAltEl) actionAltEl.textContent = actionAlt;
}


/* ════════════════════════════════════════════════════════════
   SECTION 17 — PHARMACIST INTERVENTION PANEL
════════════════════════════════════════════════════════════ */

function updateInterventionPanel(rec) {
  var complexity = computeComplexity();

  // Priority classification
  var priorityClass, priorityLabel, tierClass, tierLabel;
  if (apapContraindicated() && nsaidContraindicated()) {
    priorityClass = 'pi-prio-high';     priorityLabel = 'Urgent — no safe first-line identified';
    tierClass = 'pi-tier-urgent'; tierLabel = 'Urgent';
  } else if (P.egfr < 30 || giRisk() === 'very-high') {
    priorityClass = 'pi-prio-high';     priorityLabel = 'High priority — renal / GI safety concern';
    tierClass = 'pi-tier-urgent'; tierLabel = 'High';
  } else if (P.egfr < 45 || (nsaidContraindicated() && P.pain >= 7)) {
    priorityClass = 'pi-prio-elevated'; priorityLabel = 'Elevated — review before next prescribing';
    tierClass = 'pi-tier-high'; tierLabel = 'Elevated';
  } else if (nsaidContraindicated() || P.adh === 'poor' || complexity >= 60) {
    priorityClass = 'pi-prio-monitor';  priorityLabel = 'Monitor — Week 2 contact required';
    tierClass = 'pi-tier-monitor'; tierLabel = 'Monitor';
  } else if (P.pain >= 6 || P.adh === 'partial') {
    priorityClass = 'pi-prio-monitor';  priorityLabel = 'Follow-up at Week 2';
    tierClass = 'pi-tier-monitor'; tierLabel = 'Follow-up';
  } else {
    priorityClass = 'pi-prio-routine';  priorityLabel = 'Routine review';
    tierClass = 'pi-tier-routine'; tierLabel = 'Routine';
  }

  var tierBadge = document.getElementById('pi-priority-tier-badge');
  if (tierBadge) { tierBadge.className = 'pi-priority-tier ' + tierClass; tierBadge.textContent = tierLabel; }

  var badge   = document.getElementById('pi-priority-badge');
  var labelEl = document.getElementById('pi-priority-label');
  if (badge)   badge.className = 'pi-priority-badge ' + priorityClass;
  if (labelEl) labelEl.textContent = priorityLabel;

  // Sidebar status
  var sidebarDot  = document.getElementById('dp-intervention-status-dot');
  var sidebarText = document.getElementById('dp-intervention-status-text');
  if (sidebarDot && sidebarText) {
    sidebarDot.className = 'dp-risk-dot';
    if (priorityClass === 'pi-prio-high') {
      sidebarDot.classList.add('dp-risk-dot-red');
      sidebarText.textContent = 'Act now — safety intervention required';
    } else if (priorityClass === 'pi-prio-elevated') {
      sidebarDot.classList.add('dp-risk-dot-amber');
      sidebarText.textContent = 'Review before next prescribing contact';
    } else if (priorityClass === 'pi-prio-monitor') {
      sidebarDot.classList.add('dp-risk-dot-amber');
      sidebarText.textContent = 'Week 2 follow-up — confirm adherence + eGFR';
    } else {
      sidebarDot.classList.add('dp-risk-dot-green');
      sidebarText.textContent = 'Routine review — no urgent action';
    }
  }

  // Action verb
  var actionVerbEl = document.getElementById('pi-action-verb');
  if (actionVerbEl) {
    if (apapContraindicated() && nsaidContraindicated()) actionVerbEl.textContent = 'Refer — specialist input needed';
    else if (P.egfr < 30)                               actionVerbEl.textContent = 'Dose-adjust and escalate monitoring';
    else if (P.egfr < 45)                               actionVerbEl.textContent = 'Dose-reduce — renal risk active';
    else if (multimodalFailure())                        actionVerbEl.textContent = 'Review pathway — specialist input';
    else if (P.pain >= 8 && !apapContraindicated())      actionVerbEl.textContent = 'Escalate if not controlled at Wk 4';
    else                                                 actionVerbEl.textContent = 'Initiate today';
  }

  // Panel title
  var titleEl = document.getElementById('pi-title');
  if (titleEl) {
    if (apapContraindicated() && nsaidContraindicated()) titleEl.textContent = 'Medication Review — Specialist Pathway Assessment';
    else if (P.egfr < 45)                               titleEl.textContent = 'Medication Review — Renal Safety Assessment';
    else if (multimodalFailure())                        titleEl.textContent = 'Medication Review — Deprescribing & Escalation Review';
    else if (P.pain >= 8)                                titleEl.textContent = 'Medication Review — Analgesic Escalation Assessment';
    else                                                 titleEl.textContent = 'Medication Review — Analgesic Safety Assessment';
  }

  // Main intervention + sub-actions
  var mainEl = document.getElementById('pi-intervention-main');
  var sub1El = document.getElementById('pi-sub-1');
  var sub2El = document.getElementById('pi-sub-2');
  var sub3El = document.getElementById('pi-sub-3');

  var mainText, sub1, sub2, sub3, sub1Dot, sub2Dot, sub3Dot;
  if (apapContraindicated() && nsaidContraindicated()) {
    mainText='Initiate specialist referral — no safe first-line analgesic identified'; sub1='Review full medication list for deprescribing opportunities'; sub2='Consider pain medicine or rheumatology co-management'; sub3='Hold analgesic escalation pending specialist input';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-amber';
  } else if (apapContraindicated()) {
    mainText='Initiate low-dose NSAID + PPI cover — intensive monitoring pathway'; sub1='eGFR check at 2 weeks — flag any decline ≥10%'; sub2='GI symptom review at every contact'; sub3='Do not deprescribe PPI — GI risk remains active';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-amber';
  } else if (multimodalFailure()) {
    mainText='Reassess analgesic pathway — consider deprescribing review'; sub1='Review all 7 concurrent agents for interaction burden'; sub2='Opioid candidacy requires sedation risk reassessment'; sub3='Document failure rationale before next escalation';
    sub1Dot='pi-dot-amber'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-blue';
  } else if (P.egfr < 30) {
    mainText='Dose-adjust acetaminophen to 2 g/day max — nephrology review'; sub1='Weekly eGFR monitoring — all renally-cleared drugs at risk'; sub2='Avoid NSAIDs absolutely — prostaglandin-dependent renal perfusion'; sub3='Review entire medication list for renal dose adjustment';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-red'; sub3Dot='pi-dot-amber';
  } else if (P.egfr < 45) {
    mainText='Dose-reduce acetaminophen to 2.5 g/day — intensify renal follow-up'; sub1='Renal function check at 2 and 4 weeks'; sub2='NSAID pathway closed — renal risk prohibitive at eGFR ' + P.egfr; sub3='Document eGFR trajectory before Month 3 review';
    sub1Dot='pi-dot-red'; sub2Dot='pi-dot-red'; sub3Dot='pi-dot-amber';
  } else if (P.pain >= 8 && !apapContraindicated()) {
    mainText='Escalate to topical diclofenac gel — if acetaminophen inadequate at Week 4'; sub1='Confirm fixed-schedule acetaminophen use before escalation decision'; sub2='eGFR recheck before topical NSAID — confirm eGFR ≥50'; sub3='Document pain trajectory from NRS baseline';
    sub1Dot='pi-dot-amber'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-blue';
  } else {
    mainText='Initiate acetaminophen TID (fixed schedule) — obtain baseline eGFR today'; sub1='Obtain baseline eGFR before Week 2 contact'; sub2='Confirm adherence at Week 2 — do not escalate on PRN use'; sub3='Maintain pantoprazole 40 mg — do not deprescribe at this stage';
    sub1Dot='pi-dot-amber'; sub2Dot='pi-dot-amber'; sub3Dot='pi-dot-blue';
  }

  if (mainEl) mainEl.textContent = mainText;
  function setSub(el, text, dotClass) {
    if (!el) return;
    el.textContent = text;
    var dotEl = el.previousElementSibling;
    if (dotEl) dotEl.className = 'pi-sub-dot ' + dotClass;
  }
  setSub(sub1El, sub1, sub1Dot);
  setSub(sub2El, sub2, sub2Dot);
  setSub(sub3El, sub3, sub3Dot);

  // Urgency items
  var urgencyContainer = document.getElementById('pi-urgency-items');
  if (urgencyContainer) {
    var urgencyItems = [];
    if      (P.egfr < 30)      urgencyItems.push({ cls:'urg-red',   text:'<strong>Severe renal impairment (eGFR ' + P.egfr + ')</strong> — dose-adjust all renally-cleared drugs now; acetaminophen ceiling 2 g/day' });
    else if (P.egfr < 45)      urgencyItems.push({ cls:'urg-red',   text:'<strong>eGFR ' + P.egfr + ' — moderate CKD</strong> — NSAID pathway closed; check renal function at 2 and 4 weeks' });
    else if (P.egfr < 60)      urgencyItems.push({ cls:'urg-amber', text:'<strong>eGFR ' + P.egfr + ' — CKD Stage 3a</strong> — no prior trend; order baseline today, recheck at Week 6 before any escalation decision' });

    if      (giRisk()==='very-high') urgencyItems.push({ cls:'urg-red',   text:'<strong>Active or recent GI bleed</strong> — NSAIDs absolutely contraindicated; check GI symptoms at every contact' });
    else if (giRisk()==='high')      urgencyItems.push({ cls:'urg-amber', text:'<strong>Prior peptic ulcer — GI risk high</strong> — NSAIDs contraindicated; maintain PPI cover, do not deprescribe pantoprazole' });

    if (nsaidContraindicated() && P.pain >= 7)
      urgencyItems.push({ cls:'urg-amber', text:'<strong>NRS ' + P.pain + '/10 with NSAID pathway closed</strong> — escalation options are narrow; document pain trajectory at Wk 2 before next decision' });
    else if (P.pain >= 8)
      urgencyItems.push({ cls:'urg-amber', text:'<strong>Severe pain (NRS ' + P.pain + '/10)</strong> — acetaminophen monotherapy likely inadequate; combination threshold reached at Week 4' });

    if      (P.adh === 'poor')    urgencyItems.push({ cls:'urg-amber', text:'<strong>Poor adherence</strong> — do not escalate until confirmed at Week 2; Week 4 NRS cannot be interpreted without dosing verification' });
    else if (P.adh === 'partial') urgencyItems.push({ cls:'urg-blue',  text:'<strong>Inconsistent PRN use</strong> — prescribe TID fixed schedule today; subtherapeutic exposure will confound Week 4 review' });

    if (complexity >= 75)  urgencyItems.push({ cls:'urg-amber', text:'<strong>7-agent regimen — high complexity</strong> — review for interaction burden; deprescribing candidates: identify at Month 3 review' });
    if (multimodalFailure()) urgencyItems.push({ cls:'urg-red',  text:'<strong>All non-opioid options exhausted</strong> — specialist referral required before any further pharmacotherapy' });

    if (urgencyItems.length === 0)
      urgencyItems.push({ cls:'urg-blue', text:'<strong>No escalating concern identified</strong> — standard monitoring schedule applies; review at Week 2 as planned' });

    urgencyContainer.innerHTML = urgencyItems.map(function(item) {
      return '<div class="pi-urgency-item ' + item.cls + '">' +
        '<svg class="pi-urgency-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
        '<span>' + item.text + '</span></div>';
    }).join('');
  }

  // Follow-up consequence items
  var followupContainer = document.getElementById('pi-followup-items');
  if (followupContainer) {
    var followupItems = [];
    if      (P.egfr < 45) followupItems.push({ strong:'Missed dose-adjustment window',      text:' — eGFR may continue to decline without dose ceiling in place; accumulation risk increases' });
    else if (P.egfr < 60) followupItems.push({ strong:'Escalation decision without renal data',   text:' — baseline eGFR not available; cannot confirm eGFR ≥50 required for topical NSAID at Wk 4' });

    if (giRisk() !== 'low')
      followupItems.push({ strong:'Analgesic use without GI reassessment', text:' — prolonged PPI omission or analgesic substitution may go undetected' });

    if (P.adh === 'partial' || P.adh === 'poor')
      followupItems.push({ strong:'Week 4 escalation decision becomes invalid', text:' — cannot distinguish treatment failure from subtherapeutic dosing without adherence confirmation at Wk 2' });

    if (nsaidContraindicated() && P.pain >= 6)
      followupItems.push({ strong:'Pain uncontrolled — no objective reassessment',  text:' — NRS trajectory unknown; escalation timing window may close with further renal decline' });

    if (complexity >= 70)
      followupItems.push({ strong:'Interaction risk unreviewed', text:' — 7-agent regimen; any new prescription requires interaction check against current list' });

    if (followupItems.length === 0)
      followupItems.push({ strong:'Pain review delayed', text:' — NRS trajectory at Week 2 is the first data point for escalation decision; delay pushes this to Month 3 review' });

    followupContainer.innerHTML = followupItems.map(function(item) {
      return '<div class="pi-followup-item">' +
        '<span class="pi-followup-arrow">›</span>' +
        '<span><strong>' + item.strong + '</strong>' + item.text + '</span>' +
        '</div>';
    }).join('');
  }

  // Next contact text
  var nextContactEl = document.getElementById('pi-next-contact-text');
  if (nextContactEl) {
    if      (P.egfr < 30) nextContactEl.textContent = 'Next contact: 1 week — eGFR + safety review + dose check';
    else if (P.egfr < 45) nextContactEl.textContent = 'Next contact: 2 weeks — eGFR + dose-adjustment confirmation';
    else                  nextContactEl.textContent = 'Week 2 — confirm TID adherence, NRS, eGFR status. Do not escalate until adherence verified.';
  }

  // Action pathway steps
  var pathwayStepsEl = document.getElementById('pi-pathway-steps');
  var pathwayNoteEl  = document.getElementById('pi-pathway-note');
  if (pathwayStepsEl) {
    var steps;
    if (apapContraindicated() && nsaidContraindicated()) {
      steps = [
        { label:'NSAIDs — CI', cls:'pi-step-closed' }, { label:'Acetaminophen — CI', cls:'pi-step-closed' },
        { label:'Specialist Referral', cls:'pi-step-active' }, { label:'Deprescribing Review', cls:'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Refer to pain medicine or rheumatology before initiating further pharmacotherapy';
    } else if (P.egfr < 30) {
      steps = [
        { label:'NSAIDs — absolute CI', cls:'pi-step-closed' }, { label:'Acetaminophen ≤2 g/day', cls:'pi-step-active' },
        { label:'Nephrology review', cls:'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Renal protection is the overriding priority; analgesic ceiling applies at all stages';
    } else if (multimodalFailure()) {
      steps = [
        { label:'NSAIDs — CI', cls:'pi-step-closed' }, { label:'Acetaminophen — failed', cls:'pi-step-closed' },
        { label:'Deprescribing review', cls:'pi-step-active' }, { label:'Opioid candidacy assessment', cls:'pi-step-conditional' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Opioid pathway candidacy requires specialist oversight — document all failure rationale first';
    } else if (P.pain >= 8 && !apapContraindicated()) {
      steps = [
        { label:'Acetaminophen TID', cls:'pi-step-active' }, { label:'Topical diclofenac gel (Wk 4)', cls:'pi-step-conditional' },
        { label:'Duloxetine 30–60 mg', cls:'pi-step-conditional' }, { label:'NSAIDs — CI', cls:'pi-step-closed' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Escalate to topical diclofenac at Week 4 if NRS ≥6 on confirmed TID use; eGFR ≥50 required';
    } else {
      steps = [
        { label:'Acetaminophen TID — now', cls:'pi-step-active' }, { label:'Topical diclofenac (Wk 4+)', cls:'pi-step-conditional' },
        { label:'Duloxetine 30 mg (neuropathic)', cls:'pi-step-conditional' }, { label:'NSAIDs — CI', cls:'pi-step-closed' }
      ];
      if (pathwayNoteEl) pathwayNoteEl.textContent = 'Wk 2: confirm adherence + NRS · Wk 4: escalation decision if NRS ≥6 or inadequate response on TID schedule';
    }

    pathwayStepsEl.innerHTML = steps.map(function(step, i) {
      var arrow = i < steps.length - 1 ? '<span class="pi-pathway-arrow">›</span>' : '';
      return '<span class="pi-pathway-step ' + step.cls + '">' + step.label + '</span>' + arrow;
    }).join('');
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 18 — HANDOFF SECTION
════════════════════════════════════════════════════════════ */

var _activeHandoffType = 'pharmacist';

function selectHandoffType(type, btn) {
  document.querySelectorAll('.hf-doc-type').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  _activeHandoffType = type;

  var docIds = ['pharmacist','monitoring','escalation','attending','risk','rationale','followup'];
  docIds.forEach(function(id) {
    var el = document.getElementById('hf-doc-' + id);
    if (el) el.style.display = (id === type) ? 'block' : 'none';
  });
}

function copyHandoffDocument() {
  var doc = document.getElementById('hf-doc-' + _activeHandoffType);
  if (!doc) return;

  var lines = [];
  var header = doc.querySelector('.hf-doc-title');
  var sub    = doc.querySelector('.hf-doc-subtitle');
  if (header) lines.push(header.textContent.toUpperCase());
  if (sub)    lines.push(sub.textContent);
  lines.push('');

  doc.querySelectorAll('.hf-section').forEach(function(section) {
    var headEl = section.querySelector('.hf-section-head');
    if (headEl) lines.push('── ' + headEl.textContent.trim() + ' ──');
    section.querySelectorAll('.hf-line, .hf-line-flag, .hf-action-item, .hf-risk-row').forEach(function(el) {
      lines.push(el.textContent.trim().replace(/\s+/g,' '));
    });
    var callout = section.querySelector('.hf-amber-callout, .hf-escalation-callout');
    if (callout) lines.push(callout.textContent.trim().replace(/\s+/g,' '));
    lines.push('');
  });

  var sig = doc.querySelector('.hf-sig-block');
  if (sig) { lines.push('──'); lines.push(sig.textContent.trim().replace(/\s+/g,' ')); }

  var text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      var btns = doc.querySelectorAll('.hf-copy-btn');
      btns.forEach(function(btn) {
        btn.classList.add('copied');
        btn.textContent = 'Copied';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
        }, 2000);
      });
    });
  }
}

function updateHandoffMeta() {
  var painEl    = document.getElementById('hf-meta-pain');
  var egfrEl    = document.getElementById('hf-meta-egfr');
  var complexEl = document.getElementById('hf-meta-complexity');

  if (painEl) {
    painEl.textContent = P.pain + ' / 10';
    painEl.className = 'hf-meta-val ' + (P.pain >= 8 ? 'val-red' : P.pain >= 6 ? 'val-amber' : 'val-green');
  }
  if (egfrEl) {
    egfrEl.textContent = P.egfr + ' mL/min';
    egfrEl.className = 'hf-meta-val ' + (P.egfr < 45 ? 'val-red' : P.egfr < 60 ? 'val-amber' : 'val-green');
  }
  if (complexEl) {
    var score = computeComplexity();
    complexEl.textContent = score + ' / 100';
    complexEl.className = 'hf-meta-val ' + (score >= 75 ? 'val-red' : score >= 50 ? 'val-amber' : 'val-green');
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 19 — POLYPHARMACY & INTERACTIONS ENGINE
════════════════════════════════════════════════════════════ */

function updatePolypharmacyPanel() {
  updateRenalCascadeHighlight();
  updatePolyBurdenBadge();
  updatePolyInteractionFlags();
  updatePolyMonitoringBanner();
  updateReactiveDoseLabels();
}

function updateRenalCascadeHighlight() {
  ['renal-row-60plus','renal-row-4559','renal-row-3044','renal-row-under30'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('renal-active-row');
    var egfrCell = el.querySelector('.renal-cascade-egfr');
    if (egfrCell) egfrCell.classList.remove('egfr-current');
    var marker = el.querySelector('.renal-active-marker');
    if (marker) marker.style.display = 'none';
  });

  var activeId;
  if      (P.egfr >= 60) activeId = 'renal-row-60plus';
  else if (P.egfr >= 45) activeId = 'renal-row-4559';
  else if (P.egfr >= 30) activeId = 'renal-row-3044';
  else                   activeId = 'renal-row-under30';

  var activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add('renal-active-row');
    var egfrCell = activeEl.querySelector('.renal-cascade-egfr');
    if (egfrCell) egfrCell.classList.add('egfr-current');
    var marker = activeEl.querySelector('.renal-active-marker');
    if (!marker) {
      egfrCell = activeEl.querySelector('.renal-cascade-egfr');
      if (egfrCell) {
        var m = document.createElement('span');
        m.className = 'renal-active-marker';
        m.textContent = 'CURRENT';
        egfrCell.appendChild(m);
      }
    } else {
      marker.style.display = '';
    }
  }

  var inlineEgfr = document.getElementById('poly-egfr-inline');
  if (inlineEgfr) inlineEgfr.textContent = P.egfr;
  var currentEgfrLabel = document.getElementById('poly-renal-current-egfr');
  if (currentEgfrLabel) currentEgfrLabel.textContent = 'Current eGFR: ' + P.egfr + ' mL/min';
}

function updatePolyBurdenBadge() {
  var badge = document.getElementById('poly-burden-badge');
  if (badge) {
    var complexity = computeComplexity();
    if (complexity >= 70 || P.egfr < 30) {
      badge.className = 'poly-burden-badge burden-high'; badge.textContent = 'High burden';
    } else if (complexity >= 45 || P.egfr < 50 || nsaidContraindicated()) {
      badge.className = 'poly-burden-badge burden-mod';  badge.textContent = 'Moderate burden';
    } else {
      badge.className = 'poly-burden-badge burden-low';  badge.textContent = 'Low burden';
    }
  }

  // Interaction rail
  var intVal  = document.getElementById('poly-rail-int-val');
  var intNote = document.getElementById('poly-rail-int-note');
  var intRail = document.getElementById('poly-rail-interactions');
  if (intVal && intNote) {
    if (nsaidContraindicated()) {
      intVal.textContent  = '0 active interactions';
      intNote.textContent = 'Amlodipine–NSAID interaction fully prevented by NSAID exclusion. Acetaminophen carries no clinically significant interactions with current regimen.';
      if (intRail) intRail.className = 'safety-rail-item srl-green';
    } else {
      intVal.textContent  = '1–2 monitor-level pairs';
      intNote.textContent = 'NSAID pathway conditionally accessible — amlodipine–NSAID BP interaction monitoring required if initiated. Review before prescribing.';
      if (intRail) intRail.className = 'safety-rail-item srl-amber';
    }
  }

  // Renal rail
  var renalVal  = document.getElementById('poly-rail-renal-val');
  var renalNote = document.getElementById('poly-rail-renal-note');
  var renalRail = document.getElementById('poly-rail-renal');
  if (renalVal && renalNote) {
    if (P.egfr < 30) {
      renalVal.textContent  = '2 adjustments active';
      renalNote.textContent = 'Severe renal impairment — APAP ceiling 2 g/day, all NSAIDs absolutely contraindicated, opioid metabolite accumulation risk. Nephrology input required.';
      if (renalRail) renalRail.className = 'safety-rail-item srl-red';
    } else if (P.egfr < 45) {
      renalVal.textContent  = '2 adjustments active';
      renalNote.textContent = 'Moderate CKD — APAP max 2.5 g/day, NSAIDs absolutely contraindicated, close monitoring required. Nephrology co-management if declining.';
      if (renalRail) renalRail.className = 'safety-rail-item srl-red';
    } else if (P.egfr < 60) {
      renalVal.textContent  = '1 dose ceiling active';
      renalNote.textContent = 'Acetaminophen ceiling at 3 g/day (older adult + G3a CKD). NSAIDs excluded — renal constraint plus documented intolerance. Monitor eGFR trajectory 6-weekly.' + (P.egfr >= 50 && P.egfr <= 62 ? ' Trajectory unconfirmed — no prior eGFR on record.' : '');
      if (renalRail) renalRail.className = 'safety-rail-item srl-amber';
    } else {
      renalVal.textContent  = 'Standard dosing';
      renalNote.textContent = 'eGFR ≥60 — standard analgesic dosing permissible on renal grounds. Age-adjusted ceiling (older adult 3 g/day) still applies.';
      if (renalRail) renalRail.className = 'safety-rail-item srl-green';
    }
  }
}

function updatePolyInteractionFlags() {
  var amlNsaidFlag   = document.getElementById('poly-aml-nsaid-flag');
  var amlNsaidDetail = document.getElementById('poly-aml-nsaid-detail');
  var intSev         = document.getElementById('poly-int-aml-nsaid-sev');
  var intMech        = document.getElementById('poly-int-aml-nsaid-mech');

  if (nsaidContraindicated()) {
    if (amlNsaidFlag)   { amlNsaidFlag.className = 'poly-interaction-flag poly-flag-green'; amlNsaidFlag.textContent = '✓ NSAID excluded — interaction prevented'; }
    if (amlNsaidDetail) amlNsaidDetail.textContent = 'NSAIDs are contraindicated in this patient profile. The amlodipine–NSAID interaction is fully mitigated by NSAID exclusion. No monitoring required for this pair on current regimen.';
    if (intSev) { intSev.className = 'poly-int-severity poly-int-sev-ok'; intSev.textContent = 'Risk eliminated'; }
    if (intMech) intMech.textContent = 'NSAIDs excluded from this patient\'s regimen due to documented intolerance and contraindication profile. Amlodipine antihypertensive efficacy is therefore not at risk. This interaction becomes clinically relevant again only if NSAID restrictions are revisited — which would require specialist review.';
  } else {
    if (amlNsaidFlag)   { amlNsaidFlag.className = 'poly-interaction-flag poly-flag-amber'; amlNsaidFlag.textContent = '⚠ NSAID: monitor BP'; }
    if (amlNsaidDetail) amlNsaidDetail.textContent = 'NSAIDs are conditionally accessible at current parameters. If initiated: BP monitoring at 2 weeks is mandatory. Prior response (+18 mmHg with diclofenac) indicates high individual sensitivity.';
    if (intSev) { intSev.className = 'poly-int-severity poly-int-sev-avoid'; intSev.textContent = 'Monitor closely'; }
    if (intMech) intMech.textContent = 'NSAIDs impair prostaglandin-mediated vasodilation and promote sodium retention, opposing CCB antihypertensive effect. In this patient, diclofenac previously caused +18 mmHg systolic rise. If NSAID pathway becomes necessary: low-dose, shortest duration, BP check at 2 weeks.';
  }
}

function updateReactiveDoseLabels() {
  var apapLabel  = document.getElementById('poly-apap-renal-label');
  var apapDetail = document.getElementById('poly-apap-renal-detail');
  if (apapLabel && apapDetail) {
    if (P.egfr < 30) {
      apapLabel.className = 'poly-renal-dose renal-ci';
      apapLabel.textContent = 'Dose reduction required (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 2 g/day with extended dosing interval (every 6–8 hours). Avoid combination with hepatotoxic agents. Monitor LFTs at 4 weeks. Nephrology input required before any analgesic escalation.';
    } else if (P.egfr < 45) {
      apapLabel.className = 'poly-renal-dose renal-adjust';
      apapLabel.textContent = 'Dose ceiling reduced (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 2.5 g/day — moderate CKD with declining renal function. Monitor LFTs. Avoid co-prescribing other hepatotoxic agents. Extend interval to every 6 hours if needed.';
    } else if (P.egfr < 60) {
      apapLabel.className = 'poly-renal-dose renal-adjust';
      apapLabel.textContent = 'Dose ceiling active (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 3 g/day — older adult + G3a CKD ceiling. Standard elderly limit applies. Monitor eGFR trajectory every 6 weeks. If eGFR drops below 45, tighten ceiling to 2.5 g/day.';
    } else {
      apapLabel.className = 'poly-renal-dose renal-ok';
      apapLabel.textContent = 'Standard older-adult dose (eGFR ' + P.egfr + ')';
      apapDetail.textContent = 'Max 3 g/day (older adult ceiling applies regardless of eGFR at age ' + P.age + '). Renal function is not the dose-limiting factor at current eGFR.';
    }
  }
}

function updatePolyMonitoringBanner() {
  var banner   = document.getElementById('poly-monitoring-banner');
  var label    = document.getElementById('poly-mib-label');
  var text     = document.getElementById('poly-mib-text');
  var schedule = document.getElementById('poly-mib-schedule');
  if (!banner || !label || !text || !schedule) return;

  var complexity           = computeComplexity();
  var renalTrendUnknown    = (P.egfr >= 50 && P.egfr <= 62);
  var adherenceUnverified  = (P.adh === 'partial' || P.adh === 'unknown');

  if (P.egfr < 30 || complexity >= 75) {
    banner.className = 'monitoring-intensity-banner mib-high';
    label.textContent = 'High intensity';
    text.textContent = 'Severely impaired renal function and high overall complexity require compressed monitoring intervals. Post-change labs within 2 weeks. Any new drug addition at this stage requires nephrology and pharmacy co-review before prescribing.';
    schedule.textContent = 'Labs at 2 weeks + 4 weeks';
  } else if (P.egfr < 45 || (nsaidContraindicated() && P.bp >= 150)) {
    banner.className = 'monitoring-intensity-banner mib-high';
    label.textContent = 'Elevated intensity';
    text.textContent = 'Moderate CKD with eGFR ' + P.egfr + ' mL/min and NSAID contraindication active. Post-change monitoring prioritises renal trajectory and analgesic tolerability. eGFR at 4 weeks is a non-optional safety check.';
    schedule.textContent = 'eGFR at 4 weeks · BP monthly';
  } else if (complexity >= 50 || P.adh === 'poor') {
    banner.className = 'monitoring-intensity-banner mib-mod';
    label.textContent = 'Moderate intensity';
    if (P.adh === 'poor') {
      text.textContent = 'Poor adherence history is the dominant monitoring concern at this stage — monitoring intensity is driven by adherence verification, not drug interaction risk. Confirm fixed schedule at week 2 before any dose titration or escalation decision.';
      schedule.textContent = 'Adherence check wk 2 · Labs wk 6';
    } else {
      text.textContent = 'Moderate complexity profile — renal trajectory and GI tolerability are the primary monitoring concerns. Post-change assessment should confirm acetaminophen tolerability and GI stability at week 2, with eGFR and LFT at 6 weeks.';
      schedule.textContent = 'Clinical wk 2 · Labs wk 6';
    }
  } else if (renalTrendUnknown && adherenceUnverified) {
    banner.className = 'monitoring-intensity-banner mib-mod';
    label.textContent = 'Moderate intensity — uncertainty-adjusted';
    text.textContent = 'Profile would warrant routine monitoring on documented parameters alone, but two unresolved uncertainties increase caution: (1) eGFR ' + P.egfr + ' sits at the G2/G3a boundary with no prior result to establish trend direction; (2) adherence is self-reported and unverified. Monitoring is treated as moderate until both are confirmed. Do not defer baseline labs.';
    schedule.textContent = 'Baseline labs Day 1 · Adherence wk 2 · eGFR wk 6';
  } else if (renalTrendUnknown) {
    banner.className = 'monitoring-intensity-banner mib-mod';
    label.textContent = 'Moderate intensity — renal trend unconfirmed';
    text.textContent = 'Renal function sits at the G2/G3a boundary (eGFR ' + P.egfr + ') without prior measurements to establish trajectory. Monitoring is conservatively elevated until at least one follow-up eGFR establishes whether function is stable, improving, or declining. Obtain baseline labs at this visit.';
    schedule.textContent = 'Baseline eGFR Day 1 · Recheck wk 6';
  } else {
    banner.className = 'monitoring-intensity-banner mib-routine';
    label.textContent = 'Routine intensity';
    text.textContent = 'Current regimen change carries low pharmacological risk. Monitoring is standard for this complexity level — adherence confirmation at week 2 and routine labs at 6 weeks are appropriate. No compressed monitoring intervals required.';
    schedule.textContent = 'Review wk 2 · Labs wk 6';
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 20 — LONGITUDINAL PROGRESSION ENGINE
════════════════════════════════════════════════════════════ */

var P_BASELINE    = null;
var LP_CURRENT_TP = 0;


// Timepoint definitions moved to data/oa-content.js
// LP_TIMEPOINTS is aliased from OA_TIMEPOINTS at runtime
var LP_TIMEPOINTS = OA_TIMEPOINTS;


function initLongitudinalProgression() {
  P_BASELINE = {
    egfr: P.egfr, gi: P.gi, bp: P.bp, cv: P.cv,
    pain: P.pain, age: P.age, failed: P.failed,
    adh:  P.adh,  sed: P.sed, intol: P.intol
  };
  renderTimepointButtons(0);
  updatePathwayStates(0);
}

function setTimepoint(idx) {
  LP_CURRENT_TP = idx;
  var tp = LP_TIMEPOINTS[idx];

  Object.assign(P, P_BASELINE);

  var d = tp.drift;
  if (d.egfr  !== undefined) P.egfr  = Math.max(10, P_BASELINE.egfr  + d.egfr);
  if (d.bp    !== undefined) P.bp    = Math.max(100, P_BASELINE.bp   + d.bp);
  if (d.pain  !== undefined) P.pain  = Math.max(1, Math.min(10, P_BASELINE.pain + d.pain));
  if (d.adh   !== undefined) P.adh   = d.adh;
  if (d.cv    !== undefined) P.cv    = d.cv;

  runReasoningEngine();
  updatePolypharmacyPanel();
  renderTimepointButtons(idx);
  renderDeltaStrip(tp);
  renderMissedBanner(idx);
  updatePathwayStates(idx);

  // Sync popover sliders to updated P values
  ['egfr','bp','pain'].forEach(function(key) {
    var cfg  = POPOVER_INPUTS[key];
    var rng  = document.getElementById(cfg.id);
    var valEl = document.getElementById(cfg.valId);
    if (rng)   rng.value = P[key];
    if (valEl) valEl.textContent = P[key];
  });
}

// ── Timepoint button rendering ──
function renderTimepointButtons(activeIdx) {
  for (var i = 0; i < LP_TIMEPOINTS.length; i++) {
    var btn = document.getElementById('lp-tp-' + i);
    if (!btn) continue;
    btn.className = 'lp-tp ' + (i < activeIdx ? 'lp-past' : i === activeIdx ? 'lp-active' : 'lp-future');

    var dotEl = btn.querySelector('.lp-tp-dot');
    if (dotEl) {
      // Common dot dimensions
      dotEl.style.display      = 'inline-block';
      dotEl.style.width        = '6px';
      dotEl.style.height       = '6px';
      dotEl.style.borderRadius = '50%';
      if (i < activeIdx) {
        dotEl.style.background = 'var(--border)';
        dotEl.style.border     = 'none';
      } else if (i === activeIdx) {
        dotEl.style.background = 'var(--blue)';
        dotEl.style.border     = 'none';
      } else {
        dotEl.style.background = 'transparent';
        dotEl.style.border     = '1px solid var(--border)';
      }
    }

    // Status tag for past checkpoints
    var tp      = LP_TIMEPOINTS[i];
    var weekDiv = btn.querySelector('.lp-tp-week');
    if (weekDiv) {
      var existingTag = weekDiv.querySelector('.lp-status-tag');
      if (existingTag) existingTag.remove();
      if (i < activeIdx && tp.pathwayOutcomes && tp.pathwayOutcomes[i]) {
        var out    = tp.pathwayOutcomes[i];
        var tag    = document.createElement('span');
        var tagCls = 'lp-status-tag ';
        if      (out.cls === 'outcome-ok')        tagCls += 'lp-status-ok';
        else if (out.cls === 'outcome-escalated')  tagCls += 'lp-status-escalated';
        else if (out.cls === 'outcome-concern')    tagCls += 'lp-status-concern';
        else                                       tagCls += 'lp-status-missed';
        tag.className    = tagCls;
        tag.style.marginLeft = '5px';
        tag.textContent  = i === 0 ? 'Done' : out.cls === 'outcome-ok' ? 'Completed' : out.cls === 'outcome-escalated' ? 'Escalated' : 'Concern';
        weekDiv.appendChild(tag);
      }
    }
  }
}

// ── Delta strip rendering ──
function renderDeltaStrip(tp) {
  var delta = document.getElementById('lp-delta');
  if (!delta) return;

  if (!tp.delta) { delta.className = 'lp-delta'; return; }

  var d = tp.delta;
  delta.className = 'lp-delta lp-delta-visible' +
    (d.severity === 'alert' ? ' lp-delta-alert' : d.severity === 'warn' ? ' lp-delta-warn' : '');

  setEl('lp-delta-title', d.title);
  setEl('lp-delta-from',  d.from);
  setEl('lp-implication-text', d.implication);

  var implLabel = document.getElementById('lp-implication-label');
  if (implLabel) {
    implLabel.textContent = d.severity === 'alert' ? 'Escalation implication'
      : d.severity === 'warn' ? 'Management implication' : 'Reasoning implication';
  }

  var changesEl = document.getElementById('lp-delta-changes');
  if (changesEl) {
    changesEl.innerHTML = '';
    d.changes.forEach(function(c) {
      var row = document.createElement('div');
      row.className = 'lp-delta-item';
      row.innerHTML = '<span class="lp-delta-param">' + c.param + '</span>' +
                      '<span class="lp-delta-change">' + c.text + '</span>';
      changesEl.appendChild(row);
    });
  }
}

// ── Missed follow-up banner ──
function renderMissedBanner(idx) {
  var banner = document.getElementById('lp-missed-banner');
  if (!banner) return;

  if (idx === 3) {
    banner.className = 'lp-missed-banner lp-missed-visible';
    setEl('lp-missed-text', 'Escalation checkpoint at Week 4 was reached without adherence being confirmed. The renal trend that emerged between Weeks 4–8 (eGFR 55→51) occurred without a monitoring-triggered reassessment. Previously acceptable NSAID escalation paths are now narrowed by a decline that went undetected within the monitoring window.');
  } else if (idx === 4) {
    banner.className = 'lp-missed-banner lp-missed-visible';
    setEl('lp-missed-text', 'The eGFR threshold crossing (below 50 mL/min) at 3 months has closed the topical NSAID escalation pathway that was conditionally available at initiation. This represents a previously acceptable option becoming permanently unsafe due to monitored disease progression — not a prescribing error, but a clinically expected consequence of longitudinal CKD in this patient profile.');
  } else {
    banner.className = 'lp-missed-banner';
  }
}

// ── Pathway visual state update ──
function updatePathwayStates(activeIdx) {
  var tp = LP_TIMEPOINTS[activeIdx];
  if (!tp) return;

  for (var i = 0; i < 5; i++) {
    var item       = document.getElementById('lp-pathway-' + i);
    var dot        = document.getElementById('lp-pdot-' + i);
    var outcomeEl  = document.getElementById('lp-outcome-' + i);
    if (!item) continue;

    var state       = tp.pathwayStates[i];
    var outcomeData = tp.pathwayOutcomes ? tp.pathwayOutcomes[i] : null;

    item.classList.remove('lp-item-past', 'lp-item-active', 'lp-item-future');
    if      (state === 'past')   item.classList.add('lp-item-past');
    else if (state === 'active') item.classList.add('lp-item-active');
    else if (state === 'future') item.classList.add('lp-item-future');

    if (dot) {
      dot.className = 'mn-pathway-dot' + (state === 'active' ? ' active' : '');
      if (state === 'past') {
        dot.style.background  = 'var(--border)';
        dot.style.borderColor = 'var(--border)';
      } else if (state === 'active') {
        dot.style.background  = 'var(--blue)';
        dot.style.borderColor = 'var(--blue)';
      } else {
        dot.style.background  = '';
        dot.style.borderColor = '';
      }
    }

    if (outcomeEl) {
      if (outcomeData && state !== 'future') {
        var existingBadge = outcomeEl.querySelector('.lp-past-outcome');
        if (existingBadge) existingBadge.remove();
        var badge = document.createElement('span');
        badge.className  = 'lp-past-outcome ' + outcomeData.cls;
        badge.textContent = outcomeData.text;
        outcomeEl.appendChild(badge);
      } else {
        outcomeEl.innerHTML = '';
      }
    }
  }
}


/* ════════════════════════════════════════════════════════════
   SECTION 21A — CLINICAL STATUS SUMMARY
════════════════════════════════════════════════════════════ */

function updateClinicalStatusSummary() {
  var block = document.getElementById('css-block');
  if (!block) return;

  function setVal(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function setCls(id, cls) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = el.className.replace(/css-val-\w+/g, '').trim();
    if (cls) el.classList.add(cls);
  }

  // Clinical Status
  var statusKey = (P.egfr < 30 || P.bp >= 170 || giRisk() === 'very-high') ? 'unstable'
    : (P.egfr < 45 || P.bp >= 150 || giRisk() === 'high') ? 'guarded' : 'stable';
  var s = OA_CSS_STATUS[statusKey];
  setVal('css-status-val', s.val); setVal('css-status-sub', s.sub); setCls('css-status-val', s.cls);

  // Functional Impact
  var funcKey = P.pain >= 8 ? 'severe' : P.pain >= 6 ? 'moderate' : P.pain >= 4 ? 'mild_mod' : 'mild';
  var f = OA_CSS_FUNCTIONAL[funcKey];
  setVal('css-functional-val', f.val); setVal('css-functional-sub', f.sub); setCls('css-functional-val', f.cls);

  // Symptom Burden
  var symKey  = P.pain >= 8 ? 'high' : P.pain >= 6 ? 'mod_high' : P.pain >= 4 ? 'moderate' : 'low';
  var sm = OA_CSS_SYMPTOM_SEVERITY[symKey];
  setVal('css-symptom-val', sm.val);
  setVal('css-symptom-sub', OA_CSS_SYMPTOM_PREFIX + P.pain + '/10' + sm.suffix);
  setCls('css-symptom-val', sm.cls);

  // Risk Profile
  var eR = egfrRisk(); var gR = giRisk();
  var riskCount = (gR === 'high' || gR === 'very-high' ? 1 : 0)
    + (eR === 'moderate' || eR === 'severe' ? 2 : eR === 'mild' ? 1 : 0)
    + (ageFlag() ? 1 : 0)
    + (P.cv === 'high' || P.cv === 'very-high' ? 1 : 0)
    + (P.bp >= 150 ? 1 : 0);
  var riskKey = riskCount >= 5 ? 'high' : riskCount >= 3 ? 'mod_high' : riskCount >= 1 ? 'moderate' : 'low';
  var r = OA_CSS_RISK[riskKey];
  setVal('css-risk-val', r.val); setVal('css-risk-sub', r.sub); setCls('css-risk-val', r.cls);

  // Treatment Pathway
  var nsaidClosed = nsaidContraindicated();
  var opioidClosed = opioidAvoidable();
  var closedCount = (nsaidClosed ? 1 : 0) + (opioidClosed ? 1 : 0) + (acetaminophenFailed() ? 1 : 0);
  var pathKey = closedCount >= 3 ? 'exhausted' : (nsaidClosed && opioidClosed) ? 'constrained' : nsaidClosed ? 'restricted' : 'open';
  var p = OA_CSS_PATHWAY[pathKey];
  setVal('css-pathway-val', p.val); setVal('css-pathway-sub', p.sub); setCls('css-pathway-val', p.cls);

  // Intervention Urgency
  var urgKey = (P.pain >= 8 || gR === 'very-high' || P.egfr < 30) ? 'urgent'
    : (P.pain >= 6 || gR === 'high' || eR === 'mild') ? 'prompt' : 'routine';
  var u = OA_CSS_URGENCY[urgKey];
  setVal('css-urgency-val', u.val); setVal('css-urgency-sub', u.sub); setCls('css-urgency-val', u.cls);

  // Overall badge
  var badge = document.getElementById('css-overall-badge');
  var badgeLbl = document.getElementById('css-overall-label');
  if (badge && badgeLbl) {
    badge.className = 'css-overall-badge';
    var badgeKey = (statusKey === 'unstable' || riskKey === 'high') ? 'review'
      : (statusKey === 'guarded' || riskKey === 'mod_high') ? 'elevated' : 'stable';
    var b = OA_CSS_OVERALL_BADGE[badgeKey];
    if (b.cls) badge.classList.add(b.cls);
    badgeLbl.textContent = b.label;
  }

  // Reasoning chips
  var chipsEl = document.getElementById('css-reasoning-items');
  if (chipsEl) {
    var chips = [];
    if (gR === 'very-high' || gR === 'high')        chips.push({ label: 'GI risk binding',           cls: 'css-chip-red'   });
    if (eR === 'mild' || eR === 'moderate')          chips.push({ label: 'Renal monitoring required', cls: 'css-chip-amber' });
    if (eR === 'severe')                             chips.push({ label: 'Severe renal impairment',   cls: 'css-chip-red'   });
    if (P.failed === '2nsaid' || P.failed === 'multi') chips.push({ label: 'NSAID pathway closed ×2', cls: 'css-chip-amber' });
    else if (P.failed === '1nsaid')                  chips.push({ label: 'NSAID failed ×1',           cls: 'css-chip-amber' });
    if (ageFlag())                                   chips.push({ label: 'Age ≥65 (Beers)',           cls: 'css-chip-amber' });
    if (P.bp >= 150)                                 chips.push({ label: 'BP elevated',               cls: 'css-chip-amber' });
    if (!acetaminophenFailed() && !nsaidClosed)      chips.push({ label: 'Acetaminophen: first-line', cls: 'css-chip-blue'  });
    else if (!acetaminophenFailed())                 chips.push({ label: 'Acetaminophen: lowest systemic risk', cls: 'css-chip-blue' });
    if (P.adh === 'partial' || P.adh === 'poor')     chips.push({ label: 'Adherence concern',         cls: 'css-chip-amber' });
    chips.push({ label: 'ACR 2023 aligned', cls: 'css-chip-muted' });
    chipsEl.innerHTML = chips.map(function(c) {
      return '<span class="css-reasoning-chip ' + c.cls + '">' + c.label + '</span>';
    }).join('');
  }

  // Overall assessment text
  var parts = [];
  if (P.pain >= 8) parts.push('Severe pain at NRS ' + P.pain + '/10 with significant functional impairment.');
  else if (P.pain >= 6) parts.push('Patient remains symptomatic with moderate-to-severe pain (NRS ' + P.pain + '/10) and progressive functional limitation.');
  else parts.push('Moderate pain at NRS ' + P.pain + '/10 with manageable functional impact.');
  if (nsaidClosed && opioidClosed) parts.push('Analgesic options are significantly restricted by compound ' + (gR !== 'low' ? 'GI, ' : '') + (eR !== 'low' ? 'renal, ' : '') + 'and cardiovascular constraints.');
  else if (nsaidClosed) parts.push('NSAIDs are contraindicated; alternative analgesic strategies are required.');
  if (acetaminophenFailed()) parts.push('First-line acetaminophen has failed — pathway review and specialist input are required before escalation.');
  else if (nsaidClosed) parts.push('First-line treatment initiation is appropriate today — acetaminophen TID provides the best achievable safety-efficacy balance within the current constraint profile.');
  else parts.push('Treatment initiation is appropriate — acetaminophen is recommended as first-line with close monitoring.');
  var overallEl = document.getElementById('css-assessment-text'); if (overallEl) overallEl.textContent = parts.join(' ');

  // Block title
  var tpLabels = ['Day 1', 'Week 2', 'Week 4', 'Week 8', '3 Months'];
  var titleEl = document.getElementById('css-title');
  if (titleEl) titleEl.textContent = 'Patient Assessment — ' + (tpLabels[LP_CURRENT_TP] || 'Day 1');
}

function updateClinicalImpression() {
  var el = document.getElementById('ci-block');
  if (!el) return;

  var eR          = egfrRisk();
  var gR          = giRisk();
  var nsaidClosed = nsaidContraindicated();
  var opioidClosed= opioidAvoidable();
  var apapFailed  = acetaminophenFailed();
  var multimodal  = multimodalFailure();
  var v           = { egfr: P.egfr, pain: P.pain, bp: P.bp, age: P.age };

  var tpLabels = ['Day 1', 'Week 2', 'Week 4', 'Week 8', '3 Months'];
  var tpEl = document.getElementById('ci-timepoint');
  if (tpEl) tpEl.textContent = tpLabels[LP_CURRENT_TP] || 'Day 1';

  var lines = [];

  // 1. Pain / functional
  var painTier = P.pain >= 8 ? 'severe' : P.pain >= 6 ? 'mod_high' : P.pain >= 4 ? 'moderate' : 'low';
  lines.push(oaFill(OA_CI.pain[painTier].text, v));
  lines.push({ text: lines.pop(), tone: OA_CI.pain[painTier].tone });

  // 2. Risk constraint
  if (gR === 'very-high' && (eR === 'moderate' || eR === 'severe')) {
    lines.push({ tone: OA_CI.risk.compound_gi_renal.tone, text: oaFill(OA_CI.risk.compound_gi_renal.text, v) });
  } else if (gR === 'very-high') {
    lines.push({ tone: OA_CI.risk.gi_very_high.tone, text: OA_CI.risk.gi_very_high.text });
  } else if (gR === 'high' && eR !== 'low') {
    lines.push({ tone: OA_CI.risk.gi_renal_compound.tone, text: oaFill(OA_CI.risk.gi_renal_compound.text, v) });
  } else if (gR === 'high') {
    lines.push({ tone: OA_CI.risk.gi_high.tone, text: OA_CI.risk.gi_high.text });
  } else if (eR === 'moderate' || eR === 'severe') {
    lines.push({ tone: OA_CI.risk.renal_severe.tone, text: oaFill(OA_CI.risk.renal_severe.text, v) });
  } else if (eR === 'mild') {
    lines.push({ tone: OA_CI.risk.renal_mild.tone, text: oaFill(OA_CI.risk.renal_mild.text, v) });
  }

  // 3. BP / CV
  if (P.bp >= 170) {
    lines.push({ tone: OA_CI.bp.uncontrolled.tone, text: oaFill(OA_CI.bp.uncontrolled.text, v) });
  } else if (P.bp >= 150) {
    lines.push({ tone: OA_CI.bp.elevated.tone, text: oaFill(OA_CI.bp.elevated.text, v) });
  }

  // 4. Treatment history
  if (multimodal) {
    lines.push({ tone: OA_CI.failures.multimodal.tone, text: OA_CI.failures.multimodal.text });
  } else if (apapFailed) {
    lines.push({ tone: OA_CI.failures.apap_failed.tone, text: OA_CI.failures.apap_failed.text });
  } else if (P.failed === '2nsaid') {
    lines.push({ tone: OA_CI.failures.two_nsaid.tone, text: OA_CI.failures.two_nsaid.text });
  } else if (P.failed === '1nsaid') {
    lines.push({ tone: OA_CI.failures.one_nsaid.tone, text: OA_CI.failures.one_nsaid.text });
  }

  // 5. Adherence
  if (P.adh === 'poor') {
    lines.push({ tone: OA_CI.adherence.poor.tone, text: OA_CI.adherence.poor.text });
  } else if (P.adh === 'partial') {
    lines.push({ tone: OA_CI.adherence.partial.tone, text: OA_CI.adherence.partial.text });
  }

  // 6. Opioid gate
  if (opioidClosed && (multimodal || P.pain >= 8)) {
    lines.push({ tone: OA_CI.opioid_closed.tone, text: OA_CI.opioid_closed.text });
  }

  // 7. Trajectory
  if (LP_CURRENT_TP > 0 && P.pain <= 5 && eR !== 'severe') {
    lines.push({ tone: OA_CI.trajectory.stable.tone, text: OA_CI.trajectory.stable.text });
  } else if (LP_CURRENT_TP > 0 && P.pain >= 7) {
    lines.push({ tone: OA_CI.trajectory.persistent_pain.tone, text: OA_CI.trajectory.persistent_pain.text });
  } else if (LP_CURRENT_TP === 0 && !multimodal && !apapFailed) {
    lines.push({ tone: OA_CI.trajectory.no_escalation.tone, text: OA_CI.trajectory.no_escalation.text });
  }

  // Fix: first item may still be a string from the push/pop above — normalise
  lines = lines.map(function(l) { return typeof l === 'string' ? { tone: 'amber', text: l } : l; });

  // Conclusion
  var conclusion;
  if (multimodal)       conclusion = OA_CI.conclusions.specialist;
  else if (apapFailed)  conclusion = OA_CI.conclusions.apap_failed;
  else if (gR === 'very-high' || (gR === 'high' && eR !== 'low')) conclusion = OA_CI.conclusions.compound_risk;
  else if (nsaidClosed) conclusion = OA_CI.conclusions.nsaid_closed;
  else if (P.pain <= 4 && LP_CURRENT_TP > 0) conclusion = OA_CI.conclusions.favourable;
  else conclusion = OA_CI.conclusions.standard;

  var parasEl = document.getElementById('ci-paragraphs');
  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }
  var concTextEl = document.getElementById('ci-conclusion-text');
  if (concTextEl) concTextEl.textContent = conclusion;
}

