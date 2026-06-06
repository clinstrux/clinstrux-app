/* ════════════════════════════════════════════════════════════
   case-shell.js — Bridge between the platform router and the
   legacy clinical workflow pages.

   Clinstrux · Clinical Decision Infrastructure

   Implemented incrementally:
     Step 1  STATE RESTORE + WORKFLOW ACTIVATION  ✓
     Step 2  Section nav interception + updateSection wiring ← this step
     Step 3  Autosave (applyParam wrappers)
     Step 4  Case context header + exit navigation
     Step 5  Progress strip + Complete button

   Depends on (must be loaded before this file):
     event-bus.js
     storage-adapter.js
     patient-manager.js
     workflow-registry.js
     case-manager.js
     router.js
     core.js          (enterWorkflow / enterAbxWorkflow / enterPolyWorkflow)
     oa.js            (P, runReasoningEngine, initLongitudinalProgression)
     abx.js           (ABX, abxRunReasoningEngine)
     poly.js          (POLY, polyRunReasoningEngine)

   Public interface:
     CaseShell.mount(caseId)   — activate shell for a case
     CaseShell.unmount()       — deactivate, clean up, restore nav functions

   Design constraints:
     — oa.js / abx.js / poly.js are NEVER modified.
     — core.js enterFn functions are called, never replaced.
     — WorkflowRegistry is the sole source of workflow metadata.
     — All state reads/writes go through CaseManager; direct
       writes to P / ABX / POLY happen only during restore and
       are the minimum required to display saved state.
     — Nav function wrappers call the original function first,
       then record the section visit. Original behaviour is
       always preserved regardless of CaseManager state.
════════════════════════════════════════════════════════════ */

var CaseShell = (function () {

  /* ── Internal state ─────────────────────────────────────── */

  var _caseId  = null;   /* ID of the currently active case   */
  var _entry   = null;   /* WorkflowRegistry entry            */
  var _kase    = null;   /* Case object snapshot              */

  /* Saved originals so unmount() can restore them exactly.   */
  var _origShowSection      = null;
  var _origAbxShowSection   = null;
  var _origPolyShowSection  = null;

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

     Strategy: replace window.showSection / window.abxShowSection /
     window.polyShowSection with a thin wrapper that:
       1. Calls the original function — DOM show/hide unchanged.
       2. Translates the domId to a canonical sectionId via
          WorkflowRegistry.getSectionByDomId().
       3. Calls CaseManager.updateSection() if the sectionId
          resolves (sub-tabs like 'notes', 'evidence' return
          null and are silently skipped).

     Only the wrapper for the active workflow is installed.
     All three originals are saved before any wrapper is set
     and are restored exactly on unmount().
  ══════════════════════════════════════════════════════════ */

  function _wrapNavFunctions(caseId, entry) {
    /* Save all three originals unconditionally so unmount()
       can always restore them safely.                        */
    _origShowSection     = window.showSection;
    _origAbxShowSection  = window.abxShowSection;
    _origPolyShowSection = window.polyShowSection;

    /* Build a wrapper for the active workflow only.
       Other workflow nav functions are not called while this
       case is open, but we leave them unwrapped to be safe.  */

    if (entry.id === 'oa') {
      window.showSection = function (id, btn) {
        /* 1. Original DOM behaviour — always runs first */
        if (_origShowSection) _origShowSection(id, btn);

        /* 2. Section tracking */
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

  /* Translate domId → canonical sectionId and call
     CaseManager.updateSection(). Silent no-op for sub-tabs. */
  function _recordSection(caseId, entry, domId) {
    var section = WorkflowRegistry.getSectionByDomId(entry.id, domId);
    if (!section) {
      /* domId is a sub-tab (e.g. 'notes', 'evidence', 'polypharmacy')
         that is not a registry section. Skip silently.       */
      return;
    }
    CaseManager.updateSection(caseId, section.id);
    console.info('[CaseShell] Section visited: ' + section.id + ' (' + domId + ')');
  }

  /* Restore all three nav functions to their originals.
     Called by unmount(). Safe to call even if _originals are
     null (window assignments are no-ops in that case).       */
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

    /* Step 1A: restore saved parameter state */
    _restoreState(kase, entry);

    /* Step 2: install nav interception before activation so
       the first section shown (by enterFn) is also recorded */
    _wrapNavFunctions(caseId, entry);

    /* Step 1B: show the workflow page */
    _activateWorkflow(entry);

    return true;
  }

  function unmount() {
    /* Step 2: restore original nav functions */
    _restoreNavFunctions();

    /* Step 1: hide workflow pages, restore app-view */
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
