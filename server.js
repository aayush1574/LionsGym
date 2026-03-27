require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { initializeDatabase } = require('./db/database');
const { checkAndNotify } = require('./services/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serverless initialization middleware (for Vercel)
if (process.env.VERCEL === '1') {
    app.use(async (req, res, next) => {
        try {
            await initializeDatabase();
            next();
        } catch (e) {
            next(e);
        }
    });
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));

// Serve HTML pages for specific routes
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/user.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user.html')));

// SPA fallback
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Initialize database and start server
if (process.env.VERCEL !== '1') {
    async function start() {
        await initializeDatabase();

        // Schedule WhatsApp notifications - every day at 9:00 AM
        cron.schedule('0 9 * * *', () => {
            console.log('⏰ Running daily membership expiry check...');
            checkAndNotify();
        });

        app.listen(PORT, () => {
            console.log(`\n🏋️  Lion's Gym Server`);
            console.log(`🌐 Running at http://localhost:${PORT}`);
            console.log(`📅 WhatsApp cron job scheduled (daily at 9:00 AM)\n`);
        });
    }

    start().catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
} else {
    // Vercel serverless environment
    module.exports = app;
}
