import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import CreateListing from "./pages/CreateListing";
import Profile from "./pages/Profile";
import TradeRequests from "./pages/TradeRequests";
import ActiveTrades from "./pages/ActiveTrades";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateListing />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/trades/requests" element={<TradeRequests />} />
          <Route path="/trades/active" element={<ActiveTrades />} />
        </Routes>
      </main>
    </div>
  );
}
