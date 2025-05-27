// PeerJS + UI logic for roomMic
let peer = null;
let call = null;
let localStream = null;
let isHost = false;
let currentRoom = null;

// UI Elements
const screens = {
    main: document.getElementById('main-menu'),
    create: document.getElementById('create-screen'),
    join: document.getElementById('join-screen'),
    broadcast: document.getElementById('broadcast-screen')
};
const statusEl = document.getElementById('status');
const remoteAudio = document.getElementById('remote-audio');

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

function setStatus(msg) {
    statusEl.textContent = msg;
    console.log('[STATUS]', msg);
}

function randomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Main menu events

document.getElementById('create-room').onclick = () => {
    const code = randomCode();
    document.getElementById('room-code').textContent = code;
    currentRoom = code;
    isHost = true;
    showScreen('create');
};

document.getElementById('join-room').onclick = () => {
    showScreen('join');
};

document.getElementById('back-main-1').onclick = document.getElementById('back-main-2').onclick = () => {
    showScreen('main');
};

document.getElementById('copy-code').onclick = () => {
    const code = document.getElementById('room-code').textContent;
    navigator.clipboard.writeText(code).then(() => alert('הקוד הועתק!'));
};

document.getElementById('start-broadcast').onclick = async () => {
    await startBroadcast(currentRoom, true);
};

document.getElementById('join-confirm').onclick = async () => {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code) return alert('יש להזין קוד חדר');
    currentRoom = code;
    isHost = false;
    await startBroadcast(currentRoom, false);
};

document.getElementById('toggle-mic').onclick = () => {
    if (!localStream) return;
    const btn = document.getElementById('toggle-mic');
    const enabled = localStream.getAudioTracks()[0].enabled;
    localStream.getAudioTracks()[0].enabled = !enabled;
    btn.textContent = enabled ? 'הפעל מיקרופון' : 'השתק מיקרופון';
    setStatus(enabled ? 'המיקרופון מושתק' : 'המיקרופון פעיל');
};

document.getElementById('leave').onclick = () => {
    cleanup();
    showScreen('main');
};

// --- PeerJS Logic ---

async function startBroadcast(roomCode, host) {
    showScreen('broadcast');
    setStatus('מבקש הרשאה למיקרופון...');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatus('הרשאה התקבלה, פותח חיבור...');
    } catch (e) {
        setStatus('שגיאה בגישה למיקרופון');
        alert('לא ניתן לגשת למיקרופון.');
        return;
    }
    remoteAudio.srcObject = null;
    remoteAudio.pause();
    if (peer) peer.destroy();
    peer = null;
    call = null;
    if (host) {
        peer = new Peer(roomCode, { debug: 2 });
        peer.on('open', id => {
            setStatus('ממתין למשתתפים...');
        });
        peer.on('call', incomingCall => {
            setStatus('משדר...');
            incomingCall.answer(localStream);
            call = incomingCall;
            call.on('stream', stream => {
                remoteAudio.srcObject = stream;
                remoteAudio.play();
                setStatus('משדר ומאזין');
            });
            call.on('close', () => setStatus('החיבור נסגר'));
            call.on('error', err => setStatus('שגיאה בשידור: ' + err));
        });
        peer.on('error', err => setStatus('שגיאה: ' + err.type));
    } else {
        peer = new Peer(undefined, { debug: 2 });
        peer.on('open', id => {
            setStatus('מתחבר למנהל...');
            call = peer.call(roomCode, localStream);
            if (!call) {
                setStatus('לא נמצא מנהל עם קוד זה');
                return;
            }
            call.on('stream', stream => {
                remoteAudio.srcObject = stream;
                remoteAudio.play();
                setStatus('שומע את המנהל');
            });
            call.on('close', () => setStatus('החיבור נסגר'));
            call.on('error', err => setStatus('שגיאה בשידור: ' + err));
        });
        peer.on('error', err => setStatus('שגיאה: ' + err.type));
    }
}

function cleanup() {
    if (call) {
        call.close();
        call = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    remoteAudio.srcObject = null;
    setStatus('מנותק');
}

// בדיקה אוטומטית: מעבר מסכים, שידור, הצטרפות, השתקה, עזיבה, שגיאות
// ניתן להוסיף בדיקות נוספות כאן 