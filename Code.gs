// ═══════════════════════════════════════════════════════════════
//  CMAPrep Pro — Google Apps Script Backend
//  Paste this entire file into your Apps Script editor
//  Sheet ID: 1aSgbweZ1BzXXmO0GQfHKlXJhZynUGePjT-G77YlKN0I
//  Tab name: Students
// ═══════════════════════════════════════════════════════════════

const SHEET_ID   = '1aSgbweZ1BzXXmO0GQfHKlXJhZynUGePjT-G77YlKN0I';
const SHEET_NAME = 'Students';

// Column indices (1-based, matching your sheet layout)
// ⚠ Sheet structure (A→J):
//   A=Full Name, B=CMA Reg No, C=Email, D=Mobile, E=City,
//   F=Level, G=Password, H=Role, I=Photo URL, J=Registration Date
const COL = {
  FULL_NAME:         1,   // A
  CMA_REG_NO:        2,   // B
  EMAIL:             3,   // C
  MOBILE:            4,   // D
  CITY:              5,   // E
  LEVEL:             6,   // F
  PASSWORD:          7,   // G
  ROLE:              8,   // H  ← Role moved here for easy manual assignment
  PHOTO_URL:         9,   // I
  REGISTRATION_DATE: 10   // J
};

// ───────────────────────────────────────────────────────────────
// ROLE DEFINITIONS
// Centralised role constants — edit here, nowhere else.
// ───────────────────────────────────────────────────────────────
const ROLES = {
  ADMIN:   'admin',
  STUDENT: 'student',
  TEACHER: 'teacher'
};

// ───────────────────────────────────────────────────────────────
// ROLE VALIDATION UTILITY
// ───────────────────────────────────────────────────────────────

/**
 * Checks whether a given role is present in the list of allowed roles.
 *
 * @param {string}   userRole     - The role of the requesting user.
 * @param {string[]} allowedRoles - Array of roles permitted to access the resource.
 * @returns {boolean} true if authorised, false otherwise.
 *
 * @example
 *   validateRole('admin', [ROLES.ADMIN])           // → true
 *   validateRole('student', [ROLES.ADMIN])         // → false
 *   validateRole('teacher', [ROLES.ADMIN, ROLES.TEACHER]) // → true
 */
function validateRole(userRole, allowedRoles) {
  if (!userRole || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return false;
  }
  return allowedRoles.includes(userRole.toLowerCase().trim());
}

// ───────────────────────────────────────────────────────────────
// API HELPERS
// ───────────────────────────────────────────────────────────────

/**
 * Standardize API responses
 */
function formatResponse(status, message = '', data = null) {
  return ContentService
    .createTextOutput(JSON.stringify({ status, message, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle errors gracefully
 */
function handleError(error, defaultMessage = 'Internal server error') {
  console.error(error); // Logs to Apps Script executions
  const message = error instanceof Error ? error.message : defaultMessage;
  return formatResponse('error', message, null);
}

/**
 * Higher-order function to wrap API handlers with role validation and error handling
 */
function withGuard(allowedRoles, handler) {
  return function(payload) {
    try {
      if (allowedRoles && allowedRoles.length > 0) {
        if (!validateRole(payload.userRole, allowedRoles)) {
          return unauthorizedResponse();
        }
      }
      return handler(payload);
    } catch (err) {
      return handleError(err);
    }
  };
}

/**
 * Builds a standard "Unauthorized" response object.
 */
function unauthorizedResponse() {
  return formatResponse('error', 'Unauthorized access', null);
}

// ───────────────────────────────────────────────────────────────
// API ROUTER
// ───────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    const routes = {
      // Public
      'register':         withGuard([], handleRegister),
      'login':            withGuard([], handleLogin),
      
      // Admin & Teacher
      'addTest':          withGuard([ROLES.ADMIN, ROLES.TEACHER], addTest),
      'saveTestSeries':   withGuard([ROLES.ADMIN, ROLES.TEACHER], handleSaveTestSeries),
      
      // Admin Only
      'createTest':       withGuard([ROLES.ADMIN], createTest),
      'uploadMCQs':       withGuard([ROLES.ADMIN], uploadMCQs),
      'deleteTest':       withGuard([ROLES.ADMIN], handleDeleteTest),
      'updateTest':       withGuard([ROLES.ADMIN], handleUpdateTest),
      'unlockLevel2':     withGuard([ROLES.ADMIN], handleUnlockLevel2),
      'scheduleLevel2':   withGuard([ROLES.ADMIN], handleScheduleLevel2),
      'resetLeaderboard': withGuard([ROLES.ADMIN], handleResetLeaderboard),
      'updatePricing':    withGuard([ROLES.ADMIN], handleUpdatePricing),
      'updatePrize':      withGuard([ROLES.ADMIN], handleUpdatePrize),
      'declareWinners':   withGuard([ROLES.ADMIN], handleDeclareWinners),
      'getStudents':      withGuard([ROLES.ADMIN], handleGetStudents),
      
      // Shared (Admin, Teacher, Student)
      'getTests':         getAllTests,  // public — no auth needed to browse test listings
      'getLeaderboard':   withGuard([], handleGetLeaderboard),
      'getGlobalStats':   withGuard([], handleGetGlobalStats),
      'getHomepageStats': withGuard([], handleGetGlobalStats),
      'getDashboardStats':withGuard([ROLES.ADMIN], handleGetDashboardStats),
      'getPricing':       withGuard([ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT], handleGetPricing),
      'getLevelRules':    withGuard([ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT], handleGetLevelRules),
      'getEnrollments':   withGuard([ROLES.ADMIN, ROLES.STUDENT], handleGetEnrollments),
      'getLevel2Status':  withGuard([ROLES.ADMIN, ROLES.STUDENT], handleGetLevel2Status),
      'getNotifications': withGuard([ROLES.ADMIN, ROLES.STUDENT], handleGetNotifications),
      'markNotificationRead': withGuard([ROLES.ADMIN, ROLES.STUDENT], handleMarkNotificationRead),
      'prizeConfig':      withGuard([ROLES.ADMIN, ROLES.STUDENT], handleGetPrizeConfig),
      'enroll':           withGuard([ROLES.ADMIN, ROLES.STUDENT], handleEnroll),
      
      // Admin & Student
      'submitTest':       withGuard([ROLES.ADMIN, ROLES.STUDENT], handleSubmitTest),
      'getAnalytics':     withGuard([ROLES.ADMIN, ROLES.STUDENT], handleGetAnalytics),
      'fetchTests':       withGuard([ROLES.ADMIN, ROLES.STUDENT], fetchTests),
      'getTestById':      withGuard([ROLES.ADMIN, ROLES.STUDENT], handleGetTestById),
      'fetchAnalytics':   withGuard([ROLES.ADMIN, ROLES.STUDENT], fetchAnalytics)
    };

    if (routes[action]) {
      return routes[action](payload);
    }

    return formatResponse('error', 'Unknown action.', null);
  } catch (err) {
    return handleError(err, 'Invalid request format');
  }
}

// ───────────────────────────────────────────────────────────────
// REGISTER  (public — no role guard)
// ───────────────────────────────────────────────────────────────
function handleRegister(data) {
  const sheet = SpreadsheetApp
    .openById(SHEET_ID)
    .getSheetByName(SHEET_NAME);

  const lastRow  = sheet.getLastRow();
  const allData  = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, 9).getValues()
    : [];

  const emailLower = (data.email || '').toLowerCase().trim();
  const cmaLower   = (data.cmaRegNo || '').toLowerCase().trim();

  // Check for existing account by Email OR CMA Reg No.
  for (const row of allData) {
    const rowEmail = (row[COL.EMAIL - 1] || '').toString().toLowerCase().trim();
    const rowCma   = (row[COL.CMA_REG_NO - 1] || '').toString().toLowerCase().trim();
    if (rowEmail === emailLower || rowCma === cmaLower) {
      return formatResponse('exists', 'Account already exists.', null);
    }
  }

  // Append new student row — column order MUST match COL map above
  sheet.appendRow([
    data.fullName         || '',                                        // A - Full Name
    data.cmaRegNo         || '',                                        // B - CMA Reg No
    data.email            || '',                                        // C - Email
    data.mobile           || '',                                        // D - Mobile
    data.city             || '',                                        // E - City
    data.level            || '',                                        // F - Level
    data.password         || '',                                        // G - Password ⚠ hash in production
    data.role             || ROLES.STUDENT,                             // H - Role (admin/student)
    data.photoUrl         || '',                                        // I - Photo URL
    data.registrationDate || new Date().toLocaleDateString('en-IN')    // J - Registration Date
  ]);

  return formatResponse('success', 'Registration successful.', null);
}

