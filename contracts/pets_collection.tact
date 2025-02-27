import "@stdlib/deploy";
import "./imports/utils.fc";
import "./messages.tact";
import "./exceptions.tact";
import "./auth_item.tact";
import "./pet_memory_nft.tact";
import "./utils.tact";

struct VoteAction {
    requester: Address;
    stateId: Int as uint32;
    dateCreated: Int as uint64;    
    message: Cell;
}

struct Info {
    voteAction: VoteAction?;
    votesFor: Int as uint4;
    votesAgainst: Int as uint4;
    classACount: Int as uint4;
    classBCount: Int as uint4;
    voteDurationHours: Int as uint8;
    //
    feeStorageTons: Int as coins;
    feeClassATons: Int as coins;
    feeClassBTons: Int as coins;
    //
    balance: Int as coins;
    balanceClassA: Int as coins;
    balanceClassB: Int as coins;
    //
}

fun nextState(): Int {
    return randomInt() & 0xFFFFFFFF;
}

const MaxAuthItemIndex: Int = 15;
const MinVoteDurationMinutes: Int = 1440;

const FieldUri: Int = sha256("uri");
const FieldName: Int = sha256("name");
const FieldDescription: Int = sha256("description");
const FieldImage: Int = sha256("image");
const FieldImageData: Int = sha256("image_data");
const FieldAttributes: Int = sha256("attributes");
const FieldTraitType: Int = sha256("trait_type");
const FieldValue: Int = sha256("value");

const PetsCollectionName: String = "petsmem-v1";

