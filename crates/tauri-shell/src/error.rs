use serde::Serialize;
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Serialize, Error, TS)]
#[serde(tag = "code", content = "message")]
#[ts(export, export_to = "../../packages/shared/types/")]
pub enum AppError {
    #[error("Docker error: {0}")]
    Docker(String),
    #[error("Docker ops error: {0}")]
    DockerOps(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Docker not connected")]
    DockerNotConnected,
    #[error("Container not found: {0}")]
    NotFound(String),
    #[error("{0}")]
    Generic(String),
}

impl From<bollard::errors::Error> for AppError {
    fn from(e: bollard::errors::Error) -> Self {
        AppError::Docker(e.to_string())
    }
}

impl From<docker_ops::DockerError> for AppError {
    fn from(e: docker_ops::DockerError) -> Self {
        AppError::DockerOps(e.to_string())
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
