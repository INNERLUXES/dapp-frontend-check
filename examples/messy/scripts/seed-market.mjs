import { JsonRpcProvider, Wallet } from 'ethers';

// Lists the first passes on the local test chain.
const provider = new JsonRpcProvider('http://127.0.0.1:8545');
const seeder = new Wallet(process.env.SEEDER_KEY ?? '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', provider);
console.info('seeding as', seeder.address);
