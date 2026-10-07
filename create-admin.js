const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 12);
  const newReferralCode = crypto.randomBytes(5).toString('hex').toUpperCase();

  const admin = await prisma.user.upsert({
    where: { email: 'admin@orbitplay.com' },
    update: {},
    create: {
      email: 'admin@orbitplay.com',
      username: 'admin',
      mobile: '0000000000',
      passwordHash,
      role: 'ADMIN',
      referralCode: { create: { code: newReferralCode } },
      wallet: { create: { balance: 0, currency: 'INR' } }
    }
  });

  console.log('Admin user created successfully!');
  console.log('Email:', admin.email);
  console.log('Password: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
