import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';

Clarinet.test({
  name: "Test initial pool balance is zero",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Check initial pool balance
    let call = chain.callReadOnlyFn(
      'flip-market',
      'get-pool-balance',
      [],
      wallet1.address
    );
    call.result.expectOk().expectUint(0);
  }
});

Clarinet.test({
  name: "Test flip with correct 1 STX payment",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Get initial pool balance
    let initialPool = chain.callReadOnlyFn(
      'flip-market',
      'get-pool-balance',
      [],
      wallet1.address
    );
    initialPool.result.expectOk().expectUint(0);

    // Perform flip with 1 STX
    let block = chain.mineBlock([
      Tx.contractCall(
        'flip-market',
        'flip',
        [],
        wallet1.address
      ).stxTransfer(1_000_000, wallet1.address) // 1 STX in micro-STX
    ]);

    // Check transaction succeeded
    block.receipts[0].result.expectOk();

    // Check pool balance increased (deposit added, reward subtracted)
    let finalPool = chain.callReadOnlyFn(
      'flip-market',
      'get-pool-balance',
      [],
      wallet1.address
    );
    let poolValue = finalPool.result.expectOk();
    
    // Pool should be > 0 and < 1,000,000 (since reward was given)
    poolValue.expectUint().should.be.greaterThan(0);
    poolValue.expectUint().should.be.lessThan(1_000_000);
  }
});

Clarinet.test({
  name: "Test flip rejects wrong payment amount",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Try with 0.5 STX (should fail)
    let block = chain.mineBlock([
      Tx.contractCall(
        'flip-market',
        'flip',
        [],
        wallet1.address
      ).stxTransfer(500_000, wallet1.address) // 0.5 STX
    ]);

    block.receipts[0].result.expectErr(2); // ERR_WRONG_AMOUNT

    // Try with 2 STX (should fail)
    block = chain.mineBlock([
      Tx.contractCall(
        'flip-market',
        'flip',
        [],
        wallet1.address
      ).stxTransfer(2_000_000, wallet1.address) // 2 STX
    ]);

    block.receipts[0].result.expectErr(2); // ERR_WRONG_AMOUNT
  }
});

Clarinet.test({
  name: "Test reward is always greater than zero",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Perform multiple flips
    for (let i = 0; i < 10; i++) {
      let block = chain.mineBlock([
        Tx.contractCall(
          'flip-market',
          'flip',
          [],
          wallet1.address
        ).stxTransfer(1_000_000, wallet1.address)
      ]);

      let result = block.receipts[0].result.expectOk();
      let reward = result.expectTuple()['reward'].expectUint();
      
      // Reward should always be > 0
      reward.should.be.greaterThan(0);
    }
  }
});

Clarinet.test({
  name: "Test reward never exceeds 50% of pool",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Build up pool with multiple deposits
    for (let i = 0; i < 5; i++) {
      let block = chain.mineBlock([
        Tx.contractCall(
          'flip-market',
          'flip',
          [],
          wallet1.address
        ).stxTransfer(1_000_000, wallet1.address)
      ]);

      let result = block.receipts[0].result.expectOk();
      let poolAfter = result.expectTuple()['pool-after'].expectUint();
      let reward = result.expectTuple()['reward'].expectUint();
      
      // Get pool before this flip
      let poolBefore = chain.callReadOnlyFn(
        'flip-market',
        'get-pool-balance',
        [],
        wallet1.address
      );
      let currentPool = poolBefore.result.expectOk().expectUint();
      
      // Calculate max allowed (50% of pool before reward)
      let poolBeforeReward = currentPool + reward; // Pool after deposit, before reward
      let maxAllowed = poolBeforeReward / 2;
      
      // Reward should not exceed 50% of pool
      reward.should.be.lessThanOrEqual(maxAllowed);
    }
  }
});

Clarinet.test({
  name: "Test get-contract-info returns correct values",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let call = chain.callReadOnlyFn(
      'flip-market',
      'get-contract-info',
      [],
      wallet1.address
    );

    let info = call.result.expectOk().expectTuple();
    info['min-reward'].expectUint(1);
    info['max-reward-percentage'].expectUint(500000);
    info['deposit-amount'].expectUint(1_000_000);
    info['pool-balance'].expectUint(0);
  }
});

Clarinet.test({
  name: "Test multiple players can flip",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    const wallet3 = accounts.get('wallet_3')!;

    // Each player flips once
    let block = chain.mineBlock([
      Tx.contractCall(
        'flip-market',
        'flip',
        [],
        wallet1.address
      ).stxTransfer(1_000_000, wallet1.address),
      Tx.contractCall(
        'flip-market',
        'flip',
        [],
        wallet2.address
      ).stxTransfer(1_000_000, wallet2.address),
      Tx.contractCall(
        'flip-market',
        'flip',
        [],
        wallet3.address
      ).stxTransfer(1_000_000, wallet3.address)
    ]);

    // All should succeed
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();
    block.receipts[2].result.expectOk();

    // Pool should have some balance
    let pool = chain.callReadOnlyFn(
      'flip-market',
      'get-pool-balance',
      [],
      wallet1.address
    );
    let poolValue = pool.result.expectOk().expectUint();
    poolValue.should.be.greaterThan(0);
  }
});
