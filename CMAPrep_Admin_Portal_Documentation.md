# CMAPrep Pro: MCQ Admin Portal Documentation

## 1. Overview & Purpose
The **MCQ Admin Portal** (`mcq_admin_panel.html`) is a core administrative tool within the CMAPrep Pro platform. Its primary purpose is to allow administrators and educators to seamlessly generate, manage, and export large sets of Multiple Choice Questions (MCQs) for student test series. 

The portal supports a hybrid approach to question generation:
*   **AI-Powered PDF Extraction:** Automatically parses syllabus materials and utilizes the Groq LLM API to generate categorized MCQs.
*   **Manual Entry:** Allows educators to write custom questions directly into the platform.
*   **Image-Extraction/OCR Workflow:** Allows educators to import and verify questions from image-based sources.

---

## 2. Core Architecture & Technologies
The application is built using a lightweight, client-side architecture to maximize speed and reduce server overhead during question generation.

*   **Frontend Technologies:** HTML5, Vanilla JavaScript (ES6+), CSS3 (Custom Properties & CSS Grid/Flexbox).
*   **PDF Parsing:** `pdf.js` (Mozilla) is used to read and chunk PDF documents entirely in the browser.
*   **AI Generation:** Integrates with the **Groq API** (`llama-3.3-70b-versatile`) for high-speed, zero-shot MCQ generation based on extracted text chunks.
*   **State Management:** Utilizes localized variables (`mcqs`, `answers`, `tsSelected`) with unique hash-based IDs to maintain data integrity across hundreds of questions without React or Vue.
*   **Authentication:** Session-based validation (`sessionStorage`) linked to the Google Apps Script backend.

---

## 3. Security & Authentication Configuration
The portal is locked down to administrative users only.

**How it works:**
1. Upon loading `mcq_admin_panel.html`, an Immediately Invoked Function Expression (IIFE) executes before the DOM renders.
2. It checks `sessionStorage.getItem('cmaUser')`.
3. It verifies that the user object exists and that `user.role === 'admin'`.
4. If the check fails, the user is forcefully redirected to `index.html#login` (or `dashboard.html` if they are a student).

**Configuration:**
To modify access levels, edit the Security script at the top of the HTML file. For production, ensure your backend (Google Apps Script) also strictly verifies the `userRole` against the database rather than trusting the client payload.

---

## 4. Detailed Workflow: PDF Upload & AI Parsing
The primary engine of the portal is the PDF-to-MCQ pipeline.

### Step 4.1: File Upload
*   The admin uploads a `.pdf` file via drag-and-drop or file selection.
*   The browser loads the file into memory (File API) and validates the MIME type.

### Step 4.2: Chapter Detection & Chunking
*   `pdf.js` extracts raw text from the document.
*   The `detectChapters()` function uses Regex patterns (e.g., matching "Chapter 1", "Module IV") to intelligently slice the document into thematic chunks.
*   If no chapters are found, `generateFallbackChapters()` safely splits the text into ~1500-word blocks.

### Step 4.3: Groq AI Generation
*   The admin inputs their **Groq API Key**.
*   The selected chapters are sanitized (removing special characters to prevent JSON escaping errors) and sent to the Groq API.
*   **Prompt Engineering:** The LLM is strictly instructed to return a JSON array containing exactly 100 questions distributed across Easy, Medium, and Hard difficulties.

---

## 5. Detailed Workflow: The Question Bank & Builder
Once questions are generated (or when manually adding them), they enter the **Test Series Builder**.

### 5.1 Unique ID System
Every question is assigned a globally unique ID generated via:
```javascript
'mcq_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)
```
This ensures that if Question A is deleted, it does not shift the array index and corrupt the correct answer mapping for Question B. 

