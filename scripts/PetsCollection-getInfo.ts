import { Address } from '@ton/core';
import { PetsCollection } from '../wrappers/PetsCollection';
import { NetworkProvider } from '@ton/blueprint';
// import axios from 'axios';

// axios.interceptors.request.use(request => {
//   console.log('Starting Request', request.url, JSON.stringify(request.data, null, 2))
//   return request
// })
    
// axios.interceptors.response.use(response => {
//   console.log('Response:', response.config.url, JSON.stringify(response.data, null, 2))
//   return response
// })

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
