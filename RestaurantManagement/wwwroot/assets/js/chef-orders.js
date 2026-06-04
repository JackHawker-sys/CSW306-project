const API_BASE = 'https://localhost:7037';
let allOrders = [];
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

// Check authentication
const token = localStorage.getItem('authToken');
if (!token) {
    window.location.href = 'login.html';
}

// Check if user is Chef or Admin
const userRole = localStorage.getItem('userRole');
if (userRole !== 'Chef' && userRole !== 'Admin') {
    window.location.href = 'BDrestaurant.html';
}

// Set chef name
const chefName = localStorage.getItem('adminName') || 'Chef';
document.getElementById('chefName').textContent = chefName;

// Event Listeners
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('adminName');
        window.location.href = 'login.html';
    });
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadOrders());
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderOrders();
    });
});

// Modal confirmation
if (confirmYes) {
    confirmYes.addEventListener('click', async () => {
        confirmModal.classList.remove('show');
        if (currentAction === 'process' && currentOrderDetailId) {
            await updateOrderDetailStatus(currentOrderDetailId, 'Processing');
        } else if (currentAction === 'ready' && currentOrderDetailId) {
            await updateOrderDetailStatus(currentOrderDetailId, 'Ready');
        }
        currentOrderDetailId = null;
        currentAction = null;
    });
}

if (confirmNo) {
    confirmNo.addEventListener('click', () => {
        confirmModal.classList.remove('show');
        currentOrderDetailId = null;
        currentAction = null;
    });
}

// Update order detail status
async function updateOrderDetailStatus(orderDetailId, newStatus) {
    try {
        // Chef chỉ được phép chuyển sang "Ready"
        if (newStatus === 'Completed') {
            showToast('Only Admin can confirm completion!', 'error');
            return;
        }

        const res = await fetch(`${API_BASE}/api/OrderDetail/${orderDetailId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Cannot update status to ${newStatus}`);
        }

        const result = await res.json();
        showToast(`Order item status updated to ${newStatus}!`);
        await loadOrders();

    } catch (error) {
        console.error('Update status error:', error);
        showToast(error.message, 'error');
    }
}

// Load orders from API
async function loadOrders() {
    if (!ordersGrid) return;

    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    ordersGrid.style.display = 'none';

    try {
        // Fetch all orders
        const res = await fetch(`${API_BASE}/api/order?filter=all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Cannot fetch orders');
        }

        const orders = await res.json();

        // Fetch order details for each order
        for (const order of orders) {
            const detailsRes = await fetch(`${API_BASE}/api/OrderDetail/order/${order.orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailsRes.ok) {
                order.details = await detailsRes.json();
            }
        }

        allOrders = orders;
        renderOrders();

    } catch (error) {
        console.error('Load orders error:', error);
        loadingState.style.display = 'none';
        ordersGrid.style.display = 'block';
        ordersGrid.innerHTML = `<div class="empty-state" style="display:block;"><i class="fa-solid fa-circle-exclamation" style="font-size:48px;color:#dc3545;"></i><p>Failed to load orders. Please try again.</p></div>`;
    }
}

// Calculate waiting time in minutes
function calculateWaitingTime(orderDate) {
    const orderTime = new Date(orderDate);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    return diffMinutes;
}

// Get priority level based on waiting time
function getPriorityLevel(waitingMinutes) {
    if (waitingMinutes >= 30) return 'urgent';
    if (waitingMinutes >= 10) return 'warning';
    return 'normal';
}

// Get waiting time class
function getWaitingTimeClass(waitingMinutes) {
    if (waitingMinutes >= 30) return 'urgent';
    if (waitingMinutes >= 10) return 'warning';
    return 'normal';
}

// Format waiting time display
function formatWaitingTime(waitingMinutes) {
    if (waitingMinutes < 1) return 'Just now';
    if (waitingMinutes < 60) return `${waitingMinutes} min ago`;
    const hours = Math.floor(waitingMinutes / 60);
    const mins = waitingMinutes % 60;
    return `${hours}h ${mins}m ago`;
}

