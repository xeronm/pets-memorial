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
    loadPetMemoryNftContent,
} from '../wrappers/PetsCollection';
import '@ton/test-utils';

import './jest';
const fs = require('node:fs');
import { transactionStringify, transactionAmountFlow, transactionReport } from './jest';
import { PetMemoryNft } from '../build/PetsCollection/tact_PetMemoryNft';


const ExitCodes = {
    ErrorNotEnoughtToncoin: 37,
    ErrorValidation: 14516,
    ErrorNotAuthorized: 54277,
    ErrorInsufficientFunds: 15166,
};


const MinTransactionAmount = toNano('0.004'); // Deposit `totalFees`
const MaxTransactionAmount = toNano('0.25');  // Mint Big NFT
const MaxBalanceDifference = toNano('0.01');
const MaxClassABalanceDifference = toNano('0.002');

const StorageTonsReserve = {
    Collection:             toNano('0.05'),
    PetMemoryNftMinting:    toNano('0.05'),
    PetMemoryNftMin:        toNano('0.01'),
}

function dumpTransactions(txs: BlockchainTransaction[]) {
    fs.writeFileSync('./tests/transactions.json', transactionStringify(txs));
}

function describe_(...args: any) {
}

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
    geoPoint: null,
    birthDate: 0x20120000n,
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
    flows: {},
    storageAnnualFees: {},
    details: {},
};

function dumpResultReport() {
    fs.writeFileSync(
        './tests/report.json',
        JSON.stringify(resultReport, (k, v) => (typeof v === 'bigint' ? fromNano(v) : v), 4)
    );
}

