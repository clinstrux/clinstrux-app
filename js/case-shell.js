/* ════════════════════════════════════════════════════════════
   case-shell.js — Bridge between the platform router and the
   legacy clinical workflow pages.

   Clinstrux · Clinical Decision Infrastructure

   Implemented incrementally:
     Step 1  STATE RESTORE + WORKFLOW ACTIVATION  ✓
     Step 2  Section nav interception             ✓
     Step 3  Autosave (applyParam wrappers)       ← this step
     Step 4  Case context header + exit navigation
     Step 5  Progress strip + Complete button

   Depends on (must be loaded before this file):
     event-bus.js, storage-adapter.js, patient-manager.js,
     workflow-registry.js, case-manager.js, router.js,
     core.js, oa.js, abx.js, poly.js

   Public interface:
     CaseShell.mount(caseId)  — activate shell for a case
     CaseShell.unmount()      — deactivate, restore all wrapped functions

   Design constraints:
     — oa.js / abx.js / poly.js are NEVER modified.
     — Original functions are always called first in every wrapper.
     — WorkflowRegistry is the sole source of workflow metadata.
     — saveWorkflowState receives a shallow copy of the live state
       object taken immediately after the original applyParam runs,
       so the persisted value is always consistent with what the
       engine just computed from.
════════════════════════════════════════════════════════════ */

