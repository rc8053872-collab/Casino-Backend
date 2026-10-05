import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const game = await prisma.game.findFirst({where: {thumbnail: {not: null}}});
    console.log(game?.thumbnail);
    const recent = await prisma.game.findFirst({where: {providerId: 'eb70e20d756eb4bf4e2b683465b8f9c5'}});
    console.log("Recent:", recent?.thumbnail);
}
main();
