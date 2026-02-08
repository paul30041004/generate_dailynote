// ===== 앱 상태 =====
let messages = [];
let photos = []; // {file, overlay} 객체 배열
let currentPhotoIndex = -1; // 오버레이 편집 중인 사진

// ===== DOM 요소 =====
const dateDisplay = document.getElementById('dateDisplay');
const messageList = document.getElementById('messageList');
const messageCount = document.getElementById('messageCount');
const photoCount = document.getElementById('photoCount');
const photoPreview = document.getElementById('photoPreview');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
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
    restoreLastAddress();
    setupTemplateBuilder(); // 템플릿 빌더 초기화
    createOverlayModal();
}

// ===== 날짜 표시 =====
function updateDate() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateDisplay.textContent = now.toLocaleDateString('ko-KR', options);
}

// ===== 동/호수 선택 동기화 =====
function syncBuildingSelects() {
    const selects = document.querySelectorAll('.building-select');
    const roomInputs = document.querySelectorAll('input[type="number"][id^="roomNumber"]');

    selects.forEach(select => {
        select.addEventListener('change', function () {
            selects.forEach(s => s.value = this.value);
        });
    });

    roomInputs.forEach(input => {
        input.addEventListener('input', function () {
            roomInputs.forEach(r => { if (r !== this) r.value = this.value; });
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
            addMessage(phrase, isCommon);
            saveLastAddress(); // 마지막 주소 저장
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => btn.style.transform = '', 150);
        });
    });

    if (cameraInput) cameraInput.addEventListener('change', handlePhotoInput);
    if (galleryInput) galleryInput.addEventListener('change', handlePhotoInput);

    clearBtn.addEventListener('click', clearAll);
    sendBtn.addEventListener('click', sendToKakao);

    // ⚡ 퀵 액션 버튼
    setupQuickActions();
}

// ===== ⚡ 퀵 액션 (원 탭) =====
function setupQuickActions() {
    const quickBtns = document.querySelectorAll('.quick-btn[data-phrase]');
    const quickCamera = document.getElementById('quickCamera');

    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            addMessage(btn.dataset.phrase, true); // 공통 메시지로 추가
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => btn.style.transform = '', 150);
            if (navigator.vibrate) navigator.vibrate(30);
        });
    });

    if (quickCamera) {
        quickCamera.addEventListener('click', () => {
            cameraInput?.click();
        });
    }
}

// ===== 마지막 주소 저장/복원 =====
function saveLastAddress() {
    const addr = getCurrentAddress();
    localStorage.setItem('lastBuilding', addr.building);
    if (addr.room) localStorage.setItem('lastRoom', addr.room);
}

function restoreLastAddress() {
    const lastBuilding = localStorage.getItem('lastBuilding');
    const lastRoom = localStorage.getItem('lastRoom');

    if (lastBuilding) {
        document.querySelectorAll('.building-select').forEach(s => s.value = lastBuilding);
    }
    if (lastRoom) {
        document.querySelectorAll('input[type="number"][id^="roomNumber"]').forEach(i => i.value = lastRoom);
    }
}

// ===== 📝 템플릿 빌더 =====
let selectedTerm = null;

function setupTemplateBuilder() {
    const termBtns = document.querySelectorAll('.term-btn');
    const statusBtns = document.querySelectorAll('.status-btn');
    const preview = document.getElementById('templatePreview');

    termBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 선택 표시
            termBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedTerm = btn.dataset.term;

            // 미리보기 업데이트
            updateTemplatePreview();
            if (navigator.vibrate) navigator.vibrate(20);
        });
    });

    statusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!selectedTerm) {
                preview.innerHTML = '<span class="preview-placeholder">먼저 용어를 선택하세요</span>';
                return;
            }

            // 문구 생성 (동/호수는 addMessage에서 자동 추가됨)
            const status = btn.dataset.status;
            const message = `입주민 요청 ${selectedTerm} ${status}`;

            addMessage(message, false); // isCommon=false → 동/호수 자동 추가
            saveLastAddress();

            // 시각 피드백
            btn.classList.add('selected');
            setTimeout(() => btn.classList.remove('selected'), 300);

            // 초기화
            termBtns.forEach(b => b.classList.remove('selected'));
            selectedTerm = null;
            preview.innerHTML = '<span class="preview-placeholder">✅ 문구가 추가되었습니다!</span>';
            setTimeout(() => {
                preview.innerHTML = '<span class="preview-placeholder">용어 → 상태 순서로 선택하세요</span>';
            }, 1500);

            if (navigator.vibrate) navigator.vibrate(50);
        });
    });
}

