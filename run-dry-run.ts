import { GameSyncService, CatalogGame } from './src/services/games/GameSyncService';
import catalogData from './catalog.json';

async function main() {
  const catalog = catalogData as CatalogGame[];
  
  console.log("================================================");
  console.log("CATALOG IMPORT PREVIEW (DRY RUN)");
  console.log("================================================");
  
  const report = await GameSyncService.runDryRun(catalog);
  
  console.log(`Total screenshot catalog records: ${report.totalScreenshotRecords}`);
  console.log(`Valid records: ${report.validRecords}`);
  console.log(`Invalid records: ${report.invalidRecords}`);
  console.log(`UID review required: ${report.uidReviewRequired}`);
  console.log(`Existing matches: ${report.existingMatches}`);
  console.log(`New games to add: ${report.newGames}`);
  console.log(`Duplicates prevented: ${report.duplicates}`);
  console.log(`New providers to create: ${report.newProviders.length}`);
  console.log(`Existing providers: ${report.existingProviders.length}`);
  console.log("");
  console.log("New Providers List:");
  console.log(report.newProviders.join(", "));
  console.log("================================================");

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
