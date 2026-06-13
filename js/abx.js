/* ════════════════════════════════════════════════════════════
   abx.js — Antibiotic Stewardship workflow (UTI Focus):
            state, readiness, classification helpers,
            reasoning engine, UI updates, monitoring
   Clinstrux · Clinical Decision Infrastructure
   Spec: ABX UTI Stewardship Workflow v1.0 (FROZEN)
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   ABX — STATE  (spec §2.1)
   All fields null — engine blocked until mandatory fields set.
════════════════════════════════════════════════════════════ */

var ABX = {

  /* ── PATIENT DEMOGRAPHICS ─────────────────────────── */
  age:            null,   // integer, years
  sex:            null,   // 'female' | 'male' | 'other'
  weight:         null,   // float, kg
  height:         null,   // integer, cm
  pregnant:       null,   // 'yes' | 'no' | 'unknown'
  catheter:       null,   // 'yes' | 'no'
  immunocomp:     null,   // 'yes' | 'no'
  structural:     null,   // 'yes' | 'no'

  /* ── ALLERGY ──────────────────────────────────────── */
  pen_allergy:    null,   // 'none' | 'low' | 'high'

  /* ── SITE AND CLASSIFICATION ─────────────────────── */
  site:           null,   // 'lower' | 'upper' | 'urosepsis'

  /* ── RENAL FUNCTION ──────────────────────────────── */
  egfr:           null,   // integer, mL/min/1.73m²

  /* ── LIVER FUNCTION ──────────────────────────────── */
  alt:            null,   // integer, U/L (optional)
  ast:            null,   // integer, U/L (optional)

  /* ── INFLAMMATORY MARKERS ────────────────────────── */
  crp:            null,   // integer, mg/L
  wbc:            null,   // float, ×10⁹/L
  pct:            null,   // float, µg/L (optional)

  /* ── CULTURE AND MICROBIOLOGY ────────────────────── */
  culture:        null,   // 'pending' | 'sensitive' | 'resistant' | 'no-growth' | 'mixed' | 'contaminated'
  organism:       null,   // 'ecoli' | 'klebsiella' | 'enterococcus' | 'pseudomonas' | 'proteus' | 'staph_sapro' | 'other' | null
  esbl:           null,   // 'yes' | 'no' | 'unknown'
  susceptibility: null,   // 'narrow' | 'broad' | 'carbapenem_only' | 'unknown'

  /* ── TREATMENT TIMELINE ──────────────────────────── */
  abx_day:        null,   // integer, day of current antibiotic course (1-based)
  iv_days:        null,   // integer, number of IV days completed (0 if oral only)
  current_abx:    null,   // 'nitrofurantoin' | 'trimethoprim' | 'pivmecillinam' |
                          // 'cefalexin' | 'co-amoxiclav' | 'ciprofloxacin' |
                          // 'pip-taz' | 'meropenem' | 'gentamicin' | 'other'

  /* ── ANTIBIOTIC COURSE HISTORY ───────────────────── */
  prior_abx_90d:  null,   // 'yes' | 'no'
  prior_resistant: null,  // 'yes' | 'no'
  hospital_onset: null,   // 'yes' | 'no'

  /* ── CLINICAL RESPONSE ───────────────────────────── */
  response:       null,   // 'improving' | 'stable' | 'worsening'
  temp:           null,   // float, °C
  news2:          null    // integer, NEWS2 score
};

var _abxActivePopover = null;

/* ════════════════════════════════════════════════════════════
   ABX — READINESS  (spec §3)
   Engine blocked until all 11 mandatory fields are non-null.
════════════════════════════════════════════════════════════ */

function abxIsReady() {
  return (
    ABX.age         !== null &&
    ABX.sex         !== null &&
    ABX.pregnant    !== null &&
    ABX.catheter    !== null &&
    ABX.site        !== null &&
    ABX.egfr        !== null &&
    ABX.pen_allergy !== null &&
    ABX.culture     !== null &&
    ABX.response    !== null &&
    ABX.abx_day     !== null &&
    ABX.current_abx !== null
  );
}

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
  var pop  = document.getElementById('abx-pop-' + key);
  var card = document.getElementById('abx-p-' + key);
  if (!pop || !card) return;

  /* Sync input to current ABX state before showing */
  var rng = document.getElementById('abx-rng-' + key);
  var sel = document.getElementById('abx-sel-' + key);
  if (rng && ABX[key] !== null) {
    rng.value = ABX[key];
    var disp = document.getElementById('abx-rng-' + key + '-val');
    if (disp) disp.textContent = (key === 'temp') ? parseFloat(ABX[key]).toFixed(1) : ABX[key];
  }
  if (sel && ABX[key] !== null) sel.value = ABX[key];

  pop.style.display = 'block';
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
   Reads the DOM input for the given key, writes to ABX state,
   closes the popover, then re-runs the engine.
════════════════════════════════════════════════════════════ */

function abxApplyParam(key) {
  var rng = document.getElementById('abx-rng-' + key);
  var sel = document.getElementById('abx-sel-' + key);

  /* Range inputs */
  if (rng) {
    var intKeys = { age: 1, height: 1, egfr: 1, alt: 1, ast: 1, crp: 1, abx_day: 1, iv_days: 1, news2: 1 };
    if (intKeys[key]) {
      ABX[key] = parseInt(rng.value, 10);
    } else {
      ABX[key] = parseFloat(rng.value);
    }
  }

  /* Select inputs */
  if (sel) {
    var v = sel.value;
    ABX[key] = (v === '' || v === 'null') ? null : v;
  }

  abxClosePopover(key);
  abxRunReasoningEngine();
}

/* ════════════════════════════════════════════════════════════
   ABX — CLASSIFICATION HELPERS  (spec §4.1)
   All guards against null per spec §13.
════════════════════════════════════════════════════════════ */

function abxIsComplicated() {
  return (
    ABX.catheter   === 'yes' ||
    ABX.immunocomp === 'yes' ||
    ABX.structural === 'yes' ||
    ABX.site       === 'upper' ||
    ABX.site       === 'urosepsis'
  );
}

function abxIsPregnant() {
  return ABX.pregnant === 'yes';
}

function abxIsUrosepsis() {
  return (
    ABX.site === 'urosepsis' ||
    (ABX.news2 !== null && ABX.news2 >= 5)
  );
}

function abxIsUpper() {
  return ABX.site === 'upper' && !abxIsUrosepsis();
}

function abxIsLower() {
  return ABX.site === 'lower' && !abxIsComplicated();
}

function abxPenHighRisk() {
  return ABX.pen_allergy === 'high';
}

function abxPenLowRisk() {
  return ABX.pen_allergy === 'low';
}

function abxRenalImpaired() {
  return ABX.egfr !== null && ABX.egfr < 45;
}

function abxRenalModerate() {
  return ABX.egfr !== null && ABX.egfr >= 45 && ABX.egfr < 60;
}

function abxRenalSevere() {
  return ABX.egfr !== null && ABX.egfr < 30;
}

function abxLiverCaution() {
  if (ABX.alt === null && ABX.ast === null) return false;
  return (ABX.alt !== null && ABX.alt > 40) || (ABX.ast !== null && ABX.ast > 40);
}

function abxESBL() {
  return ABX.esbl === 'yes';
}

function abxResistant() {
  return ABX.culture === 'resistant' || ABX.susceptibility === 'carbapenem_only';
}

function abxNarrowSensitive() {
  return (
    ABX.culture === 'sensitive' &&
    (ABX.susceptibility === 'narrow' || ABX.susceptibility === null)
  );
}

function abxPriorRisk() {
  return (
    ABX.prior_abx_90d  === 'yes' ||
    ABX.prior_resistant === 'yes' ||
    ABX.hospital_onset  === 'yes'
  );
}

function abxFever() {
  return ABX.temp !== null && ABX.temp >= 38.0;
}

function abxPCTHigh() {
  return ABX.pct !== null && ABX.pct >= 0.5;
}

function abxImproving() {
  return ABX.response === 'improving';
}

function abxWorsening() {
  return ABX.response === 'worsening';
}

function abxStepDownEligible() {
  return (
    abxImproving() &&
    ABX.abx_day !== null && ABX.abx_day >= 2 &&
    ABX.iv_days !== null && ABX.iv_days >= 1
  );
}

