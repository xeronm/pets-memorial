import "@stdlib/deploy";
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

    init(collectionAddress: Address, index: Int) {
        require(sender() == collectionAddress, ErrorNotAuthorized);
        self.collectionAddress = collectionAddress;
        self.owner = collectionAddress;
        self.index = index;
    }

    receive() {
    }

    receive(msg: Transfer){
        require(sender() == self.owner!!, ErrorNotAuthorized);
        let storageReserve: Int = self.storageReserve;      
        if (!self.isInitialized()) {
            let init = PetMemoryNftInit.fromCell(msg.customPayload);
            self.immData = init.immData;
            self.data = init.data;
            storageReserve = unpackQint(init.storageReserve);
        }
        require(self.isInitialized(), ErrorValidation);

        self.owner = msg.newOwner;        
        let needResp: Bool = msg.responseDestination != null && msg.responseDestination != newAddress(0, 0);
        if (msg.forwardAmount > 0 || needResp) {
            nativeReserve(storageReserve, 0);
            if (msg.forwardAmount > 0) {
                send(SendParameters {
                    to: msg.newOwner,
                    value: msg.forwardAmount,
                    mode: SendPayGasSeparately,
                    bounce: true,
                    body: OwnershipAssigned{
                        queryId: msg.queryId,
                        prevOwner: self.owner!!,
                        forwardPayload: msg.forwardPayload
                    }.toCell()
                });
            }
            if (needResp) {
                send(SendParameters {
                    to: msg.responseDestination!!,
                    value: 0,
                    mode: SendPayGasSeparately + SendRemainingBalance,
                    bounce: true,
                    body: Excesses{
                        queryId: msg.queryId
                    }.toCell()
                }); 
            }        
        }
    }

    receive(msg: GetStaticData) {
        send(SendParameters {
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
        require(sender() == self.owner, ErrorNotAuthorized);
        self.data = msg.data;

        self.notify(Excesses{
            queryId: msg.queryId
        }.toCell());
    }    

    receive("Destroy") {
        require(sender() == self.owner, ErrorNotAuthorized);
        self.owner = null;
        send(SendParameters{
            to: sender(),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance + SendDestroyIfZero,
            body: "Excess balance".asComment()
        });
    }    

    get fun get_nft_data(): GetNftData {
        require(self.isInitialized(), ErrorValidation);
        return GetNftData {
            isInitialized: self.isInitialized(), 
            index: self.index, 
            collectionAddress: self.collectionAddress, 
            ownerAddress: self.owner!!,
            individualContent: PetMemoryNftContent{
                immData: self.immData!!,
                data: self.data!!,
            }.toCell()
        };
    }

    inline fun isInitialized(): Bool {
        return self.data != null;
    }

}