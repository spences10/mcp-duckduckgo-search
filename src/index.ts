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

// DDG API configuration
const DDG_BASE_URL = 'https://api.duckduckgo.com';

interface ddg_search_response {
	abstract_text: string;
	abstract_source: string;
	abstract_url: string;
	image: string;
	heading: string;
	answer: string;
	redirect: string;
	related_topics: Array<{
		text: string;
		first_url: string;
	}>;
	results: Array<{
		text: string;
		first_url: string;
	}>;
	type: string;
}

class duckduckgo_server {
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
									type: 'boolean',
									description: 'Enable safe search',
									default: true,
								},
								format: {
									type: 'string',
									enum: ['json', 'text'],
									default: 'json',
									description: 'Response format',
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
					format = 'json',
				} = request.params.arguments as {
					query: string;
					region?: string;
					safe_search?: boolean;
					format?: 'json' | 'text';
				};

				try {
					const search_params = new URLSearchParams({
						q: query,
						kl: region,
						format: 'json',
						no_redirect: '1',
						no_html: '1',
						skip_disambig: '1',
					});

					if (safe_search) {
						search_params.append('safesearch', '1');
					}

					const controller = new AbortController();
					const timeout_id = setTimeout(
						() => controller.abort(),
						30000,
					); // 30 second timeout

					try {
						const response = await fetch(
							`${DDG_BASE_URL}/?${search_params.toString()}`,
							{
								method: 'GET',
								signal: controller.signal,
							},
						);

						if (!response.ok) {
							throw new McpError(
								ErrorCode.InternalError,
								`DuckDuckGo API error: ${response.statusText}`,
							);
						}

						const data: ddg_search_response = await response.json();

						// Format the response based on user preference
						if (format === 'text') {
							let text_response = 'Search Results:\n\n';

							// Add instant answer if available
							if (data.abstract_text) {
								text_response += `Instant Answer:\n${data.abstract_text}\n`;
								text_response += `Source: ${data.abstract_source} (${data.abstract_url})\n\n`;
							}

							// Add results
							if (data.results?.length > 0) {
								text_response += 'Top Results:\n';
								data.results.forEach((result, index) => {
									text_response += `${index + 1}. ${result.text}\n`;
									text_response += `   URL: ${result.first_url}\n\n`;
								});
							}

							// Add related topics
							if (data.related_topics?.length > 0) {
								text_response += '\nRelated Topics:\n';
								data.related_topics.forEach((topic) => {
									text_response += `- ${topic.text}\n`;
								});
							}

							return {
								content: [
									{
										type: 'text',
										text: text_response,
									},
								],
							};
						}

						// Return JSON response
						return {
							content: [
								{
									type: 'json',
									text: JSON.stringify(data, null, 2),
								},
							],
						};
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

const server = new duckduckgo_server();
server.run().catch(console.error);
