import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyze() {
  const games = await prisma.game.findMany();
  console.log('Total Games:', games.length);
  if (games.length > 0) {
    console.log('Sample game:', JSON.stringify(games[0], null, 2));
  }
  
  // Checking duplicate slugs
  const slugs = games.map(g => g.slug);
  const uniqueSlugs = new Set(slugs);
  console.log('Total Unique Slugs:', uniqueSlugs.size);
  
  const providers = await prisma.game.findMany({
    select: { providerId: true },
    distinct: ['providerId']
  });
  console.log('Providers currently in use:', providers.map(p => p.providerId));
  
  await prisma.$disconnect();
}
analyze().catch(e => { console.error(e); process.exit(1); });
