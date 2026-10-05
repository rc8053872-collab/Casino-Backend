import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.game.updateMany({
        where: { providerId: 'eb70e20d756eb4bf4e2b683465b8f9c5' },
        data: { thumbnail: '3-big-barrels-aztec.jpg' }
    });
    await prisma.game.updateMany({
        where: { providerId: 'c08670e7c2c90f6a565fa9516e842924' },
        data: { thumbnail: '3-power-dragons.jpg' }
    });
    console.log("Thumbnails updated successfully.");
}
main();
