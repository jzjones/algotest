import path from "path";
import {
  DockerComposeEnvironment,
  StartedDockerComposeEnvironment,
  StartedTestContainer,
  Wait
} from "testcontainers";
import {
  Algodv2,
  Kmd,
  secretKeyToMnemonic,
  mnemonicToSecretKey,
  Account,
  generateAccount
} from "algosdk";

import {
  KmdWallet
} from "../types";

const algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export default class SandboxEnvironment {
  algodContainer: StartedTestContainer | null = null;
  environment: StartedDockerComposeEnvironment | null = null;
  algodClient: Algodv2 = new Algodv2("", "http://localhost");
  account: Account = generateAccount();
  private _environment: DockerComposeEnvironment;

  constructor () {
    this._environment = new DockerComposeEnvironment(path.resolve(__dirname, "../../docker"), "docker-compose.yaml")
      .withWaitStrategy("algod_1", Wait.forLogMessage("http server started on [::]:4001"));
  }

  async up() {
    this.environment = await this._environment.up();
    this.algodContainer = this.environment.getContainer("algod_1");

    const algodServer = `http://${this.algodContainer.getHost()}`;
    this.algodClient = new Algodv2(
      algodToken,
      algodServer,
      this.algodContainer.getMappedPort(4001)
    );

    process.env.ALGOD_TOKEN = algodToken;
    process.env.ALGOD_AUTH_HEADER = "X-Algo-API-Token";
    process.env.ALGOD_SERVER = algodServer;
    process.env.ALGOD_PORT = (4001).toString();

    await this.setSandboxAccount();
  }

  private async setSandboxAccount() {
    if (this.algodContainer) {
      const algodServer = `http://${this.algodContainer.getHost()}`;

      const kmdClient = new Kmd(
        algodToken,
        algodServer,
        this.algodContainer.getMappedPort(4002)
      );

      const wallets = await kmdClient.listWallets();
    
      const defaultWalletId = wallets.wallets.filter((w: KmdWallet) => w.name === "unencrypted-default-wallet")[0].id

      const defaultWalletHandle = (await kmdClient.initWalletHandle(defaultWalletId, "")).wallet_handle_token
      const defaultKeyIds = (await kmdClient.listKeys(defaultWalletHandle)).addresses

      // When you create accounts using goal they get added to this wallet so check for an account that's actually a default account
      let i = 0;
      for (i = 0; i < defaultKeyIds.length; i++) {
        const key = defaultKeyIds[i]
        const account = await this.algodClient.accountInformation(key).do()
        if (account.status !== "Offline" && account.amount > 1000_000_000) {
          break
        }
      }

      const defaultAccountKey = (await kmdClient.exportKey(defaultWalletHandle, "", defaultKeyIds[i])).private_key

      const defaultAccountMnemonic = secretKeyToMnemonic(defaultAccountKey)
      process.env.SANDBOX_MNEMONIC = defaultAccountMnemonic;
      this.account = mnemonicToSecretKey(defaultAccountMnemonic)
    } else {
      throw new Error("Algod container not started properly");
    }
  }

  async down() {
    await this.environment?.down();
  }
}