# BarterChain - Decentralised Barter Marketplace MVP

A full-stack Web3 barter platform where users exchange physical goods while staking MATIC (Polygon testnet) as collateral via an on-chain escrow contract.

**Architecture:** Blockchain handles financial trust. Backend handles real-world logistics.

---

## Live Demo

- **App:** https://decentralised-barter-chain-p17u.vercel.app
- **Backend API:** https://barterchain-backend.onrender.com/api/health
- **Repo:** https://github.com/shivani51-06/Decentralised-BarterChain

> The backend is on Render's free tier and spins down after ~15 min of inactivity - the first request after a while may take 30–60s to wake it up.

Listings, wallet connect, trade requests/acceptance, and profiles are fully functional on the live demo. The on-chain escrow steps (deposit stake, confirm, dispute) require a deployed smart contract, which isn't live yet - those steps work end-to-end when run locally against a Hardhat node (see below).

---

## Project Structure

```
decentralised_barter/
├── contracts/   # Solidity smart contract + Hardhat
├── backend/     # Node.js + Express + MongoDB API
└── frontend/    # React + Vite + Tailwind + ethers.js
```

---

## Prerequisites

- Node.js 18+
- MongoDB running locally (`mongod`)
- MetaMask browser extension
- Git

---

## 1. Smart Contract Setup

```bash
cd contracts
npm install
```

### Run locally (recommended for dev)

```bash
# Terminal 1 — start local Hardhat blockchain
npm run node

# Terminal 2 — deploy contract + write ABI to frontend
npm run deploy:local
```

Copy the printed contract address.

### Deploy to Polygon Mumbai (testnet)

1. Copy `.env.example` → `.env` and fill in your RPC URL and deployer private key
2. Get free test MATIC from the [Mumbai Faucet](https://faucet.polygon.technology/)
3. Deploy:

```bash
npm run deploy:mumbai
```

### Run contract tests

```bash
npm test
```

---

## 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI and PORT if needed
npm run dev
```

Backend runs on `http://localhost:5000`.

---

## 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: set VITE_CONTRACT_ADDRESS to your deployed contract address
npm run dev
```

Frontend runs on `http://localhost:5173`.

> The Vite dev server proxies `/api` requests to `http://localhost:5000` automatically.

---

## Sample End-to-End Test Flow

Use **two browser profiles** with different MetaMask accounts, both on the Hardhat local network (or Mumbai).

### Configure MetaMask for local Hardhat network

- Network Name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Import test accounts using the private keys printed by `npm run node`

---

### Step-by-step walkthrough

| Step | Who | Action |
|------|-----|--------|
| 1 | User A | Connect MetaMask → Create a listing |
| 2 | User B | Connect MetaMask → Create a listing |
| 3 | User B | Go to Home → click "Request Trade" on User A's listing → select own listing |
| 4 | User A | Go to Trade Requests → Accept |
| 5 | Both | **Before staking**, User A must create the on-chain trade via the Hardhat console (see below) |
| 6 | Both | Go to Active Trades → Deposit Stake (same MATIC amount) |
| 7 | Both | Ship items, add tracking ID, upload proof URL |
| 8 | Both | Click "Confirm Receipt" — on-chain + off-chain |
| 9 | — | Stakes auto-released by smart contract; trust scores updated |

---

### Creating the on-chain trade (Step 5 - local dev)

```bash
cd contracts
npx hardhat console --network localhost

# In the console:
const contract = await ethers.getContractAt("BarterEscrow", "YOUR_CONTRACT_ADDRESS")
await contract.createTrade("USER_B_WALLET_ADDRESS")
# Note the returned tradeId (starts at 0)
```

Then in the frontend, the backend's trade document needs the `contractTradeId` set. You can do this via the `/api/trades/stake` endpoint once both users call `depositStake` from the Active Trades page (the page reads `contractTradeId` from the trade record).

**Simplified dev flow:** Set `contractTradeId` manually in MongoDB after creating the on-chain trade, then both users deposit via the UI.

---

### Dispute resolution (admin)

```bash
npx hardhat console --network localhost

const contract = await ethers.getContractAt("BarterEscrow", "YOUR_CONTRACT_ADDRESS")
await contract.resolveDispute(TRADE_ID, "WINNER_WALLET_ADDRESS")
```

- Winner receives 100% of their stake (full amount back)
- Loser receives 70% of their stake
- Admin (contract deployer) receives 30% of loser's stake

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/connect-wallet` | Upsert user by wallet address |
| POST | `/api/products` | Create listing (needs `x-wallet-address` header) |
| GET | `/api/products` | List all available products |
| GET | `/api/products/:id` | Single product |
| POST | `/api/trades/request` | Request a trade |
| POST | `/api/trades/accept` | Accept incoming request |
| POST | `/api/trades/stake` | Record on-chain stake info |
| POST | `/api/trades/upload-proof` | Upload shipment proof URL |
| POST | `/api/trades/add-tracking` | Add shipment tracking ID |
| POST | `/api/trades/confirm` | Confirm receipt |
| POST | `/api/trades/dispute` | Raise a dispute |
| GET | `/api/trades/my` | All trades for connected wallet |

---

## Smart Contract: BarterEscrow

| Function | Access | Description |
|----------|--------|-------------|
| `createTrade(userB)` | Any | UserA initiates a trade |
| `depositStake(tradeId)` payable | Participants | Both deposit equal MATIC |
| `confirmTrade(tradeId)` | Participants | Confirm receipt; both confirm = release |
| `raiseDispute(tradeId)` | Participants | Freeze funds pending admin review |
| `resolveDispute(tradeId, winner)` | Owner only | Apply penalty split |
| `cancelTrade(tradeId)` | Participants | Refund if not fully staked |

### Penalty math

```
penalty    = stakeAmount × 30%
winnerPayout = stakeAmount          (100% — their own 70% + loser's 30%)
loserRefund  = stakeAmount × 70%
ownerFee     = stakeAmount × 30%    (admin fee)

Total out = stakeAmount + 0.7×stakeAmount + 0.3×stakeAmount = 2×stakeAmount ✓
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity ^0.8.20, Hardhat |
| Blockchain | Polygon Mumbai testnet (or local Hardhat) |
| Wallet | MetaMask + ethers.js v6 |
| Backend | Node.js, Express 4, MongoDB (Mongoose) |
| Frontend | React 18, Vite, Tailwind CSS |
