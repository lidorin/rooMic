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
                // שמירת המועמד ב-localStorage
                const candidates = JSON.parse(localStorage.getItem('iceCandidates') || '[]');
                candidates.push(event.candidate);
                localStorage.setItem('iceCandidates', JSON.stringify(candidates));
            }
        };

        // טיפול בסטרים מרוחק
        peerConnection.ontrack = event => {
            const remoteAudio = new Audio();
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play();
        };

        // אם אנחנו המארח, ניצור הצעה
        if (localStorage.getItem('isHost') === 'true') {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            // שמירת ההצעה ב-localStorage
            localStorage.setItem('offer', JSON.stringify(offer));
        } else {
            // אם אנחנו משתתף, נחכה להצעה
            const checkForOffer = setInterval(async () => {
                const offer = JSON.parse(localStorage.getItem('offer'));
                if (offer) {
                    clearInterval(checkForOffer);
                    await handleOffer(offer);
                }
            }, 1000);
        }

        // בדיקת ICE candidates חדשים
        const checkForCandidates = setInterval(async () => {
            const candidates = JSON.parse(localStorage.getItem('iceCandidates') || '[]');
            if (candidates.length > 0) {
                for (const candidate of candidates) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
                localStorage.setItem('iceCandidates', '[]');
            }
        }, 1000);

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

// פונקציה לקבלת הצעה
async function handleOffer(offer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // שמירת התשובה ב-localStorage
        localStorage.setItem('answer', JSON.stringify(answer));
    } catch (error) {
        console.error('Error handling offer:', error);
        updateConnectionStatus('שגיאה בטיפול בהצעה');
    }
} 