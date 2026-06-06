const API_BASE = 'https://localhost:7037';
let allDetails = [];          // flat list of OrderDetail hôm nay
let currentFilter = 'all';
let autoRefreshInterval = null;
let currentAction = null;
let currentOrderDetailId = null;

// DOM Elements
const ordersGrid = document.getElementById('ordersGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const confirmMessage = document.getElementById('confirmMessage');

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = localStorage.getItem('authToken');
const userRole = localStorage.getItem('userRole');
if (!token) window.location.href = 'login.html';
if (userRole !== 'Chef' && userRole !== 'Admin') window.location.href = 'BDrestaurant.html';

document.getElementById('chefName').textContent =
    localStorage.getItem('adminName') || 'Chef';

// ── Logout ────────────────────────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        ['authToken', 'currentUser', 'userRole', 'adminName'].forEach(k => localStorage.removeItem(k));
        window.location.href = 'login.html';
    });
}

// ── Refresh button ────────────────────────────────────────────────────────────
if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);

// ── Filter tabs ───────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderDetails();
    });
});

// ── Modal ─────────────────────────────────────────────────────────────────────
if (confirmYes) {
    confirmYes.addEventListener('click', async () => {
        confirmModal.classList.remove('show');
        const id = currentOrderDetailId;
        const action = currentAction;
        currentOrderDetailId = null;
        currentAction = null;
        if (action === 'process') await patchStatus(id, 'Processing');
        else if (action === 'complete') await patchStatus(id, 'Completed');
        else if (action === 'cancel') await patchStatus(id, 'Cancelled');
    });
}
if (confirmNo) {
    confirmNo.addEventListener('click', () => {
        confirmModal.classList.remove('show');
        currentOrderDetailId = null;
        currentAction = null;
    });
}

// ── PATCH status ──────────────────────────────────────────────────────────────
async function patchStatus(orderDetailId, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/api/OrderDetail/${orderDetailId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Cannot update status to ${newStatus}`);
        }

        showToast(`Status updated → ${newStatus}`);
        await loadOrders();
    } catch (e) {
        console.error('patchStatus error:', e);
        showToast(e.message, 'error');
    }
}

// ── Load data ─────────────────────────────────────────────────────────────────
// Strategy:
//   1. GET api/order?filter=InProcessing  → lấy các order chưa xong hôm nay
//   2. Với mỗi order, GET api/OrderDetail/order/{id}
//   3. Flatten, lọc orderDate = hôm nay, loại IsDeleted
async function loadOrders() {
    if (!ordersGrid) return;

    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    ordersGrid.style.display = 'none';

    try {
        // Lấy tất cả order (InProcessing) để có đủ detail hôm nay
        const res = await fetch(`${API_BASE}/api/order?filter=InProcessing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401) { window.location.href = 'login.html'; return; }
            throw new Error('Cannot fetch orders');
        }

        const orders = await res.json();

        // Fetch detail cho từng order song song
        const detailPromises = orders.map(o =>
            fetch(`${API_BASE}/api/OrderDetail/order/${o.orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.ok ? r.json() : [])
                .then(details => details.map(d => ({
                    ...d,
                    orderId: o.orderId,
                    customerName: o.customerName || 'Guest'
                })))
        );

        const nestedDetails = await Promise.all(detailPromises);
        const flatDetails = nestedDetails.flat();

        // Chỉ giữ OrderDetail của HÔM NAY và chưa bị xóa
        const today = new Date();
        allDetails = flatDetails.filter(d => {
            if (d.isDeleted) return false;
            const dt = new Date(d.orderDate);
            return dt.getFullYear() === today.getFullYear()
                && dt.getMonth() === today.getMonth()
                && dt.getDate() === today.getDate();
        });

        renderDetails();

    } catch (e) {
        console.error('loadOrders error:', e);
        loadingState.style.display = 'none';
        ordersGrid.style.display = 'block';
        ordersGrid.innerHTML = `
            <div class="empty-state" style="display:block;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:48px;color:#dc3545;"></i>
                <p>Failed to load orders. Please try again.</p>
            </div>`;
    }
}

// ── Render flat list ──────────────────────────────────────────────────────────
function renderDetails() {
    if (!ordersGrid) return;

    // Filter theo tab
    let list = [...allDetails];
    switch (currentFilter) {
        case 'pending':
            list = list.filter(d => d.status === 'Pending'); break;
        case 'processing':
            list = list.filter(d => d.status === 'Processing'); break;
        case 'completed':
            list = list.filter(d => d.status === 'Completed' || d.status === 'Cancelled'); break;
        default:
            // 'all' — chỉ hiện món đang cần xử lý, ẩn terminal states
            list = list.filter(d => d.status === 'Pending' || d.status === 'Processing');
            break;
    }

    // Sort: chờ lâu nhất (orderDate cũ nhất) lên đầu
    list.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));

    loadingState.style.display = 'none';

    if (list.length === 0) {
        ordersGrid.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <i class="fa-solid fa-check-circle" style="font-size:48px;color:var(--dark-green);"></i>
            <p>No items match this filter. Great job!</p>`;
        return;
    }

    ordersGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    ordersGrid.innerHTML = list.map(d => renderDetailRow(d)).join('');
}

