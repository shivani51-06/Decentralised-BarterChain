import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import { BrowserRouter } from "react-router-dom";
import { WalletProvider } from "./contexts/WalletContext";
import App from "./App";
import "./index.css";

// In dev, Vite's proxy forwards relative /api calls to localhost:5000.
// In production there is no proxy, so point axios at the deployed backend.
axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
