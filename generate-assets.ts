import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import prisma from './src/prismaClient';

async function generatePlaceholder(name: string, type: 'thumbnail' | 'banner', outPath: string) {
  const width = type === 'thumbnail' ? 400 : 800;
  const height = type === 'thumbnail' ? 400 : 400;
  
  // Premium dark casino theme gradients
  const colors = [
    ['#1a1a2e', '#16213e'], // Dark Blue
    ['#2d132c', '#801336'], // Dark Red
    ['#0f3460', '#e94560'], // Neon Blue/Pink
    ['#141e30', '#243b55'], // Slate
    ['#000000', '#434343'], // Premium Black
  ];
  const colorPair = colors[name.length % colors.length];

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorPair[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colorPair[1]};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" rx="20" ry="20" />
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-weight="bold" font-size="${type === 'thumbnail' ? '32' : '48'}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
        ${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
      <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="16" fill="#e0e0e0" text-anchor="middle" dominant-baseline="middle">
        PREMIUM EDITION
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .webp({ quality: 80 })
    .toFile(outPath);
}

async function main() {
  console.log('Generating premium assets...');
  const games = await prisma.game.findMany({
    where: { isFeatured: false, status: 'INACTIVE', providerId: '' }
  });

  const baseDir = path.join(__dirname, 'public', 'game-assets');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  let count = 0;
  for (const game of games) {
    const gameDir = path.join(baseDir, game.slug);
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    const thumbPath = path.join(gameDir, 'thumbnail.webp');
    const bannerPath = path.join(gameDir, 'banner.webp');

    if (!fs.existsSync(thumbPath)) await generatePlaceholder(game.name, 'thumbnail', thumbPath);
    if (!fs.existsSync(bannerPath)) await generatePlaceholder(game.name, 'banner', bannerPath);

    count++;
  }

  console.log(`Successfully generated premium assets for ${count} games.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
