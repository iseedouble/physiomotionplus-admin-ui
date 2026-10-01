# Physiomotion Plus Admin

Angular 21, PrimeNG and Tailwind sample-data POC for physiotherapists.

## Run

Run `npm install`, then `npm start`. Open http://localhost:4201.
Run `npm run build` for production output in `dist/physiomotionplus-admin-ui/browser`.

## Workflows

- Modules: search, filter, create, edit, draft/publish preview.
- Exercises: add/edit instructions and a video reference, reorder progression, remove sample exercises.
- Clients: search profiles and assign/unassign published modules.
- Private messages: separate sample conversations and in-memory replies.
- English/French interface. User-authored content remains in its original language.

State is shared across screens through a signal-based store, and resets on refresh.
There is no backend, authentication, actual private-data access control, email sending, video upload, or playback.
Invitation-only authentication is planned but deliberately not implemented.
Use fictional data only. A future server must enforce physio/client access rules.
For static hosting, configure all application routes to fall back to index.html.
