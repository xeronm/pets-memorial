import { 
    Blockchain, SandboxContract, BlockchainTransaction,
    SendMessageResult, TreasuryContract, printTransactionFees 
} from '@ton/sandbox';
import { toNano, fromNano, beginCell, Dictionary, Address, Cell } from '@ton/core';
import { NFTDictValueSerializer } from '../utils/dict';
import { toTextCellSnake } from '../utils/nftContent';
import { sha256 } from '@ton/crypto';
import { 
    PetsCollection, 
    loadAuthItemWithdrawResult,
    loadUpdateSettings,
    storeUpdateSettings,
    storeMintAuthItems,
    storeTransferAuthItems,
    TransferAuthItemItem,
    MintAuthItemItem,
    PetMemoryNftImmutableData,
    NftMutableMetaData,
} from '../wrappers/PetsCollection';
import '@ton/test-utils';
import { AuthItem } from '../build/PetsCollection/tact_AuthItem';

import './jest';
const fs = require('node:fs');
import { transactionStringify, transactionAmountFlow } from './jest';
import { PetMemoryNft } from '../build/PetsCollection/tact_PetMemoryNft';


const ExitCodes = {
    ErrorValidation: 12332,
    ErrorInsufficientFunds: 57532,
    ErrorMaxAuthItemCount: 2432,
    ErrorNotAuthorized: 42435,
    ErrorVoteInProgress: 18229,
    ErrorVoteInvalidState: 42676,
    ErrorVoteExpired: 44322,
    ErrorVoteDuplicated: 26719,
    ErrorPendingTransaction: 45351,
};


// B1 = B0 - Tx[0].valueIn + Tx[-1].valueIn - 
//          (Tx[0].totalFees + Tx[1].inForwardFee + Tx[-1].totalFees)

const MinTransactionAmount = toNano('0.1');

const MaxTonsDifference = toNano('0.001');

const MaxFeeStoragePerYear = {
    PetsCollection:     toNano('0.05'),
    AuthItem:           toNano('0.015'),
    MemoryNftSmall:     toNano('0.021'),
    MemoryNftMedium:    toNano('0.027'),
    MemoryNftBig128:    toNano('0.047'),
    MemoryNftBig256:    toNano('0.064'),
}

const StorageTonsReserve = {
    AuthItem:           toNano('0.05'),
    Collection:         toNano('0.05'),
}

const MaxGasConsumption = {
    //
    ExtMessage:         toNano('0.0025'),
    ExtInForwardFee:    toNano('0.0003'),
    //
    Deposit:            toNano('0.0034'),
    //
    Deploy:             toNano('0.0154'),
    DeployInForwardFee: toNano('0.0226'),
    MintAuthItem:       toNano('0.0032'),
    MintAuthItemInForwardFee: toNano('0.005'),
    DeployResult:       toNano('0.0002'),
    //
    Withdraw:           toNano('0.0045'),
    _Withdraw:          toNano('0.0090'),
    _WithdrawReply:     toNano('0.0060'),    
    WithdrawResult:     toNano('0.0002'),
    //
    PutToVoteUpdateSettings:    toNano('0.0046'),
    _PutToVoteUpdateSettings:   toNano('0.0085'),

    PutToVoteMintAuthItem:      toNano('0.0048'),
    _PutToVoteMintAuthItem:     toNano('0.0292'),

    _PutToVoteReply:   toNano('0.0045'),
    PutToVoteResult:   toNano('0.0002'),

    //
    MintPetMemoryNft:               toNano('0.0228'),
    _MintPetMemoryNft:              toNano('0.0114'),
    _MintPetMemoryNftInForwardFee:  toNano('0.009'),
    DestroyPetMemoryNft:            toNano('0.009'),
    EditPetMemoryNft:               toNano('0.010'),
    TransferPetMemoryNft:           toNano('0.0103'),
}


const MinTransactionTons = {
    get CollectionDeploy(): bigint {
        return StorageTonsReserve.Collection +
            StorageTonsReserve.AuthItem +
            MaxGasConsumption.Deploy +
            MaxGasConsumption.DeployInForwardFee +
            MaxGasConsumption.MintAuthItem +
            MaxTonsDifference;
    },

    get Withdraw(): bigint {
        return MaxGasConsumption.Withdraw + 
            MaxGasConsumption._Withdraw + 
            MaxGasConsumption._WithdrawReply + 
            MaxTonsDifference;
    },


    get _MintPetMemoryNft(): bigint {
        return toNano("0.05") + // Storage Fee
            MaxGasConsumption._MintPetMemoryNft +
            MaxGasConsumption._MintPetMemoryNftInForwardFee;
    },

    get MintPetMemoryNft(): bigint {
        return toNano("0.025") + toNano("0.05") + // ClassA + ClassB Fees
            toNano("0.05") + // Storage Fee
            MaxGasConsumption.MintPetMemoryNft +
            MaxGasConsumption._MintPetMemoryNft +
            MaxGasConsumption._MintPetMemoryNftInForwardFee +
            MaxTonsDifference;
    },

    get EditPetMemoryNft(): bigint {
        return MaxGasConsumption._MintPetMemoryNft +
            MaxGasConsumption._MintPetMemoryNftInForwardFee +
            MaxTonsDifference;
    },

    get DestroyPetMemoryNft(): bigint {
        return MaxGasConsumption.EditPetMemoryNft + MaxTonsDifference;
    },

    get TransferPetMemoryNft(): bigint {
        return MaxGasConsumption.TransferPetMemoryNft + MaxTonsDifference;
    },
}

function dumpTransactions(txs: BlockchainTransaction[]) {
    fs.writeFileSync('./transactions.json', transactionStringify(txs)); 
}

function describe_(...args: any) {
}

const PrefixUri = "tonstorage://E24049996AE60A0AC2255452B24716C6266D42B5BFA0323E1D75FB12A017B11A/";
const PrefixUriNew = "https://raw.githubusercontent.com/xeronm/pm-assets/refs/heads/main/";

