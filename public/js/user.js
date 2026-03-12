// ============================================
// User Dashboard Logic
// ============================================

// Auth guard
if (!requireAuth('user')) {
    throw new Error('Not authorized');
}

const currentUser = getUser();
document.getElementById('userName').textContent = currentUser?.name || 'Member';

// Tab navigation
document.querySelectorAll('.tab-nav').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-nav').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// ============ OVERVIEW ============
async function loadProfile() {
    try {
        const data = await apiRequest('/user/profile');
        const { user, membership, attendanceCount, thisMonthAttendance } = data;

        // Stats
        document.getElementById('totalAttendance').textContent = attendanceCount;
        document.getElementById('monthAttendance').textContent = thisMonthAttendance;
        document.getElementById('memberSince').textContent = formatDate(user.created_at);

        // Membership card
        if (membership) {
            const days = daysRemaining(membership.end_date);
            const planLabel = membership.plan_type === 'professional' ? '💎 PROFESSIONAL TRAINING' : '🥇 GOLD PACKAGE';
            const durationLabel = membership.duration.replace('_', ' ').toUpperCase();

            document.getElementById('planName').textContent = `${planLabel} — ${durationLabel}`;
            document.getElementById('membershipTitle').textContent = `The Royal Fitness Gym`;
            document.getElementById('msStart').textContent = formatDate(membership.start_date);
            document.getElementById('msEnd').textContent = formatDate(membership.end_date);

            if (days <= 0) {
                document.getElementById('msDays').innerHTML = `<span style="color: var(--danger);">Expired</span>`;
                document.getElementById('membershipCard').style.borderColor = 'rgba(239, 68, 68, 0.4)';
            } else if (days <= 7) {
                document.getElementById('msDays').innerHTML = `<span style="color: var(--warning);">${days} days</span>`;
            } else {
                document.getElementById('msDays').textContent = `${days} days`;
            }

            const paymentColors = { paid: 'var(--success)', pending: 'var(--danger)', partial: 'var(--warning)' };
            document.getElementById('msPayment').innerHTML = `<span style="color: ${paymentColors[membership.payment_status] || 'inherit'}">${membership.payment_status.toUpperCase()}</span>`;
        } else {
            document.getElementById('planName').textContent = 'NO ACTIVE PLAN';
            document.getElementById('membershipTitle').textContent = 'Contact admin to get a membership';
            document.getElementById('membershipCard').style.borderColor = 'rgba(239, 68, 68, 0.3)';
        }
    } catch (err) {
        console.error('Profile load error:', err);
        showToast('Failed to load profile', 'error');
    }
}

// ============ ATTENDANCE ============
let attendanceDates = new Set();
let calendarDate = new Date();

// Set today's date
const today = new Date();
document.getElementById('todayDate').textContent = today.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

async function loadAttendance() {
    try {
        const attendance = await apiRequest('/user/attendance');
        attendanceDates = new Set(attendance.map(a => a.date));

        // Check if already marked today
        const todayStr = today.toISOString().split('T')[0];
        if (attendanceDates.has(todayStr)) {
            const btn = document.getElementById('markAttendanceBtn');
            btn.classList.add('marked');
            btn.innerHTML = '<span class="check-icon">✓</span><span>CHECKED IN</span>';
            document.getElementById('attendanceStatus').textContent = '✅ You have marked your attendance today!';
        }

        // Render calendar
        renderCalendar();

        // Render history
        const tbody = document.getElementById('attendanceHistory');
        if (attendance.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">📅</div><h4>No attendance yet</h4><p>Mark your first attendance today!</p></div></td></tr>';
            return;
        }

        tbody.innerHTML = attendance.slice(0, 30).map(a => {
            const date = new Date(a.date);
            const dayName = date.toLocaleDateString('en-IN', { weekday: 'long' });
            return `<tr>
        <td><strong style="color: var(--text-primary);">${formatDate(a.date)}</strong></td>
        <td>${dayName}</td>
        <td>${a.check_in_time || '—'}</td>
      </tr>`;
        }).join('');
    } catch (err) {
        console.error('Attendance load error:', err);
    }
}

