# OpenSort Windows Build Instructions

This document provides detailed instructions for building OpenSort for Windows on both x64 and ARM64 architectures.

## Prerequisites

Before building OpenSort for Windows, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **Python** (v3.9 or higher)
- **npm** or **yarn**
- **Git** (for cloning the repository)

## Dependencies Installation

1. Clone the repository:
```bash
git clone https://github.com/MeetSohailCodes/OpenSort.git
cd OpenSort
```

2. Install root dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd frontend && npm install
cd ..
```

4. Install backend dependencies:
```bash
cd backend
python -m venv venv
backend\venv\Scripts\activate  # On Windows
pip install -r requirements.txt
pip install pyinstaller
cd ..
```

## Building for Windows

### Automated Build (Recommended)

Use the automated build script to build for both architectures:

```bash
npm run build:win
```

This will:
1. Build the frontend
2. Package the Python backend using PyInstaller
3. Create Electron installers for both x64 and ARM64 architectures

### Manual Build Steps

If you prefer to build manually, follow these steps:

1. Build the frontend:
```bash
npm run build:frontend
```

2. Build the Python backend:
```bash
npm run build:backend
```

3. Build the Electron app for Windows:
```bash
npm run dist:win
```

## Build Output

After a successful build, you'll find the following in the `/dist` folder:

- `OpenSort Setup x.x.x.exe` - NSIS installer for Windows (both x64 and ARM64)
- Portable versions may also be created depending on configuration
- The installer includes both architectures and will install the correct one for the target system

## Architecture Support

- **x64**: Compatible with 64-bit Windows systems (most common)
- **ARM64**: Compatible with ARM64 Windows systems (Surface Pro X, newer Snapdragon devices)

The build process creates a universal installer that includes both architectures and installs the appropriate version for the target system.

## Build Configuration

The build is configured in `package.json` under the `build` section:

- Uses NSIS installer (professional setup wizard)
- Creates desktop and start menu shortcuts
- Allows users to change installation directory
- Includes the Python backend executable as extra resource
## Troubleshooting

### Common Issues

1. **PyInstaller not found**: Make sure to install PyInstaller in your Python environment:
   ```bash
   pip install pyinstaller
   ```

2. **Missing dependencies**: Ensure all Node.js and Python dependencies are installed:
   ```bash
   npm install
   cd backend && pip install -r requirements.txt
   ```

3. **Permission errors**: Run the build command as an administrator if encountering permission issues.

4. **Disk space**: Ensure you have at least 2GB of free disk space for the build process.

5. **File/Folder dialog not showing in built app**: This is usually related to Electron's security settings. The app now includes improved dialog handling with fallback mechanisms to ensure the folder selection dialog appears properly in both development and production builds.

### Advanced Configuration


The PyInstaller configuration is in `backend/main.spec` and includes:
- Required Python modules for FastAPI and file operations
- Data files needed for the application
- Optimized settings for minimal executable size

The Electron Builder configuration in `package.json` sets up:
- Multi-architecture support
- NSIS installer generation
- Proper file bundling
- Icon integration

## Release Preparation

Before releasing:

1. Test the installer on clean Windows systems
2. Verify both x64 and ARM64 installations work properly
3. Ensure the Python backend starts correctly
4. Test file organization functionality
5. Verify uninstallation works properly

## Building Specific Architectures

To build only a specific architecture:

- For x64 only: `electron-builder --win --x64`
- For ARM64 only: `electron-builder --win --arm64`

## Code Signing (Optional)

For distribution, you may want to sign the executable with a certificate:

1. Obtain a code signing certificate
2. Update the build configuration in package.json to include your certificate information
3. Build as usual - electron-builder will handle code signing

## Size Optimization

The build process includes optimization:
- UPX compression for the Python executable
- Maximum compression for the installer
- Removal of unnecessary files
- Tree-shaking for JavaScript bundles

## Verifying Builds

After building, verify:

1. Installer runs correctly
2. Application launches without errors
3. Python backend connects properly
4. File organization features work as expected
5. All UI elements display correctly

## Continuous Integration

For CI/CD pipelines, use the `build-windows.js` script which automates the entire process and provides detailed logging.