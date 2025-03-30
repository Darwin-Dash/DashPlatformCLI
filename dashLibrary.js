const { dashClient, walletClient } = require("./dashClient");
const util = require("util");

// Helper functions to get IDs from either command line args or environment variables
// This provides flexibility in how IDs are provided to the CLI
const getIdentityId = (args) => args.identityId || process.env.IDENTITY_ID;
const getContractId = (args) => args.contractId || process.env.CONTRACT_ID;
const getDocumentId = (args) => args.documentId || process.env.DOCUMENT_ID;
const getAddress = (args) => args.address || process.env.ADDRESS;

// Constants for platform operations
const MINIMUM_TOPUP_AMOUNT = 50000; // Minimum amount in duffs for identity topup
// Regex for validating identity names per Dash Platform specification
const IDENTITY_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;

// Validation functions
const validateIdentityName = (name) => {
  if (!IDENTITY_NAME_REGEX.test(name)) {
    throw new Error(
      "Invalid identity name. Name must:\n" +
        "- Start with a letter or number\n" +
        "- End with a letter or number\n" +
        "- Contain only letters, numbers, and hyphens\n" +
        "- Be between 2 and 63 characters long",
    );
  }
  return true;
};

// Validates contract indices both for single index and array of indices
// Ensures all required fields are present and correctly typed
const validateIndices = (indices) => {
  if (!Array.isArray(indices)) {
    // Convert single index to array for uniform processing
    indices = [indices];
  }

  indices.forEach((index) => {
    if (!index.name) {
      throw new Error("Index must have a name");
    }
    if (!index.properties || !Array.isArray(index.properties)) {
      throw new Error("Index must have properties array");
    }
    if (typeof index.unique !== "boolean") {
      throw new Error("Index must specify unique as boolean");
    }
  });
  return indices;
};

// Comprehensive contract definition validator
// Ensures the contract follows Dash Platform specification
const validateContractDefinition = (contractDef) => {
  // Handle both string and object input formats
  const def =
    typeof contractDef === "string" ? JSON.parse(contractDef) : contractDef;

  // Basic structure validation
  if (!def || typeof def !== "object" || Object.keys(def).length === 0) {
    throw new Error("Contract must define at least one document type");
  }

  // Validate each document type definition
  Object.entries(def).forEach(([docType, schema]) => {
    // Each document type must be an object
    if (schema.type !== "object") {
      throw new Error(`Document type '${docType}' must have type:'object'`);
    }

    // Properties object is required and must be properly structured
    if (!schema.properties || typeof schema.properties !== "object") {
      throw new Error(`Document type '${docType}' must define properties`);
    }

    // Validate each property has required fields
    Object.entries(schema.properties).forEach(([propName, propDef]) => {
      if (!propDef.type) {
        throw new Error(
          `Property '${propName}' in '${docType}' must have type`,
        );
      }
      // Position is required for backwards compatibility in contract updates
      if (typeof propDef.position !== "number") {
        throw new Error(
          `Property '${propName}' in '${docType}' must have numeric position`,
        );
      }
    });

    // additionalProperties must be explicitly set for schema validation
    if (typeof schema.additionalProperties !== "boolean") {
      throw new Error(
        `Document type '${docType}' must specify additionalProperties as boolean`,
      );
    }
  });

  return true;
};

//Find the starting block height for a Dash address by looking up its first transaction.
//This optimizes wallet synchronization by starting from the block where the address was first used.

