const express = require("express");
const Farmer = require("../models/Farmer");
const router = express.Router();

// Create Farmer
router.post("/", async (req, res) => {
    try {
        const { farmerName, email, phoneNumber, location, password } = req.body;
        
        // Validate required fields
        if (!farmerName || !email || !phoneNumber || !location || !password) {
            return res.status(400).json({ 
                message: "All fields are required: farmerName, email, phoneNumber, location, password" 
            });
        }

        const farmer = await Farmer.create({
            farmerName,
            email,
            phoneNumber,
            location,
            password
        });
        
        res.status(201).json(farmer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get All Farmers
router.get("/", async (req, res) => {
    try {
        const farmers = await Farmer.find();
        res.json(farmers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Single Farmer
router.get("/:id", async (req, res) => {
    try {
        const farmer = await Farmer.findById(req.params.id);
        if (!farmer) {
            return res.status(404).json({ message: "Farmer not found" });
        }
        res.json(farmer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Farmer
router.put("/:id", async (req, res) => {
    try {
        const { farmerName, email, phoneNumber, location, password } = req.body;
        
        const updateData = {};
        if (farmerName) updateData.farmerName = farmerName;
        if (email) updateData.email = email;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (location) updateData.location = location;
        if (password) updateData.password = password;

        const farmer = await Farmer.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!farmer) {
            return res.status(404).json({ message: "Farmer not found" });
        }
        
        res.json(farmer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Farmer
router.delete("/:id", async (req, res) => {
    try {
        const farmer = await Farmer.findByIdAndDelete(req.params.id);
        if (!farmer) {
            return res.status(404).json({ message: "Farmer not found" });
        }
        res.json({ message: "Farmer deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;