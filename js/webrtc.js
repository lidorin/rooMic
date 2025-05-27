let localStream = null;
let peer = null;
let conn = null;
let call = null;
let isHost = false;

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
    console.log('[STATUS]', status);
}

async function initializeWebRTC(roomCode) {
    isHost = localStorage.getItem('isHost') === 'true';
    updateConnectionStatus('מתחבר...');
    console.log('[INFO] Requesting microphone access...');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[SUCCESS] Microphone access granted');
    } catch (err) {
        updateConnectionStatus('שגיאה בגישה למיקרופון');
        alert('לא ניתן לגשת למיקרופון.');
        console.error('[ERROR] getUserMedia failed:', err);
        return;
    }

    if (isHost) {
        console.log('[INFO] Creating Peer as host with id:', roomCode);
        peer = new Peer(roomCode, { debug: 2 });
        peer.on('open', id => {
            updateConnectionStatus('ממתין למשתתפים...');
            console.log('[PEER OPEN] Host peer id:', id);
        });
        peer.on('call', incomingCall => {
            console.log('[CALL] Incoming call from:', incomingCall.peer);
            incomingCall.answer(localStream);
            updateConnectionStatus('משדר...');
            incomingCall.on('stream', remoteStream => {
                playRemoteAudio(remoteStream);
                console.log('[AUDIO] Playing remote stream');
            });
            call = incomingCall;
        });
        peer.on('error', err => {
            updateConnectionStatus('שגיאה: ' + err.type);
            console.error('[PEER ERROR]', err);
        });
    } else {
        console.log('[INFO] Creating Peer as guest');
        peer = new Peer(undefined, { debug: 2 });
        peer.on('open', id => {
            updateConnectionStatus('מתקשר למנהל...');
            console.log('[PEER OPEN] Guest peer id:', id);
            call = peer.call(roomCode, localStream);
            if (!call) {
                updateConnectionStatus('לא נמצא מנהל עם קוד זה');
                console.error('[ERROR] No call object returned');
                return;
            }
            call.on('stream', remoteStream => {
                playRemoteAudio(remoteStream);
                updateConnectionStatus('שומע את המנהל');
                console.log('[AUDIO] Playing remote stream');
            });
            call.on('error', err => {
                updateConnectionStatus('שגיאה בשיחה');
                console.error('[CALL ERROR]', err);
            });
        });
        peer.on('error', err => {
            updateConnectionStatus('שגיאה: ' + err.type);
            console.error('[PEER ERROR]', err);
        });
    }
}

function playRemoteAudio(stream) {
    let remoteAudio = document.getElementById('remote-audio');
    if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.id = 'remote-audio';
        remoteAudio.autoplay = true;
        document.body.appendChild(remoteAudio);
    }
    remoteAudio.srcObject = stream;
    console.log('[AUDIO] remoteAudio.srcObject set');
}

function toggleMicrophone(isMuted) {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMuted;
        });
        console.log('[MIC]', isMuted ? 'Muted' : 'Unmuted');
    }
}

function closeWebRTC() {
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
    updateConnectionStatus('מנותק');
    const remoteAudio = document.getElementById('remote-audio');
    if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.remove();
    }
    console.log('[CLEANUP] Closed all connections and streams');
} 