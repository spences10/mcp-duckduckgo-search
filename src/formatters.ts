import { FormattedResponse, SerpApiResponse } from './types.js';

export function format_response(data: SerpApiResponse): FormattedResponse {
	let formatted_response = 'Search Results:\n\n';

	// Add knowledge graph if available
	if (data.knowledge_graph) {
		const kg = data.knowledge_graph;
		formatted_response += `${kg.title}\n`;
		formatted_response += `${kg.description}\n`;
		
		// Add facts if available
		if (kg.facts && Object.keys(kg.facts).length > 0) {
			formatted_response += '\nKey Facts:\n';
			for (const [key, value] of Object.entries(kg.facts)) {
				formatted_response += `- ${key}: ${value}\n`;
			}
		}

		// Add profiles if available
		if (kg.profiles && kg.profiles.length > 0) {
			formatted_response += '\nProfiles:\n';
			kg.profiles.forEach(profile => {
				formatted_response += `- ${profile.name}: ${profile.link}\n`;
			});
		}
		formatted_response += '\n';
	}

	// Add advertisement results if available
	if (data.ads && data.ads.length > 0) {
		formatted_response += 'Sponsored Results:\n';
		data.ads.forEach((ad, index) => {
			formatted_response += `${index + 1}. ${ad.title}\n`;
			formatted_response += `   ${ad.snippet}\n`;
			formatted_response += `   Source: ${ad.source}\n`;
			formatted_response += `   URL: ${ad.link}\n`;
			
			if (ad.sitelinks && ad.sitelinks.length > 0) {
				formatted_response += '   Related links:\n';
				ad.sitelinks.forEach(link => {
					formatted_response += `   - ${link.title}: ${link.link}\n`;
				});
			}
			formatted_response += '\n';
		});
	}

	// Add organic results
	if (data.organic_results?.length > 0) {
		formatted_response += 'Organic Results:\n';
		data.organic_results.forEach((result, index) => {
			formatted_response += `${index + 1}. ${result.title}\n`;
			formatted_response += `   ${result.snippet}\n`;
			formatted_response += `   URL: ${result.link}\n`;
			
			if (result.sitelinks && result.sitelinks.length > 0) {
				formatted_response += '   Related pages:\n';
				result.sitelinks.forEach(link => {
					formatted_response += `   - ${link.title}: ${link.link}\n`;
					if (link.snippet) {
						formatted_response += `     ${link.snippet}\n`;
					}
				});
			}
			formatted_response += '\n';
		});
	}

	// Add news results if available
	if (data.news_results && data.news_results.length > 0) {
		formatted_response += 'News Results:\n';
		data.news_results.forEach((item, index) => {
			formatted_response += `${index + 1}. ${item.title}\n`;
			formatted_response += `   ${item.snippet}\n`;
			formatted_response += `   Source: ${item.source} - ${item.date}\n`;
			formatted_response += `   URL: ${item.link}\n\n`;
		});
	}

	// Add inline videos if available
	if (data.inline_videos && data.inline_videos.length > 0) {
		formatted_response += 'Video Results:\n';
		data.inline_videos.forEach((video, index) => {
			formatted_response += `${index + 1}. ${video.title}\n`;
			if (video.duration) {
				formatted_response += `   Duration: ${video.duration}\n`;
			}
			if (video.platform) {
				formatted_response += `   Platform: ${video.platform}\n`;
			}
			if (video.views !== undefined) {
				formatted_response += `   Views: ${video.views}\n`;
			}
			formatted_response += `   URL: ${video.link}\n\n`;
		});
	}

	// Add inline images if available
	if (data.inline_images && data.inline_images.length > 0) {
		formatted_response += 'Image Results:\n';
		data.inline_images.forEach((image, index) => {
			formatted_response += `${index + 1}. ${image.title}\n`;
			if (image.source) {
				formatted_response += `   Source: ${image.source}\n`;
			}
			formatted_response += `   URL: ${image.link}\n\n`;
		});
	}

	// Add related searches
	if (data.related_searches && data.related_searches.length > 0) {
		formatted_response += 'Related Searches:\n';
		data.related_searches.forEach(search => {
			formatted_response += `- ${search.query}\n`;
		});
	}

	// Add search metadata
	formatted_response += `\nSearch Information:\n`;
	formatted_response += `- Time taken: ${data.search_metadata.total_time_taken}s\n`;
	formatted_response += `- Results state: ${data.search_information.organic_results_state}\n`;

	return {
		content: [
			{
				type: 'text',
				text: formatted_response.trim(),
			},
		],
	};
}
