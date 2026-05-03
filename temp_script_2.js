
let _selectedFileForUpload = null;
let _currentFilter = 'all';
let _allTests = [];

// Avatar colors
function avColor(name) {
  const colors = ['av-0','av-1','av-2','av-3','av-4','av-5'];
  let h = 0; for (let c of (name||'')) h = (h*31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

function initials(name) {
  return (name||'?').trim().split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
}

// ── Sidebar toggle (mobile) ─────────────────────────────────
function toggleSidebar() {
  document.getElementById('aSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('aSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// Close sidebar on nav tap (mobile)
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.a-nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
});

// ── Mobile data-label injection ─────────────────────────────
(function() {
  const TABLE_LABELS = {
    manageTestsBody:      ['Test', 'Status', 'Start Time', 'End Time', 'Actions'],
    adminStudentsBody:    ['Student', 'Phone', 'Level', 'Joined'],
    adminAnalyticsBody:   ['Student', 'Test', 'Score', 'Submission', 'Violations', 'Timestamp'],
    level2UnlockBody:     ['Student', 'Test', 'L1 Score', 'Request Date', 'Status', 'Action'],
    adminLeaderboardBody: ['Rank', 'Student', 'Tests Done', 'Avg Score', 'Points', 'Rewards'],
  };

  function labelRows(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const labels = TABLE_LABELS[tbodyId];
    tbody.querySelectorAll('tr').forEach(function(tr) {
      tr.querySelectorAll('td').forEach(function(td, i) {
        if (!td.getAttribute('colspan') && labels[i]) {
          td.setAttribute('data-label', labels[i]);
        }
      });
    });
  }

  function observeTable(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    labelRows(tbodyId);
    new MutationObserver(function() { labelRows(tbodyId); })
      .observe(tbody, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', function() {
    Object.keys(TABLE_LABELS).forEach(observeTable);
  });
})();

// ── Navigation ─────────────────────────────────────────────
const PAGE_LABELS = {
  'view-dashboard':      'Dashboard',
  'view-manage-tests':   'Manage Tests',
  'view-create-test':    'Create Test',
  'view-students':       'Registered Students',
  'view-analytics':      'Analytics',
  'view-unlock':         'L2 Unlock Requests',
  'view-leaderboard':    'Leaderboard',
  'view-level2-config':  'Level 2 Schedule',

  'view-past-papers':    'Past Papers',
};

function navTo(viewId, clickedEl) {
  // Update sidebar active state
  document.querySelectorAll('.a-nav-item').forEach(el => el.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  // Hide all views
  document.querySelectorAll('.a-view').forEach(v => v.style.display = 'none');

  // Show target view
  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';

  // Scroll to top
  const mainEl = document.querySelector('.a-content');
  if (mainEl) mainEl.scrollTop = 0;
  window.scrollTo(0, 0);

  // Update breadcrumb
  const crumb = document.getElementById('breadcrumb-page');
  if (crumb) crumb.textContent = PAGE_LABELS[viewId] || 'Dashboard';

  // Lazy-load section data on first visit (manual refresh button for subsequent loads)
  const section = VIEW_TO_SECTION[viewId];
  if (section) loadSectionOnce(section);
}

// ── Status badge ───────────────────────────────────────────
function statusBadge(s) {
  const map = {
    live:'a-badge-live', draft:'a-badge-draft', expired:'a-badge-expired',
    upcoming:'a-badge-pending',
    active:'a-badge-active', inactive:'a-badge-inactive',
    pending:'a-badge-pending', free:'a-badge-free', paid:'a-badge-paid'
  };
  return `<span class="a-badge ${map[s]||'a-badge-draft'}">${s||'draft'}</span>`;
}

// ── Filter Tests ────────────────────────────────────────────
function filterTests(filter, btn) {
  _currentFilter = filter;
  document.querySelectorAll('.a-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderManageTests();
}

function renderManageTests() {
  const container = document.getElementById('manageTestsBody');
  const tests = _currentFilter === 'all' ? _allTests : _allTests.filter(t => t.status === _currentFilter);
  if (!tests.length) {
    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">No tests found.</div>';
    return;
  }
  const pricingOf = (t) => t.pricing || {};
  container.innerHTML = tests.map(t => {
    const pr = pricingOf(t);
    const priceType = pr.testType || 'Free';
    const priceVal  = pr.price != null ? pr.price : (pr.discountPrice || 0);
    return `
    <div style="border:1px solid var(--card-border);border-radius:10px;padding:20px;background:var(--card-bg)">
      <!-- Header row: title + ID badge + status badge -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:4px">TITLE</div>
          <input type="text" class="a-input" style="font-weight:600;font-size:14px;width:100%" id="title_${t.testId}" value="${escHtml(t.title)}">
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);font-family:var(--mono)">${escHtml(t.testId)}</span>
          ${statusBadge(t.status)}
        </div>
      </div>

      <!-- Form grid: row 1 -->
      <div class="a-form-grid a-form-grid-3" style="margin-bottom:14px">
        <div class="a-form-group">
          <label class="a-label">Level</label>
          <select class="a-select" id="level_${t.testId}">
            <option value="foundation" ${(t.level||'').toLowerCase()==='foundation'?'selected':''}>Foundation</option>
            <option value="intermediate" ${(t.level||'').toLowerCase()==='intermediate'?'selected':''}>Intermediate</option>
            <option value="final" ${(t.level||'').toLowerCase()==='final'?'selected':''}>Final</option>
          </select>
        </div>
        <div class="a-form-group">
          <label class="a-label">Status</label>
          <select class="a-select" id="status_${t.testId}">
            <option value="draft" ${t.status==='draft'?'selected':''}>Draft</option>
            <option value="upcoming" ${t.status==='upcoming'?'selected':''}>Upcoming</option>
            <option value="live" ${t.status==='live'?'selected':''}>Live</option>
            <option value="expired" ${t.status==='expired'?'selected':''}>Expired</option>
          </select>
        </div>
        <div class="a-form-group">
          <label class="a-label">Subject</label>
          <input class="a-input" type="text" id="subject_${t.testId}" value="${escHtml(t.subject||'')}" placeholder="e.g. Cost Accounting">
        </div>
        <div class="a-form-group">
          <label class="a-label">Start Time</label>
          <input type="datetime-local" class="a-input" id="start_${t.testId}" value="${t.startTime||""}">
        </div>
        <div class="a-form-group">
          <label class="a-label">End Time</label>
          <input type="datetime-local" class="a-input" id="end_${t.testId}" value="${t.endTime||""}">
        </div>
        <div class="a-form-group">
          <label class="a-label">Duration (mins)</label>
          <input class="a-input" type="number" id="duration_${t.testId}" value="${t.duration||60}">
        </div>
        <div class="a-form-group">
          <label class="a-label">Test Type</label>
          <select class="a-select" id="pricetype_${t.testId}">
            <option value="Free" ${priceType==='Free'?'selected':''}>Free</option>
            <option value="Paid" ${priceType==='Paid'?'selected':''}>Paid</option>
          </select>
        </div>
        <div class="a-form-group">
          <label class="a-label">Price (₹)</label>
          <input class="a-input" type="number" id="price_${t.testId}" value="${priceVal}">
        </div>
        <div class="a-form-group">
          <label class="a-label">Negative Marking</label>
          <select class="a-select" id="negmark_${t.testId}">
            <option value="0" ${(!t.negativeMarking||t.negativeMarking==0)?'selected':''}>None (0)</option>
            <option value="0.25" ${t.negativeMarking==0.25?'selected':''}>−0.25</option>
            <option value="0.5" ${t.negativeMarking==0.5?'selected':''}>−0.50</option>
            <option value="1" ${t.negativeMarking==1?'selected':''}>−1.00</option>
          </select>
        </div>
        <div class="a-form-group">
          <label class="a-label">1st Prize (₹)</label>
          <input class="a-input" type="number" id="prize1_${t.testId}" value="${t.prize1||0}">
        </div>
        <div class="a-form-group">
          <label class="a-label">2nd Prize (₹)</label>
          <input class="a-input" type="number" id="prize2_${t.testId}" value="${t.prize2||0}">
        </div>
        <div class="a-form-group">
          <label class="a-label">3rd Prize (₹)</label>
          <input class="a-input" type="number" id="prize3_${t.testId}" value="${t.prize3||0}">
        </div>
        <div class="a-form-group">
          <label class="a-label">Total Questions</label>
          <input class="a-input" type="text" value="${t.totalQuestions||'—'}" disabled style="color:var(--text-muted)">
        </div>
      </div>
      <div class="a-form-group" style="margin-bottom:14px">
        <label class="a-label">Description / Syllabus</label>
        <textarea class="a-input" id="desc_${t.testId}" rows="2" style="resize:vertical" placeholder="Enter description or syllabus...">${escHtml(t.description||'')}</textarea>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--card-border);flex-wrap:wrap">
        <button class="a-btn a-btn-outline a-btn-sm" onclick="viewTestContent('${t.testId}')">View Content</button>
        <button class="a-btn a-btn-sm" style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA" onclick="deleteTest('${t.testId}','${escHtml(t.title).replace(/'/g,"\\'")}')">🗑 Delete</button>
        <button class="a-btn a-btn-primary a-btn-sm" onclick="saveTestDetails('${t.testId}')">Save Changes</button>
      </div>
    </div>
  `;
  }).join('');
}

// ── Load Manage Tests ───────────────────────────────────────
async function loadManageTests() {
  const container = document.getElementById('manageTestsBody');
  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">Loading\u2026</div>';
  try {
    const data = await apiCall('fetchTests');
    if (data.status === 'success' && data.data?.tests) {
      _allTests = data.data.tests;
      renderManageTests();
    } else {
      _allTests = [];
      renderManageTests();
    }
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--red-text)">Failed to load tests.</div>';
  }
}

window.viewTestContent = function(testId) {
  const modal = document.getElementById('contentViewerModal');
  const body  = document.getElementById('contentViewerBody');
  const title = document.getElementById('contentViewerTitle');
  body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">Loading questions…</div>';
  title.textContent = 'Loading…';
  modal.classList.add('open');
  apiCall('fetchTests').then(res => {
    const test = (res.data?.tests || []).find(t => t.testId === testId);
    if (!test) { body.innerHTML = '<div style="padding:24px;color:var(--red-text)">Test not found.</div>'; return; }
    title.textContent = test.title || testId;
    const qs = test.testData?.questions || [];
    if (!qs.length) { body.innerHTML = '<div style="padding:24px;color:var(--text-muted)">No questions in this test.</div>'; return; }
    body.innerHTML = qs.map((q, i) => `
      <div style="margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px">
        <div style="font-weight:600;margin-bottom:8px">Q${i+1}. ${escHtml(q.text)}</div>
        ${q.image ? `<img src="${q.image}" style="max-width:100%;max-height:200px;border-radius:4px;margin-bottom:8px">` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${q.options.map((opt, j) => `
            <div style="padding:6px;font-size:13px;border-radius:4px;background:${opt === q.correct ? '#DCFCE7;border:1px solid #86EFAC' : '#fff;border:1px solid var(--border)'}">${['A','B','C','D'][j]}. ${escHtml(opt)}</div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }).catch(() => {
    body.innerHTML = '<div style="padding:24px;color:var(--red-text)">Error loading questions.</div>';
  });
};

window.deleteTest = async function(testId, title) {
  if (!confirm(`Are you sure you want to delete test "${title}"?\nThis cannot be undone.`)) return;
  try {
    const res = await apiCall('deleteTest', { testId });
    if (res.status === 'success') {
      showToast('✅ Test deleted successfully');
      loadManageTests();
    } else {
      showToast('❌ Failed: ' + res.message);
    }
  } catch(e) {
    showToast('❌ Network error');
  }
};

window.saveTestDetails = async function(testId) {
  const title = document.getElementById('title_' + testId)?.value;
  const level = document.getElementById('level_' + testId)?.value;
  const status = document.getElementById('status_' + testId).value;
  const startTime = document.getElementById('start_' + testId).value;
  const endTime = document.getElementById('end_' + testId).value;
  const subject = document.getElementById('subject_' + testId)?.value || '';
  const duration = parseInt(document.getElementById('duration_' + testId)?.value) || 60;
  const negativeMarking = parseFloat(document.getElementById('negmark_' + testId)?.value) || 0;
  const prize1 = parseInt(document.getElementById('prize1_' + testId)?.value) || 0;
  const prize2 = parseInt(document.getElementById('prize2_' + testId)?.value) || 0;
  const prize3 = parseInt(document.getElementById('prize3_' + testId)?.value) || 0;
  const description = document.getElementById('desc_' + testId)?.value || '';
  const priceType = document.getElementById('pricetype_' + testId)?.value || 'Free';
  const price = parseInt(document.getElementById('price_' + testId)?.value) || 0;
  try {
    const res = await apiCall('updateTest', { testId, title, level, status, startTime, endTime, subject, duration, negativeMarking, prize1, prize2, prize3, description });
    if (res.status === 'success') {
      showToast('✅ Test updated successfully');
      // Issue 5: persist pricing so index page shows updated price
      await apiCall('updatePricing', { testId, testTitle: title, price, discountPrice: price, testType: priceType, packageName: '', status: 'active' }).catch(() => {});
      // Trigger student notification when test goes live
      if (status === 'live') {
        apiCall('notifyStudents', { testId, trigger: 'testLive' }).catch(() => {});
      }
      loadManageTests();
    }
    else showToast('❌ Failed: ' + res.message);
  } catch(e) { showToast('❌ Network error saving test'); }
};

// ── Load Students ───────────────────────────────────────────
async function loadAdminStudents() {
  const tbody = document.getElementById('adminStudentsBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">Loading…</td></tr>';
  try {
    const data = await apiCall('getStudents');
    if (data.status === 'success' && data.data?.students?.length) {
      tbody.innerHTML = data.data.students.map(st => {
        const av = avColor(st.name);
        return `<tr>
          <td>
            <div class="a-user-cell">
              <div class="a-cell-avatar ${av}">${initials(st.name)}</div>
              <div>
                <div class="a-cell-name">${escHtml(st.name)}</div>
                <div class="a-cell-sub">${escHtml(st.email)}</div>
              </div>
            </div>
          </td>
          <td style="text-transform:capitalize">${escHtml(st.role)}</td>
          <td style="font-family:var(--mono);font-size:13px;color:var(--text-muted)">${escHtml(st.phone||'—')}</td>
          <td>
            <div class="a-action">
              <button class="a-link-btn" onclick="navTo('view-manage-tests', null); filterTests('all', document.querySelector('.a-tab'))">View Tests</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">No students found.</td></tr>';
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--red-text)">Failed to load students.</td></tr>';
  }
}

// ── Dashboard Stats ─────────────────────────────────────────
async function loadAdminDashboardStats() {
  try {
    const data = await apiCall('getDashboardStats');
    if (data.status === 'success' && data.data?.stats) {
      ['students','tests','pending','submissions'].forEach(k => {
        const el = document.getElementById('admin-stat-' + k);
        if (el) el.textContent = data.data.stats[k] ?? '—';
      });
    } else {
      ['admin-stat-students','admin-stat-tests','admin-stat-pending','admin-stat-submissions']
        .forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '—'; });
    }
  } catch(e) {
    ['admin-stat-students','admin-stat-tests','admin-stat-pending','admin-stat-submissions']
      .forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '⚠'; });
  }
}

// ── Level 2 Requests ────────────────────────────────────────
// ── Level 2 Requests ────────────────────────────────────────
// Tracks per-row selected action (email -> 'approve'|'reject'|'')
const _l2ActionMap = {};

async function loadLevel2Requests() {
  const tbody = document.getElementById('level2UnlockBody');
  if (!tbody) return;
  try {
    const data = await apiCall('fetchAnalytics');
    if (data.status === 'success' && data.data?.attempts) {
      let attempts = data.data.attempts.filter(a => a.score !== null);
      attempts.sort((a,b) => {
        let sa = parseFloat((a.score||'0').split('(')[1]||a.score);
        let sb = parseFloat((b.score||'0').split('(')[1]||b.score);
        if (sb !== sa) return sb - sa;
        return (parseInt(a.totalTime)||999999) - (parseInt(b.totalTime)||999999);
      });
      const top10 = attempts.slice(0,10);
      const badge = document.getElementById('unlock-pending-badge');
      const navBadge = document.getElementById('nav-badge-pending');
      if (badge) badge.textContent = attempts.length + ' Pending';
      if (navBadge) { navBadge.textContent = attempts.length; navBadge.style.display = attempts.length ? '' : 'none'; }
      if (!top10.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">No pending requests.</td></tr>'; return; }
      tbody.innerHTML = top10.map(req => {
        const av = avColor(req.name);
        const currentStatus = req.l2Status || req.level2Status || 'pending';
        const safeEmail = escHtml(req.email).replace(/'/g, "\\'");
        const safeName  = escHtml(req.name).replace(/'/g, "\\'");
        const rowKey = btoa(unescape(encodeURIComponent(req.email))).replace(/[^a-zA-Z0-9]/g, '');
        return `<tr id="l2row_${rowKey}">
          <td>
            <div class="a-user-cell">
              <div class="a-cell-avatar ${av}">${initials(req.name)}</div>
              <div class="a-cell-name">${escHtml(req.name)}</div>
            </div>
          </td>
          <td>${escHtml(req.testTitle)}</td>
          <td style="font-family:var(--mono);font-weight:600;color:var(--green-text)">${req.score}</td>
          <td style="font-size:12.5px;color:var(--text-muted)">${new Date(req.timestamp).toLocaleDateString()}</td>
          <td id="l2status_${rowKey}">${statusBadge(currentStatus)}</td>
          <td>
            <div class="a-action" style="gap:6px;flex-wrap:wrap">
              <select class="a-select" id="l2action_${rowKey}"
                style="padding:4px 8px;font-size:12px;min-width:100px"
                onchange="window._l2PreviewStatus('${rowKey}', this.value)">
                <option value="">- Action -</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="completed">Mark Completed</option>
              </select>
              <button class="a-btn a-btn-primary a-btn-sm"
                onclick="window.saveL2Action('${safeEmail}','${safeName}','${rowKey}')">Save</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red-text)">Failed to load.</td></tr>';
  }
}

// Issue 7: Preview status badge before saving
window._l2PreviewStatus = function(rowKey, action) {
  const statusEl = document.getElementById('l2status_' + rowKey);
  if (!statusEl) return;
  if (action === 'approve') statusEl.innerHTML = statusBadge('active');
  else if (action === 'reject') statusEl.innerHTML = statusBadge('expired');
  else if (action === 'completed') statusEl.innerHTML = statusBadge('active');
  else statusEl.innerHTML = statusBadge('pending');
};

// Issue 7+10: Save action - Approve = unlock, Reject = reject
window.saveL2Action = async function(email, name, rowKey) {
  const sel = document.getElementById('l2action_' + rowKey);
  if (!sel || !sel.value) { showToast('Please select an action first'); return; }
  const action = sel.value;
  try {
    if (action === 'approve') {
      const res = await apiCall('unlockLevel2', { studentEmail: email });
      if (res.status === 'success') {
        showToast('Level 2 approved for ' + name);
        // Issue 12: Notify student on approval
        apiCall('sendNotification', { studentEmail: email, message: 'Congratulations! You have been selected for Level 2. Please check your schedule.' }).catch(() => {});
        loadLevel2Requests();
      } else showToast('Failed: ' + res.message);
    } else if (action === 'completed') {
      const res = await apiCall('markL2Completed', { studentEmail: email });
      if (res.status === 'success') {
        showToast('Level 2 marked as completed for ' + name);
        const statusEl = document.getElementById('l2status_' + rowKey);
        if (statusEl) statusEl.innerHTML = statusBadge('expired');
        // Issue 12: Notify student on completion
        apiCall('sendNotification', { studentEmail: email, message: 'Your Level 2 evaluation is complete. Results will be published soon.' }).catch(() => {});
        setTimeout(() => loadLevel2Requests(), 1500);
      } else showToast('Failed: ' + res.message);
    } else if (action === 'reject') {
      const res = await apiCall('rejectLevel2', { studentEmail: email });
      if (res.status === 'success') {
        showToast('Request rejected for ' + name);
        // Issue 10: Immediately update status badge in row
        const statusEl = document.getElementById('l2status_' + rowKey);
        if (statusEl) statusEl.innerHTML = statusBadge('expired');
        // Issue 12: Notify student on rejection
        apiCall('sendNotification', { studentEmail: email, message: 'Your Level 2 unlock request was not approved at this time.' }).catch(() => {});
        setTimeout(() => loadLevel2Requests(), 1500);
      } else showToast('Failed: ' + res.message);
    }
  } catch(e) { showToast('Network error'); }
};

// Legacy kept for any inline calls
window.unlockLevel2 = async function(email, name) {
  try {
    const res = await apiCall('unlockLevel2', { studentEmail: email });
    if (res.status === 'success') { showToast('Level 2 unlocked for ' + name); loadLevel2Requests(); }
    else showToast('Failed: ' + res.message);
  } catch(e) { showToast('Network error'); }
};

window.rejectLevel2 = async function(email) {
  if (!confirm('Reject this unlock request?')) return;
  try {
    const res = await apiCall('rejectLevel2', { studentEmail: email });
    if (res.status === 'success') { showToast('Request rejected'); loadLevel2Requests(); }
    else showToast('Failed: ' + res.message);
  } catch(e) { showToast('Network error'); }
};

// ── Analytics ───────────────────────────────────────────────
async function loadAdminAnalytics() {
  const tbody = document.getElementById('adminAnalyticsBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Loading…</td></tr>';
  try {
    const data = await apiCall('getAnalytics');
    if (data.status === 'success' && data.data?.attempts?.length) {
      tbody.innerHTML = data.data.attempts.map(att => {
        const av = avColor(att.name);
        const vBadge = att.violations > 0
          ? `<span class="a-badge a-badge-expired">${att.violations} Violations</span>`
          : `<span class="a-badge a-badge-active">Clean</span>`;
        const typeLabel = att.type === 'violation submit'
          ? `<span style="color:var(--red-text);font-weight:600">Forced</span>` : (att.type||'—');
        return `<tr>
          <td>
            <div class="a-user-cell">
              <div class="a-cell-avatar ${av}">${initials(att.name)}</div>
              <div>
                <div class="a-cell-name">${escHtml(att.name)}</div>
                <div class="a-cell-sub">${escHtml(att.email)}</div>
              </div>
            </div>
          </td>
          <td>${escHtml(att.testTitle)}</td>
          <td style="font-family:var(--mono);font-weight:700">${att.score}</td>
          <td>${typeLabel}</td>
          <td>${vBadge}</td>
          <td style="font-size:12px;color:var(--text-muted)">${new Date(att.timestamp).toLocaleString()}</td>
        </tr>`;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">No attempts recorded yet.</td></tr>';
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red-text)">Failed to load analytics.</td></tr>';
  }
}

// ── Leaderboard ─────────────────────────────────────────────
async function loadAdminLeaderboard() {
  const tbody = document.getElementById('adminLeaderboardBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Loading…</td></tr>';
  try {
    const data = await apiCall('getLeaderboard');
    const lbData = data.data?.leaderboard || data.leaderboard;
    if (data.status === 'success' && lbData?.length) {
      tbody.innerHTML = lbData.map((lb, i) => {
        const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
        const av = avColor(lb.studentName);
        return `<tr>
          <td style="font-weight:700;font-size:15px">${medal||'#'+lb.currentRank}</td>
          <td>
            <div class="a-user-cell">
              <div class="a-cell-avatar ${av}">${initials(lb.studentName)}</div>
              <div>
                <div class="a-cell-name">${escHtml(lb.studentName)}</div>
                <div class="a-cell-sub">${escHtml(lb.email)}</div>
              </div>
            </div>
          </td>
          <td>${lb.testsAttempted}</td>
          <td>${lb.avgScore}</td>
          <td style="font-family:var(--mono);font-weight:700;color:var(--navy)">${lb.totalPoints}</td>
          <td>${escHtml(lb.earnedRewards||'None')}</td>
          <td>
            <div class="a-action">
              <button class="a-link-btn" onclick="updateLBRank('${lb.email}')">Rank</button>
              <button class="a-link-btn" onclick="hideLBEntry('${lb.email}')">Hide</button>
              <button class="a-link-btn del" onclick="deleteLBEntry('${lb.email}')">Del</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No leaderboard data.</td></tr>';
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red-text)">Failed to load.</td></tr>';
  }
}

window.updateLBRank = async function(email) {
  const newRank = prompt('Enter new rank for ' + email + ':');
  if(!newRank) return;
  try {
    const res = await apiCall('updateLBRank', { email, rank: parseInt(newRank, 10) });
    if(res.status==='success') { showToast('✅ Rank updated'); loadAdminLeaderboard(); }
    else showToast('❌ ' + res.message);
  } catch(e) { showToast('❌ Network error'); }
};

window.hideLBEntry = async function(email) {
  if(!confirm('Hide ' + email + ' from public leaderboard?')) return;
  try {
    const res = await apiCall('hideLBEntry', { email });
    if(res.status==='success') { showToast('✅ Hidden'); loadAdminLeaderboard(); }
    else showToast('❌ ' + res.message);
  } catch(e) { showToast('❌ Network error'); }
};

window.deleteLBEntry = async function(email) {
  if(!confirm('Delete ' + email + ' from leaderboard?')) return;
  try {
    const res = await apiCall('deleteLBEntry', { email });
    if(res.status==='success') { showToast('✅ Deleted'); loadAdminLeaderboard(); }
    else showToast('❌ ' + res.message);
  } catch(e) { showToast('❌ Network error'); }
};

let _lbIsVisible = true;
window.toggleLeaderboardVisibility = async function() {
  _lbIsVisible = !_lbIsVisible;
  const btn = document.getElementById('toggle-lb-visibility');
  try {
    const res = await apiCall('toggleLeaderboardVisibility', { visible: _lbIsVisible });
    if(res.status==='success') {
      btn.innerHTML = _lbIsVisible ? '👁️ Hide LB' : '🚫 LB Hidden';
      showToast('✅ Visibility updated');
    } else showToast('❌ ' + res.message);
  } catch(e) { showToast('❌ Network error'); }
};

async function resetLeaderboard() {
  if (!confirm('Reset all rankings? This cannot be undone.')) return;
  try {
    const data = await apiCall('resetLeaderboard');
    showToast(data.status === 'success' ? 'Leaderboard reset!' : '❌ Failed: ' + data.message);
    if (data.status === 'success') loadAdminLeaderboard();
  } catch(e) { showToast('❌ Network error.'); }
}

async function declareWinners() {
  if (!confirm('Declare winners and send notifications?')) return;
  try { await apiCall('declareWinners', {}); } catch(_) {}
  showToast('🏆 Winners declared! Notifications dispatched.');
}



// ── Level 2 Config ──────────────────────────────────────────
window.loadLevel2Status = async function() {
  try {
    const data = await apiCall('getLevel2Status');
    if (data.status === 'success' && data.data?.level2) {
      const l2 = data.data.level2;
      if (l2.date) {
        const d = new Date(l2.date);
        if (!isNaN(d.getTime())) {
          document.getElementById('l2-date').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
      }
      if (l2.time) {
        let tv = l2.time;
        if (tv.includes('T')) { const d=new Date(tv); tv=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
        document.getElementById('l2-time').value = tv;
      }
      if (l2.meetLink) document.getElementById('l2-meet').value = l2.meetLink;
      if (l2.status) document.getElementById('l2-status').value = l2.status;
    }
  } catch(e) { console.error(e); }
};

window.saveLevel2Config = async function() {
  const btn = document.querySelector('#section-level2-config .a-btn-primary');
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const data = await apiCall('scheduleLevel2', {
      level2Date: document.getElementById('l2-date').value,
      level2Time: document.getElementById('l2-time').value,
      meetLink: document.getElementById('l2-meet').value.trim(),
      status: document.getElementById('l2-status').value
    });
    showToast(data.status === 'success' ? '✅ Config saved & notifications sent!' : '❌ Failed: ' + (data.message||'Error'));
  } catch(e) { showToast('❌ Network error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Configuration'; }
};

// ── JSON File Upload ────────────────────────────────────────
function handleJsonFile(input) {
  const file = input.files[0];
  if (file) showJsonPreview(file);
}

function handleJsonDrop(event) {
  event.preventDefault();
  document.getElementById('jsonDropZone').style.borderColor = 'var(--card-border)';
  const file = event.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.endsWith('.json')) { showToast('❌ Only .json files are allowed'); return; }
  showJsonPreview(file);
}

function showJsonPreview(file) {
  if (!file.name.endsWith('.json')) { showToast('❌ Only .json files allowed'); return; }
  if (file.size > 5*1024*1024) { showToast('❌ File exceeds 5 MB'); return; }
  document.getElementById('jsonFileName').textContent = file.name;
  document.getElementById('jsonFileSize').textContent = (file.size/1024).toFixed(1) + ' KB';
  const preview = document.getElementById('jsonFilePreview');
  preview.style.display = 'flex';
  _selectedFileForUpload = file;
  const titleInput = document.getElementById('create-chapter');
  if (!titleInput.value) titleInput.value = file.name.replace(/\.testseries\.json$|\.json$/,'').replace(/_/g,' ');
}

function clearJsonFile(e) {
  if (e) e.stopPropagation();
  document.getElementById('jsonFileInput').value = '';
  document.getElementById('jsonFilePreview').style.display = 'none';
  _selectedFileForUpload = null;
}

function parseTestSeriesJson(data, filename) {
  if (!data || typeof data !== 'object') { showToast('⚠️ JSON must be an object'); return null; }
  let questions = (data.questions||[]).map((q,idx) => {
    let qText = q.question || q.q || '';
    if (typeof qText === 'string') qText = qText.replace(/\n/g, '<br>');

    let opts = q.options || q.opts || [];
    if (typeof opts === 'object' && !Array.isArray(opts)) {
      opts = [opts.A||opts.a, opts.B||opts.b, opts.C||opts.c, opts.D||opts.d, opts.E||opts.e].filter(Boolean);
    }
    opts = opts.map(o => typeof o === 'string' ? o.replace(/\n/g, '<br>') : o);

    let ans = q.correctAnswer !== undefined ? q.correctAnswer : (q.answer !== undefined ? q.answer : (q.ans !== undefined ? q.ans : null));
    if (typeof ans === 'string') {
      const uAns = ans.toUpperCase().trim();
      if (/^[A-E]$/.test(uAns)) ans = uAns.charCodeAt(0) - 65;
      else {
        // Try to match value exactly
        const matchIdx = opts.findIndex(o => (o||'').toString().trim().toLowerCase() === uAns.toLowerCase());
        if (matchIdx !== -1) ans = matchIdx;
        else ans = parseInt(ans) || 0;
      }
    }

    return {
      ...q, id: q.id || idx + 1,
      q: qText,
      opts: opts,
      diff: q.diff || 'medium',
      ans: ans
    };
  });
  
  if (!questions.length) { showToast('⚠️ No questions found'); return null; }
  for (let i=0;i<questions.length;i++) {
    const q = questions[i];
    if (!q.q) { showToast(`⚠️ Q${i+1} missing question text`); return null; }
    if (!Array.isArray(q.opts)||q.opts.length<2) { showToast(`⚠️ Q${i+1} invalid options`); return null; }
    if (q.ans===undefined||q.ans===null||typeof q.ans!=='number'||q.ans<0||q.ans>=q.opts.length) { showToast(`⚠️ Q${i+1} invalid answer. Expected 0 to ${q.opts.length-1}`); return null; }
  }
  return questions;
}

async function handleUnifiedTestCreate() {
  if (typeof getLoggedInUser === 'function') {
    const _u = getLoggedInUser(); if (!_u||_u.role!=='admin') { showToast('❌ Admin access required'); return; }
  }
  const level = document.getElementById('create-level').value;
  const subject = document.getElementById('create-subject').value.trim();
  const chapter = document.getElementById('create-chapter').value.trim();
  const duration = parseInt(document.getElementById('create-duration').value)||60;
  const priceType = document.getElementById('create-pricing-type').value;
  const price = parseInt(document.getElementById('create-price').value)||0;
  const status = document.getElementById('create-status').value;
  const startTime = document.getElementById('create-start-time').value;
  const endTime = document.getElementById('create-end-time').value;
  const negativeMarking = parseFloat(document.getElementById('create-negative-mark').value)||0;
  const prize1 = parseInt(document.getElementById('create-prize-1').value)||0;
  const prize2 = parseInt(document.getElementById('create-prize-2').value)||0;
  const prize3 = parseInt(document.getElementById('create-prize-3').value)||0;
  const description = document.getElementById('create-description').value.trim();
  if (!chapter) { showToast('⚠️ Please enter a Title/Chapter'); return; }
  const title = subject ? `${subject} - ${chapter}` : chapter;
  const btn = document.getElementById('create-test-btn');
  btn.disabled = true; btn.textContent = 'Processing…';

  const performCreation = async (questions) => {
    const payload = {
      title, subject, level: level.toLowerCase(), duration,
      totalQuestions: questions.length, status, startTime, endTime, negativeMarking,
      prize1, prize2, prize3, description,
      testData: { title, subject, duration, total: questions.length, level: level.toLowerCase(), questions, status, startTime, endTime, negativeMarking }
    };
    try {
      const data = await apiCall('createTest', payload);
      if (data.status === 'success') {
        await apiCall('updatePricing', { testId: data.data?.testId||data.testId, testTitle: title, price, discountPrice: price, testType: priceType, packageName:'', status:'active' });
        showToast(`✅ Test "${title}" created!`);
        document.getElementById('create-chapter').value = '';
        clearJsonFile();
        loadManageTests();
      } else showToast('❌ Failed: ' + (data.message||'Unknown error'));
    } catch(e) { showToast('❌ Network error saving test.'); }
    finally { btn.disabled = false; btn.textContent = 'Create Test'; }
  };

  if (_selectedFileForUpload) {
    const reader = new FileReader();
    reader.onload = function(e) {
      let raw;
      try { raw = JSON.parse(e.target.result); }
      catch { showToast('❌ Invalid JSON'); btn.disabled=false; btn.textContent='Create Test'; return; }
      const qs = parseTestSeriesJson(raw, _selectedFileForUpload.name);
      if (!qs) { btn.disabled=false; btn.textContent='Create Test'; return; }
      performCreation(qs);
    };
    reader.readAsText(_selectedFileForUpload);
  } else { performCreation([]); }
}

// ── Refresh system (manual only) ───────────────────────────────
let _lastRefreshed = {};
let _loadedSections = new Set();

const SECTION_LOADERS = {
  'dashboard':     () => { loadAdminDashboardStats(); loadLevel2Requests(); },
  'manage-tests':  () => loadManageTests(),
  'students':      () => loadAdminStudents(),
  'analytics':     () => loadAdminAnalytics(),
  'unlock':        () => loadLevel2Requests(),
  'leaderboard':   () => loadAdminLeaderboard(),
  'level2-config': () => { if (typeof window.loadLevel2Status === 'function') window.loadLevel2Status(); },
};

function _runLoader(section) {
  const fn = SECTION_LOADERS[section];
  if (!fn) return;
  try { fn(); } catch(e) { console.warn('Loader error:', section, e); }
  _lastRefreshed[section] = Date.now();
  _loadedSections.add(section);
  const badge = document.getElementById('refresh-badge-' + section);
  if (badge) { badge.textContent = 'Updated'; }
}

function refreshNow(section) {
  _runLoader(section);
  const badge = document.getElementById('refresh-badge-' + section);
  if (badge) {
    badge.textContent = 'Just now';
    badge.classList.add('fresh');
    setTimeout(() => badge && badge.classList.remove('fresh'), 2000);
  }
}

// Load a section once when first navigated to
function loadSectionOnce(section) {
  if (!_loadedSections.has(section)) _runLoader(section);
}

// ── navTo: update view and lazy-load ────────────────────────
const VIEW_TO_SECTION = {
  'view-dashboard':    'dashboard',
  'view-manage-tests': 'manage-tests',
  'view-students':     'students',
  'view-analytics':    'analytics',
  'view-unlock':       'unlock',
  'view-leaderboard':  'leaderboard',
  'view-level2-config':'level2-config',
};

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  try {
    const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : null;
    if (user) {
      const init = (user.fullName||user.name||'A').trim().split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
      const firstName = (user.fullName||user.name||'Admin').split(' ')[0];
      document.getElementById('sidebar-initials').textContent = init;
      document.getElementById('sidebar-name').textContent = user.fullName||user.name||'Admin';
      document.getElementById('admin-user-info-small').textContent = init;
      document.getElementById('nav-user-name').textContent = '👋 ' + firstName;
    }
  } catch(e) {}

  // Show only dashboard view on load
  document.querySelectorAll('.a-view').forEach(v => v.style.display = 'none');
  const dashView = document.getElementById('view-dashboard');
  if (dashView) dashView.style.display = 'block';

  // Load only the dashboard section once on init
  _runLoader('dashboard');
});

