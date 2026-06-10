/* ════════════════════════════════════════════════════════════
   case-shell.js — Bridge between the platform router and the
   legacy clinical workflow pages.

   Clinstrux · Clinical Decision Infrastructure

   Steps implemented:
     Step 1  STATE RESTORE + WORKFLOW ACTIVATION  ✓
     Step 2  Section nav interception             ✓
     Step 3  Autosave (applyParam wrappers)       ✓
     Step 4  Case context header + exit nav       ✓
     Step 5  Progress strip + Complete button     ✓ ← this step

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

  /* Step 4 + 5: injected shell element (header + strip wrapper) */
  var _shellEl = null;

  /* Step 5 EventBus handlers */
  var _onCaseUpdated    = null;
  var _onSectionVisited = null;
  var _onCompleted      = null;

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
     SHARED HELPERS (Steps 4 + 5)
  ══════════════════════════════════════════════════════════ */

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _statusPill(status) {
    var labels = { draft:'Draft', in_progress:'In Progress',
                   complete:'Complete', archived:'Archived' };
    return '<span class="clx-status-pill clx-status-' + _esc(status) + '">' +
             (labels[status] || _esc(status)) + '</span>';
  }

  /* ══════════════════════════════════════════════════════════
     STEP 4 — CASE CONTEXT HEADER
  ══════════════════════════════════════════════════════════ */

  function _buildHeaderHtml(kase, entry) {
    var patientLabel = kase.patient && kase.patient.identifier
      ? _esc(kase.patient.identifier) : 'Unknown patient';

    if (kase.patientId &&
        typeof PatientManager !== 'undefined' &&
        typeof PatientManager.getPatient === 'function') {
      var pt = PatientManager.getPatient(kase.patientId);
      if (pt) patientLabel = _esc(pt.firstName + ' ' + pt.lastName);
    }

    return (
      '<div class="clx-case-header" id="clx-case-header-bar">' +
        '<button class="clx-case-header-back" onclick="CaseShell._exitToList()">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
               'stroke="currentColor" stroke-width="2.5">' +
            '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
          '</svg>Cases' +
        '</button>' +
        '<div class="clx-case-header-divider"></div>' +
        '<div class="clx-case-header-patient">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" ' +
               'stroke="currentColor" stroke-width="2">' +
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
            '<circle cx="12" cy="7" r="4"/>' +
          '</svg>' + patientLabel +
        '</div>' +
        '<div class="clx-case-header-sep"></div>' +
        '<div class="clx-case-header-ref">'      + _esc(kase.reference)  + '</div>' +
        '<div class="clx-case-header-sep"></div>' +
        '<div class="clx-case-header-workflow">' + _esc(entry.label)     + '</div>' +
        '<div class="clx-case-header-sep"></div>' +
        '<div id="clx-case-header-status">'      + _statusPill(kase.status) + '</div>' +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     STEP 5 — PROGRESS STRIP + COMPLETE BUTTON

     Renders a horizontal strip of section nodes beneath the
     case header. Each node shows:
       ● visited  — filled circle + label, clickable to jump
       ◐ current  — highlighted circle + label
       ○ pending  — empty circle + label (required) or
                    ○ dashed (optional)

     Complete Assessment button appears in the strip at the
     right end. It is:
       — disabled (greyed) when not all required sections visited
       — enabled  when WorkflowRegistry.isCompletable() is true
       — hidden   when case.status === 'complete'

     The strip re-renders in place when section:visited or
     case:updated fires for the active case. Re-render is done
     by replacing innerHTML of #clx-progress-strip — a targeted
     update that leaves the header above it untouched.
  ══════════════════════════════════════════════════════════ */

  function _buildStripHtml(kase, entry) {
    var visited  = kase.workflow.visitedSections || [];
    var current  = kase.workflow.currentSection  || null;
    var sections = entry.sections;
    var completable = WorkflowRegistry.isCompletable(entry.id, visited);
    var isComplete  = kase.status === 'complete';

    /* Section nodes */
    var nodes = sections.map(function(s) {
      var isVisited = visited.indexOf(s.id) !== -1;
      var isCurrent = s.id === current;
      var stateClass = isCurrent  ? 'clx-strip-node-current'
                     : isVisited  ? 'clx-strip-node-visited'
                     :              'clx-strip-node-pending';
      var optClass   = s.required ? '' : ' clx-strip-node-optional';

      /* Clicking a visited node re-navigates to that section via the nav function */
      var clickable  = isVisited || isCurrent;
      var onclick    = clickable
        ? ' onclick="CaseShell._jumpToSection(\'' + _esc(s.domId) + '\')"'
        : '';

      return (
        '<div class="clx-strip-node ' + stateClass + optClass + '"' + onclick + '>' +
          '<div class="clx-strip-node-dot">' +
            (isVisited || isCurrent
              ? '<svg width="14" height="14" viewBox="0 0 14 14">' +
                  '<circle cx="7" cy="7" r="6" fill="currentColor"/>' +
                  (isVisited && !isCurrent
                    ? '<path d="M4 7l2 2 4-4" stroke="#fff" stroke-width="1.5" ' +
                      'stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
                    : '') +
                '</svg>'
              : '<svg width="14" height="14" viewBox="0 0 14 14">' +
                  '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" ' +
                           'stroke-width="' + (s.required ? '1.5' : '1') + '"' +
                           (s.required ? '' : ' stroke-dasharray="3 2"') + '/>' +
                '</svg>') +
          '</div>' +
          '<div class="clx-strip-node-label">' + _esc(s.label) + '</div>' +
        '</div>'
      );
    }).join('<div class="clx-strip-connector"></div>');

    /* Complete button — hidden once complete */
    var completeBtn = isComplete
      ? '<div class="clx-strip-complete-done">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ' +
               'stroke="currentColor" stroke-width="2.5">' +
            '<path d="M20 6L9 17l-5-5"/>' +
          '</svg>Complete' +
        '</div>'
      : '<button class="clx-strip-complete-btn' +
          (completable ? '' : ' clx-strip-complete-btn-disabled') + '"' +
          (completable ? ' onclick="CaseShell._completeCase()"' : ' disabled') + '>' +
          'Complete Assessment' +
        '</button>';

    return (
      '<div class="clx-progress-strip" id="clx-progress-strip">' +
        '<div class="clx-strip-nodes">' + nodes + '</div>' +
        '<div class="clx-strip-actions">' + completeBtn + '</div>' +
      '</div>'
    );
  }

  /* ── Inject the full shell (header + strip) ─────────────── */

  function _injectShell(kase, entry) {
    var pageEl = document.getElementById(entry.pageId);
    if (!pageEl) {
      console.warn('[CaseShell] pageId not found:', entry.pageId);
      return;
    }

    /* Remove any stale shell */
    var stale = document.getElementById('clx-shell-wrapper');
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);

    var wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<div id="clx-shell-wrapper">' +
        _buildHeaderHtml(kase, entry) +
        _buildStripHtml(kase, entry) +
      '</div>';
    _shellEl = wrapper.firstChild;

    if (pageEl.firstChild) {
      pageEl.insertBefore(_shellEl, pageEl.firstChild);
    } else {
      pageEl.appendChild(_shellEl);
    }
    console.info('[CaseShell] Shell injected into #' + entry.pageId);
  }

  /* ── Re-render only the progress strip (not the header) ─── */

  function _refreshStrip(caseId, entry) {
    var stripEl = document.getElementById('clx-progress-strip');
    if (!stripEl) return;
    var kase = CaseManager.getCase(caseId);
    if (!kase) return;
    /* Replace the strip's own outerHTML equivalent via parent */
    var parent = stripEl.parentNode;
    if (!parent) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = _buildStripHtml(kase, entry);
    var newStrip = tmp.firstChild;
    parent.replaceChild(newStrip, stripEl);
  }

  /* ── Refresh the status pill in the header ──────────────── */

  function _refreshHeaderStatus(caseId) {
    var statusEl = document.getElementById('clx-case-header-status');
    if (!statusEl) return;
    var kase = CaseManager.getCase(caseId);
    if (!kase) return;
    statusEl.innerHTML = _statusPill(kase.status);
  }

  /* ── Remove the entire shell from DOM ───────────────────── */

  function _removeShell() {
    if (_shellEl && _shellEl.parentNode) {
      _shellEl.parentNode.removeChild(_shellEl);
    }
    _shellEl = null;
  }

  /* ══════════════════════════════════════════════════════════
     STEP 5 ACTIONS (called from inline onclick)
  ══════════════════════════════════════════════════════════ */

  /* Jump to a section by domId using the active workflow's nav function */
  function _jumpToSection(domId) {
    if (!_entry) return;
    var navFn = window[_entry.navFn];
    if (typeof navFn === 'function') {
      navFn(domId, null);
    }
  }

  /* Complete the case: final save, completeCase, navigate to /cases */
  function _completeCase() {
    if (!_caseId || !_entry) return;

    /* Final autosave before completing */
    _persistState(_caseId, _entry);

    var liveState = window[_entry.stateVar];
    var finalState = {};
    if (liveState) {
      var keys = Object.keys(liveState);
      for (var i = 0; i < keys.length; i++) { finalState[keys[i]] = liveState[keys[i]]; }
    }

    CaseManager.completeCase(_caseId, finalState);
    console.info('[CaseShell] Case completed:', _caseId);
    /* Navigation triggered by the workflow:completed EventBus handler below */
  }

  /* Exit to case list with a final autosave */
  function _exitToList() {
    if (_caseId && _entry) {
      _persistState(_caseId, _entry);
    }
    Router.navigate('/cases');
  }

  /* ══════════════════════════════════════════════════════════
     DYNAMIC FIELD POPULATION
     Writes case/patient data into the workflow page DOM
     elements that previously held hardcoded demo values.
     Called once on mount, after _activateWorkflow shows the
     page. Only updates elements that exist in the active
     workflow page — OA-specific ids are safe to target
     because ABX/POLY pages don't contain them.
  ══════════════════════════════════════════════════════════ */

  function _updateWorkflowDynamic(kase) {
    /* Resolve patient display values */
    var identifier = kase.patient && kase.patient.identifier
      ? kase.patient.identifier : '—';

    /* Use full name from PatientManager if patientId is linked */
    if (kase.patientId &&
        typeof PatientManager !== 'undefined' &&
        typeof PatientManager.getPatient === 'function') {
      var pt = PatientManager.getPatient(kase.patientId);
      if (pt) identifier = pt.firstName + ' ' + pt.lastName;
    }

    var age = (kase.patient && kase.patient.age) ? kase.patient.age : '—';
    var ref = kase.reference || '—';

    /* ── Batch 1 (lines 898, 1107, 1187, 1371, 1834, 2547, 3188) ── */

    /* Line 898 — dp-scenario-meta */
    _setText('dyn-patient-meta', age + ' y/o · ' + _esc(kase.patient.setting || ''));

    /* Line 1107 — dp-topbar case id */
    _setText('dyn-case-ref-topbar', ref);

    /* Line 1187 — pi-case-ref */
    _setText('dyn-case-ref-pi', ref);

    /* Line 1371 — csl-case-ref */
    _setText('dyn-case-ref-csl', ref);

    /* Line 1834 — si-patient-name (scenario section) */
    _setText('dyn-patient-name-si', age + '-year-old · ' + _esc(identifier));

    /* Line 2547 — contenteditable clinical notes header + first line */
    _setText('dyn-cn-ref', ref);
    _setText('dyn-cn-patient-line',
      'Patient: ' + _esc(identifier) +
      (age !== '—' ? ', ' + age + ' years old' : '') +
      (kase.patient.setting ? ', ' + _esc(kase.patient.setting) : '') +
      '. Enter clinical background here.');

    /* Line 3188 — renal cascade age + eGFR inline values
       These read from the live workflow state (P.age, P.egfr)
       which has already been restored by _restoreState above.   */
    if (typeof window.P !== 'undefined') {
      _setText('dyn-renal-age',  window.P.age  !== undefined ? String(window.P.age)  : String(age));
      _setText('dyn-renal-egfr', window.P.egfr !== undefined ? String(window.P.egfr) : '—');
    }

    /* ── Handoff batch (lines 3544–4135) ───────────────────── */

    /* Shared values used across all six handoff documents */
    var patientSummary = age + ' y/o · ' + _esc(identifier);

    /* Line 3544 — hf-status-strip right (across all docs) */
    _setText('dyn-hf-status-right', ref + ' · ' + _escDate() + ' · M. Evteev');

    /* Document subtitles — each keeps its fixed descriptor,
       with the demo case ref replaced by the real reference  */
    _setText('dyn-hf-sub-pharmacist',
      'Case ' + ref + ' · ' + patientSummary);
    _setText('dyn-hf-sub-monitoring',
      'Case ' + ref + ' · For incoming pharmacist / clinical team');
    _setText('dyn-hf-sub-escalation',
      'Case ' + ref + ' · For supervising physician / team lead');
    _setText('dyn-hf-sub-attending',
      'Case ' + ref + ' · Concise summary for physician review');
    _setText('dyn-hf-sub-risk',
      'Case ' + ref + ' · Analgesic risk profile — structured for safety review');
    _setText('dyn-hf-sub-rationale',
      'Case ' + ref + ' · Documented reasoning for analgesic selection decision');
    _setText('dyn-hf-sub-followup',
      'Case ' + ref + ' · For next clinical contact — structured review agenda');

    /* Signature dates */
    _setText('dyn-hf-sigdate-pharmacist', 'Case ' + ref + ' · ' + _escDate());
    _setText('dyn-hf-sigdate-escalation', 'Case ' + ref + ' · ' + _escDate());
    _setText('dyn-hf-sigdate-attending',  ref + ' · ' + _escDate());
    _setText('dyn-hf-sigdate-risk',       ref + ' · ' + _escDate());
    _setText('dyn-hf-sigdate-rationale',  ref + ' · ' + _escDate());
    _setText('dyn-hf-sigdate-followup',   'Next contact: Week 2 · ' + ref);

    /* Line 3811 — Attending brief patient context line */
    _setText('dyn-hf-patient-context',
      _esc(identifier) +
      (age !== '—' ? ', ' + age + ' years old' : '') +
      '. Chronic OA pain. ' +
      (kase.patient.clinicalContext
        ? _esc(kase.patient.clinicalContext)
        : 'Document clinical context here.'));

    /* Line 4135 — hf-meta-card patient summary */
    _setText('dyn-hf-meta-patient', patientSummary);
  }

  /* ── ABX dynamic fields ────────────────────────────────── */

  function _updateAbxDynamic(kase) {
    var identifier = kase.patient && kase.patient.identifier ? kase.patient.identifier : '—';
    if (kase.patientId && typeof PatientManager !== 'undefined' &&
        typeof PatientManager.getPatient === 'function') {
      var pt = PatientManager.getPatient(kase.patientId);
      if (pt) identifier = pt.firstName + ' ' + pt.lastName;
    }
    var age = (kase.patient && kase.patient.age) ? kase.patient.age : '—';
    var ref = kase.reference || '—';
    var setting = (kase.patient && kase.patient.setting) ? kase.patient.setting : '';

    _setText('dyn-abx-patient-meta',    age + ' y/o · ' + _esc(setting));
    _setText('dyn-abx-case-ref-topbar', ref);
    _setText('dyn-abx-patient-name',    age + '-year-old · ' + _esc(identifier));
    _setText('dyn-abx-patient-sub',
      _esc(setting) +
      (kase.patient.clinicalContext ? ' · ' + _esc(kase.patient.clinicalContext) : '') +
      (kase.patient.referralSource  ? ' · ' + _esc(kase.patient.referralSource)  : ''));
  }

  /* ── POLY dynamic fields ───────────────────────────────── */

  function _updatePolyDynamic(kase) {
    var identifier = kase.patient && kase.patient.identifier ? kase.patient.identifier : '—';
    if (kase.patientId && typeof PatientManager !== 'undefined' &&
        typeof PatientManager.getPatient === 'function') {
      var pt = PatientManager.getPatient(kase.patientId);
      if (pt) identifier = pt.firstName + ' ' + pt.lastName;
    }
    var age = (kase.patient && kase.patient.age) ? kase.patient.age : '—';
    var ref = kase.reference || '—';
    var setting = (kase.patient && kase.patient.setting) ? kase.patient.setting : '';

    _setText('dyn-poly-patient-meta',    age + ' y/o · ' + _esc(setting));
    _setText('dyn-poly-case-ref-topbar', ref);
    _setText('dyn-poly-patient-name',    age + '-year-old · ' + _esc(identifier));
  }

  /* Write textContent to an element by id — safe no-op if not found */
  function _setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* Short month-year string e.g. "Jun 2026" */
  function _escDate() {
    var d = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
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
    _updateWorkflowDynamic(kase);      /* OA dynamic fields (Batch 1 + Handoff) */
    if (entry.id === 'abx')  _updateAbxDynamic(kase);   /* ABX dynamic fields */
    if (entry.id === 'poly') _updatePolyDynamic(kase);  /* POLY dynamic fields */
    _injectShell(kase, entry);         /* Steps 4 + 5 */

    /* EventBus subscriptions for live refresh */
    _onSectionVisited = function (payload) {
      if (!payload || payload.caseId !== caseId) return;
      _refreshStrip(caseId, entry);
      _refreshHeaderStatus(caseId);
    };
    _onCaseUpdated = function (payload) {
      if (!payload || payload.caseId !== caseId) return;
      _refreshStrip(caseId, entry);
      _refreshHeaderStatus(caseId);
    };
    _onCompleted = function (payload) {
      if (!payload || payload.caseId !== caseId) return;
      /* Navigate to case list after a brief moment so the strip
         can re-render to show the "Complete" done state first.  */
      setTimeout(function() { Router.navigate('/cases'); }, 400);
    };

    EventBus.on('section:visited',   _onSectionVisited);
    EventBus.on('case:updated',      _onCaseUpdated);
    EventBus.on('workflow:completed', _onCompleted);

    return true;
  }

  function unmount() {
    /* Teardown subscriptions */
    if (_onSectionVisited) { EventBus.off('section:visited',   _onSectionVisited); _onSectionVisited = null; }
    if (_onCaseUpdated)    { EventBus.off('case:updated',      _onCaseUpdated);    _onCaseUpdated    = null; }
    if (_onCompleted)      { EventBus.off('workflow:completed', _onCompleted);      _onCompleted      = null; }

    /* Remove injected DOM */
    _removeShell();

    /* Restore wrapped functions */
    _restoreApplyParam();
    _restoreNavFunctions();

    /* Hide workflow pages, restore app-view */
    ['workflow-page', 'abx-page', 'poly-page'].forEach(function (id) {
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
    mount:          mount,
    unmount:        unmount,
    activeCaseId:   activeCaseId,
    activeEntry:    activeEntry,
    _exitToList:    _exitToList,     /* inline onclick */
    _jumpToSection: _jumpToSection,  /* inline onclick */
    _completeCase:  _completeCase    /* inline onclick */
  };

}());
