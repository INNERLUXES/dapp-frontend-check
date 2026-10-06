// Connects the wallet when the user clicks Connect, and follows the chain it is on.
const WANTED_CHAIN = '0x1';

export async function connect(ethereum: any): Promise<string> {
  const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
  const chainId: string = await ethereum.request({ method: 'eth_chainId' });
  if (chainId !== WANTED_CHAIN) {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: WANTED_CHAIN }] });
  }
  ethereum.on('chainChanged', () => window.location.reload());
  return accounts[0];
}

// Reads the accounts the user already allowed, after connect.
export async function currentAccount(ethereum: any): Promise<string | undefined> {
  const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
  return accounts[0];
}
