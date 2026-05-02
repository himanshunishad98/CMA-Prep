// ── POPULATE USER DETAILS FROM SESSION ─────────────
// Removed: Duplicate of populateUserDetails in auth-guard.js
// ───────────────────────────────────────────────────

// PAGE NAV
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  // Restore active state on the matching nav link
  const activeLink = document.querySelector(`.nav-link[onclick*="'${id}'"]`);
  if (activeLink) activeLink.classList.add('active');
  window.scrollTo(0, 0);
}

// TEST FILTERS — operates on dynamically-rendered cards
var _activeFilter = 'all';
function filterTests(level, clickedEl) {
  _activeFilter = level;
  const tabs = document.querySelectorAll('.level-tab');
  tabs.forEach(t => t.classList.remove('active-f','active-i','active-fn','active-all'));
  // find clicked tab
  const clicked = clickedEl || event?.target;
  if (clicked) {
    if (level === 'all')          clicked.classList.add('active-all');
    else if (level === 'foundation')   clicked.classList.add('active-f');
    else if (level === 'intermediate') clicked.classList.add('active-i');
    else                               clicked.classList.add('active-fn');
  }
  document.querySelectorAll('#testsGrid .test-card').forEach(c => {
    c.style.display = (level === 'all' || c.dataset.level === level) ? '' : 'none';
  });
}

// SIDEBAR
function activeSidebar(el) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// OPTION SELECT
function selectOption(el) {
  el.closest('.options-list').querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// MODALS
function showModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// TOAST
function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    const msgEl = document.getElementById('toastMsg');
    if (msgEl) msgEl.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }
}

// ── CENTRALIZED API CALL ──────────────────────────────────────────────
async function apiCall(action, payload = {}) {
var GAS = (typeof APPS_SCRIPT_URL !== 'undefined') ? APPS_SCRIPT_URL : (typeof GAS_URL !== 'undefined' ? GAS_URL : '');
  if (!GAS) {
    const msg = 'Backend URL not configured';
    typeof showToastCustom === 'function' ? showToastCustom(msg, true) : showToast(msg);
    return { status: 'error', message: msg };
  }

  const reqBody = { action, ...payload };
  
  if (typeof getLoggedInUser === 'function') {
    const user = getLoggedInUser();
    if (user) {
      if (!reqBody.email) reqBody.email = user.email;
      if (!reqBody.userRole) reqBody.userRole = user.role;
      if (!reqBody.token) reqBody.token = user.token;
    }
  }

  try {
    const res = await fetch(GAS, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      redirect: 'follow',
      body: JSON.stringify(reqBody)
    });
    
    if (!res.ok) {
      throw new Error(`Server returned ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from server');
    }
    
    if (data.status === 'error' && data.message) {
      // Suppress auth errors for unauthenticated public visitors
      const _isUnauth = data.message.toLowerCase().includes('unauthorized');
      const _loggedIn = typeof getLoggedInUser === 'function' && !!getLoggedInUser();
      if (!_isUnauth || _loggedIn) {
        typeof showToastCustom === 'function' ? showToastCustom(data.message, true) : showToast(data.message);
      }
    }
    
    return data;
  } catch (err) {
    console.error(`API Error [${action}]:`, err);
    let errorMsg = 'Network error or server unreachable';
    if (err.message && err.message.includes('403')) {
      errorMsg = 'Access denied. Check backend deployment permissions.';
    } else if (err.message) {
      errorMsg = err.message;
    }
    typeof showToastCustom === 'function' ? showToastCustom(errorMsg, true) : showToast(errorMsg);
    return { status: 'error', message: errorMsg, data: null };
  }
}

// TIMER
let timeLeft = 28 * 60 + 45;
setInterval(() => {
  const timerEl = document.getElementById('timerDisplay');
  const testPage = document.getElementById('page-test');
  if (timeLeft > 0 && timerEl && testPage && testPage.classList.contains('active')) {
    timeLeft--;
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timerEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    if (timeLeft < 300) timerEl.style.color = '#E53E3E';
  }
}, 1000);

// ── LOAD AVAILABLE TESTS FROM BACKEND ───────────────────────────────────────
let _loadedTests = []; // array of fetched test objects

async function loadAvailableTests() {
  const grid = document.getElementById('testsGrid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">⏳ Loading tests...</div>';
  
  try {
    const data = await apiCall('getTests');
    if (data.status === 'success') {
      _loadedTests = (data.data?.tests || data.tests || [])
        .filter(t => {
          const st = (t.status || (t.testData && t.testData.status) || 'live').toLowerCase();
          if (st !== 'live' && st !== 'upcoming') return false;
          const now = new Date();
          const end = t.endTime || (t.testData && t.testData.endTime);
          if (end && new Date(end) < now) return false;
          return true;
        })
        .map(t => ({
          id: t.testId,
          title: t.title || 'Untitled',
          duration: t.duration || 60,
          level: detectLevel(t.level),
          total: t.totalQuestions || (t.testData && t.testData.questions ? t.testData.questions.length : 0),
          pricing: t.pricing || { testType: 'Free', price: 0 },
          startTime: t.startTime || (t.testData && t.testData.startTime),
          endTime: t.endTime || (t.testData && t.testData.endTime),
          status: (t.status || 'live').toLowerCase()
        }));
      
      renderTestCards();
      renderEnrollCards();
    } else {
      if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text3)">No tests available right now. Check back soon.</div>`;
    }
  } catch (e) {
    console.error('Failed to load available tests', e);
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red)">Network error loading tests.</div>';
  }
}

