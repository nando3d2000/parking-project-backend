import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
    startParkingSession,
    endParkingSession,
    getUserSessions,
    getAllSessions,
    getSessionById,
    getActiveSession,
    getSessionStats
} from '../controller/ParkingSessionController.js';

const router = express.Router();

router.post('/start', authenticateToken, startParkingSession);
router.patch('/:id/end', authenticateToken, endParkingSession);
router.get('/my-sessions', authenticateToken, getUserSessions);
router.get('/active', authenticateToken, getActiveSession);
router.get('/:id', authenticateToken, getSessionById);

router.get('/', authenticateToken, requireAdmin, getAllSessions);
router.get('/stats/summary', authenticateToken, requireAdmin, getSessionStats);

export default router;