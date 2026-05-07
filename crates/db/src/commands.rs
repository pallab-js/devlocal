use crate::{
    import_env_file_inner, is_sensitive, pool, validate_key, validate_scope, EnvVar,
    KEYRING_SERVICE,
};

#[tauri::command]
pub async fn list_env_vars(scope: Option<String>) -> Result<Vec<EnvVar>, String> {
    if let Some(ref s) = scope {
        validate_scope(s)?;
    }
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
    validate_scope(&scope)?;
    validate_key(&key)?;
    let pool = pool()?;

    // Security 2.3: store sensitive values in OS keychain
    let stored_value = if is_sensitive(&key) {
        let keyring_key = format!("{scope}:{key}");
        let entry =
            keyring::Entry::new(KEYRING_SERVICE, &keyring_key).map_err(|e| e.to_string())?;
        entry.set_password(&value).map_err(|e| e.to_string())?;
        "__keychain__".to_string() // sentinel value in DB
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
pub async fn delete_env_var(id: i64, scope: String) -> Result<(), String> {
    validate_scope(&scope)?;
    let pool = pool()?;
    sqlx::query("DELETE FROM env_vars WHERE id = ? AND scope = ?")
        .bind(id)
        .bind(&scope)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn import_env_file(content: String, scope: String) -> Result<u32, String> {
    validate_scope(&scope)?;
    let pool = pool()?;
    import_env_file_inner(pool, &content, &scope).await
}

/// Bug 1.4: quote values containing spaces, =, #, or newlines.
#[tauri::command]
pub async fn export_env_scope(scope: String) -> Result<String, String> {
    validate_scope(&scope)?;
    let pool = pool()?;
    let rows = sqlx::query_as::<_, EnvVar>("SELECT * FROM env_vars WHERE scope = ? ORDER BY key")
        .bind(&scope)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    let content = rows
        .iter()
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
pub async fn clear_all_env_vars() -> Result<u64, String> {
    let pool = pool()?;
    // Clean up keychain entries before deleting DB rows
    let sensitive: Vec<(String, String)> =
        sqlx::query_as("SELECT key, scope FROM env_vars WHERE value = '__keychain__'")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
    for (key, scope) in sensitive {
        let keyring_key = format!("{scope}:{key}");
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &keyring_key) {
            let _ = entry.delete_credential();
        }
    }
    let result = sqlx::query("DELETE FROM env_vars")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}

#[tauri::command]
pub async fn import_secrets(content: String, format: String, scope: String) -> Result<u32, String> {
    validate_scope(&scope)?;
    let pool = pool()?;

    match format.as_str() {
        "kubernetes" => {
            let yaml: serde_yaml::Value =
                serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
            let data = yaml
                .get("data")
                .ok_or("No 'data' field found in Kubernetes Secret")?;
            let data_map = data.as_mapping().ok_or("'data' field is not a map")?;

            let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
            let mut count = 0u32;

            use base64::Engine;
            for (k, v) in data_map {
                let key = k.as_str().ok_or("Key is not a string")?.to_string();
                let encoded_val = v.as_str().ok_or("Value is not a string")?;

                let decoded_bytes = base64::engine::general_purpose::STANDARD
                    .decode(encoded_val.trim())
                    .map_err(|e| format!("Failed to decode base64 for key {}: {}", key, e))?;
                let value = String::from_utf8(decoded_bytes)
                    .map_err(|e| format!("Value for key {} is not valid UTF-8: {}", key, e))?;

                sqlx::query(
                    "INSERT INTO env_vars (key, value, scope) VALUES (?, ?, ?)
                     ON CONFLICT(key, scope) DO UPDATE SET value = excluded.value",
                )
                .bind(&key)
                .bind(&value)
                .bind(&scope)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
                count += 1;
            }
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok(count)
        }
        "docker" => {
            // Docker secrets can be env files or single value files.
            // We reuse env file parser for multi-line support.
            import_env_file_inner(pool, &content, &scope).await
        }
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

/// Architecture 4.4: settings table commands
#[tauri::command]
pub async fn get_setting(key: String) -> Result<Option<String>, String> {
    let pool = pool()?;
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.map(|(v,)| v))
}

#[tauri::command]
pub async fn set_setting(key: String, value: String) -> Result<(), String> {
    const ALLOWED_SETTINGS: &[&str] = &["poll_containers", "poll_stats", "docker_socket"];
    if !ALLOWED_SETTINGS.contains(&key.as_str()) {
        return Err(format!("Unknown setting key: {key}"));
    }
    let pool = pool()?;
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_db_pool_stats() -> Result<crate::DbPoolStats, String> {
    crate::get_pool_stats()
}
