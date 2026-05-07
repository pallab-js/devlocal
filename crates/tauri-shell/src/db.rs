use crate::error::Result;
use db::{self, EnvVar};

#[tauri::command]
pub async fn list_env_vars(scope: Option<String>) -> Result<Vec<EnvVar>> {
    db::commands::list_env_vars(scope)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn upsert_env_var(key: String, value: String, scope: String) -> Result<EnvVar> {
    db::commands::upsert_env_var(key, value, scope)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn delete_env_var(id: i64, scope: String) -> Result<()> {
    db::commands::delete_env_var(id, scope)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn import_env_file(content: String, scope: String) -> Result<u32> {
    db::commands::import_env_file(content, scope)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn export_env_scope(scope: String) -> Result<String> {
    db::commands::export_env_scope(scope)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn clear_all_env_vars() -> Result<u64> {
    db::commands::clear_all_env_vars()
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn get_setting(key: String) -> Result<Option<String>> {
    db::commands::get_setting(key)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn set_setting(key: String, value: String) -> Result<()> {
    db::commands::set_setting(key, value)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn import_secrets(content: String, format: String, scope: String) -> Result<u32> {
    db::commands::import_secrets(content, format, scope)
        .await
        .map_err(crate::error::AppError::Generic)
}

#[tauri::command]
pub async fn get_db_pool_stats() -> Result<db::DbPoolStats> {
    db::commands::get_db_pool_stats()
        .await
        .map_err(crate::error::AppError::Generic)
}