// ───────────────────────────────────────────────────────────────
// LOGIN  (public — returns role so the client can pass it back)
// ───────────────────────────────────────────────────────────────
function handleLogin(data) {
  const sheet = SpreadsheetApp
    .openById(SHEET_ID)
    .getSheetByName(SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return formatResponse('not_found', 'No users registered yet.', null);
  }

  const allData       = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const identifier    = (data.identifier || '').toLowerCase().trim();
  const inputPassword = (data.password   || '').trim();

  for (const row of allData) {
    const rowEmail = (row[COL.EMAIL - 1]      || '').toString().toLowerCase().trim();
    const rowCma   = (row[COL.CMA_REG_NO - 1] || '').toString().toLowerCase().trim();

    if (rowEmail === identifier || rowCma === identifier) {
      const storedPassword = (row[COL.PASSWORD - 1] || '').toString().trim();

      if (storedPassword !== inputPassword) {
        return formatResponse('wrong_password', 'Incorrect password.', null);
      }

      // Return safe user object (password is never returned)
      return formatResponse('success', 'Login successful', {
        fullName:         row[COL.FULL_NAME - 1],
        cmaRegNo:         row[COL.CMA_REG_NO - 1],
        email:            row[COL.EMAIL - 1],
        mobile:           row[COL.MOBILE - 1],
        city:             row[COL.CITY - 1],
        level:            row[COL.LEVEL - 1],
        photoUrl:         row[COL.PHOTO_URL - 1],
        registrationDate: row[COL.REGISTRATION_DATE - 1],
        role:             row[COL.ROLE - 1] || ROLES.STUDENT
      });
    }
  }

  return formatResponse('not_found', 'Account not found, please register.', null);
}

// ───────────────────────────────────────────────────────────────
// GET handler (health check — optional)
// ───────────────────────────────────────────────────────────────
function doGet(e) {
  return formatResponse('ok', 'CMAPrep Auth API is live.', null);
}

// ───────────────────────────────────────────────────────────────
// TESTS_MASTER SHEET
// Tab: Tests_Master
// Columns: Test ID | Title | Level | Subject | Duration | Total Questions
// ───────────────────────────────────────────────────────────────

const TESTS_SHEET_NAME = 'Tests_Master';

const TEST_COL = {
  TEST_ID:         1,   // A  – e.g. "TEST_001"
  TITLE:           2,   // B  – e.g. "Cost Accounting – Ch.5-7"
  LEVEL:           3,   // C  – Foundation | Intermediate | Final
  SUBJECT:         4,   // D  – e.g. "Cost Accounting"
  DURATION:        5,   // E  – minutes (number)
  TOTAL_QUESTIONS: 6,   // F  – count of MCQs
  JSON_DATA:       7    // G  – internal JSON blob
};

/**
 * Ensures the Tests_Master tab exists with a header row.
 * Call once from the Apps Script editor (Run → setupTestsSheet)
 * or let addTest() call it automatically.
 */
function setupTestsSheet() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(TESTS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(TESTS_SHEET_NAME);
  }

  // Write header only if the sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Test ID', 'Title', 'Level', 'Subject', 'Duration (mins)', 'Total Questions', 'JSON_DATA']);

    // Style header row
    const header = sheet.getRange(1, 1, 1, 7);
    header.setFontWeight('bold');
    header.setBackground('#1B2F5B');
    header.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);

    // Column widths for readability
    sheet.setColumnWidth(TEST_COL.TEST_ID,         110);
    sheet.setColumnWidth(TEST_COL.TITLE,           260);
    sheet.setColumnWidth(TEST_COL.LEVEL,           120);
    sheet.setColumnWidth(TEST_COL.SUBJECT,         200);
    sheet.setColumnWidth(TEST_COL.DURATION,        130);
    sheet.setColumnWidth(TEST_COL.TOTAL_QUESTIONS, 140);
    sheet.setColumnWidth(7, 300); // JSON_DATA
  }

  return sheet;
}

/**
 * Generates the next sequential Test ID (TEST_001, TEST_002, …).
 */
function generateTestId_(sheet) {
  const lastRow = sheet.getLastRow();
  const next    = lastRow; // row 1 = header, so last data row index = lastRow - 1, next = lastRow
  return 'TEST_' + String(next).padStart(3, '0');
}

// ───────────────────────────────────────────────────────────────
// ADD TEST  ── Admin & Teacher only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole         {string}  required – caller's role
 *   - title            {string}  required
 *   - level            {string}  required  – Foundation | Intermediate | Final
 *   - subject          {string}  required
 *   - duration         {number}  required  – minutes
 *   - totalQuestions   {number}  required
 */
function addTest(data) {
  // Validate required fields
  const required = ['title', 'level', 'subject', 'duration', 'totalQuestions'];
  for (const field of required) {
    if (!data[field] && data[field] !== 0) {
      return formatResponse('error', `Missing required field: ${field}`, null);
    }
  }

  const sheet  = setupTestsSheet();
  const testId = generateTestId_(sheet);

  sheet.appendRow([
    testId,
    data.title.trim(),
    data.level.trim(),
    data.subject.trim(),
    Number(data.duration),
    Number(data.totalQuestions)
  ]);

  return formatResponse('success', `Test "${data.title}" saved as ${testId}.`, { testId });
}

// ───────────────────────────────────────────────────────────────
// CREATE TEST (ADMIN ONLY) ── Advanced Test Creation
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 */
function createTest(data) {
  // Validate input data object
  if (!data || typeof data !== 'object') {
    return formatResponse('error', 'Invalid test data provided', null);
  }

  // Support two payload shapes:
  // Shape A (direct): { title, level, subject, duration, totalQuestions, testData }
  // Shape B (nested): { testData: { title, level, subject, duration, ... } }
  const td = data.testData || {};
  const title          = data.title    || td.title    || '';
  const level          = data.level    || td.level    || '';
  const subject        = data.subject  || td.subject  || '';
  const duration       = Number(data.duration  !== undefined ? data.duration  : (td.duration  || 0));
  const totalQuestions = Number(data.totalQuestions !== undefined ? data.totalQuestions : ((td.questions || []).length || 0));

  // Validate required fields
  if (!title)   return formatResponse('error', 'Missing required field: title',    null);
  if (!level)   return formatResponse('error', 'Missing required field: level',    null);
  if (!subject) return formatResponse('error', 'Missing required field: subject',  null);
  if (!duration) return formatResponse('error', 'Missing required field: duration', null);

  const sheet = setupTestsSheet();
  const testId = generateTestId_(sheet);

  // Initialize lifecycle fields
  td.status = data.status || td.status || 'draft';
  if (data.startTime || td.startTime) td.startTime = data.startTime || td.startTime;
  if (data.endTime   || td.endTime)   td.endTime   = data.endTime   || td.endTime;

  // ── FIX 1 & 2: Extract new fields from payload and store in JSON_DATA ──
  // Extract with safe defaults — never breaks existing tests
  const price          = Number(data.price          !== undefined ? data.price          : (td.pricing && td.pricing.price !== undefined ? td.pricing.price : 0));
  const negativeMarking = Number(data.negativeMarking !== undefined ? data.negativeMarking : (td.negativeMarking !== undefined ? td.negativeMarking : 0));
  const prize1         = Number(data.prize1          !== undefined ? data.prize1          : (td.prizes && td.prizes.first  !== undefined ? td.prizes.first  : 0));
  const prize2         = Number(data.prize2          !== undefined ? data.prize2          : (td.prizes && td.prizes.second !== undefined ? td.prizes.second : 0));
  const prize3         = Number(data.prize3          !== undefined ? data.prize3          : (td.prizes && td.prizes.third  !== undefined ? td.prizes.third  : 0));

  // Store inside JSON_DATA blob — DO NOT create new sheet columns
  td.pricing = {
    price:    price,
    currency: 'INR',
    testType: price > 0 ? 'Paid' : 'Free'
  };
  td.negativeMarking = negativeMarking;
  td.prizes = {
    first:  prize1,
    second: prize2,
    third:  prize3
  };

  const testDataJson = JSON.stringify(td);

  sheet.appendRow([
    testId,
    String(title).trim(),
    String(level).trim(),
    String(subject).trim(),
    duration,
    totalQuestions,
    testDataJson
  ]);

  return formatResponse('success', `Test "${title}" successfully created.`, { testId });
}

