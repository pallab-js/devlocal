use serde::Serialize;
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Error, TS)]
#[ts(export, export_to = "../../packages/shared/types/", type = "string")]
pub enum AppError {
    #[error("Docker error: {0}")]
    Docker(#[from] bollard::errors::Error),
    #[error("Docker ops error: {0}")]
    DockerOps(#[from] docker_ops::DockerError),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("{0}")]
    Generic(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
