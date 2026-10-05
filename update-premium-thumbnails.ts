import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    // 3 Big Barrels Aztec variants
    await prisma.game.updateMany({
        where: { name: { contains: '3 Big Barrels Aztec' } },
        data: { thumbnail: '/icons/3-big-barrels-aztec.jpg' }
    });

    // 3 Power Dragons
    await prisma.game.updateMany({
        where: { name: { contains: '3 Power Dragons' } },
        data: { thumbnail: '/icons/3-power-dragons.jpg' }
    });

    // 3 African Drums variants
    await prisma.game.updateMany({
        where: { name: { contains: '3 African Drums' } },
        data: { thumbnail: '/icons/3-african-drums.jpg' }
    });

    // 25 Coins Santas Jackpot
    await prisma.game.updateMany({
        where: { name: { contains: '25 Coins Santas' } },
        data: { thumbnail: '/icons/25-coins-santas.jpg' }
    });

    console.log("Thumbnails updated for premium logos.");
}

main();
