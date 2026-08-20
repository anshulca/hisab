/**
 * Minimal qrcode stub for Node test bundles. Produces a tiny valid PNG data URL
 * so jsPDF.addImage works and the seal pipeline can be exercised end-to-end.
 */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export default {
  toDataURL: async () => TINY_PNG,
  toCanvas: async () => TINY_PNG
};
