const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// נתיב לקובץ ה-JSON
const ROOMS_FILE = path.join(__dirname, 'rooms.json');

// פונקציות עזר
function loadRooms() {
    try {
        if (fs.existsSync(ROOMS_FILE)) {
            const data = fs.readFileSync(ROOMS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
    return { rooms: {} };
}

function saveRooms(rooms) {
    try {
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
    } catch (error) {
        console.error('Error saving rooms:', error);
    }
}

// נקודות קצה
app.post('/api/rooms/create', (req, res) => {
    const { code } = req.body;
    const rooms = loadRooms();
    
    if (rooms.rooms[code]) {
        return res.status(400).json({ error: 'Room already exists' });
    }
    
    rooms.rooms[code] = {
        createdAt: new Date().toISOString(),
        isActive: true,
        participants: []
    };
    
    saveRooms(rooms);
    res.json({ success: true });
});

app.get('/api/rooms/:code', (req, res) => {
    const { code } = req.params;
    const rooms = loadRooms();
    
    if (!rooms.rooms[code] || !rooms.rooms[code].isActive) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({ success: true });
});

app.post('/api/rooms/:code/leave', (req, res) => {
    const { code } = req.params;
    const { isHost } = req.body;
    const rooms = loadRooms();
    
    if (!rooms.rooms[code]) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    if (isHost) {
        // אם המארח עוזב, נסגור את החדר
        delete rooms.rooms[code];
    } else {
        // אם משתתף רגיל עוזב, רק נעדכן את רשימת המשתתפים
        rooms.rooms[code].participants = rooms.rooms[code].participants.filter(p => p !== req.ip);
    }
    
    saveRooms(rooms);
    res.json({ success: true });
});

app.post('/api/rooms/:code/offer', (req, res) => {
    const { code } = req.params;
    const { offer } = req.body;
    const rooms = loadRooms();
    
    if (!rooms.rooms[code]) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    // שמירת ההצעה בחדר
    rooms.rooms[code].offer = offer;
    saveRooms(rooms);
    
    res.json({ success: true });
});

app.post('/api/rooms/:code/answer', (req, res) => {
    const { code } = req.params;
    const { answer } = req.body;
    const rooms = loadRooms();
    
    if (!rooms.rooms[code]) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    // שמירת התשובה בחדר
    rooms.rooms[code].answer = answer;
    saveRooms(rooms);
    
    res.json({ success: true });
});

app.post('/api/rooms/:code/ice', (req, res) => {
    const { code } = req.params;
    const { candidate } = req.body;
    const rooms = loadRooms();
    
    if (!rooms.rooms[code]) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    // שמירת ה-ICE candidate בחדר
    if (!rooms.rooms[code].iceCandidates) {
        rooms.rooms[code].iceCandidates = [];
    }
    rooms.rooms[code].iceCandidates.push(candidate);
    saveRooms(rooms);
    
    res.json({ success: true });
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 