/* ── Legacy aliases kept for any HTML onclick still using them ── */
function abxFeverActive()      { return abxFever(); }
function abxGfrImpaired()      { return ABX.egfr !== null && ABX.egfr < 60; }
function abxGfrSevere()        { return abxRenalSevere(); }
function abxWbcElevated()      { return ABX.wbc !== null && ABX.wbc > 11; }
function abxWbcSeverely()      { return ABX.wbc !== null && ABX.wbc > 20; }
function abxCrpHigh()          { return ABX.crp !== null && ABX.crp > 100; }
function abxCrpVeryHigh()      { return ABX.crp !== null && ABX.crp > 200; }
function abxCultureSensitive() { return ABX.culture === 'sensitive'; }
function abxCultureResistant() { return ABX.culture === 'resistant'; }
function abxCultureNoGrowth()  { return ABX.culture === 'no-growth'; }
function abxCulturePending()   { return ABX.culture === 'pending'; }

/* ════════════════════════════════════════════════════════════
   ABX — CLASSIFICATION  (spec §4.2)
   Returns one of five mutually exclusive codes.
════════════════════════════════════════════════════════════ */

function abxClassify() {
  if (abxIsUrosepsis())  return 'UROSEPSIS';
  if (abxIsUpper())      return 'UPPER';
  if (abxIsPregnant())   return 'LOWER_PREG';
  if (abxIsComplicated()) return 'LOWER_COMP';
  return 'LOWER_UNCOMP';
}

/* ════════════════════════════════════════════════════════════
   ABX — DOSING HELPERS  (spec §6)
════════════════════════════════════════════════════════════ */

/* Returns renal-adjusted dose string for a given agent.
   Returns null if agent not in table.                        */
function abxGetDose(agent) {
  var egfr = ABX.egfr; // already guarded at engine entry via abxIsReady()

  if (agent === 'nitrofurantoin') {
    if (egfr < 45) return null; // contraindicated
    if (egfr < 60) return 'Nitrofurantoin 100mg MR BD 5 days <em>(use with caution — eGFR 45–59)</em>';
    return 'Nitrofurantoin 100mg MR BD 5 days';
  }
  if (agent === 'trimethoprim') {
    if (egfr < 10) return 'Trimethoprim — specialist input required (eGFR &lt;10)';
    if (egfr < 30) return 'Trimethoprim — specialist input required (eGFR 10–29)';
    if (egfr < 45) return 'Trimethoprim 100mg BD 7 days <em>(50% dose — eGFR 30–44)</em>';
    return 'Trimethoprim 200mg BD 7 days';
  }
  if (agent === 'pivmecillinam') {
    if (egfr < 10) return null; // avoid
    if (egfr < 30) return 'Pivmecillinam 400mg TDS 3 days <em>(use with caution — eGFR 10–29)</em>';
    return 'Pivmecillinam 400mg TDS 3 days';
  }
  if (agent === 'cefalexin') {
    if (egfr < 10) return 'Cefalexin — specialist input required (eGFR &lt;10)';
    if (egfr < 30) return 'Cefalexin 500mg BD';
    return 'Cefalexin 500mg QDS';
  }
  if (agent === 'co-amoxiclav') {
    if (egfr < 10) return 'Co-amoxiclav 375mg OD';
    if (egfr < 30) return 'Co-amoxiclav 375mg BD';
    if (egfr < 45) return 'Co-amoxiclav 375mg TDS';
    return 'Co-amoxiclav 625mg TDS';
  }
  if (agent === 'ciprofloxacin') {
    if (egfr < 10) return 'Ciprofloxacin — specialist input required (eGFR &lt;10)';
    if (egfr < 30) return 'Ciprofloxacin 250mg OD';
    if (egfr < 45) return 'Ciprofloxacin 250mg BD';
    return 'Ciprofloxacin 500mg BD';
  }
  if (agent === 'pip-taz') {
    if (egfr < 10) return 'Pip-taz — specialist input required (eGFR &lt;10)';
    if (egfr < 20) return 'Piperacillin-tazobactam 2.25g IV q8h';
    return 'Piperacillin-tazobactam 4.5g IV q8h';
  }
  if (agent === 'meropenem') {
    if (egfr < 10) return 'Meropenem — specialist input required (eGFR &lt;10)';
    if (egfr < 26) return 'Meropenem 500mg IV q12h';
    if (egfr < 50) return 'Meropenem 1g IV q12h';
    return 'Meropenem 1g IV q8h';
  }
  if (agent === 'gentamicin') {
    if (egfr < 20) return 'Gentamicin — specialist input required before use (eGFR &lt;20)';
    if (egfr < 45) return 'Gentamicin — specialist input required (eGFR 20–44)';
    return 'Gentamicin — once-daily dosing per local nomogram; monitor levels';
  }
  return null;
}

/* Returns hepatotoxicity warning string or null.            */
function abxHepatoWarning(agent) {
  if (!abxLiverCaution()) return null;
  var hepatoAgents = { 'co-amoxiclav': 1, 'flucloxacillin': 1 };
  if (!hepatoAgents[agent]) return null;
  var threshold = 120;
  if ((ABX.alt !== null && ABX.alt > threshold) || (ABX.ast !== null && ABX.ast > threshold)) {
    return 'Hepatotoxicity risk — ALT/AST &gt;3× ULN. Review LFTs before prescribing ' + agent + '.';
  }
  return null;
}

/* Returns adjusted body weight for gentamicin if obese.    */
function abxGentamicinWeight() {
  if (ABX.weight === null) return null;
  if (ABX.height === null || ABX.sex === null) return ABX.weight;
  var hIn = (ABX.height - 152.4) / 2.54;
  var ibw = (ABX.sex === 'male') ? (50 + 2.3 * hIn) : (45.5 + 2.3 * hIn);
  var bmi = ABX.weight / ((ABX.height / 100) * (ABX.height / 100));
  if (bmi > 30 && ABX.weight > ibw) {
    return ibw + 0.4 * (ABX.weight - ibw);
  }
  return ABX.weight;
}

/* ════════════════════════════════════════════════════════════
   ABX — RECOMMENDATION ENGINE  (spec §5, §11)
   abxBuildRecommendation() returns the §11 output object.
   abxRunReasoningEngine()  orchestrates all UI updates.
════════════════════════════════════════════════════════════ */

