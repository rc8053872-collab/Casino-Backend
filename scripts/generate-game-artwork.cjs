const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ quiet: true });

const prisma = new PrismaClient();
const publicDir = path.resolve(__dirname, '../../Casino-frontend-main/public');
const outputDir = path.join(publicDir, 'game-art');
const artwork = {
  treasure: ['icons/games/diamond-treasure.webp', 'icons/games/3-big-barrels-aztec.webp', 'icons/games/lil-greedy.webp'],
  money: ['icons/games/25-coins-santas-jackpot.webp', 'icons/games/lil-greedy.webp'],
  fruit: ['icons/games/candy-superwin.webp', 'icons/games/3-bunny-pots.webp', 'icons/games/gu-gu-gu-2m.webp'],
  animals: ['icons/games/gu-gu-gu-2m.webp', 'icons/games/3-bunny-pots.webp', 'icons/games/3-power-dragons.webp'],
  fish: ['icons/fishing-cover.webp'],
  mines: ['icons/games/diamond-treasure.webp', 'icons/games/3-arcane-cauldrons.webp', 'icons/games/3-big-barrels-aztec.webp'],
  cards: ['icons/games/handicap-baccarat.webp', 'icons/roulette_main.jpg'],
  crash: ['icons/games/3-arcane-cauldrons.webp', 'icons/games/3-big-barrels-aztec.webp', 'icons/games/3-african-drums.webp'],
  sports: ['icons/games/3-power-dragons.webp', 'icons/games/3-african-drums.webp'],
  scratch: ['icons/games/candy-superwin.webp', 'icons/games/3-bunny-pots.webp', 'icons/games/gu-gu-gu-2m.webp'],
  mythic: ['icons/games/3-power-dragons.webp', 'icons/games/3-arcane-cauldrons.webp', 'icons/games/3-bunny-pots.webp'],
  egypt: ['icons/games/3-big-barrels-aztec.webp', 'icons/games/diamond-treasure.webp', 'icons/games/lil-greedy.webp'],
  spooky: ['icons/games/3-arcane-cauldrons.webp', 'icons/games/3-bunny-pots.webp', 'icons/games/gu-gu-gu-2m.webp'],
  royal: ['icons/games/25-coins-santas-jackpot.webp', 'icons/games/diamond-treasure.webp', 'icons/games/3-power-dragons.webp'],
  adventure: [
    'icons/games/3-arcane-cauldrons.webp',
    'icons/games/3-bunny-pots.webp',
    'icons/games/3-african-drums.webp',
    'icons/games/3-big-barrels-aztec.webp',
    'icons/games/3-power-dragons.webp',
  ],
};
const themeRules = [
  { match: /dragon[\s-]*tiger/i, art: ['icons/games/handicap-baccarat.webp'], palette: ['#f5bd4f', '#ff765e'], label: 'TABLE' },
  { match: /halloween|ghost|vampire|witch|spooky|haunted|monster/i, art: artwork.spooky, palette: ['#b493ff', '#ff765e'], label: 'SPOOKY' },
  { match: /egypt|aztec|maya|inca|pyramid|pharaoh|tomb|temple/i, art: artwork.egypt, palette: ['#f5bd4f', '#56d5c7'], label: 'TREASURE' },
  { match: /dragon|phoenix|myth|zeus|thor|odin|god|legend/i, art: artwork.mythic, palette: ['#ff765e', '#a487ff'], label: 'MYTHIC' },
  { match: /buffalo|wolf|bear|tiger|lion|safari|jungle|wild|animal|bird|monkey/i, art: artwork.animals, palette: ['#9bd96b', '#ff9b45'], label: 'WILD' },
  { match: /mine|plinko|tower|bomb/i, art: artwork.mines, palette: ['#69a8ff', '#ff765e', '#a487ff'], label: 'CHALLENGE' },
  { match: /fish|prawn|crab|ocean|sea|shark|reef/i, art: artwork.fish, palette: ['#56d5c7', '#70aaff'], label: 'OCEAN' },
  { match: /beach penalties/i, art: ['game-assets/beach-penalties-expanse/card.webp'], palette: ['#56d5c7'] },
  { match: /beer tycoon|bartender/i, art: ['game-assets/beer-tycoon-jdb/card.webp'], palette: ['#f5bd4f'] },
  { match: /roulette|black jack|pokdeng|sic bo|hilo|dice|mahjong|baccarat|poker|teen.?patti|acey deucey|5pk/i, art: artwork.cards, palette: ['#f5bd4f', '#a487ff'], label: 'TABLE' },
  { match: /aviator|balloon|rocket|space|galaxy|cosmic|alien|star/i, art: ['icons/aviator_main.jpg', 'icons/games/3-arcane-cauldrons.webp'], palette: ['#ff765e', '#70aaff'], label: 'SKY' },
  { match: /crash|heli/i, art: artwork.crash, palette: ['#ff765e', '#70aaff'], label: 'CRASH' },
  { match: /scratch|fruit|bubble gum|candy|chilli|chili|cookie|sweet/i, art: artwork.scratch, palette: ['#f078ab', '#ff9b45'], label: 'SWEET' },
  { match: /penalty|soccer|racing|derby|sport|basketball|cricket|football/i, art: artwork.sports, palette: ['#56d5c7', '#9bd96b'], label: 'SPORT' },
  { match: /queen|king|princess|royal|empress|emperor|crown|palace/i, art: artwork.royal, palette: ['#f5bd4f', '#a487ff'], label: 'ROYAL' },
  { match: /money|lucky|loot|tycoon|coin|lotto|caishen|gold|treasure|bounty|cash|fortune|rich/i, art: artwork.money, palette: ['#f5bd4f', '#ff9b45'], label: 'FORTUNE' },
];
const accents = ['#f5bd4f', '#56d5c7', '#ff765e', '#a487ff', '#70aaff', '#f078ab', '#9bd96b', '#ff9b45'];
const hashText = (value) => [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

function escapeXml(value) {
  return value.replace(/[<>&"']/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

function wrapTitle(value) {
  const words = value.toUpperCase().split(/\s+/);
  const lines = [''];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (current && `${current} ${word}`.length > 21 && lines.length < 2) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = current ? `${current} ${word}` : word;
    }
  }
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].length > 21) lines[index] = `${lines[index].slice(0, 19)}…`;
  }
  return lines;
}

