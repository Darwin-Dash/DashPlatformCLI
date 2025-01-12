const dashClient = require('./dashClient');

const MINIMUM_TOPUP_AMOUNT = 50000;
const IDENTITY_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;

const validateIdentityName = (name) => {
  if (!IDENTITY_NAME_REGEX.test(name)) {
    throw new Error(
      'Invalid identity name. Name must:\n' +
      '- Start with a letter or number\n' +
      '- End with a letter or number\n' +
      '- Contain only letters, numbers, and hyphens\n' +
      '- Be between 2 and 63 characters long'
    );
  }
  return true;
};

const findFirstTransactionBlock = async (address, network = 'mainnet') => {
  try {
    // Define endpoints based on network
    const insightApi = network === 'testnet' 
      ? 'https://insight.testnet.networks.dash.org/insight-api'
      : 'https://insight.dash.org/insight-api';

    const rpcUrl = network === 'testnet'
      ? 'https://trpc.digitalcash.dev/'
      : 'https://rpc.digitalcash.dev/';

    // First try RPC API
    try {
      console.log(`Trying ${rpcUrl}...`);
      const txidsResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'getaddresstxids',
          params: [{
            addresses: [address]
          }]
        })
      });

      const txidsData = await txidsResponse.json();

      if (txidsData.result && txidsData.result.length > 0) {
        const firstTxId = txidsData.result[0];

        const txResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'getrawtransaction',
            params: [firstTxId, true]
          })
        });

        const txData = await txResponse.json();

        if (txData.result && txData.result.height) {
          console.log(`First transaction ID: ${firstTxId}`);
          console.log(`Found in block: ${txData.result.height}`);
          return txData.result.height;
        }
      }
    } catch (rpcError) {
      console.log('RPC API attempt failed, falling back to Insight API...');
    }

    // Fallback to Insight API
    console.log(`Trying ${insightApi}...`);
    const response = await fetch(`${insightApi}/addr/${address}`);
    if (!response.ok) {
      throw new Error(`Insight API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.transactions || data.transactions.length === 0) {
      console.log('Could not find transactions. Please verify the address is correct.');
      console.log('Address being checked:', address);
      return null;
    }

    const txs = data.transactions.reverse();
    console.log(`Found ${txs.length} transactions`);

    const firstTxResponse = await fetch(`${insightApi}/tx/${txs[0]}`);
    const firstTx = await firstTxResponse.json();

    if (firstTx && firstTx.blockheight) {
      console.log(`First transaction ID: ${txs[0]}`);
      console.log(`Found in block: ${firstTx.blockheight}`);
      return firstTx.blockheight;
    }

    console.log('Could not determine block height for the first transaction');
    return null;

  } catch (error) {
    console.error('Error:', error);
    return null;
  }
};

const getBestBlockHeight = async (args) => {
  const client = dashClient({ ...args, height: undefined });
  try {
    const height = await client.getDAPIClient().core.getBestBlockHeight();
    return height;
  } finally {
    await client.disconnect();
  }
};

const getUnusedAddress = async (args) => {
  if (!process.env.MNEMONIC) {
    throw new Error('No wallet mnemonic configured');
  }

  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    console.log('Getting wallet account, please wait...')
    const account = await client.getWalletAccount();
    const address = account.getUnusedAddress();
    return { address: address.address };
  } finally {
    await client.disconnect();
  }
};

const findStartHeight = async (address, args) => {
  console.log('Finding the first transaction block for address');
  // Add default network value here
  const network = args.network || 'mainnet';
  const blockHeight = await findFirstTransactionBlock(address, network);
  return blockHeight || 1;
};

const createWallet = async (args) => {
  const client = dashClient(args);
  try {
    const account = await client.getWalletAccount();
    const mnemonic = client.wallet.exportWallet();
    return { mnemonic };
  } finally {
    await client.disconnect();
  }
};

const createIdentity = async (address, args) => {
  const height = await findStartHeight(address, args);
  const client = dashClient({ ...args, height });
  try {
    console.log('Creating identity. Please wait while the core chain syncs...')
    const identity = await client.platform.identities.register();
    return identity.toJSON();
  } finally {
    if (client && client.disconnect) {
      await client.disconnect();
    }
  }
};

const retrieveIdentity = async (identityId, args) => {
  const client = dashClient(args);
  try {
    const identity = await client.platform.identities.get(identityId);
    return identity.toJSON();
  } finally {
    await client.disconnect();
  }
};

const topupIdentity = async (identityId, address, topupAmount, args) => {
  if (!topupAmount) {
    throw new Error(`Topup amount is required. Minimum ${MINIMUM_TOPUP_AMOUNT} duffs = 50000000 credits`);
  }

  const parsedAmount = parseInt(topupAmount);
  if (parsedAmount < MINIMUM_TOPUP_AMOUNT) {
    throw new Error(`Topup amount must be at least ${MINIMUM_TOPUP_AMOUNT} duffs = 50000000 credits`);
  }

  const height = await findStartHeight(address, args);
  const client = dashClient({ ...args, height });
  try {
    console.log('Topping up identity. Please wait while the core chain syncs...')
    await client.platform.identities.topUp(identityId, parsedAmount);
    const updatedIdentity = await client.platform.identities.get(identityId);
    return updatedIdentity.toJSON();
  } finally {
    await client.disconnect();
  }
};

const registerName = async (identityId, identityName, args) => {
  const height = await getBestBlockHeight(args);
  validateIdentityName(identityName);

  const client = dashClient({ ...args, height });
  try {
    const identity = await client.platform.identities.get(identityId);
    console.log('Registering name. Please wait...')
    const nameRegistration = await client.platform.names.register(
      `${identityName}.dash`,
      { identity: identity.getId() },
      identity,
    );
    return nameRegistration.toJSON();
  } finally {
    await client.disconnect();
  }
};

module.exports = {
  createWallet,
  getUnusedAddress,
  createIdentity,
  retrieveIdentity,
  topupIdentity,
  registerName,
  validateIdentityName
};