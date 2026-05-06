mod db;
mod docker;
mod settings;

use db::{delete_env_var, export_env_scope, import_env_file, list_env_vars, upsert_env_var};
use docker::{
    get_host_stats, get_network_topology, inspect_container, inspect_network, list_containers,
    restart_container, start_container, stop_container, stop_logs, stream_docker_events,
    stream_logs, LogStreamState, SysState,
};
use settings::{clear_all_env_vars, get_app_info, test_docker_connection};
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
