mod docker;
mod db;
mod settings;

use docker::{
    list_containers, start_container, stop_container, restart_container,
    inspect_container, get_host_stats, get_network_topology, inspect_network,
    stream_logs, stop_logs, stream_docker_events,
    LogStreamState, SysState,
};
use db::{list_env_vars, upsert_env_var, delete_env_var, import_env_file, export_env_scope};
use settings::{get_app_info, test_docker_connection, clear_all_env_vars};
use std::sync::Mutex;
use sysinfo::System;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LogStreamState(Mutex::new(None)))
        .manage(SysState(Mutex::new(System::new())))
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                if let Err(e) = db::init(app).await {
                    eprintln!("DB init error: {e}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_containers,
            start_container,
            stop_container,
            restart_container,
            inspect_container,
            get_host_stats,
            get_network_topology,
            inspect_network,
            stream_logs,
            stop_logs,
            stream_docker_events,
            list_env_vars,
            upsert_env_var,
            delete_env_var,
            import_env_file,
            export_env_scope,
            get_app_info,
            test_docker_connection,
            clear_all_env_vars,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
