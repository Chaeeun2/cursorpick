// Socket.IO 연결
const socket = io();

// DOM 요소들
const voteForm = document.getElementById('voteForm');
const voteTitleInput = document.getElementById('voteTitle');
const choiceAInput = document.getElementById('choiceA');
const choiceBInput = document.getElementById('choiceB');
const customTimeInput = document.getElementById('customTime');
const selectedTimeDisplay = document.getElementById('selectedTime');
const connectionStatusElement = document.getElementById('connectionStatus');
const backBtn = document.getElementById('backBtn');
const previewBtn = document.getElementById('previewBtn');
const createVoteBtn = document.getElementById('createVoteBtn');

// 글자수 표시 요소들
const titleCounter = document.getElementById('titleCounter');
const choiceACounter = document.getElementById('choiceACounter');
const choiceBCounter = document.getElementById('choiceBCounter');

// 미리보기 모달 요소들
const previewModal = document.getElementById('previewModal');
const closePreviewBtn = document.getElementById('closePreview');
const previewTitle = document.getElementById('previewTitle');
const previewChoiceA = document.getElementById('previewChoiceA');
const previewChoiceB = document.getElementById('previewChoiceB');
const previewTime = document.getElementById('previewTime');

// 선택지 미리보기 요소들
const choiceAPreview = document.querySelector('.choice-a-preview .choice-text');
const choiceBPreview = document.querySelector('.choice-b-preview .choice-text');

// 시간 버튼들
const timeButtons = document.querySelectorAll('.time-btn');

// 상태 변수들
let selectedTime = 10; // 기본 10초
let myId = null;
let isVoteCreated = false; // 투표 생성 완료 플래그

// 글자수 업데이트 함수
function updateCharCounter(input, counter, maxLength) {
    if (!counter) return;
    
    const currentLength = input.value.length;
    counter.textContent = currentLength;
    
    // 글자수에 따른 색상 변경
    const counterElement = counter.parentElement;
    counterElement.classList.remove('warning', 'error');
    
    if (currentLength >= maxLength) {
        counterElement.classList.add('error');
    } else if (currentLength >= maxLength * 0.8) {
        counterElement.classList.add('warning');
    }
}

// Socket.IO 연결 이벤트
socket.on('connect', () => {
    myId = socket.id;
    if (connectionStatusElement) {
        connectionStatusElement.textContent = '연결됨';
        connectionStatusElement.className = 'connected';
    }
});

socket.on('disconnect', () => {
    if (connectionStatusElement) {
        connectionStatusElement.textContent = '연결 끊김';
        connectionStatusElement.className = 'disconnected';
    }
});

// 글자수 표시 이벤트 리스너
if (voteTitleInput && titleCounter) {
    voteTitleInput.addEventListener('input', () => {
        updateCharCounter(voteTitleInput, titleCounter, 30);
    });
    // 초기 글자수 표시
    updateCharCounter(voteTitleInput, titleCounter, 30);
}

if (choiceAInput && choiceACounter) {
    choiceAInput.addEventListener('input', () => {
        updateCharCounter(choiceAInput, choiceACounter, 20);
    });
    // 초기 글자수 표시
    updateCharCounter(choiceAInput, choiceACounter, 20);
}

if (choiceBInput && choiceBCounter) {
    choiceBInput.addEventListener('input', () => {
        updateCharCounter(choiceBInput, choiceBCounter, 20);
    });
    // 초기 글자수 표시
    updateCharCounter(choiceBInput, choiceBCounter, 20);
}

// 뒤로가기 버튼
backBtn.addEventListener('click', () => {
        window.location.href = '/';
    
    const hasContent = voteTitleInput.value.trim() || 
                      choiceAInput.value.trim() || 
                      choiceBInput.value.trim();
});

// 시간 버튼 이벤트 처리
timeButtons.forEach(button => {
    button.addEventListener('click', () => {
        // 기존 활성화 제거
        timeButtons.forEach(btn => btn.classList.remove('active'));
        
        // 새로운 버튼 활성화
        button.classList.add('active');
        
        // 시간 설정
        selectedTime = parseInt(button.dataset.time);
        if (selectedTimeDisplay) {
            selectedTimeDisplay.textContent = `${selectedTime}초`;
        }
        
        // 커스텀 입력 필드 초기화
        if (customTimeInput) {
            customTimeInput.value = '';
        }
    });
});

// 커스텀 시간 입력 처리 (요소가 존재할 때만)
if (customTimeInput) {
    customTimeInput.addEventListener('input', () => {
        const customTime = parseInt(customTimeInput.value);
        
        if (customTime && customTime > 0 && customTime <= 300) {
            // 기존 버튼 활성화 제거
            timeButtons.forEach(btn => btn.classList.remove('active'));
            
            selectedTime = customTime;
            if (selectedTimeDisplay) {
                selectedTimeDisplay.textContent = `${selectedTime}초`;
            }
        }
    });
}

