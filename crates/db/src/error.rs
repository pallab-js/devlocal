//! Typed errors for the `db` crate.
//!
//! These categories let the Tauri boundary map each failure to a meaningful
//! `AppError` code so the frontend can classify errors (e.g. show a form-level
//! message for validation vs a toast for storage failures) instead of treating
//! everything as a generic error.

use std::fmt;

#[derive(Debug)]
pub enum DbError {
    /// User input failed server-side validation (bad key/scope/setting).
    Validation(String),
    /// A storage/SQL operation failed.
    Storage(String),
    /// An OS keychain operation failed.
    Keychain(String),
    /// The database pool has not been initialized yet.
    NotInitialized,
    /// A requested record does not exist.
    NotFound(String),
}

impl DbError {
    /// A stable, machine-readable category string. Mirrors the variant name so
    /// callers can match without depending on the message text.
    pub fn category(&self) -> &'static str {
        match self {
            DbError::Validation(_) => "Validation",
            DbError::Storage(_) => "Storage",
            DbError::Keychain(_) => "Keychain",
            DbError::NotInitialized => "NotInitialized",
            DbError::NotFound(_) => "NotFound",
        }
    }
}

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DbError::Validation(m) => write!(f, "{m}"),
            DbError::Storage(m) => write!(f, "{m}"),
            DbError::Keychain(m) => write!(f, "{m}"),
            DbError::NotInitialized => write!(f, "Database not initialized"),
            DbError::NotFound(m) => write!(f, "Not found: {m}"),
        }
    }
}

impl std::error::Error for DbError {}

impl From<sqlx::Error> for DbError {
    fn from(e: sqlx::Error) -> Self {
        DbError::Storage(e.to_string())
    }
}

pub type DbResult<T> = std::result::Result<T, DbError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_category_labels() {
        assert_eq!(DbError::Validation("x".into()).category(), "Validation");
        assert_eq!(DbError::Storage("x".into()).category(), "Storage");
        assert_eq!(DbError::Keychain("x".into()).category(), "Keychain");
        assert_eq!(DbError::NotInitialized.category(), "NotInitialized");
        assert_eq!(DbError::NotFound("x".into()).category(), "NotFound");
    }

    #[test]
    fn test_display_passthrough() {
        assert_eq!(DbError::Validation("bad key".into()).to_string(), "bad key");
        assert_eq!(
            DbError::NotInitialized.to_string(),
            "Database not initialized"
        );
        assert_eq!(
            DbError::NotFound("abc".into()).to_string(),
            "Not found: abc"
        );
    }

    #[test]
    fn test_from_sqlx_is_storage() {
        let e: DbError = sqlx::Error::RowNotFound.into();
        assert_eq!(e.category(), "Storage");
    }
}
