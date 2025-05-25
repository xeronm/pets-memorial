import "./messages.tact";
import "./exceptions.tact";
import "./utils.tact";

contract PetMemoryNft {
    override const storageReserve: Int = ton("0.01");

    collectionAddress: Address;
    index: Int as uint40;
    owner: Address?;
    immData: PetMemoryNftImmutableData?;
    data: NftMutableMetaData?;
    feeDueTime: Int as uint32 = 0; // Fees for Class B target paid due time

    init(collectionAddress: Address, index: Int) {
        self.collectionAddress = collectionAddress;
        self.index = index;
    }

    receive() {
    }

    receive(msg: DonateCollection) {
        throwUnless(ErrorNotAuthorized, sender() == self.owner!!);
        message(MessageParameters{
            to: self.collectionAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: Donate{
                index: self.index,
                feeClassA: msg.feeClassA,
                feeClassB: msg.feeClassB
            }.toCell()
        });
    }

    receive(msg: DonateReply) {
        throwUnless(ErrorNotAuthorized, sender() == self.collectionAddress);
        let currTime: Int = now();
        self.feeDueTime = min(max(self.feeDueTime, currTime) + msg.feeDueTimeAdd, currTime + MaxFeeDueSeconds);
        cashback(self.owner!!);
    }

    receive(msg: Transfer){
        let isInitialized: Bool = self.owner != null;
        throwUnless(ErrorNotAuthorized, sender() == (isInitialized ? self.owner!! : self.collectionAddress));
        let storageReserve: Int = self.storageReserve;
        if (!isInitialized) {
            let init = PetMemoryNftInit.fromCell(msg.customPayload);
            self.immData = init.immData;
            self.data = init.data;
            self.feeDueTime = init.feeDueTime;
            storageReserve = unpackQint(init.storageReserve);
        }

        self.owner = msg.newOwner;
        let needResp: Bool = msg.responseDestination != null && msg.responseDestination != newAddress(0, 0);
        if (msg.forwardAmount > 0 || needResp) {
            nativeReserve(storageReserve, ReserveExact);
            if (msg.forwardAmount > 0) {
                message(MessageParameters{
                    to: msg.newOwner,
                    value: msg.forwardAmount,
                    mode: SendPayGasSeparately,
                    bounce: false,
                    body: OwnershipAssigned{
                        queryId: msg.queryId,
                        prevOwner: self.owner!!,
                        forwardPayload: msg.forwardPayload
                    }.toCell()
                });
            }
            if (needResp) {
                message(MessageParameters{
                    to: msg.responseDestination!!,
                    value: 0,
                    mode: SendPayGasSeparately + SendRemainingBalance,
                    bounce: false,
                    body: Excesses{
                        queryId: msg.queryId
                    }.toCell()
                });
            }
        }
    }

    receive(msg: GetStaticData) {
        message(MessageParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ReportStaticData{
                queryId: msg.queryId,
                indexId: self.index,
                collection: self.collectionAddress
            }.toCell()
        });
    }

    receive(msg: EditContent) {
        throwUnless(ErrorNotAuthorized, sender() == self.owner);
        self.data = msg.data;

        cashback(sender());
    }

    receive(msg: Destroy) {
        throwUnless(ErrorNotAuthorized, sender() == self.owner);
        self.owner = null;
        message(MessageParameters{
            to: sender(),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance + SendDestroyIfZero,
            body: null
        });
    }

    get fun get_nft_data(): GetNftData {
        return GetNftData {
            isInitialized: self.owner != null,
            index: self.index,
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner!!,
            individualContent: PetMemoryNftContent{
                immData: self.immData!!,
                data: self.data!!,
                feeDueTime: self.feeDueTime,
            }.toCell()
        };
    }

}