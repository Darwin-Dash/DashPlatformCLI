const dotenv = require('dotenv');
dotenv.config();
const Dash = require('dash');

// Helper function to parse DAPI addresses from environment variables
// We separate this to handle potential JSON parsing errors gracefully
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

// Main client factory function that creates configured Dash SDK client instances
// Uses environment variables and command line args to configure the client
const walletClient = (args = {}) => {
  const clientOpts = {
    wallet: {
      unsafeOptions: {
        skipSynchronizationBeforeHeight: args.height || 0
      }
    },
    network: args.network !== undefined ? args.network : 
            process.env.NETWORK !== undefined ? process.env.NETWORK : 
            'mainnet'
  };

  if (!process.env.MNEMONIC) {
    clientOpts.wallet.mnemonic = null;
    clientOpts.wallet.offlineMode = true;
  } else {
    clientOpts.wallet.mnemonic = process.env.MNEMONIC;
  }

  return new Dash.Client(clientOpts);
};

const dashClient = (args = {}) => {
  const clientOpts = {
    wallet: {},
    // Network priority: 1. Command line arg, 2. ENV variable, 3. Default to mainnet
    // This allows flexibility while maintaining sane defaults
    // Get network with priority: CLI args -> ENV var -> Default mainnet  
    network: args.network !== undefined ? args.network : 
          process.env.NETWORK !== undefined ? process.env.NETWORK : 
          'mainnet'
  };

  console.log(`Using network: ${clientOpts.network}`);

  // Get DAPI addresses for the selected network
  // These are required for connecting to the Dash Platform
  clientOpts.dapiAddresses = getDapiAddresses(clientOpts.network);

  // Configure contract access if a contract ID is provided
  // This enables the dot notation access pattern (e.g., myContract.note)
  if (args.contractId) {
    clientOpts.apps = {
      myContract: {
        contractId: args.contractId
      }
    };
  }

  // Optimize wallet sync by starting from specific block height
  // This significantly reduces initial sync time
  if (args.height) {
    clientOpts.wallet.unsafeOptions = {
      skipSynchronizationBeforeHeight: parseInt(args.height) - 10
    };
  }

  // Handle wallet configuration
  // If no mnemonic provided, create a new one in offline mode
  if (!process.env.MNEMONIC) {
    clientOpts.wallet.mnemonic = null;
    clientOpts.wallet.offlineMode = true;
  } else {
    clientOpts.wallet.mnemonic = process.env.MNEMONIC;
  }

  // Verbose logging for debugging
  if (args.verbose) {
    console.log('Client Options:', {
      ...clientOpts,
      wallet: {
        ...clientOpts.wallet,
        mnemonic: process.env.MNEMONIC
      }
    });
  }

  // Debug logging
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('[DEBUG] Using mnemonic from env:', process.env.MNEMONIC);
  }

  if (process.env.LOG_LEVEL === 'debug' && clientOpts.apps) {
    console.log('[DEBUG] Using apps configuration:', JSON.stringify(clientOpts.apps, null, 2));
  }

  const client = new Dash.Client(clientOpts);
  
  // Add cleanup handler
  process.on('beforeExit', async () => {
    if (client) {
      await client.disconnect();
    }
  });

  return client;
};
module.exports = {
  dashClient,
  walletClient
};