require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Route imports
const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const expenseRoutes = require("./routes/expense.routes");
const saleRoutes = require("./routes/sale.routes");
const apartmentRoutes = require("./routes/apartment.routes");
const uploadRoutes = require("./routes/upload.routes");
const exportRoutes = require("./routes/export.routes");
const generalExpenseRoutes = require("./routes/generalExpenses.routes");
const analysisRoutes = require("./routes/analysis.routes");
const app = express();
const commissionRoutes = require('./routes/commisions');   // file name as it is





// ================= CORS =================
const allowedOrigins = [
  "http://localhost:5173",
  "https://elite-project-final.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
// ================= BODY PARSER =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= REQUEST LOGGER =================
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ================= STATIC FILES =================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
  res.send("Elite Backend is running!");
});

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/apartments", apartmentRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/general-expenses", generalExpenseRoutes);
app.use("/api/analysis", analysisRoutes);
app.use('/api/commissions', commissionRoutes);

// ================= 404 HANDLER =================
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Route not found",
    path: req.url
  });
});




// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(err.status || 500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ================= MONGODB CONNECTION =================
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      console.log(`📊 Routes mounted:`);
      console.log(`   - /api/auth`);
      console.log(`   - /api/projects`);
      console.log(`   - /api/expenses`);
      console.log(`   - /api/sales`);
      console.log(`   - /api/apartments`);
      console.log(`   - /api/uploads`);
      console.log(`   - /api/export`);
      console.log(`   - /api/general-expenses`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });