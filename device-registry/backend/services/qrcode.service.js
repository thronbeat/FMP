const QRCode = require('qrcode');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const QR_SECRET = process.env.QR_SECRET || 'default-qr-secret';
const QR_EXPIRY_MINUTES = parseInt(process.env.QR_EXPIRY_MINUTES) || 15;

/**
 * Generate a transfer QR code for a device
 */
const generateTransferQR = async (deviceId, sellerId, transferId = null) => {
    const token = uuidv4();
    const timestamp = Date.now();
    const expiresAt = new Date(timestamp + QR_EXPIRY_MINUTES * 60 * 1000);
    
    const payload = {
        type: 'DRTS_TRANSFER',
        version: '1.0',
        deviceId: deviceId.toString(),
        sellerId: sellerId.toString(),
        transferId: transferId ? transferId.toString() : null,
        token: token,
        timestamp: timestamp,
        expiresAt: expiresAt.toISOString()
    };
    
    // Create HMAC signature
    const signature = crypto
        .createHmac('sha256', QR_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    payload.signature = signature;
    
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'M',
        width: 300,
        margin: 2
    });
    
    return {
        qrCode: qrDataUrl,
        token: token,
        payload: payload,
        expiresAt: expiresAt
    };
};

/**
 * Verify QR code data and signature
 */
const verifyQRCode = (qrData) => {
    try {
        let payload;
        
        if (typeof qrData === 'string') {
            payload = JSON.parse(qrData);
        } else {
            payload = qrData;
        }
        
        // Check type
        if (payload.type !== 'DRTS_TRANSFER') {
            return { valid: false, error: 'Invalid QR code type' };
        }
        
        // Check expiry
        if (new Date(payload.expiresAt) < new Date()) {
            return { valid: false, error: 'QR code has expired' };
        }
        
        // Verify signature
        const receivedSignature = payload.signature;
        const payloadWithoutSignature = { ...payload };
        delete payloadWithoutSignature.signature;
        
        const expectedSignature = crypto
            .createHmac('sha256', QR_SECRET)
            .update(JSON.stringify(payloadWithoutSignature))
            .digest('hex');
        
        if (receivedSignature !== expectedSignature) {
            return { valid: false, error: 'Invalid QR code signature' };
        }
        
        return {
            valid: true,
            payload: payload
        };
    } catch (error) {
        return { valid: false, error: 'Invalid QR code format' };
    }
};

/**
 * Generate a simple verification QR for device info display
 */
const generateDeviceInfoQR = async (deviceId) => {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${deviceId}`;
    
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'M',
        width: 200,
        margin: 2
    });
    
    return {
        qrCode: qrDataUrl,
        url: verificationUrl
    };
};

module.exports = {
    generateTransferQR,
    verifyQRCode,
    generateDeviceInfoQR
};
