use crate::error::Result;
use bollard::Docker;
use serde::Serialize;
use tauri::Manager;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export, export_to = "../../packages/shared/types/")]
pub struct AppInfo {
    pub version: String,
    pub db_path: String,
}

#[tauri::command]
pub async fn get_app_info(app: tauri::AppHandle) -> Result<AppInfo> {
    let version = app.package_info().version.to_string();
    let db_path = app
        .path()
        .app_data_dir()
        .map(|p| p.join("devopslocal.db").display().to_string())
        .map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
    Ok(AppInfo { version, db_path })
}

#[tauri::command]
pub async fn test_docker_connection(socket_path: Option<String>) -> Result<String> {
    let docker = match socket_path {
        Some(ref path) if !path.is_empty() => {
            Docker::connect_with_socket(path, 30, bollard::API_DEFAULT_VERSION)?
        }
        _ => Docker::connect_with_local_defaults()?,
    };
    let info = docker.version().await?;
    Ok(format!(
        "Docker {} (API {})",
        info.version.unwrap_or_default(),
        info.api_version.unwrap_or_default()
    ))
}
