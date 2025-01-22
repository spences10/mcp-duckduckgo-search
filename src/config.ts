import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
	readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);

export const { name, version } = pkg;

// SerpAPI configuration
export const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';
export const SERPAPI_KEY = process.env.SERPAPI_API_KEY || '';

if (!SERPAPI_KEY) {
	throw new Error('SERPAPI_API_KEY environment variable is required');
}

// Cache configuration
export const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Request configuration
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Safe search levels
export const SAFE_SEARCH_LEVELS = {
	off: '-2',
	moderate: '-1',
	strict: '1',
} as const;

// Tool schema
export const TOOL_SCHEMA = {
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
} as const;
