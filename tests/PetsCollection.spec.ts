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
    ErrorNotEnoughtToncoin: 37,
    ErrorValidation: 12332,
    ErrorNotAuthorized: 42435,
    ErrorInsufficientFunds: 57532,
};


// B1 = B0 - Tx[0].valueIn + Tx[-1].valueIn - 
//          (Tx[0].totalFees + Tx[1].inForwardFee + Tx[-1].totalFees)

const MinTransactionAmount = toNano('0.1');

const MaxTonsDifference = toNano('0.001');

const MaxFeeStoragePerYear = {
    PetsCollection:     toNano('0.05'),
    MemoryNftSmall:     toNano('0.021'),
    MemoryNftMedium:    toNano('0.027'),
    MemoryNftBig128:    toNano('0.047'),
    MemoryNftBig256:    toNano('0.064'),
}

const StorageTonsReserve = {
    Collection:         toNano('0.05'),
}

const MaxGasConsumption = {
    //
    ExtMessage:         toNano('0.0025'),
    ExtInForwardFee:    toNano('0.0003'),
    Deposit:            toNano('0.0021'),
    //
    Deploy:             toNano('0.0045'),
    DeployInForwardFee: toNano('0.0138'),
    DeployResult:       toNano('0.0002'),
    //
    Withdraw:           toNano('0.0051'),
    WithdrawAndForward: toNano('0.0070'),
    WithdrawForward:    toNano('0.0002'),
    WithdrawForwardOutFee:    toNano('0.0005'),
    WithdrawResult:     toNano('0.0002'),    
    //
    UpdateSettings:     toNano('0.0049'),
    ChangeOwner:        toNano('0.0046'),
    Excesses:           toNano('0.0002'),
    //
    
    //
    MintPetMemoryNft:               toNano('0.0229'),
    _MintPetMemoryNft:              toNano('0.0114'),
    _MintPetMemoryNftInForwardFee:  toNano('0.009'),
    DestroyPetMemoryNft:            toNano('0.009'),
    EditPetMemoryNft:               toNano('0.010'),
    TransferPetMemoryNft:           toNano('0.0103'),
}


const MinTransactionTons = {
    get Deposit(): bigint {
        return MaxGasConsumption.Deposit + 
            MaxTonsDifference;
    },

    get CollectionDeploy(): bigint {
        return StorageTonsReserve.Collection +
            MaxGasConsumption.Deploy +
            MaxGasConsumption.DeployInForwardFee +
            MaxTonsDifference;
    },

    get Withdraw(): bigint {
        return MaxGasConsumption.Withdraw + 
            MaxGasConsumption.WithdrawResult + 
            MaxTonsDifference;
    },

    get WithdrawAndForward(): bigint {
        return MaxGasConsumption.WithdrawAndForward + 
            MaxGasConsumption.WithdrawForward + 
            MaxGasConsumption.WithdrawResult + 
            MaxTonsDifference;
    },

    get UpdateSettings(): bigint {
        return MaxGasConsumption.UpdateSettings + 
            MaxGasConsumption.Excesses + 
            MaxTonsDifference;
    },


    get ChangeOwner(): bigint {
        return MaxGasConsumption.ChangeOwner + 
            MaxGasConsumption.Excesses + 
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

const PrefixUriNew = "tonstorage://F70D2F7587DBDFD0928E1967A0B2783EC3ABD63846AEC3B055B4705AEF742871/images/";
const PrefixUriDefault = "https://muratov.xyz/petsmem/images/";

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


const resultReport: {[key: string]: any} = {
    tons: {},
    flows: {},
    storageAnnualFees: {},
};

function dumpResultReport() {
    fs.writeFileSync('./tests/report.json', JSON.stringify(resultReport, null, 4)); 
}

describe('PetsCollection Deploy', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;

    afterAll(async () => {
        console.log(resultReport);
        dumpResultReport();
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(deployer.address));
    });

    it('Deploy: should deploy', async () => {
        resultReport.tons.CollectionDeploy = fromNano(MinTransactionTons.CollectionDeploy);

        // 1. Deploy
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
        resultReport.flows.CollectionDeploy = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

        expect(deployResult.transactions).toHaveTransactionSeq([
            {},
            {totalFeesUpper: MaxGasConsumption.Deploy, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.DeployResult, from: petsCollection.address},
        ]); 
    });
        
    it('Deploy: should not deploy (InsufficientFunds)', async () => {       
        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: StorageTonsReserve.Collection,
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
            actionResultCode: ExitCodes.ErrorNotEnoughtToncoin,
        });
    });        
});


