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
  // --- 1. Validation ---
  onStatus('Validating URL...');
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const PROXY_ENDPOINT = '/resources/proxy';
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;

  // --- 2. Load Module ---
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
    coverData: false, // Optimization: skip cover art
    full: true,
    locateFile: (path: string) => `/${path}`,
  });

  // Track total bytes for UI
  let totalBytesDownloaded = 0;

  try {
    // --- 3. IO Handlers ---

    // A. Robust Size Detection
    // This logic mirrors your original code (HEAD first) but fixes the 405 error
    // by falling back to GET if HEAD fails.
    const getSize = async (): Promise<number> => {
      onStatus('Connecting to file...');

      try {
        // Method 1: Try HEAD (Fastest, works for most servers)
        const response = await fetch(proxyUrl, { method: 'HEAD' });

        if (response.ok) {
          const contentLength = response.headers.get('Content-Length');
          if (contentLength) return parseInt(contentLength, 10);
        }
      } catch (e) {
        // Ignore HEAD error and try fallback
      }

      // Method 2: Fallback to GET 0-0 (Fixes 405 Method Not Allowed)
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) return parseInt(match[1], 10);
      }
      
      const contentLength = response.headers.get('Content-Length');
      if (contentLength && response.status === 200) {
         return parseInt(contentLength, 10);
      }

      throw new Error('Could not determine exact file size. Server must support Range requests.');
    };

    // B. Direct Chunk Reader (No Prefetching)
    // Removed cache/prefetch logic to fix the 10-second delay.
    // It now reads exactly what MediaInfo asks for.
    const readChunk: ReadChunkFunc = async (size: number, offset: number): Promise<Uint8Array> => {
      // Simple UI Counter
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
        // This is where the 416 error usually happens if size was wrong
        throw new Error(`Read error: ${response.status} ${response.statusText}`);
      }

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
