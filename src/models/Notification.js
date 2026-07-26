const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'request_submitted',
        'request_assigned',
        'request_in_progress',
        'request_completed',
        'request_cancelled',
        'payment_received',
        'review_received',
        'new_request_available', // for technicians
      ],
    },
    title: String,
    message: String,
    relatedRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRequest',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);