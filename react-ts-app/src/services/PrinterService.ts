// src/services/PrinterService.ts
const EPSON_VENDOR_ID = 0x04b8; // Epson's Vendor ID

class PrinterService {
  private device: USBDevice | null = null;
  private interfaceNumber: number | null = null;
  private endpointOut: USBEndpoint | null = null;

  async connect(): Promise<boolean> {
    try {
      this.device = await navigator.usb.requestDevice({
        filters: [{ vendorId: EPSON_VENDOR_ID }],
      });
      if (!this.device) {
        console.error("No device selected.");
        return false;
      }

      await this.device.open();
      if (this.device.configuration === null) {
        // Try to select the first configuration if not already selected
        await this.device.selectConfiguration(1);
      }

      const interfaces = this.device.configuration?.interfaces;
      if (!interfaces || interfaces.length === 0) {
        console.error("No interfaces found on the device.");
        await this.device.close();
        this.device = null;
        return false;
      }

      let foundInterface: USBInterface | undefined;
      // Try to find a printer-specific interface (Class 7)
      foundInterface = interfaces.find(iface => iface.alternates.some(alt => alt.interfaceClass === 7));

      if (!foundInterface) {
        // If not found, try to use the first interface that has an OUT endpoint
        // This is a common fallback for many USB printers
        console.warn("Printer class interface (Class 7) not found. Looking for any interface with an OUT endpoint.");
        for (const iface of interfaces) {
            const alternateWithOutEndpoint = iface.alternates.find(alt => alt.endpoints.some(ep => ep.direction === "out"));
            if (alternateWithOutEndpoint) {
                foundInterface = iface;
                break;
            }
        }
      }

      if (!foundInterface) {
        console.error("No suitable interface with an OUT endpoint found.");
        await this.device.close();
        this.device = null;
        return false;
      }

      this.interfaceNumber = foundInterface.interfaceNumber;
      await this.device.claimInterface(this.interfaceNumber);

      // Find an alternate interface that has an OUT endpoint
      const alternate = foundInterface.alternates.find(alt => alt.endpoints.some(ep => ep.direction === "out"));
      if (!alternate) {
          console.error("No alternate interface with an OUT endpoint found for the claimed interface.");
          await this.device.releaseInterface(this.interfaceNumber);
          await this.device.close();
          this.device = null;
          this.interfaceNumber = null;
          return false;
      }

      this.endpointOut = alternate.endpoints.find(ep => ep.direction === "out");
      if (!this.endpointOut) {
        console.error("No OUT endpoint found on the selected alternate interface.");
        await this.device.releaseInterface(this.interfaceNumber);
        await this.device.close();
        this.device = null;
        this.interfaceNumber = null;
        return false;
      }

      console.log("Printer connected:", this.device.productName, "Endpoint:", this.endpointOut.endpointNumber);
      return true;
    } catch (error) {
      console.error("Failed to connect to printer:", error);
      if (this.device) {
        if (this.interfaceNumber !== null && this.device.opened) {
          try {
            await this.device.releaseInterface(this.interfaceNumber);
          } catch (e) { console.error("Error releasing interface:", e); }
        }
        if (this.device.opened) {
          try {
            await this.device.close();
          } catch (e) { console.error("Error closing device:", e); }
        }
      }
      this.device = null;
      this.interfaceNumber = null;
      this.endpointOut = null;
      return false;
    }
  }

  async printRaw(data: Uint8Array): Promise<boolean> {
    if (!this.device || !this.endpointOut || !this.device.opened) {
      console.error("Printer not connected, not open, or no endpoint configured.");
      return false;
    }
    try {
      await this.device.transferOut(this.endpointOut.endpointNumber, data);
      return true;
    } catch (error) {
      console.error("Failed to print data:", error);
      // Handle specific USB error codes if necessary e.g. STALL
      if (error instanceof DOMException && error.name === 'NetworkError') {
         //This can happen if the device is disconnected or endpoint pipe is halted
         console.error("NetworkError during transferOut. Device might be disconnected or endpoint stalled.");
         // Attempt to clear halt/stall on the endpoint
         if(this.endpointOut?.endpointNumber){
            try {
                await this.device.clearHalt("out", this.endpointOut.endpointNumber);
                console.log("Cleared HALT on OUT endpoint. Please try printing again.");
            } catch (clearError) {
                console.error("Failed to clear HALT on endpoint:", clearError);
            }
         }
      }
      return false;
    }
  }

  async printText(text: string): Promise<boolean> {
    const encoder = new TextEncoder(); // UTF-8 encoder by default
    const data = encoder.encode(text);
    return this.printRaw(data);
  }

  async disconnect(): Promise<void> {
    if (!this.device) {
      console.log("No device to disconnect.");
      return;
    }
    try {
      if (this.interfaceNumber !== null && this.device.opened) {
        await this.device.releaseInterface(this.interfaceNumber);
        this.interfaceNumber = null;
        console.log("Interface released.");
      }
      if (this.device.opened) {
        await this.device.close();
        console.log("Printer device closed.");
      }
    } catch (error) {
      console.error("Failed to disconnect printer:", error);
    } finally {
      this.device = null;
      this.endpointOut = null;
      console.log("Printer disconnected.");
    }
  }

  isConnected(): boolean {
    return this.device !== null && this.device.opened && this.endpointOut !== null;
  }
}

export const printerService = new PrinterService();
