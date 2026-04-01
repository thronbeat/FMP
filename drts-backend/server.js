const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth.routes");
const deviceRoutes = require("./routes/device.routes");
const transferRoutes = require("./routes/transfer.routes");
const reportRoutes = require("./routes/report.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later" }
});
app.use(limiter);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/drts_rwanda";
mongoose.connect(MONGODB_URI)
    .then(() => console.log("MongoDB Connected - DRTS Database"))
    .catch(err => console.log("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "DRTS API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`DRTS Server running on port ${PORT}`));
