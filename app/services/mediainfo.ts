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
  // --- 1. Setup ---
  onStatus('Validating URL...');
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const PROXY_ENDPOINT = '/resources/proxy';
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;

  // --- 2. Load Engine ---
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

  // --- 3. The "Fast" Logic (Cache + Prefetch) ---
  // We keep the logic from 'working.ts' that made it fast.
  let fileSize = 0;
  let cache: { start: number; data: Uint8Array } | null = null;
  const PREFETCH_SIZE = 2 * 1024 * 1024; // 2MB Chunk Size
  let totalBytesDownloaded = 0;

  try {
    // A. Robust Size Detection (Fixes 405 Error)
    const getSize = async (): Promise<number> => {
      onStatus('Connecting...');

      // Attempt 1: HEAD (Fastest)
      try {
        const response = await fetch(proxyUrl, { method: 'HEAD' });
        if (response.ok) {
          const len = response.headers.get('Content-Length');
          if (len) {
             fileSize = parseInt(len, 10);
             return fileSize;
          }
        }
      } catch (e) {
        // Ignore HEAD failure, proceed to fallback
      }

      // Attempt 2: GET Range 0-0 (Fallback for 405 errors)
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      // Check Content-Range first
      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          fileSize = parseInt(match[1], 10);
          return fileSize;
        }
      }

      // Check Content-Length (fallback)
      const contentLength = response.headers.get('Content-Length');
      if (contentLength && response.status === 200) {
         fileSize = parseInt(contentLength, 10);
         return fileSize;
      }

      throw new Error('Could not determine file size.');
    };

    // B. Fast Chunk Reader (With Prefetching)
    const readChunk: ReadChunkFunc = async (size: number, offset: number): Promise<Uint8Array> => {
      // 1. Check Cache
      if (
        cache &&
        offset >= cache.start &&
        offset + size <= cache.start + cache.data.byteLength
      ) {
        const startIdx = offset - cache.start;
        return cache.data.subarray(startIdx, startIdx + size);
      }

      // 2. Calculate Prefetch
      // We read a bigger chunk (2MB) than asked to reduce network requests
      let fetchSize = Math.max(size, PREFETCH_SIZE);
      
      // Don't read past end of file
      if (fileSize > 0 && offset + fetchSize > fileSize) {
        fetchSize = fileSize - offset;
      }
      // Safety: ensure we at least read what is asked
      if (fetchSize < size) fetchSize = size;

      // 3. Update UI
      // We track actual network usage (overhead), not just what MediaInfo asked for
      totalBytesDownloaded += fetchSize;
      const mbRead = (totalBytesDownloaded / 1024 / 1024).toFixed(2);
      onStatus(`Analyzing... (${mbRead} MB downloaded)`);

      // 4. Fetch
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Range: `bytes=${offset}-${offset + fetchSize - 1}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Read error: ${response.status} ${response.statusText}`);
      }
      
      if (response.status === 200 && offset > 0) {
         // Critical check: If server sends full file, stop immediately
         throw new Error('Server does not support partial requests (200 OK). Aborting.');
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // 5. Update Cache
      cache = {
        start: offset,
        data: data,
      };

      // Return only the requested slice
      return data.subarray(0, size);
    };

    // --- 4. Run ---
    const size = await getSize();
    const result = await mediainfo.analyzeData(() => size, readChunk);

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
