import { ethers } from "ethers";
import contractData from "./BarterEscrow.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || contractData.address;

export function getContract(signer) {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0xYourDeployedContractAddressHere") {
    throw new Error("Set VITE_CONTRACT_ADDRESS in frontend/.env and restart the dev server.");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, contractData.abi, signer);
}

/** Create a trade on-chain. Returns the tradeId as a number. */
export async function createTradeOnChain(signer, userBAddress) {
  const contract = getContract(signer);
  const tx = await contract.createTrade(userBAddress);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); }
      catch { return null; }
    })
    .find((e) => e && e.name === "TradeCreated");

  if (!event) throw new Error("TradeCreated event not found in receipt");
  return Number(event.args.tradeId);
}

/** Deposit stake. amountInMatic is a string e.g. "0.1" */
export async function depositStakeOnChain(signer, tradeId, amountInMatic) {
  const contract = getContract(signer);
  const value = ethers.parseEther(String(amountInMatic));
  const tx = await contract.depositStake(tradeId, { value });
  await tx.wait();
}

/** Confirm trade on-chain */
export async function confirmTradeOnChain(signer, tradeId) {
  const contract = getContract(signer);
  const tx = await contract.confirmTrade(tradeId);
  await tx.wait();
}

/** Raise a dispute on-chain */
export async function raiseDisputeOnChain(signer, tradeId) {
  const contract = getContract(signer);
  const tx = await contract.raiseDispute(tradeId);
  await tx.wait();
}

/** Cancel trade on-chain */
export async function cancelTradeOnChain(signer, tradeId) {
  const contract = getContract(signer);
  const tx = await contract.cancelTrade(tradeId);
  await tx.wait();
}
