const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.paymentSetting.findFirst({where: {isActive: true}}).then(s => console.log('Active setting:', s)).catch(e=>console.error(e)).finally(()=>prisma.$disconnect());
