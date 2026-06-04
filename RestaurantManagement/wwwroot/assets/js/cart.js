const CART_STORAGE_KEY = 'restaurant_cart';

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