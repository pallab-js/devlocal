use crate::error::Result;
use db::{self, EnvVar};

#[tauri::command]
pub async fn list_env_vars(scope: Option<String>) -> Result<Vec<EnvVar>> {
    Ok(db::commands::list_env_vars(scope).await?)
}

#[tauri::command]
pub async fn upsert_env_var(key: String, value: String, scope: String) -> Result<EnvVar> {
    Ok(db::commands::upsert_env_var(key, value, scope).await?)
}

#[tauri::command]
pub async fn delete_env_var(id: i64, scope: String) -> Result<()> {
    Ok(db::commands::delete_env_var(id, scope).await?)
}

#[tauri::command]
pub async fn import_env_file(content: String, scope: String) -> Result<db::ImportResult> {
    Ok(db::commands::import_env_file(content, scope).await?)
}

#[tauri::command]
pub async fn export_env_scope(scope: String) -> Result<String> {
    Ok(db::commands::export_env_scope(scope).await?)
}

#[tauri::command]
pub async fn clear_all_env_vars() -> Result<u64> {
    Ok(db::commands::clear_all_env_vars().await?)
}

#[tauri::command]
pub async fn get_setting(key: String) -> Result<Option<String>> {
    Ok(db::commands::get_setting(key).await?)
}

#[tauri::command]
pub async fn set_setting(key: String, value: String) -> Result<()> {
    Ok(db::commands::set_setting(key, value).await?)
}

#[tauri::command]
pub async fn import_secrets(
    content: String,
    format: String,
    scope: String,
) -> Result<db::ImportResult> {
    Ok(db::commands::import_secrets(content, format, scope).await?)
}

#[tauri::command]
pub async fn get_db_pool_stats() -> Result<db::DbPoolStats> {
    Ok(db::commands::get_db_pool_stats().await?)
}

#[tauri::command]
pub async fn db_connect(path: String) -> Result<db::explorer::DbSchema> {
    Ok(db::explorer::discover_schema(&path).await?)
}

#[tauri::command]
pub async fn db_execute_query(path: String, sql: String) -> Result<db::explorer::DbQueryResult> {
    Ok(db::explorer::execute_query(&path, &sql).await?)
}
