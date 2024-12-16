import "@stdlib/deploy";
import "./messages.tact";
import "./exceptions.tact";

struct AuthItemInfo {
    collection_address: Address;
    owner_address: Address;
    index: Int;
    isClassB: Bool;
    balanceWithdrawn: Int;
    balance: Int;
}

struct WithdrawResult {
    value: Int;
}

contract AuthItem {
    override const storageReserve: Int = ton("0.05");

    collection_address: Address;
    index: Int as uint4; 
    isClassB: Bool;
    balanceWithdrawn: Int as coins;
    owner: Address;

    init(collection_address: Address, index: Int, isClassB: Bool) {
        require(sender() == collection_address, ErrorNotAuthorized);

        self.collection_address = collection_address;
        self.owner = collection_address;
        self.index = index;
        self.isClassB = isClassB;
        self.balanceWithdrawn = 0;
    }

    receive() {
    }

    receive("withdraw") {
        let ctx: Context = context();
        require(ctx.sender == self.owner, ErrorNotAuthorized);
        send(SendParameters{
            to: self.collection_address,
            bounce: false,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: Withdraw{
                queryId: self.balanceWithdrawn,
                index: self.index,
                isClassB: self.isClassB,
                balanceWithdrawn: self.balanceWithdrawn,
            }.toCell()
        });
    }

    receive(msg: WithdrawReply) {
        require(self.notInitialized() || (self.balanceWithdrawn <= msg.balanceWithdrawn), ErrorAssertion);
        let value: Int = msg.balanceWithdrawn - self.balanceWithdrawn;
        self.balanceWithdrawn = msg.balanceWithdrawn;

        nativeReserve(self.storageReserve, 0);
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: 0,
            mode: SendRemainingBalance + SendIgnoreErrors,
            body: WithdrawResult{value: value}.toCell(),
        });

        // emit(LogEventWithdrawResult{value: value}.toCell());
    }

    receive(msg: AuthItemTransfer){
        let ctx: Context = context();        
        require(ctx.sender == self.owner, ErrorNotAuthorized);
        if (self.notInitialized()) {
            self.balanceWithdrawn = msg.balanceWithdrawn;
        }
        self.owner = msg.newOwner;
    }

    get fun info(): AuthItemInfo {
        let balance: Int = myBalance();
        return AuthItemInfo{
            collection_address: self.collection_address,
            owner_address: self.owner,
            index: self.index,
            isClassB: self.isClassB,
            balanceWithdrawn: self.balanceWithdrawn,
            balance: balance           
        }
    }

    // private methods
    fun notInitialized(): Bool {
        return (self.owner == self.collection_address);
    }
}