const mongoose = require('mongoose');

const repairRequestSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Device Info
    deviceType: {
      type: String,
      required: true,
      enum: ['smartphone', 'laptop', 'tablet', 'desktop', 'TV', 'smartwatch', 'gaming_console', 'other'],
    },
    deviceBrand: {
      type: String,
      required: true,
      trim: true,
    },
    deviceModel: {
      type: String,
      trim: true,
    },
    issueDescription: {
      type: String,
      required: [true, 'Please describe the issue'],
      trim: true,
    },
    issueCategory: {
      type: String,
      enum: ['screen', 'battery', 'charging', 'software', 'hardware', 'water_damage', 'other'],
      default: 'other',
    },
    images: [String], // URLs/paths of device images
    // Scheduling
    preferredDate: Date,
    scheduledDate: Date,
    serviceType: {
      type: String,
      enum: ['home_visit', 'drop_off', 'remote'],
      default: 'home_visit',
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    // Status Tracking
    status: {
      type: String,
      enum: [
        'pending',       // just submitted
        'assigned',      // technician assigned
        'in_progress',   // technician working on it
        'on_hold',       // waiting for parts or info
        'completed',     // repair done
        'cancelled',     // cancelled by customer or admin
        'rejected',      // rejected by technician
      ],
      default: 'pending',
    },
    statusHistory: [
      {
        status: String,
        note: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    // Pricing
    estimatedCost: {
      type: Number,
      default: null,
    },
    finalCost: {
      type: Number,
      default: null,
    },
    // Payment
    payment: {
      status: {
        type: String,
        enum: ['unpaid', 'partial', 'paid'],
        default: 'unpaid',
      },
      method: {
        type: String,
        enum: ['cash', 'card', 'online', 'wallet'],
        default: null,
      },
      paidAt: Date,
      transactionId: String,
    },
    // Review
    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdAt: Date,
    },
    // Internal notes
    technicianNotes: String,
    completedAt: Date,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
  },
  { timestamps: true }
);

// Index for dashboard queries
repairRequestSchema.index({ status: 1, createdAt: -1 });
repairRequestSchema.index({ customer: 1 });
repairRequestSchema.index({ technician: 1 });

module.exports = mongoose.model('RepairRequest', repairRequestSchema);