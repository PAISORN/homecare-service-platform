---
status: accepted
---

# Use React Native with Expo, Next.js, and Supabase for the MVP

HomeCare requires camera capture, push notifications, location sharing during travel, and distinct customer and technician experiences on iOS and Android. The MVP will therefore use React Native with Expo and TypeScript for one mobile codebase, Next.js with TypeScript for the separate admin web application, and Supabase for PostgreSQL, authentication, storage, realtime features, and row-level authorization; PWA, Flutter, and a custom backend were considered but rejected because this combination provides the required native capabilities with lower initial delivery and operational cost.

## Consequences

- Mobile and admin clients share domain types and validation where practical, but not UI components by default.
- Map and payment integrations sit behind adapters so providers can be selected or replaced later.
- Production access must be enforced by database Row Level Security and server-side privileged operations; the mobile client never receives service-role credentials.
- A custom API service may be introduced when workflows, integrations, or scale exceed the safe limits of the MVP architecture.
