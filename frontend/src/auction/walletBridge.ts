export type MidnightWalletLike = {
  name?: string;
  signData?: (data: string) => Promise<unknown>;
  submitTransaction?: (tx: string) => Promise<void>;
  balanceUnsealedTransaction?: (tx: string, options?: unknown) => Promise<{ tx: string }>;
  balanceSealedTransaction?: (tx: string, options?: unknown) => Promise<{ tx: string }>;
  makeTransfer?: (desiredOutputs: unknown[], options?: unknown) => Promise<{ tx: string }>;
  makeIntent?: (desiredInputs: unknown[], desiredOutputs: unknown[], options?: unknown) => Promise<{ tx: string }>;
};

export type WalletManagerLike = {
  connectWithFallback?: (wallets: string[]) => Promise<void>;
  connect?: (wallet: string) => Promise<void>;
  disconnect?: () => Promise<void> | void;
  getActiveWallet?: () => MidnightWalletLike | null;
};

export async function connect1AM(manager: WalletManagerLike): Promise<MidnightWalletLike> {
  if (manager.connectWithFallback) {
    await manager.connectWithFallback(["1AM"]);
  } else if (manager.connect) {
    await manager.connect("1AM");
  } else {
    throw new Error("Wallet manager does not expose a connect method");
  }

  const active = manager.getActiveWallet?.();
  if (!active) {
    throw new Error("1AM wallet connection did not return an active wallet");
  }
  return active;
}

export async function submitWalletAction(
  wallet: MidnightWalletLike,
  action: string,
  payload: Record<string, unknown>
): Promise<string> {
  const txBody = JSON.stringify({
    action,
    payload,
    ts: new Date().toISOString()
  });

  if (wallet.balanceUnsealedTransaction && wallet.submitTransaction) {
    const balanced = await wallet.balanceUnsealedTransaction(txBody, { payFees: true });
    await wallet.submitTransaction(balanced.tx);
    return balanced.tx;
  }

  if (wallet.balanceSealedTransaction && wallet.submitTransaction) {
    const balanced = await wallet.balanceSealedTransaction(txBody, { payFees: true });
    await wallet.submitTransaction(balanced.tx);
    return balanced.tx;
  }

  if (wallet.makeTransfer && wallet.submitTransaction) {
    const built = await wallet.makeTransfer([], { payFees: true });
    await wallet.submitTransaction(built.tx);
    return built.tx;
  }

  if (wallet.signData) {
    await wallet.signData(txBody);
    return txBody;
  }

  throw new Error("Connected 1AM wallet does not expose transaction methods");
}
