import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract, printTransactionFees } from '@ton/sandbox';
import { toNano, fromNano } from '@ton/core';
import { PetsCollection, loadWithdrawResult } from '../wrappers/PetsCollection';
import '@ton/test-utils';
import { AuthItem } from '../build/PetsCollection/tact_AuthItem';

const CollectionDeployAmount = toNano('0.15');
const MinTransactionAmount = toNano('0.1');


const MaxFeeStoragePerYear = {
    PetsCollection: toNano('0.025'),
    AuthItem: toNano('0.012'),
}

const MaxGasConsumption = {
    Deposit: toNano('0.0015'),
    Deploy: toNano('0.013'),
    UpdateSettings: toNano('0.003'),
    //
    ExtWithdraw: toNano('0.0016'),
    Withdraw: toNano('0.00425'),
    _Withdraw: toNano('0.0076'),
    _WithdrawReplay: toNano('0.004'),    
    WithdrawResult: toNano('0.0002'),
}


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
                value: CollectionDeployAmount,
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
            state_id: info.state_id,
            feeStorageTons: 50000000n,
            feeClassATons: 25000000n,
            feeClassBTons: 50000000n,
            balance: 50000000n,
            balanceClassA: 50000000n,
            balanceClassB: 0n,
        });        


        // 5. AuthItem Info
        const authItemInfo = await authItem.getInfo();
        expect(authItemInfo.collection_address).toEqualAddress(petsCollection.address);
        expect(authItemInfo.owner_address).toEqualAddress(deployer.address);
        expect(authItemInfo.balance).toBeGreaterThanOrEqual(info.feeStorageTons - MaxGasConsumption.Deploy);
        expect(authItemInfo).toEqual({
            '$$type': 'AuthItemInfo',
            collection_address: authItemInfo.collection_address,
            owner_address: authItemInfo.owner_address,
            index: 1n,
            isClassB: false,
            balanceWithdrawn: 0n,
            balance: authItemInfo.balance
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
                value: CollectionDeployAmount,
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

    it('verify available withdraw balance', async () => {
        // 1. Initial balance = 0.05 TON
        const availableForWithdraw1 = await petsCollection.getAvailableForWithdraw(false, 0n);
        expect(availableForWithdraw1).toBe(0n);

        // 2. Deposit 0.02 TON, less than feeClassATons
        const deposit1 = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano("0.02"),
            },
            null
        )
        const availableForWithdraw2 = await petsCollection.getAvailableForWithdraw(false, 0n);        
        expect(availableForWithdraw2).toBe(0n);

        // 3. Deposit 0.02 TON, less than feeClassATons
        const deposit2 = await petsCollection.send(
            deployer.getSender(),
            {
                value: toNano("0.02"),
            },
            null
        )
        const availableForWithdraw3 = await petsCollection.getAvailableForWithdraw(false, 0n);
        expect(availableForWithdraw3).toBeGreaterThan(toNano("0.04") - 2n*MaxGasConsumption.Deposit);

        const availableForWithdraw4 = await petsCollection.getAvailableForWithdraw(false, toNano("0.01"));
        expect(availableForWithdraw4).toBeGreaterThan(toNano("0.04") - 2n*MaxGasConsumption.Deposit - toNano("0.01"));

        const availableForWithdraw5 = await petsCollection.getAvailableForWithdraw(false, toNano("0.02"));
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

        const tx1 = res1.transactions[1];                                          // extract the transaction that executed in a year
        expect(tx1.description.type).toEqual('generic');

        // Check that the storagePhase fees are less than 0.02 TON over the course of a year
        if ('storagePhase' in tx1.description) {
            expect(tx1.description.storagePhase?.storageFeesCollected).toBeLessThanOrEqual(MaxFeeStoragePerYear.PetsCollection);
            console.log(`Collection Storage Fee: ${fromNano(tx1.description.storagePhase?.storageFeesCollected || 0)}`)
        }

        const res2 = await authItem.send(
            user.getSender(),
            {
                value: MinTransactionAmount,
            },
            null
        )

        const tx2 = res2.transactions[1];                                          // extract the transaction that executed in a year
        expect(tx2.description.type).toEqual('generic');

        // Check that the storagePhase fees are less than 0.01 TON over the course of a year
        if ('storagePhase' in tx2.description) {
            expect(tx2.description.storagePhase?.storageFeesCollected).toBeLessThanOrEqual(MaxFeeStoragePerYear.AuthItem);
            console.log(`AuthItem Storage Fee: ${fromNano(tx2.description.storagePhase?.storageFeesCollected || 0)}`)
        }
    });    

    it('should update settings', async () => {
        const info = await petsCollection.getInfo();

        const user = await blockchain.treasury('user');

        const initInfo = await petsCollection.getInfo();
        
        const updateResult = await petsCollection.send(
            user.getSender(),
            {
                value: MinTransactionAmount,
            },
            {
                $$type: 'UpdateSettings',
                state_id: info.state_id,
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
        expect(updatedInfo.state_id).not.toEqual(info.state_id);
        expect(updatedInfo.balance).toBeGreaterThanOrEqual(initInfo.balance + MinTransactionAmount - MaxGasConsumption.UpdateSettings);

        expect(updatedInfo).toEqual({
            '$$type': 'Info',
            countryCode: 643n,
            partId: 0n,
            state_id: updatedInfo.state_id,
            feeStorageTons: 25000000n,
            feeClassATons: 0n,
            feeClassBTons: 0n,
            balance: updatedInfo.balance,
            balanceClassA: updatedInfo.balance,            
            balanceClassB: 0n,
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
                value: MaxGasConsumption.ExtWithdraw,
            },
            "withdraw"
        );
        expect(withdrawResult1.transactions.length).toBe(2);
        expect(withdrawResult1.transactions).toHaveTransaction({
            from: deployer.address,
            to: authItem.address,
            success: false,
            aborted: true,
        });

        const info2 = await petsCollection.getInfo();
        expect(info2).toEqual(info1);

        // 2. Failing 2-nd message in chain
        const withdrawResult2 = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.ExtWithdraw + MaxGasConsumption.Withdraw,
            },
            "withdraw"
        );
        expect(withdrawResult2.transactions.length).toBe(3);
        expect(withdrawResult2.transactions).toHaveTransaction({
            from: deployer.address,
            to: authItem.address,
            success: true,
        });        
        expect(withdrawResult2.transactions).toHaveTransaction({
            from: authItem.address,
            to: petsCollection.address,
            success: false,
            aborted: true,
        });        

        const info3 = await petsCollection.getInfo();
        expect(info3).toEqual(info1);

        // 3. Failing 3-rd message in chain
        const withdrawResult3 = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.ExtWithdraw + MaxGasConsumption.Withdraw + MaxGasConsumption._Withdraw,
            },
            "withdraw"
        );
        expect(withdrawResult3.transactions.length).toBe(4);
        expect(withdrawResult3.transactions).toHaveTransaction({
            from: deployer.address,
            to: authItem.address,
            success: true,
        });        
        expect(withdrawResult3.transactions).toHaveTransaction({
            from: authItem.address,
            to: petsCollection.address,
            success: true,
        });   
        expect(withdrawResult3.transactions).toHaveTransaction({
            from: petsCollection.address,
            to: authItem.address,
            success: false,
            aborted: true,
        });   

        const info4 = await petsCollection.getInfo();
        expect(info4).toEqual(info1);
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

        // 2. Gas enought for 2-nd message in chain
        const withdrawResult = await authItem.send(
            deployer.getSender(),
            {
                value: MaxGasConsumption.ExtWithdraw + MaxGasConsumption.Withdraw + MaxGasConsumption._Withdraw,
            },
            "withdraw"
        );
        console.log(withdrawResult.events)
        expect(withdrawResult.transactions.length).toBe(5);

        let result1: any = {value: null};
        if ('body' in withdrawResult.events[3]) {
            result1 = loadWithdrawResult(withdrawResult.events[3].body.asSlice());
        }
        expect(result1.value).toBeGreaterThanOrEqual(toNano("0.1") - MaxGasConsumption.Deposit);        

        const info2 = await petsCollection.getInfo();
        expect(info2).toEqual({...info1, balanceClassA: info1.balanceClassA + result1.value});
    });

    it('AuthItem: should withdraw (itemCount=1)', async () => {
        const availableForWithdraw1 = await petsCollection.getAvailableForWithdraw(false, 0n);
        expect(availableForWithdraw1).toBe(0n);

        const balance1 = await deployer.getBalance();

        const withdrawResult1 = await authItem.send(
            deployer.getSender(),
            {
                value: MinTransactionAmount,
            },
            "withdraw"
        );
        expect(withdrawResult1.transactions).toHaveTransaction({
            from: deployer.address,
            to: authItem.address,
            success: true,
        });
        expect(withdrawResult1.transactions).toHaveTransaction({
            from: authItem.address,
            to: petsCollection.address,
            success: true,
        });           
        expect(withdrawResult1.transactions).toHaveTransaction({
            from: petsCollection.address,
            to: authItem.address,
            success: true,
        });           
        expect(withdrawResult1.transactions).toHaveTransaction({
            from: authItem.address,
            to: deployer.address,
            success: true,
        });         

        const balance2 = await deployer.getBalance();
        expect(balance2).toBeGreaterThanOrEqual(balance1 - (
            MaxGasConsumption.ExtWithdraw + 
            MaxGasConsumption.Withdraw + 
            MaxGasConsumption._Withdraw + 
            MaxGasConsumption._WithdrawReplay + 
            MaxGasConsumption.WithdrawResult) 
        );

        let result1: any = {value: null};
        if ('body' in withdrawResult1.events[3]) {
            result1 = loadWithdrawResult(withdrawResult1.events[3].body.asSlice());
        }
        expect(result1.value).toBe(0n);
        printTransactionFees(withdrawResult1.transactions);

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
            "withdraw"
        );        
        expect(withdrawResult2.transactions).toHaveTransaction({
            from: authItem.address,
            to: deployer.address,
            success: true,
        });
        const balance4 = await deployer.getBalance();

        let result2: any = {value: null};
        if ('body' in withdrawResult2.events[3]) {
            result2 = loadWithdrawResult(withdrawResult2.events[3].body.asSlice());
        }
        expect(result2.value).toBeGreaterThanOrEqual(toNano("0.1") - MaxGasConsumption.Deposit);

        console.log(balance3, balance4, result2);
    });

});
