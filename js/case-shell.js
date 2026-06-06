/* ════════════════════════════════════════════════════════════
   case-shell.js — Bridge between the platform router and the
   legacy clinical workflow pages.

   Clinstrux · Clinical Decision Infrastructure

   Implemented incrementally:
     Step 1  STATE RESTORE + WORKFLOW ACTIVATION  ← this file
     Step 2  Section nav interception + updateSection wiring
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
     CaseShell.unmount()       — deactivate, clean up, hide workflow pages

   Design constraints:
     — oa.js / abx.js / poly.js are NEVER modified.
     — core.js enterFn functions are called, never replaced.
     — WorkflowRegistry is the sole source of workflow metadata.
     — All state reads/writes go through CaseManager; direct
       writes to P / ABX / POLY happen only during restore and
       are the minimum required to display saved state.
════════════════════════════════════════════════════════════ */

var CaseShell = (function () {

  /* ── Internal state ─────────────────────────────────────── */

  var _caseId   = null;   /* ID of the currently active case  */
  var _entry    = null;   /* WorkflowRegistry entry           */
  var _kase     = null;   /* Case object snapshot             */

  /* ══════════════════════════════════════════════════════════
     STEP 1A — STATE RESTORE
     Reads case.workflow.state from CaseManager and writes
     each key into the live workflow state global (P / ABX /
     POLY). Uses WorkflowRegistry stateVar to resolve the
     correct global. Calls engineFn afterwards so the UI
     reflects the restored values immediately.
  ══════════════════════════════════════════════════════════ */

  function _restoreState(kase, entry) {
    var savedState = kase.workflow.state;
    if (!savedState) {
      console.warn('[CaseShell] No saved state for case:', kase.id);
      return;
    }

    /* Resolve the global state object: window['P'], window['ABX'], window['POLY'] */
    var stateVar = entry.stateVar;           /* 'P' | 'ABX' | 'POLY' */
    var liveState = window[stateVar];

    if (!liveState) {
      console.error('[CaseShell] State global not found: ' + stateVar);
      return;
    }

    /* Write each saved key into the live state object.
       Only keys present in savedState are written — keys not
       in savedState keep their current (default) values.
       This is safe: the saved state was produced by the same
       workflow engine and contains the same key set.          */
    var keys = Object.keys(savedState);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      liveState[k] = savedState[k];
    }

    console.info('[CaseShell] State restored for ' + stateVar + ':', JSON.stringify(liveState));

    /* Re-run the reasoning engine so all UI panels reflect
       the restored values. engineFn is a global function name
       string (e.g. 'runReasoningEngine').                     */
    if (entry.engineFn && typeof window[entry.engineFn] === 'function') {
      window[entry.engineFn]();
    }

    /* OA only: re-initialise the longitudinal progression
       engine after restoring P so P_BASELINE is set from
       the restored values, not the boot-time defaults.
       initFn is null for ABX and POLY.                        */
    if (entry.initFn && typeof window[entry.initFn] === 'function') {
      window[entry.initFn]();
    }
  }

  /* ══════════════════════════════════════════════════════════
     STEP 1B — WORKFLOW ACTIVATION
     Shows the correct legacy workflow page and hides the
     platform #app-view. Calls the workflow's enterFn exactly
     as the original selector buttons did.

     enterWorkflow     → shows #workflow-page, hides entry/selector
     enterAbxWorkflow  → shows #abx-page, calls abxRunReasoningEngine
     enterPolyWorkflow → shows #poly-page, calls polyRunReasoningEngine

     Note: enterAbxWorkflow and enterPolyWorkflow call their
     engine internally. For OA, the engine was already called
     in _restoreState above. There is no double-call issue
     because runReasoningEngine is idempotent.
  ══════════════════════════════════════════════════════════ */

  function _activateWorkflow(entry) {
    /* Hide the platform app-view so the workflow page can
       occupy the full viewport. The router will restore
       app-view when CaseShell.unmount() navigates away.      */
    var appView = document.getElementById('app-view');
    if (appView) appView.style.display = 'none';

    /* Call the workflow's enter function.
       These are the same functions called by the old selector
       buttons — no behaviour change.                          */
    if (entry.enterFn && typeof window[entry.enterFn] === 'function') {
      window[entry.enterFn]();
      console.info('[CaseShell] Activated workflow via ' + entry.enterFn);
    } else {
      console.error('[CaseShell] enterFn not found: ' + entry.enterFn);
    }
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  /* mount(caseId)
     Called by CaseShellView when the router navigates to
     /cases/:id. Validates the case, restores state, and
     activates the workflow page.
     Returns true on success, false if the case is not found
     or the workflow is not registered.                        */
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

    /* Step 1B: show the workflow page */
    _activateWorkflow(entry);

    return true;
  }

  /* unmount()
     Called by CaseShellView when the router navigates away.
     Hides all workflow pages and shows the platform app-view
     so the next platform view can mount into it.             */
  function unmount() {
    /* Hide all legacy workflow pages */
    var pageIds = ['workflow-page', 'abx-page', 'poly-page'];
    pageIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    /* Restore the platform app-view */
    var appView = document.getElementById('app-view');
    if (appView) appView.style.display = 'block';

    console.info('[CaseShell] Unmounted, workflow pages hidden');

    _caseId = null;
    _entry  = null;
    _kase   = null;
  }

  /* activeCaseId()
     Returns the ID of the currently mounted case, or null.
     Used by Step 2 (nav interception) and Step 3 (autosave). */
  function activeCaseId() {
    return _caseId;
  }

  /* activeEntry()
     Returns the WorkflowRegistry entry for the active case.
     Used by Step 2 (getSectionByDomId lookup).               */
  function activeEntry() {
    return _entry;
  }

  return {
    mount:        mount,
    unmount:      unmount,
    activeCaseId: activeCaseId,
    activeEntry:  activeEntry
  };

}());
