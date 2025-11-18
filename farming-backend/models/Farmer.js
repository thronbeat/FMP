const mongoose = require("mongoose");

const farmerSchema = new mongoose.Schema({
    farmerName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    location: { type: String, required: true },
    password: { type: String, required: true }
}, { 
    timestamps: true // This automatically adds createdAt and updatedAt
});

module.exports = mongoose.model("Farmer", farmerSchema);