import type { ZodType } from 'zod';
import { StatusError } from './error.js';
import { parseBody, type BodyValue, type FormValue, type JSONValue, type UnknownBodyValue } from './parser.js';
import { ServerResponse } from './response.js';

export type ServerRequestUrlParams = Record<string, string | undefined>;
export interface ServerRequestUrl {
    path: string;
    params: ServerRequestUrlParams;
    search: URLSearchParams;
    hash: string;
}
export interface ServerRequest<Body extends BodyValue> {
    method: string;
    url: ServerRequestUrl;
    headers: Headers;
    body: Body;
    signal: AbortSignal;
};

export interface ServerRouteOptions<Body extends BodyValue, Schema = Exclude<Body, undefined>> {
    schema?: Body extends UnknownBodyValue ? never : ZodType<Schema>;
    allowCrossOrigin?: boolean;
}

export type ServerRouteHandler<Body extends BodyValue> = (request: ServerRequest<Body>) => ServerResponse | void | Promise<ServerResponse | void>;
export interface ServerRoute<Body extends BodyValue> extends ServerRouteOptions<Body> {
    pattern: URLPattern;
    methods: (string | null)[];
    handler: ServerRouteHandler<Body>;
}

export interface RouterOptions {
    errorHandler?: (error: Error, request: ServerRequest<BodyValue>) => ServerResponse | void | Promise<ServerResponse | void>;
}

export class Router {
    private errorHandler?: RouterOptions['errorHandler'];
    protected routes: ServerRoute<any>[] = [];

    constructor(options: RouterOptions = {}) {
        this.errorHandler = options.errorHandler;
    }

    private async parseBody(headers: Headers, body: UnknownBodyValue, schema: ZodType<JSONValue | FormValue>): Promise<BodyValue> {
        try {
            const parsed = await parseBody(headers, body);
            if (parsed instanceof ReadableStream) return parsed;
            return schema.parse(parsed);
        }
        catch {
            throw new StatusError(400, 'Invalid request body');
        }
    }

    protected async handleRequest(request: ServerRequest<BodyValue>) {
        let matchedRoute: ServerRoute<any> | undefined;
        const availableMethods: string[] = [];
        const crossOriginMethods: string[] = [];

        for (const route of this.routes) {
            if (matchedRoute && route.methods.every(method => method === null || availableMethods.includes(method))) continue;
            const match = route.pattern.exec('/!' + request.url.path, 'http://localhost');
            if (match) {
                if (!matchedRoute && (route.methods.includes(request.method) || route.methods.includes(null))) {
                    matchedRoute = route;
                    request.url.params = match.pathname.groups;
                }
                for (const method of route.methods) {
                    if (method === null || availableMethods.includes(method)) continue;
                    availableMethods.push(method);
                    if (route.allowCrossOrigin) crossOriginMethods.push(method);
                }
            }
        }

        availableMethods.sort();
        crossOriginMethods.sort();
        const allowMethods = availableMethods.join(', ') + ', OPTIONS';

        if (request.method === 'OPTIONS') {
            const headers = new Headers();
            if (availableMethods.length) headers.set('Allow', allowMethods);
            if (crossOriginMethods.length) {
                headers.set('Access-Control-Allow-Origin', '*');
                headers.set('Access-Control-Allow-Methods', crossOriginMethods.join(', '));
                headers.set('Access-Control-Allow-Headers', ['Authorization', 'Content-Type'].join(', '));
            }
            return ServerResponse.empty({
                status: availableMethods.length ? 200 : 404,
                headers
            });
        }

        try {
            if (matchedRoute?.schema) request.body = await this.parseBody(request.headers, request.body as UnknownBodyValue, matchedRoute?.schema);
            if (matchedRoute) {
                const response = await matchedRoute.handler(request);
                if (!response) throw new StatusError(404, 'Not Found', { Allow: allowMethods });
                if (!response.headers.has('Allow')) response.headers.set('Allow', allowMethods);
                if (crossOriginMethods.includes(request.method) && !response.headers.has('Access-Control-Allow-Origin')) {
                    response.headers.set('Access-Control-Allow-Origin', '*');
                }
                return response;
            }
            else {
                throw new StatusError(404, 'Not Found', { Allow: allowMethods });
            }
        }
        catch (error: any) {
            if (this.errorHandler) {
                const response = await this.errorHandler(error, request);
                if (response) return response;
            }
            throw error;
        }
    }

    route<Body extends BodyValue = UnknownBodyValue>(methods: string | string[], path: string, handler?: ServerRouteHandler<Body>, options: ServerRouteOptions<Body> = {}) {
        const pattern = new URLPattern({ pathname: '/!' + path });
        const routeIndex = this.routes.findIndex(route => route.pattern.pathname === pattern.pathname);
        const methodList: (string | null)[] = Array.isArray(methods) ? methods : [methods];
        if (handler) {
            this.routes.push({
                pattern,
                methods: methodList,
                handler,
                ...options
            });
        }
        if (routeIndex >= 0) {
            const route = this.routes[routeIndex];
            route.methods = route.methods.filter(method => !methodList.includes(method));
            if (!route.methods.length) this.routes.splice(routeIndex, 1);
        }
    }

    get<Body extends BodyValue = UnknownBodyValue>(path: string, handler?: ServerRouteHandler<Body>, options?: ServerRouteOptions<Body>) {
        this.route('GET', path, handler, options);
    }
    post<Body extends BodyValue = UnknownBodyValue>(path: string, handler?: ServerRouteHandler<Body>, options?: ServerRouteOptions<Body>) {
        this.route('POST', path, handler, options);
    }
    put<Body extends BodyValue = UnknownBodyValue>(path: string, handler?: ServerRouteHandler<Body>, options?: ServerRouteOptions<Body>) {
        this.route('PUT', path, handler, options);
    }
    delete<Body extends BodyValue = UnknownBodyValue>(path: string, handler?: ServerRouteHandler<Body>, options?: ServerRouteOptions<Body>) {
        this.route('DELETE', path, handler, options);
    }
    patch<Body extends BodyValue = UnknownBodyValue>(path: string, handler?: ServerRouteHandler<Body>, options?: ServerRouteOptions<Body>) {
        this.route('PATCH', path, handler, options);
    }

    all<Body extends BodyValue = UnknownBodyValue>(path: string, handler?: ServerRouteHandler<Body>, options: ServerRouteOptions<Body> = {}) {
        const pattern = new URLPattern({ pathname: '/!' + path });
        const routeIndex = this.routes.findIndex(route => route.pattern.pathname === pattern.pathname);
        if (handler) {
            this.routes.push({
                pattern,
                methods: [null],
                handler,
                ...options
            });
        }
        if (routeIndex >= 0) {
            const route = this.routes[routeIndex];
            route.methods = route.methods.filter(method => method !== null);
            if (!route.methods.length) this.routes.splice(routeIndex, 1);
        }
    }

    use(path: string, router: Router) {
        const pattern = new URLPattern({ pathname: `/!${path}${path.endsWith('/') ? '' : '/'}*` });
        const routeIndex = this.routes.findIndex(route => route.pattern.pathname === pattern.pathname);
        if (router) {
            this.routes.push({
                pattern,
                methods: [null],
                handler(request: ServerRequest<UnknownBodyValue>) {
                    request.url.path = '/' + request.url.params[0]!;
                    return router.handleRequest(request);
                }
            });
        }
        if (routeIndex >= 0) {
            const route = this.routes[routeIndex];
            route.methods = route.methods.filter(method => method !== null);
            if (!route.methods.length) this.routes.splice(routeIndex, 1);
        }
    }
}