import re
import os

filepath = r'g:\Platform\mcq_admin_panel.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Security Script
security_script = """
<script>
// SECURITY AWARENESS (Admin context)
(function() {
  try {
    const raw = sessionStorage.getItem('cmaUser');
    if (!raw) { window.location.replace('index.html#login'); return; }
    const user = JSON.parse(raw);
    if (user.role !== 'admin') { window.location.replace('dashboard.html'); }
  } catch(e) { window.location.replace('index.html#login'); }
})();
</script>
"""
content = content.replace('</style>\n</head>', '</style>\n' + security_script + '</head>')

# 2. Add generateId
id_func = """
function generateId() {
  return 'mcq_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}
"""
content = content.replace('// ── State ──', id_func + '\n// ── State ──')

# 3. Update parsed mcqs mapping to add ID
content = content.replace("return parsed.slice(0,100).map(q => ({...q, source: 'pdf'}));", 
                          "return parsed.slice(0,100).map(q => ({...q, id: generateId(), source: 'pdf'}));")

# 4. Modify answers to map from ID -> answer index
content = content.replace('answers[gi]', 'answers[q.id]')
content = content.replace('answers[idx]=optIdx;', 'answers[id]=optIdx;')

# Let's use regex to replace specific functions.
content = content.replace('function selectAnswer(idx,optIdx){', 'function selectAnswer(id,optIdx){')
content = content.replace('const card=$(`mcq-${idx}`);', 'const card=$(`mcq-${id}`);')
content = content.replace('selectAnswer(${gi},${oi})', "selectAnswer('${q.id}',${oi})")
content = content.replace('id="mcq-${gi}"', 'id="mcq-${q.id}"')

# Quiz submit logic
content = content.replace('const correct=mcqs.filter((q,i)=>answers[i]===q.ans).length;', 'const correct=mcqs.filter(q=>answers[q.id]===q.ans).length;')

# Quiz new gen / go to builder
content = content.replace('tsSelected=new Set(mcqs.map((_,i)=>i)); // start with all selected', 'tsSelected=new Set(mcqs.map(q=>q.id)); // start with all selected')

# 5. Fix renderBuilderList to use ID
content = content.replace('onclick="toggleQSelection(${i})" data-idx="${i}"', 'onclick="toggleQSelection(\\'${q.id}\\')" data-id="${q.id}"')
content = content.replace('onclick="openEditModal(${i})"', "onclick=\"openEditModal('${q.id}')\"")
content = content.replace('onclick="openDelConfirm(${i})"', "onclick=\"openDelConfirm('${q.id}')\"")

# toggleQSelection
content = content.replace('function toggleQSelection(idx){', 'function toggleQSelection(id){')
content = content.replace('tsSelected.has(idx)', 'tsSelected.has(id)')
content = content.replace('tsSelected.delete(idx);', 'tsSelected.delete(id);')
content = content.replace('tsSelected.add(idx);', 'tsSelected.add(id);')
content = content.replace('onclick.includes(`(${idx})`)', "onclick.includes(`('${id}')`)")

# getFilteredIndices -> getFilteredQuestions
content = content.replace('function getFilteredIndices(){', 'function getFilteredQuestions(){')
content = content.replace('acc.push(i);', 'acc.push(q);')
content = content.replace('const indices=getFilteredIndices();', 'const filteredQs=getFilteredQuestions();')
content = content.replace('indices.length', 'filteredQs.length')
content = content.replace('list.innerHTML=indices.map(i=>{', 'list.innerHTML=filteredQs.map((q, i)=>{')
content = content.replace('const q=mcqs[i];', '') # remove this line inside map
content = content.replace('const sel=tsSelected.has(i);', 'const sel=tsSelected.has(q.id);')

# Select All/None Q
content = content.replace('getFilteredIndices().forEach(i=>tsSelected.add(i));', 'getFilteredQuestions().forEach(q=>tsSelected.add(q.id));')
content = content.replace('getFilteredIndices().forEach(i=>tsSelected.delete(i));', 'getFilteredQuestions().forEach(q=>tsSelected.delete(q.id));')

# updateBuilderStats
content = content.replace('const sel=Array.from(tsSelected).map(i=>mcqs[i]);', 'const sel=Array.from(tsSelected).map(id=>mcqs.find(q=>q.id===id)).filter(Boolean);')

