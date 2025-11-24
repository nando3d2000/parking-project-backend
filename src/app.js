import express from "express";
import cors from "cors";

import router from "./routes/ParkingSpotRoutes.js";

const app = express();

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use("/api/v1/spots", router);

export default app;