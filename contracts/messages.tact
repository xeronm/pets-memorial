// PetsCollection Producer
message UpdateSettings {
    queryId: Int as uint64;
    state_id: Int as uint32;
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;  
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
}

struct PetMemoryNftImmutableMetaData {
    species: Int as uint8; // 0 - Other, 1 - Dog, 2 - Cat, ...;
    isMale: Bool;
    name: String;
    breed: String;
    location: String; // It's preferred to use Postal Code
    owners: String;
    birthDate: Int as uint32; // Days since the epoch - January 1, 1970, UTC
    deathDate: Int as uint32; // Days since the epoch - January 1, 1970, UTC
}

message MintPetMemoryNft {
    queryId: Int as uint64;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;
    meta: PetMemoryNftImmutableMetaData;
    // Mutable attributes
    memo: String;
    image: String;
    imageData: Cell;
}

// AuthItem Producer
message AuthItemTransfer {
    queryId: Int as uint64;
    newOwner: Address;
    balanceWithdrawn: Int as coins;
}

// MemoryNft Producer
message PetMemoryNftTransfer {
    queryId: Int as uint64;
    newOwner: Address;    
}