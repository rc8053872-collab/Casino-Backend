import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const gamesList = `
1. Diamond treasure
Provider: CQ9
UID: 2f3e4881d605653d536e8b5ab21e113b

2. Gu Gu Gu 2 M
Provider: CQ9
UID: 24e0e334a06f1c2f609908ea51f56945

3. .Lil Greedy™
Provider: Playtech Asia
UID: 5173d58fc02e96521a5c40532fd695e5

4. #Alice and the Mad Respin Party 96
Provider: Rubyplay
UID: c45a7f70da9ad3966ecb91255ae42a31

5. #Alice in the Wild 96
Provider: Rubyplay
UID: eb70e20d756eb4bf4e2b683465b8f9c5

6. #LuxuryLife
Provider: Endorphina
UID: c254f7540a27b7cb85d2c8a68653350a

7. 1-Of-A-Kind
Provider: Playtech Asia
UID: 44f6e08856a602e68952f49658b7d3f8

8. 10 Lucky Spins
Provider: QT
UID: 1e963be594b5a8990365657a3a368d90

9. 10 Sparkling Crown
Provider: JILI
UID: 2eb2879a2e4f3c5e5d297925283c37c9

10. 10 Sparkling Crown
Provider: TADA
UID: d2ca1af0693ead145b930fb6f9c33a54

11. 10 Sparkling Crown
Provider: JILISweep
UID: 2c4e8dbd0811f3e65f58a0f29edb5649

12. 10 Sparkling Crown 2
Provider: JILI
UID: 93d306f6d5dc42dd14334d4474b2476c

13. 10 Sparkling Crown 2
Provider: TADA
UID: ebb82e2fb570de9850339f5ff4a02521

14. 100 Blazing Clover
Provider: JILI
UID: 949cebe251fe69676f45518c48ff558c

15. 100 Blazing Clover
Provider: TADA
UID: 950bb3f88dbe4fd100147fe93249bba0

16. 100 Super Icy
Provider: expanse
UID: c1df36dd431dcf2d0103fb6604db4349

17. 100 Super Icy Dice
Provider: expanse
UID: 59a817f6de83e12602191f3c843df441

18. 100 Zombies
Provider: Endorphina
UID: 18acc7095966cf7339960b53f95ab145

19. 100 Zombies Dice
Provider: Endorphina
UID: d693aff1b328b6eead4831fb4472fbed

20. 1000 Amigo Monkeys
Provider: Amigo
UID: 91beabd9d7b3c7d69697a0e5071163b8

21. 1000 Moon Girls
Provider: Amigo
UID: 1235df727e5484fe68fb07e3d6469af

22. 1000 Olympus Rivals
Provider: Amigo
UID: 3be1d7f0930d016b22f590956f61a223

23. 10000 Fortunes
Provider: MG
UID: 2023c842fbba07a41405ef3bf73a95fe

24. 10000 Wishes
Provider: MG
UID: 2ca3b8cad27b28796280325dbd2e8e50

25. 10001 Nights
Provider: Evolution-Red Tiger Asia
UID: b4823bf398ca5fab512bd9a61bd7f783

26. 10001 Nights Megaways
Provider: Evolution-Red Tiger Asia
UID: 8de9b4b0d89ee4dda0c0f6ad5f8777d3

27. 1001 Fruit Wishes
Provider: Amigo
UID: 27d9ce85ccc6ecabc99a2fec7197bd76

28. 100× Diamond 7
Provider: Ygr
UID: f2ab9adc108bbab5c1f4fffeed5c40fb

29. 100× Lions 7
Provider: Ygr
UID: 2804dff32c1580a78076bbca238989a

30. 101 Candies
Provider: Evolution-NetEnt Asia
UID: 5cdb749ef224893ee5942b79e49be473

31. 108 Heroes
Provider: MG
UID: a899b3c1735898b9a1ae18bdf372a297

32. 108 Heroes Water Margin
Provider: MG
UID: d693c33ddb634da6e5f3d53d35e4f07c

33. 10× Diamond 7
Provider: Ygr
UID: aeba32461714cb4482faed3058e4bb76

34. 10× Lions 7
Provider: Ygr
UID: 39629775f8735c7826a676a5e24a04ab

35. 10X Rewind
Provider: QT
UID: f681e8de8a71ae0b1f84a27d487f66b3

36. 12 Bells
Provider: QT
UID: 85aa6eb2046515f0067cfe2b655e5ef

37. 12 Bells Easter Jackpots
Provider: QT
UID: adebf547d35039576d9b88618b6e26d9

38. 12 Bells Love the Jackpot
Provider: QT
UID: f6e9c837faba42afa5fa37c1068c0d76

39. 12 Coins Grand Diamond Edition Easter Jackpots
Provider: QT
UID: f26bf987ec4b1d7edb345804083effe4

40. 12 Coins Grand Gold Edition
Provider: QT
UID: cd7bbbe2973eb5dd6b3d0f472e9134da

41. 12 Coins Grand Gold Edition Halloween Jackpots
Provider: QT
UID: 214fc659080242d048e2d606460ac151

42. 12 Coins Grand Gold Edition Santas Jackpots
Provider: QT
UID: 3f979749c6a871fbc024491464dba503

43. 12 Coins Grand Platinum Edition Santas Jackpots
Provider: QT
UID: 0a0e92530106bace69f433975cdbb7af

44. 12 Coins Hold The Jackpot Cash Infinity
Provider: QT
UID: f6c5b5ec2204390bc1c5434ce868d182

45. 12 Coins: Grand Diamond Edition
Provider: QT
UID: 42d65d467b3ff61ab9171889c387cf29

46. 12 Coins: Grand Platinum Edition
Provider: QT
UID: 180f44fee825572b58d176976d3e79e8

47. 12 Fortune Signs
Provider: Amigo
UID: 93ed8992109f7c7b0792d20cd1c6dcb

48. 12 Skulls of the Dead
Provider: MG
UID: ca6f6856efefb5d3a5deff01409572cb

49. 12 Treasures: Aztec Riches
Provider: PenguinKing
UID: 192ef90f52c626f1c89a2586ff886ed2

50. 12 Trojan Mysteries
Provider: QT
UID: 5b3ae15ac15753c33646389b71b035aa

51. 12Zodiacs
Provider: Habanero
UID: b88e91b328ecc8e990af48df6db705b4

52. 123 Soccer Link&Merge
Provider: MG
UID: 290706b2d8aeb87265837ae6114a17e6

53. 15 Coins Grand Diamond Edition
Provider: QT
UID: 26da35170456e2848aea009d94cdca4

54. 15 Coins Grand Gold Edition
Provider: QT
UID: d949d22ff21142c9d324a906a6b1b082

55. 15 Coins Grand Gold Edition Halloween Jackpots
Provider: QT
UID: 2c74ea642464c2a4daaa6f82d13e9915

56. 15 Coins Grand Gold Edition Santas Jackpots
Provider: QT
UID: 27c6a85e883b3c4e297ade83a264b7cb

57. 15 Coins Hold The Jackpot Cash Infinity
Provider: QT
UID: 1ede395ebdb691733476f422ca720d00

58. 15 Coins Love the Jackpot
Provider: QT
UID: 6ef5e08390259a57855a3e1ed79abd37

59. 15 Coins: Grand Platinum Edition
Provider: QT
UID: 29b8f09056a9d84e2c2477b2a0b3634e

60. 15 Crystal Roses: A Tale of Love
Provider: Play'n GO
UID: 6b072dcb3eedf445e0260fc2de83316
`;

