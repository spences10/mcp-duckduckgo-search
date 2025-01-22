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

interface SerpApiResponse {
	search_metadata: {
		id: string;
		status: string;
		json_endpoint: string;
		created_at: string;
		processed_at: string;
		duckduckgo_url: string;
		raw_html_file: string;
		prettify_html_file: string;
		total_time_taken: number;
	};
	search_parameters: {
		engine: string;
		q: string;
		kl: string;
	};
	search_information: {
		organic_results_state: string;
	};
	organic_results: Array<{
		position: number;
		title: string;
		link: string;
		snippet: string;
		favicon?: string;
	}>;
	knowledge_graph?: {
		title: string;
		description: string;
		website?: string;
		thumbnail?: string;
	};
	news_results?: Array<{
		position: number;
		title: string;
		link: string;
		snippet: string;
		source: string;
		date: string;
		thumbnail?: string;
	}>;
	related_searches?: Array<{
		query: string;
		link: string;
	}>;
}

// Cache interface
interface CacheEntry {
	timestamp: number;
	data: SerpApiResponse;
}

// Cache configuration
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const cache = new Map<string, CacheEntry>();

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

	private format_response(data: SerpApiResponse) {
		let formatted_response = 'Search Results:\n\n';

		// Add knowledge graph if available
		if (data.knowledge_graph) {
			formatted_response += `${data.knowledge_graph.title}\n`;
			formatted_response += `${data.knowledge_graph.description}\n\n`;
		}

		// Add organic results
		if (data.organic_results?.length > 0) {
			data.organic_results.forEach((result, index) => {
				formatted_response += `${index + 1}. ${result.title}\n`;
				formatted_response += `   ${result.snippet}\n`;
				formatted_response += `   URL: ${result.link}\n\n`;
			});
		}

		// Add news results if available
		const news_results = data.news_results || [];
		if (news_results.length > 0) {
			formatted_response += '\nNews Results:\n';
			news_results.forEach((item, index) => {
				formatted_response += `${index + 1}. ${item.title}\n`;
				formatted_response += `   ${item.snippet}\n`;
				formatted_response += `   Source: ${item.source} - ${item.date}\n`;
				formatted_response += `   URL: ${item.link}\n\n`;
			});
		}

		// Add related searches
		const related_searches = data.related_searches || [];
		if (related_searches.length > 0) {
			formatted_response += '\nRelated Searches:\n';
			related_searches.forEach((search) => {
				formatted_response += `- ${search.query}\n`;
			});
		}

		return {
			content: [
				{
					type: 'text',
					text: formatted_response.trim(),
				},
			],
		};
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
									type: 'boolean',
									description: 'Enable safe search',
									default: true,
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
					safe_search = true,
				} = request.params.arguments as {
					query: string;
					region?: string;
					safe_search?: boolean;
				};

				try {
					// Check cache first
					const cache_key = JSON.stringify({
						query,
						region,
						safe_search,
					});
					const cached_entry = cache.get(cache_key);

					if (
						cached_entry &&
						Date.now() - cached_entry.timestamp < CACHE_TTL
					) {
						return this.format_response(cached_entry.data);
					}

					const params: Record<string, string> = {
						engine: 'duckduckgo',
						q: query,
						kl: region,
						safe: safe_search ? '1' : '-1',
						api_key: API_KEY,
					};

					const search_params = new URLSearchParams(params);

					const controller = new AbortController();
					const timeout_id = setTimeout(
						() => controller.abort(),
						30000,
					); // 30 second timeout

					try {
						const response = await fetch(
							`${SERPAPI_BASE_URL}?${search_params.toString()}`,
							{
								method: 'GET',
								signal: controller.signal,
							},
						);

						if (!response.ok) {
							throw new McpError(
								ErrorCode.InternalError,
								`Search API error: ${response.statusText}`,
							);
						}

						const data: SerpApiResponse = await response.json();

						// Cache the response
						cache.set(cache_key, {
							timestamp: Date.now(),
							data,
						});

						return this.format_response(data);
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
