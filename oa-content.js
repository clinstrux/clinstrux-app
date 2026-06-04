/* ════════════════════════════════════════════════════════════
   data/oa-content.js — Osteoarthritis workflow content
   Label maps, recommendation templates, clinical impression
   templates, and longitudinal timepoint definitions.
   No logic, no calculations, no DOM access.
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ─── Parameter label maps ──────────────────────────────────────────────── */

var GI_LABELS = {
  none:           'No GI history',
  dyspepsia:      'Dyspepsia only',
  ulcer:          'Prior peptic ulcer',
  'ulcer-recent': 'Active / recent ulcer',
  bleed:          'Prior GI bleed'
};

var GI_RISK_LABELS = {
  none:           'Baseline risk',
  dyspepsia:      'Low-moderate risk',
  ulcer:          'High risk',
  'ulcer-recent': 'Very high risk',
  bleed:          'Very high risk'
};

var CV_LABELS      = { low: 'Low', mod: 'Moderate', high: 'High', 'very-high': 'Very high' };
var CV_RISK_LABELS = { low: 'No major factors', mod: 'Hypertension', high: 'Multiple risk factors', 'very-high': 'Established CVD' };

var FAILED_LABELS = {
  none:    'No prior therapies',
  physio:  'Physio only',
  apap:    'Acetaminophen failed',
  '1nsaid':'1 NSAID failed',
  '2nsaid':'2 NSAIDs failed',
  multi:   'Multiple classes failed'
};
var FAILED_RISK_LABELS = {
  none:    'Treatment naive',
  physio:  'Analgesic naive',
  apap:    'Core option exhausted',
  '1nsaid':'Intolerance documented',
  '2nsaid':'Intolerance documented',
  multi:   'Multimodal failure'
};

var ADH_LABELS      = { good: 'Good adherence', partial: 'Inconsistent PRN', poor: 'Poor adherence', unknown: 'Adherence unknown' };
var ADH_RISK_LABELS = { good: 'Low concern', partial: 'Concern noted', poor: 'High concern', unknown: 'Assess at next visit' };

var SED_LABELS      = { none: 'No concern', mod: 'Mild preference', high: 'High concern', fall: 'Fall risk active' };
var SED_RISK_LABELS = { none: 'Accepts sedation', mod: 'Prefers non-sedating', high: 'Patient refuses sedation', fall: 'Sedation contraindicated' };

var INTOL_LABELS = {
  none:        'None documented',
  'gi-nsaid':  'NSAIDs: GI only',
  'bp-nsaid':  'NSAIDs: BP only',
  'both-nsaid':'NSAIDs: GI + BP',
  apap:        'Acetaminophen',
  multi:       'Multiple classes'
};
var INTOL_RISK_LABELS = {
  none:        'No intolerance',
  'gi-nsaid':  'Documented × 1',
  'bp-nsaid':  'Documented × 1',
  'both-nsaid':'Documented × 2',
  apap:        'Key option affected',
  multi:       'Multiple affected'
};

/* ─── Clinical Status Summary — metric display maps ────────────────────── */

var OA_CSS_STATUS = {
  unstable: { val: 'Unstable',  sub: 'Acute risk factors present',           cls: 'css-val-red'   },
  guarded:  { val: 'Guarded',   sub: 'Active risk factors — monitor closely', cls: 'css-val-amber' },
  stable:   { val: 'Stable',    sub: 'No acute deterioration',                cls: 'css-val-green' }
};

var OA_CSS_FUNCTIONAL = {
  severe:   { val: 'Severe',         sub: 'Markedly limits daily activities', cls: 'css-val-red'   },
  moderate: { val: 'Moderate',       sub: 'Stair use and walking limited',    cls: 'css-val-amber' },
  mild_mod: { val: 'Mild–Moderate',  sub: 'Some activity restriction',        cls: 'css-val-amber' },
  mild:     { val: 'Mild',           sub: 'Manageable with current regimen',  cls: 'css-val-green' }
};

var OA_CSS_SYMPTOM_PREFIX = 'NRS '; // followed by P.pain + '/10 · severity label'

