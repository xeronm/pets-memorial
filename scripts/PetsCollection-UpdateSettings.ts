import { Address, toNano, Cell } from '@ton/core';
import { PetsCollection, UpdateSettings } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';

const NewSettings_MainNet: UpdateSettings = {
    $$type: 'UpdateSettings',
    feeStorage: 0x3Cn, // 0.05 TON
    feeClassA: 0x44n,  // 0.5 TON
    feeClassB: 0x42n,  // 0.25 TON
    fbMode: 5n,
    fbUri: null,
    minter: Address.parse('UQAvOkOhdbNpSdL4rzmEM8zWQZTKvyqIZmqbnh8pD7vtdkNa'),  // Mainnet
}

const NewSettings_TestNet: UpdateSettings = {
    $$type: 'UpdateSettings',
    feeStorage: 0x3Cn, // 0.05 TON
    feeClassA: 0x44n,  // 0.5 TON
    feeClassB: 0x42n,  // 0.25 TON
    fbMode: 5n,
    fbUri: 'https://s.muratovd.ru/c/',
    minter: Address.parse('0QBdDAYMeJLygjji1bFPRUY4yWP3_3JlNIllIG5SSNJEgCrH'),
}

const NewSettings = NewSettings_TestNet;


function jsonbig (obj: any) {
  return  JSON.stringify(obj, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
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
  while (jsonbig(info2) == jsonbig(info1)) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    info2 = await petsCollection.getGetInfo();
    attempt++;
  }

  ui.clearActionPrompt();
  console.log('Info after: ', info2);
}