//Uses two APIs with fallback:
//1. RPC API (primary) - Faster but may have temporary issues
//2. Insight API (fallback) - More stable but slower
const findStartHeight = async (args) => {
  console.log("Finding the first transaction block for address");
  const address = getAddress(args);
  if (!address) {
    throw new Error("Address is required for this operation");
  }

  // Determine network with fallback chain: CLI args -> Environment -> Default mainnet
  const network = args.network || process.env.NETWORK || "mainnet";

  try {
    // Define API endpoints based on network
    const insightApi =
      network === "testnet"
        ? "https://insight.testnet.networks.dash.org/insight-api"
        : "https://insight.dash.org/insight-api";

    const rpcUrl =
      network === "testnet"
        ? "https://trpc.digitalcash.dev/"
        : "https://rpc.digitalcash.dev/";

    // PRIMARY: Try RPC API first (faster)
    try {
      console.log(`Trying ${rpcUrl}...`);
      // Step 1: Get all transaction IDs for the address
      const txidsResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "getaddresstxids",
          params: [
            {
              addresses: [address],
            },
          ],
        }),
      });

      // Check for RPC API errors
      if (!txidsResponse.ok) {
        throw new Error(`RPC API returned status ${txidsResponse.status}`);
      }

      const txidsData = await txidsResponse.json();

      // Validate transaction data exists
      if (
        !txidsData.result ||
        !Array.isArray(txidsData.result) ||
        txidsData.result.length === 0
      ) {
        throw new Error("No transactions found in RPC response");
      }

      // Get the first (oldest) transaction ID
      const firstTxId = txidsData.result[0];

      // Step 2: Get detailed transaction data to find block height
      const txResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "getrawtransaction",
          params: [firstTxId, true],
        }),
      });

      // Check for transaction lookup errors
      if (!txResponse.ok) {
        throw new Error(
          `RPC API returned status ${txResponse.status} for transaction lookup`,
        );
      }

      const txData = await txResponse.json();

      // Validate block height exists and is valid
      if (
        !txData.result ||
        !txData.result.height ||
        txData.result.height <= 0
      ) {
        throw new Error("Invalid or missing block height in transaction data");
      }

      console.log(`First transaction ID: ${firstTxId}`);
      console.log(`Found in block: ${txData.result.height}`);
      return txData.result.height;
    } catch (rpcError) {
      // If RPC fails, log error and try Insight API
      console.log(
        "RPC API attempt failed, falling back to Insight API...",
        rpcError.message,
      );

      // FALLBACK: Try Insight API
      try {
        console.log(`Trying ${insightApi}...`);

        // Step 1: Get address information including transactions
        const response = await fetch(`${insightApi}/addr/${address}`);

        if (!response.ok) {
          throw new Error(`Insight API returned status ${response.status}`);
        }

        const data = await response.json();

        // Validate address has transactions
        if (
          !data ||
          !data.transactions ||
          !Array.isArray(data.transactions) ||
          data.transactions.length === 0
        ) {
          throw new Error("No transactions found in Insight API response");
        }

        // Get transactions in reverse order (oldest first)
        const txs = data.transactions.reverse();
        console.log(`Found ${txs.length} transactions`);

        // Step 2: Get first transaction details
        const firstTxResponse = await fetch(`${insightApi}/tx/${txs[0]}`);

        if (!firstTxResponse.ok) {
          throw new Error(
            `Insight API returned status ${firstTxResponse.status} for transaction lookup`,
          );
        }

        const firstTx = await firstTxResponse.json();

        // Validate block height exists and is valid
        if (!firstTx || !firstTx.blockheight || firstTx.blockheight <= 0) {
          throw new Error(
            "Invalid or missing block height in transaction data",
          );
        }

        console.log(`First transaction ID: ${txs[0]}`);
        console.log(`Found in block: ${firstTx.blockheight}`);
        return firstTx.blockheight;
      } catch (insightError) {
        // If both APIs fail for valid reasons (e.g., new address with no transactions)
        throw new Error(
          "No transactions found for this address. Please verify the address is correct and has transaction history.",
        );
      }
    }
  } catch (error) {
    // Catch any unexpected errors
    throw new Error(`Could not find transaction history: ${error.message}`);
  }
};

// Helper function to get current best block height
// Used for optimizing wallet sync
const getBestBlockHeight = async (args) => {
  const client = dashClient({ ...args });
  try {
    const height = await client.getDAPIClient().core.getBestBlockHeight();
    return height;
  } finally {
    await client.disconnect();
  }
};

const getUnusedAddress = async (args) => {
  if (!process.env.MNEMONIC) {
    throw new Error("No wallet mnemonic configured");
  }

  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    console.log("Getting wallet account, please wait...");
    const account = await client.getWalletAccount();
    const address = account.getUnusedAddress();
    return { address: address.address };
  } finally {
    await client.disconnect();
  }
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

