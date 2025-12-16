import type { MediaInfo, ReadChunkFunc } from 'mediainfo.js';

type MediaInfoFactory = (opts: {
  format: 'text' | 'json' | 'object' | 'XML' | 'MAXML' | 'HTML' | string;
  coverData: boolean;
  full: boolean;
  locateFile?: (path: string, prefix: string) => string;
}) => Promise<MediaInfo>;

export async function analyzeMedia(
  url: string,
  onResult: (text: string) => void,
  onStatus: (status: string) => void,
  format: string = 'text',
): Promise<string> {
  // --- 1. Basic URL Validation ---
  onStatus('Validating URL...');
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const PROXY_ENDPOINT = '/resources/proxy';
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;

  // --- 2. Load MediaInfo Engine ---
  onStatus('Loading MediaInfo engine...');
  let mediainfoModule: any;
  try {
    // @ts-expect-error - dynamic import
    mediainfoModule = await import('mediainfo.js');
  } catch (e) {
    throw new Error('Failed to load MediaInfo WASM module.');
  }

  const mediaInfoFactory = mediainfoModule.default as MediaInfoFactory;
  const mediainfo = await mediaInfoFactory({
    format,
    coverData: false, // Optimization: don't fetch cover images
    full: true,
    locateFile: (path: string) => `/${path}`,
  });

  // Track data usage for UI
  let totalBytesDownloaded = 0;

  try {
    // --- 3. IO Handlers ---

    // A. Get Exact File Size
    // We strictly need the file size. Guessing causes 416 errors.
    const getSize = async (): Promise<number> => {
      onStatus('Connecting to file...');
      
      // Use GET 0-0 instead of HEAD. This is robust and fixes 405 errors.
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      // Priority 1: Content-Range (Standard for Range requests)
      // Format: bytes 0-0/123456
      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) return parseInt(match[1], 10);
      }

      // Priority 2: Content-Length
      const contentLength = response.headers.get('Content-Length');
      if (contentLength && response.status === 200) {
         return parseInt(contentLength, 10);
      }

      // If we cannot determine size, we MUST fail here.
      throw new Error('Could not determine file size. Server must support Range requests.');
    };

    // B. Direct Chunk Reader (Fastest Method - No Prefetching)
    const readChunk: ReadChunkFunc = async (size: number, offset: number): Promise<Uint8Array> => {
      // Update UI with actual download amount
      totalBytesDownloaded += size;
      const mbRead = (totalBytesDownloaded / 1024 / 1024).toFixed(2);
      onStatus(`Analyzing... (${mbRead} MB read)`);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Range: `bytes=${offset}-${offset + size - 1}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Read error: ${response.status} ${response.statusText}`);
      }

      // If server ignores Range and sends 200 OK (Full File), abort to save bandwidth
      if (response.status === 200 && offset > 0) {
        throw new Error('Server returned full file (200) instead of partial (206). Aborting.');
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    };

    // --- 4. Run Analysis ---
    const fileSize = await getSize();
    
    const result = await mediainfo.analyzeData(() => fileSize, readChunk);

    if (typeof result === 'string') {
      onResult(result);
      onStatus('Analysis complete!');
      return result;
    } else {
      const json = JSON.stringify(result, null, 2);
      onResult(json);
      onStatus('Analysis complete!');
      return json;
    }
  } catch (error) {
    console.error(error);
    onStatus(error instanceof Error ? error.message : 'Error occurred');
    mediainfo.close();
    throw error;
  }
}
