# Flip Market - Stacks Blockchain Implementation Plan

## Overview
A decentralized flip market where players deposit 1 STX into a shared pool and receive a random reward. Every player wins something, with rewards capped at 50% of the pool.

## Core Requirements
- ✅ Players deposit exactly 1 STX per participation
- ✅ Deposits are added to a global STX pool
- ✅ Random reward generation (no zero rewards)
- ✅ Minimum reward: > 0 STX
- ✅ Maximum reward: 50% of current pool
- ✅ Automatic reward transfer to player
- ✅ Pool balance updates after each flip

---

## Architecture

### Smart Contract Structure

#### 1. Data Variables
```clarity
;; Global pool balance (in micro-STX, 1 STX = 1,000,000 micro-STX)
(define-data-var pool-balance uint u0)

;; Minimum reward (1 micro-STX to ensure no zero rewards)
(define-constant MIN_REWARD u1)

;; Maximum reward percentage (50% = 500000 per million)
(define-constant MAX_REWARD_PERCENTAGE u500000)

;; Deposit amount (1 STX = 1,000,000 micro-STX)
(define-constant DEPOSIT_AMOUNT u1000000)
```

#### 2. Key Functions

**a. `flip` - Main participation function**
- Input: None (uses tx-sender's payment)
- Validates: Payment amount = 1 STX
- Actions:
  1. Add deposit to pool
  2. Generate random number
  3. Calculate reward (within bounds)
  4. Transfer reward to player
  5. Update pool balance
  6. Emit event

**b. `get-pool-balance` - View current pool**
- Returns: Current pool balance in micro-STX

**c. `calculate-reward` - Internal reward calculation**
- Input: Random number, current pool balance
- Output: Reward amount (MIN_REWARD to 50% of pool)

---

## Random Number Generation Strategy

### Option 1: Block Hash Based (Recommended)
```clarity
;; Use block hash + tx sender + nonce for randomness
(begin
  (let ((random-seed (hash160 (concat (block-hash? (at-block 'block-height)) (tx-sender)))))
    ;; Extract random value from hash
  )
)
```

### Option 2: Block Height + Transaction Index
```clarity
;; Combine block height and transaction index
(let ((random-value (mod (+ (block-height) (tx-index)) u1000000)))
  ;; Use modulo to get random number
)
```

### Option 3: VRF (Verifiable Random Function) - Future Enhancement
- Requires oracle integration
- More secure but adds complexity

**Recommendation**: Start with Option 1 (block hash based) for MVP.

---

## Reward Calculation Logic

### Algorithm
1. Generate random number `r` (0 to 1,000,000)
2. Calculate reward percentage: `reward_pct = (r * MAX_REWARD_PERCENTAGE) / 1,000,000`
3. Calculate reward: `reward = (pool_balance * reward_pct) / 1,000,000`
4. Ensure minimum: `reward = max(reward, MIN_REWARD)`
5. Ensure maximum: `reward = min(reward, pool_balance / 2)`
6. Ensure player doesn't get more than pool: `reward = min(reward, pool_balance)`

### Example Scenarios

**Scenario 1: Small Pool (2 STX = 2,000,000 micro-STX)**
- Random: 800,000 → 40% → 800,000 micro-STX (40% of pool)
- Player receives: 0.8 STX
- Pool after: 1,200,000 micro-STX

**Scenario 2: Large Pool (100 STX = 100,000,000 micro-STX)**
- Random: 900,000 → 45% → 45,000,000 micro-STX
- Player receives: 45 STX
- Pool after: 56,000,000 micro-STX

**Scenario 3: Edge Case - Very Small Pool (1.1 STX)**
- Random: 999,999 → 49.99% → 549,945 micro-STX
- Player receives: 0.549945 STX
- Pool after: 550,055 micro-STX

---

## Smart Contract Implementation Details

### Function: `flip`
```clarity
(define-public (flip)
  (let (
    ;; Validate payment
    (payment (unwrap! (stx-get-balance tx-sender) (err u1)))
    (deposit-amount DEPOSIT_AMOUNT)
  )
    (asserts! (is-eq payment deposit-amount) (err u2))
    
    ;; Add deposit to pool
    (var-set pool-balance (+ (var-get pool-balance) deposit-amount))
    
    ;; Generate random number
    (let ((random-value (generate-random)))
      ;; Calculate reward
      (let ((reward (calculate-reward random-value (var-get pool-balance))))
        ;; Ensure we have enough in pool
        (asserts! (<= reward (var-get pool-balance)) (err u3))
        
        ;; Update pool
        (var-set pool-balance (- (var-get pool-balance) reward))
        
        ;; Transfer reward
        (unwrap! (stx-transfer? reward tx-sender) (err u4))
        
        ;; Emit event
        (ok (print (tuple (player tx-sender) (reward reward) (pool-after (var-get pool-balance)))))
      )
    )
  )
)
```

### Function: `calculate-reward`
```clarity
(define-private (calculate-reward (random-value uint) (pool-balance uint))
  (let (
    ;; Calculate reward percentage (0 to MAX_REWARD_PERCENTAGE)
    (reward-percentage (/ (* random-value MAX_REWARD_PERCENTAGE) u1000000))
    
    ;; Calculate base reward
    (base-reward (/ (* pool-balance reward-percentage) u1000000))
    
    ;; Apply minimum
    (reward-with-min (if (< base-reward MIN_REWARD) MIN_REWARD base-reward))
    
    ;; Apply maximum (50% of pool)
    (max-allowed (/ pool-balance u2))
    (reward-with-max (if (> reward-with-min max-allowed) max-allowed reward-with-min))
    
    ;; Ensure we don't exceed pool
    (final-reward (if (> reward-with-max pool-balance) pool-balance reward-with-max))
  )
    final-reward
  )
)
```

### Function: `generate-random`
```clarity
(define-private (generate-random)
  (let (
    (block-hash (unwrap! (block-hash? (block-height)) (err u5)))
    (sender-hash (hash160 tx-sender))
    (combined (hash160 (concat block-hash sender-hash)))
  )
    ;; Extract uint from hash (use first 6 bytes for 0-999,999 range)
    (mod (to-uint combined) u1000000)
  )
)
```

---

## Security Considerations

### 1. Reentrancy Protection
- Clarity's design prevents reentrancy (no external calls during execution)
- Still validate all state changes before transfers

### 2. Integer Overflow/Underflow
- Use Clarity's built-in overflow protection
- Validate calculations don't exceed uint limits

### 3. Random Number Manipulation
- Block hash is not manipulable by users
- Consider adding additional entropy sources
- Document that randomness is pseudo-random, not cryptographically secure

### 4. Pool Balance Validation
- Always check pool has sufficient balance before transfer
- Handle edge cases (pool < MIN_REWARD)

### 5. Payment Validation
- Strictly enforce 1 STX deposit
- Reject any other amount

### 6. Access Control
- No admin functions needed (fully decentralized)
- Consider adding emergency pause (optional)

---

## Error Codes
```clarity
(define-constant ERR_INVALID_PAYMENT u1)
(define-constant ERR_WRONG_AMOUNT u2)
(define-constant ERR_INSUFFICIENT_POOL u3)
(define-constant ERR_TRANSFER_FAILED u4)
(define-constant ERR_BLOCK_HASH_FAILED u5)
```

---

## Events

### Event: `flip-completed`
```clarity
(define-event flip-completed
  (player principal)
  (deposit uint)
  (reward uint)
  (pool-before uint)
  (pool-after uint)
  (block-height uint)
)
```

---

## Testing Strategy

### Unit Tests
1. **Reward Calculation Tests**
   - Test minimum reward enforcement
   - Test maximum reward (50% cap)
   - Test various random values
   - Test edge cases (very small pool, very large pool)

2. **Pool Management Tests**
   - Test pool balance updates correctly
   - Test deposit addition
   - Test reward deduction

3. **Payment Validation Tests**
   - Test correct 1 STX payment
   - Test rejection of wrong amounts
   - Test rejection of zero payment

4. **Random Generation Tests**
   - Test randomness distribution (statistical)
   - Test no zero rewards
   - Test reward range compliance

### Integration Tests
1. End-to-end flip flow
2. Multiple consecutive flips
3. Pool growth over time
4. Edge case: First flip (empty pool → 1 STX deposit)

### Security Tests
1. Attempt to manipulate random number
2. Attempt to deposit wrong amount
3. Attempt to drain pool
4. Test with maximum pool size

---

## Deployment Considerations

### 1. Network Selection
- **Testnet**: Deploy to Stacks testnet first
- **Mainnet**: Deploy after thorough testing

### 2. Initial Pool State
- Pool starts at 0
- First player deposits 1 STX, receives reward from that 1 STX

### 3. Contract Parameters
- Consider making MIN_REWARD and MAX_REWARD_PERCENTAGE configurable
- Or keep fixed for simplicity (recommended for MVP)

### 4. Upgrade Path
- Clarity contracts are immutable (cannot be upgraded)
- Plan carefully before mainnet deployment
- Consider proxy pattern if upgrades needed (adds complexity)

---

## File Structure

```
stacks-flip/
├── contracts/
│   └── flip-market.clar          # Main smart contract
├── tests/
│   └── flip-market_test.ts       # Test suite
├── scripts/
│   ├── deploy.ts                 # Deployment script
│   └── interact.ts               # Interaction examples
├── clarinet.toml                 # Clarinet configuration
├── .env.example                  # Environment variables
└── README.md                     # Project documentation
```

---

## Implementation Phases

### Phase 1: Core Contract (MVP)
- [ ] Basic contract structure
- [ ] Pool balance management
- [ ] Payment validation
- [ ] Random number generation
- [ ] Reward calculation
- [ ] Transfer mechanism

### Phase 2: Testing & Security
- [ ] Unit tests
- [ ] Integration tests
- [ ] Security audit
- [ ] Edge case handling

### Phase 3: Deployment
- [ ] Testnet deployment
- [ ] Testnet testing
- [ ] Mainnet deployment (if approved)

### Phase 4: Enhancements (Future)
- [ ] VRF integration for better randomness
- [ ] Analytics/statistics tracking
- [ ] Multi-token support
- [ ] Governance features

---

## Technical Challenges & Solutions

### Challenge 1: True Randomness
**Problem**: Blockchain randomness is deterministic
**Solution**: Use block hash + transaction data for pseudo-randomness
**Trade-off**: Not cryptographically secure, but sufficient for game

### Challenge 2: Pool Edge Cases
**Problem**: What if pool < MIN_REWARD?
**Solution**: Ensure first deposit creates pool >= MIN_REWARD, or adjust MIN_REWARD dynamically

### Challenge 3: Gas Costs
**Problem**: Each flip costs gas
**Solution**: Optimize contract, batch operations not possible in Clarity

### Challenge 4: Front-running
**Problem**: Miners could front-run transactions
**Solution**: Randomness based on block hash (not predictable before block)

---

## Success Metrics

1. **Functionality**
   - ✅ All flips execute successfully
   - ✅ Rewards always > 0
   - ✅ Rewards never exceed 50% of pool
   - ✅ Pool balance updates correctly

2. **Security**
   - ✅ No exploits found
   - ✅ All edge cases handled
   - ✅ Payment validation works

3. **User Experience**
   - ✅ Simple one-function interface
   - ✅ Fast execution
   - ✅ Clear events for tracking

---

## Next Steps

1. Set up Clarinet development environment
2. Create contract file structure
3. Implement core `flip` function
4. Implement helper functions (random, reward calculation)
5. Write comprehensive tests
6. Deploy to testnet
7. Test with real transactions
8. Security review
9. Mainnet deployment (if ready)

---

## Notes

- Clarity doesn't support floating point, all calculations in micro-STX
- Clarity is decidable (no loops, limited recursion) - design accordingly
- Consider adding a small fee for contract maintenance (optional)
- Document that this is a game, not an investment product
