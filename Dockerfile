# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Copy project files
COPY ["tools_website.Server.csproj", "./"]
COPY ["tools_website.client.esproj", "./"]
COPY ["package.json", "./"]
COPY ["package-lock.json", "./"]

# Restore dependencies
RUN dotnet restore "tools_website.Server.csproj"
WORKDIR /src
RUN npm ci

# Copy all files and build
WORKDIR /src
COPY . .
WORKDIR /src
RUN dotnet build "tools_website.Server.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
WORKDIR /src
RUN dotnet publish "tools_website.Server.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "tools_website.Server.dll"]
