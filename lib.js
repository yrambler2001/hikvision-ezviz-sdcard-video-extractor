const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class LibHikvision {
  constructor(cameraDir) {
    this.cameraDir = cameraDir;

    this.headerBufferLength = 1280;
    this.file_len = 32;
    this.segmentBufferLength = 80;
    this.maxSegmentsInSourceFile = 256;
    // this.video_len = 4096;

    this.indexType = null;
    this.segments = [];

    this.indexPath = path.join(this.cameraDir, 'index00.bin'); // index01.bin has the same segments
    this.header = this.getFileHeader();
  }

  getFileHeader() {
    const buffer = fs.readFileSync(this.indexPath);

    let offset = 0;
    const modifyTimes = buffer.readBigUInt64LE(offset); offset += 8;
    const version = buffer.readUInt32LE(offset); offset += 4;
    const avFiles = buffer.readUInt32LE(offset); offset += 4;
    const nextFileRecNo = buffer.readUInt32LE(offset); offset += 4;
    const lastFileRecNo = buffer.readUInt32LE(offset); offset += 4;
    const curFileRec = buffer.subarray(offset, offset + 1176); offset += 1176;
    const unknown = buffer.subarray(offset, offset + 76); offset += 76;
    const checksum = buffer.readUInt32LE(offset); offset += 4;
    return { modifyTimes, version, avFiles, nextFileRecNo, lastFileRecNo, curFileRec, unknown, checksum };
  }

  parseSegment(buffer) {
    let offsetInSegment = 0;
    const type = buffer.readUint8(offsetInSegment); offsetInSegment += 1;
    const status = buffer.readUint8(offsetInSegment); offsetInSegment += 1;
    const resA = buffer.readUint16LE(offsetInSegment); offsetInSegment += 2;
    const resolution = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const startTime = buffer.readBigUInt64LE(offsetInSegment); offsetInSegment += 8;
    const endTime = buffer.readBigUInt64LE(offsetInSegment); offsetInSegment += 8;
    const firstKeyFrame_absTime = buffer.readBigUInt64LE(offsetInSegment); offsetInSegment += 8;
    const firstKeyFrame_stdTime = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const lastFrame_stdTime = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const startOffset = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const endOffset = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const resB = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const infoNum = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const infoTypes = buffer.readBigUInt64LE(offsetInSegment); offsetInSegment += 8;
    const infoStartTime = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const infoEndTime = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const infoStartOffset = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    const infoEndOffset = buffer.readUInt32LE(offsetInSegment); offsetInSegment += 4;
    return {
      type, status, resA, resolution, startTime, endTime, firstKeyFrame_absTime, firstKeyFrame_stdTime, lastFrame_stdTime, startOffset, endOffset, resB, infoNum, infoTypes, infoStartTime, infoEndTime, infoStartOffset, infoEndOffset,
    };
  }

  processSegments() {
    const buffer = fs.readFileSync(this.indexPath);
    const startOffset = this.headerBufferLength + this.header.avFiles * this.file_len;
    let offset = startOffset;

    for (let sourceFileIndex = 0; sourceFileIndex < this.header.avFiles; sourceFileIndex++) {
      for (let sourceFileSegmentIndex = 0; sourceFileSegmentIndex < this.maxSegmentsInSourceFile; sourceFileSegmentIndex++) {
        if (offset + this.segmentBufferLength > buffer.length) break;

        const segBuffer = buffer.subarray(offset, offset + this.segmentBufferLength);
        const data = this.parseSegment(segBuffer);
        offset += this.segmentBufferLength;

        if (data.endTime === 0n) continue;

        const dateMask = 0x00000000ffffffffn;
        const startTimeTimestamp = Number(data.startTime & dateMask);
        const endTimeTimestamp = Number(data.endTime & dateMask);
        const firstKeyFrame_absTimeTimestamp = Number(data.firstKeyFrame_absTime & dateMask);

        const timestampToString = (timestamp) => {
          const date = new Date(timestamp * 1000);
          const pad = (num) => String(num).padStart(2, '0');
          return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1 /* Months are zero-based */)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
        };

        const sourceFileIndexString = String(sourceFileIndex).padStart(5, '0');
        const sourceFileSegmentIndexString = String(sourceFileSegmentIndex).padStart(3, '0');
        const sourceFileName = `hiv${sourceFileIndexString}.mp4`;
        const segment = {
          data,
          startTimeTimestamp,
          startTime: timestampToString(startTimeTimestamp),
          endTimeTimestamp,
          endTime: timestampToString(endTimeTimestamp),
          firstKeyFrame_absTimeTimestamp,
          firstKeyFrame_absTime: timestampToString(firstKeyFrame_absTimeTimestamp),
          sourceFileIndex,
          sourceFileIndexString,
          sourceFileName,
          sourceFileSegmentIndex,
          sourceFileSegmentIndexString,
        };
        this.segments.push(segment);
      }
    }
    this.segments.sort((a, b) => a.startTimeTimestamp - b.startTimeTimestamp);
    console.log(`Found ${this.segments.length} recordings`)
  }

  readFileRange(path, offset, length) {
    const fd = fs.openSync(path, 'r');
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, offset);
    fs.closeSync(fd);
    return buffer;
  }

  extractSegmentMP4(index, targetPath = './extracted', replace = true) {
    console.log(`Processing ${index} recording`);
    fs.mkdirSync(targetPath, { recursive: true });
    const seg = this.segments[index];
    const sanitizeDatePath = (dateString) => dateString.replace(/:/g, '-');
    const h265File = path.join(
      targetPath,
      `${sanitizeDatePath(seg.startTime)} - ${sanitizeDatePath(seg.endTime)} (${seg.sourceFileIndexString}-${seg.sourceFileSegmentIndexString}).h265`,
    );
    const movFile = h265File.replace('.h265', '.mov');

    if (fs.existsSync(movFile) && replace) fs.unlinkSync(movFile);
    if (!fs.existsSync(movFile) || replace) {
      const buffer = this.readFileRange(path.join(this.cameraDir, seg.sourceFileName), seg.data.startOffset, seg.data.endOffset);
      fs.writeFileSync(h265File, buffer);

      const macOSQuickTimePlayerSupport = '-tag:v hvc1';
      const cmd = `ffmpeg -i "${h265File}" -acodec copy -vcodec copy ${macOSQuickTimePlayerSupport} -f mov "${movFile}"`;
      const ffmpegLogPath = path.join('.', 'ffmpeg.log');
      const ffmpegLogFileHandle = fs.openSync(ffmpegLogPath, 'a');

      try {
        fs.writeSync(ffmpegLogFileHandle, `${cmd}\n`);
        console.log('Running ffmpeg...');
        execSync(cmd, { stdio: ['ignore', ffmpegLogFileHandle, ffmpegLogFileHandle] });
        fs.unlinkSync(h265File);
      } catch (err) {
        console.error('Error caught while running ffmpeg. See ffmpeg.log');
      }
      fs.closeSync(ffmpegLogFileHandle);
    }
    return movFile;
  }

  extractAllSegments(targetPath = './extracted', replace = true) {
    this.segments.forEach((segment, index) => {
      this.extractSegmentMP4(index, targetPath, replace);
    });
  }
}

module.exports = LibHikvision;