function updateTemplatePreview() {
    const preview = document.getElementById('templatePreview');
    if (!selectedTerm) {
        preview.innerHTML = '<span class="preview-placeholder">용어 → 상태 순서로 선택하세요</span>';
        return;
    }

    const addr = getCurrentAddress();
    const room = addr.room ? `${addr.building}동 ${addr.room}호` : `${addr.building}동`;
    preview.innerHTML = `<strong>${room}</strong> 입주민 요청 <strong>${selectedTerm}</strong> [상태 선택]`;
}

// ===== 사진 위치 가져오기 =====
function getPhotoLocation() {
    const photoLocationSelect = document.getElementById('photoLocation');
    const selectedValue = photoLocationSelect ? photoLocationSelect.value : 'unit';

    if (selectedValue === 'unit') {
        // 세대 선택 시 동/호수 조합
        const addr = getCurrentAddress();
        if (addr.room) {
            return `${addr.building}동 ${addr.room}호`;
        } else {
            return `${addr.building}동`;
        }
    } else {
        // 공용시설 선택 시 그대로 반환
        return selectedValue;
    }
}

// ===== 사진 처리 =====
function handlePhotoInput(e) {
    const files = Array.from(e.target.files);
    const location = getPhotoLocation();
    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            photos.push({
                file: file,
                overlay: {
                    location: location,
                    action: '시설점검',
                    time: timeStr,
                    enabled: true
                }
            });
        }
    });
    e.target.value = '';
    updatePhotoUI();
    if (navigator.vibrate) navigator.vibrate(30);
}

function removePhoto(index) {
    photos.splice(index, 1);
    updatePhotoUI();
}

function updatePhotoUI() {
    photoCount.textContent = `${photos.length}장`;
    if (photos.length === 0) {
        photoPreview.innerHTML = '';
    } else {
        photoPreview.innerHTML = photos.map((p, i) => {
            const url = URL.createObjectURL(p.file);
            return `
                <div class="photo-item">
                    <img src="${url}" alt="사진 ${i + 1}" onclick="editOverlay(${i})">
                    <div class="overlay-badge" onclick="editOverlay(${i})">✎</div>
                    <button class="remove-photo" onclick="removePhoto(${i})">✕</button>
                </div>
            `;
        }).join('');
    }
    updateSendButton();
}

// ===== 오버레이 모달 생성 =====
function createOverlayModal() {
    const modal = document.createElement('div');
    modal.id = 'overlayModal';
    modal.className = 'overlay-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📝 사진 정보 편집</h3>
                <button class="modal-close" onclick="closeOverlayModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-preview">
                    <canvas id="previewCanvas"></canvas>
                </div>
                <div class="modal-fields">
                    <div class="field-group">
                        <label>📍 위치</label>
                        <input type="text" id="overlayLocation" placeholder="201동 101호">
                    </div>
                    <div class="field-group">
                        <label>🔧 조치내용</label>
                        <input type="text" id="overlayAction" placeholder="전등 교체">
                    </div>
                    <div class="field-group">
                        <label>🕐 일시</label>
                        <input type="text" id="overlayTime" placeholder="2/8 14:30">
                    </div>
                    <div class="field-group checkbox">
                        <label><input type="checkbox" id="overlayEnabled" checked> 오버레이 표시</label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn cancel" onclick="closeOverlayModal()">취소</button>
                <button class="modal-btn save" onclick="saveOverlay()">저장</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 입력 변경 시 실시간 미리보기
    ['overlayLocation', 'overlayAction', 'overlayTime', 'overlayEnabled'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreviewCanvas);
        document.getElementById(id).addEventListener('change', updatePreviewCanvas);
    });
}

function editOverlay(index) {
    currentPhotoIndex = index;
    const p = photos[index];

    document.getElementById('overlayLocation').value = p.overlay.location;
    document.getElementById('overlayAction').value = p.overlay.action;
    document.getElementById('overlayTime').value = p.overlay.time;
    document.getElementById('overlayEnabled').checked = p.overlay.enabled;

    document.getElementById('overlayModal').classList.add('show');
    updatePreviewCanvas();
}

function closeOverlayModal() {
    document.getElementById('overlayModal').classList.remove('show');
    currentPhotoIndex = -1;
}

