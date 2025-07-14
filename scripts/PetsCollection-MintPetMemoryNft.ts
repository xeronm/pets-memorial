import { Address, toNano  } from '@ton/core';
import {
  PetsCollection,
  NftMutableMetaData,
  PetMemoryNftImmutableData
} from '../wrappers/PetsCollection';
import { toTextCellSnake } from '../utils/nftContent';
import { PetMemoryNft } from '../wrappers/PetMemoryNft';
import { NetworkProvider, sleep } from '@ton/blueprint';
const fs = require('node:fs');

const oldDescription =
  "He appeared in our lives on 08/19/2023. We noticed him a week earlier, " +
  "on the way to the gym. A big, gray cat, thin as a skeleton, was running" +
  " out of an abandoned private house, looked at people with piercing emerald eyes," +
  " and screamed. We tried to feed him, but that day I realized that if he did not" +
  " run out at some day, I would not be able to forgive myself. An hour later, my" +
  " wife and I caught him.\nIt was a former domestic, neutered cat, 10-12 years old," +
  " with CKD. Then there were 15 months of struggle and joy of life, ups and downs," +
  " and dozens of visits to vets. Several times we thought that he wouldn't get out," +
  " but he had an iron will to live. However, on 11/15/2024, he passed away."

const description =
  "He came into our lives on August 19, 2023. We first noticed him a week earlier on our way to the gym — a large gray cat, as thin as a skeleton, emerging from an abandoned house. He looked at people with piercing emerald eyes and cried out loudly.\n"+
  "We tried to feed him, but that day I realized: if he didn’t show up again, I wouldn’t be able to forgive myself. Just an hour later, my wife and I managed to catch him.\n"+
  "He turned out to be a former house cat, neutered, about 10–12 years old, suffering from chronic kidney disease.\n"+
  "What followed were 15 months of struggle and joy, ups and downs, and countless vet visits. Several times we thought he wouldn’t make it — but he had an iron will to live."+
  "He accepted us completely and was incredibly human-oriented — endlessly headbutting, climbing into our arms, and curling up to be petted with his head pressed gently into an elbow.\n"+
  "On November 15, 2024, he passed away."

const nftDataImageOnChain: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: null,
  image: null,
  imageData: toTextCellSnake(fs.readFileSync('./assets/images/marcus-2-onchain-256x256.jpg')),
  description: description
}

const nftDataImageOffChain: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: null,
  image: 'ipfs://bafybeib356rlhshb7uxlxgwkk4qh4kyrm2ewp4n5qm2yxu4z2yjghevism/marcus-4.webp',
  imageData: null,
  description: description
}

const nftDataImageOffChain2: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: 'https://s.getgems.io/nft/c/6738e6330102dc6fdeba9f27/1000000/meta.json',
  image: 'https://s.getgems.io/nft/c/6738e6330102dc6fdeba9f27/1000000/image.png',
  imageData: null,
  description: description
}

const nftDataImageOffChain3: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: null,
  //image: 'ipfs://bafybeidjs33bvmgjezfe6curhgymb3qipzefwy7tsaiqmfdc244qtx3hve',
  image: 'ipfs://bafkreiaas3zoxflteg62larh4liileevmn53gsfzgntoaavtuuzgi36hmy',
  imageData: null,
  description: "Forever our playful shadow and loyal friend—your wagging tail and joyful spirit live on in our hearts." +
              " Every squirrel you chased and every nap in the sun is a memory we’ll cherish with a smile."
}

// const nftData = nftDataImageOnChain;
const nftData = nftDataImageOffChain;
// const nftData = nftDataImageOffChain2;
// const nftData = nftDataImageOffChain3;

const nftImmDataMarcusCat: PetMemoryNftImmutableData = {
  $$type: 'PetMemoryNftImmutableData',
  species: 2n,
  name: 'Marcus',
  sex: 0n,
  speciesName: null,
  breed: 'Nibelung',
  lang: 0x8Dn,         // "en"
  countryCode: 0x234n, // "ru"
  location: 'Krasnodar 350020',
  geoPoint: 0x4010d91bb866n, // 45,046284 [N1=4198617], 38,981700 [N2=1816678]
  birthDate: 0n,
  deathDate: 0x20241115n,
}

const nftImmDataBoomerDog: PetMemoryNftImmutableData = {
  $$type: 'PetMemoryNftImmutableData',
  species: 1n,
  name: 'Boomer',
  sex: 0n,
  speciesName: null,
  breed: 'Sibu-inu',
  lang: 0x8Dn,         // "en"
  countryCode: 0x234n, // "ru"
  location: 'Krasnodar 350020',
  geoPoint: 0x4010d91bb866n, // 45,046284 [N1=4198617], 38,981700 [N2=1816678]
  birthDate: 0x20200000n,
  deathDate: 0x20250101n,
}

const nftImmData = nftImmDataMarcusCat;
// const nftImmData = nftImmDataBoomerDog;


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
        feeClassA: 0n,
        feeClassB: 0n,
        newOwner: null,
        content: {
            $$type: 'PetMemoryNftContent',
            immData: nftImmData,
            data: nftData,
            feeDueTime: 0n
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

  const nftAddress = await petsCollection.getGetNftAddressByIndex(collDataBefore.nextItemIndex);
  console.log('\nNFT Address:', nftAddress);

  await provider.waitForDeploy(nftAddress);
  console.log('NFT deployed:', nftAddress);

  const nft = provider.open(PetMemoryNft.fromAddress(nftAddress));
  console.log('NFT Info:', await nft.getGetNftData());

  ui.clearActionPrompt();
  ui.write('Deployed successfully!');
}
