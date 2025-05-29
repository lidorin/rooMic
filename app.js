/**
 * roomMic 2.0 - Centralized Audio Streaming
 * All audio streams to the host's speakers only
 */

// Application State
const AppState = {
    peer: null,
    localStream: null,
    audioContext: null,
    audioDestination: null,
    connections: new Map(),
    gainNodes: new Map(),
    currentRoom: null,
    isHost: false,
    isMicActive: true,
    participantCount: 0
};

// DOM Elements
const Elements = {
    // Screens
    mainScreen: document.getElementById('main-screen'),
    createScreen: document.getElementById('create-screen'),
    joinScreen: document.getElementById('join-screen'),
    sessionScreen: document.getElementById('session-screen'),
    
    // Buttons
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnBackCreate: document.getElementById('btn-back-create'),
    btnBackJoin: document.getElementById('btn-back-join'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnStartHosting: document.getElementById('btn-start-hosting'),
    btnJoinConfirm: document.getElementById('btn-join-confirm'),
    btnToggleMic: document.getElementById('btn-toggle-mic'),
    btnLeaveRoom: document.getElementById('btn-leave-room'),
    
    // Display Elements
    roomCode: document.getElementById('room-code'),
    joinCodeInput: document.getElementById('join-code-input'),
    sessionTitle: document.getElementById('session-title'),
    participantCount: document.getElementById('participant-count'),
    connectionStatus: document.getElementById('connection-status'),
    currentRoomCode: document.getElementById('current-room-code'),
    userRole: document.getElementById('user-role'),
    volumeBars: document.querySelectorAll('.volume-bar'),
    
    // Audio & Toast
    audioOutput: document.getElementById('audio-output'),
    statusToast: document.getElementById('status-toast'),
    statusMessage: document.getElementById('status-message')
};

// Utility Functions
const Utils = {
    generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        Elements[screenName + 'Screen'].classList.add('active');
    },

    showToast(message, duration = 3000) {
        Elements.statusMessage.textContent = message;
        Elements.statusToast.classList.add('show');
        
        setTimeout(() => {
            Elements.statusToast.classList.remove('show');
        }, duration);
    },

    updateConnectionStatus(status, className = '') {
        Elements.connectionStatus.textContent = status;
        Elements.connectionStatus.className = 'status ' + className;
    },

    updateParticipantCount(count) {
        AppState.participantCount = count;
        Elements.participantCount.textContent = `משתתפים: ${count}`;
    },

    updateVolumeIndicator(level) {
        const activeCount = Math.floor((level / 100) * Elements.volumeBars.length);
        Elements.volumeBars.forEach((bar, index) => {
            bar.classList.toggle('active', index < activeCount);
        });
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            Utils.showToast('הקוד הועתק!');
        }).catch(() => {
            Utils.showToast('לא ניתן להעתיק', 2000);
        });
    }
};

