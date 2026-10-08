const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.paymentSetting.updateMany({ data: { isActive: false } });
  const setting = await prisma.paymentSetting.create({
    data: {
      upiId: 'orbit-demo@upi',
      qrCodeUrl: '/demo-payment-qr.svg',
      isActive: true
    }
  });
  console.log('Payment settings configured:', setting);
}

main().catch(console.error).finally(() => prisma.$disconnect());