async function decodeNftMetadata(cell: Cell): Promise<{[key: string]: string | Buffer}> {
    const data = cell.asSlice();
    const flag = data.loadUint(8);
    expect(flag).toBe(0x00);

    const dict = data.loadDict(
        Dictionary.Keys.Buffer(32),
        NFTDictValueSerializer
    )

    const keys = ['uri', 'image', 'image_data', 'name', 'description'];
    const attributes: {[key: string]: string | Buffer} = {};
    for (const key of keys) {
        const dictKey = await sha256(key);
        const dictValue = dict.get(dictKey);
        if (dictValue) {
            if (key === 'image_data') {
                attributes[key] = dictValue.content;
            }
            else {
                attributes[key] = dictValue.content.toString('utf-8');    
            }
        }
    }

    return attributes; 
}

describe('PetsCollection Deploy', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let resultReport: any;

    beforeAll(async () => {
        resultReport = {};
    });

    afterAll(async () => {
        console.log(resultReport);
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(PrefixUri));

        deployer = await blockchain.treasury('deployer');
    });

    it('should deploy', async () => {
        resultReport.collectionDeployTons = fromNano(MinTransactionTons.CollectionDeploy);

        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.CollectionDeploy
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        console.log('Deploy transaction details:');
        printTransactionFees(deployResult.transactions);

        const flow = transactionAmountFlow(deployResult.transactions, deployer.address);
        resultReport.deployPetsCollectionFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

        // 1. Root Transaction
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            deploy: true,
            success: true,
        });

        // 2. Minted Account
        const createdAccounts = deployResult.events.filter((x) => x.type == 'account_created');
        expect(createdAccounts.length).toEqual(2);
        const authItem = blockchain.openContract(AuthItem.fromAddress(createdAccounts[1].account));

        // 3. Mint NFT Transaction
        expect(deployResult.transactions).toHaveTransaction({
            from: petsCollection.address,
            to: authItem.address,
            deploy: true,
            success: true,
        });

        expect(deployResult.transactions).toHaveTransactionSeq([
            {},
            {totalFeesUpper: MaxGasConsumption.Deploy, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.MintAuthItem, valueLower: toNano("0.04"), valueUpper: toNano("0.05"), from: petsCollection.address},
        ]);

        // 4. Collection Info
        const info = await petsCollection.getInfo();
        expect(info).toEqual({
            $$type: 'Info',
            voteAction: null,
            voteDurationHours: 24n,
            votesFor: 0n,
            votesAgainst: 0n,
            classACount: 1n,
            classBCount: 0n,
            feeStorageTons: toNano("0.05"),
            feeClassATons: toNano("0.025"),
            feeClassBTons: toNano("0.05"),
            balance: StorageTonsReserve.Collection,
            balanceClassA: toNano("0.05"),
            balanceClassB: 0n,
        });        

        // 5. AuthItem Info
        const authItemInfo = await authItem.getInfo();

        resultReport.authItemBalance = fromNano(authItemInfo.balance);
        expect(authItemInfo.collectionAddress).toEqualAddress(petsCollection.address);
        expect(authItemInfo.ownerAddress).toEqualAddress(deployer.address);
        expect(authItemInfo.balance).toBeGreaterThanOrEqual(toNano("0.04"));
        expect(authItemInfo.balance).toBeLessThanOrEqual(StorageTonsReserve.AuthItem + MaxTonsDifference);
        expect(authItemInfo).toEqual({
            $$type: 'AuthItemInfo',
            collectionAddress: authItemInfo.collectionAddress,
            ownerAddress: authItemInfo.ownerAddress,
            index: 1n,
            isClassB: false,
            voteStateId: null,
            balanceWithdrawn: 0n,
            balance: authItemInfo.balance
        });

        // 6. get_collection_data()
        const data =  await petsCollection.getGetCollectionData();
        const attributes = await decodeNftMetadata(data.collectionContent);
        expect(attributes).toStrictEqual({
            name: 'Test Collection',
            description: 'Test Collection Description',
            image: 'tonstorage://E24049996AE60A0AC2255452B24716C6266D42B5BFA0323E1D75FB12A017B11A/collection.png'
        });

        // 7. AuthItem get_nft_data()
        const nftData = await authItem.getGetNftData();
        expect(nftData.isInitialized).toBe(true);

        // 8. AuthItem get_nft_content()
        const nftContent =  await petsCollection.getGetNftContent(nftData.index, nftData.individualContent);
        const attributes2 = await decodeNftMetadata(nftContent);
        expect(attributes2).toStrictEqual({
            name: 'Test Collection - Class A',
            description: 'Class A Token',
            image: 'tonstorage://E24049996AE60A0AC2255452B24716C6266D42B5BFA0323E1D75FB12A017B11A/classA.png',
        });
    });
        
    it('should not deploy (InsufficientFunds)', async () => {       
        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: StorageTonsReserve.Collection + StorageTonsReserve.AuthItem,
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });
    });        
});


