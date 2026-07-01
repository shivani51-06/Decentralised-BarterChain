import { useEffect, useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import {
  createTradeOnChain,
  depositStakeOnChain,
  confirmTradeOnChain,
  raiseDisputeOnChain,
} from "../utils/contract";

const ACTIVE_STATUSES = ["accepted", "staked", "shipped", "disputed"];

function StatusBadge({ status }) {
  const colors = {
    accepted: "bg-blue-100 text-blue-800",
    staked: "bg-purple-100 text-purple-800",
    shipped: "bg-indigo-100 text-indigo-800",
    completed: "bg-green-100 text-green-800",
    disputed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[status] || "bg-gray-100"}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function ActiveTrades() {
  const { account, signer } = useWallet();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (account) fetchTrades();
  }, [account]);

  async function fetchTrades() {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/trades/my", {
        headers: { "x-wallet-address": account },
      });
      setTrades(data.filter((t) => ACTIVE_STATUSES.includes(t.status)));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  if (!account) {
    return <p className="text-gray-500">Connect your wallet to see your active trades.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Active Trades</h1>
      {loading && <p className="text-gray-400">Loading…</p>}
      {!loading && trades.length === 0 && (
        <p className="text-gray-500">No active trades right now.</p>
      )}
      <div className="flex flex-col gap-6">
        {trades.map((trade) => (
          <TradePanel
            key={trade._id}
            trade={trade}
            account={account}
            signer={signer}
            onRefresh={fetchTrades}
          />
        ))}
      </div>
    </div>
  );
}

