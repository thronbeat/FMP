/**
 * SMS Service for sending OTP and notifications
 * Uses Africa's Talking API for Rwanda
 * 
 * In production, replace the mock functions with actual API calls
 */

// Configuration
const config = {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || "sandbox",
    senderId: process.env.AT_SENDER_ID || "DRTS"
};

/**
 * Send SMS message
 * @param {string} phoneNumber - Recipient phone number (+250...)
 * @param {string} message - Message content
 * @returns {Promise<object>} - Send result
 */
exports.sendSMS = async (phoneNumber, message) => {
    try {
        // In development/sandbox mode, just log the message
        if (process.env.NODE_ENV !== "production" || !config.apiKey) {
            console.log("=== SMS (Development Mode) ===");
            console.log(`To: ${phoneNumber}`);
            console.log(`Message: ${message}`);
            console.log("==============================");
            return {
                success: true,
                messageId: `dev-${Date.now()}`,
                status: "Sent (Development)"
            };
        }

        // Production: Use Africa's Talking API
        // Uncomment and configure when ready for production
        /*
        const AfricasTalking = require("africastalking");
        const africastalking = AfricasTalking({
            apiKey: config.apiKey,
            username: config.username
        });
        const sms = africastalking.SMS;
        
        const result = await sms.send({
            to: phoneNumber,
            message: message,
            from: config.senderId
        });
        
        return {
            success: true,
            messageId: result.SMSMessageData.Recipients[0].messageId,
            status: result.SMSMessageData.Recipients[0].status
        };
        */

        return {
            success: true,
            messageId: `mock-${Date.now()}`,
            status: "Sent"
        };
    } catch (error) {
        console.error("SMS Error:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send OTP verification code
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} otp - OTP code
 */
exports.sendOTP = async (phoneNumber, otp) => {
    const message = `Your DRTS verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;
    return this.sendSMS(phoneNumber, message);
};

/**
 * Send transfer notification to buyer
 * @param {string} phoneNumber - Buyer phone number
 * @param {string} sellerName - Seller's name
 * @param {string} deviceName - Device name/model
 */
exports.sendTransferNotification = async (phoneNumber, sellerName, deviceName) => {
    const message = `DRTS: ${sellerName} wants to transfer a ${deviceName} to you. Open the DRTS app to accept or reject this transfer.`;
    return this.sendSMS(phoneNumber, message);
};

/**
 * Send transfer completion confirmation
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} deviceName - Device name/model
 * @param {boolean} isBuyer - Whether the recipient is the buyer
 */
exports.sendTransferComplete = async (phoneNumber, deviceName, isBuyer) => {
    const action = isBuyer ? "received" : "transferred";
    const message = `DRTS: Transfer complete! You have successfully ${action} ${deviceName}. Check the DRTS app for details.`;
    return this.sendSMS(phoneNumber, message);
};

/**
 * Send lost device alert
 * @param {string} phoneNumber - Owner phone number
 * @param {string} deviceName - Device name/model
 * @param {string} finderName - Name of person who found it
 */
exports.sendFoundDeviceAlert = async (phoneNumber, deviceName, finderName) => {
    const message = `DRTS Alert: Your ${deviceName} has been reported as found by ${finderName}! Check the DRTS app for contact details.`;
    return this.sendSMS(phoneNumber, message);
};

/**
 * Send registration invitation
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} senderName - Name of person inviting
 */
exports.sendInvitation = async (phoneNumber, senderName) => {
    const message = `DRTS: ${senderName} wants to transfer a device to you. Download the DRTS app and register to receive it: https://drts.rw`;
    return this.sendSMS(phoneNumber, message);
};
