import { createContext, useContext, useState, useCallback } from "react";
import { ethers } from "ethers";
import axios from "axios";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [user, setUser] = useState(null);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install MetaMask.");
      return;
    }

    try {
      // Request accounts
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const _provider = new ethers.BrowserProvider(window.ethereum);
      const _signer = await _provider.getSigner();
      const _account = await _signer.getAddress();

      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);

      // Upsert user in backend
      const { data } = await axios.post("/api/auth/connect-wallet", {
        walletAddress: _account,
      });
      setUser(data);
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  }, []);

  const refreshUser = useCallback(async (walletAddress) => {
    try {
      const { data } = await axios.post("/api/auth/connect-wallet", {
        walletAddress,
      });
      setUser(data);
    } catch (err) {
      console.error("Refresh user error:", err);
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{ account, provider, signer, user, connectWallet, refreshUser }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
