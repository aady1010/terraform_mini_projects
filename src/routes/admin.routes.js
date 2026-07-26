const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRevenueChart,
  getRequestsByStatus,
  getRequestsByDevice,
  getUsers,
  toggleUserStatus,
  verifyUser,
  getAllRequests,
  getTechnicianPerformance,
  createAdmin,
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin')); // All admin routes protected

router.get('/stats', getDashboardStats);
router.get('/revenue-chart', getRevenueChart);
router.get('/requests-by-status', getRequestsByStatus);
router.get('/requests-by-device', getRequestsByDevice);
router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.put('/users/:id/verify', verifyUser);
router.get('/requests', getAllRequests);
router.get('/technician-performance', getTechnicianPerformance);
router.post('/create-admin', createAdmin);

module.exports = router;