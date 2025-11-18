const products = [
      {
        name: "Green Apples",
        category: "fruits",
        price: 3.0,
        stock: "450kg in stock",
        seller: "Emma Davis",
        rating: 4.5,
        reviews: 76,
        image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce",
      },
      {
        name: "Fresh Milk",
        category: "dairy",
        price: 2.0,
        stock: "200kg in stock",
        seller: "Mike Brown",
        rating: 4.8,
        reviews: 142,
        image: "https://images.unsplash.com/photo-1585238342028-9c8d5c0f2c6c",
      },
      {
        name: "Organic Rice",
        category: "grains",
        price: 3.5,
        stock: "1000kg in stock",
        seller: "Sarah Williams",
        rating: 4.7,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1600320842439-6e7a45fa68cf",
      },
      {
        name: "Fresh Strawberries",
        category: "fruits",
        price: 4.2,
        stock: "300kg in stock",
        seller: "David Lee",
        rating: 4.9,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1576402187878-974f70c890a5",
      },
      {
        name: "Sweet Corn",
        category: "vegetables",
        price: 1.8,
        stock: "800kg in stock",
        seller: "Mary Johnson",
        rating: 4.6,
        reviews: 98,
        image: "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2",
      },
      {
        name: "Organic Tomatoes",
        category: "vegetables",
        price: 2.5,
        stock: "500kg in stock",
        seller: "John Smith",
        rating: 4.8,
        reviews: 124,
        image: "https://images.unsplash.com/photo-1567303317682-0c9f1f6ba64c",
      },
    ];

    const grid = document.getElementById("productGrid");
    const search = document.getElementById("search");
    const category = document.getElementById("category");
    const sort = document.getElementById("sort");

    function renderProducts(list) {
      grid.innerHTML = "";
      list.forEach((p) => {
        const div = document.createElement("div");
        div.className = "product";
        div.innerHTML = `
          <img src="${p.image}" alt="${p.name}">
          <div class="product-content">
            <div class="category">${p.category.toUpperCase()}</div>
            <h3>${p.name}</h3>
            <p>by ${p.seller}</p>
            <div class="stars">⭐ ${p.rating} (${p.reviews} reviews)</div>
            <div class="price">$${p.price.toFixed(2)}</div>
            <div class="stock">${p.stock}</div>
            <button class="add-btn">Add to Cart</button>
          </div>
        `;
        grid.appendChild(div);
      });
    }

    function filterAndSort() {
      let filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.value.toLowerCase())
      );

      if (category.value !== "all") {
        filtered = filtered.filter(p => p.category === category.value);
      }

      if (sort.value === "priceLow") {
        filtered.sort((a,b) => a.price - b.price);
      } else if (sort.value === "priceHigh") {
        filtered.sort((a,b) => b.price - a.price);
      }

      renderProducts(filtered);
    }

    search.addEventListener("input", filterAndSort);
    category.addEventListener("change", filterAndSort);
    sort.addEventListener("change", filterAndSort);

    renderProducts(products);
