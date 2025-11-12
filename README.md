Pets Memorial NFT Collection
============================
![Pets Memorial banner](/assets/images/git-readme-banner.png "Pets Memorial")

This repository contains contract sources for Pets Memorial NFT Collection on TON blockchain.

Mainnet Website: https://petsmem.site/

Mainnet Contract: [EQBSsYn6y560LVuVf3UYOnKUfH7Fexfk4iXtkA2TPl-CUsa6](https://tonviewer.com/EQBSsYn6y560LVuVf3UYOnKUfH7Fexfk4iXtkA2TPl-CUsa6)

Collection on Getgems: [@petsmem](https://getgems.io/petsmem)

Linked repositories:
- TON NFT Torrent HTTP Gateway: https://github.com/xeronm/nft-torrent
- Pets Memroal Web/Mini-App: https://github.com/noobel/pets-memorial-miniapp

Feel free to support us with TON: `UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh`

![Wallet UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh QR code](/assets/images/UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh.PNG "UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh")

### Getting Started

#### Configure

Edit constants at `pets_collection.tact`

```ts
const PetsCollectionName: String = "<Collection Name>";
const DefaultFallback: String = "<Fallback URI>";
```

#### Build and Test

```sh
npm install
npx blueprint build
npx blueprint test
```


#### Run Script
```sh
npx blueprint run
```


