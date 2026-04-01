const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceType: {
        type: String,
        required: [true, 'Device type is required'],
        enum: ['phone', 'laptop', 'tablet', 'tv', 'other']
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    model: {
        type: String,
        required: [true, 'Model is required'],
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
            trim: true
        }
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    color: {
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
        ref: 'User',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['registered', 'pending_transfer', 'transferred', 'reported_lost', 'reported_stolen', 'found'],
        default: 'registered',
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
    registrationVerified: {
        type: Boolean,
        default: false
    },
    flags: [{
        type: {
            type: String,
            enum: ['suspicious', 'duplicate_claim', 'under_investigation']
        },
        reason: String,
        flaggedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        flaggedAt: Date
    }]
}, {
    timestamps: true
});

// Compound index for unique device identification
deviceSchema.index({ 'identifiers.imei1': 1 }, { unique: true, sparse: true });
deviceSchema.index({ 'identifiers.serialNumber': 1, deviceType: 1 }, { unique: true, sparse: true });

// Virtual for primary identifier
deviceSchema.virtual('primaryIdentifier').get(function() {
    if (this.deviceType === 'phone') {
        return this.identifiers.imei1;
    }
    return this.identifiers.serialNumber;
});

// Static method to find by any identifier
deviceSchema.statics.findByIdentifier = async function(identifier) {
    return await this.findOne({
        $or: [
            { 'identifiers.imei1': identifier },
            { 'identifiers.imei2': identifier },
            { 'identifiers.serialNumber': identifier }
        ]
    });
};

// Check if device is transferable
deviceSchema.methods.isTransferable = function() {
    return this.status === 'registered' || this.status === 'transferred';
};

deviceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Device', deviceSchema);