function coverOverlay(game, accent, label) {
  const lines = wrapTitle(game.name);
  const longestLine = Math.max(...lines.map(line => line.length));
  const fontSize = Math.max(19, Math.min(30, Math.floor(340 / Math.max(longestLine * 0.65, 1))));
  const firstLineY = lines.length === 1 ? 337 : 319;
  const title = lines.map((line, index) =>
    `<text x="200" y="${firstLineY + index * 30}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="900" text-anchor="middle" fill="#ffffff" stroke="#07101d" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${escapeXml(line)}</text>`
  ).join('');
  const provider = (game.provider || '').trim().toUpperCase().slice(0, 24);

  return Buffer.from(`<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".38" stop-color="#030617" stop-opacity="0"/><stop offset="1" stop-color="#030617" stop-opacity=".9"/></linearGradient><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="400" height="400" fill="url(#fade)"/><rect x="10" y="10" width="380" height="380" rx="34" fill="none" stroke="${accent}" stroke-opacity=".98" stroke-width="8" filter="url(#glow)"/><rect x="24" y="24" width="352" height="352" rx="26" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="2"/><rect x="10" y="273" width="380" height="117" fill="#030617" fill-opacity=".18"/>${label ? `<rect x="26" y="30" width="${Math.max(86, label.length * 12 + 28)}" height="30" rx="15" fill="#07101d" fill-opacity=".85" stroke="${accent}" stroke-width="2"/><text x="69" y="50" font-family="Arial,sans-serif" font-size="12" font-weight="900" letter-spacing="1.5" text-anchor="middle" fill="${accent}">${escapeXml(label)}</text>` : ''}${title}<text x="200" y="372" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2" text-anchor="middle" fill="${accent}">${escapeXml(provider)}</text></svg>`);
}

async function generate() {
  const games = await prisma.game.findMany({
    where: { category: { in: ['ARCADE', 'arcade', 'Arcade', 'SLOT', 'slot', 'Slot', 'slots', 'Slots'] } },
    select: { name: true, slug: true, provider: true, category: true },
    orderBy: { slug: 'asc' },
  });
  if (!games.length) throw new Error('No ARCADE or SLOT games were found; no artwork was generated.');

  await fs.promises.mkdir(outputDir, { recursive: true });
  for (const game of games) {
    const name = game.name.trim();
    const identity = `${game.slug}:${game.provider || ''}`;
    const hash = hashText(identity);
    const theme = themeRules.find(rule => rule.match.test(name));
    const sourceCandidates = theme?.art || artwork.adventure;
    const source = path.join(publicDir, sourceCandidates[hash % sourceCandidates.length]);
    if (!fs.existsSync(source)) throw new Error(`Missing artwork source for "${name}": ${source}`);

    const base = await sharp(source)
      .resize(400, 400, { fit: 'cover' })
      .modulate({ brightness: 0.82, saturation: 1.22, hue: hash % 37 })
      .png()
      .toBuffer();
    const accent = theme?.palette[hash % theme.palette.length] || accents[hash % accents.length];
    await sharp(base)
      .composite([{ input: coverOverlay(game, accent, theme?.label || (/^slots?$/i.test(game.category) ? 'SLOTS' : 'MINI GAME')) }])
      .webp({ quality: 88 })
      .toFile(path.join(outputDir, `${game.slug}.webp`));
  }

  console.log(`Generated highlighted themed covers for ${games.length} ARCADE and SLOT games.`);
}

generate()
  .catch(error => {
    console.error(`Game artwork generation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
