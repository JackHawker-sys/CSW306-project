const API_BASE = 'https://localhost:7037/api';

const token = localStorage.getItem('authToken');
if (!token) {
    window.location.href = 'login.html';
}

// Nav: inject Login/Logout
const profileNavItem = document.querySelector('.primary-menu > ul > li.page');
if (!token) {
    if (profileNavItem) profileNavItem.style.display = 'none';
    document.querySelector('.primary-menu ul').insertAdjacentHTML('beforeend', `<li><a href="login.html">Login</a></li>`);
} else {
    document.querySelector('.primary-menu ul').insertAdjacentHTML('beforeend', `<li><a href="#" id="logout-btn">Logout</a></li>`);
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        window.location.href = 'BDrestaurant.html';
    });
}

// Hamburger menu
const openMenu = document.querySelector('#hamburger');
const closeMenu = document.querySelector('#close-btn');
const primaryMenu = document.querySelector('#primary-menu');
const overlay = document.querySelector('#overlay');

openMenu.addEventListener('click', function () {
    primaryMenu.classList.add('active');
    closeMenu.style.display = 'block';
    overlay.style.display = 'block';
});
closeMenu.addEventListener('click', function () {
    primaryMenu.classList.remove('active');
    closeMenu.style.display = 'none';
    overlay.style.display = 'none';
});

// Go top
(function () {
    const btn = document.getElementById('goTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('show', window.scrollY > 120);
    }, { passive: true });
})();

// Footer
document.querySelector('#footer-btn').addEventListener('click', function () {
    const FEmail = document.querySelector('#footer-email');
    const FEmailE = document.querySelector('#f-email-error');
    FEmailE.innerText = FEmail.value ? '' : '*Email must be filled!';
});

function formatMoney(amount) {
    return '$' + Number(amount).toFixed(2);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Modal helpers ──────────────────────────────────────────
function openModal(html) {
    document.getElementById('detailModalBody').innerHTML = html;
    document.getElementById('detailModal').classList.add('active');
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// ── Fetch order detail ──────────────────────────────────────
async function viewDetail(orderId) {
    openModal(`<div class="modal-loading"><i class="fa-solid fa-circle-notch"></i><p>Loading...</p></div>`);

    try {
        const res = await fetch(`${API_BASE}/Order/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const order = JSON.parse(text);
        openModal(renderDetailHTML(order));

    } catch (err) {
        openModal(`<div class="modal-error"><i class="fa-solid fa-circle-exclamation"></i><p>${err.message}</p></div>`);
    }
}

function renderDetailHTML(order) {
    const rows = order.items.map(item => `
        <tr>
            <td>
                ${item.foodImage
            ? `<img src="${item.foodImage}" class="food-thumb" alt="${item.foodName}">`
            : `<div class="food-thumb-placeholder"><i class="fa-solid fa-utensils"></i></div>`}
            </td>
            <td>${item.foodName ?? '—'}</td>
            <td>${formatMoney(item.unitPrice)}</td>
            <td>${item.quantity}</td>
            <td>${formatMoney(item.subtotal)}</td>
            <td><span class="badge-status">${item.status ?? '—'}</span></td>
        </tr>`).join('');

    return `
        <div class="detail-header">
            <div><span class="order-id"><i class="fa-solid fa-hashtag"></i> Order #${order.orderId}</span></div>
            <div class="detail-meta">
                <span><i class="fa-solid fa-user"></i> ${order.customerName ?? '—'}</span>
                <span><i class="fa-solid fa-calendar"></i> ${formatDate(order.orderDate)}</span>
                <span class="${order.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${order.paymentStatus}</span>
            </div>
        </div>
        <table class="order-items-table">
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Food</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="detail-total">
            <span>Total:</span>
            <span class="order-total-amount">${formatMoney(order.totalAmount)}</span>
        </div>`;
}

// ── Load order list ─────────────────────────────────────────
async function loadOrderHistory() {
    const container = document.getElementById('historyContainer');

    try {
        const res = await fetch(`${API_BASE}/Order?filter=Paid`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const text = await res.text();
        if (res.status === 401) {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const orders = JSON.parse(text);

        if (!orders.length) {
            container.innerHTML = `
                <div class="history-empty">
                    <i class="fa-solid fa-receipt"></i>
                    <p>You have no order history yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-card-header">
                    <div>
                        <span class="order-id"><i class="fa-solid fa-hashtag"></i> Order #${order.orderId}</span>
                        <span class="order-date ms-3">${formatDate(order.orderDate)}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="${order.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">
                            ${order.paymentStatus ?? 'Unpaid'}
                        </span>
                        <button class="toggle-items-btn" onclick="viewDetail(${order.orderId})">
                            <i class="fa-solid fa-eye"></i> View Detail
                        </button>
                    </div>
                </div>
                <div class="order-card-footer">
                    <span class="order-total-label">Total Items: ${order.totalItems ?? 0} &nbsp;|&nbsp; Total:</span>
                    <span class="order-total-amount">${formatMoney(order.totalAmount)}</span>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = `
            <div class="history-error">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Cannot load order history. Please try again later.</p>
                <small style="color:#888">${err.message}</small>
            </div>`;
    }
}

document.getElementById('detailModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

loadOrderHistory();

// Move modal ra ngoài container để tránh stacking context
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('detailModal');
    if (modal) document.body.appendChild(modal);
});