const createIdentity = async (args) => {
  const address = getAddress(args);
  if (!address) {
    throw new Error("Address is required for creating an identity");
  }
  const height = await findStartHeight(args);
  const client = dashClient({ ...args, height });
  try {
    console.log("Creating identity. Please wait while the core chain syncs...");
    const identity = await client.platform.identities.register();
    return identity.toJSON();
  } catch (error) {
    throw new Error(`Failed to create identity: ${error.message}`);
  } finally {
    await client.disconnect();
  }
};

const retrieveIdentity = async (args) => {
  const identityId = getIdentityId(args);
  if (!identityId) {
    throw new Error("Identity ID is required.");
  }
  const client = dashClient(args);
  try {
    const identity = await client.platform.identities.get(identityId);
    return identity.toJSON();
  } finally {
    await client.disconnect();
  }
};

const topupIdentity = async (args) => {
  // Get values from either args or env vars
  const identityId = getIdentityId(args);
  const address = getAddress(args);
  const topupAmount = args.topupAmount;

  // Validate required params
  if (!identityId) {
    throw new Error("Identity ID is required.");
  }

  if (!address) {
    throw new Error("Address is required.");
  }

  if (!topupAmount) {
    throw new Error(
      `Topup amount is required. Minimum ${MINIMUM_TOPUP_AMOUNT} duffs = 50000000 credits`,
    );
  }

  const parsedAmount = parseInt(topupAmount);
  if (parsedAmount < MINIMUM_TOPUP_AMOUNT) {
    throw new Error(
      `Topup amount must be at least ${MINIMUM_TOPUP_AMOUNT} duffs = 50000000 credits`,
    );
  }

  const height = await findStartHeight(args);
  const client = dashClient({ ...args, height });
  try {
    console.log(
      "Topping up identity. Please wait while the core chain syncs...",
    );
    await client.platform.identities.topUp(identityId, parsedAmount);
    const updatedIdentity = await client.platform.identities.get(identityId);
    return updatedIdentity.toJSON();
  } finally {
    await client.disconnect();
  }
};

const registerName = async (args) => {
  if (!args.identityName) {
    throw new Error("Identity Name is required.");
  }
  const height = await getBestBlockHeight(args);
  validateIdentityName(args.identityName);

  const client = dashClient({ ...args, height });
  try {
    const identityId = getIdentityId(args);
    const identity = await client.platform.identities.get(identityId);
    console.log("Registering name. Please wait...");
    const nameRegistration = await client.platform.names.register(
      `${args.identityName}.dash`,
      { identity: identity.getId() },
      identity,
    );
    return nameRegistration.toJSON();
  } finally {
    await client.disconnect();
  }
};

const getIdentityIds = async (args) => {
  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    const account = await client.getWalletAccount();
    const identityIds = await account.identities.getIdentityIds();
    return identityIds;
  } finally {
    await client.disconnect();
  }
};

const registerContract = async (args) => {
  const identityId = getIdentityId(args);
  if (!identityId) {
    throw new Error("Identity ID is required.");
  }
  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    const identity = await client.platform.identities.get(identityId);

    // Validate and parse contract definition
    validateContractDefinition(args.contractDef);
    const documents = JSON.parse(args.contractDef);

    // If indices are provided separately, merge them into the contract
    if (args.indices) {
      try {
        const newIndices = JSON.parse(args.indices);
        const validatedIndices = validateIndices(newIndices);

        Object.keys(documents).forEach((docType) => {
          if (!args.documentType || docType === args.documentType) {
            documents[docType].indices = documents[docType].indices || [];
            documents[docType].indices = [
              ...documents[docType].indices,
              ...validatedIndices,
            ];
          }
        });
      } catch (e) {
        throw new Error(`Invalid indices format: ${e.message}`);
      }
    }

    const contract = await client.platform.contracts.create(
      documents,
      identity,
    );

    if (args.keepHistory) {
      contract.setConfig({
        keepsHistory: true,
      });
    }

    await client.platform.contracts.publish(contract, identity);
    return util.inspect(contract.toJSON(), { depth: null, colors: true });
  } finally {
    await client.disconnect();
  }
};

