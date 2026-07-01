import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useWallet } from "../contexts/WalletContext";

export default function CreateListing() {
  const { account } = useWallet();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    estimatedValue: "",
    imageUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!account) return alert("Connect your wallet first.");
    setLoading(true);
    setError("");

    try {
      await axios.post(
        "/api/products",
        {
          title: form.title,
          description: form.description,
          estimatedValue: Number(form.estimatedValue),
          images: form.imageUrl ? [form.imageUrl] : [],
        },
        { headers: { "x-wallet-address": account } }
      );
      navigate("/profile");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create listing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Create Listing</h1>

      {!account && (
        <p className="mb-4 text-sm text-red-600 font-medium">
          Connect your wallet to create a listing.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-6 flex flex-col gap-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            name="title"
            required
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Vintage Camera"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            required
            rows={3}
            value={form.description}
            onChange={handleChange}
            placeholder="Describe the item, condition, etc."
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Value (USD)
          </label>
          <input
            name="estimatedValue"
            type="number"
            min="0"
            required
            value={form.estimatedValue}
            onChange={handleChange}
            placeholder="e.g. 150"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image URL (optional)
          </label>
          <input
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !account}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? "Creating…" : "Create Listing"}
        </button>
      </form>
    </div>
  );
}
