/* ════════════════════════════════════════════════════════════
   views/patient-list.js — Patient roster view
   Clinstrux · Clinical Decision Infrastructure

   Route:  /patients
   Renders the full patient list with:
     - Live search across firstName, lastName, patientId
     - Sex filter
     - Sort (newest / oldest)
     - Patient rows: name, DOB, age, sex, last updated,
       open case count
     - + New Patient button → /patients/new
     - Row click → /patients/:id

   Subscribes to patient:created / patient:updated /
   patient:deleted for live refresh without full re-render.
════════════════════════════════════════════════════════════ */

var PatientListView = (function () {

  var _container  = null;
  var _handlers   = {};
  var _searchQuery = '';
  var _filterSex   = 'all';
  var _sortOrder   = 'newest';

  /* ── Helpers ─────────────────────────────────────────────── */

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _calcAge(dob) {
    if (!dob) return '—';
    var birth = new Date(dob);
    var today = new Date();
    var age   = today.getFullYear() - birth.getFullYear();
    var m     = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function _formatDob(isoDate) {
    if (!isoDate) return '—';
    var parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function _relativeTime(isoString) {
    if (!isoString) return '';
    var diff = Date.now() - new Date(isoString).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)   return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7)   return days + 'd ago';
    return new Date(isoString).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function _sexLabel(sex) {
    var map = { male:'Male', female:'Female', other:'Other', unknown:'Unknown' };
    return map[sex] || _esc(sex);
  }

  /* Count active (non-archived) cases for a patient */
  function _activeCaseCount(patientId) {
    var cases = CaseManager.listCases().filter(function(c) {
      return c.patientId === patientId && c.status !== 'archived';
    });
    return cases.length;
  }

  /* ── Build filtered + sorted patient list ─────────────────── */

  function _getPatients() {
    var list;
    if (_searchQuery.trim()) {
      list = PatientManager.searchPatients(_searchQuery);
    } else {
      var filters = {};
      if (_filterSex !== 'all') filters.sex = _filterSex;
      list = PatientManager.listPatients(filters);
    }

    if (_sortOrder === 'oldest') {
      list = list.slice().sort(function(a, b) {
        return new Date(a.updatedAt) - new Date(b.updatedAt);
      });
    }

    return list;
  }

  /* ── Table row HTML ──────────────────────────────────────── */

  function _renderRow(p) {
    var age       = _calcAge(p.dateOfBirth);
    var caseCount = _activeCaseCount(p.patientId);

    return (
      '<tr class="clx-pt-list-row" onclick="Router.navigate(\'/patients/' + p.patientId + '\')">' +
        '<td class="clx-pt-list-td clx-pt-list-name">' +
          '<div class="clx-pt-name-primary">' + _esc(p.lastName) + ', ' + _esc(p.firstName) + '</div>' +
          '<div class="clx-pt-name-id">' + _esc(p.patientId) + '</div>' +
        '</td>' +
        '<td class="clx-pt-list-td">' + _formatDob(p.dateOfBirth) + '</td>' +
        '<td class="clx-pt-list-td">' + age + '</td>' +
        '<td class="clx-pt-list-td">' + _sexLabel(p.sex) + '</td>' +
        '<td class="clx-pt-list-td">' +
          (caseCount > 0
            ? '<span class="clx-pt-case-badge">' + caseCount + ' case' + (caseCount !== 1 ? 's' : '') + '</span>'
            : '<span class="clx-pt-case-badge clx-pt-case-badge-empty">No cases</span>') +
        '</td>' +
        '<td class="clx-pt-list-td clx-pt-list-updated">' + _relativeTime(p.updatedAt) + '</td>' +
      '</tr>'
    );
  }

  /* ── Table HTML ──────────────────────────────────────────── */

  function _renderTable(patients) {
    if (patients.length === 0) {
      return (
        '<div class="clx-empty-state clx-empty-state-table">' +
          '<div class="clx-empty-state-icon">👤</div>' +
          '<div class="clx-empty-state-title">' +
            (_searchQuery.trim() || _filterSex !== 'all'
              ? 'No patients match the current filters'
              : 'No patients yet') +
          '</div>' +
          '<div class="clx-empty-state-body">' +
            (_searchQuery.trim() || _filterSex !== 'all'
              ? 'Try clearing the search or filters.'
              : 'Create your first patient record to get started.') +
          '</div>' +
          (!_searchQuery.trim() && _filterSex === 'all'
            ? '<button class="clx-btn clx-btn-primary" onclick="Router.navigate(\'/patients/new\')">+ New Patient</button>'
            : '') +
        '</div>'
      );
    }

    return (
      '<div class="clx-pt-table-wrap">' +
        '<table class="clx-pt-table">' +
          '<thead>' +
            '<tr>' +
              '<th class="clx-pt-th">Name</th>' +
              '<th class="clx-pt-th">DOB</th>' +
              '<th class="clx-pt-th">Age</th>' +
              '<th class="clx-pt-th">Sex</th>' +
              '<th class="clx-pt-th">Cases</th>' +
              '<th class="clx-pt-th">Last Updated</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="clx-pt-list-tbody">' +
            patients.map(_renderRow).join('') +
          '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  /* ── Filter bar ──────────────────────────────────────────── */

  function _renderFilters(total) {
    return (
      '<div class="clx-pt-filters">' +
        '<input class="clx-input clx-pt-search" type="text" id="clx-pt-search-input" ' +
          'placeholder="Search by name or ID…" value="' + _esc(_searchQuery) + '">' +
        '<select class="clx-select" id="clx-pt-filter-sex">' +
          '<option value="all"'     + (_filterSex==='all'     ?' selected':'') + '>All</option>' +
          '<option value="female"'  + (_filterSex==='female'  ?' selected':'') + '>Female</option>' +
          '<option value="male"'    + (_filterSex==='male'    ?' selected':'') + '>Male</option>' +
          '<option value="other"'   + (_filterSex==='other'   ?' selected':'') + '>Other</option>' +
          '<option value="unknown"' + (_filterSex==='unknown' ?' selected':'') + '>Unknown</option>' +
        '</select>' +
        '<select class="clx-select" id="clx-pt-filter-sort">' +
          '<option value="newest"' + (_sortOrder==='newest'?' selected':'') + '>Newest First</option>' +
          '<option value="oldest"' + (_sortOrder==='oldest'?' selected':'') + '>Oldest First</option>' +
        '</select>' +
        '<span class="clx-pt-count" id="clx-pt-count">' + total + ' patient' + (total !== 1 ? 's' : '') + '</span>' +
      '</div>'
    );
  }

  /* ── Full render ─────────────────────────────────────────── */

  function _render() {
    if (!_container) return;
    var patients = _getPatients();

    _container.innerHTML =
      '<div class="clx-pt-list-page">' +
        '<div class="clx-page-header">' +
          '<div>' +
            '<h1 class="clx-page-title">Patients</h1>' +
            '<p class="clx-page-subtitle">Patient records and clinical history</p>' +
          '</div>' +
          '<button class="clx-btn clx-btn-primary" onclick="Router.navigate(\'/patients/new\')">+ New Patient</button>' +
        '</div>' +
        _renderFilters(patients.length) +
        '<div id="clx-pt-table-container">' + _renderTable(patients) + '</div>' +
      '</div>';

    _bindEvents();
  }

  /* ── Refresh table only ──────────────────────────────────── */

  function _refreshTable() {
    var patients = _getPatients();
    var container = document.getElementById('clx-pt-table-container');
    if (container) container.innerHTML = _renderTable(patients);
    var countEl = document.getElementById('clx-pt-count');
    if (countEl) countEl.textContent = patients.length + ' patient' + (patients.length !== 1 ? 's' : '');
  }

  /* ── Bind filter events ──────────────────────────────────── */

  function _bindEvents() {
    var searchEl = document.getElementById('clx-pt-search-input');
    var sexEl    = document.getElementById('clx-pt-filter-sex');
    var sortEl   = document.getElementById('clx-pt-filter-sort');

    if (searchEl) {
      searchEl.addEventListener('input', function() {
        _searchQuery = searchEl.value;
        _refreshTable();
      });
    }
    if (sexEl) {
      sexEl.addEventListener('change', function() {
        _filterSex = sexEl.value;
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

  /* ══════════════════════════════════════════════════════════
     PUBLIC: View interface
  ══════════════════════════════════════════════════════════ */

  function mount(container) {
    _container   = container;
    _searchQuery = '';
    _filterSex   = 'all';
    _sortOrder   = 'newest';

    _render();

    _handlers.created  = function() { _refreshTable(); };
    _handlers.updated  = function() { _refreshTable(); };
    _handlers.deleted  = function() { _refreshTable(); };

    EventBus.on('patient:created', _handlers.created);
    EventBus.on('patient:updated', _handlers.updated);
    EventBus.on('patient:deleted', _handlers.deleted);
  }

  function unmount() {
    EventBus.off('patient:created', _handlers.created);
    EventBus.off('patient:updated', _handlers.updated);
    EventBus.off('patient:deleted', _handlers.deleted);
    _container = null;
    _handlers  = {};
  }

  return { mount: mount, unmount: unmount };

}());
