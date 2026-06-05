/* ════════════════════════════════════════════════════════════
   views/new-case.js — New Case creation flow
   Clinstrux · Clinical Decision Infrastructure

   Two-step form flow:
     Step 1: Patient context (identifier, age, setting,
             referral source, clinical context)
     Step 2: Workflow selector (OA / ABX / Poly tiles)

   Query param ?workflow=oa|abx|poly pre-selects the workflow
   and advances focus to Step 2 automatically.

   On Start Case: calls CaseManager.createCase() then
   navigates to Router.navigate('/cases/:id') [Phase 3: 404].

   PHI notice is shown on Step 1 per architecture constraint.
════════════════════════════════════════════════════════════ */

var NewCaseView = (function() {

  var _container       = null;
  var _step            = 1;
  var _patientData     = {};
  var _selectedWorkflow = null;

  /* ── HTML escape ────────────────────────────────────────────  */

  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Step indicator ─────────────────────────────────────────  */

  function _renderStepper() {
    return (
      '<div class="clx-stepper">' +
        '<div class="clx-step ' + (_step === 1 ? 'clx-step-active' : 'clx-step-done') + '">' +
          '<div class="clx-step-num">' + (_step > 1 ? '✓' : '1') + '</div>' +
          '<div class="clx-step-label">Patient Context</div>' +
        '</div>' +
        '<div class="clx-step-connector"></div>' +
        '<div class="clx-step ' + (_step === 2 ? 'clx-step-active' : '') + '">' +
          '<div class="clx-step-num">2</div>' +
          '<div class="clx-step-label">Select Workflow</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── Step 1: Patient context form ───────────────────────────  */

  function _renderStep1() {
    return (
      '<div class="clx-new-case-step" id="clx-step1">' +

        '<div class="clx-notice clx-notice-info">' +
          '<strong>Demo notice:</strong> Do not enter real patient names, NHS numbers, or identifiable clinical data. Use reference codes only (e.g. "Patient A", "Ref XJ-447").' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-identifier">Patient Reference <span class="clx-required">*</span></label>' +
          '<input class="clx-input" type="text" id="nc-identifier" placeholder="e.g. Patient A or Ref XJ-447" value="' + _esc(_patientData.identifier || '') + '" maxlength="100"/>' +
          '<div class="clx-field-error" id="err-identifier"></div>' +
        '</div>' +

        '<div class="clx-form-row">' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="nc-age">Age (years) <span class="clx-required">*</span></label>' +
            '<input class="clx-input" type="number" id="nc-age" placeholder="e.g. 68" min="18" max="120" value="' + _esc(_patientData.age || '') + '"/>' +
            '<div class="clx-field-error" id="err-age"></div>' +
          '</div>' +
          '<div class="clx-form-group clx-form-group-half">' +
            '<label class="clx-form-label" for="nc-setting">Clinical Setting <span class="clx-required">*</span></label>' +
            '<select class="clx-select clx-input" id="nc-setting">' +
              _settingOptions() +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-referral">Referral Source <span class="clx-optional">(optional)</span></label>' +
          '<input class="clx-input" type="text" id="nc-referral" placeholder="e.g. GP referral, Ward round" value="' + _esc(_patientData.referralSource || '') + '" maxlength="200"/>' +
        '</div>' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label" for="nc-context">Clinical Context <span class="clx-optional">(optional)</span></label>' +
          '<textarea class="clx-input clx-textarea" id="nc-context" placeholder="Brief case summary or relevant background" rows="3" maxlength="500">' + _esc(_patientData.clinicalContext || '') + '</textarea>' +
        '</div>' +

        '<div class="clx-form-actions">' +
          '<button class="clx-btn clx-btn-secondary" onclick="Router.navigate(\'/cases\')">Cancel</button>' +
          '<button class="clx-btn clx-btn-primary" id="nc-continue-btn">Continue →</button>' +
        '</div>' +

      '</div>'
    );
  }

  function _settingOptions() {
    var settings = [
      { val: 'outpatient',       label: 'Outpatient'       },
      { val: 'inpatient',        label: 'Inpatient'        },
      { val: 'community',        label: 'Community'        },
      { val: 'residential_care', label: 'Residential Care' },
      { val: 'telehealth',       label: 'Telehealth'       }
    ];
    return settings.map(function(s) {
      var sel = (_patientData.setting === s.val) ? ' selected' : '';
      if (!_patientData.setting && s.val === 'outpatient') sel = ' selected';
      return '<option value="' + s.val + '"' + sel + '>' + s.label + '</option>';
    }).join('');
  }

  /* ── Step 2: Workflow selector ──────────────────────────────  */

  function _renderStep2() {
    var workflows = WorkflowRegistry.getAll();

    var tiles = workflows.map(function(entry) {
      var selected = _selectedWorkflow === entry.id;
      return (
        '<div class="clx-workflow-selector-tile ' + (selected ? 'clx-tile-selected' : '') + '" ' +
             'data-workflow-id="' + entry.id + '" ' +
             'id="clx-tile-' + entry.id + '">' +
          '<div class="clx-wf-tile-header">' +
            '<span class="clx-wf-tile-badge clx-wf-' + entry.id + '">' + entry.id.toUpperCase() + '</span>' +
          '</div>' +
          '<div class="clx-wf-tile-label">' + _esc(entry.label) + '</div>' +
          '<div class="clx-wf-tile-category">' + _esc(entry.category) + '</div>' +
          '<div class="clx-wf-tile-guideline">' + _esc(entry.guidelineSource) + '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="clx-new-case-step" id="clx-step2">' +

        '<div class="clx-form-group">' +
          '<label class="clx-form-label">Select Clinical Workflow <span class="clx-required">*</span></label>' +
          '<div class="clx-field-error" id="err-workflow"></div>' +
          '<div class="clx-workflow-selector-grid">' + tiles + '</div>' +
        '</div>' +

        '<div class="clx-patient-summary-banner">' +
          '<span class="clx-patient-summary-label">Patient:</span> ' +
          _esc(_patientData.identifier) +
          ' · ' + _esc(_patientData.age) + ' yrs' +
          ' · ' + _esc(_patientData.setting) +
        '</div>' +

        '<div class="clx-form-actions">' +
          '<button class="clx-btn clx-btn-secondary" id="nc-back-btn">← Back</button>' +
          '<button class="clx-btn clx-btn-primary" id="nc-start-btn">Start Case →</button>' +
        '</div>' +

      '</div>'
    );
  }

  /* ── Validation ─────────────────────────────────────────────  */

  function _validateStep1() {
    var ok = true;

    var identifier = document.getElementById('nc-identifier');
    var age        = document.getElementById('nc-age');
    var errId      = document.getElementById('err-identifier');
    var errAge     = document.getElementById('err-age');

    if (errId)  errId.textContent  = '';
    if (errAge) errAge.textContent = '';

    if (!identifier || !identifier.value.trim()) {
      if (errId) errId.textContent = 'Patient reference is required.';
      ok = false;
    }

    var ageVal = parseInt(age ? age.value : '', 10);
    if (!age || !age.value || isNaN(ageVal) || ageVal < 18 || ageVal > 120) {
      if (errAge) errAge.textContent = 'A valid age (18–120) is required.';
      ok = false;
    }

    if (ok) {
      _patientData.identifier     = identifier.value.trim();
      _patientData.age            = ageVal;
      _patientData.setting        = document.getElementById('nc-setting').value;
      _patientData.referralSource = (document.getElementById('nc-referral') || {}).value || '';
      _patientData.clinicalContext = (document.getElementById('nc-context') || {}).value || '';
    }

    return ok;
  }

  /* ── Render the full view ───────────────────────────────────  */

  function _render() {
    if (!_container) return;

    var stepContent = _step === 1 ? _renderStep1() : _renderStep2();

    _container.innerHTML =
      '<div class="clx-new-case">' +
        '<div class="clx-page-header">' +
          '<div>' +
            '<h1 class="clx-page-title">New Case</h1>' +
            '<p class="clx-page-subtitle">Set up a new clinical review case</p>' +
          '</div>' +
        '</div>' +
        _renderStepper() +
        '<div class="clx-new-case-body">' +
          stepContent +
        '</div>' +
      '</div>';

    _bindStepEvents();
  }

  /* ── Bind events for the rendered step ─────────────────────  */

  function _bindStepEvents() {
    if (_step === 1) {
      var continueBtn = document.getElementById('nc-continue-btn');
      if (continueBtn) {
        continueBtn.addEventListener('click', function() {
          if (_validateStep1()) {
            _step = 2;
            _render();
          }
        });
      }
      /* Allow Enter on text inputs to advance */
      var inputs = document.querySelectorAll('#clx-step1 .clx-input');
      for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            if (_validateStep1()) { _step = 2; _render(); }
          }
        });
      }
    }

    if (_step === 2) {
      /* Tile selection */
      var tiles = document.querySelectorAll('.clx-workflow-selector-tile');
      for (var j = 0; j < tiles.length; j++) {
        (function(tile) {
          tile.addEventListener('click', function() {
            _selectedWorkflow = tile.getAttribute('data-workflow-id');
            /* Update selected state on all tiles */
            var allTiles = document.querySelectorAll('.clx-workflow-selector-tile');
            for (var k = 0; k < allTiles.length; k++) {
              allTiles[k].classList.remove('clx-tile-selected');
            }
            tile.classList.add('clx-tile-selected');
            var errWf = document.getElementById('err-workflow');
            if (errWf) errWf.textContent = '';
          });
        })(tiles[j]);
      }

      /* Back */
      var backBtn = document.getElementById('nc-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', function() {
          _step = 1;
          _render();
        });
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
          /* Disable button to prevent double-submit */
          startBtn.disabled = true;
          startBtn.textContent = 'Creating…';

          try {
            var newCase = CaseManager.createCase(_patientData, _selectedWorkflow);
            Router.navigate('/cases/' + newCase.id);
          } catch (err) {
            console.error('[NewCaseView] createCase failed:', err);
            startBtn.disabled = false;
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

    /* Pre-select workflow from query param */
    var preselect = params && params.query && params.query.workflow;
    if (preselect && WorkflowRegistry.get(preselect)) {
      _selectedWorkflow = preselect;
      _step = 2;
    }

    _render();
  }

  function unmount() {
    _container        = null;
    _step             = 1;
    _patientData      = {};
    _selectedWorkflow = null;
  }

  return { mount: mount, unmount: unmount };

}());
