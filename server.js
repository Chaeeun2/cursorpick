const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 방 관리를 위한 Map
const rooms = new Map();
const users = new Map(); // 사용자 정보 저장

// 사용자 색상 배열
const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#F4D03F'
];

// 색상 인덱스 관리
let colorIndex = 0;

// 방 생성 함수
function createRoom(voteData, creatorId) {
    const roomId = uuidv4();
    const room = {
        id: roomId,
        creatorId: creatorId,
        vote: voteData,
        users: [],
        voteInProgress: false,
        voteTimer: null,
        voteResults: { A: 0, B: 0 },
        timeLeft: 0,
        userCount: 0
    };
    
    rooms.set(roomId, room);
    return room;
}

// 방 삭제 함수
function deleteRoom(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        // 모든 사용자를 방에서 제거
        room.users.forEach(user => {
            const socket = io.sockets.sockets.get(user.id);
            if (socket) {
                socket.leave(roomId);
            }
        });
        
        // 타이머 정리
        if (room.voteTimer) {
            clearInterval(room.voteTimer);
        }
        
        rooms.delete(roomId);
        
        // 모든 클라이언트에게 방 삭제 알림
        io.emit('room-deleted', roomId);
    }
}

// 방 목록 업데이트 브로드캐스트
function broadcastRoomsList() {
    const roomsList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        vote: room.vote,
        voteInProgress: room.voteInProgress,
        voteResults: room.voteResults,
        userCount: room.userCount
    }));
    
    io.emit('rooms-list', roomsList);
}

// 방 정보 업데이트 브로드캐스트
function broadcastRoomUpdate(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        const roomData = {
            id: room.id,
            vote: room.vote,
            voteInProgress: room.voteInProgress,
            voteResults: room.voteResults,
            userCount: room.userCount
        };
        
        io.emit('room-updated', roomData);
    }
}

// 방 내 사용자들에게 메시지 전송
function broadcastToRoom(roomId, eventName, data) {
    io.to(roomId).emit(eventName, data);
}

// 사용자 색상 할당
function assignColor() {
    const color = colors[colorIndex % colors.length];
    colorIndex++;
    return color;
}

// 투표 시작 함수
function startVoteInRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room || room.voteInProgress) return;
    
    room.voteInProgress = true;
    room.timeLeft = room.vote.timeLimit;
    
    // 방 내 모든 사용자에게 투표 시작 알림
    broadcastToRoom(roomId, 'vote-started');
    
    // 타이머 시작
    room.voteTimer = setInterval(() => {
        room.timeLeft--;
        
        if (room.timeLeft <= 0) {
            clearInterval(room.voteTimer);
            endVoteInRoom(roomId);
        }
    }, 1000);
    
    // 방 상태 업데이트
    broadcastRoomUpdate(roomId);
}

// 투표 종료 함수
function endVoteInRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.voteInProgress = false;
    
    // 현재 각 사용자의 호버 상태 기반으로 투표 결과 계산
    const results = { A: 0, B: 0 };
    
    room.users.forEach(user => {
        // 호버 상태 기반 투표 집계
        if (user.hoverChoice && (user.hoverChoice === 'A' || user.hoverChoice === 'B')) {
            results[user.hoverChoice]++;
        }
    });
    
    room.voteResults = results;
    
    // 방 내 모든 사용자에게 결과 전송
    broadcastToRoom(roomId, 'vote-results', results);
    
    // 방 상태 업데이트
    broadcastRoomUpdate(roomId);
    
    // 3초 후 자동 리셋
    setTimeout(() => {
        resetVoteInRoom(roomId);
    }, 3000);
}

