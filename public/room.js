// Socket.IO 연결
const socket = io();

// DOM 요소들
const backToRoomsBtn = document.getElementById('backToRoomsBtn');
const startVoteBtn = document.getElementById('startVoteBtn');
const userCount = document.getElementById('userCount');
const voteTitle = document.getElementById('voteTitle');
const timerText = document.getElementById('timerText');
const timerCircle = document.getElementById('timerCircle');
const choiceA = document.getElementById('choiceA');
const choiceB = document.getElementById('choiceB');
const cursorsContainer = document.getElementById('cursors');
const votingArea = document.getElementById('votingArea');
const yourId = document.getElementById('yourId');

// 모달 관련 DOM 요소들
const editVoteBtn = document.getElementById('editVoteBtn');
const editVoteModal = document.getElementById('editVoteModal');
const editVoteForm = document.getElementById('editVoteForm');
const editVoteTitle = document.getElementById('editVoteTitle');
const editChoiceA = document.getElementById('editChoiceA');
const editChoiceB = document.getElementById('editChoiceB');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const resultModal = document.getElementById('resultModal');

// 편집 모달 상태 변수
let editSelectedTime = 10;

// 상태 변수들
let myId = null;
let currentRoomId = null;
let users = new Map();
let votes = new Map();
let isVoting = false;
let currentTimer = null;
let voteResults = { A: 0, B: 0 };
let currentVote = null;
let voteCreatorId = null;
let isRoomCreator = false;
let myPosition = { x: 25, y: 50 }; // 내 마우스 위치 추적 (기본값: 왼쪽 영역)
let currentHoverChoice = null; // 현재 호버 중인 선택지 ('A', 'B', 또는 null)

// URL에서 방 ID와 생성자 정보 가져오기
const urlParams = new URLSearchParams(window.location.search);
currentRoomId = urlParams.get('id');
const isCreatorFromUrl = urlParams.get('creator') === 'true';

// 로컬 스토리지에서 투표 생성자 정보 확인
const isCreatorFromStorage = localStorage.getItem('isVoteCreator') === 'true';
const createdRoomId = localStorage.getItem('createdRoomId');
const isCreatorOfThisRoom = isCreatorFromStorage && createdRoomId === currentRoomId;

// 투표 생성자 여부 판단
const isOriginalCreator = isCreatorFromUrl || isCreatorOfThisRoom;

if (!currentRoomId) {
    alert('방 ID가 없습니다. 방 목록으로 돌아갑니다.');
    window.location.href = '/';
}

// 마우스 위치 추적을 위한 스로틀 함수
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 마우스 위치 전송 (스로틀 적용)
let sendMousePosition = throttle((x, y) => {
    socket.emit('mouse-move', { x, y, roomId: currentRoomId });
}, 16); // 약 60fps로 업데이트

// 마우스 움직임 이벤트 리스너
votingArea.addEventListener('mousemove', (e) => {
    const rect = votingArea.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // 내 마우스 위치 업데이트
    myPosition.x = x;
    myPosition.y = y;
    
    // 디버깅 로그 (투표 중일 때만)
    if (isVoting) {
        const choice = getCurrentChoice(x, y);
    }
    
    sendMousePosition(x, y);
});

// 마우스 진입 이벤트
votingArea.addEventListener('mouseenter', (e) => {
    const rect = votingArea.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // 내 마우스 위치 업데이트
    myPosition.x = x;
    myPosition.y = y;
    
    sendMousePosition(x, y);
});

// 마우스 이탈 이벤트
votingArea.addEventListener('mouseleave', () => {
    // 마우스가 투표 영역을 벗어났을 때는 위치를 업데이트하지 않음
    sendMousePosition(-10, -10);
});

// 선택지 A 호버 이벤트
choiceA.addEventListener('mouseenter', () => {
    currentHoverChoice = 'A';
    updateHoverChoice('A');
});

choiceA.addEventListener('mouseleave', () => {
    currentHoverChoice = null;
    updateHoverChoice(null);
});

// 선택지 B 호버 이벤트
choiceB.addEventListener('mouseenter', () => {
    currentHoverChoice = 'B';
    updateHoverChoice('B');
});

choiceB.addEventListener('mouseleave', () => {
    currentHoverChoice = null;
    updateHoverChoice(null);
});

// 현재 마우스 위치 기반 선택지 판별 (레거시 호환성을 위해 유지)
function getCurrentChoice(x, y) {
    return x < 50 ? 'A' : 'B';
}

