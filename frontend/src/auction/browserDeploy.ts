import { OneAMWalletAdapter, buildOneAMProviders, deployContract } from "midnight-wallet-kit";
import { Contract } from "../generated/sealed-bid-auction/contract/index.js";

const DEFAULT_CONTRACT_NAME = "SealedBidAuction";

export type BrowserDeployResult = {
  contractAddress: string;
};

export async function connectPreview1AM(): Promise<OneAMWalletAdapter> {
  const adapter = new OneAMWalletAdapter({ network: "preview" });
  await adapter.connect();
  return adapter;
}

export async function deployPreviewContract(
  adapter: OneAMWalletAdapter,
  contractName = DEFAULT_CONTRACT_NAME
): Promise<BrowserDeployResult> {
  const providers = await buildOneAMProviders(adapter, {
    contractName
  });
  const deployed = await deployContract(providers, {
    compiledContract: Contract
  });
  return { contractAddress: deployed.contractAddress };
}
