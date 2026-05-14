window.__currentPaperId = null;

document.addEventListener('DOMContentLoaded', function() {
  loadPapers();
  setupDropZone();
  setupSendButton();
});

// --- Paper List ---
async function loadPapers(query) {
  query = query || '';
  var url = query ? '/api/papers?q=' + encodeURIComponent(query) : '/api/papers';
  var res = await fetch(url);
  var papers = await res.json();
  renderPaperList(papers);
}

function renderPaperList(papers) {
  var container = document.getElementById('paper-list');
  if (papers.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无论文，点击右上角上传</p>';
    return;
  }
  container.innerHTML = papers.map(function(p) {
    var cls = p.id === window.__currentPaperId ? ' active' : '';
    return '<div class="paper-card' + cls + '" onclick="selectPaper(' + p.id + ')">' +
      '<div class="title">' + escapeHtml(p.title || p.filename) + '</div>' +
      '<div class="meta">' +
        '<span>' + p.page_count + 'p · ' + formatSize(p.file_size) + '</span>' +
        '<span>' + formatDate(p.created_at) + '</span>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn btn-sm" onclick="event.stopPropagation();deletePaper(' + p.id + ')" title="删除">删除</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function searchPapers() {
  loadPapers(document.getElementById('search-input').value);
}

// --- Paper Selection ---
async function selectPaper(id) {
  window.__currentPaperId = id;
  var res = await fetch('/api/papers/' + id);
  var paper = await res.json();
  if (paper.error) return alert(paper.error);
  renderPaperDetail(paper);
  loadConversations(id);
  loadPapers(document.getElementById('search-input').value);
}

function renderPaperDetail(paper) {
  // Update header
  var titleDisplay = document.getElementById('paper-title-display');
  var titleInput = document.getElementById('paper-title-input');
  if (titleDisplay) titleDisplay.style.display = 'none';
  if (titleInput) {
    titleInput.style.display = '';
    titleInput.value = paper.title || '';
  }

  var meta = paper.page_count + '页 · ' + formatSize(paper.file_size) + ' · ' + formatDate(paper.created_at);
  document.getElementById('paper-meta').textContent = meta;
  document.getElementById('paper-actions').style.display = '';

  // Update share button state
  var shareBtn = document.getElementById('share-btn');
  var shareUrl = document.getElementById('share-url');
  if (paper.share_token) {
    shareBtn.textContent = '取消分享';
    shareUrl.textContent = window.location.origin + '/s/' + paper.share_token;
    shareUrl.style.display = '';
  } else {
    shareBtn.textContent = '分享';
    shareUrl.textContent = '';
    shareUrl.style.display = 'none';
  }

  document.getElementById('view-tabs').style.display = 'flex';

  var isPdf = paper.filename.toLowerCase().endsWith('.pdf');
  var detail = document.getElementById('paper-detail');
  detail.innerHTML = '';

  // PDF / Text view
  var pdfDiv = document.createElement('div');
  pdfDiv.id = 'tab-pdf-content';
  if (isPdf) {
    var embed = document.createElement('embed');
    embed.className = 'pdf-embed';
    embed.src = '/api/papers/' + paper.id + '/file#toolbar=1&navpanes=0';
    embed.type = 'application/pdf';
    pdfDiv.appendChild(embed);
  } else {
    var textDiv = document.createElement('div');
    textDiv.className = 'text-content';
    var raw = paper.content_text || '';
    if (!raw) {
      textDiv.innerHTML = '<p class="empty-hint">无法提取文本内容</p>';
    } else {
      textDiv.innerHTML = raw.split('\n\n').map(function(p) {
        p = p.trim();
        return p ? '<p>' + escapeHtml(p) + '</p>' : '';
      }).join('');
    }
    pdfDiv.appendChild(textDiv);
  }
  detail.appendChild(pdfDiv);

  // Notes view
  var notesDiv = document.createElement('div');
  notesDiv.id = 'tab-notes-content';
  notesDiv.style.display = 'none';

  var toolbar = document.createElement('div');
  toolbar.className = 'notes-toolbar';
  toolbar.id = 'notes-toolbar';
  toolbar.innerHTML =
    '<select onchange="rtFontFamily(this.value)" title="字体">' +
      '<option value="">字体</option>' +
      '<option value="Georgia, serif">Georgia</option>' +
      '<option value="Arial, sans-serif">Arial</option>' +
      '<option value="\'Courier New\', monospace">Courier</option>' +
      '<option value="\'Noto Serif CJK SC\', serif">宋体</option>' +
      '<option value="\'Microsoft YaHei\', sans-serif">微软雅黑</option>' +
    '</select>' +
    '<select onchange="rtFontSize(this.value)" title="字号">' +
      '<option value="">字号</option>' +
      '<option value="1">小</option>' +
      '<option value="3">中</option>' +
      '<option value="5">大</option>' +
      '<option value="7">超大</option>' +
    '</select>' +
    '<span class="tb-sep"></span>' +
    '<button class="tb-btn" onclick="rtCmd(\'bold\')" title="加粗 Ctrl+B"><b>B</b></button>' +
    '<button class="tb-btn" onclick="rtCmd(\'italic\')" title="斜体 Ctrl+I"><i>I</i></button>' +
    '<button class="tb-btn" onclick="rtCmd(\'underline\')" title="下划线 Ctrl+U"><u>U</u></button>' +
    '<button class="tb-btn" onclick="rtCmd(\'strikeThrough\')" title="删除线"><s>S</s></button>' +
    '<span class="tb-sep"></span>' +
    '<input type="color" value="#ef4444" onchange="rtColor(this.value)" title="文字颜色">' +
    '<input type="color" value="#fbbf24" onchange="rtBgColor(this.value)" title="高亮背景">' +
    '<span class="tb-sep"></span>' +
    '<button class="tb-btn" onclick="rtCmd(\'insertUnorderedList\')" title="无序列表">&#8226;</button>' +
    '<button class="tb-btn" onclick="rtCmd(\'insertOrderedList\')" title="有序列表">1.</button>' +
    '<button class="tb-btn" onclick="rtCmd(\'formatBlock\',\'<h2>\')" title="标题">H</button>' +
    '<span class="tb-sep"></span>' +
    '<button class="tb-btn" onclick="rtCmd(\'undo\')" title="撤销">&#x21A9;</button>' +
    '<button class="tb-btn" onclick="rtCmd(\'redo\')" title="重做">&#x21AA;</button>';
  notesDiv.appendChild(toolbar);

  var editor = document.createElement('div');
  editor.className = 'notes-editor';
  editor.id = 'notes-editor';
  editor.contentEditable = true;
  editor.setAttribute('data-placeholder', '开始写笔记...');
  notesDiv.appendChild(editor);

  detail.appendChild(notesDiv);

  switchTab('pdf');
  loadNotes(paper.id);
}

// --- Tabs ---
function switchTab(tab) {
  var tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var pdfContent = document.getElementById('tab-pdf-content');
  var notesContent = document.getElementById('tab-notes-content');

  if (tab === 'pdf') {
    document.getElementById('tab-pdf').classList.add('active');
    if (pdfContent) pdfContent.style.display = '';
    if (notesContent) notesContent.style.display = 'none';
  } else {
    document.getElementById('tab-notes').classList.add('active');
    if (pdfContent) pdfContent.style.display = 'none';
    if (notesContent) notesContent.style.display = '';
  }
}

// --- Notes ---
window._notesTimer = null;

async function loadNotes(paperId) {
  var editor = document.getElementById('notes-editor');
  if (!editor) return;

  var res = await fetch('/api/papers/' + paperId + '/notes');
  var data = await res.json();
  editor.innerHTML = data.notes || '';

  // Auto-save on input
  editor.oninput = rtAutoSave;
  // Save on Ctrl+S
  editor.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveNotes(paperId);
    }
  });
}

