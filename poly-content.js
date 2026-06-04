/* ════════════════════════════════════════════════════════════
   data/poly-content.js — Polypharmacy Review workflow content
   Label maps, status display maps, recommendation templates,
   clinical impression templates.
   No logic, no calculations, no DOM access.
   Clinstrux · Clinical Decision Infrastructure
════════════════════════════════════════════════════════════ */

/* ─── Parameter card display maps ───────────────────────────────────────── */

var POLY_MEDS_LABELS = {
  hyper:  'Hyper-polypharmacy',
  poly:   'Polypharmacy',
  low:    'Low burden'
};
var POLY_MEDS_CLS = {
  hyper:  'abx-val-red',
  poly:   'abx-val-amber',
  low:    'abx-val-green'
};

var POLY_HIGHRISK_SUBS = {
  very_high: 'Very high — {n} agents',
  standard:  'Warfarin · opioid · hypnotic',
  one:       '1 high-risk agent',
  none:      'None identified'
};

var POLY_DUPLICATE_LABELS = {
  yes: 'Yes',
  no:  'No'
};
var POLY_DUPLICATE_SUBS = {
  yes: 'Dual antihypertensive overlap',
  no:  'No duplication detected'
};
var POLY_DUPLICATE_CLS = {
  yes: 'abx-val-amber',
  no:  'abx-val-green'
};

var POLY_ACH_LABELS = {
  very_high: 'Very high — severe cognitive risk',
  high:      'High — oxybutynin + amitriptyline + promethazine',
  mild:      'Mild — monitor',
  minimal:   'Minimal'
};

var POLY_FALLS_LABELS = {
  low:      'Low — no significant FRIDs',
  moderate: 'Moderate — 1–2 FRIDs present',
  high:     'Opioid + hypnotic + antihypertensive'
};
var POLY_FALLS_DISPLAY = {
  low:      'Low',
  moderate: 'Moderate',
  high:     'High'
};
var POLY_FALLS_CLS = {
  low:      'abx-val-green',
  moderate: 'abx-val-amber',
  high:     'abx-val-red'
};

/* ─── Clinical Status Summary — metric display maps ────────────────────── */

var POLY_CSS_BURDEN = {
  hyper: { val: 'Hyper-polypharmacy', sub_suffix: ' · ≥10 threshold', cls: 'css-val-red'   },
  poly:  { val: 'Polypharmacy',       sub_suffix: ' · ≥5 threshold',  cls: 'css-val-amber' },
  low:   { val: 'Low burden',         sub_suffix: ' · below threshold',cls: 'css-val-green' }
};

var POLY_CSS_ACH = {
  very_high: { val_prefix: 'Very High (ACB ', sub: 'Threshold ≥3 — cognitive risk',cls: 'css-val-red'   },
  high:      { val_prefix: 'High (ACB ',      sub: 'Threshold ≥3 — cognitive risk',cls: 'css-val-amber' },
  low:       { val_prefix: 'Low (ACB ',       sub: 'Within acceptable range',      cls: ''              }
};

var POLY_CSS_FALLS = {
  high:     { val: 'Elevated', sub: '3 FRIDs · opioid + hypnotic + AHT', cls: 'css-val-red'   },
  moderate: { val: 'Moderate', sub: '1–2 FRIDs present',                 cls: 'css-val-amber' },
  low:      { val: 'Low',      sub: 'No significant FRIDs',              cls: 'css-val-green' }
};

var POLY_CSS_INTERACTIONS = {
  high:     { val: 'Moderate–High', sub_suffix: ' · 2 significant', cls: 'css-val-amber' },
  moderate: { val: 'Moderate',      sub_suffix: ' · 1 significant', cls: 'css-val-amber' },
  low:      { val: 'Low',           sub_suffix: ' · none significant',cls: 'css-val-green'}
};

var POLY_CSS_BADGE = {
  high:     { label: 'High burden — review required', cls: 'css-badge-red'   },
  elevated: { label: 'Elevated burden — optimise',    cls: 'css-badge-amber' },
  low:      { label: 'Acceptable burden',             cls: ''               }
};

/* ─── Recommendation templates ──────────────────────────────────────────── */

var POLY_REC = {
  urgent: {
    action: 'Structured<br>Deprescribing Review',
    state:  'Urgent — multiple targets identified',
    conf: 91, confLabel: 'High confidence',
    confDesc: 'Multiple STOPP criteria met · immediate deprescribing targets identified',
    chip_stopp:   '<span class="ds-primary-ev-chip strong">STOPP/START v3 criteria</span>',
    chip_beers:   '<span class="ds-primary-ev-chip strong">AGS Beers Criteria 2023</span>',
    chip_serotonin:'<span class="ds-primary-ev-chip caution">Serotonin interaction — action required</span>',
    chip_ach:      '<span class="ds-primary-ev-chip caution">ACB ≥3 — cognitive risk</span>',
    chip_falls:    '<span class="ds-primary-ev-chip caution">Falls risk — FRIDs present</span>',
    chip_duplicate:'<span class="ds-primary-ev-chip caution">Duplicate therapy — confirm</span>'
  },
  prompt: {
    action: 'Medication Review\nRecommended',
    state:  'Prompt — active risk factors present',
    conf: 82, confLabel: 'High confidence',
    confDesc: 'Falls risk and interaction burden identified',
    rationale: 'Active medication-related risk factors are present — {falls_text}{interactions_text}require prompt prescriber and pharmacist review. A comprehensive medication review should be scheduled within 1–2 weeks, with any urgent interactions addressed immediately.'
  },
  targeted: {
    action: 'Targeted Optimisation\nRecommended',
    state:  'Routine — modifiable risks identified',
    conf: 74, confLabel: 'Moderate-high confidence',
    confDesc: 'Anticholinergic burden and/or duplicate therapy identified',
    rationale: 'Targeted medication optimisation is appropriate. {ach_text}{duplicate_text}These are modifiable risk factors that can be addressed within a structured review without necessarily requiring urgent action.'
  },
  routine: {
    action: 'Annual Review\nRecommended',
    state:  'Routine — scheduled review appropriate',
    conf: 65, confLabel: 'Moderate confidence',
    confDesc: 'No urgent targets — routine reconciliation recommended',
    rationale: 'No urgent deprescribing targets are identified at this review. A scheduled annual medication reconciliation is recommended given the patient\'s age, frailty status, and comorbidity profile. Each medication\'s ongoing indication, dose, and tolerability should be formally reviewed.'
  }
};

