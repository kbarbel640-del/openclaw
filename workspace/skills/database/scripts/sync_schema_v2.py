#!/usr/bin/env python3
"""
Schema synchronization script v2 - Use the existing db_tool to fetch live schema.

This approach uses the db_tool.py itself to inspect all tables and build the schema.json.
This is simpler and reuses the existing logic.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# Set environment variables from .env file
env_file = Path(__file__).parent.parent / ".env"
env_vars = {}

if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env_vars[key] = value
                os.environ[key] = value

def run_db_tool(args: list[str]) -> Dict[str, Any]:
    """Run db_tool.py and return parsed JSON result."""
    cmd = [sys.executable, "db_tool.py"] + args
    
    result = subprocess.run(
        cmd,
        cwd=Path(__file__).parent,
        capture_output=True,
        text=True,
        env={**os.environ, **env_vars}
    )
    
    if result.returncode != 0:
        print(f"ERROR: db_tool failed: {result.stderr}")
        sys.exit(1)
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse JSON: {e}")
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        sys.exit(1)

def get_live_schema() -> Dict[str, Any]:
    """Build complete schema by inspecting each table via db_tool."""
    print("Fetching live schema using db_tool...")
    
    # Get list of tables
    tables_result = run_db_tool(["inspect"])
    if not tables_result.get("success"):
        print(f"ERROR: Failed to list tables: {tables_result}")
        sys.exit(1)
    
    table_names = tables_result.get("tables", [])
    print(f"Found {len(table_names)} tables: {table_names}")
    
    # Build schema structure
    schema = {
        "version": "v2",
        "domain": "live_database",
        "description": "Live database schema synchronized from Supabase via db_tool",
        "last_sync": datetime.now(timezone.utc).isoformat(),
        "tables": {}
    }
    
    # Inspect each table in detail
    for table_name in table_names:
        print(f"Inspecting table: {table_name}")
        
        table_result = run_db_tool(["inspect", table_name, "--detailed"])
        if not table_result.get("success"):
            print(f"WARNING: Failed to inspect table {table_name}: {table_result}")
            continue
        
        # The detailed result already has the structure we want
        schema["tables"][table_name] = {
            "name": table_name,
            "description": table_result.get("description", f"Table {table_name}"),
            "columns": table_result.get("columns", {})
        }
        
        # Add relationships if present
        if table_result.get("relationships"):
            schema["tables"][table_name]["relationships"] = table_result["relationships"]
        
        # Add indexes if present  
        if table_result.get("indexes"):
            schema["tables"][table_name]["indexes"] = table_result["indexes"]
            
        # Add business rules if present
        if table_result.get("business_rules"):
            schema["tables"][table_name]["business_rules"] = table_result["business_rules"]
    
    print(f"Built live schema for {len(schema['tables'])} tables")
    return schema

def compare_schemas(live_schema: Dict[str, Any], static_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Compare live schema with static schema and report differences."""
    differences = {
        "tables_added": [],
        "tables_removed": [],
        "columns_added": {},
        "columns_removed": {},
        "columns_changed": {},
        "type_changes": {},
        "summary": ""
    }
    
    live_tables = set(live_schema.get("tables", {}).keys())
    static_tables = set(static_schema.get("tables", {}).keys())
    
    # Check for table differences
    differences["tables_added"] = sorted(live_tables - static_tables)
    differences["tables_removed"] = sorted(static_tables - live_tables)
    
    # Check column differences for common tables
    common_tables = live_tables & static_tables
    
    for table in common_tables:
        live_cols = live_schema["tables"][table].get("columns", {})
        static_cols = static_schema["tables"][table].get("columns", {})
        
        live_col_names = set(live_cols.keys())
        static_col_names = set(static_cols.keys())
        
        cols_added = live_col_names - static_col_names
        cols_removed = static_col_names - live_col_names
        
        if cols_added:
            differences["columns_added"][table] = sorted(cols_added)
        if cols_removed:
            differences["columns_removed"][table] = sorted(cols_removed)
        
        # Check for type changes in common columns
        common_cols = live_col_names & static_col_names
        type_changes = []
        
        for col in common_cols:
            live_col = live_cols[col]
            static_col = static_cols[col]
            
            live_type = live_col.get("type") if isinstance(live_col, dict) else None
            static_type = static_col.get("type") if isinstance(static_col, dict) else None
            
            if live_type and static_type and live_type != static_type:
                type_changes.append({
                    "column": col,
                    "live_type": live_type,
                    "static_type": static_type
                })
        
        if type_changes:
            differences["type_changes"][table] = type_changes
    
    # Generate summary
    summary_parts = []
    if differences["tables_added"]:
        summary_parts.append(f"{len(differences['tables_added'])} tables added")
    if differences["tables_removed"]:
        summary_parts.append(f"{len(differences['tables_removed'])} tables removed")
    
    col_adds = sum(len(v) for v in differences["columns_added"].values())
    if col_adds:
        summary_parts.append(f"{col_adds} columns added")
        
    col_removes = sum(len(v) for v in differences["columns_removed"].values())
    if col_removes:
        summary_parts.append(f"{col_removes} columns removed")
        
    type_changes = sum(len(v) for v in differences["type_changes"].values())
    if type_changes:
        summary_parts.append(f"{type_changes} column types changed")
    
    if not summary_parts:
        differences["summary"] = "No differences found - schemas are in sync"
    else:
        differences["summary"] = ", ".join(summary_parts)
    
    return differences

