import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const gamesList = `
1. 25 Coins Grand Gold Edition
Provider: QT
Category: SLOT
UID: 740ccc080d415568849c1ba8940d4bcb

2. 25 Coins Grand Gold Edition Easter Jackpots
Provider: QT
Category: SLOT
UID: 58e5e1796ad94c4766e32b65e3d8bc35

3. 25 Coins Halloween Jackpots
Provider: QT
Category: SLOT
UID: bfd969b4e39ece05b78dbe4b38e43b3a

4. 25 Coins Love the Jackpot
Provider: QT
Category: SLOT
UID: a6f069be620721ebd051f1ec7d622346

5. 25 Coins Santas Jackpot
Provider: QT
Category: SLOT
UID: e6ddc29f5236c5316694b00a0f60de10

6. 25 Cookies: Hit The Bonus
Provider: BNG(3oks)
Category: SLOT
UID: 26f366c89a5fdfcbfeba50333fbd83ed

7. 25000 Talons
Provider: MG
Category: SLOT
UID: 29baca9a06f2b1147e5e2cc741515a21

8. 28 Mansions
Provider: Playtech Asia
Category: SLOT
UID: d4a6819ce811b1b97c07a8818a64690d

9. 29 Baccarat
Provider: MAC88
Category: CASINO LIVE
UID: a6748ae8ac36dfca78c3d61807cab291

10. 29 Card Baccarat
Provider: Aura Gaming
Category: CASINO LIVE
UID: 9f217028836904851a9088ff3c089e77

11. 3 African Drums
Provider: BNG
Category: SLOT
UID: 9301226771ddc4e55ab52bcb049c5871

12. 3 African Drums
Provider: BNG(3oks)
Category: SLOT
UID: 18675fbfc8dfe19ba4f65b385565c419

13. 3 Angels Power Combo
Provider: MG
Category: SLOT
UID: 5ebf07a913116c99d101dd623fae9da3

14. 3 Arcane Cauldrons
Provider: Hacksaw Asia
Category: SLOT
UID: 136b44185d3080ec03f6baa95982b7b0

15. 3 Arcane Cauldrons
Provider: Hacksaw Latam
Category: SLOT
UID: 46ea4c6318c5cbd977bb2c8f7a73a1d9

16. 3 Arcane Cauldrons
Provider: Hacksaw World
Category: SLOT
UID: 5de711162c4a310e4f4e00e338fb7e04

17. 3 Aztec Temples
Provider: BNG
Category: SLOT
UID: e73fc42915a6c308adb1522d0cc374a6

18. 3 Aztec Temples
Provider: BNG(3oks)
Category: SLOT
UID: 4e62a6d0de1240dc08515447d84e0fc2

19. 3 Big Barrels Aztec 90
Provider: Rubyplay
Category: SLOT
UID: e1116b525213a4448a79c66d0281781d

20. 3 Big Barrels Aztec 92
Provider: Rubyplay
Category: SLOT
UID: caf0a2338730bc53b4b727a5165777ae

21. 3 Big Barrels Aztec 94
Provider: Rubyplay
Category: SLOT
UID: 9e5a09a70b88b293f7319877fd5507fd

22. 3 Big Barrels Aztec 96
Provider: Rubyplay
Category: SLOT
UID: 5551a8c0cff7749767e8b27e43982b2b

23. 3 Big Barrels Buffalo
Provider: Playtech Asia
Category: SLOT
UID: c3cd2e5e1fce67a2831047c54268b193

24. 3 Big Barrels Buffalo 90
Provider: Rubyplay
Category: SLOT
UID: 539e2dde3aa62f1514b7f1ce6b485628

25. 3 Big Barrels Buffalo 92
Provider: Rubyplay
Category: SLOT
UID: db536f8da3887c292c6d2bf13af3dab1

26. 3 Big Barrels Buffalo 94
Provider: Rubyplay
Category: SLOT
UID: 10f119a894b6488d262549b96daead85

27. 3 Big Barrels Buffalo 96
Provider: Rubyplay
Category: SLOT
UID: e62c16385342350956b9333b6b443e98

28. 3 Big Barrels Elfin' Rich
Provider: Playtech Asia
Category: SLOT
UID: 7a198daf0caabc56a506e1602c6110f5

29. 3 Big Barrels Elfin' Rich 90
Provider: Rubyplay
Category: SLOT
UID: 6eb647101e1c6d07b2653c2763f24495

30. 3 Big Barrels Elfin' Rich 92
Provider: Rubyplay
Category: SLOT
UID: 8d52227ce230481170534a217c632027

31. 3 Big Barrels Elfin' Rich 94
Provider: Rubyplay
Category: SLOT
UID: 0f3adb86837df065774b5ba63e67f235

32. 3 Big Barrels Elfin' Rich 96
Provider: Rubyplay
Category: SLOT
UID: ece5ed591625fefe9ff64fc48559e49e

33. 3 Blazing Volcanoes Power Combo
Provider: MG
Category: SLOT
UID: 513f022ed72fc2e33a5d586935167585

34. 3 Builder Piggies
Provider: AvatarUX
Category: SLOT
UID: bd48f50e1c81cd4f64c7a24e556b1207

35. 3 Bunny Pots Bonanza
Provider: EvoPlay Asia
Category: SLOT
UID: 1c089a9e63c5a6fa68a3cb4260550e5b

36. 3 Buzzing Wilds
Provider: PP
Category: SLOT
UID: b7f5590ec64882148207e646949d005f

37. 3 Card Brag
Provider: Playtech Asia
Category: CASINO LIVE
UID: 1041e1bce5dbdea43e65b511aff04b3f

38. 3 Card Brag
Provider: QT
Category: SLOT
UID: e7129b0d70fdc734d9badeb8b706ed7f

39. 3 Cards Judgement
Provider: MAC88
Category: CASINO LIVE
UID: 1b72a33d0f799ac4dc75d01e87c51f6b

40. 3 Cards Judgement
Provider: Aura Gaming
Category: CASINO LIVE
UID: e0853d2ea07cdcdbb256aec54df999bc

41. 3 Power Dragons (Avtar)
Provider: Unknown
Category: SLOT
UID: c08670e7c2c90f6a565fa9516e842924

214: 42. 3 Big Barrels Aztec
Provider: Rubyplay
Category: SLOT
UID: eb70e20d756eb4bf4e2b683465b8f9c5

43. 15 Dragon Pearls
Provider: BNG
Category: SLOT
UID: b46d315d49c7ba8bd9be41235414b88c

44. 15 Dragon Pearls: Hold and Win
Provider: BNG(3oks)
Category: SLOT
UID: c1299ac48cd31435588f42f8f4583380

45. 15 Stars Ablaze
Provider: Playtech Asia
Category: SLOT
UID: 17893229c0c7f2659ca25ce921357e89

46. 15 Tridents
Provider: MG
Category: SLOT
UID: 22cda159b93170df2433368afd6e716e

47. 16 Coins
Provider: QT
Category: SLOT
UID: 844639e1b10b863defe7970f3232d4d9

48. 16 Coins Burning Board
Provider: QT
Category: LOTTERY
UID: ef6c2debd111ad4db1ba4e8885fc0aca

49. 16 Coins Diamond Burning Board
Provider: QT
Category: LOTTERY
UID: 46b294152908e68bc12c13f3ac8066a4

50. 16 Coins Gold Burning Board
Provider: QT
Category: LOTTERY
UID: 8294d673f0c1f5e70ba39b74a09993e6

51. 16 Coins Grand Gold Edition
Provider: QT
Category: SLOT
UID: 29fd81131d325971c87600883ddb4cd9

52. 16 Coins Grand Gold Edition Halloween Jackpots
Provider: QT
Category: SLOT
UID: 2c6bb8d247d868629b75a1633b7f393d

53. 16 Coins Grand Gold Edition Santas Jackpots
Provider: QT
Category: SLOT
UID: 34c173c9da86fddbff025c08f0b52cda

54. 16 Coins Grand Platinum Edition
Provider: QT
Category: SLOT
UID: c66f384ab7de487cbdff3121c08ba1b6

55. 16 Coins Grand Platinum Edition Easter Jackpots
Provider: QT
Category: SLOT
UID: 32a76d7f7650b299177d6cf72fa01f42

56. 16 Coins Halloween Edition
Provider: QT
Category: SLOT
UID: f1ef0731baeaee2e6f2d2c89fa2f163d

57. 16 Coins Love the Jackpot
Provider: QT
Category: SLOT
UID: 6eb6c63b815b225e31f380502a7d4875

58. 16 Coins Platinum Burning Board
Provider: QT
Category: LOTTERY
UID: 91a1dd138832486cdb9877d884a307e4

59. 16 Coins x5000
Provider: QT
Category: SLOT
UID: fc2db123938b84690f05c5fbeb32e894

60. 16 Coins x5000 Love the Jackpot
Provider: QT
Category: SLOT
UID: 60bb8752f54b6a184ca6cfe5ab3fc115

61. 16 Coins Xmas
Provider: QT
Category: SLOT
UID: b945a94f42c4cfe01194886c6f0a9d28

62. 16 Coins x5000 Easter Jackpots
Provider: QT
Category: SLOT
UID: 349bc545711bd757829827fac5375eda

63. 16 Coins x5000 Score the Jackpot
Provider: QT
Category: SLOT
UID: 554a8fbc44aa6471befff8b17608212d

64. 168 Lucky Bag
Provider: CQ9
Category: SLOT
UID: ddc3887d612ebb2442b0391f42ef1cc7

65. 168 Lucky Bag 2
Provider: Titi Gaming
Category: SLOT
UID: 7cab6ac00e0b315e112d9658a0476015

66. 1942 Sky Warrior
Provider: Evolution-Red Tiger Asia
Category: SLOT
UID: aec1cd6d9759abdac33ddfdf8868670b

67. 1960 Elvis Guava
Provider: KA
Category: SLOT
UID: e2dc0533d98a89dc837207c78e63e8a8

68. 1st Cricket League
Provider: Amigo
Category: SLOT
UID: 63192730ae335d27a7bf590878d3b198

69. 1Tap Mines
Provider: Turbo Asia
Category: MINI
UID: dad62a94d4cefc185418f04816daca15

70. 1Tap Mines Eu
Provider: Turbo Eu
Category: MINI
UID: 11ecee9facb7f8e008771e3ba905f6a7

71. 1v1 BullBull
Provider: KY
Category: ROULETTE
UID: e85da661176abbd77f4173fcdbb5603b

72. 2 Card Teenpatti
Provider: Aura Gaming
Category: CASINO LIVE
UID: 4986d8f67ea3dc2ecdfed1a55978e0b8

73. 2 card Teenpatti Fast
Provider: Aura Gaming
Category: CASINO LIVE
UID: 6b11c0e9d6e7839039269a701178c0bb

74. 2 Hand Casino Holdem
Provider: Evolution-live Asia
Category: CASINO LIVE
UID: 71f886872d6bf34f6e5fa9e20857df8e

75. 2 Hand Casino Holdem Row
Provider: Evolution Live Row
Category: CASINO LIVE
UID: 97dcc429fe7142159aab82b918780f14

76. 2 Persons Mahjong
Provider: KY
Category: ROULETTE
UID: a4634443b474682e8db93ec7aaa9af14

77. 2 Powerful Dragons
Provider: Skywind
Category: SLOT
UID: b6e3f379228119389ebf1e6ed2b51a3d

78. 2 Wild 2 Die
Provider: Hacksaw Asia
Category: SLOT
UID: 4ed428e71bbf1f6572fa2f1c46fd8685

79. 2 Wild 2 Die Latam
Provider: Hacksaw Latam
Category: SLOT
UID: 1bfc411bd87306191c9c065472d548be

80. 2 Wild 2 Die World
Provider: Hacksaw World
Category: SLOT
UID: 02f66e3835a0d9f988474066c4c5dd33

81. 2-8 Bar
Provider: MT
Category: HUNDRED-PLAYER
UID: 0375c97e5db3651d69968b25b661e4fa

82. 20 20 Teenpatti 2
Provider: MAC88
Category: CASINO LIVE
UID: 4bc3c56df613b843bf5210754b10e0a1

83. 20 Blazing Clover
Provider: JILI
Category: SLOT
UID: 0c5683f2c3829fc0a24c3a49921c76e0

84. 20 Blazing Clover Tada
Provider: TADA
Category: SLOT
UID: 9762e8058984f382c6a908a60b1f7a18

85. 20 Blazing Clover JILISweep
Provider: JILISweep
Category: SLOT
UID: 4af9955674d11fac043163e9d3870e65

86. 20 Coin Halloween Jackpots
Provider: QT
Category: SLOT
UID: 7f66395a97af3cf3f922d86dd9f7294c

87. 20 Coins
Provider: QT
Category: SLOT
UID: 14c1dbd05ac50a0255eaf77527662804

88. 20 Coins Easter
Provider: QT
Category: SLOT
UID: 3d99edf085624ee53fac928aedca44a8

89. 20 Coins Love the Jackpot
Provider: QT
Category: SLOT
UID: a0b28e787c368661e298edb30e880694

90. 20 Coins Santas Jackpots
Provider: QT
Category: SLOT
UID: 9206d04f15bfa099f5e3e70c048c8fc0

91. 20 Coins Score the Jackpot
Provider: QT
Category: SLOT
UID: f54311fbb18473ee086f6310d36cd60c

92. 20 Coins Grand Gold Edition
Provider: QT
Category: SLOT
UID: 3cd7f66564108a3c5ad1368deb71a415

93. 20 Hot Fruit Delights
Provider: GameArt
Category: SLOT
UID: a70e2fc86389943ca5f0119e738b9e3d

94. 20 Power Joker
Provider: AvatarUX
Category: SLOT
UID: ae8fb15b04390316f4c00eba55b94bdd

95. 20 Stars Ablaze
Provider: Playtech Asia
Category: SLOT
UID: aec6e04f6084265a5040aad059f0506c
`;

