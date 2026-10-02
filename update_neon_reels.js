const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.game.updateMany({
    where: { slug: 'neon-reels' },
    data: { providerId: '50fb95404b19b978a8983f2ff6cafc6d' }
  });
  console.log('Updated Neon Reels providerId to 50fb95404b19b978a8983f2ff6cafc6d');
}

run().catch(console.error).finally(() => prisma.$disconnect());