### 5.2 Adding Manual / Image Questions
*   Admins can click **+ Manual** or **+ Image**.
*   This triggers `openAddModal()`, which provides a clean slate with 4 default option fields.
*   Validation prevents saving if the question text is empty, if there are less than 2 options, or if a correct answer is not designated.
*   The newly created question is tagged with the respective `source` ("manual" or "image") and pushed to the `mcqs` memory array.

### 5.3 Pagination & Performance
To prevent DOM lag when managing hundreds of questions, the Question Bank is paginated.
*   `renderBuilderList()` renders questions in chunks of `20`.
*   A **"Load More"** button dynamically appends the next chunk to the scrollable list without triggering a full page repaint.

---

## 6. Source-Based Analytics & Dashboard
The Right-Hand Sidebar acts as a dynamic analytics dashboard.

*   **Difficulty Distribution:** A dynamic SVG Donut chart calculates the percentage of Easy (Green), Medium (Gold), and Hard (Red) questions currently selected.
*   **Source Tracking:** The panel actively tallies how many selected questions originated from PDFs, Manual Entry, or Image OCR.
*   These stats update instantly via `updateBuilderStats()` whenever a question is toggled, edited, or deleted.

---

## 7. Export Format & Data Integrity
When the admin finalizes the Test Series, clicking **Export Test File** generates a JSON file.

### Schema Structure
The resulting `.testseries.json` adheres to a strict schema necessary for the Student Portal to read and auto-grade tests:

```json
{
  "version": "1.0",
  "format": "mcq-test-series",
  "meta": {
    "title": "CMA Final Direct Tax",
    "subject": "Direct Taxation",
    "duration": 60,
    "passingPercentage": 40,
    "totalQuestions": 50,
    "difficulty": { "easy": 15, "medium": 25, "hard": 10 },
    "sources": { "pdf": 48, "manual": 2, "image": 0 },
    "createdAt": "2026-04-30T15:00:00.000Z"
  },
  "questions": [
    {
      "id": "mcq_ltb123_4z9x",
      "question": "What is the penalty for late filing?",
      "options": ["₹1000", "₹5000", "₹10000", "None"],
      "difficulty": "medium",
      "source": "pdf",
      "correctAnswer": 1
    }
  ]
}
```
*Note: The `correctAnswer` is exposed in the JSON for auto-grading but must be masked by the frontend when rendering tests to the students.*

---

## 8. Configuration & Setup Guide

### 8.1 API Key Configuration
The application currently requires the administrator to manually paste a Groq API Key into the UI.
**To configure this securely for production:**
1. Remove the API key input field from the UI.
2. Route the generation request through your Google Apps Script (`Code.gs`) backend.
3. Store the Groq API key securely in the Google Apps Script **Script Properties**.

### 8.2 Adjusting AI Generation Limits
To change the number of questions generated:
1. Locate `generateMCQs()` in `mcq_admin_panel.html`.
2. Update the prompt string: `Generate exactly 100 unique multiple-choice questions`.
3. Change the slice limit: `return parsed.slice(0, 100)...`.

### 8.3 Adjusting Pagination Settings
To show more or fewer questions per page in the Builder:
1. Locate the variable `const qbankPageSize = 20;`.
2. Adjust this number (e.g., `50`). Be aware that values higher than 100 may cause scrolling lag on lower-end devices.

---

## 9. Troubleshooting

*   **PDF Fails to Analyze:** Ensure you are using a standard, text-based PDF. Scanned images wrapped in PDFs will fail text extraction. An OCR pre-processing step is required for scanned documents.
*   **"No valid MCQs extracted" Error:** The AI model occasionally fails to output perfect JSON. The `safeParseQuestions()` function handles most syntax errors (like trailing commas), but if the model outputs heavy markdown, the parsing will abort. Re-clicking "Generate" usually resolves this.
*   **Redirect Loop:** If you are instantly kicked out of the panel, verify your session. Open Chrome DevTools -> Application -> Session Storage and ensure `cmaUser` contains `{"role":"admin"}`.
