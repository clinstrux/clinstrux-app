/* ════════════════════════════════════════════════════════════
   app.js — Boot / initialisation entry point
   Phase 2: Router + platform views boot sequence.
   Clinstrux · Clinical Decision Infrastructure

   Load order (enforced by index.html):
     data/oa-content.js, abx-content.js, poly-content.js
     js/event-bus.js
     js/workflow-registry.js
     js/case-manager.js
     js/router.js
     js/core.js
     js/oa.js, abx.js, poly.js
     js/views/dashboard.js
     js/views/case-list.js
     js/views/new-case.js
     js/app.js  ← this file (last)
════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {

  /* ── 1. Render global navigation ───────────────────────── */
  _renderGlobalNav();

  /* ── 2. OA workflow pre-warm ────────────────────────────── */
  /* Pre-warm runs regardless of route in Phase 2.
     Phase 4 will make this conditional on the active route.
     All workflow DOM must be present (it is — just hidden).   */
  updateParamTiles();
  updateComplexityBar();
  updateClinicalStatusSummary();
  updateClinicalImpression();

  var rec    = buildPrimaryRec();
  var nsaidR = buildNsaidReasoning();
  _isFirstRun = true;
  updateClinicalReasoningPanel(rec, nsaidR);
  updateTradeoffStrip();
  updateEscalationTags();
  updateRenalDosingBlock();
  updateInterventionPanel(rec);
  updatePolypharmacyPanel();
  initLongitudinalProgression();
  updateHandoffMeta();

  /* ── 3. ABX pre-warm ────────────────────────────────────── */
  abxRunReasoningEngine();

  /* ── 4. Poly pre-warm ───────────────────────────────────── */
  polyRunReasoningEngine();

  /* ── 5. Initialise router with all platform routes ──────── */
  Router.init([
    { path: '/dashboard',  view: DashboardView },
    { path: '/cases/new',  view: NewCaseView   },
    { path: '/cases/:id',  view: _CaseStubView },
    { path: '/cases',      view: CaseListView  }
  ]);

});

/* ── Global navigation renderer ────────────────────────────── */

function _renderGlobalNav() {
  var nav = document.getElementById('global-nav');
  if (!nav) return;

  nav.innerHTML =
    '<div class="clx-nav-inner">' +
      '<a class="clx-nav-brand" onclick="Router.navigate(\'/dashboard\'); return false;" href="#">' +
        '<img src="https://i.ibb.co/b5b8qNk8/clinstrux-full-light.png" alt="Clinstrux" class="clx-nav-logo" />' +
      '</a>' +
      '<nav class="clx-nav-links">' +
        '<a class="clx-nav-link" onclick="Router.navigate(\'/cases\'); return false;" href="#">Cases</a>' +
      '</nav>' +
      '<div class="clx-nav-actions">' +
        '<button class="clx-btn clx-btn-primary clx-btn-sm" onclick="Router.navigate(\'/cases/new\')">+ New Case</button>' +
      '</div>' +
    '</div>';
}

/* ── Case Shell stub view (Phase 2 placeholder) ─────────────── */
/* Replaced in Phase 3 by the full WorkflowShell + CaseShellView */

var _CaseStubView = (function() {

  function mount(container, params) {
    var caseId = params && params.id;
    var kase   = caseId ? CaseManager.getCase(caseId) : null;

    var body;
    if (kase) {
      var entry = WorkflowRegistry.get(kase.workflow.workflowId);
      body =
        '<div class="clx-stub-case">' +
          '<div class="clx-stub-badge">Case Shell — coming in Phase 3</div>' +
          '<h2 class="clx-stub-ref">' + _escStub(kase.reference) + '</h2>' +
          '<p class="clx-stub-patient">' +
            _escStub(kase.patient.identifier) + ' · ' +
            _escStub(kase.patient.age) + ' yrs · ' +
            _escStub(kase.patient.setting) +
          '</p>' +
          '<p class="clx-stub-workflow">' + _escStub(entry ? entry.label : kase.workflow.workflowId) + '</p>' +
          '<p class="clx-stub-status">Status: ' + _escStub(kase.status) + '</p>' +
          '<div class="clx-stub-actions">' +
            '<button class="clx-btn clx-btn-secondary" onclick="Router.navigate(\'/cases\')">← Case List</button>' +
            '<button class="clx-btn clx-btn-secondary" onclick="Router.navigate(\'/dashboard\')">Dashboard</button>' +
          '</div>' +
        '</div>';
    } else {
      body =
        '<div class="clx-not-found">' +
          '<div class="clx-not-found-code">404</div>' +
          '<div class="clx-not-found-msg">Case not found</div>' +
          '<div class="clx-not-found-path">' + _escStub(caseId) + '</div>' +
          '<button class="clx-btn clx-btn-secondary" onclick="Router.navigate(\'/cases\')">← Case List</button>' +
        '</div>';
    }

    if (container) container.innerHTML = body;
  }

  function unmount() {}

  function _escStub(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { mount: mount, unmount: unmount };
}());
