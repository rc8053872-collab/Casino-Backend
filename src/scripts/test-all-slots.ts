import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const prisma = new PrismaClient();

const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
const API_TOKEN = process.env.GAMECLOUD_API_TOKEN;
const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://orbitplay.com';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function run() {
    console.log("Fetching SLOT games from database to test for INR...");
    const games = await prisma.game.findMany({
        where: {
            category: 'slots'
        }
    });

    console.log(`Found ${games.length} total slot games in the DB.`);

    const report: {
        inrSupported: {name: string, provider: string, uid: string, response: string}[],
        inrUnsupported: {name: string, provider: string, uid: string, response: string}[],
        disabled: {name: string, provider: string, uid: string, response: string}[],
        otherErrors: {name: string, provider: string, uid: string, response: string}[]
    } = {
        inrSupported: [],
        inrUnsupported: [],
        disabled: [],
        otherErrors: []
    };

    for (const game of games) {
        console.log(`Testing [${(game as any).provider}] ${game.name} (${game.providerId})...`);

        try {
            const payload = {
                reseller_id: RESELLER_ID,
                player_id: "test_inr_bot",
                game_uid: game.providerId,
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
                validateStatus: () => true
            });

            const data = response.data;
            const errStr = typeof data?.message === 'string' ? data.message : (typeof data?.error === 'string' ? data.error : JSON.stringify(data));

            if (data?.status === 'SUCCESS') {
                console.log(`✅ SUCCESS: INR Supported.`);
                // Update DB to add INR support if not present
                if (!game.supportedCurrencies.includes('INR')) {
                    await prisma.game.update({
                        where: { id: game.id },
                        data: {
                            supportedCurrencies: {
                                push: 'INR'
                            },
                            status: 'ACTIVE'
                        }
                    });
                }
                report.inrSupported.push({
                    name: game.name,
                    provider: (game as any).provider || '',
                    uid: game.providerId,
                    response: 'SUCCESS'
                });
            } else if (errStr && errStr.includes('disabled')) {
                console.log(`❌ GAME DISABLED.`);
                await prisma.game.update({
                    where: { id: game.id },
                    data: {
                        status: 'INACTIVE'
                    }
                });
                report.disabled.push({
                    name: game.name,
                    provider: (game as any).provider || '',
                    uid: game.providerId,
                    response: errStr
                });
            } else if (errStr && (errStr.includes('use [') || errStr.toLowerCase().includes('currency'))) {
                console.log(`⚠️ UNSUPPORTED CURRENCY: ${errStr}`);
                report.inrUnsupported.push({
                    name: game.name,
                    provider: (game as any).provider || '',
                    uid: game.providerId,
                    response: errStr
                });
            } else {
                console.log(`❌ OTHER ERROR: ${errStr}`);
                report.otherErrors.push({
                    name: game.name,
                    provider: (game as any).provider || '',
                    uid: game.providerId,
                    response: errStr
                });
            }
        } catch (e: any) {
            console.log(`❌ EXCEPTION: ${e.message}`);
            report.otherErrors.push({
                name: game.name,
                provider: (game as any).provider || '',
                uid: game.providerId,
                response: e.message
            });
        }
        
        await delay(100);
    }

    console.log("\n==============================");
    console.log("       FINAL TEST REPORT      ");
    console.log("==============================");
    console.log(`Total Tested: ${games.length}`);
    console.log(`INR Supported: ${report.inrSupported.length}`);
    console.log(`INR Unsupported: ${report.inrUnsupported.length}`);
    console.log(`Disabled Games: ${report.disabled.length}`);
    console.log(`Other Errors: ${report.otherErrors.length}`);
    
    // Save detailed markdown report
    let md = `# GameCloud INR Test Report\n\n`;
    md += `**Total Tested:** ${games.length}\n`;
    md += `**Total INR Supported:** ${report.inrSupported.length}\n`;
    md += `**Total INR Unsupported:** ${report.inrUnsupported.length}\n`;
    md += `**Total Disabled:** ${report.disabled.length}\n`;
    md += `**Total Other Errors:** ${report.otherErrors.length}\n\n`;

    md += `## ✅ INR Supported Games\n`;
    report.inrSupported.forEach(g => {
        md += `- **${g.name}** (${g.provider}) - \`${g.uid}\`\n`;
    });

    md += `\n## ⚠️ INR Unsupported Games\n`;
    report.inrUnsupported.forEach(g => {
        md += `- **${g.name}** (${g.provider}) - \`${g.uid}\` - Error: ${g.response}\n`;
    });

    md += `\n## ❌ Disabled Games\n`;
    report.disabled.forEach(g => {
        md += `- **${g.name}** (${g.provider}) - \`${g.uid}\`\n`;
    });

    md += `\n## ❌ Other Errors\n`;
    report.otherErrors.forEach(g => {
        md += `- **${g.name}** (${g.provider}) - \`${g.uid}\` - Error: ${g.response}\n`;
    });

    fs.writeFileSync('inr_test_report.md', md, 'utf8');
    console.log("\nSaved detailed markdown report to 'inr_test_report.md'");
}
run();