async function loadPublicLeaderboard() {
  const tbody = document.getElementById('publicLeaderboardBody');
  if (!tbody) return;
  
  try {
    const data = await apiCall('getLeaderboard');
    if (data.status === 'success' && data.data && data.data.leaderboard && data.data.leaderboard.length > 0) {
      let htmlStr = '';
      const limit = data.data.leaderboardLimit || data.leaderboardLimit || data.data.leaderboard.length;
      data.data.leaderboard.slice(0, limit).forEach(lb => {
        const r = parseInt(lb.currentRank);
        let rankBadge = `<span class="rank-medal medal-n">${r}</span>`;
        if (r === 1) rankBadge = `<span class="rank-medal medal-1">🥇</span>`;
        if (r === 2) rankBadge = `<span class="rank-medal medal-2">🥈</span>`;
        if (r === 3) rankBadge = `<span class="rank-medal medal-3">🥉</span>`;
        
        htmlStr += `
          <tr>
            <td>${rankBadge}</td>
            <td><strong>${escHtml(lb.studentName)}</strong></td>
            <td><span class="test-tag tag-intermediate">CMA</span></td>
            <td>${lb.testsAttempted}</td>
            <td>${lb.avgScore}</td>
            <td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--navy)">${lb.totalPoints}</td>
          </tr>
        `;
      });
      tbody.innerHTML = htmlStr;
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">No leaderboard data yet.</td></tr>';
    }
  } catch (e) {
    console.error('Failed to load leaderboard', e);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red)">Failed to load leaderboard.</td></tr>';
  }
}

/**
 * Very simple heuristic: guess CMA level from text.
 * Falls back to a generic tag so all tests are still displayed.
 */
function detectLevel(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('final')) return 'final';
  if (t.includes('inter') || t.includes('intermediate')) return 'intermediate';
  if (t.includes('foundation') || t.includes('found')) return 'foundation';
  return 'general'; // no CMA level detected
}

/** Returns CSS tag class and label for a level string */
function levelMeta(level) {
  switch (level) {
    case 'foundation':   return { cls: 'tag-foundation',   label: 'Foundation',   chipBg: '#EEF2FF', chipClr: '#4338CA' };
    case 'intermediate': return { cls: 'tag-intermediate', label: 'Intermediate',  chipBg: '#FFF7ED', chipClr: '#C2410C' };
    case 'final':        return { cls: 'tag-final',        label: 'Final',         chipBg: '#F0FDF4', chipClr: '#166534' };
    default:             return { cls: 'tag-foundation',   label: 'General',       chipBg: '#F3F4F6', chipClr: '#374151' };
  }
}

/**
 * Renders test cards into #testsGrid from _loadedTests.
 * Shows/hides the empty state and level-tab row.
 */