// ── Render một OrderDetail row (dạng card) ───────────────────────────────────
function renderDetailRow(d) {
    const waitMins = calculateWaitingTime(d.orderDate);
    const priority = getPriorityLevel(waitMins);
    const waitDisplay = formatWaitingTime(waitMins);
    const timeStr = new Date(d.orderDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const actionBtns = buildActionButtons(d);

    return `
    <div class="order-card ${priority}" data-detail-id="${d.orderDetailId}">
        <div class="order-card-header">
            <div>
                <span class="order-id">${escapeHtml(d.foodName || 'Unknown dish')}</span>
                <div style="font-size:12px;margin-top:4px;opacity:.85;">
                    <i class="fa-regular fa-clock"></i> ${timeStr}
                    &nbsp;·&nbsp;
                    <i class="fa-regular fa-folder-open"></i> Order #${d.orderId}
                    &nbsp;·&nbsp;
                    <i class="fa-regular fa-user"></i> ${escapeHtml(d.customerName)}
                </div>
            </div>
            <div class="waiting-time ${getPriorityLevel(waitMins)}">
                <i class="fa-regular fa-hourglass-half"></i>
                <span>${waitDisplay}</span>
            </div>
        </div>
        <div class="order-card-body" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 20px;">
            <span class="item-quantity" style="font-size:16px;">x${d.quantity}</span>
            <span class="item-status ${d.status}">${d.status}</span>
            <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
                ${actionBtns}
            </div>
        </div>
    </div>`;
}

// ── Action buttons theo AllowedTransitions ────────────────────────────────────
// Pending    → Processing | Cancelled
// Processing → Completed
// Completed / Cancelled → (terminal, no buttons)
function buildActionButtons(d) {
    if (d.status === 'Pending') {
        return `
            <button class="action-btn-small btn-processing-small"
                    onclick="openConfirmModal('process', ${d.orderDetailId}, '${escapeHtml(d.foodName)}')">
                <i class="fa-solid fa-play"></i> Start
            </button>
            <button class="action-btn-small" style="background:#dc3545;color:white;"
                    onclick="openConfirmModal('cancel', ${d.orderDetailId}, '${escapeHtml(d.foodName)}')">
                <i class="fa-solid fa-xmark"></i> Cancel
            </button>`;
    }
    if (d.status === 'Processing') {
        return `
            <button class="action-btn-small btn-complete-small"
                    onclick="openConfirmModal('complete', ${d.orderDetailId}, '${escapeHtml(d.foodName)}')">
                <i class="fa-solid fa-check"></i> Complete
            </button>`;
    }
    // Completed / Cancelled — terminal
    return '';
}

// ── Open confirm modal ────────────────────────────────────────────────────────
window.openConfirmModal = function (action, orderDetailId, foodName) {
    currentAction = action;
    currentOrderDetailId = orderDetailId;

    const name = foodName || 'this dish';
    const messages = {
        process: `Start preparing "${name}"?`,
        complete: `Mark "${name}" as Completed?`,
        cancel: `Cancel "${name}"? This cannot be undone.`
    };
    confirmMessage.textContent = messages[action] || 'Are you sure?';
    confirmModal.classList.add('show');
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function calculateWaitingTime(orderDate) {
    return Math.floor((new Date() - new Date(orderDate)) / 60000);
}

function getPriorityLevel(mins) {
    if (mins >= 30) return 'urgent';
    if (mins >= 10) return 'warning';
    return 'normal';
}

function formatWaitingTime(mins) {
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}

function showToast(message, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast-message${type === 'error' ? ' error' : ''}`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── Auto refresh ──────────────────────────────────────────────────────────────
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(loadOrders, 30000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    startAutoRefresh();
});

window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
});