var OA_CSS_SYMPTOM_SEVERITY = {
  high:     { val: 'High',          suffix: ' · Severe',    cls: 'css-val-red'   },
  mod_high: { val: 'Moderate–High', suffix: ' · Bilateral', cls: 'css-val-amber' },
  moderate: { val: 'Moderate',      suffix: '',             cls: 'css-val-amber' },
  low:      { val: 'Low',           suffix: ' · Manageable',cls: 'css-val-green' }
};

var OA_CSS_RISK = {
  high:     { val: 'High',          sub: 'Multiple compound constraints',    cls: 'css-val-red'   },
  mod_high: { val: 'Moderate–High', sub: 'GI + renal + age constraints',     cls: 'css-val-amber' },
  moderate: { val: 'Moderate',      sub: 'Active risk factors present',      cls: 'css-val-amber' },
  low:      { val: 'Low',           sub: 'No major risk factors active',     cls: ''              }
};

var OA_CSS_PATHWAY = {
  exhausted:   { val: 'Severely Limited', sub: 'Most classes exhausted',    cls: 'css-val-red'   },
  constrained: { val: 'Constrained',      sub: 'NSAID & opioid closed',     cls: 'css-val-amber' },
  restricted:  { val: 'Restricted',       sub: 'NSAID pathway closed',      cls: 'css-val-amber' },
  open:        { val: 'Open',             sub: 'Standard options available', cls: 'css-val-green' }
};

var OA_CSS_URGENCY = {
  urgent:  { val: 'Urgent',  sub: 'Immediate action required',          cls: 'css-val-red'   },
  prompt:  { val: 'Prompt',  sub: 'Initiate today · Review Wk 2',       cls: 'css-val-amber' },
  routine: { val: 'Routine', sub: 'Elective — monitor at follow-up',    cls: ''              }
};

var OA_CSS_OVERALL_BADGE = {
  review:   { label: 'Clinical Review Required', cls: 'css-badge-red'   },
  elevated: { label: 'Monitoring Elevated',       cls: 'css-badge-amber' },
  stable:   { label: 'Clinically Stable',         cls: ''               }
};

/* ─── Recommendation templates ──────────────────────────────────────────── */

var OA_REC = {
  apap_intol_nsaid: {
    drug: 'Low-dose NSAID\n+ PPI cover',
    state: 'Escalation Required',
    confPct: 55, confLabel: 'Moderate confidence',
    confDesc: 'Acetaminophen intolerance shifts first-line pathway · Close GI monitoring',
    rationale: 'Acetaminophen contraindicated or failed — documented intolerance shifts the first-line recommendation. Low-dose NSAID with mandatory PPI cover is the next appropriate option. Intensive GI and renal monitoring required given patient profile. This represents a high-risk therapeutic pathway.'
  },
  specialist: {
    drug: 'Specialist Review\nRequired',
    state: 'Escalation — No Safe First-Line',
    confPct: 38, confLabel: 'Low confidence — complex case',
    confDesc: 'Acetaminophen and NSAID pathways both compromised · Specialist input needed',
    rationale: 'Both primary analgesic pathways are compromised in this patient. Acetaminophen intolerance and NSAID contraindications leave limited safe pharmacological options for this severity of pain. Specialist rheumatology or pain medicine referral is recommended before initiating further pharmacotherapy.'
  },
  apap_nsaid_combo: {
    drug: 'Acetaminophen\n+ Topical NSAID',
    state: 'Combination · First-line',
    confPct: 70, confLabel: 'Moderate-High confidence',
    confDesc: 'Combination approach for severe pain with prior monotherapy failure',
    rationale: 'Severe pain ({pain}/10) combined with prior analgesic failures supports combination first-line approach. Acetaminophen provides systemic baseline analgesia; topical NSAID provides localized anti-inflammatory effect with lower systemic exposure. Monitor renal and GI parameters.'
  },
  apap_nsaid_contraind: {
    drug: 'Acetaminophen\n(Paracetamol)',
    state: 'Preferred · First-line',
    confPct: 82, confLabel: 'High confidence',
    confDesc: 'Supported by ACR/EULAR guidelines · Multiple RCTs',
    rationale_base: 'Best safety balance for this patient profile: avoids NSAID-related complications while providing adequate pain control.',
    rationale_gi_very_high: ' Recent or active GI bleeding history makes NSAID initiation a critical safety risk.',
    rationale_gi_high: ' High GI risk (prior peptic ulcer) substantially elevates NSAID-related bleeding probability.',
    rationale_renal_severe: ' Moderate-to-severe renal impairment (eGFR {egfr}) makes NSAID use unsafe — significant prostaglandin-dependent perfusion dependency.',
    rationale_renal_mild: ' Baseline renal impairment (eGFR {egfr}) further strengthens NSAID avoidance.',
    rationale_age: ' Age {age} activates Beers Criteria NSAID exclusion.',
    rationale_bp: ' Uncontrolled hypertension ({bp} mmHg) makes NSAID initiation unsafe — significant BP elevation risk.',
    rationale_intol: ' Both GI and BP NSAID intolerances are documented in this patient.'
  },
  apap_standard: {
    drug: 'Acetaminophen\n(Paracetamol)',
    state: 'Preferred · First-line',
    confPct: 78, confLabel: 'High confidence',
    confDesc: 'ACR guideline aligned · Multiple RCT support',
    rationale: 'Acetaminophen remains the safest first-line analgesic for this patient given current risk profile. Pain severity ({pain}/10) is appropriate for acetaminophen monotherapy at this stage.'
  }
};