function renderTestCards() {
  const grid  = document.getElementById('testsGrid');
  const empty = document.getElementById('testsEmpty');
  const tabs  = document.getElementById('levelTabsRow');
  if (!grid) return;

  grid.innerHTML = '';

  if (_loadedTests.length === 0) {
    if (empty) empty.style.display = '';
    if (tabs)  tabs.style.display  = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (tabs)  tabs.style.display  = '';

  _loadedTests.forEach(test => {
    const lm = levelMeta(test.level);
    const dataLevel = test.level === 'general' ? 'foundation' : test.level; // fallback for filter
    const card = document.createElement('div');
    card.className = 'test-card';
    card.dataset.level = dataLevel;

    // Apply current filter
    if (_activeFilter !== 'all' && dataLevel !== _activeFilter) card.style.display = 'none';

    const safeTitle = test.title.replace(/'/g, "\\'");
    const diffText = test.diff && Object.keys(test.diff).length
      ? Object.entries(test.diff).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(' · ')
      : `${test.total} questions`;

    const priceText = (test.pricing && test.pricing.testType === 'Paid') 
      ? `₹${test.pricing.price}` 
      : 'FREE';

    card.innerHTML = `
      <div class="test-card-header">
        <span class="test-tag ${lm.cls}">${lm.label}</span>
        <span class="chip" style="background:${lm.chipBg};color:${lm.chipClr}">📝 ${test.total} MCQs</span>
      </div>
      <div class="test-card-title">${escHtml(test.title)}</div>
      <div class="test-card-sub" style="font-size:12px;color:var(--text3)">${escHtml(diffText)}</div>
      <div class="test-meta">
        <span class="test-meta-item">⏱ ${test.duration} min</span>
        ${test.createdAt ? `<span class="test-meta-item">📅 ${test.createdAt}</span>` : ''}
        ${test.source ? `<span class="test-meta-item" title="Generated from ${escHtml(test.source)}">📄 ${escHtml(shortenFilename(test.source))}</span>` : ''}
      </div>
      <div class="test-card-footer flex-between">
        <span style="font-weight:bold;color:var(--gold2)">${priceText}</span>
        ${test.status === 'upcoming'
          ? `<span style="font-size:11.5px;padding:5px 10px;border-radius:6px;background:#EFF6FF;color:#1D4ED8;font-weight:600;border:1px solid #BFDBFE">🔔 Upcoming</span>
             <button class="btn btn-navy btn-sm"
               onclick="openEnrollModal('${safeTitle}','${lm.label}','Upcoming – Available soon', '${priceText}', '${test.duration || 60}')">
               Pre-Enroll
             </button>`
          : `<button class="btn btn-navy btn-sm"
               onclick="openEnrollModal('${safeTitle}','${lm.label}','Available now', '${priceText}', '${test.duration || 60}')">
               Enroll Now
             </button>`
        }
      </div>`;
    grid.appendChild(card);
  });
}

/**
 * Mirrors renderTestCards but produces enroll-card rows in #enrollCardsContainer.
 */
function renderEnrollCards() {
  const container = document.getElementById('enrollCardsContainer');
  const empty     = document.getElementById('enrollEmpty');
  if (!container) return;

  container.innerHTML = '';

  if (_loadedTests.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  _loadedTests.forEach(test => {
    const lm = levelMeta(test.level);
    const safeTitle = test.title.replace(/'/g, "\\'");
    const icons = ['📐','📚','📊','🔬','📈','🏛','⚖️','📋'];
    const icon  = icons[Math.abs(hashStr(test.title)) % icons.length];
    const diffText = test.diff && Object.keys(test.diff).length
      ? Object.entries(test.diff).filter(([,v])=>v>0).map(([k,v])=>`${k}: ${v}`).join(' · ')
      : `${test.total} questions`;

    const card = document.createElement('div');
    card.className = 'enroll-card';
    card.innerHTML = `
      <div class="enroll-icon">${icon}</div>
      <div class="enroll-info">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span class="test-tag ${lm.cls}">${lm.label}</span>
          <span class="chip" style="background:#F0FDF4;color:#166534">Level 1</span>
        </div>
        <div class="enroll-title">${escHtml(test.title)}</div>
        <div class="enroll-meta-row">
          <span class="enroll-meta">📝 ${escHtml(diffText)}</span>
          <span class="enroll-meta">⏱ ${test.duration} minutes</span>
          <span class="enroll-meta">📋 ${test.total} MCQs</span>
          ${test.createdAt ? `<span class="enroll-meta">📅 ${test.createdAt}</span>` : ''}
        </div>
        ${test.source ? `<div class="enroll-tags"><span class="enroll-tag">📄 ${escHtml(shortenFilename(test.source))}</span></div>` : ''}
      </div>
      <div class="enroll-actions">
        <div class="price-tag free">${(test.pricing && test.pricing.testType === 'Paid') ? '₹'+test.pricing.price : 'FREE'}</div>
        <button class="btn btn-gold"
          onclick="openEnrollModal('${safeTitle}','${lm.label}','Available now', '${(test.pricing && test.pricing.testType === 'Paid') ? '₹'+test.pricing.price : 'FREE'}', '${test.duration || 60}')">
          Enroll →
        </button>
      </div>`;
    container.appendChild(card);
  });
}

// ── UTILITIES ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortenFilename(name) {
  return name.length > 28 ? name.slice(0, 25) + '…' : name;
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// ══════════════════════════════════════════════════════════════════════════
//  DASHBOARD — Dynamic Enrollment Loader
//  Fetches this student's enrolled tests from the GAS backend and renders
//  them into dashboard.html's dynamic containers.
//
//  Called once on DOMContentLoaded (from the inline <script> in dashboard.html
//  or from auth-guard's populateUserDetails hook — see bottom of this section).
// ══════════════════════════════════════════════════════════════════════════

/**
 * Main entry point. Reads the session, hits GAS, renders everything.
 * Safe to call only when on dashboard.html (checks for #enrolledList).
 */
async function loadDashboardEnrollments() {
  if (!document.getElementById('enrolledList')) return; // not on dashboard

  // Grab session — auth-guard.js must be loaded
  const user = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  if (!user) return; // guard already redirects, just bail

  // ── Show loading state ──────────────────────────────────────────
  _dashEl('enrolledLoading', el => el.style.display = '');
  _dashEl('enrolledList',    el => el.innerHTML = '');
  _dashEl('enrolledEmpty',   el => el.style.display = 'none');
  _dashEl('liveTestBar',     el => el.style.display = 'none');

  let enrollments = [];

  try {
    const data = await apiCall('getEnrollments');
    if (data.status === 'success' && Array.isArray(data.data?.enrollments || data.enrollments)) {
      enrollments = data.data?.enrollments || data.enrollments;
    } else {
      console.warn('[Dashboard] GAS response:', data);
    }

    // Analytics & Leaderboard Stats
    try {
      const dataA = await apiCall('getAnalytics');
      if (dataA.status === 'success') {
        const attempts = dataA.data?.attempts || dataA.attempts;
        const unlockedLevel = dataA.data?.unlockedLevel || dataA.unlockedLevel;
        if (attempts) _renderRecentResults(attempts, unlockedLevel);
        const ulEl = document.getElementById('profile-unlocked-level');
        if (ulEl) ulEl.textContent = 'Level ' + (unlockedLevel || 1);
        
        if (unlockedLevel >= 2) {
          _renderLevel2Panel();
        }
        _loadNotifications();
      }
      
      const dataL = await apiCall('getLeaderboard');
      if (dataL.status === 'success') {
        const lbArray = dataL.data?.leaderboard || dataL.leaderboard;
        if (lbArray) {
          const myRank = lbArray.find(lb => (lb.email || '').toLowerCase() === user.email.toLowerCase());
          if (myRank) {
            const rankEl = document.getElementById('profile-rank');
            const ptsEl = document.getElementById('profile-points');
            const rewEl = document.getElementById('profile-rewards');
            const prEl = document.getElementById('profile-prize-eligibility');
            
            if (rankEl) rankEl.textContent = '#' + myRank.currentRank;
            if (ptsEl) ptsEl.textContent = myRank.totalPoints;
            if (rewEl) rewEl.textContent = myRank.earnedRewards || 'None';
            if (prEl) prEl.textContent = myRank.prizeEligibility || 'Eligible';
          } else {
             const prEl = document.getElementById('profile-prize-eligibility');
             if (prEl) prEl.textContent = 'Not Ranked';
          }
        }
      }
    } catch (err) {
      console.error('[Dashboard] Analytics/Leaderboard fetch failed', err);
    }

  } catch (err) {
    console.error('[Dashboard] Failed to fetch enrollments:', err);
    _renderEnrollError();
    return;
  }

  _dashEl('enrolledLoading', el => el.style.display = 'none');
  _renderDashEnrolledTests(enrollments);
  _renderDashStats(enrollments);
  _renderDashAdmitCards(enrollments);
}

// ── Render enrolled test rows ───────────────────────────────────────────────
function _renderDashEnrolledTests(enrollments) {
  const list = document.getElementById('enrolledList');
  if (!list) return;

  if (enrollments.length === 0) {
    _dashEl('enrolledEmpty', el => el.style.display = '');
    return;
  }

  const iconBgMap = {
    foundation:   '#EFF6FF',
    intermediate: '#FFF7ED',
    final:        '#F0FDF4',
  };
  const testIcons = ['📐','📚','📊','🔬','📈','🏛','⚖️','📋','💡','🗂️'];

  // Track first live test for the action bar
  let firstLiveTitle = null;
  let firstLiveId    = null;

  enrollments.forEach((enr, idx) => {
    const lvlKey = (enr.testLevel || '').toLowerCase();
    const iconBg = iconBgMap[lvlKey] || '#F3F4F6';
    const icon   = testIcons[idx % testIcons.length];

    // Determine status
    const attempted = (enr.attempted || '').toLowerCase() === 'yes';
    const statusVal = _getTestStatus(enr);
    const isLive    = !attempted && statusVal === 'live';
    const isExpired = statusVal === 'expired';
    const isUnlocked= (enr.unlocked || '').toLowerCase() === 'yes';

    if (isLive && !firstLiveTitle) {
      firstLiveTitle = enr.testTitle;
      firstLiveId    = enr.testId || enr.testTitle;
    }

    // Status pill HTML
    let pillHtml;
    if (attempted) {
      pillHtml = `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="status-pill status-upcoming">✅ Attempted</span>
          <button class="btn btn-outline btn-sm" style="color:var(--navy);border-color:var(--navy)" onclick="window.location.href='dashboard.html#section-recent'">View Result</button>
        </div>`;
    }
    else if (isLive || isUnlocked) {
      pillHtml = `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="status-pill status-${isLive ? 'live' : 'unlocked'}">${isLive ? '🔴 Live' : '🔓 L2 Unlocked'}</span>
          <button class="btn btn-navy btn-sm" onclick="window.location.href='test.html?id=${encodeURIComponent(enr.testId || enr.testTitle)}'">Attempt Test</button>
        </div>
      `;
    }
    else if (isExpired) {
      pillHtml = `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="status-pill status-locked">Expired</span>
          <button class="btn btn-outline btn-sm" style="color:var(--text3);border-color:var(--border)" disabled>Closed</button>
        </div>
      `;
    }
    else {
      // Upcoming
      const startText = enr.startTime ? new Date(enr.startTime).toLocaleString() : (enr.testDate || 'TBD');
      pillHtml = `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="status-pill status-upcoming">Upcoming</span>
          <div style="font-size:11px;color:var(--text3)">Starts at: ${startText}</div>
        </div>`;
    }

    // Score line (if attempted)
    const scoreLine = attempted && enr.score != null
      ? `<div style="font-size:11px;color:var(--green);font-weight:700;margin-top:4px">Score: ${enr.score}</div>`
      : '';

    // Date / unlock line
    const dateLine = isUnlocked
      ? `<div style="font-size:11px;color:var(--gold2);margin-bottom:4px">🔓 Unlocked by Admin</div>`
      : enr.testDate
        ? `<div style="font-size:11px;color:var(--text3);margin-bottom:4px">Date: ${escHtml(enr.testDate)}</div>`
        : '';

    const row = document.createElement('div');
    row.className = 'enrolled-test';
    row.innerHTML = `
      <div class="enrolled-icon" style="background:${iconBg}">${icon}</div>
      <div class="enrolled-info">
        <div class="enrolled-name">${escHtml(enr.testTitle || 'Unnamed Test')}</div>
        <div class="enrolled-sub">${escHtml(enr.testLevel || '')} · Level 1 Test</div>
        <div style="margin-top:6px">
          ${dateLine}
          <div class="progress-bar-wrap" style="width:160px">
            <div class="progress-bar" style="width:${attempted ? '100' : '0'}%"></div>
          </div>
          ${scoreLine}
        </div>
      </div>
      ${pillHtml}`;
    list.appendChild(row);
  });

  // Show live-test action bar
  if (firstLiveTitle) {
    _dashEl('liveTestBar',  el => el.style.display = '');
    _dashEl('liveTestBtn',  el => {
      el.textContent = `▶ Attempt Live Test – ${firstLiveTitle}`;
      el.onclick = () => window.location.href = `test.html?id=${encodeURIComponent(firstLiveId || firstLiveTitle)}`;
    });
  }
}

// ── Render stat counters ────────────────────────────────────────────────────
function _renderDashStats(enrollments) {
  const total    = enrollments.length;
  const live     = enrollments.filter(e => !((e.attempted||'').toLowerCase()==='yes') && _getTestStatus(e)==='live').length;
  const upcoming = enrollments.filter(e => !((e.attempted||'').toLowerCase()==='yes') && _getTestStatus(e)==='upcoming').length;
  const attempted= enrollments.filter(e => (e.attempted||'').toLowerCase()==='yes').length;

  _setText('stat-enrolled',  String(total));
  _setText('stat-live',      String(live));
  _setText('stat-upcoming',  String(upcoming));
  _setText('stat-attempted', String(attempted));

  // Sidebar badge
  const badge = document.getElementById('myTestsBadge');
  if (badge) {
    badge.textContent = String(total);
    badge.style.display = total > 0 ? '' : 'none';
  }

  // Update the greeting sub-line
  if (live > 0) {
    _setText('dash-subgreeting', `You have ${live} live test${live > 1 ? 's' : ''} available now!`);
  } else if (upcoming > 0) {
    _setText('dash-subgreeting', `You have ${upcoming} upcoming test${upcoming > 1 ? 's' : ''} this week`);
  } else if (total === 0) {
    _setText('dash-subgreeting', 'No tests enrolled yet. Go browse and enroll!');
  }
}

// ── Render admit cards ──────────────────────────────────────────────────────
function _renderDashAdmitCards(enrollments) {
  const body = document.getElementById('admitCardBody');
  if (!body) return;

  const loading = document.getElementById('admitCardLoading');
  if (loading) loading.style.display = 'none';

  // Show admit card for each non-attempted enrollment
  const pending = enrollments.filter(e => (e.attempted || '').toLowerCase() !== 'yes');

  if (pending.length === 0) {
    body.innerHTML = `<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">No upcoming tests — all done! 🎉</div>`;
    return;
  }

  pending.slice(0, 3).forEach(enr => {
    const block = document.createElement('div');
    block.style.cssText = 'margin-bottom:10px';
    block.innerHTML = `
      <div style="background:var(--gold-light);border:1px solid #FFD54F;border-radius:8px;padding:12px;font-size:13px;margin-bottom:8px">
        🎟️ <strong>${escHtml(enr.testTitle)}</strong><br>
        <span style="color:var(--text2)">${enr.testDate ? 'Date: ' + escHtml(enr.testDate) : 'Date: TBD'}</span>
      </div>
      <button class="btn btn-navy" style="width:100%;justify-content:center"
        onclick="showToast('Admit card for ${escHtml(enr.testTitle).replace(/'/g,"\\'")} — downloading (placeholder)')">
        📥 Download Admit Card
      </button>`;
    body.appendChild(block);
  });
}

// ── Error state ─────────────────────────────────────────────────────────────
function _renderEnrollError() {
  _dashEl('enrolledLoading', el => el.style.display = 'none');
  _dashEl('enrolledList', el => {
    el.innerHTML = `
      <div style="text-align:center;padding:28px 0;color:var(--red)">
        <div style="font-size:28px;margin-bottom:8px">⚠️</div>
        <div style="font-size:13.5px;font-weight:600">Could not load enrollments</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">Check your internet connection and refresh.</div>
        <button class="btn btn-sm btn-navy" style="margin-top:12px" onclick="loadDashboardEnrollments()">Retry</button>
      </div>`;
  });

  // Zero out stats
  ['stat-enrolled','stat-live','stat-upcoming','stat-attempted'].forEach(id => _setText(id, '—'));
}

// ── Utility: check if a test date string means "live now" ───────────────────
/**
 * Very simple heuristic. GAS may store dates as:
 *   "May 18, 2025"  →  compare with today (same day or past = live)
 *   "Available now" →  always live
 *   ISO string      →  parse and compare
 * Real production logic should use the `status` field from GAS.
 */
function _getTestStatus(testObj) {
  if (!testObj) return 'upcoming';
  
  if (testObj.status) {
    const s = testObj.status.toLowerCase();
    if (s === 'live') return 'live';
    if (s === 'expired' || s === 'completed') return 'expired';
    if (s === 'draft') return 'draft';
    return 'upcoming';
  }
  
  // Legacy fallback
  const dateStr = testObj.testDate || testObj.date;
  if (!dateStr) return 'upcoming';
  const s = dateStr.trim().toLowerCase();
  if (s === 'available now' || s === 'live') return 'live';
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'upcoming';
  const now = new Date();
  if (d > now) return 'upcoming';
  
  return 'live';
}

function _dashEl(id, fn) {
  const el = document.getElementById(id);
  if (el) fn(el);
}

function _renderRecentResults(attempts, unlockedLevel) {
  const levelEl = document.getElementById('profile-unlocked-level');
  if (levelEl) levelEl.textContent = 'Level ' + unlockedLevel;
  
  // also update user in session storage so auth-guard handles it
  const user = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  if (user) {
    user.unlockedLevel = unlockedLevel;
    sessionStorage.setItem('cmaUser', JSON.stringify(user));
  }

  const list = document.getElementById('recentResultsList');
  const loading = document.getElementById('recentResultsLoading');
  if (!list || !loading) return;
  loading.style.display = 'none';

  const validAttempts = attempts.filter(a => a.type !== 'start');

  if (!validAttempts || validAttempts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text3)">
      <div style="font-size:24px;margin-bottom:8px">📋</div>
      <div style="font-weight:600;color:var(--navy);font-size:14px;margin-bottom:4px">No recent results</div>
      <div style="font-size:12px">Attempt a test to see your results here.</div>
    </div>`;
    return;
  }

  list.innerHTML = '';
  validAttempts.slice(0, 5).forEach(att => {
    list.innerHTML += `
      <div style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px;">
        <div class="flex-between" style="font-weight:600;color:var(--navy);margin-bottom:4px">
          <span>${escHtml(att.testTitle)}</span>
          <span style="color:var(--gold2)">Score: ${att.score}</span>
        </div>
        <div class="flex-between" style="color:var(--text2);font-size:12px;">
          <span>${new Date(att.timestamp).toLocaleDateString()} · ${att.totalTime || '--'}</span>
          <span>${att.violations > 0 ? `<span style="color:var(--red)">${att.violations} Violations</span>` : `<span style="color:var(--green)">Clean</span>`}</span>
        </div>
      </div>
    `;
  });
}

// ── Level 2 Student Dashboard logic ───────────────────────────────────────
async function _renderLevel2Panel() {
  const panel = document.getElementById('student-level2-panel');
  if (!panel) return;
  panel.style.display = 'block';

  try {
    const data = await apiCall('getLevel2Status');
    if (data.status === 'success' && data.data?.level2) {
      const l2 = data.data.level2;
      _setText('s-l2-date', l2.date ? new Date(l2.date).toLocaleDateString(undefined, {weekday:'short', year:'numeric', month:'short', day:'numeric'}) : 'TBD');
      
      let timeDisplay = l2.time || 'TBD';
      if (l2.time && l2.time.includes('T')) {
        const d = new Date(l2.time);
        timeDisplay = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      }
      _setText('s-l2-time', timeDisplay);
      
      const stEl = document.getElementById('s-l2-status');
      if (stEl) {
        stEl.textContent = l2.status || 'Draft';
        stEl.style.color = (l2.status === 'Live') ? '#4ADE80' : ((l2.status === 'Upcoming') ? '#FCD34D' : '#FFF');
      }

      const btn = document.getElementById('s-l2-join-btn');
      if (btn) {
        if (l2.status === 'Live' && l2.meetLink) {
          btn.disabled = false;
          btn.onclick = () => window.open(l2.meetLink, '_blank');
        } else {
          btn.disabled = true;
          btn.onclick = null;
        }
      }
    }
  } catch (err) {
    console.error('Failed to load Level 2 status', err);
  }
}

// ── Notifications logic ───────────────────────────────────────────────────
window.toggleNotifications = function() {
  const panel = document.getElementById('notif-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
};

async function _loadNotifications() {
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');
  if (!list) return;

  try {
    const data = await apiCall('getNotifications');
    if (data.status === 'success' && data.data?.notifications) {
      const notifs = data.data.notifications;
      const unreadCount = notifs.filter(n => !n.isRead).length;
      
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      if (notifs.length === 0) {
        list.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3)">No notifications yet.</div>`;
        return;
      }

      list.innerHTML = '';
      notifs.forEach(n => {
        const bg = n.isRead ? '#fff' : '#EFF6FF';
        const fw = n.isRead ? 'normal' : '600';
        list.innerHTML += `
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);background:${bg};cursor:pointer;transition:background 0.2s" onclick="_markNotifRead(${n.id}, this)">
            <div style="font-weight:${fw};color:var(--navy);margin-bottom:4px">${escHtml(n.message)}</div>
            <div style="font-size:11px;color:var(--text3)">${new Date(n.timestamp).toLocaleDateString()}</div>
          </div>
        `;
      });
    }
  } catch(err) {
    console.error('Failed to load notifications', err);
  }
}

window._markNotifRead = async function(id, el) {
  if (el.style.background !== 'rgb(255, 255, 255)' && el.style.background !== '#fff') {
    el.style.background = '#fff';
    el.querySelector('div').style.fontWeight = 'normal';
    try {
      await apiCall('markNotificationRead', { id });
      _loadNotifications(); // Refresh badge count
    } catch(err) {
      console.error(err);
    }
  }
};

// ── Auto-trigger on dashboard.html DOMContentLoaded ────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('enrolledList')) {
    // Small delay so auth-guard's populateUserDetails runs first
    setTimeout(loadDashboardEnrollments, 300);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  TEST PORTAL LOGIC (test.html)
//  Handles loading test data from localStorage, rendering questions, timer, 
//  progress bar, navigation, and submitting the result to the backend.
// ══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('tp-qgrid')) {
    initTestPortal();
  }
});

