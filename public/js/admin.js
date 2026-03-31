// ============================================
// Admin Dashboard Logic
// ============================================

// Auth guard
if (!requireAuth('admin')) {
    throw new Error('Not authorized');
}

// Set admin name
const user = getUser();
document.getElementById('adminName').textContent = user?.name || 'Admin';

// Tab navigation
document.querySelectorAll('.tab-nav').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        // Update nav buttons
        document.querySelectorAll('.tab-nav').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// Pricing lookup
const PRICING = {
    gold: { '1_month': 1000, '3_month': 2500, '6_month': 4200, '1_year': 8000 },
    professional: { '1_month': 2000, '3_month': 5000, '6_month': 7200, '1_year': 12000 }
};

function updatePrice() {
    const plan = document.getElementById('msPlan').value;
    const duration = document.getElementById('msDuration').value;
    document.getElementById('msAmount').value = PRICING[plan]?.[duration] || '';
}

// ============ DASHBOARD ============
async function loadDashboard() {
    try {
        const data = await apiRequest('/admin/dashboard');
        document.getElementById('statTotalMembers').textContent = data.totalMembers;
        document.getElementById('statActiveMembers').textContent = data.activeMembers;
        document.getElementById('statPending').textContent = data.pendingPayments;
        document.getElementById('statToday').textContent = data.todayAttendance;
        document.getElementById('statExpiring').textContent = data.expiringThisWeek;
        document.getElementById('statRevenue').textContent = `₹${data.totalRevenue.toLocaleString('en-IN')}`;
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

// ============ MEMBERS ============
let allMembers = [];

async function loadMembers() {
    try {
        allMembers = await apiRequest('/admin/users');
        renderMembers(allMembers);
    } catch (err) {
        console.error('Load members error:', err);
    }
}

function renderMembers(members) {
    const tbody = document.getElementById('membersTable');
    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h4>No members yet</h4><p>Add your first member to get started</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const days = m.end_date ? daysRemaining(m.end_date) : null;
        const planBadge = m.plan_type
            ? `<span class="badge ${m.plan_type === 'professional' ? 'badge-info' : 'badge-warning'}">${m.plan_type}</span>`
            : '<span class="text-muted">—</span>';

        const expiryText = m.end_date
            ? `${formatDate(m.end_date)} ${days !== null ? (days <= 0 ? '<span class="badge badge-danger">Expired</span>' : days <= 7 ? `<span class="badge badge-warning">${days}d left</span>` : `<span class="text-muted">(${days}d)</span>`) : ''}`
            : '<span class="text-muted">No plan</span>';

        const paymentBadge = m.payment_status
            ? `<span class="badge ${m.payment_status === 'paid' ? 'badge-success' : m.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}">${m.payment_status}</span>`
            : '<span class="text-muted">—</span>';

        return `<tr>
      <td><strong style="color: var(--text-primary);">${m.name}</strong></td>
      <td>${m.email}</td>
      <td>${m.phone}</td>
      <td>${planBadge}</td>
      <td>${expiryText}</td>
      <td>${paymentBadge}</td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="editMember(${m.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id}, '${m.name}')">🗑️</button>
        </div>
      </td>
    </tr>`;
    }).join('');
}

// Search members
document.getElementById('searchMembers')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allMembers.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.phone.includes(query)
    );
    renderMembers(filtered);
});

// Add / Edit member modal
function openAddMemberModal() {
    document.getElementById('memberModalTitle').textContent = '➕ Add New Member';
    document.getElementById('memberForm').reset();
    document.getElementById('editMemberId').value = '';
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('memberPassword').required = true;
    document.getElementById('saveMemberBtn').textContent = 'Save Member';
    document.getElementById('membershipDatesGroup').style.display = 'none';
    // Show PT toggle in add mode
    document.getElementById('ptToggleGroup').style.display = 'block';
    document.getElementById('ptToggle').checked = false;
    document.getElementById('ptFields').style.display = 'none';
    document.getElementById('ptStartDate').value = new Date().toISOString().split('T')[0];
    updatePTPrice();
    openModal('addMemberModal');
}

