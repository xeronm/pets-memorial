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
    state_id: Int as uint32;
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
    classBCount: Int as uint4;
    classACount: Int as uint4;
    state_id: Int as uint32;
    // Fee Settings
    feeStorage: Int as uint8;
    feeClassA: Int as uint8;
    feeClassB: Int as uint8;    
    // Balances
    balanceWithdrawn: Int as coins;
    balanceClassB: Int as coins;


    init(countryCode: Int, partId: Int) {
        // Immutable Data
        self.countryCode = countryCode;
        self.partId = partId;
        //
        self.authIndexSeq = 1;
        self.classBCount = 0;
        self.classACount = 0;
        self.state_id = nextState();
        // 
        self.feeStorage = 0x3C;  // 0.05 TON
        self.feeClassA = 0x3A; // 0.025 TON
        self.feeClassB = 0x3C; // 0.05 TON
        // 
        self.balanceWithdrawn = 0;
        self.balanceClassB = 0;
    }

    receive() {        
    }

    receive(msg: Deploy) {
        let ctx: Context = context();        
        let mintValue: Int = unpackQint(self.feeStorage);
        // deploy first AuthItem
        self.mintAuthItem(ctx.sender, mintValue, false);
        // send rest amount back
        self.notify(DeployOk{queryId: msg.queryId}.toCell());
    }

    receive(msg: UpdateSettings) {
        require(msg.state_id == self.state_id, ErrorCompareState);
        require(msg.feeStorage >= MinFeeStorage, ErrorMinimumStorageFee);
        let ctx = context();

        self.feeStorage = msg.feeStorage;
        self.feeClassA = msg.feeClassA;
        self.feeClassB = msg.feeClassB;
        self.state_id = nextState();
    }

    receive(msg: Withdraw) {
        let authItemAddr: Address = self.calcAuthItemAddress(msg.index, msg.isClassB);
        let ctx: Context = context();
        require(ctx.sender == authItemAddr, ErrorNotAuthorized);

        let msgAmount: Int = self.calcAvailableForWithdraw(msg.isClassB, myBalance() - ctx.value, msg.balanceWithdrawn);
        self.balanceWithdrawn += msgAmount;
        send(SendParameters{
            to: sender(),
            bounce: true,
            value: msgAmount,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: WithdrawReply{
                queryId: msg.queryId,
                balanceWithdrawn: self.balanceWithdrawn,
            }.toCell()
        });
    }

    get fun info(): Info {
        let balance: Int = myBalance();
        return Info{
            countryCode: self.countryCode,
            partId: self.partId,
            state_id: self.state_id,
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
    fun authItemInit(index: Int, isClassB: Bool): StateInit {
        return initOf AuthItem(myAddress(), index, isClassB);
    }

    fun calcAuthItemAddress(index: Int, isClassB: Bool): Address {
        require(index <= MaxAuthItemIndex, ErrorMaxAuthItemCount);
        let nft_init: StateInit = self.authItemInit(index, isClassB);
        return contractAddress(nft_init);
    }

    fun calcAvailableForWithdraw(isClassB: Bool, balance: Int, withdrawnBalance: Int): Int {
        let amount: Int = (isClassB ? self.balanceClassB : (self.balanceWithdrawn + balance - self.balanceClassB));
        if (amount > balance - self.storageReserve) {
            amount = balance - self.storageReserve;
        }
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

    fun mintAuthItem(itemOwner: Address, msgValue: Int, isClassB: Bool) {
        require(self.authIndexSeq <= MaxAuthItemIndex, ErrorMaxAuthItemCount);
        let nft_init: StateInit = self.authItemInit(self.authIndexSeq, isClassB);
        send(SendParameters{
                to: contractAddress(nft_init), 
                value: msgValue, 
                bounce: false,
                mode: SendIgnoreErrors,
                body: AuthItemTransfer{
                    queryId: 0,
                    newOwner: itemOwner,
                    balanceWithdrawn: self.balanceWithdrawn,
                }.toCell(),
                code: nft_init.code,
                data: nft_init.data
            });
        self.authIndexSeq = self.authIndexSeq + 1;
        if (isClassB) {
            self.classBCount += 1;    
        }
        else {
            self.classACount += 1;    
        }
    }

    fun remainingValue(value: Int): Int {
        return value -  myStorageDue();
    }


}


