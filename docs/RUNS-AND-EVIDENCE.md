# Runs and Evidence (UI-4 / S-8)

Run controls choose Suite and Environment explicitly. POST /executions is synchronous
and sends only those two fields, without Gates. The returned batch id and every
Execution are displayed, including infrastructure_failure. A new run is a new batch;
it never settles an old Result. Retry remains restricted to infrastructure failure.

Runs list reads all offset/limit pages from GET /executions with Suite, Environment,
status and inclusive timezone-bearing date filters. It groups returned records by
execution_batch_id and displays ten batches per UI page. A status/date filter can
select part of a batch; counts say matching Executions, not the unfiltered batch total.
Histograms count recorded Results by disposition/verdict; they neither resolve Results
nor compute quality. Earlier batches remain in the list, with no later-run supersession.

Each Execution has its own URL, `#runs/{project}/{execution}`. Evidence reads the
Conversation, paginated Artifacts, metadata/configuration and paginated Results. A
409 transcript response says **no completed transcript**, with the original error.
Context sources and tool calls are readable; latency and usage stay recorded values.
Unknown or malformed-for-presentation Artifacts fall back to raw JSON. Frozen
Environment, resolved Contract and Oracle configurations are labelled
**frozen at execution; later configuration changes do not apply here**.

Results are grouped into chains using recorded resolves ids only, oldest first.
Each record stays visible with its Oracle, disposition/verdict, Confidence,
recorded_at and supporting criteria/provider response/explanation/attempts. Complete
supporting records remain inspectable. Panel member verdicts and configured/counted
figures are returned engine records. The chain tip says **latest in this chain**;
this is not a Gate-effective-state calculation.

Human Review is offered on a current inconclusive Result, or current pending Human
Result routed to the configured local Person's Role. The page displays review_route
verbatim, including required_roles/state/timeout. Verdict has no default, supporting
reason is required. A Confidence field exists only for a frozen capture policy; it
is then required and numeric [0,1]. Otherwise the key is omitted, never null. The engine
performs the final permission, Role and currency checks. An inconclusive Judge gains
a new resolving Human Result. Pending Human completion retains id and recorded_at:
the one documented in-place mutation, clearly labelled.

**Re-check with the same Oracle** is offered only on a current uninvalidated
oracle_unavailable Result. It sends the original Oracle string exactly. It neither
calls the subject nor changes the frozen Evidence. Continued outage is another
oracle_unavailable record in the chain, not an action error. After Connections turns
off the flaky outage, another re-check can produce an actionable record. Corrected
Oracle re-assessment is disabled with the UI-5 Requalification explanation.

403/409 review errors, 404/422 run preflight errors and read failures retain the
engine status and body. No Admission, Seeded Control, Requalification, Gate, Report
or Dashboard operation is introduced here.
