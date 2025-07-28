const HikvisionParser = require('./lib');

const folder = '/Users/User/Desktop/sdcard';
const targetFolder = undefined;
const from = undefined;
// const from = '2020-01-01 00-00-00';
const to = undefined;
// const to = '2026-01-01 00-00-00';
const mergeDays = false;
const mergeDaysFileSizeLimitInBytes = undefined;

(async () => {
  const parser = new HikvisionParser(folder)
  await parser.processSegments();
  await parser.extractAllSegments({ from, to, targetPath: targetFolder, mergeDays, mergeParameters: { fileSizeLimitInBytes: mergeDaysFileSizeLimitInBytes } })
})()
