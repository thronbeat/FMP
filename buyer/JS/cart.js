function updateQuantity(id, change) {
            const qtyElement = document.getElementById(`qty-${id}`);
            const priceElement = document.getElementById(`price-${id}`);
            const cartItem = document.querySelector(`[data-id="${id}"]`);
            const unitPrice = parseFloat(cartItem.dataset.price);
            
            let quantity = parseInt(qtyElement.textContent);
            quantity = Math.max(1, quantity + change);
            
            qtyElement.textContent = quantity;
            priceElement.textContent = `$${(unitPrice * quantity).toFixed(2)}`;
            
            updateSummary();
        }

        function removeItem(id) {
            const item = document.querySelector(`[data-id="${id}"]`);
            item.style.transform = 'translateX(-100%)';
            item.style.opacity = '0';
            item.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                item.remove();
                updateSummary();
                checkEmptyCart();
            }, 300);
        }

        function updateSummary() {
            const items = document.querySelectorAll('.cart-item');
            let subtotal = 0;
            
            items.forEach(item => {
                const id = item.dataset.id;
                const unitPrice = parseFloat(item.dataset.price);
                const quantity = parseInt(document.getElementById(`qty-${id}`).textContent);
                subtotal += unitPrice * quantity;
            });
            
            const shipping = 5.00;
            const tax = subtotal * 0.10;
            const discount = 2.00;
            const total = subtotal + shipping + tax - discount;
            
            document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
            document.getElementById('shipping').textContent = `$${shipping.toFixed(2)}`;
            document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
            document.getElementById('discount').textContent = `-$${discount.toFixed(2)}`;
            document.getElementById('total').textContent = `$${total.toFixed(2)}`;
        }

        function checkEmptyCart() {
            const cartItems = document.getElementById('cartItems');
            if (cartItems.children.length === 0) {
                document.querySelector('.cart-layout').innerHTML = `
                    <div class="empty-cart" style="grid-column: 1 / -1;">
                        <div class="empty-cart-icon">🛒</div>
                        <h2>Your cart is empty</h2>
                        <p>Add some products to your cart to get started</p>
                        <button class="checkout-btn" onclick="continueShopping()">Browse Products</button>
                    </div>
                `;
            }
        }

        function checkout() {
            alert('Proceeding to checkout...');
        }

        function continueShopping() {
            alert('Returning to marketplace...');
        }

        document.querySelector('.logout-btn').addEventListener('click', () => {
            alert('Logging out...');
        });