# Export logic:
content = content.replace('const sel=Array.from(tsSelected).sort((a,b)=>a-b);', 'const sel=Array.from(tsSelected).map(id=>mcqs.find(q=>q.id===id)).filter(Boolean);')
content = content.replace('sel.map((i,idx)=>({', 'sel.map((qObj,idx)=>({')
content = content.replace('mcqs[i]', 'qObj')

# Open Preview Modal
content = content.replace('const sel=Array.from(tsSelected).sort((a,b)=>a-b).map(i=>mcqs[i]);', 'const sel=Array.from(tsSelected).map(id=>mcqs.find(q=>q.id===id)).filter(Boolean);')


# 6. Pagination & DOM Optimization for `renderBuilderList`
pagination_code = """
let qbankPage = 0;
const qbankPageSize = 20;

function renderBuilderList(append=false) {
  const list=$('qbankList');
  const filteredQs=getFilteredQuestions();
  $('qbankCountLabel').textContent=`${filteredQs.length} questions shown`;
  
  if(!filteredQs.length){list.innerHTML='<div class="empty-state" style="padding:2rem"><p>No questions match the filter.</p></div>';return;}
  
  if (!append) qbankPage = 0;
  
  const start = qbankPage * qbankPageSize;
  const end = start + qbankPageSize;
  const chunk = filteredQs.slice(start, end);
  
  const html = chunk.map((q, idx)=>{
    const actualIdx = start + idx;
    const sel=tsSelected.has(q.id);
    const optsHtml=(q.opts||[]).map((o,oi)=>`<div class="q-opt-chip">${'ABCD'[oi]}. ${o.length>22?o.substring(0,22)+'…':o}</div>`).join('');
    const sourceBadge = q.source === 'manual' ? '<span class="diff-badge" style="background:rgba(240,192,96,0.1);color:var(--gold);">Manual</span>' : q.source === 'image' ? '<span class="diff-badge" style="background:rgba(96,184,240,0.1);color:var(--blue);">Image</span>' : '<span class="diff-badge" style="background:rgba(200,184,255,0.1);color:var(--accent);">PDF</span>';
    return `<div class="q-row${sel?' selected':''}" onclick="toggleQSelection('${q.id}')" data-id="${q.id}">
      <div class="q-check"><div class="q-check-inner"></div></div>
      <div class="q-body">
        <div class="q-meta-row">
          <span class="q-num-label">Q${actualIdx+1}</span>
          <span class="diff-badge diff-${q.diff}" style="font-size:10px;padding:2px 7px;">${q.diff}</span>
          ${sourceBadge}
        </div>
        <div class="q-text">${q.q}</div>
        <div class="q-opts-preview">${optsHtml}</div>
      </div>
      <div class="q-row-actions" onclick="event.stopPropagation()">
        <div class="q-action-btn edit" title="Edit question" onclick="openEditModal('${q.id}')">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div class="q-action-btn del" title="Delete question" onclick="openDelConfirm('${q.id}')">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');

  if (append) {
    // remove load more button
    const btn = document.getElementById('loadMoreBtn');
    if(btn) btn.remove();
    list.innerHTML += html;
  } else {
    list.innerHTML = html;
  }
  
  if (end < filteredQs.length) {
    list.innerHTML += `<div id="loadMoreBtn" style="text-align:center; padding:15px;"><button class="btn btn-ghost btn-sm" onclick="qbankPage++; renderBuilderList(true);">Load More...</button></div>`;
  }
}
"""
content = re.sub(r'function renderBuilderList\(\)\{.*?(?=function toggleQSelection)', pagination_code, content, flags=re.DOTALL)


# 7. Edit and Delete Logic 
content = content.replace('let editingIdx = -1;', 'let editingId = null;')
content = content.replace('function openEditModal(idx) {', 'function openEditModal(id) {')
content = content.replace('editingIdx = idx;', 'editingId = id;')
content = content.replace('const q = mcqs[idx];', 'const q = mcqs.find(x => x.id === id); const idx = mcqs.findIndex(x => x.id === id);')

content = content.replace('function openAddModal(source) {', 'function openAddModal(source) {')
content = content.replace('editingIdx = -1;', 'editingId = null;')

