import { Address, toNano, Cell } from '@ton/core';
import { PetsCollection, UpdateSettings } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';

const NewSettings: UpdateSettings = {
  $$type: 'UpdateSettings',
  queryId: 0n,
  feeStorage: 0x39n,
  feeClassA: 0x39n,
  feeClassB: 0x39n,
  // prefixUri: null,
  prefixUri: 'https://muratov.xyz/petsmem/images/'
  // prefixUri: 'tonstorage://F70D2F7587DBDFD0928E1967A0B2783EC3ABD63846AEC3B055B4705AEF742871/'
}


export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetsCollection address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const petsCollection = provider.open(PetsCollection.fromAddress(address));
  const info1 = await petsCollection.getInfo();
  console.log('Info after: ', info1);

  await petsCollection.send(
    provider.sender(), 
    {
      value: toNano('0.01')
    },
    NewSettings
  );

  let info2 = await petsCollection.getInfo();
  let attempt = 1;
  while (info2 == info1) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    info2 = await petsCollection.getInfo();
    attempt++;
  }

  console.log('Info after: ', info2);
}
