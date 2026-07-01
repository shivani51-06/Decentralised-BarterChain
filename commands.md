# 1 — Smart contract
cd contracts && npm install
npm run node           # Terminal 1: local blockchain
npm run deploy:local   # Terminal 2: deploy + writes ABI to frontend

# 2 — Backend
cd backend && npm install
cp .env.example .env && npm run dev

# 3 — Frontend
cd frontend && npm install
[
    # or try with
    cd frontend
    npm install --legacy-peer-deps
]
cp .env.example .env
# Set VITE_CONTRACT_ADDRESS= from the deploy output
npm run dev            # Opens at localhost:5173

# 4 — Run tests
cd contracts && npm test
