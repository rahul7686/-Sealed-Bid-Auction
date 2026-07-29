import { useEffect, useMemo, useState } from "react";
import { LocalAuctionClient } from "./auction/localClient";
import { connectPreview1AM, deployPreviewContract, type BrowserDeployResult } from "./auction/browserDeploy";
import { AuctionClient, AuctionPublicState, Phase, phaseLabel } from "./auction/types";
import { connect1AM, submitWalletAction, type MidnightWalletLike, type WalletManagerLike } from "./auction/walletBridge";

const AUCTIONEER = "auctioneer";
const HISTORY_STORAGE_KEY = "midnight-auction-history";
const PREVIEW_CONTRACT_ID = import.meta.env.VITE_PREVIEW_CONTRACT_ID ?? "";
const formatShort = (hex: string) => (hex ? `${hex.slice(0, 10)}...` : "-");

type HistoryEntry = {
  id: string;
  timestamp: string;
  message: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DeployPage() {
  const [status, setStatus] = useState("Connect 1AM on preview to deploy.");
  const [error, setError] = useState("");
  const [walletStatus, setWalletStatus] = useState("Disconnected");
  const [walletDetail, setWalletDetail] = useState("No preview wallet connected");
  const [contractName, setContractName] = useState("SealedBidAuction");
  const [deployed, setDeployed] = useState<BrowserDeployResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [adapter, setAdapter] = useState<Awaited<ReturnType<typeof connectPreview1AM>> | null>(null);

  const connectWallet = async () => {
    setError("");
    setBusy(true);
    try {
      const active = await connectPreview1AM();
      setAdapter(active);
      setWalletStatus("1AM connected");
      setWalletDetail("Preview network ready");
      setStatus("Connected to 1AM on preview.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setWalletStatus("Connection failed");
      setWalletDetail("Unable to connect to 1AM");
    } finally {
      setBusy(false);
    }
  };

  const deploy = async () => {
    if (!adapter) {
      setError("Connect 1AM first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await deployPreviewContract(adapter, contractName.trim() || "SealedBidAuction");
      setDeployed(result);
      setStatus("Contract deployed through 1AM preview.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero card">
        <div>
          <p className="eyebrow">Preview deploy</p>
          <h1>Deploy from the browser.</h1>
          <p className="lede">
            Connect 1AM on Midnight preview, deploy directly from the wallet extension, and show the
            deployed contract address immediately.
          </p>
        </div>
        <div className="hero-grid">
          <Stat label="Network" value="preview" />
          <Stat label="Wallet" value={walletStatus} />
          <Stat label="Status" value={status} />
          <Stat label="Contract" value={deployed ? formatShort(deployed.contractAddress) : "not deployed"} />
        </div>
        <div className="winner">
          <strong>Wallet state:</strong> {walletDetail}
          {deployed ? (
            <>
              <br />
              <span className="mono">Contract address: {deployed.contractAddress}</span>
            </>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">1AM</p>
            <h2>Connect preview wallet</h2>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Contract name
            <input value={contractName} onChange={(event) => setContractName(event.target.value)} />
          </label>
        </div>

        <div className="button-row">
          <button disabled={busy} onClick={() => void connectWallet()}>
            Connect 1AM
          </button>
          <button className="ghost" disabled={busy || !adapter} onClick={() => void deploy()}>
            Deploy contract
          </button>
        </div>

        <p className="muted">
          This path uses the browser wallet extension and 1AM&apos;s provider flow. No server-side
          deployer wallet or local proof server is required in the main flow.
        </p>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Result</p>
            <h2>Deployed contract address</h2>
          </div>
        </div>

        {deployed ? (
          <div className="winner mono">{deployed.contractAddress}</div>
        ) : (
          <p className="muted">No contract deployed yet.</p>
        )}

        {error ? <div className="message error">Error: {error}</div> : null}
      </section>
    </main>
  );
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const isDeployPage = pathname === "/deploy";
  if (isDeployPage) {
    return <DeployPage />;
  }

  const client = useMemo<AuctionClient>(() => new LocalAuctionClient(), []);
  const [state, setState] = useState<AuctionPublicState | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [walletStatus, setWalletStatus] = useState("Disconnected");
  const [walletDetail, setWalletDetail] = useState("No wallet connected");
  const [walletError, setWalletError] = useState("");
  const [item, setItem] = useState("Rare painting: Midnight over Nassau");
  const [bidder, setBidder] = useState("alice");
  const [amount, setAmount] = useState("100");
  const [walletReady, setWalletReady] = useState(false);
  const [walletManager, setWalletManager] = useState<WalletManagerLike | null>(null);
  const [wallet, setWallet] = useState<MidnightWalletLike | null>(null);

  const refresh = () => setState({ ...client.getState() });

  const pushHistory = (message: string) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toLocaleTimeString(),
      message
    };
    setHistory((current) => [entry, ...current].slice(0, 12));
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as HistoryEntry[];
      if (Array.isArray(parsed)) {
        setHistory(
          parsed
            .filter(
              (entry): entry is HistoryEntry =>
                typeof entry?.id === "string" &&
                typeof entry?.timestamp === "string" &&
                typeof entry?.message === "string"
            )
            .slice(0, 12)
        );
      }
    } catch {
      // Ignore malformed local history and start fresh.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const run = async (message: string, action: () => Promise<void>) => {
    setError("");
    try {
      await action();
      setStatus(message);
      pushHistory(message);
      refresh();
    } catch (cause) {
      const messageText = cause instanceof Error ? cause.message : String(cause);
      setError(messageText);
      pushHistory(`error: ${messageText}`);
    }
  };

  useEffect(() => {
    void run("Fresh auction deployed.", () => client.deploy(item, AUCTIONEER));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const kit = await import("midnight-wallet-kit");
        if (!mounted) return;
        const manager = kit.createMidnightWalletManager({
          network: "preview",
          only: ["1AM"]
        }) as unknown as WalletManagerLike;
        setWalletManager(manager);
        setWalletReady(true);
        setWalletStatus("Ready to connect wallet");
        setWalletDetail("Wallet manager loaded");
        setWalletError("");
        pushHistory("wallet manager loaded");
      } catch {
        if (!mounted) return;
        setWalletReady(false);
        setWalletStatus("midnight-wallet-kit not installed");
        setWalletError("Wallet kit import failed");
        pushHistory("wallet kit import failed");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!state) {
    return <div className="shell">Loading auction state...</div>;
  }

  const canBid = state.phase === Phase.Bidding && bidder.length > 0 && amount.length > 0;
  const canReveal = state.phase === Phase.Reveal && bidder.length > 0;

  const connectWallet = async () => {
    if (!walletManager) {
      throw new Error("Wallet kit is not available in this build.");
    }
    try {
      const active = await connect1AM(walletManager);
      setWallet(active);
      setWalletStatus(active.name ? `${active.name} connected` : "Wallet connected");
      setWalletDetail(`Active wallet object captured: ${active.name ?? "unknown"}`);
      setWalletError("");
      pushHistory(`wallet connected: ${active.name ?? "unknown"}`);
    } catch (cause) {
      setWallet(null);
      setWalletStatus("Connection failed");
      setWalletDetail("No active wallet captured");
      setWalletError(cause instanceof Error ? cause.message : String(cause));
      pushHistory("wallet connect failed");
      throw cause;
    }
  };

  const disconnectWallet = async () => {
    await walletManager?.disconnect?.();
    setWallet(null);
    setWalletStatus("Disconnected");
    setWalletDetail("Wallet disconnected");
    pushHistory("wallet disconnected");
  };

  const submitAuctionAction = async (
    action: "placeSealedBid" | "revealBid" | "openRevealPhase" | "endAuction",
    payload: Record<string, unknown>,
    fallback: () => Promise<void>,
    success: string
  ) => {
    if (wallet) {
      const tx = await submitWalletAction(wallet, action, payload);
      setStatus(`${success} Wallet tx submitted: ${formatShort(tx)}`);
      pushHistory(`wallet tx submitted: ${action} ${formatShort(tx)}`);
      await fallback();
      refresh();
      return;
    }
    await fallback();
    setStatus(`${success} Local mode only. Connect 1AM and approve the transaction to use the wallet bridge.`);
    pushHistory(`local fallback used: ${action}`);
    refresh();
  };

  return (
    <main className="shell">
      <section className="hero card">
        <div>
          <p className="eyebrow">Midnight sealed-bid auction</p>
          <h1>Private bids. Highest bidder wins.</h1>
          <p className="lede">
            Bidders commit privately, reveal only in the reveal phase, and the contract
            records the highest revealed bidder without exposing unrevealed bids.
          </p>
        </div>

        <div className="hero-grid">
          <Stat label="Phase" value={phaseLabel(state.phase)} />
          <Stat label="Bid count" value={String(state.bidCount)} />
          <Stat label="Highest revealed bid" value={state.hasWinner ? String(state.highestBid) : "none"} />
          <Stat label="Wallet" value={walletStatus} />
          <Stat
            label="Preview contract ID"
            value={PREVIEW_CONTRACT_ID ? formatShort(PREVIEW_CONTRACT_ID) : "not set"}
          />
        </div>
        <div className="winner">
          <strong>Wallet state:</strong> {walletDetail}
          {wallet ? (
            <>
              <br />
              <span className="muted">Connected wallet: {wallet.name ?? "unknown"}</span>
            </>
          ) : null}
          {walletError ? (
            <>
              <br />
              <span className="error">Connect error: {walletError}</span>
            </>
          ) : null}
        </div>
        <a className="history-link" href="#transaction-history">
          View transaction history
        </a>
        <a
          className="history-link"
          href="/deploy"
          onClick={(event) => {
            event.preventDefault();
            window.history.pushState({}, "", "/deploy");
            setPathname("/deploy");
          }}
        >
          Open browser deploy
        </a>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Wallet</p>
            <h2>Connect 1AM</h2>
          </div>
        </div>

        <div className="button-row">
          <button disabled={!walletReady} onClick={() => void connectWallet()}>
            Connect 1AM
          </button>
          <button className="ghost" disabled={!walletReady} onClick={() => void disconnectWallet()}>
            Disconnect Wallet
          </button>
        </div>

        <p className="muted">
          When connected, action buttons route through the wallet bridge so the wallet can sign or
          submit the transaction payload. Local simulation still works if the wallet kit is absent.
        </p>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Auction control</p>
            <h2>Deploy and advance the auction</h2>
          </div>
          <button className="ghost" onClick={() => run("Auction reset.", () => client.deploy(item, AUCTIONEER))}>
            Reset auction
          </button>
        </div>

        <div className="form-grid">
          <label>
            Item
            <input value={item} onChange={(event) => setItem(event.target.value)} />
          </label>
          <label>
            Bidder alias
            <input value={bidder} onChange={(event) => setBidder(event.target.value.trim())} />
          </label>
          <label>
            Amount
            <input
              value={amount}
              inputMode="numeric"
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
        </div>

        <div className="button-row">
          <button
            disabled={state.phase !== Phase.Bidding}
            onClick={() =>
              void submitAuctionAction(
                "openRevealPhase",
                { item, phase: "bidding" },
                () => client.openRevealPhase(AUCTIONEER),
                "Reveal phase opened."
              )
            }
          >
            Open reveal phase
          </button>
          <button
            className="ghost"
            disabled={state.phase !== Phase.Reveal}
            onClick={() =>
              void submitAuctionAction(
                "endAuction",
                { item, phase: "reveal" },
                () => client.endAuction(AUCTIONEER),
                "Auction ended."
              )
            }
          >
            End auction
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bidding flow</p>
            <h2>Seal a bid or reveal it later</h2>
          </div>
        </div>

        <div className="button-row">
          <button
            disabled={!canBid}
            onClick={() =>
              void submitAuctionAction(
                "placeSealedBid",
                { bidder, amount },
                () => client.placeSealedBid(bidder, BigInt(amount || "0")),
                `${bidder} placed a sealed bid.`
              )
            }
          >
            Place sealed bid
          </button>
          <button
            className="ghost"
            disabled={!canReveal}
            onClick={() =>
              void submitAuctionAction(
                "revealBid",
                { bidder },
                () => client.revealBid(bidder),
                `${bidder} revealed their bid.`
              )
            }
          >
            Reveal bid
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Public ledger</p>
            <h2>What the chain can show without exposing secrets</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bidder</th>
                <th>Nullifier</th>
                <th>Commitment</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {state.bids.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No sealed bids yet.
                  </td>
                </tr>
              ) : (
                state.bids.map((bid) => (
                  <tr key={bid.nullifier}>
                    <td>{bid.name}</td>
                    <td className="mono">{formatShort(bid.nullifier)}</td>
                    <td className="mono">{formatShort(bid.commitment)}</td>
                    <td>
                      <span className={`pill ${bid.revealed ? "pill-revealed" : "pill-sealed"}`}>
                        {bid.revealed ? "revealed" : "sealed"}
                      </span>
                    </td>
                    <td>{bid.amount === null ? "-" : bid.amount.toString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="winner">
          {state.hasWinner ? (
            <>
              <strong>Winning bidder:</strong> {state.highestBid.toString()} by{" "}
              <span className="mono">{formatShort(state.highestNullifier ?? "")}</span>
              {state.phase === Phase.Ended ? " - final" : ""}
            </>
          ) : (
            <span className="muted">No revealed winning bidder yet.</span>
          )}
        </div>
      </section>

      <section className="card" id="transaction-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2>Transaction history</h2>
          </div>
        </div>

        <button
          className="ghost history-clear"
          onClick={() => {
            setHistory([]);
            window.localStorage.removeItem(HISTORY_STORAGE_KEY);
          }}
        >
          Clear history
        </button>

        <div className="history">
          {history.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="history-item">
                <span className="history-time">{entry.timestamp}</span>
                <span>{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="footer">
        {error ? <div className="message error">Error: {error}</div> : null}
        {!error && status ? <div className="message success">Success: {status}</div> : null}
        <p>
          This UI uses a local simulator with the same state machine as the Compact contract in{" "}
          <code>contract/</code>. The public interface is ready to swap to a Midnight-backed
          client later without redesigning the app.
        </p>
      </footer>
    </main>
  );
}
