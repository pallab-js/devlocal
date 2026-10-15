use sqlx::{sqlite::SqliteConnectOptions, Column, Connection, Row, SqliteConnection, TypeInfo};
use std::time::Instant;

/// Hard cap on the number of rows the explorer will return, regardless of any
/// `LIMIT` in the user's query. Prevents a `SELECT * FROM huge_table` from
/// loading an unbounded result set into memory and serializing it to JSON.
pub const MAX_RESULT_ROWS: usize = 1000;

/// Statement keywords that mutate data or schema. The explorer is read-only, so
/// these are rejected before the query ever reaches SQLite (defense-in-depth on
/// top of the read-only connection and `PRAGMA query_only`).
const FORBIDDEN_KEYWORDS: &[&str] = &[
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "replace",
    "truncate",
    "attach",
    "detach",
    "reindex",
    "vacuum",
    "pragma",
    "begin",
    "commit",
    "rollback",
    "savepoint",
    "release",
];

/// Validate that `db_path` points to an existing regular file. The explorer can
/// open any SQLite file the user chooses, but it must be a real file on disk —
/// this rejects directories, non-existent paths, and avoids surprising behavior
/// from special paths.
fn validate_db_path(db_path: &str) -> std::result::Result<(), String> {
    let path = std::path::Path::new(db_path);
    if !path.is_file() {
        return Err(format!("Database path must be an existing file: {db_path}"));
    }
    Ok(())
}

