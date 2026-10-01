import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Game catalog sync started...");
  
  const games = [
    {
      slug: "spribe_aviator",
      name: "Aviator",
      providerId: "50fb95404b19b978a8983f2ff6cafc6d",
      category: "crash",
      status: "ACTIVE",
      thumbnail: "aviator.png",
      displayOrder: 1,
      minBet: 10,
      maxBet: 10000,
    },
    {
      slug: "neon-reels",
      name: "Neon Reels",
      providerId: "neon-reels",
      category: "slots",
      status: "ACTIVE",
      thumbnail: "neon-reels.png",
      displayOrder: 2,
      minBet: 10,
      maxBet: 10000,
    },
    {
      slug: "dragon-tiger",
      name: "Dragon Tiger",
      providerId: "dragon-tiger",
      category: "table",
      status: "ACTIVE",
      thumbnail: "dragon-tiger.png",
      displayOrder: 3,
      minBet: 10,
      maxBet: 10000,
    },
  ];

  for (const game of games) {
    const existing = await prisma.game.findFirst({
      where: { slug: game.slug }
    });

    if (existing) {
      const updated = await prisma.game.update({
        where: { id: existing.id },
        data: game,
      });
      console.log(`Updated: ${game.slug}`);
      console.log(`Game ObjectId: ${updated.id}`);
    } else {
      const created = await prisma.game.create({
        data: game,
      });
      console.log(`Created: ${game.slug}`);
      console.log(`Game ObjectId: ${created.id}`);
    }
  }

  console.log("Game catalog sync completed.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
