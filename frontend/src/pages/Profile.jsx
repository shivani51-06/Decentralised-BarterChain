import { useEffect, useState } from "react";
import axios from "axios";
import { useWallet } from "../contexts/WalletContext";

export default function Profile() {
  const { account, user, refreshUser } = useWallet();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      setLoading(true);
      refreshUser(account);
      axios
        .get(`/api/products?owner=${account}`)
        .then((r) => setProducts(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [account]);

  if (!account) {
    return (
      <p className="text-gray-500">Connect your wallet to view your profile.</p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">My Profile</h1>

      {/* Wallet + stats */}
      <div className="bg-white rounded-xl shadow p-5 mb-8 flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Wallet</p>
          <p className="font-mono text-sm text-gray-700 mt-1">{account}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Trust Score</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {user?.trustScore ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Completed Trades</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {user?.completedTrades ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Disputes</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {user?.disputes ?? 0}
          </p>
        </div>
      </div>

      {/* My listings */}
      <h2 className="text-xl font-semibold text-gray-700 mb-4">My Listings</h2>
      {loading && <p className="text-gray-400">Loading…</p>}
      {!loading && products.length === 0 && (
        <p className="text-gray-500">You have no listings yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((p) => (
          <div
            key={p._id}
            className="bg-white rounded-xl shadow p-4 flex flex-col gap-2"
          >
            {p.images?.[0] && (
              <img
                src={p.images[0]}
                alt={p.title}
                className="w-full h-36 object-cover rounded-lg"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <h3 className="font-semibold text-gray-800">{p.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
            <span className="text-indigo-700 font-bold text-sm">
              ~${p.estimatedValue}
            </span>
            <span
              className={`text-xs font-medium ${
                p.isAvailable ? "text-green-600" : "text-gray-400"
              }`}
            >
              {p.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
