import "@stdlib/deploy";
import "./imports/utils.fc";
import "./messages.tact";
import "./pet_memory_nft.tact";
import "./utils.tact";

struct Info {
    feeStorageTons: Int as coins;
    feeClassATons: Int as coins;
    feeClassBTons: Int as coins;
    //
    balance: Int as coins;
    balanceClassA: Int as coins;
    balanceClassB: Int as coins;
}

const MaxAuthItemIndex: Int = 15;
const MinVoteDurationHours: Int = 24;

const FieldUri: Int = sha256("uri");
const FieldName: Int = sha256("name");
const FieldDescription: Int = sha256("description");
const FieldImage: Int = sha256("image");
const FieldImageData: Int = sha256("image_data");
const FieldAttributes: Int = sha256("attributes");
const FieldTraitType: Int = sha256("trait_type");
const FieldValue: Int = sha256("value");

const PetsCollectionName: String = "Test Collection";
const PetsCollectionDescription: String = "Test Collection Description";
const AuthClassADescription: String = "Class A Token";
const AuthClassBDescription: String = "Class B Token";

// const PetsCollectionName: String = "Pets Memorial";
// const PetsCollectionDescription: String = "TestNet Pets Memorial";
// const AuthClassADescription: String = "Auth Governance Token";
// const AuthClassBDescription: String = "Auth Non-governance Token";

const PetsCollectionImage: String = "collection.png";
const AuthClassAName: String = "Class A";
const AuthClassAImage: String = "classA.png";
const AuthClassBName: String = "Class B";
const AuthClassBImage: String = "classB.png";
const ImageCat: String = "cat.png";
const ImageDog: String = "dog.png";
const ImageOther: String = "other.png";
const DefaultPrefixUri: String = "https://muratov.xyz/petsmem/images/";

inline fun speciesToImage(species: Int): String {
    if (species == 1) {
        return ImageDog;
    }
    else if (species == 2) {
        return ImageCat
    } 
    return ImageOther;
}

fun encodeNftMetadataContent(name: String, uri: String?, description: String?, image: String?, imageData: Cell?): Cell {
    let dict: map<Int as uint256, Cell> = emptyMap();

    dict.set(FieldName, name.asMetadataCell());

    if (uri != null) {
        dict.set(FieldUri, uri!!.asMetadataCell());
    }
    if (description != null) {
        dict.set(FieldDescription, description!!.asMetadataCell());
    }
    if (image != null) {
        dict.set(FieldImage, image!!.asMetadataCell());
    }
    if (imageData != null) {
        dict.set(FieldImageData, imageData!!);
    }

    return beginCell()
        .storeUint(0, 8) // On-chain content layout
        .storeMaybeRef(dict.asCell()!!)
        .endCell();
}

fun makeUri(prefixUri: String, path: String): String {
    return beginString().concat(prefixUri).concat(path).toString();
}