function abxBuildRecommendation() {
  var classification = abxClassify();
  var action = '';
  var state  = 'Continue';
  var rationale = '';
  var confPct   = 50;
  var confLabel = 'Moderate';
  var confDesc  = '';
  var chips     = '';
  var deescTarget = '';
  var prereq    = '';
  var wn_deesc  = '';
  var wn_esc    = '';
  var wn_continue = '';
  var wn_culture  = '';
  var flags     = [];

  /* ── Escalation / worsening cross-path check ──── */
  if (abxWorsening()) {
    state = 'Escalate';
    confPct = 85;
    confLabel = 'High';
    confDesc = 'Clinical deterioration is a mandatory escalation trigger per NICE NG112.';
    wn_esc = 'Response is worsening — current regimen is inadequate. Escalation is mandatory.';
    wn_deesc = 'De-escalation is contraindicated while patient is deteriorating.';
    wn_continue = 'Continuation of current regimen is not appropriate — clinical failure signal present.';
    flags.push({ severity: 'urgent', text: 'Worsening response — escalate immediately.' });
  }

  /* ── ESBL cross-path flag ──────────────────────── */
  if (abxESBL()) {
    flags.push({ severity: 'urgent', text: 'ESBL confirmed — ensure carbapenem coverage; remove pip-taz from regimen.' });
  }

  /* ── NEWS2 urosepsis upgrade flag ─────────────── */
  if (ABX.news2 !== null && ABX.news2 >= 5 && ABX.site !== 'urosepsis') {
    flags.push({ severity: 'urgent', text: 'NEWS2 \u22655 — reclassify as urosepsis and escalate immediately.' });
  }

  /* ══════════════════════════════════════════════
     PATH: UROSEPSIS  (spec §5.3)
  ══════════════════════════════════════════════ */
  if (classification === 'UROSEPSIS') {
    chips = '<span class="ev-chip">NICE NG112</span><span class="ev-chip">NICE NG15</span>';

    if (abxWorsening()) {
      /* Worsening on current regimen */
      var escAgent = abxESBL() ? abxGetDose('meropenem') : abxGetDose('meropenem');
      action = escAgent || 'Meropenem 1g IV q8h';
      if (abxESBL()) action += ' + Gentamicin (ESBL — specialist input required)';
      rationale = 'Inadequate source control — patient is deteriorating on current regimen. Escalation to carbapenem is required. Senior review mandatory.';
      state = 'Escalate';
      confPct = 90; confLabel = 'High';
      confDesc = 'Worsening urosepsis requires immediate escalation per NICE NG112 and UKHSA AMR guidance.';
      deescTarget = 'Review at 48–72hr once cultures available.';
      prereq = 'Senior clinical review required before any regimen change.';
      flags.push({ severity: 'urgent', text: 'Senior review required — urosepsis with worsening response.' });

    } else if (abxStepDownEligible() && ABX.culture !== 'pending') {
      /* Improving + culture available + step-down criteria met */
      var oral = _abxUrosepsisStepDownAgent();
      action = oral;
      state  = 'De-escalate';
      rationale = 'Patient meets IV-to-oral step-down criteria: improving response, day ' + ABX.abx_day + ', ' + ABX.iv_days + ' IV day(s) completed, culture result available. Oral step-down is safe in improving sepsis with microbiological confirmation per NICE.';
      confPct = 80; confLabel = 'High';
      confDesc = 'Step-down criteria met — NICE NG112 supports oral therapy in confirmed improving sepsis.';
      deescTarget = oral;
      prereq = 'Confirm: apyrexial, tolerating oral intake, no ongoing source. Review at 24hr.';
      wn_deesc = 'Step-down criteria met: improving, culture available, abx_day \u22653, iv_days \u22652.';
      wn_esc   = 'Escalation not indicated — patient is improving.';
      wn_continue = 'IV continuation is not required — step-down criteria satisfied.';
      wn_culture  = 'Culture available — de-escalation is microbiologically supported.';
      chips += '<span class="ev-chip ev-chip-green">Step-down criteria met</span>';

    } else if (abxImproving() && ABX.culture === 'pending') {
      /* Improving but culture still pending */
      action = abxGetDose('pip-taz') || 'Piperacillin-tazobactam 4.5g IV q8h';
      state  = 'Continue';
      rationale = 'Patient is improving but culture result is still pending. Cannot de-escalate without microbiological confirmation in urosepsis. Continue IV; set 24hr culture review.';
      confPct = 75; confLabel = 'High';
      confDesc = 'De-escalation deferred pending culture — mandatory in urosepsis per NICE NG112.';
      deescTarget = 'To be determined once culture available.';
      prereq = 'Culture result required before any step-down.';
      wn_deesc = 'De-escalation deferred — culture is pending. Never de-escalate in urosepsis without microbiological confirmation.';
      wn_culture = 'Culture pending — review result within 24hr.';
      flags.push({ severity: 'warn', text: 'Culture pending at day ' + ABX.abx_day + ' — chase result urgently.' });

    } else if (ABX.culture === 'no-growth' && abxImproving()) {
      /* No growth + improving */
      action = abxGetDose('cefalexin') || 'Cefalexin 500mg QDS';
      state  = 'De-escalate';
      rationale = 'No growth at 72hr supports de-escalation but not immediate cessation. Step down to cefalexin oral. Reassess at day 5.';
      confPct = 70; confLabel = 'Moderate';
      confDesc = 'No-growth culture supports de-escalation. Reassess at day 5.';
      deescTarget = action;
      prereq = 'Confirm no growth at \u226572hr. Reassess at day 5.';
      wn_deesc = 'No growth at 72hr — supports oral step-down in improving patient.';
      wn_culture = 'Culture shows no growth — supports de-escalation; do not stop antibiotics yet.';

    } else {
      /* Day 1–2 or stable — continue IV */
      var ivAgent = abxESBL() ? (abxGetDose('meropenem') || 'Meropenem 1g IV q8h') : (abxGetDose('pip-taz') || 'Piperacillin-tazobactam 4.5g IV q8h');
      action = ivAgent;
      state  = 'Continue';
      rationale = 'Insufficient time to assess response. Do not de-escalate. Continue IV and reassess at 48–72hr.';
      confPct = 80; confLabel = 'High';
      confDesc = 'IV mandatory in early urosepsis — NICE NG112.';
      deescTarget = 'Review at day 3 if improving and culture available.';
      prereq = 'Do not de-escalate in urosepsis before day 3 or without culture confirmation.';
      wn_deesc = 'Too early to de-escalate — minimum day 3 with improving response and confirmed culture.';
      wn_continue = 'Continue IV — early urosepsis requires sustained broad-spectrum cover.';
    }

    if (!chips.match('ev-chip-renal') && abxRenalImpaired()) {
      flags.push({ severity: 'warn', text: 'eGFR ' + ABX.egfr + ' — renal dose adjustment applied to all agents.' });
    }
    chips += '<span class="ev-chip">UKHSA AMR</span>';

  /* ══════════════════════════════════════════════
     PATH: UPPER UTI — pyelonephritis  (spec §5.4)
  ══════════════════════════════════════════════ */
  } else if (classification === 'UPPER') {
    chips = '<span class="ev-chip">NICE NG112</span>';

    if (abxWorsening()) {
      /* Escalate — reassess for urosepsis */
      action = abxGetDose('pip-taz') || 'Piperacillin-tazobactam 4.5g IV q8h';
      state  = 'Escalate';
      rationale = 'Worsening pyelonephritis — escalate. Consider urosepsis upgrade if NEWS2 rising. Do not continue ineffective agent.';
      confPct = 85; confLabel = 'High';
      confDesc = 'Worsening upper UTI mandates escalation and urosepsis re-evaluation.';
      deescTarget = 'Pending reassessment of site classification.';
      prereq = 'Senior review required. Re-evaluate NEWS2 and systemic features.';
      flags.push({ severity: 'urgent', text: 'Reassess for urosepsis — NEWS2 review required.' });

    } else if (abxResistant()) {
      /* Culture resistant */
      action = 'Review sensitivities — specialist/microbiology input required.';
      state  = 'Escalate';
      rationale = 'Culture shows resistant organism. Do not continue ineffective agent. Await full sensitivities and seek specialist input.';
      confPct = 90; confLabel = 'High';
      confDesc = 'Resistant culture — escalation mandatory per NICE NG112.';
      deescTarget = 'Pending sensitivities.';
      prereq = 'Full susceptibility result and specialist input required.';
      flags.push({ severity: 'urgent', text: 'Resistant organism — do not continue current regimen.' });

    } else if (abxStepDownEligible()) {
      /* IV to oral step-down */
      var stepAgent = abxPenHighRisk() ? (abxGetDose('ciprofloxacin') || 'Ciprofloxacin 500mg BD 7 days') : (abxGetDose('co-amoxiclav') || 'Co-amoxiclav 625mg TDS');
      var hepaWarn = abxHepatoWarning('co-amoxiclav');
      action = stepAgent;
      if (hepaWarn) flags.push({ severity: 'warn', text: hepaWarn });
      state  = 'De-escalate';
      rationale = 'Patient improving — NICE NG112 supports oral step-down for admitted upper UTI when clinical criteria met. Step down to ' + (abxPenHighRisk() ? 'ciprofloxacin' : 'co-amoxiclav') + '.';
      confPct = 80; confLabel = 'High';
      confDesc = 'Step-down criteria met — NICE NG112 oral step-down in improving pyelonephritis.';
      deescTarget = stepAgent;
      prereq = 'Apyrexial, tolerating oral intake. Complete 7-day course total.';
      wn_deesc = 'Step-down criteria met: improving, iv_days \u22651, abx_day \u22652.';
      wn_culture = ABX.culture === 'sensitive' ? 'Culture confirms sensitivity — oral step-down is microbiologically supported.' : 'Culture pending — proceed on clinical criteria alone only if improvement is sustained.';
      chips += '<span class="ev-chip ev-chip-green">Oral step-down</span>';

    } else if (abxNarrowSensitive()) {
      /* Culture sensitive narrow — de-escalate to narrowest */
      var narrowAgent = _abxNarrowOralAgent();
      action = narrowAgent;
      state  = 'De-escalate';
      rationale = 'Culture identifies organism sensitive to narrow-spectrum oral agent. Stewardship principle: use narrowest effective drug.';
      confPct = 85; confLabel = 'High';
      confDesc = 'Narrow-spectrum de-escalation is microbiologically supported.';
      deescTarget = narrowAgent;
      prereq = 'Confirm culture sensitivity and clinical improvement.';
      wn_deesc = 'Culture sensitive to narrow agent — de-escalation to narrowest effective oral is indicated.';
      wn_culture = 'Culture sensitive (narrow) — de-escalation supported.';

    } else {
      /* First-line empirical upper UTI */
      var empAgent;
      if (ABX.iv_days !== null && ABX.iv_days >= 1) {
        /* Admitted */
        empAgent = abxGetDose('pip-taz') || 'Piperacillin-tazobactam 4.5g IV q8h';
      } else {
        /* Community-managed */
        empAgent = abxPenHighRisk()
          ? (abxGetDose('ciprofloxacin') || 'Ciprofloxacin 500mg BD 7 days')
          : (abxGetDose('cefalexin')     || 'Cefalexin 500mg QDS 7 days');
      }
      action = empAgent;
      state  = 'Continue';
      rationale = 'Continue empirical therapy per NICE NG112 first-line for upper UTI. Reassess at 48–72hr.';
      confPct = 75; confLabel = 'Moderate';
      confDesc = 'Empirical first-line per NICE NG112.';
      deescTarget = 'Review at 48–72hr or when culture available.';
      prereq = 'Culture result required before de-escalation.';
    }

    if (ABX.abx_day !== null && ABX.abx_day >= 8) {
      flags.push({ severity: 'warn', text: 'Duration exceeds NICE NG112 guideline for upper UTI (7 days) — review indication.' });
    }
    chips += '<span class="ev-chip">NICE NG15</span>';

  /* ══════════════════════════════════════════════
     PATH: PREGNANCY  (spec §5.5)
  ══════════════════════════════════════════════ */
  } else if (classification === 'LOWER_PREG') {
    chips = '<span class="ev-chip">NICE NG112</span>';

    /* Note: we don't have trimester field — default to safest
       universal pregnancy path (trimethoprim excluded,
       nitrofurantoin excluded at term is flagged) */
    if (abxWorsening()) {
      action = abxGetDose('cefalexin') || 'Cefalexin 500mg QDS 7 days';
      state  = 'Escalate';
      rationale = 'Worsening UTI in pregnancy — escalate. Cefalexin is the safest escalation oral agent. Seek obstetric and microbiology input urgently.';
      confPct = 85; confLabel = 'High';
      confDesc = 'Worsening UTI in pregnancy requires urgent senior review.';
      prereq = 'Obstetric and microbiology input required.';
      flags.push({ severity: 'urgent', text: 'Worsening UTI in pregnancy — senior review urgently required.' });

    } else {
      /* First-line pregnancy */
      var pregAgent = abxGetDose('cefalexin') || 'Cefalexin 500mg QDS 7 days';
      action = pregAgent;
      state  = abxImproving() && ABX.culture !== 'pending' ? 'De-escalate' : 'Continue';
      rationale = 'First-line oral therapy for UTI in pregnancy per NICE NG112. Trimethoprim excluded (folate antagonist). Fluoroquinolones excluded (teratogen). Culture result mandatory — empirical treatment must be reviewed and narrowed at 48hr.';
      confPct = 80; confLabel = 'High';
      confDesc = 'NICE NG112 first-line for pregnancy UTI.';
      deescTarget = 'Narrow to culture-directed agent at 48hr.';
      prereq = 'Culture result required — all UTIs in pregnancy must be culture-confirmed.';
      wn_culture = ABX.culture === 'pending' ? 'Culture pending — must review and narrow at 48hr.' : 'Culture available — narrow to organism-directed therapy.';

      /* Flag nitrofurantoin if current_abx and potentially at term */
      if (ABX.current_abx === 'nitrofurantoin') {
        flags.push({ severity: 'warn', text: 'Nitrofurantoin contraindicated at term (\u226536 weeks) — confirm gestation before continuing.' });
      }
      /* Flag trimethoprim if current_abx */
      if (ABX.current_abx === 'trimethoprim') {
        flags.push({ severity: 'urgent', text: 'Trimethoprim is excluded in pregnancy (folate antagonist) — switch immediately.' });
      }
      /* Flag fluoroquinolones */
      if (ABX.current_abx === 'ciprofloxacin') {
        flags.push({ severity: 'urgent', text: 'Ciprofloxacin (fluoroquinolone) is excluded in pregnancy — switch immediately.' });
      }
    }

    if (ABX.abx_day !== null && ABX.abx_day >= 8) {
      flags.push({ severity: 'warn', text: 'Duration exceeds NICE NG112 guideline for pregnancy UTI (7 days) — review.' });
    }
    chips += '<span class="ev-chip">NICE NG15</span>';

  /* ══════════════════════════════════════════════
     PATH: COMPLICATED LOWER  (spec §5.6)
  ══════════════════════════════════════════════ */
  } else if (classification === 'LOWER_COMP') {
    chips = '<span class="ev-chip">NICE NG112</span>';

    if (abxWorsening()) {
      action = abxGetDose('pip-taz') || 'Piperacillin-tazobactam 4.5g IV q8h';
      state  = 'Escalate';
      rationale = 'Worsening complicated lower UTI — escalate to IV. Reassess site classification (consider upper UTI or urosepsis).';
      confPct = 85; confLabel = 'High';
      confDesc = 'Worsening complicated UTI requires IV escalation and site re-evaluation.';
      prereq = 'Reassess site classification — rule out pyelonephritis / urosepsis.';
      flags.push({ severity: 'urgent', text: 'Escalate IV and reassess site classification.' });

    } else if (abxResistant()) {
      /* Culture resistant */
      var resistAgent = (abxPenHighRisk() || abxESBL())
        ? (abxGetDose('meropenem') || 'Meropenem 1g IV q8h')
        : (abxGetDose('pip-taz')   || 'Piperacillin-tazobactam 4.5g IV q8h');
      action = resistAgent;
      state  = 'Escalate';
      rationale = 'Resistant culture — escalate to IV broad-spectrum. Urology/infection specialist input required.';
      confPct = 85; confLabel = 'High';
      confDesc = 'Resistant complicated UTI requires IV escalation and specialist input.';
      prereq = 'Urology/infection specialist input required.';
      flags.push({ severity: 'urgent', text: 'Resistant complicated UTI — specialist input required.' });

    } else if (ABX.catheter === 'yes') {
      /* Catheter-associated */
      var catAgent = abxGetDose('cefalexin') || 'Cefalexin 500mg QDS 7 days';
      action = catAgent;
      state  = abxImproving() ? 'Continue' : 'Continue';
      rationale = 'Catheter-associated UTI: treat with cefalexin 7 days. Consider catheter change. If catheter present \u22657 days, change catheter before sampling then treat based on new sample.';
      confPct = 75; confLabel = 'Moderate';
      confDesc = 'NICE NG112 — catheter-associated UTI first-line.';
      deescTarget = catAgent;
      prereq = 'Consider catheter removal or change. Repeat culture after catheter change if \u22657 days.';
      flags.push({ severity: 'info', text: 'Catheter-associated UTI — consider catheter change per NICE NG112.' });

    } else if (ABX.immunocomp === 'yes') {
      /* Immunocompromised */
      var immAgent = abxHepatoWarning('co-amoxiclav')
        ? (abxGetDose('cefalexin') || 'Cefalexin 500mg QDS 7 days')
        : (abxGetDose('co-amoxiclav') || 'Co-amoxiclav 625mg TDS 7 days');
      action = immAgent;
      state  = 'Continue';
      rationale = 'Immunocompromised host — co-amoxiclav oral 7 days; consider longer course. ID team input recommended.';
      confPct = 70; confLabel = 'Moderate';
      confDesc = 'Immunocompromised complicated UTI — conservative empirical approach.';
      prereq = 'ID team input recommended. Consider longer course duration.';
      flags.push({ severity: 'warn', text: 'Immunocompromised host — ID team input recommended.' });

    } else {
      /* Structural / default complicated lower */
      var structAgent = abxPenHighRisk()
        ? (abxGetDose('cefalexin') || 'Cefalexin 500mg QDS 7 days')
        : (abxGetDose('co-amoxiclav') || 'Co-amoxiclav 625mg TDS 7 days');
      var hepaW2 = abxHepatoWarning('co-amoxiclav');
      if (hepaW2 && !abxPenHighRisk()) {
        structAgent = abxGetDose('cefalexin') || 'Cefalexin 500mg QDS 7 days';
        flags.push({ severity: 'warn', text: hepaW2 });
      }
      action = structAgent;
      state  = 'Continue';
      rationale = 'Complicated lower UTI with structural abnormality — treat 7 days. Urology follow-up mandatory.';
      confPct = 70; confLabel = 'Moderate';
      confDesc = 'Complicated lower UTI — 7-day course.';
      prereq = 'Urology follow-up mandatory for structural abnormality.';
      flags.push({ severity: 'info', text: 'Urology follow-up mandatory — structural abnormality noted.' });
    }

    if (ABX.abx_day !== null && ABX.abx_day >= 8) {
      flags.push({ severity: 'warn', text: 'Duration exceeds guideline for complicated lower UTI (7 days) — review.' });
    }
    chips += '<span class="ev-chip">NICE NG15</span>';

  /* ══════════════════════════════════════════════
     PATH: UNCOMPLICATED LOWER  (spec §5.7)
  ══════════════════════════════════════════════ */
  } else {
    /* LOWER_UNCOMP */
    chips = '<span class="ev-chip">NICE NG112</span>';

    if (abxWorsening() || (ABX.response === 'stable' && ABX.abx_day !== null && ABX.abx_day >= 3)) {
      /* Escalation check */
      action = 'Reassess site classification — consider upper UTI pathway.';
      state  = 'Escalate';
      rationale = abxWorsening()
        ? 'Worsening at any day — escalate. Re-evaluate site classification: rule out upper UTI or occult complication.'
        : 'Stable at day ' + ABX.abx_day + ' — insufficient response. Reassess site classification. Consider escalation to upper UTI path.';
      confPct = 80; confLabel = 'High';
      confDesc = 'NICE NG112: inadequate response in uncomplicated lower UTI requires reassessment.';
      prereq = 'Reassess site classification before escalating antibiotic.';
      flags.push({ severity: 'warn', text: 'Inadequate response — reassess site classification (consider upper UTI).' });

    } else if (abxImproving() && abxCultureSensitive() && ABX.abx_day !== null && ABX.abx_day >= 2) {
      /* De-escalation check day 2–3 */
      var deescAgent = _abxUncompFirstLine();
      action = deescAgent;
      state  = 'De-escalate';
      rationale = 'Patient improving with sensitive culture. Confirm current agent is narrowest effective. De-escalate to first-line if currently on broader spectrum.';
      confPct = 85; confLabel = 'High';
      confDesc = 'Culture-directed de-escalation per NICE NG112 stewardship principles.';
      deescTarget = deescAgent;
      prereq = 'Culture sensitivity confirmed. Patient clinically improving.';
      wn_deesc = 'Improving with sensitive culture at day \u22652 — de-escalation indicated.';
      wn_culture = 'Culture sensitive — de-escalation to narrowest effective agent.';
      chips += '<span class="ev-chip ev-chip-green">Culture-directed</span>';

    } else {
      /* First-line empirical */
      var firstLine = _abxUncompFirstLine();
      action = firstLine;
      state  = 'Continue';
      rationale = 'Continue empirical first-line therapy per NICE NG112. ' + (abxPriorRisk() ? 'Prior antibiotic exposure / resistance risk present — agent selected accordingly.' : '');
      confPct = 75; confLabel = 'Moderate';
      confDesc = 'NICE NG112 first-line uncomplicated lower UTI.';
      deescTarget = 'Review when culture available.';
      prereq = 'Culture result recommended. Review at 48hr.';
    }

    /* Duration check */
    if (ABX.abx_day !== null && ABX.abx_day >= 6) {
      flags.push({ severity: 'warn', text: 'Duration exceeds NICE NG112 guideline for uncomplicated lower UTI (3–5 days) — review indication.' });
    }
    chips += '<span class="ev-chip">NICE NG15</span>';
  }

  /* ── Culture-pending cross-path flag ──────── */
  if (ABX.culture === 'pending' && ABX.abx_day !== null && ABX.abx_day >= 3) {
    flags.push({ severity: 'urgent', text: 'Culture still pending at day ' + ABX.abx_day + ' — chase result urgently.' });
  } else if (ABX.culture === 'pending') {
    flags.push({ severity: 'warn', text: 'Culture review due — result may be available.' });
  }

  /* ── PCT cross-path flag ───────────────────── */
  if (ABX.pct !== null) {
    if (ABX.pct < 0.1) {
      flags.push({ severity: 'warn', text: 'PCT <0.1 \u00b5g/L — bacterial infection unlikely. Review diagnosis before continuing antibiotics.' });
    } else if (ABX.pct < 0.25) {
      flags.push({ severity: 'warn', text: 'PCT 0.1–0.25 \u00b5g/L — unlikely bacterial. Consider stopping if clinical picture supports.' });
    } else if (ABX.pct >= 0.5 && ABX.pct <= 2.0) {
      flags.push({ severity: 'info', text: 'PCT 0.5–2.0 \u00b5g/L — probable bacterial infection. Use as baseline for trend monitoring.' });
    } else if (ABX.pct > 2.0) {
      flags.push({ severity: 'warn', text: 'PCT >2.0 \u00b5g/L — definite bacterial infection. Continue IV; de-escalate only when PCT falls >80% from peak.' });
    }
  }

  /* ── Renal flag ─────────────────────────────── */
  if (abxRenalSevere()) {
    flags.push({ severity: 'urgent', text: 'eGFR ' + ABX.egfr + ' — severe renal impairment. Urgent dose review. Nephrology input recommended. Avoid all nephrotoxic agents.' });
  } else if (abxRenalImpaired()) {
    flags.push({ severity: 'warn', text: 'eGFR ' + ABX.egfr + ' — renal dose adjustments applied. Recheck eGFR at 72hr.' });
  }

  return {
    classification: classification,
    action:         action,
    state:          state,
    rationale:      rationale,
    confPct:        confPct,
    confLabel:      confLabel,
    confDesc:       confDesc,
    chips:          chips,
    deescTarget:    deescTarget,
    prereq:         prereq,
    wn_deesc:       wn_deesc,
    wn_esc:         wn_esc,
    wn_continue:    wn_continue,
    wn_culture:     wn_culture,
    flags:          flags
  };
}

