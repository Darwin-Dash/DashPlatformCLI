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
  .showHelpAfterError('Available commands: createWallet, getUnusedAddress, createIdentity, retrieveIdentity, topupIdentity, registerName')
  .argument('<command>', 'Command to execute')
  .option('--network <network>', 'Network to use (mainnet/testnet)')
  .option('--identity-id <id>', 'Identity ID')
  .option('--height <height>', 'Block height')
  .option('--address <address>', 'Dash address to use')
  .option('--topup-amount <topupAmount>', 'Amount for topup in duffs. Minumum 50000 duffs. 1 duff = 1,000 platform credits')
  .option('--identity-name <identityName>', 'Identity name')
  .action(async (command, options) => {
    log('debug', "Command:", command);
    log('debug', "Options:", options);

    try {
      if (!command || !['createWallet', 'getUnusedAddress', 'createIdentity', 'retrieveIdentity', 'topupIdentity', 'registerName'].includes(command)) {
        throw new Error('Invalid command. Available commands: createWallet, getUnusedAddress, createIdentity, retrieveIdentity, topupIdentity, registerName');
      }
    
      if (!['createWallet'].includes(command) && !process.env.MNEMONIC) {
        throw new Error('Please add your wallet mnemonic to the .env file as MNEMONIC=your_mnemonic');
      }

      if (command === 'createWallet' && process.env.MNEMONIC) {
        throw new Error('Cannot create a new wallet when MNEMONIC environment variable exists. Please remove MNEMONIC from .env file first.');
      }

      // Check for required address parameter
      if (['createIdentity', 'topupIdentity'].includes(command) && !options.address) {
        throw new Error(`${command} requires --address parameter`);
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
          const identity = await dashLibrary.createIdentity(options.address, options);
          console.log('Identity:', identity);
          break;

        case 'retrieveIdentity':
          const retrievedIdentity = await dashLibrary.retrieveIdentity(options.identityId, options);
          console.log('Retrieved Identity:', retrievedIdentity);
          break;

        case 'topupIdentity':
          const updatedIdentity = await dashLibrary.topupIdentity(
            options.identityId,
            options.address,
            options.topupAmount,
            options
          );
          console.log('Updated Identity:', updatedIdentity);
          break;

        case 'registerName':
          const nameRegistration = await dashLibrary.registerName(options.identityId, options.identityName, options);
          console.log('Name Registration:', nameRegistration);
          break;

        default:
          console.log('Available commands: createWallet, getUnusedAddress, createIdentity, retrieveIdentity, topupIdentity, registerName');
          break;
      }
    } catch (error) {
      console.error(error.message);
    }
  });

program.parse();