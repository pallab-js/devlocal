pub mod db;
pub mod docker;
pub mod error;
pub mod settings;

use crate::docker::{DockerState, EventStreamState, LogStreamState, SysState};
use std::sync::{Arc, Mutex};
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
pub fn run() {
    let docker = connect_docker().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DockerState(docker.map(Arc::new)))
        .manage(LogStreamState(Mutex::new(None)))
        .manage(EventStreamState(Mutex::new(None)))
        .manage(SysState(Mutex::new(System::new())))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ::db::init(&handle).await {
                    eprintln!("DB init error: {e}");
                }
            });

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
            db::list_env_vars,
            db::upsert_env_var,
            db::delete_env_var,
            db::import_env_file,
            db::export_env_scope,
            db::clear_all_env_vars,
            db::get_setting,
            db::set_setting,
            settings::get_app_info,
            settings::test_docker_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use crate::error::AppError;
    use crate::settings::AppInfo;
    use db::EnvVar;
    use docker_ops::{
        ContainerDetails, ContainerInfo, ContainerStats, DockerEvent, HostStats, NetworkContainer,
        NetworkInfo, VolumeInfo,
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
    }
}
