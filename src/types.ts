export interface SerpApiResponse {
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
		df?: string;
		safe?: string;
		start?: number;
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
		sitelinks?: Array<{
			title: string;
			link: string;
			snippet?: string;
		}>;
	}>;
	knowledge_graph?: {
		title: string;
		description: string;
		website?: string;
		thumbnail?: string;
		facts?: Record<string, string>;
		profiles?: Array<{
			name: string;
			link: string;
			thumbnail?: string;
		}>;
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
	inline_videos?: Array<{
		position: number;
		title: string;
		link: string;
		duration?: string;
		platform?: string;
		date?: string;
		views?: number;
		thumbnail?: string;
	}>;
	inline_images?: Array<{
		position: number;
		title: string;
		link: string;
		thumbnail?: string;
		source?: string;
	}>;
	ads?: Array<{
		position: number;
		title: string;
		link: string;
		source: string;
		snippet: string;
		sitelinks?: Array<{
			title: string;
			link: string;
		}>;
	}>;
	related_searches?: Array<{
		query: string;
		link: string;
	}>;
}

export interface SearchParameters {
	query: string;
	region?: string;
	safe_search?: 'off' | 'moderate' | 'strict';
	date_filter?: 'd' | 'w' | 'm' | 'y' | string;
	start?: number;
	no_cache?: boolean;
}

export interface CacheEntry {
	timestamp: number;
	data: SerpApiResponse;
}

export interface FormattedResponse {
	content: Array<{
		type: string;
		text: string;
	}>;
	isError?: boolean;
}
