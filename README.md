# SSH Tool

Desktop SSH client for connecting to remote servers, browsing files over SFTP,
editing remote files, running commands, and monitoring system usage from one
Electron application.

## How It Works

SSH Tool is built as an Electron desktop app with two main parts:

- **Main process:** handles privileged operations such as SSH connections,
  SFTP access, credential encryption, local storage, file dialogs, and IPC
  handlers.
- **Renderer process:** provides the React UI for server management, terminal
  tabs, file explorer, editor, quick commands, and system monitoring.

The renderer does not access Node.js APIs directly. Instead, `main/preload.js`
exposes a controlled `window.electronAPI` bridge using Electron's context
bridge. React components call this API, and the main process performs the
actual SSH, SFTP, storage, and encryption work.

Connection data is stored locally through `electron-store`. Sensitive fields
such as passwords and private keys are encrypted before being saved. A master
password unlocks the credential vault for the current app session.

When a server connection is opened, the main process creates an SSH session
using `ssh2` and returns a session ID to the renderer. That session ID is then
used for:

- opening interactive shell streams for terminal tabs
- executing one-off commands
- creating or reusing SFTP clients
- reading, writing, renaming, deleting, uploading, and downloading remote files
- polling remote system statistics

Remote terminal data is streamed from the SSH shell back to the renderer through
IPC events and displayed with xterm.js. Remote files are loaded through SFTP and
edited in Monaco Editor. Saving a file writes the updated content back to the
remote path and creates a `.bak` backup when applicable.

## Features

- Saved SSH server profiles
- Password and private-key authentication
- Master-password protected credential vault
- AES-256-GCM encryption for stored credentials
- Local portable data directory support for packaged builds
- Interactive SSH terminal tabs
- Terminal resize synchronization with the remote shell
- One-off remote command execution
- User-defined quick actions for reusable commands
- Optional working directory support for quick actions
- Remote file explorer over SFTP
- Lazy-loaded remote directory tree
- Remote file open/edit/save workflow
- Monaco Editor integration with syntax detection by filename or extension
- Dirty-state tracking for modified files
- Backup creation before remote file writes
- Remote file and folder creation
- Remote rename and delete operations
- File upload and download through native Electron dialogs
- Remote system monitor panel
- CPU, memory, swap, disk, network, uptime, load average, and process views
- Configurable polling interval for system metrics
- Pause/resume and manual refresh controls for monitoring
- Toast notifications for success, warning, and error states
- Custom frameless desktop window with app-level window controls
