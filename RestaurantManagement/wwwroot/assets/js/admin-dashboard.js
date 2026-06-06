// admin-dashboard.js
const API_BASE = 'https://localhost:7037';
let currentOrderFilter = 'processing';
let currentOrderIdForAction = null;
let currentAction = null;
let allOrders = [];

console.log('Auth token:', localStorage.getItem('authToken'));
console.log('User role:', localStorage.getItem('userRole'));

const token = localStorage.getItem('authToken');
if (!token) {
    console.log('No token found, redirecting to login');
    window.location.href = 'login.html';
}

const userRole = localStorage.getItem('userRole');
console.log('User role from storage:', userRole);
if (userRole !== 'Admin') {
    console.log('Not admin, redirecting to home');
    window.location.href = 'BDrestaurant.html';
}

// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');
const logoutNav = document.getElementById('logoutNav');
const ordersTableBody = document.getElementById('ordersTableBody');
const employeesTableBody = document.getElementById('employeesTableBody');
const revenueTableBody = document.getElementById('revenueTableBody');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

// Toggle sidebar
if (toggleSidebar) {
    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// Navigation
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        const page = item.dataset.page;
        document.querySelectorAll('.page-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${page}Page`).classList.add('active');

        if (page === 'orders') loadOrders();
        else if (page === 'employees') loadEmployees();
        else if (page === 'revenue') loadRevenue();
    });
});

// Logout
if (logoutNav) {
    logoutNav.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('adminName');
        window.location.href = 'login.html';
    });
}

// Order filter buttons
document.querySelectorAll('[data-order-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-order-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentOrderFilter = btn.dataset.orderFilter;
        renderOrdersTable();
    });
});

// Refresh buttons
document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);
document.getElementById('refreshEmployeesBtn')?.addEventListener('click', loadEmployees);
document.getElementById('refreshRevenueBtn')?.addEventListener('click', loadRevenue);

// Modal confirmation
confirmYes.addEventListener('click', async () => {
    confirmModal.classList.remove('show');
    if (currentAction === 'complete' && currentOrderIdForAction) {
        await confirmOrder(currentOrderIdForAction);
    } else if (currentAction === 'finish' && currentOrderIdForAction) {
        await finishOrder(currentOrderIdForAction);
    } else if (currentAction === 'deny' && currentOrderIdForAction) {
        await denyOrder(currentOrderIdForAction);
    }
    currentOrderIdForAction = null;
    currentAction = null;
});

confirmNo.addEventListener('click', () => {
    confirmModal.classList.remove('show');
    currentOrderIdForAction = null;
    currentAction = null;
});

