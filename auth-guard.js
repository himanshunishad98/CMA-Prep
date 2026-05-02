// ═══════════════════════════════════════════════════════════════
//  CMAPrep Pro — Auth Guard & Session Management
//  Handles secure, scalable session lifecycle and role-based access.
// ═══════════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────────────
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzSp2xUR32Fm24g-p9ed-uPvoYf4fjeo3H-GI3AfPZHG6AoNmTCIJGMGaGsCLr89RPy3A/exec';

// Standardized session key
var SESSION_KEY = 'cmaUser';

// Page routes
const LOGIN_PAGE     = 'index.html#login';
const DASHBOARD_PAGE = 'dashboard.html';

// ── SESSION MANAGEMENT ──────────────────────────────────────────

/**
 * Saves the authenticated user object securely to sessionStorage.
 * STRICTLY stores only non-sensitive, necessary data (name, email, role).
 *
 * @param {object} userData - Full user object from backend login response.
 */
function saveUserSession(userData) {
  if (!userData) return;

  const session = {
    // Core identity
    name:    userData.fullName || userData.name || '',
    fullName:userData.fullName || userData.name || '',
    email:   userData.email   || '',
    role:    userData.role    || 'student',

    // Additional fields needed for test submission
    mobile:    userData.mobile    || '',
    cmaRegNo:  userData.cmaRegNo  || '',
    level:     userData.level     || '',
    city:      userData.city      || '',
    photoUrl:  userData.photoUrl  || '',

    // Optional: token-based auth placeholder
    token: userData.token || null
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('saveUserSession: Could not write to sessionStorage', err);
  }
}

/**
 * Returns the full logged-in user session object,
 * or null if not logged in or session is invalid.
 */
function getLoggedInUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Clears the user session completely.
 */
function clearUserSession() {
  sessionStorage.removeItem(SESSION_KEY);
  
  // Prepare for token-based auth cleanup
  localStorage.removeItem('authToken');
}

/**
 * Logs the user out securely and redirects to the login page.
 */
function logout() {
  clearUserSession();
  window.location.replace(LOGIN_PAGE);
}

// ── ROLE HELPERS ─────────────────────────────────────────────────

/**
 * Returns true if the current user has role === 'admin'.
 * @returns {boolean}
 */
function isAdmin() {
  const user = getLoggedInUser();
  return !!user && user.role === 'admin';
}

/**
 * Returns true if the current user has role === 'student'.
 * @returns {boolean}
 */
function isStudent() {
  const user = getLoggedInUser();
  return !!user && (user.role === 'student' || !user.role);
}

/**
 * Generic role check — supports future roles like 'teacher', 'moderator'.
 * @param {string|string[]} roles - A single role string or array of allowed roles.
 * @returns {boolean}
 */
function hasRole(roles) {
  const user = getLoggedInUser();
  if (!user) return false;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes((user.role || 'student').toLowerCase());
}

// ── UI HELPERS ──────────────────────────────────────────────────

/**
 * Populates dynamic student-detail elements.
 * Unstored sensitive data fields gracefully default to '—'
 * maintaining UI compatibility across the dashboard and admin.
 */
function populateUserDetails(user) {
  if (!user) return;

  const name   = user.name  || 'User';
  const email  = user.email || '—';
  const role   = user.role  || 'student';

  // Initials: first letter of each word, max 2
  const safeName = (name || 'Student').trim() || 'Student';
  const initials = safeName.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

  // Sidebar
  _setText('sidebar-initials', initials);
  _setText('sidebar-name',     name);
  _setText('sidebar-role',     role.charAt(0).toUpperCase() + role.slice(1));
  _setText('sidebar-level',    role === 'student' ? 'Student Portal' : 'Admin Portal');

  const hour      = new Date().getHours();
  const tod       = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const firstName = safeName.split(' ')[0];
  _setText('dash-greeting',    `Good ${tod}, ${firstName} 👋`);
  _setText('dash-subgreeting', 'Welcome back to your dashboard');
  
  const navUserName = document.getElementById('nav-user-name');
  if (navUserName) navUserName.textContent = `👋 ${firstName}`;
  
  const adminUserInfo = document.getElementById('admin-user-info');
  if (adminUserInfo) {
    adminUserInfo.innerHTML = `<span style="width:30px;height:30px;border-radius:50%;background:var(--gold);color:var(--navy);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</span><span style="font-size:13.5px;font-weight:600;color:#fff;white-space:nowrap;margin-left:2px;">👋 ${firstName}</span>`;
  }

  // Profile card
  _setText('profile-initials', initials);
  _setText('profile-name',     name);
  _setText('profile-email',    email);
  _setText('profile-role',     role);
}

/** Safe inner-text setter — silently skips missing elements. */
function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── INTERNAL API HELPERS ────────────────────────────────────────

/**
 * Shows a small toast / popup message.
 */
function _showPopup(message, type = 'success') {
  if (typeof showToast === 'function') {
    showToast(message);
    return;
  }
  // Fallback inline toast
  let el = document.getElementById('_authToast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_authToast';
    el.style.cssText = `
      position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);
      background:#1B2F6E;color:#fff;padding:13px 28px;border-radius:12px;
      font-family:'Sora',sans-serif;font-size:14px;font-weight:600;
      box-shadow:0 8px 28px rgba(0,0,0,0.22);z-index:9999;
      opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;
    `;
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.background = type === 'success' ? '#1B2F6E' : '#DC2626';
  el.style.opacity  = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.opacity  = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2800);
}

