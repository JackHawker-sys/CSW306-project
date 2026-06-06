const CART_STORAGE_KEY = 'restaurant_cart';
const API_BASE = 'https://localhost:7037';

// ─── CartManager ──────────────────────────────────────────────────────────────
class CartManager {
    constructor() {
        this.items = this.loadCart();
        this.updateListeners = [];
    }

    loadCart() {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }

    saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
        this.notifyListeners();
    }

    addItem(food) {
        const existing = this.items.find(item => item.foodId === food.foodId);
        if (existing) {
            existing.quantity += 1;
        } else {
            this.items.push({
                foodId: food.foodId,
                name: food.name,
                price: food.price,
                imageUrl: food.imageUrl,
                quantity: 1
            });
        }
        this.saveCart();
    }

    updateQuantity(foodId, delta) {
        const index = this.items.findIndex(item => item.foodId === foodId);
        if (index !== -1) {
            const newQuantity = this.items[index].quantity + delta;
            if (newQuantity <= 0) {
                this.items.splice(index, 1);
            } else {
                this.items[index].quantity = newQuantity;
            }
            this.saveCart();
        }
    }

    removeItem(foodId) {
        this.items = this.items.filter(item => item.foodId !== foodId);
        this.saveCart();
    }

    getTotalItems() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    getTotalPrice() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getItems() {
        return [...this.items];
    }

    clearCart() {
        this.items = [];
        this.saveCart();
    }

    addUpdateListener(callback) {
        this.updateListeners.push(callback);
    }

    notifyListeners() {
        this.updateListeners.forEach(cb => cb(this.getItems()));
    }
}

const cartManager = new CartManager();

let _getCurrentOrderId = null;

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

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

// ─── Shared Cart UI ───────────────────────────────────────────────────────────
/**
 * Cập nhật badge số lượng trên icon giỏ hàng.
 */
function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge && typeof cartManager !== 'undefined') {
        const total = cartManager.getTotalItems();
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }
}

/**
 * Render danh sách items trong sidebar giỏ hàng.
 */
function renderCartSidebar() {
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

        // Nếu đang có order chạy → hiện nút Proceed to Checkout
        const activeOrderId = typeof _getCurrentOrderId === 'function' ? _getCurrentOrderId() : null;
        if (footer && activeOrderId) {
            footer.style.display = 'block';
            const totalEl = document.getElementById('cartTotal');
            if (totalEl) totalEl.textContent = '';
            const btn = document.getElementById('checkoutBtn');
            if (btn) btn.textContent = 'Proceed to Checkout';
        } else {
            if (footer) footer.style.display = 'none';
        }
        return;
        // if (footer) footer.style.display = 'none';
        // return;
    }

    if (footer) footer.style.display = 'block';
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = `$${cartManager.getTotalPrice().toFixed(2)}`;
    const checkoutBtnEl = document.getElementById('checkoutBtn');
    if (checkoutBtnEl) checkoutBtnEl.textContent = 'Order';

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
        btn.addEventListener('click', () => {
            const foodId = parseInt(btn.closest('.cart-item').dataset.foodId);
            cartManager.updateQuantity(foodId, 1);
        });
    });
    document.querySelectorAll('.cart-decr').forEach(btn => {
        btn.addEventListener('click', () => {
            const foodId = parseInt(btn.closest('.cart-item').dataset.foodId);
            cartManager.updateQuantity(foodId, -1);
        });
    });
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const foodId = parseInt(btn.closest('.cart-item').dataset.foodId);
            cartManager.removeItem(foodId);
        });
    });
}

/**
 * Khởi tạo toàn bộ Cart UI: mở/đóng sidebar, checkout, badge.
 * @param {object} options
 * @param {number|null} options.getCurrentOrderId  - getter function trả về currentOrderId hiện tại
 * @param {function} options.onOrderClosed         - callback khi order bị đóng bất ngờ (status 400 finished)
 */
function initCartUI({ getCurrentOrderId, onOrderClosed } = {}) {
    _getCurrentOrderId = getCurrentOrderId || null;

    const cartIcon = document.getElementById('cartIcon');
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!cartIcon || !cartSidebar) return;

    // Mở sidebar
    cartIcon.addEventListener('click', () => {
        cartSidebar.classList.add('open');
        if (cartOverlay) cartOverlay.classList.add('show');
        renderCartSidebar();
    });

    // Đóng sidebar
    const closeCart = () => {
        cartSidebar.classList.remove('open');
        if (cartOverlay) cartOverlay.classList.remove('show');
    };
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    // Checkout
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            const items = cartManager.getItems();
            if (items.length === 0) {
                const activeOrderId = typeof getCurrentOrderId === 'function' ? getCurrentOrderId() : null;
                if (activeOrderId) window.location.href = 'checkout.html';
                return;
            }

            const currentOrderId = typeof getCurrentOrderId === 'function' ? getCurrentOrderId() : null;
            if (!currentOrderId) {
                showToast('You did not have any order yet. Click "Start ordering" first', 'error');
                return;
            }

            const token = localStorage.getItem('authToken');
            if (!token) {
                showToast('Please login first.', 'error');
                return;
            }

            checkoutBtn.disabled = true;
            checkoutBtn.textContent = 'Sending...';

            try {
                const res = await fetch(`${API_BASE}/api/OrderDetail`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        items: items.map(item => ({
                            foodId: item.foodId,
                            quantity: item.quantity
                        }))
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    if (res.status === 400 && data.message?.includes('finished')) {
                        if (typeof onOrderClosed === 'function') onOrderClosed();
                        showToast('⚠️ Order đã bị đóng. Vui lòng tạo order mới.', 'error');
                        return;
                    }
                    throw new Error(data.message || 'Can not send Order.');
                }

                cartManager.clearCart();
                showToast(`Ordered ${data.items.length} dishes successfully`);

            } catch (err) {
                showToast(`${err.message}`, 'error');
            } finally {
                checkoutBtn.disabled = false;
            }
        });
    }

    // Lắng nghe thay đổi cart
    cartManager.addUpdateListener(() => {
        updateCartBadge();
        renderCartSidebar();
    });

    updateCartBadge();
}

/**
 * Gọi GET /api/Order/isOrder, trả về orderId nếu có, hoặc null.
 */
async function fetchCurrentOrderId() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/api/Order/isOrder`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.hasOrder ? data.orderId : null;
    } catch {
        return null;
    }
}