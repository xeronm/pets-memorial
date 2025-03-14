import { toNano } from '@ton/core';
import { PetsCollection } from '../wrappers/PetsCollection';
import { NetworkProvider } from '@ton/blueprint';

const PrefixUri = 'https://muratov.xyz/petsmem/images/'
// const PrefixUri = 'tonstorage://F70D2F7587DBDFD0928E1967A0B2783EC3ABD63846AEC3B055B4705AEF742871/images/'

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
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(petsCollection.address);
    const info = await petsCollection.getInfo();

    console.log('Info: ', info);
}
