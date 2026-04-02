import OpenAI from 'openai';

import type { Venue, Show } from '@repo/types';
import { MOCK_VENUES, MOCK_SHOWS } from '../data/mockData.js';
import { filterShows, ShowFilters } from '../utils/filterShows.js';

const client = new OpenAI({
  baseURL: 'https://router.huggingface.co/v1',
  apiKey: process.env.HF_API_TOKEN ?? '',
});

const SEARCH_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_venues',
    description:
      'Search for open mic venues and shows based on filters extracted from the user query. Call this whenever the user asks about spots, venues, availability, timings, or locations.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city to search in. Default to Delhi if not specified.',
        },
        date: {
          type: 'string',
          description:
            'The date to search for in YYYY-MM-DD format. Infer from words like today, tomorrow, tonight, this weekend. Use current date for today and tonight.',
        },
        spot_type: {
          type: 'string',
          enum: ['busking', 'non_busking'],
          description:
            'Type of spot. Busking means the performer earns from audience tips. Non-busking means a structured paid or free slot.',
        },
        after_time: {
          type: 'string',
          description:
            'Show start time must be at or after this time. Format HH:MM in 24-hour. Convert from natural language: 8pm becomes 20:00, 9pm becomes 21:00, half 8 becomes 20:30.',
        },
        before_time: {
          type: 'string',
          description: 'Show start time must be at or before this time. Format HH:MM in 24-hour.',
        },
        venue_name: {
          type: 'string',
          description:
            'Full or partial name of a specific venue or neighbourhood. Examples: Hauz Khas, Punjabi Bagh, The Laugh Factory.',
        },
      },
      required: [],
    },
  },
};

const SYSTEM_PROMPT = `You are an assistant for OpenMic Delhi,
a platform that helps stand-up comedians find and book open
mic spots across Delhi.

When a user asks about spots, venues, availability, timings,
prices, or locations — always call the search_venues tool.
Never make up venue names, show times, or availability.
All real venue data comes through the tool.

For greetings or completely unrelated questions, respond
conversationally without calling the tool.

Today's date is ${new Date().toISOString().split('T')[0]}.
The default city is Delhi.
When the user mentions a time (like "after 8pm" or "before 9pm") but does NOT explicitly mention a specific date, day, or word like "today" or "tonight" - do NOT set the date parameter. Only set date when the user explicitly refers to a specific day.
Words that should trigger date extraction: today, tonight, tomorrow, this weekend, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, and specific dates like "April 10th". Words that should NOT trigger date extraction: after, before, pm, am, evening, night, late, early.`;

export interface ChatResponse {
  type: 'venues' | 'message';
  message?: string;
  venues?: Venue[];
  shows?: Show[];
  filtersUsed?: ShowFilters;
}

type ToolArgs = Partial<ShowFilters & { city: string; venue_name: string }>;

export async function processChat(userMessage: string): Promise<ChatResponse> {
  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      tools: [SEARCH_TOOL],
      tool_choice: 'auto',
      max_tokens: 512,
      temperature: 0,
    });

    const responseMessage = response.choices[0]?.message;

    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];

      let args: ToolArgs;
      try {
        args = JSON.parse(toolCall.function.arguments) as ToolArgs;
      } catch {
        return {
          type: 'message',
          message: 'Sorry, I could not understand that query. Please try again.',
        };
      }

      let filteredVenues = MOCK_VENUES;

      if (args.city) {
        filteredVenues = filteredVenues.filter((venue) => {
          return venue.city.toLowerCase() === args.city?.toLowerCase();
        });
      }

      if (args.venue_name) {
        const venueQuery = args.venue_name.toLowerCase();
        filteredVenues = filteredVenues.filter((venue) => {
          return (
            venue.name.toLowerCase().includes(venueQuery) ||
            venue.address.toLowerCase().includes(venueQuery)
          );
        });
      }

      const venue_ids: string[] = filteredVenues.map((venue) => venue.id);

      const filters: ShowFilters = {};
      if (args.date) {
        filters.date = args.date;
      }
      if (args.spot_type === 'busking' || args.spot_type === 'non_busking') {
        filters.spot_type = args.spot_type;
      }
      if (args.after_time) {
        filters.after_time = args.after_time;
      }
      if (args.before_time) {
        filters.before_time = args.before_time;
      }
      if (args.city || args.venue_name) {
        filters.venue_ids = venue_ids;
      }

      const filteredShows = filterShows(MOCK_SHOWS, filters);

      const matchedVenueIds = new Set(filteredShows.map((show) => show.venue_id));
      const matchedVenues = MOCK_VENUES.filter((venue) => matchedVenueIds.has(venue.id));

      const secondResponse = await client.chat.completions.create({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: null, tool_calls: [toolCall] },
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              venueCount: matchedVenues.length,
              showCount: filteredShows.length,
              venues: matchedVenues.map((venue) => ({
                name: venue.name,
                address: venue.address,
              })),
            }),
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      return {
        type: 'venues',
        message: secondResponse.choices[0]?.message?.content ?? 'Here are the spots I found.',
        venues: matchedVenues,
        shows: filteredShows,
        filtersUsed: filters,
      };
    }

    return {
      type: 'message',
      message: responseMessage?.content ?? 'How can I help you find a spot today?',
    };
  } catch (error) {
    console.error('Error processing chat:', error);
    return {
      type: 'message',
      message: 'Something went wrong. Please try again.',
    };
  }
}
