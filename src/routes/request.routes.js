const express = require('express');
const router = express.Router();
const {
  createRequest,
  getRequests,
  getRequest,
  updateStatus,
  assignTechnician,
  cancelRequest,
  submitReview,
  updatePayment,
} = require('../controllers/request.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect); // All routes require auth

router.route('/').get(getRequests).post(authorize('customer'), createRequest);
router.route('/:id').get(getRequest);
router.put('/:id/status', authorize('technician', 'admin'), updateStatus);
router.put('/:id/assign', authorize('admin'), assignTechnician);
router.put('/:id/cancel', authorize('customer', 'admin'), cancelRequest);
router.post('/:id/review', authorize('customer'), submitReview);
router.put('/:id/payment', authorize('admin', 'technician'), updatePayment);

module.exports = router;