import express from "express";
import cors from "cors";

import spotRouter from "./routes/ParkingSpotRoutes.js";
import userRouter from "./routes/UserRoutes.js";
import parkingLotRouter from "./routes/ParkingLotRoutes.js";
import sessionRouter from "./routes/ParkingSessionRoutes.js";
import socketTestRouter from "./routes/SocketTestRoutes.js";

const app = express();

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Registrar todas las rutas
app.use("/api/v1/users", userRouter);
app.use("/api/v1/spots", spotRouter);
app.use("/api/v1/parking-lots", parkingLotRouter);
app.use("/api/v1/sessions", sessionRouter);
app.use("/api/v1/socket", socketTestRouter);

// Ruta de bienvenida
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚗 Parking System API v1.0",
    endpoints: [
      "POST /api/v1/users/register",
      "POST /api/v1/users/login",
      "GET /api/v1/users/profile",
      "GET /api/v1/parking-lots",
      "GET /api/v1/spots",
      "GET /api/v1/sessions/active"
    ]
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === 'development' ? err.message : "Error interno"
  });
});

export default app;