describe('PetsCollection AuthItem (Single)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let authItem: SandboxContract<AuthItem>;
    let deployResult: SendMessageResult;
    let resultReport: any;

    beforeAll(async () => {
        resultReport = {};
    });

    afterAll(async () => {
        console.log(resultReport);
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(PrefixUri));

        deployer = await blockchain.treasury('deployer');

        deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.CollectionDeploy,
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            deploy: true,
            success: true,
        });

        // 2. Minted Account
        const createdAccounts = deployResult.events.filter((x) => x.type == 'account_created');
        expect(createdAccounts.length).toEqual(2);
        authItem = blockchain.openContract(AuthItem.fromAddress(createdAccounts[1].account));        
    });


    it('should not deploy (Second Deploy)', async () => {       
        const deployResult2 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.CollectionDeploy,
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult2.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorValidation,
        });
    });  

    it('verify available withdraw balance', async () => {
        // 1. Initial balance = 0.05 TON
        const availableForWithdraw1 = await petsCollection.getAvailableForWithdraw(false, 0n);
        resultReport.availableForWithdraw1 = fromNano(availableForWithdraw1);
        expect(availableForWithdraw1).toBe(0n);

        // 2. Deposit 0.02 TON, less than feeClassATons
        const deposit1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano("0.02") + MaxGasConsumption.Deposit,
            },
            null
        )
        const availableForWithdraw2 = await petsCollection.getAvailableForWithdraw(false, 0n);        
        resultReport.availableForWithdraw2 = fromNano(availableForWithdraw2);
        expect(availableForWithdraw2).toBe(0n);

        // 3. Deposit 0.02 TON, less than feeClassATons
        const deposit2 = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano("0.02") + MaxGasConsumption.Deposit,
            },
            null
        )
        expect(deposit1.transactions[1].totalFees.coins).toBeLessThanOrEqual(MaxGasConsumption.Deposit);

        const availableForWithdraw3 = await petsCollection.getAvailableForWithdraw(false, 0n);
        resultReport.availableForWithdraw3 = fromNano(availableForWithdraw3);
        expect(availableForWithdraw3).toBeGreaterThan(toNano("0.04"));

        const availableForWithdraw4 = await petsCollection.getAvailableForWithdraw(false, toNano("0.01"));
        resultReport.availableForWithdraw4 = fromNano(availableForWithdraw4);
        expect(availableForWithdraw4).toBeGreaterThan(toNano("0.04") - toNano("0.01"));

        const availableForWithdraw5 = await petsCollection.getAvailableForWithdraw(false, toNano("0.02"));
        resultReport.availableForWithdraw5 = fromNano(availableForWithdraw5);
        expect(availableForWithdraw5).toBe(0n);
    });

    it('verify storage fees for 1 Year', async () => {
        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year

        const user = await blockchain.treasury('user');
        
        blockchain.now = time2;                                                    // set current time
        const res1 = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionAmount,
            },
            null
        )
        const flow1 = transactionAmountFlow(res1.transactions, user.address);
        resultReport.storagePetsCollection = fromNano(flow1.storageFees);
        expect(flow1.storageFees).toBeLessThanOrEqual(MaxFeeStoragePerYear.PetsCollection);

        const res2 = await authItem.send(
            user.getSender(),
            {
                value: MinTransactionAmount,
            },
            null
        )
        const flow2 = transactionAmountFlow(res2.transactions, user.address);
        resultReport.storageAuthItem = fromNano(flow2.storageFees);
        expect(flow2.storageFees).toBeLessThanOrEqual(MaxFeeStoragePerYear.AuthItem);
    });

    it('Unathorized PuToVote (direct API call)', async () => {
        const msg = beginCell();
        storeUpdateSettings({
            $$type: 'UpdateSettings',
            feeStorage: 0x3An,
            feeClassA: 0n,
            feeClassB: 0n,
            voteDurationHours: 24n,
            prefixUri: null,
        })(msg);
        msg.endCell();

        const putToVoteResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'PutToVote',
                queryId: 0n,
                index: 0n,
                isClassB: false,
                message: msg.asCell(),
            }
        )

        expect(putToVoteResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });    
    });

    it('AuthItem: should not withdraw (Unathorized)', async () => {
        const user = await blockchain.treasury('unauthorized user');

        const withdrawResult = await authItem.send(
            user.getSender(),
            {
                value: MinTransactionTons.Withdraw,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }            
        );
        
        expect(withdrawResult.transactions).toHaveTransaction({
            from: user.address,
            to: authItem.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });        
    });

    it('AuthItem: should not withdraw (not enought gas)', async () => {
        const availableForWithdraw1 = await petsCollection.getAvailableForWithdraw(false, 0n);
        expect(availableForWithdraw1).toBe(0n);
   
        const balance1 = await deployer.getBalance();
        const info1 = await petsCollection.getInfo();

        // 1. Failing 1-st message in chain
        const withdrawResult1 = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.Withdraw - MaxTonsDifference,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }
        );
        expect(withdrawResult1.transactions.length).toBe(2);
        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.Withdraw, to: authItem.address, success: false},
        ]);        

        const info2 = await petsCollection.getInfo();
        expect(info2).toEqual(info1);

        // 2. Failing 2-nd message in chain
        const withdrawResult2 = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.Withdraw + MaxGasConsumption._Withdraw 
                    - MaxTonsDifference,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }
        );
        expect(withdrawResult2.transactions.length).toBe(3);
        expect(withdrawResult2.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.Withdraw, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption._Withdraw, to: petsCollection.address, success: false},
        ]);        
       

        const info3 = await petsCollection.getInfo();
        expect(info3).toEqual(info1);

        // 3. Failing 3-rd message in chain
        const withdrawResult3 = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.Withdraw + MaxGasConsumption._Withdraw + 
                    MaxGasConsumption._WithdrawReply - MaxTonsDifference,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }
        );
        expect(withdrawResult3.transactions.length).toBe(4);
        expect(withdrawResult3.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.Withdraw, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption._Withdraw, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption._WithdrawReply, from: petsCollection.address, success: false},
        ]);   

        const info4 = await petsCollection.getInfo();
        expect(info4).toStrictEqual(info1);
    });

    it('AuthItem: should withdraw (gas enought for 2-nd message, get rest from withdrawal amount)', async () => {
        const availableForWithdraw1 = await petsCollection.getAvailableForWithdraw(false, 0n);
        expect(availableForWithdraw1).toBe(0n);
   
        const balance1 = await deployer.getBalance();
        const info1 = await petsCollection.getInfo();

        // 1. Deposit some TONs and try to withdraw with enought gas for 2-nd message processing
        //    as a result 3-rd and 4-th message would be process for withdrawn non-zero value
        const user = await blockchain.treasury('user');
        const deposit = await petsCollection.send(
            user.getSender(),
            {
                value: toNano("0.1"),
            },
            null
        );        

        // 2. Gas enought for 3-rd message in chain
        const withdrawResult = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.Withdraw + MaxGasConsumption._Withdraw + 
                    MaxGasConsumption._WithdrawReply,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }
        );
        expect(withdrawResult.transactions.length).toBe(5);

        let result1: any = {value: null};
        if ('body' in withdrawResult.events[3]) {
            result1 = loadAuthItemWithdrawResult(withdrawResult.events[3].body.asSlice());
        }
        expect(result1.value).toBeGreaterThanOrEqual(toNano("0.1") - MaxGasConsumption.Deposit);        

        const info2 = await petsCollection.getInfo();
        expect(info2).toEqual({...info1, balanceClassA: info1.balanceClassA + result1.value});
    });

    it('AuthItem: should withdraw (itemCount=1)', async () => {
        const availableForWithdraw1 = await petsCollection.getAvailableForWithdraw(false, 0n);
        expect(availableForWithdraw1).toBe(0n);

        const balance1 = await deployer.getBalance();

        resultReport.withdrawAuthItemTons =  fromNano(MinTransactionTons.Withdraw);
        const withdrawResult1 = await authItem.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.Withdraw,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }
        );
        console.log('Withdraw Transaction details:');
        printTransactionFees(withdrawResult1.transactions);
        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.Withdraw, from: deployer.address, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption._Withdraw, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption._WithdrawReply, from: petsCollection.address, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption.WithdrawResult, from: authItem.address, to: deployer.address},
        ]);  

        const flow1 = transactionAmountFlow(withdrawResult1.transactions, deployer.address);
        resultReport.withdrawAuthItemFlow = { amount: fromNano(flow1.outAmount - flow1.inAmount), totalFees: fromNano(flow1.totalFees)};
    
        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 - (
            MaxGasConsumption.ExtMessage + 
            MaxGasConsumption.ExtInForwardFee +
            MinTransactionTons.Withdraw +
            MaxGasConsumption.WithdrawResult) 
        );

        let result1: any = {value: null};
        if ('body' in withdrawResult1.events[3]) {
            result1 = loadAuthItemWithdrawResult(withdrawResult1.events[3].body.asSlice());
        }
        expect(result1.value).toBe(0n);

        // 2. After deposit some TONs
        const user = await blockchain.treasury('user');

        const deposit1 = await petsCollection.send(
            user.getSender(),
            {
                value: toNano("0.1"),
            },
            null
        );
        expect(deposit1.transactions).toHaveTransaction({
            from: user.address,
            to: petsCollection.address,
            success: true,
        });        

        const balance3 = await deployer.getBalance();

        const withdrawResult2 = await authItem.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemWithdraw',
                'queryId': 0n,
            }
        );        
        expect(withdrawResult2.transactions).toHaveTransaction({
            from: authItem.address,
            to: deployer.address,
            success: true,
        });
        const balance4 = await deployer.getBalance();

        let result2: any = {value: null};
        if ('body' in withdrawResult2.events[3]) {
            result2 = loadAuthItemWithdrawResult(withdrawResult2.events[3].body.asSlice());
        }
        expect(result2.value).toBeGreaterThanOrEqual(toNano("0.1") - MaxGasConsumption.Deposit);

        // console.log(balance3, balance4, result2);
    });

    it('AuthItem: PutToVote->UpdateSettings', async () => {
        const msg = beginCell();
        storeUpdateSettings({
            $$type: 'UpdateSettings',
            feeStorage: 0x3An,
            feeClassA: 0n,
            feeClassB: 0n,
            voteDurationHours: 24n,
            prefixUri: PrefixUriNew,
        })(msg);
        msg.endCell();

        const updateSettings = await authItem.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemPutToVote',
                queryId: 0n,
                message: msg.asCell()
            }
        )

        console.log('PutToVote(UpdateSettings) Transdaction details:');
        printTransactionFees(updateSettings.transactions);
        expect(updateSettings.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.PutToVoteUpdateSettings, from: deployer.address, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption._PutToVoteUpdateSettings, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption._PutToVoteReply, from: petsCollection.address, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption.PutToVoteResult, from: authItem.address, to: deployer.address},
        ]);

        const flow = transactionAmountFlow(updateSettings.transactions, deployer.address);
        resultReport.updateSettingPetsCollectionFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};


        const info = await petsCollection.getInfo();
        expect(info.voteAction).toBeNull();
        // if (info.voteAction?.message) {
        //     const msgUpdateSettings = loadUpdateSettings(info.voteAction.message.asSlice());
        //     expect(msgUpdateSettings).toStrictEqual({
        //         $$type: 'UpdateSettings',
        //         queryId: 0n,
        //         feeStorage: 0x3An,
        //         feeClassA: 0n,
        //         feeClassB: 0n
        //     });
        // }

        expect(info).toStrictEqual({
            $$type: 'Info',
            voteAction: null,
            voteDurationHours: 24n,
            votesFor: 0n,
            votesAgainst: 0n,
            classACount: 1n,
            classBCount: 0n,
            feeStorageTons: toNano("0.025"),
            feeClassATons: toNano("0"),
            feeClassBTons: toNano("0"),
            balance: StorageTonsReserve.Collection,
            balanceClassA: toNano("0.05"),
            balanceClassB: 0n,
        });

        const authItemInfo = await authItem.getInfo();
        expect(authItemInfo.collectionAddress).toEqualAddress(petsCollection.address);
        expect(authItemInfo.ownerAddress).toEqualAddress(deployer.address);
        expect(authItemInfo.balance).toBeGreaterThanOrEqual(toNano("0.04"));
        expect(authItemInfo.balance).toBeLessThanOrEqual(StorageTonsReserve.AuthItem + MaxTonsDifference); 
        expect(authItemInfo.voteStateId).not.toBeNull();
    });    

    it('AuthItem: PutToVote->MintAuthItem', async () => {
        const userA = await blockchain.treasury('user class A');
        const userB = await blockchain.treasury('user class B');
        const items = <Dictionary<number, MintAuthItemItem>>Dictionary.empty();
        items.set(0, {
            $$type: 'MintAuthItemItem',
            owner: userA.address,
            isClassB: false,
        });
        items.set(1, 
        {
            $$type: 'MintAuthItemItem',
            owner: userB.address,
            isClassB: true,
        });        

        const msg = beginCell();
        storeMintAuthItems({
            $$type: 'MintAuthItems',
            items: items,
        })(msg);
        msg.endCell();

        const mintAuthItems = await authItem.send(
            deployer.getSender(),
            {
                value: StorageTonsReserve.AuthItem * 2n + MinTransactionAmount,
            },
            {
                $$type: 'AuthItemPutToVote',
                queryId: 0n,
                message: msg.asCell()
            }
        )

        expect(mintAuthItems.transactions).toHaveTransaction({
            from: authItem.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });

        const deposit = await petsCollection.send(
            deployer.getSender(),
            {
                value: StorageTonsReserve.AuthItem * 2n + MinTransactionAmount,
            },
            null
        );         

        const info = await petsCollection.getInfo();        

        const mintAuthItems2 = await authItem.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemPutToVote',
                queryId: 0n,
                message: msg.asCell()
            }
        )

        console.log('PutToVote(MintAuthItem) Transdaction details:');
        printTransactionFees(mintAuthItems2.transactions);

        const createdAccounts = mintAuthItems2.events.filter((x) => x.type == 'account_created');
        expect(createdAccounts.length).toEqual(2);
        const createdContracts = createdAccounts.map(x => blockchain.openContract(AuthItem.fromAddress(x.account)));

        expect(mintAuthItems2.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.PutToVoteMintAuthItem, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption._PutToVoteMintAuthItem, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.MintAuthItem, valueLower: toNano("0.04"), valueUpper: toNano("0.05"), 
                from: petsCollection.address, to: createdContracts[0].address},
            {totalFeesUpper: MaxGasConsumption.MintAuthItem, valueLower: toNano("0.04"), valueUpper: toNano("0.05"), 
                from: petsCollection.address, to: createdContracts[1].address},
            {totalFeesUpper: MaxGasConsumption._PutToVoteReply, from: petsCollection.address, to: authItem.address},
            {totalFeesUpper: MaxGasConsumption.PutToVoteResult, from: authItem.address, to: deployer.address},
        ]);           

        const flow = transactionAmountFlow(mintAuthItems2.transactions, deployer.address);
        resultReport.mintAuthItemPetsCollectionFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

        const authItem1Info = await createdContracts[0].getInfo();
        expect(authItem1Info.collectionAddress).toEqualAddress(petsCollection.address);
        expect(authItem1Info.ownerAddress).toEqualAddress(userA.address);
        expect(authItem1Info).toEqual({
            $$type: 'AuthItemInfo',
            collectionAddress: authItem1Info.collectionAddress,
            ownerAddress: authItem1Info.ownerAddress,
            index: 2n,
            isClassB: false,
            voteStateId: null,
            balanceWithdrawn: 0n,
            balance: authItem1Info.balance
        });

        const authItem2Info = await createdContracts[1].getInfo();
        expect(authItem2Info.collectionAddress).toEqualAddress(petsCollection.address);
        expect(authItem2Info.ownerAddress).toEqualAddress(userB.address);
        expect(authItem2Info).toEqual({
            $$type: 'AuthItemInfo',
            collectionAddress: authItem2Info.collectionAddress,
            ownerAddress: authItem2Info.ownerAddress,
            index: 3n,
            isClassB: true,
            voteStateId: null,
            balanceWithdrawn: 0n,
            balance: authItem2Info.balance
        });

        const info2 = await petsCollection.getInfo();
        expect(info2.voteAction).toBeNull();
        expect(info2).toStrictEqual({
            $$type: 'Info',
            voteAction: null,
            voteDurationHours: 24n,
            votesFor: 0n,
            votesAgainst: 0n,
            classACount: 2n,
            classBCount: 1n,
            feeStorageTons: toNano("0.05"),
            feeClassATons: toNano("0.025"),
            feeClassBTons: toNano("0.05"),
            balance: info2.balance,
            balanceClassA: info2.balance,
            balanceClassB: 0n,
        });
               
    });

});


