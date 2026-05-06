use bollard::Docker;
use docker_ops::list_containers;
use wiremock::matchers::method;
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_list_containers_mocked() {
    // Start a mock server
    let mock_server = MockServer::start().await;

    // Define the mock response (a list of ContainerSummary-like objects)
    let container_json = serde_json::json!([
        {
            "Id": "8dfafdbc3a40",
            "Names": ["/test_container"],
            "Image": "nginx:latest",
            "ImageID": "sha256:...",
            "Command": "nginx -g 'daemon off;'",
            "Created": 1622548800,
            "Ports": [
                {
                    "PrivatePort": 80,
                    "PublicPort": 8080,
                    "Type": "tcp"
                }
            ],
            "Labels": {
                "com.docker.compose.project": "test_project"
            },
            "State": "running",
            "Status": "Up 2 hours",
            "HostConfig": {
                "NetworkMode": "default"
            },
            "NetworkSettings": {
                "Networks": {
                    "bridge": {
                        "IPAddress": "172.17.0.2",
                        "Gateway": "172.17.0.1"
                    }
                }
            },
            "Mounts": []
        }
    ]);

    // Register the mock
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(container_json))
        .mount(&mock_server)
        .await;

    // Instantiate Bollard client pointing to the mock server
    // Note: bollard::Docker::connect_with_http is useful for this
    let docker = Docker::connect_with_http(
        &mock_server.uri(),
        120,
        bollard::API_DEFAULT_VERSION,
    ).unwrap();

    // Call the function under test
    let result = list_containers(&docker).await.unwrap();

    // Verify the results
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].id, "8dfafdbc3a40");
    assert_eq!(result[0].name, "test_container");
    assert_eq!(result[0].image, "nginx:latest");
    assert_eq!(result[0].status, "Up 2 hours");
    assert_eq!(result[0].state, "running");
    assert_eq!(result[0].ports, vec!["8080:80"]);
    assert_eq!(result[0].compose_project, Some("test_project".to_string()));
}