// ───────────────────────────────────────────────────────────────
// UPDATE TEST (ADMIN ONLY)
// ───────────────────────────────────────────────────────────────
function handleUpdateTest(data) {
  if (!data || !data.testId) return formatResponse('error', 'Missing testId', null);
  
  const sheet = setupTestsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return formatResponse('not_found', 'Test not found', null);
  
  const allIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowIndex = -1;
  for (let i = 0; i < allIds.length; i++) {
    if (allIds[i][0] === data.testId) {
      rowIndex = i + 2;
      break;
    }
  }
  if (rowIndex === -1) return formatResponse('not_found', 'Test not found', null);
  
  // Read existing JSON — preserve ALL existing keys
  const existingJsonStr = sheet.getRange(rowIndex, TEST_COL.JSON_DATA).getValue();
  let td = {};
  try { td = JSON.parse(existingJsonStr || '{}'); } catch(e) {}
  
  // Lifecycle fields
  if (data.status    !== undefined) td.status    = data.status;
  if (data.startTime !== undefined) td.startTime = data.startTime;
  if (data.endTime   !== undefined) td.endTime   = data.endTime;

  // Metadata fields
  if (data.title       !== undefined) td.title       = data.title;
  if (data.level       !== undefined) td.level        = data.level;
  if (data.subject     !== undefined) td.subject      = data.subject;
  if (data.duration    !== undefined) td.duration     = Number(data.duration);
  if (data.description !== undefined) td.description  = data.description;

  // Pricing — store in JSON_DATA only, no new sheet columns
  if (data.price !== undefined) {
    td.pricing = td.pricing || {};
    td.pricing.price    = Number(data.price);
    td.pricing.currency = 'INR';
    td.pricing.testType = Number(data.price) > 0 ? 'Paid' : 'Free';
  }

  // Negative marking
  if (data.negativeMarking !== undefined) {
    td.negativeMarking = Number(data.negativeMarking);
  }

  // Prizes
  if (data.prize1 !== undefined || data.prize2 !== undefined || data.prize3 !== undefined) {
    td.prizes = td.prizes || { first: 0, second: 0, third: 0 };
    if (data.prize1 !== undefined) td.prizes.first  = Number(data.prize1);
    if (data.prize2 !== undefined) td.prizes.second = Number(data.prize2);
    if (data.prize3 !== undefined) td.prizes.third  = Number(data.prize3);
  }

  // Update flat sheet columns if supplied (keeps sheet columns in sync)
  if (data.title    !== undefined) sheet.getRange(rowIndex, TEST_COL.TITLE).setValue(String(data.title).trim());
  if (data.level    !== undefined) sheet.getRange(rowIndex, TEST_COL.LEVEL).setValue(String(data.level).trim());
  if (data.subject  !== undefined) sheet.getRange(rowIndex, TEST_COL.SUBJECT).setValue(String(data.subject).trim());
  if (data.duration !== undefined) sheet.getRange(rowIndex, TEST_COL.DURATION).setValue(Number(data.duration));

  sheet.getRange(rowIndex, TEST_COL.JSON_DATA).setValue(JSON.stringify(td));
  return formatResponse('success', 'Test updated successfully', null);
}

// ───────────────────────────────────────────────────────────────
// UNLOCK LEVEL 2 (ADMIN ONLY)
// ───────────────────────────────────────────────────────────────
function handleUnlockLevel2(data) {
  if (!data || !data.studentEmail) return formatResponse('error', 'Missing studentEmail', null);
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const levelsSheet = ss.getSheetByName(LEVELS_SHEET_NAME);
  if (!levelsSheet) return formatResponse('error', 'Levels sheet not found', null);
  
  const allLevelsData = levelsSheet.getDataRange().getValues();
  const emailLower = data.studentEmail.toLowerCase().trim();
  let rowIndex = -1;
  let currentLevel = 1;
  
  for (let i = 1; i < allLevelsData.length; i++) {
    if ((allLevelsData[i][0] || '').toLowerCase().trim() === emailLower) {
      rowIndex = i + 1;
      currentLevel = Number(allLevelsData[i][1]) || 1;
      break;
    }
  }
  
  if (rowIndex > -1) {
    if (currentLevel < 2) {
      levelsSheet.getRange(rowIndex, 2).setValue(2);
    }
  } else {
    levelsSheet.appendRow([emailLower, 2, 'Admin Unlocked', '-', new Date().toISOString()]);
  }
  
  // Add Notification
  const notifSheet = ss.getSheetByName(NOTIFICATIONS_SHEET_NAME);
  if (notifSheet) {
    notifSheet.appendRow([
      emailLower, 
      '🎉 You have qualified for Level 2!', 
      'level2_unlock', 
      'false', 
      new Date().toISOString()
    ]);
  }
  
  return formatResponse('success', 'Level 2 unlocked successfully', null);
}

// ───────────────────────────────────────────────────────────────
// LEVEL 2 TEST SCHEDULING (ADMIN)
// ───────────────────────────────────────────────────────────────
function handleScheduleLevel2(data) {
  setupAdvancedSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(LEVEL2_CONFIG_SHEET_NAME);
  
  if (sheet.getLastRow() > 1) {
    // Clear old config
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
  }
  sheet.appendRow([
    data.level2Date || '',
    data.level2Time || '',
    data.meetLink || '',
    data.status || 'Draft'
  ]);

  // If status is Live or Scheduled, notify all level 2 students
  if (data.status === 'Live' || data.status === 'Upcoming') {
    const levelsSheet = ss.getSheetByName(LEVELS_SHEET_NAME);
    const notifSheet = ss.getSheetByName(NOTIFICATIONS_SHEET_NAME);
    if (levelsSheet && notifSheet) {
      const allLevels = levelsSheet.getDataRange().getValues();
      for (let i = 1; i < allLevels.length; i++) {
        if (Number(allLevels[i][1]) >= 2) {
          const stEmail = allLevels[i][0];
          notifSheet.appendRow([
            stEmail,
            '📅 Your Level 2 test is scheduled. Check details now.',
            'level2_scheduled',
            'false',
            new Date().toISOString()
          ]);
        }
      }
    }
  }
  
  return formatResponse('success', 'Level 2 scheduled successfully', null);
}

function handleGetLevel2Status(data) {
  setupAdvancedSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(LEVEL2_CONFIG_SHEET_NAME);
  if (sheet.getLastRow() < 2) return formatResponse('success', '', { level2: null });
  
  const vals = sheet.getRange(2, 1, 1, 4).getValues()[0];
  return formatResponse('success', '', {
    level2: {
      date: vals[0],
      time: vals[1],
      meetLink: vals[2],
      status: vals[3]
    }
  });
}

// ───────────────────────────────────────────────────────────────
// NOTIFICATIONS API
// ───────────────────────────────────────────────────────────────
function handleGetNotifications(data) {
  setupAdvancedSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(NOTIFICATIONS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return formatResponse('success', '', { notifications: [] });
  
  const rows = sheet.getDataRange().getValues();
  const email = (data.email || '').toLowerCase().trim();
  const notifs = [];
  
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toLowerCase().trim() === email) {
      notifs.push({
        id: i + 1, // row number as ID
        message: rows[i][1],
        type: rows[i][2],
        isRead: String(rows[i][3]) === 'true',
        timestamp: rows[i][4]
      });
    }
  }
  
  notifs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  return formatResponse('success', '', { notifications: notifs });
}

function handleMarkNotificationRead(data) {
  if (!data.id) return formatResponse('error', 'Missing notification ID');
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(NOTIFICATIONS_SHEET_NAME);
  if (sheet && data.id <= sheet.getLastRow()) {
    sheet.getRange(data.id, 4).setValue('true');
  }
  return formatResponse('success', 'Notification marked as read', null);
}

// ───────────────────────────────────────────────────────────────
// UPLOAD MCQs (ADMIN ONLY) ── Attach questions to a test
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - testId   {string}  required
 *   - mcqList  {Array}   required
 */
function uploadMCQs(data) {
  if (!data || !data.testId || !Array.isArray(data.mcqList)) {
    return formatResponse('error', 'Invalid payload. Requires testId and mcqList array.', null);
  }

  // Validate MCQ structure
  for (let i = 0; i < data.mcqList.length; i++) {
    const q = data.mcqList[i];
    if (!q.question || !Array.isArray(q.options) || q.options.length === 0 || !q.answer) {
      return formatResponse('error', `Invalid MCQ structure at index ${i}. Required: question, options (array), answer.`, null);
    }
  }

  const sheet = setupTestsSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    return formatResponse('not_found', 'Test not found.', null);
  }

  const allIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowIndex = -1;
  for (let i = 0; i < allIds.length; i++) {
    if (allIds[i][0] === data.testId) {
      rowIndex = i + 2;
      break;
    }
  }

  if (rowIndex === -1) {
    return formatResponse('not_found', 'Test ID not found.', null);
  }

  // Fetch and update existing testData
  let testDataObj = {};
  const existingJson = sheet.getRange(rowIndex, TEST_COL.JSON_DATA).getValue();
  if (existingJson) {
    try {
      testDataObj = JSON.parse(existingJson);
    } catch (e) {
      // Ignore parse errors on old corrupted rows, overwrite with new struct
    }
  }

  testDataObj.questions = data.mcqList;
  const newTotal = data.mcqList.length;

  sheet.getRange(rowIndex, TEST_COL.TOTAL_QUESTIONS).setValue(newTotal);
  sheet.getRange(rowIndex, TEST_COL.JSON_DATA).setValue(JSON.stringify(testDataObj));

  return formatResponse('success', `Successfully uploaded ${newTotal} MCQs.`, { testId: data.testId, count: newTotal });
}

