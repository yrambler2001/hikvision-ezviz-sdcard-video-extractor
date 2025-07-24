// libhikvision.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DateTime } = require('luxon');
const { execSync } = require('child_process');

class LibHikvision {
  constructor(cameradir, asktype = 'video') {
    this.cameradir = cameradir;
    this.asktype = asktype;

    this.header_len = 1280;
    this.file_len = 32;
    this.segment_len = 80;
    this.maxSegments = 256;
    this.video_len = 4096;

    this.indexType = null;
    this.segments = [];

    this.getIndexPath();
    this.info = this.getNASInfo();
    this.header = this.getFileHeader();
  }

  getIndexPath(indexFileNum = 0) {
    if (["video", "mp4"].includes(this.asktype)) {
      this.indexFile = "index00.bin";
    } else {
      this.indexFile = "index00p.bin";
    }

    let filename = path.join(this.cameradir, `datadir${indexFileNum}`, this.indexFile);
    if (!fs.existsSync(filename)) {
      this.indexType = "sqlite";
      this.indexFile = "record_db_index00";
      filename = path.join(this.cameradir, `datadir${indexFileNum}`, this.indexFile);
      if (!fs.existsSync(filename)) {
        throw new Error("Can't find indexes...");
      }
    } else {
      this.indexType = "bin";
    }

    return filename;
  }

  getNASInfo() {
    const info_keys = ["serialNumber", "MACAddr", "byRes", "f_bsize", "f_blocks", "DataDirs"];
    const buffer = fs.readFileSync(path.join(this.cameradir, "info.bin"));
    const unpacked = [
      buffer.slice(0, 48).toString("utf-8").replace(/\0/g, ""),
      buffer.readUInt32LE(48),
      buffer.readUInt8(52),
      buffer.readUInt32LE(53),
      buffer.readUInt32LE(57),
      buffer.readUInt32LE(61),
    ];

    return Object.fromEntries(info_keys.map((k, i) => [k, unpacked[i]]));
  }

  getFileHeader() {
    let header = null;
    for (let indexFileNum = 0; indexFileNum < this.info.DataDirs; indexFileNum++) {
      const fileName = this.getIndexPath(indexFileNum);
      const buffer = fs.readFileSync(fileName);
      header = {
        modifyTimes: Number(buffer.readBigUInt64LE(0)),
        version: buffer.readUInt32LE(8),
        avFiles: buffer.readUInt32LE(12),
        nextFileRecNo: buffer.readUInt32LE(16),
        lastFileRecNo: buffer.readUInt32LE(20),
        curFileRec: buffer.readUInt32LE(24),
        unknown: buffer.slice(28, 1204),
        checksum: buffer.readUInt32LE(1276),
      };
    }
    return header;
  }

  getSegments({ fromTime = null, toTime = null, fromUnixtime = null, toUnixtime = null } = {}) {
    if (fromUnixtime) fromTime = DateTime.fromSeconds(fromUnixtime).toUTC();
    if (toUnixtime) toTime = DateTime.fromSeconds(toUnixtime).toUTC();
    if (fromTime) fromUnixtime = Math.floor(fromTime.toSeconds());
    if (toTime) toUnixtime = Math.floor(toTime.toSeconds());

    return this.indexType === 'bin'
      ? this.getSegmentsBIN(fromTime, toTime)
      : this.getSegmentsSQL(fromUnixtime, toUnixtime);
  }

  getSegmentsSQL(fromUnixtime = null, toUnixtime = null) {
    this.segments = [];
    let where = 'record_type != 0';
    if (fromUnixtime) where += ` AND start_time_tv_sec >= ${fromUnixtime}`;
    if (toUnixtime) where += ` AND start_time_tv_sec <= ${toUnixtime}`;

    const statement = `SELECT file_no, start_offset, end_offset, start_time_tv_sec, end_time_tv_sec FROM record_segment_idx_tb WHERE ${where} ORDER BY start_time_tv_sec`;

    for (let indexFileNum = 0; indexFileNum < this.info.DataDirs; indexFileNum++) {
      const fileName = this.getIndexPath(indexFileNum);
      const db = new sqlite3.Database(fileName);
      db.each(statement, (err, row) => {
        if (err) throw err;
        this.segments.push({
          startOffset: row.start_offset,
          endOffset: row.end_offset,
          cust_indexFileNum: indexFileNum,
          cust_startTime: DateTime.fromSeconds(row.start_time_tv_sec).toUTC(),
          cust_endTime: DateTime.fromSeconds(row.end_time_tv_sec).toUTC(),
          cust_duration: row.end_time_tv_sec - row.start_time_tv_sec,
        });
      });
    }
    return this.segments;
  }

