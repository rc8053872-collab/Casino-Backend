import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function verifyAllSlots() {
    const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
    const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
    const API_TOKEN = process.env.GAMECLOUD_API_TOKEN;
    const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
    const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://orbitplay.com';

    const allSlots = await prisma.game.findMany({
        where: { category: 'SLOT' }
    });

    console.log(`Starting verification for ${allSlots.length} SLOT games...`);

    let verifiedInr = 0;
    let unsupportedInr = 0;
    let disabled = 0;
    let failedDb = 0;

    for (const game of allSlots) {
        if (!game.providerId) continue;

        try {
            const payload = {
                reseller_id: RESELLER_ID,
                player_id: "test_verification",
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

            if (response.data?.status === 'SUCCESS') {
                // Working perfectly in INR
                const currencies = new Set(game.supportedCurrencies || []);
                currencies.add('INR');
                await prisma.game.update({
                    where: { id: game.id },
                    data: {
                        status: 'ACTIVE',
                        supportedCurrencies: Array.from(currencies)
                    }
                });
                verifiedInr++;
                console.log(`[SUCCESS] ${game.name} - Playable in INR`);
            } else {
                let errStr = typeof response.data?.message === 'string' ? response.data.message : (typeof response.data?.error === 'string' ? response.data.error : JSON.stringify(response.data));
                
                if (errStr.toLowerCase().includes('disabled')) {
                    await prisma.game.update({
                        where: { id: game.id },
                        data: {
                            status: 'INACTIVE'
                        }
                    });
                    disabled++;
                    console.log(`[DISABLED] ${game.name} - ${errStr}`);
                } else if (errStr.includes('Please use') || errStr.toLowerCase().includes('currency')) {
                    // Currency rejected
                    const currencies = new Set(game.supportedCurrencies || []);
                    currencies.delete('INR'); // Ensure INR is NOT in the list
                    
                    await prisma.game.update({
                        where: { id: game.id },
                        data: {
                            supportedCurrencies: Array.from(currencies)
                        }
                    });
                    unsupportedInr++;
                    console.log(`[UNSUPPORTED INR] ${game.name} - ${errStr}`);
                } else {
                    // Some other error, better to remove INR just in case
                    const currencies = new Set(game.supportedCurrencies || []);
                    currencies.delete('INR');
                    
                    await prisma.game.update({
                        where: { id: game.id },
                        data: {
                            supportedCurrencies: Array.from(currencies)
                        }
                    });
                    unsupportedInr++;
                    console.log(`[OTHER ERROR] ${game.name} - ${errStr}`);
                }
            }
        } catch (e: any) {
            console.log(`[EXCEPTION] ${game.name} - ${e.message}`);
            failedDb++;
        }
    }

    console.log("\\n=== VERIFICATION COMPLETE ===");
    console.log("Total SLOT games:", allSlots.length);
    console.log("INR playable games:", verifiedInr);
    console.log("INR unsupported games:", unsupportedInr);
    console.log("GameCloud disabled games:", disabled);
    console.log("Failed DB/API operations:", failedDb);
    console.log("=============================\\n");
}

verifyAllSlots();
