const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "drts-secret-key-change-in-production";

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in header
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                error: "Not authorized. Please log in."
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if user still exists
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                error: "User no longer exists."
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                error: "Account has been deactivated."
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ error: "Invalid token." });
        }
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expired. Please log in again." });
        }
        return res.status(500).json({ error: "Authentication error." });
    }
};

// Restrict to specific roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: "You do not have permission to perform this action."
            });
        }
        next();
    };
};

// Optional auth - attach user if token exists but don't require it
exports.optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user && user.isActive) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        // Continue without user if token is invalid
        next();
    }
};

// Generate JWT token
exports.generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "1h"
    });
};

// Generate refresh token
exports.generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
    });
};
