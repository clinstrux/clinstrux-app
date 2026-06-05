/* ════════════════════════════════════════════════════════════
   case-manager.js — Case CRUD, localStorage persistence,
   and EventBus emission for all case lifecycle events.

   Clinstrux · Clinical Decision Infrastructure

   This is the ONLY module that reads from or writes to
   localStorage. All other modules call this API.

   Storage key:  'clinstrux_v1'
   Schema version: 1

   Case object shape is defined at the bottom of this file
   in the _buildCase() factory function.
════════════════════════════════════════════════════════════ */

var CaseManager = (function() {

  var STORAGE_KEY     = 'clinstrux_v1';
  var SCHEMA_VERSION  = 1;

  /* ══════════════════════════════════════════════════════════
     INTERNAL HELPERS
  ══════════════════════════════════════════════════════════ */

  /* Generate a short unique case ID: 'case_' + 6 alphanumeric chars */
  function _generateId() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var id = 'case_';
    for (var i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /* Generate human-readable reference: 'Case YYYY-NNN'
     Counter is stored in meta.caseCounter and incremented per case. */
  function _generateReference(counter) {
    var year = new Date().getFullYear();
    var padded = String(counter).padStart(3, '0');
    return 'Case ' + year + '-' + padded;
  }

  /* ISO 8601 timestamp for right now */
  function _now() {
    return new Date().toISOString();
  }

  /* ── Storage primitives ─────────────────────────────────── */

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return _emptyStore();
      var store = JSON.parse(raw);
      /* Schema version check — clear stale data gracefully */
      if (store.version !== SCHEMA_VERSION) {
        console.warn('[CaseManager] Stale schema version (' + store.version + '). Clearing storage.');
        return _emptyStore();
      }
      return store;
    } catch (err) {
      console.error('[CaseManager] Failed to load from localStorage:', err);
      return _emptyStore();
    }
  }

  function _save(store) {
    try {
      store.meta.lastSaved = _now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.error('[CaseManager] Failed to save to localStorage:', err);
    }
  }

  function _emptyStore() {
    return {
      version: SCHEMA_VERSION,
      cases: [],
      meta: {
        sessionStarted: _now(),
        lastSaved: null,
        caseCounter: 0
      }
    };
  }

  /* Find a case by ID within a store's case array.
     Returns { store, case, index } or null.          */
  function _find(caseId) {
    var store = _load();
    for (var i = 0; i < store.cases.length; i++) {
      if (store.cases[i].id === caseId) {
        return { store: store, kase: store.cases[i], index: i };
      }
    }
    return null;
  }

  /* ── Case factory ───────────────────────────────────────── */

  /* Build a complete new Case object with all fields initialised.
     patientData: { identifier, age, setting, referralSource, clinicalContext }
     workflowId: 'oa' | 'abx' | 'poly'                                         */
  function _buildCase(patientData, workflowId, reference) {
    var entry = WorkflowRegistry.get(workflowId);
    if (!entry) {
      throw new Error('[CaseManager] Unknown workflowId: ' + workflowId);
    }

    var now = _now();

    return {
      id:        _generateId(),
      reference: reference,
      createdAt: now,
      updatedAt: now,
      status:    'draft',          /* draft | in_progress | complete | archived */

      /* ── Metadata block ────────────────────────────────── */
      metadata: {
        owner:     null,           /* populated when auth exists          */
        createdBy: 'demo',         /* 'demo' | 'user' in future           */
        source:    'manual',       /* 'manual' | 'import' | 'referral'    */
        tags:      [],             /* user-defined tags (future UI)        */
        priority:  'normal'        /* 'normal' | 'urgent' | 'routine'     */
      },

      /* ── Lifecycle block ───────────────────────────────── */
      lifecycle: {
        stage:           'intake',  /* intake | assessment | documentation | ... */
        completedStages: []
      },

      /* ── Patient context ───────────────────────────────── */
      patient: {
        identifier:     patientData.identifier     || '',
        age:            patientData.age            || null,
        setting:        patientData.setting        || 'outpatient',
        referralSource: patientData.referralSource || '',
        clinicalContext:patientData.clinicalContext || ''
      },

      /* ── Workflow context ──────────────────────────────── */
      workflow: {
        workflowId:      workflowId,
        workflowLabel:   entry.label,
        startedAt:       now,
        completedAt:     null,
        currentSection:  null,
        visitedSections: [],
        /* Deep copy of the workflow's default state */
        state: JSON.parse(JSON.stringify(entry.defaultState))
      },

      /* ── Assessment block ──────────────────────────────── */
      assessment: {
        status:    'draft',   /* draft | in_progress | complete */
        riskLevel: null,      /* null | 'low' | 'moderate' | 'high' | 'critical' */
        flags:     [],        /* Array<AssessmentFlag>                             */
        outputs:   {}         /* keyed by canonical sectionId                      */
      },

      /* ── Documentation block ───────────────────────────── */
      documentation: {
        status:      'not_started',  /* not_started | ready */
        handoffData: null
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  /* ── createCase ─────────────────────────────────────────── */

  function createCase(patientData, workflowId) {
    var store = _load();
    store.meta.caseCounter += 1;
    var reference = _generateReference(store.meta.caseCounter);
    var newCase = _buildCase(patientData, workflowId, reference);
    store.cases.push(newCase);
    _save(store);
    EventBus.emit('case:created', { caseId: newCase.id, workflowId: workflowId });
    return newCase;
  }

  /* ── getCase ────────────────────────────────────────────── */

  function getCase(caseId) {
    var result = _find(caseId);
    return result ? result.kase : null;
  }

  /* ── listCases ──────────────────────────────────────────── */

  /* Returns all cases, sorted by updatedAt descending.
     Optional filters object: { status: 'in_progress', workflowId: 'oa' }
     Omit a filter field to include all values for that dimension. */
  function listCases(filters) {
    var store = _load();
    var list = store.cases.slice();

    if (filters) {
      if (filters.status) {
        list = list.filter(function(c) { return c.status === filters.status; });
      }
      if (filters.workflowId) {
        list = list.filter(function(c) { return c.workflow.workflowId === filters.workflowId; });
      }
    }

    /* Sort newest-updated first */
    list.sort(function(a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return list;
  }

  /* ── saveWorkflowState ──────────────────────────────────── */

  /* Persist the current workflow parameter state.
     Called by WorkflowShell autosave (Phase 3).
     state: the full workflow state object (P, ABX, or POLY values). */
  function saveWorkflowState(caseId, state) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] saveWorkflowState: case not found:', caseId);
      return;
    }
    result.kase.workflow.state = JSON.parse(JSON.stringify(state));
    result.kase.updatedAt = _now();
    _save(result.store);
    EventBus.emit('case:updated', { caseId: caseId, changes: ['workflow.state'] });
  }

  /* ── updateSection ──────────────────────────────────────── */

  /* Record that a section has been visited.
     Appends sectionId to visitedSections if not already present.
     Upgrades case status from 'draft' to 'in_progress' on first section visit.
     Updates lifecycle.stage from 'intake' to 'assessment' on first section visit. */
  function updateSection(caseId, sectionId) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] updateSection: case not found:', caseId);
      return;
    }
    var kase = result.kase;

    /* Append section if not already recorded */
    if (kase.workflow.visitedSections.indexOf(sectionId) === -1) {
      kase.workflow.visitedSections.push(sectionId);
    }

    /* Update current section pointer */
    kase.workflow.currentSection = sectionId;

    /* Upgrade status on first visit */
    if (kase.status === 'draft') {
      kase.status = 'in_progress';
    }

    /* Advance lifecycle from intake to assessment on first section visit */
    if (kase.lifecycle.stage === 'intake') {
      kase.lifecycle.completedStages.push('intake');
      kase.lifecycle.stage = 'assessment';
    }

    /* Upgrade assessment status */
    if (kase.assessment.status === 'draft') {
      kase.assessment.status = 'in_progress';
    }

    kase.updatedAt = _now();
    _save(result.store);
    EventBus.emit('section:visited', { caseId: caseId, sectionId: sectionId });
  }

  /* ── saveAssessmentOutput ───────────────────────────────── */

  /* Store the structured output for a completed section.
     outputData: arbitrary object from the reasoning engine or DocBridge.
     Called by WorkflowShell (Phase 3) when a section is completed. */
  function saveAssessmentOutput(caseId, sectionId, outputData) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] saveAssessmentOutput: case not found:', caseId);
      return;
    }
    result.kase.assessment.outputs[sectionId] = {
      capturedAt:    _now(),
      stateSnapshot: JSON.parse(JSON.stringify(result.kase.workflow.state)),
      data:          outputData
    };
    result.kase.updatedAt = _now();
    _save(result.store);
  }

  /* ── setAssessmentFlag ──────────────────────────────────── */

  /* Append a clinical flag to the assessment.
     flag: { id, severity, source, message }
     Duplicate flag IDs are replaced, not appended.            */
  function setAssessmentFlag(caseId, flag) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] setAssessmentFlag: case not found:', caseId);
      return;
    }
    var flags = result.kase.assessment.flags;
    /* Replace existing flag with same ID if present */
    var existingIdx = -1;
    for (var i = 0; i < flags.length; i++) {
      if (flags[i].id === flag.id) { existingIdx = i; break; }
    }
    if (existingIdx !== -1) {
      flags[existingIdx] = flag;
    } else {
      flags.push(flag);
    }
    result.kase.updatedAt = _now();
    _save(result.store);
    EventBus.emit('assessment:flagged', { caseId: caseId, flag: flag });
  }

  /* ── updateLifecycle ────────────────────────────────────── */

  /* Advance the case lifecycle to the next stage.
     The current stage is appended to completedStages.         */
  function updateLifecycle(caseId, newStage) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] updateLifecycle: case not found:', caseId);
      return;
    }
    var kase = result.kase;
    var currentStage = kase.lifecycle.stage;
    if (currentStage && kase.lifecycle.completedStages.indexOf(currentStage) === -1) {
      kase.lifecycle.completedStages.push(currentStage);
    }
    kase.lifecycle.stage = newStage;
    kase.updatedAt = _now();
    _save(result.store);
  }

  /* ── completeCase ───────────────────────────────────────── */

  /* Mark a case as complete.
     Saves the final state snapshot, sets completedAt,
     advances lifecycle to 'documentation', emits workflow:completed. */
  function completeCase(caseId, finalState) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] completeCase: case not found:', caseId);
      return;
    }
    var kase = result.kase;
    var now = _now();

    kase.status = 'complete';
    kase.workflow.completedAt = now;
    kase.assessment.status = 'complete';
    if (finalState) {
      kase.workflow.state = JSON.parse(JSON.stringify(finalState));
    }
    /* Advance lifecycle */
    if (kase.lifecycle.stage !== 'documentation') {
      if (kase.lifecycle.completedStages.indexOf(kase.lifecycle.stage) === -1) {
        kase.lifecycle.completedStages.push(kase.lifecycle.stage);
      }
      kase.lifecycle.stage = 'documentation';
    }
    kase.updatedAt = now;
    _save(result.store);
    EventBus.emit('workflow:completed', { caseId: caseId });
    EventBus.emit('case:updated', { caseId: caseId, changes: ['status', 'lifecycle'] });
  }

  /* ── archiveCase ────────────────────────────────────────── */

  function archiveCase(caseId) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] archiveCase: case not found:', caseId);
      return;
    }
    result.kase.status = 'archived';
    result.kase.updatedAt = _now();
    _save(result.store);
    EventBus.emit('case:archived', { caseId: caseId });
    EventBus.emit('case:updated', { caseId: caseId, changes: ['status'] });
  }

  /* ── saveHandoff ────────────────────────────────────────── */

  /* Store the DocBridge HandoffPackage in the case.
     Called by DocBridge.prepareHandoff() (Phase 5).           */
  function saveHandoff(caseId, handoffData) {
    var result = _find(caseId);
    if (!result) {
      console.warn('[CaseManager] saveHandoff: case not found:', caseId);
      return;
    }
    result.kase.documentation.handoffData = handoffData;
    result.kase.documentation.status = 'ready';
    result.kase.updatedAt = _now();
    _save(result.store);
  }

  /* ── clearAllData ───────────────────────────────────────── */

  /* Remove all Clinstrux data from localStorage.
     For demo reset only. Requires explicit call — never called
     automatically. Should be exposed in the platform footer UI. */
  function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    console.info('[CaseManager] All case data cleared.');
  }

  /* ── getSessionMeta ─────────────────────────────────────── */

  function getSessionMeta() {
    return _load().meta;
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC SURFACE
  ══════════════════════════════════════════════════════════ */

  return {
    createCase:          createCase,
    getCase:             getCase,
    listCases:           listCases,
    saveWorkflowState:   saveWorkflowState,
    updateSection:       updateSection,
    saveAssessmentOutput:saveAssessmentOutput,
    setAssessmentFlag:   setAssessmentFlag,
    updateLifecycle:     updateLifecycle,
    completeCase:        completeCase,
    archiveCase:         archiveCase,
    saveHandoff:         saveHandoff,
    clearAllData:        clearAllData,
    getSessionMeta:      getSessionMeta
  };

}());

