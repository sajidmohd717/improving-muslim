import { Config } from '@remotion/cli/config';

// Lossless frame capture (default is JPEG q80, which softens text)
Config.setVideoImageFormat('png');
// Tighter H.264 quality; lower = better (default 18)
Config.setCrf(15);
