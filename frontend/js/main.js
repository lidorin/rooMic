// קבועים
const API_URL = 'http://localhost:3000/api';

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
buttons.createRoom.addEventListener('click', async () => {
    const roomCode = generateRoomCode();
    try {
        const response = await fetch(`${API_URL}/rooms/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: roomCode })
        });
        
        if (response.ok) {
            inputs.roomCode.textContent = roomCode;
            showScreen(screens.create);
        } else {
            alert('שגיאה ביצירת החדר. נסה שוב.');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        alert('שגיאה ביצירת החדר. נסה שוב.');
    }
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

buttons.submitCode.addEventListener('click', async () => {
    const code = inputs.roomCodeInput.value;
    if (!code || code.length !== 4) {
        alert('אנא הזן קוד חדר תקין (4 ספרות)');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/rooms/${code}`);
        if (response.ok) {
            showScreen(screens.broadcast);
            // כאן נתחיל את החיבור WebRTC
            initializeWebRTC(code);
        } else {
            alert('קוד חדר לא תקין או שהחדר לא קיים');
        }
    } catch (error) {
        console.error('Error joining room:', error);
        alert('שגיאה בהצטרפות לחדר. נסה שוב.');
    }
});

buttons.startBroadcast.addEventListener('click', () => {
    showScreen(screens.broadcast);
    // כאן נתחיל את השידור WebRTC
    initializeWebRTC(inputs.roomCode.textContent);
});

buttons.toggleMic.addEventListener('click', () => {
    const isMuted = buttons.toggleMic.textContent === 'הפעל מיקרופון';
    buttons.toggleMic.textContent = isMuted ? 'השתק מיקרופון' : 'הפעל מיקרופון';
    // כאן נטפל בהשתקת/הפעלת המיקרופון
    toggleMicrophone(isMuted);
});

buttons.leaveRoom.addEventListener('click', () => {
    // כאן נסגור את החיבור WebRTC
    closeWebRTC();
    showScreen(screens.main);
}); 