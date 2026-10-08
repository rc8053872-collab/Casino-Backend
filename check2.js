const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.paymentSetting.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' }
  });
  const configured = Boolean(setting?.upiId && setting.qrCodeUrl);
  console.log("Configured:", configured);
  console.log("UPI:", setting?.upiId);
  console.log("QR Length:", setting?.qrCodeUrl?.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
