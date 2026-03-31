require('dotenv').config();
const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// DB init middleware — runs on every request on Vercel (stateless)
app.use(async (req, res, next) => {
    try {
        await initializeDatabase();
        next();
    } catch (e) {
        console.error('DB init error:', e);
        res.status(500).json({ error: 'Database initialization failed.' });
    }
});

// API Routes — must be before SPA fallback
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));

// API 404 handler — catches any /api/* that didn't match above
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found.' });
});

// Serve specific HTML pages
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/user.html',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'user.html')));

// SPA fallback — only for non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Local dev server
if (process.env.VERCEL !== '1') {
    const cron = require('node-cron');
    const { checkAndNotify } = require('./services/whatsapp');

    async function start() {
        await initializeDatabase();

        cron.schedule('0 9 * * *', () => {
            console.log('⏰ Running daily membership expiry check...');
            checkAndNotify();
        });

        app.listen(PORT, () => {
            console.log(`\n🏋️  Lion's Gym Server`);
            console.log(`🌐 Running at http://localhost:${PORT}\n`);
        });
    }

    start().catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}

// Vercel serverless export
module.exports = app;
