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
        let msg = match self {
            DockerError::Bollard(e) => match e {
                bollard::errors::Error::DockerResponseServerError {
                    status_code,
                    message,
                } => {
                    format!("Docker error {status_code}: {message}")
                }
                bollard::errors::Error::IOError { err } => {
                    format!("Docker I/O error: {err}")
                }
                _ => "Docker connection error. Is the daemon running?".to_string(),
            },
            DockerError::NotFound(id) => format!("Container not found: {id}"),
            DockerError::Mutex => "Internal lock error".to_string(),
            DockerError::Other(msg) => msg.clone(),
        };
        s.serialize_str(&msg)
    }
}

impl From<String> for DockerError {
    fn from(s: String) -> Self {
        DockerError::Other(s)
    }
}
