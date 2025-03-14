import { Address, toNano, Cell } from '@ton/core';
import { PetsCollection, } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetsCollection address'));
  const amount = toNano(args.length > 1 ? args[1] : await ui.input('Withdraw amount'));
  const isClassB = Boolean(args.length > 2 ? args[2] : await ui.input('Is Class B? [Y/N]'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const petsCollection = provider.open(PetsCollection.fromAddress(address));
  const info1 = await petsCollection.getInfo();
  console.log('Info before: ', info1);

  await petsCollection.send(
    provider.sender(), 
    {
      value: toNano('0.01')
    },
    {
        $$type: 'Withdraw',
        queryId: 0n,
        amount: amount,
        isClassB: isClassB,
        customPayload: null,
        forwardDestination: null,
        forwardPayload: new Cell().asSlice(),
    }
  );

  let info2 = await petsCollection.getInfo();
  let attempt = 1;
  while (info2.balanceClassA == info1.balanceClassA && info2.balanceClassB == info1.balanceClassB) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    info2 = await petsCollection.getInfo();
    attempt++;
  }

  console.log('\nInfo after: ', info2);
}
