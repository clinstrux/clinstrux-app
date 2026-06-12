/* ════════════════════════════════════════════════════════════
   workflow-registry.js — Single source of truth for all
   workflow metadata, section definitions, default states,
   applyParam key lists, and outputMap specifications.

   Clinstrux · Clinical Decision Infrastructure

   IMPORTANT: This is the only place section definitions exist.
   The router, shell, progress strip, DocBridge, and CaseManager
   all read section metadata from here exclusively.
   Nothing else duplicates section definitions.

   Adding a new workflow requires:
     1. Building the workflow module (JS + HTML + content)
     2. Adding a registry entry here
     3. Nothing else in the platform needs to change
════════════════════════════════════════════════════════════ */

var WorkflowRegistry = (function() {

  /* ── Registry entries ─────────────────────────────────────── */

  var _entries = {

    /* ══════════════════════════════════════════════════════════
       OSTEOARTHRITIS ANALGESIC SAFETY REVIEW
    ══════════════════════════════════════════════════════════ */
    oa: {
      id:              'oa',
      label:           'Osteoarthritis Analgesic Safety Review',
      category:        'Pain Management',
      guidelineSource: 'ACR 2023 / AGS Beers 2023 / BNF',

      /* HTML page container for this workflow */
      pageId: 'workflow-page',

      /* ── Section definitions ──────────────────────────────
         id:      canonical platform ID used by CaseManager,
                  progress strip, DocBridge, lifecycle tracking
         domId:   the exact string passed to showSection() in HTML
         label:   human-readable label for the progress strip
         step:    1-based display order
         required: must be visited for assessment to be completable */
      sections: [
        { id: 'patient-inputs',  domId: 'scenario',    label: 'Patient Inputs',  step: 1, required: true  },
        { id: 'clinical-status', domId: 'summary',     label: 'Clinical Status', step: 2, required: true  },
        { id: 'impression',      domId: 'drivers',     label: 'Impression',      step: 3, required: true  },
        { id: 'longitudinal',    domId: 'progression', label: 'Progression',     step: 4, required: false },
        { id: 'monitoring',      domId: 'monitoring',  label: 'Monitoring',      step: 5, required: true  },
        { id: 'documentation',   domId: 'handoff',     label: 'Documentation',   step: 6, required: true  }
      ],

      /* Factory default state — matches var P in oa.js exactly */
      defaultState: {
        egfr:   58,
        gi:     'ulcer',
        bp:     128,
        cv:     'mod',
        pain:   6,
        age:    68,
        failed: '2nsaid',
        adh:    'partial',
        sed:    'high',
        intol:  'both-nsaid'
      },

      /* Global function names on window */
      enterFn:  'enterWorkflow',
      navFn:    'showSection',
      engineFn: 'runReasoningEngine',
      initFn:   'initLongitudinalProgression', /* must be called after setState */
      stateVar: 'P',

      /* ── applyParam keys ──────────────────────────────────
         All keys that applyParam() handles for this workflow.
         Used by the Phase 3 applyParam wrapper to confirm which
         workflow a param change belongs to.                    */
      paramKeys: ['egfr', 'gi', 'bp', 'cv', 'pain', 'age', 'failed', 'adh', 'sed', 'intol'],

      /* ── DOM input sync map ───────────────────────────────
         Used by the Phase 4 adapter setState() to repopulate
         popover inputs after restoring saved state.
         type: 'range' | 'select'
         displayId: span that shows the current range value    */
      inputMap: {
        egfr:   { domId: 'rng-egfr',    type: 'range',  displayId: 'rng-egfr-val',  parse: 'int' },
        bp:     { domId: 'rng-bp',      type: 'range',  displayId: 'rng-bp-val',    parse: 'int' },
        pain:   { domId: 'rng-pain',    type: 'range',  displayId: 'rng-pain-val',  parse: 'int' },
        age:    { domId: 'rng-age',     type: 'range',  displayId: 'rng-age-val',   parse: 'int' },
        gi:     { domId: 'sel-gi',      type: 'select' },
        cv:     { domId: 'sel-cv',      type: 'select' },
        failed: { domId: 'sel-failed',  type: 'select' },
        adh:    { domId: 'sel-adh',     type: 'select' },
        sed:    { domId: 'sel-sed',     type: 'select' },
        intol:  { domId: 'sel-intol',   type: 'select' }
      },

      /* ── outputMap ────────────────────────────────────────
         Drives DocBridge.prepareHandoff() generically.
         DocBridge reads these DOM elements to build the
         HandoffPackage. No workflow-specific logic in DocBridge.
         key:    field name in HandoffPackage.sectionOutputs
         domId:  element to read
         method: 'textContent' | 'innerText' | 'innerHTML'      */
      outputMap: {
        impression_lines:        { domId: 'ci-paragraphs',          method: 'innerText'    },
        impression_conclusion:   { domId: 'ci-conclusion-text',     method: 'textContent'  },
        status_overall:          { domId: 'css-assessment-text',    method: 'textContent'  },
        rec_drug:                { domId: 'dyn-primary-drug',       method: 'innerText'    },
        rec_state:               { domId: 'dyn-primary-state',      method: 'textContent'  },
        rec_rationale:           { domId: 'dyn-primary-rationale',  method: 'textContent'  },
        rec_confidence:          { domId: 'dyn-conf-pct',           method: 'textContent'  },
        rec_drivers:             { domId: 'dyn-drivers-summary',    method: 'textContent'  },
        monitoring_renal_apap:   { domId: 'dyn-rd-apap-val',        method: 'textContent'  },
        monitoring_renal_note:   { domId: 'dyn-rd-apap-note',       method: 'textContent'  }
      }
    },

    /* ══════════════════════════════════════════════════════════
       ANTIBIOTIC STEWARDSHIP REVIEW — UTI
    ══════════════════════════════════════════════════════════ */
    abx: {
      id:              'abx',
      label:           'Antibiotic Stewardship Review — UTI',
      category:        'Stewardship',
      guidelineSource: 'NICE NG112 · NICE NG15 · UKHSA AMR guidance',

      pageId: 'abx-page',

      sections: [
        { id: 'patient-inputs',  domId: 'abx-section-inputs',         label: 'Patient Profile',    step: 1, required: true  },
        { id: 'microbiology',    domId: 'abx-section-micro',          label: 'Microbiology',        step: 2, required: true  },
        { id: 'assessment',      domId: 'abx-section-assessment',     label: 'Clinical Assessment', step: 3, required: true  },
        { id: 'recommendation',  domId: 'abx-section-recommendation', label: 'Recommendation',      step: 4, required: true  },
        { id: 'monitoring',      domId: 'abx-section-monitoring',     label: 'Monitoring',          step: 5, required: true  }
      ],

      /* Factory default state — null schema per spec §12.
         Engine blocked until all mandatory fields are non-null. */
      defaultState: {
        age:            null,
        sex:            null,
        weight:         null,
        height:         null,
        pregnant:       null,
        catheter:       null,
        immunocomp:     null,
        structural:     null,
        pen_allergy:    null,
        site:           null,
        egfr:           null,
        alt:            null,
        ast:            null,
        crp:            null,
        wbc:            null,
        pct:            null,
        culture:        null,
        organism:       null,
        esbl:           null,
        susceptibility: null,
        abx_day:        null,
        iv_days:        null,
        current_abx:    null,
        prior_abx_90d:  null,
        prior_resistant: null,
        hospital_onset: null,
        response:       null,
        temp:           null,
        news2:          null
      },

      enterFn:     'enterAbxWorkflow',
      navFn:       'abxShowSection',
      engineFn:    'abxRunReasoningEngine',
      readinessFn: 'abxIsReady',
      initFn:      null,
      stateVar:    'ABX',

      paramKeys: [
        'age', 'sex', 'weight', 'height', 'pregnant', 'catheter',
        'immunocomp', 'structural', 'pen_allergy', 'site',
        'egfr', 'alt', 'ast', 'crp', 'wbc', 'pct',
        'culture', 'organism', 'esbl', 'susceptibility',
        'abx_day', 'iv_days', 'current_abx',
        'prior_abx_90d', 'prior_resistant', 'hospital_onset',
        'response', 'temp', 'news2'
      ],

      inputMap: {
        age:            { domId: 'abx-rng-age',            type: 'range',  displayId: 'abx-rng-age-val',            parse: 'int'    },
        weight:         { domId: 'abx-rng-weight',         type: 'range',  displayId: 'abx-rng-weight-val',         parse: 'float'  },
        height:         { domId: 'abx-rng-height',         type: 'range',  displayId: 'abx-rng-height-val',         parse: 'int'    },
        egfr:           { domId: 'abx-rng-egfr',           type: 'range',  displayId: 'abx-rng-egfr-val',           parse: 'int'    },
        alt:            { domId: 'abx-rng-alt',            type: 'range',  displayId: 'abx-rng-alt-val',            parse: 'int'    },
        ast:            { domId: 'abx-rng-ast',            type: 'range',  displayId: 'abx-rng-ast-val',            parse: 'int'    },
        abx_day:        { domId: 'abx-rng-abx-day',        type: 'range',  displayId: 'abx-rng-abx-day-val',        parse: 'int'    },
        iv_days:        { domId: 'abx-rng-iv-days',        type: 'range',  displayId: 'abx-rng-iv-days-val',        parse: 'int'    },
        crp:            { domId: 'abx-rng-crp',            type: 'range',  displayId: 'abx-rng-crp-val',            parse: 'int'    },
        wbc:            { domId: 'abx-rng-wbc',            type: 'range',  displayId: 'abx-rng-wbc-val',            parse: 'float'  },
        pct:            { domId: 'abx-rng-pct',            type: 'range',  displayId: 'abx-rng-pct-val',            parse: 'float'  },
        temp:           { domId: 'abx-rng-temp',           type: 'range',  displayId: 'abx-rng-temp-val',           parse: 'float'  },
        news2:          { domId: 'abx-rng-news2',          type: 'range',  displayId: 'abx-rng-news2-val',          parse: 'int'    },
        sex:            { domId: 'abx-sel-sex',            type: 'select' },
        pregnant:       { domId: 'abx-sel-pregnant',       type: 'select' },
        catheter:       { domId: 'abx-sel-catheter',       type: 'select' },
        immunocomp:     { domId: 'abx-sel-immunocomp',     type: 'select' },
        structural:     { domId: 'abx-sel-structural',     type: 'select' },
        pen_allergy:    { domId: 'abx-sel-pen-allergy',    type: 'select' },
        site:           { domId: 'abx-sel-site',           type: 'select' },
        current_abx:    { domId: 'abx-sel-current-abx',   type: 'select' },
        culture:        { domId: 'abx-sel-culture',        type: 'select' },
        organism:       { domId: 'abx-sel-organism',       type: 'select' },
        esbl:           { domId: 'abx-sel-esbl',           type: 'select' },
        susceptibility: { domId: 'abx-sel-susceptibility', type: 'select' },
        prior_abx_90d:  { domId: 'abx-sel-prior-abx-90d', type: 'select' },
        prior_resistant:{ domId: 'abx-sel-prior-resistant',type: 'select' },
        hospital_onset: { domId: 'abx-sel-hospital-onset', type: 'select' },
        response:       { domId: 'abx-sel-response',       type: 'select' }
      },

      outputMap: {
        impression_lines:      { domId: 'abx-ci-paragraphs',            method: 'innerText'   },
        impression_conclusion: { domId: 'abx-ci-conclusion-text',       method: 'textContent' },
        status_overall:        { domId: 'abx-overall-text',             method: 'textContent' },
        rec_action:            { domId: 'abx-rec-action',               method: 'innerHTML'   },
        rec_state:             { domId: 'abx-rec-state',                method: 'textContent' },
        rec_rationale:         { domId: 'abx-rec-rationale',            method: 'textContent' },
        rec_confidence:        { domId: 'abx-conf-pct',                 method: 'textContent' },
        rec_conf_label:        { domId: 'abx-conf-label',               method: 'textContent' },
        monitoring_renal:      { domId: 'abx-rd-piptz',                 method: 'textContent' },
        monitoring_renal_note: { domId: 'abx-rd-piptz-note',            method: 'textContent' }
      }
    },

    /* ══════════════════════════════════════════════════════════
       POLYPHARMACY REVIEW
    ══════════════════════════════════════════════════════════ */
    poly: {
      id:              'poly',
      label:           'Polypharmacy Review',
      category:        'Medication Optimisation',
      guidelineSource: 'STOPP/START v3 / NHS Scotland',

      pageId: 'poly-page',

      sections: [
        { id: 'patient-inputs',    domId: 'poly-section-inputs',         label: 'Med. Profile',    step: 1, required: true },
        { id: 'burden-assessment', domId: 'poly-section-assessment',     label: 'Burden',          step: 2, required: true },
        { id: 'recommendation',    domId: 'poly-section-recommendation', label: 'Recommendations', step: 3, required: true },
        { id: 'monitoring',        domId: 'poly-section-monitoring',     label: 'Monitoring',      step: 4, required: true }
      ],

      /* Factory default state — null schema: engine blocked until meds is set */
      defaultState: {
        meds:         null,
        highrisk:     null,
        interactions: null,
        duplicate:    null,
        ach:          null,
        falls:        null
      },

      enterFn:      'enterPolyWorkflow',
      navFn:        'polyShowSection',
      engineFn:     'polyRunReasoningEngine',
      readinessFn:  'polyIsReady',
      initFn:       null,
      stateVar:     'POLY',

      paramKeys: ['meds', 'highrisk', 'interactions', 'duplicate', 'ach', 'falls'],

      inputMap: {
        meds:         { domId: 'poly-rng-meds',         type: 'range',  displayId: 'poly-rng-meds-val',         parse: 'int' },
        highrisk:     { domId: 'poly-rng-highrisk',     type: 'range',  displayId: 'poly-rng-highrisk-val',     parse: 'int' },
        interactions: { domId: 'poly-rng-interactions', type: 'range',  displayId: 'poly-rng-interactions-val', parse: 'int' },
        ach:          { domId: 'poly-rng-ach',          type: 'range',  displayId: 'poly-rng-ach-val',          parse: 'int' },
        duplicate:    { domId: 'poly-sel-duplicate',    type: 'select' },
        falls:        { domId: 'poly-sel-falls',        type: 'select' }
      },

      outputMap: {
        impression_lines:      { domId: 'poly-ci-paragraphs',      method: 'innerText'   },
        impression_conclusion: { domId: 'poly-ci-conclusion-text', method: 'textContent' },
        rec_action:            { domId: 'poly-rec-action',         method: 'textContent' },
        rec_state:             { domId: 'poly-rec-state',          method: 'textContent' },
        rec_rationale:         { domId: 'poly-rec-rationale',      method: 'textContent' },
        rec_confidence:        { domId: 'poly-conf-pct',           method: 'textContent' },
        dep_target_count:      { domId: 'poly-mon-targets',        method: 'textContent' },
        status_overall:        { domId: 'poly-overall-text',       method: 'textContent' }
      }
    }

  };

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  /* Return a single registry entry by workflow ID.
     Returns undefined if the ID is not registered.           */
  function get(workflowId) {
    return _entries[workflowId];
  }

  /* Return all registered entries as an array.
     Order matches insertion order (OA, ABX, Poly).           */
  function getAll() {
    return Object.keys(_entries).map(function(k) { return _entries[k]; });
  }

  /* Given a workflowId and a DOM section ID (as passed to the
     workflow's showSection / abxShowSection / polyShowSection),
     return the canonical section object (with .id, .label etc).
     Returns null if no match found.

     OA note: showSection() receives the bare ID like 'summary';
     ABX / Poly receive the full ID like 'abx-section-assessment'.
     This function handles both by comparing entry.domId directly. */
  function getSectionByDomId(workflowId, domSectionId) {
    var entry = _entries[workflowId];
    if (!entry) return null;
    for (var i = 0; i < entry.sections.length; i++) {
      if (entry.sections[i].domId === domSectionId) {
        return entry.sections[i];
      }
    }
    return null;
  }

  /* Return only the required sections for a given workflow.  */
  function getRequiredSections(workflowId) {
    var entry = _entries[workflowId];
    if (!entry) return [];
    return entry.sections.filter(function(s) { return s.required; });
  }

  /* Check whether all required sections have been visited.
     visitedSections is the array stored on case.workflow.     */
  function isCompletable(workflowId, visitedSections) {
    var required = getRequiredSections(workflowId);
    for (var i = 0; i < required.length; i++) {
      if (visitedSections.indexOf(required[i].id) === -1) return false;
    }
    return true;
  }

  return {
    get:                 get,
    getAll:              getAll,
    getSectionByDomId:   getSectionByDomId,
    getRequiredSections: getRequiredSections,
    isCompletable:       isCompletable
  };

}());
