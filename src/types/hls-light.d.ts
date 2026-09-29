// hls.js/light expone la misma API que hls.js (sin subtítulos, audio alternativo ni DRM).
declare module 'hls.js/light' {
  export { default } from 'hls.js';
  export * from 'hls.js';
}
