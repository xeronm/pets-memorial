import "@stdlib/deploy";
import "./messages.tact";
import "./exceptions.tact";

struct AuthItemInfo {
    collectionAddress: Address;
    ownerAddress: Address;
    index: Int;
    isClassB: Bool;
    balanceWithdrawn: Int;
    balance: Int;
}

contract AuthItem {
    collectionAddress: Address;
    index: Int as uint4; 
    isClassB: Bool;
    balanceWithdrawn: Int as coins;
    owner: Address?;

    init(collectionAddress: Address, index: Int, isClassB: Bool) {
        require(sender() == collectionAddress, ErrorNotAuthorized);

        self.collectionAddress = collectionAddress;
        self.index = index;
        self.isClassB = isClassB;
        self.balanceWithdrawn = 0;
    }

    receive() {
    }

    receive(msg: AuthItemTransfer){
        let ctx: Context = context();
        
        if (self.owner == null) {  // Not initialized
            require(ctx.sender == self.collectionAddress, ErrorNotAuthorized);
            self.balanceWithdrawn = msg.initBalanceWithdrawn;
        } else {
            require(ctx.sender == self.owner, ErrorNotAuthorized);
        }

        self.owner = msg.newOwner;
    }

    get fun info(): AuthItemInfo {
        let balance: Int = myBalance();
        return AuthItemInfo{
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner!!,
            index: self.index,
            isClassB: self.isClassB,
            balanceWithdrawn: self.balanceWithdrawn,
            balance: balance           
        }
    }    
}