async function markAttendance() {
    const btn = document.getElementById('markAttendanceBtn');
    if (btn.classList.contains('marked')) {
        showToast('Already checked in today!', 'info');
        return;
    }

    try {
        await apiRequest('/user/attendance', 'POST');
        btn.classList.add('marked');
        btn.innerHTML = '<span class="check-icon">✓</span><span>CHECKED IN</span>';
        document.getElementById('attendanceStatus').textContent = '✅ Attendance marked successfully!';
        showToast('Attendance marked! Great workout! 💪');

        // Refresh data
        loadAttendance();
        loadProfile();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderCalendar() {
    const calendar = document.getElementById('attendanceCalendar');
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    document.getElementById('calendarMonth').textContent = calendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = today.toISOString().split('T')[0];

    let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(d => `<div class="cal-header">${d}</div>`).join('');

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isPresent = attendanceDates.has(dateStr);
        const isToday = dateStr === todayStr;
        const classes = ['cal-day'];
        if (isPresent) classes.push('present');
        if (isToday) classes.push('today');

        html += `<div class="${classes.join(' ')}">${d}</div>`;
    }

    calendar.innerHTML = html;
}

function changeMonth(offset) {
    calendarDate.setMonth(calendarDate.getMonth() + offset);
    renderCalendar();
}

// ============ PROGRESS ============
let progressData = [];

async function loadProgress() {
    try {
        progressData = await apiRequest('/user/progress');

        // Render chart
        renderWeightChart();

        // Render history
        const tbody = document.getElementById('progressHistory');
        if (progressData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📈</div><h4>No progress entries yet</h4><p>Log your first measurement above!</p></div></td></tr>';
            return;
        }

        tbody.innerHTML = progressData.map(p => `<tr>
      <td><strong style="color: var(--text-primary);">${formatDate(p.date)}</strong></td>
      <td>${p.weight || '—'}</td>
      <td>${p.chest || '—'}</td>
      <td>${p.waist || '—'}</td>
      <td>${p.biceps || '—'}</td>
      <td>${p.thighs || '—'}</td>
      <td>${p.shoulders || '—'}</td>
      <td class="text-muted">${p.notes || '—'}</td>
    </tr>`).join('');
    } catch (err) {
        console.error('Progress load error:', err);
    }
}

function renderWeightChart() {
    const container = document.getElementById('weightChart');
    const entries = progressData.filter(p => p.weight).slice(0, 12).reverse();

    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state" style="width:100%; display:flex; align-items:center; justify-content:center;"><p>Log your weight to see the chart</p></div>';
        return;
    }

    const weights = entries.map(e => e.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const range = maxWeight - minWeight || 1;

    container.innerHTML = entries.map(e => {
        const height = 20 + ((e.weight - minWeight) / range) * 80;
        const dateLabel = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<div class="chart-bar" style="height: ${height}%;">
      <span class="bar-value">${e.weight}kg</span>
      <span class="bar-label">${dateLabel}</span>
    </div>`;
    }).join('');
}

async function saveProgress() {
    const body = {
        weight: parseFloat(document.getElementById('prWeight').value) || null,
        chest: parseFloat(document.getElementById('prChest').value) || null,
        waist: parseFloat(document.getElementById('prWaist').value) || null,
        biceps: parseFloat(document.getElementById('prBiceps').value) || null,
        thighs: parseFloat(document.getElementById('prThighs').value) || null,
        shoulders: parseFloat(document.getElementById('prShoulders').value) || null,
        notes: document.getElementById('prNotes').value || null
    };

    // At least one measurement required
    if (!body.weight && !body.chest && !body.waist && !body.biceps && !body.thighs && !body.shoulders) {
        showToast('Please enter at least one measurement', 'error');
        return;
    }

    try {
        await apiRequest('/user/progress', 'POST', body);
        showToast('Progress saved! Keep it up! 🔥');
        document.getElementById('progressForm').reset();
        loadProgress();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============ INIT ============
loadProfile();
loadAttendance();
loadProgress();
