/* ════════════════════════════════════════════════════════════
   data/abx-content.js — Antibiotic Stewardship workflow content
   Label maps, status display maps, recommendation templates,
   clinical impression templates.
   No logic, no calculations, no DOM access.
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ─── Parameter card display maps ───────────────────────────────────────── */

var ABX_IMPROVEMENT_LABELS = {
  improving: 'Improving',
  stable:    'Stable',
  worsening: 'Worsening'
};
var ABX_IMPROVEMENT_SUBS = {
  improving: 'Tolerating oral intake · mobilising',
  stable:    'No deterioration — limited change',
  worsening: 'Clinical decline noted'
};
var ABX_IMPROVEMENT_CLS = {
  improving: 'abx-val-green',
  stable:    'abx-val-amber',
  worsening: 'abx-val-red'
};

var ABX_CULTURE_LABELS = {
  pending:     'Pending',
  'no-growth': 'No growth',
  sensitive:   'Sensitive organism',
  resistant:   'Resistant organism',
  contaminant: 'Likely contaminant'
};
var ABX_CULTURE_SUBS = {
  pending:     'Blood cultures day 1 — no growth to date',
  'no-growth': '72hr negative — de-escalation supported',
  sensitive:   'Narrow-spectrum agent possible',
  resistant:   'Broad-spectrum therapy required',
  contaminant: 'Clinical correlation needed'
};
var ABX_CULTURE_CLS = {
  pending:     'abx-val-amber',
  'no-growth': 'abx-val-green',
  sensitive:   'abx-val-green',
  resistant:   'abx-val-red',
  contaminant: 'abx-val-amber'
};

/* ─── Clinical Status Summary — metric display maps ────────────────────── */

var ABX_CSS_TRAJECTORY = {
  improving: { val: 'Improving', sub: 'Tolerating oral · mobilising',       cls: 'css-val-green' },
  stable:    { val: 'Stable',    sub: 'No deterioration — limited change',   cls: 'css-val-amber' },
  worsening: { val: 'Worsening', sub: 'Clinical decline — reassess urgently',cls: 'css-val-red'   }
};

var ABX_CSS_BADGE = {
  worsening: { label: 'Clinical deterioration',      cls: 'css-badge-red'   },
  stable:    { label: 'Stable — limited response',   cls: 'css-badge-amber' },
  improving: { label: 'Clinical improvement noted',  cls: ''                }
};

/* ─── Recommendation templates ──────────────────────────────────────────── */

