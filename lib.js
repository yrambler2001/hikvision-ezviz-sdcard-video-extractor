const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { exec, execSync } = require('child_process');
const validateMpegPsStart = require('./mpegPsValidator');

class HikvisionParser {
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
    this.outputContainer = 'mov'; // mp4 does not support pcm_alaw audio
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

  timestampToString(timestamp) {
    // Expected format: 1753542271
    const date = new Date(timestamp * 1000);
    const pad = (num) => String(num).padStart(2, '0');

    // Expected format: "YYYY-MM-DD HH-mm-ss"
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1 /* Months are zero-based */)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
  }

  stringToTimestamp(str) {
    // Expected format: "YYYY-MM-DD HH-mm-ss"
    const [datePart, timePart] = str.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split('-').map(Number);

    // Create Unix timestamp from UTC date
    const date = Date.UTC(year, month - 1, day, hour, minute, second);

    // Expected format: 1753542271
    return date / 1000;
  }

  async processSegments(check = true) {
    let skippedSegments = 0;
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

        const sourceFileIndexString = String(sourceFileIndex).padStart(5, '0');
        const sourceFileSegmentIndexString = String(sourceFileSegmentIndex).padStart(3, '0');
        const sourceFileName = `hiv${sourceFileIndexString}.mp4`;
        const segment = {
          data,
          startTimeTimestamp,
          startTime: this.timestampToString(startTimeTimestamp),
          endTimeTimestamp,
          endTime: this.timestampToString(endTimeTimestamp),
          firstKeyFrame_absTimeTimestamp,
          firstKeyFrame_absTime: this.timestampToString(firstKeyFrame_absTimeTimestamp),
          sourceFileIndex,
          sourceFileIndexString,
          sourceFileName,
          sourceFileSegmentIndex,
          sourceFileSegmentIndexString,
        };
        if (check) {
          // case when segment is overwritten by newer segment
          const data = await this.readFileRange(path.join(this.cameraDir, segment.sourceFileName), segment.data.startOffset, segment.data.startOffset + 4096);
          segment.validationResult = validateMpegPsStart(data);
          if (!segment.validationResult.valid) {
            skippedSegments += 1;
            continue;
          }
        }
        this.segments.push(segment);
      }
    }
    this.segments.sort((a, b) => a.startTimeTimestamp - b.startTimeTimestamp);
    console.log(`Found ${this.segments.length} recordings`);
    if (skippedSegments > 0) console.log(`Skipped ${skippedSegments} invalid recordings`);
  }

  async readFileRange(path, startOffset, endOffset) {
    const length = endOffset - startOffset;
    const file = await fsPromises.open(path, 'r');
    const buffer = Buffer.alloc(length);
    try {
      await file.read(buffer, 0, length, startOffset);
    } finally {
      await file.close();
    }
    return buffer;
  }

  async extractSegmentMP4({ segment, targetPath = './extracted', replace = true, ffmpegLogCallback = console.log, logPrefix = '' }) {
    const existsAsync = async (path) => {
      try {
        await fsPromises.access(path, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    };
    await fsPromises.mkdir(targetPath, { recursive: true });
    const segmentFile = path.join(
      targetPath,
      `${segment.startTime} - ${segment.endTime} (${segment.sourceFileIndexString}-${segment.sourceFileSegmentIndexString}).mpeg`,
    );
    const mp4File = segmentFile.replace('.mpeg', `.${this.outputContainer}`);

    if ((await existsAsync(mp4File)) && replace) await fsPromises.unlink(mp4File);
    if (!(await existsAsync(mp4File)) || replace) {
      const buffer = await this.readFileRange(path.join(this.cameraDir, segment.sourceFileName), segment.data.startOffset, segment.data.endOffset);
      await fsPromises.writeFile(segmentFile, buffer);

      const macOSQuickTimePlayerSupport = '-tag:v hvc1';
      const cmd = `ffmpeg -i "${segmentFile}" -acodec copy -vcodec copy ${macOSQuickTimePlayerSupport} -y "${mp4File}"`;

      try {
        ffmpegLogCallback(`${cmd}\n`);
        console.log(`${logPrefix}Running ffmpeg...`);
        await new Promise((res, rej) => {
          exec(cmd, (error, stdout, stderr) => {
            ffmpegLogCallback(`${stdout + stderr}\n`);
            if (error) rej();
            else res();
          });
        });
        await fsPromises.unlink(segmentFile);
      } catch (error) {
        console.error(`${logPrefix}Error caught while running ffmpeg on ${segment.startTime} segment. See ffmpeg.log`, error || '');
        const statSize = await fsPromises.stat(`./${mp4File}`).catch(() => {
          /* no file found */
        });
        if (statSize?.size === 0) {
          // unlink empty-sized failed to process segments
          await fsPromises.unlink(`./${mp4File}`);
        }
      }
    }
    return mp4File;
  }

  async extractAllSegments({
    from = undefined,
    to = undefined /* [from, to) */,
    targetPath = path.join('.', 'extracted'),
    parallel = 8,
    replace = true,
    mergeDays = false,
    mergeParameters,
  } = {}) {
    const segmentsToBeProcessed = from && to ? this.segments.filter((segment) => segment.startTime >= from && segment.startTime < to) : this.segments;
    console.log(`${segmentsToBeProcessed.length} of ${this.segments.length} will be extracted`);
    const segmentsByDay = this.getSegmentsByDay(segmentsToBeProcessed, (segment) => segment.startTime.slice(0, 10)); // YYYY-MM-DD
    let currentSegmentIndex = 0;

    const ffmpegLogPath = path.join('.', `ffmpeg-${new Date().toISOString().replace(/:/g, '-')}.log`);
    const ffmpegLogFileHandle = await fsPromises.open(ffmpegLogPath, 'a');

    for (const dayKey of Object.keys(segmentsByDay).sort()) {
      console.log(`Processing day ${dayKey}`);
      const segmentsInDay = segmentsByDay[dayKey];
      let currentSegmentInDayIndex = 0;

      const Worker = async (workerIndex) => {
        while (currentSegmentInDayIndex < segmentsInDay.length) {
          const processingSegmentIndex = currentSegmentInDayIndex;
          const processingSegmentNumber = currentSegmentInDayIndex + 1;
          const workerNumber = workerIndex + 1;
          const currentSegment = segmentsInDay[processingSegmentIndex];
          currentSegmentInDayIndex += 1;
          currentSegmentIndex += 1;
          const logPrefix = `[${new Date().toISOString()}; Worker Number: ${`${workerNumber}/${parallel}`.padStart(2, '0')}; Segment Number: ${processingSegmentNumber}; Segment Date: ${currentSegment.startTime}]: `;
          console.log(
            `${logPrefix}Processing ${dayKey} ${processingSegmentNumber}/${segmentsInDay.length} (${currentSegmentIndex}/${segmentsToBeProcessed.length})`,
          );
          const ffmpegLogCallback = (data) =>
            ffmpegLogFileHandle.write(
              `${data
                .split('\n')
                .map((line) => `${logPrefix}${line}`)
                .join('\n')}\n`,
            );

          await this.extractSegmentMP4({ segment: currentSegment, targetPath, replace, logPrefix, ffmpegLogCallback });
        }
      };
      await Promise.all(new Array(parallel).fill(undefined).map((_, workerIndex) => Worker(workerIndex)));
      console.log(`Finished processing day ${dayKey}`);
      if (mergeDays) {
        console.log(`Merging day ${dayKey}...`);
        await this.mergeSegmentsIntoDays({ segmentsDir: targetPath, removeSegmentsAfterMerging: true, ...mergeParameters });
      }
    }

    await ffmpegLogFileHandle.close();
  }

  getSegmentsByDay(segments, getSegmentDayPredicate) {
    const segmentsByDay = {};
    segments.forEach((segment) => {
      const dayKey = getSegmentDayPredicate(segment);
      if (!segmentsByDay[dayKey]) segmentsByDay[dayKey] = [];
      const segmentsInDay = segmentsByDay[dayKey];
      segmentsInDay.push(segment);
    });
    return segmentsByDay;
  }

  async mergeSegmentsIntoDays({
    segmentsDir = path.join('.', 'extracted'),
    daysDir = path.join('.', 'days'),
    fileSizeLimitInBytes = undefined /* 550*1024*1024 */,
    removeSegmentsAfterMerging = false,
  } = {}) {
    const parseSegmentFileRange = (segmentName) => {
      const ranges = segmentName.slice(0, segmentName.indexOf('(')).trim();
      const [startDateString, endDateString] = ranges.split(' - ');
      const [startDate, endDate] = [startDateString, endDateString].map(this.stringToTimestamp).map((timestamp) => new Date(timestamp * 1000));
      return { startDate, endDate };
    };

    function chunkBySumLimit(array, elementAccessor, maxChunkSum) {
      const result = [];
      let currentChunk = [];
      let currentSum = 0;

      for (const element of array) {
        if (currentSum + elementAccessor(element) > maxChunkSum) {
          if (currentChunk.length > 0) {
            result.push(currentChunk);
          }
          currentChunk = [element];
          currentSum = elementAccessor(element);
        } else {
          currentChunk.push(element);
          currentSum += elementAccessor(element);
        }
      }

      if (currentChunk.length > 0) {
        result.push(currentChunk);
      }

      return result;
    }

    const segments = await Promise.all(
      fs
        .readdirSync(segmentsDir)
        .filter((fileName) => fileName.endsWith(`.${this.outputContainer}`))
        .map(async (segmentName) => ({
          name: segmentName,
          size: (await fsPromises.stat(path.join(segmentsDir, segmentName))).size,
        })),
    );

    const segmentsByDay = this.getSegmentsByDay(segments, (segment) => {
      const range = parseSegmentFileRange(segment.name);
      const dayKey = range.startDate.toISOString().slice(0, 10); // YYYY-MM-DD
      return dayKey;
    });

    Object.keys(segmentsByDay)
      .sort()
      .forEach((dayKey) => {
        const segmentsInDay = segmentsByDay[dayKey].sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
        const chunksWithSegments = fileSizeLimitInBytes ? chunkBySumLimit(segmentsInDay, (segment) => segment.size, fileSizeLimitInBytes) : [segmentsInDay];
        chunksWithSegments.forEach((chunkWithSegments) => {
          const concatFilePath = path.join('.', 'ffmpegConcatList.txt');
          fs.writeFileSync(concatFilePath, chunkWithSegments.map((segment) => `file '${path.join(segmentsDir, segment.name)}'`).join('\n'));

          const firstSegmentRange = parseSegmentFileRange(chunkWithSegments[0].name);
          const lastSegmentRange = parseSegmentFileRange(chunkWithSegments[chunkWithSegments.length - 1].name);
          const mergedFileName = `${this.timestampToString(firstSegmentRange.startDate / 1000)} - ${this.timestampToString(lastSegmentRange.endDate / 1000)}.${this.outputContainer}`;

          fs.mkdirSync(daysDir, { recursive: true });
          const allowSpecialSymbolsInPath = '-safe 0';
          execSync(`ffmpeg -f concat ${allowSpecialSymbolsInPath} -i "${concatFilePath}" -acodec copy -vcodec copy -y "${path.join(daysDir, mergedFileName)}"`);
          fs.unlinkSync(concatFilePath);
          if (removeSegmentsAfterMerging) {
            chunkWithSegments.forEach((segment) => fs.unlinkSync(path.join(segmentsDir, segment.name)));
          }
        });
      });
  }

  logSourcesUsage = () => {
    const statsPerSourceFile = this.segments.reduce(
      (statsPerSourceFileIndex, segment) => ({
        ...statsPerSourceFileIndex,
        [segment.sourceFileIndex]: (statsPerSourceFileIndex[segment.sourceFileIndex] || 0) + segment.data.endOffset - segment.data.startOffset,
      }),
      {},
    );
    console.log(JSON.stringify(statsPerSourceFile, null, 2));
  };

  logAvailableRecordings = () => {
    const data = this.segments.map(
      (segment, index) =>
        `${index} ${segment.sourceFileName}: ${segment.startTime} - ${segment.endTime} (${`${segment.data.startOffset}`.padStart(9, '0')} - ${`${segment.data.endOffset}`.padStart(9, '0')})`,
    );
    console.log(JSON.stringify(data, null, 2));
  };
}

module.exports = HikvisionParser;
