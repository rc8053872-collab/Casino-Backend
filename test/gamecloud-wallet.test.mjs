import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import prismaModule from '../src/prismaClient.ts';
import { GameCloudController, resolveGameCloudPlayerId } from '../src/controllers/GameCloudController.ts';
import { WalletService } from '../src/services/WalletService.ts';
import { GameTransactionService } from '../src/services/games/GameTransactionService.ts';

const prisma = prismaModule.default || prismaModule;
const originalMethods = [];
const initialBalance = 10;
const user = {
  id: '64a000000000000000000001',
  mobile: '+919876543210',
  gameCloudPlayerId: null,
  wallet: {
    id: '64a000000000000000000002',
    userId: '64a000000000000000000001',
    balance: initialBalance,
    lockedBalance: 0,
    currency: 'INR',
    totalLost: 0,
    totalWon: 0,
    totalWithdrawn: 0,
  },
};
const game = {
  id: '64a000000000000000000003',
  slug: 'test-game',
  gameUid: 'provider-game-1',
  providerId: 'provider-game-1',
};

let state;
let transactionQueue;

function replaceMethod(target, name, implementation) {
  if (!target) throw new Error(`Prisma mock target unavailable for ${name}`);
  const descriptor = Object.getOwnPropertyDescriptor(target, name);
  originalMethods.push({ target, name, descriptor });
  Object.defineProperty(target, name, {
    configurable: true,
    writable: true,
    value: implementation,
  });
}

function applyMutation(value, mutation = {}) {
  let next = value;
  if (typeof mutation === 'number') return mutation;
  if (mutation.increment !== undefined) next += mutation.increment;
  if (mutation.decrement !== undefined) next -= mutation.decrement;
  return next;
}

function createTransactionClient(draft) {
  return {
    user: {
      async findUnique({ where }) {
        return where.id === user.id
          ? { ...user, wallet: { ...draft.wallet } }
          : null;
      },
    },
    wallet: {
      async findUnique({ where }) {
        if (where.id && where.id !== draft.wallet.id) return null;
        if (where.userId && where.userId !== draft.wallet.userId) return null;
        return { ...draft.wallet };
      },
      async updateMany({ where, data }) {
        if (
          where.id !== draft.wallet.id ||
          (where.balance?.gte !== undefined && draft.wallet.balance < where.balance.gte) ||
          (where.currency && where.currency !== draft.wallet.currency)
        ) {
          return { count: 0 };
        }
        for (const [key, mutation] of Object.entries(data)) {
          draft.wallet[key] = applyMutation(draft.wallet[key], mutation);
        }
        return { count: 1 };
      },
      async update({ where, data }) {
        assert.equal(where.id, draft.wallet.id);
        for (const [key, mutation] of Object.entries(data)) {
          draft.wallet[key] = applyMutation(draft.wallet[key], mutation);
        }
        return { ...draft.wallet };
      },
    },
    transaction: {
      async findUnique({ where }) {
        return draft.transactions.get(where.idempotencyKey) || null;
      },
      async findFirst({ where }) {
        return [...draft.transactions.values()].find((transaction) =>
          transaction.walletId === where.walletId &&
          transaction.type === where.type &&
          transaction.status === where.status &&
          transaction.referenceId === where.referenceId
        ) || null;
      },
      async create({ data }) {
        if (draft.transactions.has(data.idempotencyKey)) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const created = { ...data, id: `transaction-${draft.transactions.size + 1}` };
        draft.transactions.set(data.idempotencyKey, created);
        return created;
      },
    },
    gameHistory: {
      async findFirst({ where }) {
        if (draft.failGameHistoryLookup) throw new Error('test database failure');
        return draft.gameHistories.find((history) =>
          history.roundId === where.roundId &&
          history.gameId === where.gameId &&
          history.userId === where.userId
        ) || null;
      },
      async findUnique({ where }) {
        return draft.gameHistories.find((history) => history.id === where.id) || null;
      },
      async create({ data }) {
        const created = { ...data, id: `history-${draft.gameHistories.length + 1}` };
        draft.gameHistories.push(created);
        return created;
      },
      async update({ where, data }) {
        if (draft.failGameHistoryUpdate) throw new Error('test database failure');
        const history = draft.gameHistories.find((item) => item.id === where.id);
        if (!history) throw new Error('Game history not found');
        if (data.betAmount?.increment !== undefined) {
          history.betAmount += data.betAmount.increment;
        }
        if (data.winAmount?.increment !== undefined) {
          history.winAmount += data.winAmount.increment;
        }
        if (data.status) history.status = data.status;
        return history;
      },
    },
  };
}

