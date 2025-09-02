import { Address, toNano, Cell } from '@ton/core';
import { PetsCollection, UpdateSettings } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';

const NewSettings: UpdateSettings = {
    $$type: 'UpdateSettings',
    feeStorage: 0x3Cn, // 0.05 TON
    feeClassA: 0x48n,  // 1 TON
    feeClassB: 0x44n,  // 0.5 TON
    fbMode: 5n,
    fbUri: null,
    minter: Address.parse('0QBdDAYMeJLygjji1bFPRUY4yWP3_3JlNIllIG5SSNJEgCrH'),
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
  while (JSON.stringify(info2) == JSON.stringify(info1)) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    info2 = await petsCollection.getGetInfo();
    attempt++;
  }

  ui.clearActionPrompt();
  console.log('Info after: ', info2);
}
