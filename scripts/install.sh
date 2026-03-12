#!/usr/bin/env bash
# crayon bootstrap installer
# Usage: curl -fsSL https://raw.githubusercontent.com/timescale/crayon/main/scripts/install.sh | bash
{

set -euo pipefail

# ── Colors (disabled if not a terminal) ──────────────────────────────────────

if [ -t 2 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' MAGENTA='' BOLD='' DIM='' RESET=''
fi

info()    { printf "${CYAN}  ...${RESET}  %s\n" "$*" >&2; }
success() { printf "${GREEN}  OK${RESET}  %s\n" "$*" >&2; }
warn()    { printf "${YELLOW}  !!${RESET}  %s\n" "$*" >&2; }
error()   { printf "${RED}  !!${RESET}  %s\n" "$*" >&2; }
fatal()   { error "$@"; exit 1; }
step()    { printf "\n${BOLD}%s${RESET}\n" "$*" >&2; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

# ── Banner ───────────────────────────────────────────────────────────────────

print_banner() {
  printf '\n' >&2
  printf '%b%s%b\n' "$RED"     '   ___ _ __ __ _ _   _  ___  _ __'    "$RESET" >&2
  printf '%b%s%b\n' "$YELLOW"  "  / __| '__/ _\` | | | |/ _ \\| '_ \\" "$RESET" >&2
  printf '%b%s%b\n' "$GREEN"   ' | (__| | | (_| | |_| | (_) | | | |'  "$RESET" >&2
  printf '%b%s%b\n' "$CYAN"    '  \___|_|  \__,_|\__, |\___/|_| |_|'  "$RESET" >&2
  printf '%b%s%b\n' "$MAGENTA" '                 |___/'                "$RESET" >&2
  printf '\n' >&2
}

# ── OS detection ─────────────────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Darwin*) OS="macos" ;;
    Linux*)  OS="linux" ;;
    *)       fatal "Unsupported operating system: $(uname -s). Only macOS and Linux are supported." ;;
  esac
}

# ── Step 1: Node.js ─────────────────────────────────────────────────────────

install_node() {
  step "Step 1/3: Node.js"

  if has_cmd node; then
    local node_version node_major
    node_version=$(node --version 2>/dev/null | sed 's/^v//')
    node_major=$(echo "$node_version" | cut -d. -f1)
    if [ "$node_major" -ge 20 ] 2>/dev/null; then
      success "Node.js v${node_version} found"
      return 0
    else
      warn "Node.js v${node_version} found, but v20+ is required"
    fi
  fi

  info "Installing Node.js via nvm..."

  # Install nvm (idempotent — safe to re-run)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

  # Load nvm into current session
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"

  nvm install 24

  if has_cmd node && has_cmd npx; then
    success "Node.js $(node --version) installed"
  else
    fatal "Node.js installation failed. Install manually: https://nodejs.org"
  fi
}

# ── Step 3: Claude Code CLI ─────────────────────────────────────────────────

install_claude() {

  if has_cmd claude; then
    success "Claude Code CLI found"
    return 0
  fi

  info "Installing Claude Code CLI..."
  curl -fsSL https://claude.ai/install.sh | bash

  # The installer may not update PATH in the current session — probe known locations
  for dir in "${HOME}/.claude/local/bin" "${HOME}/.local/bin" "/usr/local/bin"; do
    if [ -x "${dir}/claude" ]; then
      export PATH="${dir}:${PATH}"
      break
    fi
  done

  if has_cmd claude; then
    success "Claude Code CLI installed"
  else
    fatal "Claude Code CLI installation failed. Install manually: https://claude.ai/code"
  fi
}

# ── CLI script ───────────────────────────────────────────────────────────────

setup_script() {
  local bin_dir="${HOME}/.local/bin"
  local script_path="${bin_dir}/crayon"

  mkdir -p "$bin_dir"

  cat > "$script_path" << 'SCRIPT'
#!/usr/bin/env sh
exec npx -y --prefer-online --loglevel=error runcrayon@dev "$@"
SCRIPT
  chmod +x "$script_path"

  # Ensure ~/.local/bin is in PATH
  if echo "$PATH" | tr ':' '\n' | grep -qx "$bin_dir"; then
    success "~/.local/bin already in PATH"
  else
    PATH_UPDATED=true
    local rc_file
    case "$(basename "${SHELL:-/bin/bash}")" in
      zsh)  rc_file="${HOME}/.zshrc" ;;
      *)    rc_file="${HOME}/.bashrc" ;;
    esac

    if ! grep -qF '/.local/bin' "$rc_file" 2>/dev/null; then
      printf '\n# crayon CLI\nexport PATH="${HOME}/.local/bin:${PATH}"\n' >> "$rc_file"
      success "Added ~/.local/bin to PATH in ${rc_file}"
    else
      success "~/.local/bin already in PATH via ${rc_file}"
    fi

    export PATH="${bin_dir}:${PATH}"
  fi

  # Clean up old alias from rc files if present
  for rc in "${HOME}/.zshrc" "${HOME}/.bashrc" "${HOME}/.bash_profile"; do
    if grep -qF "alias crayon=" "$rc" 2>/dev/null; then
      local tmp
      tmp=$(mktemp)
      grep -vF "alias crayon=" "$rc" | grep -vF "# crayon CLI alias" > "$tmp"
      mv "$tmp" "$rc"
    fi
  done

  success "Installed crayon to ${script_path}"
}

# ── Main ─────────────────────────────────────────────────────────────────────

PATH_UPDATED=false

main() {
  print_banner
  detect_os

  printf "${DIM}  Detected: %s (%s)${RESET}\n" "$OS" "$(uname -m)" >&2

  install_node

  step "Step 2/3: Crayon CLI"
  setup_script

  step "Step 3/3: Claude Code CLI"
  install_claude

  printf "\n"
  printf "${GREEN}${BOLD}  Installation complete!${RESET}\n\n" >&2
  printf "${BOLD}  To get started, run:${RESET}\n\n" >&2
  if $PATH_UPDATED; then
    printf "${CYAN}    export PATH=\"\${HOME}/.local/bin:\${PATH}\"; crayon cloud run${RESET}\n\n" >&2
  else
    printf "${CYAN}    crayon cloud run${RESET}\n\n" >&2
  fi
}

main "$@"

}
