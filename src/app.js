import express from "express";
import cors from "cors";
import parkingSpotRoutes from "./routes/ParkingSpotRoutes.js";
import userRoutes from "./routes/UserRoutes.js";
import parkingLotRoutes from "./routes/ParkingLotRoutes.js";
import parkingSessionRoutes from "./routes/ParkingSessionRoutes.js";

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000"
];

const CORS_CONFIG = {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(CORS_CONFIG));
app.use(express.json());

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/parking-lots", parkingLotRoutes);
app.use("/api/v1/parking-spots", parkingSpotRoutes);
app.use("/api/v1/parking-sessions", parkingSessionRoutes);
app.use("/api/v1/spots", parkingSpotRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

export default app;