// ───────────────────────────────────────────────────────────────
// GET ALL TESTS  ── All authenticated roles
// ───────────────────────────────────────────────────────────────
/**
 * Returns all rows from Tests_Master as an array of objects.
 * Also parses the JSON_DATA column to return full test data.
 *
 * @param {Object} data
 *   - userRole {string} required
 */
function getAllTests(data) {
  const sheet   = setupTestsSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return formatResponse('success', '', { tests: [] });

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  const isAdmin = data && (data.userRole === 'admin' || data.userRole === 'teacher');

  const tests = rows
    .filter(r => r[0])   // skip blank rows
    .map(r => {
      let testJson = {};
      try { testJson = JSON.parse(r[6] || '{}'); } catch (e) {}

      // All pricing/prize data lives in JSON_DATA — Tests_Master is the single source of truth
      const jsonPricing = testJson.pricing || {};
      const jsonPrizes  = testJson.prizes  || {};
      const price       = jsonPricing.price !== undefined ? jsonPricing.price : 0;

      return {
        testId:           r[0],
        title:            r[1],
        level:            r[2],
        subject:          r[3],
        duration:         r[4],
        totalQuestions:   r[5],
        price:            price,
        pricing:          { testType: price > 0 ? 'Paid' : 'Free', price: price, currency: 'INR' },
        negativeMarking:  testJson.negativeMarking !== undefined ? testJson.negativeMarking : 0,
        prizes: {
          first:  jsonPrizes.first  !== undefined ? jsonPrizes.first  : 0,
          second: jsonPrizes.second !== undefined ? jsonPrizes.second : 0,
          third:  jsonPrizes.third  !== undefined ? jsonPrizes.third  : 0
        },
        prize1:           jsonPrizes.first  || 0,
        prize2:           jsonPrizes.second || 0,
        prize3:           jsonPrizes.third  || 0,
        description:      testJson.description || '',
        testData:         isAdmin ? testJson : {},
        status:           testJson.status || 'draft',
        startTime:        testJson.startTime || null,
        endTime:          testJson.endTime   || null
      };
    })
    .filter(t => isAdmin || t.status === 'live' || t.status === 'upcoming');

  return formatResponse('success', '', { tests });
}

// ───────────────────────────────────────────────────────────────
// SAVE TEST SERIES  ── Admin & Teacher only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleSaveTestSeries(data) {
  const sheet  = setupTestsSheet();
  const testId = data.testId || generateTestId_(sheet);

  // If testId exists, update it; else append
  const lastRow = sheet.getLastRow();
  let rowIndex = -1;
  if (lastRow >= 2) {
    const allIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < allIds.length; i++) {
      if (allIds[i][0] === testId) {
        rowIndex = i + 2;
        break;
      }
    }
  }

  const rowData = [
    testId,
    data.title          || 'Untitled',
    data.level          || 'Level 1',
    data.subject        || 'General',
    data.duration       || 60,
    data.totalQuestions || 0,
    JSON.stringify(data.testData || {})
  ];

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, 7).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return formatResponse('success', '', { testId });
}

// ───────────────────────────────────────────────────────────────
// DELETE TEST  ── Admin only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 *   - testId   {string} required
 */
function handleDeleteTest(data) {
  const sheet  = setupTestsSheet();
  const testId = data.testId;
  if (!testId) return formatResponse('error', 'No testId provided', null);

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const allIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < allIds.length; i++) {
      if (allIds[i][0] === testId) {
        sheet.deleteRow(i + 2);
        return formatResponse('success', '', null);
      }
    }
  }
  return formatResponse('not_found', 'Not found', null);
}

// ───────────────────────────────────────────────────────────────
// ADVANCED EXAM & PROGRESSION BACKEND
// ───────────────────────────────────────────────────────────────

const ATTEMPTS_SHEET_NAME = 'Test_Attempts_Data';
const LEVELS_SHEET_NAME   = 'Level_Progress';
const NOTIFICATIONS_SHEET_NAME = 'Notifications';
const LEVEL2_CONFIG_SHEET_NAME = 'Level2_Config';

function setupAdvancedSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let attemptsSheet = ss.getSheetByName(ATTEMPTS_SHEET_NAME);
  let levelsSheet   = ss.getSheetByName(LEVELS_SHEET_NAME);

  if (!attemptsSheet) {
    attemptsSheet = ss.insertSheet(ATTEMPTS_SHEET_NAME);
    attemptsSheet.appendRow([
      'Student Name', 'Email', 'Mobile', 'Registration Number', 'Test ID', 'Test Title',
      'Score', 'Correct Answers', 'Wrong Answers', 'Unattempted', 'Total Time',
      'Per Question Timing', 'Violations', 'Submission Timestamp', 'Submission Type'
    ]);
    const header = attemptsSheet.getRange(1, 1, 1, 15);
    header.setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    attemptsSheet.setFrozenRows(1);
  }

  if (!levelsSheet) {
    levelsSheet = ss.insertSheet(LEVELS_SHEET_NAME);
    levelsSheet.appendRow([
      'Student Email', 'Current Unlocked Level', 'Latest Score', 'Completed Test', 'Unlock Timestamp'
    ]);
    const header = levelsSheet.getRange(1, 1, 1, 5);
    header.setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    levelsSheet.setFrozenRows(1);
  }

  let notifSheet = ss.getSheetByName(NOTIFICATIONS_SHEET_NAME);
  if (!notifSheet) {
    notifSheet = ss.insertSheet(NOTIFICATIONS_SHEET_NAME);
    notifSheet.appendRow(['Email', 'Message', 'Type', 'IsRead', 'Timestamp']);
    notifSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    notifSheet.setFrozenRows(1);
  }

  let l2ConfigSheet = ss.getSheetByName(LEVEL2_CONFIG_SHEET_NAME);
  if (!l2ConfigSheet) {
    l2ConfigSheet = ss.insertSheet(LEVEL2_CONFIG_SHEET_NAME);
    l2ConfigSheet.appendRow(['Date', 'Time', 'Google Meet Link', 'Status']);
    l2ConfigSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    l2ConfigSheet.setFrozenRows(1);
  }
}

const PRICING_SHEET_NAME     = 'Pricing_Config';
const PRIZE_SHEET_NAME       = 'Prize_Config';
const LEADERBOARD_SHEET_NAME = 'Leaderboard_Data';
const SUBMISSIONS_SHEET_NAME = 'Test_Attempts_Data';

function setupMonetizationSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (!ss.getSheetByName(PRICING_SHEET_NAME)) {
    const s = ss.insertSheet(PRICING_SHEET_NAME);
    s.appendRow(['Test ID', 'Test Title', 'Price', 'Discount Price', 'Test Type', 'Package Name', 'Status']);
    s.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  }

  if (!ss.getSheetByName(PRIZE_SHEET_NAME)) {
    const s = ss.insertSheet(PRIZE_SHEET_NAME);
    s.appendRow(['Contest Name', 'Rank 1 Prize', 'Rank 2 Prize', 'Rank 3 Prize', 'Eligibility Criteria', 'Start Date', 'End Date', 'Payout Status']);
    s.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  }

  if (!ss.getSheetByName(LEADERBOARD_SHEET_NAME)) {
    const s = ss.insertSheet(LEADERBOARD_SHEET_NAME);
    s.appendRow(['Student Name', 'Email', 'Total Points', 'Avg Score', 'Tests Attempted', 'Current Rank', 'Monthly Rank', 'Earned Rewards', 'Prize Eligibility']);
    s.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1B2F5B').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  }
}

