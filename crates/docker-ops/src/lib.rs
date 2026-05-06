use bollard::container::{
    ListContainersOptions, RestartContainerOptions, StartContainerOptions, StatsOptions,
    StopContainerOptions,
};
use bollard::models::ContainerSummary;
use bollard::Docker;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use sysinfo::{Disks, System};

pub mod error;
pub use error::DockerError;

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
    pub compose_project: Option<String>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerStats {
    pub cpu_percent: f64,
    pub mem_used_mb: u64,
    pub mem_limit_mb: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub scope: String,
    pub created: String,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

pub fn summary_to_info(c: ContainerSummary) -> ContainerInfo {
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
    let compose_project = c
        .labels
        .as_ref()
        .and_then(|l| l.get("com.docker.compose.project"))
        .cloned();
    ContainerInfo {
        id,
        name,
        image,
        status,
        state,
        ports,
        created: c.created.unwrap_or(0),
        compose_project,
    }
}

pub async fn fetch_one(docker: &Docker, id: &str) -> Result<ContainerInfo, DockerError> {
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
        .await?
        .into_iter()
        .next()
        .map(summary_to_info)
        .ok_or_else(|| DockerError::NotFound(id.to_string()))
}

// ── Core Logic ───────────────────────────────────────────────────────────────

pub async fn list_containers(docker: &Docker) -> Result<Vec<ContainerInfo>, DockerError> {
    let containers = docker
        .list_containers(Some(ListContainersOptions::<String> {
            all: true,
            ..Default::default()
        }))
        .await?;
    Ok(containers.into_iter().map(summary_to_info).collect())
}

pub async fn start_container(docker: &Docker, id: &str) -> Result<ContainerInfo, DockerError> {
    docker
        .start_container(id, None::<StartContainerOptions<String>>)
        .await?;
    fetch_one(docker, id).await
}

pub async fn stop_container(docker: &Docker, id: &str) -> Result<ContainerInfo, DockerError> {
    docker
        .stop_container(id, Some(StopContainerOptions { t: 10 }))
        .await?;
    fetch_one(docker, id).await
}

pub async fn restart_container(docker: &Docker, id: &str) -> Result<ContainerInfo, DockerError> {
    docker
        .restart_container(id, Some(RestartContainerOptions { t: 10 }))
        .await?;
    fetch_one(docker, id).await
}

pub async fn inspect_container(docker: &Docker, id: &str) -> Result<ContainerDetails, DockerError> {
    let info = docker.inspect_container(id, None).await?;
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
    let created = info
        .created
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.timestamp())
        .unwrap_or(0);
    Ok(ContainerDetails {
        id: id.to_string(),
        name,
        image,
        status,
        state,
        ports,
        created,
        env,
        mounts,
        cmd,
    })
}

pub fn get_host_stats(sys: &mut System) -> HostStats {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    let cpu_percent = sys.global_cpu_usage() as f64;
    let mem_used_mb = sys.used_memory() / 1024 / 1024;
    let mem_total_mb = sys.total_memory() / 1024 / 1024;

    let disks = Disks::new_with_refreshed_list();
    let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |(u, t), d| {
        (
            u + (d.total_space() - d.available_space()),
            t + d.total_space(),
        )
    });
    HostStats {
        cpu_percent,
        mem_used_mb,
        mem_total_mb,
        disk_used_gb: disk_used as f64 / 1_073_741_824.0,
        disk_total_gb: disk_total as f64 / 1_073_741_824.0,
    }
}

pub async fn get_network_topology(docker: &Docker) -> Result<Vec<NetworkInfo>, DockerError> {
    let networks = docker.list_networks::<String>(None).await?;
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

pub async fn inspect_network(docker: &Docker, id: &str) -> Result<NetworkInfo, DockerError> {
    let net = docker.inspect_network::<String>(id, None).await?;
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

pub async fn get_container_stats(docker: &Docker, id: &str) -> Result<ContainerStats, DockerError> {
    let stats = docker
        .stats(
            id,
            Some(StatsOptions {
                stream: false,
                one_shot: true,
            }),
        )
        .next()
        .await
        .ok_or_else(|| DockerError::Other(format!("No stats for container {id}")))?
        .map_err(|e| DockerError::Bollard(e))?;

    let cpu_delta = stats
        .cpu_stats
        .cpu_usage
        .total_usage
        .saturating_sub(stats.precpu_stats.cpu_usage.total_usage);
    let system_delta = stats
        .cpu_stats
        .system_cpu_usage
        .unwrap_or(0)
        .saturating_sub(stats.precpu_stats.system_cpu_usage.unwrap_or(0));
    let num_cpus = stats.cpu_stats.online_cpus.unwrap_or(1) as f64;
    let cpu_percent = if system_delta > 0 {
        (cpu_delta as f64 / system_delta as f64) * num_cpus * 100.0
    } else {
        0.0
    };

    let mem_usage = stats.memory_stats.usage.unwrap_or(0);
    let mem_cache = stats
        .memory_stats
        .stats
        .as_ref()
        .map(|s| match s {
            bollard::container::MemoryStatsStats::V1(v1) => v1.cache,
            bollard::container::MemoryStatsStats::V2(v2) => v2.file,
        })
        .unwrap_or(0);
    let mem_used_mb = mem_usage.saturating_sub(mem_cache) / 1024 / 1024;
    let mem_limit_mb = stats.memory_stats.limit.unwrap_or(0) / 1024 / 1024;

    Ok(ContainerStats {
        cpu_percent,
        mem_used_mb,
        mem_limit_mb,
    })
}

pub async fn list_volumes(docker: &Docker) -> Result<Vec<VolumeInfo>, DockerError> {
    let result = docker.list_volumes::<String>(None).await?;
    let volumes = result.volumes.unwrap_or_default();
    Ok(volumes
        .into_iter()
        .map(|v| VolumeInfo {
            name: v.name,
            driver: v.driver,
            mountpoint: v.mountpoint,
            scope: v.scope.map(|s| format!("{:?}", s)).unwrap_or_default(),
            created: v.created_at.unwrap_or_default(),
        })
        .collect())
}

pub async fn prune_volumes(docker: &Docker) -> Result<u64, DockerError> {
    let result = docker.prune_volumes::<String>(None).await?;
    Ok(result.space_reclaimed.unwrap_or(0) as u64)
}