contract PetsCollection {
    override const storageReserve: Int = ton("0.05");  // CollectionStorageReserve;

    owner: Address;
    // Mutable Internal Attributes
    // - Minting data
    nftIndexSeq: Int as uint40;
    // - Balances
    balanceWithdrawn: Int as coins;
    balanceClassB: Int as coins;
    // Mutable Settings
    // - Fees
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;    
    //
    prefixUri: String;

    init(owner: Address) {
        self.owner = owner;
        //
        self.nftIndexSeq = 0;
        // 
        self.feeStorage = 0x3C;  // 0.05 TON
        self.feeClassA = 0x3A; // 0.025 TON
        self.feeClassB = 0x3C; // 0.05 TON
        // 
        self.balanceWithdrawn = 0;
        self.balanceClassB = 0;
        //
        self.prefixUri = DefaultPrefixUri;
    }

    receive() {        
    }


    receive(msg: Deploy) {
        require(sender() == self.owner, ErrorNotAuthorized);
        require(self.nftIndexSeq == 0, ErrorValidation);

        self.nftIndexSeq = 1;
        self.notify(DeployOk{queryId: msg.queryId}.toCell());
    }

    receive(msg: MintPetMemoryNft) {
        require(self.nftIndexSeq > 0, ErrorValidation);

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


    receive(msg: Withdraw) {
        require(sender() == self.owner, ErrorNotAuthorized);
        
        let available = self.availableBalance(msg.isClassB, myBalance() - context().value);
        require(available >= msg.amount, ErrorInsufficientFunds);
        self.balanceWithdrawn += msg.amount;

        let needFwd: Bool = msg.forwardDestination != null && msg.forwardDestination != newAddress(0, 0);
        if (needFwd) {
            send(SendParameters{
                to: msg.forwardDestination!!,
                bounce: true,
                value: msg.amount,
                mode: 0,
                body:  WithdrawForward{
                    queryId: msg.queryId,
                    forwardPayload: msg.forwardPayload,
                }.toCell()
            });
        }

        send(SendParameters{
            to: sender(),
            bounce: true,
            value: needFwd ? 0 : msg.amount,
            mode: SendRemainingValue,
            body: WithdrawResult{
                queryId: msg.queryId,
                isClassB: msg.isClassB,
                balanceWithdrawn: self.balanceWithdrawn,
                customPayload: msg.customPayload,
            }.toCell()
        });
    }

    receive(msg: UpdateSettings) {
        require(sender() == self.owner, ErrorNotAuthorized);

        require(msg.feeStorage >= MinFeeStorage && msg.feeClassA >= MinFeeClassA, ErrorValidation);
        self.feeStorage = msg.feeStorage;
        self.feeClassA = msg.feeClassA;
        self.feeClassB = msg.feeClassB;
        if (msg.prefixUri != null) {
            self.prefixUri = msg.prefixUri!!;
        }

        self.notify(Excesses{
            queryId: msg.queryId
        }.toCell());   
    }    

    receive(msg: ChangeOwner) {
        require(sender() == self.owner, ErrorNotAuthorized);
        self.owner = msg.newOwner;
        self.notify(Excesses{
            queryId: msg.queryId
        }.toCell());        
    }


    get fun get_collection_data(): CollectionData {
        let content: Cell = encodeNftMetadataContent(
            PetsCollectionName, 
            null,
            PetsCollectionDescription,
            makeUri(self.prefixUri, PetsCollectionImage),
            null,            
        );

        return CollectionData{
            nextItemIndex: self.nftIndexSeq,
            collectionContent: content,
            ownerAddress: self.owner,
        }
    }

    get fun get_nft_address_by_index(index: Int): Address {
        let nftInit: StateInit = initOf PetMemoryNft(myAddress(), index);
        return contractAddress(nftInit);        
    }

    get fun get_nft_content(index: Int, individualContent: Cell): Cell {
        let nameStr: StringBuilder = beginString();
        let description: String? = null;
        let uri: String? = null;
        let image: String? = null;
        let imageData: Cell? = null;

        // PetMemoryNFT
        let content: PetMemoryNftContent = PetMemoryNftContent.fromCell(individualContent);

        nameStr = nameStr.concat(content.immData.name)
            .concat(", ")
            .concat((content.immData.speciesName != null) ? content.immData.speciesName!! : speciesToName(content.immData.species));

        // TODO: Add serialization depends on serialization mask each bit for each feature
        if (content.immData.countryCode > 0) {
            nameStr = nameStr.concat(", ").concat(bcd2cToString(content.immData.countryCode));
        }

        if (content.immData.location != null) {
            nameStr = nameStr.concat(", ").concat(content.immData.location!!);
        }

        if (content.immData.birthDate > 0 || content.immData.deathDate > 0) {
            nameStr = nameStr.concat(" (")
                .concat(dateMaskToString(content.immData.birthDate))
                .concat(" ~ ")
                .concat(dateMaskToString(content.immData.deathDate))
                .concat(")");
        }

        uri = content.data.uri;
        description = content.data.description;
        if (description == null) {
            description = PetsCollectionName;
        }
        image = content.data.image;
        imageData = content.data.imageData;
        if (image == null && imageData == null) {
            image = makeUri(self.prefixUri, speciesToImage(content.immData.species));
        }
    
        return encodeNftMetadataContent(
            nameStr.toString(), 
            uri,
            description,
            image,
            imageData);
    }

    get fun info(): Info {
        let balance: Int = myBalance();
        return Info{
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

    // Private Methods
    fun availableBalance(isClassB: Bool, balance: Int): Int {
        let amount: Int = (isClassB ? self.balanceClassB : (self.balanceWithdrawn + balance - self.balanceClassB));
        if (amount > balance - self.storageReserve) {
            amount = balance - self.storageReserve;
        }
        return amount;
    }

}