let testData = null;
let currentQ = 0;
let answers = []; // array of selected option indices (0-3), null if unanswered
let timerInterval = null;
let secondsLeft = 0;
let marksForReview = [];

// Advanced State
let perQuestionTime = {}; 
let questionStartTime = Date.now();
let violations = 0;
let testIdKey = '';
let isSubmitting = false;

async function initTestPortal() {
  const urlParams  = new URLSearchParams(window.location.search);
  const testId     = urlParams.get('id');
  const attemptLevel = urlParams.get('level') || 'Level 1';
  window._attemptLevel = attemptLevel;

  const titleEl = document.getElementById('tp-title');
  const subEl   = document.getElementById('tp-subtitle');
  if (titleEl) titleEl.textContent = 'Loading Test…';

  try {
    let found = null;

    // ── Step 1: Try fast single-test lookup ───────────────────
    if (testId) {
      const r1 = await apiCall('getTestById', { testId });
      if (r1.status === 'success' && r1.data && r1.data.test) {
        found = r1.data.test;
      }
    }

    // ── Step 2: Fall back to full test list scan ──────────────
    if (!found) {
      const r2 = await apiCall('fetchTests');
      const allTests = (r2.data && r2.data.tests) ? r2.data.tests : (r2.tests || []);
      if (allTests.length === 0) throw new Error('No tests are currently available.');
      found = allTests.find(t => t.testId === testId)
           || allTests.find(t => t.title  === testId)
           || allTests[0];
    }

    if (!found) throw new Error('Test not found.');

    // ── Extract questions from JSON blob ──────────────────────
    let questions = [];
    if (found.testData && Array.isArray(found.testData.questions)) {
      questions = found.testData.questions;
    } else if (Array.isArray(found.questions)) {
      questions = found.questions;
    }
    if (questions.length === 0) throw new Error('This test has no questions uploaded yet. Please contact the admin.');

    // Normalise fields — support both `q`/`ans` and `question`/`correctAnswer`
    questions = questions.map(q => ({
      ...q,
      q: q.q || q.question,
      ans: q.ans !== undefined ? q.ans : (q.correctAnswer !== undefined ? q.correctAnswer : q.answer),
      opts: q.opts || q.options || []
    }));

    testData = {
      id:       found.testId,
      title:    found.title,
      duration: Number(found.duration) || 60,
      level:    found.level   || 'General',
      subject:  found.subject || found.title,
      questions
    };
  } catch (e) {
    console.error('[TestPortal]', e);
    if (titleEl) titleEl.textContent = 'Test Unavailable';
    if (subEl)   subEl.textContent   = e.message || 'Failed to load test data. Please go back and try again.';
    const backBtn = document.getElementById('tp-back-btn');
    if (backBtn) backBtn.style.display = '';
    return;
  }

  testIdKey = testData.id || testData.title;

  // Initialize state
  answers = new Array(testData.questions.length).fill(null);
  marksForReview = new Array(testData.questions.length).fill(false);
  secondsLeft = (testData.duration || 60) * 60;
  perQuestionTime = {};
  
  restoreTestState();
  if (!window.testEndTime) {
    window.testEndTime = Date.now() + (secondsLeft * 1000);
  }

  // Prevent multiple tabs
  const activeTabId = Math.random().toString(36).substr(2, 9);
  localStorage.setItem('cmaTestActiveTab_' + testIdKey, activeTabId);
  window.addEventListener('storage', (e) => {
    if (e.key === 'cmaTestActiveTab_' + testIdKey && e.newValue !== activeTabId) {
      if (!isSubmitting) {
        alert("This test is now open in another tab. This instance will be closed.");
        window.location.replace('dashboard.html');
      }
    }
  });

  // Render layout
  document.getElementById('tp-title').textContent = testData.title;
  document.getElementById('tp-subtitle').textContent = `${testData.level || 'General'} Level · ${testData.questions.length} Questions · Auto-submit on timer end`;
  
  initQuestionGrid();
  startTimer();
  initAntiCheat();
  
  questionStartTime = Date.now();
  renderQuestion(currentQ);
}