// 호버 상태 업데이트 함수
function updateHoverChoice(choice) {
    // 서버에 호버 상태 전송
    socket.emit('hover-choice-update', {
        roomId: currentRoomId,
        choice: choice
    });
    
    // 투표 중일 때만 시각적 피드백 제공
    if (isVoting) {
        choiceA.classList.remove('active');
        choiceB.classList.remove('active');
        
        if (choice === 'A') {
            choiceA.classList.add('active');
        } else if (choice === 'B') {
            choiceB.classList.add('active');
        }
        
        // 실시간 투표 수 업데이트
        updateLiveVoteCount();
    }
}

// Socket.IO 연결 이벤트
socket.on('connect', () => {
    myId = socket.id;
    
    // 방 입장 요청 (투표 생성자 정보 포함)
    socket.emit('join-room', {
        roomId: currentRoomId,
        isOriginalCreator: isOriginalCreator
    });
});

socket.on('disconnect', () => {
    // 연결 상태 업데이트나 다른 처리 필요시 여기에 추가
});

// 방 입장 성공
socket.on('room-joined', (roomData) => {
    if (timerCircle) timerCircle.style.display = 'none';
    
    // 방 제목은 voteTitle에 업데이트됨 (updateVoteInfo에서 처리)
    
    updateVoteInfo(roomData.vote);
    updateRoomUsers(roomData.users);
    
    // 방 생성자 확인
    isRoomCreator = roomData.creatorId === myId;
    
    updateButtons();
    
    // 진행 중인 투표가 있다면 동기화
    if (roomData.voteInProgress) {
        isVoting = true;
        updateVotingState(roomData);
    }
    
    // 기존 투표 결과가 있다면 표시 (모달은 표시하지 않음)
    if (roomData.voteResults) {
        showVoteResults(roomData.voteResults, false);
    }
    
    // 방 생성자에게 알림
    if (isRoomCreator) {
        // 로컬 스토리지 정리 (한 번만 사용)
        localStorage.removeItem('isVoteCreator');
        localStorage.removeItem('createdRoomId');
    }
    
    // URL에서 creator 파라미터 제거 (깔끔한 URL을 위해)
    if (isCreatorFromUrl) {
        const cleanUrl = new URL(window.location);
        cleanUrl.searchParams.delete('creator');
        window.history.replaceState({}, document.title, cleanUrl.toString());
    }
});

// 방 입장 실패
socket.on('room-join-failed', (error) => {
    console.error('방 입장 실패:', error);
    alert(`방 입장에 실패했습니다: ${error}`);
    window.location.href = '/';
});

// 방 사용자 업데이트
socket.on('room-users-updated', (users) => {
    updateRoomUsers(users);
});

// 방 정보 업데이트
socket.on('room-info-updated', (roomData) => {
    updateVoteInfo(roomData.vote);
    updateButtons();
});

// 사용자 위치 업데이트
socket.on('mouse-moved', (data) => {
    const { userId, x, y, color } = data;
    
    // 사용자 정보 업데이트
    let user = users.get(userId);
    if (!user) {
        user = { id: userId, x, y, color };
        users.set(userId, user);
    } else {
        user.x = x;
        user.y = y;
        user.color = color;
    }
    
    updateCursor(user);
    updateLiveVoteCount();
});

// 사용자 호버 상태 업데이트
socket.on('hover-choice-changed', (data) => {
    const { userId, choice, color } = data;
    const user = users.get(userId);
    
    if (user) {
        user.hoverChoice = choice;
        
        // 투표 중이면 실시간 투표 수 업데이트
        if (isVoting) {
            updateLiveVoteCount();
        }
    }
});

// 사용자 입장
socket.on('user-joined', (user) => {
    users.set(user.id, user);
    updateCursor(user);
    updateStats();
    updateLiveVoteCount();
});

// 사용자 이탈
socket.on('user-left', (userId) => {
    users.delete(userId);
    removeCursor(userId);
    updateStats();
    updateLiveVoteCount();
});

// 투표 시작
socket.on('vote-started', () => {
    if (timerCircle) timerCircle.style.display = 'block';
    if (startVoteBtn) startVoteBtn.style.display = 'none';
    if (editVoteBtn) editVoteBtn.style.display = 'none';
    
    if (!isVoting) {
        startVoting();
    }
});

// 투표 결과
socket.on('vote-results', (results) => {
    if (timerCircle) timerCircle.style.display = 'none';
    if (startVoteBtn) startVoteBtn.style.display = 'block';
    if (editVoteBtn) editVoteBtn.style.display = 'block';
    showVoteResults(results);
    updateStats();
});