/* ─── Urgent rationale templates ────────────────────────────────────────── */

var POLY_REC_URGENT_RATIONALE = 'The current regimen carries compound risk across multiple axes — elevated anticholinergic burden (ACB {ach}), significant falls risk with {highrisk} high-risk medications, a clinically important serotonin interaction, and {duplicate_text}. Three medications have been identified as primary deprescribing candidates alongside one urgent interaction requiring management. A structured, stepwise review is indicated — addressing the highest-risk agents first.';

/* ─── Clinical Impression templates ────────────────────────────────────── */

var POLY_CI = {
  burden: {
    hyper: { tone: 'red',   text: 'Patient carries a hyper-polypharmacy regimen of {meds} concurrent medications. At this level of medication burden, the probability of an adverse drug event, medication error, or adherence failure is substantially elevated. Hyper-polypharmacy in frail older adults is independently associated with increased hospitalisation, falls, and mortality.' },
    poly:  { tone: 'amber', text: 'Patient is currently prescribed {meds} medications, meeting the threshold for polypharmacy. While each individual agent may be clinically indicated, the cumulative burden — particularly in the context of frailty and multiple comorbidities — warrants systematic review.' },
    low:   { tone: 'green', text: 'Current medication count ({meds}) is below the polypharmacy threshold. Targeted review of any high-risk agents or interactions remains appropriate.' }
  },
  ach: {
    very_high: { tone: 'red',   text: 'Anticholinergic burden is very high (ACB score {ach}). ACB scores above 4 are associated with a significantly increased risk of dementia, falls, urinary retention, and all-cause hospitalisation in older adults. Reducing the anticholinergic load is one of the highest-value interventions available in this case.' },
    high:      { tone: 'amber', text: 'Anticholinergic burden is clinically significant (ACB score {ach}). An ACB score of 3 or above is the accepted threshold for harm risk in older adults. Multiple agents are contributing simultaneously — oxybutynin carries the highest individual score and should be the primary deprescribing target.' }
  },
  falls: {
    high:     { tone: 'red',   text: 'Medication-related falls risk is elevated. The concurrent prescription of an opioid, a Z-drug hypnotic, and antihypertensive therapy creates compound sedative and orthostatic risk. Each agent is a recognised fall-risk-increasing drug (FRID); their combination in a frail 81-year-old patient represents a preventable harm risk that warrants immediate attention.' },
    moderate: { tone: 'amber', text: 'Medication-related falls risk is moderate. One or two fall-risk-increasing drugs are present. A falls risk assessment should be completed and medication contribution formally documented.' }
  },
  interactions: {
    many: { tone: 'amber', text: 'Multiple drug interactions have been identified ({interactions} in total). The tramadol–sertraline combination carries clinically significant serotonin syndrome risk and requires urgent prescriber review — this interaction cannot be monitored passively. The remaining interactions should be triaged by severity and managed systematically.' },
    some: { tone: 'amber', text: '{interactions} drug interactions are present. At least one is clinically significant and requires active management rather than passive monitoring.' }
  },
  duplicate: { tone: 'amber', text: 'Duplicate therapeutic class prescribing has been identified. Dual antihypertensive use may be intentional if the clinical target has not been achieved on monotherapy — however, this should be explicitly confirmed. Unintentional duplication is a common source of preventable harm in complex regimens.' },
  conclusions: {
    urgent:    'This regimen represents compound, multi-axis risk and requires urgent structured review. Deprescribing should begin with the highest-risk targets — the serotonin interaction, oxybutynin, and zopiclone — in a stepwise, patient-centred process. A target of ≤8 medications is a reasonable initial goal within 8 weeks.',
    high:      'Structured deprescribing review is indicated. Prioritise the highest-risk agents and interactions, and take one change at a time to allow clear attribution of any symptom changes. Document each decision with patient agreement.',
    targeted:  'Targeted medication optimisation is recommended. The anticholinergic burden and drug interactions identified represent modifiable risk factors. A focused review addressing these specific issues — without necessarily reducing the total medication count — is the appropriate next step.',
    routine:   'Current regimen complexity warrants a scheduled medication review. No urgent deprescribing targets are identified, but ongoing monitoring and an annual medication reconciliation are recommended given the patient\'s age and comorbidity profile.'
  }
};

/* ─── Template interpolation helper ────────────────────────────────────── */

function polyFill(tpl, values) {
  return tpl.replace(/\{(\w+)\}/g, function(_, key) {
    return values[key] !== undefined ? values[key] : '{' + key + '}';
  });
}