function saveTestState() {
  if (isSubmitting) return;
  
  // Track ongoing time for the current question
  const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
  const tempPerQuestionTime = { ...perQuestionTime };
  tempPerQuestionTime[currentQ] = (tempPerQuestionTime[currentQ] || 0) + timeSpent;

  const state = {
    answers,
    currentQ,
    secondsLeft,
    testEndTime: window.testEndTime,
    perQuestionTime: tempPerQuestionTime,
    violations,
    marksForReview
  };
  sessionStorage.setItem('cmaTestState_' + testIdKey, JSON.stringify(state));
}

function restoreTestState() {
  const stored = sessionStorage.getItem('cmaTestState_' + testIdKey);
  if (stored) {
    try {
      const state = JSON.parse(stored);
      answers = state.answers || answers;
      currentQ = state.currentQ || 0;
      secondsLeft = state.secondsLeft || secondsLeft;
      window.testEndTime = state.testEndTime || (Date.now() + (secondsLeft * 1000));
      perQuestionTime = state.perQuestionTime || {};
      violations = state.violations || 0;
      marksForReview = state.marksForReview || marksForReview;
    } catch(e) {}
  }
}

function initAntiCheat() {
  // Prevent returning to a blocked test
  const blocked = localStorage.getItem('cmaTestBlocked_' + testIdKey);
  if (blocked === 'true') {
    alert("You have been permanently blocked from attempting this test due to multiple violations.");
    window.location.replace('dashboard.html');
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handleCheatEvent();
  });
  window.addEventListener('blur', handleCheatEvent);
  window.addEventListener('pagehide', handleCheatEvent);
}