contract PetsCollection {
    override const storageReserve: Int = ton("0.05");  // CollectionStorageReserve;

    // Mutable Internal Attributes
    // - Minting data
    authIndexSeq: Int as uint4;
    nftIndexSeq: Int;
    classBCount: Int as uint4;
    classACount: Int as uint4;
    // - Balances
    balanceWithdrawn: Int as coins;
    balanceClassB: Int as coins;
    // - Current Vote action
    voteAction: VoteAction?;
    votesFor: Int as uint4;
    votesAgainst: Int as uint4;
    // Mutable Settings
    // - Fees
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;    
    // - Vote settings
    voteDurationHours: Int as uint8;
    //
    data: NftMutableMetaData?;

    init() {
        //
        self.votesFor = 0;
        self.votesAgainst = 0;
        //
        self.authIndexSeq = 1;
        self.nftIndexSeq = 1;
        self.classBCount = 0;
        self.classACount = 0;
        // 
        self.feeStorage = 0x3C;  // 0.05 TON
        self.feeClassA = 0x3A; // 0.025 TON
        self.feeClassB = 0x3C; // 0.05 TON
        // 
        self.balanceWithdrawn = 0;
        self.balanceClassB = 0;
        //
        self.voteDurationHours = 24;
    }

    receive() {        
    }

    receive(msg: Deploy) {
        require(context().value >= CollectionDeployMinTons, ErrorInsufficientFunds);
        // deploy first AuthItem
        self.mintAuthItem(sender(), false, unpackQint(self.feeStorage));
        // send rest amount back
        self.notify(DeployOk{queryId: msg.queryId}.toCell());
    }

    receive(msg: MintPetMemoryNft) {
        let storageReserve: Int = unpackQint(self.feeStorage);
        let feeClassA: Int = unpackQint(max(msg.feeClassA, self.feeClassA));
        let feeClassB: Int = unpackQint(max(msg.feeClassB, self.feeClassB)); 
        let ctx = context();
        let fwdFee: Int = ctx.readForwardFee();

        require(ctx.value >= storageReserve + feeClassA + feeClassB + 2*fwdFee, ErrorInsufficientFunds);

        let nftInit: StateInit = initOf PetMemoryNft(myAddress(), self.nftIndexSeq);
        let nftAddress: Address = contractAddress(nftInit);

        send(SendParameters{
            to: nftAddress, 
            value: ctx.value - (feeClassA + feeClassB + fwdFee), 
            bounce: true,
            mode: 0,
            body: Transfer{
                queryId: msg.queryId,
                newOwner: (msg.newOwner == null) ? sender() : msg.newOwner!!,
                responseDestination: sender(),
                forwardAmount: 0,
                forwardPayload: emptySlice(),
                customPayload: PetMemoryNftInit{
                    immData: msg.content.immData,
                    data: msg.content.data,
                    storageReserve: self.feeStorage,
                }.toCell(),
            }.toCell(),
            code: nftInit.code,
            data: nftInit.data
        });

        self.nftIndexSeq += 1;
        self.balanceClassB += feeClassB;
    }

    receive(msg: PutToVote) {
        self.assertAuthItem(msg.index, msg.isClassB);
        require(self.voteAction == null, ErrorVoteInProgress);

        nativeRandomizeLt();
        let stateId: Int = randomUint32();
        self.voteAction = VoteAction{
            stateId: stateId,
            requester: sender(),
            dateCreated: now(),
            message: msg.message,
        };
        self.votesFor = 1;
        self.votesAgainst = 0;

        if (self.classACount == 1) {
            self.voteExecute();
        }

        self.notify(VoteReply{
            queryId: msg.queryId, 
            stateId: stateId,
            status: ((self.voteAction == null) ? VoteStatusExecuted : VoteStatusPending)
        }.toCell());
    }

    receive(msg: Vote) {
        require(msg.isClassB == false, ErrorNotAuthorized);
        self.assertAuthItem(msg.index, msg.isClassB);
        if (self.voteAction == null) {
            require(false, ErrorVoteInvalidState);
        }
        let vote: VoteAction = self.voteAction!!;
        require(vote.stateId == msg.stateId, ErrorVoteInvalidState);        
        require(now() <= vote.dateCreated + self.voteDurationHours*60, ErrorVoteExpired);

        if (msg.vote) {
            self.votesFor += 1;
        }
        else {
            self.votesAgainst += 1;
        }
        
        if (self.votesFor > (self.classACount >> 1)) {  // 50% + 1
            self.voteExecute();
        }

        self.notify(VoteReply{
            queryId: msg.queryId, 
            stateId: msg.stateId,
            status: ((self.voteAction == null) ? VoteStatusExecuted : VoteStatusPending),
        }.toCell());
    }

    receive(msg: Withdraw) {
        self.assertAuthItem(msg.index, msg.isClassB);

        let msgAmount: Int = self.calcAvailableForWithdraw(msg.isClassB, myBalance() - context().value, msg.balanceWithdrawn);
        self.balanceWithdrawn += msgAmount;
        send(SendParameters{
            to: sender(),
            bounce: false,
            value: msgAmount,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: WithdrawReply{
                queryId: msg.queryId,
                balanceWithdrawn: self.balanceWithdrawn,
                storageReserve: self.feeStorage - 1,
            }.toCell()
        });
    }

    get fun get_collection_data(): CollectionData {
        let dict: map<Int as uint256, Cell> = emptyMap();
        dict.set(FieldName, PetsCollectionName.asMetadataCell());
        if (self.data != null) {
            if (self.data!!.uri != null) {
                dict.set(FieldUri, self.data!!.uri!!.asMetadataCell());
            }
            if (self.data!!.description != null) {
                dict.set(FieldDescription, self.data!!.description!!.asMetadataCell());
            }
            if (self.data!!.image != null) {
                dict.set(FieldImage, self.data!!.image!!.asMetadataCell());
            }
        }

        return CollectionData{
            nextItemIndex: self.nftIndexSeq,
            collectionContent: beginCell()
                                .storeUint(0, 8) // On-chain content layout
                                .storeMaybeRef(dict.asCell()!!)
                                .endCell(),
            ownerAddress: newAddress(0, 0)
        }
    }

    get fun get_nft_address_by_index(index: Int): Address {
        let nftInit: StateInit = initOf PetMemoryNft(myAddress(), index);
        return contractAddress(nftInit);        
    }


    get fun get_nft_content(index: Int, individualContent: Cell): Cell {
        let content: PetMemoryNftContent = PetMemoryNftContent.fromCell(individualContent);

        let nameStr: StringBuilder = beginString()
            .concat(content.immData.name)
            .concat(", ")
            .concat((content.immData.speciesName != null) ? content.immData.speciesName!! : enumToSpeciesName(content.immData.species));

        // TODO: Add serialization depends on serialization mask each bit for each feature
        if (content.immData.countryCode > 0) {
            nameStr = nameStr.concat(", ").concat(bcd2cToString(content.immData.countryCode));
        }

        if (content.immData.location != null) {
            nameStr = nameStr.concat(", ").concat(content.immData.location!!);
        }

        if (content.immData.birthDate > 0 || content.immData.deathDate > 0) {
            nameStr = nameStr
                .concat(" (")
                .concat(dateMaskToString(content.immData.birthDate))
                .concat(" ~ ")
                .concat(dateMaskToString(content.immData.deathDate))
                .concat(")");
        }

        let dict: map<Int as uint256, Cell> = emptyMap();
        dict.set(FieldName, nameStr.toString().asMetadataCell());

        if (content.data.uri != null) {
            dict.set(FieldUri, content.data.uri!!.asMetadataCell());
        }
        if (content.data.description != null) {
            dict.set(FieldDescription, content.data.description!!.asMetadataCell());
        }
        if (content.data.image != null) {
            dict.set(FieldImage, content.data.image!!.asMetadataCell());
        }
        if (content.data.imageData != null) {
            dict.set(FieldImageData, content.data.imageData!!.asMetadataCell());
        }

        return beginCell()
                .storeUint(0, 8) // On-chain content layout
                .storeMaybeRef(dict.asCell()!!)
                .endCell();
    }

    get fun info(): Info {
        let balance: Int = myBalance();
        return Info{
            voteAction: self.voteAction,
            votesFor: self.votesFor,
            votesAgainst: self.votesAgainst,
            classACount: self.classACount,
            classBCount: self.classBCount,
            //
            voteDurationHours: self.voteDurationHours,
            //
            feeStorageTons: unpackQint(self.feeStorage),
            feeClassATons: unpackQint(self.feeClassA),
            feeClassBTons: unpackQint(self.feeClassB),
            //
            balance: balance,
            balanceClassA: self.balanceWithdrawn + balance,
            balanceClassB: self.balanceClassB,
        }
    }

    get fun availableForWithdraw(isClassB: Bool, withdrawnBalance: Int): Int {
        return self.calcAvailableForWithdraw(isClassB, myBalance(), withdrawnBalance);
    }
    
    // Private Methods
    fun assertFromMySelf() {
        require(sender() == myAddress(), ErrorNotAuthorized);
    }

    fun assertAuthItem(index: Int, isClassB: Bool) {
        require(sender() == self.calcAuthItemAddress(index, isClassB), ErrorNotAuthorized);
    }

    fun authItemInit(index: Int, isClassB: Bool): StateInit {
        return initOf AuthItem(myAddress(), index, isClassB);
    }

    fun calcAuthItemAddress(index: Int, isClassB: Bool): Address {
        require(index <= MaxAuthItemIndex, ErrorMaxAuthItemCount);
        let nft_init: StateInit = self.authItemInit(index, isClassB);
        return contractAddress(nft_init);
    }

    fun availableBalance(isClassB: Bool, balance: Int): Int {
        let amount: Int = (isClassB ? self.balanceClassB : (self.balanceWithdrawn + balance - self.balanceClassB));
        if (amount > balance - self.storageReserve) {
            amount = balance - self.storageReserve;
        }
        return amount;
    }

    fun calcAvailableForWithdraw(isClassB: Bool, balance: Int, withdrawnBalance: Int): Int {
        let amount: Int = self.availableBalance(isClassB, balance);
        let shares = (isClassB ? self.classBCount : self.classACount);
        if (shares == 0) {
            return 0;
        }
        amount = (amount - withdrawnBalance)/ shares;

        let minAmount = unpackQint(isClassB ? self.feeClassB : self.feeClassA);
        if (amount < minAmount) {
            return 0;
        }
        return amount;
    }

    fun mintAuthItem(itemOwner: Address, isClassB: Bool, value: Int) {
        require(self.authIndexSeq <= MaxAuthItemIndex, ErrorMaxAuthItemCount);
        let nftInit: StateInit = self.authItemInit(self.authIndexSeq, isClassB);
        send(SendParameters{
                to: contractAddress(nftInit), 
                value: unpackQint(self.feeStorage), 
                bounce: false,
                mode:  SendPayGasSeparately + SendIgnoreErrors,
                body: AuthItemTransfer{
                    newOwner: itemOwner,
                    balanceWithdrawn: self.balanceWithdrawn,
                }.toCell(),
                code: nftInit.code,
                data: nftInit.data
            });
        self.authIndexSeq += 1;

        if (isClassB) {
            self.classBCount += 1;
        }
        else {
            self.classACount += 1;
        }          
    }

    fun voteExecute() {
        let op: Int = self.voteAction!!.message.asSlice().preloadUint(32);
        if (op == VoteOpUpdateSettings) {
            self.execUpdateSettings(UpdateSettings.fromCell(self.voteAction!!.message));
        }
        else if (op == VoteOpMintAuthItem) {
            self.execMintAuthItem(MintAuthItems.fromCell(self.voteAction!!.message))
        }
        else if (op == VoteOpTransferAuthItem) {            
            self.execTransferAuthItem(TransferAuthItems.fromCell(self.voteAction!!.message))
        }

        self.voteAction = null;
        self.votesFor = 0;
        self.votesAgainst = 0;
    }

    fun execUpdateSettings(msg: UpdateSettings) {
        require(msg.feeStorage >= MinFeeStorage, ErrorMinimumStorageFee);
        self.feeStorage = msg.feeStorage;
        self.feeClassA = msg.feeClassA;
        self.feeClassB = msg.feeClassB;
        if (msg.data != null) {
            self.data = msg.data;
        }
    }

    fun execMintAuthItem(msg: MintAuthItems) {
        let count: Int = 0;
        foreach (id, item in msg.items) {
            count += 1;
        }
        require(self.authIndexSeq + count <= MaxAuthItemIndex, ErrorMaxAuthItemCount);

        let itemValue: Int = unpackQint(self.feeStorage);
        let balance: Int = self.availableBalance(false, myBalance() - context().value);
        require(balance > itemValue * count, ErrorInsufficientFunds);

        foreach (id, item in msg.items) {
            self.mintAuthItem(item.owner, item.isClassB, itemValue);
        }    
    }

    fun execTransferAuthItem(msg: TransferAuthItems) {
        let count: Int = 0;
        foreach (id, item in msg.items) {
            count += 1;
        }

        let balance: Int = self.availableBalance(false, myBalance() - context().value);        
        require(balance > TransferAuthItemMinTons * count, ErrorInsufficientFunds);

        foreach (id, item in msg.items) {
            send(SendParameters{
                to: item.address,
                bounce: false,
                value: 0,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                body: AuthItemTransfer{
                    newOwner: item.newOwner,
                    balanceWithdrawn: self.balanceWithdrawn,
                }.toCell(),
            });
        }        
    }

}


