// ===== 앱 상태 =====
let messages = [];

// ===== DOM 요소 =====
const dateDisplay = document.getElementById('dateDisplay');
const messageList = document.getElementById('messageList');
const messageCount = document.getElementById('messageCount');
const clearBtn = document.getElementById('clearBtn');
const sendBtn = document.getElementById('sendBtn');
const phraseButtons = document.querySelectorAll('.phrase-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// ===== 초기화 =====
function init() {
    updateDate();
    setupEventListeners();
    updateUI();
    loadSavedMessages();
    syncBuildingSelects();
}

// ===== 날짜 표시 =====
function updateDate() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateDisplay.textContent = now.toLocaleDateString('ko-KR', options);
}

// ===== 동 선택 동기화 =====
function syncBuildingSelects() {
    const selects = document.querySelectorAll('.building-select');
    selects.forEach(select => {
        select.addEventListener('change', function () {
            selects.forEach(s => s.value = this.value);
        });
    });
}

// ===== 이벤트 리스너 =====
function setupEventListeners() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    phraseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const phrase = btn.dataset.phrase;
            const isCommon = btn.dataset.common === 'true';
            const isMove = btn.dataset.move === 'true';
            addMessage(phrase, isCommon, isMove);
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => btn.style.transform = '', 150);
        });
    });

    clearBtn.addEventListener('click', clearAll);
    sendBtn.addEventListener('click', sendToKakao);
}

// ===== 탭 전환 =====
function switchTab(tabId) {
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    tabContents.forEach(content => content.classList.toggle('active', content.id === `tab-${tabId}`));
    if (navigator.vibrate) navigator.vibrate(20);
}

// ===== 현재 동/호수 가져오기 =====
function getCurrentAddress() {
    const activeTab = document.querySelector('.tab-content.active');
    const buildingSelect = activeTab.querySelector('.building-select') || document.getElementById('buildingNumber');
    const roomInput = activeTab.querySelector('input[type="number"]') || document.getElementById('roomNumber');
    return {
        building: buildingSelect ? buildingSelect.value : '201',
        room: roomInput ? roomInput.value.trim() : ''
    };
}

// ===== 메시지 추가 =====
function addMessage(phrase, isCommon = false, isMove = false) {
    const addr = getCurrentAddress();
    let message;

    if (isCommon) {
        message = phrase;
    } else if (addr.room) {
        message = `${addr.building}동 ${addr.room}호 ${phrase}`;
    } else {
        const roomInput = document.querySelector('.tab-content.active input[type="number"]');
        if (roomInput) {
            roomInput.focus();
            roomInput.style.animation = 'shake 0.3s ease';
            setTimeout(() => roomInput.style.animation = '', 300);
        }
        alert('호수를 입력해주세요!');
        return;
    }

    if (messages.includes(message)) {
        alert('이미 추가된 항목입니다.');
        return;
    }

    messages.push(message);
    updateUI();
    saveMessages();
    if (navigator.vibrate) navigator.vibrate(30);

    const preview = document.querySelector('.preview-section');
    if (preview) preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===== 메시지 삭제 =====
function deleteMessage(index) {
    messages.splice(index, 1);
    updateUI();
    saveMessages();
}

// ===== 전체 삭제 =====
function clearAll() {
    if (messages.length === 0) return;
    if (confirm('모든 내용을 삭제하시겠습니까?')) {
        messages = [];
        updateUI();
        saveMessages();
    }
}

// ===== UI 업데이트 =====
function updateUI() {
    messageCount.textContent = `${messages.length}건`;
    if (messages.length === 0) {
        messageList.innerHTML = '<p class="placeholder-text">버튼을 눌러 인계사항을 추가하세요</p>';
        sendBtn.disabled = true;
    } else {
        messageList.innerHTML = messages.map((msg, i) => `
            <div class="message-item">
                <span class="text">• ${msg}</span>
                <button class="delete-btn" onclick="deleteMessage(${i})">✕</button>
            </div>
        `).join('');
        sendBtn.disabled = false;
    }
}

// ===== 로컬 저장 =====
function saveMessages() { localStorage.setItem('lhDutyMessages', JSON.stringify(messages)); }
function loadSavedMessages() {
    const saved = localStorage.getItem('lhDutyMessages');
    if (saved) { try { messages = JSON.parse(saved); updateUI(); } catch (e) { } }
}

// ===== 카카오톡 전송 =====
function sendToKakao() {
    if (messages.length === 0) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

    const alerts = messages.filter(m => m.includes('🚨') || m.includes('⚠️'));
    const moveOut = messages.filter(m => m.includes('퇴거') || m.includes('원상복구') || m.includes('훼손') || m.includes('미반납'));
    const moveIn = messages.filter(m => m.includes('입주') || m.includes('열쇠 인계') || m.includes('개통'));
    const normal = messages.filter(m => !alerts.includes(m) && !moveOut.includes(m) && !moveIn.includes(m));

    let body = '';
    if (alerts.length) body += '🚨 긴급사항\n' + alerts.map(m => `• ${m}`).join('\n') + '\n\n';
    if (moveOut.length) body += '📦 퇴거점검\n' + moveOut.map(m => `• ${m}`).join('\n') + '\n\n';
    if (moveIn.length) body += '🏠 입주점검\n' + moveIn.map(m => `• ${m}`).join('\n') + '\n\n';
    if (normal.length) body += '📋 점검/인계\n' + normal.map(m => `• ${m}`).join('\n');

    const fullMessage = `🏢 LH 당직 인계 (${dateStr} ${timeStr})\n\n${body.trim()}\n\n- 당직자 올림`;

    if (navigator.share) {
        navigator.share({ title: 'LH 당직 인계장', text: fullMessage }).then(() => {
            if (confirm('전송 완료. 초기화할까요?')) { messages = []; updateUI(); saveMessages(); }
        }).catch(() => { });
    } else {
        navigator.clipboard.writeText(fullMessage).then(() => {
            alert('📋 복사 완료! 카카오톡에 붙여넣기 하세요.');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = fullMessage;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert('📋 복사 완료!');
        });
    }
}

// Shake 애니메이션
const style = document.createElement('style');
style.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}';
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);
