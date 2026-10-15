use crate::{
    import_env_file_inner, is_sensitive, keychain_delete, keychain_get, keychain_set, pool,
    validate_key, validate_scope, DbError, DbResult, EnvVar, KEYCHAIN_SENTINEL,
};

// ── Error-mapping helpers ────────────────────────────────────────────────────

/// Map a `String` validation error to the typed `Validation` category.
fn validation(e: String) -> DbError {
    DbError::Validation(e)
}

/// Fetch the connection pool, mapping the uninitialized case to `NotInitialized`.
fn require_pool() -> DbResult<&'static sqlx::SqlitePool> {
    pool().map_err(|_| DbError::NotInitialized)
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/// Replace the keychain sentinel in a row's `value` with the real secret read
/// back from the OS keychain. If the keychain entry is missing (e.g. it was
/// removed out-of-band), the value is blanked rather than leaking the sentinel.
fn resolve_sensitive(mut row: EnvVar) -> EnvVar {
    if row.value == KEYCHAIN_SENTINEL {
        row.value = keychain_get(&row.scope, &row.key)
            .ok()
            .flatten()
            .unwrap_or_default();
    }
    row
}

/// Insert one secret within an open transaction. Validates the key (invalid
/// keys are recorded in `skipped` and skipped, not fatal), routes sensitive
/// values to the OS keychain, and upserts the row. Returns `Ok(true)` when a
/// row was imported, `Ok(false)` when the key was skipped.
async fn insert_secret(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    scope: &str,
    key: &str,
    value: String,
    skipped: &mut Vec<String>,
) -> DbResult<bool> {
    if validate_key(key).is_err() {
        skipped.push(key.to_string());
        return Ok(false);
    }

    let stored_value = if is_sensitive(key) {
        keychain_set(scope, key, &value).map_err(DbError::Keychain)?;
        KEYCHAIN_SENTINEL.to_string()
    } else {
        value
    };

    sqlx::query(
        "INSERT INTO env_vars (key, value, scope) VALUES (?, ?, ?)
         ON CONFLICT(key, scope) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(&stored_value)
    .bind(scope)
    .execute(&mut **tx)
    .await?;
    Ok(true)
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_env_vars(scope: Option<String>) -> DbResult<Vec<EnvVar>> {
    if let Some(ref s) = scope {
        validate_scope(s).map_err(validation)?;
    }
    let pool = require_pool()?;
    let rows = match scope {
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
    }?;

    Ok(rows.into_iter().map(resolve_sensitive).collect())
}

#[tauri::command]
pub async fn upsert_env_var(key: String, value: String, scope: String) -> DbResult<EnvVar> {
    validate_scope(&scope).map_err(validation)?;
    validate_key(&key).map_err(validation)?;
    let pool = require_pool()?;

    // Security 2.3: store sensitive values in OS keychain
    let stored_value = if is_sensitive(&key) {
        keychain_set(&scope, &key, &value).map_err(DbError::Keychain)?;
        KEYCHAIN_SENTINEL.to_string() // sentinel value in DB
    } else {
        value
    };

    sqlx::query(
        "INSERT INTO env_vars (key, value, scope) VALUES (?, ?, ?)
         ON CONFLICT(key, scope) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&stored_value)
    .bind(&scope)
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE key = ? AND scope = ?")
        .bind(&key)
        .bind(&scope)
        .fetch_one(pool)
        .await?;
    Ok(resolve_sensitive(row))
}

#[tauri::command]
pub async fn delete_env_var(id: i64, scope: String) -> DbResult<()> {
    validate_scope(&scope).map_err(validation)?;
    let pool = require_pool()?;

    // Look up the row first so we can clean up its keychain entry (if any)
    // before deleting. Without this, deleting a sensitive var orphans the
    // credential in the OS keychain forever.
    let existing: Option<EnvVar> =
        sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE id = ? AND scope = ?")
            .bind(id)
            .bind(&scope)
            .fetch_optional(pool)
            .await?;

    sqlx::query("DELETE FROM env_vars WHERE id = ? AND scope = ?")
        .bind(id)
        .bind(&scope)
        .execute(pool)
        .await?;

    if let Some(row) = existing {
        if row.value == KEYCHAIN_SENTINEL {
            // Best-effort cleanup; a stale keychain entry is non-fatal.
            let _ = keychain_delete(&row.scope, &row.key);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn import_env_file(content: String, scope: String) -> DbResult<crate::ImportResult> {
    validate_scope(&scope).map_err(validation)?;
    let pool = require_pool()?;
    import_env_file_inner(pool, &content, &scope)
        .await
        .map_err(DbError::Storage)
}

/// Bug 1.4: quote values containing spaces, =, #, or newlines.
#[tauri::command]
pub async fn export_env_scope(scope: String) -> DbResult<String> {
    validate_scope(&scope).map_err(validation)?;
    let pool = require_pool()?;
    let rows = sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE scope = ? ORDER BY key")
        .bind(&scope)
        .fetch_all(pool)
        .await?;
    let content = rows
        .into_iter()
        .map(resolve_sensitive)
        .map(|v| {
            let val = &v.value;
            let needs_quotes =
                val.contains(' ') || val.contains('=') || val.contains('#') || val.contains('\n');
            if needs_quotes {
                format!("{}=\"{}\"", v.key, val.replace('"', "\\\""))
            } else {
                format!("{}={}", v.key, val)
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    Ok(content)
}

/// Architecture 4.2: moved from settings/mod.rs
#[tauri::command]
pub async fn clear_all_env_vars() -> DbResult<u64> {
    let pool = require_pool()?;
    // Clean up keychain entries before deleting DB rows
    let sensitive: Vec<(String, String)> =
        sqlx::query_as("SELECT key, scope FROM env_vars WHERE value = ?")
            .bind(KEYCHAIN_SENTINEL)
            .fetch_all(pool)
            .await?;
    for (key, scope) in sensitive {
        // Best-effort cleanup; a stale keychain entry is non-fatal.
        let _ = keychain_delete(&scope, &key);
    }
    let result = sqlx::query("DELETE FROM env_vars").execute(pool).await?;
    Ok(result.rows_affected())
}

#[tauri::command]
pub async fn import_secrets(
    content: String,
    format: String,
    scope: String,
) -> DbResult<crate::ImportResult> {
    validate_scope(&scope).map_err(validation)?;
    let pool = require_pool()?;

    match format.as_str() {
        "kubernetes" => {
            let yaml: serde_yaml::Value = serde_yaml::from_str(&content)
                .map_err(|e| DbError::Validation(format!("Invalid YAML: {e}")))?;

            // A Kubernetes Secret may carry base64-encoded entries under `data`
            // and/or plaintext entries under `stringData`. Support both; at
            // least one must be present.
            let data_map = yaml.get("data").and_then(|d| d.as_mapping());
            let string_data_map = yaml.get("stringData").and_then(|d| d.as_mapping());
            if data_map.is_none() && string_data_map.is_none() {
                return Err(DbError::Validation(
                    "No 'data' or 'stringData' field found in Kubernetes Secret".to_string(),
                ));
            }

            let mut tx = pool.begin().await?;
            let mut imported = 0u32;
            let mut skipped: Vec<String> = Vec::new();

            use base64::Engine;

            // Base64-encoded `data` entries.
            if let Some(map) = data_map {
                for (k, v) in map {
                    let key = k
                        .as_str()
                        .ok_or_else(|| DbError::Validation("Key is not a string".into()))?
                        .to_string();
                    let encoded_val = v
                        .as_str()
                        .ok_or_else(|| DbError::Validation("Value is not a string".into()))?;
                    let decoded_bytes = base64::engine::general_purpose::STANDARD
                        .decode(encoded_val.trim())
                        .map_err(|e| {
                            DbError::Validation(format!(
                                "Failed to decode base64 for key {key}: {e}"
                            ))
                        })?;
                    let value = String::from_utf8(decoded_bytes).map_err(|e| {
                        DbError::Validation(format!("Value for key {key} is not valid UTF-8: {e}"))
                    })?;
                    if insert_secret(&mut tx, &scope, &key, value, &mut skipped).await? {
                        imported += 1;
                    }
                }
            }

            // Plaintext `stringData` entries (take precedence per Kubernetes).
            if let Some(map) = string_data_map {
                for (k, v) in map {
                    let key = k
                        .as_str()
                        .ok_or_else(|| DbError::Validation("Key is not a string".into()))?
                        .to_string();
                    let value = v
                        .as_str()
                        .ok_or_else(|| DbError::Validation("Value is not a string".into()))?
                        .to_string();
                    if insert_secret(&mut tx, &scope, &key, value, &mut skipped).await? {
                        imported += 1;
                    }
                }
            }

            tx.commit().await?;
            Ok(crate::ImportResult { imported, skipped })
        }
        "docker" => {
            // Docker secrets can be env files or single value files.
            // We reuse env file parser for multi-line support.
            import_env_file_inner(pool, &content, &scope)
                .await
                .map_err(DbError::Storage)
        }
        other => Err(DbError::Validation(format!("Unsupported format: {other}"))),
    }
}

/// Architecture 4.4: settings table commands
#[tauri::command]
pub async fn get_setting(key: String) -> DbResult<Option<String>> {
    let pool = require_pool()?;
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|(v,)| v))
}

#[tauri::command]
pub async fn set_setting(key: String, value: String) -> DbResult<()> {
    const ALLOWED_SETTINGS: &[&str] = &["poll_containers", "poll_stats", "docker_socket"];
    if !ALLOWED_SETTINGS.contains(&key.as_str()) {
        return Err(DbError::Validation(format!("Unknown setting key: {key}")));
    }
    let pool = require_pool()?;
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn get_db_pool_stats() -> DbResult<crate::DbPoolStats> {
    crate::get_pool_stats().map_err(|_| DbError::NotInitialized)
}
