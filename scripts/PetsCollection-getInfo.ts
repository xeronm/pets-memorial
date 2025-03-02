import { Address, toNano } from '@ton/core';
import { PetsCollection } from '../wrappers/PetsCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';
const fs = require('node:fs');



export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('PetsCollection address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const petsCollection = provider.open(PetsCollection.fromAddress(address));

  console.log('Info: ', await petsCollection.getInfo());
  console.log('Collection Data: ', await petsCollection.getGetCollectionData());
}
