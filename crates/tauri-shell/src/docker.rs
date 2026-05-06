use crate::error::Result;
use bollard::container::LogsOptions;
use bollard::system::EventsOptions;
use bollard::Docker;
use docker_ops::{
    self, ContainerDetails, ContainerInfo, ContainerStats, DockerEvent, HostStats, ImageInfo,
    LogLine, NetworkInfo, VolumeInfo,
};
use futures_util::StreamExt;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinHandle;

// ── Managed state ────────────────────────────────────────────────────────────

pub struct LogStreamState(pub Mutex<HashMap<String, JoinHandle<()>>>);
pub struct EventStreamState(pub Mutex<Option<JoinHandle<()>>>);
pub struct SysState(pub Mutex<System>);
pub struct DockerState(pub Option<Arc<Docker>>);

// ── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_containers(docker: State<'_, DockerState>) -> Result<Vec<ContainerInfo>> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::list_containers(docker).await?)
}

#[tauri::command]
pub async fn start_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<ContainerInfo> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::start_container(docker, &id).await?)
}

#[tauri::command]
pub async fn stop_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<ContainerInfo> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::stop_container(docker, &id).await?)
}

#[tauri::command]
pub async fn restart_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<ContainerInfo> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::restart_container(docker, &id).await?)
}

#[tauri::command]
pub async fn update_container_limits(
    id: String,
    cpu_shares: Option<i64>,
    memory_bytes: Option<i64>,
    docker: State<'_, DockerState>,
) -> Result<()> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::update_container_limits(docker, &id, cpu_shares, memory_bytes).await?)
}

#[tauri::command]
pub async fn inspect_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<ContainerDetails> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::inspect_container(docker, &id).await?)
}

#[tauri::command]
pub async fn get_host_stats(sys_state: State<'_, SysState>) -> Result<HostStats> {
    {
        let mut sys = sys_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
        sys.refresh_cpu_usage();
    }
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    let stats = {
        let mut sys = sys_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
        docker_ops::get_host_stats(&mut sys)
    };
    Ok(stats)
}

#[tauri::command]
pub async fn get_network_topology(
    docker: State<'_, DockerState>,
) -> Result<Vec<NetworkInfo>> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::get_network_topology(docker).await?)
}

#[tauri::command]
pub async fn inspect_network(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<NetworkInfo> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::inspect_network(docker, &id).await?)
}

#[tauri::command]
pub async fn stream_logs(
    container_id: String,
    tail: Option<u32>,
    app: AppHandle,
    log_state: State<'_, LogStreamState>,
    docker: State<'_, DockerState>,
) -> Result<()> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    {
        let mut guard = log_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
        if let Some(old) = guard.remove(&container_id) {
            old.abort();
        }
    }

    let tail_str = tail
        .map(|n| n.to_string())
        .unwrap_or_else(|| "100".to_string());
    let opts = LogsOptions::<String> {
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: tail_str,
        ..Default::default()
    };

    let docker_clone = Arc::clone(docker);
    let cid_clone = container_id.clone();
    let handle = tokio::spawn(async move {
        let mut stream = docker_clone.logs(&cid_clone, Some(opts));
        while let Some(Ok(msg)) = stream.next().await {
            let raw = msg.to_string();
            let (ts, text) = if let Some(idx) = raw.find(' ') {
                (raw[..idx].to_string(), raw[idx + 1..].to_string())
            } else {
                (String::new(), raw)
            };
            let _ = app.emit("log-line", LogLine {
                container_id: cid_clone.clone(),
                ts,
                text,
            });
        }
    });

    let mut guard = log_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
    guard.insert(container_id, handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_logs(
    container_id: Option<String>,
    log_state: State<'_, LogStreamState>
) -> Result<()> {
    let mut guard = log_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
    if let Some(id) = container_id {
        if let Some(handle) = guard.remove(&id) {
            handle.abort();
        }
    } else {
        for (_, handle) in guard.drain() {
            handle.abort();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn stream_docker_events(
    app: AppHandle,
    event_state: State<'_, EventStreamState>,
    docker: State<'_, DockerState>,
) -> Result<()> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    let docker_clone = Arc::clone(docker);
    let handle = tokio::spawn(async move {
        let mut stream = docker_clone.events(None::<EventsOptions<String>>);
        while let Some(Ok(event)) = stream.next().await {
            let ev = DockerEvent {
                kind: event.typ.map(|t| t.to_string()).unwrap_or_default(),
                action: event.action.unwrap_or_default(),
                actor: event.actor.and_then(|a| a.id).unwrap_or_default(),
                time: event.time.unwrap_or(0),
            };
            let _ = app.emit("docker-event", ev);
        }
    });

    let mut guard = event_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
    if let Some(old) = guard.take() {
        old.abort();
    }
    *guard = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_docker_events(event_state: State<'_, EventStreamState>) -> Result<()> {
    let mut guard = event_state.0.lock().map_err(|e| crate::error::AppError::Generic(e.to_string()))?;
    if let Some(handle) = guard.take() {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_container_stats(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<ContainerStats> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::get_container_stats(docker, &id).await?)
}

#[tauri::command]
pub async fn list_volumes(docker: State<'_, DockerState>) -> Result<Vec<VolumeInfo>> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::list_volumes(docker).await?)
}

#[tauri::command]
pub async fn prune_volumes(docker: State<'_, DockerState>) -> Result<u64> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::prune_volumes(docker).await?)
}

#[tauri::command]
pub async fn list_images(docker: State<'_, DockerState>) -> Result<Vec<ImageInfo>> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::list_images(docker).await?)
}

#[tauri::command]
pub async fn remove_image(id: String, docker: State<'_, DockerState>) -> Result<()> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    Ok(docker_ops::remove_image(docker, &id).await?)
}

#[tauri::command]
pub async fn pull_image(
    image: String,
    tag: String,
    app: AppHandle,
    docker: State<'_, DockerState>,
) -> Result<()> {
    let docker = docker.0.as_ref().ok_or_else(|| crate::error::AppError::Generic("Docker not connected".to_string()))?;
    let docker_clone = Arc::clone(docker);

    tokio::spawn(async move {
        let mut stream = docker_ops::pull_image(&docker_clone, image, tag);
        while let Some(res) = stream.next().await {
            match res {
                Ok(progress) => {
                    let _ = app.emit("pull-progress", progress);
                }
                Err(e) => {
                    let _ = app.emit("pull-error", e.to_string());
                    break;
                }
            }
        }
        let _ = app.emit("pull-finished", ());
    });

    Ok(())
}

#[tauri::command]
pub async fn compose_up(project_name: String, config_dir: String) -> Result<()> {
    Ok(docker_ops::compose_up(&project_name, &config_dir).await?)
}

#[tauri::command]
pub async fn compose_down(project_name: String, config_dir: String) -> Result<()> {
    Ok(docker_ops::compose_down(&project_name, &config_dir).await?)
}

pub fn start_health_monitor(app: AppHandle, docker: Arc<Docker>) {
    tokio::spawn(async move {
        loop {
            let online = docker.ping().await.is_ok();
            let _ = app.emit("app:dockerd-status", serde_json::json!({ "online": online }));
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });
}
