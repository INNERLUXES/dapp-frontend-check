import { createWalletClient, custom, parseEther, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import contracts from './config/contracts.json';
import network from './config/network.json';

const BOOTH = contracts['1'].TicketBooth as Address;

// Buys a ticket, waits for the confirmations the network setting asks for, and returns the receipt.
export async function buyTicket(ethereum: any, account: Address, price: string) {
  const wallet = createWalletClient({ account, chain: mainnet, transport: custom(ethereum) });
  const hash = await wallet.writeContract({ address: BOOTH, abi: BOOTH_ABI, functionName: 'buy', value: parseEther(price), chain: mainnet });
  return publicClient.waitForTransactionReceipt({ hash, confirmations: network.confirmations });
}

// Lets the booth take the exact price of one ticket in the pay token.
export async function approvePrice(wallet: any, token: Address, amount: bigint) {
  return wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [BOOTH, amount], chain: mainnet });
}

// Signs a resale offer as EIP-712 typed data, bound to the chain and to the booth.
export async function signResale(wallet: any, ticketId: bigint, price: bigint) {
  return wallet.signTypedData({
    domain: { name: 'Fernhollow Tickets', version: '1', chainId: mainnet.id, verifyingContract: BOOTH },
    types: { Resale: [{ name: 'ticketId', type: 'uint256' }, { name: 'price', type: 'uint256' }] },
    primaryType: 'Resale',
    message: { ticketId, price }
  });
}

// Signs in with a Sign-In with Ethereum message.
export async function signIn(wallet: any, account: Address, nonce: string) {
  const message = `tickets.fernhollow.test wants you to sign in with your Ethereum account:\n${account}\n\nNonce: ${nonce}`;
  return wallet.signMessage({ account, message });
}

declare const publicClient: any;
declare const BOOTH_ABI: readonly unknown[];
declare const ERC20_ABI: readonly unknown[];
