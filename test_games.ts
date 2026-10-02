import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
const API_TOKEN = process.env.GAMECLOUD_API_TOKEN;
const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://orbitplay.com';

async function run() {
  if (!API_TOKEN) {
    console.error("No API token set. Exiting.");
    process.exit(1);
  }

  // Get a test user (or just use a dummy id since GameCloud just needs a string)
  const player_id = 'test_currency_player';
  
  const games = await prisma.game.findMany();
  console.log(`Found ${games.length} games in DB.`);
  
  const report = [];

  for (const game of games) {
    const game_uid = game.providerId || game.slug;
    console.log(`Testing Game: ${game.name} (${game_uid})`);
    
    try {
      const payload = {
        reseller_id: RESELLER_ID,
        player_id: player_id,
        game_uid: game_uid,
        mode: 'seamless',
        currency_code: 'INR',
        home_url: HOME_URL
      };

      const response = await axios.post(`${GATEWAY_URL}/api/v1/game/launch`, payload, {
        headers: {
          'X-API-Token': API_TOKEN,
          'X-Secret-Key': SECRET_KEY,
          'Origin': 'https://maltiplayx.com',
          'Referer': 'https://maltiplayx.com/',
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true // Resolve all statuses to inspect
      });

      let inrSupported = 'NO';
      let requiredCurrency = 'UNKNOWN';
      let providerResponse = 'UNKNOWN';

      if (response.data?.status === 'SUCCESS') {
        inrSupported = 'YES';
        providerResponse = 'SUCCESS';
      } else {
        const errStr = typeof response.data?.message === 'string' ? response.data.message : (typeof response.data?.error === 'string' ? response.data.error : JSON.stringify(response.data));
        providerResponse = errStr;
        
        // Extract required currencies
        const match = errStr.match(/Please use \[(.*?)\]/);
        if (match && match[1]) {
          requiredCurrency = match[1];
        } else if (errStr.toLowerCase().includes('disabled') || errStr.toLowerCase().includes('unavailable')) {
          requiredCurrency = 'DISABLED';
        } else if (errStr.toLowerCase().includes('not found') || errStr.toLowerCase().includes('invalid')) {
          requiredCurrency = 'INVALID UID';
        }
      }

      report.push({
        game: game.name,
        slug: game.slug,
        providerId: game.providerId,
        inrSupported,
        providerResponse: providerResponse.substring(0, 50), // Trim for table
        requiredCurrency
      });
      
    } catch (e: any) {
      report.push({
        game: game.name,
        slug: game.slug,
        providerId: game.providerId,
        inrSupported: 'ERROR',
        providerResponse: e.message.substring(0, 50),
        requiredCurrency: 'ERROR'
      });
    }
  }

  console.table(report);
  
  // Write markdown report
  const fs = require('fs');
  let md = '| Game | slug | providerId | INR supported? | Provider response | Required test currency |\n';
  md += '|------|------|------------|----------------|-------------------|------------------------|\n';
  for (const r of report) {
    md += `| ${r.game} | ${r.slug} | ${r.providerId} | ${r.inrSupported} | ${r.providerResponse} | ${r.requiredCurrency} |\n`;
  }
  fs.writeFileSync('currency_report.md', md);
  console.log("Report saved to currency_report.md");
}

run().catch(console.error);
