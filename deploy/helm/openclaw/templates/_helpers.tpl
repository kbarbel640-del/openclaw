{{/*
Expand the name of the chart.
*/}}
{{- define "openclaw.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "openclaw.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "openclaw.labels" -}}
app.kubernetes.io/part-of: {{ include "openclaw.name" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Gateway labels
*/}}
{{- define "openclaw.gateway.labels" -}}
{{ include "openclaw.labels" . }}
app.kubernetes.io/component: gateway
{{- end }}

{{/*
Gateway selector labels
*/}}
{{- define "openclaw.gateway.selectorLabels" -}}
app: {{ include "openclaw.fullname" . }}-gateway
{{- end }}

{{/*
Worker labels
*/}}
{{- define "openclaw.worker.labels" -}}
{{ include "openclaw.labels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Worker selector labels
*/}}
{{- define "openclaw.worker.selectorLabels" -}}
app: {{ include "openclaw.fullname" . }}-worker
{{- end }}

{{/*
Gateway ServiceAccount name
*/}}
{{- define "openclaw.gateway.serviceAccountName" -}}
{{- if .Values.gateway.serviceAccount.name }}
{{- .Values.gateway.serviceAccount.name }}
{{- else }}
{{- include "openclaw.fullname" . }}-gateway
{{- end }}
{{- end }}

{{/*
Worker ServiceAccount name
*/}}
{{- define "openclaw.worker.serviceAccountName" -}}
{{- if .Values.worker.serviceAccount.name }}
{{- .Values.worker.serviceAccount.name }}
{{- else }}
{{- include "openclaw.fullname" . }}-worker
{{- end }}
{{- end }}

{{/*
Container image with tag
*/}}
{{- define "openclaw.image" -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag }}
{{- printf "%s:%s" .Values.image.repository $tag }}
{{- end }}

{{/*
Gateway secret name
*/}}
{{- define "openclaw.gateway.secretName" -}}
{{- if .Values.gateway.existingSecret }}
{{- .Values.gateway.existingSecret }}
{{- else }}
{{- include "openclaw.fullname" . }}-gateway-token
{{- end }}
{{- end }}

{{/*
Gateway service name (used by workers to connect)
*/}}
{{- define "openclaw.gateway.serviceName" -}}
{{- include "openclaw.fullname" . }}-gateway
{{- end }}

{{/*
Gateway FQDN for in-cluster DNS
*/}}
{{- define "openclaw.gateway.fqdn" -}}
{{- printf "%s.%s.svc.cluster.local" (include "openclaw.gateway.serviceName" .) .Release.Namespace }}
{{- end }}
