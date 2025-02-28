import { Address, toNano } from '@ton/core';
import { 
  PetsCollection, 
  NftMutableMetaData, 
  PetMemoryNftImmutableData 
} from '../wrappers/PetsCollection';
import { PetMemoryNft } from '../wrappers/PetMemoryNft';
import { NetworkProvider, sleep } from '@ton/blueprint';
const fs = require('node:fs');


const nftDataBig: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: null,
  image: null,
  imageData: fs.readFileSync('./tests/marcus-onchain-96x96.jpg', { encoding: 'ascii' }),
  description: "He appeared in our lives on 08/19/2023. We noticed him a week earlier, " +
              "on the way to the gym. A large, gray cat, thin as a skeleton, was running" +
              " out of an abandoned private house, looked at people with piercing emerald eyes," +
              " and screamed. We tried to feed him, but that day I realized that if he did not" +
              " run out at some day, I would not be able to forgive myself. An hour later, my" +
              " wife and I caught him. It was a former domestic, neutered cat, 10-12 years old," +
              " with CKD. Then there were 15 months of struggle and joy of life, ups and downs," +
              " and dozens of visits to vets. Several times we thought that he would not get out," +
              " but he had an iron will to live. However, on 11/15/2024, he passed away."
}

const nftData: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: 'https://s.getgems.io/nft/c/6738e6330102dc6fdeba9f27/1000000/meta.json',
  image: 'https://s.getgems.io/nft/c/6738e6330102dc6fdeba9f27/1000000/image.png',
  imageData: null,
  description: "On-chain overriden description"
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

export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetsCollection address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const petsCollection = provider.open(PetsCollection.fromAddress(address));

  let collDataBefore = await petsCollection.getGetCollectionData();

  await petsCollection.send(
    provider.sender(), 
    {
      value: toNano('0.25')
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
            data: nftData
        }
    }
  );

  ui.write(`Deploying with index ${collDataBefore.nextItemIndex} ...`);

  let collData = await petsCollection.getGetCollectionData();
  let attempt = 1;
  while (collData.nextItemIndex === collDataBefore.nextItemIndex) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    collData = await petsCollection.getGetCollectionData();
    attempt++;
  }

  ui.clearActionPrompt();
  ui.write('Deployed successfully!');

  const nftAddress = await petsCollection.getGetNftAddressByIndex(collDataBefore.nextItemIndex);
  console.log('NFT Address:', nftAddress);

  const nft = provider.open(PetMemoryNft.fromAddress(nftAddress));
  console.log('NFT Info:', await nft.getGetNftData());
}
