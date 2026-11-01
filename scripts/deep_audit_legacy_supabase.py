"""Read-only cross-project audit of job/scanner/user keys; no PII in report."""
import json
import os
from pathlib import Path
from datetime import datetime, timezone
import psycopg
from psycopg import sql

TABLES = ("jobs", "scout_runs", "scout_source_metrics", "scout_companies",
          "profiles", "user_roles", "organizations", "unique_scanner_sites",
          "talent_profiles", "talent_assignments", "job_applications")
NATURAL = {"jobs": ("source", "external_id")}
def keys(conn, table, cols):
    query = sql.SQL("select {} from {}").format(
        sql.SQL(", ").join(map(sql.Identifier, cols)), sql.Identifier("public", table))
    return {tuple(row) for row in conn.execute(query) if all(v is not None for v in row)}
def cols(conn, table):
    return {x[0] for x in conn.execute(
        "select column_name from information_schema.columns where table_schema='public' and table_name=%s", (table,))}
def pks(conn, table):
    return tuple(r[0] for r in conn.execute("""
        select a.attname from pg_index i
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
        where i.indrelid=%s::regclass and i.indisprimary
        order by array_position(i.indkey,a.attnum)
    """, ("public."+table,)))
def auth(conn):
    return {r[0]:r[1] for r in conn.execute("select id, lower(email) from auth.users")}
report = {"created_at": datetime.now(timezone.utc).isoformat(), "tables": {},
          "auth": {}, "cautions": [
            "Read-only report; no records were migrated.",
            "Natural-key matches can mask differing contents; inspect before merge.",
            "Auth identity must be reconciled before migrating user-owned records.",
            "Back up both projects before any write migration."]}
source_url=os.environ["SOURCE_DATABASE_URL"]
target_url=os.environ["TARGET_DATABASE_URL"]
if source_url == target_url:
    raise SystemExit("Refusing identical source and target")
with psycopg.connect(source_url, connect_timeout=20) as source, psycopg.connect(target_url, connect_timeout=20) as target:
    source.autocommit=True
    target.autocommit=True
    source_users, target_users = auth(source), auth(target)
    target_emails = {email for email in target_users.values() if email}
    report["auth"] = {"source_users":len(source_users),"target_users":len(target_users),
                      "source_ids_absent_in_target":len(set(source_users)-set(target_users)),
                      "source_emails_absent_in_target":sum(bool(email) and email not in target_emails for email in source_users.values()),
                      "source_emails_present_with_different_ids":sum(
                          bool(email) and email in target_emails and uid not in target_users
                          for uid,email in source_users.items())}
    for table in TABLES:
        sc,tc=cols(source,table),cols(target,table)
        key=NATURAL.get(table) or pks(source,table)
        if not key or not set(key).issubset(sc&tc):
            report["tables"][table]={"status":"no_common_key"}
            continue
        sk,tk=keys(source,table,key),keys(target,table,key)
        report["tables"][table]={
            "key_columns":key, "source_distinct_key_count":len(sk),
            "target_distinct_key_count":len(tk),
            "source_keys_missing_in_target":len(sk-tk),
            "target_keys_missing_in_source":len(tk-sk),
            "source_columns_absent_in_target":sorted(sc-tc),
            "target_columns_absent_in_source":sorted(tc-sc)}
        if table=="jobs":
            for conn,label in ((source,"source"),(target,"target")):
                report["tables"][table][label+"_unkeyed_rows"]=conn.execute(
                    "select count(*) from public.jobs where source is null or external_id is null"
                ).fetchone()[0]
Path("deep-audit-report.json").write_text(json.dumps(report,indent=2,default=str))
print(json.dumps(report,indent=2,default=str))
