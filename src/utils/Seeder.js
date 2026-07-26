require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const RepairRequest = require('../models/RepairRequest');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB...');

  // Clear existing data
  await User.deleteMany({});
  await RepairRequest.deleteMany({});
  console.log('Cleared existing data...');

  // Create admin
  const admin = await User.create({
    name: 'ePair Admin',
    email: 'admin@epair.com',
    password: 'admin123',
    role: 'admin',
    isVerified: true,
    phone: '555-0000',
  });

  // Create demo customers
  const customers = await User.create([
    { name: 'Alice Johnson', email: 'alice@example.com', password: 'password123', role: 'customer', phone: '555-1001' },
    { name: 'Bob Smith', email: 'bob@example.com', password: 'password123', role: 'customer', phone: '555-1002' },
    { name: 'Carol White', email: 'carol@example.com', password: 'password123', role: 'customer', phone: '555-1003' },
  ]);

  // Create demo technicians
  const technicians = await User.create([
    {
      name: 'Dave Tech',
      email: 'dave@epair.com',
      password: 'password123',
      role: 'technician',
      phone: '555-2001',
      specializations: ['smartphone', 'tablet'],
      bio: 'Expert in mobile device repairs with 5 years experience.',
      experience: 5,
      isVerified: true,
      rating: { average: 4.8, count: 32 },
    },
    {
      name: 'Eve Repairs',
      email: 'eve@epair.com',
      password: 'password123',
      role: 'technician',
      phone: '555-2002',
      specializations: ['laptop', 'desktop'],
      bio: 'Certified PC technician specializing in data recovery and hardware.',
      experience: 7,
      isVerified: true,
      rating: { average: 4.6, count: 28 },
    },
  ]);

  // Create sample repair requests
  await RepairRequest.create([
    {
      customer: customers[0]._id,
      technician: technicians[0]._id,
      deviceType: 'smartphone',
      deviceBrand: 'Samsung',
      deviceModel: 'Galaxy S22',
      issueDescription: 'Screen cracked after drop',
      issueCategory: 'screen',
      status: 'in_progress',
      serviceType: 'home_visit',
      estimatedCost: 120,
      priority: 'high',
      statusHistory: [
        { status: 'pending', note: 'Request submitted', changedBy: customers[0]._id },
        { status: 'assigned', note: 'Technician assigned', changedBy: admin._id },
        { status: 'in_progress', note: 'Repair started', changedBy: technicians[0]._id },
      ],
    },
    {
      customer: customers[1]._id,
      technician: technicians[1]._id,
      deviceType: 'laptop',
      deviceBrand: 'Dell',
      deviceModel: 'XPS 15',
      issueDescription: 'Laptop not turning on',
      issueCategory: 'hardware',
      status: 'completed',
      serviceType: 'drop_off',
      estimatedCost: 200,
      finalCost: 185,
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      payment: { status: 'paid', method: 'card', paidAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
      review: { rating: 5, comment: 'Excellent service, very fast!', createdAt: new Date() },
      statusHistory: [
        { status: 'pending', note: 'Request submitted', changedBy: customers[1]._id },
        { status: 'assigned', note: 'Technician assigned', changedBy: admin._id },
        { status: 'completed', note: 'Repair complete', changedBy: technicians[1]._id },
      ],
    },
    {
      customer: customers[2]._id,
      deviceType: 'tablet',
      deviceBrand: 'Apple',
      deviceModel: 'iPad Air',
      issueDescription: 'Battery drains very fast',
      issueCategory: 'battery',
      status: 'pending',
      serviceType: 'home_visit',
      priority: 'normal',
      statusHistory: [{ status: 'pending', note: 'Request submitted', changedBy: customers[2]._id }],
    },
  ]);

  console.log('✅ Seed data inserted successfully!');
  console.log('\n--- Login Credentials ---');
  console.log('Admin:       admin@epair.com   / admin123');
  console.log('Customer 1:  alice@example.com / password123');
  console.log('Customer 2:  bob@example.com   / password123');
  console.log('Technician:  dave@epair.com    / password123');
  console.log('Technician:  eve@epair.com     / password123');

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});