function handleCheatEvent() {
  if (isSubmitting) return;

  violations++;
  saveTestState();

  if (violations === 1) {
    alert("WARNING: Tab switching, minimizing, or leaving the window is not allowed during the test. Your next violation will result in automatic submission.");
  } else if (violations === 2) {
    alert("FINAL VIOLATION: The test will now automatically submit.");
    finishTest('violation submit');
  } else if (violations >= 3) {
    localStorage.setItem('cmaTestBlocked_' + testIdKey, 'true');
    finishTest('violation submit');
  }
}

function initQuestionGrid() {
  const grid = document.getElementById('tp-qgrid');
  grid.innerHTML = '';
  
  testData.questions.forEach((_, idx) => {
    const bubble = document.createElement('div');
    bubble.className = 'q-bubble';
    bubble.textContent = idx + 1;
    bubble.onclick = () => renderQuestion(idx);
    grid.appendChild(bubble);
  });
  updateGridUI();
}

function renderQuestion(index) {
  if (index < 0 || index >= testData.questions.length) return;
  
  // Save time spent on the previous question
  if (currentQ !== index) {
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    perQuestionTime[currentQ] = (perQuestionTime[currentQ] || 0) + timeSpent;
    questionStartTime = Date.now();
  }
  
  currentQ = index;
  const qData = testData.questions[index];
  
  document.getElementById('tp-qnum').textContent = `Question ${index + 1} of ${testData.questions.length}`;
  document.getElementById('tp-qtext').textContent = qData.q || 'Question text is missing.';
  
  const optsContainer = document.getElementById('tp-options');
  optsContainer.innerHTML = '';
  
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const isLocked = answers[currentQ] !== null;
  
  (qData.opts || qData.options || []).forEach((optText, optIdx) => {
    const optDiv = document.createElement('div');
    optDiv.className = `option ${answers[currentQ] === optIdx ? 'selected' : ''}`;
    
    if (isLocked) {
      optDiv.style.cursor = 'not-allowed';
      optDiv.style.opacity = answers[currentQ] === optIdx ? '1' : '0.6';
    } else {
      optDiv.onclick = () => selectOption(optIdx);
    }
    
    optDiv.innerHTML = `
      <div class="option-key">${labels[optIdx] || optIdx + 1}</div>
      <div class="option-text">${escHtml(optText)}</div>
    `;
    optsContainer.appendChild(optDiv);
  });
  
  // Navigation buttons state
  document.getElementById('tp-prev-btn').style.visibility = index === 0 ? 'hidden' : 'visible';
  document.getElementById('tp-next-btn').textContent = index === testData.questions.length - 1 ? 'Finish' : 'Next →';
  
  const markBtn = document.getElementById('tp-mark-btn');
  markBtn.textContent = marksForReview[currentQ] ? '★ Marked for review' : '☆ Mark for review';
  markBtn.style.color = marksForReview[currentQ] ? 'var(--gold)' : 'var(--text3)';
  
  updateGridUI();
}

