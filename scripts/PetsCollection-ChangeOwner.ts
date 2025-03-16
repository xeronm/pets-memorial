import { Address, toNano, Cell } from '@ton/core';
import { PetsCollection } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';


export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetsCollection address'));
  const newOwner = Address.parse(args.length > 1 ? args[1] : await ui.input('New Owner address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const petsCollection = provider.open(PetsCollection.fromAddress(address));
  const data1 = await petsCollection.getGetCollectionData();
  console.log('Data before: ', data1);

  await petsCollection.send(
    provider.sender(), 
    {
      value: toNano('0.01')
    },
    {
      $$type: 'ChangeOwner',
      queryId: 0n,
      newOwner: newOwner,
    }
  );

  let data2 = await petsCollection.getGetCollectionData();
  let attempt = 1;
  while (data2.ownerAddress.equals(data1.ownerAddress)) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    data2 = await petsCollection.getGetCollectionData();
    attempt++;
  }
  ui.clearActionPrompt();
  console.log('Data after: ', data2);
}
