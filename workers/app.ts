import { createRequestHandler } from 'react-router';

declare module 'react-router' {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Proxy logic
    if (
      url.pathname === '/resources/proxy' ||
      url.pathname.startsWith('/resources/proxy')
    ) {
      const targetUrl = url.searchParams.get('url');

      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, User-Agent',
        'Access-Control-Expose-Headers':
          'Content-Length, Content-Range, Content-Type, Accept-Ranges',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      if (!targetUrl) {
        return new Response("Missing 'url'", { status: 400, headers: corsHeaders });
      }

      try {
        const upstreamUrl = new URL(targetUrl);
        const headers = new Headers(request.headers);
        
        headers.set('Host', upstreamUrl.hostname);
        headers.set('Referer', upstreamUrl.origin);
        headers.delete('Origin'); 
        headers.delete('Cookie');

        const upstreamResponse = await fetch(targetUrl, {
          method: request.method,
          headers: headers,
          redirect: 'follow',
        });

        const responseHeaders = new Headers();
        
        // Copy safe headers
        const skipHeaders = [
          'content-encoding', 'content-length', 'transfer-encoding', 
          'connection', 'keep-alive', 'content-disposition', 'content-type'
        ];

        for (const [key, value] of upstreamResponse.headers.entries()) {
          if (!skipHeaders.includes(key.toLowerCase())) {
            responseHeaders.set(key, value);
          }
        }

        // --- ANTI-DOWNLOAD MEASURES ---
        // 1. Force generic binary type (hides "video/mp4" from IDM)
        responseHeaders.set('content-type', 'application/octet-stream');
        // 2. Remove attachment disposition
        responseHeaders.delete('content-disposition');

        // Restore critical sizing headers
        if (upstreamResponse.headers.has('Content-Length')) {
          responseHeaders.set('Content-Length', upstreamResponse.headers.get('Content-Length')!);
        }
        if (upstreamResponse.headers.has('Content-Range')) {
          responseHeaders.set('Content-Range', upstreamResponse.headers.get('Content-Range')!);
        }

        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        return new Response(`Proxy error: ${error instanceof Error ? error.message : 'Unknown'}`, {
          status: 502,
          headers: corsHeaders,
        });
      }
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