/* ─── NSAID reasoning text fragments ───────────────────────────────────── */

var OA_NSAID = {
  contraind: {
    state: 'Avoid',
    reason_very_high_gi:    'Multiple absolute contraindications make NSAID use clinically unsafe in this patient.',
    reason_high_gi:         'Compound contraindication profile renders NSAIDs inappropriate as analgesic pathway.',
    reason_default:         'NSAIDs deprioritized due to safety profile in this patient context.',
    gi_bleed:               'Active or prior GI bleed — NSAID initiation carries high probability of re-bleeding. Absolute contraindication.',
    gi_ulcer_recent:        'Recent peptic ulcer (&lt;1yr) substantially elevates NSAID-related GI complication risk. Contraindicated.',
    gi_high_intol:          'Elevated GI bleeding risk — prior peptic ulcer + documented NSAID-induced GI intolerance ({intol_detail})',
    gi_present:             'GI risk present — careful monitoring would be required if NSAID pathway considered in future',
    bp_uncontrolled:        'Hypertension uncontrolled ({bp} mmHg systolic) — NSAID initiation carries clinically significant risk of further BP elevation',
    bp_intol:               'BP elevation documented with prior NSAID use — previous diclofenac caused +18 mmHg systolic; amlodipine efficacy may be compromised',
    bp_cv_monitor:          'CV monitoring required if NSAID pathway ever initiated — controlled hypertension present',
    renal_severe:           'Severe renal impairment (eGFR {egfr}) — NSAIDs absolutely contraindicated; prostaglandin-dependent renal perfusion at high risk',
    renal_moderate:         'Moderate renal impairment (eGFR {egfr}) — NSAIDs impair renal perfusion significantly at this eGFR; avoid unless absolutely necessary',
    renal_mild:             'Renal monitoring concern — eGFR {egfr}; NSAIDs impair renal perfusion and cannot be safely initiated without close monitoring',
    age_beers:              'Age {age} — Beers Criteria (AGS 2023) recommends against NSAIDs in adults ≥65 unless all alternatives exhausted',
    age_no_flag:            'Patient age ({age}) does not trigger Beers Criteria flag — age is not the primary contraindication driver in this profile'
  },
  conditional: {
    state: 'Conditional',
    reason: 'NSAIDs are not absolutely contraindicated in this updated profile, but remain a secondary option to acetaminophen due to residual risk factors.',
    gi:     'GI risk remains present — {gi_label}. Low-dose with PPI cover required.',
    bp:     'BP status: {bp_risk} ({bp} mmHg) — monitor BP closely if NSAID initiated',
    renal:  'Renal function: eGFR {egfr} — baseline monitoring required at 2 and 6 weeks if NSAID started',
    age_flag:    'Age {age} — Beers Criteria flag remains active; use lowest effective dose and shortest duration',
    age_no_flag: 'Age {age} — no Beers flag; standard dosing considerations apply'
  }
};

/* ─── Opioid reasoning text ─────────────────────────────────────────────── */

