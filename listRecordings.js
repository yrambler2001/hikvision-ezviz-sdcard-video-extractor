const HikvisionParser = require('./lib');

const folder = '/Users/yrambler2001/Desktop/untitled folder/unt/sdc ard';

(async () => {
  const parser = new HikvisionParser(folder)
  await parser.processSegments();
  await parser.logAvailableRecordings();
})()