/* ── First-line agent for uncomplicated lower UTI (spec §5.7) ── */
function _abxUncompFirstLine() {
  var egfr = ABX.egfr;
  if (abxPriorRisk()) {
    /* Prior risk — second-line per spec §5.7 */
    if (ABX.prior_resistant === 'yes') {
      return abxGetDose('co-amoxiclav') || 'Co-amoxiclav 625mg TDS 3 days <em>(culture mandatory)</em>';
    }
    return abxGetDose('pivmecillinam') || 'Pivmecillinam 400mg TDS 3 days';
  }
  /* Standard first-line table: eGFR × allergy */
  if (egfr < 30) {
    return abxPenHighRisk()
      ? (abxGetDose('cefalexin')     || 'Cefalexin 500mg QDS 3 days')
      : (abxGetDose('pivmecillinam') || 'Pivmecillinam 400mg TDS 3 days');
  }
  if (egfr < 45) {
    return abxPenHighRisk()
      ? (abxGetDose('pivmecillinam') || 'Pivmecillinam 400mg TDS 3 days')
      : (abxGetDose('trimethoprim')  || 'Trimethoprim 200mg BD 7 days');
  }
  /* eGFR ≥45 */
  return abxPenHighRisk()
    ? (abxGetDose('trimethoprim')    || 'Trimethoprim 200mg BD 7 days')
    : (abxGetDose('nitrofurantoin')  || 'Nitrofurantoin 100mg MR BD 5 days');
}