describe('PetsCollection Methods', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let deployResult: SendMessageResult;
    let nftUser: SandboxContract<TreasuryContract>;

    async function mintNft(feeClassA: bigint = 0n, feeClassB: bigint = 0n,
        newOwner: Address | null = null, value: bigint | null = null, data?: NftMutableMetaData) {
        const mintNftResult = await petsCollection.send(
            nftUser.getSender(),
            {
                value: value || (MinTransactionTons.MintPetMemoryNft + (data ? toNano('0.1') : 0n))
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

    afterAll(async () => {
        console.log(resultReport);
        dumpResultReport();
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(deployer.address));

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

        nftUser = await blockchain.treasury('NFT User');
    });

    it('<Get>: getInfo()', async () => {

        // 2. Collection Info
        const info = await petsCollection.getInfo();
        expect(info).toEqual({
            $$type: 'Info',
            feeStorageTons: toNano("0.05"),
            feeClassATons: toNano("0.025"),
            feeClassBTons: toNano("0.05"),
            balance: StorageTonsReserve.Collection,
            balanceClassA: toNano("0.05"),
            balanceClassB: 0n,
        });        
    });

    it('<Get>: get_collection_data()', async () => {
        // 3. get_collection_data()
        const data =  await petsCollection.getGetCollectionData();
        const attributes = await decodeNftMetadata(data.collectionContent);
        expect(attributes).toStrictEqual({
            name: 'Test Collection',
            description: 'Test Collection Description',
            image: 'https://muratov.xyz/petsmem/images/collection.png'
        });
    });

    it('<Storage>: verify storage fees for 1 Year', async () => {
        const user = await blockchain.treasury('user');

        const res1 = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionAmount,                
            },
            null,            
        )

        console.log('Deposit transaction details:');
        printTransactionFees(res1.transactions);

        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
        
        blockchain.now = time2;                                                    // set current time
        const res2 = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionAmount,
            },
            null
        )
        const flow1 = transactionAmountFlow(res2.transactions, user.address);
        resultReport.storageAnnualFees.Collection = fromNano(flow1.storageFees);
        expect(flow1.storageFees).toBeLessThanOrEqual(MaxFeeStoragePerYear.PetsCollection);        
    })

    it('Deploy: should not deploy (Second Deploy)', async () => {       
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

    it('UpdateSettings: should update settings', async () => {
        const updateSettings = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'UpdateSettings',
                queryId: 0n,
                feeStorage: 0x3An,
                feeClassA: 0x30n,
                feeClassB: 0n,
                prefixUri: PrefixUriNew,
            }
        )

        console.log('UpdateSettings Transdaction details:');
        printTransactionFees(updateSettings.transactions);
        expect(updateSettings.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.UpdateSettings, from: deployer.address, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.Excesses, from: petsCollection.address, to: deployer.address},
        ]);

        const flow = transactionAmountFlow(updateSettings.transactions, deployer.address);
        resultReport.flows.CollectionUpdateSettings = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};


        const info = await petsCollection.getInfo();

        expect(info).toStrictEqual({
            $$type: 'Info',
            feeStorageTons: toNano("0.025"),
            feeClassATons: toNano("0.001"),
            feeClassBTons: toNano("0"),
            balance: StorageTonsReserve.Collection,
            balanceClassA: toNano("0.05"),
            balanceClassB: 0n,
        });

        const data =  await petsCollection.getGetCollectionData();
        const attributes = await decodeNftMetadata(data.collectionContent);
        expect(attributes).toStrictEqual({
            name: 'Test Collection',
            description: 'Test Collection Description',
            image: 'tonstorage://F70D2F7587DBDFD0928E1967A0B2783EC3ABD63846AEC3B055B4705AEF742871/images/collection.png'
        });        
    });    

    it('UpdateSettings: should not update settings (Unathorized)', async () => {
        const user = await blockchain.treasury('unauthorized user');

        const putToVoteResult = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'UpdateSettings',
                queryId: 0n,
                feeStorage: 0x3An,
                feeClassA: 0n,
                feeClassB: 0n,
                prefixUri: null,
            }
        )

        expect(putToVoteResult.transactions).toHaveTransaction({
            from: user.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });    
    });

    it('Withdraw: should withdraw (classA)', async () => {
        // 1. Deposit some TONs
        const user = await blockchain.treasury('user');

        const deposit1 = await petsCollection.send(
            user.getSender(),
            {
                value: toNano("0.1"),
            },
            null
        );
        const flow1 = transactionAmountFlow(deposit1.transactions, user.address);
        resultReport.flows.CollectionDeposit = { amount: fromNano(flow1.outAmount - flow1.inAmount), totalFees: fromNano(flow1.totalFees)};

        expect(deposit1.transactions).toHaveTransaction({
            from: user.address,
            to: petsCollection.address,
            success: true,
        });

        const info = await petsCollection.getInfo();
        expect(info.balanceClassA).toBeLessThan(toNano('0.05') + toNano('0.1'));
        expect(info.balanceClassA).toBeGreaterThan(toNano('0.05') + toNano('0.1') - MinTransactionTons.Deposit);
        expect(info.balanceClassB).toBe(0n);

        const balance1 = await deployer.getBalance();

        resultReport.tons.CollectionWithdraw =  fromNano(MinTransactionTons.Withdraw);
        const withdrawResult1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.Withdraw,
            },
            {
                $$type: 'Withdraw',
                queryId: 0n,
                isClassB: false,
                amount: info.balanceClassA - toNano('0.05'),  // minus storageReserve
                customPayload: null,
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }
        );
        console.log('Withdraw Transaction details:');
        printTransactionFees(withdrawResult1.transactions);
        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.Withdraw, from: deployer.address, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.WithdrawResult, from: petsCollection.address, to: deployer.address},
        ]);  

        const flow2 = transactionAmountFlow(withdrawResult1.transactions, deployer.address);
        resultReport.flows.CollectionWithdraw = { amount: fromNano(flow2.outAmount - flow2.inAmount), totalFees: fromNano(flow2.totalFees)};
    

        const info2 = await petsCollection.getInfo();
        expect(info2.balanceClassA).toBe(info.balanceClassA);
        expect(info2.balance).toBe(toNano('0.05'));

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 - (
            MaxGasConsumption.ExtMessage + 
            MaxGasConsumption.ExtInForwardFee +
            MinTransactionTons.Withdraw +
            MaxGasConsumption.WithdrawResult) 
        );

    });

    it('Withdraw: should withdraw with forwarding (classA)', async () => {
        // 1. Deposit some TONs
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

        const info = await petsCollection.getInfo();
        expect(info.balanceClassA).toBeLessThan(toNano('0.05') + toNano('0.1'));
        expect(info.balanceClassA).toBeGreaterThan(toNano('0.05') + toNano('0.1') - MinTransactionTons.Deposit);
        expect(info.balanceClassB).toBe(0n);

        const balance1 = await deployer.getBalance();
        const withdrawAmount = info.balanceClassA - toNano('0.05');  // minus storageReserve

        resultReport.tons.CollectionWithdrawAndForward =  fromNano(MinTransactionTons.Withdraw);
        const withdrawResult1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.WithdrawAndForward,
            },
            {
                $$type: 'Withdraw',
                queryId: 0n,
                isClassB: false,
                amount: withdrawAmount,
                customPayload: null,
                forwardDestination: user.address,
                forwardPayload: new Cell().asSlice(),
            }
        );
        console.log('Withdraw(forward) Transaction details:');
        printTransactionFees(withdrawResult1.transactions);
        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.WithdrawAndForward, from: deployer.address, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.WithdrawForward, from: petsCollection.address, to: user.address, 
                valueLower: withdrawAmount - MaxGasConsumption.WithdrawForwardOutFee,  valueUpper: withdrawAmount},
            {totalFeesUpper: MaxGasConsumption.WithdrawResult, from: petsCollection.address, to: deployer.address},
        ]);  

        const flow2 = transactionAmountFlow(withdrawResult1.transactions, deployer.address);
        resultReport.flows.CollectionWithdrawAndForward = { amount: fromNano(flow2.outAmount - flow2.inAmount), totalFees: fromNano(flow2.totalFees)};
    
        const info2 = await petsCollection.getInfo();
        expect(info2.balanceClassA).toBe(info.balanceClassA);
        expect(info2.balance).toBe(toNano('0.05'));

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 - (
            MaxGasConsumption.ExtMessage + 
            MaxGasConsumption.ExtInForwardFee +
            MinTransactionTons.WithdrawAndForward +
            MaxGasConsumption.WithdrawResult + 
            MaxGasConsumption.WithdrawForward) 
        );

    });    

    it('Withdraw: should not withdraw (Unathorized)', async () => {
        const user = await blockchain.treasury('unauthorized user');

        const info1 = await petsCollection.getInfo();
        const withdrawResult = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionTons.Withdraw,
            },
            {
                $$type: 'Withdraw',
                queryId: 0n,
                isClassB: false,
                amount: toNano('0.01'),
                customPayload: null, 
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }            
        );

        const info2 = await petsCollection.getInfo();
        expect(info2.balanceClassA).toBe(info1.balanceClassA);
        expect(info2.balance).toBe(info1.balance);

        expect(withdrawResult.transactions).toHaveTransaction({
            from: user.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });        
    });

    it('Withdraw: should not withdraw (InsufficientFunds)', async () => {
        const info1 = await petsCollection.getInfo();        
        const withdrawResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.Withdraw,
            },
            {
                $$type: 'Withdraw',
                queryId: 0n,
                isClassB: false,
                amount: toNano('0.01'),
                customPayload: null, 
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }                        
        );
        console.log('Withdraw(InsufficientFunds) Transaction #1 details:');
        printTransactionFees(withdrawResult.transactions);
        
        const info2 = await petsCollection.getInfo();
        expect(info2.balanceClassA).toBe(info1.balanceClassA);
        expect(info2.balance).toBe(info1.balance);


        expect(withdrawResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });             
    });

    it('ChageOwner: should change owner', async () => {
        const user = await blockchain.treasury('new owner');

        const changeOwner = await petsCollection.send(
            deployer.getSender(),
            {
                value: MinTransactionTons.ChangeOwner,
            },
            {
                $$type: 'ChangeOwner',
                queryId: 0n,
                newOwner: user.address
            }
        )

        console.log('ChangeOwner Transdaction details:');
        printTransactionFees(changeOwner.transactions);
        expect(changeOwner.transactions).toHaveTransactionSeq([
            {totalFeesUpper: MaxGasConsumption.ExtMessage},
            {totalFeesUpper: MaxGasConsumption.ChangeOwner, from: deployer.address, to: petsCollection.address},
            {totalFeesUpper: MaxGasConsumption.Excesses, from: petsCollection.address, to: deployer.address},
        ]);

        const flow = transactionAmountFlow(changeOwner.transactions, deployer.address);
        resultReport.flows.CollectionChangeOwner = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

        const info = await petsCollection.getInfo();

        const data =  await petsCollection.getGetCollectionData();
        expect(data.ownerAddress).toEqualAddress(user.address);
    });    

    it('ChageOwner: should not withdraw (Unathorized)', async () => {
        const user = await blockchain.treasury('new owner');

        const changeOwner = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionTons.ChangeOwner,
            },
            {
                $$type: 'ChangeOwner',
                queryId: 0n,
                newOwner: user.address
            }
        )
        
        expect(changeOwner.transactions).toHaveTransaction({
            from: user.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });        
    });


    it('MintPetMemoryNft: shloud mint NFT for sender', async () => {
        resultReport.tons.MintPetMemoryNft = fromNano(MinTransactionTons.MintPetMemoryNft);
        const { mintNftResult, nftItem } = await mintNft();

        const flow = transactionAmountFlow(mintNftResult.transactions, nftUser.address);
        resultReport.flows.MintPetMemoryNft = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

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
            resultReport.MintPetMemoryNftBalance = fromNano(contract.balance);
    
            const nftData2 = await nftItem.getGetNftData();
            expect(nftData2.isInitialized).toBe(true);
            expect(nftData2.ownerAddress).toEqualAddress(nftUser.address);    
        }
    });


    it('MintPetMemoryNft: shloud mint NFT for 3rd party user', async () => {
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

    it('MintPetMemoryNft: shloud not mint NFT (InsufficientFunds)', async () => {
        const { mintNftResult } = await mintNft(0x40n, 0x40n);
        expect(mintNftResult.transactions).toHaveTransaction({
            from: nftUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });        

        const { mintNftResult: mintNftResult2 } = await mintNft(0x40n, 0x40n, null, MinTransactionTons.MintPetMemoryNft - toNano("0.025"));
        expect(mintNftResult2.transactions).toHaveTransaction({
            from: nftUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });          
    });

});


