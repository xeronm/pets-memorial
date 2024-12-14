// PetsCollection Producer
message UpdateSettings {
    queryId: Int as uint64;
    stateId: Int as uint32;
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;  
}

message MintPetMemoryNft {
    queryId: Int as uint64;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;

}

message QueryAuthItemAddress {
    index: Int as uint4;
    isClassB: Bool;
}

// AuthItem Producer
message AuthItemTransfer {
    queryId: Int as uint64;
    newOwner: Address;
    initBalanceWithdrawn: Int as coins;
}

// MemoryNft Producer
message PetMemoryNftTransfer {
    queryId: Int as uint64;
    newOwner: Address;    
}