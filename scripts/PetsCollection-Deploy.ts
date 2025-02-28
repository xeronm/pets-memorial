import { toNano } from '@ton/core';
import { PetsCollection } from '../wrappers/PetsCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const petsCollection = provider.open(await PetsCollection.fromInit());

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

    console.log('Info:', await petsCollection.getInfo());
}