/* ── Narrowest oral agent for de-escalation ── */
function _abxNarrowOralAgent() {
  if (abxPenHighRisk()) {
    return abxGetDose('trimethoprim') || 'Trimethoprim 200mg BD 7 days';
  }
  if (ABX.egfr !== null && ABX.egfr >= 45) {
    return abxGetDose('nitrofurantoin') || 'Nitrofurantoin 100mg MR BD 5 days';
  }
  return abxGetDose('trimethoprim') || 'Trimethoprim 200mg BD 7 days';
}

/* ── Urosepsis step-down oral agent ── */
function _abxUrosepsisStepDownAgent() {
  if (abxESBL()) return abxGetDose('meropenem') || 'Meropenem 1g IV q8h <em>(ESBL — oral step-down not appropriate)</em>';
  if (abxPenHighRisk()) {
    return abxGetDose('ciprofloxacin') || 'Ciprofloxacin 500mg BD';
  }
  if (ABX.susceptibility === 'narrow' || abxNarrowSensitive()) {
    return _abxNarrowOralAgent();
  }
  return abxGetDose('co-amoxiclav') || 'Co-amoxiclav 625mg TDS';
}

/* ════════════════════════════════════════════════════════════
   ABX — REASONING ENGINE ORCHESTRATOR
════════════════════════════════════════════════════════════ */

function abxRunReasoningEngine() {
  abxUpdateInputSummaryCards();
  abxUpdateClinicalStatusSummary();
  abxUpdateClinicalImpression();
  abxUpdateRecommendation();
  abxUpdateMonitoring();
}

