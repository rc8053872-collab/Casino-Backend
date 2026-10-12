const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const artifactsDir = 'C:\\Users\\kdb12\\.gemini\\antigravity-ide\\brain\\f2986493-7511-417f-a1dc-5d6e81bfdb61';
const img3Cards = path.join(artifactsDir, 'three_cards_judgement_1791806564374.jpg');
const imgArena = path.join(artifactsDir, 'arena_of_cards_1791806584025.jpg');
const imgBaccarat = path.join(artifactsDir, 'baccarat_luxury_card_1791806603567.jpg');

const frontendGameArtDir = path.join(__dirname, '..', '..', 'Casino-frontend-main', 'public', 'game-art');
const frontendIconsDir = path.join(__dirname, '..', '..', 'Casino-frontend-main', 'public', 'icons');
const backendPublicDir = path.join(__dirname, '..', 'public', 'game-assets');

async function processImages() {
  console.log('Processing images...');

  // Ensure directories exist
  if (!fs.existsSync(frontendGameArtDir)) fs.mkdirSync(frontendGameArtDir, { recursive: true });
  if (!fs.existsSync(frontendIconsDir)) fs.mkdirSync(frontendIconsDir, { recursive: true });

  // 1. 3 Cards Judgement
  if (fs.existsSync(img3Cards)) {
    const target3CardsWebp = path.join(frontendGameArtDir, '3-cards-judgement-mac88.webp');
    const target3CardsAltWebp = path.join(frontendGameArtDir, '3-cards-judgement.webp');
    const target3CardsJpg = path.join(frontendIconsDir, '3-cards-judgement.jpg');

    await sharp(img3Cards).resize(600, 600).webp({ quality: 90 }).toFile(target3CardsWebp);
    await sharp(img3Cards).resize(600, 600).webp({ quality: 90 }).toFile(target3CardsAltWebp);
    await sharp(img3Cards).resize(600, 600).jpeg({ quality: 90 }).toFile(target3CardsJpg);
    console.log('Saved 3 Cards Judgement artwork.');
  } else {
    console.warn('img3Cards not found at:', img3Cards);
  }

  // 2. Arena of Cards
  if (fs.existsSync(imgArena)) {
    const targetArenaWebp = path.join(frontendGameArtDir, 'arena-of-cards.webp');
    const targetArenaAltWebp = path.join(frontendGameArtDir, 'arena-of-cards-v8.webp');
    const targetArenaJpg = path.join(frontendIconsDir, 'arena-of-cards.jpg');

    await sharp(imgArena).resize(600, 600).webp({ quality: 90 }).toFile(targetArenaWebp);
    await sharp(imgArena).resize(600, 600).webp({ quality: 90 }).toFile(targetArenaAltWebp);
    await sharp(imgArena).resize(600, 600).jpeg({ quality: 90 }).toFile(targetArenaJpg);
    console.log('Saved Arena of Cards artwork.');
  } else {
    console.warn('imgArena not found at:', imgArena);
  }

  // 3. Baccarat (replace bad roulette thumbnail with beautiful baccarat card artwork)
  if (fs.existsSync(imgBaccarat)) {
    const targetBaccaratWebp = path.join(frontendGameArtDir, 'baccarat-askmeslot.webp');
    const targetBaccaratAltWebp = path.join(frontendGameArtDir, 'baccarat.webp');
    const targetBaccaratJpg = path.join(frontendIconsDir, 'baccarat.jpg');

    await sharp(imgBaccarat).resize(600, 600).webp({ quality: 90 }).toFile(targetBaccaratWebp);
    await sharp(imgBaccarat).resize(600, 600).webp({ quality: 90 }).toFile(targetBaccaratAltWebp);
    await sharp(imgBaccarat).resize(600, 600).jpeg({ quality: 90 }).toFile(targetBaccaratJpg);
    console.log('Saved Baccarat luxury artwork.');
  } else {
    console.warn('imgBaccarat not found at:', imgBaccarat);
  }
}

async function updateDatabase() {
  console.log('Updating database...');

  // 1. Update / Upsert 3 Cards Judgement
  const threeCards = await prisma.game.upsert({
    where: { slug: '3-cards-judgement-mac88' },
    update: {
      name: '3 Cards Judgement',
      category: 'cards',
      subCategory: 'cards',
      provider: 'MAC88',
      providerId: '1b72a33d0f799ac4dc75d01e87c51f6b',
      gameUid: '1b72a33d0f799ac4dc75d01e87c51f6b',
      thumbnail: '/game-art/3-cards-judgement-mac88.webp',
      banner: '/game-art/3-cards-judgement-mac88.webp',
      supportedCurrencies: ['INR'],
      status: 'ACTIVE',
      isActive: true,
      mode: 'seamless',
      displayOrder: 1,
      sortOrder: 1
    },
    create: {
      slug: '3-cards-judgement-mac88',
      name: '3 Cards Judgement',
      category: 'cards',
      subCategory: 'cards',
      provider: 'MAC88',
      providerId: '1b72a33d0f799ac4dc75d01e87c51f6b',
      gameUid: '1b72a33d0f799ac4dc75d01e87c51f6b',
      thumbnail: '/game-art/3-cards-judgement-mac88.webp',
      banner: '/game-art/3-cards-judgement-mac88.webp',
      supportedCurrencies: ['INR'],
      status: 'ACTIVE',
      isActive: true,
      mode: 'seamless',
      displayOrder: 1,
      sortOrder: 1
    }
  });
  console.log('Updated 3 Cards Judgement:', threeCards.name, threeCards.slug);

  // 2. Upsert Arena of cards (V8 Poker)
  const arenaOfCards = await prisma.game.upsert({
    where: { slug: 'arena-of-cards' },
    update: {
      name: 'Arena of cards',
      category: 'cards',
      subCategory: 'cards',
      provider: 'V8 Poker',
      providerId: 'e2a542ed67a82f3dc325db69e50d7cdd',
      gameUid: 'e2a542ed67a82f3dc325db69e50d7cdd',
      thumbnail: '/game-art/arena-of-cards.webp',
      banner: '/game-art/arena-of-cards.webp',
      supportedCurrencies: ['INR'],
      status: 'ACTIVE',
      isActive: true,
      mode: 'seamless',
      displayOrder: 2,
      sortOrder: 2
    },
    create: {
      slug: 'arena-of-cards',
      name: 'Arena of cards',
      category: 'cards',
      subCategory: 'cards',
      provider: 'V8 Poker',
      providerId: 'e2a542ed67a82f3dc325db69e50d7cdd',
      gameUid: 'e2a542ed67a82f3dc325db69e50d7cdd',
      thumbnail: '/game-art/arena-of-cards.webp',
      banner: '/game-art/arena-of-cards.webp',
      supportedCurrencies: ['INR'],
      status: 'ACTIVE',
      isActive: true,
      mode: 'seamless',
      displayOrder: 2,
      sortOrder: 2
    }
  });
  console.log('Upserted Arena of cards:', arenaOfCards.name, arenaOfCards.slug);

  // 3. Update Baccarat
  await prisma.game.updateMany({
    where: { slug: 'baccarat-askmeslot' },
    data: {
      subCategory: 'cards',
      thumbnail: '/game-art/baccarat-askmeslot.webp',
      banner: '/game-art/baccarat-askmeslot.webp',
      supportedCurrencies: ['INR'],
      status: 'ACTIVE',
      isActive: true
    }
  });
  console.log('Updated Baccarat.');
}

async function main() {
  await processImages();
  await updateDatabase();
  console.log('All done successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
