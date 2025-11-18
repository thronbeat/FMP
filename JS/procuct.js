    const products = [
      {
        name: "Organic Tomatoes",
        category: "vegetables",
        price: 2.5,
        stock: "500kg in stock",
        rating: 4.8,
        reviews: 124,
        description: "Fresh organic tomatoes grown using sustainable farming practices.",
        image: "https://images.unsplash.com/photo-1567303317682-0c9f1f6ba64c",
      },
      {
        name: "Sweet Corn",
        category: "vegetables",
        price: 1.8,
        stock: "800kg in stock",
        rating: 4.6,
        reviews: 98,
        description: "Premium sweet corn harvested at peak freshness.",
        image: "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2",
      }
    ];

    const grid = document.getElementById("productGrid");
    const modalOverlay = document.getElementById("modalOverlay");
    const modalTitle = document.getElementById("modalTitle");
    const productForm = document.getElementById("productForm");
    const submitBtn = document.getElementById("submitBtn");
    let editingIndex = -1;

    function renderProducts() {
      grid.innerHTML = "";
      products.forEach((p, index) => {
        const div = document.createElement("div");
        div.className = "product";
        div.innerHTML = `
          <img src="${p.image}" alt="${p.name}">
          <div class="product-content">
            <div class="category">${p.category.toUpperCase()}</div>
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <div class="stars">⭐ ${p.rating} (${p.reviews})</div>
            <div class="price">$${p.price.toFixed(2)}</div>
            <div class="stock">${p.stock}</div>
            <div class="actions-btn">
              <button class="edit-btn" onclick="editProduct(${index})">Edit</button>
              <button class="delete-btn" onclick="deleteProduct(${index})">Delete</button>
            </div>
          </div>
        `;
        grid.appendChild(div);
      });
    }

    function openModal(isEdit = false, index = -1) {
      editingIndex = index;
      modalTitle.textContent = isEdit ? "Edit Product" : "Add New Product";
      submitBtn.textContent = isEdit ? "Update Product" : "Add Product";
      
      if (isEdit && index >= 0) {
        const product = products[index];
        document.getElementById("productName").value = product.name;
        document.getElementById("category").value = product.category;
        document.getElementById("description").value = product.description;
        document.getElementById("price").value = product.price;
        
        // Parse stock (e.g., "500kg in stock" -> 500 and "kg")
        const stockMatch = product.stock.match(/(\d+)(\w+)/);
        if (stockMatch) {
          document.getElementById("stock").value = stockMatch[1];
          document.getElementById("stockUnit").value = stockMatch[2];
        }
        
        document.getElementById("imageUrl").value = product.image;
      } else {
        productForm.reset();
      }
      
      modalOverlay.classList.add("active");
    }

    function closeModal() {
      modalOverlay.classList.remove("active");
      productForm.reset();
      editingIndex = -1;
    }

    function editProduct(i) {
      openModal(true, i);
    }

    function deleteProduct(i) {
      if (confirm("Are you sure you want to delete this product?")) {
        products.splice(i, 1);
        renderProducts();
      }
    }

    // Event Listeners
    document.getElementById("addProduct").addEventListener("click", () => {
      openModal(false);
    });

    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);

    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    document.getElementById("submitBtn").addEventListener("click", (e) => {
      e.preventDefault();
      
      if (!productForm.checkValidity()) {
        productForm.reportValidity();
        return;
      }

      const formData = {
        name: document.getElementById("productName").value,
        category: document.getElementById("category").value,
        description: document.getElementById("description").value,
        price: parseFloat(document.getElementById("price").value),
        stock: `${document.getElementById("stock").value}${document.getElementById("stockUnit").value} in stock`,
        rating: 4.5,
        reviews: 0,
        image: document.getElementById("imageUrl").value || "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2"
      };

      if (editingIndex >= 0) {
        // Update existing product
        products[editingIndex] = { ...products[editingIndex], ...formData };
      } else {
        // Add new product
        products.push(formData);
      }

      renderProducts();
      closeModal();
    });

    renderProducts();