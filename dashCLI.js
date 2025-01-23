const { program } = require('commander');
const dashLibrary = require('./dashLibrary');

const LOG_LEVEL = process.env.LOG_LEVEL || 'error';

function log(level, ...args) {
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(LOG_LEVEL);
  const messageLevelIndex = levels.indexOf(level);

  if (messageLevelIndex <= currentLevelIndex) {
    console.log(`[${level.toUpperCase()}]`, ...args);
  }
}

program
  .name('dashCLI')
  .description('CLI for Dash Platform operations')
  .showHelpAfterError('Available commands: createWallet, getUnusedAddress, createIdentity, retrieveIdentity, topupIdentity, registerName, getIdentityIds, registerContract, updateContract, retrieveContract, retrieveContractHistory, submitDocument, retrieveDocuments, deleteDocument')
  .argument('<command>', 'Command to execute')
  .option('--network <network>', 'Network to use (mainnet/testnet)')
  .option('--identity-id <id>', 'Identity ID')
  .option('--height <height>', 'Block height')
  .option('--address <address>', 'Dash address to use')
  .option('--topup-amount <topupAmount>', 'Amount for topup in duffs. Minumum 50000 duffs. 1 duff = 1,000 platform credits')
  .option('--identity-name <identityName>', 'Identity name')
  .option('--contract-id <id>', 'Contract ID')
  .option('--document-type <type>', 'Document type')
  .option('--contract-def <json>', 'Contract definition')
  .option('--new-properties <json>', 'New properties for contract update')
  .option('--indices <json>', 'Indices for contract create/update')
  .option('--keep-history', 'Enable contract history tracking')
  .option('--document-id <id>', 'Document ID for update/delete operations')
  .option('--document-data <json>', 'Document data for create/update')
  .option('--query <json>', 'Query options for document retrieval')
  .option('--action <type>', 'Document action type (create/replace/delete)')
  .action(async (command, options) => {
    log('debug', "Command:", command);
    log('debug', "Options:", options);

    try {
      if (!command || !['createWallet', 'getUnusedAddress', 'createIdentity', 'retrieveIdentity', 'topupIdentity', 'registerName', 'getIdentityIds', 'registerContract', 'updateContract', 'retrieveContract', 'retrieveContractHistory', 'submitDocument', 'retrieveDocuments', 'deleteDocument'].includes(command)) {
        throw new Error('Invalid command. Available commands: createWallet, getUnusedAddress, createIdentity, retrieveIdentity, topupIdentity, registerName, getIdentityIds, registerContract, updateContract, retrieveContract, retrieveContractHistory, submitDocument, retrieveDocuments, deleteDocument');
      }

      if (command === 'registerContract' && options.keepHistory === undefined) {
        options.keepHistory = false;
      }
    
      if (!['createWallet'].includes(command) && !process.env.MNEMONIC) {
        throw new Error('Please add your wallet mnemonic to the .env file as MNEMONIC=your_mnemonic');
      }

      if (command === 'createWallet' && process.env.MNEMONIC) {
        throw new Error('Cannot create a new wallet when MNEMONIC environment variable exists. Please remove MNEMONIC from .env file first.');
      }

      // Check for required address parameter
      if (['createIdentity', 'topupIdentity'].includes(command) && !options.address && !process.env.ADDRESS) {
        throw new Error(`${command} requires --address parameter or ADDRESS environment variable`);
      }

      // Set address from environment variable if not provided in options
      if (!options.address && process.env.ADDRESS) {
        options.address = process.env.ADDRESS;
      }

      if (!options.identityId && process.env.IDENTITY_ID) {
        options.identityId = process.env.IDENTITY_ID;
      }
      if (!options.contractId && process.env.CONTRACT_ID) {
        options.contractId = process.env.CONTRACT_ID;
      }
      if (!options.documentId && process.env.DOCUMENT_ID) {
        options.documentId = process.env.DOCUMENT_ID;
      }

      switch (command) {
        case 'createWallet':
          const wallet = await dashLibrary.createWallet(options);
          console.log('Wallet mnemonic:', wallet.mnemonic);
          break;

        case 'getUnusedAddress':
          const address = await dashLibrary.getUnusedAddress(options);
          console.log('New unused address:', address.address);
          break;

        case 'createIdentity':
          const identity = await dashLibrary.createIdentity(options);
          console.log('Identity:', identity);
          break;

        case 'retrieveIdentity':
          const retrievedIdentity = await dashLibrary.retrieveIdentity(options);
          console.log('Retrieved Identity:', retrievedIdentity);
          break;

        case 'topupIdentity':
          const updatedIdentity = await dashLibrary.topupIdentity(options);
          console.log('Updated Identity:', updatedIdentity);
          break;

        case 'registerName':
          const nameRegistration = await dashLibrary.registerName(options);
          console.log('Name Registration:', nameRegistration);
          break;
        
        case 'getIdentityIds':
          const identityIds = await dashLibrary.getIdentityIds(options);
          console.log('Identity IDs:', identityIds);
          break;

        case 'registerContract':
          if (!options.contractDef) {
            throw new Error('Contract definition required');
          }
          try {
            const contract = await dashLibrary.registerContract(options);
            console.log('Contract registered:', contract);
          } catch (error) {
            console.error('Contract validation failed:', error.message);
          }
          break;

        case 'updateContract':
          if (!options.newProperties && !options.indices) {
            throw new Error('New properties or indices required');
          }
          if (!options.identityId) {
            throw new Error('Identity ID is required for updating contracts');
          }
          const updatedContract = await dashLibrary.updateContract(options);
          console.log('Contract updated:', updatedContract);
          break;

        case 'retrieveContract':
          const retrievedContract = await dashLibrary.retrieveContract(options);
          console.log('Contract:', retrievedContract);
          break;

        case 'retrieveContractHistory':
          const contractHistory = await dashLibrary.retrieveContractHistory(options);
          console.log('Contract History:', contractHistory);
          break;

        case 'submitDocument':
          if (!options.identityId) {
            throw new Error('Identity ID is required for submitting documents');
          }
          if (!options.contractId || !options.documentType) {
            throw new Error('Contract ID and document type are required');
          }
          if (!options.action) {
            throw new Error('Action (create/replace/delete) is required');
          }
          if (options.action !== 'delete' && !options.documentData) {
            throw new Error('Document data is required for create/replace actions');
          }
          const submitResult = await dashLibrary.submitDocument(options);
          console.log('Document submitted:', submitResult);
          break;

        case 'retrieveDocuments':
          if (!options.contractId || !options.documentType) {
            throw new Error('Contract ID and document type are required');
          }
          const queryOpts = options.query ? JSON.parse(options.query) : {};
          const docs = await dashLibrary.retrieveDocuments(options, queryOpts);
          console.log('Documents retrieved:', docs);
          break;

        case 'deleteDocument':
          if (!options.identityId) {
            throw new Error('Identity ID is required for deleting documents');
          }
          if (!options.contractId || !options.documentType) {
            throw new Error('Contract ID and document type are required');
          }
          if (!options.documentId) {
            throw new Error('Document ID is required for deletion');
          }

          const deleteResult = await dashLibrary.deleteDocument(options);
          console.log('Document deleted:', deleteResult);
          break;

        default:
          console.log('Available commands: createWallet, getUnusedAddress, createIdentity, retrieveIdentity, topupIdentity, registerName, registerContract, updateContract, retrieveContract, retrieveContractHistory, submitDocument, retrieveDocuments, deleteDocument');
          break;
      }
    } catch (error) {
      console.error(error.message);
    }
  });

program.parse();