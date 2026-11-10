# Automatic Maintenance Rule Drafting

The administrator Rules page can now check every distinct Garage vehicle configuration and create editable maintenance-rule drafts.

## Operation

1. Open **Admin → Vehicle Intelligence → Rules**.
2. Select **Create Rules Automatically**.
3. Review the result labels:
   - **Ready to approve**: an exact official source and interval were retained with high confidence.
   - **Needs review**: the source or match needs an administrator check.
   - **No reliable source found**: no interval was assumed; the draft remains an inspection/source-research task.
4. Use **Edit Draft** when a source, interval, explanation, or safety flag needs correction.
5. Select **Approve Rule** only after verifying the retained source and exact vehicle applicability.

The weekly background check runs Mondays at 11:00 UTC and covers newly added Garage configurations. Matching year/make/model/trim/engine configurations share the same draft instead of creating duplicates.

## Research connection

Configure one of these Netlify server-side options:

- `OPENAI_API_KEY` for official-source web research through the Responses API. `MAINTENANCE_RULE_AI_MODEL` defaults to `gpt-5-mini`.
- `MAINTENANCE_RULE_PROVIDER_URL` and optional `MAINTENANCE_RULE_PROVIDER_TOKEN` for a licensed maintenance-data provider.

When neither connection is configured, the system stays in **Review-only safety mode**. It links the official manufacturer owner portal where one is mapped and creates an inspection draft without inventing a mileage or calendar interval.

## Safety controls

- Generated rules always start as inactive drafts.
- The automatic process cannot approve or activate a rule.
- Manufacturer drafts require a source URL, source title, source edition/version, exact vehicle applicability, and at least one explicitly sourced interval.
- Unsupported, ambiguous, imported, modified, or incomplete vehicle records fall back to review rather than a guessed schedule.
- Existing approved or draft configurations are deduplicated.