function togglePTFields() {
    const show = document.getElementById('ptToggle').checked;
    document.getElementById('ptFields').style.display = show ? 'block' : 'none';
}

function updatePTPrice() {
    const duration = document.getElementById('ptDuration').value;
    const customGroup = document.getElementById('ptCustomMonthsGroup');
    customGroup.style.display = duration === 'custom' ? 'block' : 'none';
    document.getElementById('ptAmount').value = PRICING.professional?.[duration] || 1500;
}

function editMember(id) {
    const m = allMembers.find(u => u.id === id);
    if (!m) return;

    document.getElementById('memberModalTitle').textContent = '✏️ Edit Member';
    document.getElementById('editMemberId').value = m.id;
    document.getElementById('memberName').value = m.name;
    document.getElementById('memberEmail').value = m.email;
    document.getElementById('memberPhone').value = m.phone;
    document.getElementById('memberGender').value = m.gender || 'male';
    document.getElementById('memberPassword').required = false;
    document.getElementById('memberPassword').value = '';
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('saveMemberBtn').textContent = 'Update Member';

    // Hide PT toggle in edit mode
    document.getElementById('ptToggleGroup').style.display = 'none';

    // Show membership dates if member has a membership
    const datesGroup = document.getElementById('membershipDatesGroup');
    datesGroup.style.display = 'block';
    document.getElementById('memberStartDate').value = m.start_date || '';
    document.getElementById('memberEndDate').value = m.end_date || '';

    openModal('addMemberModal');
}

