# 🎰 Flip Market - Stacks Blockchain

A decentralized flip market where players deposit 1 STX into a shared pool and receive a random reward. Every player wins something, with rewards capped at 50% of the pool.

## 📁 Project Structure

```
stacks-flip/
├── contracts/          # Clarity smart contracts
│   └── flip-market.clar
├── tests/              # Contract tests
│   └── flip-market_test.ts
├── frontend/           # Next.js frontend application
│   ├── app/
│   ├── package.json
│   └── ...
├── backend/            # Express.js API server
│   ├── src/
│   ├── package.json
│   └── ...
├── scripts/            # Deployment and interaction scripts
│   ├── deploy.ts
│   └── interact.ts
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- [Clarinet](https://docs.hiro.so/clarinet) for contract development
- Stacks wallet (Hiro Wallet recommended)

### 1. Smart Contract Setup

```bash
# Install Clarinet (if not already installed)
# See: https://docs.hiro.so/clarinet/installing-clarinet

# Run tests
clarinet test
```

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your contract address
npm run dev
```

Visit `http://localhost:3000`

### 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your contract address
npm run dev
```

Backend runs on `http://localhost:3001`

## 📝 Contract Details

### Functions

- **`flip`**: Deposit 1 STX and receive a random reward
- **`get-pool-balance`**: Get current pool balance
- **`get-contract-info`**: Get contract configuration and pool balance

### Rules

- ✅ Deposit exactly 1 STX per flip
- ✅ No zero rewards (minimum 1 micro-STX)
- ✅ Maximum reward is 50% of current pool
- ✅ Random reward calculation based on block hash

## 🧪 Testing

```bash
# Run contract tests
clarinet test

# Run frontend tests (when added)
cd frontend && npm test

# Run backend tests (when added)
cd backend && npm test
```

## 📦 Deployment

### Deploy Contract

1. Set up `.env` file:
```bash
DEPLOYER_PRIVATE_KEY=your_private_key_here
STACKS_NETWORK=testnet  # or mainnet
```

2. Deploy:
```bash
npx ts-node scripts/deploy.ts
```

3. Update `.env` files in frontend and backend with the contract address

### Interact with Contract

```bash
# Get pool balance
npx ts-node scripts/interact.ts balance

# Get contract info
npx ts-node scripts/interact.ts info

# Execute a flip
npx ts-node scripts/interact.ts flip
```

## 🔧 Configuration

### Environment Variables

**Frontend** (`.env`):
```
NEXT_PUBLIC_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_NETWORK=testnet
```

**Backend** (`.env`):
```
PORT=3001
STACKS_NETWORK=testnet
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
```

**Scripts** (`.env`):
```
DEPLOYER_PRIVATE_KEY=your_private_key
STACKS_NETWORK=testnet
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
PRIVATE_KEY=your_private_key  # For interaction scripts
```

## 📚 API Endpoints (Backend)

- `GET /health` - Health check
- `GET /api/pool-balance` - Get current pool balance
- `GET /api/contract-info` - Get contract information
- `GET /api/flip-history?limit=50` - Get flip history

## 🛡️ Security Considerations

- Random number generation uses block hash (pseudo-random, not cryptographically secure)
- All payments are validated (must be exactly 1 STX)
- Pool balance is checked before each reward transfer
- Contract is immutable once deployed (plan carefully)

## 📖 Documentation

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed implementation details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT

## ⚠️ Disclaimer

This is a game/experiment, not an investment product. Use at your own risk.