async function loadOrders() {
    if (!ordersTableBody) return;
    ordersTableBody.innerHTML = '<tr><td colspan="7" class="loading-cell"><div class="spinner"></div> Loading...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/order?filter=all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Cannot fetch orders');

        allOrders = await res.json();

        // Load order details for each order
        for (const order of allOrders) {
            const detailsRes = await fetch(`${API_BASE}/api/OrderDetail/order/${order.orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailsRes.ok) {
                order.details = await detailsRes.json();
            }
        }

        // Sort orders by OrderDate ascending (oldest first)
        allOrders.sort((a, b) => {
            return new Date(a.orderDate) - new Date(b.orderDate);
        });

        renderOrdersTable();
    } catch (error) {
        console.error('Load orders error:', error);
        ordersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Failed to load orders</td></tr>';
    }
}

function renderOrdersTable() {
    let filteredOrders = [...allOrders];

    switch (currentOrderFilter) {
        case 'processing':
            filteredOrders = allOrders.filter(o =>
                !o.isFinished &&
                o.paymentStatus !== 'Paid' &&
                o.paymentStatus !== 'Suspended' &&
                o.details?.some(d => d.status !== 'Completed' && d.status !== 'Cancelled')
            );
            break;
        case 'completed':
            filteredOrders = allOrders.filter(o => o.paymentStatus === 'Paid');
            break;
        case 'suspended':
            filteredOrders = allOrders.filter(o => o.paymentStatus === 'Suspended');
            break;
        default:
            break;
    }

    if (filteredOrders.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">No orders found</td></tr>';
        return;
    }

    ordersTableBody.innerHTML = filteredOrders.map(order => {
        const hasPendingOrProcessing = order.details?.some(d =>
            d.status === 'Pending' || d.status === 'Processing'
        );

        // Tất cả items đã Completed hoặc Cancelled
        const allItemsDone = order.details?.length > 0 &&
            order.details.every(d => d.status === 'Completed' || d.status === 'Cancelled');

        // Finish: khách đã Paid + tất cả items xong + order chưa finish
        const canFinish = allItemsDone && order.paymentStatus === 'Paid' && !order.isFinished;

        // Cancel: còn item đang xử lý, chưa finish
        const canDeny = hasPendingOrProcessing && !order.isFinished;

        return `
            <tr>
                <td>#${order.orderId}</td>
                <td>${escapeHtml(order.customerName || 'N/A')}</td>
                <td>${new Date(order.orderDate).toLocaleString()}</td>
                <td>${order.totalItems || 0}</td>
                <td>${formatCurrencyUSD(order.totalAmount)}</td>
                <td>
                    <span class="status-badge ${getStatusClass(order)}">
                        ${getOrderStatusText(order)}
                    </span>
                </td>
                <td>
                    <button class="action-btn btn-view" onclick="viewOrderDetails(${order.orderId})">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    ${canFinish ? `
                        <button class="action-btn btn-complete" onclick="openConfirmModal(${order.orderId}, 'finish')">
                            <i class="fa-solid fa-flag-checkered"></i> Finish
                        </button>
                    ` : ''}
                    ${canDeny ? `
                        <button class="action-btn btn-deny" onclick="openConfirmModal(${order.orderId}, 'deny')">
                            <i class="fa-solid fa-times"></i> Cancel Order
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function getOrderStatusText(order) {
    if (order.isFinished && order.paymentStatus === 'Paid') return 'Completed';
    if (order.paymentStatus === 'Suspended') return 'Suspended';
    if (order.paymentStatus === 'Cancelled') return 'Cancelled';
    if (order.paymentStatus === 'Paid') return 'Paid – Awaiting Confirmation';

    if (order.details) {
        const allDone = order.details.every(d => d.status === 'Completed' || d.status === 'Cancelled');
        if (allDone && order.details.length > 0) return 'All Items Done';

        const hasProcessing = order.details.some(d => d.status === 'Processing');
        if (hasProcessing) return 'Processing';

        const hasPending = order.details.some(d => d.status === 'Pending');
        if (hasPending) return 'Pending';
    }
    return 'Processing';
}

function getStatusClass(order) {
    if (order.isFinished && order.paymentStatus === 'Paid') return 'status-completed';
    if (order.paymentStatus === 'Suspended') return 'status-cancelled';
    if (order.paymentStatus === 'Cancelled') return 'status-cancelled';
    if (order.paymentStatus === 'Paid') return 'status-ready';
    const allDone = order.details?.length > 0 &&
        order.details.every(d => d.status === 'Completed' || d.status === 'Cancelled');
    if (allDone) return 'status-ready';
    return 'status-processing';
}

async function confirmOrder(orderId) {
    try {
        const res = await fetch(`${API_BASE}/api/order/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paymentStatus: 'Paid' })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Cannot confirm payment');
        }

        const result = await res.json();
        showToast(result.message);
        await loadOrders();
        await loadRevenue();

    } catch (error) {
        console.error('Confirm order error:', error);
        showToast(error.message, 'error');
    }
}

async function finishOrder(orderId) {
    try {
        const res = await fetch(`${API_BASE}/api/order/${orderId}/confirm`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Cannot finish order');
        }

        const result = await res.json();
        showToast(result.message);
        await loadOrders();

    } catch (error) {
        console.error('Finish order error:', error);
        showToast(error.message, 'error');
    }
}

async function denyOrder(orderId) {
    try {
        // Get all order details for this order
        const detailsRes = await fetch(`${API_BASE}/api/OrderDetail/order/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!detailsRes.ok) throw new Error('Cannot fetch order details');
        const details = await detailsRes.json();

        let allSuccess = true;

        // Update each detail to Cancelled
        for (const detail of details) {
            if (detail.status !== 'Completed' && detail.status !== 'Cancelled') {
                const cancelRes = await fetch(`${API_BASE}/api/OrderDetail/${detail.orderDetailId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'Cancelled' })
                });
                if (!cancelRes.ok) allSuccess = false;
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Update order to Cancelled
        const orderRes = await fetch(`${API_BASE}/api/order/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paymentStatus: 'Cancelled' })
        });

        if (!orderRes.ok) {
            const error = await orderRes.json();
            throw new Error(error.message || 'Cannot cancel order');
        }

        if (allSuccess) {
            showToast(`Order #${orderId} has been cancelled!`);
            await loadOrders();
            await loadRevenue();
        } else {
            showToast('Some updates failed', 'error');
        }
    } catch (error) {
        console.error('Deny order error:', error);
        showToast(error.message, 'error');
    }
}

