/* ════════════════════════════════════════════════════════════
   views/new-case.js — New Case creation flow
   Clinstrux · Clinical Decision Infrastructure

   Three entry paths, all converging on Step 2 (workflow
   selector) then case creation:

   PATH A — Anonymous (existing behaviour, no query params):
     Step 1: Manual patient form (identifier, age, setting,
             referral source, clinical context)
     Step 2: Workflow selector
     Creates case with patientId = null.

   PATH B — Linked patient (?patientId=pt_xxx):
     Step 1 replaced by: Patient confirmation card showing
             the full PatientManager record. Pharmacist
             reviews and confirms (or goes back to patients).
     Step 2: Workflow selector
     Creates case with patientId = pt_xxx and
             patient.* populated from PatientManager record.

   PATH C — Pre-selected workflow (?workflow=oa|abx|poly):
     Skips to Step 2 directly (existing Phase 2 behaviour).
     Can be combined with ?patientId.

   Backward compatibility:
     All existing two-argument CaseManager.createCase() calls
     remain valid. The third argument (patientId) is new and
     optional. No other file is affected.
════════════════════════════════════════════════════════════ */

var NewCaseView = (function() {

  var _container        = null;
  var _step             = 1;
  var _patientData      = {};      /* always populated before step 2  */
  var _linkedPatientId  = null;    /* set when ?patientId= param given */
  var _linkedPatient    = null;    /* PatientManager record, or null   */
  var _selectedWorkflow = null;

  /* ── HTML escape ─────────────────────────────────────────── */

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Age from DOB ────────────────────────────────────────── */

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
    var p = isoDate.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : isoDate;
  }

  /* ── Step indicator ──────────────────────────────────────── */

  function _renderStepper() {
    var label1 = _linkedPatient ? 'Confirm Patient' : 'Patient Context';
    return (
      '<div class="clx-stepper">' +
        '<div class="clx-step ' + (_step === 1 ? 'clx-step-active' : 'clx-step-done') + '">' +
          '<div class="clx-step-num">' + (_step > 1 ? '✓' : '1') + '</div>' +
          '<div class="clx-step-label">' + label1 + '</div>' +
        '</div>' +
        '<div class="clx-step-connector"></div>' +
        '<div class="clx-step ' + (_step === 2 ? 'clx-step-active' : '') + '">' +
          '<div class="clx-step-num">2</div>' +
          '<div class="clx-step-label">Select Workflow</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     STEP 1A — ANONYMOUS PATIENT FORM (Path A)
     Unchanged from Phase 2. Shows when no patientId param.
  ══════════════════════════════════════════════════════════ */

  function _renderStep1Anonymous() {
    return (
      '<div class="clx-new-case-step" id="clx-step1">' +

        '<div class="clx-notice clx-notice-info">' +
          '<strong>Demo notice:</strong> Do not enter real patient names, NHS numbers, ' +
          'or identifiable clinical data. Use reference codes only (e.g. "Patient A", "Ref XJ-447").' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-identifier">' +
            'Patient Reference <span class="clx-required">*</span></label>' +
          '<input class="clx-input" type="text" id="nc-identifier" ' +
            'placeholder="e.g. Patient A or Ref XJ-447" ' +
            'value="' + _esc(_patientData.identifier || '') + '" maxlength="100"/>' +
          '<div class="clx-field-error" id="err-identifier"></div>' +
        '</div>' +

        '<div class="clx-form-row">' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="nc-age">' +
              'Age (years) <span class="clx-required">*</span></label>' +
            '<input class="clx-input" type="number" id="nc-age" ' +
              'placeholder="e.g. 68" min="18" max="120" ' +
              'value="' + _esc(_patientData.age || '') + '"/>' +
            '<div class="clx-field-error" id="err-age"></div>' +
          '</div>' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="nc-setting">' +
              'Clinical Setting <span class="clx-required">*</span></label>' +
            '<select class="clx-select clx-input" id="nc-setting">' +
              _settingOptions() +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-referral">' +
            'Referral Source <span class="clx-optional">(optional)</span></label>' +
          '<input class="clx-input" type="text" id="nc-referral" ' +
            'placeholder="e.g. GP referral, Ward round" ' +
            'value="' + _esc(_patientData.referralSource || '') + '" maxlength="200"/>' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-context">' +
            'Clinical Context <span class="clx-optional">(optional)</span></label>' +
          '<textarea class="clx-input clx-textarea" id="nc-context" ' +
            'placeholder="Brief case summary or relevant background" ' +
            'rows="3" maxlength="500">' + _esc(_patientData.clinicalContext || '') + '</textarea>' +
        '</div>' +

        '<div class="clx-form-actions">' +
          '<button class="clx-btn clx-btn-secondary" ' +
            'onclick="Router.navigate(\'/cases\')">Cancel</button>' +
          '<button class="clx-btn clx-btn-primary" id="nc-continue-btn">Continue →</button>' +
        '</div>' +

      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     STEP 1B — LINKED PATIENT CONFIRMATION CARD (Path B)
     Shown when ?patientId=pt_xxx is in the URL.
     Displays the full PatientManager record so the
     pharmacist can confirm before selecting a workflow.
  ══════════════════════════════════════════════════════════ */

  function _renderStep1LinkedPatient() {
    var p   = _linkedPatient;
    var age = p.dateOfBirth ? _calcAge(p.dateOfBirth) : null;

    /* Diagnoses / medications / allergies pill lists */
    function pills(arr) {
      if (!arr || arr.length === 0) return '<span class="clx-nc-pill-empty">None recorded</span>';
      return arr.map(function(v) {
        return '<span class="clx-nc-pill">' + _esc(v) + '</span>';
      }).join('');
    }

    return (
      '<div class="clx-new-case-step" id="clx-step1">' +

        /* Patient identity card */
        '<div class="clx-nc-patient-card">' +
          '<div class="clx-nc-patient-card-header">' +
            '<div class="clx-nc-patient-card-icon">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
                   'stroke="currentColor" stroke-width="1.8">' +
                '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
                '<circle cx="12" cy="7" r="4"/>' +
              '</svg>' +
            '</div>' +
            '<div>' +
              '<div class="clx-nc-patient-name">' +
                _esc(p.firstName) + ' ' + _esc(p.lastName) +
              '</div>' +
              '<div class="clx-nc-patient-meta">' +
                (age !== null ? age + ' yrs · ' : '') +
                _esc(p.dateOfBirth ? _formatDob(p.dateOfBirth) : '') +
                ' · ' + _esc(_sexLabel(p.sex)) +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="clx-nc-patient-card-body">' +
            '<div class="clx-nc-patient-field">' +
              '<div class="clx-nc-field-label">Diagnoses</div>' +
              '<div class="clx-nc-field-pills">' + pills(p.diagnoses) + '</div>' +
            '</div>' +
            '<div class="clx-nc-patient-field">' +
              '<div class="clx-nc-field-label">Medications</div>' +
              '<div class="clx-nc-field-pills">' + pills(p.medications) + '</div>' +
            '</div>' +
            '<div class="clx-nc-patient-field">' +
              '<div class="clx-nc-field-label">Allergies</div>' +
              '<div class="clx-nc-field-pills">' + pills(p.allergies) + '</div>' +
            '</div>' +
            (p.notes
              ? '<div class="clx-nc-patient-field">' +
                  '<div class="clx-nc-field-label">Notes</div>' +
                  '<div class="clx-nc-field-notes">' + _esc(p.notes) + '</div>' +
                '</div>'
              : '') +
          '</div>' +
        '</div>' +

        /* Setting selector — still required even for linked patients */
        '<div class="clx-form-group clx-nc-setting-group">' +
          '<label class="clx-form-label" for="nc-setting">' +
            'Clinical Setting <span class="clx-required">*</span></label>' +
          '<select class="clx-select clx-input" id="nc-setting">' +
            _settingOptions() +
          '</select>' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-context">' +
            'Clinical Context <span class="clx-optional">(optional)</span></label>' +
          '<textarea class="clx-input clx-textarea" id="nc-context" ' +
            'rows="2" maxlength="500" ' +
            'placeholder="Referral reason or brief clinical summary…">' +
            _esc(_patientData.clinicalContext || '') +
          '</textarea>' +
        '</div>' +

        '<div class="clx-form-actions">' +
          '<button class="clx-btn clx-btn-secondary" ' +
            'onclick="Router.navigate(\'/patients/' + _linkedPatientId + '\')">← Back to Patient</button>' +
          '<button class="clx-btn clx-btn-primary" id="nc-continue-btn">Continue →</button>' +
        '</div>' +

      '</div>'
    );
  }

  function _sexLabel(sex) {
    var map = { male:'Male', female:'Female', other:'Other', unknown:'Unknown' };
    return map[sex] || sex || '';
  }

  function _settingOptions() {
    var settings = [
      { val:'outpatient',       label:'Outpatient'       },
      { val:'inpatient',        label:'Inpatient'        },
      { val:'community',        label:'Community'        },
      { val:'residential_care', label:'Residential Care' },
      { val:'telehealth',       label:'Telehealth'       }
    ];
    return settings.map(function(s) {
      var sel = (_patientData.setting === s.val) ? ' selected' : '';
      if (!_patientData.setting && s.val === 'outpatient') sel = ' selected';
      return '<option value="' + s.val + '"' + sel + '>' + s.label + '</option>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     STEP 2 — WORKFLOW SELECTOR (all paths)
  ══════════════════════════════════════════════════════════ */

  function _renderStep2() {
    var workflows = WorkflowRegistry.getAll();

    var tiles = workflows.map(function(entry) {
      var selected = _selectedWorkflow === entry.id;
      return (
        '<div class="clx-workflow-selector-tile ' + (selected ? 'clx-tile-selected' : '') + '" ' +
          'data-workflow-id="' + entry.id + '" id="clx-tile-' + entry.id + '">' +
          '<div class="clx-wf-tile-header">' +
            '<span class="clx-wf-tile-badge clx-wf-' + entry.id + '">' +
              entry.id.toUpperCase() +
            '</span>' +
          '</div>' +
          '<div class="clx-wf-tile-label">'    + _esc(entry.label)          + '</div>' +
          '<div class="clx-wf-tile-category">' + _esc(entry.category)       + '</div>' +
          '<div class="clx-wf-tile-guideline">'+ _esc(entry.guidelineSource) + '</div>' +
        '</div>'
      );
    }).join('');

    /* Patient summary banner — rich when linked, simple when anonymous */
    var bannerContent;
    if (_linkedPatient) {
      bannerContent =
        '<span class="clx-patient-summary-label">Patient:</span> ' +
        _esc(_linkedPatient.firstName + ' ' + _linkedPatient.lastName) +
        ((_linkedPatient.dateOfBirth && _calcAge(_linkedPatient.dateOfBirth) !== null)
          ? ' · ' + _calcAge(_linkedPatient.dateOfBirth) + ' yrs'
          : '') +
        ' · ' + _esc(_patientData.setting || 'outpatient') +
        ' <span class="clx-nc-linked-badge">Linked</span>';
    } else {
      bannerContent =
        '<span class="clx-patient-summary-label">Patient:</span> ' +
        _esc(_patientData.identifier) +
        ' · ' + _esc(_patientData.age) + ' yrs' +
        ' · ' + _esc(_patientData.setting);
    }

    return (
      '<div class="clx-new-case-step" id="clx-step2">' +
        '<div class="clx-form-group">' +
          '<label class="clx-form-label">' +
            'Select Clinical Workflow <span class="clx-required">*</span></label>' +
          '<div class="clx-field-error" id="err-workflow"></div>' +
          '<div class="clx-workflow-selector-grid">' + tiles + '</div>' +
        '</div>' +
        '<div class="clx-patient-summary-banner">' + bannerContent + '</div>' +
        '<div class="clx-form-actions">' +
          '<button class="clx-btn clx-btn-secondary" id="nc-back-btn">← Back</button>' +
          '<button class="clx-btn clx-btn-primary" id="nc-start-btn">Start Case →</button>' +
        '</div>' +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     VALIDATION
  ══════════════════════════════════════════════════════════ */

  function _validateStep1Anonymous() {
    var ok       = true;
    var idEl     = document.getElementById('nc-identifier');
    var ageEl    = document.getElementById('nc-age');
    var errId    = document.getElementById('err-identifier');
    var errAge   = document.getElementById('err-age');

    if (errId)  errId.textContent  = '';
    if (errAge) errAge.textContent = '';

    if (!idEl || !idEl.value.trim()) {
      if (errId) errId.textContent = 'Patient reference is required.';
      ok = false;
    }
    var ageVal = parseInt(ageEl ? ageEl.value : '', 10);
    if (!ageEl || !ageEl.value || isNaN(ageVal) || ageVal < 18 || ageVal > 120) {
      if (errAge) errAge.textContent = 'A valid age (18–120) is required.';
      ok = false;
    }

    if (ok) {
      _patientData.identifier     = idEl.value.trim();
      _patientData.age            = ageVal;
      _patientData.setting        = (document.getElementById('nc-setting') || {}).value || 'outpatient';
      _patientData.referralSource = (document.getElementById('nc-referral') || {}).value || '';
      _patientData.clinicalContext= (document.getElementById('nc-context')  || {}).value || '';
    }
    return ok;
  }

  function _validateStep1Linked() {
    /* For a linked patient the name/age come from PatientManager.
       Only setting (always valid — has a default) and optional
       context need reading from the DOM.                        */
    _patientData.identifier     = _linkedPatient.firstName + ' ' + _linkedPatient.lastName;
    _patientData.age            = _calcAge(_linkedPatient.dateOfBirth) || 0;
    _patientData.setting        = (document.getElementById('nc-setting') || {}).value || 'outpatient';
    _patientData.referralSource = '';
    _patientData.clinicalContext= (document.getElementById('nc-context') || {}).value || '';
    return true;  /* always valid — PatientManager record already validated */
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */

  function _render() {
    if (!_container) return;

    var stepContent;
    if (_step === 1) {
      stepContent = _linkedPatient ? _renderStep1LinkedPatient() : _renderStep1Anonymous();
    } else {
      stepContent = _renderStep2();
    }

    _container.innerHTML =
      '<div class="clx-new-case">' +
        '<div class="clx-page-header">' +
          '<div>' +
            '<h1 class="clx-page-title">New Case</h1>' +
            '<p class="clx-page-subtitle">' +
              (_linkedPatient
                ? 'New case for ' + _esc(_linkedPatient.firstName + ' ' + _linkedPatient.lastName)
                : 'Set up a new clinical review case') +
            '</p>' +
          '</div>' +
        '</div>' +
        _renderStepper() +
        '<div class="clx-new-case-body">' + stepContent + '</div>' +
      '</div>';

    _bindStepEvents();
  }

  /* ══════════════════════════════════════════════════════════
     EVENT BINDING
  ══════════════════════════════════════════════════════════ */

  function _bindStepEvents() {
    if (_step === 1) {
      var continueBtn = document.getElementById('nc-continue-btn');
      if (continueBtn) {
        continueBtn.addEventListener('click', function() {
          var valid = _linkedPatient
            ? _validateStep1Linked()
            : _validateStep1Anonymous();
          if (valid) { _step = 2; _render(); }
        });
      }

      /* Enter key on text inputs (anonymous path only) */
      if (!_linkedPatient) {
        var inputs = document.querySelectorAll('#clx-step1 .clx-input');
        for (var i = 0; i < inputs.length; i++) {
          inputs[i].addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
              if (_validateStep1Anonymous()) { _step = 2; _render(); }
            }
          });
        }
      }
      return;
    }

    if (_step === 2) {
      /* Tile selection */
      var tiles = document.querySelectorAll('.clx-workflow-selector-tile');
      for (var j = 0; j < tiles.length; j++) {
        (function(tile) {
          tile.addEventListener('click', function() {
            _selectedWorkflow = tile.getAttribute('data-workflow-id');
            var all = document.querySelectorAll('.clx-workflow-selector-tile');
            for (var k = 0; k < all.length; k++) all[k].classList.remove('clx-tile-selected');
            tile.classList.add('clx-tile-selected');
            var errWf = document.getElementById('err-workflow');
            if (errWf) errWf.textContent = '';
          });
        })(tiles[j]);
      }

      /* Back */
      var backBtn = document.getElementById('nc-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', function() { _step = 1; _render(); });
      }

      /* Start Case */
      var startBtn = document.getElementById('nc-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', function() {
          var errWf = document.getElementById('err-workflow');
          if (!_selectedWorkflow) {
            if (errWf) errWf.textContent = 'Please select a workflow to continue.';
            return;
          }
          startBtn.disabled    = true;
          startBtn.textContent = 'Creating…';

          try {
            /* Pass patientId as third argument — null when anonymous */
            var newCase = CaseManager.createCase(
              _patientData,
              _selectedWorkflow,
              _linkedPatientId
            );
            Router.navigate('/cases/' + newCase.id);
          } catch (err) {
            console.error('[NewCaseView] createCase failed:', err);
            startBtn.disabled    = false;
            startBtn.textContent = 'Start Case →';
            if (errWf) errWf.textContent = 'Failed to create case. Please try again.';
          }
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC: View interface
  ══════════════════════════════════════════════════════════ */

  function mount(container, params) {
    _container        = container;
    _step             = 1;
    _patientData      = {};
    _selectedWorkflow = null;
    _linkedPatientId  = null;
    _linkedPatient    = null;

    var query = params && params.query ? params.query : {};

    /* Path B: ?patientId=pt_xxx — load from PatientManager */
    if (query.patientId) {
      var pt = PatientManager.getPatient(query.patientId);
      if (pt) {
        _linkedPatientId = query.patientId;
        _linkedPatient   = pt;
        /* Pre-populate patientData from the record */
        _patientData.identifier     = pt.firstName + ' ' + pt.lastName;
        _patientData.age            = _calcAge(pt.dateOfBirth) || 0;
        _patientData.setting        = 'outpatient';
        _patientData.referralSource = '';
        _patientData.clinicalContext= '';
      }
      /* If PatientManager.getPatient returns null (stale ID), fall through
         to anonymous path — graceful degradation.                          */
    }

    /* Path C: ?workflow=oa|abx|poly — pre-select and skip to step 2 */
    var preselect = query.workflow;
    if (preselect && WorkflowRegistry.get(preselect)) {
      _selectedWorkflow = preselect;
      /* If we have a linked patient, validate their data first before
         jumping to step 2 so _patientData is populated correctly.    */
      if (_linkedPatient) {
        _validateStep1Linked();
      }
      _step = 2;
    }

    _render();
  }

  function unmount() {
    _container        = null;
    _step             = 1;
    _patientData      = {};
    _selectedWorkflow = null;
    _linkedPatientId  = null;
    _linkedPatient    = null;
  }

  return { mount: mount, unmount: unmount };

}());
