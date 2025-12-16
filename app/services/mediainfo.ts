import type { MediaInfo } from 'mediainfo.js';

type MediaInfoFactory = (opts: {
  format: 'text' | 'json' | 'object' | 'XML' | 'MAXML' | 'HTML' | string;
  coverData: boolean;
  full: boolean;
  locateFile?: (path: string, prefix: string) => string;
}) => Promise<MediaInfo>;

// We assume metadata is usually found within the first 5MB of read operations.
// This is used ONLY for the progress bar calculation, not for limiting the read.
const ESTIMATED_METADATA_WORKLOAD = 2 * 1024 * 1024; // 2MB "Target" for 100%

// Minimum chunk size to fetch from network to speed up processing
// Even if MediaInfo asks for 10 bytes, we fetch this much to avoid latency overhead.
const MIN_FETCH_SIZE = 256 * 1024; // 256KB

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
    coverData: false,
    full: true,
    locateFile: (path: string) => `/${path}`,
  });

  // Trackers
  let totalBytesDownloaded = 0;

  try {
    // --- 3. IO Handlers ---

    // A. Get Size (Using GET 0-0 trick to avoid 405 errors)
    const getSize = async (): Promise<number> => {
      onStatus('Connecting...');
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });

      if (!response.ok) throw new Error(`Connection failed: ${response.status}`);

      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) return parseInt(match[1], 10);
      }
      
      const contentLength = response.headers.get('Content-Length');
      if (contentLength) return parseInt(contentLength, 10);

      // If unknown, return a safe large number, MediaInfo handles it
      return 1024 * 1024 * 1024 * 10; 
    };

    // B. Smart Chunk Reader
    const readChunk = async (size: number, offset: number): Promise<Uint8Array> => {
      // 1. Calculate "Relative Percentage" for UI
      totalBytesDownloaded += size;
      
      // Calculate 0-100% based on our "Estimated Workload" (2MB)
      // If it goes over 100%, we cap it at 99% or show a spinner text.
      let percent = Math.min(99, (totalBytesDownloaded / ESTIMATED_METADATA_WORKLOAD) * 100);
      let percentStr = percent.toFixed(0);
      
      onStatus(`Analyzing... ${percentStr}%`);

      // 2. Optimization: Fetch larger chunks than requested
      // If MediaInfo asks for 100 bytes, fetching 100 bytes is slow due to network latency.
      // We fetch at least MIN_FETCH_SIZE (256KB) unless we are near the end.
      const fetchSize = Math.max(size, MIN_FETCH_SIZE);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Range: `bytes=${offset}-${offset + fetchSize - 1}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Read error: ${response.statusText}`);
      }
      
      // Check for full file download (server ignored Range)
      if (response.status === 200 && offset > 0) {
        throw new Error('Server returned full file (200) instead of partial (206). Aborting.');
      }

      const buffer = await response.arrayBuffer();
      
      // If we fetched more than needed (optimization), we need to slice it back
      // to exactly what MediaInfo asked for.
      const data = new Uint8Array(buffer);
      
      if (data.length > size) {
         return data.subarray(0, size);
      }
      return data;
    };

    // --- 4. Run ---
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
    onStatus('Error occurred');
    mediainfo.close();
    throw error;
  }
}
