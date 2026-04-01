/**
 * SMS Service for OTP and notifications
 * In production, integrate with Africa's Talking or similar SMS provider
 */

// Simulated SMS sending - replace with actual provider in production
const sendSMS = async (phoneNumber, message) => {
    // In development, just log the SMS
    console.log(`[SMS] To: ${phoneNumber}`);
    console.log(`[SMS] Message: ${message}`);
    
    // TODO: In production, integrate with Africa's Talking
    /*
    const AfricasTalking = require('africastalking')({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME
    });
    
    const sms = AfricasTalking.SMS;
    
    const response = await sms.send({
        to: [phoneNumber],
        message: message,
        from: process.env.AT_SENDER_ID
    });
    
    return response;
    */
    
    return { success: true, simulated: true };
};

/**
 * Send OTP to user
 */
const sendOTP = async (phoneNumber, otp) => {
    const message = `Your DRTS verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
    return await sendSMS(phoneNumber, message);
};

/**
 * Send transfer notification to buyer
 */
const sendTransferRequest = async (phoneNumber, sellerName, deviceInfo) => {
    const message = `DRTS: ${sellerName} wants to transfer a ${deviceInfo} to you. Open the DRTS app to accept or reject.`;
    return await sendSMS(phoneNumber, message);
};

/**
 * Send transfer completion notification
 */
const sendTransferComplete = async (phoneNumber, deviceInfo, role) => {
    const message = role === 'seller' 
        ? `DRTS: You have successfully transferred your ${deviceInfo}. The device is no longer registered to you.`
        : `DRTS: You are now the registered owner of ${deviceInfo}. Thank you for using DRTS.`;
    return await sendSMS(phoneNumber, message);
};

/**
 * Send lost device alert to owner
 */
const sendDeviceFoundAlert = async (phoneNumber, deviceInfo) => {
    const message = `DRTS: Good news! Someone has found a device matching your lost ${deviceInfo}. Login to DRTS for details.`;
    return await sendSMS(phoneNumber, message);
};

/**
 * Send device registration confirmation
 */
const sendRegistrationConfirmation = async (phoneNumber, deviceInfo) => {
    const message = `DRTS: Your ${deviceInfo} has been registered successfully. Keep your registration details safe.`;
    return await sendSMS(phoneNumber, message);
};

/**
 * Send account verification confirmation
 */
const sendVerificationSuccess = async (phoneNumber, name) => {
    const message = `DRTS: Welcome ${name}! Your account has been verified. You can now register and manage your devices.`;
    return await sendSMS(phoneNumber, message);
};

module.exports = {
    sendSMS,
    sendOTP,
    sendTransferRequest,
    sendTransferComplete,
    sendDeviceFoundAlert,
    sendRegistrationConfirmation,
    sendVerificationSuccess
};
