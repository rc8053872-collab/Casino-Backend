const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const newGame = {
    slug: 'mega-slots',
    name: 'Mega Slots',
    category: 'slots',
    providerId: '50fb95404b19b978a8983f2ff6cafc6d',
    thumbnail: 'mega-slots.png',
    status: 'ACTIVE',
    minBet: 10,
    maxBet: 10000,
    displayOrder: 10
  };

  await prisma.game.upsert({
    where: { slug: newGame.slug },
    update: newGame,
    create: newGame,
  });

  console.log('Added Mega Slots to database');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
