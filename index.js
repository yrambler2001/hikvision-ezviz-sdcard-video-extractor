const HikvisionParser = require('./lib');
// const parser = new HikvisionParser('/Users/yrambler2001/Desktop/unt/sdcard')
(async () => {

  const parser = new HikvisionParser('/Users/yrambler2001/Desktop/untitled folder/aaaaa/datadir0')
  await parser.processSegments();
  await parser.logAvailableRecordings();

  parser.extractAllSegments({ from: '2020-01-26 00-00-00', to: '2026-04-26 00-43-00',mergeDays: false })
  debugger
})()
// parser.extractAllSegments({ mergeDays: false })

// parser.mergeSegmentsIntoDays()