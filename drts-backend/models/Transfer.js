const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
        required: true,
        index: true
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    transferType: {
        type: String,
        enum: ["sale", "gift", "inheritance"],
        default: "sale"
    },
    price: {
        type: Number,
        min: 0
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "cancelled", "expired", "completed"],
        default: "pending",
        index: true
    },
    qrCodeUsed: {
        type: Boolean,
        default: false
    },
    initiatedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    expiresAt: {
        type: Date,
        default: function() {
            // Default expiry: 48 hours from creation
            return new Date(Date.now() + 48 * 60 * 60 * 1000);
        }
    },
    sellerOtpVerified: {
        type: Boolean,
        default: false
    },
    buyerOtpVerified: {
        type: Boolean,
        default: false
    },
    notes: String
}, {
    timestamps: true
});

// Index for efficient querying
transferSchema.index({ fromUser: 1, status: 1 });
transferSchema.index({ toUser: 1, status: 1 });
transferSchema.index({ device: 1, status: 1 });

// Check if transfer is expired
transferSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Complete the transfer
transferSchema.methods.complete = async function() {
    this.status = "completed";
    this.completedAt = new Date();
    await this.save();
    
    // Update device ownership
    const Device = mongoose.model("Device");
    await Device.findByIdAndUpdate(this.device, {
        currentOwner: this.toUser,
        status: "registered"
    });
};

// Pre-save hook to check expiry
transferSchema.pre("save", function(next) {
    if (this.status === "pending" && this.isExpired()) {
        this.status = "expired";
    }
    next();
});

module.exports = mongoose.model("Transfer", transferSchema);
