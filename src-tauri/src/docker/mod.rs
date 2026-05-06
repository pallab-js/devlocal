use bollard::container::{
    ListContainersOptions, LogsOptions, RestartContainerOptions, StartContainerOptions,
    StopContainerOptions,
};
use bollard::models::ContainerSummary;
use bollard::system::EventsOptions;
use bollard::Docker;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use sysinfo::{Disks, System};
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinHandle;

// ── Managed state ────────────────────────────────────────────────────────────

pub struct LogStreamState(pub Mutex<Option<JoinHandle<()>>>);
pub struct SysState(pub Mutex<System>);

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub ports: Vec<String>,
    pub created: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerDetails {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub ports: Vec<String>,
    pub created: i64,
    pub env: Vec<String>,
    pub mounts: Vec<String>,
    pub cmd: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HostStats {
    pub cpu_percent: f64,
    pub mem_used_mb: u64,
    pub mem_total_mb: u64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkContainer {
    pub name: String,
    pub ipv4: String,
    pub mac: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    pub subnet: String,
    pub gateway: String,
    pub containers: Vec<NetworkContainer>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DockerEvent {
    pub kind: String,
    pub action: String,
    pub actor: String,
    pub time: i64,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn connect() -> Result<Docker, String> {
    Docker::connect_with_local_defaults().map_err(|e| e.to_string())
}

fn summary_to_info(c: ContainerSummary) -> ContainerInfo {
    let id = c.id.unwrap_or_default();
    let name = c
        .names
        .and_then(|n| n.into_iter().next())
        .unwrap_or_default()
        .trim_start_matches('/')
        .to_string();
    let image = c.image.unwrap_or_default();
    let status = c.status.unwrap_or_default();
    let state = c.state.unwrap_or_default();
    let ports = c
        .ports
        .unwrap_or_default()
        .iter()
        .filter_map(|p| {
            p.public_port
                .map(|pub_p| format!("{}:{}", pub_p, p.private_port))
        })
        .collect();
    ContainerInfo {
        id,
        name,
        image,
        status,
        state,
        ports,
        created: c.created.unwrap_or(0),
    }
}

async fn fetch_one(docker: &Docker, id: &str) -> Result<ContainerInfo, String> {
    let opts = ListContainersOptions::<String> {
        all: true,
        filters: {
            let mut m = HashMap::new();
            m.insert("id".to_string(), vec![id.to_string()]);
            m
        },
        ..Default::default()
    };
    docker
        .list_containers(Some(opts))
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .next()
        .map(summary_to_info)
        .ok_or_else(|| "Container not found".to_string())
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_containers() -> Result<Vec<ContainerInfo>, String> {
    let docker = connect()?;
    let containers = docker
        .list_containers(Some(ListContainersOptions::<String> {
            all: true,
            ..Default::default()
        }))
        .await
        .map_err(|e| e.to_string())?;
    Ok(containers.into_iter().map(summary_to_info).collect())
}

#[tauri::command]
pub async fn start_container(id: String) -> Result<ContainerInfo, String> {
    let docker = connect()?;
    docker
        .start_container(&id, None::<StartContainerOptions<String>>)
        .await
        .map_err(|e| e.to_string())?;
    fetch_one(&docker, &id).await
}

#[tauri::command]
pub async fn stop_container(id: String) -> Result<ContainerInfo, String> {
    let docker = connect()?;
    docker
        .stop_container(&id, Some(StopContainerOptions { t: 10 }))
        .await
        .map_err(|e| e.to_string())?;
    fetch_one(&docker, &id).await
}

#[tauri::command]
pub async fn restart_container(id: String) -> Result<ContainerInfo, String> {
    let docker = connect()?;
    docker
        .restart_container(&id, Some(RestartContainerOptions { t: 10 }))
        .await
        .map_err(|e| e.to_string())?;
    fetch_one(&docker, &id).await
}

#[tauri::command]
pub async fn inspect_container(id: String) -> Result<ContainerDetails, String> {
    let docker = connect()?;
    let info = docker
        .inspect_container(&id, None)
        .await
        .map_err(|e| e.to_string())?;
    let name = info
        .name
        .unwrap_or_default()
        .trim_start_matches('/')
        .to_string();
    let image = info
        .config
        .as_ref()
        .and_then(|c| c.image.clone())
        .unwrap_or_default();
    let state = info
        .state
        .as_ref()
        .and_then(|s| s.status.as_ref())
        .map(|s| s.to_string())
        .unwrap_or_default();
    let status = state.clone();
    let env = info
        .config
        .as_ref()
        .and_then(|c| c.env.clone())
        .unwrap_or_default();
    let cmd = info
        .config
        .as_ref()
        .and_then(|c| c.cmd.clone())
        .unwrap_or_default();
    let mounts = info
        .mounts
        .unwrap_or_default()
        .iter()
        .filter_map(|m| m.destination.clone())
        .collect();
    let ports = info
        .network_settings
        .as_ref()
        .and_then(|n| n.ports.as_ref())
        .map(|p| p.keys().cloned().collect())
        .unwrap_or_default();
    Ok(ContainerDetails {
        id,
        name,
        image,
        status,
        state,
        ports,
        created: 0,
        env,
        mounts,
        cmd,
    })
}

#[tauri::command]
pub async fn get_host_stats(sys_state: State<'_, SysState>) -> Result<HostStats, String> {
    let (cpu_percent, mem_used_mb, mem_total_mb) = {
        let mut sys = sys_state.0.lock().map_err(|e| e.to_string())?;
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        (
            sys.global_cpu_usage() as f64,
            sys.used_memory() / 1024 / 1024,
            sys.total_memory() / 1024 / 1024,
        )
    };
    let disks = Disks::new_with_refreshed_list();
    let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |(u, t), d| {
        (
            u + (d.total_space() - d.available_space()),
            t + d.total_space(),
        )
    });
    Ok(HostStats {
        cpu_percent,
        mem_used_mb,
        mem_total_mb,
        disk_used_gb: disk_used as f64 / 1_073_741_824.0,
        disk_total_gb: disk_total as f64 / 1_073_741_824.0,
    })
}

#[tauri::command]
pub async fn get_network_topology() -> Result<Vec<NetworkInfo>, String> {
    let docker = connect()?;
    let networks = docker
        .list_networks::<String>(None)
        .await
        .map_err(|e| e.to_string())?;
    Ok(networks
        .into_iter()
        .map(|net| {
            let ipam = net
                .ipam
                .as_ref()
                .and_then(|i| i.config.as_ref())
                .and_then(|c| c.first());
            let subnet = ipam.and_then(|c| c.subnet.clone()).unwrap_or_default();
            let gateway = ipam.and_then(|c| c.gateway.clone()).unwrap_or_default();
            let containers = net
                .containers
                .unwrap_or_default()
                .values()
                .map(|c| NetworkContainer {
                    name: c.name.clone().unwrap_or_default(),
                    ipv4: c.ipv4_address.clone().unwrap_or_default(),
                    mac: c.mac_address.clone().unwrap_or_default(),
                })
                .collect();
            NetworkInfo {
                id: net.id.unwrap_or_default(),
                name: net.name.unwrap_or_default(),
                driver: net.driver.unwrap_or_default(),
                scope: net.scope.unwrap_or_default(),
                subnet,
                gateway,
                containers,
            }
        })
        .collect())
}

#[tauri::command]
pub async fn inspect_network(id: String) -> Result<NetworkInfo, String> {
    let docker = connect()?;
    let net = docker
        .inspect_network::<String>(&id, None)
        .await
        .map_err(|e| e.to_string())?;
    let ipam = net
        .ipam
        .as_ref()
        .and_then(|i| i.config.as_ref())
        .and_then(|c| c.first());
    let subnet = ipam.and_then(|c| c.subnet.clone()).unwrap_or_default();
    let gateway = ipam.and_then(|c| c.gateway.clone()).unwrap_or_default();
    let containers = net
        .containers
        .unwrap_or_default()
        .values()
        .map(|c| NetworkContainer {
            name: c.name.clone().unwrap_or_default(),
            ipv4: c.ipv4_address.clone().unwrap_or_default(),
            mac: c.mac_address.clone().unwrap_or_default(),
        })
        .collect();
    Ok(NetworkInfo {
        id: net.id.unwrap_or_default(),
        name: net.name.unwrap_or_default(),
        driver: net.driver.unwrap_or_default(),
        scope: net.scope.unwrap_or_default(),
        subnet,
        gateway,
        containers,
    })
}

/// Stream logs for a container — cancels any previous stream first.
#[tauri::command]
pub async fn stream_logs(
    container_id: String,
    tail: Option<u32>,
    app: AppHandle,
    log_state: State<'_, LogStreamState>,
) -> Result<(), String> {
    let docker = connect()?;
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

    let handle = tokio::spawn(async move {
        let mut stream = docker.logs(&container_id, Some(opts));
        while let Some(Ok(msg)) = stream.next().await {
            // bollard with timestamps=true prefixes each line: "2024-01-01T00:00:00Z text"
            let raw = msg.to_string();
            let (ts, text) = if let Some(idx) = raw.find(' ') {
                (raw[..idx].to_string(), raw[idx + 1..].to_string())
            } else {
                (String::new(), raw)
            };
            let _ = app.emit("log-line", serde_json::json!({ "ts": ts, "text": text }));
        }
    });

    let mut guard = log_state.0.lock().map_err(|e| e.to_string())?;
    if let Some(old) = guard.take() {
        old.abort();
    }
    *guard = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_logs(log_state: State<'_, LogStreamState>) -> Result<(), String> {
    let mut guard = log_state.0.lock().map_err(|e| e.to_string())?;
    if let Some(handle) = guard.take() {
        handle.abort();
    }
    Ok(())
}

/// Start streaming Docker events — emits "docker-event" to frontend.
#[tauri::command]
pub async fn stream_docker_events(app: AppHandle) -> Result<(), String> {
    let docker = connect()?;
    tokio::spawn(async move {
        let mut stream = docker.events(None::<EventsOptions<String>>);
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
    Ok(())
}