describe('PetsCollection AuthItem (Multiple: PutToVote->TransferAuthItem)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let user3: SandboxContract<TreasuryContract>;
    let user4: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let authItem: SandboxContract<AuthItem>;
    let deployResult: SendMessageResult;
    let resultReport: any;
    let authItem1: SandboxContract<AuthItem>;
    let authItem2: SandboxContract<AuthItem>;
    let authItem3: SandboxContract<AuthItem>;
    let authItem4: SandboxContract<AuthItem>;

    beforeAll(async () => {
        resultReport = {};
    });

    afterAll(async () => {
        console.log(resultReport);
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(PrefixUri));

        deployer = await blockchain.treasury('deployer');

        deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.CollectionDeploy,
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );        

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            deploy: true,
            success: true,
        });    

        // 2. Minted Account
        const createdAccounts = deployResult.events.filter((x) => x.type == 'account_created');
        expect(createdAccounts.length).toEqual(2);
        authItem = blockchain.openContract(AuthItem.fromAddress(createdAccounts[1].account));
        

        const deposit = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano("1"),
            },
            null
        );     

        user1 = await blockchain.treasury('user 1 class A');
        user2 = await blockchain.treasury('user 2 class A');
        user3 = await blockchain.treasury('user 3 class A');
        user4 = await blockchain.treasury('user 4 class B');
        const items = <Dictionary<number, MintAuthItemItem>>Dictionary.empty();
        items.set(0, {
            $$type: 'MintAuthItemItem',
            owner: user1.address,
            isClassB: false,
        });
        items.set(1, {
            $$type: 'MintAuthItemItem',
            owner: user2.address,
            isClassB: false,
        });        
        items.set(2, {
            $$type: 'MintAuthItemItem',
            owner: user3.address,
            isClassB: false,
        }); 
        items.set(3, {
            $$type: 'MintAuthItemItem',
            owner: user4.address,
            isClassB: true,
        }); 

        const msg = beginCell();
        storeMintAuthItems({
            $$type: 'MintAuthItems',
            items: items,
        })(msg);
        msg.endCell();

        const mintAuthItems = await authItem.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemPutToVote',
                queryId: 0n,
                message: msg.asCell()
            }
        )

        const createdAccounts2 = mintAuthItems.events.filter((x) => x.type == 'account_created');
        expect(createdAccounts2.length).toEqual(4);
        authItem1 = blockchain.openContract(AuthItem.fromAddress(createdAccounts2[0].account));
        authItem2 = blockchain.openContract(AuthItem.fromAddress(createdAccounts2[1].account));
        authItem3 = blockchain.openContract(AuthItem.fromAddress(createdAccounts2[2].account));
        authItem4 = blockchain.openContract(AuthItem.fromAddress(createdAccounts2[3].account));
        
        const user5 = await blockchain.treasury('user 5');
        const transfetItems = <Dictionary<number, TransferAuthItemItem>>Dictionary.empty();
        transfetItems.set(0, {
            $$type: 'TransferAuthItemItem',
            address: authItem1.address,
            newOwner: user5.address,
        });
        transfetItems.set(1, {
            $$type: 'TransferAuthItemItem',
            address: authItem2.address,
            newOwner: petsCollection.address,
        });

        const msg2 = beginCell();
        storeTransferAuthItems({
            $$type: 'TransferAuthItems',
            items: transfetItems,
        })(msg2);
        msg2.endCell();

        const transferAuthItems = await authItem.send(
            deployer.getSender(),
            {
                value: StorageTonsReserve.AuthItem * 2n + MinTransactionAmount,
            },
            {
                $$type: 'AuthItemPutToVote',
                queryId: 0n,
                message: msg2.asCell()
            }
        )

        const flow = transactionAmountFlow(transferAuthItems.transactions, deployer.address);
        resultReport.transferAuthItemsPetsCollectionFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

             
        const info1 = await petsCollection.getInfo();
        expect(info1.voteAction).not.toBeNull();
        expect(info1.votesFor).toBe(1n);
        expect(info1.votesAgainst).toBe(0n);
        expect(info1.classACount).toBe(4n);
    });

    it('AuthItem: AuthItemVote should declined due to VoteInvalidState', async () => {
        const info1 = await petsCollection.getInfo();

        const user1Vote = await authItem1.send(
            user1.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemVote',
                queryId: 0n,
                stateId: (info1.voteAction?.stateId ?? 0n) + 1n,
                vote: true,
            }
        )
        
        expect(user1Vote.transactions).toHaveTransaction({
            from: authItem1.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorVoteInvalidState,
        });         
    });

    it('AuthItem: AuthItemVote should declined due to VoteExpired', async () => {
        const info1 = await petsCollection.getInfo();

        const time1 = Math.floor(Date.now() / 1000);                         // current local unix time
        const time2 = time1 + 24 * 60 * 60;                                  // offset for 24 hours

        blockchain.now = time2;  

        const user1Vote = await authItem1.send(
            user1.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemVote',
                queryId: 0n,
                stateId: info1.voteAction?.stateId ?? 0n,
                vote: true,
            }
        )
        
        expect(user1Vote.transactions).toHaveTransaction({
            from: authItem1.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorVoteExpired,
        });         
    });


    it('AuthItem: AuthItemVote should accept 2 votes & execute', async () => {
        const info1 = await petsCollection.getInfo();

        const user1Vote = await authItem1.send(
            user1.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemVote',
                queryId: 0n,
                stateId: info1.voteAction?.stateId ?? 0n,
                vote: true,
            }
        )      
        const flow1 = transactionAmountFlow(user1Vote.transactions, user1.address);
        resultReport.votePetsCollectionFlow = { amount: fromNano(flow1.outAmount - flow1.inAmount), totalFees: fromNano(flow1.totalFees)};

        
        const info2 = await petsCollection.getInfo();
        expect(info2.voteAction).not.toBeNull();
        expect(info2.votesFor).toBe(2n);

        const item1Info = await authItem1.getInfo();
        expect(item1Info.voteStateId).toBe(info1.voteAction?.stateId ?? 0n);

        //
        const user1VoteDup = await authItem1.send(
            user1.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemVote',
                queryId: 0n,
                stateId: info1.voteAction?.stateId ?? 0n,
                vote: true,
            }
        )
        expect(user1VoteDup.transactions).toHaveTransaction({
            to: authItem1.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorVoteDuplicated,
        });        

        const user2Vote = await authItem2.send(
            user2.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'AuthItemVote',
                queryId: 0n,
                stateId: info1.voteAction?.stateId ?? 0n,
                vote: true,
            }
        )
        const flow2 = transactionAmountFlow(user2Vote.transactions, user2.address);
        resultReport.voteAndExecutePetsCollectionFlow = { amount: fromNano(flow2.outAmount - flow2.inAmount), totalFees: fromNano(flow2.totalFees)};

        printTransactionFees(user2Vote.transactions);

        const info3 = await petsCollection.getInfo();
        expect(info3.voteAction).toBeNull();
        expect(info3.votesFor).toBe(0n);
    }); 

});


