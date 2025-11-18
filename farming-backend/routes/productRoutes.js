const express = require("express");
const Product = require("../models/Product");
const Farmer = require("../models/Farmer");
const router = express.Router();

// Create Product (with farmer validation)
router.post("/", async (req, res) => {
    try {
        const { productName, category, description, quantity, unitPrice, productImage, farmer } = req.body;
        
        // Validate required fields
        if (!productName || !category || !description || !quantity || !unitPrice || !farmer) {
            return res.status(400).json({ 
                message: "All fields are required: productName, category, description, quantity, unitPrice, farmer" 
            });
        }

        // Check if farmer exists
        const farmerExists = await Farmer.findById(farmer);
        if (!farmerExists) {
            return res.status(404).json({ 
                message: "Farmer not found. Please provide a valid farmer ID." 
            });
        }

        const product = await Product.create({
            productName,
            category,
            description,
            quantity,
            unitPrice,
            productImage,
            farmer
        });
        
        // Populate farmer details in response
        await product.populate('farmer', 'farmerName email phoneNumber location');
        
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get All Products (with farmer details)
router.get("/", async (req, res) => {
    try {
        const products = await Product.find().populate('farmer', 'farmerName email phoneNumber location');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Single Product (with farmer details)
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('farmer', 'farmerName email phoneNumber location');
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Products by Farmer ID
router.get("/farmer/:farmerId", async (req, res) => {
    try {
        // Check if farmer exists
        const farmerExists = await Farmer.findById(req.params.farmerId);
        if (!farmerExists) {
            return res.status(404).json({ 
                message: "Farmer not found" 
            });
        }

        const products = await Product.find({ farmer: req.params.farmerId }).populate('farmer', 'farmerName email phoneNumber location');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Product (with farmer validation if farmer is being changed)
router.put("/:id", async (req, res) => {
    try {
        const { productName, category, description, quantity, unitPrice, productImage, farmer } = req.body;
        
        // If farmer is being updated, validate it exists
        if (farmer) {
            const farmerExists = await Farmer.findById(farmer);
            if (!farmerExists) {
                return res.status(404).json({ 
                    message: "Farmer not found. Please provide a valid farmer ID." 
                });
            }
        }

        const updateData = {};
        if (productName) updateData.productName = productName;
        if (category) updateData.category = category;
        if (description) updateData.description = description;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (unitPrice !== undefined) updateData.unitPrice = unitPrice;
        if (productImage) updateData.productImage = productImage;
        if (farmer) updateData.farmer = farmer;

        const product = await Product.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('farmer', 'farmerName email phoneNumber location');
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Product
router.delete("/:id", async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;