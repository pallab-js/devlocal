use sqlx::{sqlite::SqliteConnectOptions, Connection, Row, SqliteConnection, TypeInfo, Column};
use std::time::Instant;

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../packages/shared/types/DbTableColumn.ts")]
pub struct DbTableColumn {
    pub name: String,
    pub data_type: String,
    pub not_null: bool,
    pub pk: bool,
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../packages/shared/types/DbTable.ts")]
pub struct DbTable {
    pub name: String,
    pub columns: Vec<DbTableColumn>,
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../packages/shared/types/DbSchema.ts")]
pub struct DbSchema {
    pub tables: Vec<DbTable>,
}

#[derive(serde::Serialize, ts_rs::TS, Debug, Clone)]
#[ts(export, export_to = "../../packages/shared/types/DbQueryResult.ts")]
pub struct DbQueryResult {
    pub columns: Vec<String>,
    #[ts(type = "any[]")]
    pub rows: Vec<serde_json::Value>,
    pub execution_time_ms: u64,
}

pub async fn discover_schema(db_path: &str) -> std::result::Result<DbSchema, String> {
    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .read_only(true);
    let mut conn = SqliteConnection::connect_with(&opts)
        .await
        .map_err(|e| e.to_string())?;

    // Query tables in SQLite
    let tables_rows = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for row in tables_rows {
        let table_name: String = row.get("name");
        
        // Get column details for table using table_info pragma
        let column_query = format!("PRAGMA table_info({});", table_name);
        let columns_rows = sqlx::query(&column_query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

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

pub async fn execute_query(db_path: &str, sql: &str) -> std::result::Result<DbQueryResult, String> {
    let start = Instant::now();
    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .read_only(true);
    let mut conn = SqliteConnection::connect_with(&opts)
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query(sql)
        .fetch_all(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

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
    for row in rows {
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
                        Some(val) => serde_json::Value::String(format!("<BLOB: {} bytes>", val.len())),
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

        sqlx::query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER);")
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
        let query_res = execute_query(db_path, "SELECT * FROM users;").await.unwrap();
        assert_eq!(query_res.columns, vec!["id".to_string(), "name".to_string(), "age".to_string()]);
        assert_eq!(query_res.rows.len(), 1);

        let row = query_res.rows[0].as_object().unwrap();
        assert_eq!(row.get("name").unwrap().as_str().unwrap(), "Alice");
        assert_eq!(row.get("age").unwrap().as_i64().unwrap(), 30);
    }
}
