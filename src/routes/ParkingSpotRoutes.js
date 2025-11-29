import { Router } from "express";
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
    getParkingSpots,
    createParkingSpot,
    getParkingSpotById,
    updateParkingSpotStatus,
    updateParkingSpot,
    deleteParkingSpot,
    reserveParkingSpot,
    cancelReservation
} from "../controller/ParkingSpotController.js";

const router = Router();

router.get("/", authenticateToken, getParkingSpots);
router.get("/:id", authenticateToken, getParkingSpotById);

router.patch("/:id/status", authenticateToken, updateParkingSpotStatus);
router.post("/:id/reserve", authenticateToken, reserveParkingSpot);
router.delete("/:id/reservation", authenticateToken, cancelReservation);

router.post("/", authenticateToken, requireAdmin, createParkingSpot);
router.put("/:id", authenticateToken, requireAdmin, updateParkingSpot);
router.delete("/:id", authenticateToken, requireAdmin, deleteParkingSpot);

export default router;