import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Munimark exists so that information about local government is easy to
// find, cite and check. That includes AI crawlers: a model that answers a
// question about a municipality should be able to read — and attribute —
// the numbers here. So access is stated explicitly, per agent, rather than
// left to the silent default of "no rule". A future decision to restrict
// one of them is then a one-line, visible change.
const AI_AGENTS = [
  'GPTBot',            // OpenAI — training
  'OAI-SearchBot',     // OpenAI — search
  'ChatGPT-User',      // OpenAI — user-initiated fetch
  'ClaudeBot',         // Anthropic — training
  'Claude-SearchBot',  // Anthropic — search
  'Claude-User',       // Anthropic — user-initiated fetch
  'PerplexityBot',     // Perplexity — index
  'Perplexity-User',   // Perplexity — user-initiated fetch
  'CCBot',             // Common Crawl — the open corpus many models start from
  'Google-Extended',   // Google — Gemini / AI use of Googlebot's crawl
  'Applebot-Extended', // Apple — AI use of Applebot's crawl
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: AI_AGENTS, allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
