use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::sync::OnceLock;
use tauri::Manager;

static POOL: OnceLock<SqlitePool> = OnceLock::new();

pub async fn init(app: &tauri::App) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let db_path = data_dir.join("devopslocal.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| e.to_string())?;

    // Enable WAL mode for better concurrent read performance
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| e.to_string())?;

    POOL.set(pool)
        .map_err(|_| "Pool already initialized".to_string())?;
    Ok(())
}

fn pool() -> Result<&'static SqlitePool, String> {
    POOL.get().ok_or_else(|| "DB not initialized".to_string())
}

pub fn get_pool() -> Result<&'static SqlitePool, String> {
    pool()
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, PartialEq)]
pub struct EnvVar {
    pub id: i64,
    pub key: String,
    pub value: String,
    pub scope: String,
}

#[tauri::command]
pub async fn list_env_vars(scope: Option<String>) -> Result<Vec<EnvVar>, String> {
    let pool = pool()?;
    match scope {
        Some(s) => {
            sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE scope = ? ORDER BY key")
                .bind(s)
                .fetch_all(pool)
                .await
        }
        None => {
            sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars ORDER BY scope, key")
                .fetch_all(pool)
                .await
        }
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_env_var(key: String, value: String, scope: String) -> Result<EnvVar, String> {
    let pool = pool()?;
    sqlx::query(
        "INSERT INTO env_vars (key, value, scope) VALUES (?, ?, ?)
         ON CONFLICT(key, scope) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .bind(&scope)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE key = ? AND scope = ?")
        .bind(&key)
        .bind(&scope)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_env_var(id: i64) -> Result<(), String> {
    let pool = pool()?;
    sqlx::query("DELETE FROM env_vars WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Parse a .env file content string and upsert all key=value pairs into the given scope.
#[tauri::command]
pub async fn import_env_file(content: String, scope: String) -> Result<u32, String> {
    let pool = pool()?;
    let mut count = 0u32;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            let key = k.trim().to_string();
            let value = v.trim().trim_matches('"').trim_matches('\'').to_string();
            if key.is_empty() {
                continue;
            }
            sqlx::query(
                "INSERT INTO env_vars (key, value, scope) VALUES (?, ?, ?)
                 ON CONFLICT(key, scope) DO UPDATE SET value = excluded.value",
            )
            .bind(&key)
            .bind(&value)
            .bind(&scope)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    Ok(count)
}

/// Export all env vars in a scope as a .env file content string.
#[tauri::command]
pub async fn export_env_scope(scope: String) -> Result<String, String> {
    let pool = pool()?;
    let rows = sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE scope = ? ORDER BY key")
        .bind(&scope)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    let content = rows
        .iter()
        .map(|v| format!("{}={}", v.key, v.value))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(content)
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE env_vars (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                key   TEXT NOT NULL,
                value TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                UNIQUE(key, scope)
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn test_insert_and_list() {
        let pool = test_pool().await;
        sqlx::query("INSERT INTO env_vars (key, value, scope) VALUES ('FOO', 'bar', 'global')")
            .execute(&pool)
            .await
            .unwrap();
        let rows: Vec<(String, String)> =
            sqlx::query_as("SELECT key, value FROM env_vars WHERE scope = 'global'")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "FOO");
        assert_eq!(rows[0].1, "bar");
    }

    #[tokio::test]
    async fn test_upsert() {
        let pool = test_pool().await;
        sqlx::query("INSERT INTO env_vars (key, value, scope) VALUES ('KEY', 'v1', 'global')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO env_vars (key, value, scope) VALUES ('KEY', 'v2', 'global')
             ON CONFLICT(key, scope) DO UPDATE SET value = excluded.value",
        )
        .execute(&pool)
        .await
        .unwrap();
        let (val,): (String,) = sqlx::query_as("SELECT value FROM env_vars WHERE key = 'KEY'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(val, "v2");
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = test_pool().await;
        sqlx::query("INSERT INTO env_vars (key, value, scope) VALUES ('DEL', 'x', 'global')")
            .execute(&pool)
            .await
            .unwrap();
        let (id,): (i64,) = sqlx::query_as("SELECT id FROM env_vars WHERE key = 'DEL'")
            .fetch_one(&pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM env_vars WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM env_vars")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count.0, 0);
    }

    #[tokio::test]
    async fn test_scope_filter() {
        let pool = test_pool().await;
        sqlx::query(
            "INSERT INTO env_vars (key, value, scope) VALUES ('A', '1', 'dev'), ('B', '2', 'prod')",
        )
        .execute(&pool)
        .await
        .unwrap();
        let rows: Vec<(String,)> = sqlx::query_as("SELECT key FROM env_vars WHERE scope = 'dev'")
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "A");
    }
}
