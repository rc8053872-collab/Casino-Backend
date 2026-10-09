const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const email = 'AdminMukesh@gmail.com';
  const password = 'Admin@123';
  const passwordHash = await bcrypt.hash(password, 12);

  const existingUser = await prisma.user.findFirst({
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash, role: 'ADMIN', status: 'ACTIVE' }
    });
    console.log('Admin user updated successfully.');
  } else {
    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: email.toLowerCase(),
        mobile: '0000000000',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        wallet: {
          create: {
            balance: 0,
            currency: 'INR'
          }
        }
      }
    });
    console.log('Admin user created successfully.');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