// 투표 리셋
socket.on('vote-reset', () => {
    resetVoting();
});

// 방 삭제됨
socket.on('room-deleted', () => {
    window.location.href = '/';
});

// 버튼 이벤트 핸들러
backToRoomsBtn.addEventListener('click', () => {
    window.location.href = '/';
});

startVoteBtn.addEventListener('click', () => {
    
    if (canStartVote()) {
        socket.emit('start-vote', { roomId: currentRoomId });
    } else {
        if (!isRoomCreator) {
            showNotification('방장만 투표를 시작할 수 있습니다.');
        } else if (isVoting) {
            showNotification('이미 투표가 진행 중입니다.');
        }
    }
});

// 방 나가기는 뒤로가기 버튼으로 대체됨

// 방 사용자 정보 업데이트
function updateRoomUsers(usersData) {
    users.clear();
    cursorsContainer.innerHTML = '';
    
    usersData.forEach(user => {
        if (user.id !== myId) {
            users.set(user.id, user);
            updateCursor(user);
        }
    });
    
    updateStats();
}

// 투표 정보 업데이트
function updateVoteInfo(voteData) {
    if (!voteData) return;
    
    // 투표 제목 업데이트
    if (voteTitle) {
        voteTitle.textContent = voteData.title;
    }
    
    // 선택지 업데이트 (새 구조)
    const pA = document.querySelector('.choice-a p');
    const pB = document.querySelector('.choice-b p');
    
    if (pA && pB) {
        pA.textContent = voteData.choices ? voteData.choices.A : (voteData.choiceA || '첫 번째 선택지');
        pB.textContent = voteData.choices ? voteData.choices.B : (voteData.choiceB || '두 번째 선택지');
    }
    
    // 레거시 선택지 업데이트 (기존 구조)
    const pA_legacy = document.querySelector('#choiceA p');
    const pB_legacy = document.querySelector('#choiceB p');
    
    if (pA_legacy && pB_legacy) {
        pA_legacy.textContent = voteData.choices ? voteData.choices.A : (voteData.choiceA || '첫 번째 선택지');
        pB_legacy.textContent = voteData.choices ? voteData.choices.B : (voteData.choiceB || '두 번째 선택지');
    }
    
    // 현재 투표 정보 저장
    currentVote = voteData;
    
    updateButtons();
}

// 버튼 상태 업데이트
function updateButtons() {
    if (startVoteBtn) {
        // 투표 시작 버튼 상태 업데이트
        if (isRoomCreator && !isVoting) {
            startVoteBtn.style.display = 'block';
            startVoteBtn.classList.add('pulse');
        } else {
            startVoteBtn.style.display = 'none';
            startVoteBtn.classList.remove('pulse');
        }
    }
    
    if (editVoteBtn) {
        // 투표 편집 버튼 상태 업데이트
        if (isRoomCreator && !isVoting) {
            editVoteBtn.style.display = 'block';
        } else {
            editVoteBtn.style.display = 'none';
        }
    }
}

// 투표 시작 권한 확인
function canStartVote() {
    return isRoomCreator && !isVoting;
}

// 투표 시작 함수
function startVoting() {
    if (isVoting) return;
    
    isVoting = true;
    startVoteBtn.disabled = true;
    startVoteBtn.textContent = '투표 중...';
    
    const timeLimit = currentVote ? currentVote.timeLimit : 10;
    let timeLeft = timeLimit;
    timerText.textContent = timeLeft;
    
    currentTimer = setInterval(() => {
        timeLeft--;
        timerText.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(currentTimer);
            endVoting();
        }
    }, 1000);
}

// 투표 종료 함수
function endVoting() {
    isVoting = false;
    startVoteBtn.disabled = false;
    startVoteBtn.textContent = '투표 시작';
    timerText.textContent = '종료!';
    
    // 현재 각 사용자의 호버 상태 기반으로 투표 결과 수집
    const currentVotes = { A: 0, B: 0 };
    
    users.forEach(user => {
        // 호버 상태 기반 투표 집계
        if (user.hoverChoice && (user.hoverChoice === 'A' || user.hoverChoice === 'B')) {
            currentVotes[user.hoverChoice]++;
        }
    });
    
    // 내 선택도 포함 (호버 상태 사용)
    if (myId && currentHoverChoice) {
        currentVotes[currentHoverChoice]++;
        
        // 디버깅을 위한 로그
            Array.from(users.entries()).map(([id, user]) => ({
                id: id.substring(0, 8),
                hoverChoice: user.hoverChoice
            }))
    }
    
    // 서버에 투표 결과 전송
    socket.emit('vote-ended', { roomId: currentRoomId, results: currentVotes });
    
    // 3초 후 리셋
    setTimeout(() => {
        resetVoting();
    }, 3000);
}

