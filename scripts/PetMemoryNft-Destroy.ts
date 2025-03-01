import { Address, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { PetMemoryNft } from '../wrappers/PetMemoryNft';
const fs = require('node:fs');



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
    'Destroy'  
  );
}
