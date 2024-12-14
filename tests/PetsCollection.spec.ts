import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract, printTransactionFees } from '@ton/sandbox';
import { toNano, fromNano } from '@ton/core';
import { PetsCollection } from '../wrappers/PetsCollection';
import '@ton/test-utils';
import { AuthItem } from '../build/PetsCollection/tact_AuthItem';

const MaxGasConsumption = toNano('0.01');


describe('PetsCollection Deploy', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(643n, 0n));

        deployer = await blockchain.treasury('deployer');
    });

    it('should deploy', async () => {       
        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.12'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

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

        // 4. Collection Info
        const info = await petsCollection.getInfo();
        expect(info).toEqual({
            '$$type': 'Info',
            countryCode: 643n,
            partId: 0n,
            stateId: info.stateId,
            feeStorageTons: 50000000n,
            feeClassATons: 25000000n,
            feeClassBTons: 50000000n,
            balance: 50000000n,
            balanceClassA: 50000000n,
            balanceClassB: 0n,
        });        


        // 5. AuthItem Info
        const authItemInfo = await authItem.getInfo();
        expect(authItemInfo.collectionAddress).toEqualAddress(petsCollection.address);
        expect(authItemInfo.ownerAddress).toEqualAddress(deployer.address);
        expect(authItemInfo).toEqual({
            '$$type': 'AuthItemInfo',
            collectionAddress: authItemInfo.collectionAddress,
            ownerAddress: authItemInfo.ownerAddress,
            index: 1n,
            isClassB: false,
            balanceWithdrawn: 0n,
            balance: 44058000n
        });

        // 6. Overall Transaction Fees
        printTransactionFees(deployResult.transactions);
    });
    
    
    it('should not deploy', async () => {       
        const deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
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
        });
    });        
});

describe('PetsCollection', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let petsCollection: SandboxContract<PetsCollection>;
    let authItem: SandboxContract<AuthItem>;
    let deployResult: SendMessageResult;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        petsCollection = blockchain.openContract(await PetsCollection.fromInit(643n, 0n));

        deployer = await blockchain.treasury('deployer');

        deployResult = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.12'),
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


    it('verify storage fees for 1 Year', async () => {
        const time1 = Math.floor(Date.now() / 1000);                               // current local unix time
        const time2 = time1 + 365 * 24 * 60 * 60;                                  // offset for a year

        const user = await blockchain.treasury('user');
        
        blockchain.now = time2;                                                    // set current time
        const res1 = await petsCollection.send(
            user.getSender(),
            {
                value: toNano('0.01'),
            },
            null
        )

        const tx1 = res1.transactions[1];                                          // extract the transaction that executed in a year
        expect(tx1.description.type).toEqual('generic');

        // Check that the storagePhase fees are less than 0.02 TON over the course of a year
        if ('storagePhase' in tx1.description) {
            expect(tx1.description.storagePhase?.storageFeesCollected).toBeLessThanOrEqual(toNano('0.02'));
            console.log(`Collection Storage Fee: ${fromNano(tx1.description.storagePhase?.storageFeesCollected || 0)}`)
        }

        const res2 = await authItem.send(
            user.getSender(),
            {
                value: toNano('0.01'),
            },
            null
        )

        const tx2 = res2.transactions[1];                                          // extract the transaction that executed in a year
        expect(tx2.description.type).toEqual('generic');

        // Check that the storagePhase fees are less than 0.01 TON over the course of a year
        if ('storagePhase' in tx2.description) {
            expect(tx2.description.storagePhase?.storageFeesCollected).toBeLessThanOrEqual(toNano('0.01'));
            console.log(`AuthItem Storage Fee: ${fromNano(tx2.description.storagePhase?.storageFeesCollected || 0)}`)
        }
        console.log(tx2);
    });

    it('should update settings', async () => {
        const info = await petsCollection.getInfo();

        const user = await blockchain.treasury('user');
        
        const updateResult = await petsCollection.send(
            user.getSender(),
            {
                value: toNano('0.15'),
            },
            {
                $$type: 'UpdateSettings',
                stateId: info.stateId,
                queryId: 0n,
                feeStorage: 0x3An,
                feeClassA: 0n,
                feeClassB: 0n,
            }
        );

        expect(updateResult.transactions).toHaveTransaction({
            from: user.address,
            to: petsCollection.address,
            success: true,
        });

        const updatedInfo = await petsCollection.getInfo();
        expect(updatedInfo.stateId).not.toEqual(info.stateId);
        expect(updatedInfo.balance).toBeGreaterThanOrEqual(toNano('0.15')-MaxGasConsumption);

        expect(updatedInfo).toEqual({
            '$$type': 'Info',
            countryCode: 643n,
            partId: 0n,
            stateId: updatedInfo.stateId,
            feeStorageTons: 25000000n,
            feeClassATons: 0n,
            feeClassBTons: 0n,
            balance: updatedInfo.balance,
            balanceClassA: updatedInfo.balance,            
            balanceClassB: 0n,
        });
    });

});