content = content.replace('if (editingIdx >= 0) {', 'if (editingId) {')
content = content.replace('mcqs[editingIdx]', 'mcqs.find(x=>x.id===editingId)')
content = content.replace('mcqs.find(x=>x.id===editingId) = { q: qText, opts, ans: editCorrectIdx, diff: editDiff, source: mcqs.find(x=>x.id===editingId).source || \'pdf\' };', 
                          'const idx=mcqs.findIndex(x=>x.id===editingId); mcqs[idx] = { ...mcqs[idx], q: qText, opts, ans: editCorrectIdx, diff: editDiff };')

content = content.replace('answers[editingIdx]', 'answers[editingId]')
content = content.replace('showToast(`Q${editingIdx+1} updated successfully`);', 'showToast(`Question updated successfully`);')

content = content.replace('const newIdx = mcqs.length;', 'const newId = generateId();')
content = content.replace('mcqs.push({ q: qText, opts, ans: editCorrectIdx, diff: editDiff, source: addSourceMode });', 'mcqs.push({ id: newId, q: qText, opts, ans: editCorrectIdx, diff: editDiff, source: addSourceMode });')
content = content.replace('answers[newIdx] = editCorrectIdx;', 'answers[newId] = editCorrectIdx;')
content = content.replace('tsSelected.add(newIdx);', 'tsSelected.add(newId);')

# Delete logic
content = content.replace('let deletingIdx = -1;', 'let deletingId = null;')
content = content.replace('function openDelConfirm(idx) {', 'function openDelConfirm(id) {')
content = content.replace('deletingIdx = idx;', 'deletingId = id;')
content = content.replace('const q = mcqs[idx];', 'const q = mcqs.find(x=>x.id===id);')

content = content.replace('if (deletingIdx < 0) return;', 'if (!deletingId) return;')
content = content.replace('const idx = deletingIdx;', 'const id = deletingId;')

del_logic = """
  // Remove from mcqs
  mcqs = mcqs.filter(x => x.id !== id);
  // Remove from answers
  delete answers[id];
  // Remove from tsSelected
  tsSelected.delete(id);
"""
content = re.sub(r'// Remove from mcqs.*?tsSelected = newSel;', del_logic, content, flags=re.DOTALL)
content = content.replace('deletingIdx = -1;', 'deletingId = null;')

# Source analytics update in tsStatsStrip
stats_strip_new = """
    <!-- Stats strip -->
    <div class="ts-stats-strip" id="tsStatsStrip">
      <div class="ts-stat-card">
        <div class="ts-stat-num purple" id="tsStatTotal">0</div>
        <div class="ts-stat-label">Selected</div>
      </div>
      <div class="ts-stat-card">
        <div class="ts-stat-num green" id="tsStatEasy">0</div>
        <div class="ts-stat-label">Easy</div>
      </div>
      <div class="ts-stat-card">
        <div class="ts-stat-num gold" id="tsStatMed">0</div>
        <div class="ts-stat-label">Medium</div>
      </div>
      <div class="ts-stat-card">
        <div class="ts-stat-num red" id="tsStatHard">0</div>
        <div class="ts-stat-label">Hard</div>
      </div>
    </div>
    
    <div class="ts-stats-strip" style="margin-bottom: 1.5rem; display: flex; gap: 10px; justify-content: center; background: var(--surface2); padding: 10px; border-radius: 10px; border: 1px solid var(--border);">
       <div style="font-size:12px; font-family:var(--mono); color:var(--text3);"><span style="color:var(--accent)">PDF:</span> <span id="srcCountPdf">0</span></div>
       <div style="font-size:12px; font-family:var(--mono); color:var(--text3);"><span style="color:var(--gold)">Manual:</span> <span id="srcCountManual">0</span></div>
       <div style="font-size:12px; font-family:var(--mono); color:var(--text3);"><span style="color:var(--blue)">Image:</span> <span id="srcCountImage">0</span></div>
    </div>
"""
content = re.sub(r'<!-- Stats strip -->.*?</div>\s*</div>\s*<!-- Main 2-col layout -->', stats_strip_new + '\n\n    <!-- Main 2-col layout -->', content, flags=re.DOTALL)

# Add logic to update source counts
update_builder_stats = """
  // Source analytics
  $('srcCountPdf').textContent = sel.filter(q=>q.source==='pdf').length;
  $('srcCountManual').textContent = sel.filter(q=>q.source==='manual').length;
  $('srcCountImage').textContent = sel.filter(q=>q.source==='image').length;
"""
content = content.replace('$(\\'legendHard\\').textContent=hard;', "$('legendHard').textContent=hard;\n" + update_builder_stats)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("File updated successfully.")
