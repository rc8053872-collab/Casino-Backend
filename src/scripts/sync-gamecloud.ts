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

async function fetchCatalogGames() {
    // TODO: Replace with actual catalog API endpoint from Dev API Docs
    // Since we don't have the endpoint in the codebase, we'll test the ones already in the DB
    // If you have a JSON file or endpoint, implement the fetch here.
    const games = await prisma.game.findMany();
    return games;
}

async function testGameCurrency(game_uid: string, currency_code: string): Promise<boolean | string> {
    try {
        const payload = {
            reseller_id: RESELLER_ID,
            player_id: 'sync_test_user',
            game_uid: game_uid,
            mode: 'seamless',
            currency_code: currency_code,
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
            validateStatus: () => true 
        });

        if (response.data?.status === 'SUCCESS') {
            return true;
        }

        const errStr = typeof response.data?.message === 'string' ? response.data.message : (typeof response.data?.error === 'string' ? response.data.error : JSON.stringify(response.data));
        
        const match = errStr.match(/Please use \[(.*?)\]/);
        if (match && match[1]) {
            return match[1]; // Return required currencies
        }

        if (errStr.toLowerCase().includes('disabled') || errStr.toLowerCase().includes('unavailable')) {
            return 'DISABLED';
        }

        return errStr;

    } catch (e: any) {
        return e.message;
    }
}

async function run() {
    console.log("Starting GameCloud Catalog Sync...");

    const games = await fetchCatalogGames();
    console.log(`Discovered ${games.length} games to test.`);

    let totalInr = 0;
    let totalNonInr = 0;
    let updated = 0;

    for (const game of games) {
        const uid = game.providerId || game.slug;
        console.log(`\nTesting ${game.name} (${uid}) for INR compatibility...`);

        const result = await testGameCurrency(uid, 'INR');

        let supportedCurrencies: string[] = [];
        
        if (result === true) {
            console.log(`✅ SUCCESS: ${game.name} supports INR.`);
            supportedCurrencies = ['INR'];
            totalInr++;
        } else {
            console.log(`❌ FAILED: ${game.name} does not support INR. Response: ${result}`);
            if (typeof result === 'string' && result !== 'DISABLED') {
                supportedCurrencies = result.split(',').map(s => s.trim());
            }
            totalNonInr++;
        }

        // Update Database
        await prisma.game.update({
            where: { slug: game.slug },
            data: {
                supportedCurrencies,
                status: (result === 'DISABLED') ? 'INACTIVE' : 'ACTIVE'
            }
        });
        updated++;
    }

    console.log("\n=== SYNC REPORT ===");
    console.log(`Total games discovered: ${games.length}`);
    console.log(`Total games stored: ${games.length}`);
    console.log(`Total INR-compatible games: ${totalInr}`);
    console.log(`Total non-INR games: ${totalNonInr}`);
    console.log(`Games updated: ${updated}`);
    console.log("===================");
}

run().catch(console.error).finally(() => prisma.$disconnect());