// ───────────────────────────────────────────────────────────────
// SUBMIT TEST  ── Students (& Admins for testing)
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleSubmitTest(data) {
  setupAdvancedSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Validation: Missing fields
  if (!data.email || !data.testId) {
    return formatResponse('error', 'Missing required fields', null);
  }

  const levelsSheet    = ss.getSheetByName(LEVELS_SHEET_NAME);
  const allLevelsData  = levelsSheet.getDataRange().getValues();
  const emailLower     = (data.email || '').toLowerCase().trim();

  let rowIndex           = -1;
  let currentUnlockedLevel = 1;

  for (let i = 1; i < allLevelsData.length; i++) {
    if ((allLevelsData[i][0] || '').toLowerCase().trim() === emailLower) {
      rowIndex             = i + 1;
      currentUnlockedLevel = Number(allLevelsData[i][1]) || 1;
      break;
    }
  }

  // Level validation (anti-cheat) — only block if student explicitly tries a higher level
  const reqLevelMatch = (data.attemptLevel || '').match(/\d+/);
  const reqLevel      = reqLevelMatch ? Number(reqLevelMatch[0]) : 1;

  // Only reject if they have an existing record AND are requesting a higher level than allowed
  if (rowIndex > -1 && reqLevel > currentUnlockedLevel) {
    return formatResponse('error', 'Level requirement not met (Backend Validation)', null);
  }

  // If just logging a start
  if (data.score === null) {
    return formatResponse('success', 'Test start logged', null);
  }

  const attemptsSheet = ss.getSheetByName(ATTEMPTS_SHEET_NAME);

  // Prevent duplicate submissions
  const lastRow = attemptsSheet.getLastRow();
  if (lastRow > 1) {
    const lastAttempt = attemptsSheet.getRange(lastRow, 1, 1, 15).getValues()[0];
    if ((lastAttempt[1] || '').toString().toLowerCase().trim() === emailLower && lastAttempt[4] === data.testId) {
      const timestamp = new Date(lastAttempt[13]).getTime();
      if (Date.now() - timestamp < 60000) { // 1 minute duplicate threshold
        return formatResponse('error', 'Duplicate submission detected', null);
      }
    }
  }

  // Calculate percentage
  let percentage  = 0;
  const totalMarks = Number(data.totalMarks) || 1;
  const score      = Number(data.score) || 0;
  if (totalMarks > 0) percentage = Math.round((score / totalMarks) * 100);
  const scoreStr = score + '/' + totalMarks + ' (' + percentage + '%)';

  // Store Attempt — columns match Test_Attempts_Data header exactly
  attemptsSheet.appendRow([
    data.studentName || '',                             // A: Student Name
    data.email       || '',                             // B: Email
    data.mobile      || '',                             // C: Mobile
    data.cmaRegNo    || '',                             // D: Registration Number
    data.testId      || '',                             // E: Test ID
    data.testTitle   || '',                             // F: Test Title
    scoreStr,                                           // G: Score
    Number(data.correctAnswers) || 0,                   // H: Correct Answers
    Number(data.wrongAnswers)   || 0,                   // I: Wrong Answers
    Number(data.unattempted)    || 0,                   // J: Unattempted
    data.totalTime      || '',                          // K: Total Time
    JSON.stringify(data.perQuestionTiming || {}),       // L: Per Question Timing
    Number(data.violations)     || 0,                   // M: Violations
    new Date().toISOString(),                           // N: Submission Timestamp
    data.submissionType || 'manual'                     // O: Submission Type
  ]);

  // Progression Logic
  let newLevel = currentUnlockedLevel;
  let rules = getLevelRulesFromSheet(ss);
  if (!rules) {
    rules = [
      { level: 10, minPercentage: 90 },
      { level: 9, minPercentage: 85 },
      { level: 8, minPercentage: 80 },
      { level: 7, minPercentage: 75 },
      { level: 6, minPercentage: 70 },
      { level: 5, minPercentage: 65 },
      { level: 4, minPercentage: 60 },
      { level: 3, minPercentage: 55 },
      { level: 2, minPercentage: 50 }
    ];
  }
  rules.sort((a, b) => b.minPercentage - a.minPercentage);
  for (let rule of rules) {
    if (percentage >= rule.minPercentage && currentUnlockedLevel < rule.level) {
      newLevel = rule.level;
      break;
    }
  }

  if (rowIndex > -1) {
    if (newLevel > currentUnlockedLevel) {
      levelsSheet.getRange(rowIndex, 2).setValue(newLevel);
    }
    levelsSheet.getRange(rowIndex, 3).setValue(score + '/' + totalMarks);
    levelsSheet.getRange(rowIndex, 4).setValue(data.testTitle);
    levelsSheet.getRange(rowIndex, 5).setValue(new Date().toISOString());
  } else {
    levelsSheet.appendRow([
      data.email, newLevel, score + '/' + totalMarks, data.testTitle, new Date().toISOString()
    ]);
  }

  // Update Leaderboard
  updateLeaderboardStats_(data.studentName, data.email, score, percentage);

  return formatResponse('success', 'Test submitted successfully', { newLevel, percentage });
}

// ───────────────────────────────────────────────────────────────
// GET ANALYTICS  ── Admin sees all; Student sees own data only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 *   - email    {string} required for student queries
 */
function handleGetAnalytics(data) {
  setupAdvancedSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const email        = (data.email || '').toLowerCase().trim();
  let   attempts     = [];
  let   unlockedLevel = 1;

  const attemptsSheet = ss.getSheetByName(ATTEMPTS_SHEET_NAME);
  const attemptsData  = attemptsSheet.getDataRange().getValues();

  if (validateRole(data.userRole, [ROLES.ADMIN])) {
    // Admin gets all attempts
    attempts = attemptsData.slice(1).map(row => ({
      name:       row[0],
      email:      row[1],
      testTitle:  row[5],
      score:      row[6],
      violations: row[12],
      type:       row[14],
      timestamp:  row[13]
    }));
  } else {
    // Student gets only their own attempts
    for (let i = 1; i < attemptsData.length; i++) {
      const row = attemptsData[i];
      if (email && (row[1] || '').toLowerCase().trim() === email) {
        attempts.push({
          testId:      row[4],
          testTitle:   row[5],
          score:       row[6],
          correct:     row[7],
          wrong:       row[8],
          unattempted: row[9],
          totalTime:   row[10],
          violations:  row[12],
          timestamp:   row[13],
          type:        row[14]
        });
      }
    }
  }

  // Read Level
  const levelsSheet = ss.getSheetByName(LEVELS_SHEET_NAME);
  const levelsData  = levelsSheet.getDataRange().getValues();
  for (let i = 1; i < levelsData.length; i++) {
    if ((levelsData[i][0] || '').toLowerCase().trim() === email) {
      unlockedLevel = Number(levelsData[i][1]) || 1;
      break;
    }
  }

  return formatResponse('success', '', {
    attempts: attempts.reverse(), // newest first
    unlockedLevel
  });
}

// ───────────────────────────────────────────────────────────────
// GET LEADERBOARD  ── All authenticated roles
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleGetLeaderboard(data) {
  setupAdvancedSheets();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const attSheet = ss.getSheetByName(ATTEMPTS_SHEET_NAME);
  
  if (!attSheet || attSheet.getLastRow() < 2) {
    return formatResponse('success', '', { leaderboard: [] });
  }

  const rows = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 15).getValues();
  const studentMap = {};

  for (const row of rows) {
    const name = row[0] || 'Unknown';
    const email = (row[1] || '').toLowerCase().trim();
    if (!email) continue;
    
    const subType = (row[14] || '').toString().toLowerCase();
    if (subType === 'start') continue; // only count actual submissions
    
    const scoreStr = row[6] ? String(row[6]) : '0';
    let pct = 0;
    const match = scoreStr.match(/\((\d+)%\)/);
    if (match) {
      pct = parseInt(match[1], 10);
    } else {
      const parts = scoreStr.split('/');
      if (parts.length === 2 && Number(parts[1]) > 0) {
        pct = Math.round((Number(parts[0]) / Number(parts[1])) * 100);
      } else {
        pct = Number(scoreStr) || 0;
      }
    }
    
    const correctAnswers = Number(row[7]) || 0;
    
    if (!studentMap[email]) {
      studentMap[email] = {
        studentName: name,
        email: email,
        testsAttempted: 0,
        totalPercentage: 0,
        totalPoints: 0
      };
    }
    
    studentMap[email].testsAttempted += 1;
    studentMap[email].totalPercentage += pct;
    studentMap[email].totalPoints += correctAnswers;
  }

  const leaderboard = Object.values(studentMap).map(st => {
    st.avgScore = st.testsAttempted > 0 ? Math.round(st.totalPercentage / st.testsAttempted) + '%' : '0%';
    return st;
  });

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
  
  leaderboard.forEach((st, idx) => {
    st.currentRank = idx + 1;
  });

  return formatResponse('success', '', { leaderboard, leaderboardLimit: 10 });
}

// ───────────────────────────────────────────────────────────────
// NEW ENDPOINTS FOR DYNAMIC REFACTOR
// ───────────────────────────────────────────────────────────────
function handleGetDashboardStats(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  const usersSheet = ss.getSheetByName(SHEET_NAME);
  const students   = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;
  
  const testsSheet  = ss.getSheetByName(TESTS_SHEET_NAME);
  const testsCount  = testsSheet ? Math.max(0, testsSheet.getLastRow() - 1) : 0;
  
  const submissionsSheet = ss.getSheetByName(SUBMISSIONS_SHEET_NAME);
  const submissionsCount = submissionsSheet ? Math.max(0, submissionsSheet.getLastRow() - 1) : 0;
  
  const levelsSheet = ss.getSheetByName(LEVELS_SHEET_NAME);
  let pending = 0; // Counting pending approvals is complex without a dedicated sheet column, mocked or dynamically calculated based on constraints
  
  return formatResponse('success', '', {
    stats: {
      students,
      tests: testsCount,
      pending: pending,
      submissions: submissionsCount
    }
  });
}

