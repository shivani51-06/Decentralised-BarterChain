import { useEffect, useState } from "react";
import axios from "axios";
import { useWallet } from "../contexts/WalletContext";
import { createTradeOnChain } from "../utils/contract";

function StatusBadge({ status }) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-blue-100 text-blue-800",
    staked: "bg-purple-100 text-purple-800",
    shipped: "bg-indigo-100 text-indigo-800",
    completed: "bg-green-100 text-green-800",
    disputed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[status] || "bg-gray-100 text-gray-700"}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function TradeRequests() {
  const { account, signer } = useWallet();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account) fetchTrades();
  }, [account]);

  async function fetchTrades() {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/trades/my", {
        headers: { "x-wallet-address": account },
      });
      setTrades(data.filter((t) => t.status === "pending"));
    } catch {
      setMessage("Failed to load trades.");
    } finally {
      setLoading(false);
    }
  }

  async function acceptTrade(trade) {
    if (!signer) return setMessage("Connect your wallet first.");
    setBusy(true);
    setMessage("");
    try {
      // 1. Create the on-chain trade — userA calls createTrade(userB)
      setMessage("Creating on-chain trade (confirm MetaMask)...");
      const contractTradeId = await createTradeOnChain(signer, trade.userB);

      // 2. Accept in backend, storing the contractTradeId
      setMessage("Recording acceptance...");
      await axios.post(
        "/api/trades/accept",
        { tradeId: trade._id, contractTradeId },
        { headers: { "x-wallet-address": account } }
      );

      setMessage(`Trade accepted! On-chain ID: ${contractTradeId}. Head to Active Trades to deposit stake.`);
      fetchTrades();
    } catch (err) {
      setMessage(err.reason || err.response?.data?.error || "Failed to accept.");
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return <p className="text-gray-500">Connect your wallet to see your trade requests.</p>;
  }

  const incoming = trades.filter((t) => t.userA === account.toLowerCase());
  const outgoing = trades.filter((t) => t.userB === account.toLowerCase());

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Trade Requests</h1>

      {message && (
        <p className="mb-4 text-sm text-indigo-700 font-medium">{message}</p>
      )}
      {loading && <p className="text-gray-400">Loading...</p>}

      {/* Incoming */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Incoming ({incoming.length})
        </h2>
        {incoming.length === 0 && (
          <p className="text-gray-400 text-sm">No incoming requests.</p>
        )}
        <div className="flex flex-col gap-4">
          {incoming.map((t) => (
            <TradeCard
              key={t._id}
              trade={t}
              myRole="A"
              busy={busy}
              onAccept={() => acceptTrade(t)}
            />
          ))}
        </div>
      </section>

      {/* Outgoing */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Outgoing ({outgoing.length})
        </h2>
        {outgoing.length === 0 && (
          <p className="text-gray-400 text-sm">No outgoing requests.</p>
        )}
        <div className="flex flex-col gap-4">
          {outgoing.map((t) => (
            <TradeCard key={t._id} trade={t} myRole="B" />
          ))}
        </div>
      </section>
    </div>
  );
}

function TradeCard({ trade, myRole, busy, onAccept }) {
  const theyOffer = myRole === "A" ? trade.productB : trade.productA;
  const iOffer   = myRole === "A" ? trade.productA : trade.productB;
  const theirWallet = myRole === "A" ? trade.userB : trade.userA;

  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <StatusBadge status={trade.status} />
        <span className="text-xs text-gray-400 font-mono">
          {theirWallet.slice(0, 8)}...
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">They offer</p>
          <p className="font-semibold text-gray-800">{theyOffer?.title}</p>
          <p className="text-sm text-indigo-600">~${theyOffer?.estimatedValue}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">You offer</p>
          <p className="font-semibold text-gray-800">{iOffer?.title}</p>
          <p className="text-sm text-indigo-600">~${iOffer?.estimatedValue}</p>
        </div>
      </div>

      {myRole === "A" && trade.status === "pending" && (
        <button
          onClick={onAccept}
          disabled={busy}
          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
        >
          {busy ? "Processing..." : "Accept Trade"}
        </button>
      )}
      {myRole === "B" && (
        <p className="text-sm text-gray-400 italic">
          Waiting for the other party to accept...
        </p>
      )}
    </div>
  );
}