async function saveMember() {
    const id = document.getElementById('editMemberId').value;
    const body = {
        name: document.getElementById('memberName').value,
        email: document.getElementById('memberEmail').value,
        phone: document.getElementById('memberPhone').value,
        gender: document.getElementById('memberGender').value,
        password: document.getElementById('memberPassword').value || undefined
    };

    if (!body.name || !body.email || !body.phone) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    try {
        if (id) {
            await apiRequest(`/admin/users/${id}`, 'PUT', body);

            // Update membership dates if changed
            const startDate = document.getElementById('memberStartDate').value;
            const endDate = document.getElementById('memberEndDate').value;
            const member = allMembers.find(u => u.id === parseInt(id));
            if (member && member.membership_id && (startDate || endDate)) {
                const dateBody = {};
                if (startDate) dateBody.start_date = startDate;
                if (endDate) dateBody.end_date = endDate;
                await apiRequest(`/admin/memberships/${member.membership_id}`, 'PUT', dateBody);
            }

            showToast('Member updated successfully!');
        } else {
            if (!body.password) {
                showToast('Password is required for new members', 'error');
                return;
            }
            const result = await apiRequest('/admin/users', 'POST', body);

            // Auto-create professional membership if PT is checked
            if (document.getElementById('ptToggle').checked) {
                let duration = document.getElementById('ptDuration').value;
                if (duration === 'custom') {
                    const months = document.getElementById('ptCustomMonths').value;
                    if (!months || months < 1) { showToast('Enter valid custom months', 'error'); return; }
                    duration = `custom_${months}`;
                }
                const ptBody = {
                    user_id: result.id,
                    plan_type: 'professional',
                    duration,
                    trainer_name: document.getElementById('ptTrainerName').value || 'Deepak Rajput',
                    start_date: document.getElementById('ptStartDate').value || new Date().toISOString().split('T')[0],
                    amount: parseFloat(document.getElementById('ptAmount').value),
                    payment_status: document.getElementById('ptPayment').value
                };
                await apiRequest('/admin/memberships', 'POST', ptBody);
                showToast('Member added with Personal Training! 🎯');
            } else {
                showToast('Member added successfully!');
            }
        }
        closeModal('addMemberModal');
        loadMembers();
        loadMemberships();
        loadPersonalTraining();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteMember(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete their membership and attendance data.`)) return;

    try {
        await apiRequest(`/admin/users/${id}`, 'DELETE');
        showToast('Member deleted successfully!');
        loadMembers();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============ MEMBERSHIPS ============
let allMemberships = [];

async function loadMemberships() {
    try {
        allMemberships = await apiRequest('/admin/memberships');
        renderMemberships(allMemberships);
    } catch (err) {
        console.error('Load memberships error:', err);
    }
}

function renderMemberships(memberships) {
    const tbody = document.getElementById('membershipsTable');

    if (memberships.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💳</div><h4>No memberships found</h4><p>Create a membership for a member</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = memberships.map(m => {
        const days = daysRemaining(m.end_date);
        const durationLabel = m.duration.replace('_', ' ').replace('1 month', '1 Month').replace('3 month', '3 Months').replace('6 month', '6 Months').replace('1 year', '1 Year');

        return `<tr>
        <td><strong style="color: var(--text-primary);">${m.user_name}</strong><br><span class="text-muted" style="font-size:0.8rem;">${m.user_phone}</span></td>
        <td><span class="badge ${m.plan_type === 'professional' ? 'badge-info' : 'badge-warning'}">${m.plan_type}</span></td>
        <td>${durationLabel}</td>
        <td>${formatDate(m.start_date)}</td>
        <td>${formatDate(m.end_date)} ${days <= 0 ? '<span class="badge badge-danger" style="margin-left:4px">Expired</span>' : days <= 7 ? `<span class="badge badge-warning" style="margin-left:4px">${days}d</span>` : ''}</td>
        <td>₹${m.amount.toLocaleString('en-IN')}</td>
        <td><span class="badge ${m.payment_status === 'paid' ? 'badge-success' : m.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}">${m.payment_status}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="openPaymentModal(${m.id}, '${m.payment_status}', '${m.end_date}')">💰</button></td>
      </tr>`;
    }).join('');
}

// Search memberships
document.getElementById('searchMemberships')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allMemberships.filter(m =>
        m.user_name.toLowerCase().includes(query) ||
        m.user_phone.includes(query) ||
        m.plan_type.toLowerCase().includes(query) ||
        m.payment_status.toLowerCase().includes(query)
    );
    renderMemberships(filtered);
});

function openNewMembershipModal() {
    // Populate member dropdown
    const select = document.getElementById('msUserId');
    select.innerHTML = '<option value="">-- Select Member --</option>' +
        allMembers.map(m => `<option value="${m.id}">${m.name} (${m.phone})</option>`).join('');

    // Set default start date to today
    document.getElementById('msStartDate').value = new Date().toISOString().split('T')[0];
    updatePrice();
    openModal('newMembershipModal');
}

async function saveMembership() {
    const body = {
        user_id: parseInt(document.getElementById('msUserId').value),
        plan_type: document.getElementById('msPlan').value,
        duration: document.getElementById('msDuration').value,
        start_date: document.getElementById('msStartDate').value,
        amount: parseFloat(document.getElementById('msAmount').value),
        payment_status: document.getElementById('msPayment').value
    };

    if (!body.user_id || !body.start_date || !body.amount) {
        showToast('Please fill all fields', 'error');
        return;
    }

    try {
        await apiRequest('/admin/memberships', 'POST', body);
        showToast('Membership created successfully!');
        closeModal('newMembershipModal');
        loadMemberships();
        loadMembers();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openPaymentModal(membershipId, currentStatus, endDate) {
    document.getElementById('paymentMembershipId').value = membershipId;
    document.getElementById('paymentStatus').value = currentStatus;
    document.getElementById('paymentEndDate').value = endDate;
    openModal('paymentModal');
}

async function updatePayment() {
    const id = document.getElementById('paymentMembershipId').value;
    const body = {
        payment_status: document.getElementById('paymentStatus').value,
        end_date: document.getElementById('paymentEndDate').value || undefined
    };

    try {
        await apiRequest(`/admin/memberships/${id}`, 'PUT', body);
        showToast('Payment updated!');
        closeModal('paymentModal');
        loadMemberships();
        loadMembers();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============ MODAL HELPERS ============
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});

// ============ STAT CARD FILTER ============
const FILTER_TITLES = {
    total: '👥 All Members',
    active: '✅ Active Members',
    pending: '⏳ Pending Payments',
    today: '📅 Today\'s Attendance',
    expiring: '⚠️ Expiring This Week'
};

async function filterByCard(type) {
    try {
        const members = await apiRequest(`/admin/dashboard/filter/${type}`);
        const section = document.getElementById('filteredSection');
        const title = document.getElementById('filteredTitle');
        const tbody = document.getElementById('filteredTable');

        title.textContent = FILTER_TITLES[type] || '📋 Members';

        if (members.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📭</div><h4>No members found</h4><p>No members match this filter</p></div></td></tr>`;
        } else {
            tbody.innerHTML = members.map(m => {
                const days = m.end_date ? daysRemaining(m.end_date) : null;
                const planBadge = m.plan_type
                    ? `<span class="badge ${m.plan_type === 'professional' ? 'badge-info' : 'badge-warning'}">${m.plan_type}</span>`
                    : '<span class="text-muted">—</span>';
                const expiryText = m.end_date
                    ? `${formatDate(m.end_date)} ${days !== null ? (days <= 0 ? '<span class="badge badge-danger">Expired</span>' : days <= 7 ? `<span class="badge badge-warning">${days}d left</span>` : `<span class="text-muted">(${days}d)</span>`) : ''}`
                    : '<span class="text-muted">No plan</span>';
                const paymentBadge = m.payment_status
                    ? `<span class="badge ${m.payment_status === 'paid' ? 'badge-success' : m.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}">${m.payment_status}</span>`
                    : '<span class="text-muted">—</span>';

                return `<tr>
                    <td><strong style="color: var(--text-primary);">${m.name}</strong></td>
                    <td>${m.email}</td>
                    <td>${m.phone}</td>
                    <td>${planBadge}</td>
                    <td>${expiryText}</td>
                    <td>${paymentBadge}</td>
                </tr>`;
            }).join('');
        }

        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        console.error('Filter error:', err);
        showToast('Failed to load filtered members', 'error');
    }
}

