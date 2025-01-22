#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
	readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);
const { name, version } = pkg;

// SerpAPI configuration
const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';
const SERPAPI_KEY = process.env.SERPAPI_API_KEY || '';

if (!SERPAPI_KEY) {
	throw new Error('SERPAPI_API_KEY environment variable is required');
}

// Assert SERPAPI_KEY is string since we check for existence
const API_KEY: string = SERPAPI_KEY;

import { SerpApiResponse, CacheEntry, FormattedResponse } from './types.js';
import { ServerResult } from '@modelcontextprotocol/sdk/types.js';

// Import cache singleton
import { search_cache } from './cache.js';

// Import response formatter
import { format_response } from './formatters.js';

// Import configuration
import { SAFE_SEARCH_LEVELS } from './config.js';

class DuckDuckGoServer {
	private server: Server;

	constructor() {
		this.server = new Server(
			{ name, version },
			{
				capabilities: {
					tools: {},
				},
			},
		);

		this.setup_tool_handlers();
	}

	private setup_tool_handlers() {
		this.server.setRequestHandler(
			ListToolsRequestSchema,
			async () => ({
				tools: [
					{
						name: 'ddg_search',
						description: 'Search the web using DuckDuckGo API',
						inputSchema: {
							type: 'object',
							properties: {
								query: {
									type: 'string',
									description: 'Search query',
								},
								region: {
									type: 'string',
									description: 'Region code (e.g., us-en, uk-en)',
									default: 'us-en',
								},
								safe_search: {
									type: 'string',
									description: 'Safe search level (off, moderate, strict)',
									enum: ['off', 'moderate', 'strict'],
									default: 'moderate',
								},
								date_filter: {
									type: 'string',
									description: 'Filter results by date (d: day, w: week, m: month, y: year, or custom range like 2023-01-01..2023-12-31)',
									pattern: '^([dwmy]|\\d{4}-\\d{2}-\\d{2}\\.\\.\\d{4}-\\d{2}-\\d{2})$',
								},
								start: {
									type: 'number',
									description: 'Result offset for pagination',
									minimum: 0,
								},
								no_cache: {
									type: 'boolean',
									description: 'Bypass cache and fetch fresh results',
									default: false,
								},
							},
							required: ['query'],
						},
					},
				],
			}),
		);

		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request) => {
				if (request.params.name !== 'ddg_search') {
					throw new McpError(
						ErrorCode.MethodNotFound,
						`Unknown tool: ${request.params.name}`,
					);
				}

				const {
					query,
					region = 'us-en',
					safe_search = 'moderate',
					date_filter,
					start,
					no_cache = false,
				} = request.params.arguments as {
					query: string;
					region?: string;
					safe_search?: 'off' | 'moderate' | 'strict';
					date_filter?: string;
					start?: number;
					no_cache?: boolean;
				};

				try {
					// Check cache first if not explicitly bypassed
					if (!no_cache) {
						const cache_key = JSON.stringify({
							query,
							region,
							safe_search,
							date_filter,
							start,
						});
						const cached_result = search_cache.get(cache_key);
						if (cached_result) {
							const formatted = format_response(cached_result);
							return {
								...formatted,
								_meta: {},
							} as ServerResult;
						}
					}

					const params: Record<string, string> = {
						engine: 'duckduckgo',
						q: query,
						kl: region,
						safe: SAFE_SEARCH_LEVELS[safe_search],
						api_key: API_KEY,
					};

					// Add date filter if provided
					if (date_filter) {
						params.df = date_filter;
					}

					// Add pagination if provided
					if (start !== undefined) {
						params.start = start.toString();
					}

					const search_params = new URLSearchParams(params);

					const controller = new AbortController();
					const timeout_id = setTimeout(
						() => controller.abort(),
						30000,
					); // 30 second timeout

					try {
						const api_response = await fetch(
							`${SERPAPI_BASE_URL}?${search_params.toString()}`,
							{
								method: 'GET',
								signal: controller.signal,
							},
						);

						if (!api_response.ok) {
							throw new McpError(
								ErrorCode.InternalError,
								`Search API error: ${api_response.statusText}`,
							);
						}

						const data: SerpApiResponse = await api_response.json();

						// Cache the response if caching wasn't explicitly disabled
						if (!no_cache) {
							const cache_key = JSON.stringify({
								query,
								region,
								safe_search,
								date_filter,
								start,
							});
							search_cache.set(cache_key, data);
						}

						const formatted = format_response(data);
						return {
							...formatted,
							_meta: {},
						} as ServerResult;
					} finally {
						clearTimeout(timeout_id);
					}
				} catch (error) {
					return {
						content: [
							{
								type: 'text',
								text: `Error performing search: ${
									error instanceof Error
										? error.message
										: String(error)
								}`,
							},
						],
						isError: true,
					};
				}
			},
		);
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('DuckDuckGo MCP server running on stdio');
	}
}

const server = new DuckDuckGoServer();
server.run().catch(console.error);
