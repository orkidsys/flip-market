import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPoolBalance, getContractInfo, getFlipHistory } from './services/contractService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get pool balance
app.get('/api/pool-balance', async (req, res) => {
  try {
    const balance = await getPoolBalance();
    res.json({ success: true, balance });
  } catch (error) {
    console.error('Error fetching pool balance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get contract info
app.get('/api/contract-info', async (req, res) => {
  try {
    const info = await getContractInfo();
    res.json({ success: true, info });
  } catch (error) {
    console.error('Error fetching contract info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get flip history (from blockchain events)
app.get('/api/flip-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await getFlipHistory(limit);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching flip history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Network: ${process.env.STACKS_NETWORK || 'testnet'}`);
});