function selectOption(optIdx) {
  if (answers[currentQ] !== null) return; // Lock permanently once selected
  
  answers[currentQ] = optIdx;
  
  // Re-render question to apply disabled state
  renderQuestion(currentQ);
  
  updateProgressBar();
  saveTestState();
  
  // Auto-advance after a short delay
  setTimeout(() => {
    if (currentQ < testData.questions.length - 1) {
      nextQuestion();
    }
  }, 600);
}

function nextQuestion() {
  if (currentQ < testData.questions.length - 1) {
    renderQuestion(currentQ + 1);
  } else {
    showSubmitModal();
  }
}

function prevQuestion() {
  if (currentQ > 0) {
    renderQuestion(currentQ - 1);
  }
}

function toggleMarkReview() {
  marksForReview[currentQ] = !marksForReview[currentQ];
  const markBtn = document.getElementById('tp-mark-btn');
  markBtn.textContent = marksForReview[currentQ] ? '★ Marked for review' : '☆ Mark for review';
  markBtn.style.color = marksForReview[currentQ] ? 'var(--gold)' : 'var(--text3)';
  updateGridUI();
  saveTestState();
}

function updateGridUI() {
  const grid = document.getElementById('tp-qgrid');
  let answeredCount = 0;
  
  Array.from(grid.children).forEach((bubble, idx) => {
    // Reset classes
    bubble.className = 'q-bubble';
    
    if (idx === currentQ) {
      bubble.classList.add('current');
    } else if (answers[idx] !== null) {
      bubble.classList.add('answered');
      answeredCount++;
    }
    
    // Add mark indicator styling
    if (marksForReview[idx] && idx !== currentQ) {
      bubble.style.borderColor = 'var(--gold)';
    } else if (!bubble.classList.contains('current') && !bubble.classList.contains('answered')) {
      bubble.style.borderColor = 'var(--border)';
    }
  });
  
  // Update counts
  const total = testData.questions.length;
  document.getElementById('tp-answered-count').textContent = `Answered (${answeredCount})`;
  document.getElementById('tp-unanswered-count').textContent = `Not attempted (${total - answeredCount})`;
  
  // Update progress bar
  updateProgressBar(answeredCount, total);
}

