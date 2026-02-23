group "default" {
  targets = ["app", "sandbox", "sandbox-browser", "sandbox-common"]
}

target "app" {
  dockerfile = "Dockerfile"
  tags       = ["openclaw:local", "openclaw:latest"]
  args = {
    OPENCLAW_INSTALL_BROWSER = 0
  }
}

target "app-with-browser" {
  dockerfile = "Dockerfile"
  tags       = ["openclaw:browser"]
  args = {
    OPENCLAW_INSTALL_BROWSER = 1
  }
}

target "sandbox" {
  dockerfile = "Dockerfile.sandbox"
  tags       = ["openclaw-sandbox:bookworm-slim"]
}

target "sandbox-browser" {
  dockerfile = "Dockerfile.sandbox-browser"
  tags       = ["openclaw-sandbox:browser"]
}

target "sandbox-common" {
  dockerfile = "Dockerfile.sandbox-common"
  tags       = ["openclaw-sandbox:common"]
  args = {
    INSTALL_PNPM = 1
    INSTALL_BUN  = 1
    INSTALL_BREW = 1
  }
}
