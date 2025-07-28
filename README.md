# Hikvision SDCard Video Extractor (Node.js)

This Node.js utility extracts playable video files from Hikvision/EZVIZ SD cards directly, without the need for re-encoding or external npm dependencies.

- ✅ **No npm dependencies**
- ✅ **No re-encoding**
- ✅ **Plays in QuickTime**
- ✅ **Fast extraction**
- ✅ **Optional: Merges recordings per day**

---

## ✅ Requirements

- [Node.js](https://nodejs.org) **v20 or later**
- [FFmpeg](https://ffmpeg.org)

Tested with:

- **Hikvision DS-2CD2443G2-IW-W** (v5.3.8 build 241123)
- **Hikvision DS-2CD2443G0-IW** (v5.6.5 build 200316)

---

## 📂 SD Card File Structure

After formatting the SD card, the camera creates `hivXXXXX.mp4` files, each exactly **256MB**, and records video using a **round-robin** method.

Example structure:

```
hiv00000.mp4
hiv00000.pic
hiv00001.mp4
hiv00001.pic
...
hiv00008.mp4
hiv00008.pic
hiv00009.mp4
hiv00010.mp4
hiv00011.mp4
hiv00012.mp4
...
hiv00465.mp4
index00.bin
index00p.bin
index01.bin
index01p.bin
logCurFile.bin
logMainFile.bin
```

Each `.mp4` contains multiple **MPEG-PS containers** with **HEVC (h.265)** video and **AAC** audio. Metadata (segment time, file location, offsets) is stored in `index00.bin` and `index01.bin` (same info in both files). (`index00p.bin` has Metadata about images.)

See `examples/` for sample index files.

---

## ⚙️ What This Tool Does

1. Parses `index00.bin` (v2 & v3 supported).
2. Retrieves all recording segments.
   - Optionally filter by timeframe.
3. Extracts segments into playable files.
4. Converts containers to `.mov`.
5. Changes HEVC codec ID from `hev1` ➝ `hvc1` for QuickTime support.
6. **No re-encoding**:
   - Fast processing
   - Original video quality
   - Minimal file size
7. (Optional) Merges recordings per day.
   - (Optional) Splits daily merges by max file size.

---

## 📄 `listRecordings.js`

### 🔧 Setup

Edit the script and set your folder:

```js
const folder = "/Users/User/Desktop/sdcard";
```

### ▶️ Run

```bash
node listRecordings.js
```

### 📤 Output

```
"index" "source file": "start date" - "end date" ("source start offset" - "source end offset")
```

Example:

```
node ./listRecordings.js
Found 3402 recordings
[
  "0 hiv00000.mp4: 2025-07-12 21-02-19 - 2025-07-12 21-07-35 (000000000 - 076213180)",
  "1 hiv00000.mp4: 2025-07-12 21-10-51 - 2025-07-12 21-11-37 (076213248 - 084651320)",
  "2 hiv00000.mp4: 2025-07-12 21-35-37 - 2025-07-12 21-48-14 (084651520 - 264787587)",
  "3 hiv00001.mp4: 2025-07-12 21-48-14 - 2025-07-12 21-56-27 (000000000 - 116477676)",
  "4 hiv00001.mp4: 2025-07-12 21-56-31 - 2025-07-12 21-57-50 (116477952 - 134733060)",
...
```

---

## 📄 `extract.js`

### 🔧 Setup

Edit the following lines as needed:

- Source folder:

  ```js
  const folder = "/Users/User/Desktop/sdcard";
  ```

- Output folder (optional):

  To extract into default folder `./extracted`, keep `undefined`.

  ```js
  const targetFolder = "/path/to/output";
  ```

- Timeframe filter (optional):

  To extract all recordings, keep `undefined`.

  ```js
  const from = "2025-07-01 00-00-00";
  const to = "2025-07-31 23-59-59";
  ```

- Merge daily recordings (optional):

  Recordings will be in the `./days` folder

  ```js
  const mergeDays = true;
  ```

  - Split daily merges by max file size (optional):

    To skip splitting, keep `undefined`.

    A single contiguous recording might be up to 256 megabytes, so if smaller size is entered, file still might be up to 256 megabytes.

    ```js
    const mergeDaysFileSizeLimitInBytes = 550 * 1024 * 1024; // 550 megabytes
    ```

### ▶️ Run

```bash
node extract.js
```

Extracted files will be saved in `targetFolder`, or in `./extracted` by default.

### 🎥 Output Filename Format

```bash
2025-07-12 22-10-04 - 2025-07-12 22-16-40 (00002-003).mov
```

Format: `"start date" - "end date" ("source file" - "recording index")`

---

### Sample output:

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

### Sample output when timeframe is active and mergeDays is enabled:

```
node ./extract.js
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
...
...
...
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

---

## 🙌 Credits

This project is based on:

- [Vasilis Koulis's Python code](https://github.com/bkbilly/libHikvision)
  - [Dave Hope's PHP code](https://github.com/davehope/libHikvision)
    - [Alexey Ozerov's C++ code](https://github.com/aloz77/hiktools)