/* ════════════════════════════════════════════════════════════
   CASE OBJECT SCHEMA (reference)

   {
     id:        String   — 'case_abc123'
     reference: String   — 'Case 2026-001'
     createdAt: ISO8601
     updatedAt: ISO8601
     status:    'draft' | 'in_progress' | 'complete' | 'archived'

     metadata: {
       owner:     null | String
       createdBy: 'demo' | 'user'
       source:    'manual' | 'import' | 'referral'
       tags:      String[]
       priority:  'normal' | 'urgent' | 'routine'
     }

     lifecycle: {
       stage:           'intake' | 'assessment' | 'documentation' | ...
       completedStages: String[]
     }

     patient: {
       identifier:      String
       age:             Number
       setting:         'outpatient' | 'inpatient' | 'community' | ...
       referralSource:  String
       clinicalContext: String
     }

     workflow: {
       workflowId:      'oa' | 'abx' | 'poly'
       workflowLabel:   String
       startedAt:       ISO8601
       completedAt:     ISO8601 | null
       currentSection:  String | null   — canonical section ID
       visitedSections: String[]        — canonical section IDs
       state:           Object          — live workflow parameters
     }

     assessment: {
       status:    'draft' | 'in_progress' | 'complete'
       riskLevel: null | 'low' | 'moderate' | 'high' | 'critical'
       flags:     [ { id, severity, source, message } ]
       outputs:   { [sectionId]: { capturedAt, stateSnapshot, data } }
     }

     documentation: {
       status:      'not_started' | 'ready'
       handoffData: null | HandoffPackage
     }
   }
════════════════════════════════════════════════════════════ */
