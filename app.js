/* ════════════════════════════════════════════════════════════
   app.js — Boot / initialisation entry point
   Phase 2: Router initialisation + global nav render.
   Clinstrux · Clinical Decision Infrastructure

   Load order (must be respected in index.html):
     event-bus.js → workflow-registry.js → case-manager.js
     → router.js → core.js
     → oa.js → abx.js → poly.js
     → workflow-shell.js → doc-bridge.js
     → views/dashboard.js → views/case-list.js
     → views/new-case.js → views/case-shell-view.js
     → app.js  ← this file, always last
════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {

  /* ── Phase 4 note ────────────────────────────────────────
     The _clxRestoreRoute flag is read by the OA prewarm block
     to suppress initLongitudinalProgression() when a case
     restore is in progress. Phase 4 sets this before prewarm.
     For Phase 2, the flag is always false — prewarm runs
     normally on every load.                                   */
  var _clxRestoreRoute = false;

  /* ── OA workflow pre-warm ────────────────────────────────
     Runs on every load so the workflow is DOM-ready when the
     shell mounts it. In Phase 4, suppressed on restore routes. */
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
  if (!_clxRestoreRoute) {
    initLongitudinalProgression(); /* suppressed in Phase 4 for restore routes */
  }
  updateHandoffMeta();

  /* ── ABX workflow pre-warm ──────────────────────────────── */
  abxRunReasoningEngine();

  /* ── Poly workflow pre-warm ─────────────────────────────── */
  polyRunReasoningEngine();

  /* ── Global navigation ─────────────────────────────────── */
  _renderGlobalNav();

  /* ── Register routes ────────────────────────────────────── */
  Router.register('/dashboard',       DashboardView);
  Router.register('/cases',           CaseListView);
  Router.register('/cases/new',       NewCaseView);
  Router.register('/cases/:id',       CaseShellView);
  Router.register('/cases/:id/doc',   CaseShellView); /* Phase 5 replaces this */
  Router.register404(_404View);

  /* ── Hide legacy entry point ────────────────────────────── */
  /* Must happen BEFORE Router.init() so the entry page is never
     visible when the dashboard mounts. entry-page also carries
     style="display:none" in HTML as a belt-and-suspenders guard.
     It remains in the DOM for backward-compatibility testing.    */
  var ep = document.getElementById('entry-page');
  if (ep) ep.style.display = 'none';

  /* ── Start router ───────────────────────────────────────── */
  Router.init();

});

/* ── Global nav renderer ────────────────────────────────── */

function _renderGlobalNav() {
  var nav = document.getElementById('clx-global-nav');
  if (!nav) return;

  nav.innerHTML = (
    '<div class="clx-nav-inner">' +
      '<a class="clx-nav-wordmark" href="#/dashboard">Clinstrux</a>' +
      '<nav class="clx-nav-links">' +
        '<a class="clx-nav-link" href="#/cases">Cases</a>' +
        '<a class="clx-btn clx-btn--primary clx-nav-new" href="#/cases/new">+ New Case</a>' +
      '</nav>' +
    '</div>'
  );
}

/* ── 404 view ───────────────────────────────────────────── */

var _404View = {
  mount: function(container) {
    container.innerHTML = (
      '<div class="clx-404">' +
        '<h2>Page not found</h2>' +
        '<p>The page you requested does not exist.</p>' +
        '<a class="clx-btn clx-btn--ghost" href="#/dashboard">← Dashboard</a>' +
      '</div>'
    );
  },
  unmount: function() {}
};