function TradePanel({ trade, account, signer, onRefresh }) {
  const myRole = trade.userA === account.toLowerCase() ? "A" : "B";
  const counterparty = myRole === "A" ? trade.userB : trade.userA;
  const myProduct = myRole === "A" ? trade.productA : trade.productB;
  const theirProduct = myRole === "A" ? trade.productB : trade.productA;

  const [stakeAmount, setStakeAmount] = useState("0.1");
  const [trackingId, setTrackingId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(fn) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      onRefresh();
    } catch (err) {
      setMsg(err.reason || err.message || "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInitOnChain() {
    await run(async () => {
      if (!signer) throw new Error("Wallet not connected");
      const contractTradeId = await createTradeOnChain(signer, trade.userB);
      await axios.post(
        "/api/trades/accept",
        { tradeId: trade._id, contractTradeId },
        { headers: { "x-wallet-address": account } }
      );
      setMsg(`On-chain trade created (ID: ${contractTradeId}). Now deposit stake.`);
    });
  }

  async function handleDeposit() {
    await run(async () => {
      if (!signer) throw new Error("Wallet not connected");
      if (!trade.contractTradeId) throw new Error("On-chain trade ID missing. Initialize first.");
      await depositStakeOnChain(signer, trade.contractTradeId, stakeAmount);
      await axios.post(
        "/api/trades/stake",
        {
          tradeId: trade._id,
          contractTradeId: trade.contractTradeId,
          stakeAmount: ethers.parseEther(stakeAmount).toString(),
        },
        { headers: { "x-wallet-address": account } }
      );
      setMsg("Stake deposited!");
    });
  }

  async function handleUploadProof() {
    await run(async () => {
      if (!proofUrl) throw new Error("Enter a proof URL.");
      await axios.post(
        "/api/trades/upload-proof",
        { tradeId: trade._id, proofUrl },
        { headers: { "x-wallet-address": account } }
      );
      setMsg("Proof uploaded!");
    });
  }

  async function handleAddTracking() {
    await run(async () => {
      if (!trackingId) throw new Error("Enter a tracking ID.");
      await axios.post(
        "/api/trades/add-tracking",
        { tradeId: trade._id, trackingId },
        { headers: { "x-wallet-address": account } }
      );
      setMsg("Tracking added!");
    });
  }

  async function handleConfirm() {
    await run(async () => {
      if (!signer) throw new Error("Wallet not connected");
      await confirmTradeOnChain(signer, trade.contractTradeId);
      await axios.post(
        "/api/trades/confirm",
        { tradeId: trade._id },
        { headers: { "x-wallet-address": account } }
      );
      setMsg("Confirmed on-chain and recorded!");
    });
  }

  async function handleDispute() {
    if (!confirm("Are you sure you want to raise a dispute?")) return;
    await run(async () => {
      if (!signer) throw new Error("Wallet not connected");
      await raiseDisputeOnChain(signer, trade.contractTradeId);
      await axios.post(
        "/api/trades/dispute",
        { tradeId: trade._id },
        { headers: { "x-wallet-address": account } }
      );
      setMsg("Dispute raised. An admin will review.");
    });
  }

  const myProof = myRole === "A" ? trade.proofA : trade.proofB;
  const myTracking = myRole === "A" ? trade.trackingA : trade.trackingB;
  const myConfirmed = myRole === "A" ? trade.userAConfirmed : trade.userBConfirmed;

  return (
    <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <StatusBadge status={trade.status} />
        <span className="text-xs text-gray-400 font-mono">
          {counterparty.slice(0, 8)}…
        </span>
      </div>

      {/* Products */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">You're trading</p>
          <p className="font-semibold text-gray-800">{myProduct?.title}</p>
          <p className="text-sm text-indigo-600">~${myProduct?.estimatedValue}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">You're receiving</p>
          <p className="font-semibold text-gray-800">{theirProduct?.title}</p>
          <p className="text-sm text-indigo-600">~${theirProduct?.estimatedValue}</p>
        </div>
      </div>

      {/* On-chain info */}
      {trade.contractTradeId !== null && trade.contractTradeId !== undefined && (
        <p className="text-xs text-gray-400">
          On-chain Trade ID:{" "}
          <span className="font-mono text-gray-600">{trade.contractTradeId}</span>{" "}
          | Stake:{" "}
          {trade.stakeAmount
            ? ethers.formatEther(trade.stakeAmount) + " MATIC"
            : "—"}
        </p>
      )}

      {msg && <p className="text-sm text-indigo-700 font-medium">{msg}</p>}

      {/* ── ACCEPTED but no on-chain ID yet: UserA must init ── */}
      {trade.status === "accepted" && !trade.contractTradeId && myRole === "A" && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-yellow-800">Step 0 — Initialize On-Chain Trade</p>
          <p className="text-xs text-yellow-700">You need to register this trade on the smart contract before staking.</p>
          <button
            onClick={handleInitOnChain}
            disabled={busy}
            className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            {busy ? "Initializing..." : "Create On-Chain Trade"}
          </button>
        </div>
      )}

      {trade.status === "accepted" && !trade.contractTradeId && myRole === "B" && (
        <p className="text-sm text-gray-400 italic">
          Waiting for the other party to initialize the on-chain trade...
        </p>
      )}

      {/* ── ACCEPTED: Deposit Stake ── */}
      {trade.status === "accepted" && trade.contractTradeId && (
        <div className="border border-indigo-100 rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">Step 1 — Deposit Stake</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
              placeholder="MATIC amount"
            />
            <button
              onClick={handleDeposit}
              disabled={busy}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {busy ? "…" : "Deposit"}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Both parties must deposit the same amount. First depositor sets the amount.
          </p>
        </div>
      )}

      {/* ── STAKED: Upload proof + tracking ── */}
      {(trade.status === "staked" || trade.status === "shipped") && (
        <div className="border border-indigo-100 rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">Step 2 — Ship & Upload Proof</p>

          {!myTracking ? (
            <div className="flex gap-2">
              <input
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Tracking ID"
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
              />
              <button
                onClick={handleAddTracking}
                disabled={busy}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
              >
                {busy ? "…" : "Save"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-green-600">
              Tracking: <span className="font-mono">{myTracking}</span>
            </p>
          )}

          {!myProof ? (
            <div className="flex gap-2">
              <input
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="Proof image URL"
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
              />
              <button
                onClick={handleUploadProof}
                disabled={busy}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
              >
                {busy ? "…" : "Upload"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-green-600">
              Proof submitted.{" "}
              <a href={myProof} target="_blank" rel="noreferrer" className="underline">
                View
              </a>
            </p>
          )}
        </div>
      )}

      {/* ── SHIPPED: Confirm ── */}
      {trade.status === "shipped" && !myConfirmed && (
        <div className="border border-green-100 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Step 3 — Confirm Receipt
          </p>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            {busy ? "Confirming…" : "Confirm Receipt"}
          </button>
        </div>
      )}

      {myConfirmed && trade.status !== "completed" && (
        <p className="text-sm text-green-600 font-medium">
          You confirmed. Waiting for the other party…
        </p>
      )}

      {trade.status === "completed" && (
        <p className="text-sm text-green-700 font-bold">
          Trade completed! Stakes have been released.
        </p>
      )}

      {/* ── Raise Dispute ── */}
      {["staked", "shipped"].includes(trade.status) && (
        <button
          onClick={handleDispute}
          disabled={busy}
          className="w-full py-2 border border-red-300 hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg transition-colors"
        >
          Raise Dispute
        </button>
      )}

      {trade.status === "disputed" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Dispute in progress. An admin will review and resolve via the smart contract.
        </div>
      )}
    </div>
  );
}
