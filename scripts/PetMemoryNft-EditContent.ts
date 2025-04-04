import { Address, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { NftMutableMetaData } from '../wrappers/PetsCollection';
import { PetMemoryNft } from '../wrappers/PetMemoryNft';
const fs = require('node:fs');


const nftDataImageOffChain: NftMutableMetaData = {
  $$type: 'NftMutableMetaData',
  uri: null,
  image: ':zl5frtaw6y3npei45avcjgpe',
  imageData: null,
  description: "Description was edited",
  bagId: BigInt('0xBA53CDEB0361AE63213FD0C3E9909EF7E8BFEAEBEBB53B90731714ABCB39FB07')
}

const nftData = nftDataImageOffChain;

export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetMemoryNft address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const nft = provider.open(PetMemoryNft.fromAddress(address));

  await nft.send(
    provider.sender(), 
    {
      value: toNano('0.01'),
    },
    {
      $$type: 'EditContent',
      data: nftData
    }
  );
}