describe('PetsCollection PetMemoryNft', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let authItem: SandboxContract<AuthItem>;
    let deployResult: SendMessageResult;
    let resultReport: any;

    const nftData: NftMutableMetaData = {
        $$type: 'NftMutableMetaData',
        uri: 'https://s.getgems.io/nft/c/6738e6330102dc6fdeba9f27/1000000/meta.json',
        image: 'https://s.getgems.io/nft/c/6738e6330102dc6fdeba9f27/1000000/image.png',
        imageData: null,
        description: "He appeared in our lives on 08/19/2023. We noticed him a week earlier, " +
                    "on the way to the gym. A big, gray cat, thin as a skeleton, was running" +
                    " out of an abandoned private house, looked at people with piercing emerald eyes," +
                    " and screamed. We tried to feed him, but that day I realized that if he did not" +
                    " run out at some day, I would not be able to forgive myself. An hour later, my" +
                    " wife and I caught him. It was a former domestic, neutered cat, 10-12 years old," +
                    " with CKD. Then there were 15 months of struggle and joy of life, ups and downs," +
                    " and dozens of visits to vets. Several times we thought that he wouldn't get out," +
                    " but he had an iron will to live. However, on 11/15/2024, he passed away."
    }

    const nftImmData: PetMemoryNftImmutableData = {
        $$type: 'PetMemoryNftImmutableData',
        species: 2n,
        name: 'Marcus',
        sex: 0n,
        speciesName: null,
        breed: 'Nibelung',
        lang: 0x8Dn,         // "en"
        countryCode: 0x234n, // "ru"
        location: 'Krasnodar 350020',
        birthDate: 0n,
        deathDate: 0x20241115n,
    }

    beforeAll(async () => {
        resultReport = {};
    });

    afterAll(async () => {
        console.log(resultReport);
    });

    async function mintNft(feeClassA: bigint = 0n, feeClassB: bigint = 0n, 
        newOwner: Address | null = null, data?: NftMutableMetaData) {
        const mintNftResult = await petsCollection.send(
            user1.getSender(),
            {
                value: MinTransactionTons.MintPetMemoryNft + (data ? toNano('0.1') : 0n)
            },
            {
                $$type: 'MintPetMemoryNft',
                queryId: 0n,
                feeClassA: feeClassA,
                feeClassB: feeClassB,
                newOwner: newOwner,
                content: {
                    $$type: 'PetMemoryNftContent',
                    immData: nftImmData,
                    data: data ?? nftData
                }
            }
        );

        // 4. Minted Account
        let nftItem: SandboxContract<PetMemoryNft> | undefined;
        const mintedAccounts = mintNftResult.events.filter((x) => x.type == 'account_created');
        if (mintedAccounts.length == 1) {
            nftItem = blockchain.openContract(PetMemoryNft.fromAddress(mintedAccounts[0].account));
        }

        return {mintNftResult, nftItem};
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(PrefixUri));

        deployer = await blockchain.treasury('deployer');

        deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.CollectionDeploy,
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            deploy: true,
            success: true,
        });

        // 2. Minted Account
        const createdAccounts = deployResult.events.filter((x) => x.type == 'account_created');
        expect(createdAccounts.length).toEqual(2);
        authItem = blockchain.openContract(AuthItem.fromAddress(createdAccounts[1].account));  
        
        user1 = await blockchain.treasury('some user 1');
    });

    it('shloud mint NFT for sender', async () => {
        resultReport.mintPetMemoryNftTons = fromNano(MinTransactionTons.MintPetMemoryNft);
        const { mintNftResult, nftItem } = await mintNft();

        const flow = transactionAmountFlow(mintNftResult.transactions, user1.address);
        resultReport.mintPetMemoryNftFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

        console.log('Mint NFT transaction details:');
        printTransactionFees(mintNftResult.transactions);

        expect(mintNftResult.transactions).toHaveTransactionSeq([
            {},
            {totalFeesUpper: MaxGasConsumption.MintPetMemoryNft, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption._MintPetMemoryNft, from: petsCollection.address, 
                valueLower: MinTransactionTons._MintPetMemoryNft, deploy: true},
        ]);

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const contract = await blockchain.getContract(nftItem.address);
            expect(contract.balance).toBe(toNano("0.05"));
            resultReport.mintPetMemoryNftBalance = fromNano(contract.balance);
    
            const nftData2 = await nftItem.getGetNftData();
            expect(nftData2.isInitialized).toBe(true);
            expect(nftData2.ownerAddress).toEqualAddress(user1.address);    
        }
    });


    it('shloud mint NFT for 3rd party user', async () => {
        const user2 = await blockchain.treasury('some user 2');

        const { mintNftResult, nftItem } = await mintNft(0n, 0n, user2.address);
        expect(mintNftResult.transactions).toHaveTransactionSeq([
            {},
            {totalFeesUpper: MaxGasConsumption.MintPetMemoryNft, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption._MintPetMemoryNft, from: petsCollection.address, 
                valueLower: MinTransactionTons._MintPetMemoryNft, deploy: true},
        ]);        

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const nftData = await nftItem.getGetNftData();
            expect(nftData.isInitialized).toBe(true);
            expect(nftData.ownerAddress).toEqualAddress(user2.address);
        }
    });


    it('verify storage fees for 1 Year', async () => {
        const { nftItem: nftItem1 } = await mintNft(0n, 0n, null, {
                $$type: 'NftMutableMetaData',
                description: null,
                image: null,
                uri: null,
                imageData: null
            });
        const { nftItem: nftItem2 } = await mintNft();


        const { mintNftResult: mintNftResult128, nftItem: nftItem3 } = await mintNft(0n, 0n, null, {
                ...nftData, 
                imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-128x128.jpg'))
            });

        const flow128 = transactionAmountFlow(mintNftResult128.transactions, user1.address);
        resultReport.mintBig128PetMemoryNftFlow = { amount: fromNano(flow128.outAmount - flow128.inAmount), totalFees: fromNano(flow128.totalFees)};

        const { mintNftResult: mintNftResult256, nftItem: nftItem4 } = await mintNft(0n, 0n, null, {
            ...nftData, 
            imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-256x256.jpg'))
        });

        const flow256 = transactionAmountFlow(mintNftResult256.transactions, user1.address);
        resultReport.mintBig256PetMemoryNftFlow = { amount: fromNano(flow256.outAmount - flow256.inAmount), totalFees: fromNano(flow256.totalFees)};

    
        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
        
        blockchain.now = time2;                                                    // set current time


        for (const x of [
            { item: nftItem1, attr: 'storageSmallPetMemoryNft', maxFee: MaxFeeStoragePerYear.MemoryNftSmall},
            { item: nftItem2, attr: 'storageMediumPetMemoryNft', maxFee: MaxFeeStoragePerYear.MemoryNftMedium},
            { item: nftItem3, attr: 'storageBig128PetMemoryNft', maxFee: MaxFeeStoragePerYear.MemoryNftBig128},
            { item: nftItem4, attr: 'storageBig256PetMemoryNft', maxFee: MaxFeeStoragePerYear.MemoryNftBig256},
        ]) {
            expect(x.item).toBeDefined();
            if (x.item) {
                const res = await x.item.send(
                    user1.getSender(),
                    {
                        value: MinTransactionAmount,
                    },
                    null
                )
                const flow = transactionAmountFlow(res.transactions, user1.address);
                resultReport[x.attr] = fromNano(flow.storageFees);
                expect(flow.storageFees).toBeLessThanOrEqual(x.maxFee);
            }    
        }

    });    
        
    it('shloud not mint NFT (InsufficientFunds)', async () => {
        const { mintNftResult } = await mintNft(0x40n, 0x40n);
        expect(mintNftResult.transactions).toHaveTransaction({
            from: user1.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });        
    });

    it('shloud destroy', async () => {
        resultReport.destroyPetMemoryNftTons = fromNano(MinTransactionTons.DestroyPetMemoryNft);
        const { nftItem } = await mintNft();
        expect(nftItem).not.toBeUndefined();
        if (nftItem) {

            const contract = await blockchain.getContract(nftItem.address);
            expect(contract.balance).toBeGreaterThanOrEqual(toNano("0.05"));
            const balaneBefore = contract.balance;

            const destroyResult = await nftItem.send(
                user1.getSender(),
                {
                    value: MinTransactionTons.DestroyPetMemoryNft,
                },
                'Destroy'
            );
            
            const flow = transactionAmountFlow(destroyResult.transactions, user1.address);
            resultReport.destroyPetMemoryNftFlow = { amount: fromNano(balaneBefore + flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};            

            console.log('Destroy NFT transaction details:');
            printTransactionFees(destroyResult.transactions);

            expect(destroyResult.transactions).toHaveTransactionSeq([
                {},
                {totalFeesUpper: MaxGasConsumption.DestroyPetMemoryNft, from: user1.address, to: nftItem.address},
                {totalFeesUpper: MaxGasConsumption._MintPetMemoryNft, from: nftItem.address, to: user1.address,
                    valueLower: balaneBefore},
            ]);   

            expect(contract.balance).toBe(0n);
            expect(contract.accountState).toBeUndefined();
        }
    });     

    it('shloud not Destroy (NotAuthorized)', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const destroyResult = await nftItem.send(
                deployer.getSender(),
                {
                    value: MinTransactionTons.DestroyPetMemoryNft,
                },
                'Destroy'
            );
    
            expect(destroyResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: nftItem.address,
                success: false,
                aborted: true,
                exitCode: ExitCodes.ErrorNotAuthorized,
            });    
        }
    });


    it('get_nft_address_by_index()', async () => {
        const { nftItem } = await mintNft();

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const nftData = await nftItem.getGetNftData();

            const nftAddress = await petsCollection.getGetNftAddressByIndex(nftData.index);
            expect(nftAddress).toEqualAddress(nftItem.address);
        }
    });    


    it('get_nft_content()', async () => {
        const imageData = fs.readFileSync('./assets/images/marcus-1-onchain-128x128.jpg');
        const { nftItem } = await mintNft(0n, 0n, null, {
            ...nftData, 
            imageData: toTextCellSnake(imageData),
        });

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const nftData1 = await nftItem.getGetNftData();

            const nftContent = await petsCollection.getGetNftContent(nftData1.index, nftData1.individualContent);

            const attributes = await decodeNftMetadata(nftContent);
            expect(attributes.description).toBe(nftData.description);
            expect(attributes.uri).toBe(nftData.uri);
            expect(attributes.image).toBe(nftData.image);
            expect(attributes.name).toBe('Marcus, Cat, RU, Krasnodar 350020 (* ~ 2024-11-15)');
            expect(attributes.image_data.length).toBeGreaterThan(3000);
            expect(attributes.image_data).toStrictEqual(imageData);
        }
    });  
    
    it('shloud EditContent', async () => {
        resultReport.editPetMemoryNftTons = fromNano(MinTransactionTons.EditPetMemoryNft);
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const editResult = await nftItem.send(
                user1.getSender(),
                {
                    value: MinTransactionTons.EditPetMemoryNft,
                },
                {
                    $$type: 'EditContent',
                    queryId: 0n,
                    data: {
                        $$type: 'NftMutableMetaData',
                        description: 'Overriden Description',
                        image: null,
                        imageData: null,
                        uri: null
                    }
                }
            );

            const flow = transactionAmountFlow(editResult.transactions, user1.address);
            resultReport.editPetMemoryNftFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

            expect(editResult.transactions).toHaveTransactionSeq([
                {},
                {totalFeesUpper: MaxGasConsumption.EditPetMemoryNft, from: user1.address, to: nftItem.address},
            ]);

            const nftData = await nftItem.getGetNftData();
            const nftContent =  await petsCollection.getGetNftContent(nftData.index, nftData.individualContent);
            const attributes = await decodeNftMetadata(nftContent);
            expect(attributes.description).toBe('Overriden Description');
            expect(attributes.image).toBe('tonstorage://E24049996AE60A0AC2255452B24716C6266D42B5BFA0323E1D75FB12A017B11A/cat.png');
            expect(attributes.uri).toBeUndefined();
        }
    });    


    it('shloud not EditContent (NotAuthorized)', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const editResult = await nftItem.send(
                deployer.getSender(),
                {
                    value: MinTransactionTons.EditPetMemoryNft,
                },
                {
                    $$type: 'EditContent',
                    queryId: 0n,
                    data: {
                        $$type: 'NftMutableMetaData',
                        description: 'Overriden Description',
                        image: null,
                        imageData: null,
                        uri: null
                    }
                }
            );
    
            expect(editResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: nftItem.address,
                success: false,
                aborted: true,
                exitCode: ExitCodes.ErrorNotAuthorized,
            });    
        }
    });

    
    it('shloud Transfer', async () => {
        resultReport.transferPetMemoryNftTons = fromNano(MinTransactionTons.TransferPetMemoryNft);

        const user2 = await blockchain.treasury('some user 2');

        const { nftItem } = await mintNft();

        expect(nftItem).toBeDefined();
        if (nftItem) {
            const contractBefore = await blockchain.getContract(nftItem.address);
            expect(contractBefore.balance).toBe(toNano("0.05"));

            const transferResult = await nftItem.send(
                user1.getSender(),
                {
                    value: MinTransactionTons.TransferPetMemoryNft,
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: new Cell().asSlice(),
                    responseDestination: user1.address,
                    newOwner: user2.address,
                }
            );

            console.log('Transfer NFT transaction details:');
            printTransactionFees(transferResult.transactions);            

            const flow = transactionAmountFlow(transferResult.transactions, user1.address);
            resultReport.transferPetMemoryNftFlow = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

            expect(transferResult.transactions).toHaveTransactionSeq([
                {},
                {totalFeesUpper: MaxGasConsumption.TransferPetMemoryNft, from: user1.address, to: nftItem.address},
                {from: nftItem.address, to: user1.address, valueLower: toNano("0.04")},
            ]);

            const nftData = await nftItem.getGetNftData();
            expect(nftData.ownerAddress).toEqualAddress(user2.address);

            const contractAfter = await blockchain.getContract(nftItem.address);
            expect(contractAfter.balance).toBe(toNano("0.01"));
        }
    });  


    it('shloud not Transfer (NotAuthorized)', async () => {
        const user2 = await blockchain.treasury('some user 2');        
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const transferResult = await nftItem.send(
                user2.getSender(),
                {
                    value: MinTransactionTons.TransferPetMemoryNft,
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: new Cell().asSlice(),
                    responseDestination: user1.address,
                    newOwner: user2.address,
                }
            );
    
            expect(transferResult.transactions).toHaveTransaction({
                from: user2.address,
                to: nftItem.address,
                success: false,
                aborted: true,
                exitCode: ExitCodes.ErrorNotAuthorized,
            });    
        }
    });

});
