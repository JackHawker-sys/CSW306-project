const API_BASE = 'https://localhost:7037';
let currentFilter = 'all';
let allOrders = [];

// Check authentication
const token = localStorage.getItem('authToken');
if (!token) {
    window.location.href = 'login.html';
}

// DOM Elements
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const ordersTableBody = document.getElementById('ordersTableBody');
const orderDetailModal = document.getElementById('orderDetailModal');
const modalBody = document.getElementById('modalBody');

// Event Listeners
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
});

refreshBtn.addEventListener('click', () => {
    loadOrders();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderOrdersTable();
    });
});

// Load all orders from API
async function loadOrders() {
    if (!ordersTableBody) return;

    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading">
                <div class="spinner-custom"></div>
                <p>Loading orders...</p>
            </td>
        </tr>
    `;

    try {
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

        allOrders = await res.json();
        updateStats();
        renderOrdersTable();
    } catch (error) {
        console.error('Load orders error:', error);
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:red;">
                    Failed to load orders. Please check your connection.
                </td>
            </tr>
        `;
    }
}

// Update statistics cards
function updateStats() {
    const pending = allOrders.filter(o => o.paymentStatus === 'Unpaid' && !o.isFinished).length;
    const completed = allOrders.filter(o => o.isFinished).length;
    const paid = allOrders.filter(o => o.paymentStatus === 'Paid').length;
    const totalRevenue = allOrders
        .filter(o => o.paymentStatus === 'Paid')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('paidCount').textContent = paid;
    document.getElementById('totalRevenue').innerHTML = formatCurrencyVND(totalRevenue);
}

// Render orders table based on current filter
function renderOrdersTable() {
    let filteredOrders = [...allOrders];

    switch (currentFilter) {
        case 'pending':
            filteredOrders = allOrders.filter(o => o.paymentStatus === 'Unpaid' && !o.isFinished);
            break;
        case 'paid':
            filteredOrders = allOrders.filter(o => o.paymentStatus === 'Paid');
            break;
        case 'completed':
            filteredOrders = allOrders.filter(o => o.isFinished);
            break;
        default:
            break;
    }

    if (filteredOrders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">No orders found.</td>
            </tr>
        `;
        return;
    }

    ordersTableBody.innerHTML = filteredOrders.map(order => `
        <tr>
            <td>#${order.orderId}</td>
            <td>${escapeHtml(order.customerName || 'N/A')}</td>
            <td>${new Date(order.orderDate).toLocaleString()}</td>
            <td>${formatCurrencyVND(order.totalAmount)}</td>
            <td>
                <span class="status-badge ${order.paymentStatus === 'Paid' ? 'status-paid' : 'status-unpaid'}">
                    ${order.paymentStatus || 'Unpaid'}
                </span>
            </td>
            <td>
                <span class="status-badge ${order.isFinished ? 'status-finished' : 'status-pending'}">
                    ${order.isFinished ? 'Completed' : 'Pending'}
                </span>
            </td>
            <td>
                <button class="action-btn btn-view" onclick="viewOrderDetail(${order.orderId})">
                    <i class="fa-solid fa-eye"></i> View
                </button>
                ${!order.isFinished && order.paymentStatus !== 'Paid' ? `
                    <button class="action-btn btn-confirm" onclick="confirmOrder(${order.orderId})">
                        <i class="fa-solid fa-check"></i> Confirm & Pay
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// Confirm order (mark as Paid and Completed)
async function confirmOrder(orderId) {
    if (!confirm(`Confirm order #${orderId}? This will mark it as PAID and COMPLETED.`)) return;

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
            throw new Error(error.message || 'Cannot confirm order');
        }

        showToast(`Order #${orderId} has been confirmed and paid!`);
        await loadOrders();
    } catch (error) {
        console.error('Confirm order error:', error);
        showToast(error.message, 'error');
    }
}

// View order details
async function viewOrderDetail(orderId) {
    if (!orderDetailModal || !modalBody) return;

    orderDetailModal.classList.add('show');
    modalBody.innerHTML = '<div class="loading"><div class="spinner-custom"></div><p>Loading details...</p></div>';

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
                    <div class="order-detail-item">
                        <span><strong>${escapeHtml(item.foodName)}</strong> x ${item.quantity}</span>
                        <span>${formatCurrencyVND(subtotal)}</span>
                    </div>
                `;
            }).join('');
        } else {
            itemsHtml = '<p>No items in this order.</p>';
        }

        modalBody.innerHTML = `
            <p><strong>Order ID:</strong> #${order.orderId}</p>
            <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
            <p><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
            <p><strong>Payment Status:</strong> ${order.paymentStatus || 'Unpaid'}</p>
            <p><strong>Status:</strong> ${order.isFinished ? 'Completed' : 'Pending'}</p>
            <hr>
            <h4>Order Items:</h4>
            ${itemsHtml}
            <hr>
            <div style="display:flex; justify-content:space-between; font-weight:800; margin-top:15px;">
                <span>Total:</span>
                <span>${formatCurrencyVND(total)}</span>
            </div>
        `;
    } catch (error) {
        modalBody.innerHTML = `<p style="color:red;">Error loading details: ${error.message}</p>`;
    }
}

// Close modal
function closeModal() {
    if (orderDetailModal) {
        orderDetailModal.classList.remove('show');
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-message ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Format currency to VND
function formatCurrencyVND(amount) {
    if (amount === undefined || amount === null) return '₫0';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('orderDetailModal');
    if (event.target === modal) {
        closeModal();
    }
};

// Load orders on page load
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
});