async function parseAndAddGames() {
    const lines = gamesList.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const games: {name?: string, provider?: string, uid?: string}[] = [];
    
    let current: {name?: string, provider?: string, uid?: string} = {};
    for (const line of lines) {
        if (/^\d+\./.test(line)) {
            if (current.uid) {
                games.push(current);
            }
            current = { name: line.replace(/^\d+\.\s*/, '') };
        } else if (line.startsWith('Provider:')) {
            current.provider = line.replace('Provider:', '').trim();
        } else if (line.startsWith('UID:')) {
            current.uid = line.replace('UID:', '').trim();
        }
    }
    if (current.uid) {
        games.push(current);
    }
    
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let invalid = 0;
    
    const dbGames = await prisma.game.findMany();
    
    for (const g of games) {
        if (!g.uid || g.uid.length < 5) {
            invalid++;
            continue;
        }
        
        let slug = (g.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (g.provider || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        // Ensure slug is unique but clean
        slug = slug.replace(/-+$/, '');
        
        try {
            const existingByUid = dbGames.find(dbG => dbG.providerId === g.uid);
            
            if (existingByUid) {
                // Duplicate UID
                skipped++;
            } else {
                // Check if slug exists, if yes, just update providerId
                const existingBySlug = await prisma.game.findUnique({ where: { slug } });
                
                if (existingBySlug) {
                    await prisma.game.update({
                        where: { id: existingBySlug.id },
                        data: {
                            providerId: g.uid,
                            category: 'slots'
                        }
                    });
                    updated++;
                } else {
                    await prisma.game.create({
                        data: {
                            name: g.name || 'unknown',
                            slug: slug,
                            providerId: g.uid,
                            category: 'slots',
                            status: 'ACTIVE',
                            thumbnail: '',
                            displayOrder: 10
                        }
                    });
                    added++;
                }
            }
        } catch (e: any) {
            console.error(`Failed on ${g.name}: ${e.message}`);
            failed++;
        }
    }
    
    console.log("=== FINAL REPORT ===");
    console.log("Added:", added);
    console.log("Updated:", updated);
    console.log("Skipped (Duplicate UID):", skipped);
    console.log("Invalid UID:", invalid);
    console.log("Failed DB operation:", failed);
    console.log("====================");
    
    // Now let's test a few games to see if they support INR!
    
    const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
    const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
    const API_TOKEN = process.env.GAMECLOUD_API_TOKEN;
    const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
    const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://orbitplay.com';
    
    console.log("\\nTesting INR Launch with GameCloud...");
    
    const testGames = [
        "bbe2320adc5c506e7e56a2d24d96a252", // Known working game (Aviator)
        games[0]?.uid,
        games[3]?.uid,
        games[20]?.uid,
        games[44]?.uid
    ];
    
    for (const testUid of testGames) {
        console.log(`\nTesting UID: ${testUid}`);
        try {
            const payload = {
                reseller_id: RESELLER_ID,
                player_id: "test_player",
                game_uid: testUid,
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
                console.log(`✅ SUCCESS: Supports INR. Launch URL: ${response.data.game_launch_url.substring(0,50)}...`);
            } else {
                let errStr = typeof response.data?.message === 'string' ? response.data.message : (typeof response.data?.error === 'string' ? response.data.error : JSON.stringify(response.data));
                console.log(`❌ FAILED: ${errStr}`);
            }
        } catch (e: any) {
            console.log(`❌ EXCEPTION: ${e.message}`);
        }
    }
}
parseAndAddGames();
