const RepairRequest = require('../models/RepairRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Helper: create notification
const notify = async (recipientId, type, title, message, requestId) => {
  await Notification.create({ recipient: recipientId, type, title, message, relatedRequest: requestId });
};

// @desc    Create repair request
// @route   POST /api/requests
// @access  Private (customer)
exports.createRequest = async (req, res, next) => {
  try {
    const { deviceType, deviceBrand, deviceModel, issueDescription, issueCategory, preferredDate, serviceType, address, priority } = req.body;

    const request = await RepairRequest.create({
      customer: req.user.id,
      deviceType,
      deviceBrand,
      deviceModel,
      issueDescription,
      issueCategory,
      preferredDate,
      serviceType,
      address: address || req.user.address,
      priority,
      statusHistory: [{ status: 'pending', note: 'Request submitted', changedBy: req.user.id }],
    });

    await notify(req.user.id, 'request_submitted', 'Request Submitted', `Your repair request for ${deviceBrand} ${deviceModel || ''} has been submitted.`, request._id);

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all requests (customer: own, technician: assigned, admin: all)
// @route   GET /api/requests
// @access  Private
exports.getRequests = async (req, res, next) => {
  try {
    const { status, deviceType, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'customer') query.customer = req.user.id;
    else if (req.user.role === 'technician') query.technician = req.user.id;

    if (status) query.status = status;
    if (deviceType) query.deviceType = deviceType;

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      RepairRequest.find(query)
        .populate('customer', 'name email phone')
        .populate('technician', 'name email phone rating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RepairRequest.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: requests.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: Number(page),
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single request
// @route   GET /api/requests/:id
// @access  Private
exports.getRequest = async (req, res, next) => {
  try {
    const request = await RepairRequest.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('technician', 'name email phone rating specializations')
      .populate('statusHistory.changedBy', 'name role');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Access control
    const isOwner = request.customer._id.toString() === req.user.id;
    const isTech = request.technician && request.technician._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isTech && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Update request status
// @route   PUT /api/requests/:id/status
// @access  Private (technician, admin)
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note, estimatedCost, finalCost, technicianNotes } = req.body;

    const request = await RepairRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Only assigned technician or admin can update status
    const isTech = request.technician && request.technician.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isTech && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    request.status = status;
    request.statusHistory.push({ status, note, changedBy: req.user.id });
    if (estimatedCost !== undefined) request.estimatedCost = estimatedCost;
    if (finalCost !== undefined) request.finalCost = finalCost;
    if (technicianNotes) request.technicianNotes = technicianNotes;
    if (status === 'completed') request.completedAt = new Date();

    await request.save();

    // Notify customer
    const messages = {
      in_progress: 'Your device repair has started!',
      completed: 'Your device has been repaired! Ready for pickup/delivery.',
      on_hold: 'Your repair is on hold. The technician will provide more info.',
      cancelled: 'Your repair request has been cancelled.',
    };

    if (messages[status]) {
      await notify(request.customer, `request_${status}`.replace('_', '_'), 'Repair Update', messages[status], request._id);
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign technician to request
// @route   PUT /api/requests/:id/assign
// @access  Private (admin)
exports.assignTechnician = async (req, res, next) => {
  try {
    const { technicianId, scheduledDate } = req.body;

    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician') {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    const request = await RepairRequest.findByIdAndUpdate(
      req.params.id,
      {
        technician: technicianId,
        scheduledDate,
        status: 'assigned',
        $push: { statusHistory: { status: 'assigned', note: `Assigned to ${technician.name}`, changedBy: req.user.id } },
      },
      { new: true }
    ).populate('customer technician', 'name email phone');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Notify both parties
    await notify(request.customer._id, 'request_assigned', 'Technician Assigned', `${technician.name} has been assigned to your repair.`, request._id);
    await notify(technicianId, 'new_request_available', 'New Job Assigned', `You have been assigned a repair job for ${request.deviceBrand}.`, request._id);

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel repair request
// @route   PUT /api/requests/:id/cancel
// @access  Private (customer, admin)
exports.cancelRequest = async (req, res, next) => {
  try {
    const request = await RepairRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const isOwner = request.customer.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (['completed', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${request.status} request` });
    }

    request.status = 'cancelled';
    request.statusHistory.push({ status: 'cancelled', note: req.body.reason || 'Cancelled by user', changedBy: req.user.id });
    await request.save();

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit review for completed repair
// @route   POST /api/requests/:id/review
// @access  Private (customer)
exports.submitReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const request = await RepairRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (request.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed repairs' });
    }

    if (request.review && request.review.rating) {
      return res.status(400).json({ success: false, message: 'Already reviewed' });
    }

    request.review = { rating, comment, createdAt: new Date() };
    await request.save();

    // Update technician's average rating
    if (request.technician) {
      const tech = await User.findById(request.technician);
      const newCount = tech.rating.count + 1;
      const newAvg = ((tech.rating.average * tech.rating.count) + rating) / newCount;
      tech.rating = { average: Math.round(newAvg * 10) / 10, count: newCount };
      await tech.save();

      await notify(request.technician, 'review_received', 'New Review', `You received a ${rating}-star review!`, request._id);
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Update payment status
// @route   PUT /api/requests/:id/payment
// @access  Private (admin, technician)
exports.updatePayment = async (req, res, next) => {
  try {
    const { status, method, transactionId } = req.body;

    const request = await RepairRequest.findByIdAndUpdate(
      req.params.id,
      {
        'payment.status': status,
        'payment.method': method,
        'payment.transactionId': transactionId,
        'payment.paidAt': status === 'paid' ? new Date() : undefined,
      },
      { new: true }
    );

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (status === 'paid') {
      await notify(request.customer, 'payment_received', 'Payment Confirmed', 'Your payment has been received. Thank you!', request._id);
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};