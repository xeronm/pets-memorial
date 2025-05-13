import { toNano } from '@ton/core';
import { PetsCollection, NftMutableMetaData } from '../wrappers/PetsCollection';
import { NetworkProvider } from '@ton/blueprint';

console.log(process.env.WALLET_MNEMONIC);

const FallBackUri = 'https://s.petsmem.site/c/';
const CollectionMetaData: NftMutableMetaData = {
    $$type: 'NftMutableMetaData',
    description:
            "Transform your memories into living digital artifacts — timeless, immutable and authentic, powered by blockchain technology." +
            "Share your story with those who'll truly understand, inspire others, and preserve what matters most in a world where nothing truly disappears." +
            "\nBecause some stories are too precious to remain just another photo in your smartphone gallery.",
    image: null,
    imageData: null,
    uri: null
}

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const owner = provider.sender().address;
    if (!owner) {
        ui.write(`Error: Invalid owner address.`);
        return;
    }
    const petsCollection = provider.open(await PetsCollection.fromInit(owner, FallBackUri, CollectionMetaData));

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
