import { Address, toNano, Cell } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { PetMemoryNft } from '../wrappers/PetMemoryNft';
const fs = require('node:fs');



export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetMemoryNft address'));
  const newOwner = Address.parse(args.length > 1 ? args[1] : await ui.input('New Owner address'));
  const isWithdraw = Boolean(args.length > 2 ? args[2] : await ui.input('Withdraw excess balance? [Y/N]'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  if (!(await provider.isContractDeployed(newOwner))) {
    ui.write(`Error: Contract at address ${newOwner} is not deployed!`);
    return;
  }

  const nft = provider.open(PetMemoryNft.fromAddress(address));

  await nft.send(
    provider.sender(), 
    {
      value: toNano('0.013'),
    },
    {
      $$type: 'Transfer',
      queryId: 0n,
      customPayload: null,
      forwardAmount: 0n,
      forwardPayload: new Cell().asSlice(),
      responseDestination: (isWithdraw && provider.sender().address) || null,
      newOwner: newOwner,      
    }
  );

  let nftData = await nft.getGetNftData();
  let attempt = 1;
  while (!nftData.ownerAddress.equals(newOwner)) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    nftData = await nft.getGetNftData();
    attempt++;
  }

  ui.clearActionPrompt();
  ui.write('Transfered successfully!');    
}
