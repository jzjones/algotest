import {
  Kmd,
  secretKeyToMnemonic,
  mnemonicToSecretKey,
  Account,
} from "algosdk";
import {
  pay,
  algodClient
} from "algoutils";

import {
  KmdWallet
} from "./types";

export function sandboxAccount(): Account {
  const sandboxMnemonic = process.env["SANDBOX_MNEMONIC"];
  if (sandboxMnemonic) {
    return mnemonicToSecretKey(sandboxMnemonic);
  } else {
    throw new Error("SANDBOX_MNEMONIC not set in environment");
  }
}

export async function getDefaultAccount(algodServer: string, algodToken: string, kmdPort: string): Promise<Account> {
  const kmdClient = new Kmd(
    algodToken,
    algodServer,
    kmdPort
  );

  const wallets = await kmdClient.listWallets();

  const defaultWalletId = wallets.wallets.filter((w: KmdWallet) => w.name === "unencrypted-default-wallet")[0].id

  const defaultWalletHandle = (await kmdClient.initWalletHandle(defaultWalletId, "")).wallet_handle_token
  const defaultKeyIds = (await kmdClient.listKeys(defaultWalletHandle)).addresses

  // When you create accounts using goal they get added to this wallet so check for an account that's actually a default account
  let i = 0;
  for (i = 0; i < defaultKeyIds.length; i++) {
    const key = defaultKeyIds[i]
    const account = await algodClient().accountInformation(key).do()
    if (account.status !== "Offline" && account.amount > 1000_000_000) {
      break
    }
  }

  const defaultAccountKey = (await kmdClient.exportKey(defaultWalletHandle, "", defaultKeyIds[i])).private_key

  const defaultAccountMnemonic = secretKeyToMnemonic(defaultAccountKey)
  return mnemonicToSecretKey(defaultAccountMnemonic)
}

export async function fundAccount(address: string, amount: number) {
  return pay(sandboxAccount(), address, amount);
}

export async function fundAccounts(accounts: Account[], amount: number) {
  for (const account of accounts) {
    await fundAccount(account.addr, amount);
  }
}