const updateContract = async (args) => {
  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    const identityId = getIdentityId(args);
    const contractId = getContractId(args);

    if (!identityId) {
      throw new Error("Identity ID is required.");
    }
    if (!contractId) {
      throw new Error("Contract ID is required.");
    }

    const identity = await client.platform.identities.get(identityId);
    const existingContract = await client.platform.contracts.get(contractId);

    // Get the existing document schema
    const documentSchema = existingContract.getDocumentSchema(
      args.documentType,
    );
    if (!documentSchema) {
      throw new Error(
        `Document type '${args.documentType}' not found in contract`,
      );
    }

    // Create a deep copy of the existing schema to work with
    const updatedSchema = JSON.parse(JSON.stringify(documentSchema));

    // Parse and add new properties from JSON string
    if (args.newProperties) {
      const newProperties = JSON.parse(args.newProperties);

      // Validate that new property positions don't conflict with existing ones
      const existingPositions = new Set(
        Object.values(updatedSchema.properties).map((prop) => prop.position),
      );

      Object.entries(newProperties).forEach(([propName, propDef]) => {
        if (existingPositions.has(propDef.position)) {
          throw new Error(
            `Position ${propDef.position} is already used by another property`,
          );
        }
        if (typeof propDef.position !== "number") {
          throw new Error(
            `Property '${propName}' must have a numeric position`,
          );
        }
        if (!propDef.type) {
          throw new Error(`Property '${propName}' must have a type`);
        }
      });

      // Merge new properties with existing ones
      updatedSchema.properties = {
        ...updatedSchema.properties,
        ...newProperties,
      };
    }

    // Handle indices if provided
    if (args.indices) {
      let newIndices;
      try {
        newIndices = JSON.parse(args.indices);
        newIndices = validateIndices(newIndices);
      } catch (e) {
        throw new Error(`Invalid indices format: ${e.message}`);
      }

      // Merge with existing indices or create new indices array
      updatedSchema.indices = updatedSchema.indices || [];
      updatedSchema.indices = [...updatedSchema.indices, ...newIndices];
    }

    // Update the contract with the modified schema
    existingContract.setDocumentSchema(args.documentType, updatedSchema);

    // Sign and submit the updated contract
    await client.platform.contracts.update(existingContract, identity);
    return util.inspect(existingContract.toJSON(), {
      depth: null,
      colors: true,
    });
  } catch (error) {
    throw new Error(`Failed to update contract: ${error.message}`);
  } finally {
    await client.disconnect();
  }
};

