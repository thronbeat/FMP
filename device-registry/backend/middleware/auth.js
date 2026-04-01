const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
        
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid token or user not found.' });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

// Check if user has required role
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated.' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.',
                required: roles,
                current: req.user.role
            });
        }
        
        next();
    };
};

// Check if user is verified
const requireVerified = (req, res, next) => {
    if (!req.user.isVerified) {
        return res.status(403).json({ 
            error: 'Please verify your account first.',
            verified: false
        });
    }
    next();
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
            const user = await User.findById(decoded.userId);
            if (user && user.isActive) {
                req.user = user;
                req.userId = user._id;
            }
        }
        next();
    } catch (error) {
        // Ignore token errors for optional auth
        next();
    }
};

module.exports = { authenticate, authorize, requireVerified, optionalAuth };
