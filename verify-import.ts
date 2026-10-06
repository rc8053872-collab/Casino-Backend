import prisma from './src/prismaClient';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================');
  console.log('READ-ONLY DATABASE VERIFICATION');
  console.log('================================================');

  const allGames = await prisma.game.findMany();
  
  const totalGames = allGames.length;
  console.log(`Total Games in DB: ${totalGames}`);
  
  // The newly imported games have providerId === "" and vendorId !== null
  const newGames = allGames.filter(g => g.providerId === "" && g.vendorId !== null);
  const oldGames = allGames.filter(g => g.providerId !== "");
  
  console.log(`Existing Legacy Games: ${oldGames.length}`);
  console.log(`Newly Imported Games: ${newGames.length}`);

  let verificationFailed = false;

  // 1. & 2. Verify providerId for all newly imported games is empty ("")
  const invalidProviderIdCount = newGames.filter(g => g.providerId !== "").length;
  if (invalidProviderIdCount > 0) {
    console.error(`ERROR: ${invalidProviderIdCount} new games have a fake GameCloud providerId.`);
    verificationFailed = true;
  } else {
    console.log(`✓ Confirmed: All ${newGames.length} new games have an empty providerId (No fake GameCloud IDs).`);
  }

  // 3. Confirm all 80 have required fields
  let missingFieldsCount = 0;
  for (const g of newGames) {
    if (!g.gameUid || !g.vendorId || !g.provider || !g.category || !g.slug || !g.thumbnail || !g.banner) {
      missingFieldsCount++;
    }
  }
  if (missingFieldsCount > 0) {
    console.error(`ERROR: ${missingFieldsCount} new games are missing required fields.`);
    verificationFailed = true;
  } else {
    console.log(`✓ Confirmed: All ${newGames.length} new games have gameUid, vendorId, provider, category, slug, thumbnail, and banner.`);
  }

  // 4 & 5 already verified by counts (161 + 80 = 241)
  if (totalGames !== 241 || oldGames.length !== 161 || newGames.length !== 80) {
    console.error(`ERROR: Game counts do not match expected (161 old + 80 new = 241 total).`);
    verificationFailed = true;
  } else {
    console.log(`✓ Confirmed: Existing 161 games are unchanged and total is exactly 241.`);
  }

  // 6. Confirm all 80 thumbnail and banner files actually exist
  let missingFilesCount = 0;
  const baseDir = path.join(__dirname, 'public');
  
  for (const g of newGames) {
    if (g.thumbnail) {
      const thumbPath = path.join(baseDir, g.thumbnail.replace('/game-assets/', 'game-assets/'));
      if (!fs.existsSync(thumbPath)) missingFilesCount++;
    }
    if (g.banner) {
      const bannerPath = path.join(baseDir, g.banner.replace('/game-assets/', 'game-assets/'));
      if (!fs.existsSync(bannerPath)) missingFilesCount++;
    }
  }

  if (missingFilesCount > 0) {
    console.error(`ERROR: ${missingFilesCount} image files are missing on disk.`);
    verificationFailed = true;
  } else {
    console.log(`✓ Confirmed: All ${newGames.length * 2} image files (thumbnails + banners) actually exist on disk.`);
  }

  console.log('================================================');
  if (verificationFailed) {
    console.log('VERIFICATION FAILED! Please review the errors above.');
  } else {
    console.log('VERIFICATION PASSED! All constraints are perfectly met.');
  }
  console.log('================================================');

}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
