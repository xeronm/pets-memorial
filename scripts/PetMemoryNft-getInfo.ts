import { Address, toNano, Cell } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { PetMemoryNft } from '../wrappers/PetMemoryNft';
import { PetsCollection } from '../wrappers/PetsCollection';

const fs = require('node:fs');



export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetMemoryNft address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const nft = provider.open(PetMemoryNft.fromAddress(address));

  let nftData = await nft.getGetNftData();

  if (!(await provider.isContractDeployed(nftData.collectionAddress))) {
    ui.write(`Error: Collection at address ${nftData.collectionAddress} is not deployed!`);
    return;
  }
  console.log('NFT Data: ', nftData);  

  const petsCollection = provider.open(PetsCollection.fromAddress(nftData.collectionAddress));
  const nftContent = await petsCollection.getGetNftContent(nftData.index, nftData.individualContent);

  console.log('NFT Content: ', nftContent);
}
