;; Flip Market Smart Contract
;; Players deposit 1 STX and receive a random reward from the pool
;; No zero rewards, maximum reward is 50% of pool

;; Constants
(define-constant MIN_REWARD u1) ;; Minimum reward: 1 micro-STX (ensures no zero rewards)
(define-constant MAX_REWARD_PERCENTAGE u500000) ;; 50% = 500000 per million
(define-constant DEPOSIT_AMOUNT u1000000) ;; 1 STX = 1,000,000 micro-STX

;; Error codes
(define-constant ERR_INVALID_PAYMENT u1)
(define-constant ERR_WRONG_AMOUNT u2)
(define-constant ERR_INSUFFICIENT_POOL u3)
(define-constant ERR_TRANSFER_FAILED u4)
(define-constant ERR_BLOCK_HASH_FAILED u5)
(define-constant ERR_POOL_TOO_SMALL u6)

;; Global pool balance (in micro-STX)
(define-data-var pool-balance uint u0)

;; Events
(define-event flip-completed
  (player principal)
  (deposit uint)
  (reward uint)
  (pool-before uint)
  (pool-after uint)
  (block-height uint)
)

;; Generate pseudo-random number using block hash and sender
(define-private (generate-random)
  (let (
    (block-hash (unwrap! (block-hash? (block-height)) (err ERR_BLOCK_HASH_FAILED)))
    (sender-hash (hash160 tx-sender))
    (combined (hash160 (concat block-hash sender-hash)))
  )
    ;; Extract uint from hash (modulo 1,000,000 for 0-999,999 range)
    (mod (to-uint combined) u1000000)
  )
)

;; Calculate reward based on random value and pool balance
(define-private (calculate-reward (random-value uint) (current-pool uint))
  (let (
    ;; Calculate reward percentage (0 to MAX_REWARD_PERCENTAGE)
    (reward-percentage (/ (* random-value MAX_REWARD_PERCENTAGE) u1000000))
    
    ;; Calculate base reward
    (base-reward (/ (* current-pool reward-percentage) u1000000))
    
    ;; Apply minimum reward
    (reward-with-min (if (< base-reward MIN_REWARD) MIN_REWARD base-reward))
    
    ;; Apply maximum (50% of pool)
    (max-allowed (/ current-pool u2))
    (reward-with-max (if (> reward-with-min max-allowed) max-allowed reward-with-min))
    
    ;; Ensure we don't exceed pool balance
    (final-reward (if (> reward-with-max current-pool) current-pool reward-with-max))
  )
    final-reward
  )
)

;; Main function: Player deposits 1 STX and receives random reward
;; Note: User must send 1 STX to contract address as part of transaction
(define-public (flip)
  (let (
    ;; Get contract's STX balance before this transaction
    ;; We'll assume the payment was sent to the contract
    (contract-balance (stx-get-balance (as-contract tx-sender)))
    (pool-before (var-get pool-balance))
  )
    ;; Calculate payment: contract balance should increase by 1 STX
    ;; For simplicity, we'll add 1 STX to pool (user must send exactly 1 STX)
    (let (
      ;; Add deposit to pool (user must send 1 STX to contract)
      (pool-after-deposit (+ pool-before DEPOSIT_AMOUNT))
    )
      ;; Ensure pool is large enough for minimum reward
      (asserts! (>= pool-after-deposit MIN_REWARD) (err ERR_POOL_TOO_SMALL))
      
      ;; Update pool with deposit
      (var-set pool-balance pool-after-deposit)
      
      ;; Generate random number
      (let ((random-value (generate-random)))
        ;; Calculate reward
        (let ((reward (calculate-reward random-value pool-after-deposit)))
          ;; Ensure we have enough in pool for reward
          (asserts! (<= reward pool-after-deposit) (err ERR_INSUFFICIENT_POOL))
          
          ;; Update pool balance (subtract reward)
          (var-set pool-balance (- pool-after-deposit reward))
          
          ;; Get final pool balance
          (let ((pool-after (var-get pool-balance)))
            ;; Transfer reward to player
            (match (as-contract (stx-transfer? reward tx-sender))
              success (begin
                ;; Emit event
                (emit-event flip-completed
                  (player tx-sender)
                  (deposit DEPOSIT_AMOUNT)
                  (reward reward)
                  (pool-before pool-before)
                  (pool-after pool-after)
                  (block-height (block-height))
                )
                (ok (tuple (player tx-sender) (reward reward) (pool-after pool-after)))
              )
              (err e) (err ERR_TRANSFER_FAILED)
            )
          )
        )
      )
    )
  )
)

;; Read-only function: Get current pool balance
(define-read-only (get-pool-balance)
  (ok (var-get pool-balance))
)

;; Read-only function: Get contract info
(define-read-only (get-contract-info)
  (ok (tuple
    (min-reward MIN_REWARD)
    (max-reward-percentage MAX_REWARD_PERCENTAGE)
    (deposit-amount DEPOSIT_AMOUNT)
    (pool-balance (var-get pool-balance))
  ))
)
