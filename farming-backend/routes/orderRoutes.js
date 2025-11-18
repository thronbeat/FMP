const express = require("express");
const Order = require("../models/Order");
const router = express.Router();

// Create Order (includes product reference)
router.post("/", async (req, res) => {
    const order = await Order.create(req.body);
    res.json(order);
});

// Get all orders + product information
router.get("/", async (req, res) => {
    const orders = await Order.find().populate("product");
    res.json(orders);
});

// Get single order
router.get("/:id", async (req, res) => {
    const order = await Order.findById(req.params.id).populate("product");
    res.json(order);
});

// Update order
router.put("/:id", async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(order);
});

// Delete order
router.delete("/:id", async (req, res) => {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted" });
});

module.exports = router;
