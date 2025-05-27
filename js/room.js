// ניהול מצב החדר
let currentRoom = null;
let isHost = false;

// פונקציות ניהול חדר
function setCurrentRoom(roomCode, host = false) {
    currentRoom = roomCode;
    isHost = host;
}

function getCurrentRoom() {
    return currentRoom;
}

function isRoomHost() {
    return isHost;
}

function clearCurrentRoom() {
    currentRoom = null;
    isHost = false;
}

// פונקציות תקשורת עם השרת
async function createRoom(roomCode) {
    try {
        const response = await fetch(`${API_URL}/rooms/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: roomCode })
        });
        
        if (response.ok) {
            setCurrentRoom(roomCode, true);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error creating room:', error);
        return false;
    }
}

async function joinRoom(roomCode) {
    try {
        const response = await fetch(`${API_URL}/rooms/${roomCode}`);
        if (response.ok) {
            setCurrentRoom(roomCode, false);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error joining room:', error);
        return false;
    }
}

async function leaveRoom() {
    if (!currentRoom) return;
    
    try {
        const response = await fetch(`${API_URL}/rooms/${currentRoom}/leave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isHost })
        });
        
        if (response.ok) {
            clearCurrentRoom();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error leaving room:', error);
        return false;
    }
}

// פונקציות עזר
function validateRoomCode(code) {
    return /^\d{4}$/.test(code);
}

// ייצוא הפונקציות
window.roomManager = {
    createRoom,
    joinRoom,
    leaveRoom,
    getCurrentRoom,
    isRoomHost,
    validateRoomCode
}; 