describe('PetMemoryNft Methods', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let nftUser: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let deployResult: SendMessageResult;

    beforeAll(async () => {
    });

    afterAll(async () => {
        console.log(resultReport);
        dumpResultReport();
    });

    async function mintNft(data?: NftMutableMetaData) {
        const mintNftResult = await petsCollection.send(
            nftUser.getSender(),
            {
                value: MinTransactionTons.MintPetMemoryNft + (data ? toNano('0.1') : 0n)
            },
            {
                $$type: 'MintPetMemoryNft',
                queryId: 0n,
                feeClassA: 0n,
                feeClassB: 0n,
                newOwner: null,
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
        deployer = await blockchain.treasury('deployer');

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(deployer.address));

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
        
        nftUser = await blockchain.treasury('some NFT user 1');
    });
        

    it('<Storage>: verify storage fees for 1 Year', async () => {
        const { nftItem: nftItem1 } = await mintNft({
                $$type: 'NftMutableMetaData',
                description: null,
                image: null,
                uri: null,
                imageData: null
            });
        const { nftItem: nftItem2 } = await mintNft();


        const { mintNftResult: mintNftResult128, nftItem: nftItem3 } = await mintNft({
                ...nftData, 
                imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-128x128.jpg'))
            });

        const flow128 = transactionAmountFlow(mintNftResult128.transactions, nftUser.address);
        resultReport.flows.MintPetMemoryNft_Big128 = { amount: fromNano(flow128.outAmount - flow128.inAmount), totalFees: fromNano(flow128.totalFees)};

        const { mintNftResult: mintNftResult256, nftItem: nftItem4 } = await mintNft({
            ...nftData, 
            imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-256x256.jpg'))
        });

        const flow256 = transactionAmountFlow(mintNftResult256.transactions, nftUser.address);
        resultReport.flows.MintPetMemoryNft_Big256 = { amount: fromNano(flow256.outAmount - flow256.inAmount), totalFees: fromNano(flow256.totalFees)};

    
        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
        
        blockchain.now = time2;                                                    // set current time


        for (const x of [
            { item: nftItem1, attr: 'MintPetMemoryNft_small', maxFee: MaxFeeStoragePerYear.MemoryNftSmall},
            { item: nftItem2, attr: 'MintPetMemoryNft_medium', maxFee: MaxFeeStoragePerYear.MemoryNftMedium},
            { item: nftItem3, attr: 'MintPetMemoryNft_big128', maxFee: MaxFeeStoragePerYear.MemoryNftBig128},
            { item: nftItem4, attr: 'MintPetMemoryNft_big256', maxFee: MaxFeeStoragePerYear.MemoryNftBig256},
        ]) {
            expect(x.item).toBeDefined();
            if (x.item) {
                const res = await x.item.send(
                    nftUser.getSender(),
                    {
                        value: MinTransactionAmount,
                    },
                    null
                )
                const flow = transactionAmountFlow(res.transactions, nftUser.address);
                resultReport.storageAnnualFees[x.attr] = fromNano(flow.storageFees);
                expect(flow.storageFees).toBeLessThanOrEqual(x.maxFee);
            }    
        }

    });
    
    it('Destroy: shloud destroy', async () => {
        resultReport.tons.PetMemoryNftDestroy = fromNano(MinTransactionTons.DestroyPetMemoryNft);
        const { nftItem } = await mintNft();
        expect(nftItem).not.toBeUndefined();
        if (nftItem) {

            const contract = await blockchain.getContract(nftItem.address);
            expect(contract.balance).toBeGreaterThanOrEqual(toNano("0.05"));
            const balaneBefore = contract.balance;

            const destroyResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MinTransactionTons.DestroyPetMemoryNft,
                },
                'Destroy'
            );
            
            const flow = transactionAmountFlow(destroyResult.transactions, nftUser.address);
            resultReport.flows.PetMemoryNftDestroy = { amount: fromNano(balaneBefore + flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};            

            console.log('Destroy NFT transaction details:');
            printTransactionFees(destroyResult.transactions);

            expect(destroyResult.transactions).toHaveTransactionSeq([
                {},
                {totalFeesUpper: MaxGasConsumption.DestroyPetMemoryNft, from: nftUser.address, to: nftItem.address},
                {totalFeesUpper: MaxGasConsumption._MintPetMemoryNft, from: nftItem.address, to: nftUser.address,
                    valueLower: balaneBefore},
            ]);   

            expect(contract.balance).toBe(0n);
            expect(contract.accountState).toBeUndefined();
        }
    });     

    it('Destroy: shloud not Destroy (NotAuthorized)', async () => {
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


    it('<Get>: get_nft_address_by_index()', async () => {
        const { nftItem } = await mintNft();

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const nftData = await nftItem.getGetNftData();

            const nftAddress = await petsCollection.getGetNftAddressByIndex(nftData.index);
            expect(nftAddress).toEqualAddress(nftItem.address);
        }
    });    


    it('<Get>: get_nft_content()', async () => {
        const imageData = fs.readFileSync('./assets/images/marcus-1-onchain-128x128.jpg');
        const { nftItem } = await mintNft({
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
    
    it('EditContent: shloud edit content', async () => {
        resultReport.tons.PetMemoryNftEditContent = fromNano(MinTransactionTons.EditPetMemoryNft);
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const editResult = await nftItem.send(
                nftUser.getSender(),
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

            const flow = transactionAmountFlow(editResult.transactions, nftUser.address);
            resultReport.flows.PetMemoryNftEditContent = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

            expect(editResult.transactions).toHaveTransactionSeq([
                {},
                {totalFeesUpper: MaxGasConsumption.EditPetMemoryNft, from: nftUser.address, to: nftItem.address},
            ]);

            const nftData = await nftItem.getGetNftData();
            const nftContent =  await petsCollection.getGetNftContent(nftData.index, nftData.individualContent);
            const attributes = await decodeNftMetadata(nftContent);
            expect(attributes.description).toBe('Overriden Description');
            expect(attributes.image).toBe('https://muratov.xyz/petsmem/images/cat.png');
            expect(attributes.uri).toBeUndefined();
        }
    });    


    it('EditContent: shloud not edit content (NotAuthorized)', async () => {
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

    
    it('Transfer: shloud transfer', async () => {
        resultReport.tons.PetMemoryNftTransfer = fromNano(MinTransactionTons.TransferPetMemoryNft);

        const user2 = await blockchain.treasury('some user 2');

        const { nftItem } = await mintNft();

        expect(nftItem).toBeDefined();
        if (nftItem) {
            const contractBefore = await blockchain.getContract(nftItem.address);
            expect(contractBefore.balance).toBe(toNano("0.05"));

            const transferResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MinTransactionTons.TransferPetMemoryNft,
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: new Cell().asSlice(),
                    responseDestination: nftUser.address,
                    newOwner: user2.address,
                }
            );

            console.log('Transfer NFT transaction details:');
            printTransactionFees(transferResult.transactions);            

            const flow = transactionAmountFlow(transferResult.transactions, nftUser.address);
            resultReport.flows.PetMemoryNftTransfer = { amount: fromNano(flow.outAmount - flow.inAmount), totalFees: fromNano(flow.totalFees)};

            expect(transferResult.transactions).toHaveTransactionSeq([
                {},
                {totalFeesUpper: MaxGasConsumption.TransferPetMemoryNft, from: nftUser.address, to: nftItem.address},
                {from: nftItem.address, to: nftUser.address, valueLower: toNano("0.04")},
            ]);

            const nftData = await nftItem.getGetNftData();
            expect(nftData.ownerAddress).toEqualAddress(user2.address);

            const contractAfter = await blockchain.getContract(nftItem.address);
            expect(contractAfter.balance).toBe(toNano("0.01"));
        }
    });  


    it('Transfer: hloud not transfer (NotAuthorized)', async () => {
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
                    responseDestination: nftUser.address,
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