/* ── 1. Input summary cards (Section 1 + 2) ─────────────── */
function abxUpdateInputSummaryCards() {
  function setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id);
    if (!e) return;
    e.className = e.className.replace(/abx-val-\w+/g, '').trim();
    if (cls) e.classList.add(cls);
  }

  /* eGFR */
  if (ABX.egfr !== null) {
    var gfrStatus = ABX.egfr < 30 ? 'Severe impairment' : ABX.egfr < 45 ? 'Impaired (\u226445)' : ABX.egfr < 60 ? 'Mildly reduced' : 'Normal';
    var gfrCls    = ABX.egfr < 30 ? 'abx-val-red' : ABX.egfr < 45 ? 'abx-val-red' : ABX.egfr < 60 ? 'abx-val-amber' : 'abx-val-green';
    setTxt('abx-val-egfr', ABX.egfr); setTxt('abx-status-egfr', gfrStatus); setCls('abx-val-egfr', gfrCls);
  }

  /* WBC */
  if (ABX.wbc !== null) {
    var wbcStatus = ABX.wbc > 20 ? 'Severely elevated' : ABX.wbc > 11 ? 'Elevated' : ABX.wbc < 4 ? 'Low — leucopenia' : 'Normal range';
    var wbcCls    = ABX.wbc > 20 ? 'abx-val-red' : ABX.wbc > 11 ? 'abx-val-amber' : ABX.wbc < 4 ? 'abx-val-amber' : 'abx-val-green';
    setTxt('abx-val-wbc', ABX.wbc); setTxt('abx-status-wbc', wbcStatus); setCls('abx-val-wbc', wbcCls);
  }

  /* CRP */
  if (ABX.crp !== null) {
    var crpStatus = ABX.crp > 200 ? 'Severely elevated' : ABX.crp > 100 ? 'Significantly elevated' : ABX.crp > 5 ? 'Elevated' : 'Normal';
    var crpCls    = ABX.crp > 100 ? 'abx-val-red' : ABX.crp > 5 ? 'abx-val-amber' : 'abx-val-green';
    setTxt('abx-val-crp', ABX.crp); setTxt('abx-status-crp', crpStatus); setCls('abx-val-crp', crpCls);
  }

  /* Temperature */
  if (ABX.temp !== null) {
    var tempStatus = ABX.temp >= 39.5 ? 'High fever' : ABX.temp >= 38.5 ? 'Moderate fever' : ABX.temp >= 38.0 ? 'Febrile' : 'Afebrile';
    var tempCls    = ABX.temp >= 38.5 ? 'abx-val-red' : ABX.temp >= 38.0 ? 'abx-val-amber' : 'abx-val-green';
    setTxt('abx-val-temp', parseFloat(ABX.temp).toFixed(1));
    setTxt('abx-status-temp', tempStatus); setCls('abx-val-temp', tempCls);
  }

  /* Response */
  if (ABX.response !== null) {
    var respLabels = { improving: 'Improving', stable: 'Stable', worsening: 'Worsening' };
    var respCls    = { improving: 'abx-val-green', stable: 'abx-val-amber', worsening: 'abx-val-red' };
    setTxt('abx-val-response', respLabels[ABX.response] || ABX.response);
    setCls('abx-val-response', respCls[ABX.response] || '');
  }

  /* Culture */
  if (ABX.culture !== null) {
    var cultLabels = { pending: 'Pending', sensitive: 'Sensitive', resistant: 'Resistant', 'no-growth': 'No growth', mixed: 'Mixed', contaminated: 'Contaminated' };
    var cultCls    = { pending: 'abx-val-amber', sensitive: 'abx-val-green', resistant: 'abx-val-red', 'no-growth': 'abx-val-green', mixed: 'abx-val-amber', contaminated: 'abx-val-amber' };
    setTxt('abx-val-culture', cultLabels[ABX.culture] || ABX.culture);
    setCls('abx-val-culture', cultCls[ABX.culture] || '');
  }
}

/* ── 2. Clinical Status Summary (Section 3) ─────────────── */
function abxUpdateClinicalStatusSummary() {
  function setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setCls(id, cls) {
    var e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/css-val-\w+/g, '').trim();
    if (cls) e.classList.add(cls);
  }

  if (!abxIsReady()) {
    var overall = document.getElementById('abx-overall-text');
    if (overall) overall.textContent = 'Complete all mandatory fields to generate clinical assessment.';
    var badge = document.getElementById('abx-css-badge');
    var badgeLbl = document.getElementById('abx-css-badge-label');
    if (badge) badge.className = 'css-overall-badge';
    if (badgeLbl) badgeLbl.textContent = 'Incomplete';
    return;
  }

  /* Inflammatory trend */
  var infVal, infSub, infCls;
  var wbcAvail = ABX.wbc !== null;
  var crpAvail = ABX.crp !== null;
  if ((wbcAvail && ABX.wbc > 20) || (crpAvail && ABX.crp > 200)) {
    infVal = 'Severely elevated'; infCls = 'css-val-red';
  } else if ((wbcAvail && ABX.wbc > 11) || (crpAvail && ABX.crp > 100)) {
    infVal = 'Elevated'; infCls = 'css-val-amber';
  } else {
    infVal = 'Settling'; infCls = 'css-val-green';
  }
  infSub = (wbcAvail ? 'WBC ' + ABX.wbc : '') + (wbcAvail && crpAvail ? ' \u00b7 ' : '') + (crpAvail ? 'CRP ' + ABX.crp : '');
  setTxt('abx-m-inflam', infVal); setTxt('abx-m-inflam-sub', infSub || '—'); setCls('abx-m-inflam', infCls);

  /* Fever */
  var fevVal, fevSub, fevCls;
  if (ABX.temp !== null) {
    if (ABX.temp >= 38.5) {
      fevVal = 'Febrile';   fevSub = ABX.temp.toFixed(1) + '\u00b0C \u2014 active fever'; fevCls = 'css-val-red';
    } else if (ABX.temp >= 38.0) {
      fevVal = 'Low-grade'; fevSub = ABX.temp.toFixed(1) + '\u00b0C \u2014 borderline';    fevCls = 'css-val-amber';
    } else {
      fevVal = 'Afebrile';  fevSub = ABX.temp.toFixed(1) + '\u00b0C \u2014 resolved';     fevCls = 'css-val-green';
    }
  } else {
    fevVal = 'Not entered'; fevSub = '—'; fevCls = '';
  }
  setTxt('abx-m-fever', fevVal); setTxt('abx-m-fever-sub', fevSub); setCls('abx-m-fever', fevCls);

  /* Clinical trajectory */
  var trajMap = {
    improving: { val: 'Improving',  sub: 'Clinical improvement noted',        cls: 'css-val-green' },
    stable:    { val: 'Stable',     sub: 'No significant change',             cls: 'css-val-amber' },
    worsening: { val: 'Worsening',  sub: 'Clinical deterioration — escalate', cls: 'css-val-red'   }
  };
  var traj = trajMap[ABX.response] || trajMap.stable;
  setTxt('abx-m-trajectory', traj.val); setTxt('abx-m-traj-sub', traj.sub); setCls('abx-m-trajectory', traj.cls);

  /* Renal */
  var renVal, renSub, renCls;
  if (abxRenalSevere()) {
    renVal = 'Severe impairment'; renSub = 'eGFR ' + ABX.egfr + ' \u2014 major dose review'; renCls = 'css-val-red';
  } else if (abxRenalImpaired()) {
    renVal = 'Impaired (\u226445)';   renSub = 'eGFR ' + ABX.egfr + ' \u2014 dose adj. active'; renCls = 'css-val-red';
  } else if (abxRenalModerate()) {
    renVal = 'Mildly reduced';   renSub = 'eGFR ' + ABX.egfr + ' \u2014 caution'; renCls = 'css-val-amber';
  } else {
    renVal = 'Normal';           renSub = 'eGFR ' + ABX.egfr + ' \u2014 no adjustment'; renCls = '';
  }
  setTxt('abx-m-renal', renVal); setTxt('abx-m-renal-sub', renSub); setCls('abx-m-renal', renCls);

  /* Overall text */
  var parts = [];
  var classLabel = { UROSEPSIS: 'Urosepsis', UPPER: 'Upper UTI (pyelonephritis)', LOWER_PREG: 'UTI in pregnancy', LOWER_COMP: 'Complicated lower UTI', LOWER_UNCOMP: 'Uncomplicated lower UTI' };
  parts.push('Classification: ' + (classLabel[abxClassify()] || 'Unknown') + '.');
  if (abxWorsening()) {
    parts.push('Patient is clinically deteriorating — treatment failure signal. Escalation required.');
  } else if (abxImproving()) {
    parts.push('Patient demonstrates clinical improvement on day ' + ABX.abx_day + ' of therapy.');
    if (ABX.temp !== null && !abxFever()) parts.push('Apyrexial.');
    if (abxCultureSensitive()) parts.push('Sensitive culture available — de-escalation opportunity.');
  } else {
    parts.push('Patient is clinically stable. Reassess at 48 hours.');
  }
  var overall = document.getElementById('abx-overall-text');
  if (overall) overall.textContent = parts.join(' ');

  /* Badge */
  var badge = document.getElementById('abx-css-badge');
  var badgeLbl = document.getElementById('abx-css-badge-label');
  var badgeDot = document.getElementById('abx-css-badge-dot');
  if (badge && badgeLbl) {
    badge.className = 'css-overall-badge';
    if (abxWorsening()) {
      badge.classList.add('css-badge-red');
      badgeLbl.textContent = 'Escalate';
    } else if (abxImproving()) {
      badge.classList.add('css-badge-green');
      badgeLbl.textContent = 'Improving';
    } else {
      badge.classList.add('css-badge-amber');
      badgeLbl.textContent = 'Stable — monitor';
    }
    if (badgeDot) badgeDot.style.background = abxWorsening() ? 'var(--red)' : abxImproving() ? 'var(--green)' : 'var(--amber)';
  }
}

