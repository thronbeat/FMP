const orders = [
      {
        id: "ORD-001",
        date: "2025-11-10",
        buyer: "Global Foods Ltd",
        status: "Delivered",
        total: 46.00,
        items: [
          { name: "Organic Tomatoes", qty: "10kg", price: 2.50, image: "https://images.unsplash.com/photo-1567303317682-0c9f1f6ba64c" },
          { name: "Fresh Strawberries", qty: "5kg", price: 4.20, image: "https://images.unsplash.com/photo-1576402187878-974f70c890a5" }
        ]
      },
      {
        id: "ORD-002",
        date: "2025-11-11",
        buyer: "Fresh Market Co",
        status: "Shipped",
        total: 36.00,
        items: [
          { name: "Sweet Corn", qty: "20kg", price: 1.80, image: "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2" }
        ]
      },
      {
        id: "ORD-003",
        date: "2025-11-12",
        buyer: "Organic Store",
        status: "Processing",
        total: 195.00,
        items: [
          { name: "Organic Rice", qty: "50kg", price: 3.50, image: "https://images.unsplash.com/photo-1600320842439-6e7a45fa68cf" },
          { name: "Fresh Milk", qty: "10kg", price: 2.00, image: "https://images.unsplash.com/photo-1585238342028-9c8d5c0f2c6c" }
        ]
      },
      {
        id: "ORD-004",
        date: "2025-11-12",
        buyer: "Green Basket Ltd",
        status: "Pending",
        total: 89.00,
        items: [
          { name: "Green Apples", qty: "30kg", price: 3.00, image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce" }
        ]
      }
    ];

    const ordersList = document.getElementById("ordersList");
    const filterButtons = document.querySelectorAll(".filter-buttons button");

    function renderOrders(filter = "All") {
      ordersList.innerHTML = "";
      const filteredOrders = filter === "All" ? orders : orders.filter(o => o.status === filter);

      filteredOrders.forEach(order => {
        const div = document.createElement("div");
        div.className = "order";
        div.innerHTML = `
          <div class="order-header">
            <div>
              <span>${order.id}</span><br>
              <small>${order.date}</small>
            </div>
            <div class="status ${order.status}">${order.status}</div>
          </div>
          <div class="order-items">
            ${order.items.map(item => `
              <div class="order-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="details">
                  <h4>${item.name}</h4>
                  <p>${item.qty} × $${item.price.toFixed(2)}</p>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="order-footer">
            <div>Buyer: ${order.buyer}</div>
            <div>Total: $${order.total.toFixed(2)}</div>
          </div>
        `;
        ordersList.appendChild(div);
      });
    }

    filterButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderOrders(btn.getAttribute("data-status"));
      });
    });

    renderOrders();