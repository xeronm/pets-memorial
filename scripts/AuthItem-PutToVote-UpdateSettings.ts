import { Address, toNano, beginCell } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { AuthItem } from '../wrappers/AuthItem';
import { 
  storeUpdateSettings,
  PetsCollection,
} from '../wrappers/PetsCollection';


const fs = require('node:fs');


const UpdateSettings = beginCell();
storeUpdateSettings({
    $$type: 'UpdateSettings',
    feeStorage: 0x39n,
    feeClassA: 0n,
    feeClassB: 0n,
    voteDurationHours: 24n,
    prefixUri: null,
    // prefixUri: 'https://muratov.xyz/petsmem/images/'
    // prefixUri: 'tonstorage://F70D2F7587DBDFD0928E1967A0B2783EC3ABD63846AEC3B055B4705AEF742871/'
  })(UpdateSettings);
UpdateSettings.endCell();

        

export async function run(provider: NetworkProvider, args: string[]) {
  const ui = provider.ui();

  const address = Address.parse(args.length > 0 ? args[0] : await ui.input('AuthItem address'));

  if (!(await provider.isContractDeployed(address))) {
      ui.write(`Error: Contract at address ${address} is not deployed!`);
      return;
  }

  const authItem = provider.open(AuthItem.fromAddress(address));  

  const infoBefore = await authItem.getInfo();

  const petsCollection = provider.open(PetsCollection.fromAddress(infoBefore.collectionAddress));

  const collInfo = await petsCollection.getInfo();

  if (collInfo.voteAction != null) {
    ui.write(`Error: Vote already in progress: ${collInfo.voteAction}`);
    return;
  }

  await authItem.send(
    provider.sender(), 
    {
      value: toNano('0.2'),
    },
    {
        $$type: 'AuthItemPutToVote',
        queryId: 0n,
        message: UpdateSettings.asCell()
    }  
  );

  let infoAfter = await authItem.getInfo();
  let attempt = 1;
  while (infoAfter.voteStateId === infoBefore.voteStateId) {
    ui.setActionPrompt(`Attempt ${attempt}`);
    await sleep(3000);
    infoAfter = await authItem.getInfo();
    attempt++;
  }

  const collInfoAfter = await petsCollection.getInfo();

  ui.clearActionPrompt();
  if (collInfoAfter.voteAction != null) {
    ui.write('Settings Update Put to Vote successfully! Wainting for Vote to be complete!');
  }
  else {
    ui.write('Settings Updated successfully!');       
  }
}
