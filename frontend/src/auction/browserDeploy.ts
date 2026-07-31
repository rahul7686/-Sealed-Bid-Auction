import { OneAMWalletAdapter, buildOneAMProviders, deployContract } from "midnight-wallet-kit";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { Contract } from "../generated/sealed-bid-auction/contract/index.js";

const DEFAULT_CONTRACT_NAME = "SealedBidAuction";

export type BrowserDeployResult = {
  contractAddress: string;
};

export async function connectPreview1AM(): Promise<OneAMWalletAdapter> {
  setNetworkId("preview");
  const adapter = new OneAMWalletAdapter({ network: "preview" });
  await adapter.connect();
  return adapter;
}

export async function deployPreviewContract(
  adapter: OneAMWalletAdapter,
  contractName = DEFAULT_CONTRACT_NAME,
  itemDescription = "Sealed-bid item"
): Promise<BrowserDeployResult> {
  setNetworkId("preview");
  const ZK_ASSET_PATH = "/zk/sealed-bid-auction/";

  const providers = await buildOneAMProviders(adapter, {
    contractName,
    zkConfigBaseUrl: new URL(ZK_ASSET_PATH, window.location.origin).toString()
  });

  // Create an initial private state for the auctioneer deployer
  const initialPrivateState = {
    secretKey: new Uint8Array(32).fill(1),
    bidAmount: 0n,
    bidSalt: new Uint8Array(32).fill(2)
  };

  // The SealedBidAuction contract constructor calls localSecretKey to derive
  // the auctioneer identity, so we must provide real witness functions
  // (withVacantWitnesses won't work here).
  const witnesses = {
    localSecretKey: (ctx: any) => [ctx.privateState, initialPrivateState.secretKey],
    localBidAmount: (ctx: any) => [ctx.privateState, initialPrivateState.bidAmount],
    localBidSalt: (ctx: any) => [ctx.privateState, initialPrivateState.bidSalt],
  };

  const compiledContract = (CompiledContract.make(contractName, Contract) as any).pipe(
    (cc: any) => (CompiledContract as any).withWitnesses(witnesses)(cc),
    (CompiledContract as any).withCompiledFileAssets(ZK_ASSET_PATH)
  );

  const deployed = await deployContract(providers, {
    compiledContract,
    args: [itemDescription],
    privateStateId: `${DEFAULT_CONTRACT_NAME}PrivateState`,
    initialPrivateState
  } as any);

  return { contractAddress: deployed.contractAddress };
}
