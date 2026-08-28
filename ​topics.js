const STORAGE_KEY = 'blog_topic_archive';
let currentFilter = 'all';

function getKoreaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function loadTopics() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveArchive(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function updateTopicStatus(date, topicId, newStatus) {
  const archive = loadTopics();
  const group = archive.find(g => g.date === date);
  if (group) {
    const topic = group.topics.find(t => t.id === topicId);
    if (topic) topic.status = newStatus;
    saveArchive(archive);
    renderArchive();
  }
}

function startWrite(date, topicId) {
  const archive = loadTopics();
  const group = archive.find(g => g.date === date);
  const topic = group?.topics.find(t => t.id === topicId);
  if (!topic) return;

  topic.status = 'in_progress';
  saveArchive(archive);

  localStorage.setItem('selected_topic_for_write', JSON.stringify(topic));
  window.location.href = 'index.html';
}

function setFilter(filter, btnEl) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  renderArchive();
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleDetail(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getStatusBadge(status) {
  const map = {
    pending: '🟡 미작성',
    in_progress: '🔵 작성중',
    completed: '🟢 작성완료',
    discarded: '⚫ 폐기'
  };
  return map[status] || '🟡 미작성';
}

function renderArchive() {
  const archive = loadTopics();
  const container = document.getElementById('archiveList');
  const todayStr = getKoreaDate();
  
  if (archive.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#8B95A1; padding:40px 0; font-size:14px;">보관된 주제가 없습니다.</p>';
    return;
  }

  container.innerHTML = archive.map((group, gIdx) => {
    const filteredTopics = group.topics.filter(t => currentFilter === 'all' || t.status === currentFilter);
    if (filteredTopics.length === 0 && currentFilter !== 'all') return '';

    const isToday = group.date === todayStr;
    const bodyDisplay = isToday ? 'block' : 'none';
    const arrow = isToday ? '▼' : '▶';

    return `
      <div class="date-card">
        <div class="date-header" onclick="toggleAccordion('group_${gIdx}')">
          <span>📅 ${group.date} (${filteredTopics.length}개)</span>
          <span style="font-size:12px; color:#8B95A1;">${arrow}</span>
        </div>
        <div id="group_${gIdx}" style="display: ${bodyDisplay};">
          <ul class="topic-list">
            ${filteredTopics.map(t => `
              <li class="topic-item">
                <div class="topic-main">
                  <span class="topic-title">${getStatusBadge(t.status)} ${t.keyword}</span>
                  <button class="btn-sm" onclick="toggleDetail('detail_${t.id}')">상세</button>
                </div>
                
                <div id="detail_${t.id}" class="topic-detail">
                  <p style="margin-bottom:6px;"><strong>선정 이유:</strong> ${t.whySelected}</p>
                  <p style="margin-bottom:4px;"><strong>핵심 질문:</strong></p>
                  <ul style="margin:0 0 8px 16px; padding:0;">
                    ${(t.questions || []).map(q => `<li>${q}</li>`).join('')}
                  </ul>
                  
                  <div class="topic-actions">
                    <button class="btn-sm btn-write" onclick="startWrite('${group.date}', '${t.id}')">이 주제로 작성</button>
                    <button class="btn-sm" onclick="updateTopicStatus('${group.date}', '${t.id}', 'completed')">완료</button>
                    <button class="btn-sm" onclick="updateTopicStatus('${group.date}', '${t.id}', 'discarded')">폐기</button>
                  </div>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', renderArchive);
