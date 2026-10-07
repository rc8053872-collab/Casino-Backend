import prisma from '../../prismaClient';

export interface CatalogGame {
  name: string;
  provider: string;
  category: string;
  gameUid: string;
}

export class GameSyncService {
  
  static normalizeProviderName(name: string): string {
    return name.trim();
  }
  
  static normalizeSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  static async runDryRun(catalog: CatalogGame[]) {
    const report = {
      totalScreenshotRecords: catalog.length,
      validRecords: 0,
      invalidRecords: 0,
      uidReviewRequired: 0,
      existingMatches: 0,
      newGames: 0,
      duplicates: 0,
      newProviders: new Set<string>(),
      existingProviders: new Set<string>(),
    };

    // Load existing providers
    const existingProvidersList = await prisma.provider.findMany();
    const existingProviderMap = new Map(existingProvidersList.map(p => [p.name.toLowerCase(), p]));

    // Load all games to check duplicates and matches
    const allGames = await prisma.game.findMany({
      include: { vendor: true }
    });

    const processedUids = new Set<string>();

    for (const item of catalog) {
      if (!item.gameUid || item.gameUid.trim() === '') {
        report.invalidRecords++;
        report.uidReviewRequired++;
        continue;
      }
      report.validRecords++;

      const providerName = this.normalizeProviderName(item.provider);
      const providerKey = providerName.toLowerCase();
      
      let providerId = 'pending';
      if (existingProviderMap.has(providerKey)) {
        report.existingProviders.add(providerName);
        providerId = existingProviderMap.get(providerKey)!.id;
      } else {
        report.newProviders.add(providerName);
      }

      const identityKey = `${providerKey}_${item.gameUid}`;
      if (processedUids.has(identityKey)) {
        report.duplicates++;
        continue;
      }
      processedUids.add(identityKey);

      // Check if existing match
      const existingMatch = allGames.find(g => 
        (g.vendorId === providerId && g.gameUid === item.gameUid) || 
        // fallback if previously imported without vendorId maybe
        (g.vendor?.name?.toLowerCase() === providerKey && g.gameUid === item.gameUid)
      );

      if (existingMatch) {
        report.existingMatches++;
      } else {
        report.newGames++;
      }
    }

    return {
      ...report,
      newProviders: Array.from(report.newProviders),
      existingProviders: Array.from(report.existingProviders),
    };
  }

  static async runImport(catalog: CatalogGame[]) {
    const report = {
      providersCreated: 0,
      gamesCreated: 0,
      existingGamesBefore: await prisma.game.count(),
      existingGamesAfter: 0,
      duplicates: 0,
      uidErrors: 0,
      integrationPending: 0,
    };

    // 1. Process Providers
    const providerNames = [...new Set(catalog.map(c => this.normalizeProviderName(c.provider)))];
    for (const name of providerNames) {
      const slug = this.normalizeSlug(name);
      await prisma.provider.upsert({
        where: { name },
        update: {},
        create: { name, slug, status: 'ACTIVE' },
      });
      report.providersCreated++;
    }

    const providers = await prisma.provider.findMany();
    const providerMap = new Map(providers.map(p => [p.name, p]));

    // 2. Process Games
    for (const item of catalog) {
      if (!item.gameUid || item.gameUid.trim() === '') {
        report.uidErrors++;
        continue;
      }

      const pName = this.normalizeProviderName(item.provider);
      const provider = providerMap.get(pName);
      if (!provider) continue;

      // Check if already exists by vendorId + gameUid
      const existingGame = await prisma.game.findFirst({
        where: { vendorId: provider.id, gameUid: item.gameUid }
      });

      if (existingGame) {
        await prisma.game.update({
          where: { id: existingGame.id },
          data: {
            thumbnail: `/game-assets/${existingGame.slug}/thumbnail.webp`,
            banner: `/game-assets/${existingGame.slug}/banner.webp`,
          },
        });
        report.duplicates++;
        continue; // Do not overwrite existing game
      }

      // Generate Safe Slug
      let baseSlug = this.normalizeSlug(`${item.name}-${pName}`);
      let finalSlug = baseSlug;
      let counter = 1;
      while (await prisma.game.findUnique({ where: { slug: finalSlug } })) {
        counter++;
        finalSlug = `${baseSlug}-${counter}`;
      }

      const thumbnailPath = `/game-assets/${finalSlug}/thumbnail.webp`;
      const bannerPath = `/game-assets/${finalSlug}/banner.webp`;

      await prisma.game.create({
        data: {
          slug: finalSlug,
          name: item.name,
          category: item.category,
          providerId: "", // Legacy GameCloud UID left empty
          provider: item.provider, // Legacy provider name for display fallback
          
          vendorId: provider.id,
          gameUid: item.gameUid,
          
          thumbnail: thumbnailPath,
          banner: bannerPath,
          
          status: 'INACTIVE', // Using INACTIVE as INTEGRATION_PENDING equivalent if enum restricts
          isActive: false, // INTEGRATION_PENDING
          
          metadata: { status: 'INTEGRATION_PENDING', isNewCatalog: true },
        }
      });
      report.gamesCreated++;
      report.integrationPending++;
    }

    report.existingGamesAfter = await prisma.game.count();
    
    // We expect existingGamesAfter to be existingGamesBefore + gamesCreated
    
    return report;
  }
}