describe('PetsCollection Deploy', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let addrNames: {[name: string]: Address};

    afterAll(async () => {
        dumpResultReport();
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(deployer.address));

        addrNames = {
            'Deployer': deployer.address,
            'Collection': petsCollection.address,
        }
    });

    it('Deploy: should deploy', async () => {
        // 1. Deploy
        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount
            },
            {
                $$type: 'Deploy'
            }
        );

        resultReport.details.CollectionDeploy = transactionReport(deployResult.transactions, PetsCollection.opcodes, addrNames);
        // console.log('Deploy transaction details:');
        // printTransactionFees(deployResult.transactions);
        // dumpTransactions(deployResult.transactions);
        expect(deployResult.transactions).toHaveTransactionSeq([
            {},
            {to: petsCollection.address, deploy: true},
            {from: petsCollection.address},
        ]);

        const contract = await blockchain.getContract(petsCollection.address);
        expect(contract.balance).toBe(StorageTonsReserve.Collection);

        resultReport.flows.CollectionDeploy = {
            ...transactionAmountFlow(deployResult.transactions),
            collectionBalance: contract.balance
        };
    });

    it('Deploy: should not deploy (InsufficientFunds)', async () => {
        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: StorageTonsReserve.Collection,
            },
            {
                $$type: 'Deploy'
            }
        );
        resultReport.details.CollectionDeploy_InsufficientFunds = transactionReport(deployResult.transactions, PetsCollection.opcodes, addrNames);

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
    let anyUser: SandboxContract<TreasuryContract>;
    let nftUser: SandboxContract<TreasuryContract>;
    let addrNames: {[name: string]: Address};


    async function mintNft(feeClassA: bigint = 0n, feeClassB: bigint = 0n,
        sender: SandboxContract<TreasuryContract> | null = null, value: bigint | null = null, data?: NftMutableMetaData) {
        const mintNftResult = await petsCollection.send(
            (sender || nftUser).getSender(),
            {
                value: value || MaxTransactionAmount
            },
            {
                $$type: 'MintPetMemoryNft',
                feeClassA: feeClassA,
                feeClassB: feeClassB,
                newOwner: sender ? nftUser.address : null,
                content: {
                    $$type: 'PetMemoryNftContent',
                    immData: nftImmData,
                    data: data ?? nftData,
                    feeDueTime: BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60),
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
        dumpResultReport();
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(deployer.address));

        deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Deploy'
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            deploy: true,
            success: true,
        });

        nftUser = await blockchain.treasury('NFT User');
        anyUser = await blockchain.treasury('Any User');

        addrNames = {
            'Deployer': deployer.address,
            'NftOwner': nftUser.address,
            'AnyUser': anyUser.address,
            'Collection': petsCollection.address,
        }
    });

    it('<Get>: get_info()', async () => {

        // 2. Collection Info
        const info = await petsCollection.getGetInfo();
        expect(info).toEqual({
            $$type: 'Info',
            feeStorageTons: toNano("0.05"),
            feeClassATons: toNano("0.025"),
            feeClassBTons: toNano("0.05"),
            balance: StorageTonsReserve.Collection,
            balanceClassA: toNano("0.05"),
            balanceClassB: 0n,
            fbMode: 0n,
            fbUri: "https://s.petsmem.site/c/",
            data: {
                $$type: 'NftMutableMetaData',
                uri: null,
                description: null,
                image: null,
                imageData: null,
            }
        });
    });

    it('<Get>: get_collection_data()', async () => {
        // 3. get_collection_data()
        const data =  await petsCollection.getGetCollectionData();
        const attributes = await decodeNftMetadata(data.collectionContent);
        expect(attributes).toStrictEqual({
            name: 'Test Collection',
            image: `https://s.petsmem.site/c/${petsCollection.address}?q=image`
        });
    });

    it('<Storage>: verify storage fees for 1 Year', async () => {
        const deposit1 = await petsCollection.send(
            anyUser.getSender(),
            {
                value: MinTransactionAmount,
            },
            null,
        )

        resultReport.details.CollectionDeposit = transactionReport(deposit1.transactions, PetsCollection.opcodes, addrNames);
        resultReport.flows.CollectionDeposit = transactionAmountFlow(deposit1.transactions);

        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
        blockchain.now = time2;                                                    // set current time

        const res2 = await petsCollection.send(
            anyUser.getSender(),
            {
                value: MinTransactionAmount,
            },
            null
        )
        const report2 = transactionReport(res2.transactions, PetsCollection.opcodes, addrNames);
        resultReport.storageAnnualFees.Collection = report2[1].storageFees ?? 0n;
    })

    it('UpdateSettings: should update settings', async () => {
        const updateSettings = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'UpdateSettings',
                feeStorage: 0x3An,
                feeClassA: 0x30n,
                feeClassB: 0n,
                fbMode: 1n,
                fbUri: 'https://s.petsmem.ru/c/',
                data: {
                    $$type: 'NftMutableMetaData',
                    description: 'New Collection Description',
                    uri: "ipfs://bafybeiaxrkfpyhiryq75mstavipmsc4r674huymxext4sf4jbzwtni26j4/meta.json",
                    image: "http://abcd.com/myimage.jpeg",
                    imageData: null,
                }
            }
        )

        resultReport.details.CollectionUpdateSettings = transactionReport(updateSettings.transactions, PetsCollection.opcodes, addrNames);

        expect(updateSettings.transactions).toHaveTransactionSeq([
            {},
            {from: deployer.address, to: petsCollection.address},
            {from: petsCollection.address, to: deployer.address},
        ]);

        resultReport.flows.CollectionUpdateSettings = transactionAmountFlow(updateSettings.transactions);

        const info = await petsCollection.getGetInfo();

        expect(info).toStrictEqual({
            $$type: 'Info',
            feeStorageTons: toNano("0.025"),
            feeClassATons: toNano("0.001"),
            feeClassBTons: toNano("0"),
            balance: StorageTonsReserve.Collection,
            balanceClassA: toNano("0.05"),
            balanceClassB: 0n,
            fbMode: 1n,
            fbUri: "https://s.petsmem.ru/c/",
            data: {
                $$type: 'NftMutableMetaData',
                description: "New Collection Description",
                image: "http://abcd.com/myimage.jpeg",
                imageData: null,
                uri: "ipfs://bafybeiaxrkfpyhiryq75mstavipmsc4r674huymxext4sf4jbzwtni26j4/meta.json",
            }
        });

        const data =  await petsCollection.getGetCollectionData();
        const attributes = await decodeNftMetadata(data.collectionContent);
        expect(attributes).toStrictEqual({
            name: 'Test Collection',
            description: 'New Collection Description',
            image: `http://abcd.com/myimage.jpeg`,
            uri: `https://s.petsmem.ru/c/${petsCollection.address}?q=uri`,
        });
    });

    it('UpdateSettings: should not update settings (Unathorized)', async () => {
        const updateSettings = await petsCollection.send(
            anyUser.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'UpdateSettings',
                feeStorage: 0x3An,
                feeClassA: 0n,
                feeClassB: 0n,
                fbMode: 0n,
                fbUri: null,
                data: null,
            }
        )
        resultReport.details.CollectionUpdateSettings_Unauthorized = transactionReport(updateSettings.transactions, PetsCollection.opcodes, addrNames);

        expect(updateSettings.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });
    });

    it('Withdraw: should withdraw (classA)', async () => {
        // 1. Deposit some TONs
        const deposit1 = await petsCollection.send(
            anyUser.getSender(),
            {
                value: toNano("0.1"),
            },
            null
        );

        expect(deposit1.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: true,
        });

        const info = await petsCollection.getGetInfo();
        expect(info.balanceClassA).toBeLessThan(StorageTonsReserve.Collection + toNano('0.1'));
        expect(info.balanceClassA).toBeGreaterThan(StorageTonsReserve.Collection + toNano('0.1') - MinTransactionAmount);
        expect(info.balanceClassB).toBe(0n);

        const balance1 = await deployer.getBalance();

        const withdrawAmount = info.balanceClassA - StorageTonsReserve.Collection;
        const withdrawResult1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Withdraw',
                isClassB: false,
                amount: withdrawAmount,
                customPayload: null,
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }
        );

        resultReport.details.CollectionWithdraw = transactionReport(withdrawResult1.transactions, PetsCollection.opcodes, addrNames);

        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {},
            {from: deployer.address, to: petsCollection.address},
            {from: petsCollection.address, to: deployer.address},
        ]);

        resultReport.flows.CollectionWithdraw = transactionAmountFlow(withdrawResult1.transactions);
        resultReport.flows.CollectionWithdraw.withdrawnAmount = withdrawAmount;

        const info2 = await petsCollection.getGetInfo();
        expect(info2.balanceClassA).toBe(toNano('0.05')); // storageReserve
        expect(info2.balance).toBe(toNano('0.05'));

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 + withdrawAmount - MaxBalanceDifference);
    });

    it('Withdraw: should withdraw with forwarding (classA)', async () => {
        // 1. Deposit some TONs
        const deposit1 = await petsCollection.send(
            anyUser.getSender(),
            {
                value: toNano("0.1"),
            },
            null
        );

        expect(deposit1.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: true,
        });

        const info = await petsCollection.getGetInfo();
        expect(info.balanceClassA).toBeLessThan(StorageTonsReserve.Collection + toNano('0.1'));
        expect(info.balanceClassA).toBeGreaterThan(StorageTonsReserve.Collection + toNano('0.1') - MinTransactionAmount);
        expect(info.balanceClassB).toBe(0n);

        const balance1 = await deployer.getBalance();
        const withdrawAmount = info.balanceClassA - StorageTonsReserve.Collection;

        const userBalance1 = await anyUser.getBalance();
        const withdrawResult1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Withdraw',
                isClassB: false,
                amount: withdrawAmount,
                customPayload: null,
                forwardDestination: anyUser.address,
                forwardPayload: new Cell().asSlice(),
            }
        );

        resultReport.details.CollectionWithdrawAndForward = transactionReport(withdrawResult1.transactions, PetsCollection.opcodes, addrNames);

        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {},
            {from: deployer.address, to: petsCollection.address},
            {from: petsCollection.address, to: anyUser.address,
                valueLower: withdrawAmount - MinTransactionAmount,  valueUpper: withdrawAmount},
            {from: petsCollection.address, to: deployer.address},
        ]);

        resultReport.flows.CollectionWithdrawAndForward = transactionAmountFlow(withdrawResult1.transactions);

        const info2 = await petsCollection.getGetInfo();
        expect(info2.balanceClassA).toBe(toNano('0.05')); // storageReserve
        expect(info2.balance).toBe(toNano('0.05'));

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 - MaxBalanceDifference);

        const userBalance2 = await anyUser.getBalance();
        expect(userBalance2).toBeGreaterThanOrEqual(userBalance1 + withdrawAmount - MaxBalanceDifference);
    });


    it('Withdraw: should withdraw (classB)', async () => {
        // Deposit fee for minting on Class B balance
        const info0 = await petsCollection.getGetInfo();

        const { mintNftResult, nftItem } = await mintNft();
        expect(nftItem).toBeDefined();

        const info = await petsCollection.getGetInfo();
        expect(info.balanceClassA).toBeGreaterThanOrEqual(toNano('0.075'));
        expect(info.balanceClassA).toBeLessThanOrEqual(toNano('0.075') + MaxClassABalanceDifference);
        expect(info.balanceClassB).toBe(toNano('0.05'));

        const balance1 = await deployer.getBalance();
        const withdrawAmount = toNano('0.025');
        const withdrawResult1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Withdraw',
                isClassB: true,
                amount: withdrawAmount,
                customPayload: null,
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }
        );

        resultReport.details.CollectionWithdrawClassB = transactionReport(withdrawResult1.transactions, PetsCollection.opcodes, addrNames);

        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {},
            {from: deployer.address, to: petsCollection.address},
            {from: petsCollection.address, to: deployer.address},
        ]);

        resultReport.flows.CollectionWithdrawClassB = transactionAmountFlow(withdrawResult1.transactions);
        resultReport.flows.CollectionWithdrawClassB.withdrawnAmount = withdrawAmount;

        const info2 = await petsCollection.getGetInfo();
        expect(info2.balanceClassA).toAlmostEqualTons(info.balanceClassA);
        expect(info2.balance).toBe(info2.balanceClassA + info2.balanceClassB);

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 + withdrawAmount - MaxBalanceDifference);
    });

    it('Withdraw: should not withdraw (Unathorized)', async () => {
        const info1 = await petsCollection.getGetInfo();
        const withdrawResult = await petsCollection.send(
            anyUser.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Withdraw',
                isClassB: false,
                amount: toNano('0.01'),
                customPayload: null,
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }
        );
        resultReport.details.CollectionWithdraw_Unathorized = transactionReport(withdrawResult.transactions, PetsCollection.opcodes, addrNames);

        const info2 = await petsCollection.getGetInfo();
        expect(info2.balanceClassA).toAlmostEqualTons(info1.balanceClassA);
        expect(info2.balance).toBe(info1.balance);

        expect(withdrawResult.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });
    });

    it('Withdraw: should not withdraw (InsufficientFunds)', async () => {
        const info1 = await petsCollection.getGetInfo();
        const withdrawResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Withdraw',
                isClassB: false,
                amount: toNano('0.01'),
                customPayload: null,
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }
        );

        resultReport.details.CollectionWithdraw_InsufficientFunds = transactionReport(withdrawResult.transactions, PetsCollection.opcodes, addrNames);

        const info2 = await petsCollection.getGetInfo();
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
        const changeOwner = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'ChangeOwner',
                newOwner: anyUser.address
            }
        )

        resultReport.details.CollectionChangeOwner = transactionReport(changeOwner.transactions, PetsCollection.opcodes, addrNames);

        expect(changeOwner.transactions).toHaveTransactionSeq([
            {},
            {from: deployer.address, to: petsCollection.address},
            {from: petsCollection.address, to: deployer.address},
        ]);

        resultReport.flows.CollectionChangeOwner = transactionAmountFlow(changeOwner.transactions);

        const info = await petsCollection.getGetInfo();

        const data =  await petsCollection.getGetCollectionData();
        expect(data.ownerAddress).toEqualAddress(anyUser.address);
    });

    it('ChageOwner: should not withdraw (Unathorized)', async () => {
        const changeOwner = await petsCollection.send(
            anyUser.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'ChangeOwner',
                newOwner: anyUser.address
            }
        )

        resultReport.details.CollectionChangeOwner_Unathorized = transactionReport(changeOwner.transactions, PetsCollection.opcodes, addrNames);

        expect(changeOwner.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });
    });


    it('MintPetMemoryNft: shloud mint NFT for sender', async () => {
        const expectedDueTime = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
        const info1 = await petsCollection.getGetInfo();

        const { mintNftResult, nftItem } = await mintNft();

        resultReport.details.MintPetMemoryNft = transactionReport(mintNftResult.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem?.address});

        resultReport.flows.MintPetMemoryNft = transactionAmountFlow(mintNftResult.transactions);

        expect(mintNftResult.transactions).toHaveTransactionSeq([
            {},
            {to: petsCollection.address},
            {from: petsCollection.address, deploy: true},
        ]);

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const contract = await blockchain.getContract(nftItem.address);
            resultReport.flows.MintPetMemoryNft.nftBalance = contract.balance;
            expect(contract.balance).toBe(toNano("0.05"));

            const nftData2 = await nftItem.getGetNftData();
            expect(nftData2.isInitialized).toBe(true);
            expect(nftData2.ownerAddress).toEqualAddress(nftUser.address);
            const content = loadPetMemoryNftContent(nftData2.individualContent.asSlice());
            expect(content.feeDueTime).toBeGreaterThanOrEqual(expectedDueTime);

            const info2 = await petsCollection.getGetInfo();
            expect(info2.balanceClassA).toBeGreaterThanOrEqual(info1.balanceClassA + toNano("0.025"));
            expect(info2.balanceClassA).toBeLessThanOrEqual(info1.balanceClassA + toNano("0.025") + MaxClassABalanceDifference);
            expect(info2.balanceClassB).toBe(info1.balanceClassB + toNano("0.05"));
            expect(info2.balance).toBeGreaterThanOrEqual(info1.balance);
        }
    });

    it('MintPetMemoryNft: shloud mint NFT for 3rd party user', async () => {
        const expectedDueTime = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
        const { mintNftResult, nftItem } = await mintNft(0n, 0n, anyUser);

        resultReport.details.MintPetMemoryNft3rdParty = transactionReport(mintNftResult.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem?.address});

        resultReport.flows.MintPetMemoryNft3rdParty = transactionAmountFlow(mintNftResult.transactions);

        expect(mintNftResult.transactions).toHaveTransactionSeq([
            {},
            {to: petsCollection.address},
            {from: petsCollection.address, deploy: true},
        ]);

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const contract = await blockchain.getContract(nftItem.address);
            resultReport.flows.MintPetMemoryNft3rdParty.nftBalance = contract.balance;
            expect(contract.balance).toBe(toNano("0.05"));

            const nftData2 = await nftItem.getGetNftData();
            expect(nftData2.isInitialized).toBe(true);
            expect(nftData2.ownerAddress).toEqualAddress(nftUser.address);
            const content = loadPetMemoryNftContent(nftData2.individualContent.asSlice());
            expect(content.feeDueTime).toBeGreaterThanOrEqual(expectedDueTime);
        }
    });

    it('MintPetMemoryNft: shloud not mint NFT (InsufficientFunds)', async () => {
        const { mintNftResult, nftItem } = await mintNft(0x40n, 0x40n);

        resultReport.details.MintPetMemoryNft_InsufficientFunds = transactionReport(mintNftResult.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem?.address});

        expect(mintNftResult.transactions).toHaveTransaction({
            from: nftUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });

        const { mintNftResult: mintNftResult2 } = await mintNft(0n, 0n, null, toNano("0.025"));

        resultReport.details.MintPetMemoryNft_InsufficientFunds2 = transactionReport(mintNftResult2.transactions, PetsCollection.opcodes, addrNames);

        expect(mintNftResult2.transactions).toHaveTransaction({
            from: nftUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorInsufficientFunds,
        });
    });

    it('Withdraw: should withdraw (classA, in 1 year)', async () => {
        // 1. Deposit some TONs
        const deposit1 = await petsCollection.send(
            anyUser.getSender(),
            {
                value: toNano("0.1"),
            },
            null
        );

        expect(deposit1.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: true,
        });

        const info = await petsCollection.getGetInfo();
        expect(info.balanceClassA).toBeLessThan(StorageTonsReserve.Collection + toNano('0.1'));
        expect(info.balanceClassA).toBeGreaterThan(StorageTonsReserve.Collection + toNano('0.1') - MinTransactionAmount);
        expect(info.balanceClassB).toBe(0n);

        const balance1 = await deployer.getBalance();

        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
        blockchain.now = time2;                                                    // set current time

        const withdrawAmount = info.balanceClassA - StorageTonsReserve.Collection - resultReport.storageAnnualFees.Collection;
        const withdrawResult1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Withdraw',
                isClassB: false,
                amount: withdrawAmount,
                customPayload: null,
                forwardDestination: null,
                forwardPayload: new Cell().asSlice(),
            }
        );

        resultReport.details.CollectionWithdraw_1year = transactionReport(withdrawResult1.transactions, PetsCollection.opcodes, addrNames);

        expect(withdrawResult1.transactions).toHaveTransactionSeq([
            {},
            {from: deployer.address, to: petsCollection.address},
            {from: petsCollection.address, to: deployer.address},
        ]);

        resultReport.flows.CollectionWithdraw_1year = transactionAmountFlow(withdrawResult1.transactions);
        resultReport.flows.CollectionWithdraw_1year.withdrawnAmount = withdrawAmount;

        const info2 = await petsCollection.getGetInfo();
        expect(info2.balanceClassA).toBe(toNano('0.05')); // storageReserve
        expect(info2.balance).toBe(toNano('0.05'));

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 + withdrawAmount - MaxBalanceDifference);
    });

    it('MintPetMemoryNft: shloud mint NFT for sender (in 1 year)', async () => {
        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
        blockchain.now = time2;                                                    // set current time

        const { mintNftResult, nftItem } = await mintNft();

        resultReport.details.MintPetMemoryNft_1year = transactionReport(mintNftResult.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem?.address});

        resultReport.flows.MintPetMemoryNft_1year = transactionAmountFlow(mintNftResult.transactions);

        expect(mintNftResult.transactions).toHaveTransactionSeq([
            {},
            {to: petsCollection.address},
            {from: petsCollection.address, deploy: true},
        ]);

        expect(nftItem).not.toBeUndefined();
        if (nftItem) {
            const contract = await blockchain.getContract(nftItem.address);
            resultReport.flows.MintPetMemoryNft_1year.nftBalance = contract.balance;
            expect(contract.balance).toBe(toNano("0.05"));

            const nftData2 = await nftItem.getGetNftData();
            expect(nftData2.isInitialized).toBe(true);
            expect(nftData2.ownerAddress).toEqualAddress(nftUser.address);
        }
    });

    it('Donate: should not donate (Unathorized)', async () => {
        const info1 = await petsCollection.getGetInfo();
        const donateResult = await petsCollection.send(
            anyUser.getSender(),
            {
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Donate',
                index: 1n,
                feeClassA: 0n,
                feeClassB: 0x3Cn,
            }
        );
        resultReport.details.CollectionDonate_Unathorized = transactionReport(donateResult.transactions, PetsCollection.opcodes, addrNames);

        const info2 = await petsCollection.getGetInfo();
        expect(info2.balanceClassA).toBe(info1.balanceClassA);
        expect(info2.balanceClassB).toBe(info1.balanceClassB);
        expect(info2.balance).toBeGreaterThanOrEqual(info1.balance);

        expect(donateResult.transactions).toHaveTransaction({
            from: anyUser.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
            exitCode: ExitCodes.ErrorNotAuthorized,
        });
    });

});