/* ── 3. Clinical Impression (Section 3) ─────────────────── */
function abxUpdateClinicalImpression() {
  var parasEl   = document.getElementById('abx-ci-paragraphs');
  var concTextEl = document.getElementById('abx-ci-conclusion-text');

  if (!abxIsReady()) {
    if (parasEl)    parasEl.innerHTML = '<div class="ci-line ci-line-neutral">Complete all mandatory fields to generate clinical impression.</div>';
    if (concTextEl) concTextEl.textContent = '';
    return;
  }

  var lines = [];

  /* Trajectory */
  var trajText = {
    improving: { tone: 'positive', text: 'Patient is clinically improving on day ' + ABX.abx_day + ' of antibiotic therapy.' },
    stable:    { tone: 'neutral',  text: 'Patient is clinically stable on day ' + ABX.abx_day + ' — limited response to date.' },
    worsening: { tone: 'negative', text: 'Patient is clinically deteriorating on day ' + ABX.abx_day + ' despite current antibiotic therapy.' }
  };
  lines.push(trajText[ABX.response] || trajText.stable);

  /* Inflammatory markers */
  if (ABX.wbc !== null || ABX.crp !== null) {
    var markerTone, markerText;
    if (abxWbcSeverely() || abxCrpVeryHigh()) {
      markerTone = abxWorsening() ? 'negative' : 'neutral';
      markerText = 'Inflammatory markers are severely elevated'
        + (ABX.wbc !== null ? ' (WBC ' + ABX.wbc + ' \u00d710\u2079/L' : '')
        + (ABX.crp !== null ? ', CRP ' + ABX.crp + ' mg/L)' : ')')
        + (abxWorsening() ? ' and continuing to rise — consistent with treatment failure.' : ' — biochemical lag is expected; clinical trajectory is the dominant signal.');
    } else if (abxWbcElevated() || abxCrpHigh()) {
      markerTone = 'neutral';
      markerText = 'Inflammatory markers remain elevated'
        + (ABX.wbc !== null ? ' (WBC ' + ABX.wbc : '')
        + (ABX.crp !== null ? ', CRP ' + ABX.crp + ')' : ')')
        + (abxImproving() ? ' but are on a downward trend — biochemical lag behind clinical response is expected.' : ' — reassess in 48 hours.');
    } else {
      markerTone = 'positive';
      markerText = 'Inflammatory markers are within acceptable limits'
        + (ABX.wbc !== null ? ' (WBC ' + ABX.wbc : '')
        + (ABX.crp !== null ? ', CRP ' + ABX.crp + ')' : ')')
        + ' — consistent with resolving infection.';
    }
    lines.push({ tone: markerTone, text: markerText });
  }

  /* Fever */
  if (ABX.temp !== null) {
    var fevTone, fevText;
    if (ABX.temp >= 38.5) {
      fevTone = 'negative';
      fevText = 'Active fever (' + ABX.temp.toFixed(1) + '\u00b0C) — patient remains pyrexial.';
    } else if (abxFever()) {
      fevTone = abxImproving() ? 'neutral' : 'negative';
      fevText = 'Low-grade temperature (' + ABX.temp.toFixed(1) + '\u00b0C)' + (abxImproving() ? ' — resolving; defervescence not yet complete.' : ' — borderline fever; monitor closely.');
    } else {
      fevTone = 'positive';
      fevText = 'Apyrexial (' + ABX.temp.toFixed(1) + '\u00b0C) — defervescence achieved.';
    }
    lines.push({ tone: fevTone, text: fevText });
  }

  /* Culture */
  var cultTone, cultText;
  if (ABX.culture === 'resistant') {
    cultTone = 'negative';
    cultText = 'Culture confirms resistant organism — current regimen is microbiologically inadequate. Escalation is mandated.';
  } else if (ABX.culture === 'sensitive') {
    cultTone = 'positive';
    cultText = 'Culture identifies a sensitive organism — de-escalation to the narrowest effective agent is indicated and aligns with NICE NG112 stewardship principles.';
  } else if (ABX.culture === 'no-growth') {
    cultTone = 'positive';
    cultText = 'Culture shows no growth — supports de-escalation in an improving patient, but do not stop antibiotics until clinical criteria are met.';
  } else if (ABX.culture === 'mixed') {
    cultTone = 'neutral';
    cultText = 'Mixed culture result — treat dominant organism and request repeat culture before changing regimen.';
  } else if (ABX.culture === 'contaminated') {
    cultTone = 'neutral';
    cultText = 'Contaminated sample — repeat culture required. Do not change regimen until a clean result is available.';
  } else {
    cultTone = 'neutral';
    cultText = 'Culture result pending — de-escalation deferred. Review result at 24–48hr.';
  }
  lines.push({ tone: cultTone, text: cultText });

  /* Renal */
  if (abxRenalSevere()) {
    lines.push({ tone: 'negative', text: 'Severe renal impairment (eGFR ' + ABX.egfr + ' mL/min/1.73m\u00b2) — major dose adjustments required across all agents. Nephrology input recommended.' });
  } else if (abxRenalImpaired()) {
    lines.push({ tone: 'neutral', text: 'Renal impairment (eGFR ' + ABX.egfr + ') — nitrofurantoin is contraindicated. Dose adjustments applied to all renally-cleared agents.' });
  }

  /* PCT */
  if (ABX.pct !== null) {
    var pctTone, pctText;
    if (ABX.pct < 0.1) {
      pctTone = 'neutral'; pctText = 'Procalcitonin ' + ABX.pct + ' \u00b5g/L — bacterial infection unlikely. Review diagnosis.';
    } else if (ABX.pct < 0.5) {
      pctTone = 'neutral'; pctText = 'Procalcitonin ' + ABX.pct + ' \u00b5g/L — low; bacterial aetiology uncertain.';
    } else if (ABX.pct <= 2.0) {
      pctTone = 'neutral'; pctText = 'Procalcitonin ' + ABX.pct + ' \u00b5g/L — probable bacterial infection. Use as baseline for trend.';
    } else {
      pctTone = 'negative'; pctText = 'Procalcitonin ' + ABX.pct + ' \u00b5g/L — definite bacterial infection. IV therapy indicated. De-escalate only when PCT falls >80% from peak.';
    }
    lines.push({ tone: pctTone, text: pctText });
  }

  if (parasEl) {
    parasEl.innerHTML = lines.map(function(l) {
      return '<div class="ci-line ci-line-' + l.tone + '">' + l.text + '</div>';
    }).join('');
  }

  /* Conclusion */
  var conclusion;
  if (!abxIsReady()) {
    conclusion = '';
  } else if (abxWorsening()) {
    conclusion = 'Clinical trajectory indicates treatment failure. Immediate escalation and senior review are required.';
  } else if (abxImproving() && (abxCultureSensitive() || ABX.culture === 'no-growth')) {
    conclusion = 'Clinical and microbiological data support de-escalation to the narrowest effective agent per NICE NG112.';
  } else if (abxImproving() && ABX.culture === 'pending') {
    conclusion = 'Clinical improvement supports continued therapy. De-escalation deferred pending culture result — review within 24 hours.';
  } else if (abxImproving() && ABX.culture === 'resistant') {
    conclusion = 'Clinical improvement is present but culture confirms resistance — escalate antibiotic regimen despite clinical response.';
  } else {
    conclusion = 'Continue current regimen and reassess at 48 hours. Culture result required to guide further management.';
  }
  if (concTextEl) concTextEl.textContent = conclusion;
}