function saveOverlay() {
    if (currentPhotoIndex < 0) return;

    photos[currentPhotoIndex].overlay = {
        location: document.getElementById('overlayLocation').value,
        action: document.getElementById('overlayAction').value,
        time: document.getElementById('overlayTime').value,
        enabled: document.getElementById('overlayEnabled').checked
    };

    closeOverlayModal();
    updatePhotoUI();
}

function updatePreviewCanvas() {
    if (currentPhotoIndex < 0) return;

    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
        const maxW = 300, maxH = 300;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        if (h > maxH) { w = w * maxH / h; h = maxH; }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        if (document.getElementById('overlayEnabled').checked) {
            drawOverlayOnCanvas(ctx, w, h, {
                location: document.getElementById('overlayLocation').value,
                action: document.getElementById('overlayAction').value,
                time: document.getElementById('overlayTime').value
            });
        }
    };

    img.src = URL.createObjectURL(photos[currentPhotoIndex].file);
}

// ===== 오버레이 그리기 (작은 텍스트박스) =====
function drawOverlayOnCanvas(ctx, w, h, overlay) {
    const fontSize = Math.max(10, Math.floor(w / 30)); // 더 작은 폰트
    const padding = fontSize * 0.4;
    const lineHeight = fontSize * 1.3;
    const boxRadius = 4;

    ctx.font = `${fontSize}px "Noto Sans KR", sans-serif`;
    ctx.textBaseline = 'middle';

    // 좌측 하단: 위치 정보 (작은 박스)
    if (overlay.location) {
        const locText = `📍 ${overlay.location}`;
        const locWidth = ctx.measureText(locText).width + padding * 2;
        const locHeight = lineHeight + padding;
        const locX = padding;
        const locY = h - locHeight - padding;

        // 반투명 배경
        ctx.fillStyle = 'rgba(0, 102, 204, 0.8)';
        roundRect(ctx, locX, locY, locWidth, locHeight, boxRadius);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.fillText(locText, locX + padding, locY + locHeight / 2);
    }

    // 우측 하단: 조치명 + 일시 (작은 박스)
    const infoLines = [];
    if (overlay.action) infoLines.push(`🔧 ${overlay.action}`);
    if (overlay.time) infoLines.push(`🕐 ${overlay.time}`);

    if (infoLines.length > 0) {
        const maxWidth = Math.max(...infoLines.map(t => ctx.measureText(t).width));
        const boxWidth = maxWidth + padding * 2;
        const boxHeight = lineHeight * infoLines.length + padding;
        const boxX = w - boxWidth - padding;
        const boxY = h - boxHeight - padding;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        roundRect(ctx, boxX, boxY, boxWidth, boxHeight, boxRadius);
        ctx.fill();

        ctx.fillStyle = '#fff';
        infoLines.forEach((line, i) => {
            ctx.fillText(line, boxX + padding, boxY + padding / 2 + lineHeight * (i + 0.5));
        });
    }
}

// 둥근 사각형 그리기 헬퍼
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ===== 오버레이된 이미지 생성 =====
async function createOverlayedImage(photoObj) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);

            if (photoObj.overlay.enabled) {
                drawOverlayOnCanvas(ctx, img.width, img.height, photoObj.overlay);
            }

            canvas.toBlob(blob => {
                const filename = `LH_${photoObj.overlay.location.replace(/\s/g, '_')}_${Date.now()}.jpg`;
                resolve(new File([blob], filename, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        };
        img.src = URL.createObjectURL(photoObj.file);
    });
}

// ===== 탭 전환 =====
function switchTab(tabId) {
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    tabContents.forEach(content => content.classList.toggle('active', content.id === `tab-${tabId}`));
    if (navigator.vibrate) navigator.vibrate(20);
}

// ===== 현재 동/호수 =====
function getCurrentAddress() {
    const activeTab = document.querySelector('.tab-content.active');
    const buildingSelect = activeTab?.querySelector('.building-select') || document.getElementById('buildingNumber');
    const roomInput = activeTab?.querySelector('input[type="number"]') || document.getElementById('roomNumber');
    return {
        building: buildingSelect ? buildingSelect.value : '201',
        room: roomInput ? roomInput.value.trim() : ''
    };
}

// ===== 메시지 추가 =====
function addMessage(phrase, isCommon = false) {
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
}

function deleteMessage(index) {
    messages.splice(index, 1);
    updateUI();
    saveMessages();
}

function clearAll() {
    if (messages.length === 0 && photos.length === 0) return;
    if (confirm('모든 내용과 사진을 삭제하시겠습니까?')) {
        messages = [];
        photos = [];
        updateUI();
        updatePhotoUI();
        saveMessages();
    }
}

