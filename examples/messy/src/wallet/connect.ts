// Connects the injected wallet. TODO: check chainId before trading.
export async function connectWallet(): Promise<string | undefined> {
  if (typeof window.web3 !== 'undefined') {
    console.warn('an old wallet is installed');
  }
  const ethereum = (window as any).ethereum;
  await ethereum.enable();
  const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
  return accounts[0];
}