async function saveNotes(paperId) {
  var editor = document.getElementById('notes-editor');
  if (!editor) return;
  var html = editor.innerHTML;
  // Don't save empty placeholder
  if (html === '<br>' || html === '<br>' || html === '') html = '';
  await fetch('/api/papers/' + paperId + '/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: html })
  });
}


// --- Rich Text editor ---
function rtCmd(cmd, val) {
  document.execCommand(cmd, false, val || null);
  var editor = document.getElementById('notes-editor');
  if (editor) editor.focus();
  rtAutoSave();
}

function rtFontFamily(font) {
  if (font) document.execCommand('fontName', false, font);
}

function rtFontSize(size) {
  if (size) document.execCommand('fontSize', false, size);
}

function rtColor(color) {
  document.execCommand('foreColor', false, color);
}

function rtBgColor(color) {
  document.execCommand('hiliteColor', false, color);
}

function rtAutoSave() {
  clearTimeout(window._notesTimer);
  window._notesTimer = setTimeout(function() {
    saveNotes(window.__currentPaperId);
  }, 600);
}

// --- Rename ---
function editTitle() {
  var display = document.getElementById('paper-title-display');
  var input = document.getElementById('paper-title-input');
  if (display) display.style.display = 'none';
  if (input) { input.style.display = ''; input.focus(); input.select(); }
}

