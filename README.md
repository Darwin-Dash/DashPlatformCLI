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
   - Optionally set IDENTITY_ID, CONTRACT_ID, or DOCUMENT_ID as defaults
   - Command line options override environment variables and env overrides hard coded defaults. (i.e. network is hardcoded as mainnet if no options or variables are defined)

## Available Commands

### Core Operations:
- `createWallet` - Generate a new wallet and mnemonic
- `getUnusedAddress` - Get a new unused address from your wallet 

### Identity Operations:
- `createIdentity` - Create a new Dash Platform identity
- `retrieveIdentity` - Get details about an existing identity
- `topupIdentity` - Add credits to an identity
- `getIdentityIds` - Get all identity IDs associated with your wallet

### Name Operations:
- `registerName` - Register a name for an identity

### Contract Operations:
- `registerContract` - Register a new data contract
- `updateContract` - Update an existing contract
- `retrieveContract` - Get contract details
- `retrieveContractHistory` - Get contract revision history

### Document Operations:
- `submitDocument` - Create, update, or delete documents
  - For create: Creates a new document (`--action create --document-data '{...}'`)
  - For replace: Updates existing document (`--action replace --document-id <id> --document-data '{...}'`)
  - For delete: Removes document (`--action delete --document-id <id> --document-data '{}'`)
- `retrieveDocuments` - Get documents from a contract
- `deleteDocument` - Delete a document (alternative to `submitDocument --action delete `)

## Common Command Options:
- `--network <network>` - Select network (mainnet/testnet)
- `--identity-id <id>` - Specify identity ID
- `--height <height>` - Specify block height
- `--address <address>` - Specify Dash address
- `--topup-amount <amount>` - Amount for identity topup. Minimum 50000 duffs. 1 duff = 1,000 platform credits.
- `--identity-name <name>` - Name to register
- `--contract-id <id>` - Contract ID
- `--document-type <type>` - Document type 
- `--document-id <id>` - Document ID
- `--document-data <json>` - Document data
- `--contract-def <json>` - Contract definition
- `--new-properties <json>` - Properties for contract update
- `--indices <json>` - Indices for contract
- `--keep-history` - Enable contract history. true/false
- `--query <json>` - Query options for retrieving documents
- `--action <type>` - Document action (create/replace/delete)

## Name Operations & Username Rules

### Username Requirements
- Length: 2-63 characters
- Must start and end with alphanumeric characters
- Allowed characters: Letters (a-z, case insensitive), numbers (0-9), and hyphens
- Cannot start or end with a hyphen
- No spaces or special characters

### Username Costs
- Premium names: 20000000000 Credits (20000000 duffs/0.2 DASH)
  - Criteria:
    - Less than 20 characters long (i.e. “alice”, “quantumexplorer”)
    - Contain no numbers or only contain the number(s) 0 and/or 1 (i.e. “bob”, “carol01”)
    - Must go though the voting process
- Standard names: 100000000 Credits (100000 duffs/0.001 DASH)
  - Criteria:
    - More than 20 characters long (i.e: dashevolutionplatformcli)
    - Contains numbers (i.e: “quantumexplorer2025”)
    - Does not go through the voting process

### Username Rules
- Your identity needs sufficient credits
- Cannot register names already taken
- Names cannot be transferred (as of current version of Dash Platform but is planned)

## Document Types

### What is a document-type?
The `--document-type` parameter refers to the data structure you defined in your contract. Think of it like a collection or table name that groups similar documents together. When you create a contract, you define one or more document types that specify what kind of data can be stored.

### Usage
When using commands that interact with documents (submitDocument, retrieveDocuments, deleteDocument), you must specify which document type you're working with using the `--document-type` parameter. This should match exactly with the document type name defined in your contract.

### Best Practices
- Use clear, descriptive names
- Keep names lowercase
- Use singular form (e.g., 'note' not 'notes')
- Avoid special characters

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

### Get all identity IDs:
```bash
node dashCLI.js getIdentityIds --network testnet
```

### Register name:
```bash
node dashCLI.js registerName --network testnet --identity-id <your-identity-id> --identity-name <your-name>
```

### Register a basic contract (no index):
```bash
node dashCLI.js registerContract --network testnet --identity-id <identity_id> --contract-def '{"note":{"type":"object","properties":{"message":{"type":"string","position":0}},"additionalProperties":false}}'
```

### Register a basic contract with version history (no index):
```bash
node dashCLI.js registerContract --network testnet --identity-id <identity_id> --contract-def '{"note":{"type":"object","properties":{"message":{"type":"string","position":0}},"additionalProperties":false}}' --keep-history true
```