var ABX_REC = {
  escalate: {
    action: 'Escalate<br>Therapy',
    state:  'Urgent — treatment failure',
    conf: 88, confLabel: 'High confidence',
    confDesc: 'Clinical deterioration is a firm escalation trigger',
    rationale: 'Patient is clinically deteriorating on current antimicrobial therapy. This constitutes a treatment failure signal. Escalation of antimicrobial spectrum is indicated, along with urgent repeat cultures, infectious diseases review, and reassessment of the working diagnosis. Do not de-escalate.',
    chip1: '<span class="ds-primary-ev-chip strong">Treatment failure criteria met</span>',
    chip2: '<span class="ds-primary-ev-chip caution">Urgent ID review indicated</span>',
    chip3: '<span class="ds-primary-ev-chip caution">Repeat cultures before escalating</span>',
    chip4_renal:    '<span class="ds-primary-ev-chip caution">Severe renal impairment — agent selection critical</span>',
    chip4_standard: '<span class="ds-primary-ev-chip">Maintain renal dose monitoring</span>',
    deescTarget: 'Infectious diseases input<br><span class="ds-pcol-sub">Before any agent change</span>',
    prereq:      'Repeat blood cultures<br><span class="ds-pcol-sub">Obtain before escalating</span>',
    wn_deesc_state: 'Not appropriate', wn_deesc_cls: 'wn-col-state avoid',
    wn_esc_state:   'Required',        wn_esc_cls:   'wn-col-state',
    wn_deesc_reason:   'Clinical deterioration is an absolute contraindication to de-escalation regardless of culture data.',
    wn_esc_reason:     'Treatment failure is the only established escalation trigger. It is present here.',
    wn_continue_reason:'Continuing current therapy without change is inappropriate given documented deterioration.',
    wn_culture_item:   'Repeat cultures before changing therapy — existing results insufficient if taken on admission only.'
  },
  reassess: {
    action: 'Reassess<br>in 48 Hours',
    state:  'Observe — insufficient signal',
    conf: 62, confLabel: 'Moderate confidence',
    confDesc: 'Stable trajectory without clear improvement or deterioration',
    rationale: 'Patient is stable but has not demonstrated meaningful clinical improvement. Inflammatory markers remain elevated and culture data is not yet available to guide de-escalation. The appropriate stewardship action is to continue current therapy and formally reassess at 48 hours with updated culture results and clinical status. Neither escalation nor de-escalation is supported by the current data.',
    chip1: '<span class="ds-primary-ev-chip">Continue current therapy</span>',
    chip2: '<span class="ds-primary-ev-chip caution">Await culture result</span>',
    chip3: '<span class="ds-primary-ev-chip caution">Reassess at 48hr with updated labs</span>',
    chip4_renal:    '<span class="ds-primary-ev-chip caution">Renal dose monitoring</span>',
    chip4_standard: '<span class="ds-primary-ev-chip">No dose adjustment required</span>',
    deescTarget: 'Defer pending culture<br><span class="ds-pcol-sub">Reassess at 48hr</span>',
    prereq:      'Updated clinical assessment<br><span class="ds-pcol-sub">Plus culture result</span>',
    wn_deesc_state: 'Not yet', wn_deesc_cls: 'wn-col-state cond',
    wn_esc_state:   'Not indicated', wn_esc_cls: 'wn-col-state avoid',
    wn_deesc_reason:    'De-escalation requires demonstrated clinical improvement — not yet present.',
    wn_esc_reason:      'No deterioration trigger — escalation would be premature and not stewardship-appropriate.',
    wn_continue_reason: 'Current therapy is appropriate. Await 48hr data before changing course.',
    wn_culture_item:    'Culture result will be the key determinant of next decision — document plan to review on receipt.'
  },
  deescalate: {
    action: 'Consider<br>De-escalation',
    conf_strong: 86, conf_standard: 72,
    confLabel_strong:   'High confidence',
    confLabel_standard: 'Moderate-high confidence',
    confDesc_strong:    'Clinical improvement + microbiological support',
    confDesc_standard:  'Clinical trajectory supports step-down · pending culture confirmation',
    chip1: '<span class="ds-primary-ev-chip strong">IDSA Stewardship Principles</span>',
    chip2: '<span class="ds-primary-ev-chip strong">Clinical improvement outweighs markers</span>',
    chip3_pending:   '<span class="ds-primary-ev-chip caution">Culture data awaited</span>',
    chip3_sensitive: '<span class="ds-primary-ev-chip strong">Sensitive organism confirmed</span>',
    chip3_no_growth: '<span class="ds-primary-ev-chip strong">No growth at 72hr</span>',
    chip4_renal:     '<span class="ds-primary-ev-chip caution">Renal dose adjustment maintained</span>',
    chip4_standard:  '<span class="ds-primary-ev-chip">Standard oral dosing</span>',
    deescTarget: 'Oral amoxicillin-clavulanate<br><span class="ds-pcol-sub">If no resistant organism</span>',
    prereq_pending:   '72-hr culture result<br><span class="ds-pcol-sub">No growth or sensitive organism</span>',
    prereq_confirmed: '<span style="color:var(--green)">Culture criteria met</span><br><span class="ds-pcol-sub">Proceed when prescriber reviews</span>',
    wn_deesc_state: 'Preferred', wn_deesc_cls: 'wn-col-state',
    wn_esc_state:   'Not indicated', wn_esc_cls: 'wn-col-state avoid',
    wn_deesc_reason:    'Clinical improvement is the primary trigger for IV-to-oral step-down.',
    wn_esc_reason:      'No clinical or microbiological trigger for escalation at this review.',
    wn_continue_reason: 'Continued IV therapy beyond clinical stability criteria carries line infection risk without additional clinical benefit.',
    wn_culture_item_pending:   'Await culture result before finalising — no growth likely supports narrow-spectrum oral.',
    wn_culture_item_sensitive: 'Culture supports narrow-spectrum oral agent — de-escalation fully appropriate.',
    wn_culture_item_no_growth: 'No growth at 72hr removes the microbiological argument for continued broad-spectrum IV.'
  }
};

/* ─── Renal dosing text ─────────────────────────────────────────────────── */

var ABX_RENAL_DOSING = {
  severe: {
    label: '2.25 g TDS (eGFR <30)',
    note:  'Significant dose reduction required. Consider extended infusion strategy. Review with pharmacy.'
  },
  impaired: {
    label: '4.5 g TDS (eGFR 30–59)',
    note:  'Dose interval extended per renal guidance. Standard dose 4.5 g QDS at eGFR ≥60.'
  },
  normal: {
    label: '4.5 g QDS (eGFR ≥60)',
    note:  'Standard dosing. No renal adjustment required at current eGFR.'
  }
};

/* ─── Clinical Impression templates ────────────────────────────────────── */

