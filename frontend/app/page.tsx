'use client'

import { useState, useEffect } from 'react'
import { useConnect } from '@stacks/connect-react'
import { StacksMainnet, StacksTestnet } from '@stacks/network'
import { 
  AnchorMode, 
  PostConditionMode, 
  makeStandardSTXPostCondition,
  uintCV
} from '@stacks/transactions'
import styles from './page.module.css'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
const CONTRACT_NAME = 'flip-market'
const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? StacksMainnet : StacksTestnet

export default function Home() {
  const { doContractCall, doOpenStxToken } = useConnect()
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
    try {
      await doOpenStxToken({
        onFinish: (data) => {
          const address = data.userSession.loadUserData().profile.stxAddress.mainnet
          setUserAddress(address)
          localStorage.setItem('stacks-address', address)
          fetchPoolBalance()
        },
      })
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  const fetchPoolBalance = async () => {
    try {
      const response = await fetch(
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
      const data = await response.json()
      if (data.okay && data.result) {
        const balance = parseInt(data.result.value.value, 10) / 1_000_000
        setPoolBalance(balance.toFixed(6))
      }
    } catch (error) {
      console.error('Error fetching pool balance:', error)
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
      await doContractCall({
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
              <p>Connected: {userAddress.slice(0, 10)}...</p>
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