async function renamePaper() {
  var input = document.getElementById('paper-title-input');
  if (!input || !window.__currentPaperId) return;
  var title = input.value.trim();
  if (!title) { alert('标题不能为空'); return; }

  var display = document.getElementById('paper-title-display');
  if (display) { display.textContent = title; display.style.display = ''; }
  if (input) input.style.display = 'none';

  await fetch('/api/papers/' + window.__currentPaperId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title })
  });
  loadPapers();
}

// --- Download ---
function downloadPaper() {
  if (!window.__currentPaperId) return;
  window.open('/api/papers/' + window.__currentPaperId + '/file', '_blank');
}

// --- Upload ---
function openUpload() {
  document.getElementById('upload-modal').classList.add('show');
  document.getElementById('upload-error').style.display = 'none';
  document.getElementById('upload-progress').style.display = 'none';
  document.getElementById('drop-zone').style.display = '';
}

function setupDropZone() {
  var zone = document.getElementById('drop-zone');
  var input = document.getElementById('file-input');
  if (!zone || !input) return;

  zone.addEventListener('click', function() { input.click(); });
  zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('active'); });
  zone.addEventListener('dragleave', function() { zone.classList.remove('active'); });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    zone.classList.remove('active');
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', function() {
    if (input.files.length) uploadFile(input.files[0]);
  });
}

async function uploadFile(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  if (['pdf', 'docx', 'doc'].indexOf(ext) === -1) {
    showUploadError('仅支持 PDF 和 Word (.pdf/.docx/.doc) 文件');
    return;
  }

  document.getElementById('drop-zone').style.display = 'none';
  document.getElementById('upload-progress').style.display = 'flex';
  document.getElementById('upload-error').style.display = 'none';

  var formData = new FormData();
  formData.append('file', file);

  try {
    var res = await fetch('/api/papers', { method: 'POST', body: formData });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    closeModal('upload-modal');
    loadPapers();
    selectPaper(data.id);
  } catch (e) {
    showUploadError(e.message);
    document.getElementById('drop-zone').style.display = '';
    document.getElementById('upload-progress').style.display = 'none';
  }
}

