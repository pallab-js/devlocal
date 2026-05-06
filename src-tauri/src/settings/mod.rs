use bollard::Docker;
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
pub struct AppInfo {
    pub version: String,
    pub db_path: String,
}

#[tauri::command]
pub async fn get_app_info(app: tauri::AppHandle) -> Result<AppInfo, String> {
    let version = app.package_info().version.to_string();
    let db_path = app
        .path()
        .app_data_dir()
        .map(|p| p.join("devopslocal.db").display().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    Ok(AppInfo { version, db_path })
}

#[tauri::command]
pub async fn test_docker_connection(socket_path: Option<String>) -> Result<String, String> {
    let docker = match socket_path {
        Some(ref path) if !path.is_empty() => {
            Docker::connect_with_socket(path, 30, bollard::API_DEFAULT_VERSION)
                .map_err(|e| e.to_string())?
        }
        _ => Docker::connect_with_local_defaults().map_err(|e| e.to_string())?,
    };
    let info = docker.version().await.map_err(|e| e.to_string())?;
    Ok(format!(
        "Docker {} (API {})",
        info.version.unwrap_or_default(),
        info.api_version.unwrap_or_default()
    ))
}

#[tauri::command]
pub async fn clear_all_env_vars() -> Result<u64, String> {
    let pool = crate::db::get_pool()?;
    let result = sqlx::query("DELETE FROM env_vars")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.rows_affected())
}
