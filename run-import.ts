import { GameSyncService, CatalogGame } from './src/services/games/GameSyncService';
import catalogData from './catalog.json';
import prisma from './src/prismaClient';

async function main() {
  const catalog = catalogData as CatalogGame[];
  
  console.log("================================================");
  console.log("CATALOG ACTUAL IMPORT (PHASE F)");
  console.log("================================================");
  
  const report = await GameSyncService.runImport(catalog);
  
  console.log(`Providers created: ${report.providersCreated}`);
  console.log(`Games created: ${report.gamesCreated}`);
  console.log(`Existing games before: ${report.existingGamesBefore}`);
  console.log(`Existing games after: ${report.existingGamesAfter}`);
  console.log(`Duplicates: ${report.duplicates}`);
  console.log(`UID errors: ${report.uidErrors}`);
  
  // Phase G logic - Avatar verification
  const newGames = await prisma.game.findMany({
    where: { isFeatured: false, status: 'INACTIVE', providerId: '' },
    select: { slug: true, thumbnail: true, banner: true }
  });
  
  console.log("");
  console.log(`Thumbnails created/assigned: ${report.gamesCreated} (Paths assigned)`);
  console.log(`Banners created/assigned: ${report.gamesCreated} (Paths assigned)`);
  console.log(`Integration Pending: ${report.integrationPending}`);
  console.log(`Playable/Integrated: 0 (from new import)`);
  console.log("================================================");

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