// Check if order has any items that are not Completed (for Chef to see)
function hasIncompleteItems(order) {
    if (!order.details || order.details.length === 0) return false;
    // Chỉ hiển thị order còn món Pending hoặc Processing (không hiển thị order chỉ còn Ready)
    return order.details.some(d =>
        !d.isDeleted && (d.status === 'Pending' || d.status === 'Processing')
    );
}

// Render orders grid
function renderOrders() {
    if (!ordersGrid) return;

    let activeOrders = allOrders.filter(order => hasIncompleteItems(order));

    // Apply filter based on status
    let filteredOrders = [...activeOrders];

    switch (currentFilter) {
        case 'pending':
            filteredOrders = activeOrders.filter(order =>
                order.details.some(d => d.status === 'Pending' && !d.isDeleted));
            break;
        case 'processing':
            filteredOrders = activeOrders.filter(order =>
                order.details.some(d => d.status === 'Processing' && !d.isDeleted));
            break;
        default:
            break;
    }

    filteredOrders.sort((a, b) => {
        return new Date(a.orderDate) - new Date(b.orderDate);
    });

    loadingState.style.display = 'none';

    if (filteredOrders.length === 0) {
        ordersGrid.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <i class="fa-solid fa-check-circle" style="font-size: 48px; color: var(--dark-green);"></i>
            <p>All orders have been completed! Waiting for new orders...</p>
        `;
        return;
    }

    ordersGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    ordersGrid.innerHTML = filteredOrders.map(order => {
        const waitingMinutes = calculateWaitingTime(order.orderDate);
        const priority = getPriorityLevel(waitingMinutes);
        const waitingTimeClass = getWaitingTimeClass(waitingMinutes);
        const waitingDisplay = formatWaitingTime(waitingMinutes);

        // Get items that are Pending or Processing
        const activeItems = order.details.filter(d =>
            !d.isDeleted && (d.status === 'Pending' || d.status === 'Processing')
        );

        return `
            <div class="order-card ${priority}" data-order-id="${order.orderId}">
                <div class="order-card-header">
                    <span class="order-id">Order #${order.orderId}</span>
                    <div class="waiting-time ${waitingTimeClass}">
                        <i class="fa-regular fa-clock"></i>
                        <span>${waitingDisplay}</span>
                    </div>
                </div>
                <div class="order-card-body">
                    <div class="customer-info">
                        <i class="fa-regular fa-user"></i>
                        <span>${escapeHtml(order.customerName || 'Guest')}</span>
                    </div>
                    <div class="order-time">
                        <i class="fa-regular fa-calendar"></i>
                        <span>Ordered: ${new Date(order.orderDate).toLocaleString()}</span>
                    </div>
                    <div class="items-list">
                        ${activeItems.map(item => `
                            <div class="order-item" data-detail-id="${item.orderDetailId}">
                                <span class="item-name">${escapeHtml(item.foodName || item.foodMenu?.name || 'Unknown')}</span>
                                <span class="item-quantity">x${item.quantity}</span>
                                <span class="item-status ${item.status}">${item.status}</span>
                                ${item.status === 'Processing' ? `
                                    <button class="action-btn-small btn-ready-small" onclick="openConfirmModal('ready', ${item.orderDetailId})">
                                        <i class="fa-solid fa-check"></i> Mark Ready
                                    </button>
                                ` : ''}
                                ${item.status === 'Pending' ? `
                                    <button class="action-btn-small btn-processing-small" onclick="openConfirmModal('process', ${item.orderDetailId})">
                                        <i class="fa-solid fa-play"></i> Start
                                    </button>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Open confirm modal
window.openConfirmModal = function (action, orderDetailId) {
    currentAction = action;
    currentOrderDetailId = orderDetailId;
    if (action === 'process') {
        confirmMessage.textContent = 'Start preparing this dish?';
    } else if (action === 'ready') {
        confirmMessage.textContent = 'Mark this dish as ready? (Admin will confirm completion and payment)';
    }
    confirmModal.classList.add('show');
};

// Helper functions
function formatCurrencyVND(amount) {
    if (amount === undefined || amount === null) return '₫0';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-message ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Auto refresh every 30 seconds
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        loadOrders();
    }, 30000);
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    startAutoRefresh();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
});