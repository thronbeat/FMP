const searchInput = document.getElementById('searchInput');
        const categoryFilter = document.getElementById('categoryFilter');
        const sortFilter = document.getElementById('sortFilter');
        const productsGrid = document.getElementById('productsGrid');
        const productCards = Array.from(document.querySelectorAll('.product-card'));

        function filterAndSortProducts() {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedCategory = categoryFilter.value;
            const sortBy = sortFilter.value;

            // Filter products
            let visibleProducts = productCards.filter(card => {
                const title = card.querySelector('.product-title').textContent.toLowerCase();
                const category = card.dataset.category;
                
                const matchesSearch = title.includes(searchTerm);
                const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
                
                if (matchesSearch && matchesCategory) {
                    card.style.display = 'block';
                    return true;
                } else {
                    card.style.display = 'none';
                    return false;
                }
            });

            // Sort products
            visibleProducts.sort((a, b) => {
                switch(sortBy) {
                    case 'price-low':
                        return parseFloat(a.dataset.price) - parseFloat(b.dataset.price);
                    case 'price-high':
                        return parseFloat(b.dataset.price) - parseFloat(a.dataset.price);
                    case 'rating':
                        const ratingA = parseFloat(a.querySelector('.rating-text').textContent);
                        const ratingB = parseFloat(b.querySelector('.rating-text').textContent);
                        return ratingB - ratingA;
                    default:
                        return 0;
                }
            });

            // Reorder in DOM
            visibleProducts.forEach(card => productsGrid.appendChild(card));
        }

        searchInput.addEventListener('input', filterAndSortProducts);
        categoryFilter.addEventListener('change', filterAndSortProducts);
        sortFilter.addEventListener('change', filterAndSortProducts);

        // Add to cart functionality
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.product-card');
                const title = card.querySelector('.product-title').textContent;
                const originalText = btn.textContent;
                
                btn.textContent = 'Added ✓';
                btn.style.background = '#059669';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 1500);
            });
        });

        // Logout functionality
        document.querySelector('.logout-btn').addEventListener('click', () => {
            alert('Logging out...');
        });