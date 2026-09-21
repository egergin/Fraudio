FROM ://microsoft.com AS build
WORKDIR /src

COPY Fraudio.slnx ./
COPY src/ ./src/
COPY tests/ ./tests/

RUN dotnet publish src/Fraudio.Api/Fraudio.Api.csproj -c Release -o /app/publish

FROM ://microsoft.com
WORKDIR /app
EXPOSE 8080

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Fraudio.Api.dll"]

