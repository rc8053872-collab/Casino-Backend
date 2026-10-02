const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.game.updateMany({
    where: { slug: 'spribe_aviator' },
    data: { providerId: 'bbe2320adc5c506e7e56a2d24d96a252' }
  });
  console.log('Updated Aviator');
  
  await prisma.game.updateMany({
    where: { slug: 'neon-reels' },
    data: { providerId: '2f3e4881d685653d536e8b5ab21e113b' }
  });
  console.log('Updated Neon Reels');
  
  await prisma.game.updateMany({
    where: { slug: 'dragon-tiger' },
    data: { providerId: '24e0e334a06f1c2f609908ea51f56945' }
  });
  console.log('Updated Dragon Tiger');
}

run().catch(console.error).finally(()=>prisma.$disconnect());
