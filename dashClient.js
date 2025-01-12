const dotenv = require('dotenv');
dotenv.config();
const Dash = require('dash');

const getDapiAddresses = (network = 'mainnet') => {
  try {
   if (network === 'testnet') {
     return JSON.parse(process.env.TESTNET_DAPI_ADDRESSES);
   } else {
     return JSON.parse(process.env.MAINNET_DAPI_ADDRESSES);
   }
 } catch (error) {
   throw new Error(`Failed to parse DAPI addresses from environment variables for ${network}: ${error.message}`);
 }
};

const dashClient = (args = {}) => {
  const clientOpts = {
    wallet: {},
    network: 'mainnet'
  };

  if (args.network) {
    clientOpts.network = args.network;
  }

  console.log(`Using network: ${clientOpts.network}`);

  clientOpts.dapiAddresses = getDapiAddresses(clientOpts.network);

  if (args.height) {
    clientOpts.wallet.unsafeOptions = {
      skipSynchronizationBeforeHeight: parseInt(args.height) - 10
    };
  }

  if (!process.env.MNEMONIC) {
    clientOpts.wallet.mnemonic = null;
    clientOpts.wallet.offlineMode = true;
  } else {
    clientOpts.wallet.mnemonic = process.env.MNEMONIC;
  }

  if (args.verbose) {
    console.log('Client Options:', {
      ...clientOpts,
      wallet: {
        ...clientOpts.wallet,
        mnemonic: process.env.MNEMONIC
      }
    });
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.log('[DEBUG] Using mnemonic from env:', process.env.MNEMONIC);
  }

  if (process.env.LOG_LEVEL === 'debug' && clientOpts.apps) {
    console.log('[DEBUG] Using apps configuration:', JSON.stringify(clientOpts.apps, null, 2));
  }

  return new Dash.Client(clientOpts);
};
module.exports = dashClient;