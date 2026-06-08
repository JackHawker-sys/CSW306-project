// Requires: cart.js (CartManager, initCartUI, showToast, escapeHtml, fetchCurrentOrderId)

const API_URL = `${API_BASE}/api/FoodMenu`;
const ORDER_URL = `${API_BASE}/api/Order`;
const IMG_BASE = API_BASE;

let allItems = [];
let modalInstance = null;
let currentOrderId = null;

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

// ─── Init ─────────────────────────────────────────────────────────────────────
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

    initCartUI({
        getCurrentOrderId: () => currentOrderId,
        onOrderClosed: () => {
            currentOrderId = null;
            setOrderBtn('start', 'Start ordering');
        }
    });

    initOrderButton();
});

// ─── Check / tạo order ────────────────────────────────────────────────────────
async function initOrderButton() {
    const token = localStorage.getItem('authToken');
    const btn = document.getElementById('orderActionBtn');
    if (!btn) return;

    if (!token) {
        btn.style.display = 'none';
        hideTableInput();
        return;
    }

    btn.style.display = 'inline-flex';
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra...';

    currentOrderId = await fetchCurrentOrderId();

    if (currentOrderId) {
        setOrderBtn('active', `Ordering #${currentOrderId}`);
    } else {
        setOrderBtn('start', 'Start ordering');
    }
}

function setOrderBtn(state, label) {
    const btn = document.getElementById('orderActionBtn');
    if (!btn) return;

    btn.classList.remove('btn-start-order', 'btn-active-order');
    btn.disabled = false;
    btn.textContent = label;

    if (state === 'start') {
        btn.classList.add('btn-start-order');
        btn.onclick = showTableInput;
    } else {
        btn.classList.add('btn-active-order');
        btn.onclick = null;
        hideTableInput();
    }
}

function showTableInput() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showToast('Please login first', 'error');
        return;
    }

    let wrapper = document.getElementById('tableInputWrapper');
    if (wrapper) {
        // Toggle: nếu đang hiện thì ẩn đi
        wrapper.classList.toggle('visible');
        if (wrapper.classList.contains('visible')) {
            document.getElementById('tableIdInput').focus();
        }
        return;
    }

    // Tạo wrapper lần đầu
    wrapper = document.createElement('div');
    wrapper.id = 'tableInputWrapper';
    wrapper.className = 'table-input-wrapper visible';
    wrapper.innerHTML = `
        <input
            type="number"
            id="tableIdInput"
            class="table-id-input"
            placeholder="Table No."
            min="1"
            autocomplete="off"
        >
        <button id="confirmOrderBtn" class="btn-confirm-order">
            <i class="fa-solid fa-check"></i>
        </button>
        <button id="cancelOrderBtn" class="btn-cancel-order">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    const btn = document.getElementById('orderActionBtn');
    btn.parentNode.insertBefore(wrapper, btn.nextSibling);

    document.getElementById('tableIdInput').focus();

    document.getElementById('confirmOrderBtn').addEventListener('click', handleStartOrder);
    document.getElementById('cancelOrderBtn').addEventListener('click', hideTableInput);

    document.getElementById('tableIdInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleStartOrder();
        if (e.key === 'Escape') hideTableInput();
    });
}

function hideTableInput() {
    const wrapper = document.getElementById('tableInputWrapper');
    if (wrapper) {
        wrapper.classList.remove('visible');
    }
}

async function handleStartOrder() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showToast('Please login first', 'error');
        return;
    }

    const tableInput = document.getElementById('tableIdInput');
    const tableId = tableInput ? parseInt(tableInput.value, 10) : NaN;

    if (!tableId || isNaN(tableId) || tableId < 1) {
        showToast('Please enter a valid Table number.', 'error');
        if (tableInput) tableInput.focus();
        return;
    }

    const btn = document.getElementById('orderActionBtn');
    btn.disabled = true;
    btn.textContent = 'Starting...';

    try {
        const res = await fetch(ORDER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tableId })
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 400 && data.orderId) {
                currentOrderId = data.orderId;
                setOrderBtn('active', `Ordering #${currentOrderId}`);
                return;
            }
            throw new Error(data.message || 'Cannot make order.');
        }

        currentOrderId = data.orderId;
        setOrderBtn('active', `Ordering #${currentOrderId}`);
        showToast('Starting new Order!');
    } catch (err) {
        showToast(`${err.message}`, 'error');
        btn.disabled = false;
        setOrderBtn('start', 'Start ordering');
    }
}

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
        menuGrid.appendChild(createCard(food, i));
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

    wrapper.querySelector('.view-detail-btn').addEventListener('click', (e) => {
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

// ─── Giỏ hàng ─────────────────────────────────────────────────────────────────
function addToCartAndNotify(food) {
    if (typeof cartManager !== 'undefined' && cartManager) {
        cartManager.addItem(food);
        showToast(`✓ ${food.name} added to cart`);
    } else {
        console.error('Cart manager not loaded');
        showToast('⚠️ Cannot add item. Please refresh the page.', 'error');
    }
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
    if (num % 1 === 0) {
        return `$${num.toLocaleString('en-US')} / Person`;
    }
    return `$${num.toFixed(2)} / Person`;
}