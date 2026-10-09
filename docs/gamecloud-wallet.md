# GameCloud seamless wallet

## Active launch and callback routes

- Casino frontend launch: `POST /api/v1/games/launch`, authenticated with the casino session. The backend takes the player ID from the verified session; it ignores any client-supplied player ID.
- GameCloud launch API: `${GAMECLOUD_BASE_URL}/api/v1/game/launch`. Configure the host, reseller ID, API token, secret key, and casino home URL using backend environment variables.
- Operator Profile wallet callback URL: `https://api.maltiplayx.com/api/v1/callback`. This is the callback route registered by the backend; the launch request does not send a callback URL.
- Frontend wallet balance: `GET /api/wallet/balance`; its authenticated user and wallet are resolved independently from the GameCloud callback.

The active casino launch client is `src/services/gameProvider.ts`; the PHP `GetGameUrl.php` integration is not present in this repository. A PHP integration configured for a different host, reseller, or currency is not the active TypeScript launch path and should be treated as a separate/legacy integration until its deployment is independently verified.

## Callback fields currently handled

The implementation uses the callback fields present in the existing integration: `action`, `player_id`, `currency`, `amount`, `game_code`, and `provider_txn_id`. Example balance request:

```json
{
  "action": "balance",
  "player_id": "<same ID sent in the launch request>",
  "currency": "INR"
}
```

Example successful response from the current implementation:

```json
{
  "status": "SUCCESS",
  "balance": 10
}
```

Example successful ₹1 bet request and response:

```json
{
  "action": "bet",
  "player_id": "<same ID sent in the launch request>",
  "provider_txn_id": "<unique provider transaction ID>",
  "game_code": "<known provider game code>",
  "currency": "INR",
  "amount": 1
}
```

```json
{
  "status": "SUCCESS",
  "balance": 9
}
```

These examples describe the code's current contract; verify field names, response shape, signature/authentication requirements, and HTTP status expectations against the GameCloud Operator documentation or a redacted production callback trace before changing the provider profile. Do not send real-money test callbacks to production.

## Refund handling

Refunds fail closed until GameCloud's documented field identifying the original successful bet is confirmed. A refund must identify the original completed bet transaction, belong to the same wallet and game, not exceed the original bet, and not have been refunded already. Do not configure refund callbacks as successful until the provider's exact original-transaction reference field and retry/idempotency semantics have been verified.

## Operator verification checklist

1. Confirm the GameCloud Operator Profile uses `https://api.maltiplayx.com/api/v1/callback` (not a PHP/BDT endpoint).
2. Confirm the configured reseller and API credentials are the values provisioned for the production GameCloud account; keep credentials only in backend environment variables.
3. Confirm launch uses the same `player_id` for balance and subsequent actions, and both launch `currency_code` and callback `currency` are `INR`.
4. Inspect a redacted callback trace for action, HTTP status, error code, and response JSON. Never share tokens, signatures, full phone numbers, or full provider player IDs in support evidence.
5. Test bets and credits with a provider test wallet/environment before enabling production play.
