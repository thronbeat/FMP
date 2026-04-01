const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
    deviceType: {
        type: String,
        required: [true, "Device type is required"],
        enum: ["phone", "laptop", "tablet", "tv", "other"]
    },
    brand: {
        type: String,
        required: [true, "Brand is required"],
        trim: true
    },
    model: {
        type: String,
        required: [true, "Model is required"],
        trim: true
    },
    identifiers: {
        imei1: {
            type: String,
            trim: true,
            sparse: true,
            index: true
        },
        imei2: {
            type: String,
            trim: true,
            sparse: true,
            index: true
        },
        serialNumber: {
            type: String,
            trim: true,
            sparse: true,
            index: true
        },
        macAddress: {
            type: String,
            trim: true,
            sparse: true
        }
    },
    description: {
        type: String,
        trim: true
    },
    purchaseInfo: {
        purchaseDate: Date,
        purchasePrice: Number,
        purchaseLocation: String,
        receipt: String // URL to receipt image
    },
    currentOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["registered", "pending_transfer", "transferred", "reported_lost", "reported_stolen", "found"],
        default: "registered",
        index: true
    },
    qrCode: {
        data: String,
        generatedAt: Date,
        expiresAt: Date
    },
    photos: [{
        type: String // URLs to device photos
    }],
    color: String,
    notes: String
}, {
    timestamps: true
});

// Compound indexes for efficient searching
deviceSchema.index({ "identifiers.imei1": 1 });
deviceSchema.index({ "identifiers.imei2": 1 });
deviceSchema.index({ "identifiers.serialNumber": 1 });
deviceSchema.index({ currentOwner: 1, status: 1 });

// Static method to find device by any identifier
deviceSchema.statics.findByIdentifier = async function(identifier) {
    return this.findOne({
        $or: [
            { "identifiers.imei1": identifier },
            { "identifiers.imei2": identifier },
            { "identifiers.serialNumber": identifier },
            { "identifiers.macAddress": identifier }
        ]
    });
};

// Check if identifier exists
deviceSchema.statics.identifierExists = async function(identifiers) {
    const query = [];
    if (identifiers.imei1) query.push({ "identifiers.imei1": identifiers.imei1 });
    if (identifiers.imei2) query.push({ "identifiers.imei2": identifiers.imei2 });
    if (identifiers.serialNumber) query.push({ "identifiers.serialNumber": identifiers.serialNumber });
    
    if (query.length === 0) return null;
    
    return this.findOne({ $or: query });
};

// Virtual for full device name
deviceSchema.virtual("fullName").get(function() {
    return `${this.brand} ${this.model}`;
});

module.exports = mongoose.model("Device", deviceSchema);
