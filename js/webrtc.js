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
}

async function initializeWebRTC(roomCode) {
    isHost = localStorage.getItem('isHost') === 'true';
    updateConnectionStatus('מתחבר...');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        updateConnectionStatus('שגיאה בגישה למיקרופון');
        alert('לא ניתן לגשת למיקרופון.');
        return;
    }

    if (isHost) {
        // המנהל יוצר peer עם קוד החדר
        peer = new Peer(roomCode, { debug: 2 });
        peer.on('open', id => {
            updateConnectionStatus('ממתין למשתתפים...');
        });
        peer.on('call', incomingCall => {
            // משתתף מתקשר אלינו
            incomingCall.answer(localStream);
            updateConnectionStatus('משדר...');
            incomingCall.on('stream', remoteStream => {
                playRemoteAudio(remoteStream);
            });
            call = incomingCall;
        });
        peer.on('error', err => {
            updateConnectionStatus('שגיאה: ' + err.type);
        });
    } else {
        // משתתף יוצר peer עם id אקראי ומתקשר למנהל
        peer = new Peer(undefined, { debug: 2 });
        peer.on('open', id => {
            updateConnectionStatus('מתקשר למנהל...');
            call = peer.call(roomCode, localStream);
            if (!call) {
                updateConnectionStatus('לא נמצא מנהל עם קוד זה');
                return;
            }
            call.on('stream', remoteStream => {
                playRemoteAudio(remoteStream);
                updateConnectionStatus('שומע את המנהל');
            });
            call.on('error', err => {
                updateConnectionStatus('שגיאה בשיחה');
            });
        });
        peer.on('error', err => {
            updateConnectionStatus('שגיאה: ' + err.type);
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
}

function toggleMicrophone(isMuted) {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMuted;
        });
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
    // הסר אודיו מרחוק אם קיים
    const remoteAudio = document.getElementById('remote-audio');
    if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.remove();
    }
} 