var ABX_CI = {
  trajectory: {
    worsening: { tone: 'red',   text: 'Clinical trajectory is deteriorating on current antimicrobial therapy. This represents the primary stewardship concern at this review and takes precedence over laboratory data. Symptomatic worsening in the context of ongoing treatment is the accepted definition of treatment failure until an alternative explanation is established.' },
    improving: { tone: 'green', text: 'Patient is demonstrating meaningful clinical improvement on Day 3 of therapy. Return of oral tolerance and improved mobility are recognised step-down criteria. Clinical trajectory is the primary determinant of the stewardship decision at this stage.' },
    stable:    { tone: 'amber', text: 'Clinical trajectory is stable without clear improvement. The patient has not deteriorated, but the response to current therapy is incomplete. This intermediate position does not provide a firm basis for de-escalation and warrants a further period of observation before any pathway change is made.' }
  },
  markers: {
    very_high_worsening: { tone: 'red',   text: 'Inflammatory markers are severely elevated (WBC {wbc} ×10\u2079/L, CRP {crp} mg/L). In the context of clinical deterioration, this pattern is consistent with inadequate antimicrobial treatment response.' },
    very_high_improving: { tone: 'amber', text: 'Inflammatory markers remain significantly elevated (WBC {wbc} ×10\u2079/L, CRP {crp} mg/L). In a clinically improving patient, markedly elevated CRP should not independently prevent de-escalation — biochemical normalisation typically lags clinical response by 48–72 hours and should not be the primary decision driver.' },
    elevated:            { tone: 'amber', text: 'Inflammatory markers remain above normal range (WBC {wbc} ×10\u2079/L, CRP {crp} mg/L). This is expected at Day 3 of an acute infective process. Markers should inform but not override the clinical assessment — trajectory is more meaningful than any single value.' },
    settling:            { tone: 'green', text: 'Inflammatory markers are settling (WBC {wbc} ×10\u2079/L, CRP {crp} mg/L). Biochemical improvement alongside clinical improvement provides strong composite support for de-escalation.' }
  },
  fever: {
    high:      { tone: 'red',   text: 'Patient remains febrile at {temp}°C. Active fever in this context is a caution against step-down — clinical reassessment is required to determine whether this represents ongoing infective activity or post-infective inflammation.' },
    low_grade_improving:  { tone: 'amber', text: 'Low-grade fever persists at {temp}°C. In the context of overall clinical improvement, this may represent residual post-infective inflammation rather than active infection. Clinical assessment should guide interpretation.' },
    low_grade_stable:     { tone: 'amber', text: 'Low-grade fever persists at {temp}°C. In the context of a stable trajectory, this requires monitoring before step-down is considered.' },
    afebrile:  { tone: 'green', text: 'Defervescence has been achieved ({temp}°C). Resolution of fever alongside clinical improvement satisfies a key IV-to-oral step-down criterion.' }
  },
  culture: {
    resistant:  { tone: 'red',   text: 'Culture has confirmed a resistant organism. Broad-spectrum IV cover must be maintained. The de-escalation pathway is closed pending full susceptibility review in conjunction with microbiology or infectious diseases.' },
    sensitive:  { tone: 'green', text: 'Culture has identified a sensitive organism amenable to narrow-spectrum oral therapy. This is the strongest available microbiological argument for IV-to-oral step-down and supports de-escalation alongside the clinical picture.' },
    no_growth:  { tone: 'green', text: 'Blood cultures are negative at 72 hours. No growth on adequate incubation in a clinically improving patient supports step-down from empirical broad-spectrum IV cover. Continued broad-spectrum therapy is not justified by the microbiological data.' },
    pending:    { tone: 'amber', text: 'Culture data remains pending. The final de-escalation decision should account for this result; however, clinical criteria can be evaluated independently and a step-down plan prepared so that the transition can proceed promptly once the result is available.' }
  },
  renal: {
    severe:   { tone: 'red',   text: 'Severe renal impairment (eGFR {gfr} mL/min) requires urgent dose review. All renally-cleared antimicrobials including piperacillin-tazobactam need significant interval adjustment, and any nephrotoxic agent is contraindicated.' },
    impaired: { tone: 'amber', text: 'Mild renal impairment (eGFR {gfr} mL/min) has been accounted for in the current dosing. eGFR should be rechecked at 72 hours, as acute illness can cause further transient deterioration.' }
  },
  conclusions: {
    worsening:            'Treat as treatment failure until an alternative explanation is established. Escalation of antimicrobial spectrum, repeat cultures prior to any agent change, and urgent infectious diseases input are all indicated.',
    improving_supported:  'IV-to-oral de-escalation is supported on both clinical and microbiological grounds. Step-down should be initiated at the next prescriber review — continued IV therapy beyond this point is not consistent with stewardship principles.',
    improving_pending:    'Clinical step-down criteria are met. De-escalation should be planned now and executed once culture data is available — a pending result is not in itself a reason to delay in a clinically improving patient.',
    improving_resistant:  'Clinical improvement is evident but the identified organism requires continued broad-spectrum IV cover. Stewardship focus should shift to duration optimisation and selection of the narrowest effective agent based on susceptibility data.',
    default:              'Continue current therapy and reassess formally in 48 hours. Use the interval to obtain or review culture data, recheck inflammatory markers, and document the clinical trajectory criteria against which the next decision will be made.'
  }
};

/* ─── Template interpolation helper ────────────────────────────────────── */

function abxFill(tpl, values) {
  return tpl.replace(/\{(\w+)\}/g, function(_, key) {
    return values[key] !== undefined ? values[key] : '{' + key + '}';
  });
}
