let localStream = null;
let peerConnection = null;
let isHost = false;

async function initializeWebRTC(roomCode) {
    try {
        // קבלת הרשאות למיקרופון
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // יצירת חיבור WebRTC
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        
        peerConnection = new RTCPeerConnection(configuration);
        
        // הוספת הסטרים המקומי
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // טיפול באירועי ICE
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                // שליחת המועמד לשרת
                sendIceCandidate(event.candidate, roomCode);
            }
        };

        // טיפול בסטרים מרוחק
        peerConnection.ontrack = event => {
            const remoteAudio = new Audio();
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play();
        };

        // אם אנחנו המארח, ניצור הצעה
        if (isHost) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            // שליחת ההצעה לשרת
            sendOffer(offer, roomCode);
        }

        updateConnectionStatus('מחובר');
    } catch (error) {
        console.error('Error initializing WebRTC:', error);
        updateConnectionStatus('שגיאה בחיבור');
    }
}

function toggleMicrophone(isMuted) {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMuted;
        });
    }
}

function closeWebRTC() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    localStream = null;
    peerConnection = null;
    updateConnectionStatus('מנותק');
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// פונקציות תקשורת עם השרת
async function sendOffer(offer, roomCode) {
    try {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/offer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ offer })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send offer');
        }
    } catch (error) {
        console.error('Error sending offer:', error);
        updateConnectionStatus('שגיאה בשליחת הצעה');
    }
}

async function sendIceCandidate(candidate, roomCode) {
    try {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/ice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ candidate })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send ICE candidate');
        }
    } catch (error) {
        console.error('Error sending ICE candidate:', error);
    }
}

// פונקציה לקבלת הצעה מהשרת
async function handleOffer(offer, roomCode) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // שליחת התשובה לשרת
        const response = await fetch(`${API_URL}/rooms/${roomCode}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answer })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send answer');
        }
    } catch (error) {
        console.error('Error handling offer:', error);
        updateConnectionStatus('שגיאה בטיפול בהצעה');
    }
}

// פונקציה לקבלת ICE candidate מהשרת
async function handleIceCandidate(candidate) {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
} 