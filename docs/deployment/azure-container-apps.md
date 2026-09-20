# Azure Container Apps

The manual GitHub Actions workflow requires these repository secrets:

- `AZURE_CREDENTIALS`: Azure login JSON with permission over the resource group.
- `AZURE_RESOURCE_GROUP`: resource group containing the Container App.
- `AZURE_CONTAINER_APP_NAME`: target Container App name.
- `GHCR_USERNAME` and `GHCR_TOKEN`: read-only package credentials for the private API image, if applicable.

Set `APPLICATIONINSIGHTS_CONNECTION_STRING`, `ConnectionStrings__VoytekDatabase`, `Jwt__SigningKey`, and provider credentials as Container App secrets. Do not commit them to Git.

Use a managed identity for Azure Container Registry access when the image is moved from GHCR to ACR.
