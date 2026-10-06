import { AdminController } from './src/controllers/AdminController';
import { Request, Response, NextFunction } from 'express';

const mockRes = () => {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.data = data; return res; };
  return res;
};

const mockNext = () => (err?: any) => {
  if (err) console.error("Next called with err:", err);
};

async function testApi() {
  console.log("================================================");
  console.log("TESTING ADMIN GAME CATALOG APIs");
  console.log("================================================\n");

  let res: any;

  // 1. Fetch first page
  res = mockRes();
  await AdminController.getGames({ query: { page: '1', limit: '40' } } as any, res, mockNext());
  console.log("1. Fetch first page");
  console.log(`Pagination: ${JSON.stringify(res.data.pagination)}`);
  console.log(`Games returned: ${res.data.games.length}\n`);

  // 2. Fetch second page
  res = mockRes();
  await AdminController.getGames({ query: { page: '2', limit: '40' } } as any, res, mockNext());
  console.log("2. Fetch second page");
  console.log(`Pagination: ${JSON.stringify(res.data.pagination)}`);
  console.log(`Games returned: ${res.data.games.length}\n`);

  // 3. Search Aviator
  res = mockRes();
  await AdminController.getGames({ query: { search: 'Aviator', limit: '10' } } as any, res, mockNext());
  console.log("3. Search Aviator");
  console.log(`Total found: ${res.data.pagination.total}`);
  console.log(`Sample game name: ${res.data.games[0]?.name}\n`);

  // 4. Filter Rich88
  res = mockRes();
  await AdminController.getGames({ query: { provider: 'Rich88', limit: '10' } } as any, res, mockNext());
  console.log("4. Filter Rich88");
  console.log(`Total found: ${res.data.pagination.total}`);
  console.log(`Sample provider: ${res.data.games[0]?.provider}\n`);

  // 5. Filter ARCADE
  res = mockRes();
  await AdminController.getGames({ query: { category: 'ARCADE', limit: '1' } } as any, res, mockNext());
  console.log("5. Filter ARCADE");
  console.log(`Total found: ${res.data.pagination.total}`);
  console.log(`Sample category: ${res.data.games[0]?.category}\n`);

  // 6. Filter INTEGRATION_PENDING (maps to status=INACTIVE in my implementation)
  res = mockRes();
  await AdminController.getGames({ query: { status: 'INTEGRATION_PENDING', limit: '1' } } as any, res, mockNext());
  console.log("6. Filter INTEGRATION_PENDING");
  console.log(`Total found: ${res.data.pagination.total}`);
  console.log(`Sample status: ${res.data.games[0]?.status}\n`);

  // 7. Search by Game UID
  res = mockRes();
  await AdminController.getGames({ query: { search: '094408605f9c95d439b18edf66c583f1', limit: '1' } } as any, res, mockNext());
  console.log("7. Search by Game UID (094408605f9c95d439b18edf66c583f1)");
  console.log(`Total found: ${res.data.pagination.total}`);
  console.log(`Sample name: ${res.data.games[0]?.name}\n`);

  // 8. Confirm pagination count = 241
  res = mockRes();
  await AdminController.getGames({ query: {} } as any, res, mockNext());
  console.log("8. Confirm total count");
  console.log(`Total count: ${res.data.pagination.total} (Expected: 241)\n`);

  // 9. Fetch providers
  res = mockRes();
  await AdminController.getProviders({} as any, res, mockNext());
  console.log("9. Confirm Providers route works");
  console.log(`Total providers: ${res.data.length}\n`);

  console.log("================================================");
  console.log("ALL TESTS COMPLETED");
  console.log("================================================");
  process.exit(0);
}

testApi().catch(e => {
  console.error(e);
  process.exit(1);
});
