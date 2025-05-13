import { Address, toNano, Cell } from '@ton/core';
import { PetsCollection, UpdateSettings } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';

const NewSettings: UpdateSettings = {
    $$type: 'UpdateSettings',
    feeStorage: 0x3Cn,
    feeClassA: 0x3An,
    feeClassB: 0x3An,
    fbMode: 1n,
    fbUri: null,
    data: null
}


export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetsCollection address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const petsCollection = provider.open(PetsCollection.fromAddress(address));
  const info1 = await petsCollection.getGetInfo();
  console.log('Info before: ', info1);

  await petsCollection.send(
    provider.sender(),
    {
      value: toNano('0.01')
    },
    NewSettings
  );

  let info2 = await petsCollection.getGetInfo();
  let attempt = 1;
  while (info2 == info1) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    info2 = await petsCollection.getGetInfo();
    attempt++;
  }

  ui.clearActionPrompt();
  console.log('Info after: ', info2);
}
