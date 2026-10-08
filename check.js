const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.paymentSetting.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' }
  });
  console.log(setting);
}

main().catch(console.error).finally(() => prisma.$disconnect());
