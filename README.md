# HTTP Server

A modern, lightweight, and type-safe HTTP server framework for Node.js, built with TypeScript. It provides a clean API for routing, request handling, and response generation, with built-in support for body parsing, validation, and Server-Sent Events (SSE).

## Features

*   **Intuitive Routing**: Easy-to-use API for defining routes (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`).
*   **Type-Safe Request Handling**: Built-in TypeScript support for request bodies and parameters.
*   **Automatic Body Parsing**: Seamlessly parses JSON and Form data (`multipart/form-data`, `application/x-www-form-urlencoded`).
*   **Schema Validation**: Integrated support for [Zod](https://zod.dev) schemas to validate request bodies.
*   **Rich Response Helpers**: Utility methods for sending JSON, text, files, streams, and Server-Sent Events (SSE).
*   **CORS Support**: Built-in configuration for Cross-Origin Resource Sharing.
*   **Sub-Routers**: Composable architecture using `server.use()` to mount routers on specific paths.
*   **Standard Web APIs**: Built on top of standard Web APIs like `URLPattern`, `ReadableStream`, and `Headers`.

## Installation

To install package:

```bash
npm install github:zuenkoma/http-server
```

## Usage

### Basic Server

```typescript
import { Server, ServerResponse } from 'http-server';

const server = new Server();

server.get('/', () => {
    return ServerResponse.text('Hello World!');
});

server.get('/json', () => {
    return ServerResponse.json({ message: 'This is JSON' });
});

server.listen(3000).then(() => {
    console.log('Server running on http://localhost:3000');
});
```

### Request Object

The `req` object passed to handlers provides type-safe access to the request details. It is based on standard Web APIs.

*   `req.method`: The HTTP method (e.g., `GET`, `POST`).
*   `req.url.path`: The path of the URL (e.g., `/users`).
*   `req.url.params`: Route parameters (e.g., `{ id: '123' }`).
*   `req.url.search`: `URLSearchParams` object for query strings.
*   `req.headers`: Standard `Headers` object.
*   `req.body`: The parsed request body.

```typescript
server.get('/users/:id', (req) => {
    const id = req.url.params.id;
    const type = req.url.search.get('type');
    return ServerResponse.json({ id, type });
});
```

### Routing & Body Parsing

The server automatically parses request bodies based on the `Content-Type` header. You can also validate the body using Zod schemas.

```typescript
import { z } from 'zod';
import { Server, ServerResponse } from 'http-server';

const server = new Server();

// Define a schema for validation
const UserSchema = z.object({
    name: z.string(),
    age: z.number()
});

server.post('/users', async (req) => {
    // req.body is automatically parsed and typed if a schema is provided
    const user = req.body;
    return ServerResponse.json({ created: user }, { status: 201 });
}, { schema: UserSchema });

server.listen(3000);
```

The server supports the following content types for automatic parsing:
*   `application/json`: Parsed into a JSON object.
*   `application/x-www-form-urlencoded`: Parsed into a key-value object.
*   `multipart/form-data`: Parsed into a key-value object (supports file uploads).
*   Other types: Available as a `ReadableStream` in `req.body`.

### Sub-Routers

Create modular applications by mounting routers on specific paths using `server.use()`.

```typescript
import { Server, Router, ServerResponse } from 'http-server';

const server = new Server();
const api = new Router();

api.get('/status', () => ServerResponse.json({ status: 'ok' }));

// Mount the router at /api
server.use('/api', api); // Handles /api/status

server.listen(3000);
```

### Advanced Routing

Handle multiple methods or all methods for a specific path:

```typescript
// Handle multiple methods
server.route(['GET', 'POST'], '/items', (req) => {
    if (req.method === 'POST') {
        // Handle creation
    }
    // Handle listing
});

// Handle any method
server.all('/log', (req) => {
    console.log(`${req.method} ${req.url.path}`);
    return ServerResponse.empty();
});
```

### Response Helpers

`ServerResponse` provides static methods for creating various types of responses:

*   `ServerResponse.text(string)`: Send plain text.
*   `ServerResponse.json(data)`: Send a JSON response.
*   `ServerResponse.file(path)`: Stream a file with automatic MIME type detection.
*   `ServerResponse.redirect(url)`: Redirect to another URL.
*   `ServerResponse.empty()`: Send an empty response (e.g., 204).
*   `ServerResponse.bytes(buffer)`: Send raw bytes.
*   `ServerResponse.blob(blob)`: Send a Blob object.
*   `ServerResponse.eventsJSON(stream)`: Send Server-Sent Events (SSE) from a stream of objects.
*   `ServerResponse.eventsText(stream)`: Send Server-Sent Events (SSE) from a stream of strings.

```typescript
server.get('/file', () => {
    return ServerResponse.file('./test/static/test.txt');
});

server.get('/redirect', () => {
    return ServerResponse.redirect('/new-location');
});
```

### Server-Sent Events (SSE)

```typescript
import { Server, ServerResponse } from 'http-server';

const server = new Server();

server.get('/events', () => {
    const stream = new ReadableStream({
        start(controller) {
            setInterval(() => {
                controller.enqueue({ data: 'ping' });
            }, 1000);
        }
    });

    return ServerResponse.eventsJSON(stream);
});
```

### CORS

Enable CORS for specific routes:

```typescript
server.get('/api/data', () => {
    return ServerResponse.json({ data: 'secure' });
}, { allowCrossOrigin: true });
```

### Error Handling

Throw `StatusError` to return specific HTTP status codes and messages.

```typescript
import { Server, StatusError } from 'http-server';

const server = new Server();

server.get('/protected', (req) => {
    const authorized = false;
    if (!authorized) {
        throw new StatusError(401, 'Unauthorized');
    }
});
```

You can also provide a custom error handler when creating the server or router:

```typescript
const server = new Server({
    errorHandler: (error, req) => {
        console.error(`Error processing ${req.url.path}:`, error);
        return ServerResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
});
```

### Server Lifecycle

Methods to manage the server instance:

```typescript
// Start the server
await server.listen(3000);

// Get the bound port (useful if listening on port 0)
const port = server.getPort();

// Stop the server
await server.close();
```