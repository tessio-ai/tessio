{{/* Expand the name of the chart. */}}
{{- define "tessio.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Fully qualified app name. */}}
{{- define "tessio.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "tessio.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels */}}
{{- define "tessio.labels" -}}
helm.sh/chart: {{ include "tessio.chart" . }}
{{ include "tessio.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/* Selector labels */}}
{{- define "tessio.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tessio.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Per-component selector labels: pass (dict "ctx" . "component" "api") */}}
{{- define "tessio.componentSelectorLabels" -}}
{{ include "tessio.selectorLabels" .ctx }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Image ref for a component: pass (dict "ctx" . "component" "api") */}}
{{- define "tessio.image" -}}
{{- $ctx := .ctx -}}
{{- $tag := default $ctx.Chart.AppVersion $ctx.Values.image.tag -}}
{{- printf "%s/%s/tessio-%s:%s" $ctx.Values.image.registry $ctx.Values.image.repository .component $tag -}}
{{- end -}}

{{- define "tessio.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "tessio.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "tessio.secretName" -}}
{{- default (printf "%s-secrets" (include "tessio.fullname" .)) .Values.secrets.existingSecret -}}
{{- end -}}

{{- define "tessio.postgres.fullname" -}}
{{- printf "%s-postgresql" (include "tessio.fullname" .) -}}
{{- end -}}

{{- define "tessio.redis.fullname" -}}
{{- printf "%s-redis" (include "tessio.fullname" .) -}}
{{- end -}}

{{- define "tessio.migrateJobName" -}}
{{- printf "%s-migrate-%d" (include "tessio.fullname" .) (.Release.Revision | int) -}}
{{- end -}}

{{/* DATABASE_URL: bundled or external */}}
{{- define "tessio.databaseUrl" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "postgres://%s:$(POSTGRES_PASSWORD)@%s:5432/%s" .Values.postgresql.auth.username (include "tessio.postgres.fullname" .) .Values.postgresql.auth.database -}}
{{- else -}}
{{- required "externalDatabase.url is required when postgresql.enabled=false" .Values.externalDatabase.url -}}
{{- end -}}
{{- end -}}

{{/* REDIS_URL: bundled or external */}}
{{- define "tessio.redisUrl" -}}
{{- if .Values.redis.enabled -}}
{{- printf "redis://%s:6379" (include "tessio.redis.fullname" .) -}}
{{- else -}}
{{- required "externalRedis.url is required when redis.enabled=false" .Values.externalRedis.url -}}
{{- end -}}
{{- end -}}