/* ── 4. Recommendation  (Section 4) ─────────────────────── */
function abxUpdateRecommendation() {
  function setEl(id, v)   { var e = document.getElementById(id); if (e) e.innerHTML = v; }
  function setTxt(id, v)  { var e = document.getElementById(id); if (e) e.textContent = v; }

  if (!abxIsReady()) {
    setTxt('abx-rec-state',    'Awaiting input');
    setEl ('abx-rec-action',   '<em>Complete all mandatory fields in Patient Profile and Microbiology sections.</em>');
    setTxt('abx-rec-rationale','');
    setTxt('abx-conf-pct',     '—');
    setTxt('abx-conf-label',   '');
    setTxt('abx-conf-desc',    '');
    var bar = document.getElementById('abx-conf-bar'); if (bar) bar.style.width = '0%';
    return;
  }

  var rec = abxBuildRecommendation();

  setEl ('abx-rec-action',   rec.action);
  setTxt('abx-rec-state',    rec.state);
  setTxt('abx-rec-rationale',rec.rationale);
  setTxt('abx-conf-pct',     rec.confPct + '%');
  setTxt('abx-conf-label',   rec.confLabel);
  setTxt('abx-conf-desc',    rec.confDesc);

  var bar = document.getElementById('abx-conf-bar');
  if (bar) bar.style.width = rec.confPct + '%';

  setEl ('abx-deesc-target',  rec.deescTarget);
  setEl ('abx-prerequisite',  rec.prereq);

  var chipsRow = document.querySelector('#abx-section-recommendation .ds-primary-ev-chips');
  if (chipsRow) chipsRow.innerHTML = rec.chips;

  /* Why-not panel */
  setTxt('abx-wn-deesc',       rec.wn_deesc);
  setTxt('abx-wn-esc',         rec.wn_esc);
  setTxt('abx-wn-continue',    rec.wn_continue);
  setTxt('abx-wn-culture-item',rec.wn_culture);

  /* Classification label */
  var classLabels = { UROSEPSIS: 'Urosepsis', UPPER: 'Upper UTI', LOWER_PREG: 'UTI in Pregnancy', LOWER_COMP: 'Complicated Lower UTI', LOWER_UNCOMP: 'Uncomplicated Lower UTI' };
  setTxt('abx-rec-classification', classLabels[rec.classification] || rec.classification);
}

/* ── 5. Monitoring  (Section 5) ─────────────────────────── */
function abxUpdateMonitoring() {
  function setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setEl(id, v)  { var e = document.getElementById(id); if (e) e.innerHTML   = v; }

  if (!abxIsReady()) {
    setTxt('abx-rd-piptz', '—');
    setTxt('abx-rd-piptz-note', 'Complete mandatory fields to generate monitoring recommendations.');
    return;
  }

  /* ── Renal dosing card (using current_abx as reference agent) */
  var rdEl   = document.getElementById('abx-rd-piptz');
  var rdNote = document.getElementById('abx-rd-piptz-note');
  if (rdEl) {
    var doseStr = abxGetDose(ABX.current_abx);
    if (doseStr) {
      rdEl.innerHTML = doseStr;
      rdEl.className = 'renal-dosing-val' + (abxRenalImpaired() || abxRenalSevere() ? ' renal-dosing-val-amber' : '');
      if (rdNote) rdNote.textContent = abxRenalSevere()
        ? 'Severe renal impairment — specialist review of all doses required.'
        : abxRenalImpaired()
          ? 'eGFR ' + ABX.egfr + ' — renal dose adjustments applied. Recheck eGFR at 72hr.'
          : 'Standard dosing — no adjustment required at current eGFR.';
    } else {
      rdEl.textContent = 'See recommendation';
      if (rdNote) rdNote.textContent = 'Current agent requires specialist input at eGFR ' + ABX.egfr + '.';
    }
  }

  /* ── Culture flag */
  var flag1 = document.getElementById('abx-flag-1');
  if (flag1) {
    if (ABX.culture === 'resistant') {
      flag1.innerHTML = '<span class="mn-contra-x">\u26a0</span> Resistant organism confirmed — escalate regimen. Consult microbiology urgently.';
    } else if (ABX.culture === 'no-growth') {
      flag1.innerHTML = '<span class="mn-contra-x">\u2139</span> Culture negative — supports de-escalation if clinical criteria met.';
    } else if (ABX.culture === 'sensitive') {
      flag1.innerHTML = '<span class="mn-contra-x">\u2139</span> Sensitive organism — de-escalation to narrowest effective agent is microbiologically supported.';
    } else if (ABX.culture === 'pending') {
      var pendingFlag = ABX.abx_day !== null && ABX.abx_day >= 3
        ? '<span class="mn-contra-x">\u26a0</span> Culture still pending at day ' + ABX.abx_day + ' — chase result urgently.'
        : '<span class="mn-contra-x">\u26a0</span> Culture pending — review result within 24hr.';
      flag1.innerHTML = pendingFlag;
    } else if (ABX.culture === 'mixed') {
      flag1.innerHTML = '<span class="mn-contra-x">\u26a0</span> Mixed culture — treat dominant organism; repeat culture required.';
    } else if (ABX.culture === 'contaminated') {
      flag1.innerHTML = '<span class="mn-contra-x">\u26a0</span> Contaminated sample — repeat culture before changing regimen.';
    }
  }

  /* ── Renal flag */
  var flagR = document.getElementById('abx-flag-renal');
  if (flagR) {
    if (abxRenalSevere()) {
      flagR.innerHTML = '<span class="mn-contra-x">\u26a0</span> Severe renal impairment (eGFR ' + ABX.egfr + ') — urgent dose review required. Avoid all nephrotoxic agents. Nephrology input recommended.';
    } else if (abxRenalImpaired()) {
      flagR.innerHTML = '<span class="mn-contra-x">\u26a0</span> eGFR ' + ABX.egfr + ' — nitrofurantoin contraindicated. Monitor for AKI. Stop nephrotoxic agents if eGFR falls >20%.';
    } else if (abxRenalModerate()) {
      flagR.innerHTML = '<span class="mn-contra-x">\u26a0</span> eGFR ' + ABX.egfr + ' — use nitrofurantoin with caution. Recheck eGFR if course extends beyond 5 days.';
    } else {
      flagR.innerHTML = '<span class="mn-contra-x">\u2139</span> Renal function normal (eGFR ' + ABX.egfr + '). Standard monitoring throughout antimicrobial course.';
    }
  }

  /* ── Duration flag */
  var flagDur = document.getElementById('abx-flag-duration');
  if (flagDur && ABX.abx_day !== null) {
    var classification = abxClassify();
    var durFlag = '';
    var targets = { UROSEPSIS: 14, UPPER: 7, LOWER_PREG: 7, LOWER_COMP: 7, LOWER_UNCOMP: 5 };
    var target = targets[classification] || 7;
    if ((classification === 'LOWER_UNCOMP' && ABX.abx_day >= 6) ||
        (classification !== 'LOWER_UNCOMP' && classification !== 'UROSEPSIS' && ABX.abx_day >= 8) ||
        (classification === 'UROSEPSIS' && ABX.abx_day >= 15)) {
      durFlag = '<span class="mn-contra-x">\u26a0</span> Duration (' + ABX.abx_day + ' days) exceeds guideline target (' + target + ' days) — review indication for continuing antibiotics.';
    } else {
      durFlag = '<span class="mn-contra-x">\u2139</span> Day ' + ABX.abx_day + ' of ' + target + '-day target course.';
    }
    flagDur.innerHTML = durFlag;
  }

  /* ── Gentamicin monitoring */
  if (ABX.current_abx === 'gentamicin') {
    var flagGent = document.getElementById('abx-flag-gentamicin');
    if (flagGent) {
      if (ABX.weight === null) {
        flagGent.innerHTML = '<span class="mn-contra-x">\u26a0</span> Weight required for gentamicin dosing — enter weight in Patient Profile (Step 1).';
      } else {
        var dw = abxGentamicinWeight();
        flagGent.innerHTML = '<span class="mn-contra-x">\u2139</span> Gentamicin: once-daily dosing per local nomogram. Dosing weight ' + (dw !== null ? dw.toFixed(1) + ' kg' : 'unknown') + '. Levels at 18–24hr. Daily eGFR. Stop if eGFR falls >20%.';
      }
    }
  }

  /* ── Follow-up schedule */
  var followEl = document.getElementById('abx-followup-schedule');
  if (followEl && ABX.abx_day !== null) {
    var schedLines = [];
    schedLines.push('Day ' + ABX.abx_day + ' (current): Review response, culture, and inflammatory markers.');
    if (ABX.culture === 'pending') {
      schedLines.push('Within 24hr: Chase culture result — de-escalation cannot proceed without it.');
    }
    if (abxRenalImpaired() || ABX.current_abx === 'gentamicin') {
      schedLines.push('72hr: Recheck eGFR.');
    }
    followEl.innerHTML = schedLines.map(function(s) {
      return '<div class="followup-line">' + s + '</div>';
    }).join('');
  }
}