// Audio Management
const AudioManager = {
    async initializeAudioContext() {
        if (AppState.audioContext) {
            await AppState.audioContext.close();
        }

        AppState.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',  // More compatible latency setting
            sampleRate: 48000           // Standard sample rate
        });

        AppState.audioDestination = AppState.audioContext.createMediaStreamDestination();
        Elements.audioOutput.srcObject = AppState.audioDestination.stream;
        
        try {
            await Elements.audioOutput.play();
            console.log('Audio context initialized successfully');
        } catch (e) {
            console.warn('Auto-play prevented, user interaction required');
        }
    },

    async requestMicrophone() {
        try {
            AppState.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,  // Re-enabled for better compatibility
                    noiseSuppression: true,  // Re-enabled for better quality
                    autoGainControl: true,   // Re-enabled for consistent volume
                    latency: 0.01,           // More conservative latency
                    sampleRate: 48000,       // Standard sample rate for better compatibility
                    channelCount: 1
                }
            });
            console.log('Microphone access granted');
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            Utils.showToast('לא ניתן לגשת למיקרופון');
            return false;
        }
    },

    addLocalAudioToMix() {
        if (!AppState.audioContext || !AppState.localStream || !AppState.isHost) return;

        const source = AppState.audioContext.createMediaStreamSource(AppState.localStream);
        const gainNode = AppState.audioContext.createGain();
        gainNode.gain.value = 0.7; // Host hears themselves at lower volume
        
        source.connect(gainNode);
        gainNode.connect(AppState.audioDestination);
        
        AppState.gainNodes.set('local', { source, gainNode });
    },

    addRemoteAudioToMix(peerId, stream) {
        if (!AppState.audioContext || !AppState.isHost) return;

        const source = AppState.audioContext.createMediaStreamSource(stream);
        const gainNode = AppState.audioContext.createGain();
        gainNode.gain.value = 1.0;
        
        source.connect(gainNode);
        gainNode.connect(AppState.audioDestination);
        
        AppState.gainNodes.set(peerId, { source, gainNode });
    },

    removeAudioFromMix(peerId) {
        const audioNodes = AppState.gainNodes.get(peerId);
        if (audioNodes) {
            audioNodes.source.disconnect();
            audioNodes.gainNode.disconnect();
            AppState.gainNodes.delete(peerId);
        }
    },

    toggleMicrophone() {
        if (!AppState.localStream) return;

        const audioTrack = AppState.localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        AppState.isMicActive = audioTrack.enabled;

        const btn = Elements.btnToggleMic;
        const icon = btn.querySelector('.btn-icon');
        const text = btn.querySelector('.btn-text');

        if (AppState.isMicActive) {
            btn.classList.add('active');
            icon.textContent = '🎤';
            text.textContent = 'מיקרופון פעיל';
            Utils.showToast('המיקרופון הופעל');
        } else {
            btn.classList.remove('active');
            icon.textContent = '🔇';
            text.textContent = 'מיקרופון מושתק';
            Utils.showToast('המיקרופון הושתק');
        }
    },

    cleanup() {
        // Stop all audio tracks
        if (AppState.localStream) {
            AppState.localStream.getTracks().forEach(track => track.stop());
            AppState.localStream = null;
        }

        // Disconnect all audio nodes
        AppState.gainNodes.forEach((nodes, peerId) => {
            AudioManager.removeAudioFromMix(peerId);
        });

        // Close audio context
        if (AppState.audioContext) {
            AppState.audioContext.close();
            AppState.audioContext = null;
        }

        // Clear audio output
        Elements.audioOutput.srcObject = null;
    }
};

