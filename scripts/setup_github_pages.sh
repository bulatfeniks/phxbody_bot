#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is required. Install https://cli.github.com/ and authenticate." >&2
  exit 1
fi

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [[ -z "${repo}" ]]; then
  echo "Error: unable to determine repository. Run inside a git repo with gh auth." >&2
  exit 1
fi

pages_args=(-f build_type=workflow -f source[branch]=main -f source[path]=/)
if gh api "repos/${repo}/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/${repo}/pages" "${pages_args[@]}" >/dev/null
else
  gh api -X POST "repos/${repo}/pages" "${pages_args[@]}" >/dev/null
fi

echo "GitHub Pages source set to GitHub Actions for ${repo}."

if [[ "${1:-}" == "--api-base" ]]; then
  api_base=${2:-}
  if [[ -z "${api_base}" ]]; then
    echo "Error: --api-base requires a URL." >&2
    exit 1
  fi
  if ! gh api -X PATCH "repos/${repo}/actions/variables/PHX_API_BASE_URL" -f value="${api_base}" >/dev/null 2>&1; then
    gh api -X POST "repos/${repo}/actions/variables" -f name=PHX_API_BASE_URL -f value="${api_base}" >/dev/null
  fi
  echo "Repository variable PHX_API_BASE_URL set."
fi

echo "Next: push to main to publish the frontend via GitHub Pages."
