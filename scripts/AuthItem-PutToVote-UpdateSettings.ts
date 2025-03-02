import { Address, toNano, beginCell } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { AuthItem } from '../wrappers/AuthItem';
import { 
  storeUpdateSettings,
  PetsCollection,
} from '../wrappers/PetsCollection';
import { toTextCellSnake } from '../utils/nftContent';

const fs = require('node:fs');


const UpdateSettings = beginCell();
storeUpdateSettings({
    $$type: 'UpdateSettings',
    feeStorage: 0x3An,
    feeClassA: 0n,
    feeClassB: 0n,
    voteDurationHours: 24n,
    data: {
        $$type: 'NftMutableMetaData',
        description: "TestNet Pets Memorial Collection",
        image: null,
        imageData: toTextCellSnake(fs.readFileSync('./assets/images/pets-onchain-128x128.jpg')),
        uri: null,
    },
    dataClassA: {
        $$type: 'NftMutableMetaData',
        description: "Governance Token",
        image: null,
        imageData: null,
        uri: null,
    },
    dataClassB: {
        $$type: 'NftMutableMetaData',
        description: "Non-Governance charity Token",
        image: null,
        imageData: null,
        uri: null,
    }})(UpdateSettings);
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
