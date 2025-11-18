const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const farmerRoutes = require("./routes/farmerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/farming_simple")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// Routes
app.use("/farmers", farmerRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

app.listen(5000, () => console.log("Server running on port 5000"));