function closeFilteredSection() {
    document.getElementById('filteredSection').style.display = 'none';
}

// ============ PERSONAL TRAINING ============
let allPTMembers = [];

async function loadPersonalTraining() {
    try {
        allPTMembers = await apiRequest('/admin/personal-training');
        renderPTMembers(allPTMembers);
    } catch (err) {
        console.error('Load PT error:', err);
    }
}

function renderPTMembers(members) {
    const tbody = document.getElementById('ptTable');

    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🎯</div><h4>No personal training members</h4><p>Members with Professional plan will appear here</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const days = m.end_date ? daysRemaining(m.end_date) : 0;
        let durationLabel = m.duration || '—';
        durationLabel = durationLabel.replace('1_month','1 Month').replace('3_month','3 Months').replace('6_month','6 Months').replace('1_year','1 Year');
        if (durationLabel.startsWith('custom_')) durationLabel = durationLabel.replace('custom_','') + ' Months (Custom)';
        const trainerName = m.trainer_name || 'Deepak Rajput';
        const statusBadge = days <= 0
            ? '<span class="badge badge-danger">Expired</span>'
            : days <= 7
                ? `<span class="badge badge-warning">${days}d left</span>`
                : `<span class="badge badge-success">Active (${days}d)</span>`;
        const paymentBadge = `<span class="badge ${m.payment_status === 'paid' ? 'badge-success' : m.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}">${m.payment_status}</span>`;

        return `<tr>
            <td><strong style="color: var(--text-primary);">${m.name}</strong><br><span class="text-muted" style="font-size:0.8rem;">${m.email}</span></td>
            <td>${m.phone}</td>
            <td><span style="color:var(--accent);font-weight:600;">🏋️ ${trainerName}</span></td>
            <td>${durationLabel}</td>
            <td>${formatDate(m.start_date)}</td>
            <td>${formatDate(m.end_date)}</td>
            <td>₹${m.amount.toLocaleString('en-IN')}</td>
            <td>${paymentBadge}</td>
            <td>${statusBadge}</td>
        </tr>`;
    }).join('');
}

// Search PT members
document.getElementById('searchPT')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allPTMembers.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.phone.includes(query)
    );
    renderPTMembers(filtered);
});

// ============ INIT ============
loadDashboard();
loadMembers();
loadMemberships();
loadPersonalTraining();
