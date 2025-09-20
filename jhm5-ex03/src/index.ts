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

interface Todo {
	id: string;
	text: string;
	completed: boolean;
	priority: string;
	category: string;
	dueDate: string | null;
	createdAt: string;
	tags: string[];
	completedAt?: string | null;
}

interface BulkUpdateRequest {
	ids: string[];
	updates: Partial<Todo>;
}

interface BulkDeleteRequest {
	ids: string[];
}

const worker = {
	async fetch(request: Request, env: any): Promise<Response> {
		const url = new URL(request.url);
		const { pathname, searchParams } = url;

		// Handle API endpoints for KV operations
		if (pathname.startsWith('/api/todos')) {
			return handleTodoAPI(request, env, pathname, searchParams);
		}

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

		// If no asset found or error occurred, serve todo.html for SPA routing
		try {
			const indexRequest = new Request(new URL('/todo.html', request.url), {
				method: 'GET',
			});
			const indexResponse = await env.ASSETS.fetch(indexRequest);

			if (indexResponse.ok) {
				// Return todo.html with proper headers for SPA
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
			console.error('Error fetching todo.html:', error);
		}

		// Fallback response if everything fails
		return new Response('Asset not found', { status: 404 });
	},
};

async function handleTodoAPI(request: Request, env: any, pathname: string, _searchParams: URLSearchParams): Promise<Response> {
	const method = request.method;
	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	// Handle CORS preflight
	if (method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		switch (pathname) {
			case '/api/todos': {
				if (method === 'GET') {
					return getAllTodos(env, corsHeaders);
				} else if (method === 'POST') {
					return createTodo(request, env, corsHeaders);
				}
				break;
			}

			case '/api/todos/bulk': {
				if (method === 'PUT') {
					return bulkUpdateTodos(request, env, corsHeaders);
				} else if (method === 'DELETE') {
					return bulkDeleteTodos(request, env, corsHeaders);
				}
				break;
			}

			default: {
				// Handle individual todo operations like /api/todos/123
				const todoId = pathname.split('/').pop();
				if (todoId && method === 'PUT') {
					return updateTodo(request, env, todoId, corsHeaders);
				} else if (todoId && method === 'DELETE') {
					return deleteTodo(env, todoId, corsHeaders);
				}
				break;
			}
		}

		return new Response('Not Found', { status: 404, headers: corsHeaders });
	} catch (error) {
		console.error('API Error:', error);
		return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
	}
}

async function getAllTodos(env: any, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		const todosData = await env.TODO_KV.get('todos');
		const todos = todosData ? JSON.parse(todosData) : [];
		return new Response(JSON.stringify(todos), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error getting todos:', error);
		return new Response('[]', {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

async function createTodo(request: Request, env: any, corsHeaders: Record<string, string>): Promise<Response> {
	const todo = await request.json() as Todo;
	const todosData = await env.TODO_KV.get('todos');
	const todos = todosData ? JSON.parse(todosData) : [];

	// Add timestamp and ID if not present
	if (!todo.id) {
		todo.id = Date.now().toString();
	}
	if (!todo.createdAt) {
		todo.createdAt = new Date().toISOString();
	}

	todos.push(todo);
	await env.TODO_KV.put('todos', JSON.stringify(todos));

	return new Response(JSON.stringify(todo), {
		status: 201,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

async function updateTodo(request: Request, env: any, todoId: string, corsHeaders: Record<string, string>): Promise<Response> {
	const updatedTodo = await request.json() as Partial<Todo>;
	const todosData = await env.TODO_KV.get('todos');
	const todos = todosData ? JSON.parse(todosData) : [];

	const index = todos.findIndex((todo: Todo) => todo.id === todoId);
	if (index === -1) {
		return new Response('Todo not found', { status: 404, headers: corsHeaders });
	}

	todos[index] = { ...todos[index], ...updatedTodo };
	await env.TODO_KV.put('todos', JSON.stringify(todos));

	return new Response(JSON.stringify(todos[index]), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

async function deleteTodo(env: any, todoId: string, corsHeaders: Record<string, string>): Promise<Response> {
	const todosData = await env.TODO_KV.get('todos');
	const todos = todosData ? JSON.parse(todosData) : [];

	const filteredTodos = todos.filter((todo: Todo) => todo.id !== todoId);
	await env.TODO_KV.put('todos', JSON.stringify(todos));

	return new Response('Todo deleted', {
		headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
	});
}

async function bulkUpdateTodos(request: Request, env: any, corsHeaders: Record<string, string>): Promise<Response> {
	const { ids, updates } = await request.json() as BulkUpdateRequest;
	const todosData = await env.TODO_KV.get('todos');
	const todos = todosData ? JSON.parse(todosData) : [];

	todos.forEach((todo: Todo) => {
		if (ids.includes(todo.id)) {
			Object.assign(todo, updates);
		}
	});

	await env.TODO_KV.put('todos', JSON.stringify(todos));

	return new Response('Todos updated', {
		headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
	});
}

async function bulkDeleteTodos(request: Request, env: any, corsHeaders: Record<string, string>): Promise<Response> {
	const { ids } = await request.json() as BulkDeleteRequest;
	const todosData = await env.TODO_KV.get('todos');
	const todos = todosData ? JSON.parse(todosData) : [];

	const filteredTodos = todos.filter((todo: Todo) => !ids.includes(todo.id));
	await env.TODO_KV.put('todos', JSON.stringify(filteredTodos));

	return new Response('Todos deleted', {
		headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
	});
}

export default worker satisfies ExportedHandler<Env>;