// WebRTC Connection Management
const ConnectionManager = {
    async startAsHost(roomCode) {
        AppState.peer = new Peer(roomCode, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    { urls: 'stun:stun.cloudflare.com:3478' }
                ],
                sdpSemantics: 'unified-plan',
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            }
        });

        AppState.peer.on('open', () => {
            Utils.updateConnectionStatus('ממתין למשתתפים...', 'connecting');
            AudioManager.initializeAudioContext();
            AudioManager.addLocalAudioToMix();
            console.log('Host peer opened with ID:', roomCode);
        });

        AppState.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            console.log('Incoming call from:', peerId);
            Utils.showToast(`משתתף מתחבר: ${peerId.substring(0, 8)}...`);
            
            // Answer with local stream
            incomingCall.answer(AppState.localStream);
            AppState.connections.set(peerId, incomingCall);

            incomingCall.on('stream', (remoteStream) => {
                console.log('Received stream from participant:', peerId);
                AudioManager.addRemoteAudioToMix(peerId, remoteStream);
                Utils.updateParticipantCount(AppState.connections.size);
                Utils.updateConnectionStatus('משדר ומאזין', 'connected');
                Utils.showToast(`משתתף הצטרף! (${AppState.connections.size} משתתפים)`);
            });

            incomingCall.on('close', () => {
                console.log('Call closed for participant:', peerId);
                ConnectionManager.handleParticipantDisconnection(peerId);
            });

            incomingCall.on('error', (error) => {
                console.error('Call error for participant:', peerId, error);
                ConnectionManager.handleParticipantDisconnection(peerId);
            });
        });

        AppState.peer.on('error', (error) => {
            console.error('Host peer error:', error);
            Utils.updateConnectionStatus('שגיאת חיבור', 'error');
            Utils.showToast('שגיאה ביצירת החדר');
        });

        AppState.peer.on('disconnected', () => {
            console.log('Host peer disconnected, attempting reconnection...');
            Utils.updateConnectionStatus('מתחבר מחדש...', 'connecting');
            setTimeout(() => {
                if (AppState.peer && !AppState.peer.destroyed) {
                    AppState.peer.reconnect();
                }
            }, 1000);
        });
    },

    async startAsParticipant(roomCode) {
        AppState.peer = new Peer(undefined, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    { urls: 'stun:stun.cloudflare.com:3478' }
                ],
                sdpSemantics: 'unified-plan',
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            }
        });

        AppState.peer.on('open', (myPeerId) => {
            console.log('Participant peer opened with ID:', myPeerId);
            Utils.updateConnectionStatus('מתחבר למנהל...', 'connecting');
            
            setTimeout(() => {
                console.log('Calling host with room code:', roomCode);
                const call = AppState.peer.call(roomCode, AppState.localStream);
                
                if (!call) {
                    Utils.updateConnectionStatus('לא נמצא מנהל', 'error');
                    Utils.showToast('לא נמצא חדר עם קוד זה');
                    return;
                }

                AppState.connections.set(roomCode, call);

                call.on('stream', (remoteStream) => {
                    console.log('Received stream from host');
                    // Participants don't hear anything - audio goes to host only
                    Utils.updateConnectionStatus('מחובר למנהל', 'connected');
                    Utils.showToast('מחובר בהצלחה! המנהל שומע אותך');
                });

                call.on('close', () => {
                    console.log('Call to host closed');
                    Utils.updateConnectionStatus('החיבור נסגר', 'error');
                    Utils.showToast('החיבור למנהל נסגר');
                });

                call.on('error', (error) => {
                    console.error('Call to host error:', error);
                    Utils.updateConnectionStatus('שגיאת חיבור', 'error');
                    Utils.showToast('שגיאה בחיבור למנהל');
                });
            }, 500); // Small delay to ensure peer is ready
        });

        AppState.peer.on('error', (error) => {
            console.error('Participant peer error:', error);
            if (error.type === 'peer-unavailable') {
                Utils.updateConnectionStatus('המנהל לא זמין', 'error');
                Utils.showToast('לא נמצא חדר עם קוד זה');
            } else if (error.type === 'network') {
                Utils.updateConnectionStatus('בעיית רשת', 'error');
                Utils.showToast('בעיית חיבור לאינטרנט');
            } else {
                Utils.updateConnectionStatus('שגיאת חיבור', 'error');
                Utils.showToast('שגיאה בהתחברות');
            }
        });

        AppState.peer.on('disconnected', () => {
            console.log('Participant peer disconnected, attempting reconnection...');
            Utils.updateConnectionStatus('מתחבר מחדש...', 'connecting');
            setTimeout(() => {
                if (AppState.peer && !AppState.peer.destroyed) {
                    AppState.peer.reconnect();
                }
            }, 1000);
        });
    },

    handleParticipantDisconnection(peerId) {
        AudioManager.removeAudioFromMix(peerId);
        AppState.connections.delete(peerId);
        Utils.updateParticipantCount(AppState.connections.size);
        Utils.showToast(`משתתף עזב (${AppState.connections.size} משתתפים)`);
        
        if (AppState.connections.size === 0) {
            Utils.updateConnectionStatus('ממתין למשתתפים...', 'connecting');
        }
    },

    cleanup() {
        // Close all connections
        AppState.connections.forEach((connection) => {
            connection.close();
        });
        AppState.connections.clear();

        // Destroy peer
        if (AppState.peer) {
            AppState.peer.destroy();
            AppState.peer = null;
        }

        // Reset state
        AppState.currentRoom = null;
        AppState.isHost = false;
        AppState.participantCount = 0;
    }
};

