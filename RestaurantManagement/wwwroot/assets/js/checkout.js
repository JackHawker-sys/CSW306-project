const CHECKOUT_CART_KEY = 'checkout_cart';

let isProcessing = false;
let currentOrderId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOrderFromServer();
    setupPaymentOptions();
    document.getElementById('payBtn').addEventListener('click', processPayment);
});

// Lấy order hiện tại từ server rồi render — không đọc sessionStorage
async function loadOrderFromServer() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showPageError('Please login to continue.');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
    }

    try {
        // Bước 1: lấy orderId đang active
        const orderId = await fetchCurrentOrderId(token);
        if (!orderId) {
            showPageError('No active order found. Please go back and add items.');
            return;
        }
        currentOrderId = orderId;

        // Bước 2: lấy chi tiết order
        const order = await fetchOrderDetails(token, orderId);
        if (!order.items || order.items.length === 0) {
            showPageError('Your order has no items.');
            return;
        }

        renderOrderSummary(order);

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('checkoutContent').style.display = 'grid';

    } catch (err) {
        showPageError(err.message || 'Cannot load order.');
    }
}

function renderOrderSummary(order) {
    const container = document.getElementById('orderItems');

    container.innerHTML = order.items.map(item => {
        const statusClass = (item.status || 'pending').toLowerCase();
        const isPending = statusClass === 'pending';

        const quantityControl = isPending
            ? `<div class="qty-control">
                   <button class="qty-btn" onclick="changeQuantity(${item.orderDetailId}, ${item.quantity - 1})">−</button>
                   <span class="qty-value">x${item.quantity}</span>
                   <button class="qty-btn" onclick="changeQuantity(${item.orderDetailId}, ${item.quantity + 1})">+</button>
               </div>`
            : `<div class="checkout-item-quantity">x${item.quantity}</div>`;

        return `
            <div class="checkout-item" id="item-${item.orderDetailId}">
                <div class="checkout-item-info">
                    <div class="checkout-item-name">
                        ${escapeHtml(item.foodName)}
                        <span class="status-badge status-${statusClass}">${item.status || 'Pending'}</span>
                    </div>
                    <div class="checkout-item-price">${formatCurrencyUSD(item.unitPrice)}</div>
                </div>
                ${quantityControl}
                <div class="checkout-item-subtotal" id="subtotal-${item.orderDetailId}">
                    ${formatCurrencyUSD(item.subtotal)}
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('orderTotal').textContent = formatCurrencyUSD(order.totalAmount);
}

//Kiểm tra số lượng
async function changeQuantity(orderDetailId, newQty) {
    if (newQty < 1) return; // không cho về 0

    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`${API_BASE}/api/OrderDetail/${orderDetailId}/quantity`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: newQty })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.message || 'Cannot update quantity.');
            return;
        }

        const result = await res.json();

        // Reload lại order để cập nhật total
        const order = await fetchOrderDetails(token, currentOrderId);
        renderOrderSummary(order);

    } catch (err) {
        alert('Error updating quantity.');
    }
}

function setupPaymentOptions() {
    const options = document.querySelectorAll('.payment-option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const radio = opt.querySelector('input');
            if (radio) radio.checked = true;
        });
    });
}

async function processPayment() {
    if (isProcessing || !currentOrderId) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        showError('Please login to continue.');
        return;
    }

    isProcessing = true;
    const payBtn = document.getElementById('payBtn');
    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="spinner-custom" style="width:20px;height:20px;margin-right:10px;"></span> Processing...';

    try {
        // PUT /api/order/{id}/status → Paid
        const res = await fetch(`${API_BASE}/api/order/${currentOrderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paymentStatus: 'Paid' })
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.message || `Payment failed (${res.status})`);
        }

        // Lấy lại order để hiển thị receipt
        const order = await fetchOrderDetails(token, currentOrderId);

        // Xóa sessionStorage cart (nếu còn)
        sessionStorage.removeItem(CHECKOUT_CART_KEY);

        showReceipt(order);

    } catch (error) {
        console.error('Payment error:', error);
        showError(error.message || 'Payment failed. Please try again.');
    } finally {
        isProcessing = false;
        payBtn.disabled = false;
        payBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm & Pay';
    }
}

async function fetchCurrentOrderId(token) {
    const res = await fetch(`${API_BASE}/api/Order/isOrder`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.hasOrder ? data.orderId : null;
}

async function fetchOrderDetails(token, orderId) {
    const res = await fetch(`${API_BASE}/api/order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Cannot fetch order details.');
    return await res.json();
}

function showReceipt(order) {
    const receiptBody = document.getElementById('receiptBody');

    const itemsHtml = (order.items || []).map(item => `
        <div class="receipt-item">
            <span>${escapeHtml(item.foodName)} x ${item.quantity}</span>
            <span>${formatCurrencyUSD(item.subtotal)}</span>
            <span class="status-badge status-${item.status?.toLowerCase()}" style="margin-left:10px;">${item.status}</span>
        </div>
    `).join('');

    receiptBody.innerHTML = `
        <div class="receipt-items">
            ${itemsHtml || '<p>No items.</p>'}
        </div>
        <div class="receipt-total">
            <span>Total:</span>
            <span>${formatCurrencyUSD(order.totalAmount)}</span>
        </div>
        <p style="margin-top:15px; color:#666; font-size:13px;">
            <i class="fa-regular fa-clock"></i> Order #${order.orderId}<br>
            <i class="fa-solid fa-circle-check" style="color:green;"></i> Payment: ${order.paymentStatus}<br>
            Thank you for your order!
        </p>
    `;

    document.getElementById('receiptModal').classList.add('show');
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('show');
    window.location.href = 'menu.html';
}

function showPageError(message) {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("pageErrorState").style.display = "block";
    document.getElementById("pageErrorMsg").textContent = message;
}

function showError(message) {
    const errorState = document.getElementById('errorState');
    const errorMsg = document.getElementById('errorMsg');
    if (errorState) errorState.style.display = 'block';
    if (errorMsg) errorMsg.textContent = message;
}

function formatCurrencyUSD(amount) {
    if (amount === undefined || amount === null) return '$0';
    if (amount % 1 === 0) return `$${amount.toLocaleString('en-US')}`;
    return `$${amount.toFixed(2)}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}