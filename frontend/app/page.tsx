'use client'

import { useState, useEffect } from 'react'
import { connect, openContractCall, request } from '@stacks/connect'
import { StacksMainnet, StacksTestnet } from '@stacks/network'
import { 
  AnchorMode, 
  PostConditionMode, 
  makeStandardSTXPostCondition,
  uintCV
} from '@stacks/transactions'
import styles from './page.module.css'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'ST1JRV7YA23N532H14MQPXKMPDGWS75KREY2M03EW'
const CONTRACT_NAME = 'flip-market'
const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet()
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export default function Home() {
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [poolBalance, setPoolBalance] = useState<string>('0')
  const [isLoading, setIsLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<string>('')
  const [lastReward, setLastReward] = useState<string>('')

  useEffect(() => {
    // Check for existing session from localStorage
    const address = localStorage.getItem('stacks-address')
    if (address) {
      setUserAddress(address)
    }
  }, [])

  const handleConnect = async () => {
    // Check if running in browser
    if (typeof window === 'undefined') {
      alert('Please open this page in a browser')
      return
    }

    try {
      console.log('Starting wallet connection...')
      
      // Step 1: Connect to wallet (this shows the popup)
      const connectResponse = await connect({
        forceWalletSelect: true,
      })
      
      console.log('Connect response:', connectResponse)
      console.log('Response type:', typeof connectResponse)
      console.log('Response stringified:', JSON.stringify(connectResponse, null, 2))
      
      // Step 2: Request addresses using the request API
      // This is the reliable way to get addresses after connection
      let addresses = null
      try {
        addresses = await request('getAddresses')
        console.log('Addresses from request API:', addresses)
        console.log('Addresses type:', typeof addresses)
        console.log('Addresses stringified:', JSON.stringify(addresses, null, 2))
      } catch (requestError) {
        console.warn('Request API failed, trying to extract from connect response:', requestError)
      }
      
      // Extract address from either request response or connect response
      const isTestnet = process.env.NEXT_PUBLIC_NETWORK !== 'mainnet'
      let address = null
      
      // First try to get address from request API response
      if (addresses) {
        if (typeof addresses === 'string') {
          address = addresses
        } else if (Array.isArray(addresses) && addresses.length > 0) {
          address = typeof addresses[0] === 'string' ? addresses[0] : addresses[0]
        } else if (addresses.addresses) {
          address = isTestnet 
            ? (addresses.addresses.testnet || addresses.addresses.mainnet)
            : (addresses.addresses.mainnet || addresses.addresses.testnet)
        } else if (addresses.testnet || addresses.mainnet) {
          address = isTestnet ? addresses.testnet : addresses.mainnet
        } else if (addresses.address) {
          address = addresses.address
        }
      }
      
      // If request API didn't work, try connect response
      if (!address && connectResponse) {
        if (connectResponse.addresses) {
          if (typeof connectResponse.addresses === 'object') {
            address = isTestnet 
              ? (connectResponse.addresses.testnet || connectResponse.addresses.mainnet || connectResponse.addresses[0])
              : (connectResponse.addresses.mainnet || connectResponse.addresses.testnet || connectResponse.addresses[0])
          } else if (typeof connectResponse.addresses === 'string') {
            address = connectResponse.addresses
          }
        } else if (connectResponse.address) {
          address = typeof connectResponse.address === 'string' 
            ? connectResponse.address 
            : (isTestnet ? connectResponse.address.testnet : connectResponse.address.mainnet)
        } else if (connectResponse.testnet) {
          address = connectResponse.testnet
        } else if (connectResponse.mainnet) {
          address = connectResponse.mainnet
        } else if (typeof connectResponse === 'string') {
          address = connectResponse
        } else if (typeof connectResponse === 'object') {
          // Search for address-like strings (ST/SP prefix)
          for (const key in connectResponse) {
            const value = connectResponse[key]
            if (typeof value === 'string' && (value.startsWith('ST') || value.startsWith('SP'))) {
              address = value
              break
            } else if (typeof value === 'object' && value) {
              for (const nestedKey in value) {
                const nestedValue = value[nestedKey]
                if (typeof nestedValue === 'string' && (nestedValue.startsWith('ST') || nestedValue.startsWith('SP'))) {
                  address = nestedValue
                  break
                }
              }
              if (address) break
            }
          }
        }
      }
      
      if (address) {
        setUserAddress(address)
        localStorage.setItem('stacks-address', address)
        fetchPoolBalance()
        console.log('✅ Successfully connected with address:', address)
      } else {
        console.error('❌ Could not extract address from either source')
        console.error('Connect response:', JSON.stringify(connectResponse, null, 2))
        console.error('Request addresses:', JSON.stringify(addresses, null, 2))
        alert('Could not extract wallet address. Please check the browser console (F12) for details and share the logged response structure.')
        throw new Error('Could not extract wallet address from response')
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      const errorMsg = error?.message || String(error) || 'Unknown error'
      
      // Don't show wallet installation message for connection/signing errors
      // Only show it for actual missing wallet errors
      if (errorMsg.includes('No provider') || errorMsg.includes('not found') || errorMsg.includes('not installed') || errorMsg.includes('extension')) {
        alert('Please install a Stacks-compatible wallet:\n\n' +
              '• Leather (Hiro): https://www.hiro.so/wallet\n' +
              '• Xverse: https://www.xverse.app\n' +
              '• Or any other SIP-030 compliant wallet')
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('cancelled') || errorMsg.includes('denied')) {
        // User cancelled - don't show error, just log it
        console.log('User cancelled wallet connection')
      } else {
        // Show the actual error message
        alert(`Error connecting wallet: ${errorMsg}\n\nPlease try again or try a different wallet.`)
      }
    }
  }

  const fetchPoolBalance = async () => {
    try {
      // Use backend API instead of calling Stacks API directly
      const response = await fetch(`${BACKEND_URL}/api/pool-balance`)
      const data = await response.json()
      
      if (data.success && data.balance) {
        // Backend returns balance in STX format
        setPoolBalance(data.balance.stx || data.balance.toString())
      } else if (data.pending) {
        // Contract is pending confirmation
        setPoolBalance('Pending...')
        console.log('⏳ Contract deployment pending confirmation:', data.message)
      } else {
        console.error('Unexpected response format:', data)
        // Fallback to direct Stacks API call if backend fails
        const fallbackResponse = await fetch(
          `${NETWORK.coreApiUrl}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-pool-balance`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: CONTRACT_ADDRESS,
              arguments: [],
            }),
          }
        )
        const fallbackData = await fallbackResponse.json()
        if (fallbackData.okay && fallbackData.result) {
          const balance = parseInt(fallbackData.result.value.value, 10) / 1_000_000
          setPoolBalance(balance.toFixed(6))
        }
      }
    } catch (error) {
      console.error('Error fetching pool balance:', error)
      // Try fallback to direct API
      try {
        const fallbackResponse = await fetch(
          `${NETWORK.coreApiUrl}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-pool-balance`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: CONTRACT_ADDRESS,
              arguments: [],
            }),
          }
        )
        const fallbackData = await fallbackResponse.json()
        if (fallbackData.okay && fallbackData.result) {
          const balance = parseInt(fallbackData.result.value.value, 10) / 1_000_000
          setPoolBalance(balance.toFixed(6))
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
      }
    }
  }

  const handleFlip = async () => {
    if (!userAddress) {
      alert('Please connect your wallet first')
      return
    }

    setIsLoading(true)
    setTxStatus('Preparing transaction...')

    try {
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'flip',
        functionArgs: [],
        network: NETWORK,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        postConditions: [
          makeStandardSTXPostCondition(
            userAddress,
            '>=',
            1_000_000 // 1 STX in micro-STX
          ),
        ],
        onFinish: (data) => {
          setTxStatus(`Transaction submitted! TX: ${data.txId}`)
          setIsLoading(false)
          // Wait a bit then refresh pool balance
          setTimeout(() => {
            fetchPoolBalance()
          }, 5000)
        },
        onCancel: () => {
          setTxStatus('Transaction cancelled')
          setIsLoading(false)
        },
        onError: (error) => {
          console.error('Transaction error:', error)
          setTxStatus(`Error: ${error.message || 'Transaction failed'}`)
          setIsLoading(false)
        },
      })
    } catch (error: any) {
      console.error('Error executing flip:', error)
      setTxStatus(`Error: ${error.message}`)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPoolBalance()
    const interval = setInterval(fetchPoolBalance, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>🎰 Flip Market</h1>
        <p className={styles.description}>
          Deposit 1 STX and win a random reward from the pool!
        </p>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <h3>Pool Balance</h3>
            <p className={styles.statValue}>{poolBalance} STX</p>
          </div>
        </div>

        {!userAddress ? (
          <button className={styles.connectButton} onClick={handleConnect}>
            Connect Wallet
          </button>
        ) : (
          <div className={styles.gameSection}>
            <div className={styles.userInfo}>
              <p>Connected: {userAddress && typeof userAddress === 'string' ? `${userAddress.slice(0, 10)}...` : 'Not connected'}</p>
            </div>
            
            <button 
              className={styles.flipButton} 
              onClick={handleFlip}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : '🎲 Flip (1 STX)'}
            </button>

            {txStatus && (
              <div className={styles.status}>
                <p>{txStatus}</p>
              </div>
            )}

            {lastReward && (
              <div className={styles.reward}>
                <p>🎉 Last Reward: {lastReward} STX</p>
              </div>
            )}
          </div>
        )}

        <div className={styles.rules}>
          <h3>Rules</h3>
          <ul>
            <li>Deposit exactly 1 STX per flip</li>
            <li>Every player wins something (no zero rewards)</li>
            <li>Maximum reward is 50% of the pool</li>
            <li>Rewards are calculated randomly</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