var CaseShell = (function () {

  /* ── Internal state ─────────────────────────────────────── */

  var _caseId = null;
  var _entry  = null;
  var _kase   = null;

  /* Step 2 originals */
  var _origShowSection     = null;
  var _origAbxShowSection  = null;
  var _origPolyShowSection = null;

  /* Step 3 originals */
  var _origApplyParam     = null;
  var _origAbxApplyParam  = null;
  var _origPolyApplyParam = null;

  /* ══════════════════════════════════════════════════════════
     STEP 1A — STATE RESTORE
  ══════════════════════════════════════════════════════════ */

  function _restoreState(kase, entry) {
    var savedState = kase.workflow.state;
    if (!savedState) {
      console.warn('[CaseShell] No saved state for case:', kase.id);
      return;
    }

    var liveState = window[entry.stateVar];
    if (!liveState) {
      console.error('[CaseShell] State global not found: ' + entry.stateVar);
      return;
    }

    var keys = Object.keys(savedState);
    for (var i = 0; i < keys.length; i++) {
      liveState[keys[i]] = savedState[keys[i]];
    }

    console.info('[CaseShell] State restored for ' + entry.stateVar);

    if (entry.engineFn && typeof window[entry.engineFn] === 'function') {
      window[entry.engineFn]();
    }
    if (entry.initFn && typeof window[entry.initFn] === 'function') {
      window[entry.initFn]();
    }
  }

  /* ══════════════════════════════════════════════════════════
     STEP 1B — WORKFLOW ACTIVATION
  ══════════════════════════════════════════════════════════ */

  function _activateWorkflow(entry) {
    var appView = document.getElementById('app-view');
    if (appView) appView.style.display = 'none';

    if (entry.enterFn && typeof window[entry.enterFn] === 'function') {
      window[entry.enterFn]();
      console.info('[CaseShell] Activated workflow via ' + entry.enterFn);
    } else {
      console.error('[CaseShell] enterFn not found: ' + entry.enterFn);
    }
  }

  /* ══════════════════════════════════════════════════════════
     STEP 2 — SECTION NAV INTERCEPTION
  ══════════════════════════════════════════════════════════ */

  function _wrapNavFunctions(caseId, entry) {
    _origShowSection     = window.showSection;
    _origAbxShowSection  = window.abxShowSection;
    _origPolyShowSection = window.polyShowSection;

    if (entry.id === 'oa') {
      window.showSection = function (id, btn) {
        if (_origShowSection) _origShowSection(id, btn);
        _recordSection(caseId, entry, id);
      };
    } else if (entry.id === 'abx') {
      window.abxShowSection = function (id, btn) {
        if (_origAbxShowSection) _origAbxShowSection(id, btn);
        _recordSection(caseId, entry, id);
      };
    } else if (entry.id === 'poly') {
      window.polyShowSection = function (id, btn) {
        if (_origPolyShowSection) _origPolyShowSection(id, btn);
        _recordSection(caseId, entry, id);
      };
    }

    console.info('[CaseShell] Nav wrapper installed for: ' + entry.id);
  }

  function _recordSection(caseId, entry, domId) {
    var section = WorkflowRegistry.getSectionByDomId(entry.id, domId);
    if (!section) return;
    CaseManager.updateSection(caseId, section.id);
    console.info('[CaseShell] Section visited: ' + section.id + ' (' + domId + ')');
  }

  function _restoreNavFunctions() {
    if (_origShowSection     !== null) { window.showSection     = _origShowSection;     }
    if (_origAbxShowSection  !== null) { window.abxShowSection  = _origAbxShowSection;  }
    if (_origPolyShowSection !== null) { window.polyShowSection = _origPolyShowSection; }
    _origShowSection     = null;
    _origAbxShowSection  = null;
    _origPolyShowSection = null;
    console.info('[CaseShell] Nav functions restored');
  }

  /* ══════════════════════════════════════════════════════════
     STEP 3 — AUTOSAVE (applyParam wrappers)

     Strategy: wrap applyParam / abxApplyParam / polyApplyParam
     with a thin post-hook that:
       1. Calls the original function — all DOM updates, engine
          re-run, and popover close happen exactly as before.
       2. Reads the live state global (P / ABX / POLY) immediately
          after the original runs — the state already reflects
          the parameter change the engine just processed.
       3. Calls CaseManager.saveWorkflowState(caseId, snapshot)
          with a shallow copy of the live state object.

     Only the wrapper for the active workflow is installed.
     All three originals are saved and restored on unmount.

     saveWorkflowState deep-copies internally (JSON round-trip),
     so passing the live state object directly is safe.
  ══════════════════════════════════════════════════════════ */

  function _wrapApplyParam(caseId, entry) {
    _origApplyParam     = window.applyParam;
    _origAbxApplyParam  = window.abxApplyParam;
    _origPolyApplyParam = window.polyApplyParam;

    if (entry.id === 'oa') {
      window.applyParam = function (key) {
        /* 1. Original — updates P[key], runs engine, closes popover */
        if (_origApplyParam) _origApplyParam(key);
        /* 2. Persist the updated state */
        _persistState(caseId, entry);
      };

    } else if (entry.id === 'abx') {
      window.abxApplyParam = function (key) {
        if (_origAbxApplyParam) _origAbxApplyParam(key);
        _persistState(caseId, entry);
      };

    } else if (entry.id === 'poly') {
      window.polyApplyParam = function (key) {
        if (_origPolyApplyParam) _origPolyApplyParam(key);
        _persistState(caseId, entry);
      };
    }

    console.info('[CaseShell] Autosave wrapper installed for: ' + entry.id);
  }

  /* Read the live state global and persist it to CaseManager.
     Takes a shallow copy via object spread equivalent so the
     call is synchronous and non-allocating beyond one object. */
  function _persistState(caseId, entry) {
    var liveState = window[entry.stateVar];
    if (!liveState) return;

    /* Shallow copy — sufficient because all state values are
       primitives (numbers and strings). saveWorkflowState
       does its own deep copy (JSON round-trip) internally.   */
    var snapshot = {};
    var keys = Object.keys(liveState);
    for (var i = 0; i < keys.length; i++) {
      snapshot[keys[i]] = liveState[keys[i]];
    }

    CaseManager.saveWorkflowState(caseId, snapshot);
    console.info('[CaseShell] Autosaved state for case:', caseId);
  }

  function _restoreApplyParam() {
    if (_origApplyParam     !== null) { window.applyParam     = _origApplyParam;     }
    if (_origAbxApplyParam  !== null) { window.abxApplyParam  = _origAbxApplyParam;  }
    if (_origPolyApplyParam !== null) { window.polyApplyParam = _origPolyApplyParam; }
    _origApplyParam     = null;
    _origAbxApplyParam  = null;
    _origPolyApplyParam = null;
    console.info('[CaseShell] applyParam functions restored');
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  function mount(caseId) {
    var kase = CaseManager.getCase(caseId);
    if (!kase) {
      console.error('[CaseShell] mount: case not found:', caseId);
      return false;
    }

    var entry = WorkflowRegistry.get(kase.workflow.workflowId);
    if (!entry) {
      console.error('[CaseShell] mount: unknown workflowId:', kase.workflow.workflowId);
      return false;
    }

    _caseId = caseId;
    _entry  = entry;
    _kase   = kase;

    _restoreState(kase, entry);      /* Step 1A */
    _wrapNavFunctions(caseId, entry);/* Step 2  */
    _wrapApplyParam(caseId, entry);  /* Step 3  */
    _activateWorkflow(entry);        /* Step 1B */

    return true;
  }

  function unmount() {
    _restoreApplyParam();    /* Step 3 — before nav, before page hide */
    _restoreNavFunctions();  /* Step 2 */

    var pageIds = ['workflow-page', 'abx-page', 'poly-page'];
    pageIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    var appView = document.getElementById('app-view');
    if (appView) appView.style.display = 'block';

    console.info('[CaseShell] Unmounted');

    _caseId = null;
    _entry  = null;
    _kase   = null;
  }

  function activeCaseId() { return _caseId; }
  function activeEntry()  { return _entry;  }

  return {
    mount:        mount,
    unmount:      unmount,
    activeCaseId: activeCaseId,
    activeEntry:  activeEntry
  };

}());
