Vendored from `@ffmpeg/ffmpeg@0.12.15` (`dist/esm`), MIT licence, https://github.com/ffmpegwasm/ffmpeg.wasm

Only the small wrapper lives here, so its web worker is same-origin. The 32 MB `@ffmpeg/core`
(ffmpeg compiled to WebAssembly, with libtheora + libvorbis) is downloaded from a CDN the first
time someone converts a video, see `web/convert.js`.
