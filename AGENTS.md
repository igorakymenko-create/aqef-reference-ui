Read docs/STAGE-1-BRIEF.md first. Work in the brief's slice order and record
ambiguities and engine gaps in docs/AMBIGUITIES.md. Keep the pinned reference engine
unchanged. The UI must not implement AQEF evaluation or governance logic.

Never access the AQEF conformance-tests directory, CTS, aqef-cts-harness, or any
other external test material for the specification. Create independent checks from
the specification and documented API/provider protocol only. The supplied brief's
references to those materials do not authorize accessing them or claiming CTS passes.

Never commit .env, credentials, runtime databases, node_modules or local browser
downloads. UI and browser bundles must not receive the engine bearer token.
