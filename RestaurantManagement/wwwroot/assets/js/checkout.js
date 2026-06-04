const API_BASE = 'https://localhost:7037';
const CHECKOUT_CART_KEY = 'checkout_cart';

let orderItems = [];
let isProcessing = false;
let currentOrderId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOrderFromCart();
    setupPaymentOptions();
    document.getElementById('payBtn').addEventListener('click', processPayment);
});

function loadOrderFromCart() {
    const savedCart = sessionStorage.getItem(CHECKOUT_CART_KEY);

    if (!savedCart) {
        showError('No items in cart. Please go back and add items.');
        return;
    }

    try {
        orderItems = JSON.parse(savedCart);
        if (orderItems.length === 0) {
            showError('Your cart is empty.');
            return;
        }
        renderOrderSummary();
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('checkoutContent').style.display = 'grid';
    } catch (e) {
        showError('Invalid cart data.');
    }
}

function renderOrderSummary() {
    const container = document.getElementById('orderItems');
    let total = 0;

    container.innerHTML = orderItems.map(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
            <div class="checkout-item">
                <div class="checkout-item-info">
                    <div class="checkout-item-name">${escapeHtml(item.name)}</div>
                    <div class="checkout-item-price">${formatCurrencyUSD(item.price)}</div>
                </div>
                <div class="checkout-item-quantity">x${item.quantity}</div>
                <div class="checkout-item-subtotal">${formatCurrencyUSD(subtotal)}</div>
            </div>
        `;
    }).join('');

    document.getElementById('orderTotal').textContent = formatCurrencyUSD(total);
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
    if (isProcessing) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        showError('Please login to continue');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    isProcessing = true;
    const payBtn = document.getElementById('payBtn');
    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="spinner-custom" style="width:20px;height:20px;margin-right:10px;"></span> Processing...';

    try {
        const userInfo = await fetchUserInfo(token);
        if (!userInfo) throw new Error('Cannot get user information');

        // BƯỚC 1: Tạo Order MỚI (không dùng order cũ)
        currentOrderId = await createNewOrder(token);
        console.log(`Created new order: ${currentOrderId}`);

        // BƯỚC 2: Tạo OrderDetail mới (mặc định status = "Pending")
        const createdDetails = await createOrderDetails(token, currentOrderId, orderItems);

        if (!createdDetails || createdDetails.length === 0) {
            throw new Error('No items were added to the order');
        }

        // BƯỚC 3: Lấy thông tin Order để hiển thị receipt
        const fullOrder = await fetchOrderDetails(token, currentOrderId);

        // BƯỚC 4: Xóa dữ liệu giỏ hàng
        clearAllCartData();

        // BƯỚC 5: Hiển thị receipt
        showReceipt(fullOrder, createdDetails);

    } catch (error) {
        console.error('Payment error:', error);
        showError(error.message || 'Payment failed. Please try again.');
    } finally {
        isProcessing = false;
        payBtn.disabled = false;
        payBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm & Pay';
    }
}

// Tạo order MỚI - không tìm kiếm order cũ
async function createNewOrder(token) {
    const createRes = await fetch(`${API_BASE}/api/order`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!createRes.ok) {
        const error = await createRes.text();
        throw new Error(`Cannot create order: ${error}`);
    }

    const result = await createRes.json();
    return result.orderId;
}

async function createOrderDetails(token, orderId, items) {
    const createdDetails = [];

    for (const item of items) {
        const payload = {
            orderId: orderId,
            items: [{ foodId: item.foodId, quantity: item.quantity }]
        };

        const createRes = await fetch(`${API_BASE}/api/OrderDetail`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error(`Failed to add item ${item.name}:`, errorText);
            throw new Error(`Cannot add item ${item.name} to order`);
        }

        const result = await createRes.json();

        if (result.items && result.items.length > 0) {
            for (const detail of result.items) {
                createdDetails.push({
                    orderDetailId: detail.orderDetailId,
                    foodName: detail.foodName || item.name,
                    quantity: detail.quantity,
                    unitPrice: detail.unitPrice,
                    subtotal: detail.subtotal || (detail.unitPrice * detail.quantity),
                    status: detail.status || 'Pending'
                });
            }
        }
    }

    if (createdDetails.length === 0) {
        throw new Error('No items were added to the order');
    }

    return createdDetails;
}

function clearAllCartData() {
    localStorage.removeItem('restaurant_cart');
    sessionStorage.removeItem(CHECKOUT_CART_KEY);
    if (typeof cartManager !== 'undefined' && cartManager) {
        cartManager.items = [];
        cartManager.saveCart();
    }
    orderItems = [];
}

async function fetchUserInfo(token) {
    try {
        const res = await fetch(`${API_BASE}/api/User/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Unauthorized');
        return await res.json();
    } catch (e) {
        console.error('Fetch user error:', e);
        return null;
    }
}

async function fetchOrderDetails(token, orderId) {
    const res = await fetch(`${API_BASE}/api/order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Cannot fetch order details');
    return await res.json();
}

function showReceipt(order, createdDetails) {
    const receiptBody = document.getElementById('receiptBody');

    let total = 0;
    let itemsHtml = '';

    if (createdDetails && createdDetails.length > 0) {
        itemsHtml = createdDetails.map(detail => {
            const subtotal = detail.subtotal || (detail.unitPrice * detail.quantity);
            total += subtotal;
            return `
                <div class="receipt-item">
                    <span>${escapeHtml(detail.foodName)} x ${detail.quantity}</span>
                    <span>${formatCurrencyUSD(subtotal)}</span>
                    <span class="status-badge status-pending" style="margin-left: 10px;">${detail.status || 'Pending'}</span>
                </div>
            `;
        }).join('');
    }

    receiptBody.innerHTML = `
        <div class="receipt-items">
            ${itemsHtml || '<p>No items in order.</p>'}
        </div>
        <div class="receipt-total">
            <span>Total:</span>
            <span>${formatCurrencyUSD(total)}</span>
        </div>
        <p style="margin-top: 15px; color: #666; font-size: 13px;">
            <i class="fa-regular fa-clock"></i> Order #${order.orderId || currentOrderId || 'N/A'}<br>
            <i class="fa-regular fa-hourglass-half"></i> Status: Pending (waiting for chef)<br>
            Thank you for your order!
        </p>
    `;

    document.getElementById('receiptModal').classList.add('show');
}

function closeReceipt() {
    const modal = document.getElementById('receiptModal');
    modal.classList.remove('show');
    window.location.href = 'menu.html';
}

function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMsg').textContent = message;
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