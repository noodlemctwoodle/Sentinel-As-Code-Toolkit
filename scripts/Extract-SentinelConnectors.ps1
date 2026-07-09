<#
.SYNOPSIS
    Extracts Azure Sentinel data connector information from the official repository.

.DESCRIPTION
    This script downloads and extracts the Azure Sentinel repository archive, then processes
    all data connector JSON files to create a comprehensive dataset of available connectors,
    their tables, and metadata. The output includes connector details, table information,
    and cross-references between connectors and their associated tables.

.PARAMETER OutputPath
    The path where the output JSON file will be saved. Defaults to "../data/connectors-complete.json"

.EXAMPLE
    .\Extract-SentinelConnectors.ps1
    Extracts connector data using default output path

.EXAMPLE
    .\Extract-SentinelConnectors.ps1 -OutputPath "../data/my-connectors.json"
    Extracts connector data to a custom output path

.NOTES
    File Name      : Extract-SentinelConnectors.ps1
    Author         : TobyG
    Created        : 03/07/2023
    Version        : 1.0.0
    
    This script requires PowerShell 5.1+ or PowerShell Core and uses the built-in tar utility
    available on Windows 10+ for archive extraction.

    The script processes two main directories from the Azure Sentinel repository:
    - Solutions/[SolutionName]/Data Connectors/
    - DataConnectors/

.LINK
    https://github.com/Azure/Azure-Sentinel
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "../data/connectors.json"
)

# Set up temporary directories and paths
$tempDir = "temp"
$extractDir = Join-Path $tempDir "extracted"

# Create temp directory structure
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force
New-Item -ItemType Directory -Path $extractDir -Force

Write-Host "Downloading Azure Sentinel repository archive..."

# Download the main branch as a tar.gz (much smaller than full clone)
$archiveUrl = "https://github.com/Azure/Azure-Sentinel/archive/refs/heads/master.tar.gz"
$archivePath = Join-Path $tempDir "sentinel.tar.gz"

