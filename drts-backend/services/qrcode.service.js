const QRCode = require("qrcode");
const crypto = require("crypto");

const QR_SECRET = process.env.QR_SECRET || "drts-qr-secret-key";
const QR_EXPIRY_MINUTES = parseInt(process.env.QR_EXPIRY_MINUTES) || 15;

/**
 * Generate HMAC signature for QR data
 * @param {object} data - Data to sign
 * @returns {string} - HMAC signature
 */
const generateSignature = (data) => {
    const hmac = crypto.createHmac("sha256", QR_SECRET);
    hmac.update(JSON.stringify(data));
    return hmac.digest("hex");
};

/**
 * Verify HMAC signature
 * @param {object} data - Original data
 * @param {string} signature - Signature to verify
 * @returns {boolean} - Whether signature is valid
 */
const verifySignature = (data, signature) => {
    const expectedSignature = generateSignature(data);
    return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
    );
};

/**
 * Generate transfer QR code
 * @param {object} params - QR code parameters
 * @param {string} params.deviceId - Device ID
 * @param {string} params.transferId - Transfer request ID (optional)
 * @param {string} params.sellerId - Seller user ID
 * @param {number} params.expiryMinutes - Custom expiry time in minutes
 * @returns {Promise<object>} - QR code data and image
 */
exports.generateTransferQR = async ({ deviceId, transferId, sellerId, expiryMinutes }) => {
    const expiry = expiryMinutes || QR_EXPIRY_MINUTES;
    const expiresAt = new Date(Date.now() + expiry * 60 * 1000);
    
    const qrData = {
        type: "DRTS_TRANSFER",
        version: "1.0",
        deviceId: deviceId.toString(),
        transferId: transferId ? transferId.toString() : null,
        sellerId: sellerId.toString(),
        timestamp: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
    };
    
    // Add signature
    const signature = generateSignature(qrData);
    qrData.signature = signature;
    
    // Generate QR code image as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: "H",
        type: "image/png",
        width: 300,
        margin: 2,
        color: {
            dark: "#000000",
            light: "#ffffff"
        }
    });
    
    return {
        data: JSON.stringify(qrData),
        dataUrl: qrCodeDataUrl,
        expiresAt: expiresAt
    };
};

/**
 * Verify and parse scanned QR code
 * @param {string} qrDataString - Scanned QR code data (JSON string)
 * @returns {object} - Parsed and validated QR data
 */
exports.verifyTransferQR = (qrDataString) => {
    try {
        const qrData = JSON.parse(qrDataString);
        
        // Check type
        if (qrData.type !== "DRTS_TRANSFER") {
            return {
                valid: false,
                error: "Invalid QR code type"
            };
        }
        
        // Check version
        if (qrData.version !== "1.0") {
            return {
                valid: false,
                error: "Unsupported QR code version"
            };
        }
        
        // Check expiry
        const expiresAt = new Date(qrData.expiresAt);
        if (new Date() > expiresAt) {
            return {
                valid: false,
                error: "QR code has expired"
            };
        }
        
        // Verify signature
        const { signature, ...dataWithoutSignature } = qrData;
        if (!verifySignature(dataWithoutSignature, signature)) {
            return {
                valid: false,
                error: "Invalid QR code signature"
            };
        }
        
        return {
            valid: true,
            data: {
                deviceId: qrData.deviceId,
                transferId: qrData.transferId,
                sellerId: qrData.sellerId,
                timestamp: qrData.timestamp,
                expiresAt: qrData.expiresAt
            }
        };
    } catch (error) {
        return {
            valid: false,
            error: "Invalid QR code format"
        };
    }
};

/**
 * Generate device verification QR code (for checking device info)
 * @param {string} deviceId - Device ID
 * @returns {Promise<string>} - QR code data URL
 */
exports.generateDeviceQR = async (deviceId) => {
    const qrData = {
        type: "DRTS_DEVICE",
        deviceId: deviceId.toString(),
        checkUrl: `https://drts.rw/verify/${deviceId}`
    };
    
    return QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 200,
        margin: 2
    });
};
