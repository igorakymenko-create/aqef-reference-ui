# Workspace service and authoring

The owner authorized this minimal service in UI-2 amendment A-2. It only lists,
reads and writes YAML files in one mounted folder. No engine calls, Contract
knowledge, schema checks or AQEF decisions exist in the Python service.

Compose mounts `./workspace`, publishes the file service on **127.0.0.1:9200**, and
proxies `/workspace/` from the static UI's nginx. On first start an empty folder is
seeded from `examples/aster/`. An existing folder is preserved. The folder is ignored
by git in this development checkout; an owner may keep their workspace in its own git
repository. The service does not require git and never commits files for the user.

## File protocol (not an AQEF API)

* GET `/files`: `{files: [relative YAML paths]}`. Nested directories form a hierarchy in the UI tree; non-YAML files are not listed.
* GET `/files?path=project.yaml`: `{path, content, etag}`; etag is SHA-256 of UTF-8 text.
* PUT `/files?path=project.yaml`, `application/json`:
  `{content: "YAML text", expected_etag: "previous digest"}`. Use null for a new file.
  Response is `{path, etag}`. Missing revision: 428; stale revision: 409.
* GET `/healthz`: transport readiness only.

Paths must be relative, without traversal, drive/absolute syntax or symlinks.
The implementation conservatively refuses all symlinks, including internal ones.
The Linux container uses directory-relative no-follow file operations and atomic
replacement. Files are regular YAML text, up to 2 MB. Syntax errors identify a line
and column without echoing source values. Writes require valid YAML syntax and
reject keys `password`, `api_key`, `token`, `secret` at every nesting level,
case-insensitively, including flow mappings and aliases. The error tells the author
to use `secret_ref`; secret values are not echoed or logged. Existing files with
those keys are also refused on reads. No delete, rename, engine or execution endpoint
is offered. Remove obsolete documents using your normal filesystem/git workflow.

## YAML documents

UI-5 declarations are auxiliary documents wrapped in `admission_plan`, stored under
`admissions/plans/`. They include the Reference Set snapshot, exact Oracle, Person,
time, declared/current thresholds and any change after results were seen. They use
the same file revision checks but are not configuration applied to the engine.
Generated diagnostic Project/Suite files under `admissions/suites/` are ordinary
configuration and use Review & Apply. Control forms edit the same Project YAML.

The canonical sample is `project.yaml` with one `project: <Project mapping>` wrapper.
Project environments, Suites, Scenarios, Datasets, Contracts and Gates may be inline.
Additional documents can share a file using YAML `---`, or use separate files:

```yaml
project: aster-support
contract:
  name: response-shape
  constraints:
    - id: response-text
      validator: schema
      target: response
      expected: {type: string}
```

The same owner wrapper supports `dataset`, `environment`, `suite`, `scenario` and
`quality_gate`. A separate Scenario also names `suite: <name>`. A Project root document
must be present. Datasets and Contracts in these wrappers are reusable registry
resources, not implicitly attached Contracts. Reference Sets with `name`, `version`,
`labelled_by` and `items` are auxiliary files; they are not applied as Project config.
This wrapper/file-splitting convention is implementation-defined by Appendix A.

The browser uses YAML 1.2 and checks the assembled Project against the prose-derived
authoring subset. It rejects duplicate YAML mapping keys, cyclic aliases and
conflicting resource definitions rather than picking one silently. Identical
contributions are allowed. It never changes explicit nulls into omitted/default fields.

## One authoring and Apply path

The CodeMirror YAML editor and the forms propose the same YAML document. The visual
form edits Scenario name, Prompt, fixed Variables or Dataset binding, and inline
Constraint/Single Judge Expectation clauses with id and dimension. Existing unrelated
Scenario/Contract fields are retained. Multi Judge, Human Reviewer, Seeded Controls
and Fixed Evidence are editable through YAML in UI-2; their dedicated designers
belong to the later slices. Split documents can always use the YAML editor; visual
forms work on the Project document containing their Suite.

There is no form-only save endpoint. Both paths use **Review & Apply**, the same
source/engine diff preview and **Confirm Apply**. Form changes are visible in the YAML
diff before any file or engine write. Schema warnings are advisory; the engine is
the authority. Sensitive-key drafts are hidden and cannot be saved or applied.

The preview inventories created/changed/unchanged Project, Environment, Suite,
Scenario, attached Contract, Dataset and Gate resources. It shows the exact API call
covering each inline change, which changes are governed, and the call order.
Reusable resource calls precede their consuming Project definition. A new Project
with external dependencies first gets an explicit namespace skeleton (name and
authored Environments), which is itself shown in the call list. Inline resources use
the documented atomic Project POST/PUT: the pinned engine has no Suite PUT, and each
write must leave a valid whole Project. This is a per-Project API call, not a new bulk
endpoint or UI-side composition/validation bypass.

Before confirmation, the browser rechecks all source revisions and its engine read
set. A changed preview must be reviewed again. This is optimistic conflict detection,
not a cross-resource transaction; the engine offers no conditional-write/transaction
API. Every engine call gets an outcome. A failure skips dependent calls for that
Project and is labelled failed or partial; independent Projects can continue. The
reviewed YAML remains on disk even if the engine rejects it. Nothing is rolled back
or silently repaired. A new preview rereads accepted engine state before a retry.

## Export and defaults

Export reads current Project definitions and registered Contracts/Datasets from the
engine, shows a YAML diff, then writes only after **Confirm Export**. It includes
engine-returned documented defaults explicitly, rather than guessing them. It updates
existing split documents too; obsolete resources that need file deletion are reported
instead of silently retained as active configuration. Apply compares documented
defaults without inserting them into authored YAML. An Export is refused if its
subsequent Apply plan would contain any engine write. The independent browser check
verifies Export → Apply reports zero changes.

The independent Volume XV check authors two Scenarios through the two paths, retrieves
both API definitions and compares every field other than their intentionally different
names. Since no read-only effective-Contract endpoint exists, it also runs the Suite
and compares the engine's frozen `configuration.contract` for the two Executions.
No effective Contract is calculated by the UI or the workspace service.
