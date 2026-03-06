#!/usr/bin/env ts-node
/**
 * Example interaction script for Flip Market contract
 * Usage: npx ts-node scripts/interact.ts
 */

import {
  StacksMainnet,
  StacksTestnet,
  AnchorMode,
  PostConditionMode,
  makeStandardSTXPostCondition,
  makeContractCall,
  broadcastTransaction,
  getAddressFromPrivateKey,
  TransactionVersion
} from '@stacks/transactions';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const NETWORK = process.env.STACKS_NETWORK === 'mainnet' ? StacksMainnet : StacksTestnet;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'flip-market';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function getPoolBalance() {
  try {
    const response = await axios.post(
      `${NETWORK.coreApiUrl}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-pool-balance`,
      {
        sender: CONTRACT_ADDRESS,
        arguments: [],
      }
    );
    
    if (response.data.okay) {
      const balance = parseInt(response.data.result.value.value, 10) / 1_000_000;
      console.log(`💰 Pool Balance: ${balance} STX`);
      return balance;
    }
  } catch (error) {
    console.error('Error fetching pool balance:', error);
  }
}

async function getContractInfo() {
  try {
    const response = await axios.post(
      `${NETWORK.coreApiUrl}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-contract-info`,
      {
        sender: CONTRACT_ADDRESS,
        arguments: [],
      }
    );
    
    if (response.data.okay) {
      const info = response.data.result.value.value;
      console.log('\n📋 Contract Info:');
      console.log(`   Min Reward: ${parseInt(info['min-reward'].value, 10) / 1_000_000} STX`);
      console.log(`   Max Reward %: ${info['max-reward-percentage'].value} (50%)`);
      console.log(`   Deposit Amount: ${parseInt(info['deposit-amount'].value, 10) / 1_000_000} STX`);
      console.log(`   Pool Balance: ${parseInt(info['pool-balance'].value, 10) / 1_000_000} STX`);
    }
  } catch (error) {
    console.error('Error fetching contract info:', error);
  }
}

async function flip() {
  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in .env');
    return;
  }
  
  try {
    const address = getAddressFromPrivateKey(PRIVATE_KEY, TransactionVersion.Testnet);
    console.log(`\n🎲 Executing flip from: ${address}`);
    
    const postConditions = [
      makeStandardSTXPostCondition(
        address,
        '>=',
        1_000_000 // 1 STX
      ),
    ];
    
    const transaction = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'flip',
      functionArgs: [],
      senderKey: PRIVATE_KEY,
      fee: 1000,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      postConditions: postConditions,
    });
    
    console.log('📡 Broadcasting transaction...');
    const broadcastResponse = await broadcastTransaction(transaction, NETWORK);
    
    if (broadcastResponse.error) {
      console.error('❌ Transaction failed:', broadcastResponse.error);
      return;
    }
    
    console.log('✅ Transaction submitted!');
    console.log(`📋 TX ID: ${broadcastResponse.txid}`);
    console.log(`🔗 View: ${NETWORK.blockstackAPIUrl}/txid/${broadcastResponse.txid}`);
    
    // Wait a bit then check pool balance
    setTimeout(async () => {
      console.log('\n⏳ Waiting for confirmation...');
      await getPoolBalance();
    }, 5000);
    
  } catch (error: any) {
    console.error('❌ Error:', error);
  }
}

// Main
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'balance':
      await getPoolBalance();
      break;
    case 'info':
      await getContractInfo();
      break;
    case 'flip':
      await flip();
      break;
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/interact.ts balance  - Get pool balance');
      console.log('  npx ts-node scripts/interact.ts info     - Get contract info');
      console.log('  npx ts-node scripts/interact.ts flip     - Execute a flip');
  }
}

main();
