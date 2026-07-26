const express = require('express');
const router = express.Router();
const {
  getTechnicians,
  getTechnicianProfile,
  toggleAvailability,
  getMyStats,
} = require('../controllers/technician.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin'), getTechnicians);
router.get('/my-stats', protect, authorize('technician'), getMyStats);
router.put('/availability', protect, authorize('technician'), toggleAvailability);
router.get('/:id', getTechnicianProfile); // Public

module.exports = router;