const filterBtns = document.querySelectorAll('.filter-btn');
        const orderCards = document.querySelectorAll('.order-card');
        const ordersList = document.getElementById('ordersList');
        const themeToggle = document.getElementById('themeToggle');

        // Theme toggle functionality
        const currentTheme = localStorage.getItem('theme') || 'light';
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.textContent = '☀️';
        }

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            
            if (document.body.classList.contains('dark-mode')) {
                themeToggle.textContent = '☀️';
                localStorage.setItem('theme', 'dark');
            } else {
                themeToggle.textContent = '🌙';
                localStorage.setItem('theme', 'light');
            }
        });

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active button
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;
                let visibleCount = 0;

                // Filter orders
                orderCards.forEach(card => {
                    const status = card.dataset.status;
                    if (filter === 'all' || status === filter) {
                        card.style.display = 'block';
                        visibleCount++;
                    } else {
                        card.style.display = 'none';
                    }
                });

                // Show empty state if no orders
                if (visibleCount === 0) {
                    showEmptyState(filter);
                } else {
                    removeEmptyState();
                }
            });
        });

        function showEmptyState(filter) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.id = 'emptyState';
            emptyState.innerHTML = `
                <div class="empty-icon">📦</div>
                <h2>No ${filter} orders</h2>
                <p>You don't have any ${filter} orders at the moment</p>
                <button class="action-btn" onclick="window.location.reload()">View All Orders</button>
            `;
            ordersList.appendChild(emptyState);
        }

        function removeEmptyState() {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.remove();
            }
        }

        document.querySelector('.logout-btn').addEventListener('click', () => {
            alert('Logging out...');
        });