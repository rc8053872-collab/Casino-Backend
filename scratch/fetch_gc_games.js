const axios = require('axios');
const API_TOKEN = 'bfc369fd4090461aa92ca32987be5668';
const SECRET = 'bfc369fd4090461aa92ca32987be5668';
const RESELLER_ID = 306;

async function test(url, method) {
  try {
    const config = {
      method,
      url,
      headers: { 'X-API-Token': API_TOKEN, 'X-Secret-Key': SECRET },
      data: method === 'post' ? { reseller_id: RESELLER_ID } : undefined,
      timeout: 5000
    };
    const res = await axios(config);
    console.log(`[${method}] ${url} -> SUCCESS, Keys:`, Object.keys(res.data));
    if (res.data.data) {
        console.log(`Found ${res.data.data.length} games`);
    } else if (res.data.games) {
        console.log(`Found ${res.data.games.length} games`);
    } else {
        console.log('Response:', JSON.stringify(res.data).substring(0, 100));
    }
  } catch(e) {
    console.log(`[${method}] ${url} -> ERROR:`, e.response?.status, e.response?.data || e.message);
  }
}

async function run() {
  await test('https://api.gamecloudapi.com/api/v1/game/list', 'get');
  await test('https://api.gamecloudapi.com/api/v1/game/list', 'post');
  await test('https://api.gamecloudapi.com/api/v1/games', 'get');
  await test('https://api.gamecloudapi.com/api/v1/games', 'post');
  await test('https://api.gamecloudapi.com/api/v1/catalog', 'get');
  await test('https://api.gamecloudapi.com/api/v1/reseller/games', 'post');
  await test('https://api.gamecloudapi.com/api/v1/reseller/games', 'get');
}
run();