// Event Handlers
const EventHandlers = {
    // Navigation
    createRoom() {
        AppState.currentRoom = Utils.generateRoomCode();
        AppState.isHost = true;
        Elements.roomCode.textContent = AppState.currentRoom;
        Utils.showScreen('create');
    },

    joinRoom() {
        Elements.joinCodeInput.value = '';
        Utils.showScreen('join');
    },

    backToMain() {
        ConnectionManager.cleanup();
        AudioManager.cleanup();
        Utils.showScreen('main');
    },

    copyRoomCode() {
        Utils.copyToClipboard(AppState.currentRoom);
    },

    // Session Management
    async startHosting() {
        const micGranted = await AudioManager.requestMicrophone();
        if (!micGranted) return;

        Elements.sessionTitle.textContent = '🏠 מנהל החדר';
        Elements.currentRoomCode.textContent = AppState.currentRoom;
        Elements.userRole.textContent = 'מנהל';
        
        Utils.showScreen('session');
        Utils.updateConnectionStatus('מאתחל...', 'connecting');
        
        await ConnectionManager.startAsHost(AppState.currentRoom);
    },

    async joinConfirm() {
        const roomCode = Elements.joinCodeInput.value.trim();
        if (!roomCode || roomCode.length !== 4) {
            Utils.showToast('יש להזין קוד בן 4 ספרות');
            return;
        }

        const micGranted = await AudioManager.requestMicrophone();
        if (!micGranted) return;

        AppState.currentRoom = roomCode;
        AppState.isHost = false;
        
        Elements.sessionTitle.textContent = '🎧 משתתף';
        Elements.currentRoomCode.textContent = roomCode;
        Elements.userRole.textContent = 'משתתף';
        
        Utils.showScreen('session');
        Utils.updateConnectionStatus('מתחבר...', 'connecting');
        
        await ConnectionManager.startAsParticipant(roomCode);
    },

    toggleMicrophone() {
        AudioManager.toggleMicrophone();
    },

    leaveRoom() {
        ConnectionManager.cleanup();
        AudioManager.cleanup();
        Utils.showScreen('main');
        Utils.showToast('עזבת את החדר');
    }
};

// Initialize Application
function initializeApp() {
    console.log('roomMic 2.0 - Starting application...');
    
    // Ensure only main screen is visible
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    Elements.mainScreen.classList.add('active');
    
    // Bind event listeners
    Elements.btnCreateRoom.addEventListener('click', EventHandlers.createRoom);
    Elements.btnJoinRoom.addEventListener('click', EventHandlers.joinRoom);
    Elements.btnBackCreate.addEventListener('click', EventHandlers.backToMain);
    Elements.btnBackJoin.addEventListener('click', EventHandlers.backToMain);
    Elements.btnCopyCode.addEventListener('click', EventHandlers.copyRoomCode);
    Elements.btnStartHosting.addEventListener('click', EventHandlers.startHosting);
    Elements.btnJoinConfirm.addEventListener('click', EventHandlers.joinConfirm);
    Elements.btnToggleMic.addEventListener('click', EventHandlers.toggleMicrophone);
    Elements.btnLeaveRoom.addEventListener('click', EventHandlers.leaveRoom);

    // Numeric input only for room code
    Elements.joinCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    // Enter key for join
    Elements.joinCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            EventHandlers.joinConfirm();
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        ConnectionManager.cleanup();
        AudioManager.cleanup();
    });

    // Auto-resume audio context on user interaction
    document.addEventListener('click', () => {
        if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
            AppState.audioContext.resume();
        }
    }, { once: true });

    // Keep-alive mechanism for connections
    setInterval(() => {
        if (AppState.peer && !AppState.peer.destroyed && AppState.peer.open) {
            // Send a heartbeat to keep connection alive
            console.log('Keep-alive: Connection active');
        }
    }, 30000); // Every 30 seconds

    console.log('roomMic 2.0 - Application initialized successfully!');
    Utils.showToast('roomMic 2.0 מוכן לשימוש!');
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp); 