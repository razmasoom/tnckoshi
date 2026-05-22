const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// File-based storage
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file
if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
        users: [{
            id: '1',
            username: 'admin',
            password: bcrypt.hashSync('admin123', 10),
            fullName: 'Administrator',
            role: 'admin'
        }],
        grids: [
            { _id: '1', name: 'Grid Alpha', location: 'Substation A' },
            { _id: '2', name: 'Grid Beta', location: 'Substation B' }
        ],
        equipment: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

function readData() {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    jwt.verify(token, 'secret-key-2024', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Serve HTML file for root route - THIS IS THE FIX
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const data = readData();
    const user = data.users.find(u => u.username === username);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        'secret-key-2024',
        { expiresIn: '24h' }
    );
    
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        }
    });
});

// Get grids
app.get('/api/grids', authenticateToken, (req, res) => {
    const data = readData();
    res.json(data.grids);
});

// Add grid
app.post('/api/grids', authenticateToken, (req, res) => {
    const data = readData();
    const newGrid = {
        _id: Date.now().toString(),
        name: req.body.name,
        location: req.body.location || '',
        voltageLevel: req.body.voltageLevel || ''
    };
    data.grids.push(newGrid);
    writeData(data);
    res.status(201).json(newGrid);
});

// Delete grid
app.delete('/api/grids/:gridId', authenticateToken, (req, res) => {
    const data = readData();
    data.grids = data.grids.filter(g => g._id !== req.params.gridId);
    data.equipment = data.equipment.filter(e => e.gridId !== req.params.gridId);
    writeData(data);
    res.json({ message: 'Grid deleted' });
});

// Get equipment
app.get('/api/equipment/:gridId/:equipmentType', authenticateToken, (req, res) => {
    const data = readData();
    const equipment = data.equipment.filter(e => 
        e.gridId === req.params.gridId && e.equipmentType === req.params.equipmentType
    );
    res.json(equipment);
});

// Add equipment
app.post('/api/equipment', authenticateToken, (req, res) => {
    const data = readData();
    const newEquipment = {
        _id: Date.now().toString(),
        ...req.body,
        testValues: [],
        createdAt: new Date()
    };
    data.equipment.push(newEquipment);
    writeData(data);
    res.status(201).json(newEquipment);
});

// Update equipment
app.put('/api/equipment/:equipmentId', authenticateToken, (req, res) => {
    const data = readData();
    const index = data.equipment.findIndex(e => e._id === req.params.equipmentId);
    if (index !== -1) {
        data.equipment[index] = { ...data.equipment[index], ...req.body, lastTestDate: new Date() };
        writeData(data);
        res.json(data.equipment[index]);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Delete equipment
app.delete('/api/equipment/:equipmentId', authenticateToken, (req, res) => {
    const data = readData();
    data.equipment = data.equipment.filter(e => e._id !== req.params.equipmentId);
    writeData(data);
    res.json({ message: 'Equipment deleted' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('✅ SERVER RUNNING SUCCESSFULLY!');
    console.log('========================================');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔑 Login: admin / admin123`);
    console.log('========================================\n');
});