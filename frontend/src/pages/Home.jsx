import { useEffect, useState } from "react";
import axios from "axios";
import { useWallet } from "../contexts/WalletContext";

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Home() {
  const { account } = useWallet();
  const [products, setProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Request trade modal state
  const [selectedProduct, setSelectedProduct] = useState(null); // the listing we want
  const [myProductId, setMyProductId] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (account) {
      axios
        .get(`/api/products?owner=${account}`)
        .then((r) => setMyProducts(r.data))
        .catch(() => {});
    }
  }, [account]);

  async function fetchProducts() {
    try {
      const { data } = await axios.get("/api/products");
      setProducts(data);
    } catch {
      setMessage("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestTrade() {
    if (!account) return alert("Connect your wallet first.");
    if (!myProductId) return alert("Select one of your products to offer.");
    setRequesting(true);
    setMessage("");
    try {
      await axios.post(
        "/api/trades/request",
        {
          productA: selectedProduct._id,
          productB: myProductId,
          userA: selectedProduct.owner,
        },
        { headers: { "x-wallet-address": account } }
      );
      setMessage("Trade request sent!");
      setSelectedProduct(null);
    } catch (err) {
      setMessage(err.response?.data?.error || "Request failed.");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading listings…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">All Listings</h1>

      {message && (
        <p className="mb-4 text-sm text-indigo-700 font-medium">{message}</p>
      )}

      {products.length === 0 && (
        <p className="text-gray-500">No listings yet. Be the first to create one!</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div
            key={p._id}
            className="bg-white rounded-xl shadow p-5 flex flex-col gap-3"
          >
            {p.images?.[0] && (
              <img
                src={p.images[0]}
                alt={p.title}
                className="w-full h-40 object-cover rounded-lg"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{p.title}</h2>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-indigo-700 font-bold">
                ~${p.estimatedValue}
              </span>
              <span className="text-xs text-gray-400">
                {shortAddr(p.owner)}
              </span>
            </div>

            {/* Don't show request button on own listings */}
            {account && p.owner !== account.toLowerCase() && (
              <button
                onClick={() => {
                  setSelectedProduct(p);
                  setMyProductId("");
                  setMessage("");
                }}
                className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Request Trade
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Request Trade Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-1">Request Trade</h2>
            <p className="text-sm text-gray-500 mb-4">
              You want: <strong>{selectedProduct.title}</strong>
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Offer one of your listings:
            </label>
            {myProducts.length === 0 ? (
              <p className="text-sm text-red-500">
                You have no listings. Create one first.
              </p>
            ) : (
              <select
                value={myProductId}
                onChange={(e) => setMyProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-4"
              >
                <option value="">-- Select your product --</option>
                {myProducts.map((mp) => (
                  <option key={mp._id} value={mp._id}>
                    {mp.title} (~${mp.estimatedValue})
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRequestTrade}
                disabled={requesting || !myProductId}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
              >
                {requesting ? "Sending…" : "Send Request"}
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
