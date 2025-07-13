// Bicep file for Azure resources required by facade-studio-asp
param environmentName string
param location string
param resourceGroupName string
param COSMOS_DB_CONNECTION_STRING string
param COSMOS_ENDPOINT string
param COSMOS_KEY string
param COSMOS_DATABASE string = 'InputImages'
param COSMOS_CONTAINER string = 'batches'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: '${environmentName}acr'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {}
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: '${environmentName}kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    enableSoftDelete: true
    enablePurgeProtection: true
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${environmentName}log'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${environmentName}ai'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${environmentName}cosmos'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
  }
}

resource cosmosDbDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosDb
  name: COSMOS_DATABASE
  properties: {
    resource: {
      id: COSMOS_DATABASE
    }
  }
}

resource cosmosDbContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDbDatabase
  name: COSMOS_CONTAINER
  properties: {
    resource: {
      id: COSMOS_CONTAINER
      partitionKey: {
        paths: ['/BatchID']
        kind: 'Hash'
      }
    }
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${environmentName}env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${environmentName}-facade-studio-asp'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      secrets: [
        {
          name: 'cosmos-db-connection-string'
          value: COSMOS_DB_CONNECTION_STRING
        }
        {
          name: 'cosmos-endpoint'
          value: COSMOS_ENDPOINT
        }
        {
          name: 'cosmos-key'
          value: COSMOS_KEY
        }
      ]
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'facade-studio-asp'
          image: 'facadeai-ehgjdkdeg4e9bvbx.azurecr.io/facade-studio-asp:latest'
          env: [
            {
              name: 'COSMOS_DB_CONNECTION_STRING'
              secretRef: 'cosmos-db-connection-string'
            }
            {
              name: 'COSMOS_ENDPOINT'
              secretRef: 'cosmos-endpoint'
            }
            {
              name: 'COSMOS_KEY'
              secretRef: 'cosmos-key'
            }
            {
              name: 'COSMOS_DATABASE'
              value: COSMOS_DATABASE
            }
            {
              name: 'COSMOS_CONTAINER'
              value: COSMOS_CONTAINER
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}
