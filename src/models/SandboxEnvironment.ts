import path from "path";
import {
  DockerComposeEnvironment,
  StartedDockerComposeEnvironment,
  StartedTestContainer,
  GenericContainer,
  Wait,
  Network,
  TestContainers,
  StartedNetwork,
} from "testcontainers";

import {
  Algodv2,
  Kmd,
  secretKeyToMnemonic,
  mnemonicToSecretKey,
  Account,
  generateAccount,
  Indexer,
} from "algosdk";

import {
  KmdWallet
} from "../types";

const algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";


export default class SandboxEnvironment {
  algodContainer: StartedTestContainer | any | null = null;
  indexerContainer: StartedTestContainer | any | null = null;
  indexerdbContainer: StartedTestContainer | any | null = null;
  algodClient: Algodv2 = new Algodv2("", "http://localhost");
  indexerClient: Indexer = new Indexer("", "http://localhost");
  indexNetwork: StartedNetwork | null = null;
  account: Account = generateAccount();

  constructor () {
  }

  async up({indexer = false }: {indexer?: Boolean}={}) {
    let algodServer = null
    if(indexer)
    {
      this.indexNetwork = await new Network().start();
      this.algodContainer = await new GenericContainer("makerxau/algorand-sandbox-dev")
      .withNetworkAliases('algod')
      .withNetworkMode(this.indexNetwork.getName())
      .withExposedPorts(4001, 4002)
      .withWaitStrategy(Wait.forLogMessage("http server started on [::]:4001"))
      .start();

      algodServer = `http://${this.algodContainer.getHost()}`;

      this.indexerdbContainer = await new GenericContainer("postgres:13-alpine")
        .withNetworkAliases('indexer-db')
        .withNetworkMode(this.indexNetwork.getName())
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections"))
        .withUser('postgres')
        .withEnv("POSTGRES_USER", "algorand")
        .withEnv("POSTGRES_PASSWORD", "algorand")
        .withEnv("POSTGRES_DB", "indexer_db")
        .start()
      
      
      this.indexerContainer = await new GenericContainer("makerxau/algorand-indexer-dev")
        .withNetworkMode(this.indexNetwork.getName())
        .withExposedPorts(8980)
        .withEnv("ALGOD_HOST", "algod")
        .withEnv("POSTGRES_HOST", "indexer-db")
        .withEnv("POSTGRES_USER", "algorand")
        .withEnv("POSTGRES_PASSWORD", "algorand")
        .withEnv("POSTGRES_DB", "indexer_db")
        .withEnv("POSTGRES_PORT", String(5432))
        .withWaitStrategy(Wait.forLogMessage("http server started on [::]:8980"))
        .start();

        this.indexerClient = new Indexer(
          algodToken,
          algodServer,
          this.indexerContainer.getMappedPort(8980)
        );
    }
    else
    {
      this.algodContainer = await new GenericContainer("makerxau/algorand-sandbox-dev")
        .withNetworkAliases('algod')
        .withExposedPorts(4001, 4002)
        .withWaitStrategy(Wait.forLogMessage("http server started on [::]:4001"))
        .start();
      algodServer = `http://${this.algodContainer.getHost()}`;
    }

    this.algodClient = new Algodv2(
      algodToken,
      algodServer,
      this.algodContainer.getMappedPort(4001)
    );

    process.env.ALGOD_TOKEN = algodToken;
    process.env.ALGOD_AUTH_HEADER = "X-Algo-API-Token";
    process.env.ALGOD_SERVER = algodServer;
    process.env.ALGOD_PORT = String(this.algodContainer.getMappedPort(4001));

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
    if(this.algodContainer)
    {
      await this.algodContainer?.stop()
    }
    if(this.indexerdbContainer)
    {
      await this.indexerdbContainer?.stop()
    }
    if(this.indexerContainer)
    {
      await this.indexerContainer?.stop()
    }
  }
}