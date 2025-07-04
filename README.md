# 🎯 CursorPick - 실시간 마우스 커서 투표

마우스 커서 위치로 실시간 투표하는 웹사이트입니다.

## 🚀 기능

- 실시간 마우스 커서 위치 공유
- 투표방 생성 및 관리
- 10초 제한시간 자동 투표
- 모바일 터치 지원
- 실시간 결과 표시

## 🛠️ 기술 스택

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: In-memory (방 정보 임시 저장)

## 📦 설치 및 실행

### 로컬 개발

```bash
npm install
npm start
```

### 개발 모드 (자동 재시작)

```bash
npm run dev
```

## 🌐 호스팅 방법

### 1. Railway (추천)

1. [Railway](https://railway.app) 가입
2. GitHub 저장소 연결
3. 자동 배포 완료

### 2. Render

1. [Render](https://render.com) 가입
2. GitHub 저장소 연결
3. Node.js 서비스로 배포

### 3. Heroku

1. [Heroku](https://heroku.com) 가입
2. Heroku CLI 설치
3. 배포 명령:

```bash
heroku create your-app-name
git push heroku main
```

## 📱 사용 방법

1. **방 목록 페이지**: 현재 활성화된 투표방들을 확인
2. **투표 만들기**: 새로운 투표방 생성
3. **투표 참여**: 방에 입장하여 마우스 커서로 투표
4. **결과 확인**: 투표 종료 후 실시간 결과 확인

## �� 라이선스

MIT License
