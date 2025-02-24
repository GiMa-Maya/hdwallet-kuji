import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface KujiraGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Kujira {
  export interface Msg {
    type: string;
    value: any;
  }

  export type Coins = Coin[];

  export interface Coin {
    denom: string;
    amount: string;
  }

  export interface StdFee {
    amount: Coins;
    gas: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace crypto {
    export interface PubKey {
      type: string;
      value: string;
    }
  }

  export interface StdSignature {
    pub_key?: crypto.PubKey;
    signature: string;
  }

  export interface StdTx {
    msg: Msg[];
    fee: StdFee;
    signatures: StdSignature[];
    memo?: string;
  }
}

export interface KujiraTx {
  msg: Kujira.Msg[];
  fee: Kujira.StdFee;
  signatures: Kujira.StdSignature[];
  memo?: string;
}

export interface KujiraSignTx {
  addressNList: BIP32Path;
  tx: Kujira.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
}

export interface KujiraSignedTx {
  serialized: string;
  body: string;
  authInfoBytes: string;
  signatures: string[];
}

export interface KujiraGetAccountPaths {
  accountIdx: number;
}

export interface KujiraAccountPath {
  addressNList: BIP32Path;
}

export interface KujiraWalletInfo extends HDWalletInfo {
  readonly _supportsKujiraInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  KujiraGetAccountPaths(msg: KujiraGetAccountPaths): Array<KujiraAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  kujiraNextAccountPath(msg: KujiraAccountPath): KujiraAccountPath | undefined;
}

export interface KujiraWallet extends KujiraWalletInfo, HDWallet {
  readonly _supportsKujira: boolean;

  kujiraGetAddress(msg: KujiraGetAddress): Promise<string | null>;
  kujiraSignTx(msg: KujiraSignTx): Promise<KujiraSignedTx | null>;
}

export function kujiraDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Kuji",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Kuji")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Kujira Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Kuji",
    isKnown: true,
    isPrefork: false,
  };
}