// 투표 상태 업데이트
function updateVotingState(roomData) {
    if (roomData.voteInProgress) {
        isVoting = true;
        startVoteBtn.disabled = true;
        startVoteBtn.textContent = '투표 중...';
        timerText.textContent = roomData.timeLeft || '투표 중';
    }
}

// 투표 결과 표시
function showVoteResults(results, showModal = true) {
    // 입력값 검증
    if (!results || typeof results !== 'object' || results.A === undefined || results.B === undefined) {
        console.error('투표 결과 데이터가 올바르지 않습니다:', results);
        results = { A: 0, B: 0 }; // 기본값 설정
    }
    
    voteResults = results;
    
    // 승리한 선택지 강조
    choiceA.classList.remove('winning');
    choiceB.classList.remove('winning');
    
    if (results.A > results.B) {
        choiceA.classList.add('winning');
    } else if (results.B > results.A) {
        choiceB.classList.add('winning');
    }
    
    // 모달 표시 여부에 따라 결정
    if (showModal) {
        setTimeout(() => {
            openResultModal(results);
        }, 100); // 1초 후 모달 표시
    }
}

// 투표 리셋
function resetVoting() {
    isVoting = false;
    voteResults = { A: 0, B: 0 };
    timerText.textContent = '대기 중...';
    
    choiceA.classList.remove('winning', 'active');
    choiceB.classList.remove('winning', 'active');
    
    // 호버 상태 초기화
    currentHoverChoice = null;
    users.forEach(user => {
        user.hoverChoice = null;
    });
    
    // 투표 시작 버튼 상태 복원
    if (isRoomCreator) {
        startVoteBtn.disabled = false;
        startVoteBtn.textContent = '투표 시작';
    }
}

// 현재 선택지 표시
function updateCurrentChoice() {
    if (!isVoting) return;
    
    const choice = getCurrentChoice(myPosition.x, myPosition.y);
    
    choiceA.classList.toggle('active', choice === 'A');
    choiceB.classList.toggle('active', choice === 'B');
}