window.viewOrderDetails = async function (orderId) {
    try {
        const res = await fetch(`${API_BASE}/api/order/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Cannot fetch order details');

        const order = await res.json();

        let itemsHtml = '';
        let total = 0;

        if (order.items && order.items.length > 0) {
            itemsHtml = order.items.map(item => {
                const subtotal = item.subtotal || (item.unitPrice * item.quantity);
                total += subtotal;
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                        <div>
                            <strong>${escapeHtml(item.foodName)}</strong> x ${item.quantity}
                            <div style="font-size: 12px; color: #666;">Unit: ${formatCurrencyUSD(item.unitPrice)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div>${formatCurrencyUSD(subtotal)}</div>
                            <span class="status-badge ${item.status === 'Completed' ? 'status-completed' : item.status === 'Cancelled' ? 'status-cancelled' : item.status === 'Ready' ? 'status-processing' : 'status-processing'}">
                                ${item.status}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            itemsHtml = '<p>No items in this order.</p>';
        }

        const modalHtml = `
            <div style="max-width: 550px; margin: 0 auto;">
                <h3 style="color: var(--dark-green); margin-bottom: 20px;">Order #${order.orderId}</h3>
                <p><strong><i class="fa-solid fa-user"></i> Customer:</strong> ${escapeHtml(order.customerName)}</p>
                <p><strong><i class="fa-regular fa-calendar"></i> Date:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
                <p><strong><i class="fa-solid fa-credit-card"></i> Payment Status:</strong> ${order.paymentStatus || 'Unpaid'}</p>
                <p><strong><i class="fa-solid fa-flag-checkered"></i> Order Status:</strong> ${order.isFinished ? 'Completed' : 'In Progress'}</p>
                <hr>
                <h4>Order Items:</h4>
                ${itemsHtml}
                <hr>
                <div style="display: flex; justify-content: space-between; font-weight: 800; margin-top: 15px; font-size: 18px;">
                    <span>Total:</span>
                    <span style="color: var(--dark-green);">${formatCurrencyUSD(total)}</span>
                </div>
                <button onclick="closeDetailModal()" class="refresh-btn" style="margin-top: 20px; width: 100%;">Close</button>
            </div>
        `;

        showModal(modalHtml);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

function showModal(html) {
    let modal = document.getElementById('dynamicModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dynamicModal';
        modal.className = 'modal-custom';
        modal.innerHTML = `<div class="modal-content-custom" style="max-width: 650px; max-height: 80vh; overflow-y: auto;"></div>`;
        document.body.appendChild(modal);
    }
    modal.querySelector('.modal-content-custom').innerHTML = html;
    modal.classList.add('show');
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('show');
    };
}

window.closeDetailModal = function () {
    const modal = document.getElementById('dynamicModal');
    if (modal) modal.classList.remove('show');
};

function openConfirmModal(orderId, action) {
    currentOrderIdForAction = orderId;
    currentAction = action;
    confirmMessage.textContent = action === 'finish'
        ? `Mark order #${orderId} as finished? All items must be Completed or Cancelled.`
        : action === 'complete'
            ? `Confirm payment for order #${orderId}? This will mark the order as Paid.`
            : `Cancel order #${orderId}? This cannot be undone.`;
    confirmModal.classList.add('show');
}

async function loadEmployees() {
    if (!employeesTableBody) return;
    employeesTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell"><div class="spinner"></div> Loading...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/User/chefs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Cannot fetch employees');

        const chefs = await res.json();

        if (chefs.length === 0) {
            employeesTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">No chefs found</td></tr>';
            return;
        }

        employeesTableBody.innerHTML = chefs.map(user => `
            <tr>
                <td>${user.userId}</td>
                <td>${escapeHtml(user.fullName || user.username)}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.email}</td>
                <td><span class="status-badge status-completed">Active</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load employees error:', error);
        employeesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Failed to load employees</td></tr>';
    }
}

async function loadRevenue() {
    if (!revenueTableBody) return;
    revenueTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell"><div class="spinner"></div> Loading...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/order?filter=all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Cannot fetch revenue data');

        const orders = await res.json();

        // Calculate statistics
        const completedOrders = orders.filter(o => o.isFinished && o.paymentStatus === 'Paid');
        const processingOrders = orders.filter(o => !o.isFinished && o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Cancelled');
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        document.getElementById('totalRevenue').innerHTML = formatCurrencyUSD(totalRevenue);
        document.getElementById('completedOrdersCount').textContent = completedOrders.length;
        document.getElementById('processingOrdersCount').textContent = processingOrders.length;

        if (completedOrders.length === 0) {
            revenueTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">No completed orders</td></tr>';
            return;
        }

        // Sort completed orders by OrderDate ascending
        completedOrders.sort((a, b) => {
            return new Date(a.orderDate) - new Date(b.orderDate);
        });

        revenueTableBody.innerHTML = completedOrders.map(order => `
            <tr>
                <td>#${order.orderId}</td>
                <td>${escapeHtml(order.customerName || 'N/A')}</td>
                <td>${new Date(order.orderDate).toLocaleString()}</td>
                <td>${new Date(order.orderDate).toLocaleString()}</td>
                <td style="font-weight: 700; color: var(--dark-green);">${formatCurrencyUSD(order.totalAmount)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load revenue error:', error);
        revenueTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Failed to load revenue</td></tr>';
    }
}

// Format currency as USD
function formatCurrencyUSD(amount) {
    if (amount === undefined || amount === null) return '$0';
    if (amount % 1 === 0) {
        return `$${amount.toLocaleString('en-US')}`;
    }
    return `$${amount.toFixed(2)}`;
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
let autoRefreshInterval = null;

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        loadOrders();
        loadRevenue();
    }, 30000);
}

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    const adminName = localStorage.getItem('adminName') || 'Admin';
    const adminNameSpan = document.getElementById('adminName');
    if (adminNameSpan) adminNameSpan.textContent = adminName;
    loadOrders();
    loadEmployees(); // Preload employees but keep hidden
    startAutoRefresh();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
});