/**
 * app.js — frontend application logic.
 *
 * Responsibilities:
 *  - wizard navigation and conditional questions (intake)
 *  - assembling the answers object and rendering the assessment + Q&A library
 *  - session persistence: autosave to the server, magic-link save/restore
 *  - document uploads (server mode) with a graceful static/offline fallback
 *    when the page is served without the Node backend (e.g. GitHub Pages)
 */
(function () {
  'use strict';

  // =====================================================================
  // App mode + session bootstrap
  // =====================================================================
  const api = {
    base: 'api', // relative — works under Express at /, degrades statically
    available: false,
    async check() {
      try {
        const r = await fetch(`${this.base}/health`, { cache: 'no-store' });
        this.available = r.ok;
      } catch {
        this.available = false;
      }
      return this.available;
    },
  };

  let sessionId = null;          // server-side session id (bearer secret)
  let uploads = [];              // upload metadata for display
  let currentSection = 1;
  let resultsShown = false;
  const totalSections = 6;
  let saveTimer = null;

  // =====================================================================
  // Wizard navigation
  // =====================================================================
  function updateProgress() {
    const pct = resultsShown ? 100 : ((currentSection - 1) / totalSections) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = resultsShown
      ? 'Assessment complete'
      : `Question section ${currentSection} of ${totalSections}`;
  }

  function sectionEl(n) {
    return document.getElementById(n === 'results' ? 'results-section' : 'sec' + n);
  }

  window.goTo = function goTo(section) {
    if (section === 3) {
      const status = document.querySelector('input[name="status"]:checked');
      if (!status) {
        showBanner('You need to answer this first', 'Select your current immigration status before continuing.', false);
        return;
      }
      hideBanner();
      showStatusQuestions(status.value);
    }
    sectionEl(resultsShown ? 'results' : currentSection).style.display = 'none';
    resultsShown = false;
    currentSection = section;
    const el = sectionEl(section);
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateProgress();
    scheduleSave();
  };

  function showStatusQuestions(status) {
    ['q_visitor', 'q_overstayer', 'q_skilled', 'q_student', 'q_family', 'q_ilr', 'q_euss', 'q_asylum']
      .forEach((id) => document.getElementById(id).classList.add('hidden'));

    const titles = {
      visitor: ['Visitor details', 'Tell us more about your visit to the UK.'],
      overstayer: ['Overstay situation', 'Understanding your circumstances is key to identifying options.'],
      skilled: ['Skilled Worker details', 'Your employment and sponsorship in the UK.'],
      student: ['Student visa details', 'Your studies and plans after graduation.'],
      family: ['Family visa details', 'Your relationship and residence.'],
      ilr: ['ILR / settled status', 'You are settled — next steps.'],
      euss: ['EU Settlement Scheme', 'Your EUSS status and residence.'],
      asylum: ['Asylum situation', 'General information about your claim.'],
      other: ['Current situation', 'Tell us more about your immigration situation.'],
    };
    const [title, sub] = titles[status] || titles.other;
    document.getElementById('sec3Title').textContent = title;
    document.getElementById('sec3Sub').textContent = sub;

    const map = { visitor: 'q_visitor', overstayer: 'q_overstayer', skilled: 'q_skilled', student: 'q_student', family: 'q_family', ilr: 'q_ilr', euss: 'q_euss', asylum: 'q_asylum' };
    if (map[status]) document.getElementById(map[status]).classList.remove('hidden');
  }

  // ---------------------------------------------------------------------
  // Conditional info boxes
  // ---------------------------------------------------------------------
  function toggle(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('show', show);
  }

  document.addEventListener('change', function (e) {
    const { name, value } = e.target;
    if (name === 'inUK') toggle('outsideUK_info', value === 'no');
    if (name === 'criminal') toggle('crim_serious_warn', value === 'serious');
    if (name === 'visit_purpose') toggle('marriage_visitor_note', value === 'marriage');
    if (name === 'v_overstay_plan') toggle('visitor_overstay_warn', value === 'yes');
    if (name === 'ov_10yr') toggle('ten_year_info', value === 'yes' || value === 'unsure');
    if (name === 'ov_removal') toggle('removal_warn', value === 'yes');
    if (name === 'sw_dependants') {
      document.getElementById('dependants_section')
        .classList.toggle('hidden', !['partner', 'children', 'other'].includes(value));
    }
    if (name === 'fam_ongoing') toggle('dv_info', value === 'no');
    if (name === 'ilr_bc_spouse') toggle('ilr_spouse_info', value === 'yes');
    if (name === 'long_absence') toggle('long_absence_warn', value === 'yes');
    if (name === 'appeal_status') toggle('appeal_docs_note', value !== 'none' && value !== '');
    if (name === 'deported') toggle('deport_warn', value === 'yes');
    if (name === 'deception') toggle('deception_warn', value === 'yes');
    if (name === 'pub_funds') toggle('pub_funds_warn', value === 'yes');
    if (name === 'nhs_debt') toggle('nhs_debt_warn', value === 'yes');
    scheduleSave();
  });

  // =====================================================================
  // Answers + results
  // =====================================================================
  function radio(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
  }
  function field(id) {
    return document.getElementById(id)?.value || '';
  }

  function collectAnswers() {
    return {
      // Section 1
      age: parseInt(field('age'), 10) || 0,
      nationality: field('nationality'),
      birthCountry: field('birthCountry'),
      inUK: radio('inUK'),
      criminal: radio('criminal') || 'none',
      // Section 2
      status: radio('status') || 'unknown',
      // Section 3 (status-specific)
      visitor_entry: field('visitor_entry'),
      visitor_duration: field('visitor_duration'),
      visit_purpose: radio('visit_purpose'),
      v_overstay_plan: radio('v_overstay_plan'),
      v_partner: radio('v_partner'),
      overstay_expired: field('overstay_expired'),
      overstay_visa_type: field('overstay_visa_type'),
      ov_applied: radio('ov_applied'),
      ov_partner: radio('ov_partner'),
      ov_ukborn_child: radio('ov_ukborn_child'),
      ov_10yr: radio('ov_10yr'),
      ov_removal: radio('ov_removal'),
      skilled_entry: field('skilled_entry'),
      sw_same_sponsor: radio('sw_same_sponsor'),
      skilled_salary: field('skilled_salary'),
      sw_shortage: radio('sw_shortage'),
      skilled_absences: field('skilled_absences'),
      sw_dependants: radio('sw_dependants'),
      student_entry: field('student_entry'),
      student_level: field('student_level'),
      st_work: radio('st_work'),
      st_post: radio('st_post'),
      fam_rel: radio('fam_rel'),
      fam_duration: field('fam_duration'),
      fam_ongoing: radio('fam_ongoing'),
      fam_sponsor_uk: radio('fam_sponsor_uk'),
      ilr_duration: field('ilr_duration'),
      ilr_total_time: field('ilr_total_time'),
      ilr_bc_spouse: radio('ilr_bc_spouse'),
      euss_type: radio('euss_type'),
      euss_years: field('euss_years'),
      asy_stage: radio('asy_stage'),
      asy_country: field('asy_country'),
      // Section 4
      totalYears: field('total_years'),
      longAbsence: radio('long_absence') || 'no',
      refusal: radio('refusal') || 'no',
      appeal_status: radio('appeal_status') || 'none',
      deported: radio('deported') || 'no',
      english: radio('english'),
      lifeuk: radio('lifeuk'),
      // Section 5
      dependants_general: radio('dependants_general'),
      goal: radio('goal'),
      property: radio('property'),
      nhs_debt: radio('nhs_debt'),
      // Section 6
      deception: radio('deception') || 'no',
      pub_funds: radio('pub_funds') || 'no',
      extra_notes: field('extra_notes'),
    };
  }

  window.generateResults = function generateResults() {
    const answers = collectAnswers();
    const result = window.Guidance.generateAssessment(answers);

    const tagFor = { eligible: 'tag--green', possible: 'tag--yellow', 'not-eligible': 'tag--red', info: 'tag--blue' };
    let html = `
      <span class="caption-l">Your assessment</span>
      <h1 class="heading-l">${escapeHtml(result.title)}</h1>
      <p class="text-secondary">${escapeHtml(result.sub)}</p>
    `;
    result.cards.forEach((card) => {
      html += `
        <div class="result-card result-card--${card.type}">
          <span class="tag ${tagFor[card.type] || 'tag--grey'}">${escapeHtml(card.tag || card.type)}</span>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${card.detail}</p>
        </div>`;
    });
    if (result.steps.length) {
      html += `<h2 class="heading-m mt-30">Recommended next steps</h2><ol class="list">`;
      result.steps.forEach((s) => { html += `<li>${escapeHtml(s)}</li>`; });
      html += `</ol>`;
    }
    html += `
      <div class="warning-text">
        <span class="warning-text__icon" aria-hidden="true">!</span>
        <span class="warning-text__text">This assessment reflects UK immigration rules as checked against GOV.UK in July 2026.
        Rules change frequently and this is not legal advice — verify on GOV.UK and consult a regulated adviser.</span>
      </div>`;

    document.getElementById('results-content').innerHTML = html;
    renderQA(answers);

    sectionEl(currentSection).style.display = 'none';
    resultsShown = true;
    const rs = document.getElementById('results-section');
    rs.style.display = 'block';
    updateProgress();
    rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scheduleSave();
  };

  function renderQA(answers) {
    const { relevant, other } = window.Guidance.relevantQA(answers);
    let html = '';
    if (relevant.length) {
      html += `<h2 class="heading-m">Common questions for your circumstances</h2>`;
      relevant.forEach((item) => {
        html += `<details class="details" open><summary>${escapeHtml(item.q)}</summary><div class="details__text">${item.a}</div></details>`;
      });
    }
    if (other.length) {
      html += `<h3 class="heading-s mt-30 text-secondary">Other topics (less relevant to your answers)</h3>`;
      other.forEach((item) => {
        html += `<details class="details"><summary>${escapeHtml(item.q)}</summary><div class="details__text">${item.a}</div></details>`;
      });
    }
    document.getElementById('qa-section').innerHTML = html;
  }

  window.startOver = function startOver() {
    localStorage.removeItem('advac_session_id');
    window.location.href = window.location.pathname;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // =====================================================================
  // State serialization (save/restore)
  // =====================================================================
  function serializeState() {
    const state = { fields: {}, radios: {}, checks: {}, currentSection, resultsShown };
    document.querySelectorAll('main input, main select, main textarea').forEach((el) => {
      if (el.id === 'save_email' || el.id === 'doc_file' || el.id === 'doc_type') return;
      if (el.type === 'radio') { if (el.checked) state.radios[el.name] = el.value; }
      else if (el.type === 'checkbox') { if (el.checked) state.checks[el.id] = true; }
      else if (el.id) state.fields[el.id] = el.value;
    });
    return state;
  }

  function applyState(state) {
    if (!state) return;
    Object.entries(state.fields || {}).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    Object.entries(state.radios || {}).forEach(([name, val]) => {
      const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (el) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true })); // re-trigger conditional UI
      }
    });
    Object.keys(state.checks || {}).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });

    // Restore position in the wizard
    const status = state.radios?.status;
    if (status) showStatusQuestions(status);
    sectionEl(1).style.display = 'none';
    if (state.resultsShown) {
      currentSection = state.currentSection || totalSections;
      window.generateResults();
    } else {
      currentSection = state.currentSection || 1;
      sectionEl(currentSection).style.display = 'block';
      updateProgress();
    }
  }

  // =====================================================================
  // Server persistence
  // =====================================================================
  async function ensureSession() {
    if (!api.available) return null;
    if (sessionId) return sessionId;
    const stored = localStorage.getItem('advac_session_id');
    if (stored) {
      // Validate it still exists server-side
      const r = await fetch(`${api.base}/session/${stored}`).catch(() => null);
      if (r && r.ok) { sessionId = stored; return sessionId; }
      localStorage.removeItem('advac_session_id');
    }
    const res = await fetch(`${api.base}/session`, { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) return null;
    const data = await res.json();
    sessionId = data.sessionId;
    localStorage.setItem('advac_session_id', sessionId);
    return sessionId;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1200);
  }

  async function saveNow() {
    const state = serializeState();
    localStorage.setItem('advac_state', JSON.stringify(state)); // local fallback always
    if (!api.available) return;
    const id = await ensureSession();
    if (!id) return;
    await fetch(`${api.base}/session/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------
  // Magic link
  // ---------------------------------------------------------------------
  async function requestMagicLink() {
    const emailEl = document.getElementById('save_email');
    const status = document.getElementById('save_status');
    const email = emailEl.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = 'Enter a valid email address.';
      return;
    }
    if (!api.available) {
      status.textContent = 'Saving by email needs the app server — this static preview stores progress in this browser only.';
      return;
    }
    status.textContent = 'Saving and sending…';
    await saveNow();
    const id = await ensureSession();
    try {
      const res = await fetch(`${api.base}/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      status.textContent = data.mode === 'console'
        ? 'Saved. (Dev mode: no email service configured — the link was printed to the server console.)'
        : `Done — check ${email} for your sign-in link.`;
      showBanner('Progress saved', `A magic link has been ${data.mode === 'console' ? 'generated (see server console in dev mode)' : 'emailed to ' + email}. Opening it on any device restores this session.`, true);
    } catch (err) {
      status.textContent = err.message || 'Could not send the email — try again.';
    }
  }

  async function tryRestoreFromToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token || !api.available) return false;
    try {
      const res = await fetch(`${api.base}/restore/${encodeURIComponent(token)}`);
      if (!res.ok) {
        showBanner('Link problem', 'That sign-in link is invalid or has expired. You can start a new assessment and save again.', false);
        return false;
      }
      const data = await res.json();
      sessionId = data.sessionId;
      localStorage.setItem('advac_session_id', sessionId);
      uploads = data.uploads || [];
      renderUploads();
      applyState(data.state);
      if (data.email) document.getElementById('save_email').value = data.email;
      // Clean the token out of the address bar
      history.replaceState(null, '', window.location.pathname);
      showBanner('Welcome back', 'Your saved session has been restored — answers, guidance and documents are exactly as you left them.', true);
      return true;
    } catch {
      return false;
    }
  }

  // =====================================================================
  // Document uploads
  // =====================================================================
  const DOC_TYPE_LABELS = {
    'refusal-letter': 'Refusal letter',
    'appeal-decision': 'Appeal decision',
    'brp-card': 'BRP / eVisa',
    'visa-vignette': 'Visa vignette',
    'passport': 'Passport',
    'residence-evidence': 'Residence evidence',
    'relationship-evidence': 'Relationship evidence',
    'financial-evidence': 'Financial evidence',
    'other': 'Other',
  };

  async function uploadDocument() {
    const fileInput = document.getElementById('doc_file');
    const status = document.getElementById('upload_status');
    const docType = document.getElementById('doc_type').value;
    const file = fileInput.files[0];
    if (!file) { status.textContent = 'Choose a file first.'; return; }
    if (file.size > 10 * 1024 * 1024) { status.textContent = 'File is over the 10MB limit.'; return; }

    if (!api.available) {
      // Static/offline mode: list the file locally so the UI remains usable.
      uploads.push({ id: 'local-' + Date.now(), docType, filename: file.name, size: file.size, uploadedAt: new Date().toISOString(), local: true });
      renderUploads();
      status.textContent = 'Listed locally — uploads are stored when the app server is running.';
      fileInput.value = '';
      return;
    }

    status.textContent = 'Uploading…';
    try {
      const id = await ensureSession();
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(`${api.base}/session/${id}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, filename: file.name, mimeType: file.type, dataBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      uploads.push(data.upload);
      renderUploads();
      status.textContent = `Uploaded — "${file.name}" saved to your session.`;
      fileInput.value = '';
    } catch (err) {
      status.textContent = err.message || 'Upload failed — try again.';
    }
  }

  async function deleteUpload(uploadId) {
    const u = uploads.find((x) => x.id === uploadId);
    if (!u) return;
    if (!u.local && api.available && sessionId) {
      await fetch(`${api.base}/session/${sessionId}/uploads/${uploadId}`, { method: 'DELETE' }).catch(() => {});
    }
    uploads = uploads.filter((x) => x.id !== uploadId);
    renderUploads();
  }

  function renderUploads() {
    const wrap = document.getElementById('file-list-wrap');
    if (!uploads.length) { wrap.innerHTML = ''; return; }
    let html = `<table class="file-list"><thead><tr><th>Document</th><th>Type</th><th></th></tr></thead><tbody>`;
    uploads.forEach((u) => {
      html += `<tr>
        <td>${escapeHtml(u.filename)}<br><span class="text-secondary" style="font-size:13px">${formatSize(u.size)} · ${new Date(u.uploadedAt).toLocaleDateString('en-GB')}</span></td>
        <td><span class="tag tag--grey">${escapeHtml(DOC_TYPE_LABELS[u.docType] || u.docType)}</span></td>
        <td><button class="link-button" data-remove="${escapeHtml(u.id)}">Remove</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => deleteUpload(btn.getAttribute('data-remove')));
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]); // strip data: prefix
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // =====================================================================
  // Banner helper
  // =====================================================================
  function showBanner(title, text, success) {
    const banner = document.getElementById('banner');
    banner.classList.remove('hidden');
    banner.classList.toggle('notification-banner--success', !!success);
    document.getElementById('bannerTitle').textContent = title;
    document.getElementById('bannerText').textContent = text;
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideBanner() {
    document.getElementById('banner').classList.add('hidden');
  }

  // =====================================================================
  // Init
  // =====================================================================
  document.getElementById('save_btn').addEventListener('click', requestMagicLink);
  document.getElementById('upload_btn').addEventListener('click', uploadDocument);
  document.addEventListener('input', (e) => {
    if (e.target.matches('input[type="text"], input[type="number"], input[type="date"], textarea')) scheduleSave();
  });

  (async function init() {
    await api.check();
    if (!api.available) {
      document.getElementById('save_status').textContent =
        'Static preview: progress is saved in this browser only. Run the app server for email save and uploads.';
    }

    const restored = await tryRestoreFromToken();
    if (!restored) {
      // Resume from this browser's own session if one exists
      if (api.available) {
        const stored = localStorage.getItem('advac_session_id');
        if (stored) {
          try {
            const r = await fetch(`${api.base}/session/${stored}`);
            if (r.ok) {
              const data = await r.json();
              sessionId = stored;
              uploads = data.uploads || [];
              renderUploads();
              if (data.email) document.getElementById('save_email').value = data.email;
              if (data.state) applyState(data.state);
              updateProgress();
              return;
            }
            localStorage.removeItem('advac_session_id');
          } catch { /* fall through to local */ }
        }
      }
      const local = localStorage.getItem('advac_state');
      if (local) {
        try { applyState(JSON.parse(local)); } catch { /* ignore corrupt state */ }
      }
    }
    updateProgress();
  })();
})();
