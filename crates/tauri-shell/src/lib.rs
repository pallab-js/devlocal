pub mod db;
pub mod docker;
pub mod error;
pub mod settings;

use crate::docker::{DiskState, DockerState, EventStreamState, LogStreamState, SysState};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use sysinfo::System;
use tauri::Manager;

fn connect_docker() -> Result<bollard::Docker, bollard::errors::Error> {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let home_path = std::path::PathBuf::from(home);
            let docker_sock = home_path.join(".docker/run/docker.sock");
            let socket_uri = format!("unix://{}", docker_sock.display());
            if let Ok(docker) =
                bollard::Docker::connect_with_socket(&socket_uri, 120, bollard::API_DEFAULT_VERSION)
            {
                return Ok(docker);
            }
        }
    }
    bollard::Docker::connect_with_local_defaults()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(context: tauri::Context) {
    let docker = connect_docker().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DockerState(docker.map(Arc::new)))
        .manage(LogStreamState(Mutex::new(HashMap::new())))
        .manage(EventStreamState(Mutex::new(None)))
        .manage(SysState(Mutex::new(System::new())))
        .manage(DiskState(Mutex::new((
            sysinfo::Disks::new_with_refreshed_list(),
            Instant::now(),
        ))))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ::db::init(&handle).await {
                    eprintln!("DB init error: {e}");
                    let _ = tauri_plugin_dialog::DialogExt::dialog(&handle)
                        .message(format!(
                            "Database failed to initialize:\n{e}\n\nThe application will now exit."
                        ))
                        .title("Fatal Error")
                        .blocking_show();
                    std::process::exit(1);
                }
            });

            // Start Docker health monitor
            let docker_state = app.state::<DockerState>();
            if let Some(docker) = &docker_state.0 {
                crate::docker::start_health_monitor(app.handle().clone(), Arc::clone(docker));
            }

            // System tray
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::tray::TrayIconBuilder;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open DevOpsLocal", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open, &sep, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("DevOpsLocal")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            docker::list_containers,
            docker::start_container,
            docker::stop_container,
            docker::restart_container,
            docker::update_container_limits,
            docker::inspect_container,
            docker::get_host_stats,
            docker::get_container_stats,
            docker::get_network_topology,
            docker::inspect_network,
            docker::stream_logs,
            docker::stop_logs,
            docker::stream_docker_events,
            docker::stop_docker_events,
            docker::list_volumes,
            docker::prune_volumes,
            docker::list_images,
            docker::remove_image,
            docker::pull_image,
            docker::compose_up,
            docker::compose_down,
            docker::inspect_volume,
            docker::delete_image,
            docker::prune_images,
            db::list_env_vars,
            db::upsert_env_var,
            db::delete_env_var,
            db::import_env_file,
            db::import_secrets,
            db::export_env_scope,
            db::clear_all_env_vars,
            db::get_setting,
            db::set_setting,
            settings::get_app_info,
            settings::test_docker_connection,
            db::get_db_pool_stats,
        ])
        .run(context)
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use crate::error::AppError;
    use crate::settings::AppInfo;
    use db::EnvVar;
    use docker_ops::{
        ContainerDetails, ContainerInfo, ContainerStats, DockerEvent, HostStats, ImageInfo,
        LogLine, NetworkContainer, NetworkInfo, PullProgress, VolumeInfo,
    };
    use ts_rs::TS;

    #[test]
    fn test_export_types() {
        // This test ensures that all types we want to export to TypeScript are correctly annotated.
        // ts-rs will export them to packages/shared/types/ when running `cargo test`.
        let _ = <AppError as TS>::decl();
        let _ = <AppInfo as TS>::decl();
        let _ = <EnvVar as TS>::decl();
        let _ = <ContainerInfo as TS>::decl();
        let _ = <ContainerDetails as TS>::decl();
        let _ = <HostStats as TS>::decl();
        let _ = <NetworkContainer as TS>::decl();
        let _ = <NetworkInfo as TS>::decl();
        let _ = <DockerEvent as TS>::decl();
        let _ = <ContainerStats as TS>::decl();
        let _ = <VolumeInfo as TS>::decl();
        let _ = <ImageInfo as TS>::decl();
        let _ = <PullProgress as TS>::decl();
        let _ = <LogLine as TS>::decl();
    }
}
