const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// User registration validation
const validateUserRegistration = [
    body('nationalId')
        .trim()
        .notEmpty().withMessage('National ID is required')
        .matches(/^\d{16}$/).withMessage('National ID must be exactly 16 digits'),
    body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^\+250\d{9}$/).withMessage('Phone must be in format +250XXXXXXXXX'),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Invalid email format'),
    handleValidation
];

// Login validation
const validateLogin = [
    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone number is required'),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidation
];

// Device registration validation
const validateDeviceRegistration = [
    body('deviceType')
        .notEmpty().withMessage('Device type is required')
        .isIn(['phone', 'laptop', 'tablet', 'tv', 'other']).withMessage('Invalid device type'),
    body('brand')
        .trim()
        .notEmpty().withMessage('Brand is required')
        .isLength({ max: 100 }).withMessage('Brand name too long'),
    body('model')
        .trim()
        .notEmpty().withMessage('Model is required')
        .isLength({ max: 100 }).withMessage('Model name too long'),
    body('identifiers.imei1')
        .optional()
        .trim()
        .matches(/^\d{15}$/).withMessage('IMEI must be exactly 15 digits'),
    body('identifiers.imei2')
        .optional()
        .trim()
        .matches(/^\d{15}$/).withMessage('IMEI must be exactly 15 digits'),
    body('identifiers.serialNumber')
        .optional()
        .trim()
        .isLength({ min: 5, max: 50 }).withMessage('Serial number must be 5-50 characters'),
    handleValidation
];

// Transfer validation
const validateTransfer = [
    body('deviceId')
        .notEmpty().withMessage('Device ID is required')
        .isMongoId().withMessage('Invalid device ID'),
    body('buyerIdentifier')
        .trim()
        .notEmpty().withMessage('Buyer identifier (phone or National ID) is required'),
    body('transferType')
        .optional()
        .isIn(['sale', 'gift', 'inheritance']).withMessage('Invalid transfer type'),
    body('price')
        .optional()
        .isNumeric().withMessage('Price must be a number')
        .isFloat({ min: 0 }).withMessage('Price cannot be negative'),
    handleValidation
];

// Report validation
const validateReport = [
    body('reportType')
        .notEmpty().withMessage('Report type is required')
        .isIn(['lost', 'stolen', 'found']).withMessage('Invalid report type'),
    body('deviceId')
        .optional()
        .isMongoId().withMessage('Invalid device ID'),
    body('unregisteredDevice.identifier')
        .optional()
        .trim()
        .isLength({ min: 5 }).withMessage('Device identifier too short'),
    body('location.province')
        .optional()
        .trim()
        .isLength({ max: 100 }),
    body('location.district')
        .optional()
        .trim()
        .isLength({ max: 100 }),
    handleValidation
];

// OTP validation
const validateOTP = [
    body('otp')
        .trim()
        .notEmpty().withMessage('OTP is required')
        .matches(/^\d{6}$/).withMessage('OTP must be exactly 6 digits'),
    handleValidation
];

// MongoDB ID validation
const validateMongoId = [
    param('id')
        .isMongoId().withMessage('Invalid ID format'),
    handleValidation
];

module.exports = {
    handleValidation,
    validateUserRegistration,
    validateLogin,
    validateDeviceRegistration,
    validateTransfer,
    validateReport,
    validateOTP,
    validateMongoId
};
