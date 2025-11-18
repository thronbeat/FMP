// Add click handlers for interactive elements
        document.querySelector('.logout-btn').addEventListener('click', () => {
            alert('Logout clicked!');
        });

        document.querySelectorAll('.action-item').forEach(item => {
            item.addEventListener('click', () => {
                const title = item.querySelector('.action-title').textContent;
                alert(`Navigating to: ${title}`);
            });
        });

        // document.querySelectorAll('.nav-links a').forEach(link => {
        //     link.addEventListener('click', (e) => {
        //         e.preventDefault();
        //         document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
        //         link.classList.add('active');
        //     });
        // });