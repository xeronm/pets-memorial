Pets Memorial NFT Collection on TON
============================
![Pets Memorial banner](/assets/images/git-readme-banner.png "Pets Memorial")

This repository contains the smart contract sources for the **Pets Memorial NFT Collection** on the **TON blockchain**.

The project is built on the [TEP-62 NFT standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md) and introduces several domain-specific extensions:

- A dedicated on-chain metadata schema
- Donation mechanism through NFT to the collection contract
- Calculation of a `fee_due_date` field based on donation volume within each NFT contract
- Authorized address to mint without fees
- etc.

---

**Mainnet Website:** [https://petsmem.site](https://petsmem.site)

**Mainnet Contract:** [EQBSsYn6y560LVuVf3UYOnKUfH7Fexfk4iXtkA2TPl-CUsa6](https://tonviewer.com/EQBSsYn6y560LVuVf3UYOnKUfH7Fexfk4iXtkA2TPl-CUsa6)

**Collection on Getgems:** [@petsmem](https://getgems.io/petsmem)

---

**Linked repositories:**
- [TON NFT Torrent HTTP Gateway](https://github.com/xeronm/nft-torrent)
- [Pets Memorial Web/Mini-App](https://github.com/noobel/pets-memorial-miniapp)

---

If you'd like to support the project, you can send TON to:
`UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh`

![Wallet QR code](/assets/images/UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh.PNG "UQDJJHWJKrt7ZKiRzXz2TpzJMxJ5RrWffTqXL8769EXa_2bh")

## 1. Getting Started

### Configure

Edit constants at `pets_collection.tact`

```ts
const PetsCollectionName: String = "<Collection Name>";
const DefaultFallback: String = "<Fallback URI>";
```

### Build and Test

```sh
npm install
npx blueprint build
npx blueprint test
```


### Run Script
```sh
npx blueprint run
```


## 2. Data Structures

### `PetMemoryNftImmutableData`

```tlb
_ species:uint4 name:^string sex:uint1 speciesName:Maybe ^string breed:Maybe ^string
  lang:Maybe uint10 countryCode:uint10 geoPoint:Maybe uint48 location:Maybe ^string
  birthDate:uint32 deathDate:uint32 = PetMemoryNftImmutableData;
```

| Field         | Type            | Description                                                                                                                                                                                          |
| ------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `species`     | `uint4`         | Species ID. 0 = other (see `speciesName`), 1 = dog, 2 = cat, etc.                                                                                                                                      |
| `name`        | `^string`       | Pet's name                                                                                                                                                                                           |
| `sex`         | `uint1`         | 0 = Male, 1 = Female                                                                                                                                                                                 |
| `speciesName` | `Maybe ^string` | Optional species name                                                                                                                                                                                |
| `breed`       | `Maybe ^string` | Optional breed                                                                                                                                                                                       |
| `lang`        | `Maybe uint10`  | ISO 639-1 language code encoded with 5 bits per letter (e.g. "en" → `0x08D`)                                                                                                                         |
| `countryCode` | `uint10`        | ISO 3166-1 alpha-2 country code encoded with 5 bits per letter (e.g. "RU" → `0x234`)                                                                                                                 |
| `geoPoint`    | `Maybe uint48`  | Encoded geo-coordinates:<br>• First 24 bits — latitude: 1 bit for hemisphere, 23 bits for value, where `N < (2^23 * X / 90) < N+1`<br>• Last 24 bits — longitude, where `N < (2^24 * X / 360) < N+1` |
| `location`    | `Maybe ^string` | Optional textual location (e.g., postal code)                                                                                                                                                        |
| `birthDate`   | `uint32`        | Birth date.<br> BCD-encoded fuzzy date: 4 digits year, 2 digits month, 2 digits day (`0x00` = means unspecified or not known)                                                                        |
| `deathDate`   | `uint32`        | Death date.<br>Same format as `birthDate`                                                                                                                                                            |

---

### `NftMutableMetaData`

```tlb
_ uri:Maybe ^string description:Maybe ^string image:Maybe ^string imageData:Maybe ^cell = NftMutableMetaData;
```

| Field         | Type            | Description                          |
| ------------- | --------------- | ------------------------------------ |
| `uri`         | `Maybe ^string` | Optional metadata URI                |
| `description` | `Maybe ^string` | Optional textual description         |
| `image`       | `Maybe ^string` | Optional image URL                   |
| `imageData`   | `Maybe ^cell`   | Optional On-Chain image bytes (cell) |

---

### `PetMemoryNftContent`

```tlb
_ immData:PetMemoryNftImmutableData
  data:NftMutableMetaData
  feeDueTime:uint32 = PetMemoryNftContent;
```

Serialized NFT content returned on `get_nft_data` query.

---

### `PetMemoryNftInit`

```tlb
_ immData:PetMemoryNftImmutableData
  data:NftMutableMetaData
  storageReserve:uint8
  feeDueTime:uint32 = PetMemoryNftInit;
```

Structure used at NFT contract deployment.

---

## 3. Pets Collection Contract

Implements standard messages and get-methods for NFT Collection smart contract from [TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md)

### Messages

#### `MintPetMemoryNft`

Op Code: `0x399987e2`

```tlb
mint_pet_memory_nft#399987e2
  feeClassA:uint8
  feeClassB:uint8
  newOwner:address
  content:PetMemoryNftContent = MintPetMemoryNft;
```

| Field       | Type                  | Description                                                                 |
| ----------- | --------------------- | --------------------------------------------------------------------------- |
| `feeClassA` | `uint8`               | Blockchain fee.<br>3 bits — base factor (base = 10/8), 4 bits — power of 10 |
| `feeClassB` | `uint8`               | Project support fee<br>Same encoding as `feeClassA`                         |
| `newOwner`  | `address`             | New owner of the NFT                                                        |
| `content`   | `PetMemoryNftContent` | Full content of the NFT                                                     |

---

### Get-methods

#### `get_info`

Returns internal parameters of the collection.

```tlb
_ minter:address
  feeStorageTons:coins
  feeClassATons:coins
  feeClassBTons:coins
  balance:coins
  balanceClassA:coins
  balanceClassB:coins
  fbMode:uint3
  fbUri:^string = Info;
```

| Field            | Type      | Description                                                                                                                                                                                                                                                               |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minter`         | `address` | Address authorized to mint NFTs without fees                                                                                                                                                                                                                              |
| `feeStorageTons` | `coins`   | Fee reserved for NFT storage                                                                                                                                                                                                                                              |
| `feeClassATons`  | `coins`   | Fee in TON for Class A                                                                                                                                                                                                                                                    |
| `feeClassBTons`  | `coins`   | Fee in TON for Class B                                                                                                                                                                                                                                                    |
| `balance`        | `coins`   | Total contract balance                                                                                                                                                                                                                                                    |
| `balanceClassA`  | `coins`   | Collected Class A balance                                                                                                                                                                                                                                                 |
| `balanceClassB`  | `coins`   | Collected Class B balance                                                                                                                                                                                                                                                 |
| `fbMode`         | `uint3`   | fbMode: Fallback mode bitmask (used when NFT metadata URI is not a standard HTTP URL):<br>• 0x1 — Enable fallback URI for non-HTTP protocols<br>• 0x2 — Pass original URI as q query parameter<br>• 0x4 — Always return fallback URI in the uri field, even if it’s empty |
| `fbUri`          | `^string` | Fallback base URI used in non-standard URI handling                                                                                                                                                                                                                       |

## 4. Pet Memory NFT Contract

Implements standard messages and get-methods for NFT item smart contract from [TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md)

### `EditContent`

Op Code: `0x1a0b9d51`

```tlb
edit_content#1a0b9d51
  data:NftMutableMetaData = EditContent;
```

Allows the NFT owner to update mutable metadata (e.g., description or image).

---

### `DonateCollection`

Op Code: `0x7a737f3f`

```tlb
donate_collection#7a737f3f
  feeClassA:uint8
  feeClassB:uint8 = DonateCollection;
```

Sends a donation to the parent collection contract. Fees are encoded using the same fee class format.

---
