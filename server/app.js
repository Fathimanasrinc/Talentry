import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import uploadRoutes from "./routes/uploadRoutes.js";

dotenv.config();

const app = express();

// Enable CORS for all origins (or just your frontend)
app.use(cors({
  origin: "http://localhost:5173", // frontend URL
}));

// Use routes
app.use("/api/uploads", uploadRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
