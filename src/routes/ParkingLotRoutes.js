import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
    getParkingLots, 
    getParkingLotById, 
    createParkingLot, 
    updateParkingLot, 
    deleteParkingLot, 
    getParkingLotStats,
    getParkingLotSpots
} from '../controller/ParkingLotController.js';

const router = express.Router();

// Rutas públicas (solo lectura para usuarios autenticados)
router.get('/', authenticateToken, getParkingLots);
router.get('/:id', authenticateToken, getParkingLotById);
router.get('/:id/stats', authenticateToken, getParkingLotStats);
router.get('/:id/spots', authenticateToken, getParkingLotSpots);

// Rutas para administradores (CRUD completo)
router.post('/', authenticateToken, requireAdmin, createParkingLot);
router.put('/:id', authenticateToken, requireAdmin, updateParkingLot);
router.delete('/:id', authenticateToken, requireAdmin, deleteParkingLot);

export default router;