try {
    # Download the repository archive
    Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
    Write-Host "Archive downloaded successfully ($(Get-Item $archivePath | Select-Object -ExpandProperty Length) bytes)"
    
    # Extract using tar (available on Windows 10+ and PowerShell Core)
    Set-Location $tempDir
    tar -xzf "sentinel.tar.gz"
    Set-Location ..
    
    # Find the extracted directory (it will be Azure-Sentinel-master)
    $sentinelDir = Get-ChildItem $tempDir -Directory | Where-Object { $_.Name -like "Azure-Sentinel-*" } | Select-Object -First 1
    
    if (-not $sentinelDir) {
        throw "Could not find extracted Sentinel directory"
    }
    
    Write-Host "Archive extracted to: $($sentinelDir.FullName)"
    
    # Initialize connectors array
    $connectors = @()
    
    # Process Solutions directory - contains solution-specific connectors
    $solutionsPath = Join-Path $sentinelDir.FullName "Solutions"
    if (Test-Path $solutionsPath) {
        Write-Host "Processing Solutions directory..."
        
        Get-ChildItem $solutionsPath -Directory | ForEach-Object {
            $solutionName = $_.Name
            $dataConnectorsPath = Join-Path $_.FullName "Data Connectors"
            
            if (Test-Path $dataConnectorsPath) {
                Write-Host "  Processing solution: $solutionName"
                
                # Process each connector JSON file in the solution
                Get-ChildItem $dataConnectorsPath -Filter "*.json" | ForEach-Object {
                    try {
                        $connectorData = Get-Content $_.FullName | ConvertFrom-Json -ErrorAction Stop
                        
                        # Only process connectors with valid titles
                        if ($connectorData.title -and $connectorData.title.trim() -ne "") {
                            $connector = @{
                                id = if ($connectorData.id) { 
                                    $connectorData.id -split '/' | Select-Object -Last 1 
                                } else { 
                                    $_.BaseName 
                                }
                                title = $connectorData.title
                                publisher = $connectorData.publisher
                                descriptionMarkdown = $connectorData.descriptionMarkdown
                                dataTypes = $connectorData.dataTypes
                                source = "Solutions/$solutionName"
                                lastModified = $null
                            }
                            
                            # Extract table information if available
                            if ($connectorData.dataTypes) {
                                $connector.tables = $connectorData.dataTypes | ForEach-Object {
                                    @{
                                        name = $_.name
                                        lastDataReceivedQuery = $_.lastDataReceivedQuery
                                    }
                                }
                            }
                            
                            $connectors += $connector
                            Write-Host "    Found: $($connector.title)"
                        }
                    }
                    catch {
                        Write-Warning "    Failed to parse $($_.Name): $($_.Exception.Message)"
                    }
                }
            }
        }
    }
    
    # Process DataConnectors directory - contains legacy/standalone connectors
    $dataConnectorsPath = Join-Path $sentinelDir.FullName "DataConnectors"
    if (Test-Path $dataConnectorsPath) {
        Write-Host "Processing DataConnectors directory..."
        
        Get-ChildItem $dataConnectorsPath -Filter "*.json" | ForEach-Object {
            try {
                $connectorData = Get-Content $_.FullName | ConvertFrom-Json -ErrorAction Stop
                
                # Only process connectors with valid titles
                if ($connectorData.title -and $connectorData.title.trim() -ne "") {
                    $connector = @{
                        id = $_.BaseName
                        title = $connectorData.title
                        publisher = $connectorData.publisher
                        descriptionMarkdown = $connectorData.descriptionMarkdown
                        dataTypes = $connectorData.dataTypes
                        source = "DataConnectors"
                        lastModified = $null
                    }
                    
                    # Extract table information if available
                    if ($connectorData.dataTypes) {
                        $connector.tables = $connectorData.dataTypes | ForEach-Object {
                            @{
                                name = $_.name
                                lastDataReceivedQuery = $_.lastDataReceivedQuery
                            }
                        }
                    }
                    
                    $connectors += $connector
                    Write-Host "  Found: $($connector.title)"
                }
            }
            catch {
                Write-Warning "  Failed to parse $($_.Name): $($_.Exception.Message)"
            }
        }
    }
    
    # Generate consolidated table list with connector details
    $allTables = @()
    $connectors | ForEach-Object {
        if ($_.tables) {
            $_.tables | ForEach-Object {
                $allTables += @{
                    tableName = $_.name
                    connectorId = $_.id
                    connectorTitle = $_.title
                    lastDataReceivedQuery = $_.lastDataReceivedQuery
                }
            }
        }
    }
    
    # Remove duplicates and sort tables alphabetically
    $uniqueTables = $allTables | Sort-Object tableName | Group-Object tableName | ForEach-Object { $_.Group[0] }
    
    # Create simplified output with connector details merged into tablesByConnector
    $tablesByConnector = $connectors | Where-Object { $_.tables } | ForEach-Object {
        $connector = $_
        @{
            connectorId = $connector.id
            connectorTitle = $connector.title
            descriptionMarkdown = $connector.descriptionMarkdown
            publisher = $connector.publisher
            source = $connector.source
            tables = if ($connector.tables.Count -eq 1) { $connector.tables[0].name } else { $connector.tables.name }
        }
    } | Sort-Object connectorTitle
    
    # Create the final simplified output structure
    $output = @{
        metadata = @{
            generatedDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            totalConnectors = $connectors.Count
            totalTables = $uniqueTables.Count
            sourceRepository = "https://github.com/Azure/Azure-Sentinel"
            extractionVersion = "1.0.0"
            extractionMethod = "Archive Download"
        }
        tablesByConnector = $tablesByConnector
    }
    
    # Ensure output directory exists
    $outputDir = Split-Path $OutputPath -Parent
    if ($outputDir -and -not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force
    }
    
    # Save output to JSON file
    $output | ConvertTo-Json -Depth 10 | Out-File $OutputPath -Encoding UTF8
    
    # Display completion summary
    Write-Host ""
    Write-Host "Extraction Complete!" -ForegroundColor Green
    Write-Host "Connector data saved to: $OutputPath"
    Write-Host "Total connectors found: $($output.metadata.totalConnectors)"
    Write-Host "Total unique tables: $($output.metadata.totalTables)"
    
}
catch {
    Write-Error "Failed to process archive: $($_.Exception.Message)"
}
finally {
    # Cleanup temporary files
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
}