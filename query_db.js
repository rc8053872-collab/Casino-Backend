const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const games = await prisma.game.findMany();
  console.log(JSON.stringify(games, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
