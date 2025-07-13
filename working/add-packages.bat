@echo off
echo Installing required Microsoft Graph packages...
dotnet add package Microsoft.Graph
dotnet add package Microsoft.Identity.Web
dotnet add package Microsoft.Identity.Web.UI
dotnet add package Azure.Identity
echo Package installation complete!
