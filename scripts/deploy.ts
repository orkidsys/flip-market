#!/usr/bin/env ts-node
/**
 * Deployment script for Flip Market contract
 * Usage: npx ts-node scripts/deploy.ts
 */

import { 
  StacksMainnet, 
  StacksTestnet,
  AnchorMode,
  makeContractDeploy,
  broadcastTransaction,
  getAddressFromPrivateKey,
  TransactionVersion
} from '@stacks/transactions';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const NETWORK = process.env.STACKS_NETWORK === 'mainnet' ? StacksMainnet : StacksTestnet;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('❌ DEPLOYER_PRIVATE_KEY not found in .env');
  process.exit(1);
}

const contractName = 'flip-market';
const contractPath = path.join(__dirname, '../contracts/flip-market.clar');

async function deploy() {
  try {
    console.log('📄 Reading contract file...');
    const contractCode = fs.readFileSync(contractPath, 'utf-8');
    
    console.log('🔑 Getting deployer address...');
    const address = getAddressFromPrivateKey(PRIVATE_KEY, TransactionVersion.Testnet);
    console.log(`📍 Deployer address: ${address}`);
    
    console.log('📦 Creating deployment transaction...');
    const transaction = await makeContractDeploy({
      contractName,
      codeBody: contractCode,
      senderKey: PRIVATE_KEY,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
      fee: 10000,
    });
    
    console.log('📡 Broadcasting transaction...');
    const broadcastResponse = await broadcastTransaction(transaction, NETWORK);
    
    if (broadcastResponse.error) {
      console.error('❌ Deployment failed:', broadcastResponse.error);
      process.exit(1);
    }
    
    console.log('✅ Deployment successful!');
    console.log(`📋 Transaction ID: ${broadcastResponse.txid}`);
    console.log(`🔗 View on explorer: ${NETWORK.blockstackAPIUrl}/txid/${broadcastResponse.txid}`);
    console.log(`\n📝 Contract address: ${address}`);
    console.log(`📝 Contract name: ${contractName}`);
    console.log(`\n💡 Update your .env files with:`);
    console.log(`   CONTRACT_ADDRESS=${address}`);
    
  } catch (error: any) {
    console.error('❌ Error during deployment:', error);
    process.exit(1);
  }
}

deploy();
