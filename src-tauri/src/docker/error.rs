use thiserror::Error;

#[allow(dead_code)]
#[derive(Debug, Error)]
pub enum DockerError {
    #[error("Docker error: {0}")]
    Bollard(#[from] bollard::errors::Error),
    #[error("Container not found: {0}")]
    NotFound(String),
    #[error("Mutex poisoned")]
    Mutex,
    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for DockerError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<String> for DockerError {
    fn from(s: String) -> Self {
        DockerError::Other(s)
    }
}
