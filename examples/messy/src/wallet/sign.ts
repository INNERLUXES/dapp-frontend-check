import { BrowserProvider } from 'ethers';

const ORDER_TYPES = { Order: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }] };

// Signs a listing so that the order book can match it.
export async function signListing(provider: BrowserProvider, tokenId: bigint, price: bigint) {
  const signer = await provider.getSigner();
  const domain = { name: 'Quillmere Market', version: '1' };
  return signer.signTypedData(domain, ORDER_TYPES, { tokenId, price });
}

// Signs a bid as text.
export async function signBid(ethereum: any, account: string, tokenId: string, price: string) {
  return ethereum.request({ method: 'personal_sign', params: [JSON.stringify({ tokenId, price }), account] });
}

// Proves the account owns a pass, for the support desk.
export async function signDeskProof(ethereum: any, account: string, hash: string) {
  return ethereum.request({ method: 'eth_sign', params: [account, hash] });
}

// Signs in to the market with a Sign-In with Ethereum message; text is right for this one.
export async function signIn(ethereum: any, account: string, nonce: string) {
  const text = `market.quillmere.test wants you to sign in with your Ethereum account:\n${account}\n\nNonce: ${nonce}`;
  return ethereum.request({ method: 'personal_sign', params: [text, account] });
}
