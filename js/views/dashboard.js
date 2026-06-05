/* ════════════════════════════════════════════════════════════
   views/dashboard.js — Dashboard view
   Clinstrux · Clinical Decision Infrastructure

   Renders the platform dashboard:
     Zone A — Quick Action: + New Case
     Zone B — Active Cases panel (up to 5 recent)
     Zone C — Workflow Catalogue quick-start tiles
     Zone D — Summary strip

   Subscribes to case:created / case:updated to refresh
   the active cases panel without a full re-render.
════════════════════════════════════════════════════════════ */

var DashboardView = (function() {

  var _container = null;
  var _handlers  = {};   /* EventBus handlers — stored for cleanup */

  /* ── Helpers ─────────────────────────────────────────────── */

  function _statusPill(status) {
    var labels = {
      draft:       'Draft',
      in_progress: 'In Progress',
      complete:    'Complete',
      archived:    'Archived'
    };
    var label = labels[status] || status;
    return '<span class="clx-status-pill clx-status-' + status + '">' + label + '</span>';
  }

  function _relativeTime(isoString) {
    if (!isoString) return '';
    var diff = Date.now() - new Date(isoString).getTime();
    var mins  = Math.floor(diff / 60000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)   return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7)   return days + 'd ago';
    return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function _workflowIcon(workflowId) {
    var icons = {
      oa:   'M12 2a7 7 0 0 1 7 7c0 3.5-2.5 6-4.5 8l-2.5 3-2.5-3C7.5 15 5 12.5 5 9a7 7 0 0 1 7-7z',
      abx:  'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
      poly: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H8v-2h4v2zm4-4H8v-2h8v2zm0-4H8V7h8v2z'
    };
    return icons[workflowId] || icons.oa;
  }

  /* ── Case card HTML ─────────────────────────────────────────  */

  function _renderCaseCard(c) {
    var entry = WorkflowRegistry.get(c.workflow.workflowId);
    var label = entry ? entry.label : c.workflow.workflowLabel;

    /* Progress label — section within assessment */
    var progressLabel = '';
    if (c.workflow.visitedSections && c.workflow.visitedSections.length > 0) {
      var sections  = entry ? entry.sections : [];
      var lastId    = c.workflow.visitedSections[c.workflow.visitedSections.length - 1];
      var lastSec   = sections.filter(function(s) { return s.id === lastId; })[0];
      var totalReq  = sections.filter(function(s) { return s.required; }).length;
      progressLabel = lastSec
        ? 'Step ' + lastSec.step + ' — ' + lastSec.label
        : lastId;
      if (totalReq > 0) progressLabel += ' (' + c.workflow.visitedSections.length + '/' + sections.length + ')';
    } else {
      progressLabel = 'Not started';
    }

    return (
      '<div class="clx-case-card" data-case-id="' + c.id + '">' +
        '<div class="clx-case-card-header">' +
          '<div class="clx-case-card-ref">' + _escHtml(c.reference) + '</div>' +
          _statusPill(c.status) +
        '</div>' +
        '<div class="clx-case-card-patient">' + _escHtml(c.patient.identifier || 'Unnamed patient') + '</div>' +
        '<div class="clx-case-card-meta">' +
          '<span class="clx-case-card-workflow">' + _escHtml(label) + '</span>' +
        '</div>' +
        '<div class="clx-case-card-progress">' + _escHtml(progressLabel) + '</div>' +
        '<div class="clx-case-card-footer">' +
          '<span class="clx-case-card-time">' + _relativeTime(c.updatedAt) + '</span>' +
          (c.status !== 'archived' && c.status !== 'complete'
            ? '<button class="clx-btn clx-btn-primary clx-btn-sm" onclick="Router.navigate(\'/cases/' + c.id + '\')">Resume →</button>'
            : '<button class="clx-btn clx-btn-secondary clx-btn-sm" onclick="Router.navigate(\'/cases/' + c.id + '\')">View</button>') +
        '</div>' +
      '</div>'
    );
  }

  /* ── Workflow tile HTML ─────────────────────────────────────  */

  function _renderWorkflowTile(entry) {
    return (
      '<div class="clx-workflow-tile" onclick="Router.navigate(\'/cases/new?workflow=' + entry.id + '\')">' +
        '<div class="clx-workflow-tile-icon">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="' + _workflowIcon(entry.id) + '"/>' +
          '</svg>' +
        '</div>' +
        '<div class="clx-workflow-tile-label">' + _escHtml(entry.label) + '</div>' +
        '<div class="clx-workflow-tile-category">' + _escHtml(entry.category) + '</div>' +
        '<div class="clx-workflow-tile-cta">Start new case →</div>' +
      '</div>'
    );
  }

  /* ── Active cases panel ─────────────────────────────────────  */

  function _renderActiveCasesPanel() {
    var cases = CaseManager.listCases().filter(function(c) {
      return c.status !== 'archived';
    }).slice(0, 5);

    if (cases.length === 0) {
      return (
        '<div class="clx-empty-state">' +
          '<div class="clx-empty-state-icon">📋</div>' +
          '<div class="clx-empty-state-title">No active cases</div>' +
          '<div class="clx-empty-state-body">Create your first case using the + New Case button or a quick-start tile.</div>' +
          '<button class="clx-btn clx-btn-primary" onclick="Router.navigate(\'/cases/new\')">Start First Case</button>' +
        '</div>'
      );
    }

    return cases.map(_renderCaseCard).join('');
  }

  /* ── Summary stats ──────────────────────────────────────────  */

  function _renderSummaryStrip() {
    var all      = CaseManager.listCases();
    var total    = all.length;
    var active   = all.filter(function(c) { return c.status === 'in_progress'; }).length;
    var complete = all.filter(function(c) { return c.status === 'complete'; }).length;

    /* "completed this week" */
    var weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var thisWeek = all.filter(function(c) {
      return c.status === 'complete' && c.updatedAt > weekAgo;
    }).length;

    return (
      '<div class="clx-summary-strip">' +
        '<div class="clx-summary-stat"><div class="clx-summary-stat-val">' + total + '</div><div class="clx-summary-stat-label">Total Cases</div></div>' +
        '<div class="clx-summary-divider"></div>' +
        '<div class="clx-summary-stat"><div class="clx-summary-stat-val">' + active + '</div><div class="clx-summary-stat-label">In Progress</div></div>' +
        '<div class="clx-summary-divider"></div>' +
        '<div class="clx-summary-stat"><div class="clx-summary-stat-val">' + complete + '</div><div class="clx-summary-stat-label">Complete</div></div>' +
        '<div class="clx-summary-divider"></div>' +
        '<div class="clx-summary-stat"><div class="clx-summary-stat-val">' + thisWeek + '</div><div class="clx-summary-stat-label">Completed This Week</div></div>' +
      '</div>'
    );
  }

  /* ── Full render ────────────────────────────────────────────  */

  function _render() {
    if (!_container) return;

    var workflows = WorkflowRegistry.getAll();

    _container.innerHTML =
      '<div class="clx-dashboard">' +

        /* Header row */
        '<div class="clx-dashboard-header">' +
          '<div>' +
            '<h1 class="clx-dashboard-title">Dashboard</h1>' +
            '<p class="clx-dashboard-subtitle">Clinical Decision Support · Pharmacist Workspace</p>' +
          '</div>' +
          '<button class="clx-btn clx-btn-primary" onclick="Router.navigate(\'/cases/new\')">' +
            '+ New Case' +
          '</button>' +
        '</div>' +

        /* Main grid */
        '<div class="clx-dashboard-grid">' +

          /* Zone B — Active cases */
          '<div class="clx-dashboard-main">' +
            '<div class="clx-panel">' +
              '<div class="clx-panel-header">' +
                '<span class="clx-panel-title">Active Cases</span>' +
                '<a class="clx-panel-link" onclick="Router.navigate(\'/cases\'); return false;" href="#">View all →</a>' +
              '</div>' +
              '<div class="clx-active-cases" id="clx-active-cases-panel">' +
                _renderActiveCasesPanel() +
              '</div>' +
            '</div>' +
          '</div>' +

          /* Zone C — Workflow catalogue */
          '<div class="clx-dashboard-sidebar">' +
            '<div class="clx-panel">' +
              '<div class="clx-panel-header">' +
                '<span class="clx-panel-title">Workflows</span>' +
              '</div>' +
              '<div class="clx-workflow-tiles">' +
                workflows.map(_renderWorkflowTile).join('') +
              '</div>' +
            '</div>' +
          '</div>' +

        '</div>' +

        /* Zone D — Summary strip */
        _renderSummaryStrip() +

      '</div>';
  }

  /* ── Partial refresh (active cases panel only) ──────────────  */

  function _refreshActiveCases() {
    var panel = document.getElementById('clx-active-cases-panel');
    if (panel) {
      panel.innerHTML = _renderActiveCasesPanel();
    }
  }

  /* ── HTML escape util ───────────────────────────────────────  */

  function _escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC: View interface
  ══════════════════════════════════════════════════════════ */

  function mount(container) {
    _container = container;
    _render();

    /* Subscribe to case events — refresh the panel */
    _handlers.created = function() { _refreshActiveCases(); };
    _handlers.updated = function() { _refreshActiveCases(); };
    _handlers.archived = function() { _refreshActiveCases(); };

    EventBus.on('case:created', _handlers.created);
    EventBus.on('case:updated', _handlers.updated);
    EventBus.on('case:archived', _handlers.archived);
  }

  function unmount() {
    EventBus.off('case:created', _handlers.created);
    EventBus.off('case:updated', _handlers.updated);
    EventBus.off('case:archived', _handlers.archived);
    _container = null;
    _handlers  = {};
  }

  return { mount: mount, unmount: unmount };

}());
