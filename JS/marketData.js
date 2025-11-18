const canvas = document.getElementById('priceChart');
        const ctx = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const data = [
            {day: 'Mon', price: 2.3},
            {day: 'Tue', price: 2.5},
            {day: 'Wed', price: 2.4},
            {day: 'Thu', price: 2.7},
            {day: 'Fri', price: 2.6},
            {day: 'Sat', price: 2.9},
            {day: 'Sun', price: 2.5}
        ];

        const padding = 40;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        
        const maxPrice = Math.max(...data.map(d => d.price));
        const minPrice = Math.min(...data.map(d => d.price));
        const priceRange = maxPrice - minPrice;

        function drawChart() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = padding + (chartHeight / 4) * i;
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(canvas.width - padding, y);
                ctx.stroke();
                
                const price = maxPrice - (priceRange / 4) * i;
                ctx.fillStyle = '#9ca3af';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('$' + price.toFixed(2), padding - 10, y + 4);
            }

            const points = data.map((d, i) => {
                const x = padding + (chartWidth / (data.length - 1)) * i;
                const y = padding + chartHeight - ((d.price - minPrice) / priceRange) * chartHeight;
                return {x, y, day: d.day};
            });

            ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
            ctx.beginPath();
            ctx.moveTo(points[0].x, canvas.height - padding);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, canvas.height - padding);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();

            points.forEach(p => {
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#6b7280';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(p.day, p.x, canvas.height - padding + 20);
            });
        }

        drawChart();

        window.addEventListener('resize', () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            drawChart();
        });