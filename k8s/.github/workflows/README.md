# GitHub Actions Workflows

This directory contains CI/CD workflows for the OpenClaw Helm chart.

## Workflows

### helm.yaml
- **Trigger**: Push to main branch, PRs touching k8s files
- **Jobs**:
  1. `lint` - Validates Helm chart syntax
  2. `package` - Packages and pushes Helm chart to GitHub Packages
  3. `validate-template` - Performs Helm template rendering test

## Usage

### Lint-only Workflow
```bash
make lint  # If Makefile present
helm lint k8s/
```

### Package Locally
```bash
cd k8s
helm package .
```

### Test Installation
```bash
helm install openclaw ./k8s --dry-run --debug
```

## Maintenance

Update workflows in `.github/workflows/helm.yaml`:

```yaml
# Add new job
new-job:
  name: New Job
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Job steps
      run: |
        # Your steps here
```

## Best Practices

1. Run `helm lint` on every PR
2. Test templates with `helm template --debug`
3. Use semantic versioning for chart releases
4. Keep dependencies up to date (via Dependabot)
