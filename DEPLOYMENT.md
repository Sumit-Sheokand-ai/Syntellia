# Deployment Guide

## Local Development

### Prerequisites
- .NET 10 SDK
- Node.js 18+ with npm
- Visual Studio 2024 or VS Code (optional)

### Running Locally
```bash
# Install frontend dependencies
cd tools_website.client
npm install

# Return to root and run
cd ..
dotnet run --project tools_website.Server
```

The app will be available at `https://localhost:5173`

---

## Docker Deployment

### Build and Run with Docker
```bash
# Build the Docker image
docker build -t privacy-tools .

# Run the container
docker run -d -p 8080:8080 -p 8081:8081 --name privacy-tools privacy-tools

# View logs
docker logs -f privacy-tools
```

### Using Docker Compose
```bash
docker-compose up -d
```

---

## Cloud Deployment Options

### 1. Azure App Service

#### Using Azure CLI
```bash
# Login to Azure
az login

# Create resource group
az group create --name privacy-tools-rg --location eastus

# Create App Service plan
az appservice plan create \
  --name privacy-tools-plan \
  --resource-group privacy-tools-rg \
  --sku B1 \
  --is-linux

# Create web app
az webapp create \
  --name privacy-tools-app \
  --resource-group privacy-tools-rg \
  --plan privacy-tools-plan \
  --runtime "DOTNET|10.0"

# Deploy from local Git (or use GitHub Actions)
az webapp deployment source config-local-git \
  --name privacy-tools-app \
  --resource-group privacy-tools-rg
```

#### Using Azure Portal
1. Create new **App Service**
2. Choose **.NET 10** runtime
3. Select **Linux** OS
4. Configure deployment (GitHub Actions, Local Git, or Azure DevOps)
5. Set environment variables if needed

### 2. Azure Container Apps

```bash
# Create container app environment
az containerapp env create \
  --name privacy-tools-env \
  --resource-group privacy-tools-rg \
  --location eastus

# Build and push to Azure Container Registry
az acr create \
  --name privacytoolsacr \
  --resource-group privacy-tools-rg \
  --sku Basic \
  --admin-enabled true

az acr build \
  --registry privacytoolsacr \
  --image privacy-tools:latest \
  .

# Deploy to Container Apps
az containerapp create \
  --name privacy-tools \
  --resource-group privacy-tools-rg \
  --environment privacy-tools-env \
  --image privacytoolsacr.azurecr.io/privacy-tools:latest \
  --target-port 8080 \
  --ingress external
```

### 3. Kubernetes (AKS)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: privacy-tools
spec:
  replicas: 2
  selector:
    matchLabels:
      app: privacy-tools
  template:
    metadata:
      labels:
        app: privacy-tools
    spec:
      containers:
      - name: privacy-tools
        image: your-registry/privacy-tools:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: privacy-tools-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: privacy-tools
```

Apply with:
```bash
kubectl apply -f deployment.yaml
```

### 4. AWS (Elastic Beanstalk or ECS)

#### Elastic Beanstalk
```bash
# Install EB CLI
pip install awsebcli

# Initialize EB app
eb init -p docker privacy-tools

# Create environment and deploy
eb create privacy-tools-env
eb deploy
```

#### ECS Fargate
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name privacy-tools-cluster

# Push image to ECR
aws ecr create-repository --repository-name privacy-tools
docker tag privacy-tools:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/privacy-tools:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/privacy-tools:latest

# Create task definition and service (see AWS docs for full configuration)
```

### 5. Google Cloud Platform (Cloud Run)

```bash
# Build and deploy to Cloud Run
gcloud run deploy privacy-tools \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 6. Vercel / Netlify (Frontend only, use external API)

If you want to deploy frontend separately:
```bash
# Build static frontend
cd tools_website.client
npm run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod --dir=dist
```

**Note**: You'll need to deploy the backend separately and update API URLs.

---

## Environment Variables

### Required
None - all APIs used are public and don't require keys

### Optional
```bash
# For rate limiting or enhanced features
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_HTTP_PORTS=8080
ASPNETCORE_HTTPS_PORTS=8081
```

---

## Performance Optimization

### 1. Enable Response Caching
Add to `Program.cs`:
```csharp
builder.Services.AddResponseCaching();
app.UseResponseCaching();
```

### 2. Add Rate Limiting
Install: `dotnet add package AspNetCoreRateLimit`

### 3. Use CDN for Static Assets
Configure Azure CDN, CloudFlare, or AWS CloudFront

### 4. Database Caching (Optional)
For frequently accessed data, add Redis:
```bash
docker run -d -p 6379:6379 redis:alpine
```

---

## Monitoring & Logging

### Azure Application Insights
```csharp
// Add to Program.cs
builder.Services.AddApplicationInsightsTelemetry();
```

### Health Checks
```csharp
builder.Services.AddHealthChecks();
app.MapHealthChecks("/health");
```

### Logging
Configure in `appsettings.json`:
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

---

## Security Considerations

1. **HTTPS Only**: Enforce HTTPS in production
2. **CORS**: Configure appropriate CORS policies
3. **Rate Limiting**: Prevent API abuse
4. **Input Validation**: All user inputs are validated
5. **Content Security Policy**: Add CSP headers

### Example Security Headers
```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    await next();
});
```

---

## Cost Estimates

### Azure App Service (B1 tier)
- ~$13/month
- 1.75 GB RAM, 1 vCPU

### Azure Container Apps
- Pay per use
- ~$5-20/month for low traffic

### AWS Elastic Beanstalk (t3.small)
- ~$15/month

### Google Cloud Run
- Pay per request
- ~$5-15/month for low traffic

### Free Tiers
- Azure: 12 months free (limited)
- AWS: 12 months free EC2 t2.micro
- GCP: Always free tier (limited)

---

## Troubleshooting

### Frontend not connecting to API
- Check CORS configuration in `Program.cs`
- Verify API URLs in frontend code
- Check browser console for errors

### API rate limits
- Common Crawl: ~240 requests/minute
- openFDA: ~240 requests/minute
- FCC/NYC Open Data: Usually generous limits

### Build errors
```bash
# Clean and rebuild
dotnet clean
dotnet restore
dotnet build
```

---

## Scaling Considerations

For high traffic:
1. Use **Azure Front Door** or **CloudFlare** for CDN
2. Enable **response caching**
3. Add **Redis** for session/data caching
4. Use **horizontal scaling** (multiple instances)
5. Consider **Azure API Management** for rate limiting

---

## Support & Maintenance

- Monitor API status pages for data sources
- Set up alerts for downtime
- Keep dependencies updated: `dotnet outdated`
- Review logs regularly for errors
