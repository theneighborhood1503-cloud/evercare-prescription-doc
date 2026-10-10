<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Prescription extraction logic lives in `src/lib/prescription/` and must stay UI-independent and portable (only `fetch` + `zod`) — it will be lifted into the EVERCARE app.
- Gemini is called directly via Google's REST API with server-only `GEMINI_API_KEY` — user required no Lovable-specific runtime for the core workflow.
- OCR and medicine parsing are separate Gemini passes; parsing sees only OCR text — prevents filling gaps with guesses.
- No prescription content or patient data may be logged or stored.