describe('PetMemoryNft Methods', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let deployResult: SendMessageResult;
    let anyUser: SandboxContract<TreasuryContract>;
    let nftUser: SandboxContract<TreasuryContract>;
    let addrNames: {[name: string]: Address};

    beforeAll(async () => {
    });

    afterAll(async () => {
        dumpResultReport();
    });

    async function mintNft(data?: NftMutableMetaData) {
        const mintNftResult = await petsCollection.send(
            nftUser.getSender(),
            {
                value: MaxTransactionAmount
            },
            {
                $$type: 'MintPetMemoryNft',
                feeClassA: 0n,
                feeClassB: 0n,
                newOwner: null,
                content: {
                    $$type: 'PetMemoryNftContent',
                    immData: nftImmData,
                    data: data ?? nftData,
                    feeDueTime: 0n,
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
                value: MaxTransactionAmount,
            },
            {
                $$type: 'Deploy'
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: petsCollection.address,
            deploy: true,
            success: true,
        });

        nftUser = await blockchain.treasury('some NFT user 1');
        anyUser = await blockchain.treasury('Any User');

        addrNames = {
            'Deployer': deployer.address,
            'NftOwner': nftUser.address,
            'AnyUser': anyUser.address,
            'Collection': petsCollection.address,
        }
    });

    it('<Storage>: verify storage fees for 1 Year', async () => {
        const { mintNftResult: mintNftResultSmall, nftItem: nftItem1 } = await mintNft({
                $$type: 'NftMutableMetaData',
                description: null,
                image: null,
                uri: null,
                imageData: null,
            });
        resultReport.details.MintPetMemoryNft_small = transactionReport(mintNftResultSmall.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem1?.address});

        const { mintNftResult: mintNftResultMedium, nftItem: nftItem2 } = await mintNft();
        resultReport.details.MintPetMemoryNft_medium = transactionReport(mintNftResultMedium.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem2?.address});

        const { mintNftResult: mintNftResult128, nftItem: nftItem3 } = await mintNft({
                ...nftData,
                imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-128x128.jpg'))
            });
        resultReport.details.MintPetMemoryNft_Big128 = transactionReport(mintNftResult128.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem3?.address});


        resultReport.flows.MintPetMemoryNft_Big128 = transactionAmountFlow(mintNftResult128.transactions);
        const { mintNftResult: mintNftResult256, nftItem: nftItem4 } = await mintNft({
            ...nftData,
            imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-256x256.jpg'))
        });
        resultReport.details.MintPetMemoryNft_Big256 = transactionReport(mintNftResult256.transactions, PetsCollection.opcodes,
            {...addrNames, NftItem: nftItem4?.address});
        resultReport.flows.MintPetMemoryNft_Big256 = transactionAmountFlow(mintNftResult256.transactions);

        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year

        blockchain.now = time2;                                                    // set current time


        for (const x of [
            { item: nftItem1, attr: 'MintPetMemoryNft_small'},
            { item: nftItem2, attr: 'MintPetMemoryNft_medium'},
            { item: nftItem3, attr: 'MintPetMemoryNft_big128'},
            { item: nftItem4, attr: 'MintPetMemoryNft_big256'},
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
                const report = transactionReport(res.transactions, PetsCollection.opcodes, addrNames);
                resultReport.storageAnnualFees[x.attr] = report[1].storageFees ?? 0n;
            }
        }

    });

    it('Destroy: shloud destroy', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).not.toBeUndefined();
        if (nftItem) {

            const contract = await blockchain.getContract(nftItem.address);
            expect(contract.balance).toBeGreaterThanOrEqual(toNano("0.05"));
            const balaneBefore = contract.balance;

            const destroyResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount,
                },
                {
                    $$type: 'Destroy'
                }
            );

            resultReport.details.PetMemoryNftDestroy = transactionReport(destroyResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            resultReport.flows.PetMemoryNftDestroy = transactionAmountFlow(destroyResult.transactions);
            resultReport.flows.PetMemoryNftDestroy.nftBalance = balaneBefore;

            expect(destroyResult.transactions).toHaveTransactionSeq([
                {},
                {from: nftUser.address, to: nftItem.address},
                {from: nftItem.address, to: nftUser.address, valueLower: balaneBefore},
            ]);

            expect(contract.balance).toBe(0n);
            expect(contract.accountState).toBeUndefined();
        }
    });

    it('Destroy: shloud not Destroy (Unauthorized)', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const destroyResult = await nftItem.send(
                deployer.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'Destroy'
                }
            );

            resultReport.details.PetMemoryNftDestroy_Unauthorized = transactionReport(destroyResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

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
            const nftData2 = await nftItem.getGetNftData();

            const nftAddress = await petsCollection.getGetNftAddressByIndex(nftData2.index);
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
            expect(attributes.name).toBe('Marcus, Cat, RU, Krasnodar 350020 (2012-* ~ 2024-11-15)');
            expect(attributes.image_data.length).toBeGreaterThan(3000);
            expect(attributes.image_data).toStrictEqual(imageData);
        }
    });

    it('EditContent: should edit content', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const editResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'EditContent',
                    data: {
                        $$type: 'NftMutableMetaData',
                        description: 'Overriden Description',
                        image: null,
                        imageData: null,
                        uri: null,
                    }
                }
            );

            resultReport.details.PetMemoryNftEditContent = transactionReport(editResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            resultReport.flows.PetMemoryNftEditContent = transactionAmountFlow(editResult.transactions);

            expect(editResult.transactions).toHaveTransactionSeq([
                {},
                {from: nftUser.address, to: nftItem.address},
            ]);

            const nftData1 = await nftItem.getGetNftData();
            const nftContent1 =  await petsCollection.getGetNftContent(nftData1.index, nftData1.individualContent);
            const attributes1 = await decodeNftMetadata(nftContent1);
            expect(attributes1.description).toBe('Overriden Description');
            expect(attributes1.image).toBe(`https://s.petsmem.site/c/${nftItem.address}?q=image`);
            expect(attributes1.uri).toBeUndefined();


            const editResult2 = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'EditContent',
                    data: {
                        $$type: 'NftMutableMetaData',
                        description: nftData.description,
                        image: null,
                        imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-1-onchain-256x256.jpg')),
                        uri: nftData.uri,
                    }
                }
            );

            resultReport.details.PetMemoryNftEditContent_big256 = transactionReport(editResult2.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            resultReport.flows.PetMemoryNftEditContent_big256 = transactionAmountFlow(editResult.transactions);

            const nftData2 = await nftItem.getGetNftData();
            const nftContent2 =  await petsCollection.getGetNftContent(nftData2.index, nftData2.individualContent);
            const attributes2 = await decodeNftMetadata(nftContent2);
            expect(attributes2.image).toBeUndefined();
            expect(attributes2.description).toBe(nftData.description);
            expect(attributes2.uri).toBe(nftData.uri);
            expect(attributes2.image_data.length).toBeGreaterThan(3000);


            const editResult3 = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'EditContent',
                    data: {
                        $$type: 'NftMutableMetaData',
                        description: nftData.description,
                        image: "tonstorage://BA53CDEB0361AE63213FD0C3E9909EF7E8BFEAEBEBB53B90731714ABCB39FB07#wxr72yjs3lvvc5r3fjygr4rb",
                        imageData: null,
                        uri: nftData.uri,
                    }
                }
            );
            const nftData3 = await nftItem.getGetNftData();
            const nftContent3 =  await petsCollection.getGetNftContent(nftData3.index, nftData3.individualContent);
            const attributes3 = await decodeNftMetadata(nftContent3);
            expect(attributes3.image).toBe("tonstorage://BA53CDEB0361AE63213FD0C3E9909EF7E8BFEAEBEBB53B90731714ABCB39FB07#wxr72yjs3lvvc5r3fjygr4rb");
        }
    });


    it('EditContent: shloud not edit content (Unauthorized)', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const editResult = await nftItem.send(
                deployer.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'EditContent',
                    data: {
                        $$type: 'NftMutableMetaData',
                        description: 'Overriden Description',
                        image: null,
                        imageData: null,
                        uri: null,
                    }
                }
            );

            resultReport.details.PetMemoryNftEditContent_Unauthorized = transactionReport(editResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

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
        const { nftItem } = await mintNft();

        expect(nftItem).toBeDefined();
        if (nftItem) {
            const contractBefore = await blockchain.getContract(nftItem.address);
            expect(contractBefore.balance).toBe(StorageTonsReserve.PetMemoryNftMinting);

            const transferResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: new Cell().asSlice(),
                    responseDestination: nftUser.address,
                    newOwner: anyUser.address,
                }
            );

            resultReport.details.PetMemoryNftTransfer = transactionReport(transferResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            resultReport.flows.PetMemoryNftTransfer = transactionAmountFlow(transferResult.transactions);
            resultReport.flows.PetMemoryNftTransfer.excessBalance = StorageTonsReserve.PetMemoryNftMinting - StorageTonsReserve.PetMemoryNftMin;

            expect(transferResult.transactions).toHaveTransactionSeq([
                {},
                {from: nftUser.address, to: nftItem.address},
                {from: nftItem.address, to: nftUser.address, valueLower: StorageTonsReserve.PetMemoryNftMinting - StorageTonsReserve.PetMemoryNftMin},
            ]);

            const nftData = await nftItem.getGetNftData();
            expect(nftData.ownerAddress).toEqualAddress(anyUser.address);

            const contractAfter = await blockchain.getContract(nftItem.address);
            expect(contractAfter.balance).toBe(StorageTonsReserve.PetMemoryNftMin);
        }
    });


    it('Transfer: shloud not transfer (Unauthorized)', async () => {
        const { nftItem } = await mintNft();
        expect(nftItem).toBeDefined();
        if (nftItem) {
            const transferResult = await nftItem.send(
                anyUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: new Cell().asSlice(),
                    responseDestination: nftUser.address,
                    newOwner: anyUser.address,
                }
            );

            resultReport.details.PetMemoryNftTransfer_Unauthorized = transactionReport(transferResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            expect(transferResult.transactions).toHaveTransaction({
                from: anyUser.address,
                to: nftItem.address,
                success: false,
                aborted: true,
                exitCode: ExitCodes.ErrorNotAuthorized,
            });
        }
    });

    it('Transfer: shloud transfer (in 1 year)', async () => {
        const { nftItem } = await mintNft();

        expect(nftItem).toBeDefined();
        if (nftItem) {
            const contractBefore = await blockchain.getContract(nftItem.address);
            expect(contractBefore.balance).toBe(StorageTonsReserve.PetMemoryNftMinting);

            const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
            const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year
            blockchain.now = time2;                                                    // set current time

            const transferResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: new Cell().asSlice(),
                    responseDestination: nftUser.address,
                    newOwner: anyUser.address,
                }
            );

            resultReport.details.PetMemoryNftTransfer_1year = transactionReport(transferResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            resultReport.flows.PetMemoryNftTransfer_1year = transactionAmountFlow(transferResult.transactions);
            resultReport.flows.PetMemoryNftTransfer_1year.excessBalance = StorageTonsReserve.PetMemoryNftMinting - StorageTonsReserve.PetMemoryNftMin;

            expect(transferResult.transactions).toHaveTransactionSeq([
                {},
                {from: nftUser.address, to: nftItem.address},
                {from: nftItem.address, to: nftUser.address, valueLower: StorageTonsReserve.PetMemoryNftMinting - StorageTonsReserve.PetMemoryNftMin},
            ]);

            const nftData = await nftItem.getGetNftData();
            expect(nftData.ownerAddress).toEqualAddress(anyUser.address);

            const contractAfter = await blockchain.getContract(nftItem.address);
            expect(contractAfter.balance).toBe(StorageTonsReserve.PetMemoryNftMin);
        }
    });


    it('Donate: should donate to collection', async () => {
        const expectedDueTime1 = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
        const { nftItem } = await mintNft();

        expect(nftItem).toBeDefined();
        if (nftItem) {
            const info1 = await petsCollection.getGetInfo();

            const nftData1 = await nftItem.getGetNftData();
            const content1 = loadPetMemoryNftContent(nftData1.individualContent.asSlice());
            expect(content1.feeDueTime).toBeGreaterThanOrEqual(expectedDueTime1);

            const donateResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: MaxTransactionAmount
                },
                {
                    $$type: 'DonateCollection',
                    feeClassA: 0n,
                    feeClassB: 0x3Cn,
                }
            );

            resultReport.details.PetMemoryNftDonateCollection = transactionReport(donateResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});

            resultReport.flows.PetMemoryNftDonateCollection = transactionAmountFlow(donateResult.transactions);

            expect(donateResult.transactions).toHaveTransactionSeq([
                {},
                {from: nftUser.address, to: nftItem.address},
                {from: nftItem.address, to: petsCollection.address},
                {from: petsCollection.address, to: nftItem.address},
            ]);

            const nftData2 = await nftItem.getGetNftData();
            const content2 = loadPetMemoryNftContent(nftData2.individualContent.asSlice());
            expect(content2.feeDueTime).toBeGreaterThanOrEqual(expectedDueTime1 + (365n * 24n * 60n * 60n));

            const info2 = await petsCollection.getGetInfo();
            expect(info2.balanceClassA).toBeGreaterThanOrEqual(info1.balanceClassA);
            expect(info2.balanceClassA).toBeLessThanOrEqual(info1.balanceClassA + MaxClassABalanceDifference);
            expect(info2.balanceClassB).toBe(info1.balanceClassB + toNano("0.05"));
            expect(info2.balance).toBeGreaterThanOrEqual(info1.balance);
        }
    });

    it('Donate: should not donate to collection (InsufficientFunds)', async () => {
        const { nftItem } = await mintNft();

        expect(nftItem).toBeDefined();
        if (nftItem) {
            const info1 = await petsCollection.getGetInfo();
            const nftData1 = await nftItem.getGetNftData();
            const content1 = loadPetMemoryNftContent(nftData1.individualContent.asSlice());
            const donateResult = await nftItem.send(
                nftUser.getSender(),
                {
                    value: toNano("0.05")
                },
                {
                    $$type: 'DonateCollection',
                    feeClassA: 0n,
                    feeClassB: 0x3Cn,
                }
            );

            resultReport.details.PetMemoryNftDonateCollection_InsufficientFunds = transactionReport(donateResult.transactions, PetsCollection.opcodes,
                {...addrNames, NftItem: nftItem.address});


            expect(donateResult.transactions).toHaveTransaction({
                from: nftItem.address,
                to: petsCollection.address,
                success: false,
                aborted: true,
                exitCode: ExitCodes.ErrorInsufficientFunds,
            });

            const nftData2 = await nftItem.getGetNftData();
            const content2 = loadPetMemoryNftContent(nftData2.individualContent.asSlice());
            expect(content2.feeDueTime).toEqual(content1.feeDueTime);

            const info2 = await petsCollection.getGetInfo();
            expect(info2.balanceClassA).toAlmostEqualTons(info1.balanceClassA);
            expect(info2.balanceClassB).toBe(info1.balanceClassB);
            expect(info2.balance).toBeGreaterThanOrEqual(info1.balance);
        }
    });
});
