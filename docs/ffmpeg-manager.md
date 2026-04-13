# FFmpegManager

Managing FFmpeg environments across architectures and host environments is notoriously volatile. `FFmpegManager` safely builds localized contexts encapsulating binaries on your system, avoiding system-wide overrides.

### Automatic Downloading & Setup

```typescript
import { FFmpegManager } from 'ffmpeg-lib';

const manager = new FFmpegManager();

// Automatically checks the platform, downloads a mapped verified release tarball/zip,
// unpacks it, calculates checksums, and manages the executable permissions.
await manager.downloadFFmpegBinaries();
```

### Retrieving Binaries

You can get the exact paths directly for injection into tools or your `FFmpegCommand` configs.

```typescript
const ffmpegPath = manager.getFFmpegPath();
const ffprobePath = manager.getFFprobePath();

console.log(ffmpegPath); // e.g., /home/user/workspace/binaries/ffmpeg
```

### Verification and Checks
Before executing intensive tasks, checking existence prevents catastrophic crashes:

```typescript
const isInstalled = await manager.isFFmpegAvailable();

if (!isInstalled) {
    console.log("No installed cache was found");
}

// Ensure execution is possible and map paths natively:
const paths = await manager.verifyBinaries();
```

### Metadata Check Helpers
You can quickly check media properties safely via the manager:
```typescript
const isVideo = await manager.isVideo('file.mkv');
const info = await manager.getBasicInfo('file.mkv');
console.log(`Video duration is ${info.duration}`);
```
