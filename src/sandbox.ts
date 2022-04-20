import {
  mnemonicToSecretKey,
  Account
} from "algosdk";
import {
  pay
} from "algoutils";

export function sandboxAccount(): Account {
  const sandboxMnemonic = process.env["SANDBOX_MNEMONIC"];
  if (sandboxMnemonic) {
    return mnemonicToSecretKey(sandboxMnemonic);
  } else {
    throw new Error("SANDBOX_MNEMONIC not set in environment");
  }
}

export async function fundAccount(address: string, amount: number) {
  return pay(sandboxAccount(), address, amount);
}

export async function fundAccounts(accounts: Account[], amount: number) {
  for (const account of accounts) {
    await fundAccount(account.addr, amount);
  }
}