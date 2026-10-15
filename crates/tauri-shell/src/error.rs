use serde::Serialize;
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Serialize, Error, TS)]
#[serde(tag = "code", content = "message")]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub enum AppError {
    #[error("Docker error: {0}")]
    Docker(String),
    #[error("Docker ops error: {0}")]
    DockerOps(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Validation error: {0}")]
    Validation(String),
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

impl From<db::DbError> for AppError {
    fn from(e: db::DbError) -> Self {
        use db::DbError;
        match e {
            DbError::Validation(m) => AppError::Validation(m),
            DbError::Storage(m) => AppError::Database(m),
            // Keychain failures are a storage concern from the UI's perspective.
            DbError::Keychain(m) => AppError::Database(m),
            DbError::NotInitialized => AppError::Database("Database not initialized".into()),
            DbError::NotFound(m) => AppError::NotFound(m),
        }
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::AppError;
    use db::DbError;

    /// Extract the serde `code` tag from a serialized AppError.
    fn code_of(e: AppError) -> String {
        let v = serde_json::to_value(&e).unwrap();
        v.get("code").unwrap().as_str().unwrap().to_string()
    }

    #[test]
    fn test_dberror_maps_to_appcode() {
        assert_eq!(
            code_of(DbError::Validation("x".into()).into()),
            "Validation"
        );
        assert_eq!(code_of(DbError::Storage("x".into()).into()), "Database");
        assert_eq!(code_of(DbError::Keychain("x".into()).into()), "Database");
        assert_eq!(code_of(DbError::NotInitialized.into()), "Database");
        assert_eq!(code_of(DbError::NotFound("x".into()).into()), "NotFound");
    }

    #[test]
    fn test_validation_preserves_message() {
        let e: AppError = DbError::Validation("Invalid scope: prod".into()).into();
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v.get("code").unwrap(), "Validation");
        assert_eq!(v.get("message").unwrap(), "Invalid scope: prod");
    }
}
