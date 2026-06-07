/* ════════════════════════════════════════════════════════════
   views/patient-form.js — Patient create / edit / detail view
   Clinstrux · Clinical Decision Infrastructure

   Routes:
     /patients/new    — create mode
     /patients/:id    — detail mode (read → inline edit toggle)

   Create mode:
     Section 1: Demographics (firstName, lastName, DOB, sex)
     Section 2: Clinical context (diagnoses, medications,
                allergies, notes)
     On save: PatientManager.createPatient() → /patients/:id

   Detail mode (same form, initially read-only):
     Shows all patient fields + linked cases panel
     Edit button → fields become editable inline
     On save: PatientManager.updatePatient()
     "Start Case" → /cases/new?patientId=:id

   Tag input pattern for array fields (diagnoses, medications,
   allergies): Enter or comma adds a tag; × removes it.
   Tags are rendered as dismissable pills. The underlying
   array is maintained in _formState and serialised on save.
════════════════════════════════════════════════════════════ */

var PatientFormView = (function () {

  var _container  = null;
  var _mode       = 'create';   /* 'create' | 'detail' | 'edit' */
  var _patientId  = null;
  var _formState  = {};
  var _handlers   = {};

  /* ── Helpers ─────────────────────────────────────────────── */

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _calcAge(dob) {
    if (!dob) return null;
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
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : isoDate;
  }

  /* ── Default blank form state ────────────────────────────── */

  function _blankState() {
    return {
      firstName:   '',
      lastName:    '',
      dateOfBirth: '',
      sex:         'unknown',
      diagnoses:   [],
      medications: [],
      allergies:   [],
      notes:       ''
    };
  }

  /* ── Populate form state from a patient record ───────────── */

  function _fromPatient(p) {
    return {
      firstName:   p.firstName   || '',
      lastName:    p.lastName    || '',
      dateOfBirth: p.dateOfBirth || '',
      sex:         p.sex         || 'unknown',
      diagnoses:   (p.diagnoses   || []).slice(),
      medications: (p.medications || []).slice(),
      allergies:   (p.allergies   || []).slice(),
      notes:       p.notes        || ''
    };
  }

  /* ── Read current field values from DOM into _formState ──── */

  function _readFormFromDom() {
    var f = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    _formState.firstName   = f('pf-first-name').trim();
    _formState.lastName    = f('pf-last-name').trim();
    _formState.dateOfBirth = f('pf-dob').trim();
    _formState.sex         = f('pf-sex');
    _formState.notes       = f('pf-notes').trim();
    /* Array fields are maintained live in _formState — no DOM read needed */
  }

  /* ── Tag pill HTML ───────────────────────────────────────── */

  function _renderTags(fieldName, tags, editable) {
    if (!tags || tags.length === 0) {
      return editable ? '' : '<span class="clx-pt-tag-empty">None recorded</span>';
    }
    return tags.map(function(tag, idx) {
      return (
        '<span class="clx-pt-tag">' +
          _esc(tag) +
          (editable
            ? '<button class="clx-pt-tag-remove" ' +
              'onclick="PatientFormView._removeTag(\'' + _esc(fieldName) + '\',' + idx + ')" ' +
              'type="button">×</button>'
            : '') +
        '</span>'
      );
    }).join('');
  }

  /* ── Tag input row HTML ──────────────────────────────────── */

  function _renderTagField(label, fieldName, tags, editable) {
    var tagsHtml = _renderTags(fieldName, tags, editable);
    if (!editable) {
      return (
        '<div class="clx-form-group">' +
          '<label class="clx-form-label">' + _esc(label) + '</label>' +
          '<div class="clx-pt-tag-list">' + (tagsHtml || '<span class="clx-pt-tag-empty">None recorded</span>') + '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="clx-form-group">' +
        '<label class="clx-form-label">' + _esc(label) + '</label>' +
        '<div class="clx-pt-tag-wrap">' +
          '<div class="clx-pt-tag-list" id="clx-pt-tags-' + fieldName + '">' + tagsHtml + '</div>' +
          '<div class="clx-pt-tag-input-row">' +
            '<input class="clx-input clx-pt-tag-input" type="text" ' +
              'id="clx-pt-tag-input-' + fieldName + '" ' +
              'placeholder="Type and press Enter or comma to add…" ' +
              'autocomplete="off">' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── Demographics section HTML ───────────────────────────── */

  function _renderDemographics(editable) {
    var s = _formState;
    var age = s.dateOfBirth ? _calcAge(s.dateOfBirth) : null;

    if (!editable) {
      /* Read-only display */
      return (
        '<div class="clx-pt-section">' +
          '<div class="clx-pt-section-title">Demographics</div>' +
          '<div class="clx-pt-detail-grid">' +
            '<div class="clx-pt-detail-item">' +
              '<div class="clx-pt-detail-label">First Name</div>' +
              '<div class="clx-pt-detail-value">' + _esc(s.firstName || '—') + '</div>' +
            '</div>' +
            '<div class="clx-pt-detail-item">' +
              '<div class="clx-pt-detail-label">Last Name</div>' +
              '<div class="clx-pt-detail-value">' + _esc(s.lastName || '—') + '</div>' +
            '</div>' +
            '<div class="clx-pt-detail-item">' +
              '<div class="clx-pt-detail-label">Date of Birth</div>' +
              '<div class="clx-pt-detail-value">' +
                _formatDob(s.dateOfBirth) +
                (age !== null ? ' <span class="clx-pt-age-badge">Age ' + age + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="clx-pt-detail-item">' +
              '<div class="clx-pt-detail-label">Sex</div>' +
              '<div class="clx-pt-detail-value">' + _esc(_sexLabel(s.sex)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    /* Editable */
    return (
      '<div class="clx-pt-section">' +
        '<div class="clx-pt-section-title">Demographics</div>' +
        '<div class="clx-form-row">' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="pf-first-name">First Name <span class="clx-required">*</span></label>' +
            '<input class="clx-input" type="text" id="pf-first-name" value="' + _esc(s.firstName) + '" maxlength="100">' +
            '<div class="clx-field-error" id="err-first-name"></div>' +
          '</div>' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="pf-last-name">Last Name <span class="clx-required">*</span></label>' +
            '<input class="clx-input" type="text" id="pf-last-name" value="' + _esc(s.lastName) + '" maxlength="100">' +
            '<div class="clx-field-error" id="err-last-name"></div>' +
          '</div>' +
        '</div>' +
        '<div class="clx-form-row">' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="pf-dob">Date of Birth <span class="clx-required">*</span></label>' +
            '<input class="clx-input" type="date" id="pf-dob" value="' + _esc(s.dateOfBirth) + '">' +
            '<div class="clx-field-error" id="err-dob"></div>' +
          '</div>' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="pf-sex">Sex <span class="clx-required">*</span></label>' +
            '<select class="clx-select clx-input" id="pf-sex">' +
              '<option value="female"'  + (s.sex==='female'  ?' selected':'') + '>Female</option>' +
              '<option value="male"'    + (s.sex==='male'    ?' selected':'') + '>Male</option>' +
              '<option value="other"'   + (s.sex==='other'   ?' selected':'') + '>Other</option>' +
              '<option value="unknown"' + (s.sex==='unknown' ?' selected':'') + '>Unknown / Not stated</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _sexLabel(sex) {
    var map = { male:'Male', female:'Female', other:'Other', unknown:'Unknown / Not stated' };
    return map[sex] || sex;
  }

  /* ── Clinical context section HTML ──────────────────────── */

  function _renderClinicalContext(editable) {
    var s = _formState;
    return (
      '<div class="clx-pt-section">' +
        '<div class="clx-pt-section-title">Clinical Context</div>' +
        _renderTagField('Diagnoses',   'diagnoses',   s.diagnoses,   editable) +
        _renderTagField('Medications', 'medications', s.medications, editable) +
        _renderTagField('Allergies',   'allergies',   s.allergies,   editable) +
        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="pf-notes">Notes <span class="clx-optional">(optional)</span></label>' +
          (editable
            ? '<textarea class="clx-input clx-textarea" id="pf-notes" rows="3" maxlength="1000">' + _esc(s.notes) + '</textarea>'
            : '<div class="clx-pt-detail-value">' + (s.notes ? _esc(s.notes) : '<span class="clx-pt-tag-empty">None</span>') + '</div>') +
        '</div>' +
      '</div>'
    );
  }

  /* ── Linked cases panel ──────────────────────────────────── */

  function _renderLinkedCases(patientId) {
    var cases = CaseManager.listCases().filter(function(c) {
      return c.patientId === patientId;
    });

    var caseRows = cases.length === 0
      ? '<div class="clx-pt-no-cases">No cases for this patient. <a class="clx-pt-start-case-link" onclick="Router.navigate(\'/cases/new?patientId=' + patientId + '\'); return false;" href="#">Start one →</a></div>'
      : cases.map(function(c) {
          var entry  = WorkflowRegistry.get(c.workflow.workflowId);
          var wfLabel = entry ? entry.label : c.workflow.workflowId;
          var statusLabels = { draft:'Draft', in_progress:'In Progress', complete:'Complete', archived:'Archived' };
          return (
            '<div class="clx-pt-case-row" onclick="Router.navigate(\'/cases/' + c.id + '\')">' +
              '<div class="clx-pt-case-row-info">' +
                '<div class="clx-pt-case-row-ref">' + _esc(c.reference) + '</div>' +
                '<div class="clx-pt-case-row-wf">' + _esc(wfLabel) + '</div>' +
              '</div>' +
              '<span class="clx-status-pill clx-status-' + c.status + '">' + (statusLabels[c.status] || c.status) + '</span>' +
            '</div>'
          );
        }).join('');

    return (
      '<div class="clx-pt-section clx-pt-cases-section">' +
        '<div class="clx-pt-section-header">' +
          '<div class="clx-pt-section-title">Cases</div>' +
          '<button class="clx-btn clx-btn-secondary clx-btn-sm" ' +
            'onclick="Router.navigate(\'/cases/new?patientId=' + patientId + '\')">+ New Case</button>' +
        '</div>' +
        '<div class="clx-pt-case-list">' + caseRows + '</div>' +
      '</div>'
    );
  }

  /* ── Page header HTML ────────────────────────────────────── */

  function _renderPageHeader(patient) {
    var isCreate = (_mode === 'create');
    var isEdit   = (_mode === 'edit');

    var title = isCreate ? 'New Patient'
               : (patient ? patient.firstName + ' ' + patient.lastName : 'Patient');
    var subtitle = isCreate ? 'Create a new patient record'
                 : (patient ? patient.patientId : '');

    var actions = isCreate ? '' :
      (isEdit
        ? '<button class="clx-btn clx-btn-ghost" id="pf-cancel-btn">Cancel</button>'
        : '<button class="clx-btn clx-btn-secondary" id="pf-edit-btn">Edit</button>');

    return (
      '<div class="clx-page-header">' +
        '<div class="clx-pt-header-left">' +
          '<button class="clx-pt-back-btn" onclick="Router.navigate(\'/patients\')">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
              '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
            '</svg>' +
            'Patients' +
          '</button>' +
          '<h1 class="clx-page-title">' + _esc(title) + '</h1>' +
          '<p class="clx-page-subtitle">' + _esc(subtitle) + '</p>' +
        '</div>' +
        '<div class="clx-pt-header-actions">' + actions + '</div>' +
      '</div>'
    );
  }

  /* ── Validation ──────────────────────────────────────────── */

  function _validate() {
    var ok = true;
    var clearErr = function(id) { var el = document.getElementById(id); if (el) el.textContent = ''; };
    var setErr   = function(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg; ok = false; };

    clearErr('err-first-name'); clearErr('err-last-name'); clearErr('err-dob');

    if (!_formState.firstName.trim()) setErr('err-first-name', 'First name is required.');
    if (!_formState.lastName.trim())  setErr('err-last-name',  'Last name is required.');

    if (!_formState.dateOfBirth) {
      setErr('err-dob', 'Date of birth is required.');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(_formState.dateOfBirth)) {
      setErr('err-dob', 'Use YYYY-MM-DD format.');
    }

    return ok;
  }

  /* ── Full render ─────────────────────────────────────────── */

  function _render() {
    if (!_container) return;

    var patient  = _patientId ? PatientManager.getPatient(_patientId) : null;
    var editable = (_mode === 'create' || _mode === 'edit');

    var formContent =
      _renderDemographics(editable) +
      _renderClinicalContext(editable);

    var saveBtn = editable
      ? '<div class="clx-pt-form-actions">' +
          '<button class="clx-btn clx-btn-secondary" id="pf-cancel-save-btn">' +
            (_mode === 'create' ? 'Cancel' : 'Discard Changes') +
          '</button>' +
          '<button class="clx-btn clx-btn-primary" id="pf-save-btn">' +
            (_mode === 'create' ? 'Create Patient' : 'Save Changes') +
          '</button>' +
        '</div>'
      : '';

    _container.innerHTML =
      '<div class="clx-pt-form-page">' +
        _renderPageHeader(patient) +
        '<div class="clx-pt-form-body">' +
          '<div class="clx-pt-form-main">' +
            '<div class="clx-pt-form-card">' +
              formContent +
              saveBtn +
            '</div>' +
          '</div>' +
          (_mode !== 'create' && _patientId
            ? '<div class="clx-pt-form-side">' + _renderLinkedCases(_patientId) + '</div>'
            : '') +
        '</div>' +
      '</div>';

    _bindFormEvents();
  }

  /* ── Event binding ───────────────────────────────────────── */

  function _bindFormEvents() {
    /* Edit button (detail mode) */
    var editBtn = document.getElementById('pf-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        _mode = 'edit';
        _render();
      });
    }

    /* Cancel edit */
    var cancelBtn = document.getElementById('pf-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        _mode = 'detail';
        /* Reset form state to saved patient */
        var patient = PatientManager.getPatient(_patientId);
        if (patient) _formState = _fromPatient(patient);
        _render();
      });
    }

    /* Cancel create */
    var cancelSaveBtn = document.getElementById('pf-cancel-save-btn');
    if (cancelSaveBtn) {
      cancelSaveBtn.addEventListener('click', function() {
        if (_mode === 'create') {
          Router.navigate('/patients');
        } else {
          _mode = 'detail';
          var patient = PatientManager.getPatient(_patientId);
          if (patient) _formState = _fromPatient(patient);
          _render();
        }
      });
    }

    /* Save button */
    var saveBtn = document.getElementById('pf-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        _readFormFromDom();
        if (!_validate()) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
          if (_mode === 'create') {
            var newPatient = PatientManager.createPatient(_formState);
            Router.navigate('/patients/' + newPatient.patientId);
          } else {
            PatientManager.updatePatient(_patientId, _formState);
            _mode = 'detail';
            var updated = PatientManager.getPatient(_patientId);
            if (updated) _formState = _fromPatient(updated);
            _render();
          }
        } catch (err) {
          console.error('[PatientFormView] save failed:', err);
          saveBtn.disabled = false;
          saveBtn.textContent = _mode === 'create' ? 'Create Patient' : 'Save Changes';
          var errEl = document.getElementById('err-first-name');
          if (errEl) errEl.textContent = 'Save failed: ' + err.message;
        }
      });
    }

    /* Tag inputs */
    ['diagnoses', 'medications', 'allergies'].forEach(function(field) {
      var inputEl = document.getElementById('clx-pt-tag-input-' + field);
      if (!inputEl) return;
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          _addTag(field, inputEl.value);
          inputEl.value = '';
        }
      });
      inputEl.addEventListener('blur', function() {
        if (inputEl.value.trim()) {
          _addTag(field, inputEl.value);
          inputEl.value = '';
        }
      });
    });
  }

  /* ── Tag management ──────────────────────────────────────── */

  function _addTag(field, value) {
    var val = value.replace(/,/g, '').trim();
    if (!val) return;
    if (_formState[field].indexOf(val) !== -1) return; /* no duplicates */
    _formState[field] = _formState[field].concat(val);
    _refreshTagList(field);
  }

  function _removeTag(field, idx) {
    _formState[field] = _formState[field].filter(function(_, i) { return i !== idx; });
    _refreshTagList(field);
  }

  function _refreshTagList(field) {
    var el = document.getElementById('clx-pt-tags-' + field);
    if (!el) return;
    el.innerHTML = _renderTags(field, _formState[field], true);
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC: View interface
  ══════════════════════════════════════════════════════════ */

  function mount(container, params) {
    _container = container;

    var id = params && params.id;

    if (!id) {
      /* Create mode */
      _mode      = 'create';
      _patientId = null;
      _formState = _blankState();
      _render();
      return;
    }

    /* Detail mode — validate patient exists */
    var patient = PatientManager.getPatient(id);
    if (!patient) {
      /* 404 */
      _container.innerHTML =
        '<div class="clx-not-found">' +
          '<div class="clx-not-found-code">404</div>' +
          '<div class="clx-not-found-msg">Patient not found</div>' +
          '<div class="clx-not-found-path">' + _esc(id) + '</div>' +
          '<button class="clx-btn clx-btn-secondary" onclick="Router.navigate(\'/patients\')">← Patients</button>' +
        '</div>';
      return;
    }

    _mode      = 'detail';
    _patientId = id;
    _formState = _fromPatient(patient);
    _render();

    /* Subscribe to updates so detail view refreshes if another tab edits */
    _handlers.updated = function(payload) {
      if (payload && payload.patientId === _patientId && _mode === 'detail') {
        var refreshed = PatientManager.getPatient(_patientId);
        if (refreshed) { _formState = _fromPatient(refreshed); _render(); }
      }
    };
    EventBus.on('patient:updated', _handlers.updated);
  }

  function unmount() {
    if (_handlers.updated) {
      EventBus.off('patient:updated', _handlers.updated);
    }
    _container = null;
    _handlers  = {};
    _mode      = 'create';
    _patientId = null;
    _formState = {};
  }

  return {
    mount:       mount,
    unmount:     unmount,
    _removeTag:  _removeTag,   /* exposed for inline onclick */
    _addTag:     _addTag
  };

}());
