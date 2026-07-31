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
  const providers = await buildOneAMProviders(adapter, {
    contractName
  });

  const compiledContract = (CompiledContract.make(contractName, Contract) as any).pipe(
    (CompiledContract as any).withVacantWitnesses
  );

  // Create an initial random private state (mocked since auctioneer doesn't bid during deploy)
  const initialPrivateState = {
    secretKey: new Uint8Array(32).fill(1),
    bidAmount: 0n,
    bidSalt: new Uint8Array(32).fill(2)
  };

  const deployed = await deployContract(providers, {
    compiledContract,
    args: [itemDescription],
    privateStateId: `${DEFAULT_CONTRACT_NAME}PrivateState`,
    initialPrivateState
  } as any);

  return { contractAddress: deployed.contractAddress };
}
