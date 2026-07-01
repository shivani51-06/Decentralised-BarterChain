/**
 * Simple wallet-based auth middleware.
 * Reads the x-wallet-address header and sets req.walletAddress.
 */
function auth(req, res, next) {
  const wallet = req.headers["x-wallet-address"];
  if (!wallet) {
    return res.status(401).json({ error: "Missing x-wallet-address header" });
  }
  req.walletAddress = wallet.toLowerCase().trim();
  next();
}

module.exports = auth;
