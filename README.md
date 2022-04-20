# Utility library for Algorand smart contract testing

## Overview

The goal of this package is to accelerate testing Algorand smart contracts against a live sandbox network.

## Requirements

 - docker
 - docker-compose

## Install

 - `yarn add -D algotest`

## Sandbox Environment

 - Manage a sandbox environment in your test scripts by using the `SandboxEnvironment` class:

 ```typescript
beforeEach(async () => {
    await sandboxEnvironment.up();
    sandboxAccount = sandboxEnvironment.account;
    algodClient = sandboxEnvironment.algodClient;

    const contractParams = {
      "test_param": "test",
    }
    const approvalCode = await compilePyTeal(path.join(__dirname, "../assets/contract_approval.py"), contractParams);
    const clearCode = await compilePyTeal(path.join(__dirname, "../assets/contract_clear.py"));
    appId = await deployContract(approvalCode, clearCode, sandboxAccount, {
      numGlobalByteSlices: 0,
      numLocalInts: 0,
      numGlobalInts: 0,
      numLocalByteSlices: 0
    });
  });

  afterEach(async () => {
    await sandboxEnvironment.down();
  });
 ```

 Full example project [here]()