import { Contract, MaxUint256, parseEther, type BrowserProvider } from 'ethers';

const ROUTER = '0x24f8097B1994432e896001062ff6be5E53a6F170';
const ERC20 = ['function approve(address spender, uint256 amount) returns (bool)'];
const MARKET = ['function buy(uint256 tokenId) payable'];

// Lets the router spend the quill token of the user before a trade.
export async function approveRouter(provider: BrowserProvider, token: string) {
  const signer = await provider.getSigner();
  const { chainId } = await provider.getNetwork();
  console.info('approving on chain', chainId);
  const erc20 = new Contract(token, ERC20, signer);
  const tx = await erc20.approve(ROUTER, MaxUint256);
  return tx.wait(3);
}

// Approves only the price of one trade; this one is fine.
export async function approvePrice(provider: BrowserProvider, token: string, amount: bigint) {
  const erc20 = new Contract(token, ERC20, await provider.getSigner());
  const tx = await erc20.approve(ROUTER, amount);
  return tx.wait(3);
}

// Buys a pass with ether.
export async function buyPass(provider: BrowserProvider, market: string, tokenId: bigint, price: string) {
  const contract = new Contract(market, MARKET, await provider.getSigner());
  const tx = await contract.buy(tokenId, { value: parseEther(price) });
  return tx.wait(1);
}
