# ERROR404 – Robinhood Chain Trading Bot

Telegram-based trading terminal with wallet management, token scanner, sniper, autopilot, and smart-money tracking.

## Features

- Multi‑wallet support (create, import, export)
- Token scanner with risk scoring
- Manual buy/sell with simulation and confirmation
- Sniper – automated opportunity scanning
- Autopilot – rule‑based trade management
- Positions & orders tracking
- Smart money wallet tracking
- Alerts for momentum, liquidity, risk, etc.

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials.
2. Install dependencies: `pnpm install`
3. Build: `pnpm run build`
4. Start: `pnpm start`

## Deployment

Use Docker or Railway (see `Dockerfile` and `railway.json`).

## Commands

- `/wallet`, `/createwallet`, `/import`, `/export`, `/switch`, `/balance`
- `/scan <address>` – analyse a token
- `/buy <address> <eth>` – buy token
- `/sell <address> <percent>` – sell % of position
- `/positions`, `/orders`
- `/sniper start|stop`
- `/autopilot start|stop`
- `/track <address>`, `/untrack <address>`
- `/alert add|remove <type> [threshold]`
- `/wallets` – list all wallets (admin only)
