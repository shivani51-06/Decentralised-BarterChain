import { Link, useLocation } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";

function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Navbar() {
  const { account, connectWallet } = useWallet();
  const location = useLocation();

  const linkClass = (path) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      location.pathname === path
        ? "bg-indigo-700 text-white"
        : "text-indigo-100 hover:bg-indigo-600"
    }`;

  return (
    <nav className="bg-indigo-800 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-white text-xl font-bold tracking-tight">
          BarterChain
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/" className={linkClass("/")}>
            Listings
          </Link>
          <Link to="/create" className={linkClass("/create")}>
            + New Listing
          </Link>
          <Link to="/trades/requests" className={linkClass("/trades/requests")}>
            Requests
          </Link>
          <Link to="/trades/active" className={linkClass("/trades/active")}>
            Active Trades
          </Link>
          <Link to="/profile" className={linkClass("/profile")}>
            Profile
          </Link>

          {account ? (
            <span className="ml-3 px-3 py-2 bg-green-600 text-white text-sm rounded-md font-mono">
              {shortAddress(account)}
            </span>
          ) : (
            <button
              onClick={connectWallet}
              className="ml-3 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-indigo-900 text-sm font-semibold rounded-md transition-colors"
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