def main():
    """Main sync function."""
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print("Usage: python sync_schema_v2.py [--compare-only]")
        print("  --compare-only: Only compare schemas, don't update schema.json")
        return
    
    compare_only = len(sys.argv) > 1 and sys.argv[1] == "--compare-only"
    
    # Paths
    schema_path = Path(__file__).parent.parent / "references" / "schema.json"
    backup_path = schema_path.with_suffix(".json.backup")
    
    # Load current static schema
    if schema_path.exists():
        with open(schema_path) as f:
            static_schema = json.load(f)
        print(f"Loaded static schema with {len(static_schema.get('tables', {}))} tables")
    else:
        static_schema = {"tables": {}}
        print("No existing schema.json found")
    
    # Get live schema
    try:
        live_schema = get_live_schema()
    except Exception as e:
        print(f"ERROR: Failed to fetch live schema: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Compare schemas
    differences = compare_schemas(live_schema, static_schema)
    
    print("\n" + "="*60)
    print("SCHEMA COMPARISON RESULTS")
    print("="*60)
    print(f"Summary: {differences['summary']}")
    
    if differences["tables_added"]:
        print(f"\n[+] Tables added: {differences['tables_added']}")
    if differences["tables_removed"]:
        print(f"\n[-] Tables removed: {differences['tables_removed']}")
    
    for table, cols in differences["columns_added"].items():
        print(f"\n[+] Columns added in {table}: {cols}")
    for table, cols in differences["columns_removed"].items():
        print(f"\n[-] Columns removed from {table}: {cols}")
    for table, changes in differences["type_changes"].items():
        print(f"\n[~] Type changes in {table}:")
        for change in changes:
            print(f"   {change['column']}: {change['static_type']} -> {change['live_type']}")
    
    if compare_only:
        print("\n[i] Comparison complete. No files were modified.")
        return
    
    # Backup existing schema
    if schema_path.exists():
        schema_path.rename(backup_path)
        print(f"\nBacked up existing schema to {backup_path.name}")
    
    # Write new schema
    with open(schema_path, "w", encoding="utf-8") as f:
        json.dump(live_schema, f, indent=2, ensure_ascii=False)
    
    print(f"Updated {schema_path}")
    print(f"Schema sync complete!")
    
    # Also add this as a sync-schema subcommand to db_tool.py
    print("\nTIP: You can also run this via:")
    print("    python scripts/db_tool.py sync-schema")

if __name__ == "__main__":
    main()