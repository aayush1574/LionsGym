const express = require('express');
const { getOne, getAll, runQuery } = require('../db/database');
const { authenticateToken, requireUser } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken, requireUser);

// GET /api/user/profile - Get own profile + active membership
router.get('/profile', (req, res) => {
    try {
        const user = getOne('SELECT id, name, email, phone, gender, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const membership = getOne(
            'SELECT * FROM memberships WHERE user_id = ? ORDER BY end_date DESC LIMIT 1',
            [req.user.id]
        );

        const attendanceCount = getOne(
            'SELECT COUNT(*) as count FROM attendance WHERE user_id = ?',
            [req.user.id]
        ).count;

        const thisMonthAttendance = getOne(
            "SELECT COUNT(*) as count FROM attendance WHERE user_id = ? AND date >= DATE('now', 'start of month')",
            [req.user.id]
        ).count;

        res.json({ user, membership, attendanceCount, thisMonthAttendance });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/user/attendance - Mark today's attendance
router.post('/attendance', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const existing = getOne('SELECT id FROM attendance WHERE user_id = ? AND date = ?', [req.user.id, today]);
        if (existing) {
            return res.status(409).json({ error: 'Attendance already marked for today.' });
        }

        // Check if user has active membership
        const activeMembership = getOne(
            "SELECT id FROM memberships WHERE user_id = ? AND end_date >= DATE('now') AND payment_status = 'paid'",
            [req.user.id]
        );

        if (!activeMembership) {
            return res.status(403).json({ error: 'No active membership found. Please contact admin.' });
        }

        runQuery('INSERT INTO attendance (user_id, date) VALUES (?, ?)', [req.user.id, today]);

        res.status(201).json({ message: 'Attendance marked successfully!', date: today });
    } catch (err) {
        console.error('Attendance error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/user/attendance - Get attendance history
router.get('/attendance', (req, res) => {
    try {
        const attendance = getAll(
            'SELECT date, check_in_time FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 90',
            [req.user.id]
        );

        res.json(attendance);
    } catch (err) {
        console.error('Get attendance error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/user/progress - Log progress entry
router.post('/progress', (req, res) => {
    try {
        const { weight, chest, waist, biceps, thighs, shoulders, notes } = req.body;
        const today = new Date().toISOString().split('T')[0];

        const result = runQuery(
            'INSERT INTO progress (user_id, date, weight, chest, waist, biceps, thighs, shoulders, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, today, weight, chest, waist, biceps, thighs, shoulders, notes]
        );

        res.status(201).json({ id: result.lastId, message: 'Progress logged successfully!' });
    } catch (err) {
        console.error('Progress error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/user/progress - Get progress history
router.get('/progress', (req, res) => {
    try {
        const progress = getAll(
            'SELECT * FROM progress WHERE user_id = ? ORDER BY date DESC LIMIT 50',
            [req.user.id]
        );

        res.json(progress);
    } catch (err) {
        console.error('Get progress error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