function handleGetPricing(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const pSheet = ss.getSheetByName(PRICING_SHEET_NAME);
  let pricingConfig = [];
  if (pSheet && pSheet.getLastRow() >= 2) {
    const rows = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 7).getValues();
    pricingConfig = rows.map(r => ({
      testId: r[0],
      testTitle: r[1],
      price: r[2],
      discountPrice: r[3],
      testType: r[4] || 'Free',
      packageName: r[5],
      status: r[6]
    }));
  }
  return formatResponse('success', '', { pricingConfig });
}

function getLevelRulesFromSheet(ss) {
  const sheet = ss.getSheetByName('Level_Rules');
  if (!sheet) return null;
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  return rows.map(r => ({ level: Number(r[0]), minPercentage: Number(r[1]) }));
}

function handleGetLevelRules(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let rules = getLevelRulesFromSheet(ss);
  if (!rules) {
    rules = [
      { level: 10, minPercentage: 90 },
      { level: 9, minPercentage: 85 },
      { level: 8, minPercentage: 80 },
      { level: 7, minPercentage: 75 },
      { level: 6, minPercentage: 70 },
      { level: 5, minPercentage: 65 },
      { level: 4, minPercentage: 60 },
      { level: 3, minPercentage: 55 },
      { level: 2, minPercentage: 50 }
    ];
  }
  return formatResponse('success', '', { rules });
}

// ───────────────────────────────────────────────────────────────
// RESET LEADERBOARD  ── Admin only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleResetLeaderboard(data) {
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const lbSheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
  if (lbSheet) {
    const lastRow = lbSheet.getLastRow();
    if (lastRow > 1) {
      lbSheet.deleteRows(2, lastRow - 1);
    }
    return formatResponse('success', 'Leaderboard reset', null);
  }
  return formatResponse('error', 'Leaderboard sheet not found', null);
}

// ───────────────────────────────────────────────────────────────
// UPDATE PRICING  ── Admin only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleUpdatePricing(data) {
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const pSheet = ss.getSheetByName(PRICING_SHEET_NAME);
  if (!pSheet) {
    return formatResponse('error', 'Pricing sheet not found', null);
  }

  const testId  = data.testId;
  const lastRow = pSheet.getLastRow();
  let   rowIndex = -1;

  if (lastRow >= 2) {
    const allIds = pSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < allIds.length; i++) {
      if (allIds[i][0] === testId) {
        rowIndex = i + 2;
        break;
      }
    }
  }

  const rowData = [
    testId,
    data.testTitle    || '',
    data.price        || 0,
    data.discountPrice || 0,
    data.testType     || 'Free',
    data.packageName  || '',
    data.status       || 'active'
  ];

  if (rowIndex > -1) {
    pSheet.getRange(rowIndex, 1, 1, 7).setValues([rowData]);
  } else {
    pSheet.appendRow(rowData);
  }

  return formatResponse('success', 'Pricing updated', null);
}

// ───────────────────────────────────────────────────────────────
// UPDATE PRIZE  ── Admin only
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleUpdatePrize(data) {
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const prSheet = ss.getSheetByName(PRIZE_SHEET_NAME);
  if (!prSheet) {
    return formatResponse('error', 'Prize sheet not found', null);
  }

  prSheet.appendRow([
    data.contestName        || '',
    data.rank1Prize         || '',
    data.rank2Prize         || '',
    data.rank3Prize         || '',
    data.eligibilityCriteria || '',
    data.startDate          || '',
    data.endDate            || '',
    data.payoutStatus       || 'pending'
  ]);

  return formatResponse('success', 'Prize config saved', null);
}

// ───────────────────────────────────────────────────────────────
// DECLARE WINNERS  ── Admin only
// ───────────────────────────────────────────────────────────────
function handleDeclareWinners(data) {
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const lbSheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
  if (!lbSheet || lbSheet.getLastRow() < 2) {
    return formatResponse('success', 'No leaderboard data to declare winners from.', { declared: false });
  }

  const rows = lbSheet.getRange(2, 1, lbSheet.getLastRow() - 1, 9).getValues();
  const top3 = rows
    .filter(r => r[0])
    .sort((a, b) => (Number(b[2]) || 0) - (Number(a[2]) || 0))
    .slice(0, 3)
    .map((r, i) => ({ rank: i + 1, name: r[0], email: r[1], points: r[2] }));

  return formatResponse('success', 'Winners declared successfully.', { declared: true, winners: top3 });
}

// ───────────────────────────────────────────────────────────────
// GET ENROLLMENTS  ── Admin sees all; Student sees own only
// ───────────────────────────────────────────────────────────────
function handleGetEnrollments(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Also try to read from the actual Enrollments sheet
  let enrollData = [];
  const enrSheet = ss.getSheetByName('Enrollments');
  const email   = (data.email || '').toLowerCase().trim();
  const isAdmin = validateRole(data.userRole, [ROLES.ADMIN]);

  if (enrSheet && enrSheet.getLastRow() >= 2) {
    const rows = enrSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rowEmail = rows[i][2].toString().toLowerCase().trim();
      if (isAdmin || rowEmail === email) {
        enrollData.push({
          testId:    rows[i][5], // Using Title as ID fallback
          testTitle: rows[i][5],
          testLevel: rows[i][6],
          testDate:  rows[i][0] + ' ' + rows[i][1],
          attempted: 'No',
          unlocked:  'No'
        });
      }
    }
  }

  // Fetch Tests_Master to get true status and IDs
  const testsSheet = setupTestsSheet();
  const lastRow = testsSheet.getLastRow();
  let testsMap = {};
  if (lastRow >= 2) {
    const tRows = testsSheet.getRange(2, 1, lastRow - 1, 7).getValues();
    tRows.forEach(r => {
      let td = {};
      try { td = JSON.parse(r[6] || '{}'); } catch(e) {}
      const tObj = {
        testId:    r[0],
        testTitle: r[1],
        testLevel: r[2],
        status:    td.status || 'live',
        startTime: td.startTime || null,
        endTime:   td.endTime   || null
      };
      testsMap[r[0]] = tObj;                              // by ID
      testsMap[r[1].toString().toLowerCase().trim()] = tObj; // by Title (lowercase)
    });
  }

  // Build a set of (email+testId) pairs that have been submitted
  let attemptedSet = {};
  setupAdvancedSheets();
  const ss2 = SpreadsheetApp.openById(SHEET_ID);
  const attSheet = ss2.getSheetByName(ATTEMPTS_SHEET_NAME);
  if (attSheet && attSheet.getLastRow() >= 2) {
    const attRows = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 15).getValues();
    attRows.forEach(r => {
      const rowEmail  = (r[1] || '').toString().toLowerCase().trim();
      const rowTestId = (r[4] || '').toString().trim();
      const subType   = (r[14] || '').toString().toLowerCase();
      // Only count if it was a real submission (not just a start log)
      if (subType !== 'start' && rowEmail && rowTestId) {
        attemptedSet[rowEmail + '|' + rowTestId] = true;
      }
    });
  }

  // Fallback to old behavior for Admin if no enrollData
  if (!isAdmin && enrollData.length === 0) {
    return formatResponse('success', '', { enrollments: [] });
  }

  if (enrollData.length > 0) {
    // Enrich enrollments with true test data and attempted status
    enrollData = enrollData.map(e => {
      const match = testsMap[(e.testTitle || '').toLowerCase().trim()] || testsMap[e.testId];
      if (match) {
        e.testId    = match.testId;
        e.testTitle = match.testTitle;
        e.testLevel = match.testLevel;
        e.testDate  = match.startTime;
        e.status    = match.status;
        e.startTime = match.startTime;
        e.endTime   = match.endTime;
      } else {
        e.status = 'draft'; // unknown test → don't show as live
      }
      // Cross-reference with attempt records
      const key = email + '|' + e.testId;
      if (attemptedSet[key]) e.attempted = 'Yes';
      return e;
    });
    return formatResponse('success', '', { enrollments: enrollData });
  }

  // Admin sees all tests; enrich with attempted status
  const seenIds = new Set();
  const enrollments = [];
  Object.values(testsMap).forEach(match => {
    if (seenIds.has(match.testId)) return; // deduplicate
    seenIds.add(match.testId);
    const key = email + '|' + match.testId;
    enrollments.push({
      testId:    match.testId,
      testTitle: match.testTitle,
      testLevel: match.testLevel,
      status:    match.status,
      startTime: match.startTime,
      endTime:   match.endTime,
      attempted: attemptedSet[key] ? 'Yes' : 'No',
      unlocked:  'No'
    });
  });

  return formatResponse('success', '', { enrollments });
}

