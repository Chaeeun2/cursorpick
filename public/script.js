// Socket.IO 연결
const socket = io();

// DOM 요소들
const createVotePageBtn = document.getElementById('createVotePageBtn');
const noRoomsMessage = document.getElementById('noRoomsMessage');
const roomList = document.getElementById('roomList');
const connectionStatus = document.getElementById('connectionStatus');

// 상태 변수들
let myId = null;
let rooms = new Map();

// Socket.IO 연결 이벤트
socket.on('connect', () => {
    myId = socket.id;
    
    // 사용자 ID 표시
    const yourId = document.getElementById('yourId');
    if (yourId) {
        yourId.textContent = `ID: ${myId.substring(0, 8)}...`;
    }
    
    // 방 목록 요청
    socket.emit('get-rooms');
});

socket.on('disconnect', () => {
    if (connectionStatus) {
        connectionStatus.textContent = '연결 끊김';
        connectionStatus.className = 'disconnected';
    }
});

// 방 목록 업데이트
socket.on('rooms-list', (roomsData) => {
    updateRoomsList(roomsData);
});

// 새 방 생성 알림
socket.on('room-created', (roomData) => {
    addRoomToList(roomData);
    updateStats();
});

// 방 삭제 알림
socket.on('room-deleted', (roomId) => {
    removeRoomFromList(roomId);
    updateStats();
});

// 방 상태 업데이트
socket.on('room-updated', (roomData) => {
    updateRoomInList(roomData);
});

// 투표 만들기 페이지로 이동
createVotePageBtn.addEventListener('click', () => {
    window.location.href = '/create-vote.html';
});

// 방 목록 업데이트 함수
function updateRoomsList(roomsData) {
    rooms.clear();
    
    if (!roomsData || roomsData.length === 0) {
        showNoRoomsMessage();
        return;
    }
    
    // 방 목록 표시
    noRoomsMessage.style.display = 'none';
    roomList.style.display = 'grid';
    roomList.innerHTML = '';
    
    roomsData.forEach(room => {
        rooms.set(room.id, room);
        addRoomToList(room, false);
    });
    
    updateStats();
}

// 방이 없을 때 메시지 표시
function showNoRoomsMessage() {
    noRoomsMessage.style.display = 'block';
    roomList.style.display = 'none';
    updateStats();
}

// 방 목록에 방 추가
function addRoomToList(room, animate = true) {
    const roomCard = createRoomCard(room);
    roomList.appendChild(roomCard);
    
    if (animate) {
        roomCard.style.opacity = '0';
        roomCard.style.transform = 'translateY(20px)';
        setTimeout(() => {
            roomCard.style.transition = 'all 0.3s ease';
            roomCard.style.opacity = '1';
            roomCard.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // 빈 메시지 숨기기
    if (noRoomsMessage.style.display !== 'none') {
        noRoomsMessage.style.display = 'none';
        roomList.style.display = 'grid';
    }
}

// 방 목록에서 방 제거
function removeRoomFromList(roomId) {
    const roomCard = document.querySelector(`[data-room-id="${roomId}"]`);
    if (roomCard) {
        roomCard.style.transition = 'all 0.3s ease';
        roomCard.style.opacity = '0';
        roomCard.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            roomCard.remove();
            
            // 방이 없으면 빈 메시지 표시
            if (roomList.children.length === 0) {
                showNoRoomsMessage();
            }
        }, 300);
    }
    
    rooms.delete(roomId);
}

// 방 목록에서 방 업데이트
function updateRoomInList(room) {
    const roomCard = document.querySelector(`[data-room-id="${room.id}"]`);
    if (roomCard) {
        const newCard = createRoomCard(room);
        roomCard.replaceWith(newCard);
    }
    rooms.set(room.id, room);
}

// 방 카드 생성
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.setAttribute('data-room-id', room.id);
    
    const status = room.voteInProgress ? 'voting' : 'waiting';
    const statusText = room.voteInProgress ? '투표 중' : '대기 중';
    
    card.innerHTML = `
        <div class="room-card-header">
            <h3 class="room-title">${escapeHtml(room.vote.title)}</h3>
            <div class="room-choice">
                <span class="choice-name">${escapeHtml(room.vote.choices ? room.vote.choices.A : room.vote.choiceA || '선택지 A')}</span> vs 
                <span class="choice-name">${escapeHtml(room.vote.choices ? room.vote.choices.B : room.vote.choiceB || '선택지 B')}</span>
            </div>
        </div>
        <div class="room-meta">
        <div class="room-participants">${room.userCount}명 참여</div>
        <span class="room-status ${status}">${statusText}</span>
        </div>
        <div class="room-enter ${status}-enter" onclick="joinRoom('${room.id}')">입장</div>
    `;
    
    return card;
}

// 방 입장
function joinRoom(roomId) {
    window.location.href = `/room.html?id=${roomId}`;
}

// 통계 업데이트
function updateStats() {
    // 현재 HTML 구조에서는 별도의 통계 표시가 없으므로
    // 필요시 여기에 통계 관련 로직을 추가할 수 있습니다.
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 알림 표시 함수
function showNotification(message) {
    // 기존 알림 제거
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
    
    // 애니메이션
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 3초 후 제거
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 방 목록 요청
    socket.emit('get-rooms');
});

// 페이지 로드 시 Socket.IO 재연결 시도
socket.on('reconnect', () => {
    if (connectionStatus) {
        connectionStatus.textContent = '연결됨';
        connectionStatus.className = 'connected';
    }
    
    // 방 목록 다시 요청
    socket.emit('get-rooms');
}); 