# Terraform state and GitHub sign-in to Azure

What the owner creates by hand, once, before the CI's Terraform job can plan staging (task 28a):

- the storage account that holds Terraform's state;
- the identity GitHub Actions signs in with through OIDC;
- the three GitHub variables that tell the job which identity to use.

No secret is created or stored anywhere: the storage account accepts no access keys, and GitHub signs in with short-lived OIDC tokens.

Until the variables exist, the job runs `fmt` and `validate` only and says in its summary that the plan was skipped.

## Before you start

- Azure CLI (`az`) and GitHub CLI (`gh`), both signed in: `az login`, `gh auth login`.
- On the staging subscription: Owner, or Contributor plus User Access Administrator. In Entra ID: the right to create app registrations.
- Run the commands in bash: Azure Cloud Shell, or Git Bash on Windows. In Git Bash, first run `export MSYS_NO_PATHCONV=1`, or it rewrites `/subscriptions/…` scopes into Windows paths.

```sh
SUBSCRIPTION_ID=<staging subscription id>
LOCATION=eastus2   # the region of staging (owner, 2026-10-15)
RG=rg-greenbuild-tfstate
ACCOUNT=greenbuildtfstate
CONTAINER=tfstate
REPO=arslant84/greenbuild

az account set --subscription "$SUBSCRIPTION_ID"
```

`RG`, `ACCOUNT` and `CONTAINER` must match `infra/terraform/envs/staging/backend.tf`.

## 1. The state storage account

Storage account names are global. Check the name first:

```sh
az storage account check-name --name "$ACCOUNT" --query nameAvailable
```

If it answers `false`, choose another name. Set it in `ACCOUNT` and in `backend.tf`, and change `backend.tf` in a PR.

```sh
az group create --name "$RG" --location "$LOCATION"

az storage account create --name "$ACCOUNT" --resource-group "$RG" --location "$LOCATION" \
  --sku Standard_ZRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 \
  --allow-blob-public-access false --allow-shared-key-access false

# Old versions of the state and deleted blobs stay recoverable for 30 days.
az storage account blob-service-properties update --account-name "$ACCOUNT" --resource-group "$RG" \
  --enable-versioning true \
  --enable-delete-retention true --delete-retention-days 30 \
  --enable-container-delete-retention true --container-delete-retention-days 30

ACCOUNT_ID=$(az storage account show --name "$ACCOUNT" --resource-group "$RG" --query id -o tsv)
```

The account accepts no keys, so you create the container with your own Entra sign-in. That needs a data role on the account:

```sh
ME=$(az ad signed-in-user show --query id -o tsv)
az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope "$ACCOUNT_ID"

# A new role can take a minute or two to apply; repeat the command if it answers 403.
az storage container create --name "$CONTAINER" --account-name "$ACCOUNT" --auth-mode login
```

Protect the state's resource group from deletion:

```sh
az lock create --name tfstate-no-delete --resource-group "$RG" --lock-type CanNotDelete
```

The backend locks the state itself while a plan or apply runs: it takes a lease on the state blob. Nothing more is needed for locking.

## 2. Resource providers

The CI identity is a Reader and cannot register resource providers, so `main.tf` sets `resource_provider_registrations = "none"`. Register the ones staging's modules (28b–28e) use once, by hand:

```sh
for namespace in Microsoft.Network Microsoft.Storage Microsoft.KeyVault Microsoft.DBforPostgreSQL \
  Microsoft.Cache Microsoft.ContainerRegistry Microsoft.App Microsoft.OperationalInsights \
  Microsoft.Compute Microsoft.ManagedIdentity; do
  az provider register --namespace "$namespace"
done
```

## 3. The plan identity: GitHub Actions through OIDC

The identity that plans pull requests can read the subscription and write only the state. A PR's code runs during `plan`, and providers and data sources can run commands, so this identity must not be able to change anything else.

```sh
APP_ID=$(az ad app create --display-name greenbuild-terraform-plan --query appId -o tsv)
az ad sp create --id "$APP_ID"
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

# Tokens from this repository's pull_request runs only.
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-pull-requests",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:arslant84/greenbuild:pull_request",
  "audiences": ["api://AzureADTokenExchange"]
}'

az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Reader --scope "/subscriptions/$SUBSCRIPTION_ID"
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$ACCOUNT_ID/blobServices/default/containers/$CONTAINER"
```

PRs from forks get no OIDC token, so they never reach Azure.

## 4. GitHub variables

These are identifiers, not secrets, so they are variables. They show in job logs.

```sh
gh variable set AZURE_CLIENT_ID --repo "$REPO" --body "$APP_ID"
gh variable set AZURE_TENANT_ID --repo "$REPO" --body "$(az account show --query tenantId -o tsv)"
gh variable set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION_ID"
```

## 5. Check

Re-run the Terraform job of an open PR that changes `infra/terraform`: in the PR's Checks tab, open "Terraform" and choose "Re-run jobs". Pushing a commit to such a PR works too. The job's "Plan staging" step runs, and the PR gets a "Terraform plan: staging" comment. Until task 28b adds resources, the plan says "No changes".

If the plan fails with `AuthorizationFailed` on a read, write the missing action in "Extra permissions" below. Grant it through a custom role limited to that action, never Contributor. Task 28c checks this for the storage account's keys and Key Vault.

## Extra permissions

None yet.

## Later: the apply identity

`apply` runs only after merge, with the owner's approval (architecture.md, CI/CD). The task that adds the apply job also creates its identity, separate from the plan identity:

- a federated credential with subject `repo:arslant84/greenbuild:environment:staging`;
- Contributor on the staging subscription and Storage Blob Data Contributor on the state container;
- a GitHub environment `staging` that requires the owner's review.

The plan identity never gets Contributor.
