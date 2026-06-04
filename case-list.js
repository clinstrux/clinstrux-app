/* ════════════════════════════════════════════════════════════
   views/case-list.js — Case List view
   Clinstrux · Clinical Decision Infrastructure

   Renders the full case list with:
     - Status filter (all / draft / in_progress / complete / archived)
     - Workflow filter (all / oa / abx / poly)
     - Sort (newest / oldest)
     - Case rows: reference, patient, workflow, status, updated
     - Actions: Open, Archive
════════════════════════════════════════════════════════════ */

var CaseListView = (function() {

  var _container  = null;
  var _handlers   = {};

  /* Filter/sort state — local to this view's lifetime */
  var _filterStatus   = 'all';
  var _filterWorkflow = 'all';
  var _sortOrder      = 'newest';

  /* ── Helpers ─────────────────────────────────────────────── */

  function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _statusPill(status) {
    var labels = { draft: 'Draft', in_progress: 'In Progress', complete: 'Complete', archived: 'Archived' };
    return '<span class="clx-status-pill clx-status-' + status + '">' + (labels[status] || status) + '</span>';
  }

  function _formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* ── Build filtered + sorted case list ─────────────────────  */

  function _getCases() {
    var filters = {};
    if (_filterStatus !== 'all')   filters.status = _filterStatus;
    if (_filterWorkflow !== 'all') filters.workflowId = _filterWorkflow;

    var list = CaseManager.listCases(filters);

    if (_sortOrder === 'oldest') {
      list = list.slice().sort(function(a, b) {
        return new Date(a.updatedAt) - new Date(b.updatedAt);
      });
    }
    return list;
  }

  /* ── Row HTML ───────────────────────────────────────────────  */

  function _renderRow(c) {
    var entry    = WorkflowRegistry.get(c.workflow.workflowId);
    var wfLabel  = entry ? entry.label : c.workflow.workflowLabel;
    var sections = entry ? entry.sections : [];
    var visited  = c.workflow.visitedSections || [];
    var progress = visited.length + '/' + sections.length + ' sections';

    return (
      '<tr class="clx-list-row" data-case-id="' + c.id + '">' +
        '<td class="clx-list-td clx-list-ref">' + _escHtml(c.reference) + '</td>' +
        '<td class="clx-list-td clx-list-patient">' + _escHtml(c.patient.identifier || '—') + '</td>' +
        '<td class="clx-list-td clx-list-workflow">' +
          '<span class="clx-workflow-badge clx-wf-' + c.workflow.workflowId + '">' + _escHtml(c.workflow.workflowId.toUpperCase()) + '</span> ' +
          _escHtml(wfLabel) +
        '</td>' +
        '<td class="clx-list-td">' + _statusPill(c.status) + '</td>' +
        '<td class="clx-list-td clx-list-progress">' + progress + '</td>' +
        '<td class="clx-list-td clx-list-updated">' + _formatDate(c.updatedAt) + '</td>' +
        '<td class="clx-list-td clx-list-actions">' +
          '<button class="clx-btn clx-btn-secondary clx-btn-sm" onclick="Router.navigate(\'/cases/' + c.id + '\')">' +
            (c.status === 'archived' || c.status === 'complete' ? 'View' : 'Open') +
          '</button>' +
          (c.status !== 'archived'
            ? ' <button class="clx-btn clx-btn-ghost clx-btn-sm clx-list-archive-btn" data-case-id="' + c.id + '">Archive</button>'
            : '') +
        '</td>' +
      '</tr>'
    );
  }

  /* ── Table ──────────────────────────────────────────────────  */

  function _renderTable(cases) {
    if (cases.length === 0) {
      return (
        '<div class="clx-empty-state clx-empty-state-table">' +
          '<div class="clx-empty-state-icon">🗂</div>' +
          '<div class="clx-empty-state-title">No cases found</div>' +
          '<div class="clx-empty-state-body">' +
            (_filterStatus !== 'all' || _filterWorkflow !== 'all'
              ? 'No cases match the current filters. Try clearing the filters.'
              : 'No cases yet. Create your first case to get started.') +
          '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="clx-list-table-wrap">' +
        '<table class="clx-list-table">' +
          '<thead>' +
            '<tr>' +
              '<th class="clx-list-th">Reference</th>' +
              '<th class="clx-list-th">Patient</th>' +
              '<th class="clx-list-th">Workflow</th>' +
              '<th class="clx-list-th">Status</th>' +
              '<th class="clx-list-th">Progress</th>' +
              '<th class="clx-list-th">Last Updated</th>' +
              '<th class="clx-list-th">Actions</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="clx-list-tbody">' +
            cases.map(_renderRow).join('') +
          '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  /* ── Filter bar ─────────────────────────────────────────────  */

  function _renderFilters() {
    var statusOptions = [
      { val: 'all',         label: 'All Statuses' },
      { val: 'draft',       label: 'Draft'        },
      { val: 'in_progress', label: 'In Progress'  },
      { val: 'complete',    label: 'Complete'     },
      { val: 'archived',    label: 'Archived'     }
    ];

    var workflowOptions = [
      { val: 'all',  label: 'All Workflows' },
      { val: 'oa',   label: 'OA'            },
      { val: 'abx',  label: 'ABX'           },
      { val: 'poly', label: 'Polypharmacy'  }
    ];

    var sortOptions = [
      { val: 'newest', label: 'Newest First' },
      { val: 'oldest', label: 'Oldest First' }
    ];

    function opts(arr, current) {
      return arr.map(function(o) {
        return '<option value="' + o.val + '"' + (current === o.val ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
    }

    return (
      '<div class="clx-list-filters">' +
        '<select class="clx-select" id="clx-filter-status">' + opts(statusOptions, _filterStatus) + '</select>' +
        '<select class="clx-select" id="clx-filter-workflow">' + opts(workflowOptions, _filterWorkflow) + '</select>' +
        '<select class="clx-select" id="clx-filter-sort">' + opts(sortOptions, _sortOrder) + '</select>' +
        '<span class="clx-list-count" id="clx-list-count"></span>' +
      '</div>'
    );
  }

  /* ── Full render ────────────────────────────────────────────  */

  function _render() {
    if (!_container) return;
    var cases = _getCases();

    _container.innerHTML =
      '<div class="clx-case-list">' +
        '<div class="clx-page-header">' +
          '<div>' +
            '<h1 class="clx-page-title">Cases</h1>' +
            '<p class="clx-page-subtitle">All clinical review cases</p>' +
          '</div>' +
          '<button class="clx-btn clx-btn-primary" onclick="Router.navigate(\'/cases/new\')">+ New Case</button>' +
        '</div>' +
        _renderFilters() +
        '<div id="clx-list-table-container">' + _renderTable(cases) + '</div>' +
      '</div>';

    /* Update count badge */
    var countEl = document.getElementById('clx-list-count');
    if (countEl) countEl.textContent = cases.length + ' case' + (cases.length !== 1 ? 's' : '');

    _bindFilterEvents();
    _bindArchiveEvents();
  }

  /* ── Re-render table section only (after filter change) ─────  */

  function _refreshTable() {
    var cases = _getCases();
    var container = document.getElementById('clx-list-table-container');
    if (container) container.innerHTML = _renderTable(cases);

    var countEl = document.getElementById('clx-list-count');
    if (countEl) countEl.textContent = cases.length + ' case' + (cases.length !== 1 ? 's' : '');

    _bindArchiveEvents();
  }

  /* ── Event binding ──────────────────────────────────────────  */

  function _bindFilterEvents() {
    var statusEl   = document.getElementById('clx-filter-status');
    var workflowEl = document.getElementById('clx-filter-workflow');
    var sortEl     = document.getElementById('clx-filter-sort');

    if (statusEl) {
      statusEl.addEventListener('change', function() {
        _filterStatus = statusEl.value;
        _refreshTable();
      });
    }
    if (workflowEl) {
      workflowEl.addEventListener('change', function() {
        _filterWorkflow = workflowEl.value;
        _refreshTable();
      });
    }
    if (sortEl) {
      sortEl.addEventListener('change', function() {
        _sortOrder = sortEl.value;
        _refreshTable();
      });
    }
  }

  function _bindArchiveEvents() {
    var btns = document.querySelectorAll('.clx-list-archive-btn');
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var caseId = btn.getAttribute('data-case-id');
          if (!caseId) return;
          if (window.confirm('Archive this case? It will still be accessible via the Archived filter.')) {
            CaseManager.archiveCase(caseId);
            /* Row update handled by EventBus subscription */
          }
        });
      })(btns[i]);
    }
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC: View interface
  ══════════════════════════════════════════════════════════ */

  function mount(container) {
    _container = container;

    /* Reset filters on fresh mount */
    _filterStatus   = 'all';
    _filterWorkflow = 'all';
    _sortOrder      = 'newest';

    _render();

    /* EventBus — refresh table on case changes */
    _handlers.updated  = function() { _refreshTable(); };
    _handlers.archived = function() { _refreshTable(); };
    _handlers.created  = function() { _refreshTable(); };

    EventBus.on('case:updated',  _handlers.updated);
    EventBus.on('case:archived', _handlers.archived);
    EventBus.on('case:created',  _handlers.created);
  }

  function unmount() {
    EventBus.off('case:updated',  _handlers.updated);
    EventBus.off('case:archived', _handlers.archived);
    EventBus.off('case:created',  _handlers.created);
    _container = null;
    _handlers  = {};
  }

  return { mount: mount, unmount: unmount };

}());
