import SandboxEnvironment from "../src/models/SandboxEnvironment";
import { fundAccount } from "../src/sandbox";

describe('Container e2e', () => {
    
  it("should bring up test container", async () => {
    let env = new SandboxEnvironment();
    await env.up();
    await fundAccount(env.account.addr, 100000);
    let ai = await env.algodClient.accountInformation(env.account.addr).do();
    expect(ai.amount).toEqual(3999999999999000);
  });

  it("should bring up test container with indexer", async () => {
    let env = new SandboxEnvironment();
    await env.up({indexer: true});
    await fundAccount(env.account.addr, 100000);
    let health = await env.indexerClient.makeHealthCheck().do();
    await fundAccount(env.account.addr, 100000);

    health = await env.indexerClient.makeHealthCheck().do();
    expect(health.round).toEqual(1);
  });
});