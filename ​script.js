// ⚠️ 사용 중이신 실제 Cloudflare Worker 배포 주소로 변경하세요!
const WORKER_URL = "https://blog-writer.yunsugil.workers.dev";

// 한국 시간(KST) YYYY-MM-DD 포맷 함수
function getKoreaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

// 전역 상태 (2단계로 질문 3개를 전달하기 위한 변수)
let currentQuestions = [];

// DOM 요소 캐싱
const categorySelect = document.getElementById('categorySelect');
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

// 0단계: 실시간 주제 5개 발굴 API 호출 및 자동 보관
btnRecommend.addEventListener('click', async () => {
  const category = categorySelect.value;
  btnRecommend.disabled = true;
  btnRecommend.textContent = "AI 검색 중...";

  try {
    const res = await fetch(`${WORKER_URL}/api/recommend-trending-topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
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
    btnRecommend.textContent = "실시간 주제 5개 발굴";
  }
});

function renderTopicPills(topics) {
  topicsContainer.style.display = 'block';
  topicsContainer.innerHTML = topics.map((t, idx) => `
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px; cursor: pointer;" onclick="selectTopicByIndex(${idx})">
      <strong style="color: #2563eb;">📌 ${t.keyword}</strong>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">${t.whySelected}</p>
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

// 1단계: 롱테일 제목 5개 생성
btnGenerateTitles.addEventListener('click', async () => {
  const keyword = keywordInput.value.trim();
  const category = categorySelect.value;
  if (!keyword) return alert("키워드를 입력하거나 선택하세요.");

  btnGenerateTitles.disabled = true;
  btnGenerateTitles.textContent = "제목 생성 중...";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-titles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, keyword })
    });
    const data = await res.json();

    if (data.titles) {
      titlesContainer.style.display = 'block';
      titlesContainer.innerHTML = data.titles.map((t, idx) => `
        <div style="padding: 8px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 6px; cursor: pointer; font-size: 13px;" onclick="selectTitle('${t.title.replace(/'/g, "\\'")}')">
          💡 ${t.title}
        </div>
      `).join('');
    }
  } catch (err) {
    alert("제목 생성 오류: " + err.message);
  } finally {
    btnGenerateTitles.disabled = false;
    btnGenerateTitles.textContent = "롱테일 제목 5개 뽑기";
  }
});

window.selectTitle = function(title) {
  selectedTitleInput.value = title;
  window.scrollTo({ top: selectedTitleInput.offsetTop - 20, behavior: 'smooth' });
};

// 2단계: 본문 집필 (questions 3개 전달)
btnGenerateArticle.addEventListener('click', async () => {
  const keyword = keywordInput.value.trim();
  const category = categorySelect.value;
  const title = selectedTitleInput.value.trim();

  if (!keyword || !title) return alert("키워드와 제목을 모두 지정해야 합니다.");

  btnGenerateArticle.disabled = true;
  btnGenerateArticle.textContent = "팩트체크 본문 작성 중 (약 10~15초)...";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
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
    btnGenerateArticle.textContent = "팩트체크 본문 & 카드뉴스 집필";
  }
});

btnCopyArticle.addEventListener('click', () => {
  navigator.clipboard.writeText(articleOutput.textContent).then(() => alert("본문이 복사되었습니다!"));
});

// 한국시간 기준 로컬스토리지 저장 함수
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

// 보관함(topics.html)에서 '이 주제로 작성'을 누르고 이동했을 때 자동 주입
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
