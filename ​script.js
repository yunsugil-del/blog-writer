// ⚠️ 본인의 실제 Worker 주소로 확인해 주세요
const WORKER_URL = "https://blog-writer.yunsugil.workers.dev";

function getKoreaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

let currentQuestions = [];
let selectedCategory = "경제·복지·지원금"; // 기본 선택값

// 카테고리 칩 클릭 이벤트 연결
document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    e.currentTarget.classList.add('active');
    selectedCategory = e.currentTarget.getAttribute('data-val');
  });
});

const btnRecommend = document.getElementById('btnRecommend');
const topicsContainer = document.getElementById('topicsContainer');
const keywordInput = document.getElementById('keywordInput');
const btnGenerateTitles = document.getElementById('btnGenerateTitles');
const titlesContainer = document.getElementById('titlesContainer');
const selectedTitleInput = document.getElementById('selectedTitleInput');
const btnGenerateArticle = document.getElementById('btnGenerateArticle');
const resultSection = document.getElementById('resultSection');
const articleOutput = document.getElementById('articleOutput');
const btnCopyArticle = document.getElementById('btnCopyArticle');

// 0단계: 선택된 칩 카테고리로 발굴
btnRecommend.addEventListener('click', async () => {
  btnRecommend.disabled = true;
  btnRecommend.textContent = "AI 실시간 검색 중...";

  try {
    const res = await fetch(`${WORKER_URL}/api/recommend-trending-topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: selectedCategory })
    });
    const data = await res.json();

    if (data.topics && data.topics.length > 0) {
      saveTopicsToStorage(data.topics);
      renderTopicPills(data.topics);
    }
  } catch (err) {
    alert("주제 발굴 오류: " + err.message);
  } finally {
    btnRecommend.disabled = false;
    btnRecommend.textContent = "🔍 실시간 주제 5개 발굴";
  }
});

function renderTopicPills(topics) {
  topicsContainer.style.display = 'flex';
  topicsContainer.innerHTML = topics.map((t, idx) => `
    <div class="topic-card-item" onclick="selectTopicByIndex(${idx})">
      <div class="topic-card-kw">📌 ${t.keyword}</div>
      <div class="topic-card-why">${t.whySelected}</div>
    </div>
  `).join('');
  window._lastTopics = topics;
}

window.selectTopicByIndex = function(idx) {
  const t = window._lastTopics[idx];
  if (t) {
    keywordInput.value = t.keyword;
    currentQuestions = t.questions || [];
    window.scrollTo({ top: keywordInput.offsetTop - 20, behavior: 'smooth' });
  }
};

// 1단계
btnGenerateTitles.addEventListener('click', async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) return alert("키워드를 입력하거나 선택하세요.");

  btnGenerateTitles.disabled = true;
  btnGenerateTitles.textContent = "제목 생성 중...";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-titles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: selectedCategory, keyword })
    });
    const data = await res.json();

    if (data.titles) {
      titlesContainer.style.display = 'flex';
      titlesContainer.innerHTML = data.titles.map(t => `
        <div class="title-card-item" onclick="selectTitle('${t.title.replace(/'/g, "\\'")}')">
          💡 ${t.title}
        </div>
      `).join('');
    }
  } catch (err) {
    alert("제목 생성 오류: " + err.message);
  } finally {
    btnGenerateTitles.disabled = false;
    btnGenerateTitles.textContent = "💡 롱테일 제목 5개 뽑기";
  }
});

window.selectTitle = function(title) {
  selectedTitleInput.value = title;
  window.scrollTo({ top: selectedTitleInput.offsetTop - 20, behavior: 'smooth' });
};

// 2단계
btnGenerateArticle.addEventListener('click', async () => {
  const keyword = keywordInput.value.trim();
  const title = selectedTitleInput.value.trim();

  if (!keyword || !title) return alert("키워드와 제목을 모두 지정해야 합니다.");

  btnGenerateArticle.disabled = true;
  btnGenerateArticle.textContent = "팩트체크 본문 작성 중 (약 10~15초)...";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: selectedCategory,
        keyword,
        title,
        questions: currentQuestions
      })
    });
    const data = await res.json();

    if (data) {
      resultSection.style.display = 'block';
      let fullText = `[제목] ${title}\n\n`;
      fullText += `[도입부]\n${data.intro}\n\n`;
      if (data.sections) {
        data.sections.forEach(s => {
          fullText += `■ ${s.step}. ${s.title}\n- 요약: ${s.cardHighlight}\n${s.body}\n\n`;
        });
      }
      fullText += `[마무리]\n${data.outro}\n\n출처: ${data.source}\n태그: ${(data.tags || []).join(' ')}`;
      articleOutput.textContent = fullText;
      resultSection.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    alert("본문 작성 오류: " + err.message);
  } finally {
    btnGenerateArticle.disabled = false;
    btnGenerateArticle.textContent = "⚡ 팩트체크 본문 & 카드뉴스 집필";
  }
});

btnCopyArticle.addEventListener('click', () => {
  navigator.clipboard.writeText(articleOutput.textContent).then(() => alert("본문이 복사되었습니다!"));
});

function saveTopicsToStorage(newTopics) {
  const STORAGE_KEY = 'blog_topic_archive';
  const todayStr = getKoreaDate();
  let archive = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  let todayGroup = archive.find(item => item.date === todayStr);
  if (!todayGroup) {
    todayGroup = { date: todayStr, topics: [] };
    archive.unshift(todayGroup);
  }

  newTopics.forEach((t, idx) => {
    const cleanKw = (t.keyword || '').trim();
    const isDup = todayGroup.topics.some(saved => saved.keyword.trim() === cleanKw);
    if (!isDup && cleanKw) {
      todayGroup.topics.push({
        id: `t_${Date.now()}_${idx}`,
        keyword: cleanKw,
        whySelected: t.whySelected || '',
        questions: t.questions || [],
        status: 'pending'
      });
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
}

window.addEventListener('DOMContentLoaded', () => {
  const selectedData = localStorage.getItem('selected_topic_for_write');
  if (selectedData) {
    const topic = JSON.parse(selectedData);
    keywordInput.value = topic.keyword;
    currentQuestions = topic.questions || [];
    localStorage.removeItem('selected_topic_for_write');
    window.scrollTo({ top: keywordInput.offsetTop - 20, behavior: 'smooth' });
  }
});
