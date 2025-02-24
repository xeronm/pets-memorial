import "@stdlib/deploy";
import "./messages.tact";
import "./exceptions.tact";
import "./utils.tact";

contract PetMemoryNft {
    override const storageReserve: Int = ton("0.01");

    collectionAddress: Address;
    index: Int;
    owner: Address?;
    immData: PetMemoryNftImmutableData;
    data: PetMemoryNftData?;

    init(collectionAddress: Address, index: Int, immData: PetMemoryNftImmutableData) {
        require(sender() == collectionAddress, ErrorNotAuthorized);
        self.collectionAddress = collectionAddress;
        self.owner = collectionAddress;
        self.index = index;
        self.immData = immData;   
    }

    receive() {
    }

    receive(msg: Transfer){
        require(sender() == self.collectionAddress, ErrorNotAuthorized);
        let storageReserve: Int = self.storageReserve;      
        if (self.data == null) { // not initialized
            let init = PetMemoryNftInit.fromCell(msg.customPayload);
            self.data = init.data;
            storageReserve = unpackQint(init.storageReserve);
        }
        require(self.data != null, ErrorValidation);
        
        let ctx = context();
        let fwdFee: Int = ctx.readForwardFee();        
        let restAmount: Int = myBalance() - storageReserve;
        if (msg.forwardAmount > 0) {
            require(self.owner != null, ErrorValidation);
            restAmount -= msg.forwardAmount + fwdFee;
        }
        if (msg.responseDestination != null) {
            restAmount -= fwdFee;
        }
        require(restAmount >= 0, ErrorInsufficientFunds);

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
        if (msg.responseDestination != null) {
            send(SendParameters {
                to: msg.responseDestination!!,
                value: restAmount,
                mode: SendPayGasSeparately,
                bounce: true,
                body: Excesses{
                    queryId: msg.queryId
                }.toCell()
            }); 
        }
        self.owner = msg.newOwner;
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

    receive(msg: PetMemoryNftUpdate) {
        require(sender() == self.owner, ErrorNotAuthorized);
        self.data = msg.data;

        self.notify(Excesses{
            queryId: msg.queryId
        }.toCell());
    }    

    receive("destroy") {
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
        return GetNftData {
            isInitialized: self.data != null, 
            index: self.index, 
            collectionAddress: self.collectionAddress, 
            ownerAddress: self.owner!!,
            individualContent: PetMemoryNftContent{
                immData: self.immData,
                data: self.data!!,
            }.toCell()
        };
    }

}