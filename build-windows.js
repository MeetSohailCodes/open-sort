const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = __dirname;
const BACKEND_PATH = path.join(PROJECT_ROOT, 'backend');
const FRONTEND_PATH = path.join(PROJECT_ROOT, 'frontend');

console.log('🚀 Starting OpenSort Windows Multi-Architecture Build Process...\n');

try {
  // Step 1: Build frontend
  console.log('📦 Building frontend...');
  execSync('npm run build', { cwd: FRONTEND_PATH, stdio: 'inherit' });
  console.log('✅ Frontend build completed.\n');

  // Step 2: Build backend for Windows
  console.log('⚙️  Building Python backend...');
  
  // Check if PyInstaller is installed
  try {
    execSync('python -c "import PyInstaller"', { cwd: BACKEND_PATH });
    console.log('✅ PyInstaller is available.');
  } catch (error) {
    console.log('⚠️  Installing PyInstaller...');
    execSync('pip install pyinstaller', { cwd: BACKEND_PATH, stdio: 'inherit' });
  }

  // Run PyInstaller with the spec file
  execSync('python -m PyInstaller --clean main.spec', { cwd: BACKEND_PATH, stdio: 'inherit' });
  console.log('✅ Backend build completed.\n');

  // Step 3: Verify backend executable exists
  const backendExePath = path.join(BACKEND_PATH, 'dist', 'main.exe');
  if (!fs.existsSync(backendExePath)) {
    throw new Error('Backend executable was not created properly!');
  }
  console.log('✅ Backend executable verified.\n');

  // Step 4: Build Electron app for both architectures
  console.log('🔨 Building Electron app for Windows (x64 and arm64)...');
  
  // Set environment variable to enable multi-arch build
  const env = { ...process.env, ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true' };
  
  execSync('npm run dist:win', { 
    cwd: PROJECT_ROOT, 
    stdio: 'inherit',
    env: env
  });
  
  console.log('✅ Electron build completed for both architectures.\n');

  // Step 5: Verify output
  const distPath = path.join(PROJECT_ROOT, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log('📁 Build outputs:');
    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stat = fs.statSync(filePath);
      console.log(`   📄 ${file} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
    });
  }

  console.log('\n🎉 OpenSort Windows build process completed successfully!');
  console.log('   The installer and portable versions are located in the /dist folder.');
  console.log('   Both x64 and arm64 architectures have been built.');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}