// PeerJS + UI logic for roomMic - Multi-participant support
let peer = null;
let localStream = null;
let isHost = false;
let currentRoom = null;
let connections = new Map(); // Map of peer connections
let audioContext = null;
let audioDestination = null;
let localAudioSource = null;
let gainNodes = new Map(); // For volume control

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
    // Return a string of 4 random digits
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Audio mixing setup - ULTRA LOW LATENCY VERSION
function initAudioContext() {
    if (audioContext) {
        audioContext.close();
    }
    
    // Ultra-low latency audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 0.003,        // 3ms target latency
        sampleRate: 96000,         // Higher sample rate for better precision
        bufferSize: 64             // Smallest possible buffer
    });
    
    audioDestination = audioContext.createMediaStreamDestination();
    
    if (localStream && isHost) {
        localAudioSource = audioContext.createMediaStreamSource(localStream);
        const localGain = audioContext.createGain();
        localGain.gain.value = 0.7; // Slightly lower volume for self
        localAudioSource.connect(localGain);
        localGain.connect(audioDestination);
    }
    
    remoteAudio.srcObject = audioDestination.stream;
    remoteAudio.play().catch(e => console.log('Auto-play prevented:', e));
}

function addRemoteStream(peerId, stream) {
    if (!audioContext) initAudioContext();
    
    const source = audioContext.createMediaStreamSource(stream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;
    
    source.connect(gainNode);
    gainNode.connect(audioDestination);
    
    gainNodes.set(peerId, { source, gainNode });
    
    setStatus(`משתתף חדש הצטרף (${connections.size} משתתפים)`);
}

function removeRemoteStream(peerId) {
    const audioNodes = gainNodes.get(peerId);
    if (audioNodes) {
        audioNodes.source.disconnect();
        audioNodes.gainNode.disconnect();
        gainNodes.delete(peerId);
    }
    
    setStatus(`משתתף עזב (${connections.size} משתתפים)`);
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
    cleanup();
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

// --- Enhanced PeerJS Logic for Multiple Participants ---

async function startBroadcast(roomCode, host) {
    showScreen('broadcast');
    setStatus('מבקש הרשאה למיקרופון...');
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,    // Disabled for minimal processing
                noiseSuppression: false,    // Disabled for minimal processing
                autoGainControl: false,     // Disabled for minimal processing
                latency: 0.003,             // 3ms ultra-low latency
                googLatency: 0.003,         // Chrome-specific ultra-low
                googAutoGainControl: false,
                googEchoCancellation: false,
                googNoiseSuppression: false,
                sampleRate: 96000,          // Higher precision
                sampleSize: 16,             // Standard bit depth
                channelCount: 1,            // Mono for speed
                volume: 1.0,
                googHighpassFilter: false,  // Disable extra processing
                googTypingNoiseDetection: false
            }
        });
        setStatus('הרשאה התקבלה, פותח חיבור...');
    } catch (e) {
        setStatus('שגיאה בגישה למיקרופון');
        alert('לא ניתן לגשת למיקרופון. אנא בדוק את הגדרות הדפדפן.');
        return;
    }

    // Clean up previous connections
    cleanup();
    
    if (host) {
        await startAsHost(roomCode);
    } else {
        await startAsParticipant(roomCode);
    }
}

async function startAsHost(roomCode) {
    peer = new Peer(roomCode, {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            sdpSemantics: 'unified-plan',
            maxBandwidth: 320000,
            minBandwidth: 128000,
            codec: 'opus',
            frameDuration: 10,          // 10ms frames instead of 20ms
            jitterBufferMinDelayMs: 0,  // No jitter buffer delay
            jitterBufferMaxDelayMs: 10, // Max 10ms jitter buffer
            googCpuOveruseDetection: false,
            googSuspendBelowMinBitrate: false
        }
    });

    peer.on('open', id => {
        setStatus('ממתין למשתתפים...');
        initAudioContext(); // Initialize audio mixing
    });

    peer.on('call', incomingCall => {
        const peerId = incomingCall.peer;
        setStatus(`משתתף מתחבר: ${peerId}`);
        
        // Answer the call with our local stream
        incomingCall.answer(localStream);
        
        // Store the connection
        connections.set(peerId, incomingCall);
        
        incomingCall.on('stream', stream => {
            addRemoteStream(peerId, stream);
        });
        
        incomingCall.on('close', () => {
            removeRemoteStream(peerId);
            connections.delete(peerId);
        });
        
        incomingCall.on('error', err => {
            console.error('Call error:', err);
            removeRemoteStream(peerId);
            connections.delete(peerId);
        });
    });

    peer.on('error', err => {
        setStatus('שגיאה: ' + err.type);
        console.error('Peer error:', err);
    });

    peer.on('disconnected', () => {
        setStatus('החיבור נותק - מנסה להתחבר מחדש...');
        peer.reconnect();
    });
}

async function startAsParticipant(roomCode) {
    peer = new Peer(undefined, {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            sdpSemantics: 'unified-plan',
            // Ultra-low latency WebRTC settings
            maxBandwidth: 320000,
            minBandwidth: 128000,
            codec: 'opus',
            frameDuration: 10,          // 10ms frames instead of 20ms
            jitterBufferMinDelayMs: 0,  // No jitter buffer delay
            jitterBufferMaxDelayMs: 10, // Max 10ms jitter buffer
            googCpuOveruseDetection: false,
            googSuspendBelowMinBitrate: false
        }
    });

    peer.on('open', id => {
        setStatus('מתחבר למנהל...');
        
        // Call the host
        const call = peer.call(roomCode, localStream);
        
        if (!call) {
            setStatus('לא נמצא מנהל עם קוד זה');
            return;
        }
        
        connections.set(roomCode, call);
        
        call.on('stream', stream => {
            // Participants hear only the mixed audio from host
            remoteAudio.srcObject = stream;
            remoteAudio.play().catch(e => console.log('Auto-play prevented:', e));
            setStatus('מחובר ושומע');
        });
        
        call.on('close', () => {
            setStatus('החיבור למנהל נסגר');
        });
        
        call.on('error', err => {
            setStatus('שגיאה בחיבור למנהל: ' + err);
            console.error('Call error:', err);
        });
    });

    peer.on('error', err => {
        setStatus('שגיאה: ' + err.type);
        console.error('Peer error:', err);
        
        if (err.type === 'peer-unavailable') {
            setStatus('המנהל לא זמין - אנא בדוק את הקוד');
        }
    });
}

function cleanup() {
    // Close all connections
    connections.forEach((connection, peerId) => {
        connection.close();
        removeRemoteStream(peerId);
    });
    connections.clear();
    
    // Clean up peer
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    // Clean up audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clean up audio elements
    if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.pause();
    }
    
    // Reset variables
    localAudioSource = null;
    audioDestination = null;
    gainNodes.clear();
    
    setStatus('מנותק');
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Auto-resume audio context on user interaction
document.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: true }); 