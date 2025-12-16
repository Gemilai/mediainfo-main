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

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, User-Agent',
        // We explicitly do NOT expose Content-Disposition to prevent download managers from triggering
        'Access-Control-Expose-Headers':
          'Content-Length, Content-Range, Content-Type, Accept-Ranges',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders,
        });
      }

      if (!targetUrl) {
        return new Response("Missing 'url' query parameter", {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        const upstreamUrl = new URL(targetUrl);
        const headers = new Headers(request.headers);
        
        // Clean up headers to prevent host mismatches
        headers.set('Host', upstreamUrl.hostname);
        headers.set('Referer', upstreamUrl.origin);
        headers.delete('Origin'); 
        headers.delete('Cookie'); // Privacy: don't pass cookies

        const upstreamResponse = await fetch(targetUrl, {
          method: request.method,
          headers: headers,
          redirect: 'follow',
        });

        const responseHeaders = new Headers();
        
        // Allowed headers to pass through
        const allowedHeaders = [
          'content-length',
          'content-range',
          'content-type',
          'accept-ranges',
          'last-modified',
          'etag'
        ];

        for (const [key, value] of upstreamResponse.headers.entries()) {
          if (allowedHeaders.includes(key.toLowerCase())) {
            responseHeaders.set(key, value);
          }
        }

        // FORCE overrides to stop IDM/Download Managers
        // 1. Remove Content-Disposition (this is what triggers "Save As")
        responseHeaders.delete('content-disposition');
        
        // 2. Ensure CORS headers are present
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        return new Response(
          `Proxy error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          {
            status: 502,
            headers: corsHeaders,
          },
        );
      }
    }

    // Default Remix handler
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
