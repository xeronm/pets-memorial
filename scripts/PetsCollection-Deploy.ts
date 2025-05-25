import { toNano } from '@ton/core';
import { PetsCollection, NftMutableMetaData } from '../wrappers/PetsCollection';
import { NetworkProvider } from '@ton/blueprint';

console.log(process.env.WALLET_MNEMONIC);

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const owner = provider.sender().address;
    if (!owner) {
        ui.write(`Error: Invalid owner address.`);
        return;
    }
    const petsCollection = provider.open(await PetsCollection.fromInit(owner));

    if (await provider.isContractDeployed(petsCollection.address)) {
        ui.write(`Error: Contract at address ${petsCollection.address} is already deployed!`);
        return;
    }

    await petsCollection.send(
        provider.sender(),
        {
            value: toNano('0.25'),
        },
        {
            $$type: 'Deploy'
        }
    );

    await provider.waitForDeploy(petsCollection.address);
    const info = await petsCollection.getGetInfo();

    console.log('Info: ', info);
}
