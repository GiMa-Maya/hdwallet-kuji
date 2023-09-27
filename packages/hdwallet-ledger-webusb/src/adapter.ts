import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import { listen } from "@ledgerhq/logs";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import { getFirstLedgerDevice, getLedgerTransport, LedgerWebUsbTransport, openTransport } from "./transport";

export const VENDOR_ID = 11415;
// const APP_NAVIGATION_DELAY = 3000;

export class WebUSBLedgerAdapter {
  keyring: core.Keyring;
  currentEventTimestamp = 0;

  constructor(keyring: core.Keyring) {
    this.keyring = keyring;

    if (window && window.navigator.usb) {
      window.navigator.usb.addEventListener("connect", this.handleConnectWebUSBLedger.bind(this));
      window.navigator.usb.addEventListener("disconnect", this.handleDisconnectWebUSBLedger.bind(this));
    }

    // eslint-disable-next-line no-console
    listen((log) => console.log(log));
  }

  public static useKeyring(keyring: core.Keyring) {
    return new WebUSBLedgerAdapter(keyring);
  }

  private async handleConnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    // eslint-disable-next-line no-console
    console.log({ e });
    if (e.device.vendorId !== VENDOR_ID) return;

    this.currentEventTimestamp = Date.now();

    try {
      this.keyring.emit(
        [e.device.manufacturerName ?? "", e.device.productName ?? "", core.Events.CONNECT],
        e.device.serialNumber
      );
    } catch (error: any) {
      this.keyring.emit(
        [e.device.manufacturerName ?? "", e.device.productName ?? "", core.Events.FAILURE],
        [e.device.serialNumber, { message: { code: error.type, ...error } }]
      );
    }
  }

  private async handleDisconnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return;

    this.keyring.emit(
      [e.device.manufacturerName ?? "", e.device.productName ?? "", core.Events.DISCONNECT],
      e.device.serialNumber
    );

    const ts = Date.now();
    this.currentEventTimestamp = ts;

    // timeout gives time to detect if it is an app navigation based disconnect/connect event
    // discard disconnect event if it is not the most recent event received
    // TODO(gomes): maybe uncomment me maybe not
    // setTimeout(async () => {
    // if (ts !== this.currentEventTimestamp) return;
    //
    // try {
    // if (e.device.serialNumber) await this.keyring.remove(e.device.serialNumber);
    // } catch (error) {
    // console.error(error);
    // }
    // }, APP_NAVIGATION_DELAY);
  }

  public get(device: USBDevice): ledger.LedgerHDWallet {
    return core.mustBeDefined(this.keyring.get<ledger.LedgerHDWallet>(device.serialNumber));
  }

  // without unique device identifiers, we should only ever have one ledger device on the keyring at a time
  public async initialize(ledgerTransport?: TransportWebUSB): Promise<number> {
    const transport =
      ledgerTransport ??
      (await (async () => {
        const device = await getFirstLedgerDevice();
        if (!device) return;
        await this.keyring.remove(core.mustBeDefined(device.serialNumber));
        return openTransport(device);
      })());

    if (!transport) throw new Error("Cannot get transport");

    const wallet = ledger.create(
      new LedgerWebUsbTransport(transport.device, transport, this.keyring) as ledger.LedgerTransport
    );

    this.keyring.add(wallet, transport.device.serialNumber);

    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<ledger.LedgerHDWallet> {
    const ledgerTransport = await getLedgerTransport();

    const device = ledgerTransport.device;

    await this.initialize(ledgerTransport);

    return core.mustBeDefined(this.keyring.get<ledger.LedgerHDWallet>(device.serialNumber));
  }
}
