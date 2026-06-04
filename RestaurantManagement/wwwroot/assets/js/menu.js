const API_BASE = 'https://localhost:7037';
const API_URL = `${API_BASE}/api/FoodMenu`;
const IMG_BASE = API_BASE;

let allItems = [];
let modalInstance = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const menuGrid = document.getElementById('menuGrid');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMsg = document.getElementById('errorMsg');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const menuCount = document.getElementById('menuCount');

// Modal refs
const foodModal = document.getElementById('foodModal');
const modalImg = document.getElementById('modalImg');
const modalName = document.getElementById('modalName');
const modalPrice = document.getElementById('modalPrice');
const modalDesc = document.getElementById('modalDesc');

// ─── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    modalInstance = new bootstrap.Modal(foodModal);
    loadMenu();

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            const filtered = q ? allItems.filter(f =>
                f.name.toLowerCase().includes(q) ||
                (f.description && f.description.toLowerCase().includes(q))
            ) : allItems;
            renderCards(filtered);
        });
    }

    // Khởi tạo cart UI
    initCartUI();
});

// ─── Fetch menu từ API ────────────────────────────────────────────────────────
async function loadMenu() {
    showState('loading');

    try {
        const token = localStorage.getItem('authToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(API_URL, { method: 'GET', headers });

        if (!res.ok) throw new Error(`Server responded with ${res.status}`);

        const data = await res.json();
        allItems = data;

        if (allItems.length === 0) {
            showState('empty');
        } else {
            showState('grid');
            renderCards(allItems);
        }
    } catch (err) {
        console.error('Menu load error:', err);
        errorMsg.textContent = 'Could not load menu. Please check your connection or try again.';
        showState('error');
    }
}

// ─── Render cards ─────────────────────────────────────────────────────────────
function renderCards(items) {
    if (!menuGrid) return;
    menuGrid.innerHTML = '';
    if (menuCount) menuCount.textContent = items.length;

    if (items.length === 0) {
        showState('empty');
        return;
    }

    showState('grid');

    items.forEach((food, i) => {
        const card = createCard(food, i);
        menuGrid.appendChild(card);
    });
}

function createCard(food, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'food-card';
    wrapper.style.animationDelay = `${index * 0.05}s`;

    const imgHtml = food.imageUrl
        ? `<img src="${IMG_BASE}${food.imageUrl}" alt="${escapeHtml(food.name)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';

    const placeholderHtml = `
        <div class="card-img-placeholder" ${food.imageUrl ? 'style="display:none"' : ''}>
            <i class="fa-solid fa-bowl-food"></i>
        </div>`;

    const price = formatPrice(food.price);

    wrapper.innerHTML = `
        <div class="card-img-wrap">
            ${imgHtml}
            ${placeholderHtml}
        </div>
        <div class="card-body">
            <h2 class="card-name">${escapeHtml(food.name)}</h2>
            <p class="card-price">${price}</p>
            <p class="card-desc">${escapeHtml(food.description || '')}</p>
            <button class="card-footer-btn view-detail-btn">View Details</button>
        </div>`;

    // Xử lý nút View Details
    const viewBtn = wrapper.querySelector('.view-detail-btn');
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(food);
    });

    return wrapper;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(food) {
    modalName.textContent = food.name;
    modalPrice.textContent = formatPrice(food.price);
    modalDesc.textContent = food.description || 'No description available.';

    if (food.imageUrl) {
        modalImg.src = `${IMG_BASE}${food.imageUrl}`;
        modalImg.alt = food.name;
        modalImg.style.display = 'block';
        if (modalImg.parentElement) modalImg.parentElement.style.display = 'block';
    } else {
        if (modalImg.parentElement) modalImg.parentElement.style.display = 'none';
    }

    // Cập nhật nút Order trong modal
    setTimeout(() => {
        const orderBtn = document.querySelector('.modal-order-btn');
        if (orderBtn) {
            const newBtn = orderBtn.cloneNode(true);
            orderBtn.parentNode.replaceChild(newBtn, orderBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                addToCartAndNotify(food);
                modalInstance.hide();
            });
        }
    }, 100);

    modalInstance.show();
}

// ─── Giỏ hàng ────────────────────────────────────────────────────────────────
function addToCartAndNotify(food) {
    if (typeof cartManager !== 'undefined' && cartManager) {
        cartManager.addItem(food);
        showToast(`✓ ${food.name} added to cart`);
    } else {
        console.error('Cart manager not loaded');
        showToast(`⚠️ Cannot add item. Please refresh the page.`, 'error');
    }
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

// ─── Cart UI ─────────────────────────────────────────────────────────────────
function initCartUI() {
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

    // Thanh toán
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (typeof cartManager === 'undefined') return;
            const items = cartManager.getItems();
            if (items.length === 0) return;
            sessionStorage.setItem('checkout_cart', JSON.stringify(items));
            window.location.href = 'checkout.html';
        });
    }

    // Cập nhật badge khi cart thay đổi
    if (typeof cartManager !== 'undefined') {
        cartManager.addUpdateListener(() => {
            updateCartBadge();
            renderCartSidebar();
        });
    }

    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge && typeof cartManager !== 'undefined') {
        const total = cartManager.getTotalItems();
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }
}

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

    // Gắn sự kiện
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function showState(state) {
    if (loadingState) loadingState.style.display = state === 'loading' ? 'block' : 'none';
    if (errorState) errorState.style.display = state === 'error' ? 'block' : 'none';
    if (emptyState) emptyState.style.display = state === 'empty' ? 'block' : 'none';
    if (menuGrid) menuGrid.style.display = state === 'grid' ? 'grid' : 'none';
}

function formatPrice(price) {
    if (price == null) return '';
    const num = Number(price);
    // Nếu price là số nguyên (40000) thì hiển thị không có .00
    if (num % 1 === 0) {
        return `$${num.toLocaleString('en-US')} / Person`;
    }
    return `$${num.toFixed(2)} / Person`;
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}