### Register a contract with searchable fields:
```bash
node dashCLI.js registerContract --network testnet --identity-id <identity_id> --contract-def '{
  "note": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "maxLength": 63,
        "position": 0
      }
    },
    "indices": [
      {
        "name": "message",
        "properties": [{"message": "asc"}],
        "unique": false
      }
    ],
    "additionalProperties": false
  }
}'
```

### Update a contract:
#### Add a new property to an existing document type
```bash
node dashCLI.js updateContract --network testnet \
  --identity-id <your-identity-id> \
  --contract-id <your-contract-id> \
  --document-type <document-type> \
  --new-properties '{"author":{"type":"string","position":1}}'
```

### Retrieve a contract:
```bash
node dashCLI.js retrieveContract --network testnet --contract-id <your-contract-id>
```

### Get contract revision history:
#### Retrieves all revisions of a contract that has history enabled
```bash
node dashCLI.js retrieveContractHistory --network testnet --contract-id <your-contract-id>
```

### Submit/update/delete documents:
#### Create new document:
```bash
node dashCLI.js submitDocument --network testnet \
  --identity-id <identity_id> \
  --contract-id <contract_id> \
  --document-type <document-type> \
  --document-data '{"message":"Hello World"}' \
  --action create
```

#### Update existing document:
```bash
node dashCLI.js submitDocument --network testnet \
  --identity-id <identity_id> \
  --contract-id <contract_id> \
  --document-type <document-type> \
  --document-id <document_id> \
  --document-data '{"message":"Updated message"}' \
  --action replace
```

#### Delete document (Option 1):
```bash
node dashCLI.js submitDocument --network testnet \
  --identity-id <identity_id> \
  --contract-id <contract_id> \
  --document-type <document-type> \
  --document-id <document_id> \
  --action delete
```

#### Delete document (Option 2):
```bash
node dashCLI.js deleteDocument --network testnet \
  --identity-id <identity_id> \
  --contract-id <contract_id> \
  --document-type <document-type> \
  --document-id <document_id>
```

### Retrieve documents:
#### Get all documents of a type
#### With non-indexed contract:
```bash
node dashCLI.js retrieveDocuments --network testnet \
  --contract-id <your-contract-id> \
  --document-type <document-type>
```

#### With indexed contract:
##### Search by exact message
```bash
node dashCLI.js retrieveDocuments --network testnet --contract-id <contract_id> --document-type <document-type> --query '{"where":[["message","==","Hello World"]],"limit":10}'
```
##### Search by message prefix
```bash
node dashCLI.js retrieveDocuments --network testnet --contract-id <contract_id> --document-type <document-type> --query '{"where":[["message","startsWith","Hello"]],"orderBy":[["message","asc"]],"limit":10}'
```

#### Get a specific document by ID
```bash
node dashCLI.js retrieveDocuments --network testnet \
  --contract-id <your-contract-id> \
  --document-type <document-type> \
  --document-id <your-document-id>

## Environment Variables

- `MAINNET_DAPI_ADDRESSES`: JSON array of mainnet DAPI addresses
- `TESTNET_DAPI_ADDRESSES`: JSON array of testnet DAPI addresses
- `NETWORK`: Default network to use (mainnet/testnet)
- `LOG_LEVEL`: Logging level (error/warn/info/debug)
- `MNEMONIC`: Your wallet mnemonic
- `IDENTITY_ID`: Default identity ID to use (overrides --identity-id)
- `CONTRACT_ID`: Default contract ID to use (overrides --contract-id) 
- `DOCUMENT_ID`: Default document ID to use (overrides --document-id)

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

## Who is this for?

- Dash Enthusiasts who want to create Ids and register names
- Dash Platform App Developers who want to use this is a reference for their own project and as a simple tool to interact with Dash Platform from their Dev Environment

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
A: Go to [Dash Platform explorer](https://platform-explorer.com) Validators page and select IP's of Evonodes to use in your .env file


## Reference Links
- https://docs.dash.org/projects/platform/en/stable/docs/resources/faq.html
- https://docs.dash.org/projects/platform/en/stable/docs/explanations/dpns.html#

## Roadmap

### In development
- Caching the chain locally with Localforage Adapter
- Better logging and error handling

### Future development
- BIP44 Account Support 
- Tokens support
- NFT support
- Progess indicator
- Contract, Document and query validation
- Identity key management
- Credit transfers between identities
- Credit withdrawals to core chain
- Advanced name search and resolution
- Paginated document queries