const retrieveContract = async (args) => {
  const contractId = getContractId(args);
  if (!contractId) {
    throw new Error("Contract ID is required.");
  }
  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    const contract = await client.platform.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract not found with ID: ${contractId}`);
    }

    return util.inspect(contract.toJSON(), { depth: null, colors: true });
  } catch (error) {
    throw new Error(`Failed to retrieve contract: ${error.message}`);
  } finally {
    await client.disconnect();
  }
};

const retrieveContractHistory = async (args) => {
  const contractId = getContractId(args);
  if (!contractId) {
    throw new Error("Contract ID is required.");
  }
  const client = dashClient(args);
  try {
    const history = await client.platform.contracts.history(
      contractId,
      0,
      10,
      0,
    );
    const formattedHistory = {};
    Object.entries(history).forEach(([timestamp, contract]) => {
      formattedHistory[timestamp] = contract.toJSON();
    });
    return util.inspect(formattedHistory, { depth: null, colors: true });
    return history;
  } finally {
    await client.disconnect();
  }
};

const submitDocument = async (args) => {
  const identityId = getIdentityId(args);
  const contractId = getContractId(args);

  if (!identityId) {
    throw new Error("Identity ID is required.");
  }
  if (!contractId) {
    throw new Error("Contract ID is required.");
  }

  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    const identity = await client.platform.identities.get(identityId);
    let document;
    if (args.action === "create") {
      if (!args.documentData) {
        throw new Error("document-data is required for create action");
      }
      // Create new document
      const docData = JSON.parse(args.documentData);
      document = await client.platform.documents.create(
        `myContract.${args.documentType}`,
        identity,
        docData,
      );
    } else {
      // For replace/delete, first fetch existing document
      const documentId = getDocumentId(args);
      if (!documentId) {
        throw new Error("Document ID is required.");
      }
      const [existingDocument] = await client.platform.documents.get(
        `myContract.${args.documentType}`,
        { where: [["$id", "==", documentId]] },
      );

      if (!existingDocument) {
        throw new Error(`Document not found with ID: ${documentId}`);
      }

      if (args.action === "replace") {
        if (!args.documentData) {
          throw new Error("document-data is required for replace action");
        }
        // Update document with new data
        const docData = JSON.parse(args.documentData);
        Object.entries(docData).forEach(([key, value]) => {
          existingDocument.set(key, value);
        });
      }
      document = existingDocument;
    }

    const documentBatch = {
      create: args.action === "create" ? [document] : [],
      replace: args.action === "replace" ? [document] : [],
      delete: args.action === "delete" ? [document] : [],
    };

    await client.platform.documents.broadcast(documentBatch, identity);
    return document.toJSON();
  } finally {
    await client.disconnect();
  }
};

const retrieveDocuments = async (args, queryOpts = {}) => {
  const documentId = getDocumentId(args);
  const client = dashClient(args);
  try {
    if (documentId) {
      queryOpts.where = [["$id", "==", documentId]];
    }

    const documents = await client.platform.documents.get(
      `myContract.${args.documentType}`,
      queryOpts,
    );
    return documents.map((doc) => doc.toJSON());
  } finally {
    await client.disconnect();
  }
};

const deleteDocument = async (args) => {
  const identityId = getIdentityId(args);
  const documentId = getDocumentId(args);

  if (!identityId) {
    throw new Error("Identity ID is required.");
  }
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const height = await getBestBlockHeight(args);
  const client = dashClient({ ...args, height });
  try {
    const identity = await client.platform.identities.get(identityId);
    const [document] = await client.platform.documents.get(
      `myContract.${args.documentType}`,
      { where: [["$id", "==", documentId]] },
    );

    if (!document) {
      throw new Error(`Document not found with ID: ${documentId}`);
    }

    await client.platform.documents.broadcast({ delete: [document] }, identity);
    return document.toJSON();
  } finally {
    await client.disconnect();
  }
};

// Key Management Functions
const listIdentityPublicKeys = async (args) => {
  let client;
  try {
    const identityId = getIdentityId(args);
    if (!identityId) {
      throw new Error("Identity ID is required");
    }

    const height = await getBestBlockHeight(args);
    client = dashClient({ ...args, height });
    const identity = await client.platform.identities.get(identityId);

    if (!identity) {
      throw {
        code: "IDENTITY_NOT_FOUND",
        message: "Identity not found",
        suggestions: [
          "Check if the identity ID is correct",
          "Ensure the identity exists on the network",
          "Verify network connectivity",
        ],
      };
    }

    const keys = identity.getPublicKeys();
    // Return keys array converted to JSON-friendly format
    return keys.map((key) => ({
      id: key.getId().toString(),
      type: key.getType(),
      purpose: key.getPurpose(),
      data: key.getData().toString("hex"),
      readOnly: key.isReadOnly(),
      disabledAt: key.getDisabledAt(),
    }));
  } catch (error) {
    throw error;
  } finally {
    await client.disconnect();
  }
};

const getPrivateKeyFromPublicKey = async (args) => {
  const height = await getBestBlockHeight(args);
  const client = walletClient({ ...args, height });

  const account = await client.wallet.getAccount();
  await account.isReady();

  const identityId = getIdentityId(args);
  const publicKeyId = args.publicKeyId;

  if (!identityId || !publicKeyId) {
    throw new Error("Identity ID and Public Key ID are required");
  }

  try {
    // Get the key index from the identity's keys
    const identity = await client.platform.identities.get(identityId);
    const keys = identity.getPublicKeys();
    const keyIndex = keys.findIndex(
      (key) => key.getData().toString("hex") === publicKeyId,
    );

    if (keyIndex === -1) {
      throw new Error("Public key not found in identity");
    }

    const privateKey = await client.wallet.identities.getIdentityHDKeyById(
      identityId,
      keyIndex,
    );
    return privateKey.privateKey.toString();
  } catch (error) {
    throw error;
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
  getIdentityIds,
  registerContract,
  updateContract,
  retrieveContract,
  retrieveContractHistory,
  submitDocument,
  retrieveDocuments,
  deleteDocument,
  listIdentityPublicKeys,
  getPrivateKeyFromPublicKey,
};
