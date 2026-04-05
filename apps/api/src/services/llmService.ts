import OpenAI from 'openai';

import type { Venue, Show } from '@repo/types';
import { supabase } from '../lib/supabase.js';

interface ShowFilters {
  date?: string;
  spot_type?: 'busking' | 'non_busking';
  after_time?: string;
  before_time?: string;
  venue_ids?: string[];
}

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

      let venueQuery = supabase
        .from('venues')
        .select('*')
        .eq('admin_approved', true)
        .eq('is_active', true);

      if (args.city) {
        venueQuery = venueQuery.ilike('city', `%${args.city}%`);
      }

      if (args.venue_name) {
        venueQuery = venueQuery.or(
          `name.ilike.%${args.venue_name}%,address.ilike.%${args.venue_name}%`
        );
      }

      const { data: venueData, error: venueError } = await venueQuery;

      if (venueError) {
        console.error('Venue query error:', venueError);
        return {
          type: 'message',
          message: 'Sorry, I could not search venues right now. Please try again.',
        };
      }

      const venues = (venueData ?? []) as Venue[];

      if (venues.length === 0) {
        return {
          type: 'venues',
          message:
            'I could not find any venues matching your search. Try a broader search or different location.',
          venues: [],
          shows: [],
          filtersUsed: {},
        };
      }

      const venueIds = venues.map((venue) => venue.id);

      let showQuery = supabase
        .from('shows')
        .select('*')
        .eq('is_cancelled', false)
        .in('venue_id', venueIds)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (args.spot_type) {
        showQuery = showQuery.eq('spot_type', args.spot_type);
      }

      if (args.date) {
        showQuery = showQuery.eq('date', args.date);
      }

      if (args.after_time) {
        showQuery = showQuery.gte('start_time', args.after_time);
      }

      if (args.before_time) {
        showQuery = showQuery.lte('start_time', args.before_time);
      }

      const { data: showData, error: showError } = await showQuery;

      if (showError) {
        console.error('Shows query error:', showError);
        return {
          type: 'message',
          message: 'Sorry, I could not fetch show details right now.',
        };
      }

      const filteredShows = (showData ?? []) as Show[];

      const matchedVenueIds = new Set(filteredShows.map((show) => show.venue_id));
      const matchedVenues = venues.filter((venue) => matchedVenueIds.has(venue.id));

      const filtersUsed: ShowFilters = {
        ...(args.date && { date: args.date }),
        ...(args.spot_type && { spot_type: args.spot_type }),
        ...(args.after_time && { after_time: args.after_time }),
        ...(args.before_time && { before_time: args.before_time }),
        ...(venueIds.length > 0 && { venue_ids: venueIds }),
      };

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
        filtersUsed: filtersUsed,
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
