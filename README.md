This Node.js software can extract Hikvision/EZVIZ recorded videos out of sdcard and make it playable on Mac OS. No npm dependencies needed.

Tested with Hikvision (EZVIZ) DS-2CD2443G2-IW-W v5.3.8 build 241123 and DS-2CD2443G0-IW v5.6.5 build 200316.

[Node.js](https://nodejs.org) v20 or later is required.

[ffmpeg](https://ffmpeg.org) is required.

### Info:

On the Camera's sdcard there are these files:

```
hiv00000.mp4
hiv00000.pic
hiv00001.mp4
hiv00001.pic
hiv00002.mp4
hiv00002.pic
hiv00003.mp4
hiv00003.pic
hiv00004.mp4
hiv00004.pic
hiv00005.mp4
hiv00005.pic
hiv00006.mp4
hiv00006.pic
hiv00007.mp4
hiv00007.pic
hiv00008.mp4
hiv00008.pic
hiv00009.mp4
hiv00010.mp4
hiv00011.mp4
hiv00012.mp4
hiv00013.mp4
hiv00014.mp4
...
hiv00463.mp4
hiv00464.mp4
hiv00465.mp4
index00.bin
index00p.bin
index01.bin
index01p.bin
logCurFile.bin
logMainFile.bin
```

Each hivXXXXX file has a size of exactly 256 megabytes. After formatting the sdcard, the filesystem file allocation table is quickly filled with these 256 megabytes (filled with zeroes) files.

Video is being streamed into hivXXXXX files with Round-robin algorithm. Each file has multiple MPEG-PS containers with HEVC and AAC streams. Camera knows start and end dates, file index, start and end addresses of each MPEG-PS container part (segment) within a file. Such info is stored in `index00.bin`. `index01.bin` has the same info about segments. `index00p.bin` has info about images.

Example `index00.bin` files are in examples folder.

### This software

1. Parses the `index00.bin` file (v2 & v3 versions are confirmed to work).
1. Gets all segments.
   1. Optionally: with a timeframe limit.
1. Extracts segments into files.
1. Changes the container into mov.
1. Changes the HEVC codec id from hev1 to hvc1 to allow playing the video in QuickTime and other apps.
1. No re-encoding of the video or audio makes:
   1. the processing very fast,
   1. video size smallest possible (for that quality),
   1. video quality same as original.
1. Optionally: Merges the segments within a day into a single file.
   1. Optionally: ...into multiple files limited with specific filesize.

### listRecordings.js

#### Setup

1. Open the `listRecordings.js` file with a text editor.
1. Update the `const folder = '/Users/User/Desktop/sdcard';` line with your folder.

#### Usage

`node ./listRecordings.js`

List of recordings will be logged into the console.

#### Output format

"Recording index" "Recording source file": "Recording start date" - "Recording end date" ("Recording binary start offset within source file" - "Recording binary end offset within source file")

#### Sample output:

```
node ./listRecordings.js
Found 3402 recordings
[
  "0 hiv00000.mp4: 2025-07-12 21-02-19 - 2025-07-12 21-07-35 (000000000 - 076213180)",
  "1 hiv00000.mp4: 2025-07-12 21-10-51 - 2025-07-12 21-11-37 (076213248 - 084651320)",
  "2 hiv00000.mp4: 2025-07-12 21-35-37 - 2025-07-12 21-48-14 (084651520 - 264787587)",
  "3 hiv00001.mp4: 2025-07-12 21-48-14 - 2025-07-12 21-56-27 (000000000 - 116477676)",
  "4 hiv00001.mp4: 2025-07-12 21-56-31 - 2025-07-12 21-57-50 (116477952 - 134733060)",
  "5 hiv00001.mp4: 2025-07-12 21-57-50 - 2025-07-12 22-01-52 (134733312 - 191241056)",
  "6 hiv00001.mp4: 2025-07-12 22-01-56 - 2025-07-12 22-04-09 (191241216 - 221536620)",
  "7 hiv00001.mp4: 2025-07-12 22-04-09 - 2025-07-12 22-07-14 (221536768 - 264468879)",
  "8 hiv00002.mp4: 2025-07-12 22-07-14 - 2025-07-12 22-07-51 (000000000 - 008139132)",
  "9 hiv00002.mp4: 2025-07-12 22-07-59 - 2025-07-12 22-10-04 (008139264 - 037196256)",
  "10 hiv00002.mp4: 2025-07-12 22-10-04 - 2025-07-12 22-16-40 (037196288 - 133203788)",
...
...
...
```

### extract.js

#### Setup

1. Open the `extract.js` file with a text editor.
1. Update the `const folder = '/Users/User/Desktop/sdcard';` line with your folder.
1. If you don't want to use default folder for extracted recordings (`./extracted`):
   1. Update the `const targetFolder = undefined;` line with `const targetFolder = '/Users/User/Desktop/folder';`, use your folder path.
1. If you want to use timeframe:
   1. Replace the `const from = undefined;` line with `const from = '2020-01-01 00-00-00';`. Enter the needed date.
   1. Replace the `const to = undefined;` line with `const to = '2026-01-01 00-00-00';`. Enter the needed date.
1. If you want to merge videos into days:
   1. Replace the `const mergeDays = false;` line with `const mergeDays = true;`.
   1. If you want to make "merged into days videos" files no bigger than some size (if you want to split into smaller files):
      1. Replace the `const mergeDaysFileSizeLimitInBytes = undefined;` line with `const mergeDaysFileSizeLimitInBytes = 550 * 1024 * 1024;`, where 550 is the size in megabytes. Keep in mind that single contiguous recording might be up to 256 megabytes, so if smaller size is entered, file still might be up to 256 megabytes.
   1. Recordings will be in the `./days` folder

#### Usage

`node ./extract.js`

Recordings will be in the targetFolder defined in extract, or in `./extracted` if no folder specified.

#### Recording file name format:

"Recording start date" - "Recording end date" ("Recording source file index"-"Recording index within source file").mov

#### Sample recording name:

`2025-07-12 22-10-04 - 2025-07-12 22-16-40 (00002-003).mov`

#### Sample output:

```
node ./extract.js
Found 3402 recordings
3402 of 3402 will be extracted
Processing day 2025-07-12
[2025-07-27T23:47:18.252Z; Worker Number: 1/8; Segment Number: 1; Segment Date: 2025-07-12 21-02-19]: Processing 2025-07-12 1/39 (1/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 2/8; Segment Number: 2; Segment Date: 2025-07-12 21-10-51]: Processing 2025-07-12 2/39 (2/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 3/8; Segment Number: 3; Segment Date: 2025-07-12 21-35-37]: Processing 2025-07-12 3/39 (3/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 4/8; Segment Number: 4; Segment Date: 2025-07-12 21-48-14]: Processing 2025-07-12 4/39 (4/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 5/8; Segment Number: 5; Segment Date: 2025-07-12 21-56-31]: Processing 2025-07-12 5/39 (5/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 6/8; Segment Number: 6; Segment Date: 2025-07-12 21-57-50]: Processing 2025-07-12 6/39 (6/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 7/8; Segment Number: 7; Segment Date: 2025-07-12 22-01-56]: Processing 2025-07-12 7/39 (7/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 8/8; Segment Number: 8; Segment Date: 2025-07-12 22-04-09]: Processing 2025-07-12 8/39 (8/3402)
[2025-07-27T23:47:18.253Z; Worker Number: 2/8; Segment Number: 2; Segment Date: 2025-07-12 21-10-51]: Running ffmpeg...
[2025-07-27T23:47:18.253Z; Worker Number: 5/8; Segment Number: 5; Segment Date: 2025-07-12 21-56-31]: Running ffmpeg...
[2025-07-27T23:47:18.253Z; Worker Number: 7/8; Segment Number: 7; Segment Date: 2025-07-12 22-01-56]: Running ffmpeg...
...
...
...
[2025-07-27T23:47:19.575Z; Worker Number: 1/8; Segment Number: 31; Segment Date: 2025-07-12 23-27-54]: Running ffmpeg...
[2025-07-27T23:47:19.575Z; Worker Number: 2/8; Segment Number: 32; Segment Date: 2025-07-12 23-35-20]: Running ffmpeg...
[2025-07-27T23:47:19.803Z; Worker Number: 3/8; Segment Number: 36; Segment Date: 2025-07-12 23-54-12]: Processing 2025-07-12 36/39 (36/3402)
[2025-07-27T23:47:19.803Z; Worker Number: 3/8; Segment Number: 36; Segment Date: 2025-07-12 23-54-12]: Running ffmpeg...
[2025-07-27T23:47:19.907Z; Worker Number: 6/8; Segment Number: 37; Segment Date: 2025-07-12 23-56-32]: Processing 2025-07-12 37/39 (37/3402)
[2025-07-27T23:47:19.907Z; Worker Number: 6/8; Segment Number: 37; Segment Date: 2025-07-12 23-56-32]: Running ffmpeg...
[2025-07-27T23:47:19.950Z; Worker Number: 4/8; Segment Number: 38; Segment Date: 2025-07-12 23-57-17]: Processing 2025-07-12 38/39 (38/3402)
[2025-07-27T23:47:19.956Z; Worker Number: 8/8; Segment Number: 39; Segment Date: 2025-07-12 23-58-48]: Processing 2025-07-12 39/39 (39/3402)
[2025-07-27T23:47:19.950Z; Worker Number: 4/8; Segment Number: 38; Segment Date: 2025-07-12 23-57-17]: Running ffmpeg...
[2025-07-27T23:47:19.956Z; Worker Number: 8/8; Segment Number: 39; Segment Date: 2025-07-12 23-58-48]: Running ffmpeg...
Finished processing day 2025-07-12
Processing day 2025-07-13
[2025-07-27T23:47:20.129Z; Worker Number: 1/8; Segment Number: 1; Segment Date: 2025-07-13 00-00-00]: Processing 2025-07-13 1/208 (40/3402)
[2025-07-27T23:47:20.129Z; Worker Number: 2/8; Segment Number: 2; Segment Date: 2025-07-13 00-02-36]: Processing 2025-07-13 2/208 (41/3402)
[2025-07-27T23:47:20.129Z; Worker Number: 3/8; Segment Number: 3; Segment Date: 2025-07-13 00-03-56]: Processing 2025-07-13 3/208 (42/3402)
[2025-07-27T23:47:20.129Z; Worker Number: 4/8; Segment Number: 4; Segment Date: 2025-07-13 00-05-18]: Processing 2025-07-13 4/208 (43/3402)
...
...
...
```

#### Sample output when timeframe is active and mergeDays is enabled:

```
node ./extract,js
Found 3402 recordings
65 of 3402 will be extracted
Processing day 2025-07-12
[2025-07-27T23:49:30.552Z; Worker Number: 1/8; Segment Number: 1; Segment Date: 2025-07-12 21-02-19]: Processing 2025-07-12 1/39 (1/65)
[2025-07-27T23:49:30.553Z; Worker Number: 2/8; Segment Number: 2; Segment Date: 2025-07-12 21-10-51]: Processing 2025-07-12 2/39 (2/65)
[2025-07-27T23:49:30.553Z; Worker Number: 3/8; Segment Number: 3; Segment Date: 2025-07-12 21-35-37]: Processing 2025-07-12 3/39 (3/65)
[2025-07-27T23:49:30.553Z; Worker Number: 4/8; Segment Number: 4; Segment Date: 2025-07-12 21-48-14]: Processing 2025-07-12 4/39 (4/65)
[2025-07-27T23:49:30.553Z; Worker Number: 5/8; Segment Number: 5; Segment Date: 2025-07-12 21-56-31]: Processing 2025-07-12 5/39 (5/65)
[2025-07-27T23:49:30.553Z; Worker Number: 6/8; Segment Number: 6; Segment Date: 2025-07-12 21-57-50]: Processing 2025-07-12 6/39 (6/65)
[2025-07-27T23:49:30.553Z; Worker Number: 7/8; Segment Number: 7; Segment Date: 2025-07-12 22-01-56]: Processing 2025-07-12 7/39 (7/65)
[2025-07-27T23:49:30.553Z; Worker Number: 8/8; Segment Number: 8; Segment Date: 2025-07-12 22-04-09]: Processing 2025-07-12 8/39 (8/65)
[2025-07-27T23:49:30.553Z; Worker Number: 2/8; Segment Number: 2; Segment Date: 2025-07-12 21-10-51]: Running ffmpeg...
[2025-07-27T23:49:30.553Z; Worker Number: 5/8; Segment Number: 5; Segment Date: 2025-07-12 21-56-31]: Running ffmpeg...
[2025-07-27T23:49:30.553Z; Worker Number: 7/8; Segment Number: 7; Segment Date: 2025-07-12 22-01-56]: Running ffmpeg...
[2025-07-27T23:49:30.553Z; Worker Number: 6/8; Segment Number: 6; Segment Date: 2025-07-12 21-57-50]: Running ffmpeg...
...
...
...
[2025-07-27T23:49:31.996Z; Worker Number: 6/8; Segment Number: 36; Segment Date: 2025-07-12 23-54-12]: Running ffmpeg...
[2025-07-27T23:49:32.054Z; Worker Number: 3/8; Segment Number: 37; Segment Date: 2025-07-12 23-56-32]: Processing 2025-07-12 37/39 (37/65)
[2025-07-27T23:49:32.054Z; Worker Number: 3/8; Segment Number: 37; Segment Date: 2025-07-12 23-56-32]: Running ffmpeg...
[2025-07-27T23:49:32.111Z; Worker Number: 2/8; Segment Number: 38; Segment Date: 2025-07-12 23-57-17]: Processing 2025-07-12 38/39 (38/65)
[2025-07-27T23:49:32.115Z; Worker Number: 5/8; Segment Number: 39; Segment Date: 2025-07-12 23-58-48]: Processing 2025-07-12 39/39 (39/65)
[2025-07-27T23:49:32.111Z; Worker Number: 2/8; Segment Number: 38; Segment Date: 2025-07-12 23-57-17]: Running ffmpeg...
[2025-07-27T23:49:32.115Z; Worker Number: 5/8; Segment Number: 39; Segment Date: 2025-07-12 23-58-48]: Running ffmpeg...
Finished processing day 2025-07-12
Merging day 2025-07-12...
ffmpeg version 7.1.1 Copyright (c) 2000-2025 the FFmpeg developers
  built with Apple clang version 16.0.0 (clang-1600.0.26.6)
...
...
...
Input #0, concat, from 'ffmpegConcatList.txt':
  Duration: N/A, start: 0.000000, bitrate: 1903 kb/s
  Stream #0:0: Video: hevc (Main) (hvc1 / 0x31637668), yuvj420p(pc, bt709), 2560x1440, 1871 kb/s, 23.39 fps, 25 tbr, 90k tbn
      Metadata:
        handler_name    : VideoHandler
        vendor_id       : FFMP
  Stream #0:1: Audio: aac (LC) (mp4a / 0x6134706D), 16000 Hz, mono, fltp, 31 kb/s
      Metadata:
        handler_name    : SoundHandler
        vendor_id       : [0][0][0][0]
Stream mapping:
  Stream #0:0 -> #0:0 (copy)
  Stream #0:1 -> #0:1 (copy)
Output #0, mov, to 'days/2025-07-12 21-02-19 - 2025-07-12 22-10-04.mov':
  Metadata:
    encoder         : Lavf61.7.100
  Stream #0:0: Video: hevc (Main) (hvc1 / 0x31637668), yuvj420p(pc, bt709), 2560x1440, q=2-31, 1871 kb/s, 23.39 fps, 25 tbr, 90k tbn
      Metadata:
        handler_name    : VideoHandler
        vendor_id       : FFMP
  Stream #0:1: Audio: aac (LC) (mp4a / 0x6134706D), 16000 Hz, mono, fltp, 31 kb/s
      Metadata:
        handler_name    : SoundHandler
        vendor_id       : [0][0][0][0]
Press [q] to stop, [?] for help
[out#0/mov @ 0x14570d460] video:537433KiB audio:8935KiB subtitle:0KiB other streams:0KiB global headers:0KiB muxing overhead: 0.231826%
frame=59817 fps=0.0 q=-1.0 Lsize=  547635KiB time=00:40:13.20 bitrate=1859.0kbits/s speed=4.93e+03x
ffmpeg version 7.1.1 Copyright (c) 2000-2025 the FFmpeg developers
...
...
...
Processing day 2025-07-13
[2025-07-27T23:49:34.269Z; Worker Number: 1/8; Segment Number: 1; Segment Date: 2025-07-13 00-00-00]: Processing 2025-07-13 1/26 (40/65)
[2025-07-27T23:49:34.269Z; Worker Number: 2/8; Segment Number: 2; Segment Date: 2025-07-13 00-02-36]: Processing 2025-07-13 2/26 (41/65)
[2025-07-27T23:49:34.269Z; Worker Number: 3/8; Segment Number: 3; Segment Date: 2025-07-13 00-03-56]: Processing 2025-07-13 3/26 (42/65)
...
...
...
[2025-07-27T23:49:34.692Z; Worker Number: 2/8; Segment Number: 24; Segment Date: 2025-07-13 00-54-54]: Running ffmpeg...
[2025-07-27T23:49:34.703Z; Worker Number: 1/8; Segment Number: 25; Segment Date: 2025-07-13 00-55-13]: Processing 2025-07-13 25/26 (64/65)
[2025-07-27T23:49:34.717Z; Worker Number: 8/8; Segment Number: 26; Segment Date: 2025-07-13 00-58-43]: Processing 2025-07-13 26/26 (65/65)
[2025-07-27T23:49:34.703Z; Worker Number: 1/8; Segment Number: 25; Segment Date: 2025-07-13 00-55-13]: Running ffmpeg...
[2025-07-27T23:49:34.717Z; Worker Number: 8/8; Segment Number: 26; Segment Date: 2025-07-13 00-58-43]: Running ffmpeg...
Finished processing day 2025-07-13
Merging day 2025-07-13...
ffmpeg version 7.1.1 Copyright (c) 2000-2025 the FFmpeg developers
```

### Credits

Based on Vasilis Koulis's Python code available at https://github.com/bkbilly/libHikvision,

that is based on Dave Hope's PHP code available at https://github.com/davehope/libHikvision,

that is based on Alexey Ozerov's C++ code available at https://github.com/aloz77/hiktools,
