import { JsonRpcProvider } from 'ethers';

// A read-only provider for the market pages.
export const readProvider = new JsonRpcProvider('https://eth-mainnet.rpcnode.test/v3/demo0key0demo0key0demo0key');

// The provider of the order book reads its address from the build.
export const bookProvider = new JsonRpcProvider(import.meta.env.VITE_RPC_URL);
