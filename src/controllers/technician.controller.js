const User = require('../models/User');
const RepairRequest = require('../models/RepairRequest');

// @desc    Get available technicians
// @route   GET /api/technicians
// @access  Private (admin)
exports.getTechnicians = async (req, res, next) => {
  try {
    const { specialization, isAvailable } = req.query;
    const query = { role: 'technician', isActive: true };

    if (specialization) query.specializations = specialization;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';

    const technicians = await User.find(query).sort({ 'rating.average': -1 });

    res.status(200).json({ success: true, count: technicians.length, data: technicians });
  } catch (error) {
    next(error);
  }
};

// @desc    Get technician public profile
// @route   GET /api/technicians/:id
// @access  Public
exports.getTechnicianProfile = async (req, res, next) => {
  try {
    const technician = await User.findOne({ _id: req.params.id, role: 'technician' }).select('-__v');

    if (!technician) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    // Get recent reviews from completed jobs
    const reviews = await RepairRequest.find({
      technician: req.params.id,
      'review.rating': { $exists: true },
    })
      .select('review deviceType deviceBrand createdAt')
      .populate('customer', 'name')
      .sort({ completedAt: -1 })
      .limit(10);

    res.status(200).json({ success: true, data: { technician, reviews } });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle availability (technician self-manages)
// @route   PUT /api/technicians/availability
// @access  Private (technician)
exports.toggleAvailability = async (req, res, next) => {
  try {
    const tech = await User.findById(req.user.id);
    tech.isAvailable = !tech.isAvailable;
    await tech.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `You are now ${tech.isAvailable ? 'available' : 'unavailable'}`,
      isAvailable: tech.isAvailable,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get technician's own stats
// @route   GET /api/technicians/my-stats
// @access  Private (technician)
exports.getMyStats = async (req, res, next) => {
  try {
    const [total, completed, inProgress, pending, revenueData] = await Promise.all([
      RepairRequest.countDocuments({ technician: req.user.id }),
      RepairRequest.countDocuments({ technician: req.user.id, status: 'completed' }),
      RepairRequest.countDocuments({ technician: req.user.id, status: 'in_progress' }),
      RepairRequest.countDocuments({ technician: req.user.id, status: 'assigned' }),
      RepairRequest.aggregate([
        { $match: { technician: req.user._id, 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$finalCost' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalJobs: total,
        completedJobs: completed,
        inProgressJobs: inProgress,
        pendingJobs: pending,
        totalEarnings: revenueData[0]?.total || 0,
        rating: req.user.rating,
      },
    });
  } catch (error) {
    next(error);
  }
};