const MintPetMemoryNftGasFeeMin: Int = ton("0.014");
const MintPetMemoryNftFwdFeeMin: Int = ton("0.01");
const PetMemoryNftTransferGasFeeMin: Int = ton("0.01");
const PetMemoryNftTransferGasAndFwdFeeMin: Int = MintPetMemoryNftFwdFeeMin + PetMemoryNftTransferGasFeeMin;

const DonateGasFeeMin: Int = ton("0.007");
const DonateReplyGasFeeMin: Int = ton("0.008");

const SecondsInYear: Int = 31536000; // 365 * 24 * 60 * 60 

const MinFeeStorage: Int = 0x38; // 0.01 TON
const MinFeeClassA: Int = 0x30; // 0.001 TON

const VoteStatusError: Int = 0;
const VoteStatusPending: Int = 1;
const VoteStatusExecuted: Int = 2;
const VoteStatusAborted: Int = 3;

// Vote-required Messages: Wallet -> AuthItem -> PetCollection
const VoteOpMintAuthItem: Int = 0x3ef428b9;
const VoteOpUpdateSettings: Int = 0x4219f222;
const VoteOpTransferAuthItem: Int = 0x9d9f8663;

fun speciesToName(species: Int): String {
    if (species == 1) {
        return "Dog";
    }
    else if (species == 2) {
        return "Cat"
    } 
    return "";
}


// Common Structures
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

struct NftMutableMetaData {
    bagId: Int? as uint256;
    uri: String?;
    description: String?;
    image: String?;
    imageData: Cell?;
}

message Deploy {}

// PetCollections Contract
message(0x819dbe99) ChangeOwner {
    newOwner: Address;
}

message(0x4219f222) UpdateSettings {
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;
    prefixUri: String?;
}

message(0xa77a7982) Withdraw {
    isClassB: Bool;
    amount: Int as coins;
    customPayload: Cell?;
    forwardDestination: Address?;
    forwardPayload: Slice as remaining;
}

message(0x19e2ce21) WithdrawForward {
    forwardPayload: Slice as remaining;
} 

message(0xeaf4673d) WithdrawResult {
    isClassB: Bool;    
    balanceWithdrawn: Int as coins;
    customPayload: Cell?;
} 

message(0x399987e2) MintPetMemoryNft {
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;
    newOwner: Address?;
    content: PetMemoryNftContent;
}

message Donate {
    index: Int as uint40;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;
}

message DonateReply {
    feeDueTimeAdd: Int as uint32;
}

// PetMemoryNft Contract
struct PetMemoryNftContent {
    immData: PetMemoryNftImmutableData;
    data: NftMutableMetaData;
    feeDueTime: Int as uint32;
}

struct PetMemoryNftInit {
    immData: PetMemoryNftImmutableData;
    data: NftMutableMetaData;
    storageReserve: Int as uint8;
    feeDueTime: Int as uint32;
}

message DonateCollection {
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;    
}

message Destroy {}

// NFT Item nad NFT Collection TEP-62 Interface
message(0x7e208cb4) Excesses {
    queryId: Int as uint64;
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

struct CollectionData {
    nextItemIndex: Int;
    collectionContent: Cell;
    ownerAddress: Address;
}