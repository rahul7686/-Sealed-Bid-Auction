import { useEffect, useMemo, useState } from "react";
import { LocalAuctionClient } from "./auction/localClient";
import { AuctionClient, AuctionPublicState, Phase, phaseLabel } from "./auction/types";

const AUCTIONEER = "auctioneer";
const formatShort = (hex: string) => (hex ? `${hex.slice(0, 10)}...` : "-");

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type WalletManager = {
  connectWithFallback: (wallets: string[]) => Promise<void>;
  getActiveWallet?: () => { name?: string } | null;
  connect?: (wallet: string) => Promise<void>;
  disconnect?: () => Promise<void> | void;
};

export default function App() {
  const client = useMemo<AuctionClient>(() => new LocalAuctionClient(), []);
  const [state, setState] = useState<AuctionPublicState | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [walletStatus, setWalletStatus] = useState("Disconnected");
  const [item, setItem] = useState("Rare painting: Midnight over Nassau");
  const [bidder, setBidder] = useState("alice");
  const [amount, setAmount] = useState("100");
  const [walletReady, setWalletReady] = useState(false);
  const [walletManager, setWalletManager] = useState<WalletManager | null>(null);

  const refresh = () => setState({ ...client.getState() });

  const run = async (message: string, action: () => Promise<void>) => {
    setError("");
    try {
      await action();
      setStatus(message);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
        const manager = kit.createMidnightWalletManager({ network: "preprod" }) as WalletManager;
        setWalletManager(manager);
        setWalletReady(true);
        setWalletStatus("Ready to connect 1AM");
      } catch {
        if (!mounted) return;
        setWalletReady(false);
        setWalletStatus("midnight-wallet-kit not installed");
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

  const connect1AM = async () => {
    if (!walletManager) {
      throw new Error("1AM wallet kit is not available in this build.");
    }
    if (walletManager.connectWithFallback) {
      await walletManager.connectWithFallback(["1AM"]);
    } else if (walletManager.connect) {
      await walletManager.connect("1AM");
    }
    const active = walletManager.getActiveWallet?.();
    setWalletStatus(active?.name ? `${active.name} connected` : "1AM connected");
  };

  const disconnectWallet = async () => {
    await walletManager?.disconnect?.();
    setWalletStatus("Disconnected");
  };

  return (
    <main className="shell">
      <section className="hero card">
        <div>
          <p className="eyebrow">Midnight sealed-bid auction</p>
          <h1>Private bids. Verifiable winner.</h1>
          <p className="lede">
            Bidders commit privately, reveal only in the reveal phase, and the contract
            records a winner without exposing unrevealed bids.
          </p>
        </div>

        <div className="hero-grid">
          <Stat label="Phase" value={phaseLabel(state.phase)} />
          <Stat label="Bid count" value={String(state.bidCount)} />
          <Stat label="Highest revealed bid" value={state.hasWinner ? String(state.highestBid) : "none"} />
          <Stat label="Wallet" value={walletStatus} />
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Wallet</p>
            <h2>Connect 1AM for web3 transactions</h2>
          </div>
        </div>

        <div className="button-row">
          <button disabled={!walletReady} onClick={() => void connect1AM()}>
            Connect 1AM Wallet
          </button>
          <button className="ghost" disabled={!walletReady} onClick={() => void disconnectWallet()}>
            Disconnect Wallet
          </button>
        </div>

        <p className="muted">
          This build now has a wallet integration entry point. When the Midnight wallet kit is
          installed, the app can connect to 1AM through the standard DApp connector flow.
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
            onClick={() => run("Reveal phase opened.", () => client.openRevealPhase(AUCTIONEER))}
          >
            Open reveal phase
          </button>
          <button
            className="ghost"
            disabled={state.phase !== Phase.Reveal}
            onClick={() => run("Auction ended.", () => client.endAuction(AUCTIONEER))}
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
            onClick={() => run(`${bidder} placed a sealed bid.`, () => client.placeSealedBid(bidder, BigInt(amount || "0")))}
          >
            Place sealed bid
          </button>
          <button
            className="ghost"
            disabled={!canReveal}
            onClick={() => run(`${bidder} revealed their bid.`, () => client.revealBid(bidder))}
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
              <strong>Winning bid:</strong> {state.highestBid.toString()} by{" "}
              <span className="mono">{formatShort(state.highestNullifier ?? "")}</span>
              {state.phase === Phase.Ended ? " - final" : ""}
            </>
          ) : (
            <span className="muted">No revealed winner yet.</span>
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
