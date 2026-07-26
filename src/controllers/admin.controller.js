const User = require('../models/User');
const RepairRequest = require('../models/RepairRequest');

// @desc    Get dashboard overview stats
// @route   GET /api/admin/stats
// @access  Private (admin)
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalCustomers,
      totalTechnicians,
      totalRequests,
      activeRepairs,
      completedThisMonth,
      completedLastMonth,
      pendingRequests,
      revenueThisMonth,
      revenueLastMonth,
      recentRequests,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer', isActive: true }),
      User.countDocuments({ role: 'technician', isActive: true }),
      RepairRequest.countDocuments(),
      RepairRequest.countDocuments({ status: { $in: ['assigned', 'in_progress'] } }),
      RepairRequest.countDocuments({ status: 'completed', completedAt: { $gte: startOfMonth } }),
      RepairRequest.countDocuments({ status: 'completed', completedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      RepairRequest.countDocuments({ status: 'pending' }),
      RepairRequest.aggregate([
        { $match: { 'payment.status': 'paid', 'payment.paidAt': { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$finalCost' } } },
      ]),
      RepairRequest.aggregate([
        { $match: { 'payment.status': 'paid', 'payment.paidAt': { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$finalCost' } } },
      ]),
      RepairRequest.find()
        .populate('customer', 'name email')
        .populate('technician', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const thisMonthRevenue = revenueThisMonth[0]?.total || 0;
    const lastMonthRevenue = revenueLastMonth[0]?.total || 0;
    const revenueGrowth = lastMonthRevenue === 0 ? 100 : (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCustomers,
          totalTechnicians,
          totalRequests,
          activeRepairs,
          pendingRequests,
        },
        revenue: {
          thisMonth: thisMonthRevenue,
          lastMonth: lastMonthRevenue,
          growthPercent: Number(revenueGrowth),
        },
        repairs: {
          completedThisMonth,
          completedLastMonth,
          growthPercent: completedLastMonth === 0 ? 100 : (((completedThisMonth - completedLastMonth) / completedLastMonth) * 100).toFixed(1),
        },
        recentRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue chart data (last 12 months)
// @route   GET /api/admin/revenue-chart
// @access  Private (admin)
exports.getRevenueChart = async (req, res, next) => {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const data = await RepairRequest.aggregate([
      {
        $match: {
          'payment.status': 'paid',
          'payment.paidAt': { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$payment.paidAt' },
            month: { $month: '$payment.paidAt' },
          },
          revenue: { $sum: '$finalCost' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = data.map((d) => ({
      month: `${months[d._id.month - 1]} ${d._id.year}`,
      revenue: d.revenue,
      repairs: d.count,
    }));

    res.status(200).json({ success: true, data: chartData });
  } catch (error) {
    next(error);
  }
};

// @desc    Get requests breakdown by status
// @route   GET /api/admin/requests-by-status
// @access  Private (admin)
exports.getRequestsByStatus = async (req, res, next) => {
  try {
    const data = await RepairRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: data.map((d) => ({ status: d._id, count: d.count })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get requests breakdown by device type
// @route   GET /api/admin/requests-by-device
// @access  Private (admin)
exports.getRequestsByDevice = async (req, res, next) => {
  try {
    const data = await RepairRequest.aggregate([
      { $group: { _id: '$deviceType', count: { $sum: 1 }, revenue: { $sum: '$finalCost' } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: data.map((d) => ({ deviceType: d._id, count: d.count, revenue: d.revenue || 0 })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users (customers & technicians)
// @route   GET /api/admin/users
// @access  Private (admin)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 20, search } = req.query;
    const query = { role: { $ne: 'admin' } };

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({ success: true, count: users.length, total, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate/Deactivate user
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private (admin)
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify a technician
// @route   PUT /api/admin/users/:id/verify
// @access  Private (admin)
exports.verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, message: 'User verified', data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all requests (admin view, with full filters)
// @route   GET /api/admin/requests
// @access  Private (admin)
exports.getAllRequests = async (req, res, next) => {
  try {
    const { status, deviceType, technicianId, customerId, priority, page = 1, limit = 20, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (deviceType) query.deviceType = deviceType;
    if (technicianId) query.technician = technicianId;
    if (customerId) query.customer = customerId;
    if (priority) query.priority = priority;
    if (search) query.issueDescription = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      RepairRequest.find(query)
        .populate('customer', 'name email phone')
        .populate('technician', 'name email phone')
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
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get technician performance report
// @route   GET /api/admin/technician-performance
// @access  Private (admin)
exports.getTechnicianPerformance = async (req, res, next) => {
  try {
    const data = await RepairRequest.aggregate([
      { $match: { technician: { $ne: null } } },
      {
        $group: {
          _id: '$technician',
          totalJobs: { $sum: 1 },
          completedJobs: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalRevenue: { $sum: '$finalCost' },
          avgRating: { $avg: '$review.rating' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'technician',
        },
      },
      { $unwind: '$technician' },
      {
        $project: {
          name: '$technician.name',
          email: '$technician.email',
          totalJobs: 1,
          completedJobs: 1,
          completionRate: { $multiply: [{ $divide: ['$completedJobs', '$totalJobs'] }, 100] },
          totalRevenue: 1,
          avgRating: { $round: ['$avgRating', 1] },
        },
      },
      { $sort: { completedJobs: -1 } },
    ]);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Create admin user (only by existing admin)
// @route   POST /api/admin/create-admin
// @access  Private (admin)
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });

    const admin = await User.create({ name, email, password, phone, role: 'admin', isVerified: true });
    res.status(201).json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};