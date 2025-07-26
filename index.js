const HikvisionParser = require('./lib')
const parser = new HikvisionParser('/Users/yrambler2001/Desktop/unt/sdcard')
parser.processSegments();
// debugger
// aa.extractAllSegments({from:'2025-07-13 00:00:00',to:'2025-07-14 00:00:00'})
parser.extractAllSegments({from:'2025-07-12 21:48:14',to:'2025-07-12 22:04:10'})
