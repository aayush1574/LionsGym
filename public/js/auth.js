// ============================================
// Auth Utilities
// ============================================

const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('royal_gym_token');
}

function getUser() {
    const user = localStorage.getItem('royal_gym_user');
    return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
    localStorage.setItem('royal_gym_token', token);
    localStorage.setItem('royal_gym_user', JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem('royal_gym_token');
    localStorage.removeItem('royal_gym_user');
}

function logout() {
    clearAuth();
    window.location.href = '/login.html';
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: authHeaders()
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');

        errorDiv.classList.add('hidden');
        loginBtn.textContent = '⏳ Signing in...';
        loginBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setAuth(data.token, data.user);

            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/user.html';
            }
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.classList.remove('hidden');
            loginBtn.textContent = '🔐 Sign In';
            loginBtn.disabled = false;
        }
    });
}

// Auth guard — redirect if not logged in
function requireAuth(requiredRole) {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        window.location.href = '/login.html';
        return false;
    }

    if (requiredRole && user.role !== requiredRole) {
        window.location.href = user.role === 'admin' ? '/admin.html' : '/user.html';
        return false;
    }

    return true;
}

// Format date helper
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysRemaining(endDateStr) {
    if (!endDateStr) return 0;
    const end = new Date(endDateStr);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
}