// 미리보기 버튼 (요소가 존재할 때만)
if (previewBtn) {
    previewBtn.addEventListener('click', () => {
        const title = voteTitleInput.value || '투표 주제';
        const choiceA = choiceAInput.value || '첫 번째 선택지';
        const choiceB = choiceBInput.value || '두 번째 선택지';
        
        // 미리보기 내용 업데이트
        if (previewTitle) previewTitle.textContent = title;
        if (previewChoiceA) previewChoiceA.textContent = choiceA;
        if (previewChoiceB) previewChoiceB.textContent = choiceB;
        if (previewTime) previewTime.textContent = `${selectedTime}초`;
        
        // 모달 표시
        if (previewModal) previewModal.style.display = 'block';
    });
}

// 미리보기 모달 닫기 (요소가 존재할 때만)
if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', () => {
        if (previewModal) previewModal.style.display = 'none';
    });
}

// 모달 배경 클릭으로 닫기 (요소가 존재할 때만)
if (previewModal) {
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.style.display = 'none';
        }
    });
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewModal && previewModal.style.display === 'block') {
        previewModal.style.display = 'none';
    }
});

// 폼 제출 처리
voteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // 폼 데이터 수집
    const voteData = {
        title: voteTitleInput.value.trim(),
        choiceA: choiceAInput.value.trim(),
        choiceB: choiceBInput.value.trim(),
        timeLimit: selectedTime,
        creatorId: myId
    };
    
    // 유효성 검사
    if (!voteData.title) {
        alert('투표 주제를 입력해주세요.');
        voteTitleInput.focus();
        return;
    }
    
    if (voteData.title.length > 30) {
        alert('투표 주제는 30자 이하로 입력해주세요.');
        voteTitleInput.focus();
        return;
    }
    
    if (!voteData.choiceA) {
        alert('선택지A를 입력해주세요.');
        choiceAInput.focus();
        return;
    }
    
    if (voteData.choiceA.length > 20) {
        alert('선택지는 20자 이하로 입력해주세요.');
        choiceAInput.focus();
        return;
    }
    
    if (!voteData.choiceB) {
        alert('선택지B를 입력해주세요.');
        choiceBInput.focus();
        return;
    }
    
    if (voteData.choiceB.length > 20) {
        alert('선택지는 20자 이하로 입력해주세요.');
        choiceBInput.focus();
        return;
    }
    
    if (voteData.choiceA === voteData.choiceB) {
        alert('두 선택지는 서로 달라야 합니다.');
        choiceBInput.focus();
        return;
    }
    
    // 버튼 비활성화
    createVoteBtn.disabled = true;
    createVoteBtn.textContent = '만드는 중';
    
    // 서버에 투표 생성 요청
    socket.emit('create-vote', voteData);
});

// 투표 생성 성공 응답
socket.on('vote-created', (data) => {
    const roomId = data.roomId;
    
    // 투표 생성 완료 플래그 설정
    isVoteCreated = true;
    
    // 로컬 스토리지에 투표 생성자 정보 저장
    localStorage.setItem('isVoteCreator', 'true');
    localStorage.setItem('createdRoomId', roomId);
    
    // 투표방으로 이동
    window.location.href = `/room.html?id=${roomId}&creator=true`;
});

// 투표 생성 실패 응답
socket.on('vote-creation-error', (error) => {
    createVoteBtn.disabled = false;
    createVoteBtn.textContent = '투표 만들기';
    
    alert('투표 생성에 실패했습니다: ' + error);
});

// 서버 에러 처리
socket.on('error', (error) => {
    createVoteBtn.disabled = false;
    createVoteBtn.textContent = '투표 만들기';
    
    alert('오류가 발생했습니다: ' + error);
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 포커스 설정
    voteTitleInput.focus();
});

// 폼 필드 엔터키 처리
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        if (e.target === voteTitleInput) {
            choiceAInput.focus();
        } else if (e.target === choiceAInput) {
            choiceBInput.focus();
        } else if (e.target === choiceBInput) {
            customTimeInput.focus();
        } else if (e.target === customTimeInput) {
            // 폼 제출
            voteForm.dispatchEvent(new Event('submit'));
        }
    }
});

// 브라우저 새로고침/닫기 시 경고
const beforeUnloadHandler = (e) => {
    if (isVoteCreated) return; // 투표 생성 완료 시 경고 안 함
    
    const hasContent = voteTitleInput.value.trim() || 
                      choiceAInput.value.trim() || 
                      choiceBInput.value.trim();
};

window.addEventListener('beforeunload', beforeUnloadHandler);


// 투표 생성 성공 시 로컬 스토리지 정리는 위의 메인 이벤트 리스너에서 처리됨 