function showUploadError(msg) {
  var el = document.getElementById('upload-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// --- Delete ---
async function deletePaper(id) {
  if (!confirm('确定要删除这篇论文吗？相关问答记录也将被删除。')) return;
  var res = await fetch('/api/papers/' + id, { method: 'DELETE' });
  var data = await res.json();
  if (data.ok) {
    if (window.__currentPaperId === id) {
      window.__currentPaperId = null;
      document.getElementById('paper-detail').innerHTML = '<p class="empty-hint">选择左侧论文查看详情</p>';
      document.getElementById('paper-meta').textContent = '';
      document.getElementById('paper-actions').style.display = 'none';
      var shareUrlEl = document.getElementById('share-url');
      if (shareUrlEl) { shareUrlEl.textContent = ''; shareUrlEl.style.display = 'none'; }
      document.getElementById('view-tabs').style.display = 'none';
      document.getElementById('paper-title-input').style.display = 'none';
      document.getElementById('paper-title-display').style.display = '';
      document.getElementById('paper-title-display').textContent = '论文详情';
      document.getElementById('chat-history').innerHTML = '<p class="empty-hint">直接提问或选中论文后结合论文提问</p>';
    }
    loadPapers();
  }
}

// --- AI Q&A ---
function doSend() {
  var input = document.getElementById('question-input');
  if (!input) return;
  var question = input.value.trim();
  if (!question) return;
  if (!window.__currentPaperId) { alert('请先在左侧选择一篇论文'); return; }

  var researchDirection = document.getElementById('research-direction').value.trim();
  input.value = '';
  input.focus();
  addChatBubble('question', question);
  sendToAI(question, researchDirection);
}

function setupSendButton() {
  // Double insurance: inline handlers already work,
  // but also add JS listeners for robustness
  var input = document.getElementById('question-input');
  var btn = document.getElementById('send-btn');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) {
        e.preventDefault();
        doSend();
      }
    });
  }
  if (btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      doSend();
    });
  }
}

async function sendToAI(question, researchDirection) {
  var loadingId = addLoadingBubble();
  try {
    var res = await fetch('/api/papers/' + window.__currentPaperId + '/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question, research_direction: researchDirection })
    });
    var data = await res.json();
    removeLoadingBubble(loadingId);
    addChatBubble('answer', data.answer);
  } catch (e) {
    removeLoadingBubble(loadingId);
    addChatBubble('answer', '请求失败: ' + e.message);
  }
}

function addChatBubble(type, text) {
  var history = document.getElementById('chat-history');
  var hint = history.querySelector('.empty-hint');
  if (hint) hint.remove();

  var div = document.createElement('div');
  div.className = 'chat-bubble ' + type;
  var label = type === 'question' ? '你' : 'AI 助手';
  div.innerHTML = '<div class="role">' + label + '</div><div>' + formatAnswer(text) + '</div>';
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
}

function formatAnswer(text) {
  if (!text) return '';
  return text.split('\n').map(function(line) { return escapeHtml(line); }).join('<br>');
}

function addLoadingBubble() {
  var history = document.getElementById('chat-history');
  var hint = history.querySelector('.empty-hint');
  if (hint) hint.remove();

  var id = 'loading-' + Date.now();
  var div = document.createElement('div');
  div.id = id;
  div.className = 'chat-bubble answer';
  div.innerHTML = '<div class="role">AI 助手</div><div>思考中...</div>';
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return id;
}

function removeLoadingBubble(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}

async function loadConversations(paperId) {
  var history = document.getElementById('chat-history');
  var res = await fetch('/api/papers/' + paperId + '/conversations');
  var convs = await res.json();
  if (convs.length === 0) {
    history.innerHTML = '<p class="empty-hint">开始向 AI 提问吧</p>';
    return;
  }
  history.innerHTML = convs.map(function(c) {
    return '<div class="chat-bubble question"><div class="role">你</div><div>' + formatAnswer(c.question) + '</div></div>' +
           '<div class="chat-bubble answer"><div class="role">AI 助手</div><div>' + formatAnswer(c.answer) + '</div></div>';
  }).join('');
  history.scrollTop = history.scrollHeight;
}

// --- Helpers ---
function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function formatDate(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
