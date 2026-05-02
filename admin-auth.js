// ═══════════════════════════════════════════════════════════════
//  CMAPrep Pro — Admin Auth Guard
//  Include this file on admin pages to strictly enforce 
//  role-based access control (RBAC).
// ═══════════════════════════════════════════════════════════════

(function enforceAdminAccess() {
  // Gracefully fallback if auth-guard.js is missing or loading late
  const getUser = typeof getLoggedInUser === 'function' 
    ? getLoggedInUser 
    : function() {
        try { return JSON.parse(sessionStorage.getItem('cmaUser')); } 
        catch (e) { return null; }
      };

  const user = getUser();

  // 1. Missing or Corrupted Session
  if (!user) {
    console.warn('[Admin Guard] No valid session found. Redirecting to login.');
    if (typeof clearUserSession === 'function') clearUserSession();
    else sessionStorage.removeItem('cmaUser');
    
    window.location.replace('index.html#login');
    return;
  }
  
  // 2. Insufficient Privileges (Not Admin)
  if (user.role !== 'admin') {
    console.warn(`[Admin Guard] Access denied for role: ${user.role}. Redirecting to dashboard.`);
    window.location.replace('dashboard.html');
    return;
  }

  // 3. Admin Access Granted
  console.log('[Admin Guard] Admin session verified.');
})();