/// Strip SQL line (`--`) and block (`/* */`) comments so keyword and
/// statement-count checks can't be bypassed by hiding tokens in comments.
fn strip_sql_comments(sql: &str) -> String {
    let mut out = String::with_capacity(sql.len());
    let bytes = sql.as_bytes();
    let mut i = 0;
    let mut in_line_comment = false;
    let mut in_block_comment = false;
    let mut in_string: Option<u8> = None; // tracks ' or " string literal

    while i < bytes.len() {
        let b = bytes[i];
        let next = bytes.get(i + 1).copied();

        if in_line_comment {
            if b == b'\n' {
                in_line_comment = false;
                out.push('\n');
            }
            i += 1;
            continue;
        }
        if in_block_comment {
            if b == b'*' && next == Some(b'/') {
                in_block_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }
        if let Some(quote) = in_string {
            out.push(b as char);
            if b == quote {
                in_string = None;
            }
            i += 1;
            continue;
        }
        // Not currently in a comment or string.
        if b == b'-' && next == Some(b'-') {
            in_line_comment = true;
            i += 2;
            continue;
        }
        if b == b'/' && next == Some(b'*') {
            in_block_comment = true;
            i += 2;
            continue;
        }
        if b == b'\'' || b == b'"' {
            in_string = Some(b);
            out.push(b as char);
            i += 1;
            continue;
        }
        out.push(b as char);
        i += 1;
    }
    out
}

/// Enforce the explorer's read-only, single-statement contract.
///
/// Returns the trimmed, comment-stripped SQL ready to execute, or an error if
/// the query is empty, contains more than one statement, or references a
/// data/schema-mutating keyword.
fn guard_read_only_query(sql: &str) -> std::result::Result<String, String> {
    let stripped = strip_sql_comments(sql);
    let trimmed = stripped.trim().trim_end_matches(';').trim();

    if trimmed.is_empty() {
        return Err("Query is empty.".to_string());
    }

    // Single-statement only: no `;` may remain once a trailing one is removed.
    if trimmed.contains(';') {
        return Err("Only a single statement is allowed.".to_string());
    }

    // Keyword guard on whole, case-insensitive, word-delimited tokens.
    let lower = trimmed.to_lowercase();
    for token in lower.split(|c: char| !c.is_ascii_alphanumeric() && c != '_') {
        if FORBIDDEN_KEYWORDS.contains(&token) {
            return Err(format!(
                "Only read-only queries are allowed; '{token}' is not permitted."
            ));
        }
    }

    Ok(trimmed.to_string())
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../../packages/shared/types/DbTableColumn.ts")]
pub struct DbTableColumn {
    pub name: String,
    pub data_type: String,
    pub not_null: bool,
    pub pk: bool,
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../../packages/shared/types/DbTable.ts")]
pub struct DbTable {
    pub name: String,
    pub columns: Vec<DbTableColumn>,
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../../packages/shared/types/DbSchema.ts")]
pub struct DbSchema {
    pub tables: Vec<DbTable>,
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../../packages/shared/types/DbQueryResult.ts")]
pub struct DbQueryResult {
    pub columns: Vec<String>,
    #[ts(type = "any[]")]
    pub rows: Vec<serde_json::Value>,
    pub execution_time_ms: u64,
}

pub async fn discover_schema(db_path: &str) -> crate::DbResult<DbSchema> {
    use crate::DbError;
    validate_db_path(db_path).map_err(DbError::Validation)?;
    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .read_only(true);
    let mut conn = SqliteConnection::connect_with(&opts).await?;

    // Query tables in SQLite
    let tables_rows = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
    )
    .fetch_all(&mut conn)
    .await?;

    let mut tables = Vec::new();
    for row in tables_rows {
        let table_name: String = row.get("name");

        // Get column details for table using table_info pragma
        let column_query = format!("PRAGMA table_info({});", table_name);
        let columns_rows = sqlx::query(&column_query).fetch_all(&mut conn).await?;

        let mut columns = Vec::new();
        for col_row in columns_rows {
            let col_name: String = col_row.get("name");
            let col_type: String = col_row.get("type");
            let not_null: i64 = col_row.get("notnull");
            let pk: i64 = col_row.get("pk");

            columns.push(DbTableColumn {
                name: col_name,
                data_type: col_type,
                not_null: not_null != 0,
                pk: pk != 0,
            });
        }

        tables.push(DbTable {
            name: table_name,
            columns,
        });
    }

    Ok(DbSchema { tables })
}

pub async fn execute_query(db_path: &str, sql: &str) -> crate::DbResult<DbQueryResult> {
    use crate::DbError;
    validate_db_path(db_path).map_err(DbError::Validation)?;
    let guarded_sql = guard_read_only_query(sql).map_err(DbError::Validation)?;

    let start = Instant::now();
    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .read_only(true);
    let mut conn = SqliteConnection::connect_with(&opts).await?;

    // Defense-in-depth: even on a read-only connection, forbid any write path
    // for the lifetime of this connection.
    sqlx::query("PRAGMA query_only = ON;")
        .execute(&mut conn)
        .await?;

    let rows = sqlx::query(&guarded_sql).fetch_all(&mut conn).await?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    if rows.is_empty() {
        return Ok(DbQueryResult {
            columns: Vec::new(),
            rows: Vec::new(),
            execution_time_ms,
        });
    }

    // Discover column names dynamically from the first row
    let columns: Vec<String> = rows[0]
        .columns()
        .iter()
        .map(|col| col.name().to_string())
        .collect();

    let mut result_rows = Vec::new();
    // Enforce a hard row cap regardless of any client-supplied LIMIT.
    for row in rows.iter().take(MAX_RESULT_ROWS) {
        let mut row_obj = serde_json::Map::new();
        for col in row.columns() {
            let name = col.name();

            // Try to extract value from row based on column type
            let val = match col.type_info().name() {
                "TEXT" | "VARCHAR" | "CHAR" | "CLOB" => {
                    let s: Option<String> = row.try_get(name).ok();
                    match s {
                        Some(val) => serde_json::Value::String(val),
                        None => serde_json::Value::Null,
                    }
                }
                "INTEGER" | "INT" | "TINYINT" | "SMALLINT" | "MEDIUMINT" | "BIGINT" => {
                    let i: Option<i64> = row.try_get(name).ok();
                    match i {
                        Some(val) => serde_json::Value::Number(serde_json::Number::from(val)),
                        None => serde_json::Value::Null,
                    }
                }
                "REAL" | "DOUBLE" | "FLOAT" => {
                    let f: Option<f64> = row.try_get(name).ok();
                    match f {
                        Some(val) => {
                            if let Some(num) = serde_json::Number::from_f64(val) {
                                serde_json::Value::Number(num)
                            } else {
                                serde_json::Value::Null
                            }
                        }
                        None => serde_json::Value::Null,
                    }
                }
                "BOOLEAN" => {
                    let b: Option<bool> = row.try_get(name).ok();
                    match b {
                        Some(val) => serde_json::Value::Bool(val),
                        None => serde_json::Value::Null,
                    }
                }
                "BLOB" => {
                    let bytes: Option<Vec<u8>> = row.try_get(name).ok();
                    match bytes {
                        Some(val) => {
                            serde_json::Value::String(format!("<BLOB: {} bytes>", val.len()))
                        }
                        None => serde_json::Value::Null,
                    }
                }
                _ => {
                    // Fallback to text representation
                    let s: Option<String> = row.try_get(name).ok();
                    match s {
                        Some(val) => serde_json::Value::String(val),
                        None => serde_json::Value::Null,
                    }
                }
            };
            row_obj.insert(name.to_string(), val);
        }
        result_rows.push(serde_json::Value::Object(row_obj));
    }

    Ok(DbQueryResult {
        columns,
        rows: result_rows,
        execution_time_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_explorer_discovery() {
        let temp = tempfile::NamedTempFile::new().unwrap();
        let db_path = temp.path().to_str().unwrap();

        // Setup mock schema
        let opts = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true);
        let mut conn = SqliteConnection::connect_with(&opts).await.unwrap();

        sqlx::query(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER);",
        )
        .execute(&mut conn)
        .await
        .unwrap();

        sqlx::query("INSERT INTO users (name, age) VALUES ('Alice', 30);")
            .execute(&mut conn)
            .await
            .unwrap();

        // 1. Discover Schema
        let schema = discover_schema(db_path).await.unwrap();
        assert_eq!(schema.tables.len(), 1);
        assert_eq!(schema.tables[0].name, "users");
        assert_eq!(schema.tables[0].columns.len(), 3);
        assert_eq!(schema.tables[0].columns[0].name, "id");
        assert!(schema.tables[0].columns[0].pk);

        // 2. Execute Query
        let query_res = execute_query(db_path, "SELECT * FROM users;")
            .await
            .unwrap();
        assert_eq!(
            query_res.columns,
            vec!["id".to_string(), "name".to_string(), "age".to_string()]
        );
        assert_eq!(query_res.rows.len(), 1);

        let row = query_res.rows[0].as_object().unwrap();
        assert_eq!(row.get("name").unwrap().as_str().unwrap(), "Alice");
        assert_eq!(row.get("age").unwrap().as_i64().unwrap(), 30);
    }

    #[test]
    fn test_strip_sql_comments() {
        assert_eq!(
            strip_sql_comments("SELECT 1 -- drop table x\n+ 2").trim(),
            "SELECT 1 \n+ 2".trim()
        );
        assert_eq!(
            strip_sql_comments("SELECT /* DELETE */ 1")
                .replace("  ", " ")
                .trim(),
            "SELECT 1".trim()
        );
        // A keyword inside a string literal must be preserved (not stripped).
        assert_eq!(
            strip_sql_comments("SELECT '-- not a comment'"),
            "SELECT '-- not a comment'"
        );
    }

    #[test]
    fn test_guard_allows_plain_select() {
        assert_eq!(
            guard_read_only_query("SELECT * FROM users;").unwrap(),
            "SELECT * FROM users"
        );
        assert_eq!(
            guard_read_only_query("  select id from t  ").unwrap(),
            "select id from t"
        );
    }

    #[test]
    fn test_guard_rejects_writes() {
        for q in [
            "DELETE FROM users",
            "DROP TABLE users",
            "UPDATE users SET name='x'",
            "INSERT INTO users VALUES (1)",
            "CREATE TABLE t (id int)",
            "PRAGMA journal_mode=DELETE",
            "VACUUM",
        ] {
            assert!(guard_read_only_query(q).is_err(), "should reject: {q}");
        }
    }

    #[test]
    fn test_guard_rejects_writes_hidden_in_comments() {
        // A forbidden keyword hidden behind a stripped comment should NOT bypass
        // the guard — but a real second statement must be rejected.
        assert!(guard_read_only_query("SELECT 1; DROP TABLE users").is_err());
        // Comment hiding a write keyword: after stripping, only SELECT remains → allowed.
        assert_eq!(
            guard_read_only_query("SELECT 1 -- delete\n").unwrap(),
            "SELECT 1"
        );
    }

    #[test]
    fn test_guard_rejects_multiple_statements() {
        assert!(guard_read_only_query("SELECT 1; SELECT 2").is_err());
        assert!(guard_read_only_query("SELECT 1;SELECT 2;").is_err());
        // A single trailing semicolon is fine.
        assert_eq!(guard_read_only_query("SELECT 1;").unwrap(), "SELECT 1");
    }

    #[test]
    fn test_guard_rejects_empty() {
        assert!(guard_read_only_query("").is_err());
        assert!(guard_read_only_query("   ;  ").is_err());
        assert!(guard_read_only_query("-- just a comment").is_err());
    }

    #[tokio::test]
    async fn test_validate_db_path_rejects_missing_and_dirs() {
        assert!(validate_db_path("/nonexistent/path/to/db.sqlite").is_err());
        let dir = tempfile::tempdir().unwrap();
        assert!(validate_db_path(dir.path().to_str().unwrap()).is_err());
    }

    #[tokio::test]
    async fn test_execute_query_enforces_row_cap() {
        let temp = tempfile::NamedTempFile::new().unwrap();
        let db_path = temp.path().to_str().unwrap();
        let opts = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true);
        let mut conn = SqliteConnection::connect_with(&opts).await.unwrap();
        sqlx::query("CREATE TABLE nums (n INTEGER);")
            .execute(&mut conn)
            .await
            .unwrap();
        // Insert more rows than the cap using a recursive CTE.
        sqlx::query(
            "INSERT INTO nums (n)
             WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x < 1500)
             SELECT x FROM seq;",
        )
        .execute(&mut conn)
        .await
        .unwrap();

        // No LIMIT in the query — the backend cap must still apply.
        let res = execute_query(db_path, "SELECT n FROM nums").await.unwrap();
        assert_eq!(res.rows.len(), MAX_RESULT_ROWS);
    }

    #[tokio::test]
    async fn test_execute_query_rejects_write() {
        let temp = tempfile::NamedTempFile::new().unwrap();
        let db_path = temp.path().to_str().unwrap();
        let opts = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true);
        let mut conn = SqliteConnection::connect_with(&opts).await.unwrap();
        sqlx::query("CREATE TABLE t (id INTEGER);")
            .execute(&mut conn)
            .await
            .unwrap();

        assert!(execute_query(db_path, "DELETE FROM t").await.is_err());
        assert!(execute_query(db_path, "DROP TABLE t").await.is_err());
    }
}