function updateProgressBar(answered = null, total = null) {
  if (answered === null) {
    answered = answers.filter(a => a !== null).length;
    total = testData.questions.length;
  }
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  document.getElementById('tp-progress').style.width = `${pct}%`;
}

function startTimer() {
  updateTimerDisplay();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsLeft = Math.max(0, Math.round((window.testEndTime - Date.now()) / 1000));
    
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      secondsLeft = 0;
      updateTimerDisplay();
      finishTest('timeout submit');
    } else {
      updateTimerDisplay();
      if (secondsLeft % 5 === 0) saveTestState();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  document.getElementById('tp-timer').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  
  if (secondsLeft < 300) { // last 5 minutes
    document.getElementById('tp-timer').style.color = 'var(--red)';
  }
}

function showSubmitModal() {
  const answered = answers.filter(a => a !== null).length;
  const total = testData.questions.length;
  const unanswered = total - answered;
  
  document.getElementById('submit-modal-sub').innerHTML = `You have attempted <strong>${answered} of ${total}</strong> questions. Are you sure you want to submit?`;
  
  const warn = document.getElementById('submit-modal-warning');
  if (unanswered > 0) {
    warn.style.display = 'block';
    warn.innerHTML = `⚠️ ${unanswered} questions are unanswered. Once submitted, you cannot change your answers.`;
  } else {
    warn.style.display = 'none';
  }
  
  showModal('submit-modal');
}

async function finishTest(subType = 'manual') {
  if (isSubmitting) return;
  isSubmitting = true;
  clearInterval(timerInterval);
  
  // Finalize last question time
  const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
  perQuestionTime[currentQ] = (perQuestionTime[currentQ] || 0) + timeSpent;
  saveTestState();
  
  const btn = document.getElementById('confirm-submit-btn');
  if (btn) {
    btn.textContent = 'Submitting...';
    btn.disabled = true;
  }
  
  // Calculate analytics
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  const negMark = parseFloat(testData.negativeMarking) || 0;

  testData.questions.forEach((q, i) => {
    let qAns = q.correctAnswer !== undefined ? q.correctAnswer : q.ans;
    if (qAns !== undefined && qAns !== null) {
      qAns = Number(qAns);
    }
    
    if (answers[i] === null || answers[i] === undefined) {
      unattempted++;
    } else if (qAns !== undefined && Number(answers[i]) === qAns) {
      score++;
      correct++;
    } else {
      score -= negMark;
      wrong++;
    }
  });
  
  // Prevent negative total score if desired, but usually negative marks can go below zero.
  // We'll leave it as is or bound to 0. Let's bind to 0 for display consistency unless negative is allowed.
  score = Math.max(0, score);
  
  const timeTakenSecs = ((testData.duration || 60) * 60) - secondsLeft;
  const timeTakenStr = `${Math.floor(timeTakenSecs / 60)}m ${timeTakenSecs % 60}s`;
  
  const userStr = sessionStorage.getItem('cmaUser');
  let user = {};
  if (userStr) {
    try { user = JSON.parse(userStr); } catch(e) {}
  }

  const attemptLevel = window._attemptLevel || 'Level 1';

  const attemptData = {
    testId:         testIdKey,
    testTitle:      testData.title,
    subject:        testData.subject || testData.title,
    score:          score,
    totalMarks:     testData.questions.length,
    correctAnswers: correct,
    wrongAnswers:   wrong,
    unattempted:    unattempted,
    totalTime:      timeTakenStr,
    perQuestionTiming: perQuestionTime,
    violations:     violations,
    submissionType: subType,
    attemptLevel:   attemptLevel,
    studentName:    user.fullName || user.name || 'Unknown',
    email:          user.email    || 'unknown@example.com',
    mobile:         user.mobile   || '',
    cmaRegNo:       user.cmaRegNo || ''
  };

  // Call auth-guard.js submitTestResult if available
  let res = null;
  if (typeof submitTestResult === 'function') {
    res = await submitTestResult(attemptData);
  } else {
    showToast(`Test submitted! Score: ${score}/${testData.questions.length}`);
    res = { status: 'success' };
  }
  
  if (res && res.status === 'success') {
    // Clear session state
    sessionStorage.removeItem('cmaTestState_' + testIdKey);
    closeModal('submit-modal');
    
    // Show Result Summary Page
    const tl = document.querySelector('.test-layout');
    const th = document.querySelector('.test-header');
    const pb = document.querySelector('.progress-bar-wrap');
    if (tl) tl.style.display = 'none';
    if (th) th.style.display = 'none';
    if (pb) pb.style.display = 'none';
    
    const rsc = document.getElementById('result-summary-container');
    if (rsc) {
      rsc.style.display = 'block';
      document.getElementById('rs-score').textContent = `${score}/${testData.questions.length}`;
      document.getElementById('rs-correct').textContent = correct;
      document.getElementById('rs-wrong').textContent = wrong;
      document.getElementById('rs-unattempted').textContent = unattempted;
      document.getElementById('rs-time').textContent = timeTakenStr;
    }
  } else {
    isSubmitting = false;
    if (btn) {
      btn.textContent = 'Submit Anyway';
      btn.disabled = false;
    }
    // Resume timer if it was manual
    if (subType === 'manual' && secondsLeft > 0) {
      timerInterval = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay();
        if (secondsLeft % 5 === 0) saveTestState();
        if (secondsLeft <= 0) finishTest('timeout submit');
      }, 1000);
    }
  }
}

// ── PROTECT AGAINST ACCIDENTAL EXITS ──────────────────────────────────────
window.addEventListener('beforeunload', (e) => {
  const testPage = document.getElementById('page-test');
  if (testPage && testPage.classList.contains('active') && !isSubmitting) {
    e.preventDefault();
    e.returnValue = '';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('testsGrid') || document.getElementById('enrollCardsContainer')) {
    loadAvailableTests();
  }
  if (document.getElementById('publicLeaderboardBody')) {
    loadPublicLeaderboard();
  }
});
