import { GameSyncService, CatalogGame } from './src/services/games/GameSyncService';
import catalogData from './catalog.json';

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
  console.log("CATALOG IMPORT PREVIEW (DRY RUN)");
  console.log("================================================");
  if (uidFilter) console.log(`Scoped UID: ${uidFilter}`);
  
  const report = await GameSyncService.runDryRun(catalog);
  
  console.log(`Total screenshot catalog records: ${report.totalScreenshotRecords}`);
  console.log(`Valid records: ${report.validRecords}`);
  console.log(`Invalid records: ${report.invalidRecords}`);
  console.log(`UID review required: ${report.uidReviewRequired}`);
  console.log(`Existing matches: ${report.existingMatches}`);
  console.log(`New games to add: ${report.newGames}`);
  console.log(`UID/provider conflicts: ${report.uidProviderConflicts}`);
  console.log(`Duplicates prevented: ${report.duplicates}`);
  console.log(`Duplicate database records for UID/provider: ${report.duplicateUidRecords}`);
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