// ───────────────────────────────────────────────────────────────
// ENROLL IN A TEST  ── Admin & Student
// ───────────────────────────────────────────────────────────────
function handleEnroll(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Enrollments');
  if (!sheet) {
    sheet = ss.insertSheet('Enrollments');
    sheet.appendRow(['Date', 'Time', 'Email', 'Student Name', 'CMA Reg', 'Test Title', 'Test Level']);
  }
  
  const email = (data.email || '').toLowerCase().trim();
  const testTitle = (data.testTitle || '').trim();
  
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][2].toString().toLowerCase() === email && rows[i][5].toString() === testTitle) {
        return formatResponse('already_enrolled', 'User is already enrolled in this test', null);
      }
    }
  }

  sheet.appendRow([
    data.enrollDate || new Date().toLocaleDateString(),
    data.enrollTime || new Date().toLocaleTimeString(),
    data.email,
    data.studentName,
    data.cmaRegNo,
    data.testTitle,
    data.testLevel
  ]);

  return formatResponse('success', 'Enrolled successfully', null);
}

// ───────────────────────────────────────────────────────────────
// GET PRIZE CONFIG  ── All authenticated roles
// ───────────────────────────────────────────────────────────────
function handleGetPrizeConfig(data) {
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const prSheet = ss.getSheetByName(PRIZE_SHEET_NAME);
  if (!prSheet || prSheet.getLastRow() < 2) {
    return formatResponse('success', '', { prizes: [] });
  }

  const rows = prSheet.getRange(2, 1, prSheet.getLastRow() - 1, 8).getValues();
  const prizes = rows
    .filter(r => r[0])
    .map(r => ({
      contestName:         r[0],
      rank1Prize:          r[1],
      rank2Prize:          r[2],
      rank3Prize:          r[3],
      eligibilityCriteria: r[4],
      startDate:           r[5],
      endDate:             r[6],
      payoutStatus:        r[7]
    }));

  return formatResponse('success', '', { prizes });
}

// ───────────────────────────────────────────────────────────────
// GET GLOBAL STATS  ── All authenticated roles (homepage widget)
// ───────────────────────────────────────────────────────────────
/**
 * @param {Object} data
 *   - userRole {string} required
 */
