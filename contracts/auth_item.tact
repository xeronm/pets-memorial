import "@stdlib/deploy";
import "./messages.tact";
import "./exceptions.tact";
import "./utils.tact";

struct AuthItemInfo {
    collectionAddress: Address;
    ownerAddress: Address;
    index: Int;
    isClassB: Bool;
    balanceWithdrawn: Int;
    balance: Int;
    voteStateId: Int? as uint32;
}

contract AuthItem {
    collectionAddress: Address;
    index: Int as uint4; 
    isClassB: Bool;
    balanceWithdrawn: Int as coins;
    owner: Address;
    voteStateId: Int? as uint32;
    isPendingTx: Bool?;

    init(collectionAddress: Address, index: Int, isClassB: Bool) {
        require(sender() == collectionAddress, ErrorNotAuthorized);
        self.collectionAddress = collectionAddress;
        self.owner = collectionAddress;
        self.index = index;
        self.isClassB = isClassB;
        self.balanceWithdrawn = 0;
    }

    receive() {
    }

    receive(msg: AuthItemPutToVote) {
        require(self.isClassB == false, ErrorNotAuthorized);
        self.assertOwnerMethod();

        self.isPendingTx = true;
        send(SendParameters{
            to: self.collectionAddress,
            bounce: true,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: PutToVote{
                queryId: msg.queryId,
                index: self.index,
                isClassB: self.isClassB,
                message: msg.message,
            }.toCell()
        });        
    }

    bounced(msg: bounced<PutToVote>) {
        self.isPendingTx = null;
        self.voteReply(msg.queryId, VoteStatusError);
    }

    receive(msg: AuthItemVote) {
        self.assertOwnerMethod();
        require(self.isPendingTx == null, ErrorPendingTransaction);
        require(self.voteStateId != msg.stateId, ErrorVoteDuplicated);

        self.isPendingTx = true;
        send(SendParameters{
            to: self.collectionAddress,
            bounce: true,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: Vote{
                queryId: msg.queryId,
                stateId: msg.stateId,
                index: self.index,
                isClassB: self.isClassB,
                vote: msg.vote
            }.toCell()
        });        
    }

    bounced(msg: Vote) {
        self.isPendingTx = null;
        self.voteReply(msg.queryId, VoteStatusError);
    }

    receive(msg: VoteReply) {
        self.assertCollectionMethod();
        self.voteStateId = msg.stateId;
        self.isPendingTx = null;
        self.voteReply(msg.queryId, msg.status);
    }    

    receive(msg: AuthItemWithdraw) {
        // require(context().value >= WithdrawMinTons, ErrorInsufficientFunds);
        self.assertOwnerMethod();
        send(SendParameters{
            to: self.collectionAddress,
            bounce: true,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: Withdraw{
                queryId: msg.queryId,
                index: self.index,
                isClassB: self.isClassB,
                balanceWithdrawn: self.balanceWithdrawn,
            }.toCell()
        });
    }

    receive(msg: WithdrawReply) {
        self.assertCollectionMethod();
        require(!self.isInitialized() || (self.balanceWithdrawn <= msg.balanceWithdrawn), ErrorAssertion);
        let value: Int = msg.balanceWithdrawn - self.balanceWithdrawn;
        self.balanceWithdrawn = msg.balanceWithdrawn;

        nativeReserve(unpackQint(msg.storageReserve), 0);
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: 0,
            mode: SendRemainingBalance,
            body: AuthItemWithdrawResult{
                queryId: msg.queryId,
                value: value
            }.toCell(),
        });
    }

    receive(msg: AuthItemTransfer){
        self.assertCollectionMethod();
        if (!self.isInitialized()) {
            self.balanceWithdrawn = msg.balanceWithdrawn;
        }
        self.owner = msg.newOwner;
    }

    get fun info(): AuthItemInfo {
        let balance: Int = myBalance();
        return AuthItemInfo{
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner,
            index: self.index,
            isClassB: self.isClassB,
            voteStateId: self.voteStateId,
            balanceWithdrawn: self.balanceWithdrawn,
            balance: balance,
        }
    }

    get fun get_nft_data(): GetNftData {
        return GetNftData {
            isInitialized: self.isInitialized(), 
            index: ((self.index << 1) + (self.isClassB ? 1 : 0)) << 40,  // 40-bit offset 
            collectionAddress: self.collectionAddress, 
            ownerAddress: self.owner,
            individualContent: emptyCell(),
        };
    }

    // private methods
    fun assertOwnerMethod() {
        require(sender() == self.owner, ErrorNotAuthorized);
    }

    fun assertCollectionMethod() {
        require(sender() == self.collectionAddress, ErrorNotAuthorized);
    }

    fun isInitialized(): Bool {
        return (self.owner != self.collectionAddress);
    }

    fun voteReply(queryId: Int, status: Int) {
        send(SendParameters{
            to: self.owner,
            bounce: false,
            value: 0,
            mode: SendRemainingValue,
            body: AuthItemVoteReply{                
                queryId: queryId,
                status: status
            }.toCell(),
        });        
    }

}