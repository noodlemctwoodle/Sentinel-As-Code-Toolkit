# SentinelCodeGuard

![Beta](https://img.shields.io/badge/status-beta-orange) ![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**Development toolkit for Microsoft Sentinel Analytics Rules**

*Guard your Sentinel rules with precision*

---

## 📖 Documentation

**Complete documentation is available in our [Wiki](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki)**

- **[Getting Started Guide](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki#-quick-start)** - Complete feature overview and quick start
- **[Rule Templates](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Rule-Templates)** - Professional templates with best practices
- **[ARM to YAML Conversion](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Decompile-ARM-to-YAML)** - Comprehensive migration guide
- **[Configuration](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Configuration-Guide)** - Detailed setup and customization

---

## Beta Notice

**SentinelCodeGuard is currently in beta (v0.1.0).** We're actively developing and improving the extension. Please report any issues or feedback via [GitHub Issues](https://github.com/noodlemctwoodle/SentinelCodeGuard/issues).

---

## About

Created by **TobyG** - Visit [sentinel.blog](https://sentinel.blog) for more Microsoft Sentinel resources, tutorials, and insights.

---

## ✨ Key Features

### 🎯 Intelligent Rule Development

- **Content-based detection** - Automatically identifies Sentinel rules by analyzing YAML content
- **Real-time validation** with instant feedback and error correction
- **Professional templates** for all rule types (Standard, Advanced, NRT, Behavior Analytics)
- **Multi-framework MITRE ATT&CK validation** - Enterprise, Mobile, and ICS frameworks
- **Smart IntelliSense** for all Sentinel fields and values

### 🔄 ARM Template Migration

- **Single and bulk conversion** from ARM templates to YAML
- **Multiple naming strategies** for organized file management
- **Comprehensive field mapping** with validation
- **Configurable conversion options** for enterprise needs
- **Progress tracking** and detailed conversion summaries

### 🛠️ Development Tools

- **Professional formatting** with field reordering and duration auto-correction
- **Live validation** in the Problems panel with rule-type-specific checks
- **Code snippets** and auto-completion
- **Entity mapping helpers** for all entity types
- **Workspace integration** for team collaboration

---

## 📈 Recent Updates

### v0.1.0 (2025-08-12)

#### ✨ New: Defender XDR Custom Detections

- Export, import, and list Defender XDR custom detections via Microsoft Graph (no PowerShell required).
- Service principal auth (client credentials) with secure secret storage; last-used clientId remembered.
- Commands:
  - Defender XDR: Configure Authentication
  - Defender XDR: Clear Authentication
  - Defender XDR: List Custom Detections
  - Defender XDR: Export Custom Detections
  - Defender XDR: Import Custom Detections
  - Defender XDR: Show Auth Status

#### 📊 Data

- Refreshed Microsoft Sentinel connectors dataset (updated counts and timestamp).


### v0.0.11 (2025-07-04)

#### ⚡ Performance & Security Enhancements

- **Optimized Validation Engine** - Significantly improved rule validation performance with streamlined data processing
- **Enhanced Security Framework** - Strengthened dependency management and updated security protocols
- **Updated Dependencies** - Latest security patches and compatibility improvements for all core libraries

#### 🔧 Infrastructure Improvements

- **Modernized Build Pipeline** - Updated CI/CD workflows for more reliable builds and releases
- **Enhanced Test Coverage** - Comprehensive test suite improvements ensuring higher code quality

#### 🎯 User Experience Refinements

- **Better Resource Management** - Optimized background processes for seamless development experience

[View Full Changelog](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Change-Log)

---

## 🚀 Quick Start

### Installation

1. **From VS Code Marketplace**: Search for "SentinelCodeGuard" in Extensions
2. **From Visual Studio Marketplace**: [SentinelCodeGuard](https://marketplace.visualstudio.com/items?itemName=noodlemctwoodle.sentinelcodeguard)
3. **Manual Installation**: Download `.vsix` from [GitHub Releases](https://github.com/noodlemctwoodle/SentinelCodeGuard/releases)

### Create Your First Rule

1. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. **Run**: `Sentinel: Generate Standard Rule Template`
3. **Edit the template** with real-time validation feedback
4. **Format automatically** with `Shift+Alt+F`

### Convert ARM Templates

1. **Right-click** any `.json` file containing ARM templates
2. **Select**: "Decompile ARM to YAML"
3. **Choose naming strategy** and output location
4. **Review conversion summary** with any warnings

---

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `Sentinel Rules: Generate Rule Template` | Interactive template creation workflow with multiple template types |
| `Sentinel Rules: Generate New Rule ID` | Generate new GUID for current rule |
| `Sentinel Rules: Generate New IDs for All Rules` | Bulk GUID regeneration for workspace |
| `Sentinel Rules: Fix Field Order` | Reorder fields according to best practices |
| `Sentinel Rules: Format Sentinel Rule` | Format and optimise rule structure |
| `Sentinel Rules: Bulk Maintenance & Validation` | Workspace-wide validation and maintenance |
| `Sentinel Rules: Decompile ARM to YAML` | Convert ARM templates to YAML |

### Defender XDR commands

| Command | Description |
|---------|-------------|
| `Defender XDR: Configure Authentication` | Set up service principal (tenant, client, secret) for Graph access |
| `Defender XDR: Clear Authentication` | Remove stored credentials |
| `Defender XDR: List Custom Detections` | Show existing custom detection rules |
| `Defender XDR: Export Custom Detections` | Export rules to JSON (single file or per-rule) |
| `Defender XDR: Import Custom Detections` | Import rules from JSON with duplicate handling |
| `Defender XDR: Show Auth Status` | View current auth configuration summary |

---

## 📋 Available Templates

| Template | Complexity | Use Case | Target Audience |
|----------|------------|----------|-----------------|
| **[Minimal](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Rule-Templates#minimal-template)** | ![Low](https://img.shields.io/badge/complexity-low-green) | Quick prototyping | New users, rapid testing |
| **[Standard](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Rule-Templates#standard-template)** | ![Medium](https://img.shields.io/badge/complexity-medium-yellow) | General detection | SOC analysts, security engineers |
| **[Advanced](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Rule-Templates#advanced-template)** | ![High](https://img.shields.io/badge/complexity-high-orange) | Complex correlation | Senior analysts, threat hunters |
| **[NRT](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Rule-Templates#near-real-time-template)** | ![Medium](https://img.shields.io/badge/complexity-medium-yellow) | Real-time alerts | Critical asset monitoring |
| **[Anomaly Detection](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Rule-Templates#anomaly-detection-template)** | ![High](https://img.shields.io/badge/complexity-high-orange) | Behavioural analysis | Advanced threat hunting |

---

## ⚡ Example Usage

### Content-Based Detection

**No special naming required!** Works with any YAML file containing Sentinel rule fields:

```text
detection-rules/
├── login-anomalies.yaml        # ✅ Auto-detected
├── data-exfiltration.yml       # ✅ Auto-detected  
├── rules/
│   ├── privilege-escalation.yaml  # ✅ Auto-detected
│   └── malware-detection.yaml     # ✅ Auto-detected
```

### Bulk ARM Conversion

Convert multiple rules from a single ARM template:

**Input**: `SecurityRules.json` (5 rules) → **Output**: 5 separate YAML files

- `suspicious_login_activity.yaml`
- `data_exfiltration_alert.yaml`
- `privilege_escalation.yaml`
- etc.

---

## 🎛️ Configuration

### Basic Settings

```json
{
  "sentinelRules.validation.enabled": true,
  "sentinelRules.formatting.enabled": true,
  "sentinelRules.conversion.defaultNamingStrategy": "displayName"
}
```

### Advanced Configuration

For comprehensive configuration options, see: **[Configuration Guide](https://github.com/noodlemctwoodle/SentinelCodeGuard/wiki/Configuration-Guide#advanced-conversion-settings)**

---

## 🆘 Support & Troubleshooting

### Resources

- **[Microsoft Sentinel Docs](https://docs.microsoft.com/azure/sentinel/)** - Official documentation
- **[MITRE ATT&CK](https://attack.mitre.org/)** - Framework reference
- **[KQL Reference](https://docs.microsoft.com/azure/data-explorer/kusto/query/)** - Query language docs

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](https://github.com/noodlemctwoodle/SentinelCodeGuard/blob/main/LICENSE.txt) for details.

---

**SentinelCodeGuard** - A development toolkit for Microsoft Sentinel Analytics Rules