// ===== UI 업데이트 =====
function updateUI() {
    messageCount.textContent = `${messages.length}건`;
    if (messages.length === 0) {
        messageList.innerHTML = '<p class="placeholder-text">버튼을 눌러 인계사항을 추가하세요</p>';
    } else {
        messageList.innerHTML = messages.map((msg, i) => `
            <div class="message-item">
                <span class="text">• ${msg}</span>
                <button class="delete-btn" onclick="deleteMessage(${i})">✕</button>
            </div>
        `).join('');
    }
    updateSendButton();
}

function updateSendButton() {
    sendBtn.disabled = messages.length === 0 && photos.length === 0;
}

// ===== 로컬 저장 =====
function saveMessages() { localStorage.setItem('lhDutyMessages', JSON.stringify(messages)); }
function loadSavedMessages() {
    const saved = localStorage.getItem('lhDutyMessages');
    if (saved) { try { messages = JSON.parse(saved); updateUI(); } catch (e) { } }
}

// ===== 카카오톡 전송 =====
async function sendToKakao() {
    if (messages.length === 0 && photos.length === 0) return;

    sendBtn.textContent = '⏳ 처리중...';
    sendBtn.disabled = true;

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
    if (photos.length) body += `\n\n📷 첨부사진: ${photos.length}장`;

    const fullMessage = `🏢 음성금석LH2단지 인계 (${dateStr} ${timeStr})\n\n${body.trim()}\n\n- 당직자 올림`;

    // 오버레이된 사진 생성
    let processedPhotos = [];
    if (photos.length > 0) {
        for (const p of photos) {
            const processed = await createOverlayedImage(p);
            processedPhotos.push(processed);
        }
    }

    // Web Share API
    if (navigator.share && navigator.canShare) {
        const shareData = { title: 'LH 당직 인계장', text: fullMessage };

        if (processedPhotos.length > 0) {
            shareData.files = processedPhotos;
        }

        if (navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                sendBtn.textContent = '📲 카톡 전송';
                sendBtn.disabled = false;
                if (confirm('전송 완료! 초기화할까요?')) {
                    messages = []; photos = [];
                    updateUI(); updatePhotoUI(); saveMessages();
                }
                return;
            } catch (e) { console.log('공유 취소'); }
        }
    }

    // 폴백
    sendBtn.textContent = '📲 카톡 전송';
    sendBtn.disabled = false;

    navigator.clipboard.writeText(fullMessage).then(() => {
        let msg = '📋 텍스트가 복사되었습니다!';
        if (photos.length > 0) {
            msg += `\n\n📷 사진 ${photos.length}장은 별도로 전송해주세요.\n(사진에 위치/조치명 오버레이 적용됨)`;
        }
        alert(msg);
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

// ===== 스타일 추가 =====
const style = document.createElement('style');
style.textContent = `
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}

.overlay-badge{position:absolute;bottom:4px;left:4px;background:rgba(0,102,204,.9);color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer}

.overlay-modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);z-index:1000;align-items:center;justify-content:center;padding:20px}
.overlay-modal.show{display:flex}
.modal-content{background:#16213e;border-radius:16px;width:100%;max-width:400px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid rgba(255,255,255,.1)}
.modal-header h3{color:#fff;font-size:1rem;margin:0}
.modal-close{background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer}
.modal-body{padding:16px;overflow-y:auto}
.modal-preview{background:#0f0f23;border-radius:8px;padding:10px;margin-bottom:16px;display:flex;justify-content:center}
.modal-preview canvas{max-width:100%;border-radius:4px}
.modal-fields{display:flex;flex-direction:column;gap:12px}
.field-group{display:flex;flex-direction:column;gap:4px}
.field-group label{color:rgba(255,255,255,.7);font-size:.8rem}
.field-group input[type="text"]{background:#0f3460;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:10px 12px;color:#fff;font-size:.9rem}
.field-group input[type="text"]:focus{border-color:#0066cc;outline:none}
.field-group.checkbox{flex-direction:row;align-items:center}
.field-group.checkbox label{display:flex;align-items:center;gap:8px;color:#fff}
.field-group.checkbox input{width:18px;height:18px}
.modal-footer{display:flex;gap:10px;padding:16px;border-top:1px solid rgba(255,255,255,.1)}
.modal-btn{flex:1;padding:12px;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer}
.modal-btn.cancel{background:#424242;color:#fff}
.modal-btn.save{background:#0066cc;color:#fff}
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);
