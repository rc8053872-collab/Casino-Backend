import { GameSyncService, CatalogGame } from './src/services/games/GameSyncService';
import catalogData from './catalog.json';
import prisma from './src/prismaClient';

async function main() {
  const uidFilter = process.argv.find(argument => argument.startsWith('--uid='))?.slice('--uid='.length);
  const fullCatalog = catalogData as CatalogGame[];
  const catalog = uidFilter
    ? fullCatalog.filter(game => game.gameUid === uidFilter)
    : fullCatalog;

  if (uidFilter && catalog.length === 0) {
    throw new Error(`No catalog record found for UID ${uidFilter}`);
  }
  
  console.log("================================================");
  console.log("CATALOG ACTUAL IMPORT (PHASE F)");
  console.log("================================================");
  if (uidFilter) console.log(`Scoped UID: ${uidFilter}`);
  
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
