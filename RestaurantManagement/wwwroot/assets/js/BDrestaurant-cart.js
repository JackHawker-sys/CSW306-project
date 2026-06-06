const API_BASE = 'https://localhost:7037';
const ORDER_URL = `${API_BASE}/api/Order`;
document.addEventListener('DOMContentLoaded', function () {
    // Xử lý tất cả nút Order Now trong section food-menu
    const orderButtons = document.querySelectorAll('.food .order-btn');

    orderButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            window.location.href = 'menu.html';
        });
    });

    initCartUIStatic();
});

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 140px;
        right: 90px;
        background: ${type === 'error' ? '#dc3545' : 'var(--dark-green, #006400)'};
        color: var(--main-yellow, #FFD700);
        padding: 10px 20px;
        border-radius: 30px;
        z-index: 1002;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: fadeOut 2s forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function updateCartBadgeStatic() {
    const badge = document.getElementById('cartBadge');
    if (badge && typeof cartManager !== 'undefined') {
        const total = cartManager.getTotalItems();
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }
}

function initCartUIStatic() {
    const cartIcon = document.getElementById('cartIcon');
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!cartIcon || !cartSidebar) return;

    cartIcon.addEventListener('click', () => {
        cartSidebar.classList.add('open');
        if (cartOverlay) cartOverlay.classList.add('show');
        renderCartSidebarStatic();
    });

    const closeCart = () => {
        cartSidebar.classList.remove('open');
        if (cartOverlay) cartOverlay.classList.remove('show');
    };
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (typeof cartManager === 'undefined') return;
            const items = cartManager.getItems();
            if (items.length === 0) return;
            sessionStorage.setItem('checkout_cart', JSON.stringify(items));
            window.location.href = 'checkout.html';
        });
    }

    if (typeof cartManager !== 'undefined') {
        cartManager.addUpdateListener(() => {
            updateCartBadgeStatic();
            renderCartSidebarStatic();
        });
    }

    updateCartBadgeStatic();
}

function renderCartSidebarStatic() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');

    if (!container || typeof cartManager === 'undefined') return;

    const items = cartManager.getItems();

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        if (footer) footer.style.display = 'none';
        return;
    }

    if (footer) footer.style.display = 'block';
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = `$${cartManager.getTotalPrice().toFixed(2)}`;

    container.innerHTML = items.map(item => `
        <div class="cart-item" data-food-id="${item.foodId}">
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">$${Number(item.price).toFixed(2)}</div>
            </div>
            <div class="cart-item-controls">
                <button class="cart-decr">-</button>
                <span class="cart-item-quantity">${item.quantity}</span>
                <button class="cart-incr">+</button>
                <button class="remove-item">🗑️</button>
            </div>
            <div class="cart-item-subtotal">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `).join('');

    document.querySelectorAll('.cart-incr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const foodId = parseInt(btn.closest('.cart-item').dataset.foodId);
            if (typeof cartManager !== 'undefined') cartManager.updateQuantity(foodId, 1);
        });
    });
    document.querySelectorAll('.cart-decr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const foodId = parseInt(btn.closest('.cart-item').dataset.foodId);
            if (typeof cartManager !== 'undefined') cartManager.updateQuantity(foodId, -1);
        });
    });
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const foodId = parseInt(btn.closest('.cart-item').dataset.foodId);
            if (typeof cartManager !== 'undefined') cartManager.removeItem(foodId);
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}