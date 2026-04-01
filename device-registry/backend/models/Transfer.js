const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true,
        index: true
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    transferType: {
        type: String,
        enum: ['sale', 'gift', 'inheritance'],
        default: 'sale'
    },
    price: {
        type: Number,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'cancelled', 'expired', 'completed'],
        default: 'pending',
        index: true
    },
    qrCodeUsed: {
        type: Boolean,
        default: false
    },
    qrTransferToken: {
        type: String,
        index: true
    },
    initiatedAt: {
        type: Date,
        default: Date.now
    },
    respondedAt: Date,
    completedAt: Date,
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    sellerOtpVerified: {
        type: Boolean,
        default: false
    },
    buyerOtpVerified: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        maxlength: 500
    },
    rejectionReason: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Auto-expire transfers after 48 hours
transferSchema.pre('save', function(next) {
    if (this.isNew && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    }
    next();
});

// Check if transfer is expired
transferSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Check if transfer can be completed
transferSchema.methods.canComplete = function() {
    return this.status === 'accepted' && 
           this.sellerOtpVerified && 
           this.buyerOtpVerified &&
           !this.isExpired();
};

// Static method to get pending transfers for user
transferSchema.statics.getPendingForUser = async function(userId) {
    return await this.find({
        $or: [{ fromUser: userId }, { toUser: userId }],
        status: 'pending',
        expiresAt: { $gt: new Date() }
    }).populate('device').populate('fromUser', 'firstName lastName phoneNumber').populate('toUser', 'firstName lastName phoneNumber');
};

// Indexes for common queries
transferSchema.index({ status: 1, expiresAt: 1 });
transferSchema.index({ fromUser: 1, status: 1 });
transferSchema.index({ toUser: 1, status: 1 });

module.exports = mongoose.model('Transfer', transferSchema);
