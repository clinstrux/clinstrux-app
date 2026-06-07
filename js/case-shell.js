/* ════════════════════════════════════════════════════════════
   case-shell.js — Bridge between the platform router and the
   legacy clinical workflow pages.

   Clinstrux · Clinical Decision Infrastructure

   Implemented incrementally:
     Step 1  STATE RESTORE + WORKFLOW ACTIVATION  ✓
     Step 2  Section nav interception             ✓
     Step 3  Autosave (applyParam wrappers)       ✓
     Step 4  Case context header + exit nav       ← this step
     Step 5  Progress strip + Complete button

   Depends on (must be loaded before this file):
     event-bus.js, storage-adapter.js, patient-manager.js,
     workflow-registry.js, case-manager.js, router.js,
     core.js, oa.js, abx.js, poly.js

   Public interface:
     CaseShell.mount(caseId)  — activate shell for a case
     CaseShell.unmount()      — deactivate, restore all wrapped functions
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

  /* Step 4: header element reference per page */
  var _headerEl = null;

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
    _origShowSection = _origAbxShowSection = _origPolyShowSection = null;
    console.info('[CaseShell] Nav functions restored');
  }

  /* ══════════════════════════════════════════════════════════
     STEP 3 — AUTOSAVE
  ══════════════════════════════════════════════════════════ */

  function _wrapApplyParam(caseId, entry) {
    _origApplyParam     = window.applyParam;
    _origAbxApplyParam  = window.abxApplyParam;
    _origPolyApplyParam = window.polyApplyParam;

    if (entry.id === 'oa') {
      window.applyParam = function (key) {
        if (_origApplyParam) _origApplyParam(key);
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

  function _persistState(caseId, entry) {
    var liveState = window[entry.stateVar];
    if (!liveState) return;
    var snapshot = {};
    var keys = Object.keys(liveState);
    for (var i = 0; i < keys.length; i++) { snapshot[keys[i]] = liveState[keys[i]]; }
    CaseManager.saveWorkflowState(caseId, snapshot);
    console.info('[CaseShell] Autosaved state for case:', caseId);
  }

  function _restoreApplyParam() {
    if (_origApplyParam     !== null) { window.applyParam     = _origApplyParam;     }
    if (_origAbxApplyParam  !== null) { window.abxApplyParam  = _origAbxApplyParam;  }
    if (_origPolyApplyParam !== null) { window.polyApplyParam = _origPolyApplyParam; }
    _origApplyParam = _origAbxApplyParam = _origPolyApplyParam = null;
    console.info('[CaseShell] applyParam functions restored');
  }

  /* ══════════════════════════════════════════════════════════
     STEP 4 — CASE CONTEXT HEADER

     Injects a thin bar as the FIRST child of the active
     workflow page div (#workflow-page, #abx-page, #poly-page).
     Sits between #global-nav and .dp-wrap in the visual stack.

     Contains:
       ← Cases          (exit — calls Router.navigate('/cases'))
       Patient ref · Case ref · Workflow label · Status pill

     Subscribes to case:updated to refresh the status pill
     when CaseManager events fire (e.g. after updateSection
     advances status from draft → in_progress).

     Removed from DOM on unmount — leaves no trace.
  ══════════════════════════════════════════════════════════ */

  /* ── HTML escape ────────────────────────────────────────── */

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Status pill HTML ───────────────────────────────────── */

  function _statusPill(status) {
    var labels = {
      draft:       'Draft',
      in_progress: 'In Progress',
      complete:    'Complete',
      archived:    'Archived'
    };
    return '<span class="clx-status-pill clx-status-' + _esc(status) + '">' +
             (labels[status] || _esc(status)) +
           '</span>';
  }

  /* ── Render the header HTML string ─────────────────────── */

  function _buildHeaderHtml(kase, entry) {
    var patientLabel = kase.patient && kase.patient.identifier
      ? _esc(kase.patient.identifier)
      : 'Unknown patient';

    /* If a patientId is linked and PatientManager is available,
       use the full name from PatientManager. Graceful fallback
       if PatientManager doesn't have the record.               */
    if (kase.patientId &&
        typeof PatientManager !== 'undefined' &&
        typeof PatientManager.getPatient === 'function') {
      var pt = PatientManager.getPatient(kase.patientId);
      if (pt) {
        patientLabel = _esc(pt.firstName + ' ' + pt.lastName);
      }
    }

    return (
      '<div class="clx-case-header" id="clx-case-header-bar">' +

        /* ← Cases exit button */
        '<button class="clx-case-header-back" onclick="CaseShell._exitToList()">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
               'stroke="currentColor" stroke-width="2.5">' +
            '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
          '</svg>' +
          'Cases' +
        '</button>' +

        '<div class="clx-case-header-divider"></div>' +

        /* Patient identifier */
        '<div class="clx-case-header-patient">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" ' +
               'stroke="currentColor" stroke-width="2">' +
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
            '<circle cx="12" cy="7" r="4"/>' +
          '</svg>' +
          patientLabel +
        '</div>' +

        '<div class="clx-case-header-sep"></div>' +

        /* Case reference */
        '<div class="clx-case-header-ref">' + _esc(kase.reference) + '</div>' +

        '<div class="clx-case-header-sep"></div>' +

        /* Workflow label */
        '<div class="clx-case-header-workflow">' + _esc(entry.label) + '</div>' +

        '<div class="clx-case-header-sep"></div>' +

        /* Status pill — given an id so _refreshHeader can update it */
        '<div id="clx-case-header-status">' + _statusPill(kase.status) + '</div>' +

      '</div>'
    );
  }

  /* ── Inject header into the workflow page ───────────────── */

  function _injectHeader(kase, entry) {
    var pageEl = document.getElementById(entry.pageId);
    if (!pageEl) {
      console.warn('[CaseShell] pageId not found for header injection:', entry.pageId);
      return;
    }

    /* Remove any stale header from a previous session */
    var stale = document.getElementById('clx-case-header-bar');
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);

    /* Create and prepend the header element */
    var wrapper = document.createElement('div');
    wrapper.innerHTML = _buildHeaderHtml(kase, entry);
    _headerEl = wrapper.firstChild;

    /* insertBefore the first child of the page div */
    if (pageEl.firstChild) {
      pageEl.insertBefore(_headerEl, pageEl.firstChild);
    } else {
      pageEl.appendChild(_headerEl);
    }

    console.info('[CaseShell] Header injected into #' + entry.pageId);
  }

  /* ── Refresh just the status pill (EventBus subscriber) ─── */

  function _refreshHeaderStatus(caseId) {
    var statusEl = document.getElementById('clx-case-header-status');
    if (!statusEl) return;
    var kase = CaseManager.getCase(caseId);
    if (!kase) return;
    statusEl.innerHTML = _statusPill(kase.status);
  }

  /* ── Remove header from DOM ─────────────────────────────── */

  function _removeHeader() {
    if (_headerEl && _headerEl.parentNode) {
      _headerEl.parentNode.removeChild(_headerEl);
    }
    _headerEl = null;
  }

  /* EventBus handler references (stored for clean teardown) */
  var _onCaseUpdated    = null;
  var _onSectionVisited = null;

  /* ── Exit: save state, navigate to case list ────────────── */
  /* Exposed on window so the inline onclick can reach it.
     Wrapped in a named function so it can be documented.    */
  function _exitToList() {
    /* Final autosave before leaving */
    if (_caseId && _entry) {
      _persistState(_caseId, _entry);
    }
    Router.navigate('/cases');
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

    _restoreState(kase, entry);        /* Step 1A */
    _wrapNavFunctions(caseId, entry);  /* Step 2  */
    _wrapApplyParam(caseId, entry);    /* Step 3  */
    _activateWorkflow(entry);          /* Step 1B */
    _injectHeader(kase, entry);        /* Step 4  */

    /* Subscribe to events that require header refresh */
    _onCaseUpdated = function (payload) {
      if (payload && payload.caseId === caseId) {
        _refreshHeaderStatus(caseId);
      }
    };
    _onSectionVisited = function (payload) {
      if (payload && payload.caseId === caseId) {
        _refreshHeaderStatus(caseId);
      }
    };
    EventBus.on('case:updated',    _onCaseUpdated);
    EventBus.on('section:visited', _onSectionVisited);

    return true;
  }

  function unmount() {
    /* Step 4: teardown header first, then unsubscribe */
    _removeHeader();
    if (_onCaseUpdated) {
      EventBus.off('case:updated',    _onCaseUpdated);
      EventBus.off('section:visited', _onSectionVisited);
      _onCaseUpdated    = null;
      _onSectionVisited = null;
    }

    _restoreApplyParam();    /* Step 3 */
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
    activeEntry:  activeEntry,
    _exitToList:  _exitToList    /* exposed for inline onclick only */
  };

}());
