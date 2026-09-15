FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Fraudio.slnx ./
COPY src/ src/
COPY tests/ tests/
RUN dotnet publish src/Fraudio.Api/Fraudio.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Fraudio.Api.dll"]
