# ✳ Signature AI — version record

## Llama Standard 1.0 (saved 2026-10-07)
The on-device conversational engine, frozen as the Signature ecosystem standard.
- File: `vault/engines/llama-standard-1.0.js`
- Runs on the user's device, no key, no cloud. Real conversation: session memory,
  no back-to-back repeats, live Signature Dictionary lookup, safe math, hashtag roles,
  honest test-challenge answers, honest fallback (never word salad, never fake data).
- Deployed on: The Signature AI (Standard chat), Signature Llama 2.0 (ask box).

## Apex AI 2.0 (2026-10-07)
The online brain. Cloud LLM (Groq, Llama 3.3 70B) with real tool calling.
- File: `vault/engines/apex-engine-2.0.js`
- Key system: the user's own free Groq key, stored ONLY in the phone's localStorage,
  sent ONLY to Groq's API. No key is ever baked into the site. Get one free at
  https://console.groq.com/keys — one paste and Apex goes live.
- Tools (preloaded): define_word (live Signature Dictionary), calculate (safe math),
  wikipedia (web knowledge), route_site (39-site Signature network).
- The LLM reasons, calls tools, reads results, then answers — the agentic loop.

Property of Justin Addam Higgins (JAH). Free forever.