async function parseAndAddGames() {
    const lines = gamesList.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const games: { name: string, provider: string, category: string, uid: string, dbStatus: string, testResult: string }[] = [];

    let current: any = {};
    for (const line of lines) {
        if (/^\d+\./.test(line)) {
            if (current.uid) {
                games.push(current as any);
            }
            current = { name: line.replace(/^\d+\.\s*/, ''), dbStatus: '', testResult: '' };
        } else if (line.startsWith('Provider:')) {
            current.provider = line.replace('Provider:', '').trim();
        } else if (line.startsWith('Category:')) {
            current.category = line.replace('Category:', '').trim();
        } else if (line.startsWith('UID:')) {
            current.uid = line.replace('UID:', '').trim();
        }
    }
    if (current.uid) {
        games.push(current as any);
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
            g.dbStatus = 'Invalid UID';
            continue;
        }

        let slug = (g.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (g.provider || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        slug = slug.replace(/-+$/, '');

        try {
            const existingByUid = dbGames.find(dbG => dbG.providerId === g.uid);

            if (existingByUid) {
                await prisma.game.update({
                    where: { id: existingByUid.id },
                    data: {
                        name: g.name,
                        provider: g.provider,
                        category: g.category || 'SLOT',
                        providerId: g.uid
                    }
                });
                updated++;
                g.dbStatus = 'Updated';
            } else {
                let finalSlug = slug;
                let counter = 1;
                while (await prisma.game.findUnique({ where: { slug: finalSlug } })) {
                    finalSlug = `${slug}-${counter}`;
                    counter++;
                }

                await prisma.game.create({
                    data: {
                        name: g.name,
                        slug: finalSlug,
                        providerId: g.uid,
                        provider: g.provider,
                        category: g.category || 'SLOT',
                        status: 'ACTIVE'
                    }
                });
                added++;
                g.dbStatus = 'Added';
            }
        } catch (e: any) {
            console.error(`Failed on ${g.name}: ${e.message}`);
            failed++;
            g.dbStatus = 'Failed';
        }
    }

    console.log("=== FINAL REPORT ===");
    console.log("Total requested:", games.length);
    console.log("Added:", added);
    console.log("Updated:", updated);
    console.log("Already matching/skipped:", skipped);
    console.log("Invalid UID:", invalid);
    console.log("Failed DB operations:", failed);
    console.log("====================");

    const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
    const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
    const API_TOKEN = process.env.GAMECLOUD_API_TOKEN;
    const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
    const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://orbitplay.com';

    console.log("\nTesting INR Launch with GameCloud...");

    async function testGameCloud(uid: string) {
        if (!uid) return 'N/A';
        try {
            const payload = {
                reseller_id: RESELLER_ID,
                player_id: "test_player",
                game_uid: uid,
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
                return `SUCCESS (${response.data.game_launch_url.substring(0, 30)}...)`;
            } else {
                return typeof response.data?.message === 'string' ? response.data.message : (typeof response.data?.error === 'string' ? response.data.error : JSON.stringify(response.data));
            }
        } catch (e: any) {
            return `EXCEPTION: ${e.message}`;
        }
    }

    // Existing game test (e.g. Aviator)
    const existingResult = await testGameCloud('bbe2320adc5c506e7e56a2d24d96a252');
    console.log("Existing INR game result:", existingResult);

    // Select up to 3 newly added/updated games
    const testGames = games.filter(g => g.dbStatus === 'Added' || g.dbStatus === 'Updated').slice(0, 3);
    let idx = 0;
    for (const game of testGames) {
        game.testResult = await testGameCloud(game.uid);
        console.log(`New game #${++idx} result:`, game.testResult);
    }

    console.log("\n| Game | Provider | Category | UID | DB Status | INR Test |");
    console.log("|------|----------|----------|-----|-----------|----------|");
    for (const g of games) {
        let testRes = g.testResult || 'Not Tested';
        // Truncate testRes for table
        if (testRes.length > 30) testRes = testRes.substring(0, 27) + '...';
        console.log(`| ${g.name} | ${g.provider} | ${g.category} | ${g.uid} | ${g.dbStatus} | ${testRes} |`);
    }
}
parseAndAddGames(); 
