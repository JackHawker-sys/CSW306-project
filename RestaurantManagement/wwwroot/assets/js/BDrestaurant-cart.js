// Requires: cart.js (CartManager, initCartUI, updateCartBadge, renderCartSidebar,
//                     showToast, escapeHtml, fetchCurrentOrderId)

// const ORDER_URL = `${API_BASE}/api/Order`;
let currentOrderId = null;

document.addEventListener('DOMContentLoaded', async function () {
    // Xử lý tất cả nút Order Now trong section food-menu
    const orderButtons = document.querySelectorAll('.food .order-btn');
    orderButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'menu.html';
        });
    });

    // Khởi tạo cart UI (dùng hàm chung từ cart.js)
    initCartUI({
        getCurrentOrderId: () => currentOrderId,
        onOrderClosed: () => {
            currentOrderId = null;
        }
    });

    // Lấy orderId hiện tại (dùng hàm chung từ cart.js)
    currentOrderId = await fetchCurrentOrderId();
});