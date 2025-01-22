import { CACHE_TTL } from './config.js';
import { CacheEntry, SerpApiResponse } from './types.js';

class SearchCache {
	private cache: Map<string, CacheEntry>;

	constructor() {
		this.cache = new Map();
	}

	get(key: string): SerpApiResponse | null {
		const entry = this.cache.get(key);
		if (!entry) {
			return null;
		}

		// Check if cache entry has expired
		if (Date.now() - entry.timestamp > CACHE_TTL) {
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	set(key: string, data: SerpApiResponse): void {
		this.cache.set(key, {
			timestamp: Date.now(),
			data,
		});
	}

	clear(): void {
		this.cache.clear();
	}

	// Clean expired entries
	clean(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > CACHE_TTL) {
				this.cache.delete(key);
			}
		}
	}

	// Get cache key from search parameters
	static get_cache_key(params: Record<string, any>): string {
		return JSON.stringify(params);
	}
}

// Export singleton instance
export const search_cache = new SearchCache();
