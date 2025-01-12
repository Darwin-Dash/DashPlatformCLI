# Dash Platform CLI Tool

A command-line interface tool for interacting with the Dash Platform.

## Prerequisites

- Node.js v20 or higher
- NPM or Yarn
- A Dash wallet mnemonic. If you don't have one the tool can create one for you.

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment:
   - Copy `.env.example` to `.env`
   - Set your DAPI addresses (example provided in .env.example)
   - Add your mnemonic if you have one (required for most operations)
   - Set LOG_LEVEL if needed (error/warn/info/debug)

## Available Commands

### Basic Commands:
- `createWallet` - Generate a new wallet and mnemonic
- `getUnusedAddress` - Get a new unused address from your wallet
- `createIdentity` - Create a new Dash Platform identity 
- `retrieveIdentity` - Get details about an existing identity
- `topupIdentity` - Add credits to an identity
- `registerName` - Register a name for an identity

### Command Options:
- `--network` - Select network (mainnet/testnet). If not entered, the default is mainnet
- `--identity-id` - Specify identity ID
- `--height` - Specify block height
- `--address` - Specify Dash address
- `--topup-amount` - Amount for identity topup. Minimum 50000 duffs. 1 duff = 1,000 platform credits.
- `--identity-name` - Name to register

## Usage Examples

### Create a new wallet:
```bash
node dashCLI.js createWallet --network testnet
```

### Get unused address:
```bash
node dashCLI.js getUnusedAddress --network testnet
```

### Create identity:
```bash
node dashCLI.js createIdentity --network testnet --address <core_chain_address_with_funds>
```

### Retrieve identity:
```bash
node dashCLI.js retrieveIdentity --network testnet --identity-id <your-identity-id>
```

### Top up identity:
```bash
node dashCLI.js topupIdentity --network testnet --identity-id <your-identity-id> --address <core_chain_address_with_funds> --topup-amount 50000
```

### Register name:
```bash
node dashCLI.js registerName --network testnet --identity-id <your-identity-id> --identity-name <your-name>
```

## Environment Variables

- `MAINNET_DAPI_ADDRESSES`: JSON array of mainnet DAPI addresses
- `TESTNET_DAPI_ADDRESSES`: JSON array of testnet DAPI addresses
- `LOG_LEVEL`: Logging level (error/warn/info/debug)
- `MNEMONIC`: Your wallet mnemonic

## Error Handling

- The tool includes comprehensive error messages
- Use debug logging for more detailed information
- Check logs when operations fail

## Security Notes

- Keep your mnemonic secure and never share it
- Use testnet for testing
- Backup your wallet information

## Technical Foundation
This CLI tool is built on top of the official Dash Platform JavaScript SDK and follows the patterns established in the Dash Platform tutorials. Specifically:

- Core functionality is based on the Dash Platform JavaScript SDK tutorials
- Client setup follows the pattern from the "Setup SDK Client" tutorial
- Identity operations implemented using the Identity tutorials (register, retrieve, topup)
- Name registration follows the DPNS (Dash Platform Name Service) tutorials
- Document and contract operations follow the Contracts and Documents tutorial patterns
- Error handling and wallet operations based on SDK best practices

The tool abstracts away much of the complexity while providing a consistent command-line interface to the underlying SDK functionality. All operations use the official Dash SDK methods and follow recommended implementation patterns.
For more details on the underlying SDK implementation, see the [Dash Platform SDK Documentation](https://docs.dash.org/projects/platform/en/stable/docs/sdk-js/overview.html)



## FAQ

### Q: What is a mnemonic and why do I need it?
A: A mnemonic is a sequence of words that serves as your wallet's master key. It's required for most operations as it proves ownership of your Dash and allows you to sign transactions.

### Q: What are platform credits?
A: Platform credits are used to pay for operations on Dash Platform. One Dash duff (0.00000001 DASH) converts to 1000 platform credits.

### Q: Why do I need to specify a block height?
A: Block height helps optimize wallet synchronization by starting from a specific point in the blockchain. The tool can automatically find this for an address.

### Q: What is the minimum topup amount?
A: The minimum topup amount is 50000 duffs, which converts to 50,000,000 platform credits.

### Q: What are the identity name requirements?
A: Identity names must:
- Start with a letter or number
- End with a letter or number
- Contain only letters, numbers, and hyphens
- Be between 2 and 63 characters long

### Q: How do I debug issues?
A: Set LOG_LEVEL=debug in your .env file for detailed logging output

### Q: Where do I get DAPI addresses from if the example ones stop functioning?
A: Go to [Dash Platform explorer](https://platform-explorer.com) Validators page and select IP's of Evonodes to use in your .env file.  

## Roadmap

### In testing
- Data contract commands

### In development
- Caching the chain locally with Localforage Adapter
- Better logging and error handling 
