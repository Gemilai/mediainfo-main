import type { MediaInfo } from 'mediainfo.js';

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
  // --- 1. Validation Phase ---
  onStatus('Validating URL...');

  // Basic URL check
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Use our proxy endpoint
  const PROXY_ENDPOINT = '/resources/proxy';
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;

  // --- 2. Load MediaInfo Module ---
  // We dynamic import only when needed
  onStatus('Loading MediaInfo engine...');
  let mediainfoModule: any;
  try {
    // @ts-expect-error - mediainfo.js might not have perfect types
    mediainfoModule = await import('mediainfo.js');
  } catch (e) {
    throw new Error('Failed to load MediaInfo WASM module.');
  }

  const mediaInfoFactory = mediainfoModule.default as MediaInfoFactory;

  const mediainfo = await mediaInfoFactory({
    format,
    coverData: false,
    full: true,
    locateFile: (path: string) => `/${path}`, // points to public/MediaInfoModule.wasm
  });

  try {
    // --- 3. Define IO Handlers ---

    // A smart getSize that avoids HEAD requests (which cause 405 errors)
    const getSize = async (): Promise<number> => {
      onStatus('Checking file size...');

      // Instead of HEAD, we use GET with Range: bytes=0-0.
      // This is safer because many servers block HEAD but allow GET.
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.status} ${response.statusText}`);
      }

      // 1. Try to get size from Content-Range (Standard for Range requests)
      // Format: bytes 0-0/123456 -> we want 123456
      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }

      // 2. Fallback to Content-Length
      const contentLength = response.headers.get('Content-Length');
      if (contentLength && response.status === 200) {
        // If status is 200, it means the server ignored Range and sent the whole file.
        // We can use this size, but reading chunks later will be inefficient (downloading full file every time).
        console.warn('Server ignored Range header (200 OK). Analysis might be slow.');
        return parseInt(contentLength, 10);
      }

      // 3. Last resort fallback
      if (contentLength) {
        return parseInt(contentLength, 10);
      }

      throw new Error('Could not determine file size (Missing Content-Range and Content-Length)');
    };

    const readChunk = async (
      size: number,
      offset: number,
    ): Promise<Uint8Array> => {
      onStatus(`Reading data (${offset}-${offset + size})...`);

      // We fetch a slightly larger chunk to reduce HTTP request overhead
      // But for exactness we request what is needed.
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Range: `bytes=${offset}-${offset + size - 1}`,
        },
      });

      if (!response.ok) {
        // Retry logic could go here
        throw new Error(`Read error: ${response.statusText}`);
      }

      // Safety check: if server returns 200 instead of 206 during a read, 
      // it means it's trying to send the WHOLE file again.
      if (response.status === 200 && offset > 0) {
        throw new Error(
          'Server does not support Range requests (returned 200 OK). Aborting to prevent full download.',
        );
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    };

    // --- 4. Execute Analysis ---
    onStatus('Starting analysis...');
    
    // MediaInfo needs to know the file size first
    const fileSize = await getSize();
    
    // Run the analysis using our custom read functions
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
    console.error('Analysis failed:', error);
    onStatus('Error occurred.');
    mediainfo.close();
    throw error;
  } finally {
    // Cleanup not strictly necessary as we close above on error, 
    // but good practice if we reused the instance.
    // mediainfo.close(); 
  }
}