  getSegmentsBIN(fromTime = null, toTime = null) {
    this.segments = [];
    const mask = 0xFFFFFFFF;
    for (let indexFileNum = 0; indexFileNum < this.info.DataDirs; indexFileNum++) {
      const fileName = this.getIndexPath(indexFileNum);
      const buffer = fs.readFileSync(fileName);
      const offset = this.header_len + this.header.avFiles * this.file_len;
      let pos = offset;
      for (let fileNum = 0; fileNum < this.header.avFiles; fileNum++) {
        for (let i = 0; i < this.maxSegments; i++) {
          const seg = buffer.slice(pos, pos + this.segment_len);
          const startTime = seg.readBigUInt64LE(8) & BigInt(mask);
          const endTime = seg.readBigUInt64LE(16) & BigInt(mask);

          if (endTime !== BigInt(0)) {
            const start = DateTime.fromSeconds(Number(startTime)).toUTC();
            const end = DateTime.fromSeconds(Number(endTime)).toUTC();
            if (
              (!fromTime && !toTime) ||
              (fromTime && start > fromTime && !toTime) ||
              (!fromTime && toTime && start < toTime) ||
              (fromTime && toTime && start > fromTime && start < toTime)
            ) {
              this.segments.push({
                cust_indexFileNum: indexFileNum,
                cust_fileNum: fileNum,
                startOffset: seg.readUInt32LE(32),
                endOffset: seg.readUInt32LE(36),
                cust_startTime: start,
                cust_endTime: end,
                cust_duration: end.diff(start, 'seconds').seconds,
                cust_filePath: `${this.cameradir}/datadir${indexFileNum}/hiv${fileNum.toString().padStart(5, '0')}.${this.asktype === 'video' ? 'mp4' : 'pic'}`,
              });
            }
          }
          pos += this.segment_len;
        }
      }
    }
    return this.segments;
  }

  extractSegmentMP4(indx, cachePath = '/tmp', filename = null, resolution = null, debug = false, replace = true) {
    const seg = this.segments[indx];
    const h264File = `${cachePath}/hik_datadir${seg.cust_indexFileNum}_${seg.startOffset}_${seg.endOffset}.h264`;
    const mp4File = filename || h264File.replace('.h264', '.mp4');

    if (fs.existsSync(mp4File) && replace) fs.unlinkSync(mp4File);
    if (!fs.existsSync(mp4File) || replace) {
      const buffer = fs.readFileSync(seg.cust_filePath);
      fs.writeFileSync(h264File, buffer.slice(seg.startOffset, seg.endOffset));

      const cmd = resolution
        ? `ffmpeg -i ${h264File} -threads auto -s ${resolution} -c:a none ${mp4File}`
        : `ffmpeg -i ${h264File} -threads auto -c:v copy -c:a none ${mp4File}`;

      execSync(cmd, { stdio: debug ? 'inherit' : 'ignore' });
      fs.unlinkSync(h264File);
    }
    return mp4File;
  }

  extractSegmentJPG(indx, cachePath = '/tmp', filename = null, resolution = null, debug = false, replace = true, position = null) {
    const seg = this.segments[indx];
    const h264File = `${cachePath}/hik_datadir${seg.cust_indexFileNum}_${seg.startOffset}_${seg.endOffset}.h264`;
    const jpgFile = filename || h264File.replace('.h264', '.jpg');

    if (fs.existsSync(jpgFile) && replace) fs.unlinkSync(jpgFile);
    if (!fs.existsSync(jpgFile)) {
      const buffer = fs.readFileSync(seg.cust_filePath);
      fs.writeFileSync(h264File, buffer.slice(seg.startOffset, seg.endOffset));

      let jpgPos = position || Math.min(59, Math.floor(seg.cust_duration / 2));
      const cmd = resolution
        ? `ffmpeg -ss 00:00:${jpgPos} -i ${h264File} -vframes 1 -s ${resolution} ${jpgFile}`
        : `ffmpeg -ss 00:00:${jpgPos} -i ${h264File} -vframes 1 ${jpgFile}`;

      execSync(cmd, { stdio: debug ? 'inherit' : 'ignore' });
      fs.unlinkSync(h264File);
    }
    return jpgFile;
  }
}

module.exports = LibHikvision;
