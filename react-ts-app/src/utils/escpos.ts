// src/utils/escpos.ts
export const ESC = 0x1B;
export const GS = 0x1D;
export const LF = 0x0A;

export const INIT_PRINTER = new Uint8Array([ESC, 0x40]); // ESC @
export const CUT_PAPER_FULL = new Uint8Array([GS, 0x56, 0x00]); // GS V 0 (Full cut)
// export const CUT_PAPER_PARTIAL = new Uint8Array([GS, 0x56, 0x01]); // GS V 1 (Partial cut)

export const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]); // ESC a 0
export const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]); // ESC a 1
export const ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 0x02]); // ESC a 2

// Text formatting
export const TXT_NORMAL = new Uint8Array([ESC, 0x21, 0x00]); // Normal text
export const TXT_BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]); // ESC E n (n=1: on)
export const TXT_BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]); // ESC E n (n=0: off)
export const TXT_UNDERLINE_ON = new Uint8Array([ESC, 0x2D, 0x01]); // ESC - n (n=1: on)
export const TXT_UNDERLINE_OFF = new Uint8Array([ESC, 0x2D, 0x00]); // ESC - n (n=0: off)


// Character Code Table (Example: PC437 - USA, Standard Europe)
// export const SELECT_CHAR_CODE_TABLE_PC437 = new Uint8Array([ESC, 0x74, 0x00]);
// For Japanese, you might need to select a specific code page like Shift_JIS (e.g., ESC t n where n is the page number)
// or use commands for Kanji mode (e.g., FS C, FS &, etc.)
// Modern printers might support UTF-8 directly or via a command.

export function encodeText(text: string, encoding: 'utf-8' | 'shift_jis' = 'utf-8'): Uint8Array {
  if (encoding === 'shift_jis') {
    // Shift_JIS encoding requires a library like encoding-japanese.
    // For this example, we'll stick to UTF-8 or simple ASCII.
    console.warn("Shift_JIS encoding requested but not implemented in this basic helper. Using UTF-8.");
    // Fallback to TextEncoder for UTF-8 for now.
    // In a real app: import {年至s byteArray } from 'encoding-japanese';
    // return Uint8Array.from(convert(text, { to: 'SJIS', from: 'UNICODE', type: 'arraybuffer' }));
    return new TextEncoder().encode(text);
  }
  return new TextEncoder().encode(text);
}

export function createTextBlock(
    text: string,
    align: Uint8Array = ALIGN_LEFT,
    bold: boolean = false,
    underline: boolean = false
): Uint8Array {
    const textBytes = encodeText(text);
    const lfBytes = new Uint8Array([LF]);

    let formatCommands: Uint8Array[] = [];
    if (bold) formatCommands.push(TXT_BOLD_ON);
    if (underline) formatCommands.push(TXT_UNDERLINE_ON);

    let resetFormatCommands: Uint8Array[] = [];
    if (bold) resetFormatCommands.push(TXT_BOLD_OFF);
    if (underline) resetFormatCommands.push(TXT_UNDERLINE_OFF);
    // Always reset to normal text and left align after the block? Or per command?
    // resetFormatCommands.push(TXT_NORMAL);
    // resetFormatCommands.push(ALIGN_LEFT);


    const totalLength = align.length +
                        formatCommands.reduce((sum, arr) => sum + arr.length, 0) +
                        textBytes.length +
                        lfBytes.length +
                        resetFormatCommands.reduce((sum, arr) => sum + arr.length, 0);

    const command = new Uint8Array(totalLength);
    let offset = 0;

    command.set(align, offset);
    offset += align.length;

    for(const fmtCmd of formatCommands) {
        command.set(fmtCmd, offset);
        offset += fmtCmd.length;
    }

    command.set(textBytes, offset);
    offset += textBytes.length;

    // Reset formatting after text
    for(const fmtCmd of resetFormatCommands) {
        command.set(fmtCmd, offset);
        offset += fmtCmd.length;
    }

    command.set(lfBytes, offset); // Add Line Feed at the end of the text block
    // offset += lfBytes.length; // Not needed as it's the last part

    return command;
}

export function generateReceipt(
    header: string,
    date: string,
    time: string,
    tasks: { name: string, completed: boolean }[],
    totalTasks: number,
    footer: string
): Uint8Array {
  const commands: Uint8Array[] = [];
  commands.push(INIT_PRINTER);

  if (header) {
    commands.push(ALIGN_CENTER);
    commands.push(createTextBlock(header, ALIGN_CENTER, true)); // Bold header
  }

  commands.push(ALIGN_CENTER);
  commands.push(createTextBlock(`Date: ${date}   Time: ${time}`, ALIGN_CENTER));
  commands.push(createTextBlock("--------------------------------", ALIGN_CENTER));

  commands.push(ALIGN_LEFT);
  tasks.forEach(task => {
    commands.push(createTextBlock(`${task.completed ? '[X]' : '[ ]'} ${task.name}`));
  });

  commands.push(ALIGN_CENTER);
  commands.push(createTextBlock("--------------------------------", ALIGN_CENTER));
  commands.push(ALIGN_LEFT);
  commands.push(createTextBlock(`Total Tasks: ${totalTasks}`, ALIGN_LEFT, true)); // Bold total

  if (footer) {
    commands.push(ALIGN_CENTER);
    commands.push(createTextBlock(footer, ALIGN_CENTER, false, true)); // Underlined footer
  }

  commands.push(new Uint8Array([LF, LF, LF])); // Add some spacing
  commands.push(CUT_PAPER_FULL);

  // Concatenate all command Uint8Arrays
  let totalLength = 0;
  commands.forEach(cmd => totalLength += cmd.length);

  const receiptData = new Uint8Array(totalLength);
  let currentOffset = 0;
  commands.forEach(cmd => {
    receiptData.set(cmd, currentOffset);
    currentOffset += cmd.length;
  });

  return receiptData;
}