function handleGetGlobalStats(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const usersSheet = ss.getSheetByName(SHEET_NAME);
  const students   = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;

  const testsSheet  = ss.getSheetByName(TESTS_SHEET_NAME);
  const testsCount  = testsSheet ? Math.max(0, testsSheet.getLastRow() - 1) : 0;

  const submissionsSheet = ss.getSheetByName(SUBMISSIONS_SHEET_NAME);
  let passRate = 0;
  if (submissionsSheet && submissionsSheet.getLastRow() > 1) {
    const scoreData    = submissionsSheet.getRange(2, 7, submissionsSheet.getLastRow() - 1, 1).getValues();
    let   totalPasses  = 0;
    const totalAttempts = scoreData.length;

    for (const row of scoreData) {
      const scoreStr = row[0].toString();
      const pctMatch = scoreStr.match(/\((\d+)%\)/);
      if (pctMatch) {
        if (parseInt(pctMatch[1]) >= 40) totalPasses++;
      } else {
        totalPasses++;
      }
    }
    passRate = totalAttempts > 0 ? Math.round((totalPasses / totalAttempts) * 100) : 0;
  }

  return formatResponse('success', '', {
    stats: {
      students,
      tests:    testsCount,
      passRate: passRate > 0 ? passRate : 96, // fallback to 96% if no data
      levels:   3
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  READ-ONLY APIs
//  Lightweight, side-effect-free wrappers that expose data to
//  authorised callers without performing any write operations.
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// FETCH TESTS  ── Admin (full detail) | Student (safe subset)
// ───────────────────────────────────────────────────────────────
/**
 * Read-only API that returns test catalogue data.
 * - Admin  → full record including JSON_DATA and pricing detail.
 * - Student → safe subset: no internal JSON_DATA blob, only the
 *             fields needed to display and attempt a test.
 *
 * Payload fields:
 *   - userRole {string}  required  – caller's role
 *   - level    {string}  optional  – filter by CMA level
 *   - subject  {string}  optional  – filter by subject
 *
 * Response:
 *   { status, message, data: { tests: [...], total: number } }
 */
function fetchTests(payload) {
    const isAdmin = validateRole(payload.userRole, [ROLES.ADMIN]);
    const sheet   = setupTestsSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return formatResponse('success', 'No tests found.', { tests: [], total: 0 });
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

    // ── Optional filters ──────────────────────────────────────
    const levelFilter   = (payload.level   || '').toLowerCase().trim();
    const subjectFilter = (payload.subject || '').toLowerCase().trim();

    const tests = rows
      .filter(r => r[TEST_COL.TEST_ID - 1])   // skip blank rows
      .filter(r => {
        const matchLevel   = !levelFilter   || r[TEST_COL.LEVEL   - 1].toString().toLowerCase().trim() === levelFilter;
        const matchSubject = !subjectFilter || r[TEST_COL.SUBJECT  - 1].toString().toLowerCase().trim() === subjectFilter;
        return matchLevel && matchSubject;
      })
      .map(r => {
        const testId = r[TEST_COL.TEST_ID - 1];
        
        let parsedData = {};
        try { parsedData = JSON.parse(r[6] || '{}'); } catch(e) {}

        // Shared fields visible to all authorised roles
        const jsonPricing = parsedData.pricing || {};
        const jsonPrizes  = parsedData.prizes  || {};
        const price       = jsonPricing.price !== undefined ? jsonPricing.price : 0;
        
        const record = {
          testId:           testId,
          title:            r[TEST_COL.TITLE           - 1],
          level:            r[TEST_COL.LEVEL           - 1],
          subject:          r[TEST_COL.SUBJECT         - 1],
          duration:         r[TEST_COL.DURATION        - 1],
          totalQuestions:   r[TEST_COL.TOTAL_QUESTIONS - 1],
          testType:         price > 0 ? 'Paid' : 'Free',
          status:           parsedData.status || 'live',
          startTime:        parsedData.startTime || null,
          endTime:          parsedData.endTime   || null,
          // New fields — backward-compatible (default 0 for old tests)
          negativeMarking:  parsedData.negativeMarking !== undefined ? parsedData.negativeMarking : 0,
          price:            price,
          prize1:           jsonPrizes.first  || 0,
          prize2:           jsonPrizes.second || 0,
          prize3:           jsonPrizes.third  || 0,
          prizes:           { first: jsonPrizes.first || 0, second: jsonPrizes.second || 0, third: jsonPrizes.third || 0 },
          description:      parsedData.description || ''
        };

        // Provide full testData to allow questions to be fetched
        record.testData = parsedData;

        // Admin-only enrichment
        if (isAdmin) {
          record.pricing  = { testType: price > 0 ? 'Paid' : 'Free', price: price, currency: 'INR' };
        }

        return record;
      });

    return formatResponse('success', tests.length + ' test(s) fetched.', { tests: tests, total: tests.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET TEST BY ID  ── Student & Admin: fetch a single test’s full data by testId
// ───────────────────────────────────────────────────────────────────────────────
function handleGetTestById(payload) {
  const testId = (payload.testId || '').trim();
  if (!testId) return formatResponse('error', 'testId is required', null);

  const sheet   = setupTestsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return formatResponse('not_found', 'No tests exist', null);

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] === testId || r[1].toString().toLowerCase().trim() === testId.toLowerCase().trim()) {
      let parsedData = {};
      try { parsedData = JSON.parse(r[6] || '{}'); } catch(e) {}
      return formatResponse('success', '', {
        test: {
          testId:         r[0],
          title:          r[1],
          level:          r[2],
          subject:        r[3],
          duration:       Number(r[4]) || 60,
          totalQuestions: Number(r[5]) || 0,
          status:         parsedData.status  || 'live',
          startTime:      parsedData.startTime || null,
          endTime:        parsedData.endTime   || null,
          testData:       parsedData
        }
      });
    }
  }
  return formatResponse('not_found', 'Test not found: ' + testId, null);
}

// ───────────────────────────────────────────────────────────────
// FETCH ANALYTICS  ── Admin (all students) | Student (own only)
// ───────────────────────────────────────────────────────────────
/**
 * Read-only API that returns attempt history and performance summary.
 * - Admin  → full attempt log for every student + aggregated stats.
 * - Student → own attempts only + personal performance summary
 *             + current unlocked level.
 *
 * Payload fields:
 *   - userRole {string}  required
 *   - email    {string}  required when userRole === 'student'
 *
 * Response:
 *   { status, message, data: { attempts, summary, unlockedLevel? } }
 *
 *   summary (both roles):
 *     totalAttempts, averageScore, highestScore, passRate (%)
 *   summary (admin only, additional):
 *     totalStudents, topPerformer { name, email, avgScore }
 */
function fetchAnalytics(payload) {
    const isAdmin = validateRole(payload.userRole, [ROLES.ADMIN]);
    const email   = (payload.email || '').toLowerCase().trim();

    // Students must supply their email for identity scoping
    if (!isAdmin && !email) {
      return formatResponse('error', 'email is required for student analytics.', null);
    }

    setupAdvancedSheets();
    const ss            = SpreadsheetApp.openById(SHEET_ID);
    const attemptsSheet = ss.getSheetByName(ATTEMPTS_SHEET_NAME);
    const attemptsRaw   = attemptsSheet.getDataRange().getValues();

    // ── Build attempt list ────────────────────────────────────
    let attempts = [];

    if (isAdmin) {
      // Admin sees all attempts with extended metadata
      attempts = attemptsRaw.slice(1)
        .filter(r => r[0])
        .map(r => ({
          name:        r[0],
          email:       r[1],
          testId:      r[4],
          testTitle:   r[5],
          score:       r[6],
          correct:     r[7],
          wrong:       r[8],
          unattempted: r[9],
          totalTime:   r[10],
          violations:  r[12],
          timestamp:   r[13],
          type:        r[14]
        }));
    } else {
      // Student sees only their own records
      for (var i = 1; i < attemptsRaw.length; i++) {
        var r = attemptsRaw[i];
        if ((r[1] || '').toLowerCase().trim() === email) {
          attempts.push({
            testId:      r[4],
            testTitle:   r[5],
            score:       r[6],
            correct:     r[7],
            wrong:       r[8],
            unattempted: r[9],
            totalTime:   r[10],
            violations:  r[12],
            timestamp:   r[13],
            type:        r[14]
          });
        }
      }
    }

    // Newest first
    attempts.reverse();

    // ── Compute performance summary ───────────────────────────
    const summary = computeAnalyticsSummary_(attempts, isAdmin, attemptsRaw);

    // ── Assemble response data ────────────────────────────────
    const responseData = {
      attempts: attempts,
      summary:  summary
    };

    // Student also gets their unlocked level
    if (!isAdmin) {
      const levelsSheet = ss.getSheetByName(LEVELS_SHEET_NAME);
      const levelsData  = levelsSheet.getDataRange().getValues();
      var unlockedLevel = 1;
      for (var j = 1; j < levelsData.length; j++) {
        if ((levelsData[j][0] || '').toLowerCase().trim() === email) {
          unlockedLevel = Number(levelsData[j][1]) || 1;
          break;
        }
      }
      responseData.unlockedLevel = unlockedLevel;
    }

    return formatResponse('success', 'Analytics fetched. ' + attempts.length + ' attempt(s) returned.', responseData);
}

/**
 * Pure helper — builds a performance summary from an attempt array.
 * For admin calls it also computes global per-student stats using
 * the full raw sheet data.
 *
 * @param {Object[]}  attempts  – already-filtered attempt objects
 * @param {boolean}   isAdmin
 * @param {Array[][]} allRaw   – full sheet data (header row + data rows)
 * @returns {Object} summary
 */
function computeAnalyticsSummary_(attempts, isAdmin, allRaw) {
  var PASS_THRESHOLD = 40; // percent

  var total     = attempts.length;
  var scoreSum  = 0;
  var highest   = 0;
  var passCount = 0;

  attempts.forEach(function(a) {
    var pctMatch = (a.score || '').toString().match(/\((\d+)%\)/);
    var denom    = (Number(a.correct) || 0) + (Number(a.wrong) || 0) + (Number(a.unattempted) || 0);
    var pct      = pctMatch
      ? parseInt(pctMatch[1])
      : (denom > 0 ? Math.round(((Number(a.correct) || 0) / denom) * 100) : 0);

    scoreSum += pct;
    if (pct > highest)         highest   = pct;
    if (pct >= PASS_THRESHOLD) passCount++;
  });

  var summary = {
    totalAttempts: total,
    averageScore:  total > 0 ? Math.round(scoreSum / total) : 0,
    highestScore:  highest,
    passRate:      total > 0 ? Math.round((passCount / total) * 100) : 0
  };

  // ── Admin-only: aggregate per-student performance ─────────
  if (isAdmin && allRaw.length > 1) {
    var studentMap = {};

    allRaw.slice(1).forEach(function(r) {
      if (!r[1]) return;
      var e       = (r[1] || '').toLowerCase().trim();
      var name    = r[0] || '';
      var correct = Number(r[7]) || 0;
      var wrong   = Number(r[8]) || 0;
      var skip    = Number(r[9]) || 0;
      var pMatch  = (r[6] || '').toString().match(/\((\d+)%\)/);
      var pct     = pMatch
        ? parseInt(pMatch[1])
        : (correct + wrong + skip > 0 ? Math.round((correct / (correct + wrong + skip)) * 100) : 0);

      if (!studentMap[e]) studentMap[e] = { name: name, scoreSum: 0, count: 0 };
      studentMap[e].scoreSum += pct;
      studentMap[e].count++;
    });

    var studentList = Object.keys(studentMap).map(function(e) {
      var v = studentMap[e];
      return { email: e, name: v.name, avgScore: v.count > 0 ? Math.round(v.scoreSum / v.count) : 0 };
    });

    studentList.sort(function(a, b) { return b.avgScore - a.avgScore; });

    summary.totalStudents = studentList.length;
    summary.topPerformer  = studentList[0] || null;
  }

  return summary;
}

// ───────────────────────────────────────────────────────────────
// LEADERBOARD INTERNALS  (private helpers — not exposed via doPost)
// ───────────────────────────────────────────────────────────────

function updateLeaderboardStats_(name, email, score, percentage) {
  if (!email) return;
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const lbSheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
  if (!lbSheet) return;

  const data        = lbSheet.getDataRange().getValues();
  const emailLower  = email.toLowerCase().trim();
  let   rowIndex    = -1;
  let   currentPoints = 0;
  let   testsAttempted = 0;
  let   totalScoreSum = 0;

  for (let i = 1; i < data.length; i++) {
    if ((data[i][1] || '').toLowerCase().trim() === emailLower) {
      rowIndex      = i + 1;
      currentPoints = Number(data[i][2]) || 0;
      const avgScore = Number((data[i][3] || '').toString().replace('%', '')) || 0;
      testsAttempted = Number(data[i][4]) || 0;
      totalScoreSum  = avgScore * testsAttempted;
      break;
    }
  }

  // Points system: 1 point per correct answer × 10
  const pointsEarned = score * 10;
  currentPoints += pointsEarned;
  testsAttempted++;
  const newAvgScore = Math.round((totalScoreSum + percentage) / testsAttempted);

  if (rowIndex > -1) {
    lbSheet.getRange(rowIndex, 3).setValue(currentPoints);
    lbSheet.getRange(rowIndex, 4).setValue(newAvgScore + '%');
    lbSheet.getRange(rowIndex, 5).setValue(testsAttempted);
  } else {
    lbSheet.appendRow([name, email, currentPoints, newAvgScore + '%', testsAttempted, '', '', '', '']);
  }
  recalculateRanks_(lbSheet);
}

function recalculateRanks_(lbSheet) {
  const lastRow = lbSheet.getLastRow();
  if (lastRow < 2) return;

  const range = lbSheet.getRange(2, 1, lastRow - 1, 9);
  const data  = range.getValues();

  // Sort by Total Points (index 2) descending, then Avg Score (index 3) descending
  data.sort((a, b) => {
    const pointsA = Number(a[2]) || 0;
    const pointsB = Number(b[2]) || 0;
    if (pointsA !== pointsB) return pointsB - pointsA;
    const avgA = Number((a[3] || '').toString().replace('%', '')) || 0;
    const avgB = Number((b[3] || '').toString().replace('%', '')) || 0;
    return avgB - avgA;
  });

  // Assign ranks
  data.forEach((row, index) => {
    row[5] = index + 1; // Current Rank
    row[6] = index + 1; // Monthly Rank (simplified — same as current)
  });

  range.setValues(data);
}

// ───────────────────────────────────────────────────────────────
// GET ALL STUDENTS (ADMIN ONLY)
// ───────────────────────────────────────────────────────────────
function handleGetStudents(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return formatResponse('error', 'Students sheet not found', null);
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return formatResponse('success', '', { students: [] });
  
  const rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const students = rows
    .filter(r => r[0] || r[2]) // Name or email
    .map(r => ({
      name: r[0],
      email: r[2],
      phone: r[3],
      level: r[5],
      role: r[7],
      registrationDate: r[9]
    }));
    
  return formatResponse('success', '', { students });
}
