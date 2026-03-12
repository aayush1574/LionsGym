const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, getAll, runQuery } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, requireAdmin);

// GET /api/admin/dashboard - Summary stats
router.get('/dashboard', (req, res) => {
    try {
        const totalMembers = getOne("SELECT COUNT(*) as count FROM users WHERE role = 'user'").count;
        const activeMembers = getOne(`
      SELECT COUNT(DISTINCT user_id) as count FROM memberships 
      WHERE end_date >= DATE('now') AND payment_status = 'paid'
    `).count;
        const pendingPayments = getOne(`
      SELECT COUNT(*) as count FROM memberships 
      WHERE payment_status IN ('pending', 'partial')
    `).count;
        const todayAttendance = getOne(`
      SELECT COUNT(*) as count FROM attendance WHERE date = DATE('now')
    `).count;
        const expiringThisWeek = getOne(`
      SELECT COUNT(*) as count FROM memberships 
      WHERE end_date BETWEEN DATE('now') AND DATE('now', '+7 days')
    `).count;
        const totalRevenue = getOne(`
      SELECT COALESCE(SUM(amount), 0) as total FROM memberships WHERE payment_status = 'paid'
    `).total;

        res.json({
            totalMembers,
            activeMembers,
            pendingPayments,
            todayAttendance,
            expiringThisWeek,
            totalRevenue
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/dashboard/filter/:type - Get filtered members list
router.get('/dashboard/filter/:type', (req, res) => {
    try {
        let members = [];
        const type = req.params.type;

        switch (type) {
            case 'total':
                members = getAll(`
                    SELECT u.id, u.name, u.email, u.phone, m.plan_type, m.end_date, m.payment_status
                    FROM users u
                    LEFT JOIN (SELECT * FROM memberships WHERE id IN (SELECT MAX(id) FROM memberships GROUP BY user_id)) m ON u.id = m.user_id
                    WHERE u.role = 'user' ORDER BY u.name
                `);
                break;
            case 'active':
                members = getAll(`
                    SELECT u.id, u.name, u.email, u.phone, m.plan_type, m.end_date, m.payment_status
                    FROM users u
                    JOIN memberships m ON u.id = m.user_id
                    WHERE u.role = 'user' AND m.end_date >= DATE('now') AND m.payment_status = 'paid'
                    AND m.id IN (SELECT MAX(id) FROM memberships GROUP BY user_id)
                    ORDER BY m.end_date
                `);
                break;
            case 'pending':
                members = getAll(`
                    SELECT u.id, u.name, u.email, u.phone, m.plan_type, m.end_date, m.payment_status
                    FROM users u
                    JOIN memberships m ON u.id = m.user_id
                    WHERE m.payment_status IN ('pending', 'partial')
                    AND m.id IN (SELECT MAX(id) FROM memberships GROUP BY user_id)
                    ORDER BY u.name
                `);
                break;
            case 'expiring':
                members = getAll(`
                    SELECT u.id, u.name, u.email, u.phone, m.plan_type, m.end_date, m.payment_status
                    FROM users u
                    JOIN memberships m ON u.id = m.user_id
                    WHERE m.end_date BETWEEN DATE('now') AND DATE('now', '+7 days')
                    AND m.id IN (SELECT MAX(id) FROM memberships GROUP BY user_id)
                    ORDER BY m.end_date
                `);
                break;
            case 'today':
                members = getAll(`
                    SELECT u.id, u.name, u.email, u.phone, m.plan_type, m.end_date, m.payment_status
                    FROM users u
                    JOIN attendance a ON u.id = a.user_id
                    LEFT JOIN (SELECT * FROM memberships WHERE id IN (SELECT MAX(id) FROM memberships GROUP BY user_id)) m ON u.id = m.user_id
                    WHERE a.date = DATE('now')
                    ORDER BY u.name
                `);
                break;
            default:
                return res.status(400).json({ error: 'Invalid filter type.' });
        }

        res.json(members);
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/personal-training - Get all professional training members
router.get('/personal-training', (req, res) => {
    try {
        const members = getAll(`
            SELECT u.id, u.name, u.email, u.phone, u.gender,
                m.id as membership_id, m.plan_type, m.duration, m.start_date, m.end_date, 
                m.amount, m.payment_status
            FROM users u
            JOIN memberships m ON u.id = m.user_id
            WHERE u.role = 'user' AND m.plan_type = 'professional'
            AND m.id IN (SELECT MAX(id) FROM memberships GROUP BY user_id)
            ORDER BY m.end_date DESC
        `);

        res.json(members);
    } catch (err) {
        console.error('Personal training error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/users - List all users
router.get('/users', (req, res) => {
    try {
        const users = getAll(`
      SELECT u.id, u.name, u.email, u.phone, u.gender, u.created_at,
        m.id as membership_id, m.plan_type, m.duration, m.start_date, m.end_date, 
        m.amount, m.payment_status
      FROM users u
      LEFT JOIN (
        SELECT * FROM memberships WHERE id IN (
          SELECT MAX(id) FROM memberships GROUP BY user_id
        )
      ) m ON u.id = m.user_id
      WHERE u.role = 'user'
      ORDER BY u.created_at DESC
    `);

        res.json(users);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/admin/users - Create a new user
router.post('/users', (req, res) => {
    try {
        const { name, email, phone, password, gender } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({ error: 'Name, email, phone, and password are required.' });
        }

        const existing = getOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'A user with this email already exists.' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const result = runQuery(
            "INSERT INTO users (name, email, phone, password_hash, role, gender) VALUES (?, ?, ?, ?, 'user', ?)",
            [name, email, phone, hash, gender || 'male']
        );

        res.status(201).json({ id: result.lastId, message: 'User created successfully.' });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', (req, res) => {
    try {
        const { name, email, phone, password, gender } = req.body;
        const userId = req.params.id;

        const user = getOne("SELECT * FROM users WHERE id = ? AND role = 'user'", [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (password) {
            const hash = bcrypt.hashSync(password, 10);
            runQuery(
                "UPDATE users SET name = ?, email = ?, phone = ?, password_hash = ?, gender = ? WHERE id = ?",
                [name || user.name, email || user.email, phone || user.phone, hash, gender || user.gender, userId]
            );
        } else {
            runQuery(
                "UPDATE users SET name = ?, email = ?, phone = ?, gender = ? WHERE id = ?",
                [name || user.name, email || user.email, phone || user.phone, gender || user.gender, userId]
            );
        }

        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', (req, res) => {
    try {
        const result = runQuery("DELETE FROM users WHERE id = ? AND role = 'user'", [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/memberships - List all memberships
router.get('/memberships', (req, res) => {
    try {
        const memberships = getAll(`
      SELECT m.*, u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `);

        res.json(memberships);
    } catch (err) {
        console.error('Get memberships error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/admin/memberships - Create membership
router.post('/memberships', (req, res) => {
    try {
        const { user_id, plan_type, duration, start_date, amount, payment_status } = req.body;

        if (!user_id || !plan_type || !duration || !start_date || !amount) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Calculate end date based on duration
        let endDate;
        const start = new Date(start_date);
        switch (duration) {
            case '1_month': endDate = new Date(start.setMonth(start.getMonth() + 1)); break;
            case '3_month': endDate = new Date(start.setMonth(start.getMonth() + 3)); break;
            case '6_month': endDate = new Date(start.setMonth(start.getMonth() + 6)); break;
            case '1_year': endDate = new Date(start.setFullYear(start.getFullYear() + 1)); break;
            default: return res.status(400).json({ error: 'Invalid duration.' });
        }

        const endDateStr = endDate.toISOString().split('T')[0];
        const paymentDate = payment_status === 'paid' ? new Date().toISOString().split('T')[0] : null;

        const result = runQuery(
            "INSERT INTO memberships (user_id, plan_type, duration, start_date, end_date, amount, payment_status, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [user_id, plan_type, duration, start_date, endDateStr, amount, payment_status || 'pending', paymentDate]
        );

        res.status(201).json({ id: result.lastId, end_date: endDateStr, message: 'Membership created successfully.' });
    } catch (err) {
        console.error('Create membership error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/memberships/:id - Update membership
router.put('/memberships/:id', (req, res) => {
    try {
        const { payment_status, end_date, start_date } = req.body;
        const membershipId = req.params.id;

        const membership = getOne('SELECT * FROM memberships WHERE id = ?', [membershipId]);
        if (!membership) {
            return res.status(404).json({ error: 'Membership not found.' });
        }

        const paymentDate = payment_status === 'paid' ? new Date().toISOString().split('T')[0] : membership.payment_date;

        runQuery(
            "UPDATE memberships SET payment_status = ?, start_date = ?, end_date = ?, payment_date = ? WHERE id = ?",
            [payment_status || membership.payment_status, start_date || membership.start_date, end_date || membership.end_date, paymentDate, membershipId]
        );

        res.json({ message: 'Membership updated successfully.' });
    } catch (err) {
        console.error('Update membership error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