var OA_OPIOID = {
  avoid_multimodal: {
    state: 'Avoid',
    reason: 'Multiple factors converge to exclude opioids as a viable management pathway for this patient.'
  },
  avoid_falls: {
    state: 'Avoid',
    reason: 'Opioid analgesics are not appropriate given the patient\'s fall risk profile and sedation sensitivity.'
  },
  avoid_preference: {
    state: 'Avoid',
    reason: 'Patient preference and documented concerns around sedation preclude opioid consideration at this stage.'
  },
  caution: {
    state: 'Caution',
    reason: 'Opioids are not contraindicated in this profile but carry meaningful risk given age and comorbidities.'
  },
  not_indicated: {
    state: 'Not indicated',
    reason: 'Current pain severity and available alternatives do not support opioid initiation at this stage.'
  }
};

/* ─── Clinical Impression — static tone/text for each reasoning branch ─── */

var OA_CI = {
  pain: {
    severe:   { tone: 'red',   text: 'Severe pain at NRS {pain}/10 is producing significant functional impairment. The patient is unable to perform basic daily activities and the current analgesic approach has not provided adequate relief.' },
    mod_high: { tone: 'amber', text: 'Patient remains symptomatic at NRS {pain}/10 with moderate-to-severe pain and progressive functional limitation. Bilateral joint involvement is contributing to restricted mobility and reduced independence with daily activities.' },
    moderate: { tone: 'amber', text: 'Moderate pain at NRS {pain}/10. Functional capacity is partially preserved but activity limitation is present and affecting daily routine.' },
    low:      { tone: 'green', text: 'Pain is currently well-controlled at NRS {pain}/10. Functional status appears maintained at this timepoint and no acute deterioration is evident.' }
  },
  risk: {
    compound_gi_renal: { tone: 'red',   text: 'Analgesic options are substantially constrained by a compound risk profile. A history of GI haemorrhage combined with significant renal impairment (eGFR {egfr} mL/min) closes the NSAID pathway on two independent grounds and limits escalation options to the least nephrotoxic and gastrotoxic agents.' },
    gi_very_high:      { tone: 'red',   text: 'Prior GI haemorrhage is the dominant risk constraint. NSAIDs of all classes are contraindicated regardless of pain severity or selectivity — a firm, non-negotiable restriction that must guide the analgesic strategy.' },
    gi_renal_compound: { tone: 'amber', text: 'Compound GI and renal risk restricts analgesic selection. A documented peptic ulcer history alongside borderline renal function (eGFR {egfr} mL/min) places the NSAID pathway beyond reach and limits the available escalation options at both axes.' },
    gi_high:           { tone: 'amber', text: 'Peptic ulcer history introduces a sustained GI constraint. NSAIDs carry meaningful risk of ulcer reactivation and GI bleeding in this context, particularly given the patient\'s age.' },
    renal_severe:      { tone: 'red',   text: 'Renal impairment (eGFR {egfr} mL/min) is the primary analgesic constraint at this stage. Prostaglandin-dependent renal autoregulation is at risk; NSAIDs are contraindicated and acetaminophen dose adjustment is required.' },
    renal_mild:        { tone: 'amber', text: 'Mild renal impairment (eGFR {egfr} mL/min, CKD G3a) warrants monitoring of any analgesic with nephrotoxic potential and introduces a dose ceiling for standard acetaminophen regimens.' }
  },
  bp: {
    uncontrolled: { tone: 'red',   text: 'Blood pressure is uncontrolled at SBP {bp} mmHg. Any NSAID use at this level carries direct risk of further BP elevation and interference with antihypertensive therapy.' },
    elevated:     { tone: 'amber', text: 'Blood pressure is elevated at SBP {bp} mmHg. NSAIDs are likely to antagonise amlodipine efficacy; previous diclofenac use produced a documented rise of +18 mmHg, supporting continued avoidance.' }
  },
  failures: {
    multimodal:  { tone: 'red',   text: 'Multiple analgesic classes have been trialled without sustained benefit. The conventional treatment pathway is substantially exhausted and further escalation decisions require specialist review before any new agent class is introduced.' },
    apap_failed: { tone: 'amber', text: 'Acetaminophen has been trialled at adequate dose and frequency without sufficient effect. First-line conservative management has been explored; escalation to a second-line option appropriate to the current risk profile is now warranted.' },
    two_nsaid:   { tone: 'amber', text: 'Two NSAIDs have been discontinued due to documented intolerance. These trials collectively confirm the NSAID pathway is not viable for this patient. Fixed-schedule acetaminophen TID has not yet been formally evaluated and should be established before any further escalation is considered.' },
    one_nsaid:   { tone: 'amber', text: 'One NSAID has been discontinued due to intolerance. First-line alternatives should be fully evaluated before considering a second NSAID trial.' }
  },
  adherence: {
    poor:    { tone: 'amber', text: 'Adherence to the prescribed regimen is documented as poor. Apparent treatment failure at this stage cannot be meaningfully assessed without first establishing consistent drug exposure on a fixed schedule.' },
    partial: { tone: 'amber', text: 'Medication use has been inconsistent, taken on a PRN basis rather than as a scheduled regimen. Adequacy of analgesic exposure on a fixed-dose schedule has not yet been assessed.' }
  },
  opioid_closed: { tone: 'muted', text: 'Opioid analgesia is not appropriate for this patient. Fall risk, sedation sensitivity, and the patient\'s own preference collectively place this pathway outside the current scope of management.' },
  trajectory: {
    stable:            { tone: 'green', text: 'Clinical status remains stable compared to the previous review. Symptom burden has not escalated and no new risk factors have emerged at this timepoint.' },
    persistent_pain:   { tone: 'amber', text: 'Symptom control remains inadequate at this review. The current management approach warrants reassessment given sustained pain burden at follow-up.' },
    no_escalation:     { tone: 'muted', text: 'No acute escalation triggers are present at initial assessment. Conservative management can be established and formally evaluated before any further pathway decisions are required.' }
  },
  conclusions: {
    specialist:     'Specialist-led review is required before initiating any further analgesic class. Symptomatic management should be optimised within available options while referral is arranged.',
    apap_failed:    'First-line acetaminophen has been trialled without adequate effect. Escalation within the current risk profile is now appropriate, subject to the constraint analysis above.',
    compound_risk:  'The recommendation reflects the safest achievable option given the compound contraindications present. Expectations for analgesia should be calibrated accordingly, and functional outcomes should be monitored at each review.',
    nsaid_closed:   'Risk profile supports initiation of acetaminophen TID on a fixed schedule as first-line management. Adequacy should be formally assessed at Week 2 before any further escalation decision is made.',
    favourable:     'Clinical trajectory is favourable at this review. Current management should be continued and monitoring intensity can be stepped down if stability is confirmed at the next contact.',
    standard:       'Initiation of scheduled acetaminophen with systematic monitoring is the appropriate first step in this clinical pathway. Early reassessment will confirm whether the response is sufficient or whether escalation is warranted.'
  }
};

