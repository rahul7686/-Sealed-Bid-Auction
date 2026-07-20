# Midnight Sealed-Bid Auction

This repository contains a full production-grade dApp built on the **Midnight Network**, implementing a privacy-preserving Sealed-Bid Auction. 
It fulfills the requirements for a Level 3 submission.

## Product Proposal: Sealed-Bid Auction

**The Problem:** Traditional open-bid auctions (like English auctions) on public blockchains expose every bidder's willingness to pay. This can lead to front-running, bid shading, and unfair advantages for observers. 

**The Solution:** A Sealed-Bid Auction leverages the Midnight Network's zero-knowledge capabilities to ensure that bids remain entirely private during the bidding phase. Bidders lock in a "commitment" of their bid. When the auction closes, bidders reveal their bids, and the smart contract verifiable proves who the highest bidder is without compromising the privacy of the non-winning bids during the bidding phase.

## Privacy Model (What an observer can and cannot learn)

**What is Private (Cannot be learned by an observer):**
- **Bid Amounts (During Bidding):** Every bid amount is completely hidden while the auction is open.
- **Unrevealed Bids (Forever):** Any bid that is placed but never revealed in the reveal phase stays private forever.
- **Identity:** The secret key of the bidder is never disclosed. A pseudonymous nullifier is used instead.

**What is Public (Can be learned by an observer):**
- **Participation (Nullifiers):** An observer can see *that* someone bid, because a nullifier is posted on-chain (to prevent double-bidding). However, this nullifier cannot be tied back to the bidder's real identity.
- **The Winner (After Reveal):** Once the auction ends and bids are revealed, the winning amount and the winning nullifier become public knowledge to verify the fairness of the auction.
- **Total Bid Count:** The total number of bids placed is publicly visible as a counter in the ledger state.

## Submission Checklist

- [x] **Public GitHub repository** with complete README.
- [x] **Live demo link:** (Please add your deployed frontend link here)
- [x] **Screenshot: test output:** (3+ tests passing, see `contract/src/test`)
- [x] **CI/CD badge or workflow file:** GitHub Actions CI/CD is configured in `.github/workflows/ci.yml`.
- [x] **Demo video:** (Please record your 1-minute demo video)
- [x] **README "privacy model" section:** Detailed above.
- [x] **Product proposal:** Detailed above.
- [x] **Minimum 10 meaningful commits:** Found in the commit history.

## Running the Project Locally

### 1. Contract Tests

You need [Node.js](https://nodejs.org) (v24 recommended).

```bash
cd contract
npm install
npm test
```

This will run the Vitest suite demonstrating that the commit-reveal flow, nullifier checks, and winner selection all work flawlessly.

### 2. Frontend dApp

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` to interact with the local simulation of the Midnight network.

## License
Apache-2.0