// 커서 업데이트
function updateCursor(user) {
    let cursorElement = document.getElementById(`cursor-${user.id}`);
    
    if (!cursorElement) {
        cursorElement = document.createElement('div');
        cursorElement.id = `cursor-${user.id}`;
        cursorElement.className = 'cursor';
        
        // SVG 화살표 추가
        cursorElement.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 10.2069L3 3L10.2069 22L13.4828 13.4828L22 10.2069Z" 
                      stroke="#000000" 
                      stroke-width="2" 
                      stroke-linecap="round" 
                      stroke-linejoin="round" 
                      fill="${user.color}"/>
            </svg>
        `;
        
        cursorsContainer.appendChild(cursorElement);
    }
    
    // SVG 색상 업데이트
    const path = cursorElement.querySelector('path');
    if (path) {
        path.setAttribute('stroke', '#000000'); // 검정색 테두리 유지
        path.setAttribute('stroke-width', '2'); // 테두리 두께 설정
        path.setAttribute('fill', user.color);  // 내부는 사용자 색상
    }
    
    cursorElement.style.left = user.x + '%';
    cursorElement.style.top = user.y + '%';
    
    // 영역 밖에 있는 경우 커서 숨기기
    if (user.isOutside) {
        cursorElement.style.opacity = '0';
        cursorElement.style.transform = 'translate(0, 0) scale(0)';
    } else {
        cursorElement.style.opacity = '1';
        cursorElement.style.transform = 'translate(0, 0) scale(1)';
    }
    
    // 투표 중일 때 현재 선택지에 따른 효과
    if (isVoting) {
        const choice = getCurrentChoice(user.x, user.y);
        cursorElement.classList.toggle('choice-a', choice === 'A');
        cursorElement.classList.toggle('choice-b', choice === 'B');
    } else {
        cursorElement.classList.remove('choice-a', 'choice-b');
    }
}

// 커서 제거
function removeCursor(userId) {
    const cursorElement = document.getElementById(`cursor-${userId}`);
    if (cursorElement) {
        cursorElement.remove();
    }
}

// 실시간 투표 집계 표시
function updateLiveVoteCount() {
    if (!isVoting) return;
    
    const counts = { A: 0, B: 0 };
    
    // 다른 사용자들의 호버 상태 집계
    users.forEach(user => {
        if (user.hoverChoice && (user.hoverChoice === 'A' || user.hoverChoice === 'B')) {
            counts[user.hoverChoice]++;
        }
    });
    
    // 내 호버 상태 포함
    if (currentHoverChoice && (currentHoverChoice === 'A' || currentHoverChoice === 'B')) {
        counts[currentHoverChoice]++;
    }
    
    // 선택지별 득표수 표시 (투표 진행 중에는 숨김)
    const choiceACount = choiceA.querySelector('.choice-count');
    const choiceBCount = choiceB.querySelector('.choice-count');
    
    if (choiceACount && choiceBCount) {
        // 투표 진행 중에는 "투표 중..." 표시
        choiceACount.textContent = '투표 중...';
        choiceBCount.textContent = '투표 중...';
    }
}

// 통계 업데이트
function updateStats() {
    userCount.textContent = `${users.size + 1}명 참여`; // +1은 자신
}

// 마우스 위치 전송 함수 개선
const originalSendMousePosition = sendMousePosition;
sendMousePosition = (x, y) => {
    originalSendMousePosition(x, y);
    updateCurrentChoice();
    updateLiveVoteCount();
};

// 알림 표시 함수
function showNotification(message) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: #4CAF50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        z-index: 2000;
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 모바일 터치 이벤트 지원
votingArea.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const rect = votingArea.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    // 내 마우스 위치 업데이트
    myPosition.x = x;
    myPosition.y = y;
    
    sendMousePosition(x, y);
});

votingArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = votingArea.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    // 내 마우스 위치 업데이트
    myPosition.x = x;
    myPosition.y = y;
    
    sendMousePosition(x, y);
});

votingArea.addEventListener('touchend', (e) => {
    if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const rect = votingArea.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;
        
        // 내 마우스 위치 업데이트
        myPosition.x = x;
        myPosition.y = y;
        
        sendMousePosition(x, y);
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 방 ID 확인
    if (!currentRoomId) {
        alert('방 ID가 없습니다.');
        window.location.href = '/';
        return;
    }
    
    // 사용자 ID 표시
    if (yourId) {
        yourId.textContent = `ID: ${socket.id ? socket.id.substring(0, 8) + '...' : '연결 중...'}`;
    }
});

// 재연결 시 방 재입장
socket.on('reconnect', () => {
    if (currentRoomId) {
        socket.emit('join-room', {
            roomId: currentRoomId,
            isOriginalCreator: false
        });
    }
});

// 선택지 편집 모달 관련 함수들
function openEditVoteModal() {
    if (!isRoomCreator || isVoting) return;
    
    // 현재 투표 정보로 폼 채우기
    if (currentVote) {
        editVoteTitle.value = currentVote.title || '';
        editSelectedTime = currentVote.timeLimit || 10;
        
        // 선택지 정보 설정 (구조 확인)
        if (currentVote.choices) {
            editChoiceA.value = currentVote.choices.A || '';
            editChoiceB.value = currentVote.choices.B || '';
        } else {
            // 이전 버전 호환성
            editChoiceA.value = currentVote.choiceA || '';
            editChoiceB.value = currentVote.choiceB || '';
        }
    } else {
        // 기본값 설정
        editVoteTitle.value = '';
        editChoiceA.value = '';
        editChoiceB.value = '';
        editSelectedTime = 10;
    }
    
    // 시간 버튼 활성화 상태 설정
    const timeButtons = document.querySelectorAll('#editVoteModal .time-btn');
    timeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.time) === editSelectedTime) {
            btn.classList.add('active');
        }
    });
    
    if (editVoteModal) editVoteModal.style.display = 'flex';
    if (editVoteTitle) editVoteTitle.focus();
}

function closeEditVoteModal() {
    if (editVoteModal) editVoteModal.style.display = 'none';
}

function submitVoteEdit() {
    const title = editVoteTitle.value.trim();
    const choiceA = editChoiceA.value.trim();
    const choiceB = editChoiceB.value.trim();
    const timeLimit = editSelectedTime;
    
    if (!title || !choiceA || !choiceB) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    if (title.length > 30) {
        alert('투표 주제는 30자 이하로 입력해주세요.');
        return;
    }
    
    if (choiceA.length > 20 || choiceB.length > 20) {
        alert('선택지는 20자 이하로 입력해주세요.');
        return;
    }
    
    const editData = {
        roomId: currentRoomId,
        title: title,
        choices: {
            A: choiceA,
            B: choiceB
        },
        timeLimit: timeLimit
    };
    
    socket.emit('edit-vote', editData);
    closeEditVoteModal();
}

// 투표 결과 모달 관련 함수들
function openResultModal(results) {
    // 입력값 검증
    if (!results || typeof results !== 'object' || results.A === undefined || results.B === undefined) {
        console.error('투표 결과 데이터가 올바르지 않습니다:', results);
        return;
    }
    
    // 투표 결과 정보 채우기
    const resultTitle = document.getElementById('resultTitle');
    const resultChoiceA = document.getElementById('resultChoiceA');
    const resultChoiceB = document.getElementById('resultChoiceB');
    const resultVotesA = document.getElementById('resultVotesA');
    const resultVotesB = document.getElementById('resultVotesB');
    const progressA = document.getElementById('progressA');
    const progressB = document.getElementById('progressB');
    const resultWinner = document.getElementById('resultWinner');
    
    const totalVotes = results.A + results.B;
    const percentA = totalVotes > 0 ? Math.round((results.A / totalVotes) * 100) : 0;
    const percentB = totalVotes > 0 ? Math.round((results.B / totalVotes) * 100) : 0;
    
    if (resultTitle) resultTitle.textContent = currentVote ? currentVote.title : '투표 결과';
    
    // 선택지 이름 설정 (currentVote.choices 구조 확인)
    let choiceAName = '선택지 A';
    let choiceBName = '선택지 B';
    
    if (currentVote) {
        if (currentVote.choices) {
            choiceAName = currentVote.choices.A;
            choiceBName = currentVote.choices.B;
        } else {
            // 이전 버전 호환성
            choiceAName = currentVote.choiceA || '선택지 A';
            choiceBName = currentVote.choiceB || '선택지 B';
        }
    }
    
    if (resultChoiceA) resultChoiceA.textContent = choiceAName;
    if (resultChoiceB) resultChoiceB.textContent = choiceBName;
    if (resultVotesA) resultVotesA.textContent = `${results.A}표`;
    if (resultVotesB) resultVotesB.textContent = `${results.B}표`;
    
    // 프로그레스 바 설정
    if (progressA) progressA.style.width = `${percentA}%`;
    if (progressB) progressB.style.width = `${percentB}%`;
    
    // 승자 표시
    if (resultWinner) {
        if (results.A > results.B) {
            resultWinner.textContent = `${choiceAName} 승리!`;
            resultWinner.className = 'result-winner';
        } else if (results.B > results.A) {
            resultWinner.textContent = `${choiceBName}  승리!`;
            resultWinner.className = 'result-winner';
        } else {
            resultWinner.textContent = '무승부!';
            resultWinner.className = 'result-winner tie';
        }
    }
    
    if (resultModal) resultModal.style.display = 'flex';
}

function closeResultModal() {
    if (resultModal) resultModal.style.display = 'none';
}

function closeAllModals() {
    if (editVoteModal) editVoteModal.style.display = 'none';
    if (resultModal) resultModal.style.display = 'none';
}

// 투표 편집 관련 Socket.IO 이벤트
socket.on('vote-edited', (voteData) => {
    updateVoteInfo(voteData);
});

socket.on('vote-edit-failed', (error) => {
    console.error('투표 수정 실패:', error);
    alert(`투표 수정에 실패했습니다: ${error}`);
});

// 기존 이벤트 리스너들 (안전한 null 체크)
if (editVoteBtn) editVoteBtn.addEventListener('click', openEditVoteModal);
if (editVoteForm) editVoteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitVoteEdit();
});
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditVoteModal);

// 편집 모달의 time-btn 이벤트 리스너
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('time-btn') && e.target.closest('#editVoteModal')) {
        // 기존 활성화 제거
        const timeButtons = document.querySelectorAll('#editVoteModal .time-btn');
        timeButtons.forEach(btn => btn.classList.remove('active'));
        
        // 새로운 버튼 활성화
        e.target.classList.add('active');
        
        // 시간 설정
        editSelectedTime = parseInt(e.target.dataset.time);
    }
});

// 모달 닫기 버튼들
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllModals();
    });
});

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
    if (editVoteModal && e.target === editVoteModal) {
        closeEditVoteModal();
    }
    if (resultModal && e.target === resultModal) {
        closeResultModal();
    }
});