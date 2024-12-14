import "@stdlib/deploy";
import "./imports/utils.fc";
import "./messages.tact";
import "./exceptions.tact";
import "./auth_item.tact";

// Mapping function signatures from FunC to Tact:
@name(unpack_qint)
native unpackQint(qnum: Int): Int;

struct Info {
    countryCode: Int as uint10;
    partId: Int as uint6;
    stateId: Int as uint32;
    //
    feeStorageTons: Int as coins;
    feeClassATons: Int as coins;
    feeClassBTons: Int as coins;
    //
    balance: Int as coins;
    balanceClassA: Int as coins;
    balanceClassB: Int as coins;
}

fun nextState(): Int {
    nativeRandomizeLt();
    return randomInt() & 0xFFFFFFFF;
}

const MinFeeStorage: Int = 0x30; // 0.001 TON
const MaxAuthItemIndex: Int = 15;

contract PetsCollection {
    override const storageReserve: Int = ton("0.05");

    // Immutable Attributes
    countryCode: Int as uint10; // 10 bytes ISO 3166-1 numeric-3 code
    partId: Int as uint6; // For sharding purpose, 0 - default
    //
    authIndexSeq: Int as uint4;
    stateId: Int as uint32;
    // Fee Settings
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;    
    // Balances
    balanceClassAWithdrawn: Int as coins;
    balanceClassB: Int as coins;


    init(countryCode: Int, partId: Int) {
        // Immutable Data
        self.countryCode = countryCode;
        self.partId = partId;
        //
        self.authIndexSeq = 1;
        self.stateId = nextState();
        // 
        self.feeStorage = 0x3C;  // 0.05 TON
        self.feeClassA = 0x3A; // 0.025 TON
        self.feeClassB = 0x3C; // 0.05 TON
        // 
        self.balanceClassAWithdrawn = 0;
        self.balanceClassB = 0;
    }

    receive() {        
    }

    receive(msg: Deploy) {
        let ctx: Context = context();        
        let mintValue: Int = unpackQint(self.feeStorage);
        // deploy first AuthItem
        self.mintAuthItem(ctx.sender, mintValue);
        // send rest amount back
        self.notify(DeployOk{queryId: msg.queryId}.toCell());
    }

    receive(msg: UpdateSettings) {
        require(msg.stateId == self.stateId, ErrorCompareState);
        require(msg.feeStorage >= MinFeeStorage, ErrorMinimumStorageFee);
        let ctx = context();

        self.feeStorage = msg.feeStorage;
        self.feeClassA = msg.feeClassA;
        self.feeClassB = msg.feeClassB;
        self.stateId = nextState();
    }

    get fun info(): Info {
        let balance: Int = myBalance();
        return Info{
            countryCode: self.countryCode,
            partId: self.partId,
            stateId: self.stateId,
            //
            feeStorageTons: unpackQint(self.feeStorage),
            feeClassATons: unpackQint(self.feeClassA),
            feeClassBTons: unpackQint(self.feeClassB),
            //
            balance: balance,
            balanceClassA: self.balanceClassAWithdrawn + balance,
            balanceClassB: self.balanceClassB,
        }
    }

    get fun authItemAddress(msg: QueryAuthItemAddress): Address {
        require(msg.index <= MaxAuthItemIndex, ErrorMaxAuthItemCount);
        let nft_init: StateInit = self.authItemInit(msg.index, msg.isClassB);
        return contractAddress(nft_init);
    }

    // get fun textInfo(): String {        
    //     let sb: StringBuilder = beginString();
    //     sb.append("ISO Country: ");
    //     sb.append(self.countryCode.toString());
    //     sb.append(", Fees - ");
    //     sb.append(unpackQint(self.feeStorage).toCoinsString());
    //     sb.append(", ");
    //     sb.append(unpackQint(self.feeClassA).toCoinsString());
    //     sb.append(", ");
    //     sb.append(unpackQint(self.feeClassB).toCoinsString());
    //
    //     return sb.toString();
    // }
    
    // Private Methods
    fun authItemInit(index: Int, isClassB: Bool): StateInit {
        return initOf AuthItem(myAddress(), index, isClassB);
    }

    fun mintAuthItem(itemOwner: Address, msgValue: Int) {
        require(self.authIndexSeq <= MaxAuthItemIndex, ErrorMaxAuthItemCount);
        let nft_init: StateInit = self.authItemInit(self.authIndexSeq, false);
        send(SendParameters{
                to: contractAddress(nft_init), 
                value: msgValue, 
                bounce: false,
                mode: SendIgnoreErrors,
                body: AuthItemTransfer{
                    query_id: 0,
                    newOwner: itemOwner,
                    initBalanceWithdrawn: self.balanceClassAWithdrawn,
                }.toCell(),
                code: nft_init.code,
                data: nft_init.data
            });
        self.authIndexSeq = self.authIndexSeq + 1;
    }

    fun remainingValue(value: Int): Int {
        return value -  myStorageDue();
    }


}


