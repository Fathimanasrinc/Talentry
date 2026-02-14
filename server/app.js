const express = require("express");
const cors = require("cors"); // ✅ import cors
require("dotenv").config(); // ✅ Load environment variables
const uploadRoutes = require("./routes/uploadRoutes");

const app = express();

// Enable CORS for all origins (or just your frontend)
app.use(cors({
  origin: "http://localhost:5173", // frontend URL
}));

// Use routes
app.use("/api/uploads", uploadRoutes);

app.listen(5000, () => {
  console.log("Server started on port 5000");
});
