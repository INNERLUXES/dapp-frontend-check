// A stand-in wallet for the tests of the market; the configuration leaves this folder out.
export const mockWallet = { request: async () => ({ method: 'eth_sign' }) };
