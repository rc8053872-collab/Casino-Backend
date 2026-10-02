const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const gamesToAdd = [
    {
      slug: 'candy-superwin',
      name: 'Candy Superwin',
      category: 'slots',
      providerId: 'bbe2320adc5c506e7e56a2d24d96a252',
      thumbnail: 'candy-superwin.png',
      status: 'ACTIVE',
      minBet: 10,
      maxBet: 10000,
      displayOrder: 4
    },
    {
      slug: 'diamond-treasure',
      name: 'Diamond treasure',
      category: 'slots',
      providerId: '2f3e4881d685653d536e8b5ab21e113b',
      thumbnail: 'diamond-treasure.png',
      status: 'ACTIVE',
      minBet: 10,
      maxBet: 10000,
      displayOrder: 5
    },
    {
      slug: 'gu-gu-gu-2-m',
      name: 'Gu Gu Gu 2 M',
      category: 'slots',
      providerId: '24e0e334a06f1c2f609908ea51f56945',
      thumbnail: 'gu-gu-gu.png',
      status: 'ACTIVE',
      minBet: 10,
      maxBet: 10000,
      displayOrder: 6
    },
    {
      slug: 'lil-greedy',
      name: '.Lil Greedy™',
      category: 'slots',
      providerId: '5173d58fc02e96521a5c40532fd695e5',
      thumbnail: 'lil-greedy.png',
      status: 'ACTIVE',
      minBet: 10,
      maxBet: 10000,
      displayOrder: 7
    },
    {
      slug: 'handicap-baccarat-a',
      name: '(A) Handicap Baccarat',
      category: 'casino',
      providerId: 'e41ffb6c56c6fde1bf25c57a8fed0510',
      thumbnail: 'baccarat.png',
      status: 'ACTIVE',
      minBet: 10,
      maxBet: 10000,
      displayOrder: 8
    }
  ];

  for (const game of gamesToAdd) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: game,
      create: game,
    });
    console.log(`Added/Updated game: ${game.name}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