// 투표 리셋 함수
function resetVoteInRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.voteResults = { A: 0, B: 0 };
    room.voteInProgress = false;
    room.timeLeft = 0;
    
    if (room.voteTimer) {
        clearInterval(room.voteTimer);
        room.voteTimer = null;
    }
    
    // 방 내 모든 사용자에게 리셋 알림
    broadcastToRoom(roomId, 'vote-reset');
    
    // 방 상태 업데이트
    broadcastRoomUpdate(roomId);
}

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log('새로운 사용자 연결:', socket.id);
    
    // 사용자 정보 초기화
    const user = {
        id: socket.id,
        color: assignColor(),
        x: 25,
        y: 50,
        hoverChoice: null
    };
    
    users.set(socket.id, user);
    
    // 방 생성 요청
    socket.on('create-vote', (voteData) => {
        try {
            const room = createRoom(voteData, socket.id);
            
            // 모든 클라이언트에게 새 방 알림
            io.emit('room-created', {
                id: room.id,
                vote: room.vote,
                voteInProgress: room.voteInProgress,
                voteResults: room.voteResults,
                userCount: room.userCount
            });
            
            // 방 생성자에게 성공 응답
            socket.emit('vote-created', { roomId: room.id });
        } catch (error) {
            socket.emit('vote-creation-error', error.message);
        }
    });
    
    // 방 목록 요청
    socket.on('get-rooms', () => {
        const roomsList = Array.from(rooms.values()).map(room => ({
            id: room.id,
            vote: room.vote,
            voteInProgress: room.voteInProgress,
            voteResults: room.voteResults,
            userCount: room.userCount
        }));
        
        socket.emit('rooms-list', roomsList);
    });
    
    // 방 입장 요청
    socket.on('join-room', (data) => {
        const { roomId, isOriginalCreator } = data;
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('room-not-found');
            return;
        }
        
        // 원래 투표 생성자가 입장하는 경우, 방 생성자 ID 업데이트
        if (isOriginalCreator && room.creatorId !== socket.id) {
            room.creatorId = socket.id;
        }
        
        // 방에 입장
        socket.join(roomId);
        
        // 사용자를 방에 추가
        const user = users.get(socket.id);
        if (user) {
            const existingUserIndex = room.users.findIndex(u => u.id === socket.id);
            if (existingUserIndex === -1) {
                room.users.push(user);
            } else {
                room.users[existingUserIndex] = user;
            }
        }
        
        // 사용자 수 업데이트
        room.userCount = room.users.length;
        
        // 방 입장 데이터 구성
        const roomJoinedData = {
            roomId: room.id,
            vote: room.vote,
            users: room.users,
            voteInProgress: room.voteInProgress,
            voteResults: room.voteResults,
            timeLeft: room.timeLeft,
            creatorId: room.creatorId
        };
        
        // 방 입장 성공 응답
        socket.emit('room-joined', roomJoinedData);
        
        // 방 내 다른 사용자들에게 새 사용자 알림
        socket.to(roomId).emit('user-joined', user);
        
        // 방 상태 업데이트
        broadcastRoomUpdate(roomId);
    });
    
    // 마우스 움직임 처리
    socket.on('mouse-move', (data) => {
        const { x, y, roomId } = data;
        const user = users.get(socket.id);
        
        if (user && rooms.has(roomId)) {
            user.x = x;
            user.y = y;
            
            // 같은 방의 다른 사용자들에게 마우스 위치 전송
            socket.to(roomId).emit('mouse-moved', {
                userId: socket.id,
                x: x,
                y: y,
                color: user.color
            });
        }
    });
    
    // 호버 상태 업데이트
    socket.on('hover-choice-update', (data) => {
        const { roomId, choice } = data;
        const user = users.get(socket.id);
        
        if (user && rooms.has(roomId)) {
            user.hoverChoice = choice;
            
            // 같은 방의 다른 사용자들에게 호버 상태 전송
            socket.to(roomId).emit('hover-choice-changed', {
                userId: socket.id,
                choice: choice,
                color: user.color
            });
        }
    });
    
    // 투표 시작 요청
    socket.on('start-vote', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        
        if (!room) {
            return;
        }
        
        if (room.creatorId === socket.id && !room.voteInProgress) {
            startVoteInRoom(roomId);
        }
    });
    
    // 투표 편집 요청
    socket.on('edit-vote', (data) => {
        const { roomId, title, choices, timeLimit } = data;
        const room = rooms.get(roomId);
        
        if (!room) {
            return;
        }
        
        // 방 생성자만 편집 가능
        if (room.creatorId !== socket.id) {
            return;
        }
        
        // 투표 진행 중에는 편집 불가
        if (room.voteInProgress) {
            return;
        }
        
        // 투표 정보 업데이트
        room.vote = {
            ...room.vote,
            title: title,
            choices: choices,
            timeLimit: timeLimit
        };
        
        // 방 내 모든 사용자에게 변경 알림
        broadcastToRoom(roomId, 'vote-edited', room.vote);
        
        // 방 상태 업데이트
        broadcastRoomUpdate(roomId);
    });
    
    // 연결 해제 처리
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            // 사용자가 속한 방들에서 제거
            rooms.forEach((room, roomId) => {
                const userIndex = room.users.findIndex(u => u.id === socket.id);
                if (userIndex !== -1) {
                    room.users.splice(userIndex, 1);
                    room.userCount = room.users.length;
                    
                    // 방 내 다른 사용자들에게 알림
                    socket.to(roomId).emit('user-left', socket.id);
                    
                    // 방 생성자가 나간 경우
                    if (room.creatorId === socket.id) {
                        // 5초 후 방 삭제 (재연결 대기)
                        setTimeout(() => {
                            const currentRoom = rooms.get(roomId);
                            if (currentRoom && currentRoom.creatorId === socket.id) {
                                deleteRoom(roomId);
                            }
                        }, 2000);
                    }
                    
                    // 방이 비어있으면 즉시 삭제
                    if (room.users.length === 0) {
                        deleteRoom(roomId);
                    } else {
                        // 방 상태 업데이트
                        broadcastRoomUpdate(roomId);
                    }
                }
            });
        }
        
        users.delete(socket.id);
    });
    
    // 방 나가기
    socket.on('leave-room', (data) => {
        const { roomId } = data;
        leaveRoom(socket.id, roomId);
    });
    
    // 방 나가기 함수
    function leaveRoom(userId, roomId) {
        const room = rooms.get(roomId);
        if (!room) return;
        
        // 방에서 사용자 제거
        const userIndex = room.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            room.users.splice(userIndex, 1);
            room.userCount = room.users.length;
            
            // 방 나가기
            const socket = io.sockets.sockets.get(userId);
            if (socket) {
                socket.leave(roomId);
            }
            
            // 방 내 다른 사용자들에게 알림
            io.to(roomId).emit('user-left', userId);
            
            // 방이 비어있으면 삭제
            if (room.users.length === 0) {
                deleteRoom(roomId);
            } else {
                // 방 상태 업데이트
                broadcastRoomUpdate(roomId);
            }
        }
    }
});

// 빈 방 정리 (주기적으로 실행)
setInterval(() => {
    rooms.forEach((room, roomId) => {
        if (room.users.length === 0) {
            deleteRoom(roomId);
        }
    });
}, 60000); // 1분마다 실행

// 서버 시작
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
    if (process.env.NODE_ENV === 'production') {
        console.log(`프로덕션 환경에서 실행 중`);
    } else {
        console.log(`http://localhost:${PORT} 에서 접속하세요`);
    }
}); 