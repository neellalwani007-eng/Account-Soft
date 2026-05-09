# AccountSoft – Build Your Desktop Installer

## What this does

Running `BUILD.bat` once on your Windows PC creates `AccountSoft Setup 1.0.0.exe` — a standard Windows installer you can share with anyone. People who install it **do not need Node.js or any other software**.

---

## Step-by-Step Instructions

### Before you begin

Make sure these are installed on your Windows PC (you already have them):
- **Node.js** v18 or newer — https://nodejs.org
- **Git** (optional, not required)

---

### Step 1 — Copy the electron-app folder

Copy the entire `electron-app` folder into your `D:\Lite-Ledger\` folder.

Your folder should look like this:
```
D:\Lite-Ledger\
├── artifacts\
├── electron-app\         ← this folder
│   ├── BUILD.bat
│   ├── build-server-bundle.mjs
│   ├── electron-server-entry.ts
│   ├── package.json
│   └── src\
│       ├── main.cjs
│       └── preload.cjs
├── package.json
├── pnpm-workspace.yaml
└── ...
```

---

### Step 2 — Run BUILD.bat

1. Open `D:\Lite-Ledger\electron-app\`
2. Double-click **BUILD.bat**
3. A command window opens — let it run (5–10 minutes)

What it does automatically:
- Fixes all Windows compatibility issues
- Installs all dependencies fresh
- Builds the React web interface
- Bundles the database server
- Packages everything into a Windows installer

---

### Step 3 — Find your installer

When the build finishes, Windows Explorer opens automatically at:
```
D:\Lite-Ledger\electron-app\dist\
```

Your installer file is: **`AccountSoft Setup 1.0.0.exe`**

---

### Step 4 — Install AccountSoft

Double-click `AccountSoft Setup 1.0.0.exe` to install.

- Installs to `C:\Program Files\AccountSoft\`
- Creates a Desktop shortcut automatically
- Creates a Start Menu entry

---

### Step 5 — Launch the app

Double-click **AccountSoft** on your Desktop.

The app opens as a normal Windows desktop application — no browser, no servers to manage, no command windows.

---

## Sharing with others

Send `AccountSoft Setup 1.0.0.exe` to anyone. They:
1. Double-click it to install
2. Double-click the Desktop shortcut to run
3. Their data is stored in `C:\Users\<name>\AppData\Roaming\AccountSoft\data\`

Each person has their own separate data — there is no shared server.

---

## Troubleshooting

**BUILD.bat fails at Step 5 (frontend build)**
→ Make sure `D:\Lite-Ledger\artifacts\account-soft\` exists and has `vite.config.ts`

**BUILD.bat fails at Step 6 (server bundle)**
→ Make sure `D:\Lite-Ledger\artifacts\api-server\src\app.ts` exists

**BUILD.bat fails at Step 8 (electron-rebuild)**
→ Install Visual Studio Build Tools from https://visualstudio.microsoft.com/visual-cpp-build-tools/
→ Select "Desktop development with C++" and retry

**App opens but shows blank screen**
→ The database or frontend files may not have bundled correctly. Run BUILD.bat again.
