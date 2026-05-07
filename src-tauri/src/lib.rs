mod db;
mod docker;
mod settings;

use db::{
    clear_all_env_vars, delete_env_var, export_env_scope, get_db_pool_stats, get_setting,
    import_env_file, list_env_vars, set_setting, upsert_env_var,
};
use docker::{
    get_container_stats, get_host_stats, get_network_topology, inspect_container, inspect_network,
    list_containers, list_volumes, prune_volumes, restart_container, start_container,
    stop_container, stop_docker_events, stop_logs, stream_docker_events, stream_logs, DockerState,
    EventStreamState, LogStreamState, SysState,
};
use settings::{get_app_info, test_docker_connection};
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

/// Called from the frontend after each container list refresh.
/// Rebuilds the tray context menu with the top-5 containers.
#[tauri::command]
fn update_tray_menu(
    app: tauri::AppHandle,
    containers: Vec<docker::ContainerInfo>,
) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let open = MenuItem::with_id(&app, "open", "Open DevOpsLocal", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(&app, "quit", "Quit", true, None::<&str>)
        .map_err(|e| e.to_string())?;

    let running: Vec<_> = containers
        .iter()
        .filter(|c| c.state == "running")
        .take(5)
        .collect();

    let running_count = containers.iter().filter(|c| c.state == "running").count();
    let tooltip = format!("{} container(s) running", running_count);

    // Build container items dynamically
    let mut item_refs: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    item_refs.push(Box::new(open));
    item_refs.push(Box::new(sep));

    let container_items: Vec<MenuItem<tauri::Wry>> = running
        .iter()
        .map(|c| {
            let label = format!("▶ {}", c.name);
            MenuItem::with_id(&app, &c.id, &label, false, None::<&str>)
        })
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for item in &container_items {
        item_refs.push(Box::new(item.clone()));
    }

    let sep2 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    if !container_items.is_empty() {
        item_refs.push(Box::new(sep2));
    }
    item_refs.push(Box::new(quit));

    let dyn_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
        item_refs.iter().map(|b| b.as_ref()).collect();
    let menu = Menu::with_items(&app, &dyn_refs).map_err(|e| e.to_string())?;

    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
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
                if let Err(e) = db::init(&handle).await {
                    eprintln!("FATAL: DB init error: {e}");
                    std::process::exit(1);
                }
            });

            // System tray — initial static menu; updated dynamically via update_tray_menu
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::tray::TrayIconBuilder;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open DevOpsLocal", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open, &sep, &quit])?;
            TrayIconBuilder::with_id("main-tray")
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
            list_containers,
            start_container,
            stop_container,
            restart_container,
            inspect_container,
            get_host_stats,
            get_container_stats,
            get_network_topology,
            inspect_network,
            stream_logs,
            stop_logs,
            stream_docker_events,
            stop_docker_events,
            list_volumes,
            prune_volumes,
            list_env_vars,
            upsert_env_var,
            delete_env_var,
            import_env_file,
            export_env_scope,
            clear_all_env_vars,
            get_setting,
            set_setting,
            get_app_info,
            test_docker_connection,
            update_tray_menu,
            get_db_pool_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
