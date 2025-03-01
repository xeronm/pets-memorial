import { Address, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { AuthItem } from '../wrappers/AuthItem';
const fs = require('node:fs');



export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('AuthItem address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const authItem = provider.open(AuthItem.fromAddress(address));

  const info = await authItem.getInfo();
  console.log('Info:', info);
}