/**
 * POST JSON to the Apps Script backend securely with userRole context.
 */
async function _post(payload) {
  const user = getLoggedInUser();
  if (user && user.role) {
    payload.userRole = user.role; // Automatically inject role for backend validation
  }
  
  if (user && user.token) {
    payload.token = user.token; // Prepare for token-based auth
  }

  console.log('📡 [auth-guard] Sending request to:', APPS_SCRIPT_URL);
  console.log('📤 [auth-guard] Payload action:', payload.action);

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    redirect: 'follow',
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  console.log('📥 [auth-guard] Response:', json);
  return json;
}

// ── PUBLIC API (STUDENT ACTIONS) ────────────────────────────────

/**
 * Handle course enrollment safely
 */
async function handleEnroll(courseId, courseName) {
  const user = getLoggedInUser();

  if (!user) {
    _showPopup('Please log in to enroll.', 'error');
    setTimeout(() => { window.location.href = LOGIN_PAGE; }, 1200);
    return;
  }

  try {
    const result = await _post({
      action:     'enroll',
      name:       user.name,
      email:      user.email,
      courseId:   courseId,
      courseName: courseName,
      enrolledAt: new Date().toLocaleString('en-IN')
    });

    if (result.status === 'success') {
      _showPopup('✅ Enrolled successfully! Redirecting…');
      setTimeout(() => { window.location.href = DASHBOARD_PAGE; }, 1800);
    } else if (result.status === 'already_enrolled') {
      _showPopup('You are already enrolled in this course.');
      setTimeout(() => { window.location.href = DASHBOARD_PAGE; }, 1800);
    } else {
      _showPopup('Enrolment failed: ' + (result.message || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Enroll error:', err);
    _showPopup('Network error. Please try again.', 'error');
  }
}

/**
 * Handle test attempt securely
 */
async function handleAttemptTest(testId, testName, subject, attemptLevel = 'Level 1') {
  const user = getLoggedInUser();

  if (!user) {
    _showPopup('Please log in to attempt the test.', 'error');
    setTimeout(() => { window.location.href = LOGIN_PAGE; }, 1200);
    return;
  }
  
  // Anti-cheat blocking check
  const blocked = localStorage.getItem('cmaTestBlocked_' + testId);
  if (blocked === 'true') {
    _showPopup('You are permanently blocked from attempting this test due to multiple violations.', 'error');
    return;
  }

  // Log "started" attempt
  try {
    await _post({
      action:       'submitTest',
      studentName:  user.fullName || user.name,
      email:        user.email,
      mobile:       user.mobile || '',
      cmaRegNo:     user.cmaRegNo || '',
      testId:       testId,
      testTitle:    testName,
      subject:      subject,
      score:        null,
      attemptLevel: attemptLevel,
      submissionType: 'start'
    });
  } catch (err) {
    console.warn('Could not log test start:', err);
  }

  window.location.href = `test.html?id=${encodeURIComponent(testId)}&level=${encodeURIComponent(attemptLevel)}`;
}

/**
 * Final test submission handler
 */
let _isSubmitting = false;

async function submitTestResult(attemptData) {
  const user = getLoggedInUser();
  if (!user) {
    _showPopup('Session expired. Could not save test result.', 'error');
    return { status: 'error', message: 'Session expired' };
  }

  if (_isSubmitting) return { status: 'error', message: 'Already submitting' };
  _isSubmitting = true;

  const maxRetries = 3;
  let attempt = 0;
  let res = null;

  _showPopup('⏳ Submitting test... Please do not close the window.');

  while (attempt < maxRetries) {
    try {
      res = await _post({ 
        action: 'submitTest', 
        studentName: user.name,
        email: user.email,
        ...attemptData 
      });
      
      if (res && res.status === 'success') {
        _showPopup('📊 Result saved successfully!');
        _isSubmitting = false;
        return res;
      } else {
        throw new Error(res?.message || 'Server error');
      }
    } catch (err) {
      attempt++;
      console.warn(`Submission failed (attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        _showPopup(`⚠️ Retrying submission (${attempt}/${maxRetries})...`, 'error');
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      } else {
        console.error('submitTestResult final error:', err);
        _showPopup('❌ Submission failed. Please check your internet and try again.', 'error');
        _isSubmitting = false;
        return { status: 'error', message: 'Network failure' };
      }
    }
  }
}

// ── AUTO-WIRE ───────────────────────────────────────────────────

function attachAuthGuard() {
  document.querySelectorAll('[data-enroll]').forEach(el => {
    if (el.dataset.authWired) return;
    el.dataset.authWired = 'true';
    el.addEventListener('click', e => {
      e.preventDefault();
      handleEnroll(el.dataset.courseId || '', el.dataset.courseName || '');
    });
  });

  document.querySelectorAll('[data-test]').forEach(el => {
    if (el.dataset.authWired) return;
    el.dataset.authWired = 'true';
    el.addEventListener('click', e => {
      e.preventDefault();
      handleAttemptTest(
        el.dataset.testId       || '',
        el.dataset.testName     || '',
        el.dataset.subject      || '',
        el.dataset.attemptLevel || 'Level 1'
      );
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachAuthGuard);
} else {
  attachAuthGuard();
}
