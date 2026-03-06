import { StacksMainnet, StacksTestnet } from '@stacks/network';
import axios from 'axios';

const NETWORK = process.env.STACKS_NETWORK === 'mainnet' ? StacksMainnet : StacksTestnet;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'flip-market';

/**
 * Call read-only function on the contract
 */
async function callReadOnlyFunction(functionName, args = []) {
  try {
    const response = await axios.post(
      `${NETWORK.coreApiUrl}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/${functionName}`,
      {
        sender: CONTRACT_ADDRESS,
        arguments: args.map(arg => ({
          type: arg.type,
          value: arg.value,
        })),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.okay) {
      return response.data.result.value;
    } else {
      throw new Error(response.data.cause || 'Contract call failed');
    }
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw error;
  }
}

/**
 * Get current pool balance
 */
export async function getPoolBalance() {
  const result = await callReadOnlyFunction('get-pool-balance');
  const balance = parseInt(result.value, 10) / 1_000_000; // Convert micro-STX to STX
  return {
    microStx: result.value,
    stx: balance.toFixed(6),
  };
}

/**
 * Get contract information
 */
export async function getContractInfo() {
  const result = await callReadOnlyFunction('get-contract-info');
  const tuple = result.value;
  
  return {
    minReward: {
      microStx: tuple['min-reward'].value,
      stx: (parseInt(tuple['min-reward'].value, 10) / 1_000_000).toFixed(6),
    },
    maxRewardPercentage: tuple['max-reward-percentage'].value,
    depositAmount: {
      microStx: tuple['deposit-amount'].value,
      stx: (parseInt(tuple['deposit-amount'].value, 10) / 1_000_000).toFixed(6),
    },
    poolBalance: {
      microStx: tuple['pool-balance'].value,
      stx: (parseInt(tuple['pool-balance'].value, 10) / 1_000_000).toFixed(6),
    },
  };
}

/**
 * Get flip history from contract events
 */
export async function getFlipHistory(limit = 50) {
  try {
    const response = await axios.get(
      `${NETWORK.coreApiUrl}/extended/v1/tx/events`,
      {
        params: {
          limit,
          offset: 0,
          type: 'contract_event',
          contract_address: CONTRACT_ADDRESS,
          contract_name: CONTRACT_NAME,
          event_name: 'flip-completed',
        },
      }
    );

    const events = response.data.results || [];
    
    return events.map(event => {
      const payload = event.event_data || {};
      return {
        txId: event.tx_id,
        blockHeight: event.block_height,
        player: payload.player?.value,
        deposit: {
          microStx: payload.deposit?.value,
          stx: (parseInt(payload.deposit?.value || '0', 10) / 1_000_000).toFixed(6),
        },
        reward: {
          microStx: payload.reward?.value,
          stx: (parseInt(payload.reward?.value || '0', 10) / 1_000_000).toFixed(6),
        },
        poolBefore: {
          microStx: payload['pool-before']?.value,
          stx: (parseInt(payload['pool-before']?.value || '0', 10) / 1_000_000).toFixed(6),
        },
        poolAfter: {
          microStx: payload['pool-after']?.value,
          stx: (parseInt(payload['pool-after']?.value || '0', 10) / 1_000_000).toFixed(6),
        },
        timestamp: event.burn_block_time_iso,
      };
    });
  } catch (error) {
    console.error('Error fetching flip history:', error);
    throw error;
  }
}
