// קבועים
const API_URL = 'https://lidorin.github.io/roomMic';

// אלמנטים
const screens = {
    main: document.getElementById('main-menu'),
    create: document.getElementById('create-room-screen'),
    join: document.getElementById('join-room-screen'),
    broadcast: document.getElementById('broadcast-screen')
};

const buttons = {
    createRoom: document.getElementById('create-room'),
    joinRoom: document.getElementById('join-room'),
    startBroadcast: document.getElementById('start-broadcast'),
    backToMain: document.getElementById('back-to-main'),
    backToMainJoin: document.getElementById('back-to-main-join'),
    copyCode: document.getElementById('copy-code'),
    submitCode: document.getElementById('submit-code'),
    toggleMic: document.getElementById('toggle-mic'),
    leaveRoom: document.getElementById('leave-room')
};

const inputs = {
    roomCode: document.getElementById('room-code'),
    roomCodeInput: document.getElementById('room-code-input')
};

const status = {
    connection: document.getElementById('connection-status')
};

// פונקציות עזר
function showScreen(screen) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// אירועים
buttons.createRoom.addEventListener('click', () => {
    const roomCode = generateRoomCode();
    inputs.roomCode.textContent = roomCode;
    showScreen(screens.create);
    // שמירת הקוד ב-localStorage
    localStorage.setItem('roomCode', roomCode);
    localStorage.setItem('isHost', 'true');
});

buttons.joinRoom.addEventListener('click', () => {
    showScreen(screens.join);
});

buttons.backToMain.addEventListener('click', () => {
    showScreen(screens.main);
});

buttons.backToMainJoin.addEventListener('click', () => {
    showScreen(screens.main);
});

buttons.copyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(inputs.roomCode.textContent)
        .then(() => alert('הקוד הועתק!'))
        .catch(err => console.error('Error copying code:', err));
});

buttons.submitCode.addEventListener('click', () => {
    const code = inputs.roomCodeInput.value;
    if (!code || code.length !== 4) {
        alert('אנא הזן קוד חדר תקין (4 ספרות)');
        return;
    }

    // שמירת הקוד ב-localStorage
    localStorage.setItem('roomCode', code);
    localStorage.setItem('isHost', 'false');
    showScreen(screens.broadcast);
    initializeWebRTC(code);
});

buttons.startBroadcast.addEventListener('click', () => {
    showScreen(screens.broadcast);
    initializeWebRTC(inputs.roomCode.textContent);
});

buttons.toggleMic.addEventListener('click', () => {
    const isMuted = buttons.toggleMic.textContent === 'הפעל מיקרופון';
    buttons.toggleMic.textContent = isMuted ? 'השתק מיקרופון' : 'הפעל מיקרופון';
    toggleMicrophone(isMuted);
});

buttons.leaveRoom.addEventListener('click', () => {
    closeWebRTC();
    localStorage.removeItem('roomCode');
    localStorage.removeItem('isHost');
    showScreen(screens.main);
}); 