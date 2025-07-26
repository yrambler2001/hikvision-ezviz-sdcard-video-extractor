/**
 * mpegPsValidator.js
 *
 * A Node.js script to validate the beginning of an MPEG Program Stream (MPEG-PS).
 * To run this script:
 * 1. Save it as a file (e.g., `validate.js`).
 * 2. Run from your terminal: `node validate.js`
 */

/**
 * Validates the start of an MPEG Program Stream (MPEG-PS) buffer.
 *
 * An MPEG-PS file is a sequence of "packs". This function checks if the
 * provided buffer starts with a valid MPEG-2 Pack Header and looks for a
 * subsequent System Header, which is characteristic of a valid stream start.
 *
 * @param {Buffer} buffer The input buffer, which should represent the start of the file.
 * @returns {{valid: boolean, message: string, details: Object}} An object containing the validation result.
 */
function validateMpegPsStart(buffer) {
  const details = {};

  // --- Basic Checks ---
  // Ensure the input is a Buffer and has a minimum length for the pack start code.
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return {
      valid: false,
      message: 'Input is not a valid Buffer or is too short (less than 4 bytes).',
      details: {},
    };
  }

  // --- Check 1: Pack Start Code (0x000001BA) ---
  // Every MPEG-PS pack must begin with this 32-bit code.
  const packStartCode = buffer.readUInt32BE(0);
  details.packStartCode = `0x${packStartCode.toString(16).toUpperCase()}`;

  if (packStartCode !== 0x000001ba) {
    return {
      valid: false,
      message: 'Invalid or missing Pack Start Code.',
      details,
    };
  }

  // --- Check 2: MPEG-2 Marker ---
  // For MPEG-2 Program Streams, the 4 bits following the pack_start_code must be '01xx'.
  // This means the 5th byte in the stream must have its two most significant bits as '01'.
  if (buffer.length < 5) {
    return {
      valid: true,
      message: 'Found a valid Pack Start Code, but the buffer is too short for further checks.',
      details,
    };
  }
  const mpeg2Marker = buffer.readUInt8(4);
  details.mpeg2MarkerByte = `0x${mpeg2Marker.toString(16).toUpperCase()}`;

  // We check if the byte matches the binary pattern 01xxxxxx.
  // (mpeg2Marker & 0xC0) isolates the first two bits. 0x40 is binary 01000000.
  if ((mpeg2Marker & 0xc0) !== 0x40) {
    return {
      valid: false,
      message: "The marker bits for MPEG-2 ('01xx') were not found after the Pack Start Code.",
      details,
    };
  }

  // --- Check 3: System Header Start Code (0x000001BB) ---
  // A valid MPEG-PS file will typically have a System Header defining stream properties
  // shortly after the first pack header. We'll search for its start code.
  // We search within a reasonable limit (e.g., the first 2048 bytes) as a heuristic.
  const searchLimit = Math.min(buffer.length - 4, 2048);
  let foundSystemHeader = false;
  for (let i = 4; i < searchLimit; i++) {
    // Check for the 32-bit code 0x000001BB
    if (buffer.readUInt32BE(i) === 0x000001bb) {
      foundSystemHeader = true;
      details.systemHeaderFoundAt = `byte ${i}`;
      break;
    }
  }

  if (!foundSystemHeader) {
    // The stream could still be valid, but the absence of a system header at the start is unusual.
    // return {
    //   valid: true, // Technically it starts with a valid pack.
    //   message:
    //     'Valid Pack Start Code found, but no System Header (0x000001BB) was detected in the first 2KB. The file may be a valid but simple transport stream segment.',
    //   details,
    // };
    return {
      valid: false,
      message:
        'Valid Pack Start Code found, but no System Header (0x000001BB) was detected in the first 2KB.',
      details,
    };
  }

  // If all checks pass, it's very likely a valid MPEG-PS start.
  return {
    valid: true,
    message: 'Valid MPEG-PS start detected.',
    details,
  };
}

// // --- TEST HARNESS ---

// function runValidationTest(title, hexString) {
//   console.log(`\n--- Testing: ${title} ---`);
//   try {
//     // Convert the hex string into a Node.js Buffer, which is what the function expects.
//     const fileBuffer = Buffer.from(hexString.replace(/\s/g, ''), 'hex');
//     const result = validateMpegPsStart(fileBuffer);

//     console.log(`Result: ${result.valid ? 'VALID' : 'INVALID'}`);
//     console.log(`Message: ${result.message}`);
//     console.log('Details:', result.details);
//   } catch (error) {
//     console.log('Result: INVALID');
//     console.log(`Message: An error occurred during processing: ${error.message}`);
//   }
// }

// // --- Test Cases ---

// // 1. First valid example provided by the user.
// const validHex1 = '000001BA5F6C4F8EF40107447FFEFFFF072DFBEC000001BB001283A23F04E17FE0E080C0C008BDE080BFE080000001BC005EF2FF0024400E484B0100194E4064A2DF00FFFFFF4112484B000102030405060708090A0B0C0D0E0F003024E0001C420E071010EA0A8005F0191000001C212A0A7FFF000007081FFE50BE90C0000C430A0140FE007D0303E803FF337DB994000001E0002A8C800927DB13E3BDFFFFFFFC0000000140010C03FFFF0160000003008000000300000300960000BDE048000001E0005E8C0005FFFFFFFFFC000000014201030160000003008000000300000300960000A001502005F1FE36F7DDA9BBB92FD80B70101010400000FA0000186A1C877B944002D6A000331840016B5000198C21000B5A8000CC610005AD4000663088000001E000168C0005FFFFFFFFFC000000014401C172B09C1C0E6640000001E0';
// runValidationTest('User Example 1 (Valid)', validHex1);

// // 2. Second valid example provided by the user.
// // Note: Cleaned up a non-hex character from the end of the original string.
// const validHex2 = '000001BA441DEC421401028F63FEFFFF00001833000001BB00128147B104E17FE0E080C0C008BDE080BFE080000001BC005EFDFF0024400E484B000219765424E80F00FFFFFF4112484B000102030405060708090A0B0C0D0E0F003024E0001C420E071010EA0A0005A0111F00001C202A0A7FFF000007081FFE40B40FC0000C430A0090FE00FA0301F403FF3C99A1C2000001E000268C800721077B1085FFFC0000000140010C01FFFF01600000030000030000030000030096AC09000001E000368C0003FFFFFC0000000142010101600000030000030000030000030096A001402005A1636B924E5337010101040000384000057E4284000001E000128C0004FFFFFFFC000000014401C0F2F02240000001E0FFD28C0002FFFD000000012601AD1D';
// runValidationTest('User Example 2 (Valid)', validHex2);

// // 3. An example of junk/invalid data.
// const junkHex = 'DEADBEEF000001BA00000000000000000000000000000000000001BB';
// runValidationTest('Junk Data Example (Invalid)', junkHex);

// // 4. An example that starts correctly but is missing the MPEG-2 marker.
// const wrongMarkerHex = '000001BA80000000000000000000000000000000000001BB';
// runValidationTest('Wrong Marker Example (Invalid)', wrongMarkerHex);

// // 5. An example with a valid pack start but no system header.
// const noSystemHeaderHex = '000001BA44112233445566778899AABBCCDDEEFF';
// runValidationTest('No System Header Example (Valid Pack, but unusual start)', noSystemHeaderHex);

module.exports = validateMpegPsStart;