/* ─── Longitudinal timepoints — full content definitions ───────────────── */

var OA_TIMEPOINTS = [
  {
    idx: 0, label: 'Day 1', sublabel: 'Initiation visit',
    drift: {}, delta: null,
    pathwayStates:   ['active','future','future','future','future'],
    pathwayOutcomes: [null, null, null, null, null],
    missed: false
  },
  {
    idx: 1, label: 'Week 2', sublabel: 'Pain & adherence review',
    drift: { pain: -1, adh: 'partial' },
    delta: {
      severity: 'warn',
      title: 'Status at Week 2 review',
      from: 'Since Day 1 initiation',
      changes: [
        { param:'Pain (NRS)',    text:'<span class="lp-worsened">Still 5/10</span> — partial improvement from 6/10. Target NRS ≤3 not yet reached. Functional limitations persist.',          key:'pain' },
        { param:'Adherence',    text:'<span class="lp-new">PRN pattern resuming</span> — patient reports not taking doses on low-pain days. Fixed-schedule adherence not confirmed at this visit.', key:'adh'  },
        { param:'Renal (eGFR)', text:'<span class="lp-unchanged">Stable ~58 mL/min</span> — baseline labs obtained at Day 1. No trajectory change detectable at 2 weeks.',                        key:'egfr' },
        { param:'GI tolerance', text:'<span class="lp-improved">Tolerating well</span> — no epigastric symptoms reported. Pantoprazole cover maintained.',                                         key:'gi'   }
      ],
      implication: 'Pain response is partial, but escalation criteria are not yet met on confirmed fixed-schedule therapy. The unresolved adherence gap means apparent non-response cannot be attributed to pharmacological inadequacy — reinforce TID schedule before considering escalation. Escalation at this point would be premature.'
    },
    pathwayStates:   ['past','active','future','future','future'],
    pathwayOutcomes: [{ cls:'outcome-ok', text:'✓ Initiated' }, { cls:'outcome-escalated', text:'→ Adherence: unconfirmed' }, null, null, null],
    missed: false
  },
  {
    idx: 2, label: 'Week 4', sublabel: 'Escalation decision',
    drift: { pain: 0, adh: 'poor', egfr: -3, bp: +5 },
    delta: {
      severity: 'warn',
      title: 'Status at Week 4 escalation review',
      from: 'Accumulated since Day 1 initiation',
      changes: [
        { param:'Pain (NRS)',      text:'<span class="lp-worsened">6/10 — unchanged</span> from baseline. Acetaminophen analgesic ceiling may be insufficient, but adherence failure has not been excluded as primary driver.', key:'pain' },
        { param:'Adherence',      text:'<span class="lp-worsened">Confirmed poor</span> — patient now reporting most-days missed doses. PRN use only on severe pain days. Fixed TID schedule not established despite reinforcement at Week 2.', key:'adh'  },
        { param:'Renal (eGFR)',   text:'<span class="lp-new">eGFR 55 mL/min</span> — small decline from 58 at Day 1. Within biological variability, but directionally declining. G3a range maintained. Trend direction now visible for first time.', key:'egfr' },
        { param:'Blood pressure', text:'<span class="lp-new">133 mmHg systolic</span> — mildly elevated from 128. Within acceptable range. Consistent with intermittent amlodipine adherence.', key:'bp'   }
      ],
      implication: 'Escalation at Week 4 is clinically premature while adherence remains unconfirmed. Pain persistence at NRS 6/10 cannot be reliably attributed to pharmacological inadequacy when the patient is not taking medications as prescribed. The renal trend (58→55) is small but now directionally visible — escalation to topical NSAID should be deferred until adherence is established and the renal trajectory is confirmed stable. Polypharmacy burden has increased with adherence-driven therapeutic uncertainty.'
    },
    pathwayStates:   ['past','past','active','future','future'],
    pathwayOutcomes: [
      { cls:'outcome-ok', text:'✓ Initiated' }, { cls:'outcome-concern', text:'⚠ Adherence gap — unresolved' },
      { cls:'outcome-escalated', text:'→ Deferred — adherence prerequisite unmet' }, null, null
    ],
    missed: false
  },
  {
    idx: 3, label: 'Week 8', sublabel: 'Comprehensive review',
    drift: { pain: 0, adh: 'poor', egfr: -7, bp: +14, cv: 'high' },
    delta: {
      severity: 'alert',
      title: 'Status at Week 8 — management reassessment required',
      from: 'Progressive change since Day 1',
      changes: [
        { param:'Renal (eGFR)',         text:'<span class="lp-worsened">eGFR 51 mL/min</span> — down from 58 at baseline. 12% decline over 8 weeks. Trend now confirmed declining. Approaching the 50 mL/min absolute NSAID threshold. Topical NSAID escalation window is closing.', key:'egfr' },
        { param:'Blood pressure',       text:'<span class="lp-worsened">142 mmHg systolic</span> — progressively elevated. Amlodipine adherence should be reviewed. Not yet triggering the 160 mmHg discontinuation threshold, but trajectory warrants active monitoring.', key:'bp'  },
        { param:'Cardiovascular risk',  text:'<span class="lp-worsened">Reclassified: High</span> — cumulative progression of hypertension trajectory and declining renal function has shifted the CV risk profile.', key:'cv'   },
        { param:'Pain (NRS)',           text:'<span class="lp-worsened">Still 6/10</span> — unchanged over 8 weeks. Conservative management ceiling has been reached under current adherence pattern. Functional goals not met.', key:'pain' },
        { param:'Adherence',           text:'<span class="lp-worsened">Persistent poor pattern</span> — 8-week pattern now confirmed. Blister packaging was not implemented. Pharmacological efficacy assessment is unreliable.', key:'adh'  }
      ],
      implication: 'The Week 8 picture has materially shifted the risk balance. The eGFR decline from 58 to 51 narrows the escalation corridor — topical NSAID use now requires confirmation that eGFR is ≥50, which it marginally meets but without safety margin. The BP trajectory (128→142) and reclassified CV risk make any systemic NSAID inappropriate. Conservative management ceiling has been reached. Physiotherapy referral (home-based) and orthopedic consultation are now the appropriate next steps, not further pharmacological escalation.'
    },
    pathwayStates:   ['past','past','past','active','future'],
    pathwayOutcomes: [
      { cls:'outcome-ok',         text:'✓ Initiated' },
      { cls:'outcome-concern',    text:'⚠ Adherence unresolved' },
      { cls:'outcome-escalated',  text:'→ Conservative mgmt ceiling reached' },
      { cls:'outcome-concern',    text:'⚠ Renal + BP trend: active monitoring' },
      null
    ],
    missed: false
  },
  {
    idx: 4, label: '3 Months', sublabel: 'Stable-phase review',
    drift: { pain: -2, adh: 'partial', egfr: -9, bp: +10, cv: 'high' },
    delta: {
      severity: 'warn',
      title: 'Status at 3-month stable-phase review',
      from: 'Longitudinal course: Day 1 → 3 months',
      changes: [
        { param:'Renal (eGFR)',      text:'<span class="lp-worsened">eGFR 49 mL/min</span> — crossed the 50 mL/min NSAID threshold. All NSAIDs now absolutely contraindicated. Acetaminophen ceiling reduced to 2.5 g/day. Nephrology co-management now indicated.', key:'egfr' },
        { param:'Pain (NRS)',        text:'<span class="lp-improved">4/10 — partial improvement</span> from 6/10 baseline. Physiotherapy has contributed to functional progress. Not at target (NRS ≤3) but trend is improving.', key:'pain' },
        { param:'Adherence',        text:'<span class="lp-improved">Improving — inconsistent</span> but better than prior visits. Blister packaging implemented at Week 10. Fixed-schedule use more consistent.', key:'adh'  },
        { param:'Blood pressure',   text:'<span class="lp-unchanged">138 mmHg systolic</span> — stable at elevated level. Antihypertensive adherence improved. Monitoring ongoing. Amlodipine remains appropriate.', key:'bp'   },
        { param:'Surgical candidacy', text:'<span class="lp-new">TKA discussion initiated</span> — functional goals not fully met at 3 months. Orthopedic referral submitted. Conservative management ceiling confirmed.', key: null }
      ],
      implication: 'The 3-month trajectory has produced a meaningful shift in the treatment logic. eGFR has crossed 50 mL/min, making all NSAIDs absolutely contraindicated and reducing the acetaminophen ceiling. The previously acceptable topical NSAID escalation path is now closed permanently under the current renal trajectory. Pain has partially improved with physiotherapy. The dominant clinical question is now surgical candidacy assessment (TKA) rather than pharmacological escalation. Nephrology co-management is required for ongoing renal monitoring. The polypharmacy burden has paradoxically simplified — fewer options mean a cleaner, more conservative regimen.'
    },
    pathwayStates:   ['past','past','past','past','active'],
    pathwayOutcomes: [
      { cls:'outcome-ok',        text:'✓ Initiated' },
      { cls:'outcome-concern',   text:'⚠ Adherence concern (resolved at wk 10)' },
      { cls:'outcome-escalated', text:'→ Physio referral — delayed' },
      { cls:'outcome-escalated', text:'→ Ortho referral submitted' },
      { cls:'outcome-concern',   text:'⚠ eGFR <50 — pathway closed' }
    ],
    missed: false
  }
];

/* ─── Template interpolation helper ────────────────────────────────────── */

/**
 * Replaces {token} placeholders in a template string with values from a map.
 * Used by oa.js to merge patient values into content templates.
 * @param  {string} tpl    Template with {token} placeholders
 * @param  {object} values Map of token → replacement value
 * @return {string}
 */
function oaFill(tpl, values) {
  return tpl.replace(/\{(\w+)\}/g, function(_, key) {
    return values[key] !== undefined ? values[key] : '{' + key + '}';
  });
}
