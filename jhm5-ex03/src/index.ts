/**
 * Welcome to Cloudflare Workers! This worker serves static HTML, CSS, and JS files.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		
		// Try to fetch the asset from the static assets binding
		try {
			const response = await env.ASSETS.fetch(request);
			
			// If we get a successful response from assets, return it
			if (response.status !== 404) {
				return response;
			}
		} catch (error) {
			console.error('Error fetching from ASSETS:', error);
		}
		
		// If no asset found or error occurred, serve index.html for SPA routing
		try {
			const indexRequest = new Request(new URL('/index.html', request.url), {
				method: 'GET',
			});
			const indexResponse = await env.ASSETS.fetch(indexRequest);
			
			if (indexResponse.ok) {
				// Return index.html with proper headers for SPA
				return new Response(indexResponse.body, {
					status: 200,
					headers: {
						'Content-Type': 'text/html',
						'Cache-Control': 'no-cache',
						...Object.fromEntries(indexResponse.headers),
					},
				});
			}
		} catch (error) {
			console.error('Error fetching index.html:', error);
		}
		
		// Fallback response if everything fails
		return new Response('Asset not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
