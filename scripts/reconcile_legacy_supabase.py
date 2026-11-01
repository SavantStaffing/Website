"""Conservative public-schema reconciliation. Never deletes or overwrites target rows."""
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg import sql

MODE = os.environ.get("MIGRATION_MODE", "audit")
if MODE not in ("audit", "migrate"):
    raise SystemExit("MIGRATION_MODE must be audit or migrate")
SOURCE = os.environ["SOURCE_DATABASE_URL"]
TARGET = os.environ["TARGET_DATABASE_URL"]
if SOURCE == TARGET:
    raise SystemExit("Source and target URLs must differ")

# Identity tables and live configuration must be reviewed separately, not silently copied.
SKIP = {"profiles", "user_roles", "organizations", "scout_secrets",
        "scout_settings", "scout_companies", "talent_assignments",
        "talent_profiles", "talent_preferences", "saved_answers",
        "autofill_plans", "job_applications", "saved_jobs", "saved_talent",
        "application_requests", "notifications", "contact_messages",
        "service_requests", "coach_invites"}
# These natural keys can identify the same entity even when UUIDs differ.
NATURAL_KEYS = {
    "company_ratings": ("source", "normalized_name"),
    "employer_ethics": ("company_key",),
    "jobs": ("source", "external_id"),
    "unique_scanner_sites": ("url",),
}
report = {"mode": MODE, "generated_at": datetime.now(timezone.utc).isoformat(),
          "tables": {}, "warnings": [], "source_auth_users": None,
          "target_auth_users": None}

def tables(conn):
    return {r[0] for r in conn.execute(
        "select table_name from information_schema.tables "
        "where table_schema='public' and table_type='BASE TABLE'")}

def columns(conn, table):
    return {r[0] for r in conn.execute(
        "select column_name from information_schema.columns "
        "where table_schema='public' and table_name=%s", (table,))}

def pk(conn, table):
    return tuple(r[0] for r in conn.execute("""
        select a.attname from pg_index i
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
        where i.indrelid=%s::regclass and i.indisprimary
        order by array_position(i.indkey,a.attnum)
    """, ("public." + table,)))

def foreign_keys(conn, table):
    return list(conn.execute("""
        select distinct c.confrelid::regclass::text from pg_constraint c
        where c.conrelid=%s::regclass and c.contype='f'
    """, ("public." + table,)))

def fetch(conn, table, cols):
    query = sql.SQL("select {} from {}").format(
        sql.SQL(",").join(map(sql.Identifier, cols)),
        sql.Identifier("public", table))
    return conn.execute(query).fetchall()

def auth_count(conn):
    try:
        return conn.execute("select count(*) from auth.users").fetchone()[0]
    except psycopg.Error:
        conn.rollback()
        return "unavailable"

with psycopg.connect(SOURCE, connect_timeout=20) as source, \
     psycopg.connect(TARGET, connect_timeout=20) as target:
    source.autocommit = True
    target.autocommit = True
    report["source_auth_users"] = auth_count(source)
    report["target_auth_users"] = auth_count(target)
    src_tables, dst_tables = tables(source), tables(target)
    report["missing_target_tables"] = sorted(src_tables - dst_tables)
    if report["missing_target_tables"]:
        report["warnings"].append("Missing target tables require schema review; not auto-created.")
    for table in sorted(src_tables & dst_tables):
        src_cols, dst_cols = columns(source, table), columns(target, table)
        common = sorted(src_cols & dst_cols)
        key = NATURAL_KEYS.get(table)
        if key and not set(key).issubset(common):
            key = None
        if not key:
            source_pk, target_pk = pk(source, table), pk(target, table)
            if source_pk and source_pk == target_pk and set(source_pk).issubset(common):
                key = source_pk
        entry = {"source_columns_only": sorted(src_cols - dst_cols),
                 "target_columns_only": sorted(dst_cols - src_cols),
                 "key": key, "status": "audit", "missing": None, "inserted": 0}
        report["tables"][table] = entry
        if table in SKIP:
            entry["status"] = "manual_review_sensitive_or_configuration"
            continue
        if not key:
            entry["status"] = "manual_review_no_safe_key"
            continue
        if entry["source_columns_only"]:
            entry["status"] = "manual_review_schema_mismatch"
            continue
        if table == "jobs":
            # Null external IDs cannot be safely deduplicated using this key.
            entry["note"] = "Rows without source/external_id require separate review."
        refs = foreign_keys(target, table)
        if refs:
            entry["status"] = "manual_review_foreign_keys"
            entry["foreign_keys"] = refs
            continue
        src_rows = fetch(source, table, common)
        dst_keys = set(fetch(target, table, list(key)))
        key_indices = [common.index(c) for c in key]
        missing = [row for row in src_rows
                   if all(row[i] is not None for i in key_indices)
                   and tuple(row[i] for i in key_indices) not in dst_keys]
        entry["source_rows"] = len(src_rows)
        entry["target_rows"] = target.execute(
            sql.SQL("select count(*) from {}").format(sql.Identifier("public", table))
        ).fetchone()[0]
        entry["missing"] = len(missing)
        entry["unkeyed_source_rows"] = sum(
            any(row[i] is None for i in key_indices) for row in src_rows)
        if MODE != "migrate" or not missing:
            continue
        insert = sql.SQL("insert into {} ({}) values ({}) on conflict do nothing").format(
            sql.Identifier("public", table),
            sql.SQL(",").join(map(sql.Identifier, common)),
            sql.SQL(",").join(sql.Placeholder() for _ in common))
        # Each row is isolated: an FK or CHECK failure does not corrupt other rows.
        errors = []
        for row in missing:
            try:
                with target.transaction():
                    result = target.execute(insert, row)
                    entry["inserted"] += max(result.rowcount, 0)
            except psycopg.Error as exc:
                if len(errors) < 10:
                    errors.append({"sqlstate": exc.sqlstate, "reason": exc.diag.message_primary})
        if errors:
            entry["errors_sample"] = errors
            entry["status"] = "partial_needs_review"
        else:
            entry["status"] = "inserted"
        entry["target_rows_after"] = target.execute(
            sql.SQL("select count(*) from {}").format(sql.Identifier("public", table))
        ).fetchone()[0]

Path("migration-report.json").write_text(json.dumps(report, indent=2, default=str))
print(json.dumps({"mode": MODE, "tables": len(report["tables"]),
                  "missing_target_tables": report["missing_target_tables"],
                  "inserted": sum(v["inserted"] for v in report["tables"].values()),
                  "manual_review": [k for k,v in report["tables"].items()
                                   if v["status"].startswith("manual_review")]}, indent=2))
