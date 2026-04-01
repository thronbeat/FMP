const { body, param, query, validationResult } = require("express-validator");

// Handle validation errors
exports.validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: "Validation failed",
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// User registration validation
exports.registerValidation = [
    body("nationalId")
        .trim()
        .notEmpty().withMessage("National ID is required")
        .isLength({ min: 16, max: 16 }).withMessage("National ID must be 16 characters"),
    body("firstName")
        .trim()
        .notEmpty().withMessage("First name is required")
        .isLength({ min: 2 }).withMessage("First name must be at least 2 characters"),
    body("lastName")
        .trim()
        .notEmpty().withMessage("Last name is required")
        .isLength({ min: 2 }).withMessage("Last name must be at least 2 characters"),
    body("phoneNumber")
        .trim()
        .notEmpty().withMessage("Phone number is required")
        .matches(/^\+250[0-9]{9}$/).withMessage("Phone number must be in format +250XXXXXXXXX"),
    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("email")
        .optional()
        .trim()
        .isEmail().withMessage("Invalid email format")
];

// Login validation
exports.loginValidation = [
    body("phoneNumber")
        .trim()
        .notEmpty().withMessage("Phone number is required"),
    body("password")
        .notEmpty().withMessage("Password is required")
];

// Device registration validation
exports.deviceValidation = [
    body("deviceType")
        .notEmpty().withMessage("Device type is required")
        .isIn(["phone", "laptop", "tablet", "tv", "other"]).withMessage("Invalid device type"),
    body("brand")
        .trim()
        .notEmpty().withMessage("Brand is required"),
    body("model")
        .trim()
        .notEmpty().withMessage("Model is required"),
    body("identifiers")
        .notEmpty().withMessage("Device identifiers are required"),
    body("identifiers.imei1")
        .optional()
        .trim()
        .isLength({ min: 15, max: 15 }).withMessage("IMEI must be 15 digits")
        .isNumeric().withMessage("IMEI must contain only numbers"),
    body("identifiers.imei2")
        .optional()
        .trim()
        .isLength({ min: 15, max: 15 }).withMessage("IMEI must be 15 digits")
        .isNumeric().withMessage("IMEI must contain only numbers"),
    body("identifiers.serialNumber")
        .optional()
        .trim()
        .isLength({ min: 5 }).withMessage("Serial number must be at least 5 characters")
];

// Transfer validation
exports.transferValidation = [
    body("deviceId")
        .notEmpty().withMessage("Device ID is required")
        .isMongoId().withMessage("Invalid device ID"),
    body("toUserPhone")
        .trim()
        .notEmpty().withMessage("Buyer phone number is required")
        .matches(/^\+250[0-9]{9}$/).withMessage("Phone number must be in format +250XXXXXXXXX"),
    body("transferType")
        .optional()
        .isIn(["sale", "gift", "inheritance"]).withMessage("Invalid transfer type"),
    body("price")
        .optional()
        .isNumeric().withMessage("Price must be a number")
        .custom(value => value >= 0).withMessage("Price cannot be negative")
];

// Report validation
exports.reportValidation = [
    body("reportType")
        .notEmpty().withMessage("Report type is required")
        .isIn(["lost", "stolen", "found"]).withMessage("Invalid report type"),
    body("deviceId")
        .optional()
        .isMongoId().withMessage("Invalid device ID"),
    body("deviceIdentifier")
        .optional()
        .trim()
        .isLength({ min: 5 }).withMessage("Device identifier must be at least 5 characters"),
    body("location.province")
        .optional()
        .trim()
        .notEmpty().withMessage("Province cannot be empty"),
    body("location.district")
        .optional()
        .trim()
        .notEmpty().withMessage("District cannot be empty")
];

// OTP validation
exports.otpValidation = [
    body("otp")
        .trim()
        .notEmpty().withMessage("OTP is required")
        .isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits")
        .isNumeric().withMessage("OTP must contain only numbers")
];

// ID parameter validation
exports.idParamValidation = [
    param("id")
        .isMongoId().withMessage("Invalid ID format")
];
