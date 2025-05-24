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
    //
    fbMode: Int as uint2;
    fbUri: String;
}

const MaxAuthItemIndex: Int = 15;
const MinVoteDurationHours: Int = 24;

const FieldUri: Int = sha256("uri");
const FieldName: Int = sha256("name");
const FieldDescription: Int = sha256("description");
const FieldImage: Int = sha256("image");
const FieldImageData: Int = sha256("image_data");

const PetsCollectionName: String = "Test Collection";

const ContentTypeImage: String = "image";
const ContentTypeUri: String = "uri";
const DefaultFallback: String = "https://s.petsmem.site/c/";

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

fun makeUri(fbUri: String, fbMode: Int, address: String, qtype: String, uri: String?): String {
    if (uri == null || (fbMode != 0 && uri!!.asSlice().loadUint(32) != ascii("http"))) {
        let newUri = beginString().concat(fbUri).concat(address).concat("?q=").concat(qtype);
        if (fbMode == FallbackModeExt && uri != null) {
            newUri = newUri.concat("&u=").concat(uri!!);
        }
        return newUri.toString();
    }
    return uri!!;
}

contract PetsCollection {
    override const storageReserve: Int = ton("0.05");  // CollectionStorageReserve;

    owner: Address;
    // Mutable Internal Attributes
    // - Minting data
    nftIndexSeq: Int as uint40 = 0;
    // - Balances
    balanceClassAWithdrawn: Int as coins = 0;
    balanceClassBWithdrawn: Int as coins = 0;
    balanceClassB: Int as coins = 0;
    // Mutable Settings
    // - Fees
    feeStorage: Int as uint8 = 0x3C;  // 0.05 TON
    feeClassA: Int as uint8 = 0x3A; // 0.025 TON
    feeClassB: Int as uint8 = 0x3C; // 0.05 TON
    //
    fbMode: Int as uint2 = FallbackModeBasic;
    fbUri: String = DefaultFallback;

    init(owner: Address) {
        self.owner = owner;
    }

    receive() {
    }

    receive(msg: Deploy) {
        self.notify(null);
    }

    receive(msg: MintPetMemoryNft) {
        let storageReserve: Int = unpackQint(self.feeStorage);
        let feeClassA: Int = unpackQint(max(msg.feeClassA, self.feeClassA));
        let feeClassB: Int = unpackQint(self.feeClassB);
        let feeDueTime: Int = SecondsInYear;
        if (msg.feeClassB > self.feeClassB && feeClassB > 0) {
            let _feeClassB = unpackQint(msg.feeClassB);
            feeDueTime = (_feeClassB * SecondsInYear) / feeClassB;
            feeClassB = _feeClassB;
        }
        let ctx = context();
        let fwdFee: Int = ctx.readForwardFee(); // we use fwdFee to estimate deploy message fee

        let remainingValue = ctx.value - (feeClassA + feeClassB + MintPetMemoryNftGasFeeMin);
        // All fees (storage, compute, forward) are deducted from main, Class A balance.
        throwUnless(ErrorInsufficientFunds, remainingValue >= storageReserve + fwdFee + PetMemoryNftTransferGasAndFwdFeeMin);

        let nftInit: StateInit = initOf PetMemoryNft(myAddress(), self.nftIndexSeq);
        self.nftIndexSeq += 1;
        self.balanceClassB += feeClassB;

        deploy(DeployParameters{
            value: remainingValue,
            bounce: true,
            mode: SendDefaultMode,
            body: Transfer{
                queryId: 0,
                newOwner: (msg.newOwner == null) ? sender() : msg.newOwner!!,
                responseDestination: sender(),
                forwardAmount: 0,
                forwardPayload: emptySlice(),
                customPayload: PetMemoryNftInit{
                    immData: msg.content.immData,
                    data: msg.content.data,
                    storageReserve: self.feeStorage,
                    feeDueTime: now() + feeDueTime
                }.toCell(),
            }.toCell(),
            init: nftInit
        });
    }

    receive(msg: Donate) {
        let nftInit: StateInit = initOf PetMemoryNft(myAddress(), msg.index);
        throwUnless(ErrorNotAuthorized, sender() == contractAddress(nftInit));

        let feeClassA: Int = unpackQint(msg.feeClassA);
        let feeClassB: Int = unpackQint(msg.feeClassB);

        let ctx = context();
        let remainingValue = ctx.value - (feeClassA + feeClassB + DonateGasFeeMin);
        throwUnless(ErrorInsufficientFunds, remainingValue >= DonateReplyGasFeeMin);

        self.balanceClassB += feeClassB;

        message(MessageParameters{
            to: sender(),
            value: remainingValue,
            mode: SendDefaultMode,
            bounce: false,
            body: DonateReply{
                feeDueTimeAdd: (self.feeClassB > 0 ? (feeClassB * SecondsInYear) / unpackQint(self.feeClassB) : 0)
            }.toCell()
        });
    }

    receive(msg: Withdraw) {
        throwUnless(ErrorNotAuthorized, sender() == self.owner);

        let available: Int = self.availableBalance(msg.isClassB, myBalance() - context().value);
        throwUnless(ErrorInsufficientFunds, available >= msg.amount);
        if (msg.isClassB) {
            self.balanceClassBWithdrawn += msg.amount;
        }
        else {
            self.balanceClassAWithdrawn += msg.amount;
        }

        let needFwd: Bool = msg.forwardDestination != null && msg.forwardDestination != newAddress(0, 0);
        if (needFwd) {
            message(MessageParameters{
                to: msg.forwardDestination!!,
                bounce: true,
                value: msg.amount,
                mode: 0,
                body:  WithdrawForward{
                    forwardPayload: msg.forwardPayload,
                }.toCell()
            });
        }

        message(MessageParameters{
            to: sender(),
            bounce: true,
            value: needFwd ? 0 : msg.amount,
            mode: SendRemainingValue,
            body: WithdrawResult{
                isClassB: msg.isClassB,
                balanceWithdrawn: msg.isClassB ? self.balanceClassBWithdrawn : self.balanceClassAWithdrawn,
                customPayload: msg.customPayload,
            }.toCell()
        });
    }

    receive(msg: UpdateSettings) {
        throwUnless(ErrorNotAuthorized, sender() == self.owner);
        throwUnless(ErrorValidation, msg.feeStorage >= MinFeeStorage);
        self.feeStorage = msg.feeStorage;
        self.feeClassA = msg.feeClassA;
        self.feeClassB = msg.feeClassB;
        self.fbMode = msg.fbMode;
        if (msg.fbUri != null) {
            self.fbUri = msg.fbUri!!;
        }
        cashback(sender());
    }

    receive(msg: ChangeOwner) {
        throwUnless(ErrorNotAuthorized, sender() == self.owner);
        self.owner = msg.newOwner;
        cashback(sender());
    }

    get fun get_collection_data(): CollectionData {
        let address: String = myAddress().toString();
        let content: Cell = encodeNftMetadataContent(
            PetsCollectionName,
            makeUri(self.fbUri, 0, address, ContentTypeUri, null),
            null,
            makeUri(self.fbUri, 0, address, ContentTypeImage, null),
            null
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

        let address: String = contractAddress(initOf PetMemoryNft(myAddress(), index)).toString();

        if (content.data.uri != null) {
            uri = makeUri(self.fbUri, self.fbMode, address, ContentTypeUri, content.data.uri);
        }
        description = content.data.description;
        imageData = content.data.imageData;
        if (content.data.image != null || imageData == null) {
            image = makeUri(self.fbUri, self.fbMode, address, ContentTypeImage, content.data.image);
        }

        return encodeNftMetadataContent(
            nameStr.toString(),
            uri,
            description,
            image,
            imageData);
    }

    get fun get_info(): Info {
        let balance: Int = myBalance();
        let balanceB: Int = self.balanceClassB - self.balanceClassBWithdrawn;

        return Info{
            //
            feeStorageTons: unpackQint(self.feeStorage),
            feeClassATons: unpackQint(self.feeClassA),
            feeClassBTons: unpackQint(self.feeClassB),
            //
            balance: balance,
            balanceClassA: balance - balanceB,
            balanceClassB: balanceB,
            //
            fbMode: self.fbMode,
            fbUri: self.fbUri,
        }
    }

    // Private Methods
    inline fun availableBalance(isClassB: Bool, balance: Int): Int {
        let amount: Int = self.balanceClassB - self.balanceClassBWithdrawn;
        if (!isClassB) {
            amount = balance - amount;
        }
        return min(amount, balance - self.storageReserve);
    }

}


