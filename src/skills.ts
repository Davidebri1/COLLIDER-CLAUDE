// Shared with AgentSkillsDrawer (toggle UI) and chat.ts (actual system-prompt
// injection) — was previously defined only inline in the drawer, so toggling
// a skill had nothing to inject into a real request. `instruction` is the
// literal text spliced into the system prompt when a skill is active;
// `desc` is the shorter blurb shown in the toggle list UI.
export type ConsoleSkill = { id: string; name: string; desc: string; instruction: string };

export const CONSOLE_SKILLS: ConsoleSkill[] = [
  {
    id: "accidental-data-loss-prevention",
    name: "Accidental Data Loss Prevention",
    desc: "Verifies Drop, Truncate, or broad Delete SQL statements.",
    instruction: "Before outputting any SQL containing DROP, TRUNCATE, or an unfiltered/broad DELETE, flag it explicitly and ask for confirmation or suggest a safer scoped alternative (e.g. a WHERE clause, a soft-delete flag, or a transaction with rollback) instead of emitting it silently.",
  },
  {
    id: "dbt-bigquery",
    name: "dbt BigQuery Compiler",
    desc: "Injects dbt analytics compile structures.",
    instruction: "When writing SQL for dbt models, use dbt conventions: {{ ref() }}/{{ source() }} for table references, a config() block for materialization, and BigQuery-specific syntax (backtick-quoted identifiers, STRUCT/ARRAY types) where relevant.",
  },
  {
    id: "ml-best-practices",
    name: "ML Best Practices",
    desc: "Forces statistical validation criteria on regression/clustering.",
    instruction: "When proposing or reviewing a regression, classification, or clustering approach, explicitly call out the validation strategy (train/test split or cross-validation), the relevant evaluation metric for the problem type, and any obvious risk of overfitting or data leakage.",
  },
  {
    id: "gcp-composer-troubleshooting",
    name: "GCP Composer Diagnostics",
    desc: "Airflow DAG debugging and Root Cause Analysis.",
    instruction: "When debugging Airflow/Composer DAGs, reason through the DAG's task dependency graph and scheduler state explicitly, and structure the answer as a root-cause analysis (symptom, likely cause, verification step, fix) rather than a generic suggestion list.",
  },
  {
    id: "dataform-bigquery",
    name: "Dataform Pipeline Compiler",
    desc: "Configures dataform workflow sqlx pipelines.",
    instruction: "When writing Dataform pipelines, use .sqlx file conventions: a config {} block, ref() for dependencies, and BigQuery-compatible SQL within the query body.",
  },
];