function installPrismaMocks() {
  replaceMethod(prisma.user, 'findMany', async ({ where, take }) => {
    const alternatives = where.OR || [];
    const matches = alternatives.some((condition) =>
      (condition.mobile && condition.mobile === user.mobile) ||
      (condition.gameCloudPlayerId && condition.gameCloudPlayerId === user.gameCloudPlayerId) ||
      (condition.id && condition.id === user.id)
    );
    return matches ? [{ ...user, wallet: { ...state.wallet } }].slice(0, take) : [];
  });
  replaceMethod(prisma.user, 'findUnique', async ({ where }) =>
    where.id === user.id ? { ...user, wallet: { ...state.wallet } } : null
  );
  replaceMethod(prisma.game, 'findFirst', async ({ where }) => {
    const alternatives = where.OR || [];
    return alternatives.some((condition) =>
      condition.slug === game.slug ||
      condition.providerId === game.providerId ||
      condition.gameUid === game.gameUid
    ) ? game : null;
  });
  replaceMethod(prisma.game, 'findUnique', async ({ where }) =>
    where.slug === game.slug ? game : null
  );
  replaceMethod(prisma.transaction, 'findUnique', async ({ where }) =>
    state.transactions.get(where.idempotencyKey) || null
  );
  replaceMethod(prisma.transaction, 'findFirst', async ({ where }) =>
    [...state.transactions.values()].find((transaction) =>
      transaction.walletId === where.walletId &&
      transaction.type === where.type &&
      transaction.status === where.status &&
      transaction.referenceId === where.referenceId
    ) || null
  );
  replaceMethod(prisma.wallet, 'findUnique', async ({ where }) => {
    if (where.id && where.id !== state.wallet.id) return null;
    if (where.userId && where.userId !== state.wallet.userId) return null;
    return { ...state.wallet };
  });
  replaceMethod(prisma, '$transaction', async (callback) => {
    let release;
    const previous = transactionQueue;
    transactionQueue = new Promise((resolve) => { release = resolve; });
    await previous;
    const draft = structuredClone(state);
    try {
      const result = await callback(createTransactionClient(draft));
      state = draft;
      return result;
    } finally {
      release();
    }
  });
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function callback(body) {
  const response = responseRecorder();
  await GameCloudController.callback({ body }, response);
  return response;
}

beforeEach(() => {
  state = {
    wallet: structuredClone(user.wallet),
    transactions: new Map(),
    gameHistories: [],
  };
  transactionQueue = Promise.resolve();
  installPrismaMocks();
});

afterEach(() => {
  for (const { target, name, descriptor } of originalMethods.splice(0).reverse()) {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete target[name];
  }
});

test('balance callback returns the wallet balance for the launch player ID', async () => {
  const response = await callback({
    action: 'balance',
    player_id: user.mobile,
    currency: 'INR',
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'SUCCESS', balance: 10 });
});

test('a ₹1 bet leaves ₹9 and a ₹10 bet leaves ₹0', async (t) => {
  await t.test('₹1 bet', async () => {
    const response = await callback({
      action: 'bet', player_id: user.mobile, provider_txn_id: 'bet-one',
      game_code: game.gameUid, currency: 'INR', amount: 1,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.balance, 9);
  });
  await t.test('₹10 bet', async () => {
    const response = await callback({
      action: 'bet', player_id: user.mobile, provider_txn_id: 'bet-all',
      game_code: game.gameUid, currency: 'INR', amount: 10,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.balance, 0);
  });
});

test('an ₹11 bet is rejected without changing the wallet or ledger', async () => {
  const response = await callback({
    action: 'bet', player_id: user.mobile, provider_txn_id: 'bet-too-much',
    game_code: game.gameUid, currency: 'INR', amount: 11,
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { status: 'FAILED', error: 'INSUFFICIENT_FUNDS' });
  assert.equal(state.wallet.balance, 10);
  assert.equal(state.transactions.size, 0);
});

test('a post-debit history failure rolls back the wallet debit and ledger entry', async () => {
  state.failGameHistoryUpdate = true;
  const response = await callback({
    action: 'bet', player_id: user.mobile, provider_txn_id: 'history-update-error',
    game_code: game.gameUid, currency: 'INR', amount: 1,
  });
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.status, 'FAILED');
  assert.equal(state.wallet.balance, 10);
  assert.equal(state.transactions.size, 0);
});

test('concurrent bets cannot spend the same available balance twice', async () => {
  const responses = await Promise.all(['concurrent-a', 'concurrent-b'].map((provider_txn_id) =>
    callback({
      action: 'bet', player_id: user.mobile, provider_txn_id,
      game_code: game.gameUid, currency: 'INR', amount: 7,
    })
  ));
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 400]);
  assert.equal(state.wallet.balance, 3);
  assert.equal(state.transactions.size, 1);
});

test('win credits only the resolved wallet and duplicate callbacks are idempotent', async () => {
  const first = await callback({
    action: 'win', player_id: user.mobile, provider_txn_id: 'win-one',
    game_code: game.gameUid, currency: 'INR', amount: 5,
  });
  const duplicate = await callback({
    action: 'win', player_id: user.mobile, provider_txn_id: 'win-one',
    game_code: game.gameUid, currency: 'INR', amount: 5,
  });
  assert.equal(first.body.balance, 15);
  assert.equal(duplicate.body.balance, 15);
  assert.equal(state.wallet.userId, user.id);
  assert.equal(state.transactions.size, 1);
});

test('duplicate bet callback does not debit twice', async () => {
  const payload = {
    action: 'bet', player_id: user.mobile, provider_txn_id: 'bet-repeat',
    game_code: game.gameUid, currency: 'INR', amount: 1,
  };
  const first = await callback(payload);
  const duplicate = await callback(payload);
  assert.equal(first.body.balance, 9);
  assert.equal(duplicate.body.balance, 9);
  assert.equal(state.transactions.size, 1);
});

test('reusing a provider transaction ID with a different amount is rejected', async () => {
  const first = await callback({
    action: 'bet', player_id: user.mobile, provider_txn_id: 'bet-conflicting-retry',
    game_code: game.gameUid, currency: 'INR', amount: 1,
  });
  const conflictingRetry = await callback({
    action: 'bet', player_id: user.mobile, provider_txn_id: 'bet-conflicting-retry',
    game_code: game.gameUid, currency: 'INR', amount: 2,
  });
  assert.equal(first.statusCode, 200);
  assert.equal(conflictingRetry.statusCode, 409);
  assert.equal(conflictingRetry.body.error, 'TRANSACTION_ID_CONFLICT');
  assert.equal(state.wallet.balance, 9);
  assert.equal(state.transactions.size, 1);
});

test('unknown player and currency mismatch are rejected', async (t) => {
  await t.test('unknown player', async () => {
    const response = await callback({ action: 'balance', player_id: 'unknown-player' });
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error, 'PLAYER_NOT_FOUND');
  });
  await t.test('currency mismatch', async () => {
    const response = await callback({
      action: 'bet', player_id: user.mobile, provider_txn_id: 'wrong-currency',
      game_code: game.gameUid, currency: 'BDT', amount: 1,
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'CURRENCY_MISMATCH');
    assert.equal(state.wallet.balance, 10);
  });
});

test('malformed and unreferenced refund callbacks fail explicitly', async (t) => {
  await t.test('malformed bet', async () => {
    const response = await callback({
      action: 'bet', player_id: user.mobile, provider_txn_id: 'bad-amount',
      game_code: game.gameUid, currency: 'INR', amount: 'not-a-number',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'INVALID_AMOUNT');
  });
  await t.test('zero-amount bet', async () => {
    const response = await callback({
      action: 'bet', player_id: user.mobile, provider_txn_id: 'zero-amount',
      game_code: game.gameUid, currency: 'INR', amount: '00',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'INVALID_AMOUNT');
    assert.equal(state.wallet.balance, 10);
  });
  await t.test('missing bet amount', async () => {
    const response = await callback({
      action: 'bet', player_id: user.mobile, provider_txn_id: 'missing-amount',
      game_code: game.gameUid, currency: 'INR',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'INVALID_AMOUNT');
    assert.equal(state.wallet.balance, 10);
  });
  await t.test('refund lacks provider-confirmed original transaction reference', async () => {
    const response = await callback({
      action: 'refund', player_id: user.mobile, provider_txn_id: 'refund-one',
      game_code: game.gameUid, currency: 'INR', amount: 1,
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'REFUND_REFERENCE_REQUIRED');
    assert.equal(state.wallet.balance, 10);
  });
});

test('refund credits only an existing successful bet and is idempotent', async (t) => {
  await t.test('rejects a refund with no original completed bet', async () => {
    await assert.rejects(
      WalletService.refund(state.wallet.id, 1, 'refund-without-bet', 'missing-bet'),
      /ORIGINAL_TRANSACTION_NOT_FOUND/
    );
    assert.equal(state.wallet.balance, 10);
    assert.equal(state.transactions.size, 0);
  });

  await t.test('refunds an eligible bet once', async () => {
    state.wallet.balance = 9;
    state.transactions.set('bet-original-key', {
      id: 'bet-original-row',
      walletId: state.wallet.id,
      amount: 1,
      type: 'BET',
      status: 'COMPLETED',
      referenceId: 'bet-original',
    });

    await WalletService.refund(state.wallet.id, 1, 'refund-key', 'bet-original');
    assert.equal(state.wallet.balance, 10);
    assert.equal(state.transactions.size, 2);

    await assert.rejects(
      WalletService.refund(state.wallet.id, 1, 'refund-key', 'bet-original'),
      /IDEMPOTENCY_CONFLICT/
    );
    await assert.rejects(
      WalletService.refund(state.wallet.id, 1, 'different-refund-key', 'bet-original'),
      /REFUND_ALREADY_PROCESSED/
    );
    assert.equal(state.wallet.balance, 10);
    assert.equal(state.transactions.size, 2);
  });
});

test('provider refund processing uses the original bet and its wallet only', async () => {
  state.wallet.balance = 9;
  state.gameHistories.push({
    id: 'history-original',
    userId: user.id,
    gameId: game.id,
    roundId: 'round-original',
    betAmount: 1,
    winAmount: 0,
    status: 'OPEN',
  });
  state.transactions.set('gamecloud:bet:bet-original', {
    id: 'bet-original-row',
    walletId: state.wallet.id,
    gameHistoryId: 'history-original',
    amount: 1,
    type: 'BET',
    status: 'COMPLETED',
    referenceId: 'bet-original',
  });

  const refundRequest = {
    userId: user.id,
    gameId: game.id,
    roundId: 'round-refund',
    transactionId: 'gamecloud:refund:refund-original',
    referenceId: 'bet-original',
    amount: 1,
    type: 'REFUND',
    currency: 'INR',
  };
  await GameTransactionService.processProviderTransaction(refundRequest);
  await GameTransactionService.processProviderTransaction(refundRequest);
  await assert.rejects(GameTransactionService.processProviderTransaction({
    ...refundRequest,
    transactionId: 'gamecloud:refund:refund-retry-with-new-id',
  }), /REFUND_ALREADY_PROCESSED/);

  assert.equal(state.wallet.balance, 10);
  assert.equal(state.transactions.size, 2);
  assert.equal(state.gameHistories[0].status, 'CANCELLED');
});

test('database failures return an explicit HTTP error to the callback caller', async () => {
  state.failGameHistoryLookup = true;
  const response = await callback({
    action: 'bet', player_id: user.mobile, provider_txn_id: 'db-error',
    game_code: game.gameUid, currency: 'INR', amount: 1,
  });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { status: 'FAILED', error: 'WALLET_TRANSACTION_FAILED' });
  assert.equal(state.wallet.balance, 10);
});

test('launch player ID is the same stable ID resolved by callbacks', async () => {
  const launchPlayerId = resolveGameCloudPlayerId(user);
  assert.equal(launchPlayerId, user.mobile);
  const balanceResponse = await callback({
    action: 'balance',
    player_id: launchPlayerId,
    currency: 'INR',
  });
  assert.equal(balanceResponse.body.balance, initialBalance);
});

test('a stored provider player ID takes precedence over the mobile fallback', () => {
  assert.equal(
    resolveGameCloudPlayerId({ ...user, gameCloudPlayerId: 'gc-player-42' }),
    'gc-player-42'
  );
});
