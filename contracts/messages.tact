const CollectionDeployMinTons: Int = ton("0.115");  // 2x0.05[storageReserve] + 0.015[GasFees]
const TransferAuthItemMinTons: Int = ton("0.1");

const MinFeeStorage: Int = 0x38; // 0.01 TON

const VoteStatusError: Int = 0;
const VoteStatusPending: Int = 1;
const VoteStatusExecuted: Int = 2;
const VoteStatusAborted: Int = 3;

// Vote-required Messages: Wallet -> AuthItem -> PetCollection
const VoteOpMintAuthItem: Int = 0x3ef428b9;
const VoteOpUpdateSettings: Int = 0x4219f222;
const VoteOpTransferAuthItem: Int = 0x9d9f8663;

fun enumToSpeciesName(species: Int): String {
    if (species == 1) {
        return "Dog";
    }
    else if (species == 2) {
        return "Cat"
    }
    return "";
}

struct PetMemoryNftImmutableData {
    species: Int as uint4; // 0 - other (see speciesName), 1 - Dog, 2 - Cat, 3... - reserved;
    name: String;
    sex: Int as uint1; // 0 - male, 1 - female
    speciesName: String?;    
    breed: String?;
    lang: Int? as uint10; // ISO 639 two letter language code encoded as 5bits for every letter,
                         // examles: 00100 01101 (0x8D) - "en", 10001 10100 (0x234) - "ru"
    countryCode: Int as uint10; // ISO 3166-1 alpha-2 code, e.g. "ru"; encoded as 5bits for every letter,
                                // examles: 00100 01101 (0x8D) - "en", 10001 10100 (0x234) - "ru"
    location: String?; // It's preferred to use Postal Code
    birthDate: Int as uint32; // 4 octets - year; 2 Octets - month; 2 octets - day; 0x00 - means unspecified or unknown
    deathDate: Int as uint32; // 4 octets - year; 2 Octets - month; 2 octets - day; 0x00 - means unspecified or unknown
}

struct MintAuthItemItem {
    owner: Address;
    isClassB: Bool;    
}

struct TransferAuthItemItem {
    address: Address;
    newOwner: Address;
}

message Excesses {
    queryId: Int as uint64;
}

message(0x3ef428b9) MintAuthItems {
    items: map<Int as uint4, MintAuthItemItem>;
}

message(0x4219f222) UpdateSettings {
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;
    data: NftMutableMetaData?;
}

message(0x9d9f8663) TransferAuthItems {
    items: map<Int as uint4, TransferAuthItemItem>;
}


// PetsCollection Interface
message PutToVote {
    queryId: Int as uint64;
    index: Int as uint4;
    isClassB: Bool;
    message: Cell;
}

message Vote {
    queryId: Int as uint64;
    stateId: Int as uint32;
    index: Int as uint4;
    isClassB: Bool;
    vote: Bool;
}

message VoteReply {
    queryId: Int as uint64;
    stateId: Int as uint32;
    status: Int as uint2;
}

message QueryAuthItemAddress {
    index: Int as uint4;
    isClassB: Bool;
}

message Withdraw {
    queryId: Int as uint64;
    index: Int as uint4;
    isClassB: Bool;
    balanceWithdrawn: Int as coins;
}

message WithdrawReply {
    queryId: Int as uint64;    
    balanceWithdrawn: Int as coins;
    storageReserve: Int as uint8;
}

message MintPetMemoryNft {
    queryId: Int as uint64;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;
    newOwner: Address?;
    content: PetMemoryNftContent;
}

message VoteExecuteResult {
    executor: Address;
    voteAction: VoteAction;
    aborted: Bool;
}

// AuthItem Interface
message AuthItemWithdraw {
    queryId: Int as uint64;
}

message AuthItemWithdrawResult {
    queryId: Int as uint64;
    value: Int;
}

message AuthItemVote {
    queryId: Int as uint64;
    stateId: Int as uint32;
    vote: Bool;    
}

message AuthItemVoteReply {
    queryId: Int as uint64;
    status: Int as uint2;
}

message AuthItemPutToVote {
    queryId: Int as uint64;
    message: Cell;
}

message AuthItemTransfer {
    newOwner: Address;
    balanceWithdrawn: Int as coins;
}

// PetMemoryNft Producer
struct PetMemoryNftContent {
    immData: PetMemoryNftImmutableData;
    data: NftMutableMetaData;
}

struct PetMemoryNftInit {
    immData: PetMemoryNftImmutableData;
    data: NftMutableMetaData;
    storageReserve: Int as uint8;
}

// NFT Collection Interface
struct CollectionData {
    nextItemIndex: Int;
    collectionContent: Cell;
    ownerAddress: Address;
}

// NFT Item Interface
struct NftMutableMetaData {
    uri: String?;
    description: String?;
    image: String?;
    imageData: Cell?;
}

message(0x5fcc3d14) Transfer {
    queryId: Int as uint64;
    newOwner: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x05138d91) OwnershipAssigned {
    queryId: Int as uint64;
    prevOwner: Address;
    forwardPayload: Slice as remaining;
}

message(0x1a0b9d51) EditContent {
    queryId: Int as uint64;
    data: NftMutableMetaData;
}

message(0x2fcb26a2) GetStaticData {
    queryId: Int as uint64;
}

message(0x8b771735) ReportStaticData {
    queryId: Int as uint64;
    indexId: Int;
    collection: Address;
}

struct GetNftData {
    isInitialized: Bool;
    index: Int;
    collectionAddress: Address;
    ownerAddress: Address;
    individualContent: Cell;
}